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
     - *Thêm Nguồn Tri thức Mới (Create Source Form)*: Cho phép Admin nhập bài viết mới kèm `ModelClass`, `SourceUrl`, `EvidenceText`, `ContentType` (gọi `POST /api/v1/knowledge/sources` có sẵn từ Sprint 1). Dùng để bổ sung bài cho các ca bệnh còn mỏng như `Tomato___Target_Spot` và `Corn_(maize)___Common_rust_` trực tiếp trên Web.
     - *Duyệt bài Khuyến nông (HITL Ingestion - Đơn lẻ & Hàng loạt)*: Xem danh sách bài viết từ `KnowledgeSources` (bộ lọc Chưa duyệt / Đã duyệt / ModelClass), kiểm tra nội dung $\rightarrow$ Bấm nút `Duyệt bài` từng bài hoặc checkbox chọn nhiều bài bấm **`Duyệt hàng loạt (Bulk Approve)`** (`IsManualApproved = true`). Đây là trigger để pipeline của B băm chunk và nạp vào ChromaDB + BM25 qua webhook `/internal/reindex`.
     - *Quản lý kho thuốc*: Xem danh mục thuốc, bật/tắt cờ lưu hành hợp pháp (`IsAllowed = true/false`), cập nhật số ngày cách ly `PhiDays`.
     - *Hỗ trợ Ca bệnh khó (Expert Escalation)*: Xem danh sách các ca bệnh nông dân gửi có độ bất định cao hoặc có yêu cầu chuyên gia, gắn nhãn `requires_expert = true` và ghi chú phác đồ điều trị cho nông dân.

---

## 2. ĐẶC TẢ KỸ THUẬT & API (SPECIFICATIONS)

### 2.1. API Đặt hàng Nông nghiệp:
- `POST /api/v1/orders`:
  - Request: `{ "items": [{ "product_id": 1, "quantity": 2 }], "shipping_address": "Xã Nghĩa Bình, Huyện Nghĩa Hưng, Nam Định", "phone_number": "0987654321", "payment_method": "COD" }`
  - Response: `201 Created` kèm `order_id`, tổng tiền, dự kiến giao hàng trong 2-3 ngày.
  - **Bảo mật & Toàn vẹn**: Core API **tự truy vấn giá từ bảng Products trong DB**, kiểm tra `IsAllowed == true` và trừ tồn kho; tuyệt đối không tin giá tiền gửi từ client hay `draft_order` của Agent.

### 2.2. API Duyệt Tri thức (HITL - Đơn lẻ & Hàng loạt):
- `PATCH /api/v1/knowledge/sources/{id}/approve` (Duyệt từng bài):
  - Yêu cầu Header: `Authorization: Bearer <Admin_JWT>`
  - Request: `{ "is_approved": true, "reviewer_notes": "Đã đối chiếu hoạt chất hợp lệ theo Thông tư Cục BVTV" }`
  - Response: `200 OK`
  - **Đồng bộ RAG**: Tự động gọi webhook nội bộ `POST http://agent-service:8001/internal/reindex`.
- `PATCH /api/v1/knowledge/sources/approve-batch` (Duyệt hàng loạt - Bulk Approve):
  - Request: `{ "source_ids": ["uuid-1", "uuid-2"], "is_approved": true, "reviewer_notes": "Duyệt hàng loạt 5 bệnh demo" }`
  - Response: `200 OK` `{ "approved_count": 2, "status": "success" }`
  - **Đồng bộ RAG**: Tự động gọi webhook `/internal/reindex` đồng bộ toàn bộ bài viết mới duyệt.

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI 4 CHẶNG (SDLC 4 PHASES)

### Chặng 1: PLAN (Mô hình CSDL Đơn hàng & Giao diện)
- [ ] Thiết kế bảng `Orders` và `OrderItems` trong CSDL PostgreSQL, tạo migration EF Core.

### Chặng 2: COOK (Backend API & Giao diện Web)
- [ ] **Pha 1 (Order API)**: Xây dựng `OrdersController.cs` trong Core API hỗ trợ tạo đơn hàng COD và xem lịch sử đơn hàng của người dùng.
- [ ] **Pha 2 (Store UI)**: Xây dựng `StorePage.tsx`, thẻ sản phẩm, bộ lọc theo PHI, Drawer giỏ hàng và form đặt hàng COD.
- [ ] **Pha 3 (Admin API)**: Mở rộng `KnowledgeController.cs` hỗ trợ duyệt bài viết khuyến nông đơn lẻ (`PATCH /sources/{id}/approve`) và duyệt hàng loạt (`PATCH /sources/approve-batch`) cho tài khoản Admin, tích hợp trigger webhook `/internal/reindex`.
- [ ] **Pha 4 (Admin Dashboard UI)**: Xây dựng `AdminDashboard.tsx` gồm: Form thêm bài viết tri thức mới, bảng kiểm duyệt tri thức HITL (bộ lọc trạng thái duyệt, checkbox chọn nhiều bài, nút Duyệt đơn lẻ & Duyệt hàng loạt kích hoạt reindex), bảng quản lý kho thuốc (bật/tắt `IsAllowed`, sửa `PhiDays`) và danh sách ca bệnh cần chuyên gia.

### Chặng 3: VERIFY (Nghiệm thu Thực tế - Presence Gates)
- [ ] Thêm sản phẩm vào giỏ hàng $\rightarrow$ Đặt đơn COD $\rightarrow$ Đơn hàng lưu thành công trong CSDL với trạng thái `PENDING`.
- [ ] Đăng nhập tài khoản Admin $\rightarrow$ Bấm duyệt một bài viết khuyến nông $\rightarrow$ Giá trị `IsManualApproved` trong DB đổi thành `true`.
- [ ] Tài khoản nông dân (role `FARMER`) cố tình gọi API duyệt bài $\rightarrow$ Bị chặn với HTTP 403 Forbidden.

### Chặng 4: SHIP (Đóng gói & Chờ xác nhận Commit)
- [ ] Cập nhật trạng thái `TASK-A03` trong `tasks/TODO.md` sang `[x] DONE`.
- [ ] Ghi nhận kết quả vào `tasks/WORKLOG.md`.
- [ ] Báo cáo tóm tắt diff và chờ Lập trình viên xác nhận trước khi commit.
