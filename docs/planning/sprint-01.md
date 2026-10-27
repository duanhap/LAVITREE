# 🚀 KẾ HOẠCH SPRINT 1: NỀN TẢNG HỆ THỐNG TOÀN TRÌNH (FULL-STACK PIPELINE)
## Thời gian dự kiến: Tuần 1 — Nhóm 2 Người (Đã rà soát & Đồng bộ 100% với Code)

---

### 1. 🎯 MỤC TIÊU SPRINT (SPRINT GOAL)
Đồng bộ và kết nối thông suốt luồng chẩn đoán thị giác khép kín từ lúc Client gửi ảnh lá $\rightarrow$ Core API (`Lavitree.Api`) tiếp nhận $\rightarrow$ Lưu ảnh gốc & Grad-CAM vào MinIO S3 $\rightarrow$ AI Vision Service (`ai-service`) phân tích ResNet-18 trả về Top-1/Top-3 kèm Grad-CAM Heatmap $\rightarrow$ PostgreSQL 10 bảng truy vấn và lưu kết quả $\rightarrow$ Trả về kết quả chẩn đoán kèm Hướng dẫn IPM chuẩn.

---

### 2. 👥 PHÂN CÔNG TRÁCH NHIỆM (TEAM ROLES & OWNERSHIP)

| Thành viên | Trách nhiệm chính (Owner) | Deliverables Sprint 1 |
| :--- | :--- | :--- |
| **Thành viên A (System & Backend)** | • Hạ tầng Docker: PostgreSQL 15 (port 5432) & MinIO (port 9000/9001)<br>• Cập nhật Database: Chạy `dotnet ef database update` từ các migration đã có<br>• Nạp dữ liệu Seed Data (38 lớp, 112 bài báo, TreatmentPlans, Products)<br>• Core API: Cài đặt MinIO Service và hoàn thiện `POST /api/v1/diagnose` | • `docker-compose.yml` có sẵn `postgres` và `minio`<br>• 10 bảng PostgreSQL có đủ dữ liệu Seed<br>• Core API kết nối MinIO và AI Service pass E2E |
| **Thành viên B (AI Vision)** | • Đồng bộ `backend/ai-service` khớp 100% với `api-contracts.md`<br>• Nạp dữ liệu `Lavitree_Selected_Classes.csv` để trả về tên tiếng Việt & phân cấp Tier 1/2/3<br>• Chuẩn hóa endpoint `POST /api/v1/predict` (hỗ trợ `include_heatmap`, max 10MB)<br>• Tách bạch quy tắc `is_uncertain` (< 0.70) và `warning_message` (theo Tier) | • `backend/ai-service` chạy chuẩn RESTful<br>• Endpoint `POST /api/v1/predict` đạt latency $\le 1.0$s trên CPU<br>• Script kiểm thử `test_predict.py` pass 100% |

---

### 3. 📋 DANH SÁCH TASKS CHI TIẾT SPRINT 1 (ĐỒNG BỘ MÃ NGUỒN HIỆN CÓ)

- [ ] **TASK-01: Đồng bộ `backend/ai-service` (FastAPI), Endpoint dự đoán ResNet-18 & Bộ lọc OOD đa tầng** *(Owner: Thành viên B)*
  - File tác động: `backend/ai-service/app/main.py`, `app/api/endpoints/predict.py`, `app/services/predictor.py`, `app/services/ood_filter.py`.
  - Dữ liệu nạp thêm: Copy `Lavitree_Selected_Classes.csv` vào `app/models/` để ánh xạ Tên tiếng Việt và Tier.
  - Bộ lọc OOD đa tầng: Tích hợp `ood_filter.py` kết hợp tín hiệu sơ bộ màu thực vật (HSV/ExG, không coi là bằng chứng khẳng định) + Energy-based OOD Score trên logits (ngưỡng 95th percentile ID) để ngăn chặn hiện tượng Softmax Overconfidence trên ảnh bàn tay, mặt người, đồ vật ngoại lai.
  - Hợp đồng: Chuẩn hóa URL thành `POST /api/v1/predict`, kiểm tra file $\le 10$MB, trả về đúng định dạng JSON chuẩn (Top-1, Top-3, `tier`, `is_ood`, `is_uncertain`, `warning_message`, `gradcam_base64`).
- [ ] **TASK-02: Chuẩn hóa tham số và tối ưu hóa Grad-CAM (`layer4[-1]`)** *(Owner: Thành viên B)*
  - File tác động: `backend/ai-service/app/services/gradcam.py`, `predictor.py`.
  - Hợp đồng: Bổ sung tham số `include_heatmap: bool = True`. Tối ưu tốc độ sinh heatmap kết hợp ResNet-18 đạt $\le 1.0$s trên CPU.
- [ ] **TASK-03: Khởi tạo PostgreSQL 15 Container & Nạp đầy đủ Seed Data** *(Owner: Thành viên A)*
  - File tác động: `docker-compose.yml`, thư mục seed `backend/core-api/seed/`.
  - Thực thi: Khởi động container `postgres`, chạy `dotnet ef database update` áp dụng 5 migrations đã có sẵn trong `Lavitree.Infrastructure/Migrations/`.
  - Nạp dữ liệu: 38 lớp cây trồng (`Diseases`), 112 bài báo (`KnowledgeSources`), kèm dữ liệu mẫu `TreatmentPlans` (IPM) và `Products`/`DiseaseProducts`.
- [ ] **TASK-04: Tích hợp MinIO Storage & Hoàn thiện Core API (`Lavitree.Api`)** *(Owner: Thành viên A)*
  - File tác động: `backend/core-api/src/Lavitree.Infrastructure/Services/MinioStorageService.cs`, `Lavitree.Api/Controllers/DiagnoseController.cs`.
  - Thư viện: Cài đặt NuGet package `Minio` (hoặc `AWSSDK.S3`).
  - Hợp đồng: Nhận `POST /api/v1/diagnose`, upload ảnh gốc lên MinIO, gọi AI Service, lưu ảnh Grad-CAM vào MinIO, truy vấn DB lấy hướng dẫn IPM & sản phẩm, trả về public URL (`http://localhost:9000/...`).

---

### 4. 🛡️ TIÊU CHÍ NGHIỆM THU SPRINT (QUALITY GATES ĐÃ THỐNG NHẤT)

1. **Gate 1 - AI Vision Latency, Accuracy & OOD Filtering**:
   - Thời gian suy luận ResNet-18 + sinh Grad-CAM Heatmap: **$\le 1.0$ giây trên CPU** (hoặc $< 0.3$ giây trên GPU).
   - `is_ood` phát hiện và gắn cờ chính xác khi đưa ảnh bàn tay / đồ vật ngoại lai vào hệ thống (thông qua Energy-based OOD Score).
   - `is_uncertain` đánh giá đúng ngưỡng tin cậy $< 0.70$; `tier` trả về đúng chuẩn `"TIER_1_APPROVED"`, `"TIER_2_CONDITIONAL"`, `"TIER_3_EXCLUDED"`.
2. **Gate 2 - Storage & Persistence (100% Offline Ready)**:
   - PostgreSQL 15 chạy độc lập trong Docker container (Port 5432), có đủ 10 bảng dữ liệu.
   - Ảnh lá gốc và ảnh heatmap Grad-CAM được lưu trên MinIO S3 (`http://localhost:9000/lavitree-diagnoses/...`).
3. **Gate 3 - E2E Integration Pass**:
   - Gửi request `POST /api/v1/diagnose` với 1 ảnh lá thật $\rightarrow$ Nhận mã `200 OK` trong **$\le 1.5$ giây**.
   - Dữ liệu trả về đầy đủ kết quả chẩn đoán, ảnh nhiệt, các bước IPM và sản phẩm gợi ý khớp 100% [api-contracts.md](file:///d:/PTIT%20Do%20An/LAVITREE/docs/architecture/api-contracts.md).
