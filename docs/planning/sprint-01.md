# 🚀 KẾ HOẠCH SPRINT 1: NỀN TẢNG HỆ THỐNG TOÀN TRÌNH (FULL-STACK PIPELINE)
## Thời gian dự kiến: Tuần 1 — Nhóm 2 Người

---

### 1. 🎯 MỤC TIÊU SPRINT (SPRINT GOAL)
Xây dựng và kết nối thông suốt luồng chẩn đoán thị giác khép kín từ lúc Client gửi ảnh lá qua Camera $\rightarrow$ Core API (.NET 8) tiếp nhận $\rightarrow$ Lưu ảnh gốc & Grad-CAM vào MinIO S3 $\rightarrow$ AI Vision Service (FastAPI) phân tích ResNet-18 trích xuất Grad-CAM $\rightarrow$ PostgreSQL lưu kết quả $\rightarrow$ Trả về kết quả chẩn đoán kèm Hướng dẫn IPM chuẩn.

---

### 2. 👥 PHÂN CÔNG TRÁCH NHIỆM (TEAM ROLES & OWNERSHIP)

| Thành viên | Trách nhiệm chính (Owner) | Deliverables Sprint 1 |
| :--- | :--- | :--- |
| **Thành viên A (System & Backend)** | • Hạ tầng MinIO Object Storage & PostgreSQL 10 bảng<br>• Core API (.NET 8 Clean Architecture)<br>• Endpoint toàn trình `POST /api/v1/diagnose` | • `docker-compose.yml` (chạy postgres, minio, core-api)<br>• Entity Framework Core Migrations & Seed Data<br>• Core API kết nối MinIO và AI Service |
| **Thành viên B (AI Vision)** | • Đóng gói `backend/ai-service` (FastAPI)<br>• Nạp mô hình `best_plant_model.pt`<br>• Trích xuất bản đồ nhiệt Grad-CAM (`layer4[-1]`)<br>• Bộ lọc độ bất định (OOD Check $T < 0.70$) | • `backend/ai-service` Dockerized<br>• Endpoint `POST /api/v1/predict`<br>• Script kiểm thử `test_predict.py` pass 100% |

---

### 3. 📋 DANH SÁCH TASKS CHI TIẾT SPRINT 1

- [ ] **TASK-01: Thiết lập `backend/ai-service` (FastAPI) & Endpoint nhận diện ResNet-18** *(Owner: Thành viên B)*
  - File tác động: `backend/ai-service/app/main.py`, `app/services/predictor.py`, `requirements.txt`, `Dockerfile`.
  - Hợp đồng: Nhận Multipart image $\rightarrow$ Resize 224x224 $\rightarrow$ Trả về Top-1, Top-3, Tier 1/2/3 và cảnh báo $T < 0.70$.
- [ ] **TASK-02: Endpoint trích xuất bản đồ nhiệt Grad-CAM (`layer4[-1]`)** *(Owner: Thành viên B)*
  - File tác động: `backend/ai-service/app/services/gradcam.py`.
  - Hợp đồng: Trả về ảnh heatmap (Jet colormap) phủ mờ 50% lên ảnh lá gốc dưới dạng Base64 / byte stream.
- [ ] **TASK-03: Khởi tạo PostgreSQL 10 bảng chuẩn hóa 3NF & Nạp Seed Data** *(Owner: Thành viên A)*
  - File tác động: `backend/core-api/src/Lavitree.Infrastructure/Data/`, script nạp dữ liệu SQL.
  - Hợp đồng: Schema 10 bảng khớp 100% với `database-schema.md`, nạp 38 lớp cây trồng và 112 nguồn tri thức từ `KnowledgeSources_rows.csv`.
- [ ] **TASK-04: Xây dựng Core API (.NET 8 Clean Architecture) & Tích hợp MinIO Storage** *(Owner: Thành viên A)*
  - File tác động: `backend/core-api/src/Lavitree.API/Controllers/DiagnoseController.cs`, `MinioStorageService.cs`.
  - Hợp đồng: Upload ảnh lên bucket `lavitree-diagnoses`, gọi `ai-service`, truy vấn hướng dẫn IPM và lưu bản ghi `DiagnosisRecords`.

---

### 4. 🛡️ TIÊU CHÍ NGHIỆM THU SPRINT (DEFINITION OF DONE & QUALITY GATES)

1. **Gate 1 - AI Vision Performance**:
   - Thời gian suy luận ResNet-18 + Grad-CAM $< 1.0$ giây trên CPU / $< 0.3$ giây trên GPU.
   - Nhận diện đúng các mẫu lá kiểm thử từ bộ PlantVillage test.
2. **Gate 2 - Storage & Persistence**:
   - Ảnh lá gốc và ảnh heatmap Grad-CAM được lưu thành công trên MinIO S3 (`http://localhost:9000/lavitree-diagnoses/...`).
   - Bản ghi `DiagnosisRecord` được lưu đầy đủ vào PostgreSQL kèm URL MinIO.
3. **Gate 3 - E2E Integration Pass**:
   - Gửi request `POST /api/v1/diagnose` qua Postman/cURL với 1 ảnh lá thật $\rightarrow$ Nhận mã `200 OK`, JSON trả về đúng chuẩn [api-contracts.md](file:///d:/PTIT%20Do%20An/LAVITREE/docs/architecture/api-contracts.md) kèm Hướng dẫn IPM và URL ảnh MinIO.
