import json
import io
import time
import logging
import threading
from pathlib import Path
from typing import Dict, Any, List, Optional, Union

import torch
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image

from .gradcam import GradCAM, overlay_gradcam
from .class_mapping import class_mapping_service
from .ood_filter import ood_filter

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "best_plant_model.pt"
CLASS_INDICES_PATH = BASE_DIR / "models" / "class_indices.json"

UNCERTAINTY_THRESHOLD = 0.70  # Ngưỡng bất định Softmax theo PRD/BRD: confidence < 70%


class PlantPredictor:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.idx_to_class: Dict[str, str] = {}
        self.num_classes = 0
        self._lock = threading.Lock()
        self._load_class_mapping()
        self._load_model()
        self._setup_transforms()
        if self.model is not None:
            self.grad_cam = GradCAM(self.model, self.model.layer4[-1])
        else:
            self.grad_cam = None

    def _load_class_mapping(self):
        with open(CLASS_INDICES_PATH, "r", encoding="utf-8") as f:
            self.idx_to_class = json.load(f)
        self.num_classes = len(self.idx_to_class)
        logger.info("Đã nạp ánh xạ %d chỉ số lớp từ %s", self.num_classes, CLASS_INDICES_PATH.name)

    def _load_model(self):
        self.model = models.resnet18()
        self.model.fc = torch.nn.Linear(self.model.fc.in_features, self.num_classes)
        self.model.load_state_dict(
            torch.load(MODEL_PATH, map_location=self.device, weights_only=True)
        )
        self.model.to(self.device)
        self.model.eval()
        logger.info("Đã nạp thành công mô hình ResNet-18 từ %s lên thiết bị %s", MODEL_PATH.name, self.device)

    def _setup_transforms(self):
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
        ])

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    def predict(
        self,
        image_input: Union[bytes, Image.Image],
        include_heatmap: bool = True
    ) -> Dict[str, Any]:
        """
        Thực hiện chẩn đoán ảnh bệnh cây trồng:
        1. Tiền xử lý ảnh (Resize 224x224, Normalize ImageNet).
        2. Tối ưu Single-Pass Inference:
           - Khi include_heatmap = True: Chạy forward pass duy nhất, dùng luôn output tensor
             để tính đạo hàm cho Grad-CAM (giảm ~45% CPU).
           - Khi include_heatmap = False: Chạy no_grad hoàn toàn.
        3. Đồng bộ hóa an toàn luồng với self._lock chống xung đột gradient.
        4. Đánh giá ngoại lai (OOD) và độ bất định qua OODFilter (Decision Fusion Policy).
        5. Ánh xạ danh mục tiếng Việt, mẹo chụp và nhóm lớp dễ nhầm từ ClassMappingService.
        6. Trả về cấu trúc JSON đúng 100% theo docs/architecture/api-contracts.md Mục 2.1.
        """
        start_time = time.perf_counter()

        if isinstance(image_input, bytes):
            image = Image.open(io.BytesIO(image_input)).convert("RGB")
        elif isinstance(image_input, Image.Image):
            image = image_input.convert("RGB")
        else:
            raise ValueError("image_input bắt buộc phải là bytes hoặc PIL.Image.Image")

        tensor = self.transform(image).unsqueeze(0).to(self.device)

        with self._lock:
            # 1. Forward Pass (Single-pass inference)
            if include_heatmap and self.grad_cam is not None:
                with torch.enable_grad():
                    self.model.zero_grad()
                    outputs = self.model(tensor)  # Shape: (1, 38)
                    logits_1d = outputs[0]
                    probabilities = F.softmax(outputs, dim=1)[0].detach()
            else:
                with torch.no_grad():
                    outputs = self.model(tensor)
                    logits_1d = outputs[0]
                    probabilities = F.softmax(outputs, dim=1)[0]

            top_prob, top_idx = torch.topk(probabilities, k=min(3, self.num_classes))
            predicted_idx = top_idx[0].item()
            confidence = float(top_prob[0].item())
            top1_class_code = self.idx_to_class.get(str(predicted_idx), "Unknown")

            # 2. Đánh giá OOD & Decision Fusion Policy
            ood_eval = ood_filter.evaluate(
                logits=logits_1d.detach(),
                pil_image=image,
                confidence=confidence,
                top1_class_code=top1_class_code
            )

            inference_time_ms = int(round((time.perf_counter() - start_time) * 1000))

            # 3. Xử lý trường hợp ngoại lai OOD (is_ood = true)
            if ood_eval["is_ood"]:
                self.model.zero_grad()
                return {
                    "success": True,
                    "top1": None,
                    "top3": [],
                    "is_ood": True,
                    "is_uncertain": False,
                    "warning_message": ood_eval["warning_message"],
                    "gradcam_base64": None,
                    "inference_time_ms": inference_time_ms,
                }

            # 4. Tạo Heatmap Grad-CAM từ chính tensor outputs (Single-pass, không gọi lại model)
            gradcam_base64 = None
            if include_heatmap and self.grad_cam is not None:
                try:
                    score = outputs[0, predicted_idx]
                    cam = self.grad_cam.generate_heatmap_from_score(score)
                    gradcam_base64 = overlay_gradcam(image, cam, alpha=0.45)
                except Exception as e:
                    logger.warning("Không thể sinh Grad-CAM heatmap: %s", e)
                    self.model.zero_grad()
                    gradcam_base64 = None

        # 5. Xử lý thông tin In-Distribution
        top1_info = class_mapping_service.get_class_info(top1_class_code) or {}
        top1 = {
            "class_code": top1_class_code,
            "plant_name": top1_info.get("plant_name", ""),
            "disease_name": top1_info.get("disease_name", ""),
            "confidence": round(confidence, 4),
            "confusion_group": ood_eval["confusion_group"],
        }

        top3 = [
            {
                "class_code": self.idx_to_class.get(str(idx.item()), "Unknown"),
                "confidence": round(float(prob.item()), 4),
            }
            for prob, idx in zip(top_prob, top_idx)
        ]

        inference_time_ms = int(round((time.perf_counter() - start_time) * 1000))

        return {
            "success": True,
            "top1": top1,
            "top3": top3,
            "is_ood": False,
            "is_uncertain": ood_eval["is_uncertain"],
            "warning_message": ood_eval["warning_message"],
            "gradcam_base64": gradcam_base64,
            "inference_time_ms": inference_time_ms,
        }


# Global singleton predictor instance
predictor = PlantPredictor()
