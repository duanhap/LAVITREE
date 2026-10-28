# TASK-03: CẬP NHẬT CSDL & NẠP SEED DATA THEO NGUYÊN TẮC IDEMPOTENT (CHỐNG TRÙNG LẶP)
* **Sprint**: Sprint 1 (Full-stack Pipeline)
* **Phân hệ**: `backend/core-api` & `database`
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên A (System & Backend Lead)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Hiện trạng kiểm tra thực tế trên Supabase Cloud**:
  - `KnowledgeSources`: Đã có sẵn **đúng 112 bản ghi** (từ lượt import trước).
  - `PlantCategories`: Đang có **0 bản ghi**.
  - `Diseases`: Đang có **0 bản ghi**.
  - `TreatmentPlans` & `Products`: Đang có **0 bản ghi**.
  - Đã có 5 file migrations trong `Migrations/` (khởi tạo từ 10/10/2026).
- **Các nguy cơ kỹ thuật chí mạng cần ngăn chặn**:
  1. *Nguy cơ nhân đôi dữ liệu (112 $\rightarrow$ 224)*: Bảng `KnowledgeSources` không có ràng buộc Unique theo URL. Nếu script seed tự sinh `Guid.NewGuid()` và `INSERT` vô điều kiện, bảng sẽ bị nhân đôi thành 224 bài mà không hề báo lỗi.
  2. *Nguy cơ trùng lặp loài cây*: Bảng `PlantCategories` không có ràng buộc Unique theo tên, chạy lặp sẽ tạo 28 loài cây.
  3. *Nguy cơ lỗi migration*: Tuyệt đối **KHÔNG chạy lệnh `dotnet ef migrations add InitialCreate`** vì migration này đã có sẵn. Chỉ chạy `dotnet ef database update`.
  4. *Lỗ hổng Pass giả mạo trong `DiagnoseController.cs`*: Code API hiện tại chỉ lưu `DiagnosisRecord` khi tìm thấy `Disease` trong DB (`if (disease != null)`). Nếu bảng `Diseases` trống, API trả 200 OK nhưng không lưu bản ghi và IPM bị rỗng.
- **Nguyên tắc cốt lõi: Idempotent Seeding (Kế thừa bài học DAY10)**:
  - Script nạp dữ liệu phải đạt tính chất **Idempotent** (*chạy 1 lần hay chạy 10 lần liên tiếp thì kết quả trong DB vẫn giữ nguyên, không bao giờ bị nhân đôi*).
  - Dùng an toàn cho cả Supabase Cloud lẫn Docker Postgres cục bộ.

---

## 2. ĐẶC TẢ KỸ THUẬT (SPECIFICATIONS)
- **Danh sách file tác động**:
  - `Thư mục seed`: `backend/core-api/seed/` chứa:
    - `Lavitree_Selected_Classes.csv` (38 lớp cây trồng)
    - `KnowledgeSources_rows.csv` (112 bài báo tri thức kiểm chứng)
    - `sample_treatment_seed.json` (Dữ liệu mẫu 1-2 ca bệnh để thông luồng Sprint 1)
  - `Thêm mới / Chỉnh sửa`: `backend/core-api/src/Lavitree.Infrastructure/Persistence/LavitreeDbContextSeeder.cs`
- **Quy tắc Logic trong Seeder (Idempotent Rules)**:
  - `KnowledgeSources`: Kiểm tra `if (await context.KnowledgeSources.AnyAsync())` $\rightarrow$ Đã có 112 bản ghi thì **bỏ qua hoàn toàn**, không nạp lại.
  - `PlantCategories`: Kiểm tra theo `Name` $\rightarrow$ Nếu chưa có thì mới thêm (14 loài cây).
  - `Diseases`: Kiểm tra theo `ClassCode` $\rightarrow$ Nếu chưa có thì mới thêm (40 lớp từ CSV: gồm 38 lớp nhận diện AI + 2 lớp cẩm nang canh tác `Orange___healthy` & `Squash___healthy` để khớp 100% với `KnowledgeSources`).
  - `TreatmentPlans` & `Products`: Nạp ca mẫu đại diện `Tomato___Late_blight` (kèm thuốc Ridomil Gold, Trichoderma) để phục vụ thông luồng `DiagnoseController`.

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [ ] **Pha 1**: Kiểm tra số lượng bản ghi hiện có bằng câu lệnh SQL:
  ```sql
  SELECT 'plants', COUNT(*) FROM "PlantCategories"
  UNION ALL SELECT 'diseases', COUNT(*) FROM "Diseases"
  UNION ALL SELECT 'knowledge', COUNT(*) FROM "KnowledgeSources"
  UNION ALL SELECT 'treatments', COUNT(*) FROM "TreatmentPlans"
  UNION ALL SELECT 'products', COUNT(*) FROM "Products";
  ```
- [ ] **Pha 2**: Chạy lệnh `dotnet ef database update --project src/Lavitree.Infrastructure --startup-project src/Lavitree.Api` để đồng bộ cấu trúc 10 bảng (không tạo thêm migration mới).
- [ ] **Pha 3**: Cài đặt class `LavitreeDbContextSeeder.cs` với logic kiểm tra tồn tại (Idempotent) trước khi chèn bản ghi.
- [ ] **Pha 4**: Tích hợp gọi seeder trong `Program.cs` khi khởi động ứng dụng.
- [ ] **Pha 5**: Chạy kiểm thử seeder 2 lần liên tiếp để xác nhận số lượng bản ghi không đổi.

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [ ] Bảng `PlantCategories` có đúng **14 loài cây**.
- [ ] Bảng `Diseases` có đúng **40 lớp** (38 lớp nhận diện AI + 2 lớp cẩm nang canh tác `Orange___healthy` & `Squash___healthy` để không mồ côi 4 bài báo trong CSDL).
- [ ] Bảng `KnowledgeSources` giữ nguyên **đúng 112 bản ghi** (tuyệt đối không bị nhân đôi lên 224).
- [ ] Bảng `TreatmentPlans` và `Products` có dữ liệu mẫu của ca `Tomato___Late_blight` sẵn sàng cho `DiagnoseController` lưu `DiagnosisRecord`.
- [ ] **Tiêu chí Idempotent**: Chạy lại lệnh seed lần thứ 2 $\rightarrow$ Số lượng bản ghi trong các bảng không thay đổi 100%.
- [ ] Bằng chứng kiểm thử (Receipts):
  ```bash
  # Dán stdout kết quả kiểm tra SQL COUNT(*) sau 2 lần chạy seed
  ```
