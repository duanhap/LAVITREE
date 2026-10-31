import io
import base64
import logging
from typing import Optional
from fastapi import FastAPI, APIRouter, UploadFile, File, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

logger = logging.getLogger("mock_ai_service")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Lavitree AI Vision Service (Test Server)", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
MAX_FILE_SIZE = 10 * 1024 * 1024

# Tiny 1x1 jpeg base64
DUMMY_GRADCAM = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="

@app.get("/health")
def health_check():
    return {"status": "ok", "model_loaded": True}

@app.post("/api/v1/predict")
async def predict(
    file: UploadFile = File(...),
    include_heatmap: bool = Query(True),
    mock_ood: bool = Query(False)
):
    # 1. MIME type validation
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Tệp vượt quá 10MB hoặc định dạng không hỗ trợ.")

    # 2. File size validation
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Tệp vượt quá 10MB hoặc định dạng không hỗ trợ.")

    # 3. Decode & verify image
    try:
        verify_img = Image.open(io.BytesIO(contents))
        verify_img.verify()
    except Exception as exc:
        logger.warning("Lỗi verify ảnh: %s", exc)
        raise HTTPException(status_code=422, detail="Tệp hình ảnh bị lỗi cấu trúc hoặc không thể giải mã.")

    # 4. Check OOD (via param mock_ood or filename containing 'ood' or 'hand')
    is_ood = mock_ood or ("ood" in (file.filename or "").lower()) or ("hand" in (file.filename or "").lower())

    if is_ood:
        return {
            "success": True,
            "top1": None,
            "top3": [],
            "is_ood": True,
            "is_uncertain": False,
            "warning_message": "Ảnh nằm ngoài phạm vi 38 lớp cây trồng được hỗ trợ (OOD). Vui lòng không chụp vật thể lạ hoặc ảnh không rõ lá cây.",
            "gradcam_base64": None,
            "inference_time_ms": 25
        }

    # 5. Normal In-Distribution prediction (Tomato___Late_blight)
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
        "gradcam_base64": DUMMY_GRADCAM if include_heatmap else None,
        "inference_time_ms": 120
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
