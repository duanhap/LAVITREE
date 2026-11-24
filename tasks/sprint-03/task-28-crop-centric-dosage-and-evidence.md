# TASK-28: Phân cấp Quy tắc Liều lượng & Căn cứ Khoa học theo Cây trồng (Crop-Centric Rules & Evidence)
* **Sprint**: Sprint 3 (Nối tiếp và tinh gọn TASK-21, TASK-22, TASK-27)
* **Phân hệ**: `backend/core-api`, `frontend/web` (`AdminInventoryPage`, `ProductDetailPage`, `AdminProductDetailPage`), `docs/architecture`
* **Trạng thái**: `[x] DONE` (24/11/2026)
* **Nhánh Git**: `feat/task-28-crop-centric-rules`
* **Phụ thuộc**: TASK-21, TASK-22, TASK-27
* **Người phụ trách**: Developer & Antigravity Agent
* **Tạo ngày**: 24/11/2026

---

## 1. MỤC TIÊU & BỐI CẢNH NGHIỆP VỤ

### 1.1. Thực tế Nông nghiệp & Nỗi đau hiện tại
1. **Thực tế nhãn thuốc BVTV**:
   - Tất cả các hãng thuốc BVTV lớn (Syngenta, Bayer, Lộc Trời...) đều khuyến cáo liều lượng pha bình và lượng nước theo **Loài Cây trồng** (ví dụ: *Cây cà chua: pha 40–50g / bình 16L; Cây dưa hấu: pha 30g / bình 16L*).
   - Trên cùng 1 cây Cà chua, độ nhạy cảm của mô lá và kích thước tán là cố định. Do đó, các bệnh nấm phổ biến (mốc sương, đốm vòng, thán thư...) **dùng chung một liều pha bình giống hệt nhau**.
2. **Nỗi đau nhập liệu và giao diện hiện tại**:
   - Một cây như Cà chua có 8–10 bệnh. Hiện tại hệ thống đang phân mảnh theo từng bệnh con, bắt Admin khi gán gợi ý thuốc phải **nhập đi nhập lại 8–10 lần cùng một thông số liều lượng**.
   - Prompt Dev AI phải gánh yêu cầu tìm liều riêng cho từng bệnh con (vốn bài báo hoặc nhãn không chia chi tiết tới mức đó), dẫn đến prompt bị dài, cồng kềnh, dễ trả về null hoặc lý thuyết suông.
   - Trang chi tiết sản phẩm hiển thị các bệnh và bài báo căn cứ bị xé lẻ thành nhiều mục con rời rạc.

### 1.2. Mục tiêu cải tiến (Mô hình Phân cấp 2 Tầng)
- **Tầng 1 (Kế thừa Cây trồng - Mặc định)**: Thiết lập quy tắc liều lượng theo **Cây trồng** (Ví dụ: `Cà chua`: 50g / bình 16L, phun ướt đều tán lá). Tất cả các bệnh trên cây Cà chua tự động kế thừa liều này.
- **Tầng 2 (Ngoại lệ theo Bệnh - Tùy chọn)**: Chỉ khi nào có bệnh đặc thù (ví dụ: *Tưới gốc lở cổ rễ* thay vì *Phun lá*) thì mới thiết lập liều riêng ghi đè cho bệnh đó.
- **Tối ưu Prompt Dev AI**: Rút ngắn và tập trung tra cứu theo `Cây trồng + Thuốc`, cắt giảm 80% số lần Admin phải chạy AI khi gán các bệnh kế tiếp trên cùng một cây.
- **Gom nhóm Căn cứ & Bệnh theo Cây trồng**: Trình bày trực quan, khoa học trên cả trang Admin và Store Nông dân.

---

## 2. THIẾT KẾ CHI TIẾT

### 2.1. Backend Core API
- Thực thể `ProductUsageRule` (`Lavitree.Domain.Entities.ProductUsageRule`) đã hỗ trợ sẵn:
  - `PlantName`: Tên loài cây trồng (ví dụ `"Cà chua"`).
  - `DiseaseId`: Nullable (khi `DiseaseId == null`, rule áp dụng cho toàn bộ các bệnh trên cây `PlantName`).
- Mở rộng logic `UsageProfile.DiseaseRules` hoặc `ProductUsageRules`:
  - Cho phép lưu và tra cứu quy tắc theo cây trồng (`plant_rules` hoặc `disease_rules` có key là tên cây chuẩn hóa).
  - API `GET /api/v1/medicines/{id}` trả về thông tin liều theo cây trồng kèm danh sách bệnh kế thừa.

### 2.2. Modal Gán Gợi Ý Vật Tư (`AdminInventoryPage.tsx`)
- Khi Admin mở modal gán sản phẩm vào một bệnh mục tiêu (ví dụ: *Bệnh mốc sương / sương mai cà chua*):
  - Hệ thống tự động kiểm tra xem sản phẩm đã có quy tắc liều cho **Cây Cà chua** chưa.
  - **Trường hợp A (Đã có liều cây cà chua)**:
    - Hiển thị badge: `✓ Kế thừa liều dùng Cây Cà chua (50g / 16L)`.
    - Cho phép Admin **1-Click xác nhận liên kết ngay lập tức**.
    - **Không cần chạy Prompt Dev AI**, tiết kiệm thời gian tối đa.
  - **Trường hợp B (Chưa có liều cây cà chua)**:
    - Prompt Dev AI tinh gọn: *"Tra cứu liều dùng khuyến nông của thuốc {Tên Thuốc} trên cây {Cây Trồng}"*.
    - Prompt ngắn hơn 60%, loại bỏ các yêu cầu phân nhánh rườm rà.
    - Lưu liều này cho Cây Cà chua để các bệnh tiếp theo tự động dùng lại.

### 2.3. Trang Chi tiết Sản phẩm (`ProductDetailPage.tsx` & `AdminProductDetailPage.tsx`)
- **Tab Căn cứ khoa học**:
  - Gom nhóm cấp 1 theo **Cây trồng** (🍅 Cà chua, 🍇 Nho, 🌽 Ngô...).
  - Trong mỗi nhóm cây trồng, hiển thị các bài báo khuyến nông liên quan, kèm huy hiệu các bệnh đặc trị mà bài báo nhắc tới.
  - Giữ nguyên cơ chế **bôi vàng nổi bật** từ khóa thuốc/hoạt chất trong văn bản.
- **Tab Cây trồng & Bệnh đặc trị**:
  - Gom nhóm danh sách bệnh theo Cây trồng, hiển thị liều dùng của cây và các bệnh tương ứng dưới dạng thẻ cụm trực quan.

---

## 3. KẾ HOẠCH TRIỂN KHAI

| Bước | Phân hệ | Nội dung công việc |
|:---:|:---:|---|
| **1** | Git & Spec | Tạo nhánh `feat/task-28-crop-centric-rules` và hoàn thiện ticket `task-28` |
| **2** | Frontend Admin | Cải tiến Modal Gán gợi ý: Tự động kế thừa liều theo Cây trồng, tinh gọn Prompt Dev AI |
| **3** | Frontend Store | Cập nhật Tab Căn cứ khoa học và Tab Bệnh đặc trị gom nhóm theo Cây trồng |
| **4** | Testing & Audit | Chạy test suite `npm test`, `dotnet build`, kiểm thử tương tác thực tế và cập nhật `WORKLOG.md` |
