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
- [/] **TASK-06: Tầng Tri thức Hybrid RAG (BM25 + ChromaDB) & Ingestion Pipeline Kiểm định** *(Ưu tiên 1 - Tuần 1)*
  - Trách nhiệm: **Thành viên B** (RAG Pipeline) & **Thành viên A** (PostgreSQL Hybrid Schema)
  - Trạng thái: `[/] IN PROGRESS` (Code B xong, 11/11 test PASS: Recall@3 không lọc = 90% trên 22 bài CSV, độ trễ 145ms. Docker compose + Postgres đã chạy ở S2-BONUS đợt 5. Còn của B: đo truy vấn chéo Việt–Anh, thử `label-paragraphs` với 3 bài thật + câu chèn lệnh; luồng duyệt / bỏ duyệt → chat là S2-BONUS BUG-74)
  - Đầu ra: Tận dụng trực tiếp dữ liệu tri thức đã duyệt của 5 bệnh demo trong `KnowledgeSources` từ Sprint 1 (mỗi dòng = 1 chunk, metadata gồm `UnitType`, `IsVerbatim`), script `sync_index.py` tự động đồng bộ sang ChromaDB cục bộ + BM25 Okapi, đạt Recall@3 đối chứng $\ge 90\%$, endpoint `POST /internal/knowledge/label-paragraphs` gợi ý nhãn đoạn (chỉ trả số đoạn) hỗ trợ A03, endpoint `/internal/reindex` tự động tái tạo chỉ mục khi Admin duyệt/bỏ duyệt bài.
- [x] **TASK-05: Thiết lập `backend/agent-service:8001` & Cấu trúc Model Context Protocol (FastMCP Server)** *(Ưu tiên 2 - Tuần 1)*
  - Trách nhiệm: **Thành viên B** (Agent Core) & **Thành viên A** (Core API Data Provider)
  - Trạng thái: `[x] DONE` (`test_mcp_tools.py` 10/10 PASS với Core, PostgreSQL và OpenWeather thật. Image agent-service build và chạy được dưới user thường; chưa chạy cả hệ thống bằng docker compose.)
  - Đầu ra: Service chạy port **`8001`** công bố 4 công cụ chuẩn FastMCP (Read-Only: `lookup_disease_knowledge`, `check_weather_risk`, `query_pesticide_store`, `verify_phi_safety`), kết nối RAG Task 06 và REST API thật từ Core API (.NET 8).
- [x] **TASK-07: Chu trình ReAct Loop (Gemini), Bộ Chốt chặn An toàn Code & Router Hạ cấp Ngoại tuyến** *(Ưu tiên 3 - Tuần 2)*
  - Trách nhiệm: **Thành viên B**
  - Trạng thái: `[x] DONE` (Code xong và đã review lại ngày 08/11/2026: `test_react_guardrails.py` 25/25 PASS, thử phá 12/12 kiểu đều bị test phát hiện, `test_react_gemini_live.py` 3/3 PASS với Gemini thật nhưng kho thuốc giả lập. Việc còn lại đã chuyển sang TASK-08 mục 0.)
  - Đầu ra: ReAct loop với Gemini (model theo env `GEMINI_MODEL`), **Hard Code Guardrail bằng Python** (lọc thuốc cấm và $DaysToHarvest \le PhiDays$ trực tiếp bằng code trước khi đưa vào LLM), gắn nhãn `[DRAFT_RECOMMENDATION]`, Circuit Breaker & Router tự động hạ cấp về tệp phác đồ IPM cục bộ (`offline_ipm_cache.json`) trong $< 1.0$s khi rớt mạng.
- [x] **TASK-08: Triển khai Streaming SSE, Waterfall Trace Logging & Benchmark 5 Ca Lâm sàng** *(Ưu tiên 4 - Tuần 2)*
  - Trách nhiệm: **Thành viên B** (Streaming & Trace) & **Thành viên A** (Client Test)
  - Trạng thái: `[x] DONE` (Pha 1–3 xong, đã review và sửa ngày 08/11/2026: `test_task08_streaming_trace.py` 12/12, `test_react_guardrails.py` 25/25, `test_rag_accuracy.py` 11/11. Lần đo cuối: benchmark 9/15 PASS (2026-11-08 09:33:31, Gemini `gemini-3.5-flash-lite`, Core giả lập theo danh mục seed (Core không chạy), RAG PostgreSQL (15 đoạn đã duyệt)); 0 lượt rơi về offline; trong 15 lượt Gemini chạy thật: TTFT 1.2–1.7 giây, tổng thời gian 3.1–6.7 giây. Nghiệm thu với dữ liệu và hệ thống thật chuyển sang TASK-S2-BONUS mục 3.7; Web Chat ở A04.)
  - Đầu ra: Endpoint `POST /api/v1/agent/chat` (port 8001) chuẩn SSOT `api-contracts.md` Mục 4.1 (`trace_start`, `thought`, `action`, `observation`, `delta`, `final_answer`), trường `citations` trích dẫn trực tiếp từ RAG (chống LLM bịa URL), TTFT $\le 2.0$s, xuất `trace_waterfall.json`, bộ benchmark chạy tự động 5 ca lâm sàng (x3 lần, temp=0) đạt 15/15 PASS.

### 👨‍💻 Phân công Thành viên A (System, Auth, Web & Early Mobile):
- [x] **TASK-A00: Nền tảng Giao diện — Tailwind v4, shadcn/ui & Design Tokens** *(P0 - Đầu Tuần 1)*
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[x] DONE` (Hoàn thành 7 pha: Tailwind v4 + shadcn/ui Radix, Be Vietnam Pro font nội bộ, token chuẩn hóa ui-ux.md, AppShell/AdminShell responsive, router, ResultStatusBadge theo classes.md, /dev/styleguide, đồng bộ Android theme & fonts, build pass 100%)
  - Đầu ra: Tailwind v4 + shadcn/ui, token màu & font Be Vietnam Pro theo `docs/architecture/ui-ux.md`, khung `AppShell`/`AdminShell`, router + trang 404/403, `ResultStatusBadge`, trang `/dev/styleguide`; theme Android đồng bộ. Chi tiết: `tasks/sprint-02/task-A00-ui-foundation.md`.
- [x] **TASK-A01: Module Xác thực, Phân quyền JWT & Vá Bảo mật Core API** *(P0 - Tuần 1)*
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[x] DONE` (Đã hoàn thành 100%: Auth Controller đăng ký/đăng nhập băm BCrypt, JWT Bearer Token 7 ngày, vá IDOR trên Diagnose, bảo vệ lịch sử cá nhân; đã khắc phục triệt để 11 lỗi chặn Đợt 0, nạp mật khẩu Admin mới, lọc thuốc cấm Paraquat, cập nhật migration DB và đạt 14/14 tests qua `test_task_a01_auth.py`)
  - Đầu ra: `AuthController.cs` đăng ký / đăng nhập (JWT Token, BCrypt, role `FARMER`/`ADMIN`), trích xuất `userId` từ token claims cho các API khám lá (loại bỏ hoàn toàn `userId` từ form-data chống IDOR), cung cấp ngay Stub API Thuốc `GET /api/v1/medicines/search` cho B, nạp seed tự động tài khoản Quản trị `admin@lavitree.vn`.
- [x] **TASK-A02: Hoàn thiện Web Portal Khám lá E2E, Sổ tay Bệnh học & Lịch sử Cá nhân** *(P0 - Tuần 1)*
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[x] DONE` (đóng 22/11/2026. Mật khẩu admin, `JWT_SECRET_KEY`, phần thời tiết đã xử lý; chạy thời tiết với khóa OpenWeather thật theo dõi ở S2-BONUS BUG-05/07.)
  - Đầu ra: Màn hình Đăng nhập/Đăng ký trên Web (`LoginPage.tsx`, `RegisterPage.tsx`); trang Khám lá (`DiagnosePage.tsx`) hiển thị chẩn đoán, Grad-CAM, IPM; trang Sổ tay bệnh học (`HandbookPage.tsx`); trang Lịch sử cá nhân (`HistoryPage.tsx`) lưu và xem lại các ca khám theo tài khoản (`/history/:id` - W-08).
- [x] **TASK-A03: Phân hệ Cửa hàng Vật tư Nông nghiệp & Cổng Admin Quản trị Tri thức** *(P1 - Tuần 2)*
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[x] DONE` (đóng 22/11/2026; BUG-51 đối chiếu pháp lý thuốc chấp nhận rủi ro, chuyển Sprint 3. Đã xử lý 15 lỗi đánh giá: chống oversell atomic, chuẩn hóa URL & lock 4 đoạn, loại bỏ secret hardcode, phân tách bảo mật tri thức công khai, bổ sung giao diện Bác sĩ & ca bệnh khó, dọn sạch dữ liệu test Supabase, cập nhật tài liệu database-schema.md & api-contracts.md)
  - Đầu ra: Trang Cửa hàng Lavitree Store xem thuốc, giỏ hàng, đặt hàng COD giả lập (`POST /api/v1/orders`); Chức năng chính Cổng Admin (`AdminDashboard.tsx`): Nhập bài báo dán văn bản + URL (`POST /ingestions`) $\rightarrow$ AI gợi ý nhãn $\rightarrow$ Admin tick tối đa 4 đoạn ngắn ($\le 800$ ký tự) $\rightarrow$ Core lấy chữ từ RAM lưu nguyên văn (`POST /commit` gán `UnitType`, `IsVerbatim = true`, `IsManualApproved = true`), migration C# gỡ unique `(ModelClass, SourceUrl)` và thêm cột, sửa duplicate check trong `KnowledgeController.cs`, bảng quản lý kho thuốc (`IsAllowed`, `PhiDays`), gắn cờ ca bệnh khó `requires_expert`.
- [x] **TASK-A04: Tích hợp Khung Chat Web Streaming SSE & Khởi tạo Dự án Android Native** *(P1 - Tuần 2)*
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[x] DONE` (đóng 22/11/2026: Web Chat chạy với Agent + Gemini thật qua nginx (S2-BONUS đợt 5); Android `assembleDebug` / `assembleRelease` đạt. Chạy thử app, camera, chat Android chuyển TASK-10.)
  - Đầu ra: Khung Chat Trợ lý AI trên Web Portal nhận stream SSE mượt mà từ Task 08 của B; khởi tạo base project Android Native (`mobile/android/`) bằng Kotlin & Jetpack Compose, dựng trước khung 2 màn hình chính (Khám lá & Chat).
  - Việc chuyển sang từ A02/A03: Đã xử lý triệt để BUG-58, BUG-81 → BUG-85.

### 🤝 Việc chung Thành viên A & B:
- [/] **TASK-S2-BONUS: Dọn việc tồn Sprint 2 & Nghiệm thu chéo TVA – TVB** *(P0 cho nhóm bắt buộc trước deploy)*
  - Trách nhiệm: **Thành viên A** (Core API, Web, hạ tầng) & **Thành viên B** (Agent, RAG, Gemini); người làm không tự nghiệm thu dòng của mình.
  - Trạng thái: `[/] CHỜ NGHIỆM THU PRODUCTION` (code xong. Còn: BUG-89 đổi Secret, deploy rồi thử BUG-74, BUG-88 trên web thật. BUG-05/07, BUG-86 xong; BUG-91 chốt bật trả phí Gemini. Việc Android và việc ít quan trọng đã ghi chuyển Sprint 3.)
  - Đầu ra: Đóng các dòng còn mở của A02/A03 và review 08/11/2026: đổi mật khẩu admin và `JWT_SECRET_KEY` trên production, kiểm tra Secret `ENV_PRODUCTION`, dọn dữ liệu test có thể đã vào Supabase, xác nhận migration, đối chiếu danh mục thuốc (BUG-51), nghiệm thu chéo duyệt/bỏ duyệt → chat và nhập bài với Gemini thật, các lỗi bảo mật và hạ tầng còn lại. Chi tiết: `tasks/sprint-02/task-s2-bonus-hardening-acceptance.md`; mục 3.7 cho Agent: sửa dữ liệu Trichoderma, duyệt tri thức Ca 3–4, benchmark 15/15 với Core thật, tài khoản CSDL chỉ đọc, quota Gemini và mục tiêu thời gian phản hồi. Thêm các việc còn mở của TASK-07/08 (mục 3.7) và TASK-A04 (mục 3.8: build và chạy app Android, Web Chat với Agent thật, `draft_order`).

---

## 💻 SPRINT 3: TỐI ƯU HÓA, QUAN SÁT (OBSERVABILITY) & ĐÓNG GÓI BẢO VỆ
*Mục tiêu: Đưa hệ thống lên mức độ hoàn thiện cao nhất (Polish UI/UX, Mobile Native, Observability Dashboard) và đóng gói container Docker dự phòng bảo vệ tốt nghiệp.*

- [ ] **TASK-09: Tối ưu hóa Trải nghiệm Web Portal (UX/UI, Responsive, Chống XSS)**
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[/] IN PROGRESS`
  - Đầu ra: Giao diện chuẩn responsive trên mọi thiết bị (Mobile/Tablet/Desktop), hiệu ứng chuyển cảnh mượt mà, loading skeletons, bảo mật token.
  - Đợt 1 (08/11/2026): nền video lá cây cho Đăng nhập/Đăng ký và trang chủ, dùng Lavi 3D và Lavi 2D (avatar chat), trang Tổng quan Admin mới (`/admin`), form nhập bài báo chuyển sang `/admin/ingest`, ẩn mã lớp mô hình khỏi giao diện. Chi tiết và việc còn lại: `tasks/sprint-03/task-09-web-ux-polish.md`.
- [ ] **TASK-10: Hoàn thiện Android Native App (Kotlin, Jetpack Compose, CameraX)**
  - Trách nhiệm: **Thành viên A**
  - Trạng thái: `[ ] PENDING`
  - Nhận từ Sprint 2: BUG-104 (chạy app trên emulator), BUG-58 (xoay ảnh EXIF), BUG-102 (camera), BUG-108 (chat SSE, điều hướng), BUG-103.
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
- [ ] **TASK-14: Nâng cấp Hệ thống Bộ nhớ Tác tử Toàn diện (Persistent STM & LTM - Kế thừa DAY 17)**
  - Trách nhiệm: **Thành viên B** (Agent Memory) & **Thành viên A** (Database Schema)
  - Trạng thái: [ ] PENDING
  - Đầu ra: Lưu trữ phiên chat bền vững vào PostgreSQL (ChatSessions & ChatMessages), nén ngữ cảnh tự động (Context Compaction khi > 3000 tokens); Tool MCP lookup_farmer_history đọc DiagnosisRecords để theo dõi tiến trình hồi phục cây trồng; Quản lý hồ sơ dài hạn FarmerProfile (địa phương, thổ nhưỡng, tiêu chuẩn VietGAP) phục vụ cá nhân hóa sâu sắc.

- [ ] **TASK-15: Nhập bài báo v2 — Dán cả trang, AI tự điền, ảnh triệu chứng, gợi ý vật tư**
  - Trách nhiệm: **Trưởng nhóm** (chia lại cho A/B sau nếu cần)
  - Trạng thái: `[/] IN PROGRESS`
  - Đầu ra: Pha 1: dán cả trang và tự lọc rác, AI tự điền thông tin bài trong cùng lần gọi gán nhãn, nới giới hạn trích theo tỉ lệ bài (tạm thời mở rộng tối đa 30 đoạn nguyên văn, sàn tối thiểu 20.000 ký tự và tỷ lệ ≤ 90% bài để nạp nhanh phục vụ giai đoạn phát triển; cần siết lại về mức chuẩn thương mại 8–20 đoạn và 2.500–4.000 ký tự trước release). Pha 2: ảnh triệu chứng có ghi nguồn, hiện ở Sổ tay. Pha 3: gợi ý vật tư từ đoạn trích, Admin tự nhập PHI/nguồn, trạng thái `NOT_SOLD`, vật tư canh tác, chốt chặn thuốc cấm tạm thời. Pha 4: quản lý thuốc cấm, đoạn SUMMARY có duyệt. Chi tiết: `tasks/sprint-03/task-15-knowledge-ingestion-v2.md`.
  - **TODO Hậu Đồ Án (Commercial Release Hardening)**: Siết lại `INGEST_MAX_CHUNKS` từ 30 về 8–20 đoạn, đưa sàn `INGEST_MIN_QUOTA_FLOOR` từ 20.000 về 2.500–4.000 ký tự, và giảm `INGEST_MAX_RATIO_PERCENT` từ 90% về 30–60% để chuẩn hóa quy tắc trích dẫn thương mại theo Điều 25 Luật SHTT.

- [x] **TASK-16: Tách `AdminDashboard.tsx` thành các trang Admin riêng**
  - Trách nhiệm: **Trưởng nhóm** (làm cùng Claude Code)
  - Trạng thái: `[x] DONE`
  - Đầu ra: File 10.082 dòng đang phục vụ 5 trang (`/admin/ingest`, `/admin/knowledge`, `/admin/images`, `/admin/inventory`, `/admin/escalations`) được tách thành 5 file trang riêng; hàm tiện ích sang `features/admin/lib/`; khung soạn bài thành component dùng chung. Refactor thuần, không đổi giao diện/chức năng/API; mỗi trang một commit, đi từ trang đơn giản (Ảnh, Chuyển chuyên gia) đến Nhập bài báo. Chi tiết: `tasks/sprint-03/task-16-admin-dashboard-split.md`.

- [x] **TASK-17: Tra cứu vật tư bằng AI web, gợi ý Google theo loại, tô đậm trích dẫn**
  - Trách nhiệm: **Trưởng nhóm** (làm cùng Claude Code)
  - Trạng thái: `[x] DONE` (đợt 1 + đợt 2)
  - Đầu ra đợt 1: prompt JSON (chế độ Dev) kèm đoạn trích, yêu cầu AI xác định vật tư theo ngữ cảnh (sản phẩm / tự pha / giống / vật tư / biện pháp) và trả `target_diseases` từ danh sách mã bệnh hợp lệ; nạp JSON gộp bệnh hại, báo bệnh không khớp, gợi ý link; chip Tra Google theo loại vật tư; tô đậm tên vật tư trong trích dẫn.
  - Đầu ra đợt 2: bệnh hại điền sẵn theo mọi bài trích (gợi ý có bệnh chưa gắn giữ PENDING để Gắn SP sau); gộp đoạn cùng bài + cùng bệnh; nút "Tìm link với AI" chỉ nhờ AI tìm link; modal gọn, có ô "Dùng bài này"; sửa lỗi Gắn SP ở dòng gộp. Chi tiết: `tasks/sprint-03/task-17-product-research-ai.md`.

- [x] **TASK-18: Phiếu cách dùng vật tư, prompt Gemini tổng hợp, chuẩn bị lịch phun**
  - Trách nhiệm: **Trưởng nhóm** (làm cùng Claude Code)
  - Trạng thái: `[x] DONE` (bản nhẹ; lịch phun / nhắc nhở bản đầy đủ: `docs/architecture/treatment-schedule-design.md`)
  - Đầu ra: Nút "Tạo SP" ở hàng mở modal trích dẫn; gộp đoạn trích nằm trọn trong đoạn khác; chỉ còn 1 nút "Sao chép prompt cho Gemini" (chế độ Dev); prompt mới tổng hợp thông tin tại Việt Nam bám đoạn trích, trả JSON (mô tả chi tiết + phiếu `usage`: liều, buổi, số lần, cách nhau, tối đa lần/vụ, thời tiết, an toàn) và danh sách nguồn + ảnh để chọn; cột `Products.UsageProfile` (jsonb) lưu phiếu cách dùng để làm lịch phun / nhắc nhở ở task sau; "Hướng dẫn sử dụng" ghép tự động theo nhãn cố định cho trợ lý Lavi đọc. Chi tiết: `tasks/sprint-03/task-18-usage-profile-gemini-prompt.md`.

- [x] **TASK-20: Trang chi tiết bệnh trong Sổ tay, dựng từ tri thức đã duyệt (có nguồn)**
  - Trách nhiệm: **Trưởng nhóm** (giao Gemini làm)
  - Trạng thái: `[x] DONE`
  - Đầu ra: Trang `/handbook/:classCode` ghép các đoạn `KnowledgeSources` đã duyệt theo nhãn (Triệu chứng / Nguyên nhân / Phòng ngừa / Xử lý), nguồn tham khảo đánh số; bỏ chữ điền tạm của seeder; cột `Diseases.PathogenName` + trang Admin `/admin/diseases` sửa tác nhân; nút "Xem bệnh này trong Sổ tay" trong Chat (Lavi vẫn trích bài gốc). Chi tiết và thiết kế giao diện: `tasks/sprint-03/task-20-handbook-disease-detail.md`.

- [x] **TASK-21: Trang chi tiết sản phẩm cho Admin (thông tin + bệnh áp dụng kèm căn cứ)**
  - Trách nhiệm: **Trưởng nhóm** (giao Gemini làm)
  - Trạng thái: `[x] DONE`
  - Đầu ra: Trang riêng `/admin/inventory/products/:id` (không popup), 2 tab: "Thông tin sản phẩm" (sửa `Product`) và "Bệnh áp dụng & căn cứ" (theo từng bệnh: công tắc khuyên dùng, bài báo đã nhắc thuốc, chừa ô "Cách dùng cho bệnh này" cho TASK-22; công tắc khuyên dùng, chỉ cho "Gỡ khỏi sản phẩm" với gợi ý); API `GET /medicines/{id}`, `GET /medicines/{id}/evidence`, `POST /knowledge/product-suggestions/{id}/unlink`; component dùng lại cho trang cửa hàng và trang "thuốc cho bệnh" sau này. Chi tiết và thiết kế giao diện: `tasks/sprint-03/task-21-admin-product-detail-page.md`.

- [x] **TASK-22: Phiếu cách dùng thuốc theo từng bệnh (`ProductUsageRules`)**
  - Trách nhiệm: **Trưởng nhóm** (giao Gemini làm). Phụ thuộc: TASK-21 xong trước
  - Trạng thái: `[x] DONE`
  - Đầu ra: Bảng `ProductUsageRules` + migration (local), 5 API `/medicines/{id}/usage-rules`; ô "Cách dùng cho bệnh này" trong dòng bệnh ở Tab 2 trang chi tiết sản phẩm sửa được (tạo từ phiếu chung, sửa, xóa, đánh dấu đã đối chiếu nhãn), đặt cạnh căn cứ bài báo. Hỗ trợ nhóm tác động `ActionGroup` (FRAC/IRAC) cho bộ lập lịch chăm sóc nông nghiệp `CareSchedules`. `Products.UsageProfile` giữ làm phiếu chung. Là bước 1–3 lộ trình `docs/architecture/treatment-schedule-design.md`. Chi tiết: `tasks/sprint-03/task-22-usage-rules-per-disease.md`.

- [x] **TASK-23: Sửa lỗi trắng trang "Đơn hàng của tôi" (`/orders`) + ErrorBoundary** (P0, lỗi production)
  - Trách nhiệm: giao agent; nghiệm thu: Claude Code / trưởng nhóm
  - Trạng thái: `[x] DONE` (22/11/2026)
  - Đầu ra: `OrdersPage.tsx` đọc đúng hợp đồng API (`order_id`, `total_price` thay cho `id`, `subtotal`), dùng `formatCurrency`/`formatDate`; `ErrorBoundary` dùng chung bọc `<Outlet />` ở `AppShell`/`AdminShell`/`AuthLayout` (bắt cả lỗi tải chunk sau deploy); thêm `total_price` vào `api-contracts.md`. Không sửa backend. Chi tiết: `tasks/sprint-03/task-23-orders-page-crash.md`.

- [/] **TASK-24: Nâng cấp trải nghiệm hội thoại Trợ lý Lavi (Neural TTS & LLM văn phong linh hoạt)** (P1)
  - Trách nhiệm: **Trưởng nhóm** (giao Antigravity làm)
  - Trạng thái: `[/] IN PROGRESS` (Đã hoàn thành Phần 1: Giọng đọc AI tự nhiên Neural TTS, chuẩn bị sang Phần 2: LLM Model / Prompt)
  - Đầu ra:
    - **Phần 1 [x] DONE**: Endpoint `POST /api/v1/agent/tts` dùng thư viện `edge-tts 7.3.1` sinh luồng MP3 Neural chất lượng cao với giọng `vi-VN-HoaiMyNeural` (Nữ) và `vi-VN-NamMinhNeural` (Nam), có ngữ điệu nhấn nhá tự nhiên, phát âm chuẩn thuật ngữ song ngữ Anh - Việt; giao diện ChatMessageItem có nút `[Đọc AI]`, spinner `Loader2`, hiệu ứng sóng `VolumeX` và nút toggle `[Nữ / Nam]`, bộ nhớ đệm audio blob và fallback tự động sang Web Speech Synthesis.
    - **Phần 2 [ ] PENDING**: Tinh chỉnh System Prompt (`app/agent/prompts.py`) và nhiệt độ (`temperature = 0.6`) để văn phong trả lời mềm mại, đan xen thuật ngữ tiếng Anh trong ngoặc đơn, linh hoạt chuyển đổi model. Chi tiết: `tasks/sprint-03/task-24-chat-voice-and-llm-enhancement.md`.

- [x] **TASK-25: Chat Lavi hiểu ảnh người dùng gửi + ảnh bệnh mẫu + thẻ sản phẩm** (P1; phần A0 là P0)
  - Trách nhiệm: giao agent; nghiệm thu: Claude Code / trưởng nhóm
  - Trạng thái: `[x] DONE`
  - Đầu ra: ảnh đính kèm trong chat đi qua modal cắt ảnh lá `LeafCropper` và `POST /diagnose` có sẵn (OOD / lỗi thì không gọi agent), agent nhận `image_context` và không được nói "mình thấy trong ảnh"; ảnh không còn lưu base64 trong `localStorage`; `final_answer` thêm `reference_images` (backend gom, bỏ rule 10 Markdown ảnh) và `suggested_products` (thẻ gợi ý sản phẩm trực quan, giá lấy từ Core, bấm mở `/store/:id`, không cần nút giỏ hàng); `draft_order` vẫn `null` theo BUG-106; sửa redirect `/products/:id`; bổ sung reverse proxy `/lavitree-images/` trong `nginx.conf`. Chi tiết: `tasks/sprint-03/task-25-chat-image-and-rich-cards.md`.

- [x] **TASK-26: Phân hệ Quản lý Đơn hàng Toàn sàn cho Admin (`/admin/orders`)** (P1)
  - Trách nhiệm: **Trưởng nhóm** (giao Antigravity làm)
  - Trạng thái: `[x] DONE`
  - Đầu ra: Thêm 2 endpoint Core API `GET /api/v1/orders/admin` (bộ lọc `status`, tìm kiếm đa trường) và `PATCH /api/v1/orders/{id}/status` (chuyển đổi `PENDING` -> `CONFIRMED` -> `SHIPPING` -> `COMPLETED` -> `CANCELLED`, hoàn trả tồn kho tự động khi hủy đơn); trang `AdminOrdersPage.tsx` thay thế `ComingSoonPage` gồm 4 Thẻ chỉ số tổng quan, thanh lọc tab trạng thái, bảng quản lý chi tiết, modal xem hóa đơn xuất xưởng và dialog xác nhận hủy đơn; bổ sung lối tắt trên `AdminOverviewPage.tsx`.

- [x] **TASK-27: Quản trị Biên tập Cẩm nang Bệnh học (Handbook CMS), Bảng `HandbookDiseases` & Cơ chế Cảnh báo Lỗi thời (Staleness Invalidation)** (P1)
  - Trách nhiệm: **Trưởng nhóm** (giao Antigravity làm)
  - Trạng thái: `[x] DONE` (25/11/2026)
  - Nhánh Git: `feat/task-27-disease-handbook-editorial`
  - Đầu ra: Bảng mới `HandbookDiseases` (1-1 với `Diseases`, lưu `ContentMarkdown`, `FaqJson`, `AuthorName`, `Status`, `ReviewReason`); các endpoint Core API CRUD bài cẩm nang; cơ chế tự động đánh dấu `NEEDS_REVIEW` khi Admin xóa/bỏ duyệt đoạn trích tri thức nguồn trong `KnowledgeController`; trang `/admin/diseases` tích hợp Badge trạng thái & Trình soạn thảo Markdown 2 cột Live Preview song song kho đoạn trích; trang `/handbook/:classCode` ưu tiên hiển thị bài cẩm nang chuẩn biên tập, có banner cảnh báo Admin khi nguồn trích dẫn bị thay đổi và fallback an toàn sang TASK-20 khi chưa có bài. Chi tiết: `tasks/sprint-03/task-27-disease-handbook-editorial-and-staleness.md`.

- [x] **TASK-28: Phân cấp Quy tắc Liều lượng & Căn cứ Khoa học theo Cây trồng (Crop-Centric Rules & Evidence)** (P1)
  - Trách nhiệm: **Trưởng nhóm** (giao Antigravity làm)
  - Trạng thái: `[x] DONE` (24/11/2026)
  - Nhánh Git: `feat/task-28-crop-centric-rules`
  - Đầu ra: Phân cấp 2 tầng Cây trồng -> Bệnh (liều lượng mặc định theo cây trồng, kế thừa tự động cho mọi bệnh trên cây đó, chỉ nhập liều riêng khi có ngoại lệ cá biệt); tối ưu luồng gán sản phẩm ở Admin (tự động nhận diện cây đã có liều để 1-click gán ngay, rút gọn Prompt Dev AI ngắn hơn 60% chỉ cần tra cứu theo Cây + Thuốc); trang Chi tiết sản phẩm Store và Admin gom nhóm Căn cứ khoa học và Bệnh đặc trị theo Cây trồng. Chi tiết: `tasks/sprint-03/task-28-crop-centric-dosage-and-evidence.md`.

- [~] **TASK-29: Chuyển liều theo Cây / Bệnh ra bảng quan hệ `ProductUsageRules`, bỏ `disease_rules` / `plant_rules` trong JSON** (P1)
  - Trách nhiệm: **Trưởng nhóm** (Claude làm)
  - Trạng thái: `[~] Code xong + thử trên DB local; chờ đồng ý migrate Supabase và deploy`
  - Nhánh Git: `feat/task-29-usage-rules-relational`
  - Đầu ra: `ProductUsageRules` thêm `PlantId` (FK), `DosageInstruction`, 2 chỉ mục duy nhất (liều chung theo cây / ngoại lệ theo bệnh); thứ tự lấy liều tính ở backend (ngoại lệ bệnh → liều cây → phiếu bao bì); API sửa từng dòng, `GET` không ghi DB; web bỏ nút "Đồng bộ cho n bệnh" và các đoạn tự đoán liều; migration chuyển dữ liệu JSON cũ (cần đồng ý trước khi áp Supabase). Chi tiết: `tasks/sprint-03/task-29-usage-rules-relational.md`.

- [~] **TASK-30: Prompt AI theo cây, lưu liều cây khi tạo từ gợi ý, chặn lưu ngầm liều chung sản phẩm** (P1)
  - Trách nhiệm: **Trưởng nhóm** (Claude làm)
  - Trạng thái: `[~] Code xong + thử DB local; đã xóa phiếu chung #1, #6 trên Supabase (có sao lưu). Chưa commit.`
  - Nhánh Git: `feat/task-29-usage-rules-relational`
  - Đầu ra: prompt "Gắn SP" / "Tạo SP" viết liều theo cây (không nêu tên bệnh, không gộp liều nhiều cây); `POST /medicines` nhận `plant_usage` → liều chung cây khi tạo từ gợi ý; form "Thêm sản phẩm" hiện phiếu (hết lưu ngầm); sửa `kind` ở prompt trang chi tiết; ô thông số từ phiếu chung ghi rõ "Thông số chung của sản phẩm". Chi tiết: `tasks/sprint-03/task-30-ai-prompts-and-package-dosage.md`.

- [~] **TASK-31: "Tạo SP" từ vật tư gợi ý tách 2 khung (bao bì / liều cây), gộp gợi ý theo (vật tư + cây)** (P1)
  - Trách nhiệm: **Trưởng nhóm** (Claude làm)
  - Trạng thái: `[~] Code xong + thử DB local; chưa commit`
  - Nhánh Git: `feat/task-29-usage-rules-relational`
  - Đầu ra: Gắn SP / Bỏ qua / Xóa / Tạo SP chỉ tác động gợi ý cùng tên + cùng cây (Xóa không đụng LINKED/ADDED); form Tạo SP có Khung 1 (liều bao bì, Prompt 1) và Khung 2 (liều cây của bài, Prompt 2 + ô dán riêng); câu cho Lavi "Trên cây X: …" khi chưa có liều bao bì. Chi tiết: `tasks/sprint-03/task-31-suggestion-create-two-part-dosage.md`.

- [ ] **TASK-32: Lavi đọc liều theo cây** (P2) — API tìm thuốc trả liều theo cây của bệnh đang hỏi (`UsageRuleResolver`), agent dùng liều đó thay cho `dosage_instruction` chung. Chưa tạo file task.
