from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.predictor import predictor

router = APIRouter()

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}

@router.post("/predict")
async def predict_plant_disease(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Định dạng tệp '{file.content_type}' không được hỗ trợ. Vui lòng tải ảnh JPEG, PNG hoặc WebP."
        )

    try:
        contents = await file.read()
        result = predictor.predict(contents)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi phân tích hình ảnh: {str(e)}")
