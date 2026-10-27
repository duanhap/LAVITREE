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
  - Chuẩn hóa endpoint thành `POST /api/v1/diagnose` tuân thủ [Mục 3.1 trong api-contracts.md](file:///d:/PTIT%20Do%20An/LAVITREE/docs/architecture/api-contracts.md#L62-L130). Nhận form field `image`, tùy chọn `userId` và `notes`.
  - Cài đặt thư viện `Minio` NuGet package để tải ảnh gốc và ảnh heatmap Grad-CAM lên bucket `lavitree-diagnoses`. Thiết lập bucket policy cho phép public-read.
  - Trả về URL ảnh MinIO có thể truy cập được từ trình duyệt/mobile client (dùng `Minio__PublicUrl=http://localhost:9000` thay vì tên host nội bộ Docker `minio:9000`).
  - Đảm bảo toàn bộ luồng chẩn đoán E2E hoàn thành trong **$\le 1.5$ giây**.
- **Tài liệu tham chiếu chuẩn duy nhất (SSOT)**:
  - Hợp đồng API: [docs/architecture/api-contracts.md Mục 3.1](file:///d:/PTIT%20Do%20An/LAVITREE/docs/architecture/api-contracts.md#L62-L130)

---

## 2. ĐẶC TẢ KỸ THUẬT (SPECIFICATIONS)
- **Danh sách file tác động**:
  - `Thêm mới`: `backend/core-api/src/Lavitree.Infrastructure/Services/MinioStorageService.cs`
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.Infrastructure/Services/AiVisionService.cs` (gọi đúng `POST /api/v1/predict` của `ai-service`)
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.Application/DTOs/DiagnosisDtos.cs` (cập nhật DTO `AiPredictionResponse` và `DiagnosisResultDto` khớp với `api-contracts.md`)
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.Api/Controllers/DiagnoseController.cs` (đổi route thành `POST /api/v1/diagnose`, nhận trường `image`, gọi MinIO)
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.Api/appsettings.json` (bổ sung cấu hình `Minio`)
- **Hợp đồng dữ liệu (API Contract SSOT)**:
  - Cấu trúc Request/Response tuân thủ duy nhất theo [Mục 3.1 trong docs/architecture/api-contracts.md](file:///d:/PTIT%20Do%20An/LAVITREE/docs/architecture/api-contracts.md#L62-L130). Không tự định nghĩa cấu trúc dữ liệu riêng lẻ.

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [ ] **Pha 1**: Cài đặt package `Minio` vào `Lavitree.Infrastructure.csproj`. Cài đặt `MinioStorageService` thực hiện khởi tạo bucket và upload ảnh.
- [ ] **Pha 2**: Chỉnh sửa `AiVisionService.cs` gọi endpoint chuẩn `/api/v1/predict?include_heatmap=true` của `ai-service`.
- [ ] **Pha 3**: Cập nhật `DiagnoseController.cs` nhận file `image`, lưu ảnh gốc vào MinIO, gọi AI Service, lưu ảnh Grad-CAM vào MinIO, truy vấn `TreatmentPlans` & `Products` từ PostgreSQL và lưu bản ghi `DiagnosisRecords`.
- [ ] **Pha 4**: Chạy kiểm thử cURL toàn trình đo lường thời gian phản hồi ($\le 1.5$s).

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [ ] Endpoint `POST /api/v1/diagnose` trả về HTTP 200 OK với cấu trúc JSON khớp 100% `api-contracts.md` Mục 3.1.
- [ ] Trình duyệt truy cập được link ảnh gốc và ảnh heatmap qua URL `http://localhost:9000/lavitree-diagnoses/...`.
- [ ] Thời gian toàn luồng E2E đạt $\le 1.5$ giây.
- [ ] Bằng chứng kiểm thử (Receipts):
  ```bash
  # Dán stdout kiểm thử cURL tại đây khi nghiệm thu
  ```

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)
- *Ghi nhận sau khi hoàn thành task.*
