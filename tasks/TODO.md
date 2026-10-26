# 📌 BẢNG THEO DÕI TIẾN ĐỘ DỰ ÁN (TASKS/TODO.MD)
## Hệ thống Lavitree — Kế hoạch thực thi 3 Sprint tối ưu cho Nhóm 2 Người

> **Quy ước trạng thái**:
> - `[ ]` **PENDING**: Chưa bắt đầu
> - `[/]` **ACTIVE / IN PROGRESS**: Đang triển khai
> - `[x]` **DONE**: Đã hoàn thành, có bằng chứng nghiệm thu (Test Passed)
> - `[-]` **DEFERRED**: Tạm hoãn sang giai đoạn sau

---

## 🚀 SPRINT 1: NỀN TẢNG HỆ THỐNG TOÀN TRÌNH (FULL-STACK PIPELINE)
*Mục tiêu: Hoàn thành luồng kết nối cơ bản từ Chụp ảnh lá $\rightarrow$ Core API $\rightarrow$ AI Vision $\rightarrow$ MinIO & PostgreSQL $\rightarrow$ Trả kết quả.*

- [ ] **TASK-01: Thiết lập `backend/ai-service` (FastAPI) & Endpoint nhận diện ResNet-18**
  - Trách nhiệm: **Thành viên B**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Nạp model `best_plant_model.pt`, tiền xử lý 224x224, trả về Top-1, Top-3, phân cấp Tier 1/2/3 và cảnh báo độ bất định ($T < 0.70$).
- [ ] **TASK-02: Endpoint trích xuất bản đồ nhiệt Grad-CAM (`layer4[-1]`)**
  - Trách nhiệm: **Thành viên B**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Trả về ảnh Heatmap phủ lên ảnh gốc để hiển thị vùng nghi vấn nấm bệnh trên giao diện.
- [ ] **TASK-03: Khởi tạo PostgreSQL 10 bảng chuẩn hóa 3NF & Nạp Seed Data**
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Migration EF Core 10 bảng, nạp 38 lớp cây trồng và 112 nguồn tri thức từ `KnowledgeSources_rows.csv` & `Lavitree_Selected_Classes.csv`.
- [ ] **TASK-04: Xây dựng Core API (.NET 8 Clean Architecture) & Tích hợp MinIO Storage**
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Cấu hình MinIO bucket `lavitree-diagnoses`, hoàn thiện endpoint toàn trình `POST /api/v1/diagnose` gọi AI Service và lưu bản ghi lịch sử.

---

## 🧠 SPRINT 2: TRỌNG TÂM TRÍ TUỆ NHÂN TẠO TÁC TỬ (AGRI-AGENT & MCP ECOSYSTEM)
*Mục tiêu: Hiện thực hóa toàn diện nghiên cứu 27 DAY từ thư mục `extract/` vào `backend/agent-service` (FastAPI).*

- [ ] **TASK-05: Thiết lập `backend/agent-service` & Cấu trúc Model Context Protocol (MCP Server)**
  - Trách nhiệm: **Thành viên B**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Kiến trúc MCP Server công bố công cụ theo chuẩn JSON Schema, kết nối Core API.
- [ ] **TASK-06: Triển khai 4 Công cụ MCP Nông nghiệp (`MCP Tools`)**
  - Trách nhiệm: **Thành viên B** (phối hợp Thành viên A về DB/API)
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: 4 công cụ hoạt động: `lookup_disease_knowledge`, `check_weather_risk`, `query_pesticide_store`, `verify_phi_safety`.
- [ ] **TASK-07: Xây dựng ReAct Loop & Chốt chặn An toàn (Boundary Guardrails - DAY 2, 3)**
  - Trách nhiệm: **Thành viên B**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Chu trình `Thought → Action → Observation`, chốt chặn an toàn PHI $\le 3$ ngày sát ngày thu hoạch, Human-in-the-loop duyệt đơn mua thuốc, Graceful Degradation hạ cấp offline.
- [ ] **TASK-08: Triển khai Streaming SSE & Waterfall Trace Logging (DAY 1, 3)**
  - Trách nhiệm: **Thành viên B**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Endpoint `POST /api/v1/agent/chat` truyền phát token thời gian thực và xuất file `trace_waterfall.json` phục vụ minh bạch hóa suy luận.

---

## 💻 SPRINT 3: TỐI ƯU GIAO DIỆN, QUAN SÁT (OBSERVABILITY) & DEMO OFFLINE
*Mục tiêu: Giao diện Web/Mobile hoàn chỉnh, màn hình quan sát suy luận của Agent và đóng gói Docker chạy 100% Offline.*

- [ ] **TASK-09: Xây dựng Frontend Web Portal (React 18 + Vite) — Khám lá & Tương tác Agent Streaming**
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[ ] PENDING`
- [ ] **TASK-10: Xây dựng Android Native App (Kotlin, Jetpack Compose, CameraX) — Chụp ảnh & Chat với Agent**
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[ ] PENDING`
- [ ] **TASK-11: Xây dựng Admin Dashboard quản trị dịch tễ & Màn hình Quan sát (Agent Observability Waterfall Chart)**
  - Trách nhiệm: **Thành viên A & B**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Trực quan hóa tiến trình suy luận của Agent cho hội đồng chấm thi xem trực tiếp.
- [ ] **TASK-12: Cấu hình Docker Compose hợp nhất (Offline 100%) & Kịch bản Demo**
  - Trách nhiệm: **Thành viên A & B**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Hệ thống khởi động bằng 1 lệnh `docker compose up -d`, chạy mượt mà không cần mạng internet.
