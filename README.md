# LAVITREE (AGRI-GUARD) - HỆ THỐNG NHẬN DIỆN BỆNH CÂY TRỒNG & TƯ VẤN ĐIỀU TRỊ THÔNG MINH

> **Đồ Án Tốt Nghiệp / Khóa Luận Kỹ Sư - Học Viện Công Nghệ Bưu Chính Viễn Thông (PTIT)**  
> **Thời gian thực hiện**: 10 Tuần | **Quy mô nhóm**: 02 thành viên

---

## 1. Cấu Trúc Tổng Thể Dự Án (Monorepo)

```text
LAVITREE/
├── backend/
│   ├── core-api/          # [ASP.NET Core 8 Web API] - Nghiệp vụ cốt lõi (Clean Architecture)
│   │   ├── src/
│   │   │   ├── Lavitree.Domain/          # 10 Entities, BaseEntity, Enums
│   │   │   ├── Lavitree.Application/     # CQRS/MediatR, DTOs, Interfaces
│   │   │   ├── Lavitree.Infrastructure/  # EF Core, PostgreSQL (Supabase), HttpClient
│   │   │   └── Lavitree.Api/             # Controllers, Swagger, Middlewares
│   │   └── Dockerfile
│   │
│   ├── ai-service/        # [FastAPI + PyTorch] - AI Vision Microservice
│   │   ├── app/
│   │   │   ├── api/endpoints/predict.py  # /predict endpoint
│   │   │   ├── models/                   # best_plant_model.pt (44.8MB), class_indices.json
│   │   │   └── services/                 # predictor.py, gradcam.py (XAI Heatmap), ood_filter.py
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   └── agent-service/     # [FastAPI + RAG] - Trợ lý Khuyến nông (Bonus)
│       ├── app/
│       │   ├── agent/                    # prompts.py (An toàn PHI, chống bịa thuốc)
│       │   └── rag/                      # knowledge_retriever.py
│       ├── requirements.txt
│       └── Dockerfile
│
├── frontend/
│   └── web/               # [React 18 + Vite + TypeScript] - Web Portal & Admin Dashboard
│       ├── src/
│       │   ├── components/Navbar.tsx
│       │   ├── pages/DiagnosePage.tsx    # Chẩn đoán lá, xem Grad-CAM, phác đồ 3 bước
│       │   ├── pages/HandbookPage.tsx    # Tra cứu 14 loài cây & 38 lớp bệnh
│       │   └── pages/AdminDashboard.tsx  # Cổng quản trị tri thức & đơn hàng
│       └── Dockerfile
│
├── mobile/
│   └── android/           # [Kotlin + Jetpack Compose] - Ứng dụng di động nông dân
│       ├── app/src/main/
│       │   ├── AndroidManifest.xml       # Camera & Internet permissions
│       │   └── java/com/ptit/lavitree/
│       │       ├── MainActivity.kt
│       │       ├── LavitreeApp.kt        # Jetpack Compose Navigation
│       │       ├── ui/screens/           # HomeScreen, ScanScreen, DiagnosisResultScreen
│       │       └── data/                 # Retrofit API Service & DTOs
│       └── build.gradle.kts
│
├── docker-compose.yml     # Khởi chạy đồng bộ tất cả services
└── README.md
```

---

## 2. Hướng Dẫn Chạy Từng Phân Hệ Cục Bộ (Local Development)

### 2.1. Chạy AI Vision Service (FastAPI)
```bash
cd backend/ai-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
- Swagger AI: `http://localhost:8000/docs`

### 2.2. Chạy Core Business Backend (ASP.NET Core 8 Web API)
```bash
cd backend/core-api
dotnet restore
dotnet build
cd src/Lavitree.Api
dotnet run
```
- Swagger Core API: `http://localhost:5000/swagger` hoặc `https://localhost:7001/swagger`

### 2.3. Chạy Agri-Agent Service (Bonus)
```bash
cd backend/agent-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

### 2.4. Chạy Web Frontend (React + Vite)
```bash
cd frontend/web
npm install
npm run dev
```
- Truy cập trình duyệt: `http://localhost:3000`

### 2.5. Chạy Mobile App (Android Studio)
- Mở thư mục `mobile/android` bằng **Android Studio Iguana / Jellyfish**.
- Gradle Sync và chạy trên Android Emulator hoặc thiết bị thật (yêu cầu Android 8.0 / API 26 trở lên).

---

## 3. Khởi Chạy Nhanh Toàn Hệ Thống Bằng Docker Compose
Chỉ cần 1 lệnh tại thư mục `LAVITREE`:
```bash
docker compose up --build
```
Hệ thống sẽ tự động build và chạy:
- PostgreSQL tại port `5432`
- FastAPI Vision tại port `8000`
- FastAPI Agent tại port `8001`
- ASP.NET Core 8 Web API tại port `5000`
- Web Frontend tại port `3000`
