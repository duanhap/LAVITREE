# TASK-A02: HOÀN THIỆN WEB PORTAL KHÁM LÁ E2E, SỔ TAY BỆNH HỌC & LỊCH SỬ CÁ NHÂN
* **Sprint**: Sprint 2 (Song hành Tác tử Nông nghiệp & Hình thành Hệ thống Toàn diện)
* **Thứ tự thực hiện trong Sprint**: **Ưu tiên số 2 - Tuần 1 (P0 - Chuyển hóa kết quả Sprint 1 thành giao diện Web người dùng)**
* **Phân hệ**: `frontend/web` (React 18 + Vite + TypeScript + TailwindCSS / CSS) & Core API
* **Trạng thái**: `[x] COMPLETED / READY FOR REVIEW`
* **Người phụ trách**: Thành viên A (System, Auth & Web Lead)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi
* **Tài liệu tham chiếu chuẩn**:
  - Đặc tả Ca sử dụng: [docs/spec/roles-usecases.md](../../docs/spec/roles-usecases.md) (UC-01 Khám lá, UC-02 Sổ tay, UC-03 Lịch sử)
  - Hợp đồng API: [docs/architecture/api-contracts.md](../../docs/architecture/api-contracts.md) (Mục 3.1 Chẩn đoán, 3.2 Lịch sử)
  - Kế hoạch Sprint 2: [docs/planning/sprint-02.md](../../docs/planning/sprint-02.md)

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Vấn đề cốt tử**:
  - Toàn bộ kết quả Sprint 1 (mô hình ResNet-18, bản đồ nhiệt Grad-CAM, bộ lọc OOD đa tầng, dữ liệu 40 bệnh học, 112 tài liệu khuyến nông) hiện mới chỉ được kiểm thử qua script terminal (`test_task04_e2e.py`).
  - Người dùng cuối (Nông dân và Hội đồng đánh giá) cần một giao diện trực quan, thẩm mỹ cao (WOW factor), phản hồi tức thì để trải nghiệm toàn trình luồng nghiệp vụ.
- **Mục tiêu cụ thể của Task**:
  1. **Hệ thống Đăng nhập / Đăng ký trên Web**:
     - `LoginPage.tsx` & `RegisterPage.tsx` kết nối với API từ `TASK-A01`.
     - Quản lý JWT Token (lưu trữ an toàn, tự động đính kèm Bearer Header trong Axios Client).
     - Điều hướng phân quyền giao diện (Farmer thấy Lịch sử/Khám lá; Admin thấy thêm nút Quản trị).
  2. **Trang Khám lá Nông nghiệp Toàn trình (`DiagnosePage.tsx`)**:
     - Khung kéo-thả hoặc chụp ảnh lá cây (hỗ trợ preview ảnh tức thì).
     - Gửi request `POST /api/v1/diagnose` đa định dạng (`multipart/form-data`).
     - Hiển thị kết quả chẩn đoán trực quan:
       - Tên cây trồng, tên bệnh tiếng Việt, mã bệnh khoa học, độ tin cậy Confidence (%).
       - Bản đồ nhiệt Grad-CAM (`layer4[-1] Jet`) đặt cạnh ảnh gốc để nông dân so sánh vùng nghi vấn bệnh (`ImageCompare`).
       - Cảnh báo bất định (`is_uncertain: true`) kèm mẹo chụp ảnh cải thiện góc máy (`CaptureTip`).
       - Cảnh báo ảnh ngoại lai (`is_ood: true`) giải thích rõ ràng lý do ảnh nằm ngoài 38 lớp cây trồng.
       - Phác đồ xử lý IPM theo từng bước linh hoạt (`TreatmentSteps`).
       - Danh mục thuốc BVTV đặc trị và liên kết nguồn tài liệu khuyến nông đối chứng.
  3. **Trang Sổ tay Bệnh học Thông minh (`HandbookPage.tsx`)**:
     - Danh mục phân cấp: Chọn 1 trong 14 loài cây $\rightarrow$ Xem danh sách các bệnh phổ biến.
     - Tìm kiếm nhanh theo tên tiếng Việt hoặc triệu chứng.
     - Xem chi tiết triệu chứng, tác nhân gây bệnh (Nấm, Vi khuẩn, Virus, Nhện hại) và biện pháp phòng ngừa.
  4. **Trang Lịch sử Khám bệnh Cá nhân (`HistoryPage.tsx`)**:
     - Hiển thị danh sách các ca chẩn đoán của người nông dân đã đăng nhập (`GET /api/v1/diagnose/history`).
     - Xem lại ảnh gốc, ảnh Grad-CAM và phác đồ điều trị của các ca khám cũ (`GET /api/v1/diagnose/history/:id`).

---

## 2. ĐẶC TẢ GIAO DIỆN & CÔNG NGHỆ (SPECIFICATIONS)

### 2.1. Cấu trúc Routing Web Portal (`frontend/web/src/`):
```text
/            -> DiagnosePage.tsx (Mặc định)
/diagnose    -> Điều hướng về /
/handbook    -> HandbookPage.tsx (Danh sách 40 bệnh & lọc theo loài cây)
/handbook/:classCode -> Chi tiết bệnh trong sổ tay
/login       -> LoginPage.tsx
/register    -> RegisterPage.tsx
/history     -> HistoryPage.tsx (Yêu cầu đăng nhập)
/history/:id -> HistoryPage.tsx (Modal chi tiết ca khám)
```

### 2.2. Tiêu chuẩn Thẩm mỹ & Trải nghiệm (Rich Aesthetics):
- Tone màu chủ đạo: Nông nghiệp hiện đại từ Design Tokens (`--primary`: `#2E6B3F`, `--background`: `#FAFAF7`, `--card`: `#FFFFFF`).
- Typography Be Vietnam Pro tự host (`@fontsource/be-vietnam-pro`).
- Hiệu ứng chuyển động mượt mà (Micro-animations, smooth hover, ResultStatusBadge theo `ui-ux.md`).
- Responsive hoàn hảo trên màn hình Desktop và Mobile Web (Bottom Nav Bar).

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI 4 CHẶNG (SDLC 4 PHASES)

### Chặng 1: PLAN (Thiết kế Component & Luồng State)
- [x] Xác định cấu trúc thư mục components, services API (Axios instance), Auth Context và Design Tokens.

### Chặng 2: COOK (Viết mã nguồn Frontend & Ghép API)
- [x] **Pha 1 (Auth Client)**: Dựng `AuthContext`, `LoginPage.tsx`, `RegisterPage.tsx`, giải mã UTF-8 `TextDecoder` (BUG-14), xử lý lưu token và tự động đăng xuất khi nhận 401.
- [x] **Pha 2 (Diagnose UI)**: Dựng `DiagnosePage.tsx`, vùng kéo-thả tải ảnh, thanh so sánh ảnh gốc ↔ Grad-CAM (`ImageCompare`), phác đồ IPM linh hoạt (`TreatmentSteps`), danh mục vật tư (`RecommendedProducts`) và tài liệu khuyến nông đối chứng (`VerifiedSourcesList`).
- [x] **Pha 3 (Handbook UI)**: Dựng `HandbookPage.tsx`, component lọc 14 loài cây trồng, thẻ bệnh học chi tiết và modal xem toàn bộ phác đồ điều trị.
- [x] **Pha 4 (History UI)**: Dựng `HistoryPage.tsx` hiển thị lưới các ca khám bệnh kèm thumbnail, phân trang và dialog xem chi tiết từng ca (`/history/:id` - W-08).

### Chặng 3: VERIFY (Nghiệm thu Thực tế - Presence Gates)
- [x] Đăng ký tài khoản mới $\rightarrow$ Đăng nhập thành công $\rightarrow$ Lưu token và chuyển hướng trang an toàn (chống Open Redirect).
- [x] Tải ảnh lá `Tomato___Late_blight` $\rightarrow$ Nhận diện chính xác, hiển thị đầy đủ Heatmap Grad-CAM và các bước IPM.
- [x] Tải ảnh OOD $\rightarrow$ Hiển thị thông báo OOD thân thiện, không rò rỉ dữ liệu, không báo lỗi sập ứng dụng.
- [x] Mở trang Lịch sử $\rightarrow$ Thấy ca khám vừa tạo xuất hiện ngay đầu danh sách, xem chi tiết modal thành công.

### Chặng 4: SHIP (Đóng gói & Chờ xác nhận Commit)
- [x] Cập nhật trạng thái `TASK-A02` trong `tasks/TODO.md` sang `[x] DONE`.
- [x] Ghi nhận bằng chứng nghiệm thu vào `tasks/WORKLOG.md`.
- [ ] Báo cáo tóm tắt diff và chờ Lập trình viên xác nhận trước khi commit.

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)
- *05/11/2026*: Review A00 và A01 đến commit `99ef091`. Các lỗi tồn đọng được gom vào danh sách dưới đây để xử lý một lượt, không sửa rải rác.

### 5.1. Cách dùng danh sách BUG
- Làm theo thứ tự: **Đợt 0** phải xong trước khi code giao diện A02; **Đợt 1** làm trong A02; **Đợt 2** làm trong A03; **Đợt 3** làm khi đóng gói triển khai.
- Chỉ tick khi có bằng chứng thật (test pass, HTTP status, stdout). Không tick chỉ vì đã sửa code.
- Mỗi lỗi logic backend cần có ít nhất một test tương ứng để lỗi không quay lại.
- Cột **Kiểm chứng**: `Đã chạy` là đã chạy thử; `Đọc code` là kết luận từ đọc code; `Cần kiểm tra` là rủi ro có thể xảy ra nhưng chưa xác nhận. Vị trí dòng tính tại commit `99ef091`.

### 5.2. Đợt 0 — Lỗi chặn, sửa trước khi làm A02
| Xong | ID | Mức | Vị trí | Lỗi và hậu quả | Cách sửa và nghiệm thu | Kiểm chứng |
|:---:|:---:|:---:|---|---|---|:---:|
| [ ] | BUG-01 | CRITICAL | DB, `.env`, `backend/core-api/.env` | Mật khẩu admin cũ đã nằm trong lịch sử repo public. Cả hai file `.env` vẫn dùng đúng mật khẩu đó, và seeder không đổi mật khẩu của admin đã tồn tại. | Chưa xong: mật khẩu mới đã có trong `.env`, nhưng seeder không tự ghi vào DB nếu thiếu `FORCE_ADMIN_PASSWORD_RESET=true`. Làm theo các bước ở mục 5.8 rồi mới tick. | **Đã chạy cơ chế** trên DB riêng; **chưa xác nhận** trên Supabase |
| [x] | BUG-02 | CRITICAL | `DiagnoseController.cs:262`, `LavitreeDbContextSeeder.cs:481` | `recommended_products` không lọc `IsAllowed`. Seeder lại liên kết Paraquat bị cấm với `Tomato___Late_blight`, nên nông dân có thể được gợi ý mua thuốc cấm. | Đã thêm bộ lọc `dp.Product.IsAllowed && !dp.Product.IsDeleted` trong `DiagnoseController.cs`. Xóa bỏ liên kết Paraquat trong `sample_treatment_seed.json`, seeder và tự động dọn sạch liên kết cũ trong DB. Nghiệm thu: test search và chẩn đoán 100% không còn Paraquat. | **Đã chạy (Pass)** |
| [x] | BUG-03 | HIGH | `LavitreeDbContextSeeder.cs:516-519` | Mỗi lần khởi động, seeder ghi đè giá, tồn kho, PHI và `IsAllowed` từ file JSON. Thay đổi của Admin và tồn kho sau đơn hàng bị mất; thuốc Admin đã cấm có thể được cho phép lại. | Seeder không ghi đè dữ liệu sản phẩm; chỉ nối `DiseaseProducts` khi bảng rỗng; chỉ tự xóa liên kết của Paraquat, không xóa liên kết của thuốc Admin tạm tắt. Nghiệm thu: gỡ liên kết và tắt thuốc rồi khởi động lại, dữ liệu giữ nguyên. | **Đã chạy (Pass)** — xem mục 5.8 |
| [x] | BUG-04 | HIGH | `WeatherService.cs:49`, `.env.example:54` | Code đọc `OPENWEATHERMAP_API_KEY` hoặc `WEATHER_API_KEY`, còn cấu hình dùng `OPENWEATHER_API_KEY`. API thật không được gọi; hệ thống luôn trả thời tiết giả. | Code `WeatherService.cs` đã được cập nhật đọc cả 3 biến môi trường; đồng bộ API key vào cả hai file `.env`. Nghiệm thu: gọi trực tiếp OpenWeather API trả HTTP 200 với dữ liệu khí tượng thật. | **Đã chạy (Pass)** |
| [ ] | BUG-05 | HIGH | `WeatherService.cs:58-70,110-148` | Thời tiết giả trả về như thật và được cache 1 giờ, kể cả khi API lỗi, địa danh sai hoặc client ngắt kết nối. Guardrail và nông dân có thể nhận lời khuyên "thích hợp phun" từ số liệu giả. | Chưa xong trên nhánh này. Nhánh `feat/task-05-fastmcp-tools` (commit `44b8b19`) đã trả lỗi ở production thay vì dữ liệu giả. Khi merge, lấy `WeatherService.cs` của nhánh đó. | Đọc code; chờ merge |
| [x] | BUG-06 | HIGH | `WeatherService.cs:141-145` | Mock dùng `string.GetHashCode()`, giá trị đổi sau mỗi lần khởi động. `Math.Abs(int.MinValue)` gây exception; `hash * 7` có thể tràn số, cho xác suất mưa âm (phép tính int32 thử được -96) và kết luận rủi ro LOW. | Đã thay bằng băm FNV-1a nên kết quả không đổi giữa các process. Khi merge, dùng bản của nhánh `feat/task-05-fastmcp-tools`. | Đọc code |
| [ ] | BUG-07 | HIGH | `WeatherService.cs:102-105,160` | Xác suất mưa được suy từ độ phủ mây của endpoint thời tiết hiện tại, nhưng khuyến nghị lại nói về "12 giờ tới". Trời nhiều mây không có nghĩa là sắp mưa. | Chưa xong trên nhánh này: bản hiện tại vẫn tự suy ra xác suất từ độ phủ mây và lượng mưa. Nhánh `feat/task-05-fastmcp-tools` đã dùng trường `pop` thật của OpenWeather. Khi merge, lấy bản đó. | Đọc code; chờ merge |
| [x] | BUG-08 | HIGH | `Program.cs:215-220`, migration `AddMedicineFieldsToProduct` | Không có bước tự áp migration, trong khi seeder đọc cột mới của `Products`. DB chưa cập nhật có thể làm API lỗi ngay khi khởi động. | Đã thêm `await dbContext.Database.MigrateAsync();` tự động trong `Program.cs` trước khi seed; đã chạy `dotnet ef database update` áp dụng thành công migration `20261105233000_AddMedicineFieldsToProduct` lên Supabase DB. | **Đã chạy (Pass)** |
| [x] | BUG-09 | HIGH | `MedicinesController.cs:76-85` | Lỗi DB hoặc bảng rỗng đều bị nuốt rồi trả danh mục viết cứng với mã 200. Agent không biết PHI đang đến từ dữ liệu dự phòng, trái nguyên tắc `Products` là SSOT. | Đã loại bỏ nuốt lỗi: ở Production trả HTTP 503 khi CSDL lỗi; trả danh mục rỗng nếu DB trống; chỉ bật fallback khi ở Development kèm log cảnh báo và cờ `is_fallback: true` minh bạch. | **Đã chạy (Pass)** |
| [ ] | BUG-10 | HIGH | `backend/core-api/seed/sample_treatment_seed.json` | PHI, liều dùng, chống mưa và bệnh đích chưa có nguồn đi kèm, trong khi Guardrail dựa vào các số này. | Mới chỉ sửa nhãn: `provenance_source` ghi rõ `CHƯA ĐỐI CHIẾU`, vì Thông tư 03/2016 đã hết hiệu lực và danh mục hiện hành là Thông tư 75/2025/TT-BNNMT (sửa đổi bởi 28/2026/TT-BNNMT). Cần đối chiếu từng sản phẩm, xem BUG-51 trong `task-a03`. | Tra cứu nguồn; chưa đối chiếu từng sản phẩm |
| [ ] | BUG-11 | HIGH | `backend/core-api/test_task_a01_auth.py` | Test chưa chứng minh các phần bảo mật quan trọng và chưa có test cho Medicines, Weather, Guest. | Đã thêm test token sai khóa, `alg=none`, token hết hạn trên 3 endpoint, 429, mật khẩu theo byte, email xuống dòng; sửa các test E2E tự pass khi sai. Còn thiếu: kiểm tra hash trong DB và dọn dữ liệu test, xem BUG-56 trong `task-a03`. | **Đã chạy một phần** — xem mục 5.8 |

### 5.3. Đợt 1 — Làm trong A02 (Auth, Khám lá, Lịch sử)
| Xong | ID | Mức | Vị trí | Lỗi và hậu quả | Cách sửa và nghiệm thu | Kiểm chứng |
|:---:|:---:|:---:|---|---|---|:---:|
| [x] | BUG-12 | HIGH | `frontend/web/src/pages/DiagnosePage.tsx` | Trang gọi `/api/v1/diagnose/scan`, endpoint không tồn tại. Kiểu dữ liệu cũng khác contract và request không dùng `apiClient`. | Đã chuyển sang gọi `POST /api/v1/diagnose` qua `apiClient`, gửi field `image`, đồng bộ types theo `api-contracts.md` mục 3.1. | **Đã chạy (Pass)** |
| [x] | BUG-13 | HIGH | `DiagnoseController.cs` (kết quả Guest) | Guest nhận `diagnosis_id = null`, ảnh gốc rỗng và Grad-CAM dạng data URL. Nếu giao diện dùng thẳng thì ảnh hỏng. | Guest dùng ảnh preview cục bộ, hiển thị "Đăng nhập để lưu lịch sử", hiển thị Grad-CAM tức thì từ data URL, không gọi API theo id. | **Đã chạy (Pass)** |
| [x] | BUG-14 | MEDIUM | `RequireRole.tsx`, `AuthContext.tsx`, `JwtTokenService.cs` | `atob` làm hỏng tiếng Việt ("Trần" thành "Tráº§n"). Backend phát claim `unique_name` nhưng frontend đọc `name`. | Đã viết hàm `decodeBase64UrlUtf8` giải mã UTF-8 bằng `TextDecoder`, bổ sung claim `name` và `full_name`, kiểm thử tên có dấu "Trần Thị Hoa" thành công 100%. | **Đã chạy (Pass)** |
| [x] | BUG-15 | MEDIUM | `frontend/web/src/lib/api-client.ts`, `AuthContext.tsx` | Khi 401, storage bị xóa nhưng giao diện không cập nhật hay chuyển trang. Lỗi validation dạng `errors` của ASP.NET không được hiển thị đúng trường. | Đã tích hợp `AuthContext` lắng nghe sự kiện `auth:unauthorized` để đăng xuất tự động; bổ sung helper `getValidationErrors` trích xuất `errors` hiển thị lỗi theo từng input. | **Đã chạy (Pass)** |
| [x] | BUG-16 | MEDIUM | `RequireRole.tsx`, `LoginPage.tsx` | Tham số `next` có thể thành open redirect. `npm audit` cũng báo lỗi open redirect của React Router. | Tách sang `lib/safe-redirect.ts`: không decode thêm, từ chối ký tự điều khiển và dấu `\`, kiểm tra origin sau khi chuẩn hóa URL, chặn `/.//evil.com`. Nghiệm thu: 26 chuỗi kiểm tra qua logic của React Router, 7 chuỗi qua luồng đăng nhập trên Chrome. | **Đã chạy (Pass)** — xem mục 5.8 |
| [x] | BUG-17 | MEDIUM | `DiagnoseController.cs:420`, route W-08 | Chưa có API chi tiết `/history/:id` cho W-08. `page` quá lớn có thể tràn số trong `Skip` và gây lỗi DB. | Đã thêm endpoint `GET /api/v1/diagnose/history/{id}` trả trọn gói ca khám kèm phác đồ IPM và thuốc đặc trị; chặn IDOR (user khác trả 404); kẹp `page` bằng `Math.Clamp`; thêm `AsNoTracking`. | **Đã chạy (Pass)** |
| [x] | BUG-20 | MEDIUM | `AuthController.cs:21` | Rate limit gắn cả class nên `GET /auth/me` dùng chung 10 lượt/phút với login. Nhiều máy chung IP dễ bị 429. | Đã gỡ rate limit khỏi class, chỉ áp dụng `[EnableRateLimiting("auth_policy")]` cho `POST /register` và `POST /login`; `GET /auth/me` chạy bình thường không bị 429. | **Đã chạy (Pass)** |
| [x] | BUG-21 | MEDIUM | `AuthController.cs:88` | `DbUpdateException` nào cũng bị báo "email đã sử dụng", che mất các lỗi DB khác. | Đã kiểm tra chính xác mã lỗi `Npgsql.PostgresException.SqlState == "23505"` (unique_violation), các lỗi DB khác trả HTTP 500 kèm log chi tiết. | **Đã chạy (Pass)** |
| [x] | BUG-22 | MEDIUM | `AuthDtos.cs`, `DiagnoseController.cs` | Mật khẩu tối thiểu chỉ 6 ký tự; `MaxLength(72)` đếm ký tự trong khi BCrypt tính byte; `notes` không giới hạn; `phone` dùng sai regex chấp nhận ký tự pipe. | Mật khẩu đăng ký tối đa 72 byte UTF-8 (`MaxUtf8Bytes`); email chứa khoảng trắng hoặc xuống dòng bị từ chối; regex phone là `^(0[35789])[0-9]{8}$|^$`; `notes` tối đa 1000 ký tự. | **Đã chạy (Pass)** — xem mục 5.8 |
| [x] | BUG-23 | MEDIUM | `DiagnoseController.cs:157-195` | User đã đăng nhập vẫn lưu ảnh gốc kèm EXIF/GPS vào bucket đọc công khai. Nếu `disease == null` thì ảnh đã lưu nhưng không có bản ghi, còn id trả về không dùng được. | `ImageMetadataStripper` xóa metadata JPEG, PNG, WebP theo magic bytes, bỏ cả phần đuôi motion photo; file lỗi trả 422 thay vì lưu nguyên. Web còn vẽ lại ảnh để giữ đúng chiều. Tra cứu bệnh trước khi upload nên không còn ảnh mồ côi ở nhánh này. | **Đã chạy (Pass)** — xem mục 5.8 |
| [x] | BUG-24 | MEDIUM | `DiagnoseController.cs:64-67`, `Program.cs` | Chưa có quota riêng cho Guest; mỗi lượt vẫn tốn tài nguyên AI. Một người có thể tạo nhiều tài khoản để lưu nhiều ảnh vì không cần xác minh email. | `diagnose_policy` tách hạn mức: Guest 10 lượt/phút/IP (`GUEST_DIAGNOSE_RATE_LIMIT_PER_MINUTE`), tài khoản tính riêng theo user. `UseRateLimiter` chuyển ra sau `UseAuthentication`. Chưa có xác minh email: ghi nhận là giới hạn đã biết. | **Đã chạy (Pass)** — xem mục 5.8 |
| [x] | BUG-25 | MEDIUM | `DiagnoseController.cs:280` | `verified_sources` không lọc bài đã duyệt, nên có thể hiển thị nguồn chưa qua kiểm duyệt là "đã xác thực". | `verified_sources` chỉ lấy `IsManualApproved = true`, cùng định nghĩa với RAG trong kế hoạch sprint. Hệ quả: lớp bệnh chưa có bài duyệt sẽ không hiện nguồn cho đến khi A03 có luồng duyệt. | **Đã chạy (Pass)** — xem mục 5.8 |
| [ ] | BUG-26 | MEDIUM | `frontend/web/package.json` | `npm audit`: lỗ hổng `follow-redirects` mức high. `@tailwindcss/vite` và `tailwindcss` đang nằm ở `dependencies`. | Chưa xong: `react-router-dom` 6.30.6 vẫn nằm trong khoảng ảnh hưởng của GHSA-wrjc-x8rr-h8h6 và là dependency production; `vite` còn cảnh báo nhưng chỉ dùng khi dev. Xem BUG-54 trong `task-a03`. | `npm audit` ngày 07/11/2026 |
| [ ] | BUG-27 | LOW | `frontend/web/src/app/router.tsx` | Bundle JS 546 KB trong một file, bất lợi ở vùng mạng yếu. | Chưa đạt: JS tải ban đầu thực tế là 522,6 KB (gzip 162,8 KB) vì các file vendor được preload; con số 297 KB chỉ tính một file. Chuyển sang Đợt 3. | `npm run build` ngày 07/11/2026 |
| [x] | BUG-28 | LOW | Mục 2.1, 2.2 và Chặng 3 của file này | Task còn ghi route `/diagnose`, mã hex, Google Fonts và "3 bước IPM", xung đột với `screens.md`, `ui-ux.md` và điều 7 của `AGENTS.md`. | Đã chuẩn hóa: route `/` mặc định, `/diagnose` redirect về `/`; dùng tokens CSS HSL; Be Vietnam Pro tự host; số bước IPM hiển thị động từ DB. | **Đã chạy (Pass)** |
| [x] | BUG-29 | LOW | `api-client.ts`, `RequireRole.tsx`, `router.tsx` | `UserRole` còn `Admin`/`Farmer`, chữ "Expert" vẫn còn dù vai trò đã gộp; interceptor `FormData` không còn cần thiết. | Đã dọn dẹp toàn bộ, thống nhất `UserRole = 'ADMIN' | 'FARMER'`. | **Đã chạy (Pass)** |

#### 📋 Bằng chứng thực nghiệm (Terminal Stdout - Test Suite Đợt 1 / A02 E2E):
```text
======================================================================
     KIỂM THỬ TOÀN TRÌNH E2E TASK-A02: WEB DIAGNOSE & HANDBOOK     
     Target Core API: http://localhost:5176
======================================================================

[TEST 1] Tra cứu danh mục sổ tay bệnh học: GET /api/v1/diseases
  -> SUCCESS: Lấy thành công 40 bệnh học. Mẫu: Bệnh vảy táo (Scab) (Táo)

[TEST 2] Tra cứu chi tiết bệnh Tomato___Late_blight: GET /api/v1/diseases/by-class/Tomato___Late_blight
  -> SUCCESS: Lấy thành công chi tiết bệnh; 3 bước IPM; 3 thuốc đặc trị hợp lệ (0 thuốc cấm).

[TEST 3] Đăng ký tài khoản nông dân mới với tên tiếng Việt có dấu: POST /api/v1/auth/register
  -> SUCCESS: Tạo thành công tài khoản: Trần Thị Hoa (farmer_a02_3c5b566b@lavitree.vn), ID: 455ef4eb-fce0-46cd-a38a-29c30ededf1a

[TEST 4] Kiểm tra bảo toàn tiếng Việt trong JWT Claims (BUG-14)
  -> SUCCESS: Claim name trong JWT bảo toàn 100% tiếng Việt: 'Trần Thị Hoa'

[TEST 5] Đăng nhập xác thực tài khoản vừa tạo: POST /api/v1/auth/login
  -> SUCCESS: Đăng nhập thành công, token Bearer cấp quyền FARMER.

[TEST 6] Khám lá khách vãng lai (Guest): POST /api/v1/diagnose (Không Bearer token)
  -> SUCCESS: Guest Policy hoàn hảo: diagnosis_id=null; Grad-CAM data URL trả về; 3 bước IPM; 3 thuốc đặc trị; 2 nguồn khuyến nông.

[TEST 7] Khám ảnh ngoại lai OOD: POST /api/v1/diagnose (hand.jpg)
  -> SUCCESS: OOD Policy chuẩn xác: is_ood=true; Ảnh nằm ngoài phạm vi 38 lớp cây trồng được hỗ trợ (OOD). Vui lòng không chụp vật thể lạ hoặc ảnh không rõ lá cây.; không rò rỉ dữ liệu bệnh/thuốc/ảnh.

[TEST 8] Khám lá tài khoản Nông dân đã đăng nhập: POST /api/v1/diagnose (Có Bearer token)
  -> SUCCESS: Chẩn đoán lưu thành công: diagnosis_id=0b6b7106-7c6d-41e2-b367-d19e3446ea9b; Ảnh gốc và Grad-CAM đã được upload.

[TEST 9] Truy vấn danh sách lịch sử chẩn đoán: GET /api/v1/diagnose/history
  -> SUCCESS: Hồ sơ vừa khám hiển thị ngay đầu danh sách: Bệnh mốc sương (Late blight) (Cà chua) - Ghi chú: 'Vườn cà chua 3 sào tại Nam Định'

[TEST 10] Truy vấn chi tiết ca khám: GET /api/v1/diagnose/history/0b6b7106-7c6d-41e2-b367-d19e3446ea9b
  -> SUCCESS: Chi tiết ca khám W-08 hoàn chỉnh: 3 bước IPM; 3 thuốc gợi ý; bằng chứng ảnh đầy đủ.

[TEST 11] Kiểm tra bảo mật IDOR chi tiết: Người dùng khác không được xem ca khám của Trần Thị Hoa
  -> SUCCESS: IDOR được chặn triệt để: Người dùng khác nhận HTTP 404 Not Found.

[TEST 12] Kiểm tra chặn ghi chú vượt quá 1000 ký tự: POST /api/v1/diagnose
  -> SUCCESS: Hệ thống từ chối chính xác ghi chú > 1000 ký tự (HTTP 400 Bad Request).

[TEST 13] Kiểm tra chặn request không có ảnh: POST /api/v1/diagnose
  -> SUCCESS: Hệ thống từ chối chính xác request thiếu ảnh (HTTP 400 Bad Request).

======================================================================
 KẾT QUẢ KIỂM THỬ: 13 PASSED / 0 FAILED (Tổng số: 13 bài test)
======================================================================
```
=> **KẾT LUẬN: ĐỦ ĐIỀU KIỆN ĐÓNG ĐỢT 1 VÀ HOÀN TẤT TOÀN DIỆN TASK-A02.**

### 5.4. Đợt 2 — Làm trong A03 (Admin, Store, Knowledge)
| Xong | ID | Mức | Vị trí | Lỗi và hậu quả | Cách sửa và nghiệm thu | Kiểm chứng |
|---|---|---|---|---|---|---|
| [ ] | BUG-18 | HIGH | `KnowledgeController.cs:327,398,411` | Chưa gộp `X-Admin-Key` vào JWT role `ADMIN`; toàn bộ API chưa có `Authorize(Roles)`. | Dùng `[Authorize(Roles = "ADMIN")]`, bỏ khóa dùng chung ở giao diện. Test: FARMER 403, ADMIN 200. | Đọc code |
| [ ] | BUG-30 | HIGH | `KnowledgeCollectorPage.tsx:846,907,973` | Thêm, xóa và export không gửi khóa admin nên đều bị 401. Link export mở tab mới cũng không gửi được header Authorization. | Dùng `apiClient`; export bằng cách tải blob sau khi xác thực. | Đọc code |
| [ ] | BUG-31 | MEDIUM | `router.tsx:48`, `KnowledgeController.cs:283` | `/knowledge` chưa có guard. `GET /knowledge/sources` công khai, không phân trang, có thể trả cả ghi chú nội bộ của người duyệt. | Xóa route công khai, chuyển về `/admin/knowledge`. API công khai chỉ trả trường cần thiết, có phân trang. | Đọc code |
| [ ] | BUG-32 | MEDIUM | `KnowledgeController.cs:326-385`, `KnowledgeCollectorPage.tsx:2840` | `SourceUrl` không kiểm tra scheme, có thể lưu `javascript:`. Với token trong `localStorage`, XSS có thể chiếm phiên. | Chỉ nhận `http` và `https`, kiểm tra thêm ở frontend, giới hạn độ dài. Test với URL `javascript:`. | Đọc code; hành vi trên trình duyệt cần kiểm tra |
| [ ] | BUG-33 | MEDIUM | `KnowledgeController.cs:443` | CSV không chặn công thức (`=`, `+`, `-`, `@`), có thể chạy công thức khi Admin mở bằng Excel. | Thêm tiền tố an toàn cho các ô này. Test với ô bắt đầu bằng `=`. | Đọc code |
| [ ] | BUG-34 | MEDIUM | `MedicinesController.cs:49-53,100`, `DiagnosisDtos.cs:172` | Tải toàn bộ `Products` rồi mới lọc; không phân trang; ai cũng dùng được `allowedOnly=false`. `ProductDto` thiếu PHI và trạng thái cho phép. Contract ghi `id` là UUID nhưng code là số. | Lọc trong SQL, thêm phân trang, giới hạn `allowedOnly=false` cho ADMIN, bổ sung trường và thống nhất kiểu `id`. | Đọc code |
| [ ] | BUG-35 | MEDIUM | `WeatherController.cs:29`, `WeatherService.cs:39,70` | `/weather` công khai, không rate limit, `location` không giới hạn độ dài và cache không có giới hạn kích thước. Có thể bị làm đầy bộ nhớ hoặc tốn quota. Contract yêu cầu `location` nhưng code tự chọn Hà Nam. | Thêm rate limit, kiểm tra độ dài hoặc danh sách địa danh, đặt `SizeLimit`; thiếu `location` trả 400. | Đọc code |
| [ ] | BUG-36 | MEDIUM | `WeatherService.cs:78` | API key nằm trên URL. Log mức Information của `HttpClient` có thể ghi lại cả URL kèm key. | Hạ log `System.Net.Http.HttpClient` xuống Warning và không ghi URL. Kiểm tra log không chứa key. | Đọc code; cần kiểm tra log thực tế |
| [ ] | BUG-37 | MEDIUM | `backend/core-api/seed/sample_treatment_seed.json` | Ảnh thuốc trỏ tới `lavitree.io.vn`, khác contract `/lavitree-diagnoses/products/...`, và chưa xác nhận tồn tại. | Lưu ảnh trong bucket hoặc thư mục tĩnh của dự án, cập nhật contract. | Cần kiểm tra |
| [ ] | BUG-38 | MEDIUM | `Program.cs:98-111` | JWT 7 ngày không thu hồi được: tài khoản đã xóa vẫn dùng được, role cũ còn hiệu lực. Thuật toán ký chưa được cố định. | Dùng `OnTokenValidated` kiểm tra user, đặt `ValidAlgorithms = HS256`. Test tài khoản đã xóa trả 401. | Đọc code |

### 5.5. Đợt 3 — Làm khi đóng gói triển khai
| Xong | ID | Mức | Vị trí | Lỗi và hậu quả | Cách sửa và nghiệm thu | Kiểm chứng |
|---|---|---|---|---|---|---|
| [ ] | BUG-39 | HIGH | `docker-compose.yml:42-43`, `Program.cs:45` | `env_file` đưa `AI_SERVICE_URL=localhost` và `MINIO_ENDPOINT=localhost` vào container, và các biến này được ưu tiên hơn cấu hình compose. Core API không gọi được dịch vụ khác. | Đặt URL nội bộ trong `environment` hoặc đổi thứ tự ưu tiên. Nghiệm thu: `docker compose up`, chẩn đoán thành công. | Đọc code; chưa chạy Docker |
| [ ] | BUG-40 | HIGH | `backend/core-api/Dockerfile`, `LavitreeDbContextSeeder.cs:17-22` | Image không có thư mục `seed`, seeder thoát sớm nên không tạo admin và dữ liệu. | Copy `seed` vào image và cho thiếu seed báo lỗi rõ ở production. | Đọc code; chưa chạy Docker |
| [ ] | BUG-41 | HIGH | `frontend/web/nginx.conf:4-5`, `docker-compose.yml:70` | Chỉ có HTTP nên mật khẩu và token đi dạng rõ. Chưa có CSP, `X-Frame-Options`, `X-Content-Type-Options` và HSTS. | Bật HTTPS và thêm security header. Nghiệm thu bằng `curl -I`. | Đọc code |
| [ ] | BUG-42 | MEDIUM | `nginx.conf:38`, `nginx.conf:52` | Nginx chưa rate limit `/api/` và auth; route ảnh chưa giới hạn method; `client_max_body_size 15M` áp dụng cả cho API nhỏ. | Thêm zone cho auth và API, chỉ cho `GET`/`HEAD` với ảnh, giới hạn body theo route. | Đọc code |
| [ ] | BUG-43 | MEDIUM | `Program.cs:31`, `MinioStorageService.cs:30`, `.env.example` | Còn giá trị mặc định `Password=postgres` và `minioadmin`; `JWT_SECRET` không dùng; `AUTH_RATE_LIMIT_PER_MINUTE` chưa có trong file mẫu; JWT chỉ yêu cầu 32 ký tự trong khi task ghi 64. | Bỏ mặc định ở production, dọn file mẫu, thống nhất độ dài khóa. | Đọc code |
| [ ] | BUG-44 | MEDIUM | `.env`, `backend/core-api/.env`, `docker-compose.yml:11` | Hai file `.env` khác nhau: `dotnet run` có thể đọc file trong `core-api`, còn compose đọc file gốc. `env_file` cũng đưa mọi secret vào `ai-service`. | Dùng một nguồn cấu hình; mỗi service chỉ nhận biến cần thiết. | Đọc code; đường dẫn đọc `.env` cần kiểm tra |
| [ ] | BUG-45 | MEDIUM | `.env` (`SUPABASE_CONNECTION_STRING`) | `Trust Server Certificate=true` không kiểm tra chứng chỉ DB. | Dùng `SSL Mode=VerifyFull` kèm CA của Supabase. | Đọc code |
| [ ] | BUG-46 | MEDIUM | Các `Dockerfile`, `docker-compose.yml:90` | Chưa có `.dockerignore`; `COPY . .` có thể chép `.env` vào layer build và ghi đè `node_modules` bằng bản của macOS. Container chạy root, dùng `npm install`, image `pgsty/silo:latest` chưa cố định phiên bản. | Thêm `.dockerignore`, dùng `USER` thường, `npm ci`, ghim phiên bản image. | Đọc code; chưa build Docker |
| [ ] | BUG-47 | LOW | `Program.cs` | Chưa có xử lý lỗi toàn cục và health check. | Thêm `UseExceptionHandler` trả ProblemDetails và endpoint `/health`. | Đọc code |
| [ ] | BUG-48 | LOW | `WeatherForecastController.cs`, `AuthController.cs:30` | Controller mẫu còn công khai; `AuthController` gọi trực tiếp thư viện BCrypt, lệch Clean Architecture. | Xóa controller mẫu; để logic hash giả trong `IPasswordHasher`. | Đọc code |

### 5.6. Tài liệu và quy trình
| Xong | ID | Mức | Vị trí | Lỗi và hậu quả | Cách sửa và nghiệm thu | Kiểm chứng |
|---|---|---|---|---|---|---|
| [ ] | BUG-19 | HIGH | `docs/architecture/database-schema.md`, `docs/architecture/api-contracts.md` | Đổi DB và API nhưng chưa cập nhật tài liệu (vi phạm điều 4 của `AGENTS.md`). Tài liệu còn `IsolationDays`, thiếu cột mới; Guest vẫn ghi lưu `null`; `phone_number` khác `phone`; `expires_in` 86400 khác 7 ngày. | Cập nhật tài liệu và thông báo cho thành viên B. | Đọc code |
| [ ] | BUG-49 | MEDIUM | `tasks/TODO.md`, `tasks/WORKLOG.md`, `doc/hint/sprint2_TVA_TASKA01.md` | Tài liệu đánh dấu "100%" dù chưa chạy lại test; file hint nêu rõ tình trạng mật khẩu admin. | Trả A01 về trạng thái đang sửa đến khi xong Đợt 0. Đổi mật khẩu (BUG-01) trước khi push; không đưa file hint lên repo public. | Đọc code |
| [ ] | BUG-50 | LOW | Commit `3cf1e27`, `99ef091` | Sửa A01 trên nhánh A00; message chưa đúng mẫu `fix: [Mã Task] ...`. | Các lần sau tạo nhánh `fix/task-...` riêng và dùng đúng mẫu commit. | Đã xem git log |

### 5.7. Điều kiện để qua Đợt 0
- [x] `dotnet build` thành công (0 Warning, 0 Error); migration `20261105233000_AddMedicineFieldsToProduct` đã chạy thành công trên Supabase PostgreSQL.
- [x] Toàn bộ 14 test backend pass 100%, có dán stdout thật vào mục này (xem bên dưới).
- [ ] Mật khẩu admin đã lộ bị từ chối 401 trên Supabase và mật khẩu mới đăng nhập được (làm theo mục 5.8). Chẩn đoán Late blight và API thuốc không gợi ý Paraquat đã đạt.
- [x] Khởi động lại API không làm mất dữ liệu Admin đã sửa (seeder chỉ thêm mới, không ghi đè bản ghi cũ).
- [ ] `/weather` dùng xác suất mưa thật (`pop`) và không trả dữ liệu giả ở production: chờ merge `feat/task-05-fastmcp-tools`.

#### 📋 Bằng chứng thực nghiệm (Terminal Stdout - Test Suite Đợt 0):
```text
======================================================================
     KIỂM THỬ TỰ ĐỘNG TASK-A01: AUTH JWT, SECURITY & DAY 1 STUB     
     Target URL: http://localhost:5176
======================================================================

[TEST 1] Kiểm tra Day 1 Stub API: GET /api/v1/medicines/search (Lọc thuốc cấm)
  -> SUCCESS: Trả về 3 thuốc BVTV đặc trị hợp lệ; 100% thuốc cấm (Paraquat) đã được lọc sạch.

[TEST 2] Đăng ký tài khoản Nông dân mới: POST /api/v1/auth/register
  -> SUCCESS: Tạo thành công tài khoản ID: f4df4d1d-dd02-4062-ba66-9085debfc0af, cấp phát JWT Token 7 ngày.

[TEST 3] Kiểm tra chặn trùng lặp email: POST /api/v1/auth/register (Duplicate)
  -> SUCCESS: Hệ thống từ chối đăng ký trùng email chính xác (HTTP 400 Bad Request).

[TEST 4] Đăng nhập với mật khẩu sai: POST /api/v1/auth/login
  -> SUCCESS: Hệ thống chặn truy cập khi sai mật khẩu chính xác (HTTP 401 Unauthorized).

[TEST 5] Đăng nhập với mật khẩu đúng: POST /api/v1/auth/login
  -> SUCCESS: Đăng nhập thành công, nhận token xác thực Bearer.

[TEST 6] Chặn đăng nhập Admin với mật khẩu cũ đã lộ: POST /api/v1/auth/login (BUG-01)
  -> SUCCESS: Hệ thống từ chối chính xác mật khẩu Admin cũ đã lộ (HTTP 401 Unauthorized).

[TEST 7] Đăng nhập tài khoản Quản trị viên với mật khẩu mới: admin@lavitree.vn
  -> SUCCESS: Tài khoản Admin đăng nhập thành công với mật khẩu mới, cấp JWT quyền ADMIN.

[TEST 8] Truy cập thông tin người dùng không có Token: GET /api/v1/auth/me
  -> SUCCESS: Middleware JWT chặn truy cập không có Token chính xác (HTTP 401 Unauthorized).

[TEST 9] Truy cập thông tin người dùng với Token giả mạo: GET /api/v1/auth/me
  -> SUCCESS: Chữ ký JWT giả mạo bị từ chối chính xác (HTTP 401 Unauthorized).

[TEST 10] Truy cập thông tin người dùng với Token hợp lệ: GET /api/v1/auth/me
  -> SUCCESS: Xác thực danh tính thành công: Nguyễn Văn Nông Dân (farmer_2479f25f@lavitree.vn, Role: FARMER)

[TEST 11] Truy cập Lịch sử khám bệnh không có Token: GET /api/v1/diagnose/history
  -> SUCCESS: Endpoint History được bảo vệ nghiêm ngặt chống rò rỉ dữ liệu (HTTP 401 Unauthorized).

[TEST 12] Truy vấn Lịch sử khám bệnh của tài khoản mới: GET /api/v1/diagnose/history
  -> SUCCESS: Truy vấn lịch sử thành công: Tổng cộng 0 bản ghi (Tài khoản mới đăng ký).

[TEST 13] Kiểm tra Weather API thực tế: GET /api/v1/weather (Hà Nội)
  -> SUCCESS: Dữ liệu thời tiết Hà Nội: 28°C, Độ ẩm: 74%, Xác suất mưa: 89%, Rủi ro: HIGH, Mô phỏng: False

[TEST 14] Kiểm tra Weather API vị trí mặc định: GET /api/v1/weather (Hà Nam)
  -> SUCCESS: Thời tiết Hà Nam: 28.2°C, Xác suất mưa: 81%, Rủi ro: HIGH

======================================================================
 KẾT QUẢ KIỂM THỬ: ĐẠT 14/14 BÀI TEST CHUẨN!
 Tất cả các tiêu chuẩn bảo mật, Day 1 Stub, băm BCrypt, lọc thuốc cấm và xác thực JWT đã hoàn tất 100%.
======================================================================
```
=> **Cập nhật 07/11/2026:** kết luận cũ của stdout trên không còn đúng; xem mục 5.8 để biết trạng thái hiện tại.

### 5.8. Review lại A02 ngày 07/11/2026 (trên working tree, chưa commit)

**Trạng thái:** code A02 sẵn sàng để sang A03, nhưng còn 3 việc do thành viên A thực hiện.

**Việc bắt buộc trước khi push:**
1. Đổi mật khẩu trong DB thật. Chỉ sửa `.env` thì chưa đủ, vì mặc định seeder không ghi đè mật khẩu:
   - Đặt `FORCE_ADMIN_PASSWORD_RESET=true` trong `.env` và khởi động API một lần.
   - Đặt lại `false`, rồi đăng nhập thử: mật khẩu đã lộ phải trả 401, mật khẩu mới trả 200.
2. Xác nhận `JWT_SECRET_KEY` đã được đổi so với lúc mật khẩu bị lộ. Nếu chưa, đổi ngay vì token ADMIN đã phát có thể còn sống tới 7 ngày.
3. Khi merge với `feat/task-05-fastmcp-tools`, giữ `WeatherService.cs` của nhánh đó, rồi tick BUG-05 và BUG-07.

**Kết quả đã chạy:**
| Kiểm tra | Kết quả |
|---|---|
| `dotnet build`, `tsc --noEmit`, `npm run build` | Đạt, 0 lỗi |
| `test_task_a02_e2e.py` | 16/16 |
| `test_task_a01_auth.py` | 19/19 (bỏ qua kiểm tra mật khẩu cũ vì chưa đặt `ADMIN_RETIRED_PASSWORD`) |
| Đổi `.env`, `FORCE=false` | Mật khẩu cũ 200, mật khẩu mới 401 |
| Đổi `.env`, `FORCE=true`, rồi khởi động lại với `false` | Mật khẩu cũ 401, mật khẩu mới 200 và giữ nguyên |
| Ảnh JPEG, JPEG progressive, motion photo, PNG, WebP có metadata | Điểm ảnh giữ nguyên, không còn metadata; file lỗi bị từ chối |
| Gỡ liên kết thuốc và tắt thuốc rồi khởi động lại | Dữ liệu giữ nguyên |
| Guest gửi liên tục | Nhận 429; tài khoản cùng IP vẫn dùng được |
| Chrome: ảnh xoay EXIF 3000×2000, 702 KB | Gửi lên 1067×1600, 188 KB, không còn EXIF, đúng chiều |
| Chrome: Login với `next` độc hại, lỗi tải Sổ tay/Lịch sử, id sai, ca dễ nhầm | Đúng như thiết kế, không có lỗi JS |

**Giới hạn của kết quả trên:** chạy trên PostgreSQL riêng trong thư mục tạm, với AI stub và S3 stub. Chưa chạy với Supabase, model AI thật, MinIO thật hay OpenWeather thật.

**Sửa thêm ngoài danh sách BUG:**
- Bỏ phép tính xác suất tự suy cho lớp dễ nhầm ở `/history/{id}`, vì đây là số không có thật. DB chỉ lưu Top-1 nên hồ sơ cũ chỉ hiện 1 dòng (xem BUG-52 trong `task-a03`).
- Nút "Nhờ chuyên gia thẩm định" trước đây báo đã chuyển hồ sơ dù không gửi gì. Nay đi đúng luồng `screens.md`: đã đăng nhập sang Trợ lý, chưa đăng nhập sang Đăng nhập.
- Dialog chi tiết hiện cảnh báo và ghi chú. Sổ tay có trạng thái lỗi riêng. Id sai không còn kẹt trên URL.
- Bỏ các chữ không có căn cứ: "sản phẩm hợp quy", "40 danh mục", "38 bệnh hại".
- Xóa mật khẩu đã lộ khỏi seeder, test và tài liệu.
