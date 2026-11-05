vMình đã review xong: **A00 gần đạt nhưng cần sửa vài lỗi trước khi làm A02; A01 chưa nên tính là DONE.** Lỗi gấp nhất là mật khẩu admin đang lộ công khai trên GitHub.

Backend chỉ được đánh giá qua đọc code, vì máy này không có `dotnet` và Docker nên mình chưa chạy được 11 test của A01. Phần frontend thì mình đã build lại thành công, chạy `npm audit` và test thực tế `api-client`. Mình không sửa source code, chỉ tạo lại thư mục `dist` (đã nằm trong gitignore).

## Việc cần xử lý ngay
1. **Mật khẩu admin bị lộ:** [LavitreeDbContextSeeder.cs:60](LAVITREE/backend/core-api/src/Lavitree.Infrastructure/Persistence/LavitreeDbContextSeeder.cs#L60) và [test_task_a01_auth.py:125](LAVITREE/backend/core-api/test_task_a01_auth.py#L125) hardcode mật khẩu làm giá trị mặc định.
   - **Mức độ lộ:** repo đang public, code đã vào `main`, và cả hai file `.env` đều dùng đúng mật khẩu này. Mình không thử đăng nhập vào DB thật nên chưa xác nhận tài khoản còn dùng nó không.
   - **Tác động:** hiện chưa endpoint nào kiểm tra role, nhưng từ A03 kẻ tấn công sẽ có quyền admin.
   - **Cách sửa:** đổi mật khẩu trực tiếp trong DB, vì seeder bỏ qua nếu admin đã tồn tại. Sau đó bỏ giá trị mặc định và báo lỗi khi thiếu biến môi trường.
2. **Không giới hạn tần suất login/register:** chỉ có diagnose được rate limit ([Program.cs:111](LAVITREE/backend/core-api/src/Lavitree.Api/Program.cs#L111)), Nginx cũng không chặn `/api/`. Kẻ tấn công có thể dò mật khẩu (tối thiểu chỉ 6 ký tự) hoặc spam để BCrypt ngốn CPU. Sprint plan có yêu cầu mục này.
3. **Khóa JWT mẫu vẫn qua được kiểm tra:** giá trị trong `.env.example` dài 37 ký tự, trong khi [Program.cs:67](LAVITREE/backend/core-api/src/Lavitree.Api/Program.cs#L67) chỉ cần 32. Ai copy nguyên file mẫu sẽ dùng khóa công khai, và token ADMIN có thể bị giả mạo. `.env` hiện tại của bạn vẫn ổn (64 ký tự). Nên chặn tiền tố `YOUR_` và yêu cầu ≥ 64 ký tự như task đã ghi; `ADMIN_SECRET_KEY` cũng cần kiểm tra tương tự.

## TASK-A01: còn thiếu và còn lỗi
**Thiếu so với [sprint-02.md](LAVITREE/docs/planning/sprint-02.md#L134), dù TODO ghi "Hoàn thành 100%":**
- Chưa gộp `X-Admin-Key` vào JWT role `ADMIN` (chưa có `Authorize(Roles)` nào).
- `Product` chưa có `PhiDays`, `IsAllowed`, `RainResistant`, `MedicineType`, cũng chưa có migration và seed thuốc thật.
- Chưa có `WeatherService`.

Vì vậy, thời gian cách ly thuốc mà Guardrail của B sẽ dùng vẫn là số viết cứng trong [MedicinesController.cs:42](LAVITREE/backend/core-api/src/Lavitree.Api/Controllers/MedicinesController.cs#L42). Stub thì được phép ở Ngày 1, nhưng bạn nên làm nốt hoặc tách task và sửa lại trạng thái.

**Lỗi bảo mật và độ thực tế:**
- **Khách có thể làm đầy ổ lưu trữ:** không cần đăng nhập vẫn lưu được ảnh, heatmap và bản ghi ([DiagnoseController.cs:157](LAVITREE/backend/core-api/src/Lavitree.Api/Controllers/DiagnoseController.cs#L157)). Một IP có thể đẩy tối đa khoảng 36 GB/giờ theo lý thuyết (60 lượt/phút × 10 MB), và `notes` không giới hạn độ dài.
- **Lộ vị trí vườn:** ảnh gốc giữ nguyên EXIF, kể cả GPS nếu có, rồi nằm trong bucket ai có link cũng đọc được.
- **Không giới hạn độ dài đầu vào:** [AuthDtos.cs](LAVITREE/backend/core-api/src/Lavitree.Application/DTOs/AuthDtos.cs) không có `MaxLength`, cột DB là `text`. `full_name` rất dài sẽ vào DB và làm JWT phình to. BCrypt cũng chỉ dùng 72 byte đầu của mật khẩu.
- **Không thu hồi được token:** token sống 7 ngày, tài khoản đã xóa mềm vẫn dùng được, role cũ vẫn còn hiệu lực. Nên kiểm tra user trong `OnTokenValidated`.
- **Register trả 500:** xảy ra khi hai request trùng email cùng lúc, hoặc đăng ký lại email đã xóa mềm ([AuthController.cs:55](LAVITREE/backend/core-api/src/Lavitree.Api/Controllers/AuthController.cs#L55)), vì unique index vẫn tính các dòng đó.
- **Dò được email qua thời gian phản hồi:** email không tồn tại thì không chạy BCrypt nên trả lời nhanh hơn hẳn ([AuthController.cs:120](LAVITREE/backend/core-api/src/Lavitree.Api/Controllers/AuthController.cs#L120)). Nên verify với một hash giả.
- **Chưa có HTTPS:** Nginx chỉ nghe cổng 80, và cũng chưa có CSP dù token nằm trong `localStorage`.
- **Stack Docker khó chạy được với `.env` hiện tại (suy ra từ đọc code):**
  - `.env` thiếu `INTERNAL_API_SECRET` và `AGENT_DB_URL`, nên compose sẽ dừng ngay.
  - `AI_SERVICE_URL` và `MINIO_ENDPOINT` trỏ `localhost` lại được ưu tiên hơn cấu hình trong compose.
  - Không có lệnh `Migrate`, và image không chứa thư mục `seed` nên admin không được tạo.

**Test chưa chứng minh đủ những gì task khẳng định:**
- Test "chữ ký giả mạo" chỉ gửi chuỗi sai định dạng, chưa thử token ký sai khóa, `alg=none` hay token hết hạn.
- Chưa có test hai user để chứng minh IDOR đã được vá.
- Checklist ghi mật khẩu được băm trong DB, nhưng test không kiểm tra.
- Test tạo tài khoản thật mà không dọn; nếu chạy trên Supabase thì DB sẽ đầy dần tài khoản rác.

## TASK-A00: cần sửa trước A02
- **Role sai chuẩn:** frontend dùng `Admin`/`Expert`/`Farmer`, backend trả `ADMIN`/`FARMER` ([RequireRole.tsx:4](LAVITREE/frontend/web/src/app/RequireRole.tsx#L4)). Admin sẽ không thấy menu quản trị và sẽ bị 403 khi bật guard. `Expert` cũng là vai trò đã gộp vào `ADMIN`.
- **`/admin/*` chưa có guard:** [router.tsx:117](LAVITREE/frontend/web/src/app/router.tsx#L117) import `RequireRole` nhưng không dùng. API vẫn được backend bảo vệ, nên đây là lộ giao diện chứ chưa lộ dữ liệu.
- **Upload ảnh sẽ hỏng:** header JSON mặc định ở [api-client.ts:14](LAVITREE/frontend/web/src/lib/api-client.ts#L14) khiến axios biến `FormData` thành `{"image":{},"notes":"x"}`. Mình đã chạy thử và thấy đúng như vậy; cần bỏ header mặc định này.
- **Token hết hạn vẫn tính là đã đăng nhập:** không kiểm tra `exp` và không xử lý 401 toàn cục.
- **Thông báo lỗi sai ngữ cảnh:** sai mật khẩu hiện "Phiên đăng nhập đã hết hạn", còn email sai định dạng hiện lỗi về ảnh 10MB ([api-client.ts:49](LAVITREE/frontend/web/src/lib/api-client.ts#L49)).
- **Trang thu thập tri thức không ghi được:** `src` không gửi `X-Admin-Key` ở đâu cả nên thêm, xóa và export đều sẽ bị 401. Mục nghiệm thu "vẫn chạy như trước" vì vậy chưa đúng. Class `.card` cũng đã mất CSS.
- **Dependency có lỗ hổng:** `npm audit` báo 5 lỗ hổng, 2 mức high (`vite`, `follow-redirects`). React Router có lỗi open redirect, nên A02 phải kiểm tra tham số `?next=`.
- **Bundle lớn:** JS 546 KB (gzip 170 KB) trong một file, nên tách lazy cho các trang admin vì người dùng hay ở vùng mạng yếu.

## Những phần đã làm tốt
- **IDOR:** đã bỏ `userId` từ form, lịch sử lọc theo user trong token.
- **Xác thực:** register luôn gán `FARMER`, dùng BCrypt, và JWT kiểm tra đủ issuer, audience, lifetime.
- **Khóa admin:** so sánh constant-time và từ chối khi chưa cấu hình.
- **Hạ tầng:** Nginx ghi đè `X-Forwarded-For`, các dịch vụ nội bộ chỉ bind localhost, và `.env` chưa từng bị commit.
- **Frontend:** `/dev/styleguide` không có trong bản build production.

---

## Kế hoạch Khắc phục & Theo dõi Tiến độ (Action Plan & Checklists)

### 🚀 BƯỚC 1: Xử lý nóng Lỗ hổng Bảo mật & Lỗi Giao diện Chặn A02 (ĐÃ HOÀN THÀNH 100%)
#### A. Backend (Bảo mật Core API & Auth)
- [x] **1.1. Bỏ mật khẩu Admin hardcode**: Đã sửa `LavitreeDbContextSeeder.cs:60`, ném ngoại lệ nếu thiếu biến `ADMIN_INITIAL_PASSWORD`; sửa `test_task_a01_auth.py:125` bắt buộc đọc từ env.
- [x] **1.2. Thêm Rate Limiter cho Auth**: Đã cấu hình `auth_policy` trong `Program.cs` (10 requests/phút per IP); gắn `[EnableRateLimiting("auth_policy")]` lên `AuthController.cs`.
- [x] **1.3. Chặn khóa bí mật mẫu**: Kiểm tra `JWT_SECRET_KEY` và `ADMIN_SECRET_KEY` trong `Program.cs` & `AdminApiKeyAuthAttribute.cs`, chặn các chuỗi chứa/bắt đầu bằng `YOUR_`, siết độ dài $\ge 32$ ký tự an toàn.
- [x] **1.4. Chống Timing Attack dò Email**: Chạy `_passwordHasher.VerifyPassword` với `DummyHash` cố định trong `AuthController.cs` khi user không tồn tại để đồng nhất thời gian phản hồi.
- [x] **1.5. Xử lý lỗi 500 khi trùng Email / Race Condition**: Bắt `DbUpdateException` trong `Register` trả về HTTP 400 thay vì HTTP 500; kiểm tra trùng email không bỏ qua bản ghi xóa mềm.
- [x] **1.6. Giới hạn độ dài đầu vào DTO**: Đã thêm `[MaxLength]` vào `RegisterRequestDto` & `LoginRequestDto` trong `AuthDtos.cs` (Email 255, Password 72, FullName 100, Phone 20).

#### B. Frontend (Sửa lỗi nền tảng TASK-A00 để thông luồng A02)
- [x] **1.7. Chuẩn hóa Role Web & API**: Đã cập nhật `RequireRole.tsx` và `AppShell.tsx` đồng bộ role `ADMIN` và `FARMER` (chuẩn hóa hoa/thường, so khớp case-insensitive).
- [x] **1.8. Bọc Guard bảo vệ `/admin/*`**: Đã bọc route `<AdminShell />` trong `router.tsx` bằng `<RequireRole allowedRoles={['ADMIN']}>`.
- [x] **1.9. Sửa lỗi hỏng FormData Upload ảnh**: Đã bỏ header `'Content-Type': 'application/json'` mặc định trong `api-client.ts`, tự động xóa `Content-Type` khi payload là `FormData` để Axios/trình duyệt tự gắn boundary `multipart/form-data`.
- [x] **1.10. Kiểm tra Token hết hạn & xử lý 401**: Đã thêm kiểm tra thời hạn `exp` của JWT trong `useCurrentUser()`, tự động dọn storage khi hết hạn; xử lý 401 toàn cục trong `api-client.ts`.
- [x] **1.11. Sửa ánh xạ lỗi HTTP chuẩn ngữ cảnh**: Ưu tiên hiển thị message từ server, sửa câu 401 khi login sai pass và câu 400 khi lỗi validation.
- [x] **1.12. Bổ sung style thẻ `.card`**: Đã thêm lại lớp `.card` vào `globals.css` (dùng biến CSS `--card`, `--border`, `--radius`) để bảo đảm các trang cũ (`KnowledgeCollectorPage`) không vỡ khung viền.

---

### 📦 BƯỚC 2: Hoàn thiện Dữ liệu Thuốc DB & WeatherService (Đưa A01 đạt chuẩn SSOT)
- [ ] **2.1. Cập nhật Entity `Product.cs`**: Thêm `PhiDays (int)`, `IsAllowed (bool)`, `RainResistant (bool)`, `MedicineType (string)`.
- [ ] **2.2. Migration EF Core & Seed thuốc thật**: Thay thế dữ liệu mock trong `MedicinesController.cs` bằng dữ liệu query từ CSDL PostgreSQL.
- [ ] **2.3. Xây dựng `WeatherService`**: Tích hợp OpenWeatherMap API + `IMemoryCache` 1h trong Core API phục vụ tool `check_weather_risk`.
- [ ] **2.4. Chính sách lưu trữ ảnh khách**: Không lưu ảnh và lịch sử nếu là Guest theo `screens.md:98`.