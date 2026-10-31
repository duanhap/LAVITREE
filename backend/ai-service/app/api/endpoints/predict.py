import io
import os
import sys
import logging
import warnings
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Query, HTTPException
from PIL import Image

from app.services.predictor import predictor

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# Cờ kiểm thử cho phép mock OOD (chỉ bật khi cấu hình môi trường test hoặc chạy trong pytest, chống cửa hậu production)
ALLOW_MOCK_OOD = os.getenv("ALLOW_MOCK_OOD", "false").lower() in ("true", "1", "yes") or "pytest" in sys.modules

# Chống tấn công Decompression Bomb
Image.MAX_IMAGE_PIXELS = 10_000_000
warnings.simplefilter("error", Image.DecompressionBombWarning)


@router.post("/predict")
def predict_plant_disease(
    file: UploadFile = File(..., description="Tệp hình ảnh lá cây (JPEG, PNG, WEBP, BMP <= 10MB)"),
    include_heatmap: bool = Query(True, description="Có xuất ảnh Grad-CAM không"),
    mock_ood: bool = Query(False, description="Tùy chọn giả lập phản hồi OOD cho testing")
):
    # 1. Kiểm tra định dạng tệp (MIME type)
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Tệp vượt quá 10MB hoặc định dạng không hỗ trợ."
        )

    # 2. Đọc và kiểm tra kích thước tệp (đồng bộ trong threadpool)
    contents = file.file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Tệp vượt quá 10MB hoặc định dạng không hỗ trợ."
        )

    # 3. Xác thực ảnh bằng Pillow (chống MIME spoofing và Decompression Bomb)
    try:
        verify_img = Image.open(io.BytesIO(contents))
        verify_img.verify()
    except (Image.DecompressionBombError, Exception) as exc:
        logger.warning("Lỗi giải mã ảnh khi verify: %s", exc)
        raise HTTPException(
            status_code=422,
            detail="Tệp hình ảnh bị lỗi cấu trúc hoặc không thể giải mã."
        )

    # 4. Mở lại ảnh bằng luồng byte mới sau verify để tránh lỗi đóng luồng của Pillow
    try:
        pil_image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as exc:
        logger.warning("Lỗi mở lại luồng ảnh sau verify: %s", exc)
        raise HTTPException(
            status_code=422,
            detail="Tệp hình ảnh bị lỗi cấu trúc hoặc không thể giải mã."
        )

    # 5. Tùy chọn mock OOD nếu param mock_ood=True (chỉ hoạt động khi ALLOW_MOCK_OOD=true)
    if mock_ood:
        if not ALLOW_MOCK_OOD:
            logger.warning("Yêu cầu mock_ood bị từ chối vì ALLOW_MOCK_OOD không bật. Chuyển sang suy luận thực tế.")
        else:
            return {
                "success": True,
                "top1": None,
                "top3": [],
                "is_ood": True,
                "is_uncertain": False,
                "warning_message": "Ảnh nằm ngoài phạm vi 38 lớp cây trồng được hỗ trợ (OOD). Vui lòng không chụp vật thể lạ hoặc ảnh không rõ lá cây.",
                "gradcam_base64": None,
                "inference_time_ms": 10
            }

    # 6. Suy luận thực tế bằng ResNet-18 + OOD Filter (Try/catch ẩn str(e) bảo mật)
    try:
        result = predictor.predict(pil_image, include_heatmap=include_heatmap)
        return result
    except Exception as exc:
        logger.error("Lỗi nội bộ khi thực hiện suy luận mô hình: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Đã xảy ra lỗi trong quá trình xử lý hình ảnh. Vui lòng thử lại với ảnh khác."
        )

