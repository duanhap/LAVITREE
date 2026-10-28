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
  - Trả về URL ảnh MinIO có thể truy cập được từ trình duyệt/mobile client (dùng `Minio__PublicUrl=http://localhost:9000` thay vì tên host nội bộ Docker `minio:9000`).
  - Đảm bảo toàn bộ luồng chẩn đoán E2E hoàn thành trong **$\le 1.5$ giây**.
  - **Bổ sung An toàn & Bảo mật Core API (Security Hardening Sprint 1)**:
    - *Khóa tạm các API Quản trị bằng `X-Admin-Key`*: Tạo ActionFilter / Attribute `[AdminApiKeyAuth]` kiểm tra header `X-Admin-Key: <ADMIN_SECRET_KEY>` từ `.env` cho các endpoint nhạy cảm của `KnowledgeController.cs` (`POST /api/v1/knowledge/sources`, `DELETE /api/v1/knowledge/sources/{id}`, `GET /api/v1/knowledge/export`), ngăn chặn việc xóa hoặc làm bẩn 112 tài liệu tri thức trên Supabase khi chưa có JWT.
    - *Giới hạn kích thước file upload*: Thêm `[RequestSizeLimit(10 * 1024 * 1024)]` (10MB) vào endpoint chẩn đoán để chống tấn công làm cạn kiệt tài nguyên.
    - *Siết chặt CORS Policy*: Đổi từ `AllowAll` sang danh sách domain frontend tin cậy (`http://localhost:3000`, `http://localhost:5173`), không mở wildcard cho mọi website bên ngoài.
    - *Làm sạch cấu hình*: Chuyển chuỗi kết nối Supabase và mật khẩu trong `appsettings.json` sang nạp từ biến môi trường (`.env`), tránh lộ thông tin máy chủ trên Git.
- **Tài liệu tham chiếu chuẩn duy nhất (SSOT)**:
  - Hợp đồng API: [docs/architecture/api-contracts.md Mục 3.1](../../docs/architecture/api-contracts.md#L62-L130)
  - Ma trận phân quyền: [docs/spec/roles-usecases.md](../../docs/spec/roles-usecases.md)


---

## 2. ĐẶC TẢ KỸ THUẬT (SPECIFICATIONS)
- **Danh sách file tác động**:
  - `Thêm mới`: `backend/core-api/src/Lavitree.Infrastructure/Services/MinioStorageService.cs`
  - `Thêm mới`: `backend/core-api/src/Lavitree.Api/Filters/AdminApiKeyAuthAttribute.cs` (kiểm tra header `X-Admin-Key`)
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.Infrastructure/Services/AiVisionService.cs` (gọi đúng `POST /api/v1/predict` của `ai-service`)
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.Application/DTOs/DiagnosisDtos.cs` (cập nhật DTO `AiPredictionResponse` và `DiagnosisResultDto` khớp với `api-contracts.md`)
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.Api/Controllers/DiagnoseController.cs` (đổi route thành `POST /api/v1/diagnose`, nhận trường `image`, gọi MinIO, thêm `[RequestSizeLimit]`)
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.Api/Controllers/KnowledgeController.cs` (gắn attribute `[AdminApiKeyAuth]` lên các endpoint `POST`, `DELETE`, `GET export`)
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.Api/Program.cs` (siết chặt CORS policy)
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.Api/appsettings.json` (bổ sung cấu hình `Minio`, bỏ credential hardcode)
- **Hợp đồng dữ liệu (API Contract SSOT)**:
  - Cấu trúc Request/Response tuân thủ duy nhất theo [Mục 3.1 trong docs/architecture/api-contracts.md](../../docs/architecture/api-contracts.md#L62-L130). Không tự định nghĩa cấu trúc dữ liệu riêng lẻ.


---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [ ] **Pha 1**: Cài đặt package `Minio` vào `Lavitree.Infrastructure.csproj`. Cài đặt `MinioStorageService` thực hiện khởi tạo bucket và upload ảnh.
- [ ] **Pha 2**: Chỉnh sửa `AiVisionService.cs` gọi endpoint chuẩn `/api/v1/predict?include_heatmap=true` của `ai-service`.
- [ ] **Pha 3**: Cập nhật `DiagnoseController.cs` nhận file `image`, lưu ảnh gốc vào MinIO, gọi AI Service, lưu ảnh Grad-CAM vào MinIO, truy vấn `TreatmentPlans` & `Products` từ PostgreSQL và lưu bản ghi `DiagnosisRecords`.
- [ ] **Pha 4**: Viết `AdminApiKeyAuthAttribute.cs`, gắn vào `KnowledgeController.cs`; cấu hình lại CORS trong `Program.cs` và dọn dẹp `appsettings.json`.
- [ ] **Pha 5**: Chạy kiểm thử cURL toàn trình đo lường thời gian phản hồi ($\le 1.5$s) và kiểm tra bảo mật (gọi `POST /api/v1/knowledge/sources` không có `X-Admin-Key` bị chặn 401).

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [ ] Endpoint `POST /api/v1/diagnose` trả về HTTP 200 OK với cấu trúc JSON khớp 100% `api-contracts.md` Mục 3.1.
- [ ] Trình duyệt truy cập được link ảnh gốc và ảnh heatmap qua URL `http://localhost:9000/lavitree-diagnoses/...`.
- [ ] Thời gian toàn luồng E2E đạt $\le 1.5$ giây.
- [ ] Bảo mật: Request `POST/DELETE` vào `KnowledgeController` không có `X-Admin-Key` hợp lệ bị từ chối 401 Unauthorized.
- [ ] Bảo mật: File tải lên vượt quá 10MB bị từ chối; CORS chỉ chấp thuận domain frontend được cấu hình.

- [ ] Bằng chứng kiểm thử (Receipts):
  ```bash
  # Dán stdout kiểm thử cURL tại đây khi nghiệm thu
  ```

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)
- *Ghi nhận sau khi hoàn thành task.*
