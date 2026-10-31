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

### 👨‍💻 Phân công Thành viên B (AI Vision Specialist):
- [x] **TASK-01: Thiết lập `backend/ai-service` (FastAPI), Endpoint ResNet-18, Bộ lọc OOD đa tầng & Bảo mật AI**
- [x] **TASK-01: Thiết lập `backend/ai-service` (FastAPI), Endpoint ResNet-18, Bộ lọc OOD đa tầng & Bảo mật AI**
  - Trách nhiệm: **Thành viên B**
  - Trạng thái: `[x] DONE` (Đã hoàn thành 5 pha và nghiệm thu 5/5 test E2E qua `test_predict.py`)
  - Đầu ra: Nạp model `best_plant_model.pt`, tiền xử lý 224x224, trả về Top-1, Top-3, `confusion_group`, mẹo chụp theo lớp (đã bỏ Tier), bộ lọc OOD cơ bản (`ood_filter.py`: Tín hiệu màu thực vật sơ bộ + Energy-based OOD Score với ngưỡng tạm từ `OOD_ENERGY_THRESHOLD`) và tách bạch cảnh báo độ bất định Softmax ($T < 0.70$) với quy tắc sinh cảnh báo theo `docs/spec/classes.md`.
  - **Hợp tác Song song**: Dựng ngay Stub Endpoint `POST /api/v1/predict` (hardcoded JSON theo `api-contracts.md`) trong 30 phút đầu để Thành viên A làm TASK-04 song song.
  - **Hạng mục Bảo mật AI**: Xác thực ảnh bằng Pillow (`PIL.Image.open().verify()`), sau đó mở lại ảnh `Image.open()` tránh lỗi đóng luồng, bật `warnings.simplefilter('error', Image.DecompressionBombWarning)`, đặt `Image.MAX_IMAGE_PIXELS = 10_000_000`, giới hạn file $\le 10$MB, ẩn exception `str(e)`.
- [x] **TASK-02: Endpoint trích xuất bản đồ nhiệt Grad-CAM (`layer4[-1]`)**
  - Trách nhiệm: **Thành viên B**
  - Trạng thái: `[x] DONE` (Đã hoàn thành Single-pass inference, latency ~105ms, giảm 72% khi tắt heatmap, thread-safe với lock)
  - Đầu ra: Trả về ảnh Heatmap phủ lên ảnh gốc (Jet colormap) để hiển thị vùng nghi vấn nấm bệnh trên giao diện, xử lý trực tiếp trên bộ nhớ RAM không ghi đĩa tạm, latency $\le 1.0$s.

### 👨‍💻 Phân công Thành viên A (System & Backend Lead):
- [x] **TASK-03: Cập nhật CSDL & Nạp Seed Data An toàn theo nguyên tắc Idempotent**
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[x] DONE`
  - Đầu ra: Áp dụng migration EF Core 10 bảng, nạp 14 loài cây (`PlantCategories`), 40 lớp cây trồng (`Diseases`: 38 lớp AI + 2 lớp bổ trợ sổ tay), bỏ qua `KnowledgeSources` đã có đủ 112 bài (chống nhân đôi lên 224); nếu chạy trên CSDL trống thì giữ nguyên GUID gốc từ CSV. Nạp 1–2 ca bệnh mẫu (`Tomato___Late_blight`) theo nguyên tắc Idempotent để thông luồng cho endpoint `diagnose`.
- [x] **TASK-04: Xây dựng Core API (.NET 8 Clean Architecture), Tích hợp MinIO Storage, Bảo mật API & Quản lý Docker**
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[x] DONE`
  - Đầu ra: Cấu hình MinIO bucket `lavitree-diagnoses` (chỉ cho phép `s3:GetObject` ẩn danh, cấm `s3:ListBucket`), hoàn thiện endpoint toàn trình `POST /api/v1/diagnose` gọi AI Service và lưu bản ghi lịch sử, nghiệm thu E2E bằng ảnh `Tomato___Late_blight`. Khi ảnh OOD (`is_ood = true`), không lưu ảnh lên MinIO và không lưu CSDL để bảo vệ quyền riêng tư và tiết kiệm dung lượng.
  - **Hạng mục Bảo mật Core API & Docker**:
    - Tạo `[AdminApiKeyAuth]` kiểm tra header `X-Admin-Key` từ `.env` với nguyên tắc Fail-closed và so sánh `CryptographicOperations.FixedTimeEquals` để khóa tạm thời các API quản trị của `KnowledgeController.cs` (`POST/DELETE sources`, `GET export`).
    - Thêm `AddRateLimiter` cho endpoint chẩn đoán (đọc ngưỡng từ `RATE_LIMIT_PER_MINUTE` trong `.env`) để bảo vệ tài nguyên tính toán.
    - Cấu hình CORS siết chặt cho danh sách domain Web cụ thể (`http://localhost:3000`, `http://localhost:5173`), xóa bỏ `AllowAll`.
    - Duy nhất quản lý `docker-compose.yml`: bind port AI Service `127.0.0.1:8000:8000`, Agent Service `127.0.0.1:8001:8001`, MinIO Console `127.0.0.1:9001:9001` (chỉ mở cho local host của dev, cổng 9000 mở cho client tải ảnh). Tạo mật khẩu MinIO mới và key ngẫu nhiên mạnh trong `.env` thay cho mật khẩu lộ `miniopassword123`.


---

## 🧠 SPRINT 2: SONG HÀNH TÁC TỬ NÔNG NGHIỆP (AGENT B) & HÌNH THÀNH HỆ THỐNG TOÀN DIỆN (SYSTEM & WEB A)
*Mục tiêu: Hiện thực hóa song song: Bộ não AI Agent (FastAPI:8001) & Trục Nghiệp vụ Web/Auth/Store (.NET 8 + React), đảm bảo hệ thống hoàn chỉnh lát cắt dọc trước khi bước vào Sprint 3.*

> **Nguyên tắc Ngày Đầu Tiên (Contract-First & Mock Stub)**:
> - Thành viên A dựng Stub API Thuốc `GET /api/v1/medicines/search` cho B làm việc ngay.
> - Thành viên B dựng Stub SSE Chat `POST /api/v1/agent/chat` cho A dựng giao diện ngay.
> - Hai bên phát triển độc lập không bị chặn, cuối tuần 2 ghép nối chính thức.

### 👨‍💻 Phân công Thành viên B (AI Agent Lead):
- [ ] **TASK-06: Tầng Tri thức Hybrid RAG (BM25 + ChromaDB) & Ingestion Pipeline Kiểm định** *(Ưu tiên 1 - Tuần 1)*
  - Trách nhiệm: **Thành viên B** (RAG Pipeline) & **Thành viên A** (PostgreSQL Hybrid Schema)
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Bảng tri thức PostgreSQL mô hình Hybrid (trường cấu trúc lọc cứng + `full_content TEXT` + `chunks JSONB`), AI Ingestion trích xuất URL có Admin duyệt (HITL), đồng bộ ChromaDB cục bộ + BM25 Okapi cho 5 bệnh demo, đạt Recall@3 đối chứng 100%.
- [ ] **TASK-05: Thiết lập `backend/agent-service:8001` & Cấu trúc Model Context Protocol (FastMCP Server)** *(Ưu tiên 2 - Tuần 1)*
  - Trách nhiệm: **Thành viên B** (Agent Core) & **Thành viên A** (Core API Data Provider)
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Service chạy port **`8001`** công bố 4 công cụ chuẩn FastMCP (Read-Only: `lookup_disease_knowledge`, `check_weather_risk`, `query_pesticide_store`, `verify_phi_safety`), kết nối RAG Task 06 và REST API thật từ Core API (.NET 8).
- [ ] **TASK-07: Chu trình ReAct Loop (Gemini 2.0), Bộ Chốt chặn An toàn Code & Router Hạ cấp Ngoại tuyến** *(Ưu tiên 3 - Tuần 2)*
  - Trách nhiệm: **Thành viên B**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: ReAct loop với Gemini 2.0/2.5 Flash, **Hard Code Guardrail bằng Python** (lọc thuốc cấm và $DaysToHarvest \le PhiDays$ trực tiếp bằng code trước khi đưa vào LLM), gắn nhãn `[DRAFT_RECOMMENDATION]`, Circuit Breaker & Router tự động hạ cấp về tệp phác đồ IPM cục bộ (`offline_ipm_cache.json`) trong $< 1.0$s khi rớt mạng.
- [ ] **TASK-08: Triển khai Streaming SSE, Waterfall Trace Logging & Benchmark 5 Ca Lâm sàng** *(Ưu tiên 4 - Tuần 2)*
  - Trách nhiệm: **Thành viên B** (Streaming & Trace) & **Thành viên A** (Client Test)
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Endpoint `POST /api/v1/agent/chat` (port 8001) chuẩn SSOT `api-contracts.md` Mục 4.1 (`trace_start`, `thought`, `action`, `observation`, `delta`, `final_answer`), TTFT $\le 2.0$s, xuất `trace_waterfall.json`, bộ benchmark chạy tự động 5 ca lâm sàng (x3 lần, temp=0) đạt 15/15 PASS.

### 👨‍💻 Phân công Thành viên A (System, Auth, Web & Early Mobile):
- [ ] **TASK-A01: Module Xác thực, Phân quyền JWT & Vá Bảo mật Core API** *(P0 - Tuần 1)*
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: `AuthController.cs` đăng ký / đăng nhập (JWT Token, BCrypt, role `FARMER`/`ADMIN`), trích xuất `userId` từ token claims cho các API khám lá (bỏ `userId` từ form), cung cấp ngay Stub API Thuốc `GET /api/v1/medicines/search` cho B.
- [ ] **TASK-A02: Hoàn thiện Web Portal Khám lá E2E, Sổ tay Bệnh học & Lịch sử Cá nhân** *(P0 - Tuần 1)*
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Màn hình Đăng nhập/Đăng ký trên Web; trang Khám lá (`DiagnosePage.tsx`) hiển thị chẩn đoán, Grad-CAM, IPM; trang Sổ tay bệnh học (`HandbookPage.tsx`); trang Lịch sử cá nhân (`HistoryPage.tsx`) lưu và xem lại các ca khám theo tài khoản.
- [ ] **TASK-A03: Phân hệ Cửa hàng Vật tư Nông nghiệp & Cổng Admin Quản trị Tri thức** *(P1 - Tuần 2)*
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Trang Cửa hàng Lavitree Store xem thuốc, giỏ hàng, đặt hàng COD giả lập (`POST /api/v1/orders`); Cổng Admin (`AdminDashboard.tsx`) xem danh sách bài viết, duyệt bài (`IsManualApproved = true`), cập nhật kho thuốc, gắn cờ `requires_expert = true`.
- [ ] **TASK-A04: Tích hợp Khung Chat Web Streaming SSE & Khởi tạo Dự án Android Native** *(P1 - Tuần 2)*
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Khung Chat Trợ lý AI trên Web Portal nhận stream SSE mượt mà từ Task 08 của B; khởi tạo base project Android Native (`mobile/android/`) bằng Kotlin & Jetpack Compose, dựng trước khung 2 màn hình chính (Khám lá & Chat).

---

## 💻 SPRINT 3: TỐI ƯU HÓA, QUAN SÁT (OBSERVABILITY) & ĐÓNG GÓI BẢO VỆ
*Mục tiêu: Đưa hệ thống lên mức độ hoàn thiện cao nhất (Polish UI/UX, Mobile Native, Observability Dashboard) và đóng gói container Docker dự phòng bảo vệ tốt nghiệp.*

- [ ] **TASK-09: Tối ưu hóa Trải nghiệm Web Portal (UX/UI, Responsive, Chống XSS)**
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Giao diện chuẩn responsive trên mọi thiết bị (Mobile/Tablet/Desktop), hiệu ứng chuyển cảnh mượt mà, loading skeletons, bảo mật token.
- [ ] **TASK-10: Hoàn thiện Android Native App (Kotlin, Jetpack Compose, CameraX)**
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Ứng dụng di động Native chụp ảnh lá ngoài vườn qua CameraX $\rightarrow$ gọi Core API $\rightarrow$ hiển thị kết quả chẩn đoán và Chat trực tiếp với Agent qua SSE.
- [ ] **TASK-11: Xây dựng Admin Dashboard quản trị dịch tễ & Màn hình Quan sát (Agent Observability Waterfall Chart)**
  - Trách nhiệm: **Thành viên A & B**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Trực quan hóa tiến trình suy luận ReAct Loop của Agent bằng biểu đồ Waterfall Chart cho Hội đồng chấm thi xem trực tiếp.
- [ ] **TASK-12: Cấu hình Docker Compose hợp nhất (Container Dự phòng Demo) & Kịch bản Bảo vệ**
  - Trách nhiệm: **Thành viên A & B**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Hệ thống khởi động bằng 1 lệnh `docker compose up -d`, vận hành ổn định phục vụ kịch bản demo bảo vệ đồ án.
- [ ] **TASK-13: Hiệu chỉnh ngưỡng OOD chính thức & Đo lường cho báo cáo** *(chuyển từ Sprint 1)*
  - Trách nhiệm: **Thành viên B**
  - Trạng thái: `[ ] PENDING`
  - Đầu ra: Chọn $\tau_{energy}$ theo phân vị thứ 5 trên tập A; đo từ chối nhầm $\le 5\%$ trên tập B và phát hiện OOD $\ge 80\%$ trên tập C; cập nhật `OOD_ENERGY_THRESHOLD` và đưa bảng số liệu vào chương đánh giá.
