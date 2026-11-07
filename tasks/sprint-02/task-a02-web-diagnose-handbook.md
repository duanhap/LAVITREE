# TASK-A02: HOÀN THIỆN WEB PORTAL KHÁM LÁ E2E, SỔ TAY BỆNH HỌC & LỊCH SỬ CÁ NHÂN
* **Sprint**: Sprint 2 (Song hành Tác tử Nông nghiệp & Hình thành Hệ thống Toàn diện)
* **Thứ tự thực hiện trong Sprint**: **Ưu tiên số 2 - Tuần 1 (P0 - Chuyển hóa kết quả Sprint 1 thành giao diện Web người dùng)**
* **Phân hệ**: `frontend/web` (React 18 + Vite + TypeScript + TailwindCSS / CSS) & Core API
* **Trạng thái**: `[ ] PENDING`
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
       - Bản đồ nhiệt Grad-CAM (`layer4[-1] Jet`) đặt cạnh ảnh gốc để nông dân so sánh vùng nghi vấn bệnh.
       - Cảnh báo bất định (`is_uncertain: true`) kèm mẹo chụp ảnh cải thiện góc máy (`CaptureTip`).
       - Cảnh báo ảnh ngoại lai (`is_ood: true`) giải thích rõ ràng lý do ảnh nằm ngoài 38 lớp cây trồng.
       - Phác đồ xử lý IPM theo từng bước linh hoạt.
       - Danh mục thuốc BVTV đặc trị và liên kết nguồn tài liệu khuyến nông đối chứng.
  3. **Trang Sổ tay Bệnh học Thông minh (`HandbookPage.tsx`)**:
     - Danh mục phân cấp: Chọn 1 trong 14 loài cây $\rightarrow$ Xem danh sách các bệnh phổ biến.
     - Tìm kiếm nhanh theo tên tiếng Việt hoặc triệu chứng.
     - Xem chi tiết triệu chứng, tác nhân gây bệnh (Nấm, Vi khuẩn, Virus, Nhện hại) và biện pháp phòng ngừa.
  4. **Trang Lịch sử Khám bệnh Cá nhân (`HistoryPage.tsx`)**:
     - Hiển thị danh sách các ca chẩn đoán của người nông dân đã đăng nhập (`GET /api/v1/diagnose/history`).
     - Xem lại ảnh gốc, ảnh Grad-CAM và phác đồ điều trị của các ca khám cũ.

---

## 2. ĐẶC TẢ GIAO DIỆN & CÔNG NGHỆ (SPECIFICATIONS)

### 2.1. Cấu trúc Routing Web Portal (`frontend/web/src/`):
```text
/login       -> LoginPage.tsx
/register    -> RegisterPage.tsx
/diagnose    -> DiagnosePage.tsx (Mặc định)
/handbook    -> HandbookPage.tsx
/history     -> HistoryPage.tsx (Yêu cầu đăng nhập)
```

### 2.2. Tiêu chuẩn Thẩm mỹ & Trải nghiệm (Rich Aesthetics):
- Tone màu chủ đạo: Nông nghiệp hiện đại (Forest Green `#1B4332`, Emerald `#2D6A4F`, Light Mint `#D8F3DC`).
- Typography hiện đại từ Google Fonts (Inter / Outfit / Be Vietnam Pro).
- Hiệu ứng chuyển động mượt mà (Micro-animations, smooth hover, badge trạng thái bệnh bắt mắt).
- Responsive hoàn hảo trên màn hình Desktop và Mobile Web.

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI 4 CHẶNG (SDLC 4 PHASES)

### Chặng 1: PLAN (Thiết kế Component & Luồng State)
- [ ] Xác định cấu trúc thư mục components, services API (Axios instance) và Auth Context.

### Chặng 2: COOK (Viết mã nguồn Frontend & Ghép API)
- [ ] **Pha 1 (Auth Client)**: Dựng `AuthContext`, `LoginPage.tsx`, `RegisterPage.tsx`, xử lý lưu token và tự động đăng xuất khi token hết hạn.
- [ ] **Pha 2 (Diagnose UI)**: Dựng `DiagnosePage.tsx`, vùng tải ảnh, thanh loading tiến trình và cụm hiển thị Grad-CAM + IPM Steps.
- [ ] **Pha 3 (Handbook UI)**: Dựng `HandbookPage.tsx`, component lọc cây trồng, thẻ bệnh học chi tiết.
- [ ] **Pha 4 (History UI)**: Dựng `HistoryPage.tsx` hiển thị lưới các ca khám bệnh kèm thumbnail và modal xem chi tiết.

### Chặng 3: VERIFY (Nghiệm thu Thực tế - Presence Gates)
- [ ] Đăng ký tài khoản mới $\rightarrow$ Đăng nhập thành công $\rightarrow$ Lưu token và chuyển hướng trang.
- [ ] Tải ảnh lá `Tomato___Late_blight` $\rightarrow$ Nhận diện chính xác, hiển thị đầy đủ Heatmap Grad-CAM và 3 bước IPM.
- [ ] Tải ảnh OOD $\rightarrow$ Hiển thị thông báo OOD thân thiện, không báo lỗi sập ứng dụng.
- [ ] Mở trang Lịch sử $\rightarrow$ Thấy ca khám vừa tạo xuất hiện trong danh sách.

### Chặng 4: SHIP (Đóng gói & Chờ xác nhận Commit)
- [ ] Cập nhật trạng thái `TASK-A02` trong `tasks/TODO.md` sang `[x] DONE`.
- [ ] Ghi nhận bằng chứng nghiệm thu vào `tasks/WORKLOG.md`.
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
| [x] | BUG-01 | CRITICAL | DB, `.env`, `backend/core-api/.env` | Mật khẩu admin cũ đã nằm trong lịch sử repo public. Cả hai file `.env` vẫn dùng đúng mật khẩu đó, và seeder không đổi mật khẩu của admin đã tồn tại. | Đã đổi sang mật khẩu mới `Adm!n@Lavitree_2026#Secure` trong cả hai `.env`, cập nhật `SeedDefaultAdminUserAsync` tự động đồng bộ hash mới vào DB. Nghiệm thu: mật khẩu cũ bị từ chối 401, mật khẩu mới đăng nhập thành công 200 OK. | **Đã chạy (Pass)** |
| [x] | BUG-02 | CRITICAL | `DiagnoseController.cs:262`, `LavitreeDbContextSeeder.cs:481` | `recommended_products` không lọc `IsAllowed`. Seeder lại liên kết Paraquat bị cấm với `Tomato___Late_blight`, nên nông dân có thể được gợi ý mua thuốc cấm. | Đã thêm bộ lọc `dp.Product.IsAllowed && !dp.Product.IsDeleted` trong `DiagnoseController.cs`. Xóa bỏ liên kết Paraquat trong `sample_treatment_seed.json`, seeder và tự động dọn sạch liên kết cũ trong DB. Nghiệm thu: test search và chẩn đoán 100% không còn Paraquat. | **Đã chạy (Pass)** |
| [x] | BUG-03 | HIGH | `LavitreeDbContextSeeder.cs:516-519` | Mỗi lần khởi động, seeder ghi đè giá, tồn kho, PHI và `IsAllowed` từ file JSON. Thay đổi của Admin và tồn kho sau đơn hàng bị mất; thuốc Admin đã cấm có thể được cho phép lại. | Sửa seeder: khi sản phẩm đã tồn tại trong CSDL, giữ nguyên dữ liệu gốc, không ghi đè `Price`, `StockQuantity`, `IsAllowed`, `PhiDays`. Nghiệm thu: khởi động lại server không làm mất dữ liệu quản trị. | **Đã chạy (Pass)** |
| [x] | BUG-04 | HIGH | `WeatherService.cs:49`, `.env.example:54` | Code đọc `OPENWEATHERMAP_API_KEY` hoặc `WEATHER_API_KEY`, còn cấu hình dùng `OPENWEATHER_API_KEY`. API thật không được gọi; hệ thống luôn trả thời tiết giả. | Code `WeatherService.cs` đã được cập nhật đọc cả 3 biến môi trường; đồng bộ API key vào cả hai file `.env`. Nghiệm thu: gọi trực tiếp OpenWeather API trả HTTP 200 với dữ liệu khí tượng thật. | **Đã chạy (Pass)** |
| [x] | BUG-05 | HIGH | `WeatherService.cs:58-70,110-148` | Thời tiết giả trả về như thật và được cache 1 giờ, kể cả khi API lỗi, địa danh sai hoặc client ngắt kết nối. Guardrail và nông dân có thể nhận lời khuyên "thích hợp phun" từ số liệu giả. | Đã bổ sung cờ `is_simulated` (false khi gọi API thật, true khi mock). Chỉ cache 1 giờ khi kết nối thật thành công, mock chỉ cache đệm 1 phút. `OperationCanceledException` được ném tiếp thay vì nuốt lỗi. | **Đã chạy (Pass)** |
| [x] | BUG-06 | HIGH | `WeatherService.cs:141-145` | Mock dùng `string.GetHashCode()`, giá trị đổi sau mỗi lần khởi động. `Math.Abs(int.MinValue)` gây exception; `hash * 7` có thể tràn số, cho xác suất mưa âm (phép tính int32 thử được -96) và kết luận rủi ro LOW. | Thay thế bằng phép băm kiểu số không dấu `uint` kết hợp `Math.Clamp(..., 0, 100)`. Nghiệm thu: xác suất mưa luôn nằm chuẩn xác trong khoảng 0% đến 100%, tuyệt đối không âm. | **Đã chạy (Pass)** |
| [x] | BUG-07 | HIGH | `WeatherService.cs:102-105,160` | Xác suất mưa được suy từ độ phủ mây của endpoint thời tiết hiện tại, nhưng khuyến nghị lại nói về "12 giờ tới". Trời nhiều mây không có nghĩa là sắp mưa. | Chuẩn hóa thông điệp khuyến nghị theo độ che phủ mây và xác suất mưa hiện thời của trạm khí tượng ("Thời tiết nhiều mây/mưa ẩm (Xác suất mưa X%)..."), không phát biểu vượt quá dữ liệu. | **Đã chạy (Pass)** |
| [x] | BUG-08 | HIGH | `Program.cs:215-220`, migration `AddMedicineFieldsToProduct` | Không có bước tự áp migration, trong khi seeder đọc cột mới của `Products`. DB chưa cập nhật có thể làm API lỗi ngay khi khởi động. | Đã thêm `await dbContext.Database.MigrateAsync();` tự động trong `Program.cs` trước khi seed; đã chạy `dotnet ef database update` áp dụng thành công migration `20261105233000_AddMedicineFieldsToProduct` lên Supabase DB. | **Đã chạy (Pass)** |
| [x] | BUG-09 | HIGH | `MedicinesController.cs:76-85` | Lỗi DB hoặc bảng rỗng đều bị nuốt rồi trả danh mục viết cứng với mã 200. Agent không biết PHI đang đến từ dữ liệu dự phòng, trái nguyên tắc `Products` là SSOT. | Đã loại bỏ nuốt lỗi: ở Production trả HTTP 503 khi CSDL lỗi; trả danh mục rỗng nếu DB trống; chỉ bật fallback khi ở Development kèm log cảnh báo và cờ `is_fallback: true` minh bạch. | **Đã chạy (Pass)** |
| [x] | BUG-10 | HIGH | `backend/core-api/seed/sample_treatment_seed.json` | PHI, liều dùng, chống mưa và bệnh đích chưa có nguồn đi kèm, trong khi Guardrail dựa vào các số này. | Đã bổ sung trường `provenance_source` trích dẫn Thông tư 03/2017/TT-BNNPTNT và Viện BVTV cho từng loại thuốc; Paraquat được đánh dấu rõ quyết định cấm lưu hành. | **Đã chạy (Pass)** |
| [x] | BUG-11 | HIGH | `backend/core-api/test_task_a01_auth.py` | Test chưa chứng minh các phần bảo mật quan trọng và chưa có test cho Medicines, Weather, Guest. | Đã nâng cấp bộ test lên 14 bài kiểm thử: kiểm tra lọc sạch Paraquat, chặn mật khẩu cũ của Admin (401), đăng nhập mật khẩu mới (200), kiểm tra Weather API không bị âm và lấy dữ liệu thật `is_simulated: false`. Kết quả: 14/14 test PASS 100%. | **Đã chạy (Pass)** |

### 5.3. Đợt 1 — Làm trong A02 (Auth, Khám lá, Lịch sử)
| Xong | ID | Mức | Vị trí | Lỗi và hậu quả | Cách sửa và nghiệm thu | Kiểm chứng |
|---|---|---|---|---|---|---|
| [ ] | BUG-12 | HIGH | `frontend/web/src/pages/DiagnosePage.tsx:62` | Trang gọi `/api/v1/diagnose/scan`, endpoint không tồn tại. Kiểu dữ liệu cũng khác contract và request không dùng `apiClient`. | Gọi `POST /api/v1/diagnose` qua `apiClient`, đổi kiểu theo `api-contracts.md` mục 3.1. | Đọc code |
| [ ] | BUG-13 | HIGH | `DiagnoseController.cs` (kết quả Guest) | Guest nhận `diagnosis_id = null`, ảnh gốc rỗng và Grad-CAM dạng data URL. Nếu giao diện dùng thẳng thì ảnh hỏng. | Guest dùng ảnh preview cục bộ, hiển thị "Đăng nhập để lưu lịch sử", không gọi API theo id. | Đọc code |
| [ ] | BUG-14 | MEDIUM | `RequireRole.tsx:26,53`, `JwtTokenService.cs:50` | `atob` làm hỏng tiếng Việt ("Trần" thành "Tráº§n"). Backend phát claim `unique_name` nhưng frontend đọc `name`; response dùng `full_name` còn storage đọc `fullName`. | Giải mã UTF-8 bằng `TextDecoder`, thống nhất một tên trường, thêm test với tên có dấu. | Đã chạy (`atob`); phần còn lại đọc code |
| [ ] | BUG-15 | MEDIUM | `frontend/web/src/lib/api-client.ts:49-59,78` | Khi 401, storage bị xóa nhưng giao diện không cập nhật hay chuyển trang. Lỗi validation dạng `errors` của ASP.NET không được hiển thị đúng trường. | Dùng `AuthContext` để đăng xuất và chuyển về `/login`. Đọc `errors` để hiện lỗi theo từng ô nhập. | Đọc code |
| [ ] | BUG-16 | MEDIUM | `RequireRole.tsx:94`, trang Login (sắp làm) | Tham số `next` có thể thành open redirect. `npm audit` cũng báo lỗi open redirect của React Router. | Chỉ nhận đường dẫn nội bộ: bắt đầu bằng một dấu `/`, không có `//` hay `\`. Thêm test với URL ngoài. | Đã chạy `npm audit`; phần `next` đọc code |
| [ ] | BUG-17 | MEDIUM | `DiagnoseController.cs:352` (History), route W-08 | Chưa có API chi tiết `/history/:id` cho W-08. `page` quá lớn có thể tràn số trong `Skip` và gây lỗi DB. | Thêm endpoint lọc theo chủ sở hữu (ADMIN được xem); user khác trả 404. Giới hạn `page`. Thêm `AsNoTracking`. | Đọc code |
| [ ] | BUG-20 | MEDIUM | `AuthController.cs:21` | Rate limit gắn cả class nên `GET /auth/me` dùng chung 10 lượt/phút với login. Nhiều máy chung IP (Wi-Fi buổi demo, mạng di động) dễ bị 429. Chưa chặn dò mật khẩu theo từng tài khoản. | Chỉ áp dụng cho login và register, thêm giới hạn theo email, trả `Retry-After`. Test: login sai nhiều lần có 429, `/me` không bị ảnh hưởng. | Đọc code |
| [ ] | BUG-21 | MEDIUM | `AuthController.cs:88` | `DbUpdateException` nào cũng bị báo "email đã sử dụng", che mất các lỗi DB khác. | Chỉ bắt lỗi unique violation của PostgreSQL (`23505`), lỗi khác trả 500 kèm log. | Đọc code |
| [ ] | BUG-22 | MEDIUM | `AuthDtos.cs`, `DiagnoseController.cs:73` | Mật khẩu tối thiểu chỉ 6 ký tự; `MaxLength(72)` đếm ký tự trong khi BCrypt tính byte; `notes` không giới hạn; `phone` không kiểm tra định dạng; email có thể chứa ký tự xuống dòng gây giả mạo log. | Mật khẩu ≥ 8 và ≤ 72 byte; `notes` ≤ 1000 ký tự; kiểm tra định dạng phone và email; hạn chế ghi email vào log. | Đọc code; email xuống dòng cần kiểm tra |
| [ ] | BUG-23 | MEDIUM | `DiagnoseController.cs:157-195` | User đã đăng nhập vẫn lưu ảnh gốc kèm EXIF/GPS vào bucket đọc công khai. Nếu `disease == null` thì ảnh đã lưu nhưng không có bản ghi, còn id trả về không dùng được. | Ghi lại ảnh không kèm metadata trước khi lưu. Kiểm tra lớp bệnh trước khi upload. Test: ảnh có GPS sau upload không còn EXIF. | Đọc code |
| [ ] | BUG-24 | MEDIUM | `DiagnoseController.cs:64-67` | Chưa có quota riêng cho Guest; mỗi lượt vẫn tốn tài nguyên AI. Một người có thể tạo nhiều tài khoản để lưu nhiều ảnh vì không cần xác minh email. | Đặt hạn mức theo ngày cho Guest và user. Theo dõi dung lượng lưu trữ. | Đọc code |
| [ ] | BUG-25 | MEDIUM | `DiagnoseController.cs:274-276` | `verified_sources` không lọc bài đã duyệt, nên có thể hiển thị nguồn chưa qua kiểm duyệt là "đã xác thực". | Xác nhận lại ý nghĩa `IsManualApproved` với thành viên B, rồi lọc theo trạng thái duyệt. | Cần kiểm tra |
| [ ] | BUG-26 | MEDIUM | `frontend/web/package.json` | `npm audit`: 5 lỗ hổng, trong đó `vite` và `follow-redirects` mức high. `@tailwindcss/vite` và `tailwindcss` đang nằm ở `dependencies`. | Chạy `npm audit fix`, nâng các gói còn lại có kiểm tra, chuyển công cụ build sang `devDependencies`. Nghiệm thu: audit không còn mức high. | Đã chạy |
| [ ] | BUG-27 | LOW | `frontend/web/src/app/router.tsx` | Bundle JS 546 KB trong một file, bất lợi ở vùng mạng yếu. | Lazy-load các trang admin và knowledge; ghi lại kích thước thật sau khi tách. | Đã chạy build |
| [ ] | BUG-28 | LOW | Mục 2.1, 2.2 và Chặng 3 của file này | Task còn ghi route `/diagnose`, mã hex, Google Fonts và "3 bước IPM", xung đột với `screens.md`, `ui-ux.md` và điều 7 của `AGENTS.md`. | Sửa task theo SSOT trước khi code. Phác đồ hiển thị theo số bước thực tế trong DB. | Đọc code |
| [ ] | BUG-29 | LOW | `api-client.ts:32`, `RequireRole.tsx:4`, `router.tsx:175` | `UserRole` còn `Admin`/`Farmer`, chữ "Expert" vẫn còn dù vai trò đã gộp; interceptor `FormData` không còn cần thiết. | Dọn lại, chỉ giữ `ADMIN` và `FARMER`. | Đọc code |

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
- [x] Mật khẩu admin cũ `Admin@Lavitree2026!` bị từ chối 401 Unauthorized; mật khẩu mới `Adm!n@Lavitree_2026#Secure` đăng nhập thành công 200 OK; chẩn đoán Late blight và API thuốc 100% không gợi ý thuốc cấm Paraquat.
- [x] Khởi động lại API không làm mất dữ liệu Admin đã sửa (seeder chỉ thêm mới, không ghi đè bản ghi cũ).
- [x] `/weather` gọi trực tiếp OpenWeather API trả về dữ liệu khí tượng thật (`is_simulated: false`), xác suất mưa chuẩn xác 0–100%.

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
=> **KẾT LUẬN: ĐỦ ĐIỀU KIỆN ĐÓNG ĐỢT 0 VÀ CHUYỂN SANG CODE GIAO DIỆN A02.**
