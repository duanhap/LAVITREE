import io
import base64
import logging
import warnings
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Query, HTTPException
from PIL import Image

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# Chống Decompression Bomb
Image.MAX_IMAGE_PIXELS = 10_000_000
warnings.simplefilter("error", Image.DecompressionBombWarning)

def _generate_stub_gradcam_base64() -> str:
    try:
        sample_img = Image.new("RGB", (224, 224), color=(34, 139, 34))
        buf = io.BytesIO()
        sample_img.save(buf, format="JPEG")
        return f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"
    except Exception:
        return "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="

STUB_GRADCAM_BASE64 = _generate_stub_gradcam_base64()

@router.post("/predict")
async def predict_plant_disease(
    file: UploadFile = File(...),
    include_heatmap: bool = Query(True, description="Có xuất ảnh Grad-CAM không"),
    mock_ood: bool = Query(False, description="Tùy chọn giả lập phản hồi OOD cho testing")
):
    # 1. Kiểm tra định dạng tệp (MIME type)
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Tệp vượt quá 10MB hoặc định dạng không hỗ trợ."
        )

    # 2. Đọc và kiểm tra kích thước tệp
    contents = await file.read()
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

    # 4. Stub Response theo api-contracts.md Mục 2.1
    # Giả lập OOD nếu param mock_ood=True hoặc tên file chứa 'ood', 'hand', 'desk'
    filename_lower = (file.filename or "").lower()
    is_simulated_ood = mock_ood or any(k in filename_lower for k in ("ood", "hand", "desk"))

    if is_simulated_ood:
        return {
            "success": True,
            "top1": None,
            "top3": [],
            "is_ood": True,
            "is_uncertain": False,
            "warning_message": "Ảnh nằm ngoài phạm vi 38 lớp cây trồng được hỗ trợ (OOD). Vui lòng không chụp vật thể lạ hoặc ảnh không rõ lá cây.",
            "gradcam_base64": None,
            "inference_time_ms": 110
        }

    # Trường hợp In-Distribution chuẩn (Tomato___Late_blight)
    return {
        "success": True,
        "top1": {
            "class_code": "Tomato___Late_blight",
            "plant_name": "Cà chua",
            "disease_name": "Bệnh mốc sương cà chua",
            "confidence": 0.9462,
            "confusion_group": None
        },
        "top3": [
            {"class_code": "Tomato___Late_blight", "confidence": 0.9462},
            {"class_code": "Tomato___Early_blight", "confidence": 0.0315},
            {"class_code": "Tomato___Septoria_leaf_spot", "confidence": 0.0102}
        ],
        "is_ood": False,
        "is_uncertain": False,
        "warning_message": "Chụp kỹ cả mặt dưới lá để thấy lớp mốc trắng.",
        "gradcam_base64": STUB_GRADCAM_BASE64 if include_heatmap else None,
        "inference_time_ms": 320
    }

