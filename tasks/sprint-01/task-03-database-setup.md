# TASK-03: KHỞI TẠO POSTGRESQL 10 BẢNG CHUẨN HÓA 3NF & NẠP SEED DATA
* **Sprint**: Sprint 1 (Full-stack Pipeline)
* **Phân hệ**: `backend/core-api` & `database`
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên A (System & Backend Lead)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Mô tả ngắn**: Khởi tạo cơ sở dữ liệu PostgreSQL gồm 10 bảng chuẩn hóa 3NF khớp 100% với `LavitreeDbContext` và `docs/architecture/database-schema.md`. Nạp toàn bộ dữ liệu mẫu (Seed Data): 14 loài cây, 38 lớp bệnh cây, các bước hướng dẫn xử lý chuẩn IPM và 112 nguồn bài báo từ `KnowledgeSources_rows.csv`.
- **Tài liệu tham chiếu**:
  - Architecture: `docs/architecture/database-schema.md`
  - Dữ liệu: `KnowledgeSources_rows.csv` & `Lavitree_Selected_Classes.csv`

---

## 2. ĐẶC TẢ KỸ THUẬT (SPECIFICATIONS)
- **Danh sách file tác động**:
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.Infrastructure/Data/LavitreeDbContext.cs`
  - `Thêm mới`: Script SQL / Migrations `InitialCreate`
  - `Thêm mới`: Script Seeding dữ liệu tiếng Việt
- **10 Bảng quan hệ**: `PlantCategories`, `Diseases`, `TreatmentPlans`, `Products`, `DiseaseProducts`, `DiagnosisRecords`, `Orders`, `OrderItems`, `KnowledgeSources`, `Users`.

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [ ] **Pha 1**: Kiểm tra Docker Compose chạy dịch vụ PostgreSQL (cổng 5432).
- [ ] **Pha 2**: Chạy `dotnet ef migrations add InitialCreate` và `dotnet ef database update`.
- [ ] **Pha 3**: Viết script seed nạp 14 loài cây, 38 lớp bệnh, 112 bài báo tri thức kiểm chứng.

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [ ] 10 bảng dữ liệu được tạo thành công trên PostgreSQL.
- [ ] Truy vấn SQL `SELECT COUNT(*) FROM "Diseases"` trả về đủ 38 bản ghi.
- [ ] Truy vấn SQL `SELECT COUNT(*) FROM "KnowledgeSources"` trả về đủ 112 bản ghi.
- [ ] Bằng chứng kiểm thử (Receipts):
  ```bash
  # Dán stdout kiểm thử SQL query tại đây khi nghiệm thu
  ```

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)
- *Ghi nhận sau khi hoàn thành task.*
