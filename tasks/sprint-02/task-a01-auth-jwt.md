# TASK-A01: MODULE XÁC THỰC, PHÂN QUYỀN JWT & VÁ BẢO MẬT CORE API
* **Sprint**: Sprint 2 (Song hành Tác tử Nông nghiệp & Hình thành Hệ thống Toàn diện)
* **Thứ tự thực hiện trong Sprint**: **Ưu tiên số 1 - Tuần 1 (P0 - Làm ngay từ Ngày 1 để bảo vệ định danh & cung cấp Stub cho B)**
* **Phân hệ**: `backend/core-api` (.NET 8 Web API Clean Architecture)
* **Trạng thái**: `[x] DONE`
* **Người phụ trách**: Thành viên A (System & Backend Lead)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi
* **Tài liệu tham chiếu chuẩn**:
  - Đặc tả Phân quyền: [docs/spec/roles-usecases.md](../../docs/spec/roles-usecases.md) (Mục 1 & 2: Khách, Nông dân, Admin kiêm Kỹ sư)
  - Hợp đồng API: [docs/architecture/api-contracts.md](../../docs/architecture/api-contracts.md) (Mục 3: Core Business API)
  - Kế hoạch Sprint 2: [docs/planning/sprint-02.md](../../docs/planning/sprint-02.md) (Mục 4: Nhóm việc Thành viên A)

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Vấn đề cốt tử**:
  1. Trong Sprint 1, endpoint `POST /api/v1/diagnose` nhận `userId` dạng chuỗi Guid tự do từ client form-data. Đây là lỗ hổng bảo mật nghiêm trọng (IDOR - Insecure Direct Object References), cho phép kẻ xấu giả mạo định danh để xem hoặc tạo lịch sử khám bệnh của nông dân khác.
  2. Hệ thống chưa có cơ chế đăng ký / đăng nhập người dùng; mật khẩu chưa được băm bảo mật (cần chuẩn BCrypt).
  3. Thành viên B đang bắt đầu xây dựng Agent Service và FastMCP Server (Task 05) nhưng bị chặn nếu chưa có API danh mục thuốc BVTV. Do đó, cần kích hoạt **Nguyên tắc Ngày Đầu Tiên (Day 1 Contract)**: Cung cấp ngay Stub API Thuốc `GET /api/v1/medicines/search` để B triển khai độc lập mà không mất 1 phút chờ đợi.
- **Mục tiêu cụ thể của Task**:
  1. **Thực thi Day 1 Contract**: Dựng Stub API `GET /api/v1/medicines/search` trả về danh mục thuốc đặc trị mẫu (Tomato Late Blight) kèm các thuộc tính lọc an toàn (`PhiDays`, `IsAllowed`, `RainResistant`).
  2. **Xây dựng Module Auth chuẩn Clean Architecture**:
     - Thêm bảng `Users` (hoặc mở rộng entity `User`: `Id`, `Email`, `PasswordHash`, `FullName`, `PhoneNumber`, `Role`, `CreatedAt`).
     - Tích hợp thư viện `BCrypt.Net-Next` để băm và so khớp mật khẩu an toàn.
     - Cài đặt dịch vụ phát hành JWT Token (`JwtTokenService`) kèm cấu hình bí mật trong `.env` (`JWT_SECRET_KEY`, `JWT_ISSUER`, `JWT_AUDIENCE`).
     - Xây dựng `AuthController.cs` với 2 endpoint: `POST /api/v1/auth/register` và `POST /api/v1/auth/login`.
  3. **Vá Bảo mật Định danh trên Diagnose & History**:
     - Bổ sung middleware xác thực JWT Bearer trong `Program.cs`.
     - Cập nhật `DiagnoseController.cs`: trích xuất `userId` từ token claims (`User.FindFirst(ClaimTypes.NameIdentifier)`), loại bỏ hoàn toàn `[FromForm] Guid? userId`.
     - Cập nhật `GET /api/v1/diagnose/history`: chỉ cho phép người dùng truy vấn danh sách lịch sử thuộc về chính tài khoản của họ.

---

## 2. ĐẶC TẢ KỸ THUẬT (SPECIFICATIONS)

### 2.1. Cấu trúc Token Claims (JWT Payload):
```json
{
  "sub": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "email": "farmer.nam@gmail.com",
  "role": "FARMER",
  "name": "Trần Văn Nam",
  "exp": 1730000000,
  "iss": "LavitreeCoreApi",
  "aud": "LavitreeClients"
}
```

### 2.2. Endpoints của AuthController:
1. `POST /api/v1/auth/register`:
   - Request: `{ "email": "...", "password": "...", "full_name": "...", "phone_number": "..." }`
   - Response: `201 Created` kèm thông tin tài khoản và JWT Token.
2. `POST /api/v1/auth/login`:
   - Request: `{ "email": "...", "password": "..." }`
   - Response: `200 OK` kèm `{ "token": "...", "token_type": "Bearer", "expires_in": 86400, "user": { ... } }`

### 2.3. Endpoint Stub Thuốc BVTV (Day 1 Contract):
- `GET /api/v1/medicines/search?diseaseCode=Tomato___Late_blight&requireRainResistant=false`:
  - Trả về danh sách thuốc có sẵn, hỗ trợ phân loại thuốc sinh học / hóa học, chỉ số cách ly `phi_days` và cờ lưu hành `is_allowed`.

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI 4 CHẶNG (SDLC 4 PHASES)

### Chặng 1: PLAN (Chuẩn bị Hợp đồng & Cấu hình)
- [x] Thống nhất schema DTOs cho Auth và Medicine Search trong `docs/architecture/api-contracts.md`.
- [x] Bổ sung `JWT_SECRET_KEY` (tối thiểu 64 ký tự ngẫu nhiên) vào `.env.example` và `.env`.

### Chặng 2: COOK (Viết mã nguồn)
- [x] **Pha 1 (Day 1 Stub)**: Tạo `MedicinesController.cs` với action `GET /api/v1/medicines/search` trả về mock JSON chuẩn hợp đồng cho ca bệnh `Tomato___Late_blight`.
- [x] **Pha 2 (Domain & Database)**:
  - Tái sử dụng và cấu hình bảng `Users`, quan hệ `DiagnosisRecords.UserId`.
  - Cập nhật `LavitreeDbContextSeeder.cs`:
    + Tự động Seed tài khoản Admin đầu tiên (`admin@lavitree.vn`, pass băm BCrypt, role `ADMIN`).
- [x] **Pha 3 (Services & Logic)**:
  - Cài đặt `IPasswordHasher` (BCrypt với workFactor = 11) và `IJwtTokenService`.
  - Đăng ký Dependency Injection trong `Program.cs`.
- [x] **Pha 4 (AuthController & Bảo mật)**:
  - Hoàn thiện `AuthController.cs`: `POST /api/v1/auth/register` (gán role `FARMER`, từ chối email trùng), `POST /api/v1/auth/login` (kiểm tra BCrypt, sinh JWT 7 ngày), `GET /api/v1/auth/me` (bảo vệ Bearer).
  - Cấu hình JWT Bearer Authentication và Swagger Security trong `Program.cs`.
- [x] **Pha 5 (Vá DiagnoseController)**: Trích xuất `userId` an toàn từ Claims (`sub`/`NameIdentifier`), loại bỏ hoàn toàn `[FromForm] Guid? userId` (vá IDOR). Bổ sung `GET /api/v1/diagnose/history` với `[Authorize]`.

### Chặng 3: VERIFY (Nghiệm thu Thực tế - Presence Gates)
- [x] Kiểm thử `GET /api/v1/medicines/search` trả về HTTP 200 OK với đúng schema (3 loại thuốc kèm `rain_resistant`, `phi_days`, `is_allowed`).
- [x] Kiểm thử `POST /api/v1/auth/register` tạo người dùng mới thành công, mật khẩu trong DB được băm an toàn BCrypt, nhận JWT Token 7 ngày.
- [x] Kiểm thử `POST /api/v1/auth/login` đúng mật khẩu trả về JWT Token; sai mật khẩu trả về HTTP 401 Unauthorized.
- [x] Kiểm thử tài khoản Admin được seed sẵn `admin@lavitree.vn` đăng nhập thành công với role `ADMIN`.
- [x] Kiểm thử `GET /api/v1/auth/me` chặn không token/sai token, cho phép token hợp lệ.
- [x] Kiểm thử `GET /api/v1/diagnose/history` yêu cầu token và trả về danh sách lịch sử cá nhân chuẩn định dạng.
- [x] Nghiệm thu toàn trình 11/11 tests qua `backend/core-api/test_task_a01_auth.py` đạt 100% PASS.

### Chặng 4: SHIP (Đóng gói & Chờ xác nhận Commit)
- [x] Cập nhật trạng thái `TASK-A01` trong `tasks/TODO.md` sang `[x] DONE`.
- [x] Ghi nhận kết quả vào `tasks/WORKLOG.md`.
- [x] Chạy `git diff` kiểm tra bảo mật, trình bày tóm tắt cho Developer và chờ xác nhận trước khi commit.

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)
- *04/11/2026 (commit `b3c7fd8`)*: Hoàn thành Auth JWT/BCrypt, vá IDOR trên Diagnose/History và Day 1 Stub thuốc. Bằng chứng tại thời điểm đó: 11/11 test trong `backend/core-api/test_task_a01_auth.py` (theo `tasks/WORKLOG.md`).
- *05/11/2026 (commit `3cf1e27`) — Vá bảo mật sau review*:
  - Seeder và file test không còn mật khẩu admin viết cứng; thiếu `ADMIN_INITIAL_PASSWORD` thì báo lỗi.
  - Thêm `auth_policy` (10 request/phút/IP, đổi được qua `AUTH_RATE_LIMIT_PER_MINUTE`) cho `AuthController`.
  - Từ chối khóa mẫu `YOUR_...` cho `JWT_SECRET_KEY` và `ADMIN_SECRET_KEY`.
  - Login luôn chạy BCrypt (dùng hash giả khi không có user) để giảm dò email qua thời gian phản hồi.
  - Register không còn lỗi 500 khi trùng email hoặc email đã xóa mềm.
  - Thêm `MaxLength` cho DTO đăng ký/đăng nhập: email 255, mật khẩu 72, họ tên 100, điện thoại 20.
- *05/11/2026 (commit `99ef091`) — Bổ sung phần thiếu so với `docs/planning/sprint-02.md`*:
  - `Product` thêm `PhiDays`, `IsAllowed`, `RainResistant`, `MedicineType`; thêm migration `AddMedicineFieldsToProduct` và seed 5 sản phẩm.
  - `MedicinesController` đọc từ bảng `Products`.
  - Thêm `WeatherService`, `IMemoryCache` 1 giờ và `GET /api/v1/weather`.
  - `DiagnoseController`: khách không lưu ảnh và không ghi lịch sử, theo `docs/spec/screens.md` mục W-01.
- *05/11/2026 — Kết quả review lại*: Tồn đọng 11 lỗi chặn thuộc Đợt 0 trong `tasks/sprint-02/task-a02-web-diagnose-handbook.md`.
- *07/11/2026 — Khắc phục triệt để 11 lỗi chặn Đợt 0 & Nghiệm thu Thực nghiệm 100%*:
  - Cấu hình biến môi trường PATH trên macOS arm64, kích hoạt .NET 8 SDK (`8.0.427`) và `dotnet-ef` toàn cục.
  - **BUG-01**: Thay mật khẩu Admin mới `Adm!n@Lavitree_2026#Secure`, cập nhật cả hai file `.env`, sửa seeder tự động cập nhật hash vào Supabase DB. Nghiệm thu: mật khẩu cũ bị từ chối HTTP 401 Unauthorized, mật khẩu mới trả HTTP 200 OK.
  - **BUG-02**: Thêm bộ lọc `dp.Product.IsAllowed && !dp.Product.IsDeleted` trong `DiagnoseController.cs`, xóa bỏ liên kết Paraquat trong seed và xóa sạch liên kết cũ trong CSDL.
  - **BUG-03**: Khắc phục seeder không ghi đè giá, tồn kho, PHI, IsAllowed của sản phẩm đã có.
  - **BUG-04 - BUG-07**: Chuẩn hóa biến `OPENWEATHER_API_KEY` / `OPENWEATHERMAP_API_KEY`, gọi trực tiếp OpenWeather API trả về dữ liệu thật (`is_simulated: false`), thuật toán băm an toàn chống tràn số âm xác suất mưa.
  - **BUG-08**: Thêm lệnh `Database.MigrateAsync()` tự động trước khi seeder chạy; đã áp dụng thành công migration `20261105233000_AddMedicineFieldsToProduct` lên CSDL Supabase.
  - **BUG-09, BUG-10**: Bỏ nuốt lỗi CSDL trong `MedicinesController.cs` (trả 503 khi DB lỗi ở Prod); bổ sung nguồn kiểm chứng `provenance_source` chuẩn Thông tư 03/2017/TT-BNNPTNT.
  - **BUG-11**: Nâng cấp và chạy test suite tự động `test_task_a01_auth.py` trên Core API: **ĐẠT 14/14 BÀI TEST CHUẨN 100%**. Đủ điều kiện kỹ thuật chuyển tiếp sang A02.
