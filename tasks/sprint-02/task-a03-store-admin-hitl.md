# TASK-A03: PHÂN HỆ CỬA HÀNG VẬT TƯ NÔNG NGHIỆP & CỔNG ADMIN QUẢN TRỊ TRI THỨC (HITL)
* **Sprint**: Sprint 2 (Song hành Tác tử Nông nghiệp & Hình thành Hệ thống Toàn diện)
* **Thứ tự thực hiện trong Sprint**: **Ưu tiên số 3 - Tuần 2 (P1 - Hoàn thiện trục nghiệp vụ mua sắm vật tư & kiểm duyệt tri thức)**
* **Phân hệ**: `frontend/web` & `backend/core-api`
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên A (System, Auth & Web Lead)
* **Độ ưu tiên**: P1 - Quan trọng nghiệp vụ
* **Tài liệu tham chiếu chuẩn**:
  - Đặc tả Nghiệp vụ: [docs/spec/features.md](../../docs/spec/features.md) (FEAT-03 Lavitree Store, FEAT-04 Cổng Admin & Chuyên gia)
  - Phân quyền: [docs/spec/roles-usecases.md](../../docs/spec/roles-usecases.md) (UC-04 Đặt thuốc COD, UC-05 Duyệt bài khuyến nông)
  - Kế hoạch Sprint 2: [docs/planning/sprint-02.md](../../docs/planning/sprint-02.md)

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Vấn đề cốt tử**:
  - Khi chẩn đoán ra bệnh, nông dân cần tiếp cận ngay nguồn vật tư thuốc BVTV chính hãng để điều trị. Nếu không có tính năng đặt hàng, chuỗi giá trị chẩn đoán sẽ bị đứt đoạn.
  - Về mặt tri thức RAG (Task 06 của Thành viên B), để tránh ảo giác thuốc cấm, mọi bài viết khuyến nông nạp vào hệ thống bắt buộc phải qua khâu kiểm duyệt của Bác sĩ Cây trồng / Admin (**Human-in-the-loop - HITL**). Cần có giao diện Admin để thực hiện việc bấm nút duyệt này.
- **Mục tiêu cụ thể của Task**:
  1. **Cửa hàng Vật tư Nông nghiệp (`StorePage.tsx`)**:
     - Hiển thị danh mục thuốc BVTV, chế phẩm sinh học từ CSDL (`Products`).
     - Bộ lọc thông minh: Lọc theo tên bệnh, loại sản phẩm (Sinh học / Hóa học), thời gian cách ly PHI ngắn ($\le 3$ ngày cho nông sản cận ngày thu hoạch).
     - Giỏ hàng cá nhân (Cart Drawer): Cho phép tăng/giảm số lượng, tính tổng tiền.
     - Đặt hàng với hình thức **COD giả lập** (Giao hàng thu tiền mặt - thanh toán chuẩn đồ án): Nông dân điền địa chỉ giao hàng, số điện thoại $\rightarrow$ Tạo đơn hàng (`POST /api/v1/orders`) với trạng thái `PENDING_CONFIRMATION`.
  2. **Cổng Admin Quản trị Tri thức & Chuyên gia (`AdminDashboard.tsx`)**:
     - *Duyệt bài Khuyến nông (HITL Ingestion)*: Xem danh sách bài viết từ `KnowledgeSources`, kiểm tra tên hoạt chất, liều lượng $\rightarrow$ Bấm nút `Duyệt bài` (`IsManualApproved = true`). Đây là trigger để pipeline của B băm chunk và nạp vào ChromaDB + BM25.
     - *Quản lý kho thuốc*: Xem danh mục thuốc, bật/tắt cờ lưu hành hợp pháp (`IsAllowed = true/false`), cập nhật số ngày cách ly `PhiDays`.
     - *Hỗ trợ Ca bệnh khó (Expert Escalation)*: Xem danh sách các ca bệnh nông dân gửi có độ bất định cao hoặc có yêu cầu chuyên gia, gắn nhãn `requires_expert = true` và ghi chú phác đồ điều trị cho nông dân.

---

## 2. ĐẶC TẢ KỸ THUẬT & API (SPECIFICATIONS)

### 2.1. API Đặt hàng Nông nghiệp:
- `POST /api/v1/orders`:
  - Request: `{ "items": [{ "product_id": "...", "quantity": 2 }], "shipping_address": "Xã Nghĩa Bình, Huyện Nghĩa Hưng, Nam Định", "phone_number": "0987654321", "payment_method": "COD" }`
  - Response: `201 Created` kèm `order_id`, tổng tiền, dự kiến giao hàng trong 2-3 ngày.

### 2.2. API Duyệt Tri thức (HITL):
- `PATCH /api/v1/knowledge/sources/{id}/approve`:
  - Yêu cầu Header: `Authorization: Bearer <Admin_JWT>`
  - Cập nhật `IsManualApproved = true`, ghi nhận `ReviewerNotes`.

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI 4 CHẶNG (SDLC 4 PHASES)

### Chặng 1: PLAN (Mô hình CSDL Đơn hàng & Giao diện)
- [ ] Thiết kế bảng `Orders` và `OrderItems` trong CSDL PostgreSQL, tạo migration EF Core.

### Chặng 2: COOK (Backend API & Giao diện Web)
- [ ] **Pha 1 (Order API)**: Xây dựng `OrdersController.cs` trong Core API hỗ trợ tạo đơn hàng COD và xem lịch sử đơn hàng của người dùng.
- [ ] **Pha 2 (Store UI)**: Xây dựng `StorePage.tsx`, thẻ sản phẩm, bộ lọc theo PHI, Drawer giỏ hàng và form đặt hàng COD.
- [ ] **Pha 3 (Admin API)**: Mở rộng `KnowledgeController.cs` hỗ trợ duyệt bài viết khuyến nông cho tài khoản Admin.
- [ ] **Pha 4 (Admin Dashboard UI)**: Xây dựng `AdminDashboard.tsx`, bảng kiểm duyệt tri thức HITL, bảng quản lý kho thuốc và danh sách ca bệnh cần chuyên gia.

### Chặng 3: VERIFY (Nghiệm thu Thực tế - Presence Gates)
- [ ] Thêm sản phẩm vào giỏ hàng $\rightarrow$ Đặt đơn COD $\rightarrow$ Đơn hàng lưu thành công trong CSDL với trạng thái `PENDING`.
- [ ] Đăng nhập tài khoản Admin $\rightarrow$ Bấm duyệt một bài viết khuyến nông $\rightarrow$ Giá trị `IsManualApproved` trong DB đổi thành `true`.
- [ ] Tài khoản nông dân (role `FARMER`) cố tình gọi API duyệt bài $\rightarrow$ Bị chặn với HTTP 403 Forbidden.

### Chặng 4: SHIP (Đóng gói & Chờ xác nhận Commit)
- [ ] Cập nhật trạng thái `TASK-A03` trong `tasks/TODO.md` sang `[x] DONE`.
- [ ] Ghi nhận kết quả vào `tasks/WORKLOG.md`.
- [ ] Báo cáo tóm tắt diff và chờ Lập trình viên xác nhận trước khi commit.
