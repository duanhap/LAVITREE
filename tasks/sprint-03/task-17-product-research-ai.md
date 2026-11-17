# TASK-17: Tra cứu vật tư bằng AI web, gợi ý Google theo loại, tô đậm trích dẫn
* **Sprint**: Sprint 3
* **Phân hệ**: frontend/web (Admin › Kho vật tư & thuốc)
* **Trạng thái**: `[x] DONE` (đợt 1 ngày 15/11/2026, đợt 2 ngày 16/11/2026)
* **Người phụ trách**: Trưởng nhóm (làm cùng Claude Code)
* **Độ ưu tiên**: P2
* **Tạo ngày**: 15/11/2026, từ phản hồi khi nhập sản phẩm từ gợi ý vật tư (TASK-15 Pha 3)

---

## 1. BỐI CẢNH: VẤN ĐỀ KHI DÙNG

| # | Vấn đề | Nguyên nhân |
|---|---|---|
| V1 | JSON Gemini trả về gần như không bao giờ điền được "Bệnh hại mục tiêu" | Prompt chỉ xin **một** `target_disease_code`, mẫu ghi sẵn `"NONE"` và **không đưa danh sách mã bệnh**, nên AI trả tên bệnh. Hàm nạp JSON chỉ khớp đúng mã nội bộ (`Tomato___Late_blight`). |
| V2 | Nạp JSON làm **mất** bệnh đã chọn mà vẫn báo "thành công" | Không khớp được thì gán `[]`, không cảnh báo. |
| V3 | Prompt không có đoạn trích bài báo và bắt buộc có link trước | Chưa tìm được link (lúc cần AI nhất) thì không dùng được; AI không biết "tỏi" trong bài là tỏi tươi hay dịch tỏi tự pha. |
| V4 | Nút Google luôn tìm `tên + hoạt chất + nông nghiệp liều dùng` | Không phân biệt thuốc hóa học, chế phẩm sinh học, chế phẩm tự pha, hạt giống, vật tư. |
| V5 | Trích dẫn không tô đậm tên vật tư; ô xem trước ở bảng chỉ hiện 2 dòng đầu | Khó đối chiếu, tên vật tư thường nằm ngoài 2 dòng đầu. |

Kết quả test trước khi sửa (dán 5 kiểu JSON vào "Điền form từ Gemini"): chỉ mã nội bộ đúng điền được bệnh; tên tiếng Việt, tên tiếng Anh, mảng nhiều bệnh, `"NONE"` đều ra rỗng và xóa bệnh đã chọn, toast vẫn báo thành công.

---

## 2. QUYẾT ĐỊNH

- **Copy prompt → dán vào AI bản web → dán JSON lại** (giữ cách của chế độ Dev). Không gọi Gemini API từ server: không tốn phí API, AI bản web tự tìm web tốt. Có thể thêm gọi API ở đợt sau.
- Gợi ý có nhiều trích dẫn: **mặc định 1 prompt chung** cho cả nhóm (tối đa 4 đoạn, bỏ đoạn trùng). Prompt yêu cầu AI tự báo `mentions_differ` nếu các đoạn nói về những thứ khác nhau. Có thêm nút "Prompt riêng đoạn này". Không tự động đoán "các đoạn có liên quan không" vì dễ sai.
- Nạp JSON **gộp thêm** bệnh hại, không xóa lựa chọn của Admin.

---

## 3. ĐÃ LÀM

### 3.1. Thư viện `frontend/web/src/features/admin/lib/product-research.ts` (không phụ thuộc React)
| Hàm | Việc |
|---|---|
| `foldVi`, `splitByMention` | So khớp không phân biệt hoa thường / dấu, chỉ khớp nguyên từ; dùng để tô đậm |
| `excerptAroundMention` | Cắt đoạn quanh lần xuất hiện đầu tiên của tên vật tư |
| `detectMentionContext` | Nhận diện chế phẩm tự pha (pha chế, ngâm rượu, giã nhỏ, lọc lấy nước…) và giống cây |
| `buildGoogleQueries` | 1–3 gợi ý tìm theo loại: Nhãn thuốc & PHI, Liều dùng (hóa học); Chế phẩm sinh học; Cách pha chế (tự pha); Thông tin giống; Cách dùng (vật tư); Kỹ thuật (biện pháp); Theo cây |
| `buildProductResearchPrompt` | Prompt gồm: tên, loại, cây/bệnh, ≤4 đoạn trích (tên vật tư được đánh dấu `**…**`, kèm nguồn), nhiệm vụ xác định PRODUCT / HOMEMADE / SEED / SUPPLY / PRACTICE, tìm 1–3 link nguồn tin cậy (không bịa link), mẫu JSON có `target_diseases` (mảng) + `source_urls`, quy tắc PHI không tự đoán, **danh sách 26 mã bệnh hợp lệ** (bỏ lớp `healthy`) |
| `parseProductResearchJson`, `matchDisease` | Đọc JSON trong khối ```json (chịu được lời dẫn, dấu phẩy thừa); nhận cả `target_diseases` và `target_disease_code` cũ; khớp bệnh theo mã, tên Việt, tên Anh; tên mơ hồ ("Late blight") lọc theo cây trong tên hoặc cây của đoạn trích; trả danh sách khớp / không khớp và link http(s) hợp lệ |

### 3.2. Giao diện `frontend/web/src/pages/admin/AdminInventoryPage.tsx`
- **Modal đoạn trích**: nút **Tìm với AI (n đoạn)** (prompt chung), chip **Tra Google** theo loại, nút **Prompt riêng đoạn này** ở từng tab (khi có ≥2 đoạn), tên vật tư được tô đậm (`HighlightedText`).
- **Bảng gợi ý**: ô xem trước cắt quanh tên vật tư và tô đậm.
- **Form tạo / sửa sản phẩm**: nút **Tìm với AI** cạnh ô link (kèm các đoạn trích của cả nhóm khi mở từ gợi ý; khi sửa thì lấy các gợi ý đã gắn với sản phẩm); chip Tra Google thay link cố định; link không còn bắt buộc để tạo prompt; khối "Link nguồn AI đề xuất" có nút **Dùng link này**.
- **Nạp JSON**: bệnh hại gộp thêm; toast báo số bệnh khớp, bệnh không khớp, số link; cảnh báo khi AI xác định HOMEMADE / PRACTICE / SEED hoặc `mentions_differ`; link không phải http(s) bị bỏ.

### 3.3. Kiểm thử
- Script esbuild chạy thật thư viện: 23/23 ca PASS (tô đậm có dấu / hoa thường / emoji / cụm nhiều từ, không khớp giữa từ; "vết màu nâu" không bị coi là tự pha; khớp bệnh theo mã, tên Việt, "Late blight" + cây; JSON trong fence + dấu phẩy thừa; prompt bỏ đoạn trùng, có mã bệnh, không có `healthy`).
- Playwright trên DB local (không lưu gì): nhóm "Ridomil Gold 68WG" 2 đoạn → bảng và modal có `<mark>`; prompt chung 2 đoạn, prompt riêng 1 đoạn; form mở từ modal có "Tìm với AI (2 đoạn trích)"; JSON có `["Tomato___Late_blight", "Late blight", "Bệnh lạ XYZ"]` + bệnh chọn sẵn Khoai tây → 2 chip (giữ bệnh cũ), cảnh báo "Không khớp được bệnh: Bệnh lạ XYZ", link nguồn điền tự động, link `javascript:` bị bỏ; JSON HOMEMADE + `mentions_differ` → giữ bệnh, hiện 2 cảnh báo; form thủ công "Trichoderma" sinh học → chip "Chế phẩm sinh học", prompt ghi "Không có đoạn trích".

---

## 4. ĐỢT 2 (16/11/2026): BỆNH HẠI THEO BÀI, GỘP ĐOẠN, GỌN NÚT

> Đợt 2 thay một số nội dung ở mục 3.2: modal không còn nút "Tìm với AI" / "Prompt riêng đoạn này"; nút cạnh ô link đổi thành "Tìm link với AI".

### 4.1. Vấn đề
| # | Vấn đề | Nguyên nhân |
|---|---|---|
| V6 | Tạo SP từ nhóm gợi ý làm **mất** bệnh của các đoạn trích khác | Form chỉ điền bệnh của đoạn đầu, nhưng server đánh dấu `ADDED` mọi gợi ý cùng tên, kể cả gợi ý có bệnh chưa được gắn. |
| V7 | 4 đoạn cùng 1 bài, cùng 1 bệnh vẫn bị tách thành 4 tab / 4 đoạn trong prompt | Mỗi đoạn trích là một bản ghi `KnowledgeSource` riêng (khác `knowledge_source_id`). |
| V8 | Quá nhiều nút AI và nút tạo / gắn SP | 4 chỗ tạo prompt (trong đó "Sao chép Prompt cho Gemini" trùng hẳn với "Tìm với AI"), 4 kiểu nút tạo / gắn. |
| V9 | Nút "Gắn SP" ở dòng gộp báo "Gợi ý này đã được xử lý trước đó" | Dòng gộp gửi gợi ý đầu nhóm, có thể đã `ADDED`, thay vì gợi ý còn chờ. |

### 4.2. Quyết định (theo trao đổi với trưởng nhóm)
- **Bệnh hại mục tiêu**: bài nói về bệnh nào thì điền sẵn bệnh đó (cả vật tư canh tác). Gợi ý cho cây / bệnh khác xuất hiện sau thì **Gắn SP** sau, và bệnh đó được gắn thêm.
- **Hai prompt tách riêng**:
  - Nút cạnh ô link "Tìm link với AI" chỉ nhờ AI tìm link bài viết / trang nguồn.
  - Prompt trả JSON để điền form chỉ còn ở chế độ Dev (`</>`), giữ nguyên nội dung.
- Gợi ý Tra Google giữ nguyên.

### 4.3. Đã làm
| Nơi | Thay đổi |
|---|---|
| `MedicinesController.Create` | Chỉ đóng (`ADDED`) gợi ý cùng tên có bệnh đã gắn hoặc không có bệnh; còn lại giữ `PENDING`. Trả thêm `suggestions_kept_pending`. |
| `product-research.ts` | `mergeEvidencesByArticle`: gộp đoạn cùng link bài + cùng bệnh, bỏ đoạn trùng. Prompt JSON đếm theo `[Bài n]`, tối đa 4 bài. Thêm `buildLinkSearchPrompt`: kèm đoạn trích, ưu tiên nguồn theo loại (nhãn thuốc, cách pha chế, giống…), trả 3–5 link, cấm bịa link, không JSON, không mã bệnh. |
| `AdminInventoryPage.tsx` – form | Điền sẵn mọi bệnh của các đoạn đang chờ trong nhóm. Nút "Tìm link với AI (n bài trích)". Toast báo số gợi ý còn chờ sau khi tạo. |
| `AdminInventoryPage.tsx` – modal | Tab = 1 bài + 1 bệnh, hiện đủ các đoạn trong tab. Ô tick "Dùng bài này": bài bỏ tick không dùng cho bệnh điền sẵn, prompt, Tra Google. Bỏ nút "Tìm với AI", "Prompt riêng đoạn này", "Tạo SP từ đoạn này", "Gắn SP đoạn này". |
| `AdminInventoryPage.tsx` – bảng | Tạo / Gắn / Bỏ qua ở dòng gộp và modal dùng gợi ý còn `PENDING`. |

### 4.4. Kiểm thử
- Script esbuild: 23/23 ca cũ, cùng 6/6 ca mới (gộp cùng bài + cùng bệnh, 2 `KnowledgeSource` cùng link thành 1 khối, prompt JSON 3 khối có "2 đoạn cùng bài", prompt link không có JSON / mã bệnh, tỏi tự pha thì tìm cách pha chế, nhập tay không đoạn trích).
- Playwright trên DB local, dữ liệu thử "Zineb R2TEST" (đã xóa sau test). Gồm 4 đoạn: 2 đoạn cùng bài cà chua mốc sương, 1 đoạn khoai tây mốc sương cùng bài, 1 đoạn bài khác cà chua đốm vòng.
  - Modal "4 đoạn trích · 3 bài"; không còn nút cũ.
  - Bỏ tick bài đốm vòng → form điền 2 bệnh mốc sương; nút "Tìm link với AI (2 bài trích)"; prompt link 2 bài, không có JSON.
  - Tạo SP → DB: 3 gợi ý `ADDED` + 1 `PENDING`, sản phẩm gắn 2 bệnh; toast "Còn 1 gợi ý…".
  - Gắn SP ở dòng còn chờ (trước khi sửa V9 báo lỗi "đã được xử lý") → `LINKED`, sản phẩm gắn 3 bệnh.
- `tsc --noEmit` exit 0, `dotnet build` và `npm run build` thành công.

---

## 5. CÒN LẠI / HƯỚNG SAU
- Bỏ tick một bài trong modal chỉ áp dụng cho **Tạo SP** và prompt. **Gắn SP** vẫn gắn mọi gợi ý đang chờ cùng tên kèm bệnh của chúng (server). Nếu cần, mở rộng API link nhận danh sách gợi ý được chọn.
- Script Playwright đợt 1 (`t17_e2e.js`) dùng các nút đã bỏ ở modal, cần viết lại nếu chạy lại.
- Chưa thử với câu trả lời thật của Gemini / ChatGPT; nên thử 3–5 vật tư thật (thuốc hóa học, chế phẩm sinh học, dịch tỏi tự pha, hạt giống) và chỉnh prompt nếu AI hay trả sai định dạng.
- Có thể thêm nút gọi Gemini API (grounding) từ server để bỏ bước copy/dán; cần quyết định chi phí.
- `matchDisease` chỉ khớp tên có trong CSDL; tên dân gian khác (vd "sương mai" so với "mốc sương") vẫn phải chọn tay, nhưng prompt đã đưa mã nên AI thường trả đúng mã.
- Chưa có công cụ unit test trong `frontend/web`; script kiểm tra đang để ngoài repo.
