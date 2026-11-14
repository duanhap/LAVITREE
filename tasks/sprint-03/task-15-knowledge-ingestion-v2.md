# TASK-15: Nhập bài báo v2 — Dán cả trang, AI tự điền, ảnh triệu chứng, gợi ý vật tư
* **Sprint**: Sprint 3
* **Phân hệ**: frontend/web (Admin), backend/core-api, backend/agent-service, docs
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Trưởng nhóm (chia lại cho TVA/TVB sau nếu cần)
* **Độ ưu tiên**: P1 (Pha 1), P2 (Pha 2–3), P3 (Pha 4)
* **Tạo ngày**: 11/11/2026, tổng hợp từ buổi test nhập bài báo của trưởng nhóm

---

## 1. BỐI CẢNH: VẤN ĐỀ KHI TEST

| # | Vấn đề | Nguyên nhân trong code hiện tại |
|---|---|---|
| V1 | Copy bài báo phải bôi đen chính xác, kéo dính menu, quảng cáo, nút chia sẻ | Admin tự lọc rác bằng tay. Thực ra Core đã tách đoạn và AI đã gán nhãn `null` cho đoạn rác (contract 3.10), nhưng giao diện chưa hướng dẫn và chưa lọc trước. |
| V2 | Phải tự gõ tên bài, cơ quan, năm, cây, bệnh | Agent `label-paragraphs` chỉ trả nhãn từng đoạn |
| V3 | Chọn 4 đoạn Điều trị là hết chỗ, không chọn thêm Triệu chứng/Phòng ngừa được | Giới hạn cứng 4 đoạn mỗi `source_url` |
| V4 | Bài báo có ảnh triệu chứng (lá, quả) nhưng hệ thống chỉ lưu chữ | Chưa có chỗ lưu ảnh tri thức |
| V5 | Bài nhắc tới thuốc, chế phẩm sinh học, lưới, bẫy… nhưng cửa hàng không biết | Chưa có liên kết tri thức → cửa hàng |

---

## 2. CÁC QUYẾT ĐỊNH ĐÃ CHỐT (11/11/2026)

1. **AI chỉ gợi ý, Admin quyết định.** AI không tự tạo sản phẩm, không tự viết đoạn tri thức, không tự gắn thuốc với bệnh.
2. **Đoạn trích vẫn là nguyên văn.** Client chỉ gửi số đoạn, Core lấy chữ từ bản lưu tạm (giữ nguyên contract 3.11).
3. **Sản phẩm từ gợi ý do Admin tự tra cứu và nhập:** PHI, mô tả, ảnh, link nguồn. Cửa hàng không bán thì đánh dấu "Không bán", để người dùng vẫn biết tên mà mua nơi khác.
4. **"Không bán" khác "Hết hàng".** Không dùng `StockQuantity = 0` để biểu thị "không bán".
5. **Chức năng quản lý thuốc cấm làm sau,** sau khi đã nhập đủ thuốc và biện pháp. Trong lúc chờ có chốt chặn tạm (mục 5.4).
6. **AI viết đoạn SUMMARY: hoãn** (Pha 4). Đi ngược nguyên tắc "Agent không viết ra chữ nào" của contract 4.4 nên phải có Admin duyệt.

---

## 3. PHA 1 (P1): DÁN CẢ TRANG, AI TỰ ĐIỀN, NỚI GIỚI HẠN TRÍCH

### 3.1. Dán cả trang (V1)
- [ ] Ô dán bài báo nhận cả clipboard `text/html`: lấy phần thân bài trên trình duyệt (ví dụ `@mozilla/readability`), không thấy thân bài thì dùng `text/plain`. **Server vẫn không tự tải URL** (giữ nguyên lý do chống SSRF ở contract 3.10).
- [ ] Bỏ trước trên client các dòng rác rõ ràng: dòng ngắn trùng lặp (menu), "Chia sẻ", "Bình luận", "Tin liên quan", số điện thoại/hotline đứng riêng một dòng. Server vẫn giữ luật bỏ đoạn < 40 ký tự.
- [ ] Hướng dẫn ngay trên form: "Nhấn Ctrl+A, Ctrl+C trên trang báo rồi dán vào đây, không cần bôi đen từng đoạn".
- [ ] Đoạn AI gán nhãn `null` (rác) mặc định thu gọn trong nhóm "Đoạn không liên quan", không xóa hẳn để Admin vẫn mở ra xem được.

### 3.2. AI tự điền thông tin bài (V2)
- [ ] Mở rộng `POST /internal/knowledge/label-paragraphs` (contract 4.4) để trả thêm `metadata`. **Dùng chung lần gọi Gemini gán nhãn**, không thêm request (gói miễn phí chỉ 15 request/phút).
  ```json
  {
    "labels": [{ "id": "P2", "unit_type": "SYMPTOMS" }],
    "metadata": {
      "model_class": "Tomato___Late_blight",
      "source_title": "…",
      "organization": "Trung tâm Khuyến nông Quốc gia",
      "published_date": "2023"
    }
  }
  ```
- [ ] Kiểm tra đầu ra bằng code:
  - `model_class` phải thuộc 38 lớp, không thì `null`.
  - `published_date` là năm 4 chữ số ≤ năm hiện tại.
  - `source_title` và `organization` ≤ 300 ký tự.
- [ ] Đổi thứ tự form: Bước 1 chỉ cần URL + chữ bài. Các ô tên bài/cơ quan/năm/cây/bệnh hiện ở Bước 2, điền sẵn theo AI, gắn nhãn **"AI đề xuất, kiểm tra lại"**. Admin sửa được và phải xác nhận trước khi commit.
- [ ] Agent lỗi thì các ô để trống cho Admin tự điền (giống luật hiện tại: `ai_suggestion_available: false`).
- [ ] Commit (contract 3.11) nhận thêm `model_class`, `source_title`, `organization`, `published_date` đã được Admin xác nhận.

### 3.3. Nới giới hạn trích dẫn (V3)
**Cần trưởng nhóm chốt con số.** Đề xuất mặc định:
- Bỏ giới hạn "4 đoạn".
- Tổng số ký tự các đoạn nguyên văn của một `source_url` ≤ **30%** độ dài `article_text`, trần cứng **8 đoạn**, mỗi đoạn vẫn ≤ 800 ký tự.
- **Không** giới hạn theo từng loại (cách chia 2/1/3/2 vẫn nghẽn với bài có 4 đoạn điều trị).
- Ghi trong báo cáo: Điều 25 Luật SHTT không quy định số đoạn; nhóm tự đặt ngưỡng theo tỉ lệ để bảo đảm trích "hợp lý", không thay thế bài gốc.

Để tính tỉ lệ khi Admin commit thêm lần sau, Core cần lưu `ArticleLength` của bài, chỉ lưu độ dài, không lưu toàn văn.

Phải sửa **cùng lúc** các chỗ đang cố định số 4:

| Chỗ | Vị trí |
|---|---|
| DTO | `backend/core-api/src/Lavitree.Application/DTOs/KnowledgeIngestionDtos.cs:81` (`MaxLength(4)`) |
| Core | `KnowledgeController.cs:439`, `:707`, `:766` |
| Web | `frontend/web/src/pages/AdminDashboard.tsx:281`, `:843`, `:934`. Thanh đếm đổi thành "Đã chọn X% bài (tối đa 30%) · N/8 đoạn" |
| Docs | `docs/architecture/api-contracts.md:749`, `docs/architecture/database-schema.md:63` |

---

## 4. PHA 2 (P2): ẢNH TRIỆU CHỨNG (V4)

### 4.1. CSDL: bảng mới `KnowledgeImages`
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | `SERIAL` PK | |
| `ModelClass` | `VARCHAR(100)` NOT NULL | Thuộc 38 lớp |
| `SourceUrl` | `VARCHAR(500)` NOT NULL | Bài gốc chứa ảnh |
| `ImageUrl` | `VARCHAR(500)` NULL | Ảnh ngoài (chỉ `https`) |
| `StorageKey` | `VARCHAR(300)` NULL | Ảnh tải lên MinIO. Phải có đúng một trong hai: `ImageUrl` hoặc `StorageKey` |
| `Caption` | `VARCHAR(300)` NOT NULL | Ví dụ: "Vết bệnh dạng giọt dầu mặt dưới lá" |
| `PlantPart` | `VARCHAR(20)` NOT NULL | `LEAF` \| `FRUIT` \| `STEM` \| `WHOLE_PLANT` |
| `Credit` | `VARCHAR(200)` NOT NULL | Tác giả/cơ quan sở hữu ảnh |
| `LicenseNote` | `VARCHAR(200)` NULL | "Ảnh nhóm tự chụp", "CC BY 4.0"… |
| `IsManualApproved` | `BOOLEAN` DEFAULT FALSE | |
| `CreatedAt` | `TIMESTAMPTZ` | |

### 4.2. Việc cần làm
- [ ] Form Admin "Thêm ảnh triệu chứng": dán URL hoặc tải ảnh lên, kèm chú thích, bộ phận cây, ghi nguồn.
- [ ] Ảnh tải lên đi qua đúng các bước như ảnh khám lá: kiểm tra định dạng/kích thước, vẽ lại để bỏ EXIF/GPS, lưu MinIO.
- [ ] Ảnh URL ngoài: hiển thị kèm dòng "Ảnh: <Credit> · Xem bài gốc". Ảnh không tải được thì ẩn, không làm vỡ trang.
- [ ] Sổ tay (`/handbook/:classCode`): thêm mục "Hình ảnh triệu chứng" cho ảnh đã duyệt, tách theo bộ phận (lá/quả/thân).
- [ ] (Tùy chọn) Trang kết quả khám: hiện 1–2 ảnh lá đã duyệt để người dùng tự so sánh, ghi rõ "Ảnh tham khảo".

**Lưu ý bản quyền:** một tấm ảnh là trọn vẹn một tác phẩm. Ưu tiên ảnh tự chụp hoặc ảnh có giấy phép rõ. Ảnh từ báo thì để dạng URL kèm ghi nguồn, hạn chế sao chép về MinIO.

---

## 5. PHA 3 (P2): GỢI Ý VẬT TƯ TỪ TRI THỨC (V5)

### 5.1. Luồng
1. Trong lần gọi `label-paragraphs`, AI trả thêm danh sách **cụm từ được nhắc tới** trong mỗi đoạn: hoạt chất, chế phẩm sinh học, vật tư, biện pháp.
2. **Chống bịa bằng code:** chỉ giữ cụm từ xuất hiện **nguyên văn** trong chữ của đoạn đó (so chuỗi, không phân biệt hoa thường). Cụm không có trong đoạn thì bỏ.
3. Khi Admin commit, chỉ các cụm thuộc đoạn đã được tick mới được lưu thành gợi ý.
4. So khớp với cửa hàng theo **hoạt chất** (`ActiveIngredient`), không theo tên thương mại:
   - Khớp: hiện "Đã có trong cửa hàng: <tên SP>" kèm nút "Gắn với bệnh <X>" (Admin bấm mới tạo `DiseaseProducts`).
   - Không khớp: vào danh sách **"Gợi ý bổ sung"**.
5. Trang Admin "Gợi ý bổ sung":
   - Mỗi dòng gồm cụm từ, loại, bệnh, đoạn trích gốc và link bài.
   - Thao tác: **Thêm sản phẩm** (mở form, chỉ điền sẵn tên và loại) / **Gắn với SP có sẵn** / **Bỏ qua**.
   - Gợi ý đã bỏ qua không hiện lại với cùng cụm từ và cùng bệnh.

### 5.2. CSDL: bảng mới `ProductSuggestions`
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | `SERIAL` PK | |
| `KnowledgeSourceId` | `INT` FK → KnowledgeSources | Đoạn chứa cụm từ |
| `ModelClass` | `VARCHAR(100)` NOT NULL | |
| `MentionText` | `VARCHAR(200)` NOT NULL | Nguyên văn trong đoạn |
| `Kind` | `VARCHAR(20)` NOT NULL | `CHEMICAL` \| `BIOLOGICAL` \| `SUPPLY` \| `PRACTICE` |
| `Status` | `VARCHAR(20)` DEFAULT 'PENDING' | `PENDING` \| `ADDED` \| `LINKED` \| `DISMISSED` |
| `ProductId` | `INT` NULL FK → Products | Khi `ADDED`/`LINKED` |
| `CreatedAt`, `ResolvedAt` | `TIMESTAMPTZ` | |

`PRACTICE` (tỉa lá, luân canh…) chỉ để tham khảo, không có nút "Thêm sản phẩm".

### 5.3. Sửa bảng `Products`
| Thay đổi | Lý do |
|---|---|
| Thêm `Availability VARCHAR(20) NOT NULL DEFAULT 'IN_STOCK'`: `IN_STOCK` \| `OUT_OF_STOCK` \| `NOT_SOLD` | Phân biệt "hết hàng" với "cửa hàng không bán" |
| Thêm `MedicineType = 'Vật tư canh tác'` (lưới, bẫy dính, bạt phủ…) | Không phải thuốc |
| `ActiveIngredient`, `PhiDays` cho phép `NULL`, **chỉ khi** loại là `Vật tư canh tác` (CHECK constraint) | Vật tư không có hoạt chất và thời gian cách ly |
| **Bỏ giá trị mặc định `PhiDays = 7`.** Thuốc hóa học và sinh học bắt buộc nhập PHI | PHI mặc định dễ thành con số không ai kiểm chứng mà Lavi đem đi khuyên |
| Thêm `InfoSourceUrl VARCHAR(500)`, bắt buộc với thuốc | Nơi Admin tra PHI, liều (nhãn, trang nhà sản xuất) |
| `IsAllowed` mặc định **FALSE** khi tạo qua form mới | Xem 5.4 |

Migration cho dữ liệu cũ: sản phẩm hiện có giữ nguyên `PhiDays`; `Availability` = `IN_STOCK` nếu tồn > 0, ngược lại `OUT_OF_STOCK`.

### 5.4. Chốt chặn thuốc cấm tạm thời (trước khi có chức năng quản lý cấm)
- [ ] Form thêm sản phẩm đối chiếu hoạt chất với danh sách `BANNED_INGREDIENTS` (hiện ở `backend/agent-service/app/agent/guardrails.py:17`). Trùng thì cảnh báo đỏ và không cho bật `IsAllowed`.
- [ ] Sản phẩm mới mặc định `IsAllowed = false`. Admin phải tick "Đã đối chiếu Danh mục thuốc BVTV được phép sử dụng tại Việt Nam" mới bật được. Lavi và người dùng chỉ thấy sản phẩm `IsAllowed = true` (Core đã lọc sẵn).
- [ ] Tạm thời Core giữ một bản sao danh sách cấm, có comment trỏ về `guardrails.py`. Chức năng quản lý cấm (Pha 4) sẽ gộp về một bảng CSDL.

### 5.5. Hiển thị và Agent
- [ ] Cửa hàng:
  - `NOT_SOLD`: hiện nhãn "Cửa hàng không bán", không có nút mua, kèm dòng "Bạn có thể tìm mua tại đại lý vật tư nông nghiệp. Đọc kỹ nhãn trước khi dùng".
  - `OUT_OF_STOCK`: giữ như hiện tại ("Hết hàng").
  - Thêm bộ lọc "Chỉ hàng đang bán".
- [ ] `backend/agent-service/app/mcp/client.py:61` hiện **loại cả danh sách** nếu một món thiếu `phi_days`. Phải sửa để `Vật tư canh tác` không cần PHI, nếu không thêm một cái lưới là Lavi mất mọi gợi ý thuốc.
- [ ] `verify_phi_safety` bỏ qua vật tư. Schema MCP (`schema.py:143`) thêm `availability`, `medicine_type`.
- [ ] Lavi gợi ý sản phẩm `NOT_SOLD` thì nói rõ cửa hàng không bán và **vẫn nêu PHI** theo dữ liệu Admin đã nhập. Không gợi ý `draft_order` cho sản phẩm `NOT_SOLD`/`OUT_OF_STOCK`.

---

## 6. PHA 4 (P3): ĐỂ SAU
- [ ] **Quản lý thuốc cấm:** bảng `BannedIngredients` (hoạt chất, căn cứ pháp lý, ngày hiệu lực). Agent và Core cùng đọc, thay cho danh sách viết cứng. Rà lại toàn bộ `Products`.
- [ ] **Đoạn SUMMARY do AI viết:** chỉ tóm tắt từ các đoạn đã tick, không chứa liều lượng (chạy qua `strip_unsourced_dosage`). Lưu `IsVerbatim = false`, `IsManualApproved = false`, Admin sửa/duyệt mới vào RAG, giao diện hiển thị là "Tóm tắt". Phải sửa contract 3.11 và 4.4 trước.

---

## 7. THỨ TỰ LÀM
1. Chốt con số ở mục 3.3.
2. Sửa `docs/architecture/api-contracts.md` (3.10, 3.11, 4.4 và API mới cho ảnh và gợi ý) và `docs/architecture/database-schema.md` (`KnowledgeImages`, `ProductSuggestions`, sửa `Products`) **trước khi code**.
3. Pha 1 → Pha 3 → Pha 2. Pha 3 trước Pha 2 vì đụng tới an toàn của Agent (PHI, thuốc cấm).
4. Migration chạy trên CSDL local trước. Chạy trên Supabase chung phải được trưởng nhóm duyệt.

---

## 8. TIÊU CHÍ NGHIỆM THU
- [ ] Ctrl+A cả trang báo khuyến nông → dán → phần thân bài được giữ, menu/quảng cáo bị bỏ hoặc nằm trong nhóm "không liên quan". Thử ít nhất 3 trang báo khác nhau, ghi tên trang vào ticket.
- [ ] Các ô thông tin bài được điền sẵn. `model_class` sai/không thuộc 38 lớp thì để trống. Tắt Agent thì form vẫn dùng được.
- [ ] Chọn được 4 đoạn Điều trị + Triệu chứng + Phòng ngừa trong cùng bài (trong giới hạn đã chốt). Vượt giới hạn thì Core trả `400` kể cả khi gọi API thẳng, không qua giao diện.
- [ ] Gửi request commit có chữ đoạn tự sửa thì Core vẫn lưu đúng chữ gốc (giữ test hiện có).
- [ ] Cụm từ AI trả về không có trong đoạn thì không xuất hiện trong "Gợi ý bổ sung" (test với dữ liệu Agent giả).
- [ ] Thêm sản phẩm thuốc không nhập PHI hoặc link nguồn → bị từ chối. Hoạt chất thuộc danh sách cấm → không bật được `IsAllowed`.
- [ ] Thêm một sản phẩm "Lưới chắn côn trùng" (`Vật tư canh tác`, `NOT_SOLD`) → Lavi vẫn gợi ý thuốc bình thường cho cùng bệnh (hồi quy cho lỗi ở `client.py:61`).
- [ ] Sản phẩm `NOT_SOLD` không thêm được vào giỏ, kể cả gọi API đặt hàng trực tiếp.
- [ ] Ảnh tải lên đã mất EXIF/GPS. Ảnh URL hỏng không làm vỡ trang Sổ tay.
- [ ] Các test hiện có của Core và Agent vẫn xanh. Ghi số test vào WORKLOG.

---

## 9. PHỤ LỤC: THỐNG NHẤT ĐIỀU CHỈNH KỸ THUẬT & TRIỂN KHAI PHA 1 (11/11/2026)

*(Ghi chú: Toàn bộ phần 1 đến 8 ở trên được giữ nguyên bản gốc để đối chiếu. Phần 9 này ghi nhận các chi tiết kỹ thuật được tối ưu hóa trước khi bắt tay vào code Pha 1).*

### 9.1. Tối ưu bóc tách HTML bài báo (Mục 3.1)
* **Quyết định**: Không cài thêm thư viện `@mozilla/readability` (tránh phình bundle và xung đột Vite/JSDOM).
* **Giải pháp**: Sử dụng **`DOMParser` native** của trình duyệt. 
  - Tự động bóc tách vùng nội dung chính (`<article>`, `[role="main"]`, `.content`, `.post-content`, `.detail-content`, fallback `<body>`).
  - Thanh lọc các thẻ và node rác: `<script>`, `<style>`, `<nav>`, `<header>`, `<footer>`, `<aside>`, các class chứa `menu`, `share`, `social`, `comment`, `banner`, `hotline`.
  - Giữ lại các thẻ đoạn `<p>`, `<li>`, tiêu đề `h1..h6`, xử lý ngắt dòng sạch `\n\n`. Hoàn toàn nhẹ (0 KB bundle size thêm), tốc độ tức thì.

### 9.2. Luồng AI tự điền thông tin và Schema (Mục 3.2)
* **Bước 1 (Dán bài)**: `model_class`, `source_title`, `organization` chuyển thành **Optional** (không bắt buộc).
  - Admin có thể chọn trước Cây - Bệnh nếu đã biết chắc, hoặc để trống để AI tự nhận diện.
  - Request sang Agent `/internal/knowledge/label-paragraphs` cho phép `model_class` là `null`/rỗng. Nếu rỗng, Gemini sẽ đọc nội dung bài báo và tự xác định `model_class` thuộc 38 lớp chuẩn của Lavitree.
* **Bước 2 (Duyệt đoạn & Thông tin)**:
  - Cột duyệt hiển thị các ô Tiêu đề, Cơ quan, Năm, Cây - Bệnh được điền sẵn với huy hiệu `"AI đề xuất, vui lòng kiểm tra lại"`.
  - Admin có quyền chỉnh sửa trực tiếp hoặc đổi dropdown Cây - Bệnh trước khi bấm "Duyệt & Lưu".
  - Endpoint `POST /api/v1/knowledge/ingestions/{id}/commit` nhận thêm các trường metadata đã được Admin duyệt/chỉnh sửa để lưu vào bảng `KnowledgeSources`.

### 9.3. Công thức trích dẫn hợp lý (Mục 3.3)
* **Chốt công thức trích dẫn**:
  $$\text{Tổng ký tự trích dẫn} \le \max(1.200\text{ ký tự},\ 30\% \times \text{Độ dài bài báo})$$
  - **Trần cứng tối đa**: **8 đoạn** nguyên văn cho mỗi URL (nâng từ 4 lên 8).
  - Mỗi đoạn nguyên văn: vẫn tối đa **800 ký tự**.
  - Không phân biệt giới hạn theo phân loại (Admin được quyền chọn linh hoạt theo giá trị thực tế của bài).
  - Core API lưu `ArticleLength` trong phiên lưu tạm (session RAM) và kiểm tra hạn ngạch khi Admin commit.

### 9.4. Nhật ký công việc Pha 1
* `[x]` Chốt các điều chỉnh kỹ thuật Pha 1.
* `[x]` Cập nhật `docs/architecture/api-contracts.md` (Mục 3.10, 3.11, 4.4) và `docs/architecture/database-schema.md` (trần 8 đoạn trích).
* `[x]` Cập nhật `backend/agent-service`:
  - `schema.py`: `model_class` optional trong request; thêm `metadata` trong response.
  - `pipeline.py`: prompt Gemini đa nhiệm (nhãn + metadata); guardrail kiểm tra 38 lớp, năm <= hiện tại, chuỗi <= 300 ký tự; nâng trần gợi ý đoạn lên tối đa 8.
  - `main.py`: trả metadata ra API `/internal/knowledge/label-paragraphs`.
  - `test_rag_accuracy.py`: cập nhật test case bảo đảm pass 100%.
* `[x]` Cập nhật `backend/core-api`:
  - `KnowledgeIngestionDtos.cs`: mở rộng DTOs (optional metadata ở Bước 1, suggested metadata trả về, commit nhận metadata & max 8 đoạn).
  - `KnowledgeController.cs`: nâng trần 8 đoạn, kiểm tra trích dẫn $\le \max(1200, 30\%)$, commit metadata đã duyệt.
* `[x]` Cập nhật `frontend/web`:
  - `AdminDashboard.tsx`: smart onPaste HTML via `DOMParser` native loại bỏ menu/quảng cáo rác, sắp xếp lại form Bước 1 & Bước 2 (ô metadata AI đề xuất cho phép chỉnh sửa), bộ đếm 8 đoạn & % quota bài viết, nhóm đoạn rác thu gọn.
* `[x]` Verify toàn diện: Agent test pass, Core API `dotnet build` 0 warning 0 error, Frontend `npm run build` thành công.

---

### 9.5. Quyết định Kiến trúc & Triển khai Pha 2: Ảnh Triệu chứng Bệnh Cây Thực địa (Mục 3.4 & 4.2)
* **Mục tiêu**: Bổ sung kho ảnh triệu chứng thực tế phục vụ nông dân tra cứu trên Sổ tay bệnh học (`/handbook/:classCode`) và Admin quản lý tập trung trên Admin Dashboard (`/admin/images`).
* **Kiến trúc Cơ sở dữ liệu**:
  - Bảng mới `KnowledgeImages`: `Id` (SERIAL), `ModelClass` (INDEX, VARCHAR 100), `SourceUrl` (VARCHAR 500), `ImageUrl` (VARCHAR 500, NULL), `StorageKey` (VARCHAR 255, NULL), `Caption` (VARCHAR 300), `PlantPart` (VARCHAR 20, default 'LEAF'), `Credit` (VARCHAR 200), `LicenseNote` (VARCHAR 200, NULL), `IsManualApproved` (BOOLEAN, default TRUE), `IsDeleted` (BOOLEAN, default FALSE), `CreatedAt`, `UpdatedAt`.
  - Phân loại bộ phận cây (`PlantPart`): `LEAF` (Lá), `FRUIT` (Hoa / Quả), `STEM` (Thân / Cành), `WHOLE_PLANT` (Toàn cây).
  - Migration: `20261111073000_AddKnowledgeImages`.
* **Quy chuẩn Bảo mật & Lưu trữ**:
  - Tải tệp: Lưu trữ vào MinIO bucket `lavitree-images`. Toàn bộ tệp ảnh tải lên bắt buộc phải đi qua `ImageMetadataStripper.StripAsync()` để thanh lọc toàn bộ EXIF, GPS, camera metadata, re-encode trước khi lưu vào MinIO.
  - Ảnh ngoài: Bắt buộc sử dụng giao thức an toàn `https://`. Trình duyệt trực tiếp tải từ CDN/URL gốc (Zero SSRF rủi ro cho server backend).
  - Khả năng chịu lỗi ảnh: Frontend gắn bộ lắng nghe `onError` để tự động ẩn ảnh hỏng một cách an toàn mà không làm gãy giao diện.
* **Tích hợp Sổ tay Bệnh học (`HandbookPage.tsx`)**:
  - Thêm khu vực "Hình ảnh triệu chứng thực địa" ngay dưới phần mô tả triệu chứng và phòng ngừa.
  - Bộ lọc pill tức thì theo bộ phận: `Tất cả`, `Lá cây`, `Hoa / Quả`, `Thân / Cành`, `Toàn cây`.
  - Hiển thị chú thích, nguồn bài viết gốc (`source_url` external link), trích dẫn tác giả (`credit`).
  - Hỗ trợ Dialog xem ảnh phóng to (lightbox) khi bấm vào từng ảnh.
* **Tích hợp Quản trị Admin (`AdminDashboard.tsx`, `AdminShell.tsx`, `router.tsx`)**:
  - Route mới: `/admin/images` hiển thị tab "Ảnh triệu chứng thực địa".
  - Thanh công cụ lọc mạnh mẽ: Lọc theo Cây trồng, Bệnh hại, Bộ phận cây, Trạng thái duyệt (Đã duyệt / Chờ duyệt), ô tìm kiếm từ khóa.
  - Dialog "Thêm ảnh triệu chứng mới": Hỗ trợ 2 phương thức (Tải tệp ảnh MinIO tự xóa EXIF hoặc Dán HTTPS URL), 2 dropdown phụ thuộc Cây - Bệnh, chọn bộ phận cây, nhập chú thích và bản quyền.
  - Tích hợp liên kết nhanh từ Tab 1 "Nhập bài báo": Nút "Thêm ảnh triệu chứng từ bài này" giúp điền sẵn `source_url`, `model_class`, `credit` để thêm ảnh nhanh trong luồng đọc bài báo.
  - Nút chuyển đổi nhanh trạng thái Duyệt / Bỏ duyệt (`PATCH /api/v1/knowledge/images/{id}/approve`) và nút Xóa mềm (`DELETE /api/v1/knowledge/images/{id}`).

### 9.6. Nhật ký công việc Pha 2
* `[x]` Tạo thực thể `KnowledgeImage.cs` trong `Lavitree.Domain`.
* `[x]` Đăng ký `DbSet<KnowledgeImage> KnowledgeImages` trong `LavitreeDbContext.cs`.
* `[x]` Tạo Migration EF Core `20261111073000_AddKnowledgeImages`.
* `[x]` Tạo DTOs `KnowledgeImageDtos.cs` (`KnowledgeImageDto`, `CreateKnowledgeImageRequestDto`, `ApproveKnowledgeImageRequestDto`).
* `[x]` Cập nhật `KnowledgeController.cs` với 4 endpoints chuẩn RESTful:
  - `GET /api/v1/knowledge/images` (public đã duyệt, admin xem toàn bộ & lọc).
  - `POST /api/v1/knowledge/images` (upload file MinIO + EXIF stripper hoặc HTTPS URL ngoài).
  - `PATCH /api/v1/knowledge/images/{id}/approve` (admin duyệt / bỏ duyệt).
  - `DELETE /api/v1/knowledge/images/{id}` (admin xóa mềm).
* `[x]` Cập nhật `HandbookPage.tsx`:
  - Fetch ảnh triệu chứng theo `model_class` khi mở chi tiết bệnh.
  - Render thư viện ảnh triệu chứng phân loại theo bộ phận cây (Lá, Quả, Thân, Toàn cây).
  - Modal phóng to ảnh kiểm tra chi tiết vết bệnh kèm ghi nhận bản quyền tác giả và liên kết bài gốc.
* `[x]` Cập nhật `AdminDashboard.tsx`, `AdminShell.tsx`, `router.tsx`:
  - Thêm menu sidebar `/admin/images` vào `AdminShell`.
  - Khai báo route `/admin/images` trong `router.tsx`.
  - Thiết kế tab quản trị ảnh triệu chứng, dialog thêm ảnh (MinIO upload / HTTPS link), dialog xác nhận xóa, toggle duyệt/bỏ duyệt.
  - Nút thêm ảnh triệu chứng liên kết trực tiếp từ form nhập bài báo Tab 1.
* `[x]` Cập nhật tài liệu kiến trúc:
  - `docs/architecture/api-contracts.md`: Thêm Mục 3.12 tài liệu hóa trọn vẹn 4 API của `KnowledgeImages`.
  - `docs/architecture/database-schema.md`: Thêm Mục 4b tài liệu hóa cấu trúc bảng `KnowledgeImages`.
* `[x]` Biên dịch và kiểm thử thành công:
  - Core API `dotnet build`: `0 Warning(s), 0 Error(s)`.
  - Frontend `npm run build`: `built in 6.80s`, 0 error.

---

### 9.7. Quyết định Kiến trúc & Triển khai Pha 3: Gợi ý Vật tư & Hoạt chất từ Tri thức (Mục 3.5 & V5)
* **Bối cảnh & Động lực**:
  - Khi dán bài báo khuyến nông chứa giải pháp phòng trừ (`TREATMENT`, `PREVENTION`), bài báo thường nhắc đến tên hoạt chất, thuốc BVTV sinh học/hóa học, hoặc vật tư canh tác (bẫy dính màu vàng, lưới chắn côn trùng, bao bọc trái, vôi bột...).
  - Trước đây: Không có cơ chế tự động kết nối giữa bài báo khoa học và danh mục vật tư trong tiệm, Admin phải tự nhớ và nhập tay lại toàn bộ.
  - Vấn đề phát sinh:
    1. Vật tư canh tác không phải là thuốc hóa học nên không có hoạt chất và không có thời gian cách ly PHI (mặc định trước đây bắt buộc `PhiDays = 7` gây cảnh báo sai cho nông dân lúc cận thu hoạch).
    2. Cửa hàng Lavitree có thể không kinh doanh sản phẩm này nhưng vẫn muốn gợi ý khuyến nông cho bà con (cần cờ `Availability = NOT_SOLD` kèm lời khuyên mua tại đại lý địa phương).
    3. Nguy cơ AI bịa ra tên thuốc hoặc hoạt chất không có trong bài báo gốc (ảo giác).
* **Kiến trúc & Giải pháp triển khai**:
  1. **Trích xuất Mention với Guardrail Anti-Hallucination bằng Code**:
     - Agent Service mở rộng schema `SuggestedParagraph` chứa danh sách `mentions: [{ text, kind }]`.
     - Phân loại 4 nhóm: `CHEMICAL` (Thuốc hóa học), `BIOLOGICAL` (Chế phẩm sinh học), `SUPPLY` (Vật tư canh tác: lưới, bẫy dính...), `PRACTICE` (Biện pháp canh tác).
     - **Chống bịa 100% bằng code**: Hàm `_filter_suggestions` bắt buộc kiểm tra `m_text.lower() in p_text.lower()`. Bất kỳ cụm từ nào Gemini tự ý suy diễn hoặc bịa đặt mà không xuất hiện nguyên văn trong đoạn trích sẽ bị loại bỏ ngay lập tức ở tầng Python.
  2. **Bảng `ProductSuggestions` & Khớp tự động khi Duyệt bài**:
     - Entity `ProductSuggestion` (Id, KnowledgeSourceId, ModelClass, MentionText, Kind, Status, ProductId, CreatedAt, ResolvedAt).
     - Khi Admin bấm "Duyệt & Lưu bài" (`POST /knowledge/ingestions/{id}/commit`): Core API quét toàn bộ mentions trong các đoạn đã chọn, đối chiếu với bảng `Products`.
       - Nếu trùng hoạt chất hoặc tên thuốc trong kho $\rightarrow$ Tạo bản ghi gợi ý trạng thái `LINKED` và liên kết `DiseaseProducts`.
       - Nếu chưa có $\rightarrow$ Lưu trạng thái `PENDING` để Admin xử lý tại kho.
  3. **Hoàn thiện bảng `Products` & Quản lý Kho**:
     - `MedicineType`: Cho phép `'Vật tư canh tác'`.
     - `ActiveIngredient`: Chuyển thành `NULLABLE` (vật tư canh tác không có hoạt chất hóa học).
     - `PhiDays`: Chuyển thành `NULLABLE`, bỏ giá trị mặc định 7 ngày (vật tư canh tác không áp dụng PHI).
     - `Availability`: 3 trạng thái chuẩn (`IN_STOCK`: Đang bán, `OUT_OF_STOCK`: Tạm hết hàng, `NOT_SOLD`: Cửa hàng không bán - chỉ tư vấn kỹ thuật).
     - `InfoSourceUrl`: Lưu URL bài báo khoa học làm căn cứ kỹ thuật.
     - **Guardrail hóa chất cấm**: Đối chiếu với danh sách `BANNED_INGREDIENTS` của `backend/agent-service/app/agent/guardrails.py` (8 hoạt chất: `paraquat`, `2,4-d`, `chlorpyrifos`, `carbofuran`, `glyphosate`, `monocrotophos`, `methamidophos`, `endosulfan`, kèm các cách viết khác và tên thương phẩm `gramoxone`; chưa đối chiếu từng dòng với phụ lục TT 75/2025, xem BUG-93), quét cả tên và hoạt chất với mọi loại sản phẩm. Chặn không cho phép lưu hành (`IsAllowed = false`) nếu phát hiện hoạt chất cấm.
  4. **Tác tử MCP Tool & FastMCP Server**:
     - FastMCP Tool `verify_phi_safety`: Cho phép `phi_days: Optional[int] = None`. Nếu là vật tư canh tác (`phi_days is None`), trả về `is_safe = True`, `risk_level = 'NOT_APPLICABLE'` và không cảnh báo vi phạm thu hoạch.
     - Tool `query_pesticide_store`: Trả về `availability`, hỗ trợ lọc vật tư sinh học & canh tác an toàn.
  5. **Giao diện Cửa hàng (`StorePage.tsx`)**:
     - Sản phẩm `Availability = 'NOT_SOLD'`: Hiển thị huy hiệu xám `"Cửa hàng không bán"`, vô hiệu hóa nút mua hàng, hiển thị thông báo hướng dẫn nông dân tìm mua tại cửa hàng vật tư nông nghiệp địa phương.
     - Thêm bộ lọc tab `"Vật tư canh tác"`.
     - Thêm công tắc `"Chỉ hàng đang bán"`.
     - Core API `OrdersController.cs`: Chặn tuyệt đối hành vi mua sản phẩm `Availability = 'NOT_SOLD'`.
  6. **Giao diện Quản trị Admin (`AdminDashboard.tsx`)**:
     - Bước 2 duyệt bài báo: Hiển thị badge pill các hoạt chất / vật tư trích xuất dưới từng đoạn văn bản.
     - Tab Kho hàng (`inventory`): Thiết kế 2 subtab trực quan:
       - Subtab 1 `"Kho thuốc & Vật tư"`: Bảng quản lý kho đầy đủ giá bán, tồn kho, PHI, tình trạng bán, lưu hành, nút "Thêm thuốc / Vật tư mới" và dialog "Sửa thông số" (cho phép cập nhật availability, PHI null, URL nguồn).
       - Subtab 2 `"Gợi ý vật tư từ bài báo"`: Hiển thị badge số lượng gợi ý chờ xử lý (`PENDING`), bảng lọc theo trạng thái và loại vật tư, hiển thị trích đoạn bằng chứng và bài viết gốc.
       - Hành động nhanh: Nút `"Tạo SP"` (mở dialog tạo sản phẩm điền sẵn toàn bộ dữ liệu từ bài báo), `"Gắn SP"` (mở modal chọn sản phẩm trong kho để liên kết), `"Bỏ qua"` (dismiss gợi ý).

### 9.8. Nhật ký công việc Pha 3
* `[x]` Mở rộng schema Agent Service (`schema.py`):
  - Model `MentionItem` (`text`, `kind`).
  - Trường `mentions` trong `SuggestedParagraph`.
  - `phi_days` và `active_ingredient` optional trong `PesticideItem`, `VerifyPhiSafetyInput`, `VerifyPhiSafetyOutput`.
* `[x]` Cập nhật logic Agent Service (`pipeline.py`, `tools.py`):
  - Bổ sung `VALID_MENTION_KINDS = {"CHEMICAL", "BIOLOGICAL", "SUPPLY", "PRACTICE"}`.
  - Thuật toán `_filter_suggestions` kiểm tra `m_text.lower() in p_text.lower()` chống ảo giác.
  - Cập nhật prompt Gemini đa nhiệm trích xuất cả nhãn đoạn và vật tư/hoạt chất xuất hiện nguyên văn.
  - Cập nhật `verify_phi_safety` hỗ trợ `phi_days = None` trả về `NOT_APPLICABLE`.
* `[x]` Cập nhật Cơ sở dữ liệu Core API:
  - Tạo thực thể `ProductSuggestion.cs` trong `Lavitree.Domain`.
  - Mở rộng `Product.cs`: `Availability`, `InfoSourceUrl`, `ActiveIngredient` (nullable), `PhiDays` (nullable), `ProductSuggestions`.
  - Đăng ký `DbSet<ProductSuggestion> ProductSuggestions` trong `LavitreeDbContext.cs`.
  - Tạo Migration EF Core `20261111080000_AddProductSuggestionsAndRefineProducts.cs`.
* `[x]` Cập nhật DTOs & Controllers Core API:
  - `KnowledgeIngestionDtos.cs`: Thêm `MentionDto`, `ProductSuggestionDto`, `LinkProductSuggestionRequestDto`, `CreateProductRequestDto`.
  - `KnowledgeController.cs`: Nhận `mentions` từ Agent, tự động tạo `ProductSuggestions` (`LINKED` hoặc `PENDING`) khi commit bài báo; thêm các endpoint `GET /api/v1/knowledge/product-suggestions`, `POST .../link`, `POST .../dismiss`.
  - `MedicinesController.cs`: Đồng bộ danh sách 14 hoạt chất cấm TT 75/2025; hỗ trợ `Availability`, `InfoSourceUrl`, `MedicineType` trong `UpdateMedicineDto`; thêm endpoint `POST /api/v1/medicines` tạo sản phẩm mới và tự động đánh dấu suggestion `ADDED`.
  - `OrdersController.cs`: Kiểm tra và chặn mua sản phẩm có `Availability = 'NOT_SOLD'`.
* `[x]` Cập nhật Giao diện Cửa hàng (`StorePage.tsx`):
  - Render huy hiệu "Cửa hàng không bán", vô hiệu hóa nút mua hàng, hiển thị thông điệp khuyên nông dân mua tại địa phương.
  - Thêm bộ lọc phân loại "Vật tư canh tác" và công tắc "Chỉ hàng đang bán".
* `[x]` Cập nhật Giao diện Quản trị (`AdminDashboard.tsx`):
  - Hiển thị pill nhãn trích xuất vật tư nguyên văn dưới các thẻ đoạn bài báo Bước 2.
  - Thêm subtab chuyển đổi giữa "Kho thuốc & Vật tư" và "Gợi ý vật tư từ bài báo" (kèm badge đếm số lượng `PENDING`).
  - Bảng quản lý gợi ý vật tư đầy đủ chức năng: Lọc trạng thái, lọc loại vật tư, xem trích đoạn bằng chứng và link bài gốc.
  - Dialog "Tạo SP" prefilled từ gợi ý kèm cảnh báo hoạt chất cấm TT 75/2025.
  - Dialog "Gắn SP có sẵn" liên kết với sản phẩm trong kho.
  - Cập nhật dialog "Sửa thông số thuốc/vật tư" cho phép chỉnh sửa tình trạng bán, PHI nullable, URL nguồn.
* `[x]` Cập nhật Tài liệu Kiến trúc:
  - `docs/architecture/api-contracts.md`: Thêm Mục 3.13 đặc tả chi tiết 4 API gợi ý vật tư và tạo sản phẩm.
  - `docs/architecture/database-schema.md`: Cập nhật bảng `Products` và thêm bảng 11 `ProductSuggestions`.
* `[x]` Kiểm thử & Biên dịch:
  - Python tests Agent Service: Kiểm thử anti-hallucination guardrail và `verify_phi_safety` pass 100%.
  - Core API `dotnet build`: 0 Warning, 0 Error.
  - Frontend `npm run build`: `built in 4.07s`, 0 Error.

---

## 10. RÀ SOÁT CODE PHA 1–3 (11/11/2026, trưởng nhóm)

Rà toàn bộ thay đổi chưa commit của Pha 1–3. Các lỗi dưới đây **đã sửa**; ghi lại để thành viên biết vì sao code khác với nhật ký 9.4–9.8.

| # | Mức | Lỗi | Hậu quả | Đã sửa |
|---|---|---|---|---|
| R1 | Nghiêm trọng | Migration `AddProductSuggestionsAndRefineProducts` viết tay, **không có file `.Designer.cs`** (thiếu `[Migration]`), `ModelSnapshot` không cập nhật; Designer của `AddKnowledgeImages` rỗng | EF bỏ qua migration → Core khởi động xong nhưng mọi truy vấn `Products` lỗi "column Availability does not exist": cửa hàng, đặt hàng, Lavi gợi ý thuốc đều chết. `migrations remove` lần sau xóa sạch snapshot | Sinh lại bằng `dotnet ef migrations add`, giữ mã `20261111080000`; Designer của `AddKnowledgeImages` dựng lại đầy đủ. `has-pending-model-changes`: không còn thay đổi. **Không tự viết migration bằng tay.** |
| R2 | Nghiêm trọng | Agent `/label-paragraphs` chỉ trả `id`, `unit_type`, **bỏ rơi `mentions`** | Core không bao giờ nhận cụm từ → Pha 3 không tạo được gợi ý nào | `main.py` trả `mentions`; thêm test chống bịa mentions |
| R3 | Nghiêm trọng (an toàn) | Commit bài báo **tự tạo `DiseaseProducts`** khi cụm từ khớp `Contains` 2 chiều theo cả **tên thương mại** | Vi phạm quyết định số 1; khớp nhầm là Lavi khuyên sai thuốc cho bệnh | Chỉ lưu `PENDING` + `ProductId` gợi ý; khớp theo **hoạt chất** (≥ 4 ký tự); chỉ endpoint `link` (Admin bấm) mới tạo `DiseaseProducts`. Core kiểm tra lại mentions có nguyên văn trong đoạn; bỏ qua cụm đã `DISMISSED` |
| R4 | Cao (an toàn) | `PesticideItem.phi_days` thành Optional cho **mọi** loại | Thuốc hóa học thiếu PHI lọt qua client (test `test_05` đỏ) | Validator: chỉ `Vật tư canh tác` được thiếu PHI |
| R5 | Cao | `pre_filter_medicines` coi PHI null = 999 ngày cho cả vật tư | Thêm một cái lưới là bật cảnh báo đỏ "NGUY CƠ TỒN DƯ" và lưới bị chặn (đúng lỗi tiêu chí nghiệm thu muốn tránh) | Vật tư canh tác đi qua sau kiểm tra thuốc cấm; thêm test hồi quy |
| R6 | Cao | Form tạo SP điền sẵn **PHI = 7**, giá 55.000/75.000, tồn 100, `is_allowed = true` | Ngược mục 5.3/5.4: PHI không ai kiểm chứng | Bỏ hết giá trị điền sẵn; gợi ý mặc định `NOT_SOLD`, tồn 0; `is_allowed` mặc định false, nhãn tick đổi thành "Đã đối chiếu Danh mục…" |
| R7 | Trung bình | Core không bắt buộc `InfoSourceUrl` với thuốc, không kiểm tra `http(s)`, không kiểm tra `availability`/`medicine_type`; vật tư bỏ qua kiểm tra thuốc cấm | Có thể lưu `javascript:` (hiện thành link ở trang Admin); khai "vật tư" tên Paraquat để lách | Thêm kiểm tra ở `POST`/`PATCH /medicines` + 2 CHECK constraint trong CSDL |
| R8 | Trung bình | Hạn mức 30% chỉ tính trong 1 lần commit | Chia nhỏ nhiều lần commit là vượt 30% bài | Cộng dồn ký tự các đoạn đã lưu của cùng URL |
| R9 | Trung bình | Commit nhận `model_class` ngoài 38 lớp khi gọi API thẳng | Lưu tri thức với mã lớp rác | Trả `400` |
| R10 | Thấp | Nút "Gắn SP" ghi đè dòng bằng `{message}` của API | Dòng gợi ý hiện sai "Đã bỏ qua" | Tải lại danh sách sau khi gắn |
| R11 | Thấp | Tài liệu ghi "14 hoạt chất cấm theo TT 75/2025" nhưng code chỉ có 8 (6 cái thêm vào không có nguồn) | Báo cáo đồ án nêu số liệu không kiểm chứng được | Sửa docs, task, danh sách ở Admin về đúng `guardrails.py` |
| R12 | Thấp | Năm xuất bản ở tương lai bị đổi thành năm nay | Trái mục 3.2 (phải để trống) | Trả `null` |

**Còn mở (chưa làm):**
- Ảnh triệu chứng do Admin thêm mặc định `IsManualApproved = true` (spec 4.1 ghi FALSE). Chấp nhận được vì chỉ Admin thêm, nhưng cần trưởng nhóm chốt.
- Trang kết quả khám (`DiagnoseController`) vẫn liệt kê sản phẩm `NOT_SOLD` như hàng mua được (API đặt hàng đã chặn). Cần thêm `availability` vào `ProductDto`.
- Chưa có test Core cho các luồng mới; chưa chạy migration trên CSDL thật (chỉ kiểm tra bằng `dotnet ef migrations script`).
- Kiểm thử: Agent `test_react_guardrails` 26/26; `test_rag_accuracy -k test_08` qua; `test_mcp_tools` và `test_task08_streaming_trace` còn các lỗi **giống hệt bản `HEAD`** (cần Core chạy thật/mạng). Core `dotnet build` 0 cảnh báo, 0 lỗi. Web `tsc` sạch, `npm run build` thành công.

---

## 11. TRẢI NGHIỆM THẬT VÀ SỬA LỖI ĐỢT 2 (13/11/2026, trưởng nhóm)

Chạy cả hệ thống trên máy với Postgres local, làm đúng như Admin: dán bài, tách đoạn, lưu, xử lý gợi ý vật tư, rồi hỏi Lavi. Gộp thêm báo cáo của một agent khác test trang Admin trên production (code cũ, dừng trước bước Lưu). Migration `20261111080000` chạy được trên CSDL trống, nên mục "chưa chạy migration" ở mục 10 đã đóng.

| # | Lỗi | Đã sửa |
|---|---|---|
| R13 | Dán bài mới vẫn gửi tiêu đề, cơ quan và bệnh do AI đoán của bài trước | Dán bài hoặc đổi URL thì xóa kết quả cũ; metadata luôn để AI đọc lại; bệnh do AI đoán không mang sang bài sau |
| R14 | Năm xuất bản luôn "2024": form điền sẵn và ví dụ trong prompt ghi "2024" | Bỏ cả hai; Agent chỉ nhận năm xuất hiện trong bài, bỏ chuỗi mẫu `<...>` AI chép từ prompt |
| R15 | Mục 3 "Tùy chọn" nhưng chọn sẵn cây/bệnh, tải trang lại nhảy sang "Táo" | Để trống; đổi cây không tự chọn bệnh đầu danh sách |
| R16 | Gemini 503 khoảng một nửa số lần, mọi đoạn bị đưa vào ô "AI đánh giá là rác" | Agent thử lại tối đa 3 lần (ngân sách 12s, Core chờ 35s); vẫn lỗi thì hiện mọi đoạn để tự gắn nhãn, báo đúng lý do |
| R17 | Đoạn trích vỡ dấu ("ná m") do phông Georgia | Bỏ `font-serif` |
| R18 | Dán bài mất tiêu đề, ngày, tiêu đề mục; lọt hotline và footer lặp | Web giữ `h1`, ngày đăng, tiêu đề mục, bỏ hotline có số điện thoại và dòng trùng; Core ghép tiêu đề mục ngắn vào đoạn sau, giữ dòng ngắn ở đầu bài cho AI đọc metadata, bỏ dòng liên hệ/quảng cáo |
| R19 | Nút Lưu tắt không nói lý do | Dòng giải thích vượt hạn mức (30% bài, tối thiểu 1.200) và nhắc chọn cây/bệnh |
| R20 | AI trích tên nấm gây bệnh thành "Sinh học" | Prompt cấm đưa tác nhân gây bệnh vào mentions |
| R21 | Tên thương mại (Ridomil Gold 68WG) không khớp sản phẩm có sẵn, dễ tạo trùng | Khớp cả theo tên sản phẩm (≥ 5 ký tự), không khớp sản phẩm chứa hoạt chất cấm |
| R22 | `link` gắn được thuốc cấm vào bệnh, gắn lại được gợi ý đã xử lý | Core trả `400` và `409`; web ẩn thuốc cấm khỏi danh sách chọn |
| R23 | Modal ảnh ở trang Ảnh dính URL/cơ quan của bài đang nhập; nút "Gắn SP" ở biện pháp canh tác; câu "đã điền sẵn từ bài báo" sai | Đã sửa |

**Kiểm thử:** `test_rag_accuracy -k test_08` qua (thêm 3 test: năm bịa, chuỗi mẫu, thử lại khi 503); `test_react_guardrails` 26/26; Core build sạch; web `tsc` và `npm run build` đạt. Chạy tay bằng Chrome headless trên Postgres local: năm 2015 và 2022 lấy đúng từ bài; bài thứ 2 nhận đúng `Potato___Early_blight` và tiêu đề mới; "Ridomil Gold 68WG" khớp SP #1; tắt Agent vẫn chọn được cả 7 đoạn; gắn thuốc cấm bị `400`, gắn lại bị `409`; Lavi trích nguyên văn bài vừa nạp.

**Còn mở:** xem `tasks/error/ui/ux.md` mục 13–24 (sửa thẻ vật tư, tách đoạn dài, Reindex hiện JSON, bảng gợi ý, modal kho, trang Duyệt tri thức và Ảnh) và mục 30–33 (dữ liệu Supabase, cần duyệt).

---

## 12. SỬA LẠI BÀI ĐÃ LƯU (13/11/2026, trưởng nhóm)

Yêu cầu: bấm vào một bài ở Duyệt tri thức để sửa lại như lúc thêm bài mới. Hệ thống không lưu toàn văn bài (chỉ các đoạn đã chọn, theo quy định trích dẫn), nên muốn thêm đoạn thì Admin dán lại bài.

**Đã chốt với trưởng nhóm:** giữ các đoạn tóm tắt để Admin đọc là biết URL có gì; sửa xong phải duyệt lại.

| Phần | Cách làm |
|---|---|
| Mở bài | Nút "Sửa bài" ở mỗi bài trong Duyệt tri thức, mở `/admin/ingest?edit=<url>`. Ô URL bị khóa; "Thoát sửa" về nhập bài mới |
| Thông tin bài | Điền sẵn cây/bệnh, tiêu đề, cơ quan, năm. "Lưu thông tin bài" áp cho mọi đoạn cùng URL (`PATCH /knowledge/sources/by-url`), gợi ý vật tư chưa xử lý đi theo bệnh mới |
| Đoạn nguyên văn | Chỉ đổi loại hoặc xóa. Sửa chữ bị `400` vì không còn là lời bài báo (`PATCH /knowledge/sources/{id}`) |
| Đoạn tóm tắt | Sửa được chữ (20–4.000 ký tự), không đổi loại |
| Thêm đoạn | Dán lại bài, tách đoạn. Đoạn trùng đoạn đã lưu hiện "Đã lưu" và bị khóa; hạn mức 8 đoạn/30% cộng cả phần đã lưu; AI không ghi đè thông tin bài đang sửa |
| Duyệt lại | Đoạn bị sửa chuyển về "Chờ duyệt" và gọi reindex nên Lavi thôi dùng bản cũ ngay. Đoạn mới tick ở bước lưu vẫn là "đã duyệt" như luồng nhập bài |

**Sửa kèm:**
- R24: commit với `custom_text` (R3) so với toàn văn bài, nên đoạn có tiêu đề mục ghép vào hoặc có nhiều khoảng trắng luôn bị báo "không khớp nguyên văn". Nay so với đoạn đã tách trong phiên (đoạn tách `P3_1` so với `P3`), gộp khoảng trắng, phân biệt hoa thường.
- R25: dòng tiêu đề/ngày đăng (< 40 ký tự) giữ lại cho AI đọc thông tin bài nhưng tick và lưu được thành tri thức. Nay web khóa ô tick, Core trả `400`.

**Kiểm thử:** Core build sạch; web `tsc` và `npm run build` đạt. Chrome headless trên Postgres local: mở bài từ Duyệt tri thức, thông tin điền đúng; lưu thông tin bài `200` (3 đoạn về chờ duyệt); đổi loại đoạn `200`; dán lại bài thấy 3 nhãn "Đã lưu", lưu thêm đoạn `201`; Thoát sửa xóa form. Qua API: đoạn có tiêu đề mục `201`, dòng tiêu đề `400`, đoạn tách bị sửa chữ `400`, sửa chữ đoạn nguyên văn `400`.

**Chưa làm:** trang Duyệt tri thức chưa lọc riêng "bài chỉ có tóm tắt"; chưa thử trên Supabase (cần duyệt).

---

## 13. ĐỢT CẢI TIẾN TOÀN DIỆN UX/UI & ĐỒNG BỘ TRI THỨC (14/11/2026, theo phản hồi Admin thực tế)

Ghi nhận các điểm bất cập sau đợt kiểm thử thực tế bằng trình duyệt Google Chrome và nâng cấp giao diện, nghiệp vụ theo yêu cầu:

### 13.1. Thuật ngữ nghiệp vụ & Khung nhìn Admin (AdminShell)
- [ ] **Đổi tên "Reindex" thành "Đồng bộ tri thức"**: Thay thế toàn bộ thuật ngữ kỹ thuật "Reindex" / "Trạng thái Reindex" trên nút bấm, tiêu đề Dialog và thông báo bằng "Đồng bộ tri thức", kèm chú thích rõ ràng về việc cập nhật dữ liệu vector nạp não cho trợ lý AI Lavi.
- [ ] **Menu thu nhỏ (Collapsible Sidebar)**: Nâng cấp `AdminShell` cho phép thu gọn sidebar từ `w-64` về icon bar `w-16` (hoặc mở lại), lưu tùy chọn vào `localStorage`. Tối ưu không gian ngang cho màn hình 2 cột khi nhập bài.
- [ ] **Nút mở link bài viết gốc tab mới**: Thêm icon `ExternalLink` ngay cạnh ô URL bài viết gốc và cạnh tiêu đề bài, click mở tab mới `target="_blank" rel="noopener noreferrer"`.

### 13.2. Chuẩn hóa Form & Tách bạch thông tin bài viết
- [ ] **Xóa bỏ trùng lặp chọn Cây / Bệnh**: Bỏ hẳn mục chọn cây/bệnh ở cột trái, chỉ giữ duy nhất tại Card "Thông tin bài viết & Phân loại" ở cột phải.
- [ ] **Tách bạch 4 trường thông tin bài báo**: Tách riêng Tác giả, Cơ quan / Viện nghiên cứu, Ngày đăng bài, Ngày cập nhật thay vì dồn chung vào một ô.

### 13.3. Tương tác Thẻ vật tư (Mentions) & Tách đoạn nguyên văn chuẩn Điều 25 Luật SHTT
- [ ] **Click tag highlight văn bản**: Khi click hoặc hover vào thẻ tag vật tư, đoạn văn bản tương ứng bên trên tự động sáng đèn / highlight màu vàng nhạt.
- [ ] **Dịch nghĩa / Chú thích tiếng Việt cho tag**: Hiển thị tooltip hoặc bản dịch tiếng Việt cho các thuật ngữ/hoạt chất tiếng Anh (ví dụ: Thinning of whole plants -> Tỉa thưa cả cây, copper -> Gốc đồng).
- [ ] **Khóa sửa chữ khi tách đoạn (Click-to-split)**: Tuyệt đối cấm gõ tự do (free-text) khi tách đoạn để tránh sửa đổi làm sai lệch bài báo gốc (vi phạm Điều 25 Luật SHTT). Chuyển sang cơ chế click chọn dấu câu (`.`, `!`, `?`, `;`) để chia đôi đoạn, bảo đảm 2 đoạn con ghép lại đúng 100% nguyên văn bài gốc.

### 13.4. Tối giản Bảng Duyệt tri thức & Giao diện 2 Tab chi tiết bài viết
- [ ] **Tối giản bảng Duyệt tri thức (`/admin/knowledge`)**: Bỏ các nút rườm rà (Xem chi tiết, Thu gọn, Bỏ duyệt cả bài trên từng dòng), mỗi dòng chỉ giữ nút chính "Mở bài viết" và nút xóa.
- [ ] **Giao diện Chi tiết bài viết 2 Tab**:
  - **Tab 1 ("Thông tin & Các đoạn đã duyệt")**: Xem toàn bộ thông tin bài báo, các đoạn trích đã lưu/duyệt. Tích hợp thuật toán cảnh báo màu vàng khi phát hiện các đoạn trích có nội dung trùng lặp nhau (> 85%).
  - **Tab 2 ("Nạp thêm / Tái phân tích bài báo")**: Dán bài mới để phân tích thêm, tự động ẩn các đoạn đã lưu ở Tab 1 để tránh dài trang. Tích hợp bảng so sánh thông minh (Side-by-side Diff) nếu thông tin AI mới khác với thông tin đang lưu ở Tab 1, cho phép Admin 1-click chọn "Giữ cũ" hoặc "Áp dụng mới".
