# TASK-03: KHỞI TẠO POSTGRESQL 15 CONTAINER & NẠP ĐẦY ĐỦ SEED DATA
* **Sprint**: Sprint 1 (Full-stack Pipeline)
* **Phân hệ**: `backend/core-api` & `database`
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên A (System & Backend Lead)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Mô tả ngắn**: Cập nhật cấu trúc 10 bảng dữ liệu trên Supabase Cloud (hoặc PostgreSQL cục bộ) bằng 5 migrations có sẵn trong `Lavitree.Infrastructure/Migrations/`. Nạp dữ liệu danh mục cốt lõi và **1–2 bản ghi mẫu đại diện** cho phác đồ IPM & thuốc BVTV nhằm thông luồng kỹ thuật cho endpoint `POST /api/v1/diagnose` ở Gate 3.
- **Trọng tâm sửa đổi & thực thi (Đơn giản hóa, không làm quá tải)**:
  - Sử dụng lệnh `dotnet ef database update` để sinh cấu trúc 10 bảng (đã có sẵn 5 migrations trong repo).
  - Nạp 14 loài cây mục tiêu (`PlantCategories`) và 38 lớp (`Diseases`) từ `Lavitree_Selected_Classes.csv`.
  - Nạp 112 bài báo tri thức kiểm chứng vào bảng `KnowledgeSources` từ `KnowledgeSources_rows.csv`.
  - **Về phác đồ điều trị (`TreatmentPlans`) và kho thuốc (`Products`)**:
    - **Trong Sprint 1 chỉ cần nạp 1–2 ca bệnh mẫu đại diện** (ví dụ: ca *Mốc sương cà chua* `Tomato___Late_blight` với 3 bước IPM và 2 loại thuốc mẫu: Ridomil Gold, Chế phẩm sinh học Trichoderma).
    - **Tuyệt đối không yêu cầu soạn tay toàn bộ 38 lớp ở Sprint 1**: Toàn bộ dữ liệu tri thức đầy đủ sẽ được nạp thông qua cơ chế *Human-in-the-loop AI Ingestion* (AI trích xuất từ bài viết $\rightarrow$ Bác sĩ kiểm duyệt $\rightarrow$ Lưu kép DB & Vector DB) ở Sprint 2 & 3.
- **Tài liệu tham chiếu chuẩn duy nhất**:
  - Thiết kế database: `docs/architecture/database-schema.md` (10 bảng chuẩn hóa 3NF)

---

## 2. ĐẶC TẢ KỸ THUẬT (SPECIFICATIONS)
- **Danh sách file tác động**:
  - `Thư mục seed`: `backend/core-api/seed/` chứa:
    - `Lavitree_Selected_Classes.csv` (38 lớp cây trồng)
    - `KnowledgeSources_rows.csv` (112 bài báo tri thức kiểm chứng)
    - `sample_treatment_seed.json` (Dữ liệu mẫu đại diện 1-2 ca bệnh để thông luồng Sprint 1)
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.Infrastructure/Persistence/LavitreeDbContextSeeder.cs` (nạp dữ liệu ban đầu)

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [ ] **Pha 1**: Cấu hình chuỗi kết nối tới Supabase Cloud (hoặc container Postgres cục bộ nếu chạy offline).
- [ ] **Pha 2**: Chạy lệnh `dotnet ef database update --project src/Lavitree.Infrastructure --startup-project src/Lavitree.Api` để cập nhật schema 10 bảng.
- [ ] **Pha 3**: Nạp 38 lớp `Diseases`, 112 bản ghi `KnowledgeSources` và 1–2 ca mẫu `TreatmentPlans` & `Products`.
- [ ] **Pha 4**: Kiểm tra số lượng bản ghi bằng SQL query.

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [ ] Áp dụng đủ 5 migrations thành công không có lỗi, 10 bảng được tạo đầy đủ trên CSDL.
- [ ] Truy vấn SQL `SELECT COUNT(*) FROM "Diseases"` trả về đủ 38 bản ghi.
- [ ] Truy vấn SQL `SELECT COUNT(*) FROM "KnowledgeSources"` trả về đủ 112 bản ghi.
- [ ] Bảng `TreatmentPlans` và `Products` có sẵn dữ liệu mẫu của ca `Tomato___Late_blight` sẵn sàng cho endpoint `POST /api/v1/diagnose` trả về kết quả 200 OK.
- [ ] Bằng chứng kiểm thử (Receipts):
  ```bash
  # Dán stdout kiểm thử SQL query tại đây khi nghiệm thu
  ```

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)
- *Ghi nhận sau khi hoàn thành task.*
