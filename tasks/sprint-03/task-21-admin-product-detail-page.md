# TASK-21: Trang chi tiết sản phẩm cho Admin (thông tin + bệnh áp dụng kèm căn cứ từ tài liệu)
* **Sprint**: Sprint 3 (nhóm Admin / kho vật tư, nối tiếp TASK-15, 17, 18)
* **Phân hệ**: `frontend/web` (Admin kho), `backend/core-api` (2 API đọc mới, 1 API gỡ liên kết), `docs/architecture`
* **Trạng thái**: `[ ] TODO`
* **Người phụ trách**: Trưởng nhóm (giao cho Gemini làm), nghiệm thu: Claude Code / thành viên còn lại
* **Độ ưu tiên**: P1
* **Tạo ngày**: 22/11/2026

---

## 1. MỤC TIÊU

1. Trong tab **"Kho thuốc & vật tư"** (`/admin/inventory`), bấm vào một sản phẩm sẽ mở **một trang riêng** `/admin/inventory/products/:id`, **không dùng hộp thoại**.
2. Trang có **2 tab**:
   - **Thông tin sản phẩm**: sửa các trường của `Product`.
   - **Bệnh áp dụng & căn cứ**: gộp theo **từng bệnh**: "Lavi có khuyên dùng thuốc này cho bệnh này không" (`DiseaseProducts`) và "bài báo nào đã nhắc thuốc này cho bệnh đó" (`ProductSuggestions` + đoạn trích `KnowledgeSources`). Mỗi dòng bệnh **chừa sẵn ô "Cách dùng cho bệnh này"** (chỉ đọc). TASK-22 sẽ làm ô này sửa được.
3. Mỗi loại dữ liệu **chỉ sửa được đúng phần được phép** (xem mục 4). Không lặp thông tin giữa 2 tab. Ít thao tác, ít phải cuộn.
4. API và component làm theo hướng **dùng lại được** cho 2 trang công khai sau này (ngoài phạm vi task này, xem mục 9):
   - `/store/products/:id`: trang một sản phẩm trên cửa hàng.
   - `/handbook/:classCode/products/:id`: trang "thuốc này dùng cho bệnh này", mở khi người dùng bấm vào tên thuốc trong bài Sổ tay.

## 2. BỐI CẢNH

### 2.1. Hiện trạng

- Danh sách trong tab "Kho thuốc & vật tư" là `Product`, lấy từ `GET /api/v1/medicines/search?allowedOnly=false` (`frontend/web/src/pages/admin/AdminInventoryPage.tsx`, hàm `fetchMedicines`).
- Nút **Sửa** gọi `handleOpenEditMedModal`, mở **chung một hộp thoại** với "Thêm sản phẩm từ gợi ý" (chỉ khác tiêu đề, dựa vào `editingMedId`), rồi lưu bằng `PATCH /api/v1/medicines/{id}`.
  - Vì hộp thoại dùng chung, Admin dễ tưởng mình đang sửa gợi ý.
- Các gợi ý đã gắn vào sản phẩm (`researchItems`) **chỉ được dùng làm ngữ cảnh cho prompt AI** ở chế độ Dev. Admin **không xem được** sản phẩm có căn cứ từ bài báo nào.
- Bệnh áp dụng (`target_diseases`) đang là một ô chọn nhiều trong form, **tách rời khỏi căn cứ**. Admin không biết bệnh nào có bài báo đi kèm, bệnh nào chỉ nhập tay.
- Phiếu cách dùng (TASK-18) chỉ có **một phiếu cho cả sản phẩm** (`Products.UsageProfile`). Thực tế liều, số lần, khoảng cách ngày **khác nhau theo cây và bệnh** (nhãn thuốc BVTV ghi theo từng "cây trồng – đối tượng"). Phiếu theo bệnh (`ProductUsageRules`) làm ở **TASK-22**, ngay sau task này. Task này chỉ chừa chỗ trên giao diện.
- Trang đang tải **toàn bộ** gợi ý (`GET /knowledge/product-suggestions`) rồi tự lọc theo `product_id` trên trình duyệt.

### 2.2. Quan hệ dữ liệu (giữ nguyên, không đổi schema)

```
Product 1 ──< DiseaseProduct >── 1 Disease           (bệnh Lavi khuyên dùng thuốc này; chatbot + Sổ tay đọc bảng này)
Product 1 ──< ProductSuggestion >── 1 KnowledgeSource (bài báo nào nhắc thuốc này, cho bệnh ModelClass nào)
Product.UsageProfile                                  (phiếu cách dùng CHUNG của sản phẩm, TASK-18)
```

- `ProductSuggestion.ProductId` chỉ có giá trị khi `Status` là `LINKED` (gắn vào sản phẩm có sẵn) hoặc `ADDED` (tạo sản phẩm mới từ gợi ý). Gợi ý `PENDING` hoặc `DISMISSED` thì `ProductId = null`.
- **Giữ nguyên hành vi cũ khi gắn gợi ý.** `POST /knowledge/product-suggestions/{id}/link` vẫn tự tạo `DiseaseProduct` nếu bệnh có trong bảng `Diseases` (`KnowledgeController.LinkProductSuggestion`). Task này **không** đổi logic đó.
- **Không** thêm bảng, **không** thêm cột, **không** có migration. Bảng `ProductUsageRules` thuộc TASK-22.

## 3. QUY TẮC KHI LÀM (bắt buộc)

- Đọc `AGENTS.md`, `docs/architecture/ui-ux.md` (token màu, trạng thái, kích thước chạm), và `docs/architecture/api-contracts.md` mục 3.4 (medicines) cùng phần knowledge / product-suggestions trước khi sửa.
- **Không** chạy Core trong thư mục repo khi định dùng DB local. Dù `Program.cs` đã có `Env.NoClobber()`, vẫn phải kiểm tra DB đích trước khi chạy. **Không** ghi dữ liệu lên Supabase.
- **Không** dùng `dangerouslySetInnerHTML`. Đoạn trích hiển thị dạng chữ thường (`whitespace-pre-line`), tô đậm tên thuốc bằng cách cắt chuỗi thành `<mark>`, không chèn HTML. Link ngoài đi qua `safeHref()`, kèm `target="_blank" rel="noopener noreferrer"`.
- Chỉ dùng token màu trong `ui-ux.md`, không viết mã hex mới. Nút và vùng bấm trên mobile cao ≥ 40px.
- **Không** nhân bản form sản phẩm. Phần trường nhập dùng chung giữa trang sửa và hộp thoại "Thêm sản phẩm" phải tách thành **một component** (xem mục 6.4).
- Cập nhật `docs/architecture/api-contracts.md`, `tasks/WORKLOG.md` và mục Log ở cuối file này khi xong.

## 4. AI SỬA ĐƯỢC GÌ, Ở ĐÂU (quy tắc chống trùng lặp)

| Dữ liệu | Hiện ở | Cho sửa? | Cách sửa |
|---|---|---|---|
| `Product`: tên, loại, hoạt chất, giá, tồn kho, tình trạng bán, ảnh, link nhãn, mô tả, hướng dẫn sử dụng, PHI, lưu hành, **phiếu cách dùng chung** | **Tab 1** (và một số dạng nhãn ở đầu trang, chỉ đọc) | ✅ | Form, lưu bằng `PATCH /medicines/{id}` (đã có) |
| `DiseaseProduct` (bệnh khuyên dùng) | **Tab 2**, công tắc "Khuyên dùng" trên mỗi dòng bệnh, nút "+ Thêm bệnh" | ✅ | `PATCH /medicines/{id}` với `target_diseases` = danh sách đầy đủ sau khi đổi (đã có, thay toàn bộ) |
| `ProductSuggestion` (gắn bài báo ↔ sản phẩm) | **Tab 2**, thẻ căn cứ | ⚠️ **Chỉ "Gỡ khỏi sản phẩm"** | API mới `POST /knowledge/product-suggestions/{id}/unlink` (mục 5.3) |
| `ProductSuggestion.MentionText`, `Kind`, `Status`, `ModelClass` | Tab 2 (chỉ đọc) | ❌ | Do AI trích từ bài báo, không sửa tay |
| `KnowledgeSource` (đoạn trích, trạng thái duyệt, nguồn) | Tab 2 (chỉ đọc, nhãn "Chưa duyệt" nếu có) | ❌ ở trang này | Sửa hoặc duyệt ở `/admin/knowledge` |

- **Bỏ** ô "Bệnh hại áp dụng" (`target_diseases`) khỏi Tab 1. Bệnh chỉ quản lý ở Tab 2.
- Hộp thoại **"Thêm sản phẩm"** (tạo mới, có hoặc không từ gợi ý) **vẫn giữ** ô chọn bệnh, vì lúc đó sản phẩm chưa có trang chi tiết.

## 5. BACKEND (`backend/core-api`)

### 5.1. `GET /api/v1/medicines/{id:int}` (mới, `AllowAnonymous`)

- Trả **cùng dạng** với một phần tử trong `GET /medicines/search` (dùng lại kiểu `MedicineItem` ở frontend), thêm trường `diseases` để không phải tra tên bệnh lần nữa:

```json
{
  "id": 12, "name": "...", "active_ingredient": "...", "medicine_type": "Hóa học",
  "price": 85000, "dosage_instruction": "...", "phi_days": 7, "is_allowed": true,
  "rain_resistant": false, "stock_quantity": 40, "availability": "IN_STOCK",
  "info_source_url": "...", "image_url": "...", "usage_profile": { },
  "target_diseases": ["Tomato___Late_blight"],
  "diseases": [ { "class_code": "Tomato___Late_blight", "disease_name": "Mốc sương", "plant_name": "Cà chua" } ]
}
```

- Sản phẩm `IsDeleted` → `404`.
- Người không phải Admin thấy sản phẩm `IsAllowed = false` hoặc `NOT_SOLD` thì **trả `404`**, giống cách `search` đang ẩn. Admin thì thấy tất cả.

### 5.2. `GET /api/v1/medicines/{id:int}/evidence` (mới, `AllowAnonymous`, lọc theo vai trò)

- Trả danh sách **phẳng** các căn cứ của sản phẩm. Frontend tự gom nhóm.
- Điều kiện lọc: `ps.ProductId == id`, `ps.Status IN ('LINKED','ADDED')`, `!ps.IsDeleted`, đoạn trích tồn tại và `!IsDeleted`.
- **Không phải Admin**: chỉ lấy đoạn trích `IsManualApproved = true`. **Admin**: lấy hết, kèm cờ `is_approved`.
- Tham số tùy chọn `?diseaseCode=` để lọc theo bệnh. Trang công khai sau này cần tham số này.
- Gộp trùng: nếu cùng `KnowledgeSourceId` có nhiều gợi ý cho cùng sản phẩm, chỉ trả **1 dòng** (lấy `suggestion_id` nhỏ nhất).
- Sắp xếp: theo bệnh, sau đó `is_approved` giảm dần, sau đó `published_date` giảm dần.

```json
[
  {
    "suggestion_id": 31, "knowledge_source_id": "9c1e…",
    "model_class": "Tomato___Late_blight", "disease_name": "Mốc sương", "plant_name": "Cà chua",
    "mention_text": "Ridomil Gold 68WG", "unit_type": "TREATMENT",
    "evidence_text": "…đoạn trích nguyên văn…", "is_verbatim": true,
    "source_url": "https://…", "source_title": "…", "organization": "…", "published_date": "2024",
    "is_approved": true, "status": "LINKED"
  }
]
```

- Lấy `disease_name` và `plant_name` giống cách `GetProductSuggestions` đang làm (`All38Classes`). **Không** truy vấn từng dòng (tránh N+1).

### 5.3. `POST /api/v1/knowledge/product-suggestions/{id}/unlink` (mới, `AdminOnly`)

- Điều kiện: gợi ý tồn tại, chưa xóa, `Status` là `LINKED` hoặc `ADDED`. Sai thì trả `404`/`409` với `detail` tiếng Việt.
- Thao tác: đặt **mọi gợi ý cùng `KnowledgeSourceId` và cùng `ProductId`** về `Status = "PENDING"`, `ProductId = null`, `ResolvedAt = null`, cập nhật `UpdatedAt`.
- **Không** xóa `DiseaseProduct`. Đúng quy tắc mục 4: bật hay tắt khuyên dùng là việc riêng của Admin. Frontend sẽ gợi ý tắt nếu bệnh không còn căn cứ (mục 6.3).
- Trả `200 { message, remaining_evidence_for_disease: <số căn cứ còn lại của bệnh đó cho sản phẩm này> }`.

### 5.4. Không đổi

- `PATCH /medicines/{id}`, `POST /medicines` và `POST …/link` giữ nguyên hành vi.

## 6. FRONTEND: THIẾT KẾ GIAO DIỆN CHI TIẾT

### 6.1. Thay đổi ở danh sách `/admin/inventory` (tab "Kho thuốc & vật tư")

- **Tên sản phẩm** thành link tới `/admin/inventory/products/:id`. Bấm vào cả hàng (trừ công tắc và nút) cũng mở trang này.
- **Bỏ nút "Sửa"** và nhánh `editingMedId` của hộp thoại. Hộp thoại chỉ còn dùng để **thêm mới**.
- Giữ công tắc "Lưu hành" nhanh ở danh sách như hiện tại.
- Thêm **một cột "Căn cứ"** (gọn, 1 dòng):
  - `3 bệnh · 5 bài`, chữ `text-muted-foreground`.
  - Nếu sản phẩm có bệnh khuyên dùng nhưng **0 bài**: nhãn cảnh báo `⚠ Chưa có bài nguồn` (`status-warning`).
  - Số liệu lấy từ `target_diseases.length` và số gợi ý có `product_id` đó trong danh sách gợi ý đang tải sẵn. **Không** gọi thêm API cho mỗi dòng.
- Tab "Gợi ý từ bài báo": với gợi ý `LINKED`/`ADDED`, tên sản phẩm đã gắn thành link tới trang chi tiết sản phẩm đó.

### 6.2. Bố cục trang `/admin/inventory/products/:id`

File mới: `frontend/web/src/pages/admin/AdminProductDetailPage.tsx`. Route khai báo trong `frontend/web/src/app/router.tsx`, nằm dưới `AdminShell`, kiểu lazy giống các trang admin khác. Menu bên trái vẫn sáng mục "Kho vật tư & thuốc".

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ ← Kho vật tư & thuốc                                                            │
│ ┌──────┐  Ridomil Gold 68WG                                    [</> Trợ lý AI] │
│ │ ảnh  │  Hóa học · Metalaxyl-M + Mancozeb                                       │
│ │ 64px │  [● Đang lưu hành] [Còn hàng · 40] [PHI 7 ngày] [85.000đ]              │
│ └──────┘                                                                        │
├───────────────────────────────────────────────────────────────────────────────┤
│  Thông tin sản phẩm  │  Bệnh áp dụng & căn cứ (3)  ⚠1                          │
├───────────────────────────────────────────────────────────────────────────────┤
│  … nội dung tab …                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

- **Đầu trang (chỉ đọc)**: tóm tắt để không phải mở tab mới biết trạng thái.
  - Các nhãn lấy từ dữ liệu **đã lưu**, không phải dữ liệu đang sửa dở.
  - Ảnh hỏng → icon `Package` trên nền `bg-secondary`.
  - Trên mobile, các nhãn tự xuống dòng; ảnh còn 48px.
- **Thanh tab**: dính đầu trang khi cuộn (`sticky top-0 z-10 bg-background border-b`).
  - Tab hiện tại lưu trong URL `?tab=info|diseases`, để F5 và nút Back giữ đúng tab. Mặc định `info`.
  - Số `(3)` là số bệnh trong Tab 2. `⚠1` là số bệnh đang khuyên dùng nhưng chưa có bài nguồn; không có thì ẩn.
- **Trợ lý AI** (chế độ Dev của TASK-18): nút ở đầu trang, bấm thì mở khung prompt / nạp JSON **ngay trên form Tab 1** (tự chuyển sang Tab 1 nếu đang ở Tab 2). Ngữ cảnh prompt lấy từ dữ liệu `evidence` (mục 5.2), **không** tải toàn bộ gợi ý như hiện nay.
- Trạng thái trang:
  - Đang tải: skeleton (đầu trang và 6 ô form).
  - `404`: `EmptyState` "Không tìm thấy sản phẩm" kèm nút về danh sách.
  - Lỗi mạng: `ErrorState` có nút Thử lại.
  - Tab 2 lỗi riêng thì chỉ Tab 2 hiện `ErrorState`, Tab 1 vẫn dùng được.

### 6.3. Tab 1: Thông tin sản phẩm

Mục tiêu: **vừa một màn hình laptop (khoảng 1366×768), không phải cuộn**, với các trường thường sửa.

```
┌──────────────────────────────┬────────────────────────────────────────────────┐
│ ẢNH                          │ Tên *              [Ridomil Gold 68WG        ] │
│ ┌──────────────┐             │ Loại  [Hóa học ▾]   Hoạt chất [Metalaxyl-M…  ] │
│ │  xem trước   │             │ Giá (đ) [85000]  Tồn kho [40]  PHI (ngày) [7]  │
│ │   160px      │             │ Tình trạng bán [Còn hàng ▾]                    │
│ └──────────────┘             │ Mô tả        [ textarea 4 dòng, có Xem trước ] │
│ URL ảnh [https://…        ]  │                                                │
│ Link nhãn/nguồn [https://…]  │                                                │
│ Lưu hành  [●━━] Đang lưu hành│                                                │
├──────────────────────────────┴────────────────────────────────────────────────┤
│ CÁCH DÙNG CHUNG & LIỀU LƯỢNG                                                   │
│ ▸ Phiếu cách dùng chung (áp dụng mọi bệnh)                                     │
│   50 g / 16 lít · phun ướt 2 mặt lá · sáng sớm · cách 7–10 ngày · tối đa 3 lần/vụ│
│                                     [Ghép vào Hướng dẫn sử dụng]  [Mở để sửa ▾]│
│ Hướng dẫn sử dụng / Liều lượng                                                  │
│ [ textarea 3–6 dòng, tự giãn theo nội dung                                   ] │
│ Trợ lý Lavi đọc nguyên văn ô này; con số liều lượng phải có ở đây thì Lavi     │
│ mới được nói.                                                                   │
└───────────────────────────────────────────────────────────────────────────────┘
          (thanh lưu chỉ hiện khi có thay đổi, dính đáy màn hình)
┌───────────────────────────────────────────────────────────────────────────────┐
│ Có 3 thay đổi chưa lưu                                   [Hủy]  [Lưu thay đổi] │
└───────────────────────────────────────────────────────────────────────────────┘
```

- **Bố cục 2 cột** từ `lg` trở lên (cột trái 280px, cột phải phần còn lại). Dưới `lg`, xếp 1 cột: ảnh, rồi các trường.
- Các trường ngắn (Giá / Tồn kho / PHI; Loại / Hoạt chất) **đứng chung một hàng** để giảm chiều cao.
- **PHI**:
  - Bắt buộc khi loại là Hóa học hoặc Sinh học.
  - Ẩn và gửi `null` khi loại là "Vật tư canh tác".
  - Giữ đúng validate hiện có: 0–365.
- **Lưu hành**:
  - Công tắc dùng logic cũ: chặn bật nếu chứa hoạt chất cấm, hiện lỗi `detail` của API ngay dưới công tắc.
- **Khối "Cách dùng chung & liều lượng"** (rộng hết trang, nằm dưới 2 cột). Gom 2 thứ liên quan vào một chỗ, vì nút "Ghép" ghi từ phiếu sang ô hướng dẫn:
  - Dòng ghi chú dưới tiêu đề: "Áp dụng cho mọi bệnh của sản phẩm này." (TASK-22 sẽ đổi câu này khi có cách dùng riêng theo bệnh.)
  - **Phiếu cách dùng chung** (`usage_profile`, `UsageProfileEditor` đã có):
    - Mặc định **thu gọn** thành 1–2 dòng tóm tắt, chỉ ghép các trường đã điền theo thứ tự: liều / nước, cách dùng, buổi, cách nhau, tối đa lần/vụ, tránh mưa. Chưa có phiếu thì hiện "Chưa có phiếu, chỉ điền khi nguồn ghi rõ số".
    - Bấm "Mở để sửa" thì hiện toàn bộ `UsageProfileEditor` ngay tại chỗ, giữ nguyên lưới 4 cột như hiện nay. Dưới `md` thì 2 cột, dưới `sm` thì 1 cột.
    - Nút **"Ghép vào Hướng dẫn sử dụng"** hiện **cả khi thu gọn**. Nút bị vô hiệu khi phiếu trống. Bấm thì làm đúng như hiện nay, ghi kết quả vào ô bên dưới và đánh dấu form có thay đổi. Nếu ô đã có chữ thì hỏi "Thay nội dung hiện có?" với 2 nút **Thay** và **Hủy**.
  - **Hướng dẫn sử dụng / Liều lượng** (`dosage_instruction`, phần liều sau khi `splitDescriptionDosage` tách khỏi mô tả):
    - **Luôn hiện**, không thu gọn.
    - Là textarea 3 dòng, tự giãn đến 6 dòng rồi mới cuộn bên trong.
    - Giữ dòng ghi chú "Trợ lý Lavi đọc nguyên văn ô này…".
  - Khi lưu, ghép lại mô tả và liều lượng **đúng cách hiện tại** của hộp thoại để không đổi dữ liệu Lavi đang đọc.
- **Không có** ô "Bệnh hại áp dụng" ở đây (mục 4).
- **Lưu**:
  - Một nút, chỉ gửi **các trường đã đổi** qua `PATCH`.
  - Thanh lưu dính đáy (`sticky bottom-0`) chỉ xuất hiện khi form có thay đổi. Đếm số trường đổi.
  - Lưu xong: toast "Đã lưu", cập nhật đầu trang, thanh lưu biến mất.
  - Lỗi `400`: hiện `detail` dưới đúng trường nếu đoán được, nếu không thì hiện ở thanh lưu.
- **Rời trang khi chưa lưu**:
  - Bấm "← Kho vật tư & thuốc" hoặc đổi sang Tab 2 khi còn thay đổi thì hỏi xác nhận bằng hộp thoại nhỏ của dự án (không dùng `window.confirm`): "Bỏ thay đổi chưa lưu?" với 2 nút **Ở lại** và **Bỏ thay đổi**.
  - Thêm `beforeunload` cho trường hợp F5 hoặc đóng tab.

### 6.4. Tách component form dùng chung

- Tạo `frontend/web/src/features/admin/components/ProductFormFields.tsx`, gồm các trường của mục 6.3, điều khiển qua `value` / `onChange` / `errors`, cùng prop `showTargetDiseases` (mặc định `false`).
- Trang chi tiết dùng `showTargetDiseases={false}`. Hộp thoại "Thêm sản phẩm" trong `AdminInventoryPage.tsx` dùng `true`.
- Chuyển logic tách mô tả và liều lượng (`splitDescriptionDosage`) cùng các hàm Dev AI sang `features/admin/` nếu cần dùng chung. **Không** sao chép code.
- Kết quả mong đợi: `AdminInventoryPage.tsx` **ngắn đi** (hiện khoảng 2.477 dòng).

### 6.5. Tab 2: Bệnh áp dụng & căn cứ (gộp 2 phần)

**Ý tưởng:** mỗi dòng là **một bệnh**. Bên trong dòng là các **bài báo** đã nhắc thuốc này cho bệnh đó. Admin nhìn một chỗ là biết: Lavi có đang khuyên dùng cho bệnh này không, và dựa vào bài nào.

Danh sách bệnh lấy từ **hợp** của `diseases` (DiseaseProduct, mục 5.1) và các bệnh xuất hiện trong `evidence` (mục 5.2). Mỗi dòng ở **1 trong 3 trạng thái**:

| Trạng thái | Điều kiện | Hiển thị |
|---|---|---|
| ✅ Khuyên dùng, có căn cứ | Có DiseaseProduct, có ≥ 1 bài | Công tắc **bật**, `2 bài nguồn` |
| ⚠ Khuyên dùng, chưa có căn cứ | Có DiseaseProduct, 0 bài | Công tắc **bật**, nhãn `status-warning` "Nhập tay, chưa có bài nguồn" |
| ○ Có bài nhắc, chưa khuyên dùng | Không có DiseaseProduct, có ≥ 1 bài | Công tắc **tắt**, chữ mờ "Bài báo có nhắc, Lavi chưa khuyên dùng" |

Thứ tự: ⚠ lên đầu (cần xử lý), sau đó ✅, cuối cùng ○. Cùng trạng thái thì xếp theo tên cây rồi tên bệnh.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Lavi khuyên dùng cho 3 bệnh · 5 bài nguồn              [+ Thêm bệnh]          │
├───────────────────────────────────────────────────────────────────────────────┤
│ ⚠ Khoai tây · Cháy lá sớm          Nhập tay, chưa có bài nguồn   Khuyên dùng [●━]│
├───────────────────────────────────────────────────────────────────────────────┤
│ ▾ Cà chua · Mốc sương               2 bài nguồn                  Khuyên dùng [●━]│
│   ┌ CÁCH DÙNG CHO BỆNH NÀY ──────────────┐ ┌ CĂN CỨ (2 bài) ────────────────────┐ │
│   │ Đang dùng cách dùng chung:           │ │ (thẻ bài báo như dưới, xếp dọc)    │ │
│   │ 50 g / 16 lít · phun ướt 2 mặt lá ·  │ │                                    │ │
│   │ sáng sớm · cách 7–10 ngày ·          │ │                                    │ │
│   │ tối đa 3 lần/vụ                      │ │                                    │ │
│   │ Sửa ở tab Thông tin sản phẩm →       │ │                                    │ │
│   └──────────────────────────────────────┘ └────────────────────────────────────┘ │
│   (dưới xl: khối Cách dùng nằm trên, Căn cứ nằm dưới)                             │
│   Thẻ bài báo:                                                                    │
│   ┌─────────────────────────────────────────────────────────────────────────┐ │
│   │ Bệnh mốc sương cà chua và cách phòng trị            Nguyên văn · Xử lý  │ │
│   │ Viện BVTV · 2024 · vienbvtv.vn                                          │ │
│   │ "…phun ‖Ridomil Gold 68WG‖ nồng độ 0,25% khi bệnh chớm xuất hiện…"      │ │
│   │ [Xem cả đoạn]   [Mở bài gốc ↗]                     [Gỡ khỏi sản phẩm]   │ │
│   └─────────────────────────────────────────────────────────────────────────┘ │
│   ┌─────────────────────────────────────────────────────────────────────────┐ │
│   │ … bài thứ 2 …                                       [Chưa duyệt]        │ │
│   └─────────────────────────────────────────────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────────────────────┤
│ ▸ Ớt chuông · Đốm vi khuẩn          1 bài nguồn · Lavi chưa khuyên dùng   [━○]│
└───────────────────────────────────────────────────────────────────────────────┘
```

**Dòng bệnh:**
- Tên bệnh dạng `Cây · Bệnh`, chữ đậm. Tên bệnh là link nhỏ tới `/handbook/:classCode` (mở tab mới) để đối chiếu Sổ tay. **Không** hiện mã lớp `Tomato___Late_blight`.
- **Công tắc "Khuyên dùng"** (≥ 40px vùng bấm). Bật/tắt thì gửi ngay `PATCH /medicines/{id}` với `target_diseases` đầy đủ. Không cần nút Lưu riêng cho tab này.
  - Cập nhật lạc quan (đổi giao diện trước). Lỗi thì trả công tắc về như cũ và toast lỗi.
  - Khóa công tắc khi đang gửi, để không gửi hai lệnh chồng nhau.
  - Bật cho bệnh **không có trong bảng `Diseases`** (API trả 400) thì hiện lỗi tại dòng.
- **Mở/đóng dòng:**
  - Mặc định mở các dòng ✅ nếu tổng số bài ≤ 4. Nếu nhiều hơn thì chỉ mở dòng đầu.
  - Dòng ⚠ không có bài vẫn mở được, để xem cách dùng. Phần căn cứ hiện "Chưa có bài nguồn" kèm link "Tìm trong Gợi ý từ bài báo".
  - Trạng thái mở/đóng **không** cần lưu.

**Ô "Cách dùng cho bệnh này"** (chừa sẵn cho TASK-22; ô nằm đầu tiên bên trong dòng bệnh khi mở. Trên `xl`, ô chiếm cột trái khoảng 40%, căn cứ ở cột phải; dưới `xl`, ô nằm trên, căn cứ nằm dưới):
- **Chỉ đọc** ở task này. Chữ mờ "Đang dùng cách dùng chung:" kèm tóm tắt phiếu chung (cùng hàm tóm tắt với Tab 1). Chưa có phiếu chung thì ghi "Chưa có cách dùng".
- Link nhỏ "Sửa ở tab Thông tin sản phẩm →" chuyển sang Tab 1 và mở khối cách dùng.
- Tách thành component riêng `features/products/components/DiseaseUsageRule.tsx`, nhận `rule` (task này luôn `null`) và `defaultProfile`, để TASK-22 chỉ cần thêm phần sửa mà **không đổi bố cục**.

**Thẻ bài báo** (bên trong dòng bệnh; gom theo `source_url`, mỗi URL một thẻ):
- Dòng 1: `source_title` (tối đa 2 dòng, `line-clamp-2`). Bên phải là nhãn **Nguyên văn** / **Tóm tắt** (`is_verbatim`) và nhãn loại nội dung (`unit_type`: Xử lý / Phòng ngừa / Triệu chứng / Nguyên nhân / Tổng quan).
- Dòng 2: `organization · published_date · tên miền` (chữ nhỏ, `text-muted-foreground`). Trường nào trống thì bỏ, không để dấu `·` thừa.
- **Câu trích**:
  - Mặc định chỉ hiện **câu (hoặc 2 câu liền nhau) chứa `mention_text`**, cắt từ `evidence_text`, tên thuốc tô bằng `<mark>`.
  - Không tìm thấy `mention_text` trong đoạn (do AI viết khác) thì hiện 240 ký tự đầu và dấu `…`.
  - **Xem cả đoạn** mở rộng toàn bộ `evidence_text` ngay tại chỗ (không popup). Bấm lần nữa thì thu lại.
- Nếu cùng URL có nhiều đoạn trích: thẻ hiện câu trích của đoạn đầu và dòng nhỏ "+1 đoạn khác trong bài này". **Xem cả đoạn** sẽ hiện lần lượt các đoạn, mỗi đoạn có đường kẻ ngăn cách.
- **Mở bài gốc ↗**: link ngoài qua `safeHref()`. URL không hợp lệ thì ẩn nút.
- **Chưa duyệt**: chỉ Admin thấy (`is_approved = false`), dạng nhãn `status-warning`, có tooltip "Đoạn này chưa được duyệt nên Lavi và Sổ tay chưa dùng". Nhãn là link tới `/admin/knowledge`.
- **Gỡ khỏi sản phẩm**:
  - Nút chữ nhỏ, màu `text-destructive`, đặt cuối thẻ.
  - Bấm thì hỏi xác nhận bằng hộp thoại nhỏ: "Gỡ bài này khỏi sản phẩm? Gợi ý sẽ trở về 'Chờ xử lý' ở tab Gợi ý từ bài báo." Sau đó gọi `POST …/unlink`.
  - Thành công thì thẻ biến mất. Nếu `remaining_evidence_for_disease = 0` mà bệnh đang khuyên dùng, toast có **nút hành động** "Tắt khuyên dùng cho bệnh này" (bấm 1 lần là tắt). Admin không cần cuộn lại tìm công tắc.

**Nút "+ Thêm bệnh"**:
- Mở một ô chọn có tìm kiếm (combobox), liệt kê 38 bệnh **chưa** có trong danh sách. Hiện `Cây · Bệnh`, gõ tiếng Việt không dấu vẫn tìm được.
- Chọn xong thì gửi `PATCH` ngay. Dòng mới hiện ở trạng thái ⚠ (chưa có bài nguồn).

**Trạng thái trống của Tab 2:**
- Sản phẩm chưa có bệnh, chưa có bài: `EmptyState` "Sản phẩm chưa gắn với bệnh nào", kèm 2 hướng: **+ Thêm bệnh** và **Tìm trong Gợi ý từ bài báo** (link `/admin/inventory?tab=suggestions&search=<tên sản phẩm>`; nếu trang chưa đọc query này thì thêm phần đọc query).

### 6.6. Mobile (375px)

- Đầu trang: ảnh 48px, tên tối đa 2 dòng, nhãn xuống dòng. Nút "Trợ lý AI" thu thành icon.
- Tab 1 xếp 1 cột. Thanh lưu dính đáy cao ≥ 56px, không che ô đang nhập (thêm `pb` cho nội dung).
- Tab 2: dòng bệnh chia 2 hàng (hàng 1 là tên bệnh và công tắc, hàng 2 là số bài hoặc nhãn). Các nút trong thẻ bài báo cao ≥ 40px và xếp hàng ngang, tự xuống dòng khi hẹp.
- Không có thanh cuộn ngang ở bất kỳ chiều rộng nào ≥ 360px.

### 6.7. Thành phần dùng lại (cho trang công khai sau này)

Đặt ở `frontend/web/src/features/products/`:
- `api.ts`: `getProduct(id)` và `getProductEvidence(id, diseaseCode?)`.
- `groupEvidence.ts`: **hàm thuần**, đầu vào là `diseases` + `evidence` + vai trò. Đầu ra là danh sách dòng bệnh (trạng thái, thứ tự) và các thẻ bài gom theo URL, kèm câu trích đã cắt (vị trí bắt đầu/kết thúc của `<mark>`).
- `components/DiseaseEvidenceList.tsx` và `components/EvidenceCard.tsx`, có prop `mode: 'admin' | 'public'`.
  - `public` thì **ẩn**: công tắc, "+ Thêm bệnh", "Gỡ khỏi sản phẩm", nhãn "Chưa duyệt".

Trang Admin dùng `mode="admin"`.

## 7. TIÊU CHÍ NGHIỆM THU

1. [x] Bấm tên hoặc hàng sản phẩm ở `/admin/inventory` mở trang `/admin/inventory/products/:id`, **không** mở hộp thoại. F5 và nút Back hoạt động, `?tab=` được giữ.
2. [x] Hộp thoại "Thêm sản phẩm" (mới hoặc từ gợi ý) vẫn hoạt động như trước, gồm cả ô chọn bệnh. Không còn nhánh sửa trong hộp thoại.
3. [x] Tab 1 sửa và lưu được mọi trường của `Product` (kể cả phiếu cách dùng). Chỉ gửi trường đã đổi. Validate PHI, giá, tồn kho và chặn hoạt chất cấm giống API.
4. [x] Tab 1 không có ô bệnh hại. Ở 1366×768, khi phiếu cách dùng đang thu gọn, cả Tab 1 (gồm ô Hướng dẫn sử dụng) chỉ cần cuộn tối đa nửa màn hình. Phiếu thu gọn hiện đúng tóm tắt. Nút "Ghép vào Hướng dẫn sử dụng" dùng được cả khi thu gọn, hỏi trước khi ghi đè. Lưu xong thì `dosage_instruction` có định dạng giống hệt khi lưu từ hộp thoại cũ.
5. [x] Rời trang hoặc đổi tab khi chưa lưu thì hỏi xác nhận. F5 thì có cảnh báo của trình duyệt (`beforeunload`).
6. [x] Tab 2 hiện đủ hợp của DiseaseProduct và bệnh có bài nguồn, đúng 3 trạng thái và đúng thứ tự (⚠ → ✅ → ○). Số trên tab khớp.
7. [x] Bật/tắt "Khuyên dùng" ghi đúng `DiseaseProducts` (kiểm tra DB qua API PATCH), không làm mất bệnh khác. Lỗi API thì công tắc trở lại như cũ.
8. [x] Thẻ bài báo hiện câu trích có tô tên thuốc, "Xem cả đoạn", "Mở bài gốc", nhãn Nguyên văn/Tóm tắt. Các đoạn cùng URL gộp trong một thẻ.
9a. [x] Mỗi dòng bệnh khi mở có ô "Cách dùng cho bệnh này" (chỉ đọc), hiện đúng tóm tắt phiếu chung. Trên `xl`, ô và căn cứ nằm 2 cột; dưới `xl` thì xếp dọc. Link "Sửa ở tab Thông tin sản phẩm" hoạt động.
9. [x] "Gỡ khỏi sản phẩm" đưa gợi ý về `PENDING`/`ProductId = null` (gọi `POST …/unlink`), gợi ý hiện lại ở tab Gợi ý. **Không** xóa DiseaseProduct. Toast có nút "Tắt khuyên dùng" khi bệnh hết bài.
10. [x] `GET /medicines/{id}/evidence` khi chưa đăng nhập **chỉ** trả đoạn đã duyệt. Admin thấy cả đoạn chưa duyệt kèm `is_approved`. Gợi ý đã xóa hoặc đoạn đã xóa không xuất hiện.
11. [x] `GET /medicines/{id}`: không tồn tại, đã xóa, hoặc (người thường) dừng lưu hành / NOT_SOLD thì trả `404`. `POST …/unlink`: không đăng nhập trả `401`, User trả `403`, gợi ý `PENDING` trả `409`.
12. [x] Danh sách kho có cột "Căn cứ" đúng số liệu. Sản phẩm có bệnh mà 0 bài thì có nhãn cảnh báo. Không phát sinh request theo từng dòng.
13. [x] Không dùng `dangerouslySetInnerHTML`. Đoạn trích chứa `<script>` hoặc `<img onerror>` hiện dạng chữ, không chạy. Link `javascript:` bị chặn qua `isSafeHttpUrl`.
14. [x] Ở 375px không cuộn ngang. Mọi nút và công tắc có vùng bấm ≥ 40px. Có `aria-label` cho công tắc ("Khuyên dùng cho Cà chua · Mốc sương") và nút icon.
15. [x] `dotnet build`, `tsc`, `npm run build` đạt (0 errors, 0 warnings). Có **test đơn vị** cho `groupEvidence.ts` (7/7 tests passed).
16. [x] Cập nhật `api-contracts.md` (3 endpoint mới: `GET /medicines/{id}`, `GET /medicines/{id}/evidence`, `POST /knowledge/product-suggestions/{id}/unlink`), `WORKLOG.md` và Log bên dưới kèm bằng chứng chạy thật.

## 8. LOG

| Thời gian | Người | Nội dung |
|---|---|---|
| 22/11/2026 | Claude Code | Tạo task và thiết kế giao diện theo yêu cầu trưởng nhóm. Chưa code. |
| 22/11/2026 | Claude Code | Theo góp ý trưởng nhóm: cách dùng thuốc phải **riêng theo từng bệnh của từng cây**. Thêm bảng `ProductUsageRules` + API và khối "Cách dùng cho bệnh này" ở Tab 2. Phiếu ở Tab 1 đổi thành **phiếu chung**. |
| 22/11/2026 | Claude Code | Trưởng nhóm chốt **tách** phần phiếu theo bệnh sang `task-22-usage-rules-per-disease.md` (làm sau task này). Task này không còn bảng mới / migration; Tab 2 chỉ chừa ô "Cách dùng cho bệnh này" (chỉ đọc). |
| 22/11/2026 | Antigravity | Hoàn thành TASK-21: Backend 3 endpoint mới + query `productId`; Frontend trang `/admin/inventory/products/:id` (Tab 1 Thông tin, Tab 2 Bệnh & Căn cứ); Thêm cột Căn cứ ở kho và link sản phẩm ở tab Gợi ý; Test đơn vị 7/7 pass; `dotnet build` & `npm run build` 0 lỗi. |

## 9. NGOÀI PHẠM VI (ghi lại để làm sau)

- **Trang cửa hàng `/store/products/:id`**:
  - Dùng `GET /medicines/{id}` và `DiseaseEvidenceList mode="public"`.
  - Có nút thêm vào giỏ.
  - Nút "Xem" trong `StorePage` dẫn tới đây.
- **Trang "thuốc cho bệnh này" `/handbook/:classCode/products/:id`**:
  - Dùng `GET /medicines/{id}/evidence?diseaseCode=` để chỉ hiện căn cứ của đúng bệnh đó.
  - Mở khi người dùng bấm tên thuốc trong `HandbookDiseasePage` (hiện đang dẫn về `/store`).
- **Phiếu cách dùng theo bệnh** (bảng `ProductUsageRules`, sửa trong ô đã chừa ở Tab 2): **TASK-22**.
- Lavi đọc cách dùng theo bệnh, lịch phun / nhắc nhở: xem TASK-22 mục 7 và `treatment-schedule-design.md`.
- Đổi logic tự tạo `DiseaseProduct` khi gắn gợi ý: **giữ như cũ** theo quyết định của trưởng nhóm ngày 22/11/2026.
- Lịch sử thay đổi sản phẩm (ai sửa, sửa gì).
