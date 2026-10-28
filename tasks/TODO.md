# 📌 BẢNG THEO DÕI TIẾN ĐỘ DỰ ÁN (TASKS/TODO.MD)
## Hệ thống Lavitree — Kế hoạch thực thi 3 Sprint tối ưu cho Nhóm 2 Người

> **Quy ước trạng thái**:
> - `[ ]` **PENDING**: Chưa bắt đầu
> - `[/]` **ACTIVE / IN PROGRESS**: Đang triển khai
> - `[x]` **DONE**: Đã hoàn thành, có bằng chứng nghiệm thu (Test Passed)
> - `[-]` **DEFERRED**: Tạm hoãn sang giai đoạn sau

---

## 🚀 SPRINT 1: NỀN TẢNG HỆ THỐNG TOÀN TRÌNH & BẢO MẬT CƠ SỞ (FULL-STACK PIPELINE & BASE SECURITY)
*Mục tiêu: Hoàn thành lát cắt dọc (Vertical Slice) từ Chụp ảnh lá $\rightarrow$ Core API $\rightarrow$ AI Vision $\rightarrow$ MinIO & Supabase $\rightarrow$ Trả kết quả kèm IPM; đồng thời áp dụng bảo mật cơ sở (khóa cổng nội bộ, chặn phá hoại CSDL tri thức).*
*Tài liệu phân quyền tham chiếu chuẩn: [docs/spec/roles-usecases.md](docs/spec/roles-usecases.md)*

### 👨‍💻 Phân công Thành viên B (AI Vision Specialist & Infrastructure):
- [ ] **TASK-01: Thiết lập `backend/ai-service` (FastAPI), Endpoint ResNet-18, Bộ lọc OOD đa tầng & Bảo mật AI**
  - Trách nhiệm: **Thành viên B**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Nạp model `best_plant_model.pt`, tiền xử lý 224x224, trả về Top-1, Top-3, phân cấp Tier 1/2/3, bộ lọc OOD đa tầng (`ood_filter.py`: Tín hiệu màu thực vật sơ bộ + Energy-based OOD Score trên logits) và cảnh báo độ bất định ($T < 0.70$).
  - **Hạng mục Bảo mật AI**: Xác thực ảnh bằng Pillow (`PIL.Image.open()`), đặt `Image.MAX_IMAGE_PIXELS = 10_000_000` (chống Decompression Bomb), giới hạn file upload $\le 10$MB, che giấu exception `str(e)` và chỉ trả thông báo lỗi tiếng Việt thân thiện ra client.
- [ ] **TASK-02: Endpoint trích xuất bản đồ nhiệt Grad-CAM (`layer4[-1]`) & Đóng gói Mạng Docker**
  - Trách nhiệm: **Thành viên B**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Trả về ảnh Heatmap phủ lên ảnh gốc để hiển thị vùng nghi vấn nấm bệnh trên giao diện.
  - **Hạ tầng Docker**: Cập nhật `docker-compose.yml` khép kín các cổng `8000:8000`, `8001:8001`, `9001:9001` (chỉ cho phép giao tiếp nội bộ qua Docker bridge network giữa Core API và AI Service), chuyển thông tin đăng nhập MinIO vào `.env`.

### 👨‍💻 Phân công Thành viên A (System & Backend Lead):
- [ ] **TASK-03: Cập nhật CSDL & Nạp Seed Data An toàn theo nguyên tắc Idempotent**
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Áp dụng migration EF Core 10 bảng, nạp 14 loài cây (`PlantCategories`), 40 lớp cây trồng (`Diseases`: 38 lớp AI + 2 lớp bổ trợ sổ tay), bỏ qua `KnowledgeSources` đã có đủ 112 bài (chống nhân đôi lên 224), và nạp 1–2 ca bệnh mẫu (`Tomato___Late_blight`) theo nguyên tắc Idempotent (chạy nhiều lần không bị duplicate) để thông luồng cho endpoint `diagnose`. Dọn dẹp các chuỗi máy chủ/credentials nhạy cảm trong `appsettings.json`, chuyển sang biến môi trường `.env`.
- [ ] **TASK-04: Xây dựng Core API (.NET 8 Clean Architecture), Tích hợp MinIO Storage & Bảo mật API**
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Cấu hình MinIO bucket `lavitree-diagnoses`, hoàn thiện endpoint toàn trình `POST /api/v1/diagnose` gọi AI Service và lưu bản ghi lịch sử.
  - **Hạng mục Bảo mật Core API**:
    - Tạo `[AdminApiKeyAuth]` kiểm tra header `X-Admin-Key` từ `.env` để khóa tạm thời các API quản trị của `KnowledgeController.cs` (`POST/DELETE sources`, `GET export`), ngăn chặn việc xóa/sửa 112 tài liệu tri thức trên Supabase khi chưa làm JWT.
    - Cấu hình CORS siết chặt cho danh sách domain Web cụ thể (`http://localhost:3000`, `http://localhost:5173`), xóa bỏ `AllowAll`.
    - Giới hạn kích thước file upload $\le 10$MB trên Core API bằng `[RequestSizeLimit]`.


---

## 🧠 SPRINT 2: TRỌNG TÂM TRÍ TUỆ NHÂN TẠO TÁC TỬ (AGRI-AGENT & MCP ECOSYSTEM)
*Mục tiêu: Hiện thực hóa toàn diện nghiên cứu 27 DAY từ thư mục `extract/` vào `backend/agent-service` (FastAPI), kết nối Core API và CSDL Supabase/PostgreSQL.*

- [ ] **TASK-05: Thiết lập `backend/agent-service` & Cấu trúc Model Context Protocol (MCP Server)**
  - Trách nhiệm: **Thành viên B** (Agent Core) & **Thành viên A** (Data Provider)
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Kiến trúc MCP Server công bố 4 công cụ chuẩn JSON Schema (`lookup_disease_knowledge`, `check_weather_risk`, `query_pesticide_store`, `verify_phi_safety`), tuân thủ nguyên tắc Read-Only (DAY4), kết nối REST API thật từ Core API (.NET 8).
- [ ] **TASK-06: Tầng Tri thức Hybrid RAG (BM25 + Dense Vector) trên 112 Nguồn Khuyến Nông**
  - Trách nhiệm: **Thành viên B** (RAG Pipeline) & **Thành viên A** (Database & Chunking)
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Module Hybrid RAG (kế thừa DAY18) kết hợp BM25 (bắt chính xác tên hoạt chất thuốc và tỷ lệ pha) + Dense Vector (ngữ nghĩa triệu chứng bệnh) từ 112 tài liệu khuyến nông, hợp nhất RRF không gây ảo giác.
- [ ] **TASK-07: Xây dựng ReAct Loop, Bộ Chốt chặn An toàn (Guardrails) & Router Hạ cấp Ngoại tuyến**
  - Trách nhiệm: **Thành viên B**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Chu trình `Thought → Action → Observation` (kế thừa DAY3), chốt chặn PHI $\le 3$ ngày sát ngày thu hoạch (cảnh báo đỏ & từ chối thuốc độc), gắn nhãn `[DRAFT_RECOMMENDATION]` (HITL DAY11, 27), Circuit Breaker & Router Graceful Degradation tự động hạ cấp offline về CSDL IPM khi rớt mạng (DAY25, 27).
- [ ] **TASK-08: Triển khai Streaming SSE, Waterfall Trace Logging & Benchmark Nghiệm thu Đồ án**
  - Trách nhiệm: **Thành viên B** (Streaming & Trace) & **Thành viên A** (Client Test)
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Endpoint `POST /api/v1/agent/chat` truyền phát token thời gian thực bằng SSE, xuất file `trace_waterfall.json` đo đạc thời gian từng bước, bộ kịch bản tự động `run_agent_benchmark.py` (DAY26) pass 100% 5 ca lâm sàng phục vụ Hội đồng chấm thi.

---

## 💻 SPRINT 3: TỐI ƯU GIAO DIỆN, QUAN SÁT (OBSERVABILITY) & ĐÓNG GÓI BẢO VỆ
*Mục tiêu: Giao diện Web/Mobile hoàn chỉnh kết nối Cloud, màn hình quan sát suy luận của Agent và đóng gói container Docker dự phòng bảo vệ đồ án.*

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
- [ ] **TASK-12: Cấu hình Docker Compose hợp nhất (Container Dự phòng Demo) & Kịch bản Bảo vệ**
  - Trách nhiệm: **Thành viên A & B**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Hệ thống khởi động bằng 1 lệnh `docker compose up -d`, vận hành ổn định phục vụ kịch bản demo bảo vệ đồ án.
