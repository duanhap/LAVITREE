# TASK-A01: MODULE XÁC THỰC, PHÂN QUYỀN JWT & VÁ BẢO MẬT CORE API
* **Sprint**: Sprint 2 (Song hành Tác tử Nông nghiệp & Hình thành Hệ thống Toàn diện)
* **Thứ tự thực hiện trong Sprint**: **Ưu tiên số 1 - Tuần 1 (P0 - Làm ngay từ Ngày 1 để bảo vệ định danh & cung cấp Stub cho B)**
* **Phân hệ**: `backend/core-api` (.NET 8 Web API Clean Architecture)
* **Trạng thái**: `[ ] PENDING`
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
- [ ] Thống nhất schema DTOs cho Auth và Medicine Search trong `docs/architecture/api-contracts.md`.
- [ ] Bổ sung `JWT_SECRET_KEY` (tối thiểu 64 ký tự ngẫu nhiên) vào `.env.example` và `.env`.

### Chặng 2: COOK (Viết mã nguồn)
- [ ] **Pha 1 (Day 1 Stub)**: Tạo `MedicinesController.cs` với action `GET /api/v1/medicines/search` trả về mock JSON chuẩn hợp đồng cho ca bệnh `Tomato___Late_blight`.
- [ ] **Pha 2 (Domain & Database)**: Tạo entity `User`, cấu hình quan hệ với `DiagnosisRecords`, thêm migration EF Core và áp dụng vào CSDL.
- [ ] **Pha 3 (Services & Logic)**: Cài đặt `IPasswordHasher` (BCrypt), `IJwtTokenGenerator`, và đăng ký Dependency Injection.
- [ ] **Pha 4 (AuthController & Bảo mật)**: Hoàn thiện `AuthController.cs`, cấu hình JWT Authentication trong `Program.cs`.
- [ ] **Pha 5 (Vá DiagnoseController)**: Trích xuất `userId` từ `ClaimsPrincipal`, bỏ tham số form-data.

### Chặng 3: VERIFY (Nghiệm thu Thực tế - Presence Gates)
- [ ] Kiểm thử `GET /api/v1/medicines/search` trả về HTTP 200 OK với đúng schema.
- [ ] Kiểm thử `POST /api/v1/auth/register` tạo người dùng mới thành công, mật khẩu trong DB được băm an toàn (chuỗi bắt đầu bằng `$2a$` hoặc `$2b$`).
- [ ] Kiểm thử `POST /api/v1/auth/login` đúng mật khẩu trả về JWT Token; sai mật khẩu trả về HTTP 401 Unauthorized.
- [ ] Kiểm thử `POST /api/v1/diagnose` có Bearer Token thì lưu đúng `userId` của token; không có token vẫn cho phép khám dạng Khách vãng lai (`userId = null`).

### Chặng 4: SHIP (Đóng gói & Chờ xác nhận Commit)
- [ ] Cập nhật trạng thái `TASK-A01` trong `tasks/TODO.md` sang `[x] DONE`.
- [ ] Ghi nhận kết quả vào `tasks/WORKLOG.md`.
- [ ] Chạy `git diff` kiểm tra bảo mật, trình bày tóm tắt cho Developer và chờ xác nhận trước khi commit.
