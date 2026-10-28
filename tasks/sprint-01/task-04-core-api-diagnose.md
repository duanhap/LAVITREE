# TASK-04: TÍCH HỢP MINIO STORAGE & HOÀN THIỆN CORE API (`Lavitree.Api`)
* **Sprint**: Sprint 1 (Full-stack Pipeline)
* **Phân hệ**: `backend/core-api`
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên A (System & Backend Lead)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Mô tả ngắn**: Rà soát và chỉnh sửa mã nguồn hiện có trong `backend/core-api/src/Lavitree.Api/Controllers/DiagnoseController.cs` và `Lavitree.Infrastructure/Services/AiVisionService.cs`.
- **Trọng tâm sửa đổi**:
  - Chuẩn hóa endpoint thành `POST /api/v1/diagnose` tuân thủ [Mục 3.1 trong api-contracts.md](../../docs/architecture/api-contracts.md#L62-L130). Nhận form field `image`, tùy chọn `userId` và `notes`.
  - Cài đặt thư viện `Minio` NuGet package để tải ảnh gốc và ảnh heatmap Grad-CAM lên bucket `lavitree-diagnoses`. Thiết lập bucket policy cho phép public-read.
  - Trả về URL ảnh MinIO có thể truy cập được từ trình duyệt/mobile client (dùng `Minio__PublicUrl=http://localhost:90   - **Bổ sung An toàn & Bảo mật Core API (Security Hardening Sprint 1)**:
    - *Khóa tạm các API Quản trị bằng `X-Admin-Key`*: Tạo ActionFilter / Attribute `[AdminApiKeyAuth]` kiểm tra header `X-Admin-Key: <ADMIN_SECRET_KEY>` từ `.env` cho các endpoint nhạy cảm của `KnowledgeController.cs` (`POST /api/v1/knowledge/sources`, `DELETE /api/v1/knowledge/sources/{id}`, `GET /api/v1/knowledge/export`).
      - **Nguyên tắc Fail-Closed**: Nếu biến môi trường `ADMIN_SECRET_KEY` bị thiếu hoặc rỗng, hệ thống **từ chối 100% request** (không được để `"" == ""` lọt qua).
      - **Chống Timing Attack**: So sánh chuỗi key bằng `CryptographicOperations.FixedTimeEquals` thay vì toán tử `==`.
      - **Sinh Secret Key An toàn**: `ADMIN_SECRET_KEY` trong `.env` phải là chuỗi ngẫu nhiên dài (ít nhất 32 ký tự ngẫu nhiên), không dùng chuỗi mặc định dễ đoán.
    - *Xử lý dữ liệu & Quyền riêng tư khi ảnh bị OOD (Out-of-Distribution Privacy Policy)*:
      - Khi `ai-service` trả về `is_ood = true`:
        - **Tuyệt đối KHÔNG tải ảnh lên MinIO** và **KHÔNG tạo bản ghi `DiagnosisRecords`** trong CSDL PostgreSQL.
        - Trả về ngay HTTP 200 với `is_ood: true`, `diagnosis_id: null`, `result: null`, `visual_evidence: null`, kèm thông báo hướng dẫn người dùng chụp lại ảnh lá cây rõ nét.
        - *Lý do*: Chống lãng phí dung lượng lưu trữ, không làm bẩn dữ liệu dịch tễ học và bảo vệ quyền riêng tư tuyệt đối (người dùng vô tình tải lên ảnh mặt người, tài liệu cá nhân, ảnh rác).
    - *Chống DDoS bằng Rate Limiting (Cấu hình linh hoạt qua biến môi trường)*:
      - Sử dụng `builder.Services.AddRateLimiter()` có sẵn trong .NET 8, cấu hình Fixed Window cho endpoint `/api/v1/diagnose`.
      - Ngưỡng giới hạn đọc từ biến môi trường `RATE_LIMIT_PER_MINUTE` (mặc định 60 requests/phút hoặc có thể cấu hình nới lỏng/bỏ qua khi chạy môi trường dev/kiểm thử nội bộ).
    - *Bảo mật Object Storage (MinIO Policy & Cổng quản trị)*:
      - Cấu hình bucket `lavitree-diagnoses`: chỉ cấp quyền `s3:GetObject` ẩn danh cho các tệp có GUID ngẫu nhiên, **tuyệt đối không cấp quyền `s3:ListBucket`** để ngăn chặn việc kẻ xấu quét và tải về toàn bộ kho ảnh của nông dân.
      - **Thay đổi mật khẩu MinIO mới trong `.env`**: Do mật khẩu cũ `miniopassword123` đã bị lộ trong lịch sử git (commit `317aaa4`), Thành viên A bắt buộc phải đặt mật khẩu gốc mới hoàn toàn mạnh hơn trong `.env` (ví dụ `MINIO_ROOT_PASSWORD`), không được copy nguyên giá trị cũ.
      - **Khóa cổng Web Console MinIO**: Trong `docker-compose.yml`, cổng web console quản trị MinIO 9001 phải bind nội bộ `127.0.0.1:9001:9001` (chỉ cho phép dev truy cập trực tiếp trên máy host, không lộ ra ngoài mạng LAN/Internet). Cổng 9000 giữ nguyên `9000:9000` để client tải ảnh qua HTTP.
    - *Giới hạn kích thước & Định dạng file upload*:
      - Thêm `[RequestSizeLimit(10 * 1024 * 1024)]` (10MB).
      - Quy định rõ mã lỗi: Trả về **HTTP 400 Bad Request** nếu file vượt quá 10MB hoặc đuôi tệp không hợp lệ; trả về **HTTP 422 Unprocessable Entity** nếu dữ liệu byte bị hỏng hoặc lỗi giải mã ảnh.
    - *Siết chặt CORS Policy*: Đổi từ `AllowAll` sang danh sách domain frontend tin cậy (`http://localhost:3000`, `http://localhost:5173`), không mở wildcard cho mọi website bên ngoài.
    - *Quản lý duy nhất `docker-compose.yml` & Dọn dẹp cấu hình*:
      - Thành viên A chịu trách nhiệm cấu hình `docker-compose.yml`:
        - AI Service: `127.0.0.1:8000:8000`
        - Agent Service: `127.0.0.1:8001:8001`
        - MinIO Console: `127.0.0.1:9001:9001`
        - MinIO Data: `9000:9000`
      - Chuyển toàn bộ mật khẩu MinIO và chuỗi kết nối Supabase trong `appsettings.json` sang nạp từ biến môi trường (`.env`).
- **Tài liệu tham chiếu chuẩn duy nhất (SSOT)**:
  - Hợp đồng API: [docs/architecture/api-contracts.md Mục 3.1](../../docs/architecture/api-contracts.md#L62-L130)
  - Ma trận phân quyền: [docs/spec/roles-usecases.md](../../docs/spec/roles-usecases.md)

---

## 2. ĐẶC TẢ KỸ THUẬT (SPECIFICATIONS)
- **Danh sách file tác động**:
  - `Thêm mới`: `backend/core-api/src/Lavitree.Infrastructure/Services/MinioStorageService.cs`
  - `Thêm mới`: `backend/core-api/src/Lavitree.Api/Filters/AdminApiKeyAuthAttribute.cs` (kiểm tra header `X-Admin-Key` chuẩn Fail-closed & FixedTimeEquals)
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.Infrastructure/Services/AiVisionService.cs` (gọi đúng `POST /api/v1/predict` của `ai-service`)
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.Application/DTOs/DiagnosisDtos.cs` (cập nhật DTO `AiPredictionResponse` và `DiagnosisResultDto` khớp với `api-contracts.md` Mục 3.1, bao gồm trường hợp `is_ood = true`)
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.Api/Controllers/DiagnoseController.cs` (đổi route thành `POST /api/v1/diagnose`, nhận trường `image`, xử lý OOD không lưu ảnh/DB, gọi MinIO khi hợp lệ, thêm `[RequestSizeLimit]` và rate limiting)
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.Api/Controllers/KnowledgeController.cs` (gắn attribute `[AdminApiKeyAuth]` lên các endpoint `POST`, `DELETE`, `GET export`)
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.Api/Program.cs` (cấu hình RateLimiter đọc từ env, siết chặt CORS policy)
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.Api/appsettings.json` (bổ sung cấu hình `Minio`, bỏ credential hardcode)
  - `Chỉnh sửa`: `docker-compose.yml` (bind `127.0.0.1` cho AI service 8000, Agent 8001 và MinIO console 9001; đưa biến MinIO vào `.env`)
- **Hợp đồng dữ liệu (API Contract SSOT)**:
  - Cấu trúc Request/Response tuân thủ duy nhất theo [Mục 3.1 trong docs/architecture/api-contracts.md](../../docs/architecture/api-contracts.md#L62-L130). Không tự định nghĩa cấu trúc dữ liệu riêng lẻ.

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [ ] **Pha 1**: Cài đặt package `Minio` vào `Lavitree.Infrastructure.csproj`. Cài đặt `MinioStorageService` khởi tạo bucket với policy chỉ cho `s3:GetObject` ẩn danh theo tên file GUID.
- [ ] **Pha 2**: Chỉnh sửa `AiVisionService.cs` gọi endpoint chuẩn `/api/v1/predict?include_heatmap=true` của `ai-service`.
- [ ] **Pha 3**: Cập nhật `DiagnoseController.cs` nhận file `image`:
  - Gọi AI Service trước. Nếu `is_ood = true`, trả về response OOD ngay lập tức, bỏ qua lưu MinIO và bỏ qua ghi CSDL `DiagnosisRecords`.
  - Nếu `is_ood = false`, lưu ảnh gốc vào MinIO, lưu ảnh heatmap vào MinIO, truy vấn `TreatmentPlans` & `Products` từ PostgreSQL và lưu bản ghi `DiagnosisRecords`.
- [ ] **Pha 4**: Viết `AdminApiKeyAuthAttribute.cs` (Fail-closed, `FixedTimeEquals`, key ngẫu nhiên an toàn), gắn vào `KnowledgeController.cs`; cấu hình RateLimiter và CORS trong `Program.cs`; dọn dẹp `appsettings.json`, đổi mật khẩu MinIO mới và cập nhật `docker-compose.yml` (bind `127.0.0.1` cho port 8000, 8001, 9001).
- [ ] **Pha 5**: Chạy kiểm thử cURL toàn trình:
  - Test ảnh lá bệnh mẫu `Tomato___Late_blight` (đảm bảo hiển thị đầy đủ IPM và sản phẩm đã seed, lưu ảnh MinIO và CSDL thành công).
  - Test ảnh OOD (ảnh bàn tay hoặc đồ vật): xác nhận trả về `is_ood: true`, không sinh rác trên MinIO và không thêm bản ghi trong CSDL.
  - Đo lường thời gian phản hồi ($\le 1.5$s) và kiểm tra bảo mật (gọi `POST /api/v1/knowledge/sources` không có `X-Admin-Key` bị chặn 401; file giả mạo/vượt giới hạn bị trả đúng mã lỗi 400/422).

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [ ] Endpoint `POST /api/v1/diagnose` trả về HTTP 200 OK với cấu trúc JSON khớp 100% `api-contracts.md` Mục 3.1 khi test bằng ảnh `Tomato___Late_blight` (có đủ IPM và thuốc).
- [ ] Khi gửi ảnh không phải lá cây (OOD): API trả về HTTP 200 với `is_ood: true`, `diagnosis_id: null`, không lưu ảnh vào MinIO và không tạo dòng mới trong bảng `DiagnosisRecords`.
- [ ] Trình duyệt truy cập trực tiếp được link ảnh gốc và ảnh heatmap qua URL `http://localhost:9000/lavitree-diagnoses/{guid}.jpg`, nhưng truy cập URL bucket gốc `http://localhost:9000/lavitree-diagnoses/` bị từ chối (chặn `s3:ListBucket`).
- [ ] Thời gian toàn luồng E2E đạt $\le 1.5$ giây.
- [ ] Bảo mật: Request `POST/DELETE` vào `KnowledgeController` không có `X-Admin-Key` hợp lệ bị từ chối 401 Unauthorized; nếu `.env` thiếu key thì từ chối tất cả (Fail-closed).
- [ ] Bảo mật: Mật khẩu MinIO và `ADMIN_SECRET_KEY` trong `.env` là chuỗi mới an toàn, không sử dụng lại chuỗi lộ `miniopassword123`.
- [ ] Hạ tầng: `docker-compose.yml` ánh xạ cổng AI Service (`127.0.0.1:8000:8000`), Agent Service (`127.0.0.1:8001:8001`), và MinIO Console (`127.0.0.1:9001:9001`). Cổng tải ảnh MinIO `9000:9000` mở công khai cho client.
- [ ] Lỗi request: File vượt quá 10MB hoặc sai định dạng trả về 400 Bad Request; file lỗi dữ liệu/ảnh hỏng trả về 422 Unprocessable Entity.

- [ ] Bằng chứng kiểm thử (Receipts):
  ```bash
  # Dán stdout kiểm thử cURL tại đây khi nghiệm thu
  ```

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)
- *Ghi nhận sau khi hoàn thành task.*
