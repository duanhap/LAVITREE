# TASK-03: KHỞI TẠO POSTGRESQL 15 CONTAINER & NẠP ĐẦY ĐỦ SEED DATA
* **Sprint**: Sprint 1 (Full-stack Pipeline)
* **Phân hệ**: `backend/core-api` & `database`
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên A (System & Backend Lead)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Mô tả ngắn**: Khởi tạo cơ sở dữ liệu PostgreSQL 15 cục bộ trong Docker (Port 5432) để đảm bảo hệ thống vận hành **100% Offline** khi báo cáo đồ án. Áp dụng 5 migrations có sẵn trong `Lavitree.Infrastructure/Migrations/` và nạp toàn bộ dữ liệu mẫu (Seed Data) cho 10 bảng.
- **Trọng tâm sửa đổi & thực thi**:
  - Không tạo thêm migration `InitialCreate` vì đã có sẵn 5 migrations trong repo.
  - Sử dụng lệnh `dotnet ef database update` để sinh cấu trúc 10 bảng trên container Postgres.
  - Tổ chức thư mục `backend/core-api/seed/`, sao chép `KnowledgeSources_rows.csv` và `Lavitree_Selected_Classes.csv` vào repo.
  - Bổ sung dữ liệu Seed cho `TreatmentPlans` (các bước IPM chuẩn) và `Products`/`DiseaseProducts` (thuốc đặc trị liên kết) để phục vụ Gate 3.
- **Tài liệu tham chiếu chuẩn duy nhất**:
  - Thiết kế database: `docs/architecture/database-schema.md` (10 bảng chuẩn hóa 3NF)

---

## 2. ĐẶC TẢ KỸ THUẬT (SPECIFICATIONS)
- **Danh sách file tác động**:
  - `Chỉnh sửa`: `docker-compose.yml` (đã bổ sung service `postgres` cổng 5432 & volume `postgres_data`)
  - `Thêm mới`: Thư mục `backend/core-api/seed/` chứa:
    - `Lavitree_Selected_Classes.csv` (38 lớp cây trồng)
    - `KnowledgeSources_rows.csv` (112 bài báo tri thức kiểm chứng)
    - `treatment_plans_seed.json` (hướng dẫn canh tác, hóa sinh, phục hồi IPM)
    - `products_seed.json` (danh mục thuốc BVTV được phép lưu hành tại VN)
  - `Chỉnh sửa`: `backend/core-api/src/Lavitree.Infrastructure/Persistence/LavitreeDbContextSeeder.cs` (nạp dữ liệu tự động)

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [ ] **Pha 1**: Khởi động container `postgres` qua Docker: `docker compose up -d postgres`.
- [ ] **Pha 2**: Chạy lệnh `dotnet ef database update --project src/Lavitree.Infrastructure --startup-project src/Lavitree.Api` để cập nhật schema 10 bảng.
- [ ] **Pha 3**: Tạo các file seed trong `backend/core-api/seed/` và chạy script nạp tự động vào PostgreSQL.
- [ ] **Pha 4**: Kiểm tra số lượng bản ghi bằng SQL query.

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [ ] Container `lavitree-postgres` chạy ổn định trên cổng 5432.
- [ ] Áp dụng đủ 5 migrations thành công không có lỗi.
- [ ] Truy vấn SQL `SELECT COUNT(*) FROM "Diseases"` trả về đủ 38 bản ghi.
- [ ] Truy vấn SQL `SELECT COUNT(*) FROM "KnowledgeSources"` trả về đủ 112 bản ghi.
- [ ] Bảng `TreatmentPlans` và `Products` có đầy đủ dữ liệu mẫu sẵn sàng cho endpoint `diagnose`.
- [ ] Bằng chứng kiểm thử (Receipts):
  ```bash
  # Dán stdout kiểm thử SQL query tại đây khi nghiệm thu
  ```

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)
- *Ghi nhận sau khi hoàn thành task.*
