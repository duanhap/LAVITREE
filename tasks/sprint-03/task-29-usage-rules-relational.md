# TASK-29: Chuyển liều lượng theo Cây / Bệnh ra bảng quan hệ, bỏ `disease_rules` / `plant_rules` trong JSON

* **Sprint**: Sprint 3
* **Phân hệ**: `backend/core-api` (Domain, Infrastructure + migration, `MedicinesController`, `KnowledgeController`), `frontend/web` (Admin sản phẩm, Admin kho, trang chi tiết sản phẩm), `docs/architecture`
* **Ưu tiên**: P1. Nên làm ngay vì Admin đã gỡ phần lớn liên kết vật tư để làm lại, dữ liệu cần chuyển ít.
* **Phụ thuộc**: TASK-18 (phiếu cách dùng), TASK-22 (`ProductUsageRules`), TASK-28 (liều theo Cây, phần giao diện)
* **Thay thế**: phần lưu trữ của TASK-28 (`plant_rules`, đồng bộ đè `disease_rules`)
* **Trạng thái**: `[~] Code xong, đã thử trên DB local (30/30 API + 7/7 giao diện). Chờ đồng ý áp migration lên Supabase và deploy.`
* **Nhánh Git**: `feat/task-29-usage-rules-relational`
* **Tạo ngày**: 24/11/2026

---

## 1. Bối cảnh và nguyên nhân

### 1.1. Hiện trạng (đã kiểm tra code và DB ngày 24/11/2026)
- `Products.UsageProfile` là cột `jsonb`. Ngoài các trường của phiếu cách dùng theo bao bì, nó còn chứa:
  - `disease_rules`: từ điển theo mã bệnh (TASK-21/22);
  - `plant_rules`: từ điển theo tên cây (TASK-28, mới thêm vào `UsageProfile.cs`).
- Bảng `ProductUsageRules` (TASK-22) đã có, gồm `ProductId`, `DiseaseId?`, `PlantName` (chuỗi), `Profile` (jsonb), `ActionGroup`, `SourceUrl`, `IsVerified`, `VerifiedBy`, `VerifiedAt`.
  - Bảng này **không có cột chữ liều** (`DosageInstruction`).
  - Cây được lưu bằng **tên**, không có khóa ngoại tới `PlantCategories`.
  - Chưa có ràng buộc duy nhất.
- Code chạy song song 2 nơi: `MedicinesController` ghi vào bảng rồi chép ngược sang `UsageProfile.DiseaseRules`.
  - `GET /medicines/{id}/usage-rules` còn **ghi DB ngay trong lệnh GET**: nó tự chuyển `DiseaseRules` sang bảng ([MedicinesController.cs:972-1005](../../backend/core-api/src/Lavitree.Api/Controllers/MedicinesController.cs#L972-L1005)).
- Ai đọc các quy tắc này: **chỉ Core (`MedicinesController`, `KnowledgeController`) và web**.
  - agent-service chỉ đọc `dosage_instruction` của sản phẩm qua API tìm thuốc, không đọc `usage_profile`.
  - App Android không đọc trường này.
  - Lập lịch phun (FEAT-06) mới có bản thiết kế, chưa có code.
- Dữ liệu lúc tạo task:
  - 8 sản phẩm, 5 sản phẩm có `UsageProfile`;
  - 2 sản phẩm còn `disease_rules`, 0 sản phẩm có `plant_rules`;
  - 5 dòng `ProductUsageRules`;
  - 15 dòng `DiseaseProducts`.

### 1.2. Lỗi đã xảy ra vì thiết kế JSON lồng (sản phẩm 3, Trichoderma)
1. Backend thiếu thuộc tính `PlantRules`, nên lúc lưu, serializer lặng lẽ bỏ `plant_rules` mà không báo lỗi.
2. Mỗi lần lưu, web gửi **cả cục JSON**. Nút "Đồng bộ cho n bệnh" và "Lưu liều" chép một bản đè lên mọi bệnh của cây. Đoạn liều riêng của bệnh mốc sương bị mất, không còn bản sao nào trong DB.
3. Bản sửa ngày 24/11 cho thấy chỉ cần một Core cũ đang chạy là `plant_rules` lại mất sau lần lưu kế tiếp.

**Kết luận:** mỗi quy tắc phải là **một dòng riêng có khóa ngoại**, sửa bằng API theo từng dòng. Không bao giờ gửi cả cục JSON để ghi đè.

---

## 2. Thiết kế mới

### 2.1. Mô hình dữ liệu
Dùng lại và mở rộng `ProductUsageRules`, không tạo bảng mới:

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | int PK | |
| `ProductId` | int FK → `Products` | bắt buộc |
| `PlantId` | int FK → `PlantCategories` | **mới, bắt buộc**, thay `PlantName` |
| `DiseaseId` | int? FK → `Diseases` | `null` = liều chung của cây; có giá trị = liều riêng (ngoại lệ) cho bệnh đó |
| `DosageInstruction` | text? | **mới**: đoạn hướng dẫn bằng chữ hiển thị cho người dùng |
| `Profile` | jsonb | phiếu **phẳng** (liều, lượng nước, cách dùng, chu kỳ…); không còn `disease_rules` / `plant_rules` |
| `ActionGroup`, `SourceUrl`, `IsVerified`, `VerifiedBy`, `VerifiedAt`, `CreatedAt`, `UpdatedAt`, `IsDeleted` | | giữ nguyên |

- Ràng buộc: khi `DiseaseId != null` thì bệnh phải thuộc đúng `PlantId`. Kiểm tra ở API; nếu được thì thêm CHECK hoặc trigger.
- Chỉ mục duy nhất, áp dụng cho các dòng chưa xóa (`IsDeleted = false`):
  - `(ProductId, PlantId) WHERE DiseaseId IS NULL`: mỗi vật tư chỉ có 1 liều chung cho mỗi cây.
  - `(ProductId, DiseaseId) WHERE DiseaseId IS NOT NULL`: mỗi vật tư chỉ có 1 ngoại lệ cho mỗi bệnh.
- Giữ `Products.UsageProfile` cho **phiếu theo bao bì** (phẳng) và `Products.DosageInstruction` cho liều chung in trên nhãn.
- Xóa `DiseaseRules`, `PlantRules` và lớp `DiseaseUsageRuleProfile` khỏi `UsageProfile.cs` sau khi đã chuyển dữ liệu.

### 2.2. Thứ tự lấy liều cho một cặp (vật tư, bệnh)
1. Ngoại lệ của bệnh: dòng có `DiseaseId = bệnh`.
2. Liều chung của cây: dòng có `PlantId = cây của bệnh` và `DiseaseId IS NULL`.
3. Phiếu bao bì `Products.UsageProfile` cùng `Products.DosageInstruction`, hiển thị kèm nhãn "Liều chung của sản phẩm".

Thứ tự này được tính **ở backend, trong một hàm duy nhất**. Web chỉ hiển thị kết quả, bỏ hết các đoạn tự đoán ở frontend như "lấy đoạn dài nhất", "lấy `defaultDosage`", "khớp tên cây không phân biệt hoa thường".

### 2.3. API
- `GET /api/v1/medicines/{id}`: bỏ `usage_profile.disease_rules` và `plant_rules`, thêm:
  ```json
  "plant_usage": [
    {
      "plant_id": 1, "plant_name": "Cà chua",
      "rule": { "id": 12, "dosage_instruction": "...", "profile": { }, "source_url": "...", "is_verified": true } ,
      "diseases": [
        { "class_code": "Tomato___Late_blight", "disease_name": "...", "override_rule": null }
      ]
    }
  ]
  ```
  `rule` là `null` khi cây chưa có liều chung. Khi đó web hiện liều bao bì kèm ghi chú.
- `GET /medicines/{id}/usage-rules`: **chỉ đọc**, bỏ phần tự chuyển dữ liệu sang bảng.
- `POST /medicines/{id}/usage-rules` nhận `{ plant_id, disease_id?, dosage_instruction?, profile, action_group?, source_url? }`.
  - Trùng chỉ mục duy nhất thì trả 409.
  - Bệnh không thuộc cây thì trả 400.
- `PATCH /medicines/{id}/usage-rules/{ruleId}`: chỉ sửa đúng dòng đó.
- `DELETE /medicines/{id}/usage-rules/{ruleId}`: xóa mềm. Không đụng tới các dòng khác.
- `PATCH /medicines/{id}` (sửa sản phẩm): nếu `usage_profile` gửi lên còn `disease_rules` / `plant_rules` thì trả 400 kèm thông báo rõ ràng. Không được lặng lẽ bỏ qua.
- `KnowledgeController`, khi duyệt gợi ý vật tư (gán thuốc cho bệnh):
  - nếu cây đã có liều chung thì chỉ tạo liên kết `DiseaseProducts`, không tạo liều mới;
  - nếu Admin nhập liều thì tạo hoặc cập nhật **liều chung của cây**; chỉ khi Admin chọn "Liều riêng cho bệnh này" mới tạo ngoại lệ.
  - Bỏ vòng lặp chép cùng một quy tắc vào mọi mã bệnh (đoạn TASK-28 trong `KnowledgeController.cs`).
- Giữ nguyên `dosage_instruction` trong kết quả tìm thuốc của agent. Nếu thời gian cho phép, thêm `dosage_for_plant` lấy theo mục 2.2 để Lavi trả lời đúng liều theo cây (mục phụ, không bắt buộc).

### 2.4. Chuyển dữ liệu (migration EF)
1. Thêm cột `PlantId` (cho phép null, chỉ dùng tạm) và `DosageInstruction`.
2. Điền `PlantId`:
   - nếu dòng có `DiseaseId` thì lấy theo cây của bệnh đó;
   - nếu không, khớp `PlantName` với `PlantCategories.Name` (bỏ tiền tố "Cây", không phân biệt hoa thường).
   - Dòng nào không khớp được thì **dừng migration và báo lỗi**, không đoán.
3. Chuyển từ `Products.UsageProfile` sang bảng:
   - mỗi mục `disease_rules[mã bệnh]` thành một dòng ngoại lệ, gồm cả `dosage_instruction`;
   - mỗi mục `plant_rules[tên cây]` thành một dòng liều chung.
   - Nếu tất cả ngoại lệ của một cây giống hệt nhau (cùng chữ, cùng phiếu) thì gộp thành **1 liều chung của cây** và xóa các ngoại lệ đó, vì đó chính là kết quả của nút "Đồng bộ" trước đây.
4. Bỏ `disease_rules` / `plant_rules` khỏi JSON. Đặt `PlantId NOT NULL`, xóa `PlantName`, tạo 2 chỉ mục duy nhất.
5. Bản sao lưu và hướng hoàn tác:
   - Trước khi chạy trên Supabase, xuất `Products."UsageProfile"` và toàn bộ `ProductUsageRules` ra file JSON.
   - **Cần người dùng đồng ý trước khi áp migration lên Supabase.**
   - Không chạy Core trong repo để thử với DB local (xem lưu ý về DotNetEnv).

### 2.5. Web
- `AdminProductDetailPage` / `DiseaseEvidenceList`:
  - Mỗi cây có 1 khối "Liều chung cho Cây X" với nút Sửa và Lưu. Nút này gọi `POST` hoặc `PATCH` cho đúng 1 dòng.
  - Mỗi bệnh có nút "Đặt liều riêng" để tạo ngoại lệ, và "Bỏ liều riêng" để xóa ngoại lệ, quay về liều của cây.
  - **Bỏ nút "Đồng bộ cho n bệnh"**, vì bệnh tự kế thừa liều của cây.
  - Bỏ `handleSaveCropRule` (gửi cả cục `usage_profile`).
- `AdminInventoryPage` (gán gợi ý vật tư):
  - Nếu cây đã có liều chung thì hiện "Dùng liều Cây X" và cho gán ngay.
  - Nếu chưa có thì mở form nhập liều chung cho cây.
- `ProductDetailPage` (phía người dùng): đọc `plant_usage`. Hiện liều chung của cây, bệnh nào có ngoại lệ thì gắn nhãn "Liều riêng". Bỏ toàn bộ đoạn tự đoán liều.
- `features/admin/lib/usage-profile.ts`: bỏ `disease_rules` / `plant_rules` khỏi kiểu `UsageProfile`, thêm kiểu `PlantUsage`.

### 2.6. Tài liệu
- `docs/architecture/api-contracts.md`: mục medicines và usage-rules.
- `docs/architecture/treatment-schedule-design.md`: ghi lập lịch phun lấy liều theo thứ tự ở mục 2.2.

---

## 3. Kiểm thử

| # | Tình huống | Kỳ vọng |
|---|---|---|
| T1 | Tạo liều chung cho Cà chua, sản phẩm có 4 bệnh cà chua | `plant_usage[Cà chua].rule` có đúng đoạn chữ; cả 4 bệnh `override_rule = null` và hiển thị liều cây |
| T2 | Đặt liều riêng cho mốc sương, rồi sửa liều chung của cây | Mốc sương **giữ nguyên** liều riêng; 3 bệnh còn lại theo liều mới |
| T3 | Xóa liều riêng của mốc sương | Mốc sương quay về liều cây; các dòng khác không đổi |
| T4 | Tạo liều chung thứ 2 cho cùng (vật tư, cây) | 409 |
| T5 | Tạo ngoại lệ với bệnh không thuộc cây | 400 |
| T6 | `PATCH /medicines/{id}` gửi `usage_profile.disease_rules` | 400, dữ liệu không đổi |
| T7 | Cây chưa có liều chung | Người dùng thấy liều bao bì kèm nhãn "Liều chung của sản phẩm"; Admin **không** thấy nút nào chép liều bao bì sang các bệnh |
| T8 | Migration trên bản sao DB có `disease_rules` giống hệt nhau cho 4 bệnh | Gộp thành 1 liều chung, 0 ngoại lệ; JSON không còn `disease_rules` |
| T9 | Migration gặp `PlantName` không khớp cây nào | Dừng và báo lỗi, không ghi dở dang |
| T10 | 2 tab Admin cùng sửa 2 bệnh khác nhau của một vật tư | Cả 2 thay đổi đều còn (không ghi đè cả cục) |
| T11 | `GET /medicines/{id}/usage-rules` | Không ghi DB (kiểm tra `UpdatedAt` không đổi) |
| T12 | Agent `query_pesticide_store` | Vẫn trả `dosage_instruction` như cũ; test MCP không hỏng |

Chạy migration và T1–T11 trên **Postgres local** (container `lavi-test-pg`), chạy Core từ thư mục build bên ngoài repo. Chỉ áp lên Supabase sau khi người dùng đồng ý.

---

## 4. Tiêu chí nghiệm thu
- [x] `UsageProfile.cs` không còn `DiseaseRules` / `PlantRules` / `DiseaseUsageRuleProfile`; build Core 0 lỗi.
- [x] `ProductUsageRules` có `PlantId` (FK, bắt buộc), `DosageInstruction`, 2 chỉ mục duy nhất; không còn `PlantName`.
- [x] Thứ tự lấy liều (mục 2.2) nằm trong 1 hàm backend (`UsageRuleResolver`); kiểm bằng e2e (chưa có project unit test C#).
- [x] Không còn đường web nào sửa liều bằng cả cục `usage_profile`; không còn nút "Đồng bộ cho n bệnh".
- [x] Mọi lệnh GET không ghi DB.
- [x] T1–T12 đạt, có ghi kết quả vào mục Nhật ký bên dưới.
- [x] Tài liệu API được cập nhật (`docs/architecture/api-contracts.md` mục 3.4.0c).
- [ ] Đã sao lưu trước khi migrate Supabase, và người dùng đã đồng ý.

## 5. Rủi ro và lưu ý
- Thay đổi chưa commit của TASK-28 (`DiseaseEvidenceList.tsx`, `ProductDetailPage.tsx`, `AdminProductDetailPage.tsx`, `AdminInventoryPage.tsx`, `KnowledgeController.cs`, `UsageProfile.cs`) chạm đúng các file này. **Commit hoặc tách TASK-28 trước khi bắt đầu**, và chỉ để một agent sửa các file này.
- Production đang chạy Core cũ. Deploy Core và web cùng lúc, vì web mới cần `plant_usage`.
- Không suy diễn liều: trường nào không biết thì để null (giữ quy tắc của TASK-18).

## 5b. Điều chỉnh so với thiết kế ban đầu (khi làm)
- **Không thêm trường `plant_usage` mới.** API vẫn trả `usage_profile.plant_rules` / `usage_profile.disease_rules` như cũ nhưng giờ là **bản xem chỉ đọc** tính từ bảng, mỗi mục có thêm `rule_id` và `scope` (`plant` / `disease`). Nhờ vậy 3 form (tạo sản phẩm, tạo sản phẩm từ gợi ý, gắn gợi ý) và trang cửa hàng giữ nguyên cách đọc, chỉ sửa vài dòng.
- **T6 đổi kỳ vọng:** `PATCH /medicines/{id}` gửi lại `disease_rules` / `plant_rules` thì server **bỏ qua** (không trả 400), vì web luôn gửi lại nguyên `usage_profile` vừa đọc. Liều chỉ sửa qua `/usage-rules`, nên việc bỏ qua không làm mất dữ liệu.
- Khóa ngoại bệnh đổi từ `SET NULL` sang `CASCADE`: `SET NULL` sẽ biến liều riêng của bệnh bị xóa thành liều chung của cây.
- Lựa chọn "Dùng liều chung của sản phẩm" trong form gắn gợi ý: nếu cây **đã có** liều chung thì bệnh vẫn dùng liều cây (không tạo liều riêng bằng phiếu bao bì).
- Unit test C# chưa có project test; thay bằng bộ kiểm thử API đầu-cuối (mục Nhật ký).

## 6. Nhật ký
| Thời gian | Người làm | Nội dung | Kết quả |
|---|---|---|---|
| 2026-11-24 | Claude | Tạo task sau khi kiểm tra code và DB | — |
| 2026-11-24 | Claude | Backend: `ProductUsageRule` (+`PlantId` FK, `DosageInstruction`, 2 chỉ mục duy nhất), `UsageProfile` phẳng, `UsageRuleResolver` + `UsageProfileView`, API `/usage-rules` mới (GET chỉ đọc), link gợi ý ghi bảng; migration `20261124112042_UsageRulesByPlant` (chuyển + gộp dữ liệu JSON). Web: lưu liều cây / liều bệnh qua `/usage-rules`, bỏ nút "Đồng bộ cho n bệnh", `isUsageEmpty` chỉ xét trường phẳng, form gắn gợi ý nhận `plant_rules`. | `dotnet build` 0 lỗi; `tsc` 0 lỗi; `vite build` OK; `npm test` 7/7 |
| 2026-11-24 | Claude | Thử trên bản sao Supabase (pg_dump chỉ đọc → Postgres 15 local `lavitree_t29`), Core chạy ngoài repo cổng 5199 và tự migrate khi khởi động. Trichoderma: 4 liều riêng giống nhau → 1 liều chung Cà chua; JSON sản phẩm không còn `disease_rules`. | API e2e **30/30 PASS** (T0–T7, T10–T12, form 1/2/3: L1–L3, F1, F2); **T9 PASS** (tên cây không khớp → migration dừng, DB không đổi); giao diện Playwright **7/7 PASS** (Admin sửa liều cây = 1 dòng, không còn nút Đồng bộ, cửa hàng hiện liều mới, trang kho không lỗi JS). T8 kiểm bằng dữ liệu thật ở trên. |
