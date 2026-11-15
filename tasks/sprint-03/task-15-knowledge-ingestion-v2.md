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
- [x] **Đổi tên "Reindex" thành "Đồng bộ tri thức"**: Thay thế toàn bộ thuật ngữ kỹ thuật "Reindex" / "Trạng thái Reindex" trên nút bấm, tiêu đề Dialog và thông báo bằng "Đồng bộ tri thức", kèm chú thích rõ ràng về việc cập nhật dữ liệu vector nạp não cho trợ lý AI Lavi.
- [x] **Menu thu nhỏ (Collapsible Sidebar)**: Nâng cấp `AdminShell` cho phép thu gọn sidebar từ `w-64` về icon bar `w-16` (hoặc mở lại), lưu tùy chọn vào `localStorage`. Tối ưu không gian ngang cho màn hình 2 cột khi nhập bài.
- [x] **Nút mở link bài viết gốc tab mới**: Thêm icon `ExternalLink` ngay cạnh ô URL bài viết gốc và cạnh tiêu đề bài, click mở tab mới `target="_blank" rel="noopener noreferrer"`.

### 13.2. Chuẩn hóa Form & Tách bạch thông tin bài viết
- [x] **Xóa bỏ trùng lặp chọn Cây / Bệnh**: Bỏ hẳn mục chọn cây/bệnh ở cột trái, chỉ giữ duy nhất tại Card "Thông tin bài viết & Phân loại" ở cột phải.
- [x] **Tách bạch 4 trường thông tin bài báo**: Tách riêng Tác giả, Cơ quan / Viện nghiên cứu, Ngày đăng bài, Ngày cập nhật thay vì dồn chung vào một ô.

### 13.3. Tương tác Thẻ vật tư (Mentions) & Tách đoạn nguyên văn chuẩn Điều 25 Luật SHTT
- [x] **Click tag highlight văn bản**: Khi click hoặc hover vào thẻ tag vật tư, đoạn văn bản tương ứng bên trên tự động sáng đèn / highlight màu vàng nhạt.
- [x] **Dịch nghĩa / Chú thích tiếng Việt cho tag**: Hiển thị tooltip hoặc bản dịch tiếng Việt cho các thuật ngữ/hoạt chất tiếng Anh (ví dụ: Thinning of whole plants -> Tỉa thưa cả cây, copper -> Gốc đồng).
- [x] **Khóa sửa chữ khi tách đoạn (Click-to-split)**: Tuyệt đối cấm gõ tự do (free-text) khi tách đoạn để tránh sửa đổi làm sai lệch bài báo gốc (vi phạm Điều 25 Luật SHTT). Chuyển sang cơ chế click chọn dấu câu (`.`, `!`, `?`, `;`) để chia đôi đoạn, bảo đảm 2 đoạn con ghép lại đúng 100% nguyên văn bài gốc.

### 13.4. Tối giản Bảng Duyệt tri thức & Giao diện 2 Tab chi tiết bài viết
- [x] **Tối giản bảng Duyệt tri thức (`/admin/knowledge`)**: Bỏ các nút rườm rà (Xem chi tiết, Thu gọn, Bỏ duyệt cả bài trên từng dòng), mỗi dòng chỉ giữ nút chính "Mở bài viết" và nút xóa.
- [x] **Giao diện Chi tiết bài viết 2 Tab**:
  - **Tab 1 ("Thông tin & Các đoạn đã duyệt")**: Xem toàn bộ thông tin bài báo, các đoạn trích đã lưu/duyệt. Tích hợp thuật toán cảnh báo màu vàng khi phát hiện các đoạn trích có nội dung trùng lặp nhau (> 85%).
  - **Tab 2 ("Nạp thêm / Tái phân tích bài báo")**: Dán bài mới để phân tích thêm, tự động ẩn các đoạn đã lưu ở Tab 1 để tránh dài trang. Tích hợp bảng so sánh thông minh (Side-by-side Diff) nếu thông tin AI mới khác với thông tin đang lưu ở Tab 1, cho phép Admin 1-click chọn "Giữ cũ" hoặc "Áp dụng mới".

### 13.5. Tinh chỉnh UX Chi tiết bài viết & Khử trùng lặp trường dữ liệu (14/11/2026, theo phản ánh Admin)
- [x] **Xóa bỏ giật màn hình (Flash/Jump UI)**: Nhận diện `editParam` trên query URL để hiển thị Loading Skeleton mượt mà thay vì lộ form "Dán văn bản bài báo khuyến nông" trắng tinh trong lúc tải API.
- [x] **Khử trùng lặp 2 tầng (Banner vs Form Card)**: Hợp nhất thông tin bài viết vào Header chính. Ẩn khối form 6 ô input trùng lặp choán màn hình; chỉ mở ra dạng Card khi Admin chủ động bấm `[✏️ Sửa thông tin bài]`. Mặc định màn hình tập trung 100% vào danh sách đoạn trích và thao tác duyệt.
- [x] **Chuẩn hóa nhãn "Cây khỏe mạnh"**: Loại bỏ hoàn toàn sự phi lý khi gọi cây khỏe mạnh là "Bệnh hại mục tiêu". Đổi thành `🌱 Chăm sóc cây khỏe mạnh` / `Kỹ thuật canh tác & Phòng ngừa` trên toàn bộ Header, dropdown và badge từng đoạn trích.
- [x] **Phân loại đa chủ đề cấp Đoạn trích (Multi-topic Paragraph Level)**: Tách riêng Loài cây (`editOriginalMeta.plantName`) và danh sách các chủ đề trong bài (`articleDistinctTopics`). Hiển thị badge chủ đề riêng cho từng đoạn trích, không ép đồng bộ một bệnh duy nhất cho cả bài báo.
- [x] **Thao tác nhanh Duyệt toàn bộ / Bỏ duyệt toàn bộ**: Thêm nút thao tác 1-click duyệt toàn bộ các đoạn trong bài viết ngay tại thanh công cụ Tab 1.
- [x] **Tối giản hóa thông tin Header dạng Báo cáo**: Chuyển thông tin bài báo (Cơ quan, Tác giả, Ngày đăng, URL) từ các khung tròn xám sang định dạng văn bản thanh lịch, ngắn gọn như báo cáo học thuật. Chỉ highlight nhẹ Loài cây và Chủ đề trong bài để giảm thiểu phân tâm thị giác.
- [x] **Xóa bỏ 2 cục Header đoạn trích trùng lặp**: Gộp thanh công cụ và CardHeader của bảng đoạn trích thành một khung duy nhất (`Các đoạn trích đã lưu`), tích hợp nút "Bỏ duyệt toàn bộ bài" trực tiếp trong header card.
- [x] **Dọn sạch nút bấm thừa**: Loại bỏ nút `+ Nhập bài mới` gây xao nhãng; xóa nút sửa bài bị lặp 2 lần; đổi tiêu đề trang thành "Chi tiết bài viết tri thức" khi mở bài cũ.
- [x] **Đưa 2 Tabs lên trên cùng phân định 2 tác vụ**: Đưa cụm 2 Tabs ("1. Xem & Sửa chi tiết" vs "2. Nạp thêm dữ liệu bài báo") lên ngay đầu trang cạnh nút "Quay lại danh sách", phân định rạch ròi 100% giữa việc xem/sửa duyệt bài và việc nạp thêm dữ liệu từ văn bản.
- [x] **Hộp hướng dẫn & Nút mở bài gốc tại Tab 2**: Bổ sung hộp mẹo copy bài báo tại Tab 2 với nút `[🔗 Mở trang bài gốc ↗]` và hướng dẫn `Ctrl+A`, `Ctrl+C` giúp Admin lấy thêm toàn văn dễ dàng ngay tại chỗ.

### 13.6. Tinh chỉnh Phân đoạn trích dẫn Đa mốc cắt, Đa chủ đề cấp đoạn & Mở rộng hạn mức Đồ án (14/11/2026)
- [x] **Tách ngày xuất bản và ngày cập nhật**: Sửa lỗi hiển thị dính chuỗi `"2014 (Cập nhật 26/07/2024)"` trong ô ngày đăng. Regex tự động bóc tách thành Ngày đăng/xuất bản (`2014`) và Ngày cập nhật (`26/07/2024`) vào 2 ô riêng biệt.
- [x] **Làm mờ Placeholder**: Đổi placeholder tác giả và ngày cập nhật thành văn bản mờ, in nghiêng (`(Để trống nếu không rõ tác giả)` / `(Để trống nếu không có)` với `placeholder:text-muted-foreground/35 placeholder:italic`), tránh gây hiểu nhầm là ô đã được điền sẵn giá trị.
- [x] **Phân loại Chuyên mục / Bệnh hại theo từng đoạn trích**: Bài viết có thể chứa nhiều chủ đề khác nhau (ví dụ: đoạn chăm sóc cây khỏe mạnh + đoạn điều trị bệnh đốm lá). Mỗi đoạn trích được trang bị dropdown chọn Chuyên mục / Bệnh hại riêng biệt, mặc định thừa hưởng từ AI/bài viết và Admin có thể tùy chỉnh độc lập. Core API lưu trữ `ModelClass` riêng cho từng đoạn trích trong `KnowledgeSources`.
- [x] **Mở rộng hạn mức trích dẫn phục vụ Demo / Bảo vệ Đồ án**:
  - Tối đa **20 đoạn trích nguyên văn/bài** (trước là 8 đoạn).
  - Tối đa **1.500 ký tự/đoạn** (trước là 800 ký tự).
  - Hạn mức trích dẫn hợp lý nâng lên **60% độ dài bài viết, sàn tối thiểu 2.500 ký tự** (trước là 30% / 1.200 ký tự).
  - *Ghi chú quan trọng*: Mở rộng tạm thời nhằm hỗ trợ nạp lượng lớn tri thức phục vụ chấm điểm và bảo vệ đồ án tốt nghiệp PTIT. Sẽ kích hoạt lại các hạn mức siết chặt bản quyền (`INGEST_MAX_CHUNKS=8`, `INGEST_MAX_CHUNK_CHARS=800`) khi triển khai hệ thống thương mại chính thức.
- [x] **Chia đoạn tương tác đa mốc cắt (Multi-cut point Interactive Split Dialog)**: Thay thế nút chia đôi cố định bằng cơ chế click trực quan. Admin nhấp vào nút `[✂️ Cắt tại đây]` sau bất kỳ câu nào để đặt 1 hoặc nhiều mốc cắt (`Mốc #1`, `Mốc #2`...), xem trước kích thước/nội dung từng đoạn con, và chia đoạn thành N phần hợp lệ trong 1 click mà vẫn bảo toàn 100% nguyên văn bài gốc (Điều 25 Luật SHTT).
- [x] **Nút chọn nhanh tất cả đoạn AI gợi ý**: Đồng bộ nút `[✨ Chọn tất cả đoạn AI gợi ý]` tại cả 2 nơi (Tab 2 Nạp thêm và Form Nhập bài mới) giúp Admin 1-click duyệt nhanh các đoạn trích có ý nghĩa tri thức mà AI đã chọn lọc.

### 13.7. Danh sách Chuyên đề / Bệnh hại dạng Tags & Đồng bộ hoàn toàn Tab 2 với Nhập bài báo (14/11/2026)
- [x] **Bỏ dropdown đơn cấp bài báo, thay bằng Danh sách Chuyên đề (Tags + Selector)**: Thay thế hoàn toàn ô select đơn lẻ bằng giao diện danh sách tags chuyên đề trong bài (`articleTopics`). Admin có thể xem trực quan các chủ đề bài viết bao quát, bấm `✕` để gỡ bỏ, hoặc chọn bệnh có sẵn của cây từ dropdown và bấm `[+ Thêm vào bài]`.
- [x] **Đổi chuyên mục trực tiếp trên từng đoạn đã lưu (Tab 1)**: Bổ sung selector đổi chuyên đề/bệnh hại ngay trên từng đoạn đã lưu của Tab 1. Core API `PATCH /api/v1/knowledge/sources/{id}` hỗ trợ cập nhật `ModelClass` độc lập cho từng đoạn và tự động kích hoạt reindex.
- [x] **Bảo toàn tính độc lập khi Lưu thông tin bài (`PATCH sources/by-url`)**: Không ghi đè cào bằng một mã bệnh duy nhất lên toàn bộ các đoạn khi bài viết chứa nhiều chuyên đề khác nhau.
- [x] **Đồng bộ triệt để Tab 2 (Nạp thêm) y hệt màn hình Nhập bài báo**:
  - Tự động áp dụng `meta.model_class` do AI đề xuất cho các đoạn mới bóc tách ở Tab 2, khắc phục lỗi nhận nhầm thành Cây khỏe mạnh.
  - Bổ sung khối Thẻ vật tư / Hoạt chất (`para.mentions`) tương tác đầy đủ dưới mỗi đoạn: dịch nghĩa tiếng Việt, hover highlight, đổi loại thẻ, xóa thẻ, thêm cụm từ mới.
  - Thêm badge `AI đã gợi ý nhãn` / `Tự gán nhãn` và badge `Ký tự: ... / ... (%)` vào CardHeader của danh sách đoạn mới ở Tab 2.
  - Tích hợp accordion `⌄ Đoạn AI không chọn: X đoạn (vẫn tick để lưu được)` cho phép xem và phục hồi đoạn trích ngoài gợi ý của AI.

### 13.8. Sửa lỗi lọc nhầm nội dung tiếng Anh, bảo toàn Bảng/Danh sách & Bổ sung nút Crawl nội dung từ URL (14/11/2026)
- [x] **Khắc phục lỗi mất đoạn văn tiếng Anh bắt đầu bằng `"In ..."`**: Sửa regex nhận diện nút mạng xã hội (`linkedin`/`in`) trong `frontend/web/src/pages/AdminDashboard.tsx` (`cleanArticleTextFromHtml`) bằng cách giới hạn khớp nguyên từ ngắn (`<= 35` ký tự), chấm dứt tình trạng xóa nhầm các đoạn chuyên môn như `Disease Cycle` hay `Management` khi dán bài báo tiếng Anh (ví dụ NC State Extension).
- [x] **Bảo toàn cấu trúc Bảng, Danh sách, Tiêu đề mục & Metadata đầu bài**:
  - Chuyển thẻ `<table>` thành các dòng văn bản dễ đọc (`Header: Value | ...`) gom nhóm hợp lý (`<= 1200` ký tự/khối); gom các mục `<li>` ngắn (`12–119` ký tự) thành khối gạch đầu dòng `•` để không bị bộ tách đoạn (`< 40` ký tự) của Core API loại bỏ.
  - Tự động bổ sung dấu `:` sau thẻ `H2..H6` (trừ `Authors`/`Keywords`/`References`) và mở rộng `KnowledgeController.IsSectionHeading` (`CommonHeadingWordsRegex`) trong `backend/core-api/src/Lavitree.Api/Controllers/KnowledgeController.cs` để gắn đúng tiêu đề mục vào đoạn trích tương ứng.
  - Bóc tách sẵn metadata (`h1`, `og:site_name`, `.author`/`.authors`, `time`/ngày đăng/cập nhật) trước khi loại `<header>`/`<footer>`, bổ sung khoảng trắng quanh block tag để tránh dính chuỗi ngày tháng, và cho phép giữ tối đa 6 dòng metadata ngắn ở đầu bài trong `IngestArticle`.
- [x] **Bổ sung nút `"Crawl nội dung từ URL"` an toàn (SSRF Guardrails + Cơ chế 3 tầng)**:
  - UI đặt nút gọn ở góc trên phải khung nhập văn bản bài báo tại cả form **Nhập bài báo mới** (`/admin/ingest`) và **Tab 2 Nạp thêm dữ liệu bài báo**, sử dụng chung bộ chuẩn hóa `cleanArticleTextFromHtml` với luồng dán tay.
  - **Tầng 1 (Core API)**: Thêm `POST /api/v1/knowledge/fetch-url` (`FetchUrlRequestDto` / `FetchUrlResponseDto` trong `backend/core-api/src/Lavitree.Application/DTOs/KnowledgeIngestionDtos.cs` và `KnowledgeController.FetchArticleUrl`), dùng `SocketsHttpHandler.ConnectCallback` chặn IP private/loopback/link-local/metadata (`169.254.169.254`), kiểm tra redirect thủ công (tối đa 3 hops), giới hạn 2MB và timeout 15 giây.
  - **Tầng 2 (Vite Dev Middleware)**: Thêm middleware `GET /__dev/fetch-url` trong `frontend/web/vite.config.ts` có kiểm tra DNS/IP chống SSRF để môi trường dev hoạt động ngay cả khi container `core-api` chưa rebuild/restart.
  - **Tầng 3 (Fallback CORS Proxy & Thông báo Copy tay)**: Tự động thử CORS proxy dự phòng nếu tầng 1/2 chưa khả dụng; trường hợp trang đích bật chống bot (Cloudflare/403), hiển thị thông báo rõ ràng để Admin dùng thao tác copy-paste tay (`Ctrl+A, Ctrl+C`).
- [x] **Nâng ngưỡng phân tích đoạn dài & số lượng gợi ý AI**:
  - Nâng giới hạn độ dài đoạn gửi sang Agent Service trong `KnowledgeController.RequestAgentLabelingAsync` từ `<= 800` lên `<= 2000` ký tự để các đoạn chi tiết như `Symptoms and Signs` không bị bỏ qua khi gán nhãn và bóc tách mention.
  - Nâng `MAX_SUGGESTIONS` trong `backend/agent-service/app/rag/pipeline.py` từ `8` lên `20`.

### 13.9. Vá rà soát bảo mật & toàn vẹn dữ liệu trước khi merge main (`TASK-15-R14`, 15/11/2026)
- [x] **Loại bỏ proxy bên thứ ba khi crawl URL (Khắc phục rủi ro toàn vẹn dữ liệu mức Cao)**:
  - Xóa bỏ hoàn toàn fallback sang proxy công khai bên thứ ba (`api.allorigins.win`, `api.codetabs.com`) trong `frontend/web/src/pages/AdminDashboard.tsx` (`handleCrawlArticleFromUrl`).
  - Giới hạn middleware `GET /__dev/fetch-url` chỉ chạy ở chế độ `import.meta.env.DEV` và **không** fallback khi Core API chủ động từ chối (`400/401/403/422`). Môi trường production chỉ gọi duy nhất `POST /api/v1/knowledge/fetch-url` của Core API.
- [x] **Chặn URL scheme không hợp lệ (`?edit=` XSS hardening & `NormalizeUrl`)**:
  - Thêm helper `isSafeHttpUrl` trong `frontend/web/src/pages/AdminDashboard.tsx`; kiểm tra `url` ngay đầu `loadArticleForEdit`, gán `editUrl`/`ingestUrl` theo `res.data.source_url` chuẩn từ CSDL và chỉ render `<a href>` khi URL thuộc `http://` hoặc `https://`.
  - Cập nhật `KnowledgeController.NormalizeUrl` trong `backend/core-api/src/Lavitree.Api/Controllers/KnowledgeController.cs` trả về chuỗi rỗng nếu scheme không phải `http`/`https`; các endpoint `GET/PATCH sources/by-url` và `CommitIngestion` từ chối `400 BadRequest` với scheme không hợp lệ.
- [x] **Đưa hạn mức trích dẫn ra cấu hình môi trường/appsettings**:
  - Thêm helper `GetIngestConfigInt` đọc `INGEST_MAX_CHUNKS` (`KnowledgeIngestion:MaxChunks`, mặc định `20`), `INGEST_MAX_CHUNK_CHARS` (`KnowledgeIngestion:MaxChunkChars`, mặc định `1500`), `INGEST_MAX_RATIO_PERCENT` (`KnowledgeIngestion:MaxRatioPercent`, mặc định `60`) và `INGEST_MIN_QUOTA_FLOOR` (`KnowledgeIngestion:MinQuotaFloor`, mặc định `2500`) để dễ dàng siết chặt lại khi lên bản thương mại.
- [x] **Đồng bộ mã bệnh cho `ProductSuggestions` theo từng đoạn trích**:
  - Trong `CommitIngestion`, mỗi `ProductSuggestion` mới lưu theo `createdSource.ModelClass` riêng của đoạn trích (và truy vấn `DISMISSED` theo cặp `(ModelClass, MentionText)`) thay vì dùng mã bệnh chung `finalModelClass`.
  - Trong `UpdateSourceUnit` (`PATCH /api/v1/knowledge/sources/{id}`), khi đổi bệnh của một đoạn trích, tự động cập nhật `ModelClass` cho các gợi ý `PENDING` gắn với đoạn đó.
- [x] **Bổ sung dải IPv6 SSRF, giới hạn stream 2MB cho Vite Dev Proxy & tách task VS Code mặc định về Local**:
  - Chặn thêm `64:ff9b::/96` / `64:ff9b:1::/48` (NAT64), `2002::/16` (6to4) và `::/96` trong `IsPrivateOrReservedIp` của `KnowledgeController.cs`.
  - Nâng cấp `/__dev/fetch-url` trong `frontend/web/vite.config.ts` đọc stream từng chunk và hủy ngay khi chạm mốc `2MB` (`reader.cancel()`).
  - Đổi task test mặc định trong `.vscode/tasks.json` trỏ về `CORE_API_URL=http://localhost:5176`, tách task trỏ `https://lavitree.io.vn` thành tùy chọn riêng để tránh ghi nhầm dữ liệu test lên production.

### 13.10. Bóc tách siêu dữ liệu Key-Value tất định & bảo toàn ngày cập nhật (`TASK-15-R15`, 15/11/2026)
- [x] **Bóc tách Key-Value phía Frontend (`frontend/web/src/pages/AdminDashboard.tsx`)**:
  - Thêm bộ nhận diện siêu dữ liệu tất định gồm `extractKeyMetadataFromText`, `normalizeDateDisplay`, `MONTH_MAP`, `KNOWN_ORG_BY_HOST`, `parseCombinedOrg` và `parseCombinedDate`.
  - Hỗ trợ chuẩn hóa đa dạng định dạng ngày (tiếng Anh như `July 24, 2014`, tiếng Việt và ISO) về `DD/MM/YYYY` (ví dụ `Publication date: July 24, 2014` -> `24/07/2014`, `Reviewed/Revised: July 26, 2024` -> `26/07/2024`); trích xuất tác giả từ khối `Authors` hoặc các cặp `<Tên>:\n<Chức danh>` (như `Garrett Ridge: Research Specialist Plant Pathology`), và xác định cơ quan xuất bản từ phần đầu bài hoặc bảng `KNOWN_ORG_BY_HOST` theo domain nguồn.
  - Tích hợp vào `handleParseArticle`: gộp kết quả Key-Value với `suggested_metadata` từ AI (ưu tiên giá trị tường minh từ Key-Value cho cơ quan, tác giả, ngày đăng và ngày cập nhật), đồng thời tự điền các trường còn trống (`ingestAuthor`, `ingestUpdatedDate`) ở Tab 2 (`editUrl` / Nạp thêm dữ liệu bài báo).
  - Cập nhật các nút `[Áp dụng tất cả]` ở Tab 2, popover Cơ quan `[Áp dụng]` và popover Ngày `[Áp dụng]` để điền tách biệt đầy đủ cả `ingestOrg` & `ingestAuthor` lẫn `ingestPublishedDate` & `ingestUpdatedDate`.
- [x] **Giữ nguyên dòng metadata cuối bài phía Core API (`backend/core-api/src/Lavitree.Api/Controllers/KnowledgeController.cs`)**:
  - Bổ sung `MetadataKeyLineRegex` (ngay sau `CommonHeadingWordsRegex`) và cập nhật `IngestArticle` để không loại bỏ các dòng ngắn (`10 <= cleaned.Length < 40`) khớp mẫu khóa metadata (ví dụ `Publication date:`, `Reviewed/Revised:`, `Authors:`) nằm rải rác hoặc ở cuối bài báo trước khi gửi sang Agent Service.
- [x] **Bảo toàn ngày đầy đủ & ngày cập nhật phía Agent Service (`backend/agent-service/app/rag/pipeline.py`)**:
  - Sửa `_filter_metadata`: giữ nguyên chuỗi `published_date` đầy đủ (tối đa 100 ký tự, bao gồm cả định dạng `DD/MM/YYYY (Cập nhật: DD/MM/YYYY)`) thay vì cắt chỉ còn 1 năm 4 chữ số, miễn là mọi năm 4 chữ số trong chuỗi đều hợp lệ (`1900 <= int(y) <= current_year`) và xuất hiện trong `article_text`.
  - Cập nhật prompt trong `label_paragraphs` yêu cầu `organization` bỏ qua phần `References` cuối bài và `published_date` giữ định dạng `DD/MM/YYYY` kèm `(Cập nhật: ...)` khi có.
- [x] **Hoàn thiện xử lý `<br>`, ngữ cảnh AI `META_CONTEXT` & Kiểm thử thực tế Google Chrome (`TASK-15-R16`, 15/11/2026)**:
  - Sửa `cleanArticleTextFromHtml` trong `frontend/web/src/pages/AdminDashboard.tsx`: giữ xuống dòng `\n` cho thẻ `<br>` (thay vì thay bằng `' '`), đọc thêm thẻ meta cập nhật (`article:modified_time`, `og:updated_time`, `last-modified`, `revised`, `dateModified`) và đẩy `Ngày cập nhật: ...` trước khi dọn DOM.
  - Thêm `extractDateFromSegment` và bỏ neo đầu dòng `^` trong `extractKeyMetadataFromText` để bắt đúng cả ngày đăng và ngày cập nhật nằm cùng dòng (như `Publication date: ... Reviewed/Revised: ...`, `Last Reviewed: July 2020`, `Last Revised: 03/01/2024`), hỗ trợ `Month YYYY` (`07/2020`) và lọc bỏ chức danh học thuật (`Research Technician`, `Research Associate`, `WVU Extension Specialist...`) khỏi tên tác giả.
  - Bổ sung `BuildArticleMetaContext` (`META_CONTEXT` gồm 10 dòng đầu + 15 dòng cuối bài) trong `backend/core-api/src/Lavitree.Api/Controllers/KnowledgeController.cs`, mở rộng `MetadataKeyLineRegex`, và tách rõ `"author"` + `"updated_date"` trong JSON schema + `_validate_date_text` của `backend/agent-service/app/rag/pipeline.py` (loại `"META_CONTEXT"` khỏi danh sách `labels` được gán nhãn).
  - **Kết quả kiểm thử thực tế trên Google Chrome (`http://localhost:3000/admin/ingest`)**:
    1. `content.ces.ncsu.edu/leaf-scorch-of-strawberry`: `Tiêu đề`=`Leaf Scorch of Strawberry`, `Cơ quan`=`NC State Extension Publications`, `Tác giả`=`Frank Louws, Garrett Ridge, Bill Cline`, `Ngày đăng`=`24/07/2014`, `Ngày cập nhật`=`26/07/2024`.
    2. `content.ces.ncsu.edu/tomato-yellow-leaf-curl-virus`: `Tiêu đề`=`Tomato Yellow Leaf Curl Virus Plant Disease Factsheets`, `Cơ quan`=`NC State Extension Publications`, đủ 5 tác giả `Leighann Murray, Ella Reeves, Inga Meadows, Ella Hinchliffe, Sara Villani` (không lẫn chức danh), `Ngày đăng`=`14/07/2023`.
    3. `extension.wvu.edu/.../bacterial-leaf-spot-of-pepper`: `Tiêu đề`=`Bacterial Leaf Spot of Pepper`, `Cơ quan`=`West Virginia University Extension`, `Tác giả`=`Mahfuz Rahman, Nur Alam`, `Ngày cập nhật`=`07/2020` *(ghi chú: `ask.ifas.ufl.edu/publication/PP351` tự chuyển hướng vòng lặp nên UI báo rõ hướng dẫn Ctrl+A/Ctrl+C thủ công)*.
    4. `hort.extension.wisc.edu/articles/septoria-leaf-spot/`: `Tiêu đề`=`Septoria Leaf Spot`, `Cơ quan`=`Wisconsin Horticulture`, `Tác giả`=`Brian Hudelson`, `Ngày đăng`=`2024`, `Ngày cập nhật`=`03/01/2024`; và `nongnghieppho.vn/blogs/news/benh-dom-vong-tren-ca-chua`: `Tiêu đề` + `Cơ quan`=`Nông Nghiệp Phố`.
    5. Chế độ Xem chi tiết -> Tab 2 (`Nạp thêm dữ liệu bài báo`) cho `leaf-scorch-of-strawberry`: tự động điền `Tác giả`=`Frank Louws, Garrett Ridge, Bill Cline` và `Ngày cập nhật`=`26/07/2024`, hiển thị `3 ô có AI đề xuất`.

### 13.11 Sửa 4 lỗi UI/UX ở luồng Nhập bài báo & Tab 2 "Nạp thêm dữ liệu bài báo" (R17)

- **Chống lặp khối `Đoạn AI không chọn` & dùng chung thẻ đoạn trích (`frontend/web/src/pages/AdminDashboard.tsx`)**:
  - Loại bỏ khối accordion `showNoiseParagraphs` lồng bên trong chính nó ở luồng **Nhập bài báo** (`!editUrl`) bằng helper dùng chung `renderParagraphReviewCard`, `renderParagraphMentions` và `renderUnselectedParagraphsAccordion`.
  - Ở Tab 2 (**Nạp thêm dữ liệu bài báo**): lọc `newParagraphs` thành `suggestedNewParagraphs` (`suggested_unit_type !== null`) hiển thị phía trên và `unselectedNewParagraphs` (`suggested_unit_type === null`) vào đúng 1 accordion thu gọn phía dưới, đồng thời bổ sung form inline `+ Thêm cụm từ`, nút `Tách đoạn` và 2 dropdown phân loại cho cả hai phần.
- **Thu gọn / Mở rộng form thông tin bài viết ở Nhập bài báo**:
  - Tái sử dụng `isMetaCardCollapsed` và `renderMetaCollapsedSummary()` để thêm nút `Thu gọn` / `Mở rộng form` cho Card `Thông tin bài viết & Phân loại` khi nhập bài mới (giống Tab 2).
- **Tách độc lập 5 trường gợi ý AI ở Tab 2 & mở rộng `parseCombinedOrg` / `parseCombinedDate`**:
  - Chuẩn hóa `parseCombinedOrg` (hỗ trợ cả `(Tác giả: ...)` và `/ Tác giả: ...`) và `parseCombinedDate` (bóc tiền tố `Cập nhật`, `Updated`, `Được rà soát/cập nhật`...); tái sử dụng cả 2 helper trong `loadArticleForEdit`.
  - Tách AI diff trong Tab 2 thành 5 trường độc lập (`title`, `org`, `author`, `pubDate`, `upDate`) qua helper `renderAiMetaFieldInput`: `Ngày đăng / xuất bản` chỉ gợi ý ngày đăng (`24/07/2014`), `Cơ quan` chỉ gợi ý cơ quan (`NC State Extension Publications`), còn `Tác giả` và `Ngày cập nhật (nếu có)` có viền vàng + popover gợi ý độc lập cho ô bên cạnh và hỗ trợ `Áp dụng tất cả` / `Bỏ qua tất cả`.
- **Kiểm chứng thực tế**:
  - `npm run build` (`tsc && vite build`) thành công trong `3.81s` (`2002 modules transformed`, 0 lỗi).
  - Kiểm thử trực tiếp trên Google Chrome (`/admin/ingest`, reload `ignoreCache: true`, không lưu CSDL): Nhập bài mới thu gọn được về 1 dòng tóm tắt và chỉ còn duy nhất 1 mục `Đoạn AI không chọn`; Tab 2 (`?edit=...leaf-scorch-of-strawberry`) tách đúng 8 đoạn AI gợi ý lên trên + 1 mục `Đoạn AI không chọn: 12 đoạn` ở dưới, popover `Ngày đăng` chỉ hiện `"24/07/2014"`, popover `Cơ quan` chỉ hiện `"NC State Extension Publications"`, đồng thời `Tác giả` và `Ngày cập nhật` (`26/07/2024`) có popover gợi ý độc lập khi khác dữ liệu hiện có.

### 13.12 Tách bộ lọc Cây trồng / Chuyên mục, đổi nhãn `"🌱 Kỹ thuật canh tác & Phòng ngừa"` & phân loại Nguồn bài báo Việt Nam / Nước ngoài (`TASK-15-R18`, 15/11/2026)

- **Chuẩn hóa nhãn chuyên mục khỏe mạnh & tách 4 bộ lọc ở `Duyệt tri thức` (`frontend/web/src/pages/AdminDashboard.tsx`)**:
  - Hợp nhất hiển thị chuyên mục không phải bệnh qua `formatTopicLabel` -> **`🌱 Kỹ thuật canh tác & Phòng ngừa`** (thay cho `"Cây khỏe mạnh"` trên thanh lọc Curation, bảng gộp bài viết, bảng từng dòng, dropdown gán chuyên mục ở Nhập/Sửa bài viết và bộ lọc/modal Ảnh triệu chứng).
  - Tách dropdown đơn lẻ `Tất cả lớp cây–bệnh` ở `Duyệt tri thức` thành 2 dropdown độc lập: **`Loài cây trồng`** (`Tất cả cây trồng (14)`, giúp Admin lọc ngay toàn bộ bài của một cây như `Cà chua`) và **`Chuyên mục & Bệnh hại`** (tự động giới hạn theo loài cây đang chọn và đổi nhãn thành `Tất cả chuyên mục của <Tên cây>`), kèm bộ lọc **`Nguồn bài báo`** (`Tất cả nguồn (VN & Nước ngoài)`, `🇻🇳 Bài báo Việt Nam`, `🌐 Bài báo Nước ngoài (Quốc tế)`), giữ nguyên bộ lọc trạng thái duyệt.
  - Đổi cột bảng thành **`Cây & Chuyên mục`** (badge `+N chuyên mục khác`) và hiển thị pill **`🇻🇳 Việt Nam`** / **`🌐 Nước ngoài`** trên từng dòng bài viết ở cả 2 chế độ `Gộp bài viết` và `Từng dòng`.
- **Trường `Nguồn bài báo *` (Việt Nam / Nước ngoài) đồng bộ Frontend + Core API**:
  - Frontend (`frontend/web/src/pages/AdminDashboard.tsx`): thêm `inferSourceScope` và `renderSourceScopeSelect` tự nhận diện nguồn từ URL/cơ quan (ví dụ `content.ces.ncsu.edu` -> `🌐 Bài báo Nước ngoài (Quốc tế)`), cho phép Admin chọn lại trong Card `Thông tin bài viết & Phân loại` (cả Nhập bài mới, Sửa chi tiết & Tab 2), hiển thị pill `🇻🇳 Bài báo Việt Nam` / `🌐 Bài báo Nước ngoài` ở Header bài viết, giữ `editOriginalMeta.sourceScope` khớp khi tải `?edit=...` để không báo dirty giả, và gửi `source_scope` lên Core API.
  - Core API (`backend/core-api/src/Lavitree.Application/DTOs/KnowledgeIngestionDtos.cs`, `backend/core-api/src/Lavitree.Api/Controllers/KnowledgeController.cs`): bổ sung thuộc tính tùy chọn `SourceScope` (`source_scope`, `[MaxLength(50)]`) vào `CommitIngestionRequestDto` và `UpdateArticleRequestDto`; thêm `ResolveSourceScope(requestedScope, sourceUrl, organization)` và áp dụng trong `CommitIngestion` và `UpdateArticle` (`PATCH /api/v1/knowledge/sources/by-url`).
- **Kiểm chứng thực tế**:
  - Core API `dotnet build Lavitree.sln --no-restore --disable-build-servers -m:1` thành công (`0 Error(s)`, `1 Warning(s)` có sẵn ở `LavitreeDbContextSeeder.cs`, `8.71s`).
  - Frontend `npm run build` (`tsc && vite build`) thành công (`2002 modules transformed`, `0` lỗi, `3.62s`).
  - Kiểm thử trực tiếp trên Google Chrome (`http://localhost:3000/admin/curation` & `/admin/ingest`, reload `ignoreCache: true`, không lưu/sửa CSDL): xác nhận đủ 4 `<select>` bộ lọc, `0` chữ `"Cây khỏe mạnh"` còn sót ở option/bảng tại cả 2 chế độ xem, lọc `Cà chua` thu hẹp về đúng 10 chuyên mục Cà chua, lọc `Dâu tây` -> `🌱 Kỹ thuật canh tác & Phòng ngừa` ra đúng 2 bài, lọc `🇻🇳 Việt Nam` / `🌐 Nước ngoài` khớp 10/10 dòng ở cả `Gộp bài viết` và `Từng dòng`, URL `content.ces.ncsu.edu/leaf-scorch-of-strawberry` tự chọn `🌐 Bài báo Nước ngoài (Quốc tế)`, `?edit=...` không báo dirty giả và 0 lỗi console.

### 13.13 Sắp xếp bảng chữ cái tiếng Việt & Gom nhóm tách đoạn thông minh chống cắt vụn (`TASK-15-R19`, 15/11/2026)

- **Sắp xếp danh sách cây trồng và chuyên mục theo bảng chữ cái tiếng Việt (`frontend/web/src/pages/AdminDashboard.tsx`)**:
  - Sắp xếp danh mục `diseases` trong `fetchDiseases` theo `a.plantName.localeCompare(b.plantName, 'vi')` rồi theo `formatTopicLabel(..., 'vi')`.
  - Sắp xếp `uniquePlants` bằng `localeCompare(b, 'vi')` -> cả 14 loài cây trên toàn bộ dropdown (`Duyệt tri thức`, `Nhập bài báo`, `Xem & Sửa chi tiết`, `Ảnh triệu chứng`) hiển thị theo chuẩn A–Z tiếng Việt (`Anh đào (Cherry)` -> `Việt quất`).
- **Gom nhóm tiêu đề mục, câu dẫn & các ý con ngắn trước khi tách đoạn (`AdminDashboard.tsx` & `backend/core-api/src/Lavitree.Api/Controllers/KnowledgeController.cs`)**:
  - Frontend (`AdminDashboard.tsx`):
    - Thêm `isStandaloneMetadataLine` và `coalesceArticleParagraphs` (gọi cuối `cleanArticleTextFromHtml` và đầu `handleParseArticle`, giữ trần `MAX_GROUP_CHARS = 1300` để không vượt ngưỡng `1.500` ký tự của `CommitIngestion`).
    - Nhận diện tiêu đề mục (`3..85` ký tự, bỏ qua câu nối như `"Đây là..."`, `"Khi ..."`, kết thúc `:`, đánh số mục hoặc từ khóa chuẩn), câu dẫn kết thúc bằng `:`/`?`, và ý con ngắn (`• ...`, `<Nhãn <= 55 ký tự>: <Nội dung <= 255 ký tự>`, cặp Hỏi–Đáp `<= 320` ký tự) để gom vào cùng đoạn mạch lạc (tránh gộp nhầm các mục riêng lẻ dài `~285–309` ký tự như `Điều kiện thuận lợi` với `Triệu chứng`).
    - Loại bỏ `figcaption`/`.wp-caption-text`/`.image-caption`/`.caption`, thẻ `<p>` chú thích ảnh (`< 95` ký tự không dấu câu), dòng quảng cáo `• Website: ...` và ẩn các dòng siêu dữ liệu đơn (`Cơ quan: ...`, `< 40` ký tự) khỏi danh sách thẻ trích dẫn trong `handleParseArticle` nhưng vẫn giữ nguyên `id` đoạn gốc từ API.
    - Nâng giới hạn mỗi nửa đoạn trong `autoSplitText` lên `1500` và thêm `whitespace-pre-line` ở thẻ hiển thị đoạn trích (`Tab 1` & card bóc tách).
  - Backend Core API (`KnowledgeController.cs`):
    - Bổ sung `IsStandaloneMetadataBlock`, `IsSubItemBlock`, `IsIncompleteLeadIn`, `CoalesceArticleParagraphs`, `IsSectionHeading` (`<= 85` ký tự) trong `IngestArticle`, đồng thời không đẩy các dòng `< 40` ký tự hoặc siêu dữ liệu đơn thuần vào `validParagraphs` (vẫn giữ nguyên cho `BuildArticleMetaContext` gửi `META_CONTEXT`).
- **Kiểm chứng thực tế**:
  - Core API `dotnet build Lavitree.sln --no-restore --disable-build-servers -m:1` thành công (`0 Warning(s)`, `0 Error(s)`, `3.76s`).
  - Frontend `npm run build` (`tsc && vite build`) thành công (`2002 modules transformed`, `0` lỗi, `10.59s`).
  - Kiểm thử trực tiếp trên Google Chrome (sau bản build cuối, `ignoreCache: true`, không lưu CSDL): bài `https://nongnghieppho.vn/blogs/news/benh-dom-vong-tren-ca-chua` giảm từ **48 đoạn nhỏ lẻ** xuống còn **13 đoạn hoàn chỉnh** (`285–1277` ký tự; tách bạch `P4` giới thiệu `452` chars, `P5` `Điều kiện thuận lợi` `309` chars - `CAUSE_CONDITIONS`, `P6` `Triệu chứng` `285` chars - `SYMPTOMS`, `P7` `Vòng đời` `291` chars, gom gọn `Tác hại`, `Phòng ngừa`, `Sinh học`, `Hóa học`, `Canh tác`, `FAQ`; không còn tiêu đề mồ côi, chú thích ảnh hay dòng `Cơ quan`); dropdown 14 cây xếp đúng A–Z tiếng Việt và `0` lỗi console.

### 13.14 Chuẩn hóa Markdown sạch khi Crawl/Copy, Chuyển đổi `Xem định dạng` / `Code Markdown` & Định dạng thẻ đoạn trích (`TASK-15-R20`, 15/11/2026)

- **Chuyển HTML sang Markdown sạch khi Crawl và Copy/Paste (`frontend/web/src/pages/AdminDashboard.tsx`)**:
  - Nâng cấp `cleanArticleTextFromHtml`: thêm `extractInlineMarkdown` chuẩn hóa thẻ `<h1>` thành `# Tiêu đề`, `<h2>` thành `## Mục lớn:`, `<h3>..<h6>` / `<dt>` / đoạn in đậm toàn dòng (`<= 95` ký tự) thành `### Mục con:`, chuyển `<li>` và các đoạn có nhãn ngắn đầu dòng (`<p><strong>Nhãn:</strong> ...</p>`, `<= 265` ký tự) thành gạch đầu dòng `- **Nhãn:** Nội dung`, loại bỏ link/hình ảnh dư thừa, tránh lặp `<p>` lồng trong `<li>` và khử trùng lặp qua khóa chuẩn hóa.
  - Nâng cấp `handlePasteArticleText`: khi dán toàn văn (HTML có cấu trúc từ trình duyệt hoặc văn bản dài `>= 80` ký tự) vào ô trống hoặc thay thế toàn bộ, tự động chuyển đổi sang Markdown sạch và mở chế độ **`Xem định dạng`** mặc định (khi đang sửa một đoạn nhỏ ở giữa bài trong `Code Markdown`, vẫn giữ nguyên hành vi dán tại vị trí con trỏ).
  - Cập nhật `extractKeyMetadataFromText` bỏ qua tiền tố Markdown (`#`, `-`, `**`) để vẫn bóc tách chính xác Tác giả, Cơ quan, Ngày đăng và Ngày cập nhật.
- **Khung soạn thảo hợp nhất với nút chuyển `Xem định dạng` / `Code Markdown` (`AdminDashboard.tsx`)**:
  - Thêm helper dùng chung `renderArticleEditorSection` (áp dụng đồng nhất cho cả **Nhập bài báo mới** và **Tab 2 Nạp thêm dữ liệu bài báo**).
  - Mặc định kích hoạt **`👁️ Xem định dạng`** khi đã có nội dung (`renderFormattedArticlePreview`: hiển thị phân cấp heading, chip metadata đầu bài, chữ in đậm và danh sách bullet `•` trực quan); cho phép chuyển 1-click sang **`</> Code Markdown`** (`<Textarea>` font monospace) để Admin tự do chỉnh sửa dấu `#`, `-`, `**`.
- **Gom nhóm & Hiển thị chuẩn Markdown trên từng thẻ đoạn trích (`AdminDashboard.tsx` & `backend/core-api/src/Lavitree.Api/Controllers/KnowledgeController.cs`)**:
  - Cập nhật `coalesceArticleParagraphs` (Frontend) và `CoalesceArticleParagraphs` / `ExtractDraftParagraphs` (`KnowledgeController.cs`) nhận diện tiêu đề `##`/`###`, gạch đầu dòng `- ` và nhãn in đậm `**Nhãn:**`, tách rạch ròi ranh giới giữa các mục `##`, giữ tiêu đề trên dòng đầu (`\n`) của đoạn gom và ẩn dòng `# Tiêu đề bài` đơn khỏi danh sách thẻ trích dẫn (vẫn giữ cho `META_CONTEXT`).
  - Nâng cấp `renderParagraphWithHighlight` (`applyMentionHighlight` + `renderInlineMarkdownWithHighlight`) để render tiêu đề, danh sách dấu chấm tròn `•` và chữ in đậm `**...**` sạch đẹp bên trong cả thẻ đoạn mới (`P3..Pn`) lẫn danh sách đoạn đã lưu (Tab 1) mà vẫn giữ highlight cụm từ vật tư và bảo toàn 100% nguyên văn kiểm tra `CommitIngestion` (`computeSplitParts` giữ nguyên ký tự xuống dòng `\n`).
- **Kiểm chứng thực tế**:
  - Core API `dotnet build Lavitree.sln --no-restore --disable-build-servers -m:1` thành công (`0 Warning(s)`, `0 Error(s)`, `3.18s`).
  - Frontend `npm run build` (`tsc && vite build`) thành công (`2002 modules transformed`, `0` lỗi, `3.80s`).
  - Kiểm thử trực tiếp trên Google Chrome (`?edit=https%3A%2F%2Fnongnghieppho.vn%2Fblogs%2Fnews%2Fbenh-dom-vong-tren-ca-chua`, `ignoreCache: true`, không lưu CSDL):
    - Bấm `Crawl từ URL`: thu được `7.848 / 50.000` ký tự, tự động hiển thị **`Xem định dạng`** mặc định (render đầy đủ tiêu đề H4/H5/H6, `<strong>`, dấu `•`, không lộ ký tự thô `#`/`**`).
    - Bấm `Code Markdown`: mở `<textarea>` chứa đầy đủ mã Markdown chuẩn (`# `, `## `, `### `, `- **...**`); bấm `Xem định dạng` quay lại bản xem trước bình thường.
    - Bấm `Tách đoạn & Phân tích dữ liệu mới`: trả về `14` đoạn (`8` AI gợi ý + `6` trong `Đoạn AI không chọn`), `0` ký tự `#`/`**` thô trong nội dung cả 14 thẻ, API `/knowledge/fetch-url` và `/knowledge/ingestions` đều `200 OK`, `0` lỗi console.

### 13.15 Nâng trần trích dẫn tạm thời lên 30 đoạn, Làm rõ UI bộ đếm Tab 2 & Nút xóa toàn bộ đoạn cũ Tab 1 (`TASK-15-R21`, 15/11/2026)

- **Mở rộng hạn mức trích dẫn lên 30 đoạn (Core API & Web Frontend)**:
  - Backend Core API (`backend/core-api/src/Lavitree.Api/Controllers/KnowledgeController.cs`, `backend/core-api/src/Lavitree.Application/DTOs/KnowledgeIngestionDtos.cs`):
    - Đổi cấu hình mặc định `GetIngestConfigInt("INGEST_MAX_CHUNKS", ..., 30, 1, 100)`.
    - Cập nhật ràng buộc DTO validation `[MaxLength(30, ErrorMessage = "Mỗi bài chỉ được trích dẫn tối đa 30 đoạn nguyên văn.")]` cho `CommitIngestionRequestDto.Selections`.
    - Ghi nhận TODO trong `tasks/TODO.md`: siết lại hạn mức từ 30 về 8–20 đoạn và tỉ lệ 30% cho giai đoạn thương mại (sau bảo vệ đồ án).
  - Web Frontend (`frontend/web/src/pages/AdminDashboard.tsx`):
    - Cập nhật các vị trí quota: `availableSlots = 30 - existingVerbatimCount`, `selections.length + existingVerbatimCount > 30`, `countWithSaved >= 30`, `countWithSaved > 30` ở cả chế độ nhập mới và nạp thêm.
- **Tách bạch & Làm rõ UI bộ đếm đoạn trích ở Tab 2 (Nạp thêm dữ liệu bài báo)**:
  - Thay thế badge gộp gây hiểu nhầm bằng 2 badge riêng biệt:
    - Badge `Mới chọn: {countSelected}` (màu xanh ngọc).
    - Badge `Tổng nguyên văn: {countWithSaved} / 30 đoạn (Tab 1 đã lưu {existingVerbatimCount})` (nổi bật màu hổ phách khi chạm ngưỡng 30).
  - Bổ sung banner cảnh báo màu hổ phách ở đầu danh sách đoạn mới khi chạm trần 30 đoạn, giải thích rõ nguyên nhân checkbox bị khóa và hướng dẫn sang Tab 1 xóa bớt đoạn cũ hoặc xóa sạch để nạp lại.
  - Cập nhật tooltip/title trên checkbox khi bị khóa: `"Đã đạt giới hạn tối đa 30 đoạn nguyên văn của bài viết (Tab 1 đã lưu {existingVerbatimCount} đoạn)"`.
- **Bổ sung nút `[🗑️ Xóa toàn bộ đoạn cũ]` ở Tab 1 (Các đoạn trích đã lưu)**:
  - Thêm nút màu đỏ viền hồng cạnh nút duyệt, có hộp thoại xác nhận `window.confirm` cảnh báo trước khi thao tác.
  - Gọi endpoint `POST /api/v1/knowledge/sources/batch-delete` với danh sách id của `editRows`.
  - Tự động reset `editRows = []`, xóa `savedVerbatimTexts` và đưa `existingVerbatimCount` về `0`, mở khóa tức thì cho Tab 2 để Admin tick chọn các đoạn mới.

### 13.16 Trích xuất tác giả & ngày đăng từ cấu hình DOM Haravan/Shopify & Bóc tách thứ ngày tiếng Việt (`TASK-15-R22`, 15/11/2026)

- **Nguyên nhân không crawl được `My Trần` & `Th 2 11/08/2025`**:
  - Tên tác giả `My Trần` nằm trong `<meta itemprop="author" content="My Trần">` và khối `<div class="article-details"><div class="media"><div class="media-body"><div class="mt-0">My Trần</div>` (không mang class `.author`, `.authors`, `[rel="author"]` cũ).
  - Ngày đăng nằm trong `<small class="text-muted font-weight-light">Th 2 11/08/2025</small>` (hai thẻ `<meta itemprop="datePublished">` và `dateModified` trên trang bị rỗng `content=""`, không dùng thẻ `<time>`, không có class `.date`/`.post-date`, và bị tiền tố thứ ngày `Th 2 ` làm trượt regex neo `^`).
  - Toàn bộ khối `.media` chứa `div.mt-0` và `small` nằm ngoài bộ lọc thẻ đoạn văn (`p, h1..h6, li, table`) nên bị bỏ qua.
- **Giải pháp xử lý triệt để (`frontend/web/src/pages/AdminDashboard.tsx` & `backend/core-api/src/Lavitree.Api/Controllers/KnowledgeController.cs`)**:
  - `cleanArticleTextFromHtml`:
    - Mở rộng bộ chọn tác giả `authorMeta`: đọc thêm `meta[itemprop="author"]`, `meta[property="article:author"]`, `meta[name="creator"]`, `meta[name="byl"]`.
    - Mở rộng `authorEls`: quét thêm `.author-name`, `.user-author`, `.entry-author`, `.media-body .mt-0`, `.article-details .media .media-body div:first-child`, `.time-post-article`, `.post-meta .author`.
    - Tự động quét ngày đăng từ danh sách thẻ thời gian DOM (`small`, `small.text-muted`, `.media small`, `.article-details small`, `.time-post-article`, `[itemprop="datePublished"]`) khi thẻ `<meta>` bị rỗng hoặc không tồn tại.
  - `normalizeDateDisplay` & `extractDateFromSegment`:
    - Bóc tách và loại bỏ tiền tố thứ ngày tiếng Việt và tiếng Anh (`Th 2`, `Thứ Hai`, `Thứ 2`, `CN`, `Monday`...) trước khi chuẩn hóa định dạng ngày (`DD/MM/YYYY`).
  - `extractKeyMetadataFromText`:
    - Bổ sung quy tắc nhận diện ngày đăng đứng riêng dòng ngắn đầu bài và cặp Tác giả – Ngày đăng liền kề (`Dòng 1: Tên người`, `Dòng 2: Ngày tháng`) khi copy/paste văn bản thủ công.
  - Core API (`KnowledgeController.cs`):
    - Mở rộng `MetadataKeyLineRegex` nhận diện thêm tiền tố `người\s*viết` làm dòng siêu dữ liệu.

### 13.17 Nâng cấp xóa đoạn trích có lựa chọn & Nút xóa nhanh các đoạn chưa duyệt Tab 1 (`TASK-15-R23`, 15/11/2026)

- **Vấn đề thực tế**: Nút `[🗑️ Xóa toàn bộ đoạn cũ]` ở Tab 1 mang tính xóa càn quét (blanket delete), gây bất tiện khi Admin đã kiểm duyệt cẩn thận nhiều đoạn trích chuẩn và chỉ muốn loại bỏ các đoạn rác hoặc các đoạn chưa duyệt để giải phóng trần quota nạp đoạn mới.
- **Giải pháp hoàn thiện (`frontend/web/src/pages/AdminDashboard.tsx`)**:
  - **Checkbox chọn lọc trên từng đoạn trích**: Thêm ô tick `[ ]` (`selectedEditRowIds`) cạnh nhãn `Đoạn #K`, hỗ trợ hiệu ứng highlight viền xanh ngọc `ring-emerald-500` nổi bật khi được chọn.
  - **Thanh thao tác hàng loạt khi có đoạn được chọn (`selectedEditRowIds.length > 0`)**:
    - Badge đếm số đoạn đã chọn: `Đã chọn K/N đoạn`.
    - Nút `[✓ Duyệt (K)]` và `[Bỏ duyệt (K)]` gọi endpoint batch approve của Core API.
    - Nút màu đỏ nổi bật: **`[🗑️ Xóa K đoạn đã chọn]`** gọi `POST /api/v1/knowledge/sources/batch-delete`, giải phóng ngay các đoạn được chọn khỏi `editRows` và `sources`.
    - Nút `[Bỏ chọn]` để hủy nhanh toàn bộ lựa chọn.
  - **Nút thông minh khi chưa tick chọn đoạn nào**:
    - Khi có đoạn chưa duyệt (`pendingCount > 0`): Hiển thị nút màu cam thông minh **`[🗑️ Xóa P đoạn chưa duyệt]`** kèm xác nhận an toàn nhắc rõ các đoạn đã duyệt sẽ được bảo vệ 100%. Bấm nút này lập tức xóa sạch các đoạn rác/chưa duyệt chỉ với 1 cú click.
    - **Xóa bỏ hoàn toàn nút blanket `[Xóa toàn bộ bài]`**: Loại bỏ nút xóa toàn bộ khỏi thanh công cụ chính để triệt tiêu hoàn toàn nguy cơ vô tình bấm nhầm làm mất các đoạn đã duyệt. Khi bài viết đã được duyệt 100% (như trường hợp 19/19 đoạn), thanh công cụ trên cùng không có bất kỳ nút xóa nào. Nếu Admin thực sự muốn xóa hết, phải chủ động tick `Chọn tất cả` rồi mới bấm `[Xóa {N} đoạn đã chọn]` kèm hộp thoại cảnh báo.
  - **Thanh chọn nhanh phụ (Sub-toolbar)**:
    - Checkbox master `Chọn tất cả (N)` (hỗ trợ trạng thái gạch ngang `indeterminate` khi chọn dở).
    - Nút `Chỉ chọn P đoạn chưa duyệt` và `Chỉ chọn A đoạn đã duyệt`.
  - **Mở khóa quota Tab 2**: Sau khi xóa chọn lọc hoặc xóa đoạn chưa duyệt, `editRows` giảm $\rightarrow$ `existingVerbatimCount` giảm $\rightarrow$ Tab 2 tự động mở thêm slot khả dụng cho Admin tick nạp đoạn mới.
- **Kiểm chứng**: Core API `dotnet build` (`0` lỗi), Frontend `npm run build` (`2002 modules transformed`, `0` lỗi).

### 13.18 Mở rộng tạm thời hạn mức trích dẫn lên sàn 20.000 ký tự & 90% phục vụ phát triển nhanh (`TASK-15-R24`, 15/11/2026)

- **Yêu cầu**: Nâng trần hạn mức ký tự trích dẫn tạm thời lên sàn 20.000 ký tự để nhóm dev thoải mái nạp các bài báo dài mà không bị chặn bởi quota ký tự (~4.000 ký tự trước đó). Việc siết lại hạn mức theo luật bản quyền thương mại đã được ghi rõ trong task TODO để xử lý sau khi hoàn thiện toàn bộ các chức năng khác của hệ thống.
- **Thay đổi thực hiện**:
  - `backend/core-api/src/Lavitree.Api/Controllers/KnowledgeController.cs`:
    - `INGEST_MIN_QUOTA_FLOOR`: Nâng mặc định từ `2.500` lên `20.000` (trần tối đa `50.000`).
    - `INGEST_MAX_RATIO_PERCENT`: Nâng mặc định từ `60%` lên `90%`.
    - `INGEST_MAX_CHUNK_CHARS`: Nâng mặc định từ `1.500` lên `3.000` (trần tối đa `10.000`).
  - `frontend/web/src/pages/AdminDashboard.tsx`:
    - Đồng bộ công thức: `allowedCharsQuota = Math.max(20000, Math.floor(articleLength * 0.90))`.
    - Cập nhật cả `allowedQuota` trong hàm kiểm tra trước khi gửi `handleCommitParagraphs`.
  - `tasks/TODO.md`:
    - Cập nhật mục `TODO Hậu Đồ Án (Commercial Release Hardening)` ghi rõ nhiệm vụ siết lại: `INGEST_MAX_CHUNKS` (từ 30 về 8–20 đoạn), `INGEST_MIN_QUOTA_FLOOR` (từ 20.000 về 2.500–4.000 ký tự), và `INGEST_MAX_RATIO_PERCENT` (từ 90% về 30–60%).
- **Kiểm chứng**: Core API `dotnet build` thành công (`0` lỗi, `8.26s`), Frontend `npm run build` thành công (`2002 modules transformed`, `0` lỗi, `3.73s`).

### 13.19 Nạp nhiều ảnh triệu chứng, Gom nhóm thông minh gợi ý vật tư, Tra cứu Google & Chuẩn hóa tạo sản phẩm (`TASK-15-R25`, 15/11/2026)

- **Bối cảnh & Phản hồi thực tế từ Admin**:
  1. *Ảnh triệu chứng*: Modal chỉ cho thêm 1 ảnh một lần; muốn thêm hàng loạt nhiều ảnh cùng lúc bằng cách dán nhiều link HTTPS hoặc chọn nhiều file tải lên MinIO.
  2. *Gợi ý vật tư quá nhiều và lặp lại*: Một bài báo 14 đoạn nhắc đi nhắc lại "Trichoderma", "vôi", "phân lân" sinh ra tới 42 dòng gợi ý trùng lặp, gây rối loạn danh sách và mất công xử lý từng dòng.
  3. *Đoạn trích bằng chứng bị xấu*: Cột đoạn trích bằng chứng hiển thị ký tự Markdown thô (`##`, `###`, `**`) và bị cắt cụt `...` không có cách xem toàn văn.
  4. *Biện pháp canh tác (PRACTICE) bị khóa*: Code trước đó hardcode ẩn nút Tạo SP và Gắn SP với loại `PRACTICE`, khiến Admin không thể tạo vật tư hỗ trợ (bẫy dính, lưới chắn, kéo cắt cành) hoặc xác nhận ghi nhận kỹ thuật vào sổ tay.
  5. *Form Tạo thuốc / vật tư quá khắt khe*: Bắt buộc PHI, bắt buộc link nguồn tra cứu, bắt buộc giá bán/tồn kho ngay cả với chế phẩm sinh học hay vật tư canh tác (vốn không có PHI). Đồng thời form thiếu ô nhập ảnh sản phẩm và mô tả đặc tính kỹ thuật.
  6. *Tra cứu tra tìm khó khăn*: Thiếu phím tắt tra Google nhanh về tên hoạt chất, sản phẩm hoặc hình ảnh.
- **Giải pháp hoàn thiện**:
  - **Nạp nhiều ảnh triệu chứng cùng lúc (`addImageModalOpen`)**:
    - Phương thức URL: Đổi sang `<Textarea>` font mono cho phép dán nhiều URL (mỗi URL 1 dòng hoặc cách nhau bởi dấu phẩy). Tự động phân tích các URL hợp lệ (`parsedImageUrls`), hiển thị lưới thumbnail xem trước kèm số thứ tự.
    - Phương thức tải tệp: Bổ sung thuộc tính `multiple` cho `<Input type="file">`, hỗ trợ chọn nhiều tệp ảnh cùng lúc (JPG, PNG, WebP $\le 5$MB), tự động xóa EXIF và hiển thị lưới xem trước các tệp tải lên (`newImageFilePreviews`).
    - Nút lưu hiển thị số lượng batch: `Lưu hàng loạt (N ảnh)`. Vòng lặp tự động gửi lần lượt từng ảnh lên backend.
  - **Gom nhóm thông minh gợi ý vật tư (Group by Mention Text & Kind)**:
    - Bổ sung bộ chuyển đổi chế độ xem trên thanh công cụ: `Gộp theo tên ({groupedSuggestions.length})` vs `Tất cả đoạn ({filteredSuggestions.length})`.
    - Khi ở chế độ gộp: Gom toàn bộ gợi ý có cùng tên vật tư và loại vào 1 dòng đại diện (`primaryItem`), hiển thị badge `Xuất hiện ở N đoạn trích`.
    - Khi Admin bấm `Tạo SP`, `Gắn SP`, hoặc `Bỏ qua` trên dòng gộp: Cả Frontend và Backend Core API (`MedicinesController.CreateMedicine`, `KnowledgeController.LinkProductSuggestion`, `KnowledgeController.DismissProductSuggestion`) tự động tìm toàn bộ các gợi ý còn lại có cùng `mention_text` để cập nhật đồng bộ trạng thái `ADDED`, `LINKED`, hoặc `DISMISSED`. 42 dòng trùng lặp được xử lý dứt điểm chỉ trong 1 thao tác!
  - **Phím tắt tra cứu Google nhanh (`[🔍 Tra Google]`)**:
    - Bổ sung nút bấm `[🔍 Tra Google]` cạnh từng từ khóa vật tư trong bảng gợi ý và popover bằng chứng, mở tab tìm kiếm Google với từ khóa chuyên ngành nông nghiệp.
    - Bổ sung nút `[🔍 Tra Google]` trực tiếp trên form Tạo sản phẩm để Admin tra nhanh nhãn mác, hình ảnh và liều dùng.
  - **Làm sạch định dạng đoạn trích bằng chứng & Dialog xem chi tiết (`viewingEvidenceItem`)**:
    - Thêm hàm `cleanEvidencePreview(text)`: loại bỏ sạch sẽ các ký tự `#`, `##`, `###`, `**`, bullet points, chuẩn hóa khoảng trắng giúp hiển thị câu chữ trang nhã, dễ đọc trong ô bảng.
    - Thêm nút `[👁️ Xem chi tiết đoạn trích (N)]` mở modal popover hiển thị toàn văn ngữ cảnh đoạn trích bóc tách từ bài báo, độ dài ký tự, chuyên đề cây-bệnh, phân loại và liên kết bài viết gốc.
  - **Mở khóa toàn diện cho Biện pháp canh tác (`PRACTICE`)**:
    - Cho phép `[+ Tạo vật tư]` (để tạo các sản phẩm hỗ trợ canh tác như bẫy vàng Pheromone, túi bao trái, kéo tỉa).
    - Cho phép `[🔗 Gắn SP]` (gắn vào vật tư có sẵn).
    - Bổ sung nút chuyên biệt `[✓ Ghi nhận]` (ghi nhận kỹ thuật canh tác vào sổ tay nông vụ và đánh dấu hoàn tất gợi ý).
  - **Chuẩn hóa & Nới lỏng form Tạo thuốc / vật tư (`createMedModalOpen`)**:
    - Bổ sung trường `Ảnh sản phẩm (URL)` (`newMedImageUrl`) kèm thumbnail xem trước ảnh.
    - Bổ sung trường `Mô tả sản phẩm / Đặc tính kỹ thuật` (`newMedDescription`) lưu trữ công dụng, cơ chế và liều lượng.
    - Nới lỏng PHI: Chỉ khuyến nghị đối với thuốc `Hóa học` (mặc định 7 ngày nếu để trống); đối với `Sinh học` và `Vật tư canh tác` mặc định 0 ngày (không bắt buộc).
    - Nới lỏng link nguồn tra cứu: Chuyển thành trường tùy chọn (`tùy chọn`).
    - Nới lỏng giá bán & tồn kho: Không chặn cứng form khi Admin muốn nạp sản phẩm kỹ thuật hoặc tư vấn.
- **Kiểm chứng kỹ thuật**:
  - Backend Core API `dotnet build Lavitree.sln --no-restore --disable-build-servers -m:1` thành công (`0` lỗi, `10.33s`).
  - Frontend `npm run build` (`tsc && vite build`) thành công (`2002 modules transformed`, `0` lỗi, `14.77s`).

### 13.20 Dọn dẹp nút Tra Google ở bảng, Khắc phục ô mô tả & Tích hợp AI Crawl tự điền sản phẩm từ URL (`TASK-15-R26`, 15/11/2026)

- **Vấn đề phản ánh từ Admin**:
  1. *Ảnh 1*: Nút `[Tra Google]` khối to màu xanh nhạt nằm choán chỗ trong ô tên vật tư ở bảng gợi ý, làm phình dòng và đè lên badge số đoạn trích.
  2. *Ảnh 2*: Ô *Mô tả sản phẩm / Đặc tính kỹ thuật* bị tự động điền sẵn nguyên văn cả đoạn trích bài báo dài `795/1000` ký tự (không phải mô tả sản phẩm).
  3. *Đề xuất*: Đưa ô Link URL tra cứu lên vị trí số 1 đầu form và bổ sung tính năng AI đọc trang web tự động điền các trường còn lại (ảnh sản phẩm, tên, hoạt chất, liều dùng, giá...).
- **Giải pháp triển khai (`frontend/web/src/pages/AdminDashboard.tsx`)**:
  - **Dọn dẹp bảng gợi ý vật tư (Ảnh 1)**:
    - Gỡ bỏ hoàn toàn nút `[Tra Google]` khối to khỏi cột vật tư ở cả 2 chế độ xem gộp (`grouped`) và phẳng (`all`).
    - Giữ giao diện bảng tinh gọn, thông thoáng và chuẩn mực; các thao tác tra cứu tập trung vào modal tạo sản phẩm và popup xem bằng chứng.
  - **Khắc phục ô mô tả sản phẩm (Ảnh 2)**:
    - Trong `handleOpenCreateMedModal`: reset `newMedDescription = ''` (rỗng hoàn toàn) khi mở modal thay vì gán đoạn trích bài báo.
  - **Khối Link URL và AI Crawl Auto-fill đưa lên đầu Form**:
    - Chuyển trường *Link trang sản phẩm / nhãn thuốc (URL)* lên vị trí số 1 ngay đầu form tạo sản phẩm.
    - Tích hợp nút `[🔍 Tra Google tìm link]` mở tab tìm kiếm Google sản phẩm.
    - Tích hợp nút **`[⚡ AI đọc & Điền]`** (`handleAiAutofillProductFromUrl`):
      - Tải HTML trang web qua proxy SSRF-safe (`/knowledge/fetch-url`).
      - Dùng DOMParser, Schema.org JSON-LD và biểu thức quy chuẩn tự động bóc tách:
        - `image_url`: Ảnh sản phẩm chuẩn từ `og:image`, `twitter:image`, Microdata/JSON-LD, tự động kích hoạt khung xem trước ảnh.
        - `name`: Tên thương mại sạch (đã dọn dẹp hậu tố sàn TMĐT Shopee, Tiki, VTNN...).
        - `active_ingredient`: Hoạt chất bóc tách từ thông số bài viết.
        - `description`: Mô tả ngắn gọn 2-3 câu từ thẻ `og:description` / meta description.
        - `dosage_instruction`: Liều lượng hướng dẫn pha bình.
        - `phi_days`: Ngày cách ly (nếu là thuốc BVTV).
        - `price`: Giá bán niêm yết (nếu có từ Schema.org Product).
        - `medicine_type`: Tự nhận diện Hóa học / Sinh học / Vật tư canh tác.
      - Tự động điền đầy đủ vào các ô trong form.
- **Kiểm chứng kỹ thuật**:
  - Frontend `npm run build` (`tsc && vite build`) thành công (`2002 modules transformed`, `0` lỗi, `9.77s`).

---

### 13.21 Bộ soi tài liệu gốc (Raw Inspector) 2 cột đối chiếu song song, Thư viện 2-4 ảnh ứng viên & Chuẩn hóa AI bóc tách Vật tư (`TASK-15-R27`, 15/11/2026)

- **Vấn đề phản ánh từ Admin khi kiểm thử thực tế với trang `vietchem.com.vn/tin-tuc/voi-bot.html`**:
  1. *Lỗi tên sản phẩm*: Tự điền cả câu giật tít blog câu hỏi: *"Vôi Bột Là Gì? Tác Dụng, Giá Cả & Cách Sử Dụng Hiệu Quả"* thay vì tên ngắn gọn chuẩn danh mục ("Vôi bột" hoặc "Vôi bột nông nghiệp").
  2. *Lỗi phân loại*: Nhận diện nhầm thành *"Chế phẩm sinh học BVTV"* do trong bài viết có câu chứa từ "sinh học" ("kết hợp cùng các biện pháp sinh học, hóa học...").
  3. *Lỗi hoạt chất*: Điền tên sản phẩm vào ô hoạt chất thay vì công thức hóa học `CaO (Canxi oxit)`.
  4. *Lỗi mô tả*: Trích xuất mô tả giật tít của blog thay vì công dụng nông nghiệp thực tế (cải tạo đất, hạ phèn, khử trùng diệt nấm khuẩn).
  5. *Yêu cầu ảnh & CSDL*: Hiện chỉ trích xuất được 1 ảnh; yêu cầu lấy 2-4 ảnh để Admin chủ động chọn; đồng thời kiểm tra xem DB đã có trường ảnh cho nhóm Vật tư canh tác chưa.
  6. *Yêu cầu giao diện 2 cột (Raw Inspector)*: Modal tạo sản phẩm hiện tại quá nhỏ (`sm:max-w-lg`). Yêu cầu mở rộng thành giao diện 2 cột chuẩn như màn hình Nhập bài báo:
     - Cột trái: Form nhập liệu + Thư viện ảnh ứng viên (bấm để chọn).
     - Cột phải: Bản raw nội dung trang web với 2 chế độ `👁️ Văn bản đẹp` (mặc định) và `</> Code Markdown`.
     - Tương tác thông minh: Khi Admin focus vào bất kỳ ô nào ở cột trái (Tên, Ảnh, Mô tả, Phân loại, Hoạt chất, Giá, PHI, Liều lượng), cột phải tự động cuộn đến phần nội dung tương ứng và viền nổi bật màu hổ phách.
- **Giải pháp kiến trúc & triển khai**:
  - **Xác nhận Cơ sở dữ liệu CSDL**:
    - Thực thể `Product.cs` và bảng CSDL `Products` đã có sẵn cột `ImageUrl` (kiểu `text`, nullable).
    - Cột này được dùng chung cho mọi phân loại sản phẩm trong hệ thống bao gồm `Thuốc BVTV hóa học`, `Chế phẩm sinh học BVTV` và `Vật tư canh tác` (`MedicineType = 'Vật tư canh tác'`). Khi tạo sản phẩm mới, URL ảnh được lưu trực tiếp vào CSDL và sẵn sàng hiển thị trên Sổ tay bệnh học cũng như danh mục vật tư.
  - **Chuẩn hóa thuật toán bóc tách AI (`handleAiAutofillProductFromUrl`)**:
    - *Lọc sạch tiêu đề blog câu hỏi*: Dùng regex loại bỏ các hậu tố `"Là gì? Tác dụng, giá cả & cách sử dụng hiệu quả..."`, dấu chấm hỏi `?`, và tên thương hiệu website. Fallback về tên viết hoa của `fromSuggestion.mention_text` nếu tiêu đề bị rỗng.
    - *Phân loại thông minh phân tầng*: Ưu tiên kiểm tra từ khóa Vật tư canh tác (`vôi bột`, `vôi tôi`, `đá vôi`, `bẫy dính`, `lưới`, `bạt`, `kéo`, `phân trùn`, `phân chuồng`, `phân bón`...) lên hàng đầu. Khắc phục triệt để lỗi "sinh học" lấn át khi bài viết nhắc từ ngữ phụ.
    - *Nhận diện công thức hóa học*: Tự động phát hiện `CaO` -> `CaO (Canxi oxit)`, `Ca(OH)2`, `CaCO3`. Đối với Vật tư canh tác, trường hoạt chất được để trống/không bắt buộc.
    - *Bóc tách mô tả nông nghiệp*: Ưu tiên các đoạn văn bản trong bài có nhắc đến *nông nghiệp*, *khử trùng đất*, *cải tạo đất*, *hạ phèn*, *nâng pH*, *diệt khuẩn nấm bệnh*.
    - *Thư viện 2-4 ảnh ứng viên (`candidateImages`)*: Quét đồng thời `og:image`, `twitter:image`, JSON-LD và các thẻ `<img>` trong bài viết; lọc bỏ svg/ico/ảnh rác, chuẩn hóa URL tuyệt đối và lấy danh sách ảnh ứng viên.
  - **Thiết kế lại Giao diện 2 Cột Split-Screen (`AdminDashboard.tsx`)**:
    - Modal mở rộng thành `sm:max-w-6xl w-[96vw] max-h-[92vh] flex flex-col`.
    - **Cột trái (Form nhập liệu)**:
      - Khối URL + nút `[AI đọc & Điền]`.
      - Khối lưới Thumbnail chọn ảnh ứng viên: Hiển thị 2-4 ảnh tìm thấy; nhấp chuột trực tiếp vào ảnh để gán làm ảnh sản phẩm (có viền xanh lục `ring-emerald-500` và dấu tích check).
      - Các ô input gắn sự kiện `onFocus={() => scrollToInspectorSection(fieldKey)}`.
    - **Cột phải (Raw Inspector - Bộ soi dữ liệu gốc)**:
      - Header: Tiêu đề + Bộ chuyển đổi `👁️ Văn bản đẹp` vs `</> Markdown` + Nút `[Sao chép Markdown]` + Nút mở link gốc.
      - Chế độ `👁️ Văn bản đẹp`: Hiển thị các khối dữ liệu cấu trúc (`sec-title`, `sec-image`, `sec-description`, `sec-category`, `sec-active`, `sec-dosage`, `sec-phi`, `sec-price`, `sec-raw-body`).
      - Chế độ `</> Markdown`: Hiển thị văn bản Markdown nguyên bản có định dạng.
      - Tương tác đồng bộ: Khi Admin focus vào trường nào bên trái, hàm `scrollToInspectorSection` kích hoạt `activeInspectorField = fieldKey`, tự động cuộn mượt đến khối tương ứng và gắn hiệu ứng viền nổi bật màu hổ phách (`border-amber-400 bg-amber-50/80 ring-2 ring-amber-400/50`).
- **Kiểm chứng kỹ thuật**:
  - Frontend `npm run build` (`tsc && vite build`) thành công (`2002 modules transformed`, `0` lỗi, `10.59s`).

---

### 13.22 Xóa khối ảnh trùng, Lọc ảnh cờ rác, Ẩn Raw mặc định & Tích hợp Chế độ Dev (Prompt Gemini Web + Nạp JSON) (`TASK-15-R28`, 15/11/2026)

- **Vấn đề phản ánh từ Admin**:
  1. *Trùng ảnh*: Cột trái hiển thị một khối ảnh ứng viên to tướng ở đầu form, dưới lại có khối xem trước ảnh, và bên cột phải lại hiển thị tiếp -> gây rối mắt và lặp lại.
  2. *Ảnh rác / cờ quốc gia*: Trang web (như Vietchem) có thanh chọn ngôn ngữ nên crawler bóc tách nhầm các icon cờ Việt Nam, cờ Mỹ, cờ Nhật làm ảnh sản phẩm.
  3. *Lưu trữ CSDL*: DB có cho phép chọn nhiều ảnh không? -> Cần làm rõ: Bảng `Products` chỉ lưu 1 ảnh chính (`ImageUrl` là chuỗi `TEXT`), do đó chỉ hiển thị duy nhất ảnh đã chọn ở dưới ô *Ảnh sản phẩm (URL tùy chọn)*.
  4. *Đề xuất Chế độ Dev (Prompt Gemini)*: Để không mất thời gian chỉnh sửa do crawler cục bộ không bằng mô hình AI xịn, nên ẩn cột Raw Inspector mặc định và cung cấp nút **Chế độ Dev** (gồm nút sao chép prompt mẫu ném cho Gemini Web/Advanced xịn làm, và ô dán JSON kết quả để điền tự động).
  5. *Thắc mắc về unit "Biện pháp" và nút "Ghi nhận"*: Cần giải thích rõ nguồn gốc và vai trò của nút này trong bảng gợi ý.
- **Giải pháp triển khai (`frontend/web/src/pages/AdminDashboard.tsx`)**:
  - **Dọn dẹp ảnh trùng & Lọc sạch ảnh cờ**:
    - Xóa bỏ hoàn toàn khối thư viện ảnh ứng viên ở phía trên trường *Tên thuốc / Tên sản phẩm*.
    - Chỉ hiển thị một khung xem trước duy nhất của ảnh được chọn ngay bên dưới ô *Ảnh sản phẩm (URL tùy chọn)* kèm nhãn *"Ảnh đã chọn (lưu vào CSDL)"* và nút gỡ ảnh.
    - Cập nhật hàm `addCandidateImg` tự động loại bỏ các ảnh có tên tệp/URL chứa `flag`, `quoc-ky`, `lang`, `language`, `cờ`, `icon`, `logo`, `avatar`, `vietnam`, `united-states`, `japan`.
  - **Ẩn Raw Inspector mặc định & Nút mở rộng 2 cột**:
    - Biến trạng thái `showRawInspector` mặc định là `false`.
    - Khi đóng: Modal ở dạng 1 cột thon gọn (`sm:max-w-2xl`).
    - Nút `[👁️ Soi trang gốc]` trên header cho phép Admin chủ động mở rộng thành 2 cột (`sm:max-w-6xl`) khi thực sự cần đối chiếu văn bản gốc.
  - **Tích hợp Chế độ Dev (Gemini Prompt & Nạp JSON)**:
    - Nút `[🛠️ Chế độ Dev]` trên header mở rộng một thẻ công cụ màu xanh chuyên dụng.
    - Nút **`[📋 Sao chép Prompt cho Gemini]`**: Tự động tổng hợp URL bài viết, tên nhận diện và trích đoạn nội dung tạo thành prompt định dạng JSON hoàn chỉnh cho Gemini Web (Advanced).
    - Ô `<Textarea>` dán kết quả từ Gemini.
    - Nút **`[⚡ Điền form từ Gemini]`**: Phân tích cú pháp JSON và tự động điền đầy đủ mọi thông số vào form chỉ với 1 cú click.
  - **Giải thích tường minh về unit "Biện pháp" và nút "Ghi nhận"**:
    - Khi đọc bài báo kỹ thuật, các đoạn trích thường chứa 4 loại thực thể: Thuốc hóa học (`CHEMICAL`), Thuốc sinh học (`BIOLOGICAL`), Vật tư (`SUPPLY`), và Biện pháp canh tác (`PRACTICE`).
    - Khác với thuốc/vật tư là hàng hóa mua bán được, *Biện pháp canh tác* (như cắt tỉa cành, nhổ bỏ cây bệnh, luân canh...) là **thao tác kỹ thuật** chứ không phải mặt hàng bán trong tiệm thuốc.
    - Do đó, nút **`[Ghi nhận]`** giúp Admin ghi nhận biện pháp này vào sổ tay kỹ thuật và đánh dấu đã xử lý (Dismiss), dọn sạch danh sách chờ duyệt mà không ép Admin phải tạo sản phẩm giả trong kho hàng.
- **Kiểm chứng kỹ thuật**:
  - Frontend `npm run build` (`tsc && vite build`) hoàn thành thành công trong `3.79s` (`2002 modules transformed`, `0` lỗi).

---

### 13.23 Bỏ nút Crawler & Raw Inspector, Tối giản Chế độ Dev `</>`, Cảnh báo thiếu URL, Nâng cấp Mô tả chuyên sâu & Không chỉ định bệnh hại (`TASK-15-R29`, 15/11/2026)

- **Phản hồi từ Admin**:
  1. *Chất lượng Gemini Web vượt trội*: Việc dùng Gemini Web (Advanced) cho kết quả rất tốt, do đó các tính năng crawler nội bộ tạm thời như nút `[AI đọc & Điền]` (Ảnh 1) và nút `[👁️ Soi trang gốc]` kèm cột Raw Inspector cồng kềnh (Ảnh 2) không còn cần thiết $\rightarrow$ Yêu cầu gỡ bỏ hoàn toàn để giao diện tinh gọn, tập trung.
  2. *Nút Chế độ Dev*: Rút gọn thành biểu tượng `</>` chuyên nghiệp như chế độ developer.
  3. *Cảnh báo khi sao chép prompt*: Khi người dùng bấm sao chép prompt mà chưa dán URL sản phẩm, hệ thống phải cảnh báo rõ ràng.
  4. *Nâng cấp mô tả (Description)*: Prompt ban đầu sinh mô tả quá hời hợt (1-3 câu); yêu cầu mô tả chuyên sâu và thực tế như bài viết Vietchem (giải thích là gì, phân loại các dạng thường gặp, công dụng nông nghiệp hạ phèn/khử trùng đất, và lưu ý an toàn kỹ thuật khi bón).
  5. *Bệnh hại mục tiêu*: Bổ sung trường `target_disease_code` vào prompt và logic nạp JSON; nếu là vật tư cải tạo đất chung (như vôi bột, phân bón, bạt phủ...) thì mặc định là *"Không chỉ định"* (áp dụng diện rộng).
- **Giải pháp triển khai (`frontend/web/src/pages/AdminDashboard.tsx`)**:
  - **Tối giản hóa giao diện Modal**:
    - Gỡ bỏ hoàn toàn nút `[AI đọc & Điền]` khỏi khối URL; ô nhập URL chiếm toàn bộ chiều ngang thanh thoát.
    - Gỡ bỏ hoàn toàn nút `[👁️ Soi trang gốc]` và toàn bộ cột Raw Inspector. Modal trở về kích thước 1 cột chuẩn mực (`sm:max-w-2xl max-h-[92vh] overflow-y-auto`).
    - Nút Chế độ Dev trên header thu gọn thành biểu tượng **`</>`** font monospace với tooltip *"Chế độ Dev: Tạo prompt cho Gemini & Nạp JSON tự động"*.
  - **Chốt chặn kiểm tra URL**:
    - Khi bấm `[📋 Sao chép Prompt cho Gemini]`, nếu `newMedSourceUrl.trim()` rỗng, hàm lập tức hiển thị `toast.error('Vui lòng dán Link trang sản phẩm / nhãn thuốc (URL) trước khi sao chép prompt!')` và dừng lại.
  - **Nâng cấp nội dung Prompt cho Gemini**:
    - Mô tả (`description`): Yêu cầu viết từ 150 - 350 từ chia thành 4 ý rõ ràng:
      1. Bản chất: Sản phẩm là gì?
      2. Phân loại/Dạng thường gặp (vôi bột nông nghiệp, vôi tôi, vôi sống, bột đá vôi...).
      3. Công dụng nông nghiệp chính: Khử trùng đất, tiêu diệt mầm bệnh nấm khuẩn, hạ phèn, nâng pH đất, kích rễ, giải độc.
      4. Lưu ý an toàn & kỹ thuật: Thời điểm bón, không trộn ngay với phân đạm/phân chuồng chưa hoai để tránh mất đạm.
    - Bệnh hại mục tiêu (`target_disease_code`): Bổ sung hướng dẫn và trường JSON; nếu là vật tư cải tạo đất chung thì để `"NONE"`.
  - **Cập nhật logic nạp JSON (`handleApplyGeminiJson`)**:
    - Nếu `data.target_disease_code` là `"NONE"`, rỗng hoặc chứa chuỗi *"không chỉ định"*, hệ thống gán `newMedTargetDisease = ''` (Hiển thị nhãn *"-- Không chỉ định (áp dụng chung) --"*).
    - Đồng thời trong `handleOpenCreateMedModal`: khi mở tạo sản phẩm từ gợi ý vật tư canh tác (Vôi bột, phân bón...), trường bệnh mục tiêu tự động mặc định là rỗng (Không chỉ định) thay vì gán nhầm sang `Tomato___Late_blight`.
- **Kiểm chứng kỹ thuật**:
  - Frontend `npm run build` (`tsc && vite build`) hoàn thành thành công trong `9.77s` (`2002 modules transformed`, `0` lỗi).

---

### 13.24 Xóa lặp icon Dev, Chống đè nút X đóng, Mở rộng không gian làm việc & Sửa lỗi hiển thị ảnh sản phẩm (`TASK-15-R30`, 15/11/2026)

- **Phản hồi từ Admin (kèm ảnh chụp màn hình `media_1794742682678_816c468b.png`)**:
  1. *Lặp biểu tượng `</>`*: Nút Dev trên thanh tiêu đề hiển thị bị lặp thành `</> < / >` do vừa render icon `<Code2 />` vừa có text `&lt; / &gt;`.
  2. *Đè nút [X] đóng modal*: Nút Dev bị căn sát lề phải, va chạm và bị nút đóng `[X]` của Dialog (`absolute right-4 top-4`) đè trực tiếp lên.
  3. *Mô tả thừa*: Không cần câu chữ giải thích nút ẩn trong phần phụ đề `DialogDescription` và dưới ô URL; cần giữ giao diện tinh gọn, chuyên nghiệp.
  4. *Ảnh không hiện*: Trường ảnh sản phẩm không hiển thị ảnh xem trước (bị biến mất khi tải do CDN chặn Referer hoặc lỗi hotlink).
  5. *Không gian làm việc chật hẹp*: Kích thước modal `sm:max-w-2xl` khá hẹp khi điền thông số và thao tác; yêu cầu mở rộng không gian làm việc rộng rãi hơn.
- **Giải pháp triển khai (`frontend/web/src/pages/AdminDashboard.tsx`)**:
  - **Sửa lặp icon Dev & Chống đè nút [X]**:
    - Xóa bỏ thẻ `<span>&lt; / &gt;</span>`, chỉ giữ lại duy nhất 1 icon `<Code2 className="w-4 h-4" />` chuẩn xác trong nút bấm vuông vắn `h-7 w-7 p-0`.
    - Bổ sung khoảng đệm `pr-8` trên hàng tiêu đề `DialogHeader`, dịch toàn bộ nội dung header cách xa nút đóng `[X]` của Radix Dialog, chống va chạm 100%.
  - **Dọn dẹp phụ đề mô tả thừa**:
    - Chuẩn hóa `DialogDescription` thành: *"Tên và thông tin trích xuất từ bài báo. Có thể cập nhật ảnh, mô tả hoặc tra cứu nhanh để điền thông số."*
    - Chuẩn hóa chú thích dưới URL thành: *"Dán link bài viết hoặc trang sản phẩm để hỗ trợ đối chiếu thông tin và lấy link ảnh sản phẩm."*
  - **Mở rộng không gian làm việc**:
    - Nâng kích thước `DialogContent` từ `sm:max-w-2xl` lên `sm:max-w-3xl lg:max-w-4xl w-[94vw] max-w-4xl max-h-[92vh] overflow-y-auto p-5 sm:p-6`.
  - **Khắc phục triệt để lỗi hiển thị ảnh sản phẩm**:
    - Bổ sung thuộc tính `referrerPolicy="no-referrer"` cho thẻ `<img>` xem trước: Giúp trình duyệt không gửi header `Referer: localhost`, vượt qua cơ chế chống hotlink / leeching của hầu hết CDN (như SudoSpaces, Vietchem, Shopee...).
    - Thêm state `medImageFailed` và xử lý `onError` thông minh: Thay vì ẩn mất thẻ ảnh (`style.display = 'none'`), hiển thị khung thẻ ảnh fallback với icon `<ImageOff className="w-5 h-5 text-amber-600" />` và nhãn *"Lỗi tải ảnh (Trang nguồn chặn nhúng ngoài, hệ thống vẫn lưu link này)"*.
    - Bổ sung liên kết 1-click `[Mở xem ảnh gốc ↗]` cho phép Admin nhấp mở trực tiếp tab mới để kiểm tra ảnh gốc bất cứ lúc nào.
    - Bổ sung dải ảnh gợi ý trích xuất từ bài báo (nếu có `crawledProductSource.candidateImages`), click vào ảnh nào sẽ tự động điền URL ảnh đó vào form.
    - Cải tiến hàm `handleApplyGeminiJson` dùng biểu thức chính quy trích xuất URL ảnh an toàn kể cả khi Gemini bọc trong cú pháp Markdown hoặc dấu ngoặc kép.
- **Kiểm chứng kỹ thuật**:
  - Frontend `npm run build` (`tsc && vite build`) hoàn thành thành công trong `3.92s` (`2002 modules transformed`, `0` lỗi).

---

### 13.25 Định dạng Mô tả Bullet đẹp, Thu gọn Cây-Bệnh thành 2-3 dòng & Multi-Tabs xem trọn 2-4 đoạn trích (`TASK-15-R31`, 15/11/2026)

- **Phản hồi từ Admin (kèm ảnh chụp màn hình `media_1794743551871_ad9c1126.jpg`)**:
  1. *Định dạng mô tả form*: Khung mô tả nhìn hơi xấu, cần chuẩn hóa prompt sinh định dạng rõ ràng, chuyên sâu và có chế độ xem đẹp.
  2. *Bảng gợi ý vật tư bị tràn ngang*: Cột *Cây – Bệnh mục tiêu* để trên 1 dòng quá dài (`whitespace-nowrap`) khiến bảng bị kéo dãn ra ngoài màn hình, Admin luôn phải kéo chuột sang phải mới thao tác được các nút [Tạo SP], [Gắn SP], [Bỏ qua]. Yêu cầu cho cột này ngắt thành 2-3 dòng và tối ưu độ rộng các cột.
  3. *Không xem được đủ 2-4 đoạn trích*: Trước đây khi gợi ý xuất hiện ở 2-4 đoạn trích, bấm vào chỉ mở được duy nhất đoạn trích đầu tiên. Yêu cầu mở thành các Tab để xem được toàn bộ các đoạn trích, và có thể tạo/gắn sản phẩm chung ở ngay trên đầu hoặc từng tab riêng.
- **Giải pháp triển khai (`frontend/web/src/pages/AdminDashboard.tsx`)**:
  - **Định dạng trường Mô tả sản phẩm (Prompt & Form)**:
    - Cập nhật prompt Gemini trong `handleCopyGeminiPrompt`: yêu cầu bố cục 4 phần mạch lạc bằng các dấu chấm đầu dòng • (`• Bản chất & Phân loại`, `• Công dụng nông nghiệp`, `• Phạm vi & Cây trồng`, `• Hướng dẫn & Lưu ý an toàn khi dùng`).
    - Nâng cấp ô nhập mô tả trong modal Tạo sản phẩm: tăng chiều cao lên 5 dòng thoáng đãng, bổ sung nút bấm nhanh `+ Thêm mục •` và bộ chuyển đổi 2 chế độ:
      - `[✏️ Soạn thảo]`: Chỉnh sửa trực tiếp với font sans thoáng đãng.
      - `[👁️ Định dạng đẹp]`: Render tự động thành thẻ preview chuyên nghiệp với chấm tròn xanh emerald, in đậm tiêu đề mục con và thụt lề rõ ràng.
  - **Tối ưu bảng Gợi ý vật tư chống kéo ngang**:
    - Cột *Cây – Bệnh mục tiêu*: Bỏ `whitespace-nowrap`, giới hạn độ rộng cố định `w-[150px] min-w-[130px] max-w-[170px]`, chia thành 2-3 dòng gọn gàng (Dòng 1: chấm xanh + tên cây trồng in đậm; Dòng 2-3: tên bệnh hại màu ghi với `line-clamp-2`).
    - Cột *Đoạn trích bằng chứng*: Giới hạn `w-[240px] min-w-[190px] max-w-[260px]`, đoạn trích `line-clamp-2`.
    - Cột *Thao tác Admin*: Cố định dính lề phải (`sticky right-0 bg-background/95 backdrop-blur-xs shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.06)] z-10`), giúp cụm nút thao tác luôn luôn hiển thị trên màn hình dù người dùng xem ở bất kỳ độ phân giải nào.
  - **Nâng cấp Modal Xem chi tiết thành Multi-Tabs (2-4 đoạn trích)**:
    - Nâng cấp state `viewingEvidenceGroup` chứa đầy đủ mảng `items: ProductSuggestionItem[]` của cả nhóm gợi ý.
    - Đặt khối **Thao tác nhanh cho gợi ý chung ngay trên đầu modal** với các nút nổi bật: `[+ Tạo sản phẩm]`, `[🔗 Gắn vào SP có sẵn]`.
    - Hàng Tabs tương tác: Khi gợi ý có từ 2-4 đoạn trích, hiển thị dải tab `[Đoạn #1]`, `[Đoạn #2]`, `[Đoạn #3]`... kèm tên bệnh mục tiêu tương ứng.
    - Trong từng Tab: Hiển thị trọn vẹn văn bản đoạn trích gốc, số lượng ký tự, nguồn bài báo khoa học, cùng các nút thao tác nhanh riêng cho từng đoạn.
- **Kiểm chứng kỹ thuật**:
  - Frontend `npm run build` (`tsc && vite build`) hoàn thành thành công trong `8.16s` (`2002 modules transformed`, `0` lỗi).
