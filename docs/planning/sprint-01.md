# 🚀 KẾ HOẠCH SPRINT 1: NỀN TẢNG HỆ THỐNG TOÀN TRÌNH (FULL-STACK PIPELINE)
## Thời gian dự kiến: Tuần 1 — Kế hoạch thực thi cho Nhóm 2 Người

---

### 1. 🎯 MỤC TIÊU SPRINT (SPRINT GOAL)
Đồng bộ và kết nối luồng chẩn đoán khép kín: Client gửi ảnh lá $\rightarrow$ Core API (`Lavitree.Api`) tiếp nhận $\rightarrow$ Lưu ảnh gốc & Grad-CAM vào MinIO S3 $\rightarrow$ AI Vision Service (`ai-service`) phân tích ResNet-18 trả về Top-1/Top-3 kèm Grad-CAM Heatmap $\rightarrow$ PostgreSQL 10 bảng truy vấn và lưu kết quả $\rightarrow$ Trả về kết quả chẩn đoán kèm Hướng dẫn IPM chuẩn.

> **Quy chuẩn Giao tiếp Dữ liệu (SSOT)**: Mọi định dạng Request và Response của các Endpoint trong Sprint 1 tuân thủ duy nhất theo [docs/architecture/api-contracts.md](../architecture/api-contracts.md). Các task chi tiết chỉ dẫn chiếu theo tài liệu này, không định nghĩa lại schema riêng.

---

### 2. 👥 PHÂN CÔNG TRÁCH NHIỆM (TEAM ROLES & OWNERSHIP)

| Thành viên | Trách nhiệm chính (Owner) | Deliverables Sprint 1 |
| :--- | :--- | :--- |
| **Thành viên A (System & Backend)** | • Cập nhật Database: Chạy `dotnet ef database update` trên Supabase Cloud (hoặc Postgres Docker)<br>• Cấu hình MinIO S3 Object Storage (port 9000/9001)<br>• Nạp dữ liệu cốt lõi (38 lớp Diseases, 112 bài báo thô) & 1–2 ca bệnh mẫu đại diện (TreatmentPlans & Products) để thông luồng kỹ thuật<br>• Core API: Cài đặt MinIO Service và hoàn thiện `POST /api/v1/diagnose` | • 10 bảng CSDL có đủ cấu trúc và dữ liệu mẫu thông luồng<br>• MinIO lưu trữ ảnh lá gốc và Grad-CAM<br>• Core API kết nối MinIO và AI Service pass E2E |
| **Thành viên B (AI Vision)** | • Đồng bộ `backend/ai-service` khớp với `api-contracts.md`<br>• Nạp dữ liệu `Lavitree_Selected_Classes.csv` để trả về tên tiếng Việt, mẹo chụp theo lớp & nhóm lớp dễ nhầm<br>• Chuẩn hóa endpoint `POST /api/v1/predict` (hỗ trợ `include_heatmap`, max 10MB)<br>• Tách bạch quy tắc `is_uncertain` (< 0.70) và `warning_message` (theo `docs/spec/classes.md`) | • `backend/ai-service` chạy chuẩn RESTful<br>• Endpoint `POST /api/v1/predict` đạt latency $\le 1.0$s trên CPU<br>• Script kiểm thử `test_predict.py` pass 100% |

---

### 3. 📋 DANH SÁCH TASKS CHI TIẾT SPRINT 1 (ĐỒNG BỘ MÃ NGUỒN HIỆN CÓ)

- [ ] **TASK-01: Đồng bộ `backend/ai-service` (FastAPI), Endpoint dự đoán ResNet-18 & Bộ lọc OOD cơ bản** *(Owner: Thành viên B)*
  - File tác động: `backend/ai-service/app/main.py`, `app/api/endpoints/predict.py`, `app/services/predictor.py`, `app/services/ood_filter.py`.
  - Dữ liệu: Đọc `Lavitree_Selected_Classes.csv` (đã có trong `app/models/`) để ánh xạ tên tiếng Việt, `Capture_Tip`, `Confusion_Group`. Đã bỏ phân cấp Tier.
  - Bộ lọc OOD đa tầng: Tích hợp `ood_filter.py` kết hợp tín hiệu sơ bộ màu thực vật (HSV/ExG, không coi là bằng chứng khẳng định) + Energy-based OOD Score trên logits (ngưỡng tạm thời đọc từ `OOD_ENERGY_THRESHOLD`; hiệu chỉnh chính thức theo phân vị thứ 5 để Sprint 3) để giảm hiện tượng Softmax Overconfidence trên ảnh bàn tay, mặt người, đồ vật ngoại lai.
  - Hợp đồng: Chuẩn hóa URL thành `POST /api/v1/predict`, kiểm tra file $\le 10$MB, trả về đúng định dạng JSON chuẩn (Top-1, Top-3, `confusion_group`, `is_ood`, `is_uncertain`, `warning_message`, `gradcam_base64`).
- [ ] **TASK-02: Chuẩn hóa tham số và tối ưu hóa Grad-CAM (`layer4[-1]`)** *(Owner: Thành viên B)*
  - File tác động: `backend/ai-service/app/services/gradcam.py`, `predictor.py`.
  - Hợp đồng: Bổ sung tham số `include_heatmap: bool = True`. Tối ưu tốc độ sinh heatmap kết hợp ResNet-18 đạt $\le 1.0$s trên CPU (gợi ý: gộp 1 lần forward pass có gradient khi bật heatmap).
- [ ] **TASK-03: Cập nhật CSDL Supabase / Postgres & Nạp Seed Data Mẫu Thông Luồng** *(Owner: Thành viên A)*
  - File tác động: `docker-compose.yml`, thư mục seed `backend/core-api/seed/`.
  - Thực thi: Chạy `dotnet ef database update` áp dụng 5 migrations đã có sẵn trong `Lavitree.Infrastructure/Migrations/` lên Supabase Cloud (hoặc container local).
  - Nạp dữ liệu: 14 loài cây, 40 lớp cây trồng (`Diseases`: 38 AI + 2 bổ trợ), bỏ qua 112 bài `KnowledgeSources` nếu đã có (nếu nạp trên DB trống thì giữ nguyên GUID từ CSV), và nạp 1–2 ca bệnh mẫu (`TreatmentPlans` & `Products` cho `Tomato___Late_blight`) để thông luồng kiểm thử.
  - *Lưu ý*: Toàn bộ việc nạp tri thức đầy đủ 38 lớp sẽ do cơ chế Ingestion & Curation ở Sprint 2 thực hiện.
- [ ] **TASK-04: Tích hợp MinIO Storage & Hoàn thiện Core API (`Lavitree.Api`)** *(Owner: Thành viên A)*
  - File tác động: `backend/core-api/src/Lavitree.Infrastructure/Services/MinioStorageService.cs`, `Lavitree.Api/Controllers/DiagnoseController.cs`, `docker-compose.yml`.
  - Thư viện: Cài đặt NuGet package `Minio` (hoặc `AWSSDK.S3`).
  - Hợp đồng & Bảo mật: Nhận `POST /api/v1/diagnose`, upload ảnh gốc lên MinIO (chỉ cấp quyền `s3:GetObject` theo GUID, cấm `s3:ListBucket`), gọi AI Service, lưu ảnh Grad-CAM vào MinIO, truy vấn DB lấy hướng dẫn IPM & sản phẩm, trả về public URL (`http://localhost:9000/...`). Khi `is_ood = true`, **không lưu ảnh lên MinIO và không tạo `DiagnosisRecord`** để bảo vệ riêng tư. Cấu hình `docker-compose.yml` bind `127.0.0.1` cho port 8000/8001/9001 và nạp mật khẩu mới từ `.env`.

---

### 4. 🛡️ TIÊU CHÍ NGHIỆM THU SPRINT (QUALITY GATES ĐÃ THỐNG NHẤT)

1. **Gate 1 - AI Vision Latency, Accuracy & OOD Filtering**:
   - Thời gian suy luận ResNet-18 + sinh Grad-CAM Heatmap: **$\le 1.0$ giây trên CPU** (hoặc $< 0.3$ giây trên GPU).
   - OOD (mức cơ bản): ảnh bàn tay/đồ vật mẫu bị gắn `is_ood: true`, ảnh lá mẫu không bị chặn nhầm; ngưỡng cấu hình qua `.env`. *(Chỉ tiêu định lượng ≥ 80% / ≤ 5% trên tập ảnh tách biệt chuyển sang Sprint 3.)*
   - `is_uncertain` phản ánh đúng độ bất định Softmax khi `confidence < 0.70`; response không còn trường `tier`; `confusion_group` và `warning_message` sinh đúng theo `docs/spec/classes.md`.
2. **Gate 2 - Storage & Persistence Pipeline**:
   - CSDL quan hệ kết nối ổn định, đủ 10 bảng dữ liệu.
   - Ảnh lá gốc và ảnh heatmap Grad-CAM được lưu trên MinIO S3 (`http://localhost:9000/lavitree-diagnoses/...`) với quyền truy cập file đơn lẻ, không lộ danh sách toàn bộ bucket.
3. **Gate 3 - E2E Integration Pass**:
   - Gửi request `POST /api/v1/diagnose` với ảnh bệnh mẫu `Tomato___Late_blight` $\rightarrow$ Nhận mã `200 OK` trong **$\le 1.5$ giây**.
   - Dữ liệu trả về đầy đủ kết quả chẩn đoán, ảnh nhiệt, các bước IPM và sản phẩm gợi ý khớp 100% [api-contracts.md](../architecture/api-contracts.md).

