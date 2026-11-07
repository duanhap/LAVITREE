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
     - *Nhập Bài báo — Trích đoạn Nguyên văn (CHỨC NĂNG CHÍNH của Kho tri thức)* — theo `api-contracts.md` Mục 3.10, 3.11, 4.4:
       1. Admin chọn lớp bệnh, nhập URL, tiêu đề, cơ quan, rồi **dán văn bản bài báo** (copy từ trình duyệt hoặc PDF). Server **không tự tải URL** → không có lỗ hổng SSRF.
       2. Core tách bài thành các đoạn đánh số `P1, P2…`, gọi Agent (B) để AI gợi ý đoạn nào là `SYMPTOMS` / `CAUSE_CONDITIONS` / `PREVENTION` / `TREATMENT`. AI chỉ trả số đoạn, không viết chữ.
       3. Giao diện hiển thị toàn bộ đoạn, đoạn được gợi ý có nhãn sẵn. Admin **tick tối đa 4 đoạn**, có thể đổi nhãn → bấm Lưu. **Tick = Duyệt.**
       4. Core lấy chữ từ bản lưu tạm (không nhận chữ từ client) → mỗi đoạn thành 1 dòng `KnowledgeSources` (`IsVerbatim = true`, `IsManualApproved = true`) → gọi reindex.
       - Quy tắc pháp lý (trích dẫn hợp lý, Điều 25 Luật SHTT, Điều 28 NĐ 17/2023): mỗi bài tối đa 4 đoạn ngắn (≤ 800 ký tự/đoạn), luôn lưu kèm URL + cơ quan/tác giả, **không lưu toàn văn** vào CSDL. Gỡ bài ngay khi tác giả yêu cầu.
     - *Dữ liệu cũ (112 bài từ trang Thu Thập Tri Thức)*: migration gán `UnitType = SUMMARY`, `IsVerbatim = false`. Đổi nhãn "Trích dẫn chứng cứ" trên `KnowledgeCollectorPage.tsx` thành **"Tóm tắt"** (đó là tóm tắt do AI soạn, không phải nguyên văn). Sửa lỗi parser [dòng 630-631](../../frontend/web/src/pages/KnowledgeCollectorPage.tsx): khi không tìm thấy `[TRÍCH DẪN CỐT LÕI]` thì **báo lỗi**, không đổ cả câu trả lời của AI vào `EvidenceText`.
     - *Duyệt bài Khuyến nông (HITL Ingestion - Đơn lẻ & Hàng loạt)*: Xem danh sách bài viết từ `KnowledgeSources` (bộ lọc Chưa duyệt / Đã duyệt / ModelClass), kiểm tra nội dung $\rightarrow$ Bấm nút `Duyệt bài` từng bài hoặc checkbox chọn nhiều bài bấm **`Duyệt hàng loạt (Bulk Approve)`** (`IsManualApproved = true`), hoặc **Bỏ duyệt** (`is_approved: false`) để ngừng dùng bài trong RAG. Đoạn nguyên văn không được sửa chữ, chỉ đổi nhãn / bỏ duyệt / xóa. Đây là trigger để pipeline của B băm chunk và nạp vào ChromaDB + BM25 qua webhook `/internal/reindex`.
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
- [ ] Migration `KnowledgeSources`: thêm `UnitType VARCHAR(30) NOT NULL DEFAULT 'SUMMARY'` và `IsVerbatim BOOLEAN NOT NULL DEFAULT FALSE` (112 bài cũ tự nhận giá trị mặc định). Cập nhật chỗ kiểm tra trùng trong `KnowledgeController.cs` (hiện chặn theo `URL + ModelClass`, sẽ chặn nhầm đoạn thứ 2 của cùng bài) theo quy tắc mới ở `api-contracts.md` Mục 3.11.

### Chặng 2: COOK (Backend API & Giao diện Web)
- [ ] **Pha 1 (Order API)**: Xây dựng `OrdersController.cs` trong Core API hỗ trợ tạo đơn hàng COD và xem lịch sử đơn hàng của người dùng.
- [ ] **Pha 2 (Store UI)**: Xây dựng `StorePage.tsx`, thẻ sản phẩm, bộ lọc theo PHI, Drawer giỏ hàng và form đặt hàng COD.
- [ ] **Pha 3 (Admin API)**: Mở rộng `KnowledgeController.cs` hỗ trợ duyệt bài viết khuyến nông đơn lẻ (`PATCH /sources/{id}/approve`) và duyệt hàng loạt (`PATCH /sources/approve-batch`) cho tài khoản Admin, tích hợp trigger webhook `/internal/reindex`.
- [ ] **Pha 3B (Nhập bài báo API)**: `POST /api/v1/knowledge/ingestions` (tách đoạn, gọi Agent `/internal/knowledge/label-paragraphs` với `X-Internal-Key`, lưu tạm `IMemoryCache` 1 giờ) và `POST /api/v1/knowledge/ingestions/{id}/commit` (kiểm tra ≤ 4 đoạn / URL, ≤ 800 ký tự / đoạn, lấy chữ từ bản lưu tạm). Timeout gọi Agent ≥ 35 giây. Agent trả `503` hoặc lỗi thì vẫn cho Admin tự gán nhãn. Gọi `/internal/reindex` với timeout 5 giây: Agent trả `202` (dựng chỉ mục ở nền) thì `reindex_status` là `accepted`, lỗi thì `failed`.
- [ ] **Pha 4 (Admin Dashboard UI)**: Xây dựng `AdminDashboard.tsx` gồm: màn hình **Nhập bài báo** (ô dán văn bản → danh sách đoạn có nhãn gợi ý → tick tối đa 4 đoạn → Lưu), bảng kiểm duyệt tri thức HITL (bộ lọc trạng thái duyệt, checkbox chọn nhiều bài, nút Duyệt đơn lẻ & Duyệt hàng loạt kích hoạt reindex), bảng quản lý kho thuốc (bật/tắt `IsAllowed`, sửa `PhiDays`) và danh sách ca bệnh cần chuyên gia.

### Chặng 3: VERIFY (Nghiệm thu Thực tế - Presence Gates)
- [ ] Thêm sản phẩm vào giỏ hàng $\rightarrow$ Đặt đơn COD $\rightarrow$ Đơn hàng lưu thành công trong CSDL với trạng thái `PENDING`.
- [ ] Đăng nhập tài khoản Admin $\rightarrow$ Bấm duyệt một bài viết khuyến nông $\rightarrow$ Giá trị `IsManualApproved` trong DB đổi thành `true`.
- [ ] Tài khoản nông dân (role `FARMER`) cố tình gọi API duyệt bài $\rightarrow$ Bị chặn với HTTP 403 Forbidden.
- [ ] Nhập 1 bài báo thật → tick 2 đoạn → DB có 2 dòng `IsVerbatim = true`, `EvidenceText` **trùng khớp từng ký tự** với đoạn trong bài đã dán; bài báo không được lưu toàn văn ở bất kỳ bảng nào.
- [ ] Tick đoạn thứ 5 cho cùng một URL → bị từ chối `400`.
- [ ] Tắt agent-service rồi nhập bài → vẫn hiện danh sách đoạn (không có nhãn gợi ý), Admin tự gán nhãn và lưu được.
- [ ] Bỏ duyệt 1 đoạn → chờ reindex nền xong (`GET /internal/reindex/status` có `running: false`), hỏi chat không còn trích dẫn đoạn đó.

### Chặng 4: SHIP (Đóng gói & Chờ xác nhận Commit)
- [ ] Cập nhật trạng thái `TASK-A03` trong `tasks/TODO.md` sang `[x] DONE`.
- [ ] Ghi nhận kết quả vào `tasks/WORKLOG.md`.
- [ ] Báo cáo tóm tắt diff và chờ Lập trình viên xác nhận trước khi commit.

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)

### 5.1. Việc chuyển từ review A02 (07/11/2026)
Điều kiện bắt đầu: hoàn tất 3 việc ở mục 5.8 của `task-a02-web-diagnose-handbook.md`. Các BUG-18, 30–38 ở mục 5.4 của file đó vẫn thuộc A03.

| Xong | ID | Mức | Vị trí | Lỗi và hậu quả | Cách sửa và nghiệm thu |
|---|---|---|---|---|---|
| [ ] | BUG-51 | HIGH | `sample_treatment_seed.json`, `Products` | `IsAllowed`, PHI, liều dùng chưa được đối chiếu từng sản phẩm với danh mục hiện hành, trong khi Store sắp bán các thuốc này. | Đối chiếu với Phụ lục I, II của Thông tư 75/2025/TT-BNNMT và Thông tư 28/2026/TT-BNNMT, ghi nguồn cho từng thuốc. Thuốc chưa đối chiếu thì không mở bán. |
| [ ] | BUG-52 | MEDIUM | `DiagnosisRecords`, `DiagnoseController.cs` | DB chỉ lưu Top-1, nên W-08 không hiện được Top-3 như lúc khám; nhóm dễ nhầm đang suy từ `class_code`. | Thêm cột lưu Top-3 và `confusion_group`, cập nhật migration và `database-schema.md`. Ca cũ vẫn hiện được. |
| [ ] | BUG-53 | MEDIUM | `/chat`, `AdminDashboard.tsx` | Nút "Nhờ chuyên gia" mới chỉ chuyển sang Trợ lý; chưa tạo được ca cho Admin xử lý (`requires_expert`). | Thêm API gửi ca và màn "Ca chuyên gia". Chỉ báo "đã gửi" khi API trả thành công. |
| [ ] | BUG-54 | MEDIUM | `frontend/web/package.json` | `react-router-dom` 6.30.6 thuộc khoảng ảnh hưởng của GHSA-wrjc-x8rr-h8h6 (mức moderate); `vite` còn cảnh báo ở môi trường dev. | Nâng `react-router-dom` lên từ 7.18 và nâng `vite` trong một commit riêng, chạy lại các luồng route. `npm audit` không còn cảnh báo production. |
| [ ] | BUG-55 | MEDIUM | `LoginPage`, `RegisterPage`, form A03 | Form chưa dùng `react-hook-form` + `zod`, dữ liệu chưa dùng TanStack Query như `AGENTS.md` quy định. | Áp dụng cho form và trang mới của A03, chuyển Login và Register cùng lúc. |
| [ ] | BUG-56 | MEDIUM | `test_task_a01_auth.py`, `test_task_a02_e2e.py` | Test tạo tài khoản và ảnh thật nếu trỏ vào DB chung; chưa kiểm tra trực tiếp hash trong DB. | Chạy test trên DB riêng, dọn dữ liệu sau khi chạy, thêm kiểm tra hash. |
| [ ] | BUG-57 | LOW | `DiagnoseController.cs` | `SaveChanges` lỗi sau khi upload vẫn để lại ảnh mồ côi trong MinIO. | Xóa ảnh đã upload khi ghi DB thất bại, thêm test. |
| [ ] | BUG-58 | MEDIUM | App Android (A04) | Server xóa cả thẻ Orientation của EXIF. Client không xoay ảnh trước khi gửi sẽ lưu ảnh nằm ngang. | Android xoay và nén ảnh trước khi upload như `prepare-image.ts`. |
