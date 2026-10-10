from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints.predict import router as predict_router

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

app.include_router(predict_router, prefix="/api/v1/ai", tags=["AI Vision"])

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Lavitree AI Vision Service"}
