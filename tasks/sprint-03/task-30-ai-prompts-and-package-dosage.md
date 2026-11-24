# TASK-30: Prompt AI theo cây, lưu liều cây khi tạo từ gợi ý, chặn lưu ngầm liều chung sản phẩm

* **Sprint**: Sprint 3
* **Phân hệ**: `frontend/web` (`AdminInventoryPage`, `AdminProductDetailPage`, `ProductDetailPage`, `DiseaseEvidenceList`, `lib/product-research.ts`), `backend/core-api` (`POST /medicines`)
* **Ưu tiên**: P1
* **Phụ thuộc**: TASK-29 (liều theo cây ở bảng `ProductUsageRules`)
* **Nhánh Git**: `feat/task-29-usage-rules-relational` (làm tiếp trên nhánh TASK-29)
* **Trạng thái**: `[~] Code xong, đã thử trên DB local; dữ liệu Supabase mục 6 đã xử lý. Chưa commit.`
* **Tạo ngày**: 24/11/2026

---

## 1. Bối cảnh

Sau TASK-29 liều có 3 tầng: liều riêng của bệnh → liều chung của cây (`ProductUsageRules`) → **phiếu liều chung của sản phẩm** (`Products.UsageProfile`, kèm ô chữ `Products.DosageInstruction` mà Lavi đọc).

Rà lại các chỗ dùng prompt AI thì thấy:

| # | Chỗ dùng | Vấn đề |
|---|---|---|
| 1 | **Thêm sản phẩm** (nút chung ở Kho) | Form không hiện phiếu cách dùng, nhưng phần `usage` AI trả về vẫn được nạp và **lưu ngầm** vào `Products.UsageProfile`. Phiếu này lại hiện cho mọi cây chưa có liều riêng và được điền sẵn ở form "Gắn SP". Dữ liệu thật: Ridomil (#1), Vôi bột (#6) có phiếu chung là câu AI viết riêng cho cà chua. |
| 2 | **Tạo SP** từ vật tư gợi ý | Prompt lấy `usage` theo cây trong đoạn trích, nhưng câu "lấy mức phổ biến" gộp liều nhiều cây; liều nhập ở form được lưu làm liều chung **sản phẩm**, không thành liều **cây**. |
| 3 | **Gắn SP** vào gợi ý | Câu mẫu `dosage_instruction` có "cho bệnh ${disease}" → AI viết "Với bệnh mốc sương…", câu này hiện cho mọi bệnh của cây (liều chung cây). Prompt không có câu nào từ đoạn trích. |
| 4 | **Chi tiết sản phẩm, tab Thông tin**, nút AI | Truyền `kind = "Hóa học"` (nhãn) thay vì mã `CHEMICAL` → prompt và gợi ý Google hiểu sai loại (thuốc hóa học bị tìm "liều lượng bón", nguồn ưu tiên là cửa hàng vật tư). |
| 5 | Trang sản phẩm (Admin + cửa hàng) | Ô thông số lấy từ phiếu chung sản phẩm hiện như liều của cây, không ghi chú; trang cửa hàng còn hiện `dose_text` của phiếu chung thành liều cây và có thể lấy phiếu của **liều riêng một bệnh** làm thông số cả cây. |

## 2. Việc đã làm

1. **Prompt "Gắn SP"** (`AdminInventoryPage.handleCopyLinkAiPrompt`): vai trò ghi rõ "liều dùng chung trên cây X, áp dụng cho mọi bệnh"; dặn không nêu tên bệnh; bỏ "cho bệnh ${disease}" ở câu mẫu; thêm tối đa 3 câu trong đoạn trích có nhắc tên vật tư (gợi ý cùng tên + cùng cây, `keyMentionSentences`).
2. **Prompt "Tạo SP" / "Thêm sản phẩm"** (`buildProductResearchPrompt`): có đoạn trích → `usage` là liều trên **cây chính** của đoạn trích; nhiều cây thì không gộp, ghi liều cây khác vào `scope_note`; không nêu tên bệnh. Không có đoạn trích → giữ câu "áp dụng chung" như cũ. Mô tả sản phẩm vẫn tổng quát.
3. **Lưu liều cây khi "Tạo SP" từ gợi ý**: `POST /medicines` nhận thêm `plant_usage { dosage_instruction, usage_profile, source_url? }` (form gửi khi tạo từ gợi ý). Nếu mọi bệnh được gắn thuộc **đúng 1 cây** → tạo liều chung của cây trong `ProductUsageRules`. Nhiều cây → bỏ qua. Phiếu chung sản phẩm + ô "Hướng dẫn sử dụng" giữ nguyên (Lavi đọc `DosageInstruction`).
4. **Sửa `kind`** ở trang Chi tiết sản phẩm: `kindFromMedicineType(formData.medicine_type)` cho cả prompt AI và gợi ý Google.
5. **Form "Thêm sản phẩm" hiện phiếu cách dùng + ô "Hướng dẫn sử dụng"** (ghi chú: đây là liều chung sản phẩm, để trống nếu chưa có nguồn). Kiểm tra phiếu cho cả 2 luồng. Ô còn câu mặc định của loại cũ → lưu câu mặc định đúng loại hiện tại.
6. **Trang sản phẩm**: ô thông số lấy từ phiếu chung ghi "Thông số chung của sản phẩm (chưa có liều riêng cho cây này)"; cửa hàng không lấy `dose_text` của phiếu chung làm liều cây và không lấy phiếu của liều riêng một bệnh làm thông số cả cây.
7. **Dữ liệu Supabase** (người dùng đồng ý, 24/11/2026): đặt `Products.UsageProfile = NULL` cho Ridomil Gold 68WG (#1) và Vôi bột đá vôi nông nghiệp (#6). Trước khi xóa đã kiểm tra 2 sản phẩm không có liều theo bệnh/cây; ô `DosageInstruction` giữ nguyên. Bản sao lưu: [task-30-backup-usage-profile-p1-p6.json](task-30-backup-usage-profile-p1-p6.json). Người dùng sẽ tạo lại phiếu sau.

8. **Trang Chi tiết sản phẩm, tab Thông tin** (bổ sung 24/11 tối): trước đây tab này không có chỗ sửa liều chung sản phẩm và nút nạp JSON AI bỏ qua `usage`. Giờ chế độ xem hiện "Liều chung của sản phẩm (theo nhãn / bao bì)" + tóm tắt phiếu; chế độ sửa có `UsageProfileEditor` + ô "Hướng dẫn sử dụng"; nạp JSON AI điền cả phiếu và câu liều; lưu gửi `usage_profile` (phiếu trống gửi `{}` để xóa) và ghép lại `dosage_instruction`. Thử Playwright trên DB local: xem / sửa có khung, nạp JSON Vôi bột → lưu → API trả `dose_per_area` 300–500 kg/ha, không lỗi JS.

## 3. Danh sách mọi chỗ dùng prompt AI (sau task này)

| # | Chỗ | Phạm vi | Ghi vào đâu |
|---|---|---|---|
| 1 | Thêm sản phẩm (Kho) | Tổng quát sản phẩm, liều chung sản phẩm | `Products` (Admin thấy và sửa phiếu trước khi lưu) |
| 2 | Tạo SP từ vật tư gợi ý | Mô tả tổng quát + liều trên cây chính của đoạn trích | `Products` + liều chung cây (`ProductUsageRules`) khi bệnh thuộc 1 cây |
| 3 | Gắn SP vào gợi ý | Liều chung theo cây | `ProductUsageRules` (liều cây, hoặc liều riêng bệnh nếu khác) |
| 4 | Chi tiết sản phẩm, tab Thông tin | Tổng quát sản phẩm | Tên, hoạt chất, PHI, ảnh, link, mô tả + phiếu liều chung sản phẩm (Admin xem trước khi lưu) |
| 5 | Chi tiết sản phẩm, tab Bệnh điều trị & Liều lượng | Không có prompt AI | Nhập tay → `ProductUsageRules` |
| 6 | Gợi ý câu tìm Google | Không phải AI | — |
| 7 | Nạp bài báo (agent-service `rag/pipeline.py`) | Chia đoạn, gán nhãn, trích tên vật tư → `ProductSuggestions` | Chưa rà trong task này |
| 8 | Chat Lavi (`agent/prompts.py`) | Prompt hệ thống trợ lý | Chưa rà trong task này |

## 4. Kiểm thử

| # | Tình huống | Kết quả |
|---|---|---|
| T1 | Tạo SP từ gợi ý, không gửi `plant_usage` | Không tạo liều cây — PASS |
| T2 | Tạo SP từ gợi ý + `plant_usage`, 2 bệnh cà chua | 1 liều chung Cà chua đúng chữ; phiếu chung + `DosageInstruction` giữ nguyên — PASS |
| T3 | `plant_usage` với bệnh thuộc 2 cây | Không tạo liều cây — PASS |
| T4 | Toàn bộ bộ test TASK-29 chạy lại | 34/34 PASS (DB thử local `lavitree_t29`, Core chạy ngoài repo) |
| T5 | `tsc --noEmit`, `vite build`, `npm test` | 0 lỗi, build OK, 7/7 |
| T6 | Supabase sau khi xóa phiếu #1, #6 | `UsageProfile IS NULL`, `DosageInstruction` còn nguyên — PASS |

Chưa bấm thử trên trình duyệt: nút sao chép prompt (mục 1–3) và form "Thêm sản phẩm" mới hiện phiếu.

## 5. Nhật ký
| Thời gian | Người làm | Nội dung |
|---|---|---|
| 2026-11-24 | Claude | Làm mục 1–7, kiểm thử như mục 4. |
