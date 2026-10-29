import os
import logging
from typing import Optional, Dict, Any, Tuple
from PIL import Image
import numpy as np
import cv2
import torch

from pathlib import Path
from dotenv import load_dotenv

from .class_mapping import class_mapping_service

# Nạp cấu hình từ .env (ưu tiên backend/ai-service/.env hoặc root repo .env)
BASE_AI_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(dotenv_path=BASE_AI_DIR / ".env")
load_dotenv(dotenv_path=BASE_AI_DIR.parent.parent / ".env")

logger = logging.getLogger(__name__)

def calculate_vegetation_ratio(image: Image.Image) -> float:
    """
    Tầng 1 (Tín hiệu sơ bộ - Heuristic Vegetation Pre-check):
    Kiểm tra tỷ lệ pixel màu thực vật qua không gian màu HSV và chỉ số ExG (2G - R - B).
    Mục đích: Loại bỏ nhanh các ảnh không có thực vật (màn hình đen, mặt bàn, tờ giấy, ảnh tối).
    LƯU Ý: Không dùng để khẳng định ảnh có lá hay không (vì lá vàng, lá cháy nâu vẫn là lá hợp lệ).
    """
    try:
        rgb_image = image.convert("RGB")
        img_np = np.array(rgb_image)
        h, w = img_np.shape[:2]
        total_pixels = h * w
        if total_pixels == 0:
            return 0.0

        # 1. Chuyển sang không gian HSV: Hue dải xanh lá (OpenCV Hue 25-100 tương đương 50-200 độ)
        hsv = cv2.cvtColor(img_np, cv2.COLOR_RGB2HSV)
        lower_green = np.array([25, 30, 30], dtype=np.uint8)
        upper_green = np.array([100, 255, 255], dtype=np.uint8)
        mask_hsv = cv2.inRange(hsv, lower_green, upper_green)

        # 2. Chỉ số thực vật Excess Green Index: ExG = 2*G - R - B
        img_float = img_np.astype(np.float32)
        r = img_float[:, :, 0]
        g = img_float[:, :, 1]
        b = img_float[:, :, 2]
        exg = 2.0 * g - r - b
        mask_exg = (exg > 10.0) & (g > 35.0)

        # Kết hợp cả 2 tín hiệu (Logical OR)
        combined_mask = (mask_hsv > 0) | mask_exg
        vegetation_pixels = np.count_nonzero(combined_mask)

        return float(vegetation_pixels) / float(total_pixels)
    except Exception as e:
        logger.warning("Lỗi tính toán vegetation_ratio: %s", e)
        return 0.0


def calculate_energy_score(logits: torch.Tensor, temperature: float = 1.0) -> float:
    """
    Tầng 2 (Lõi OOD - Energy-based OOD Score trên Logits):
    Tính điểm Energy Score S_energy(x) = T * log(sum(exp(f_i(x) / T)))
    theo nghiên cứu của Liu et al. (NeurIPS 2020).
    Mẫu thuộc phân phối (In-Distribution) có Energy cao, mẫu ngoại lai (OOD) có Energy thấp.
    """
    if logits.dim() == 1:
        logits = logits.unsqueeze(0)
    
    # torch.logsumexp tương đương log(sum(exp(logits / T)))
    energy = temperature * torch.logsumexp(logits / temperature, dim=-1)
    return float(energy[0].item())


class OODFilter:
    def __init__(self, temperature: float = 1.0):
        self.temperature = temperature
        self.energy_threshold: Optional[float] = None
        self._load_threshold()

    def _load_threshold(self) -> None:
        """
        Nạp ngưỡng từ biến môi trường OOD_ENERGY_THRESHOLD.
        Nếu chưa cấu hình: Tắt kiểm tra Energy (is_ood = false) và ghi log cảnh báo.
        Không đặt ngưỡng cứng trong code.
        """
        env_val = os.getenv("OOD_ENERGY_THRESHOLD")
        if env_val is not None and env_val.strip() != "":
            try:
                self.energy_threshold = float(env_val.strip())
                logger.info(
                    "OODFilter đã kích hoạt Energy-based Score với ngưỡng tau = %.4f (T = %.1f)",
                    self.energy_threshold,
                    self.temperature,
                )
            except ValueError:
                logger.warning(
                    "Giá trị OOD_ENERGY_THRESHOLD='%s' không hợp lệ. Tắt kiểm tra Energy-based OOD.",
                    env_val,
                )
                self.energy_threshold = None
        else:
            logger.warning(
                "Biến môi trường OOD_ENERGY_THRESHOLD chưa được cấu hình. "
                "Tắt kiểm tra Energy-based OOD (is_ood=False) cho đến khi được cấu hình."
            )
            self.energy_threshold = None

    def evaluate(
        self,
        logits: torch.Tensor,
        pil_image: Image.Image,
        confidence: float,
        top1_class_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Đánh giá kết hợp 2 tầng OOD và Softmax Uncertainty theo Decision Fusion Policy:
        1. Nếu is_ood = true (Energy Score < tau): Từ chối chẩn đoán.
        2. Nếu is_ood = false nhưng vegetation_ratio < 5% và confidence < 0.70: Cảnh báo tỷ lệ lá thấp.
        3. Nếu is_ood = false, confidence < 0.70 và vegetation_ratio >= 5%: Cảnh báo bất định mô hình.
        4. Nếu is_ood = false và confidence >= 0.70: Chấp thuận dự đoán, sinh cảnh báo dễ nhầm / mẹo chụp.
        """
        energy_score = calculate_energy_score(logits, temperature=self.temperature)
        vegetation_ratio = calculate_vegetation_ratio(pil_image)

        # 1. Xác định cờ is_ood
        if self.energy_threshold is not None:
            is_ood = bool(energy_score < self.energy_threshold)
        else:
            is_ood = False

        # Lấy thông tin lớp Top-1 nếu có
        top1_info = class_mapping_service.get_class_info(top1_class_code) if top1_class_code else None
        confusion_group = top1_info.get("confusion_group") if top1_info else None
        capture_tip = top1_info.get("capture_tip") if top1_info else None

        # 2. Decision Fusion Policy
        if is_ood:
            # Trường hợp 1: OOD (Vật thể ngoại lai)
            return {
                "is_ood": True,
                "is_uncertain": False,
                "confusion_group": None,
                "warning_message": "Ảnh nằm ngoài phạm vi 38 lớp cây trồng được hỗ trợ (OOD). Vui lòng không chụp vật thể lạ.",
                "energy_score": energy_score,
                "vegetation_ratio": vegetation_ratio,
            }

        # Xác định độ bất định của Softmax (confidence < 0.70)
        is_uncertain = bool(confidence < 0.70)

        if is_uncertain and vegetation_ratio < 0.05:
            # Trường hợp 2: Tỷ lệ lá thấp và confidence < 0.70
            warning_message = "Ảnh có tỷ lệ lá thấp và độ tin cậy chưa tối ưu, vui lòng căn chỉnh lá vào đúng khung ngắm."
        elif is_uncertain and vegetation_ratio >= 0.05:
            # Trường hợp 3: Ảnh lá thật nhưng mô hình phân vân
            base_msg = "Mô hình chưa hoàn toàn chắc chắn về loại bệnh này. Khuyến nghị chụp lại cận cảnh vết bệnh dưới đủ ánh sáng."
            warning_message = f"{base_msg} {capture_tip}" if capture_tip else base_msg
        else:
            # Trường hợp 4: Chấp thuận dự đoán (confidence >= 0.70)
            if confusion_group and top1_class_code:
                warning_message = class_mapping_service.format_confusion_warning(top1_class_code, capture_tip)
            else:
                warning_message = capture_tip

        return {
            "is_ood": False,
            "is_uncertain": is_uncertain,
            "confusion_group": confusion_group,
            "warning_message": warning_message,
            "energy_score": energy_score,
            "vegetation_ratio": vegetation_ratio,
        }


# Singleton instance
ood_filter = OODFilter()
