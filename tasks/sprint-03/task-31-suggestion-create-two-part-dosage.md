# TASK-31: "Tạo SP" từ vật tư gợi ý tách 2 phần (bao bì / liều cây), gộp gợi ý theo (vật tư + cây)

* **Sprint**: Sprint 3
* **Phân hệ**: `frontend/web` (`AdminInventoryPage`, `lib/product-research.ts`), `backend/core-api` (`KnowledgeController`, `MedicinesController`)
* **Ưu tiên**: P1
* **Phụ thuộc**: TASK-29 (`ProductUsageRules`), TASK-30 (`plant_usage`)
* **Nhánh Git**: `feat/task-29-usage-rules-relational`
* **Trạng thái**: `[~] Code xong, đã thử trên DB local (API 13/13 + hồi quy 34/34, giao diện 9/9). Chưa commit.`
* **Tạo ngày**: 24/11/2026
* **Liên quan**: TASK-32 (Lavi đọc liều theo cây — làm sau)

---

## 1. Bối cảnh
Form "Tạo SP" từ gợi ý chỉ có 1 phiếu liều + 1 ô "Hướng dẫn sử dụng". Liều đó (thường là liều cho cây của bài báo) được lưu **cả** thành liều chung của sản phẩm (bao bì) **và** liều cây → liều cà chua hiện cho cây khác và Lavi nói liều cà chua cho mọi cây.

Ngoài ra danh sách "Vật tư gợi ý" và 4 thao tác hàng loạt ở backend đang gộp theo **tên vật tư**, không phân biệt cây:

| Thao tác | Lỗi |
|---|---|
| Gắn SP (`POST /knowledge/product-suggestions/{id}/link`) | Gắn luôn gợi ý cùng tên của cây khác, nối thuốc với bệnh của cây đó |
| Tạo SP (`POST /medicines` + `suggestion_id`) | Đóng luôn gợi ý cùng tên của cây khác (nếu bệnh của nó đã gắn) |
| Bỏ qua (`.../dismiss`) | Bỏ qua gợi ý cùng tên ở mọi cây |
| Xóa (`DELETE .../{id}`) | Xóa mềm gợi ý cùng tên ở mọi cây, **kể cả đã LINKED / ADDED** → mất căn cứ của sản phẩm |

(Nạp bài mới đã luôn tạo dòng `PENDING` mới, không gộp vào gợi ý đã đóng — chỉ giao diện và các thao tác trên gộp sai.)

## 2. Yêu cầu (đã chốt với người dùng)
1. **Gộp theo (vật tư + cây)**: danh sách gợi ý gộp theo `(tên vật tư, loại, cây)`; cây lấy theo tiền tố mã bệnh (`Tomato___...` → Cà chua). Không rõ bệnh → nhóm "Chưa rõ cây". 4 thao tác hàng loạt chỉ áp dụng cho gợi ý **cùng tên + cùng cây**; Xóa chỉ xóa kèm các gợi ý cùng nhóm **chưa xử lý** (không đụng LINKED / ADDED).
2. **Form "Tạo SP" từ gợi ý tách 2 khung**:
   - **Khung 1 – Thông tin & liều bao bì** (tùy chọn): phiếu + ô "Hướng dẫn sử dụng chung (bao bì)". Chỉ điền khi biết thông số nhãn nhà sản xuất.
   - **Khung 2 – Liều cho Cây X** (theo bài "…"): phiếu + ô "Hướng dẫn sử dụng cho cây X". Lưu thành liều chung của cây trong `ProductUsageRules`.
3. **2 prompt riêng**, mỗi prompt có ô dán kết quả riêng:
   - Prompt 1 "tìm thông số bao bì": mô tả sản phẩm + liều theo nhãn của hãng (không lấy liều khuyến nông của một cây).
   - Prompt 2 "tìm liều cho cây X": tài liệu khuyến nông về liều trên đúng cây đó (dùng chung với prompt "Gắn SP").
4. **Câu cho Lavi**: khung bao bì trống → ô `DosageInstruction` của sản phẩm lưu "Trên cây X: <liều cây>"; có liều bao bì → lưu liều bao bì.
5. Không đổi: form "Gắn SP", "Thêm sản phẩm", trang Chi tiết sản phẩm.

## 2b. Đã làm
- **Backend**: `KnowledgeController.SuggestionPlantKey(modelClass)` (phần trước `___`). Gắn SP / Bỏ qua / Xóa / Tạo SP chỉ áp dụng gợi ý cùng tên **và** cùng cây; Xóa không kéo theo gợi ý LINKED / ADDED. `plant_usage.class_code` → liều cây lấy đúng cây của gợi ý (kể cả khi các bệnh được gắn thuộc nhiều cây).
- **`product-research.ts`**: `buildProductResearchPrompt({ usageMode: 'package' })` = prompt 1 (liều theo nhãn hãng, không theo cây); `buildCropDosagePrompt` (prompt 2, dùng chung với Gắn SP) + `parseCropDosageJson`.
- **`AdminInventoryPage`**: danh sách gộp theo (tên + loại + cây), nhóm không rõ bệnh hiện "Chưa rõ cây"; cập nhật tại chỗ sau Gắn / Bỏ qua / Xóa khớp server, Hủy gán tải lại danh sách. Form "Tạo SP" từ gợi ý: Khung 1 (xanh dương, liều bao bì tùy chọn, Prompt 1 ở chế độ Dev) + Khung 2 (xanh lá, "Liều cho Cây X theo bài …", nút Prompt 2, ô dán + "Điền khung 2 từ AI", phiếu, ô Hướng dẫn cho cây, link nguồn). Lưu: `usage_profile` = khung 1, `plant_usage` = khung 2 (+ `class_code`), `dosage_instruction` = liều bao bì hoặc "Trên cây X: <liều cây>".
- **`AdminProductDetailPage`**: tab Thông tin, nếu câu liều bắt đầu bằng "Trên cây …" thì ghi chú "chưa có liều bao bì".

## 2c. Đổi sang 2 bước (theo người dùng, 24/11 tối)
Form một trang dài khó dùng → "Tạo SP" từ gợi ý chia **2 bước** có thanh bước và tiêu đề riêng:
- **Bước 1/2 · Thông tin sản phẩm "…"**: thông tin chung + liều bao bì (tùy chọn) + Prompt 1 (chế độ Dev). Nút **"Tiếp tục: Liều cho Cây X →"** kiểm tra phần này rồi mới sang bước 2; nhấn Enter ở bước 1 cũng chỉ sang bước 2.
- **Bước 2/2 · Liều cho Cây X · <tên SP>**: Prompt 2 + ô dán + phiếu + câu hướng dẫn cho cây + link nguồn. Nút **"← Quay lại bước 1"** và **"Tạo sản phẩm"**. Dữ liệu 2 bước giữ nguyên khi qua lại.
- Lỗi phát hiện khi thử: nút "Tiếp tục" (type=button) và "Tạo sản phẩm" (type=submit) dùng chung 1 phần tử → bấm Tiếp tục là form bị gửi luôn. Sửa bằng `key` riêng cho từng nút; test kiểm tra "bấm Tiếp tục không tạo sản phẩm".
- Playwright 13/13 PASS (thêm: bước 1 không thấy liều cây, bấm Tiếp tục không tạo SP, quay lại / sang lại giữ dữ liệu).

## 3. Kiểm thử
| # | Tình huống | Kỳ vọng |
|---|---|---|
| T1 | Gợi ý "Trichoderma" ở Cà chua và Bí đỏ | 2 dòng riêng trên danh sách |
| T2 | Gắn SP dòng Cà chua | Gợi ý Bí đỏ vẫn PENDING, không nối bệnh Bí đỏ |
| T3 | Bỏ qua dòng Cà chua | Gợi ý Bí đỏ vẫn PENDING |
| T4 | Xóa dòng Cà chua khi có gợi ý cùng tên đã LINKED | Gợi ý LINKED còn nguyên |
| T5 | Tạo SP từ gợi ý Cà chua, khung 1 trống, khung 2 có liều | Phiếu bao bì trống; 1 liều chung Cà chua; `DosageInstruction` có "Trên cây Cà chua: …"; gợi ý Bí đỏ vẫn PENDING |
| T6 | Tạo SP từ gợi ý có cả 2 khung | Phiếu bao bì = khung 1; liều cây = khung 2; `DosageInstruction` = liều bao bì |
| T7 | 2 prompt + 2 ô dán | Mỗi ô điền đúng khung của nó |

**Kết quả** (Core chạy ngoài repo, DB thử `lavitree_t29` từ bản sao Supabase):
- API `e2e_t31`: **13/13 PASS** (T1–T6; T5 gồm bệnh thuộc 2 cây vẫn tạo đúng liều Bí đỏ theo `class_code`).
- Hồi quy TASK-29/30 `e2e_t29`: **34/34 PASS**.
- Playwright: 2 cây → 2 dòng; Tạo SP từ dòng Cà chua có Khung 1 + "Khung 2 – Liều cho Cây Cà chua"; dán JSON → điền ô liều cây; lưu → 1 liều chung Cà chua đúng chữ + link, phiếu bao bì trống, câu Lavi "Trên cây Cà chua: …", gợi ý Bí đỏ vẫn PENDING; không lỗi JS — **9/9 PASS**.
- `dotnet build` 0 lỗi; `tsc` 0 lỗi; `vite build` OK; `npm test` 7/7.
- Chưa thử bằng tay: nút Prompt 1 / Prompt 2 sao chép (nội dung prompt chỉ kiểm qua `tsc`).

## 4. Nhật ký
| Thời gian | Người làm | Nội dung | Kết quả |
|---|---|---|---|
| 2026-11-24 | Claude | Tạo task | — |
| 2026-11-24 | Claude | Làm mục 2b, kiểm thử như mục 3 | API 13/13, hồi quy 34/34, UI 9/9 |
