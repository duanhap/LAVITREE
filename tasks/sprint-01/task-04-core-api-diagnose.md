# TASK-04: XÂY DỰNG CORE API (.NET 8) & TÍCH HỢP MINIO STORAGE
* **Sprint**: Sprint 1 (Full-stack Pipeline)
* **Phân hệ**: `backend/core-api`
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên A (System & Backend Lead)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Mô tả ngắn**: Cấu hình MinIO S3 Client (`AWSSDK.S3`) để tự động khởi tạo bucket `lavitree-diagnoses`. Xây dựng endpoint toàn trình `POST /api/v1/diagnose` tiếp nhận ảnh từ Client $\rightarrow$ tải ảnh lên MinIO $\rightarrow$ gọi `ai-service:8000` $\rightarrow$ giải mã lưu ảnh Grad-CAM vào MinIO $\rightarrow$ truy vấn hướng dẫn IPM và thuốc từ PostgreSQL $\rightarrow$ ghi bản ghi `DiagnosisRecord` $\rightarrow$ trả kết quả trọn gói 1 request.
- **Tài liệu tham chiếu**:
  - Architecture: `docs/architecture/system-design.md` (Mục 2)
  - Architecture: `docs/architecture/api-contracts.md` (Mục 3.1)

---

## 2. ĐẶC TẢ KỸ THUẬT (SPECIFICATIONS)
- **Danh sách file tác động**:
  - `Thêm mới`: `backend/core-api/src/Lavitree.Infrastructure/Services/MinioStorageService.cs`
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.API/Controllers/DiagnoseController.cs`
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.API/appsettings.json` (cấu hình MinIO endpoint, access key, secret key)
- **Hợp đồng dữ liệu (API Contract)**:
  - Khớp 100% với mục 3.1 trong `docs/architecture/api-contracts.md`.

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [ ] **Pha 1**: Cấu hình MinIO S3 Client trong `core-api`, kiểm tra kết nối và tạo bucket nếu chưa có.
- [ ] **Pha 2**: Viết HttpClient gọi `ai-service:8000/api/v1/predict?include_heatmap=true`.
- [ ] **Pha 3**: Lưu ảnh lá và ảnh heatmap vào MinIO, lấy public URL.
- [ ] **Pha 4**: Hoàn thiện `DiagnoseController.cs` kết nối PostgreSQL và MinIO.

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [ ] Gửi ảnh lá qua `POST /api/v1/diagnose` trả về HTTP 200 OK trong $< 1.5$s.
- [ ] MinIO chứa đủ 2 file: ảnh lá gốc và ảnh heatmap Grad-CAM.
- [ ] Database có bản ghi mới trong bảng `DiagnosisRecords`.
- [ ] Bằng chứng kiểm thử (Receipts):
  ```bash
  # Dán stdout kiểm thử cURL tại đây khi nghiệm thu
  ```

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)
- *Ghi nhận sau khi hoàn thành task.*
