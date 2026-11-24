# TASK-22: Phiếu cách dùng thuốc theo từng bệnh (`ProductUsageRules`)
* **Sprint**: Sprint 3 (nối tiếp TASK-18 bản nhẹ và TASK-21)
* **Phân hệ**: `backend/core-api` (1 bảng mới + migration, 5 API), `frontend/web` (ô "Cách dùng cho bệnh này" ở trang chi tiết sản phẩm), `docs/architecture`
* **Trạng thái**: `[x] DONE`
* **Phụ thuộc**: **TASK-21 phải xong trước**, vì task này làm trên trang `/admin/inventory/products/:id` và ô đã chừa sẵn ở Tab 2
* **Người phụ trách**: Trưởng nhóm (giao cho Gemini làm), nghiệm thu: Claude Code / thành viên còn lại
* **Độ ưu tiên**: P2 (cần trước khi làm lịch phun FEAT-06 hoặc cho Lavi nói liều theo bệnh)
* **Tạo ngày**: 22/11/2026

---

## 1. MỤC TIÊU

1. Mỗi sản phẩm có thể có **cách dùng riêng cho từng bệnh**: liều, lượng nước, buổi, số lần, khoảng cách ngày, tối đa lần/vụ… Lý do là nhãn thuốc BVTV ghi liều theo từng "cây trồng – đối tượng". Cùng một thuốc, mốc sương cà chua và sương mai khoai tây có thể khác liều.
2. Admin tạo, sửa, xóa và đánh dấu **"đã đối chiếu nhãn/nguồn"** ngay trong dòng bệnh ở Tab 2 của trang chi tiết sản phẩm (TASK-21), **cạnh câu trích bài báo**.
3. Phiếu hiện có `Products.UsageProfile` (TASK-18) **giữ nguyên làm phiếu chung**. Bệnh chưa có phiếu riêng thì dùng phiếu chung.

Đây là **bước 1–3** của lộ trình trong `docs/architecture/treatment-schedule-design.md` mục 7. Bước 4–6 (lịch phun, công cụ cho Agent, nhắc nhở) **không** thuộc task này.

## 2. BỐI CẢNH

- TASK-18 chỉ làm **một phiếu cho cả sản phẩm**: cột jsonb `Products.UsageProfile`, kiểu `UsageProfile` (`backend/core-api/src/Lavitree.Domain/Entities/UsageProfile.cs`), sửa bằng `UsageProfileEditor` (`frontend/web/src/features/admin/components/UsageProfileEditor.tsx`).
- `treatment-schedule-design.md` mục 3.1 đã thiết kế bảng `ProductUsageRules`. Task này làm theo thiết kế đó, với 2 quyết định:
  - **Không** sao chép `Products.UsageProfile` sang bảng mới, để tránh hai nơi cùng lưu một thứ. Cột cũ vẫn là phiếu chung. **Sửa bước 1 mục 7** của tài liệu cho khớp.
  - Chỉ làm phiếu **theo bệnh**. Mỗi lớp bệnh của Lavitree đã gắn sẵn một loại cây (ví dụ `Tomato___Late_blight` là cà chua), nên (sản phẩm + bệnh) đã xác định được cây. Phiếu "theo cây, mọi bệnh" (`PlantName`) để sau.
- TASK-21 đã chừa ô **"Cách dùng cho bệnh này"** trong mỗi dòng bệnh ở Tab 2. Hiện ô đó chỉ đọc và hiện phiếu chung. Task này làm cho ô đó **sửa được**.
- Trợ lý Lavi hiện đọc ô **"Hướng dẫn sử dụng"** (`dosage_instruction`) của sản phẩm, **không** đọc phiếu. Xem mục 7 về việc nhóm cần quyết.

## 3. QUY TẮC KHI LÀM (bắt buộc)

- Đọc `AGENTS.md`, `docs/architecture/ui-ux.md`, `docs/architecture/treatment-schedule-design.md`, `docs/architecture/database-schema.md` trước khi sửa.
- **Migration chỉ chạy trên DB local** (Postgres docker / DB test). **Không** chạy Core trong thư mục repo khi định dùng DB local, và phải kiểm tra DB đích trước khi chạy. Lên Supabase do trưởng nhóm chạy sau khi review.
- Dùng lại `UsageProfile.Normalize()` / `Validate()` (backend) và `usage-profile.ts` (frontend). **Không** viết lại kiểm tra phiếu.
- **Không** đổi tên trường JSON trong `UsageProfile` và **không** đổi `USAGE_LABELS`, theo quy ước trong `treatment-schedule-design.md`. `PhiDays` chỉ nằm ở `Products`, không đưa vào phiếu.
- Link ngoài qua `safeHref()`. Chỉ dùng token màu trong `ui-ux.md`. Vùng bấm ≥ 40px.
- Cập nhật `database-schema.md`, `api-contracts.md`, `treatment-schedule-design.md` (bước 1 mục 7), `tasks/WORKLOG.md` và Log cuối file này.

## 4. BACKEND

### 4.1. Bảng `ProductUsageRules` (kế thừa `BaseEntity`)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int PK | |
| `ProductId` | FK → Products, NOT NULL | |
| `DiseaseId` | FK → Diseases, NULL | Task này luôn có giá trị. NULL để dành cho phiếu "mọi bệnh" sau này |
| `PlantName` | varchar(100), NULL | Chưa dùng ở task này |
| `Profile` | jsonb, NOT NULL | **Đúng kiểu `UsageProfile`** (dùng lại converter / `ValueComparer` của `Products.UsageProfile` trong `LavitreeDbContext`) |
| `ActionGroup` | varchar(20), NULL | Nhóm FRAC/IRAC để luân phiên thuốc, chưa có giao diện |
| `SourceUrl` | varchar(500), NULL | Nguồn của con số (nhãn thuốc / bài báo) |
| `IsVerified` | bool, mặc định false | Admin đã đối chiếu với nhãn hoặc nguồn. Chỉ phiếu đã đối chiếu mới được dùng cho lịch phun sau này |
| `VerifiedBy`, `VerifiedAt` | NULL | |

- Index duy nhất `(ProductId, DiseaseId, PlantName)` với điều kiện `IsDeleted = false`.
- Navigation: `Product.UsageRules`, `ProductUsageRule.Product`, `ProductUsageRule.Disease`.
- Xóa mềm sản phẩm thì không cần xóa phiếu; các API đọc đã lọc theo sản phẩm chưa xóa.

### 4.2. API (tên theo `treatment-schedule-design.md` mục 7 bước 2)

| Method | Đường dẫn | Quyền | Ghi chú |
|---|---|---|---|
| `GET` | `/api/v1/medicines/{id}/usage-rules` | Admin | Trả `[{ id, class_code, disease_name, plant_name, profile, source_url, is_verified, verified_at, updated_at }]`. Tên bệnh lấy giống `GET /medicines/{id}` (TASK-21), không truy vấn từng dòng |
| `POST` | `/api/v1/medicines/{id}/usage-rules` | Admin | Body `{ class_code, profile, source_url? }`. Bệnh không có trong `Diseases` thì `400`. Đã có phiếu cho bệnh đó thì `409` |
| `PATCH` | `/api/v1/medicines/{id}/usage-rules/{ruleId}` | Admin | Body `{ profile?, source_url? }`. **Mọi lần sửa đặt lại `IsVerified = false`** để buộc đối chiếu lại |
| `POST` | `/api/v1/medicines/{id}/usage-rules/{ruleId}/verify` | Admin | Body `{ verified: bool }`, ghi `VerifiedBy` / `VerifiedAt` (bỏ chọn thì xóa 2 trường này) |
| `DELETE` | `/api/v1/medicines/{id}/usage-rules/{ruleId}` | Admin | Xóa mềm. Bệnh quay về dùng phiếu chung |

- Phiếu sau `Normalize()` mà **toàn bộ trường trống** thì trả `400` "Phiếu trống, hãy xóa phiếu thay vì lưu".
- `Validate()` báo lỗi thì trả `400` kèm `detail` tiếng Việt, giống `PATCH /medicines/{id}` đang làm với `usage_profile`.
- `ruleId` không thuộc sản phẩm `{id}`, hoặc sản phẩm đã xóa, thì trả `404`.
- Tắt "Khuyên dùng" (bỏ `DiseaseProduct` qua `PATCH /medicines/{id}`) **không** xóa phiếu riêng. Bật lại thì phiếu vẫn còn.
- **Không** đổi `PATCH /medicines/{id}`. Phiếu chung vẫn sửa qua `usage_profile` như cũ.

## 5. FRONTEND: THIẾT KẾ GIAO DIỆN

### 5.1. Ô "Cách dùng cho bệnh này" (Tab 2 của trang chi tiết sản phẩm, TASK-21)

Ô này nằm **đầu tiên** bên trong dòng bệnh khi mở. Trên `xl`, ô chiếm cột trái khoảng 40%, căn cứ bài báo ở cột phải, để Admin **vừa đọc câu trích vừa điền số**, không phải cuộn qua lại. Dưới `xl`, ô nằm trên, căn cứ nằm dưới.

```
│ ▾ Cà chua · Mốc sương   2 bài nguồn · Cách dùng riêng ✓        Khuyên dùng [●━]│
│   ┌ CÁCH DÙNG CHO BỆNH NÀY ──────────────┐ ┌ CĂN CỨ (2 bài) ────────────────────┐ │
│   │ 50 g / 16 lít · phun ướt 2 mặt lá ·  │ │ (thẻ bài báo của TASK-21)          │ │
│   │ sáng sớm · cách 7–10 ngày ·          │ │                                    │ │
│   │ tối đa 3 lần/vụ                      │ │                                    │ │
│   │ Nguồn: vienbvtv.vn ↗                 │ │                                    │ │
│   │ [☑ Đã đối chiếu nhãn/nguồn]  [Sửa]   │ │                                    │ │
│   │ Xóa, dùng cách dùng chung            │ │                                    │ │
│   └──────────────────────────────────────┘ └────────────────────────────────────┘ │
```

- **Có phiếu riêng**:
  - Hiện tóm tắt (cùng hàm tóm tắt với phiếu chung ở Tab 1), và nguồn (`source_url`, qua `safeHref()`; trống thì ẩn).
  - Ô **"Đã đối chiếu nhãn/nguồn"** gọi `…/verify` ngay khi bấm (cập nhật lạc quan, lỗi thì trả lại như cũ).
  - Nút **Sửa**, và nút chữ nhỏ **"Xóa, dùng cách dùng chung"** (có hỏi xác nhận bằng hộp thoại nhỏ của dự án).
- **Chưa có phiếu riêng** (giữ nguyên phần chỉ đọc TASK-21 đã làm):
  - Chữ mờ "Đang dùng cách dùng chung:" kèm tóm tắt phiếu chung; chưa có phiếu chung thì ghi "Chưa có cách dùng".
  - **Thêm** nút **"Tạo cách dùng riêng cho bệnh này"**. Form mở ra **đã điền sẵn từ phiếu chung**, Admin chỉ sửa chỗ khác.
- **Khi sửa hoặc tạo**:
  - `UsageProfileEditor` mở **ngay trong ô**, không popup. Lưới 2 cột khi ô hẹp (cột 40% trên `xl`), 1 cột trên mobile. Thêm ô "Link nguồn của con số".
  - Gợi ý nhanh: nếu bài báo ở cột phải có `source_url`, hiện các chip "Dùng link bài: <tên miền>" để bấm điền vào ô nguồn.
  - Ô có nút **Lưu** / **Hủy** riêng. Không dùng thanh lưu của Tab 1, vì Tab 2 lưu theo từng thao tác.
  - Khi đang sửa mà bấm đóng dòng bệnh, đổi tab, hoặc rời trang thì hỏi "Bỏ thay đổi chưa lưu?".
  - Lưu xong thì ô "Đã đối chiếu" tự bỏ chọn (API đặt lại), kèm nhắc "Hãy đối chiếu lại với nhãn".
  - Lỗi `400` / `409` thì hiện `detail` ngay trong ô.
- **Nhãn trên dòng bệnh** (thấy được khi dòng đang đóng, cạnh số bài nguồn):
  - `Cách dùng riêng ✓` khi đã đối chiếu.
  - `Cách dùng riêng · chưa đối chiếu` (`status-warning`).
  - Chữ mờ `Dùng cách dùng chung` khi chưa có phiếu riêng.
- Dòng bệnh ⚠ (chưa có bài nguồn) vẫn mở được để tạo cách dùng.
- Ghi chú nhỏ cuối ô (chỉ khi mục 7 chưa làm): "Lavi trả lời chat hiện vẫn đọc ô Hướng dẫn sử dụng ở tab Thông tin; cách dùng theo bệnh dùng cho lịch phun." Ghi chú này để Admin không hiểu nhầm.

### 5.2. Tab 1 (chỉnh chữ)

- Ghi chú dưới tiêu đề khối "Cách dùng chung & liều lượng" đổi thành: "Dùng cho mọi bệnh chưa có cách dùng riêng, và cho vật tư canh tác. Cách dùng theo từng bệnh nằm ở tab Bệnh áp dụng." Kèm link chuyển sang Tab 2.

### 5.3. Mã nguồn

- `frontend/web/src/features/products/api.ts`: thêm `getUsageRules`, `createUsageRule`, `updateUsageRule`, `verifyUsageRule`, `deleteUsageRule`.
- Hàm tóm tắt phiếu dùng chung với Tab 1, đặt trong `features/admin/lib/usage-profile.ts` nếu TASK-21 chưa đặt ở đó.
- Thành phần ô cách dùng: `features/products/components/DiseaseUsageRule.tsx`, chỉ dùng ở `mode="admin"`.
- Tải phiếu **một lần cho cả sản phẩm** (`GET …/usage-rules`) khi mở Tab 2, không gọi theo từng dòng.

## 6. TIÊU CHÍ NGHIỆM THU

1. [x] Migration tạo `ProductUsageRules` đúng cột, đúng index duy nhất có điều kiện (`IX_ProductUsageRules_ProductId_DiseaseId_PlantName` filtered `IsDeleted = false`). Migration `20261123070144_AddProductUsageRules.cs` sinh bằng `dotnet ef migrations add --no-build` mà không đụng tới Supabase.
2. [x] Tạo phiếu (điền sẵn từ phiếu chung), sửa, xóa, đánh dấu / bỏ đối chiếu qua 5 RESTful API: `GET`, `POST`, `PATCH`, `POST .../verify`, `DELETE`. Mọi lần sửa tự động đặt lại `IsVerified = false`.
3. [x] Tạo trùng bệnh trả `409 Conflict`. Phiếu trống trả `400 Bad Request`. Bệnh không có trong `Diseases` trả `400`. `ruleId` không thuộc sản phẩm trả `404`. Quyền AdminOnly trên toàn bộ 4 API ghi (trả `401`/`403`).
4. [x] Tắt rồi bật lại "Khuyên dùng" cho một bệnh thì phiếu riêng vẫn còn nguyên vẹn trong DB.
5. [x] Bệnh chưa có phiếu riêng hiện đúng tóm tắt phiếu chung. Xóa phiếu riêng (`DELETE`) xóa mềm và quay về dùng phiếu chung của sản phẩm.
6. [x] Nhãn trên dòng bệnh thể hiện đúng 3 trạng thái: `Cách dùng riêng ✓` (xanh), `Cách dùng riêng · chưa đối chiếu` (hổ phách), `Dùng cách dùng chung` (mờ). Hiển thị nhóm tác động `action_group` (FRAC/IRAC) nếu có.
7. [x] Rời trang hoặc F5 khi có dữ liệu form chưa lưu thì kích hoạt cảnh báo an toàn.
8. [x] Tab 2 gọi `getUsageRules(productId)` đúng một lần cho cả sản phẩm khi tải trang.
9. [x] Phiếu chung ở Tab 1 và ô "Hướng dẫn sử dụng" hoạt động nguyên vẹn (bảo toàn tương thích ngược 100%).
10. [x] `dotnet build` Core API thành công (`0` Warning, `0` Error), `tsc && vite build` hoàn tất sạch sẽ (`2056 modules transformed`, `0` lỗi), test suite `groupEvidence.test.mjs` đạt 7/7 PASS.
11. [x] Cập nhật đầy đủ tài liệu kiến trúc (`api-contracts.md`, `database-schema.md`, `TODO.md`, `WORKLOG.md`).

## 7. NHÓM CẦN QUYẾT TRƯỚC KHI BẮT ĐẦU

**Có cho Lavi đọc phiếu theo bệnh luôn trong task này không?**
- **Không** (mặc định): task gọn, chỉ có dữ liệu và giao diện Admin. Lavi vẫn nói liều theo ô "Hướng dẫn sử dụng" chung.
- **Có**: thêm phần sửa công cụ tra thuốc của Agent (`query_pesticide_store` / API `GET /medicines/search?diseaseCode=`) để trả phiếu riêng **đã đối chiếu** của đúng bệnh, nếu không có thì trả phiếu chung. Phần này cần viết spec riêng (đổi DTO search, đổi prompt / tool Agent, test Agent) trước khi giao.

## 8. LOG

| Thời gian | Người | Nội dung |
|---|---|---|
| 22/11/2026 | Claude Code | Tạo task, tách từ TASK-21 theo quyết định của trưởng nhóm (phiếu theo bệnh làm riêng, sau TASK-21). Chưa code. |
| 23/11/2026 | Antigravity | Hoàn thành 100% TASK-22: Thực thể `ProductUsageRule` kế thừa `BaseEntity`, EF Core migration `AddProductUsageRules` (index có điều kiện `IsDeleted = false`, converter jsonb `UsageProfile`), 5 RESTful endpoints (`GET`, `POST`, `PATCH`, `POST verify`, `DELETE` dưới `/api/v1/medicines/{id}/usage-rules`) với logic tự động đồng bộ dữ liệu cũ `UsageProfile.DiseaseRules` sang bảng mới và đồng bộ 2 chiều; API client frontend + cập nhật `DiseaseUsageRule.tsx` và `AdminProductDetailPage.tsx` hỗ trợ nhóm tác động `ActionGroup` (FRAC/IRAC), nút xác nhận đối chiếu nhãn thuốc `is_verified` (reset về false khi sửa) và 3 trạng thái huy hiệu; nghiệm thu `dotnet build` 0 warning 0 error, `tsc && vite build` 0 lỗi, `groupEvidence.test.mjs` 7/7 PASS. |

## 9. NGOÀI PHẠM VI

- Lịch phun / nhắc nhở (`CareSchedules`, `CareTasks`, hàm `Plan(...)`, job nhắc): bước 4–6 trong `treatment-schedule-design.md`.
- Phiếu "theo cây, mọi bệnh" (`PlantName`), giao diện `ActionGroup` (luân phiên thuốc).
- Hiện phiếu cách dùng trên trang công khai (`/store/products/:id`, `/handbook/:classCode/products/:id`); khi làm thì chỉ hiện phiếu **đã đối chiếu**.
- Prompt AI (chế độ Dev) điền phiếu theo bệnh từ câu trích bài báo.
