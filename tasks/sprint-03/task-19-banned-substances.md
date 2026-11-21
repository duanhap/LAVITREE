# TASK-19: Danh mục chất cấm quản lý được (theo văn bản, có lịch sử cấm / bỏ cấm)
* **Sprint**: Sprint 3
* **Phân hệ**: core-api (bảng mới, API), agent-service (guardrails), frontend/web (Admin › Kho vật tư & thuốc › tab Chất cấm)
* **Trạng thái**: `[ ] IN REVIEW` (18/11/2026, chưa commit, chưa chạy migration trên Supabase)
* **Người phụ trách**: Trưởng nhóm (làm cùng Claude Code)
* **Độ ưu tiên**: P1 (an toàn: chặn thuốc cấm)
* **Tạo ngày**: 18/11/2026

---

## 1. MỤC TIÊU

1. Danh mục chất cấm nằm trong CSDL, Admin cập nhật được trên giao diện, không phải sửa code ở 3 nơi.
2. Cập nhật theo **văn bản pháp lý**: mỗi thay đổi là một quyết định Cấm / Bỏ cấm kèm số hiệu văn bản và ngày hiệu lực. Thông tư mới bỏ cấm một chất thì thêm quyết định "Bỏ cấm", không xóa (giữ lịch sử). Quyết định có ngày hiệu lực trong tương lai tự áp dụng khi tới ngày.
3. Nạp danh mục từ **PDF thông tư** (bảng nháp, Admin duyệt trước khi lưu).
4. Chất **không có trong kho** vẫn lưu, để Lavi nhắc nông dân khi họ hỏi ("xịt Furadan được không?").

---

## 2. BỐI CẢNH

- Trước task này danh sách cấm viết cứng ở 3 nơi (`MedicinesController.BannedIngredients`, `guardrails.py BANNED_INGREDIENTS`, `guardrails.ts`), 14 cụm, so khớp "có chứa chuỗi".
- Đối chiếu với Phụ lục II TT 75/2025/TT-BNNMT (`75-bnnmt-pl2.pdf`, 31 hoạt chất):
  - 23 chất có trong Phụ lục chưa có trong code (DDT, Trichlorfon, Captan, Lindane, 2,4,5-T...).
  - 4 chất trong code **không có** trong Phụ lục II: paraquat, 2,4-D, chlorpyrifos, glyphosate. Giữ trạng thái cấm, ghi chú cần bổ sung văn bản (paraquat, 2,4-D: QĐ 278/QĐ-BNN-BVTV theo chú thích cũ).
- Thông tư chính (`75-bnnmt.pdf`) để trống ngày hiệu lực ("kể từ ngày … tháng … năm 2026") nên dữ liệu khởi tạo **không ghi ngày hiệu lực**. Điều 2 có chuyển tiếp cho carbosulfan (dùng 2 năm) và benfuracarb (1 năm): Admin thêm quyết định Cấm có ngày hiệu lực tương lai khi có ngày chính thức.
- Lavi trước đây gỡ câu có tên chất cấm và thêm cảnh báo chung không nêu tên; nông dân hỏi đúng tên chất cấm thì không được trả lời rõ.

---

## 3. PHẠM VI ĐÃ LÀM

### 3.1. CSDL (migration `20261118004715_AddBannedSubstances`)
- `BannedSubstances`: `CommonName` (duy nhất trong các dòng chưa xóa), `Aliases text[]` (tên thương phẩm / cách viết khác), `Category` (INSECTICIDE / FUNGICIDE / HERBICIDE / RODENTICIDE / OTHER), `Note`, xóa mềm.
- `BannedSubstanceDecisions`: `Action` (BAN / UNBAN), `LegalDocument`, `EffectiveDate` (null = đã hiệu lực, chưa ghi ngày), `SourceUrl`, `Note`, `CreatedBy`, xóa mềm (gỡ quyết định nhập nhầm).
- Trạng thái = quyết định mới nhất có `EffectiveDate ≤ hôm nay (giờ VN)`.
- Dữ liệu khởi tạo: 31 chất Phụ lục II + 4 chất cũ = 35 chất, 56 cụm so khớp.

### 3.2. Core API
- `BannedSubstanceRegistry` (bộ nhớ): nạp lúc khởi động, sau mỗi lần Admin sửa, và mỗi 10 phút (`BannedSubstanceRefreshService`). Lỗi CSDL thì giữ danh sách cũ; chưa nạp được thì dùng danh sách dự phòng (trùng dữ liệu khởi tạo).
- So khớp **từ nguyên vẹn**: "2,4-D" khớp "2,4-D 720SL", không khớp "2,4-DB".
- `MedicinesController.IsBannedIngredient` dùng registry. `GET /medicines/search?allowedOnly=true` loại cả sản phẩm chứa chất bị cấm **sau** khi đã lưu.
- API mới (mục 3.14 `api-contracts.md`): xem danh mục (công khai), thêm / sửa / xóa chất, thêm / gỡ quyết định, đọc PDF, nhập hàng loạt có xem trước (`dry_run`).
- Đọc PDF bằng PdfPig (gói NuGet `PdfPig 0.1.11`): gom chữ theo dòng, nhận nhóm "Thuốc trừ sâu / bệnh / chuột / cỏ", tách tên trong ngoặc thành tên khác (bỏ ký hiệu ngắn như Pb, Cd), "BHC, Lindane" thành 2 tên. Số hiệu văn bản nằm trong chữ ký số nên lấy từ dòng "Ban hành kèm theo Thông tư số …/2025/TT-BNNMT" + số đầu tên file, kèm cảnh báo kiểm tra lại.

### 3.3. agent-service
- `app/agent/banned_registry.py`: lấy danh mục từ Core, đệm 5 phút, Core lỗi thì giữ danh sách cũ / dự phòng.
- `pre_filter_medicines`, `post_filter_response` dùng danh sách mới, so khớp từ nguyên vẹn.
- Câu hỏi của nông dân có chất cấm → cảnh báo **nêu rõ tên chất và văn bản**, khuyên liên hệ khuyến nông / Trạm Trồng trọt & BVTV để xử lý hàng đang giữ. Áp dụng cả đường trả lời dự phòng (offline).

### 3.4. Web
- Tab **Chất cấm** (`features/admin/components/BannedSubstancesTab.tsx`): tìm, lọc theo trạng thái, xem lịch sử quyết định, thêm chất, sửa tên khác / nhóm, thêm quyết định Cấm / Bỏ cấm (có ngày hiệu lực), gỡ quyết định nhập nhầm, nạp PDF → bảng nháp sửa được → Xem trước → Lưu.
- `guardrails.ts`: danh sách tải từ server (`setBannedTerms`), dự phòng khi chưa tải được.

---

## 4. KẾT QUẢ KIỂM TRA (Core local + DB test riêng, không phải Supabase)

- API: 25/25 PASS (script `t19/e2e.mjs` trong scratchpad): khởi tạo 35 chất / 56 cụm; đọc PDF thật 31/31 dòng, số hiệu "Thông tư 75/2025/TT-BNNMT, Phụ lục II"; nhập lại cùng văn bản 31 "Không đổi"; văn bản khác 31 "Ghi thêm quyết định" (ghép đúng "Cadmium compound (Cd)", "Talium compond"); Furadan / Trichlorfon bị chặn; Bỏ cấm Captan → lưu được sản phẩm Captan → gỡ quyết định → cấm lại và biến khỏi tìm kiếm cho Lavi; chất cấm từ 2099 hôm nay chưa cấm; trùng tên 409; link không phải http(s) 400; tên khác < 3 ký tự 400; không đăng nhập 401.
- agent-service: `test_task19_banned_registry.py` 9/9 + `test_react_guardrails.py` 26/26 PASS; đọc danh mục từ Core local thật: 56 cụm, cảnh báo "Trichlorfon (Thông tư 75/2025/TT-BNNMT, Phụ lục II)" khi hỏi "Dipterex".
- Web: Playwright tab Chất cấm 35 dòng, lịch sử quyết định, nạp PDF → Xem trước 31 Không đổi, nút Lưu khóa; không lỗi JS. `tsc` 0, `npm run build` thành công.

---

## 5. VIỆC CÒN LẠI / LƯU Ý

- [ ] Chạy migration trên Supabase (deploy Core tự chạy `MigrateAsync` lúc khởi động).
- [ ] Admin bổ sung ngày hiệu lực TT 75/2025 khi có; văn bản cho chlorpyrifos, glyphosate; quyết định cho carbosulfan / benfuracarb theo điều chuyển tiếp.
- [ ] PDF bản scan (ảnh) chưa đọc được (không OCR): nhập tay hoặc làm thêm luồng AI.
- Tên kim loại (Arsenic, Mercury, Cadmium) có thể khớp nhầm khi nhãn phân bón ghi giới hạn kim loại nặng; danh sách so khớp chỉ áp vào tên và hoạt chất sản phẩm và câu trả lời của Lavi.
- Sản phẩm đã lưu trước đây có chất mới bị cấm: Core loại khỏi tìm kiếm ngay, nhưng cờ `IsAllowed` trong bảng không tự đổi.
