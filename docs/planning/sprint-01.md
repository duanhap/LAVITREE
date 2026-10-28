# 🚀 KẾ HOẠCH SPRINT 1: NỀN TẢNG HỆ THỐNG TOÀN TRÌNH (FULL-STACK PIPELINE)
## Thời gian dự kiến: Tuần 1 — Kế hoạch thực thi cho Nhóm 2 Người

---

### 1. 🎯 MỤC TIÊU SPRINT (SPRINT GOAL)
Đồng bộ và kết nối luồng chẩn đoán khép kín: Client gửi ảnh lá $\rightarrow$ Core API (`Lavitree.Api`) tiếp nhận $\rightarrow$ Lưu ảnh gốc & Grad-CAM vào MinIO S3 $\rightarrow$ AI Vision Service (`ai-service`) phân tích ResNet-18 trả về Top-1/Top-3 kèm Grad-CAM Heatmap $\rightarrow$ PostgreSQL 10 bảng truy vấn và lưu kết quả $\rightarrow$ Trả về kết quả chẩn đoán kèm Hướng dẫn IPM chuẩn.

> **Quy chuẩn Giao tiếp Dữ liệu (SSOT)**: Mọi định dạng Request và Response của các Endpoint trong Sprint 1 tuân thủ duy nhất theo [docs/architecture/api-contracts.md](file:///d:/PTIT%20Do%20An/LAVITREE/docs/architecture/api-contracts.md). Các task chi tiết chỉ dẫn chiếu theo tài liệu này, không định nghĩa lại schema riêng.

---

### 2. 👥 PHÂN CÔNG TRÁCH NHIỆM (TEAM ROLES & OWNERSHIP)

| Thành viên | Trách nhiệm chính (Owner) | Deliverables Sprint 1 |
| :--- | :--- | :--- |
| **Thành viên A (System & Backend)** | • Cập nhật Database: Chạy `dotnet ef database update` trên Supabase Cloud (hoặc Postgres Docker)<br>• Cấu hình MinIO S3 Object Storage (port 9000/9001)<br>• Nạp dữ liệu cốt lõi (38 lớp Diseases, 112 bài báo thô) & 1–2 ca bệnh mẫu đại diện (TreatmentPlans & Products) để thông luồng kỹ thuật<br>• Core API: Cài đặt MinIO Service và hoàn thiện `POST /api/v1/diagnose` | • 10 bảng CSDL có đủ cấu trúc và dữ liệu mẫu thông luồng<br>• MinIO lưu trữ ảnh lá gốc và Grad-CAM<br>• Core API kết nối MinIO và AI Service pass E2E |
| **Thành viên B (AI Vision)** | • Đồng bộ `backend/ai-service` khớp với `api-contracts.md`<br>• Nạp dữ liệu `Lavitree_Selected_Classes.csv` để trả về tên tiếng Việt & phân cấp Tier 1/2/3<br>• Chuẩn hóa endpoint `POST /api/v1/predict` (hỗ trợ `include_heatmap`, max 10MB)<br>• Tách bạch quy tắc `is_uncertain` (< 0.70) và `warning_message` (theo Tier) | • `backend/ai-service` chạy chuẩn RESTful<br>• Endpoint `POST /api/v1/predict` đạt latency $\le 1.0$s trên CPU<br>• Script kiểm thử `test_predict.py` pass 100% |

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
- [ ] **TASK-03: Cập nhật CSDL Supabase / Postgres & Nạp Seed Data Mẫu Thông Luồng** *(Owner: Thành viên A)*
  - File tác động: `docker-compose.yml`, thư mục seed `backend/core-api/seed/`.
  - Thực thi: Chạy `dotnet ef database update` áp dụng 5 migrations đã có sẵn trong `Lavitree.Infrastructure/Migrations/` lên Supabase Cloud (hoặc container local).
  - Nạp dữ liệu: 38 lớp cây trồng (`Diseases`), 112 bài báo (`KnowledgeSources`), và 1–2 ca bệnh mẫu (`TreatmentPlans` & `Products` cho `Tomato___Late_blight`) để thông luồng kiểm thử.
  - *Lưu ý*: Toàn bộ việc nạp tri thức đầy đủ 38 lớp sẽ do cơ chế Ingestion & Curation ở Sprint 2 thực hiện.
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
2. **Gate 2 - Storage & Persistence Pipeline**:
   - CSDL quan hệ kết nối ổn định, đủ 10 bảng dữ liệu.
   - Ảnh lá gốc và ảnh heatmap Grad-CAM được lưu trên MinIO S3 (`http://localhost:9000/lavitree-diagnoses/...`).
3. **Gate 3 - E2E Integration Pass**:
   - Gửi request `POST /api/v1/diagnose` với 1 ảnh lá thật $\rightarrow$ Nhận mã `200 OK` trong **$\le 1.5$ giây**.
   - Dữ liệu trả về đầy đủ kết quả chẩn đoán, ảnh nhiệt, các bước IPM và sản phẩm gợi ý khớp 100% [api-contracts.md](../architecture/api-contracts.md).
