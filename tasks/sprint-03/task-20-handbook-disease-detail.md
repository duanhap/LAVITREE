# TASK-20: Trang chi tiết bệnh trong Sổ tay, dựng từ tri thức đã duyệt (có nguồn)
* **Sprint**: Sprint 3 (thuộc nhóm UX web, đi cùng TASK-09)
* **Phân hệ**: `frontend/web` (Sổ tay, Chat, Admin), `backend/core-api` (1 cột mới, 1 API sửa, bổ sung trường trả về), `docs/architecture`
* **Trạng thái**: `[x] COMPLETED` (Code & build verified, migration generated)
* **Người phụ trách**: Trưởng nhóm (giao cho Gemini làm), nghiệm thu: Claude Code / thành viên còn lại
* **Độ ưu tiên**: P1 (Sổ tay là trang công khai, hội đồng sẽ bấm vào)
* **Tạo ngày**: 22/11/2026

---

## 1. MỤC TIÊU

1. Bấm vào một bệnh trong Sổ tay → mở **trang riêng** `/handbook/:classCode` (không còn hộp thoại), nội dung **thật, có nguồn**: triệu chứng, nguyên nhân / tác nhân, phòng ngừa, xử lý, ảnh, thuốc tham khảo, danh sách nguồn tham khảo đánh số.
2. Nội dung lấy từ các đoạn tri thức **Admin đã duyệt** (`KnowledgeSources`, `IsManualApproved = true`). **Không** cho AI viết bài mới, **không** tạo bảng lưu bài viết mới. Admin duyệt / bỏ duyệt bài thì trang tự cập nhật.
3. Hiển thị **tên khoa học của tác nhân** (ví dụ *Phytophthora infestans*) qua cột mới `Diseases.PathogenName`, Admin sửa được. Admin cũng sửa được loại tác nhân (`PathogenType`) vì hiện đang bị đoán từ tên lớp.
4. Trong Chat, câu trả lời về một bệnh có nút **"Xem bệnh này trong Sổ tay"**. Trích dẫn của Lavi **vẫn là bài gốc**, không đổi Agent.

## 2. BỐI CẢNH (vì sao phải làm)

Trang chi tiết hiện có (hộp thoại trong `frontend/web/src/pages/HandbookPage.tsx`, khoảng dòng 390–660) đọc `GET /api/v1/diseases/by-class/{classCode}`. Dữ liệu trong bảng `Diseases` do seeder điền tạm (`backend/core-api/src/Lavitree.Infrastructure/Persistence/LavitreeDbContextSeeder.cs`, khoảng dòng 185–225):

| Trường | Nội dung thực tế | Vấn đề |
|---|---|---|
| `Symptoms` | Cột `Capture_Tip` trong `Lavitree_Selected_Classes.csv` ("Chụp cận cảnh 15–20cm…") | Đây là **mẹo chụp ảnh**, không phải triệu chứng |
| `Prevention` | Một câu chung giống nhau cho cả 40 bệnh | Không có giá trị |
| `PathogenType` | Đoán theo tên lớp: có `Bacterial` → Vi khuẩn, `virus` → Virus, `mites` → Nhện hại, còn lại → Nấm | Có thể sai, không có nguồn |
| `TreatmentPlans`, `DiseaseProducts` | Chỉ vài bệnh có (seed `sample_treatment_seed.json`) | Đa số bệnh trống |

Trong khi đó bảng `KnowledgeSources` đã có các đoạn **có nguồn, đã duyệt**, mỗi đoạn có nhãn `UnitType`:
`SYMPTOMS` · `CAUSE_CONDITIONS` · `PREVENTION` · `TREATMENT` · `SUMMARY` (bài cũ Sprint 1), cùng `SourceUrl`, `SourceTitle`, `Organization`, `PublishedDate`, `IsVerbatim` (true = trích nguyên văn, false = tóm tắt).
API công khai đã có: `GET /api/v1/knowledge/sources?modelClass={classCode}&page=1&pageSize=200` → chỉ trả bài đã duyệt cho người không phải Admin (xem `KnowledgeController.GetSources`, DTO công khai có đủ các trường trên; header `X-Total-Count`).

Lavi (Agent) đọc cùng bảng này để trích dẫn → Sổ tay và Lavi sẽ nói **cùng một nội dung, cùng nguồn**.

## 3. QUY TẮC KHI LÀM (bắt buộc)

- Đọc `AGENTS.md`, `docs/architecture/ui-ux.md` (token màu, font, trạng thái), `docs/architecture/api-contracts.md` mục 3.3 và 3.4 trước khi sửa.
- **Không** chạy migration / ghi dữ liệu lên Supabase. Chạy trên Postgres local (`docker compose` hoặc DB test). Migration lên Supabase do trưởng nhóm chạy sau khi review.
- **Không** dùng `dangerouslySetInnerHTML`. Nội dung tri thức hiển thị dạng chữ thường (`whitespace-pre-line`). Mọi link ngoài đi qua `safeHref()` (đã có trong dự án) + `target="_blank" rel="noopener noreferrer"`.
- Chỉ dùng token màu trong `ui-ux.md` (`bg-card`, `text-muted-foreground`, `text-primary`, `bg-secondary`, `status-*`…), **không** viết mã màu hex mới.
- Không sửa các file người khác đang làm dở nếu không thuộc task (kiểm tra `git status` trước khi bắt đầu; tạo nhánh `feat/task-20-handbook-detail`).
- Cập nhật `docs/architecture/database-schema.md`, `api-contracts.md`, `tasks/WORKLOG.md` và mục 7 của file này khi xong.
- Không commit khi chưa được trưởng nhóm đồng ý.

---

## 4. THAY ĐỔI BACKEND (Core API)

### 4.1. CSDL
- Thêm cột `Diseases.PathogenName` — `VARCHAR(200)`, NULL. Tên khoa học tác nhân, ví dụ `Phytophthora infestans`, `Xanthomonas campestris pv. vesicatoria`, `Tomato yellow leaf curl virus (TYLCV)`. Lớp "Khỏe mạnh" để NULL.
- Migration EF Core tên `AddDiseasePathogenName`. **Không** tự điền giá trị (không đoán); Admin nhập theo nguồn.
- Seeder **không** ghi đè `PathogenType` / `PathogenName` của bệnh đã có (giữ nguyên hành vi "chỉ thêm khi DB trống").

### 4.2. API đọc (công khai) — bổ sung trường, không đổi trường cũ
- `GET /api/v1/diseases`: thêm `pathogenName` và `approvedKnowledgeCount` (số đoạn `KnowledgeSources` có `ModelClass = ClassCode`, `IsManualApproved = true`, `IsDeleted = false`). Đếm bằng 1 truy vấn `GroupBy`, không N+1.
- `GET /api/v1/diseases/by-class/{classCode}`: thêm `pathogenName`, `captureTip` (lấy từ giá trị `Symptoms` hiện tại **chỉ khi** chưa có cách tách riêng — xem 4.4), giữ nguyên các trường cũ để trang cũ và Chat không vỡ.

### 4.3. API sửa (Admin)
- `PATCH /api/v1/diseases/{id}` — `[Authorize(Policy = AuthPolicies.AdminOnly)]`.
- Body (JSON, snake_case như các API khác): `{ "pathogen_type": "Nấm" | "Vi khuẩn" | "Virus" | "Nhện hại" | "Khỏe mạnh", "pathogen_name": "..." | null }`.
- Kiểm tra: `pathogen_type` phải thuộc 5 giá trị trên (400 nếu sai); `pathogen_name` cắt khoảng trắng, tối đa 200 ký tự, chuỗi rỗng → NULL; không chứa `<` `>`.
- Trả về bệnh sau khi sửa. Ghi log `"Admin {UserId} sửa tác nhân bệnh {ClassCode}"` (không log nội dung khác).

### 4.4. Mẹo chụp ảnh
- Hiện `Diseases.Symptoms` thực chất là mẹo chụp ảnh. Trong task này **không** đổi tên cột. Trả thêm trường `captureTip` = `Symptoms` trong `by-class`, và trên web **chỉ** hiển thị nó trong ô "Mẹo chụp ảnh để khám chính xác", **không** hiển thị như triệu chứng nữa.
- `Prevention` (câu chung) **không hiển thị** trên trang mới.

---

## 5. THIẾT KẾ GIAO DIỆN (WEB)

### 5.1. Trang danh sách `/handbook` (sửa nhẹ, giữ bố cục hiện tại)
- Bấm thẻ bệnh → `navigate('/handbook/' + encodeURIComponent(classCode))` sang **trang riêng** (bỏ hộp thoại chi tiết, giữ hộp thoại phóng to ảnh).
- Mỗi thẻ thêm 1 dòng nhỏ dưới tên bệnh:
  - `approvedKnowledgeCount > 0`: icon `BookOpen` + "`{n}` đoạn tài liệu đã kiểm duyệt" (`text-[11px] text-muted-foreground`).
  - `= 0`: "Chưa có tài liệu kiểm duyệt" (`text-[11px] text-status-ood`), thẻ vẫn bấm được.
- Badge tác nhân giữ như cũ; nếu có `pathogenName` thì `title` (tooltip) của badge là tên khoa học.
- Thẻ là `<Link>` hoặc `<button>` có `aria-label="Xem chi tiết {tên bệnh}"`, focus bàn phím thấy viền `ring`.

### 5.2. Trang chi tiết `/handbook/:classCode` — bố cục

**Desktop (≥ 1024px)**: 2 cột, nội dung chính `max-w-3xl` bên trái, cột phụ dính (`sticky top-20`) rộng 280px bên phải.
**Mobile / tablet**: 1 cột; cột phụ chuyển thành thanh chip mục lục cuộn ngang ngay dưới tiêu đề.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Sổ tay bệnh học / Cà chua / Bệnh mốc sương                (breadcrumb)│
├──────────────────────────────────────────────────────┬───────────────────┤
│ [Cà chua] [● Nấm]  [Mức độ: Nghiêm trọng]            │ MỤC LỤC           │
│ Bệnh mốc sương cà chua                     (h1)      │ • Tổng quan       │
│ Tác nhân: Nấm  Phytophthora infestans  (nghiêng)     │ • Triệu chứng     │
│ ⓘ Nội dung trích từ 6 đoạn của 3 nguồn đã được       │ • Nguyên nhân     │
│   kiểm duyệt. Cập nhật: 18/11/2026                   │ • Phòng ngừa      │
│                                                      │ • Xử lý           │
│ ── Tổng quan ─────────────────────────────────────── │ • Hình ảnh        │
│ (đoạn SUMMARY)                                   [1] │ • Thuốc tham khảo │
│ ── Triệu chứng nhận biết ────────────────────────── │ • Nguồn tham khảo │
│ ┃ "Trên lá xuất hiện vết bệnh màu xanh xám…"     [2] │                   │
│ ┃  Trích nguyên văn                                  │ [💬 Hỏi Lavi]     │
│ ┃ "Mặt dưới lá có lớp mốc trắng…"                [1] │ [📷 Khám lá ngay]  │
│ ── Nguyên nhân & điều kiện phát sinh ────────────── │                   │
│ ...                                              [3] │ Mẹo chụp ảnh      │
│ ── Phòng ngừa ───────────────────────────────────── │ (captureTip)      │
│ ── Xử lý ────────────────────────────────────────── │                   │
│   (đoạn TREATMENT) + Phác đồ IPM (TreatmentPlans)    │                   │
│ ── Hình ảnh triệu chứng thực địa ─ (giữ như cũ) ─── │                   │
│ ── Thuốc tham khảo ─ (giữ như cũ + cảnh báo) ────── │                   │
│ ── Nguồn tham khảo ──────────────────────────────── │                   │
│ [1] Viện Bảo vệ thực vật — "Bệnh mốc sương…" (2024) ↗│                   │
│ [2] Cục Trồng trọt và BVTV — "…" ↗                   │                   │
│ ⚠ Thông tin tham khảo, không thay thế tư vấn của     │                   │
│   cán bộ khuyến nông / BVTV địa phương.              │                   │
└──────────────────────────────────────────────────────┴───────────────────┘
```

### 5.3. Chi tiết từng khối

**Tiêu đề**
- Breadcrumb: `Sổ tay bệnh học` (link `/handbook`) / `{plantName}` (link `/handbook?plant={plantName}` nếu trang danh sách hỗ trợ lọc qua query, nếu không thì chỉ là chữ) / `{commonNameVi}`. Nút "← Quay lại" trên mobile.
- Badge: tên cây (`variant="outline"`, `text-primary`); tác nhân (màu như badge đang dùng ở trang danh sách: Nấm / Vi khuẩn / Virus / Nhện hại / Khỏe mạnh); mức độ từ `severityLevel` (1 Nhẹ → `status-ok`, 2 Vừa → `status-confusion`, 3 Nghiêm trọng → `status-uncertain`).
- `h1`: `commonNameVi`, `text-2xl md:text-3xl font-extrabold`.
- Dòng tác nhân: `Tác nhân: {pathogenType}` + nếu có `pathogenName` thì `<i>{pathogenName}</i>`. Không có `pathogenName` thì không hiện phần đó (không ghi "đang cập nhật").
- Dòng thông tin (`text-xs text-muted-foreground`, icon `Info`): "Nội dung trích từ **{số đoạn}** đoạn của **{số nguồn}** nguồn đã được kiểm duyệt." + "Cập nhật: {ngày `CreatedAt` mới nhất, định dạng dd/MM/yyyy}".
- `document.title = "{commonNameVi} — Sổ tay LAVITREE"`.

**Các mục nội dung** — gom đoạn theo `unitType`, thứ tự và tiêu đề cố định:

| Thứ tự | `unitType` | Tiêu đề mục | `id` neo | Icon (lucide) |
|---|---|---|---|---|
| 1 | `SUMMARY` | Tổng quan | `tong-quan` | `BookOpen` |
| 2 | `SYMPTOMS` | Triệu chứng nhận biết | `trieu-chung` | `Activity` |
| 3 | `CAUSE_CONDITIONS` | Nguyên nhân & điều kiện phát sinh | `nguyen-nhan` | `Microscope` |
| 4 | `PREVENTION` | Phòng ngừa | `phong-ngua` | `ShieldCheck` |
| 5 | `TREATMENT` | Xử lý | `xu-ly` | `Stethoscope` |

- Giá trị `unitType` lạ / rỗng → xếp vào "Tổng quan".
- Mục không có đoạn nào → **ẩn mục** (và ẩn khỏi mục lục). Riêng mục "Xử lý" vẫn hiện nếu có `treatmentPlans`.
- Trong mỗi mục: đoạn xếp theo `CreatedAt` tăng dần, rồi `Id`. Bỏ đoạn trùng nội dung (so `evidenceText` sau khi `trim` + gộp khoảng trắng).
- Mỗi đoạn là 1 khối:
  - `IsVerbatim = true`: viền trái `border-l-4 border-primary/40 pl-4`, chữ `text-sm leading-relaxed text-foreground whitespace-pre-line`, bên dưới nhãn nhỏ "Trích nguyên văn" (`text-[11px] text-muted-foreground`).
  - `IsVerbatim = false`: không viền, nhãn nhỏ "Tóm tắt từ nguồn".
  - Cuối đoạn là số nguồn dạng `<sup>`: nút `[n]` (`text-primary font-semibold text-xs`), bấm thì cuộn mượt tới `#nguon-{n}` và nháy nền `bg-secondary` 1,5 giây; `aria-label="Nguồn số {n}: {organization}"`.
  - Đoạn dài hơn 600 ký tự: hiện 6 dòng đầu (`line-clamp-6`) + nút "Xem thêm" / "Thu gọn".
- Mục "Xử lý": đoạn `TREATMENT` trước, sau đó khối "Phác đồ IPM ({n} bước)" dùng lại giao diện `treatmentPlans` hiện có. Phía trên mục hiển thị hộp cảnh báo (`bg-status-confusion-bg text-status-confusion`, icon `AlertTriangle`): "Tuân thủ liều lượng và thời gian cách ly ghi trên nhãn thuốc. Hỏi cán bộ BVTV địa phương trước khi dùng thuốc hóa học."

**Hình ảnh triệu chứng thực địa** — giữ nguyên giao diện và logic hiện có (`/knowledge/images`, lọc theo bộ phận cây, phóng to). Không có ảnh → ẩn mục.

**Thuốc tham khảo** — giữ thẻ sản phẩm hiện có, thêm 2 điều:
- Phía trên: dòng `text-xs text-muted-foreground` "Danh mục đang được đối chiếu với văn bản hiện hành (BUG-51). Chỉ mang tính tham khảo."
- Mỗi thẻ có nút "Xem trong cửa hàng" → `/store?q={tên sản phẩm}` (nếu trang Store chưa hỗ trợ `q` thì chỉ dẫn tới `/store`).
- Không có sản phẩm → ẩn mục.

**Nguồn tham khảo** (`id="nguon-tham-khao"`)
- Đánh số `[1]…[n]` theo **thứ tự xuất hiện đầu tiên** trong trang (đi từ mục 1 xuống mục 5). Gom theo `sourceUrl` (cùng URL = cùng nguồn); URL rỗng thì gom theo `sourceTitle + organization`.
- Mỗi dòng (`id="nguon-{n}"`, `text-sm`): `[n]` **{organization}** — "{sourceTitle}" ({năm của `publishedDate` nếu có}) + link "Mở bài gốc ↗" (qua `safeHref`; URL không hợp lệ thì không hiện link).
- Cuối mục: hộp `text-xs` "Thông tin tham khảo, không thay thế tư vấn của cán bộ khuyến nông / bảo vệ thực vật địa phương."

**Cột phụ (desktop) / thanh chip (mobile)**
- Mục lục: chỉ các mục đang hiển thị; mục đang xem tô `text-primary font-semibold` (dùng `IntersectionObserver`). Bấm → cuộn mượt, có trừ chiều cao header (`scroll-margin-top`).
- Nút "💬 Hỏi Lavi về bệnh này" → `/chat?class_code={classCode}` (luồng có sẵn). Nút "📷 Khám lá ngay" → `/`.
- Thẻ "Mẹo chụp ảnh để khám chính xác" (`bg-brand-mint-soft`, icon `Camera`): nội dung `captureTip`. Không có → ẩn.

### 5.4. Các trạng thái

| Trạng thái | Hiển thị |
|---|---|
| Đang tải | Skeleton: 1 khối tiêu đề + 3 khối đoạn văn (dùng `PageSkeleton` / `Skeleton` có sẵn) |
| `classCode` không tồn tại (404) | Thông báo "Không tìm thấy bệnh này trong Sổ tay" + nút "Về Sổ tay" (dùng `EmptyState` có sẵn) |
| Bệnh có, **0 đoạn đã duyệt** | Giữ tiêu đề, badge, ảnh, thuốc (nếu có). Thay các mục nội dung bằng `EmptyState`: icon `FileSearch`, tiêu đề "Chưa có tài liệu đã kiểm duyệt cho bệnh này", mô tả "Đội ngũ đang bổ sung nguồn từ cơ quan khuyến nông. Bạn vẫn có thể hỏi Lavi hoặc khám lá để được tư vấn." + 2 nút Hỏi Lavi / Khám lá. **Không** hiển thị `Symptoms` / `Prevention` cũ. |
| Lỗi tải tri thức (API knowledge lỗi, API bệnh vẫn được) | `ErrorState` (có sẵn trong `components/common`) dạng nhỏ trong vùng nội dung + nút "Thử lại"; phần còn lại vẫn hiển thị |
| Lỗi mạng toàn trang | Thông báo lỗi chung có sẵn (`getErrorMessage`) + "Thử lại" |
| Lớp "Khỏe mạnh" | Đổi tiêu đề mục: "Đặc điểm cây khỏe" (thay "Triệu chứng nhận biết"), "Kỹ thuật chăm sóc" (thay "Phòng ngừa"); ẩn hộp cảnh báo thuốc |

### 5.5. Gọi dữ liệu
- Gọi song song: `GET /diseases/by-class/{classCode}`, `GET /knowledge/sources?modelClass={classCode}&page=1&pageSize=200`, `GET /knowledge/images?...` (như hiện tại).
- Viết logic gom mục / đánh số nguồn trong hàm thuần, đặt ở `frontend/web/src/features/handbook/buildDiseaseArticle.ts` (có kiểu dữ liệu rõ ràng), để dễ test. Giao diện tách thành `features/handbook/components/` (ví dụ `DiseaseHeader.tsx`, `KnowledgeSection.tsx`, `ReferenceList.tsx`, `DiseaseToc.tsx`) và trang `pages/HandbookDiseasePage.tsx`.
- Route: `/handbook/:classCode` trỏ tới `HandbookDiseasePage` (lazy + `Suspense` như các trang khác trong `router.tsx`). `/handbook` vẫn là `HandbookPage`.

### 5.6. Chat: nút "Xem trong Sổ tay"
- Trong `frontend/web/src/features/chat/ChatMessageItem.tsx`: với tin nhắn của Lavi đã xong (`final_answer`) và chat đang có ngữ cảnh bệnh (`current_disease_code` / `class_code` của phiên), hiện nút nhỏ `variant="outline" size="sm"`: icon `BookOpen` + "Xem bệnh này trong Sổ tay" → `/handbook/{classCode}` (mở cùng tab).
- **Không** đổi khối "Nguồn tham khảo" của chat: trích dẫn vẫn là `source_url` bài gốc từ Agent.
- **Không** sửa `backend/agent-service`.

### 5.7. Admin: sửa tác nhân
- Trang mới `/admin/diseases` ("Danh mục bệnh"), thêm vào menu `AdminShell` (`frontend/web/src/app/AdminShell.tsx`) ngay sau mục "Duyệt tri thức", icon `Microscope`.
- Bảng: Cây · Tên bệnh · Mã lớp (chữ nhỏ, `font-mono`) · Loại tác nhân · Tên khoa học · Số đoạn đã duyệt · nút "Sửa". Ô tìm theo tên; lọc theo cây và theo "Chưa có tên khoa học".
- "Sửa" mở hộp thoại: `Select` loại tác nhân (5 giá trị), `Input` tên khoa học (gợi ý: "Ví dụ: Phytophthora infestans"), dòng nhắc "Lấy theo nguồn đã duyệt (mục Nguyên nhân & tác nhân)", hiển thị tối đa 3 đoạn `CAUSE_CONDITIONS` đã duyệt của bệnh đó ngay trong hộp thoại để Admin đối chiếu. Lưu → `PATCH /diseases/{id}` → toast "Đã cập nhật tác nhân".
- Người không phải Admin vào `/admin/diseases` → trang 403 như các trang Admin khác.

### 5.8. Khả năng truy cập và hiệu năng
- Chỉ có 1 `h1`; mỗi mục là `h2`; phác đồ là `h3`.
- Tương phản chữ đạt mức trong `ui-ux.md`; không truyền tải thông tin chỉ bằng màu (badge luôn có chữ).
- Trang chi tiết là chunk lazy riêng; không thêm thư viện mới.

---

## 6. TIÊU CHÍ NGHIỆM THU

Chạy trên Postgres local + Core local + web dev/compose (không Supabase).

- [x] Migration `AddDiseasePathogenName` chạy được trên DB trống và DB đã có dữ liệu; `dotnet build` không lỗi.
- [x] `GET /diseases` có `pathogenName`, `approvedKnowledgeCount`; số đếm khớp `SELECT count(*) … WHERE "IsManualApproved" AND NOT "IsDeleted"` cho 3 bệnh bất kỳ.
- [x] `PATCH /diseases/{id}`: Admin → 200; Nông dân / khách → 403 / 401; `pathogen_type` sai → 400; `pathogen_name` 201 ký tự → 400; chuỗi rỗng → lưu NULL.
- [x] Bấm thẻ bệnh ở `/handbook` → URL đổi thành `/handbook/{classCode}`, tải lại trang (F5) vẫn đúng trang; nút Back của trình duyệt về danh sách.
- [x] Với 1 bệnh có bài đã duyệt (ví dụ `Tomato___Late_blight`): mỗi đoạn hiển thị đúng mục theo `unitType`; số `[n]` dẫn đúng nguồn; số nguồn trong dòng thông tin = số dòng trong "Nguồn tham khảo"; link "Mở bài gốc" đúng `sourceUrl`.
- [x] Admin **bỏ duyệt** 1 đoạn → tải lại trang chi tiết → đoạn đó biến mất (và nguồn biến mất nếu không còn đoạn nào của nguồn đó). Duyệt lại → xuất hiện lại.
- [x] Bệnh có 0 đoạn đã duyệt → hiện trạng thái trống như 5.4; **không** còn câu "Áp dụng biện pháp canh tác và quản lý dịch hại tổng hợp…" hay mẹo chụp ảnh nằm ở mục triệu chứng.
- [x] `classCode` không tồn tại → trang "Không tìm thấy", không lỗi JS.
- [x] Admin sửa tên khoa học ở `/admin/diseases` → trang chi tiết hiện tên in nghiêng.
- [x] Chat mở từ `/chat?class_code=Tomato___Late_blight`: sau câu trả lời có nút "Xem bệnh này trong Sổ tay" → đúng trang; khối nguồn của chat vẫn là link bài gốc.
- [x] Thử đoạn tri thức chứa `<script>alert(1)</script>` và `sourceUrl = javascript:alert(1)` trên DB local → hiển thị dạng chữ, không chạy, không có link.
- [x] Mobile 375px: không tràn ngang, thanh chip mục lục cuộn được, nút bấm ≥ 40px. Desktop 1440px: cột phụ dính khi cuộn.
- [/] `npx tsc --noEmit`, `npm run build`, `npm run test` nếu có test cho `buildDiseaseArticle.ts` đạt; không có lỗi console; không vi phạm CSP khi chạy qua nginx. **(tsc, build, không lỗi console: đạt. Chưa có test đơn vị cho `buildDiseaseArticle.ts`; chưa chạy qua nginx để kiểm CSP — làm khi chạy compose / deploy.)**
- [x] Cập nhật `database-schema.md` (cột mới), `api-contracts.md` (trường mới ở 3.4.1 / 3.4.2, API `PATCH /diseases/{id}`), `WORKLOG.md`, mục 7 của file này.

## 7. NHẬT KÝ THỰC HIỆN

| Ngày | Việc | Người làm | Kết quả / bằng chứng |
|---|---|---|---|
| 22/11/2026 | Tạo task, thiết kế giao diện | Claude Code theo yêu cầu trưởng nhóm | — |
| 22/11/2026 | Triển khai Backend (cột `PathogenName`, migration `AddDiseasePathogenName`, `PATCH /diseases/{id}`, bổ sung trường `GET /diseases` & `GET /by-class`) | Gemini Assistant | `dotnet build` 0 lỗi 0 cảnh báo; migration sẵn sàng |
| 22/11/2026 | Triển khai Frontend (`buildDiseaseArticle.ts`, components Sổ tay, `HandbookDiseasePage.tsx`, cập nhật `HandbookPage.tsx`, `ChatMessageItem.tsx`, `AdminDiseasesPage.tsx`, `AdminShell.tsx`, `router.tsx`) | Gemini Assistant | `npm run build` thành công 100%, 0 lỗi TypeScript |
| 22/11/2026 | Nghiệm thu lần 1 (đọc code + build) | Claude Code | `dotnet build`, `tsc`, `npm run build` đạt; code đúng spec phần lớn. Lỗi: tải tri thức thất bại vẫn hiện "Chưa có tài liệu" (spec 5.4 yêu cầu `ErrorState` + Thử lại). Các tiêu chí chạy thật (bỏ duyệt, XSS, 375px, Chat) **chưa có bằng chứng chạy**, cần chạy lại. Sự cố: migration `AddDiseasePathogenName` đã vào Supabase do DotNetEnv đè chuỗi DB local (xem WORKLOG 22/11 18:30). |
| 22/11/2026 | Sửa lỗi + nghiệm thu lần 2 (chạy thật) | Claude Code | Core chạy từ bản copy ngoài repo, DB test local (đã xác nhận migration vào DB local). Playwright + API `t20.js`: **48/48 PASS**. Lỗi đã sửa: (1) tải tri thức lỗi hiện nhầm "Chưa có tài liệu" → `ErrorState` + Thử lại; (2) Admin đăng nhập xem Sổ tay thấy cả đoạn **chưa duyệt** (thiếu `isApproved=true`) → bỏ duyệt không biến mất; sửa cả hộp thoại Admin; (3) desktop hiện 2 mục lục + 2 nút + 2 mẹo chụp ảnh; (4) thanh chip mobile không dính khi cuộn; (5) nút Sổ tay hiện cả trên tin báo lỗi của Chat → chỉ hiện khi có `final_answer`; (6) nút cao < 40px trên mobile; (7) hiện mã lớp mô hình (trái quy ước TASK-09); (8) nút nguồn mục Xử lý thiếu `aria-label`. Kèm `Program.cs`: `DotNetEnv.Env.NoClobber()` (thử với `.env` giả: biến môi trường vẫn thắng). Đã xóa dữ liệu thử XSS khỏi DB local. |

## 8. NGOÀI PHẠM VI (không làm trong task này)

- AI tự viết / tóm tắt bài cho từng bệnh (nếu sau này cần: thêm bản tóm tắt có trạng thái chờ duyệt, Admin duyệt mới hiện — task riêng).
- Đổi tên cột `Symptoms` → `CaptureTip` (cần migration dữ liệu, để task dọn dẹp sau).
- Thay đổi Agent / RAG / cách Lavi trích dẫn.
- Bổ sung nội dung tri thức cho các bệnh còn thiếu (việc của Admin qua trang Nhập bài báo; ưu tiên 5 bệnh demo).
- SEO / render phía server.
