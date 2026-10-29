from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env")
load_dotenv(dotenv_path=BASE_DIR.parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints.predict import router as predict_router
from app.services.predictor import predictor

app = FastAPI(
    title="Lavitree AI Vision Microservice",
    description="Microservice phân loại 38 lớp bệnh cây (ResNet-18) và sinh nhiệt đồ Grad-CAM",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict_router, prefix="/api/v1", tags=["AI Vision"])

@app.get("/health")
def health_check():
    return {"status": "ok", "model_loaded": predictor.is_loaded}

