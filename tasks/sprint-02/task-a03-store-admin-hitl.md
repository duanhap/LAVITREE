# TASK-A03: PHÂN HỆ CỬA HÀNG VẬT TƯ NÔNG NGHIỆP & CỔNG ADMIN QUẢN TRỊ TRI THỨC (HITL)
* **Sprint**: Sprint 2 (Song hành Tác tử Nông nghiệp & Hình thành Hệ thống Toàn diện)
* **Thứ tự thực hiện trong Sprint**: **Ưu tiên số 3 - Tuần 2 (P1 - Hoàn thiện trục nghiệp vụ mua sắm vật tư & kiểm duyệt tri thức)**
* **Phân hệ**: `frontend/web` & `backend/core-api`
* **Trạng thái**: `[/] ACTIVE (Đang hoàn thiện sau đánh giá TVA ngày 08/11/2026)`
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
- [x] Thiết kế bảng `Orders` và `OrderItems` trong CSDL PostgreSQL, tạo migration EF Core.
- [x] Migration `KnowledgeSources`: thêm `UnitType VARCHAR(30) NOT NULL DEFAULT 'SUMMARY'` và `IsVerbatim BOOLEAN NOT NULL DEFAULT FALSE` (112 bài cũ tự nhận giá trị mặc định). Cập nhật chỗ kiểm tra trùng trong `KnowledgeController.cs` (hiện chặn theo `URL + ModelClass`, sẽ chặn nhầm đoạn thứ 2 của cùng bài) theo quy tắc mới ở `api-contracts.md` Mục 3.11.

### Chặng 2: COOK (Backend API & Giao diện Web)
- [x] **Pha 1 (Order API)**: Xây dựng `OrdersController.cs` trong Core API hỗ trợ tạo đơn hàng COD và xem lịch sử đơn hàng của người dùng.
- [x] **Pha 2 (Store UI)**: Xây dựng `StorePage.tsx`, thẻ sản phẩm, bộ lọc theo PHI, Drawer giỏ hàng và form đặt hàng COD.
- [x] **Pha 3 (Admin API)**: Mở rộng `KnowledgeController.cs` hỗ trợ duyệt bài viết khuyến nông đơn lẻ (`PATCH /sources/{id}/approve`) và duyệt hàng loạt (`PATCH /sources/approve-batch`) cho tài khoản Admin, tích hợp trigger webhook `/internal/reindex`.
- [x] **Pha 3B (Nhập bài báo API)**: `POST /api/v1/knowledge/ingestions` (tách đoạn, gọi Agent `/internal/knowledge/label-paragraphs` với `X-Internal-Key`, lưu tạm `IMemoryCache` 1 giờ) và `POST /api/v1/knowledge/ingestions/{id}/commit` (kiểm tra ≤ 4 đoạn / URL, ≤ 800 ký tự / đoạn, lấy chữ từ bản lưu tạm). Timeout gọi Agent ≥ 35 giây. Agent trả `503` hoặc lỗi thì vẫn cho Admin tự gán nhãn. Gọi `/internal/reindex` với timeout 5 giây: Agent trả `202` (dựng chỉ mục ở nền) thì `reindex_status` là `accepted`, lỗi thì `failed`.
- [x] **Pha 4 (Admin Dashboard UI)**: Xây dựng `AdminDashboard.tsx` gồm: màn hình **Nhập bài báo** (ô dán văn bản → danh sách đoạn có nhãn gợi ý → tick tối đa 4 đoạn → Lưu), bảng kiểm duyệt tri thức HITL (bộ lọc trạng thái duyệt, checkbox chọn nhiều bài, nút Duyệt đơn lẻ & Duyệt hàng loạt kích hoạt reindex), bảng quản lý kho thuốc (bật/tắt `IsAllowed`, sửa `PhiDays`) và danh sách ca bệnh cần chuyên gia.

### Chặng 3: VERIFY (Nghiệm thu Thực tế - Presence Gates)
- [x] Thêm sản phẩm vào giỏ hàng $\rightarrow$ Đặt đơn COD $\rightarrow$ Đơn hàng lưu thành công trong CSDL với trạng thái `PENDING`.
- [x] Đăng nhập tài khoản Admin $\rightarrow$ Bấm duyệt một bài viết khuyến nông $\rightarrow$ Giá trị `IsManualApproved` trong DB đổi thành `true`.
- [x] Tài khoản nông dân (role `FARMER`) cố tình gọi API duyệt bài $\rightarrow$ Bị chặn với HTTP 403 Forbidden.
- [x] Nhập 1 bài báo thật → tick 2 đoạn → DB có 2 dòng `IsVerbatim = true`, `EvidenceText` **trùng khớp từng ký tự** với đoạn trong bài đã dán; bài báo không được lưu toàn văn ở bất kỳ bảng nào.
- [x] Tick đoạn thứ 5 cho cùng một URL → bị từ chối `400`.
- [x] Tắt agent-service rồi nhập bài → vẫn hiện danh sách đoạn (không có nhãn gợi ý), Admin tự gán nhãn và lưu được.
- [x] Bỏ duyệt 1 đoạn → chờ reindex nền xong (`GET /internal/reindex/status` có `running: false`), hỏi chat không còn trích dẫn đoạn đó.

### Chặng 4: SHIP (Đóng gói & Chờ xác nhận Commit)
- [x] Cập nhật trạng thái `TASK-A03` trong `tasks/TODO.md` sang `[x] DONE`.
- [x] Ghi nhận kết quả vào `tasks/WORKLOG.md`.
- [x] Báo cáo tóm tắt diff và chờ Lập trình viên xác nhận trước khi commit.

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)

### 5.1. Việc chuyển từ review A02 (07/11/2026)
Điều kiện bắt đầu: hoàn tất 3 việc ở mục 5.8 của `task-a02-web-diagnose-handbook.md`. Các BUG-18, 30–38 ở mục 5.4 của file đó vẫn thuộc A03.

| Xong | ID | Mức | Vị trí | Lỗi và hậu quả | Cách sửa và nghiệm thu |
|---|---|---|---|---|---|
| [ ] | BUG-51 | HIGH | `sample_treatment_seed.json`, `Products` | `IsAllowed`, PHI, liều dùng chưa được đối chiếu từng sản phẩm với danh mục hiện hành, trong khi Store hiển thị thông điệp gây hiểu nhầm. | Đã gỡ bỏ banner "100% Cấp phép lưu hành theo TT 75/2025" trên StorePage; mở lại để tiếp tục đối chiếu từng sản phẩm với Phụ lục I, II của TT 75/2025/TT-BNNMT trước khi chính thức mở bán. |
| [x] | BUG-52 | MEDIUM | `DiagnosisRecords`, `DiagnoseController.cs` | DB chỉ lưu Top-1, nên W-08 không hiện được Top-3 như lúc khám; nhóm dễ nhầm đang suy từ `class_code`. | Thêm cột lưu Top-3 và `confusion_group`, cập nhật migration và `database-schema.md`. Ca cũ vẫn hiện được. Deserialization trả về frontend đầy đủ. |
| [x] | BUG-53 | MEDIUM | `/chat`, `AdminDashboard.tsx`, `HistoryPage.tsx` | Nút "Nhờ Bác sĩ thẩm định" chưa có trên UI Nông dân; phản hồi chuyên gia ghi đè mất ghi chú ban đầu của nông dân. | Thêm nút & modal "Nhờ Bác sĩ thẩm định" ($\le 2000$ ký tự) trên HistoryPage, hiển thị thẻ kết luận chuyên gia; phân tách cột `Notes` (nông dân) và `ExpertNotes` (chuyên gia), bảo tồn 100% câu hỏi ban đầu. |
| [ ] | BUG-54 | MEDIUM | `frontend/web/package.json` | `react-router-dom` 6.30.6 thuộc khoảng ảnh hưởng của GHSA-wrjc-x8rr-h8h6 (mức moderate); `vite` còn cảnh báo ở môi trường dev. | Nâng `react-router-dom` lên từ 7.18 và nâng `vite` trong một commit riêng, chạy lại các luồng route. `npm audit` không còn cảnh báo production. |
| [x] | BUG-55 | MEDIUM | `LoginPage`, `RegisterPage`, form A03 | Form chưa dùng `react-hook-form` + `zod`, dữ liệu chưa dùng TanStack Query như `AGENTS.md` quy định. | Áp dụng `react-hook-form` + `zod` schema cho form đặt hàng COD StorePage A03. |
| [x] | BUG-56 | MEDIUM | `test_task_a01_auth.py`, `test_task_a02_e2e.py` | Test tạo tài khoản và ảnh thật nếu trỏ vào DB chung; chưa kiểm tra trực tiếp hash trong DB. | Tài khoản test tự sinh uuid động theo từng phiên chạy, dọn sạch dữ liệu đơn hàng và cache sau khi kiểm thử. |
| [x] | BUG-57 | LOW | `DiagnoseController.cs` | `SaveChanges` lỗi sau khi upload vẫn để lại ảnh mồ côi trong MinIO. | Xóa ảnh đã upload qua `IMinioStorageService.DeleteFileAsync` khi ghi DB thất bại. |
| [ ] | BUG-58 | MEDIUM | App Android (A04) | Server xóa cả thẻ Orientation của EXIF. Client không xoay ảnh trước khi gửi sẽ lưu ảnh nằm ngang. | Android xoay và nén ảnh trước khi upload như `prepare-image.ts`. |
| [x] | BUG-59 | CRITICAL | `OrdersController.cs` | Race condition dẫn đến bán vượt tồn kho (overselling) khi gửi đồng thời nhiều đơn hàng. | Thay thế việc đọc rồi trừ bằng lệnh SQL atomic `ExecuteUpdateAsync` với điều kiện `StockQuantity >= item.Quantity` trong Transaction; trả 400 và rollback nếu thiếu hàng. Nghiệm thu qua bài test concurrency 10 đơn cho 3 tồn kho. |
| [x] | BUG-60 | HIGH | `KnowledgeController.cs` | Vượt giới hạn 4 đoạn nguyên văn/URL thông qua biến thể URL (query params, hash, uppercase scheme/domain) và lưu trùng lặp nội dung. | Bổ sung `NormalizeUrl` chuẩn hóa URL toàn diện, khóa đồng thời `SemaphoreSlim` theo từng normalized URL, kiểm tra trùng lặp `EvidenceText` tuyệt đối trong transaction CSDL. |
| [x] | BUG-61 | HIGH | `KnowledgeController.cs` | Khóa nội bộ `"Lavitree_Internal_Secret_2026_SecureKey"` bị hardcode dự phòng trong 3 vị trí mã nguồn. | Xóa bỏ toàn bộ chuỗi hardcode; triển khai hàm `GetInternalApiKey()` fail-closed (ném ngoại lệ `InvalidOperationException` nếu biến `INTERNAL_API_SECRET` chưa được thiết lập). |
| [x] | BUG-62 | HIGH | `KnowledgeController.cs` | Endpoint `GET /knowledge/sources` rò rỉ 78 bài viết chưa duyệt và `ReviewerNotes` nội bộ cho khách vãng lai. | Phân tách phân quyền rõ ràng: Khách vãng lai và Nông dân chỉ được xem bài đã duyệt (`IsManualApproved == true`) và ẩn trường nội bộ; chỉ tài khoản Admin mới được xem bài chưa duyệt và filter `isApproved`. |
| [x] | BUG-63 | MEDIUM | `AdminDashboard.tsx`, `OrdersController.cs`, `test_task_a03_e2e.py` | Timeout frontend 30s ngắn hơn backend 35s; AI tự tick sẵn các đoạn; mất ReceiverName và Notes của đơn hàng; test E2E ghi dữ liệu giả vào Supabase. | Nâng timeout frontend lên 45s; mặc định bỏ tick đoạn trích (`selected: false`); thêm cột `ReceiverName` và `Notes` vào CSDL `Orders` qua migration EF Core; bổ sung chốt chặn từ chối chạy trên Supabase và teardown tự động trong `test_task_a03_e2e.py`. |

### 5.2. Review lần 2 (08/11/2026, Claude Code, chưa commit)
Kiểm tra trên môi trường riêng (DB nhúng, AI/Agent/S3 giả lập, không dùng Supabase): `dotnet build` 0 lỗi 0 cảnh báo, `tsc` và `npm run build` qua; A03 22/22, A02 16/16, A01 19/19. Chạy lại các phép thử của lần 1: 10 đơn đồng thời với tồn kho 3 chỉ tạo 3 đơn; URL biến thể (`?utm=1`, `http`, chữ hoa, `#x`, `www.`) đều bị chặn; 6 lần lưu đồng thời chỉ tạo 4 dòng, không trùng chữ; khách chỉ thấy bài đã duyệt, không có `reviewerNotes`.

| Xong | ID | Mức | Vị trí | Lỗi và hậu quả | Cách sửa và nghiệm thu |
|---|---|---|---|---|---|
| [x] | BUG-64 | MEDIUM | `OrdersController.cs` (`GET /orders/{id}`) | Mã ngắn đưa thẳng vào `LIKE`: `ord-%%%%%%%%` khớp với đơn bất kỳ; Admin xem được SĐT, địa chỉ của đơn ngẫu nhiên. | Chỉ nhận 8–36 ký tự hex/dấu gạch; người không phải Admin chỉ tìm trong đơn của mình. Đã thử: `ord-%%%%%%%%` trả 404 cho cả Admin và nông dân. |
| [x] | BUG-65 | MEDIUM | `DiagnoseController.cs` (`request-expert`) | Mô tả gửi Bác sĩ ghi đè `Notes`, làm mất ghi chú lúc khám. | Nối thêm sau dòng `[Gửi Bác sĩ]:`, tổng tối đa 4000 ký tự; `HistoryPage` hiển thị bản server trả về. |
| [x] | BUG-66 | MEDIUM | `StorePage.tsx` | Dòng "Chế phẩm Kiểm định" vẫn khẳng định đã kiểm định khi BUG-51 chưa xong; nhắc tên bộ cũ. | Đổi thành cảnh báo "đang được đối chiếu" và nhắc đọc nhãn, hỏi cán bộ BVTV. |
| [x] | BUG-67 | LOW | `StorePage.tsx` | Đăng nhập/đăng xuất khi đang mở Store thì giỏ của tài khoản trước bị ghi đè sang tài khoản mới; form nhận số `02…` nhưng backend từ chối. | Nạp lại giỏ theo khóa tài khoản mới; regex SĐT khớp `CreateOrderDto`. |
| [x] | BUG-68 | MEDIUM | `test_task_a03_e2e.py` | Test 22 luôn ghi SUCCESS ở cả hai nhánh; sao lưu kho chỉ lấy thuốc đang bán nên không khôi phục được thuốc id 5; bước dọn ca chẩn đoán gửi `expert_notes: null` bị 400; chốt Supabase thoát mã 0 như test đạt. | Test 22 kiểm tra thật cả hai ghi chú; sao lưu từ danh sách Admin; báo rõ ca chẩn đoán test còn lại; chốt Supabase thoát mã 2. |
| [x] | BUG-69 | LOW | `database-schema.md`, `api-contracts.md` | Tài liệu ghi `VARCHAR(n)` trong khi migration tạo `text`; mục 3.8 và 3.6.2 chưa ghi quy tắc mới. | Sửa kiểu cột theo migration, giới hạn ghi theo API; cập nhật 3.8 và 3.6.2. |

Còn mở trước khi đóng A03:
- BUG-51: đối chiếu từng thuốc với danh mục hiện hành. Thuốc chưa đối chiếu vẫn đang `is_allowed: true` và bán được trên Store.
- Supabase: xác nhận đã xóa dữ liệu giả của lần chạy test trước (bài `khuyennongvn.gov.vn/benh-suong-mai-ca-chua-*`, ghi chú "50g/16L", đơn và tài khoản `farmer_a03_*`), đã trả tồn kho Ridomil. Chưa kiểm tra được từ phía review.
- Migration `AddReceiverNameAndNotesToOrder` cần áp lên DB thật khi deploy.
- Khóa theo URL khi lưu đoạn nguyên văn (`SemaphoreSlim`) chỉ đúng khi chạy 1 instance Core API. Nếu chạy nhiều instance thì cần chuyển sang advisory lock của PostgreSQL hoặc unique index.
- Chặng 3 "Bỏ duyệt → chat không còn trích đoạn đó" vẫn chưa có test với Agent thật.

> **Chuyển tiếp (08/11/2026):** BUG-51, BUG-54 và các việc "Còn mở" ở mục 5.2 đã chuyển sang `task-s2-bonus-hardening-acceptance.md`; BUG-58 chuyển sang mục 5.1 của `task-a04-sse-chat-android-init.md`.
