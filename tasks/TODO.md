# 📌 BẢNG THEO DÕI TIẾN ĐỘ DỰ ÁN (TASKS/TODO.MD)
## Hệ thống Lavitree — Kế hoạch thực thi Sprint & Tasks

> **Quy ước trạng thái**:
> - `[ ]` **PENDING**: Chưa bắt đầu
> - `[/]` **ACTIVE / IN PROGRESS**: Đang triển khai
> - `[x]` **DONE**: Đã hoàn thành, có bằng chứng nghiệm thu (Test Passed)
> - `[-]` **DEFERRED**: Tạm hoãn sang giai đoạn sau

---

## 🚀 SPRINT 1: AI VISION SERVICE & TRI THỨC LÕI (TUẦN 1)
*Mục tiêu: Đóng gói dịch vụ FastAPI chẩn đoán ảnh lá cây, trích xuất Grad-CAM và xuất dữ liệu Seed tri thức.*

- [ ] **TASK-01: Thiết lập cấu trúc dự án `backend/ai-service` (FastAPI) & Quản lý phụ thuộc**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: `main.py`, `requirements.txt`, Dockerfile, kiểm tra healthcheck `GET /health`.
- [ ] **TASK-02: Endpoint `POST /api/v1/predict` nhận diện ảnh lá với ResNet18**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Nạp model `best_plant_model.pt`, tiền xử lý ảnh 224x224, trả về Top-1, Top-3, phân cấp Tier 1/2/3 và cảnh báo độ bất định ($T < 0.70$).
- [ ] **TASK-03: Endpoint trích xuất bản đồ nhiệt Grad-CAM (`layer4[-1]`)**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Tùy chọn trả về ảnh Heatmap phủ lên ảnh gốc để hiển thị vùng nghi vấn trên giao diện.
- [ ] **TASK-04: Đóng gói Seed Data tri thức nông nghiệp cho Database**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: File SQL/JSON chứa 38 lớp cây trồng, triệu chứng và phác đồ điều trị 3 bước từ `Lavitree_Selected_Classes.csv`.

---

## 🏛️ SPRINT 2: CORE API (.NET 8) & POSTGRESQL DATABASE (TUẦN 2)
*Mục tiêu: Xây dựng cơ sở dữ liệu 10 bảng, API nghiệp vụ chẩn đoán, quản lý người dùng và giỏ hàng tiệm thuốc.*

- [ ] **TASK-05: Khởi tạo PostgreSQL Database với 10 bảng chuẩn hóa 3NF trên Docker**
  - Trạng thái: `[ ] PENDING`
- [ ] **TASK-06: Xây dựng Core API (.NET 8 Clean Architecture) — Module Quản lý Tri thức bệnh**
  - Trạng thái: `[ ] PENDING`
- [ ] **TASK-07: Xây dựng Core API — Module Lịch sử Chẩn đoán (Diagnosis Records)**
  - Trạng thái: `[ ] PENDING`
- [ ] **TASK-08: Xây dựng Core API — Module Tiệm thuốc & Đơn hàng (Mini Store & Orders)**
  - Trạng thái: `[ ] PENDING`

---

## 💻 SPRINT 3: GIAO DIỆN WEB / MOBILE & ĐÓNG GÓI DEMO OFFLINE (TUẦN 3)
*Mục tiêu: Giao diện chụp ảnh có khung ngắm hướng dẫn, hiển thị Grad-CAM, kết nối end-to-end và chạy Docker 1 lệnh duy nhất.*

- [ ] **TASK-09: Xây dựng Frontend Web Portal (React 18 + Vite) — Chẩn đoán & Xem phác đồ**
  - Trạng thái: `[ ] PENDING`
- [ ] **TASK-10: Xây dựng Admin Dashboard quản trị dịch tễ cây trồng**
  - Trạng thái: `[ ] PENDING`
- [ ] **TASK-11: Cấu hình Docker Compose hợp nhất (Offline 100%)**
  - Trạng thái: `[ ] PENDING`
- [ ] **TASK-12: Kiểm thử tích hợp toàn hệ thống (E2E Integration Test) & Viết kịch bản Demo**
  - Trạng thái: `[ ] PENDING`
