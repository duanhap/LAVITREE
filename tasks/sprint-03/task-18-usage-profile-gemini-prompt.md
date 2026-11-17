# TASK-18: Phiếu cách dùng vật tư, prompt Gemini tổng hợp, chuẩn bị lịch phun
* **Sprint**: Sprint 3
* **Phân hệ**: frontend/web (Admin › Kho vật tư & thuốc), core-api (Products)
* **Trạng thái**: `[x] DONE` (17/11/2026, bản nhẹ; bản đầy đủ là task sau)
* **Người phụ trách**: Trưởng nhóm (làm cùng Claude Code)
* **Độ ưu tiên**: P2
* **Tạo ngày**: 17/11/2026, nối tiếp TASK-17 (đợt 2)

---

## 1. MỤC TIÊU

1. Nhập vật tư nhanh mà **dữ liệu tốt**: Admin bấm một nút, Gemini bản web tự tổng hợp thông tin vật tư **tại Việt Nam**, bám theo đoạn trích bài báo. Admin chỉ kiểm tra, chọn link và ảnh rồi lưu.
2. Mô tả và cách dùng phải **chi tiết**: liều lượng, cách pha, buổi phun (sáng / chiều), mấy lần một ngày, cách nhau bao nhiêu ngày, tối đa mấy lần một vụ, thời gian cách ly (PHI), điều kiện thời tiết, an toàn.
3. Lưu cách dùng thành **phiếu có cấu trúc** (con số riêng từng ô). Tính năng lịch phun / nhắc nhở sau này (task riêng) sẽ dùng phiếu này để code tự tính ngày, không phải đọc lại đoạn chữ.

Chế độ Dev là để tìm nhanh. Admin vẫn phải đối chiếu nguồn trước khi lưu và trước khi bật "Được phép lưu hành".

---

## 2. BỐI CẢNH

- Trợ lý Lavi lấy vật tư qua công cụ tra kho theo mã bệnh. Core trả **nguyên văn** `DosageInstruction` (gồm cả "Mô tả: …"), agent chuyển nguyên khối cho Gemini (`MedicinesController.Search`, `react_agent.py`). Trợ lý chỉ thấy sản phẩm khi:
  - đã bật **"Được phép lưu hành"** (`IsAllowed`); sản phẩm tạo từ gợi ý mặc định đang tắt;
  - đã **gắn đúng bệnh** (`DiseaseProducts`).
- Chốt chặn `strip_unsourced_dosage` xóa câu có con số liều lượng không có trong tài liệu hoặc trong hướng dẫn của sản phẩm. Hướng dẫn ghi rõ con số thì trợ lý mới được nói con số đó.
- Hiện có 2 nút AI ở form (Tìm link với AI, Sao chép Prompt cho Gemini) và prompt JSON chưa đòi chi tiết cách dùng.
- Nút "Tạo SP" ở cuối hàng mở thẳng form, Admin không thấy đoạn trích để bỏ bài không liên quan.
- Modal trích dẫn có đoạn lặp: đoạn 2 nằm trọn trong đoạn 1 của cùng bài (ví dụ "nấm đối kháng") vẫn hiện 2 lần.

---

## 3. PHẠM VI

### 3.1. Giao diện gợi ý vật tư
- [x] Nút **"Tạo SP"** ở cuối hàng (cả dạng gộp và dạng từng dòng) mở **modal trích dẫn** trước. Admin xem, bỏ tick bài không liên quan rồi bấm "Tạo sản phẩm" trong modal.
- [x] Gộp đoạn trùng: trong cùng bài + cùng bệnh, đoạn nằm trọn trong đoạn khác (so sau khi bỏ dấu, bỏ khoảng trắng thừa) thì chỉ giữ đoạn dài hơn. Áp dụng cho modal, số đếm "n đoạn trích · m bài" và prompt (`mergeEvidencesByArticle`).

### 3.2. Một nút AI duy nhất
- [x] Bỏ nút "Tìm link với AI" cạnh ô link và `buildLinkSearchPrompt`. Giữ chip Tra Google.
- [x] Chỉ còn nút **"Sao chép prompt cho Gemini"** trong chế độ Dev (`</>`), kèm ô dán JSON.

### 3.3. Prompt Gemini mới (`buildProductResearchPrompt`)
- [x] Vai trò: chuyên gia vật tư nông nghiệp / thuốc BVTV **tại Việt Nam**. Ưu tiên nguồn Việt Nam: nhãn thuốc đã đăng ký, danh mục thuốc BVTV được phép, nhà sản xuất / phân phối, trung tâm khuyến nông, viện / trường.
- [x] Giữ: đoạn trích gộp theo bài (≤ 4 bài, tên vật tư `**…**`), xác định PRODUCT / HOMEMADE / SEED / SUPPLY / PRACTICE, `mentions_differ`, danh sách mã bệnh hợp lệ.
- [x] Bắt buộc bám đoạn trích: cây, bệnh, cách dùng trong bài. Nếu nguồn khác bài báo thì ghi rõ.
- [x] Đầu ra gồm 2 phần theo thứ tự:
  1. **Khối ```json** để copy (mẫu ở mục 4.1), có `description` chi tiết và `usage` có cấu trúc.
  2. **Danh sách nguồn** bên dưới, dạng markdown: 3–5 link, mỗi dòng ghi `URL — loại trang — có thông tin gì`, đánh dấu link nào có ảnh sản phẩm và link ảnh trực tiếp nếu có.
- [x] Quy tắc: số liệu không có nguồn ghi rõ thì `null`, **tuyệt đối không đoán** liều, PHI, số lần. Chế phẩm tự pha thì ghi nguyên liệu, tỷ lệ, cách pha theo bài. Không bịa link, không bịa link ảnh.

### 3.4. Nạp JSON vào form
- [x] `description` vào ô Mô tả (dài hơn, chia mục "• …").
- [x] `usage` vào **khối "Cách dùng"** mới trong form: các ô nhỏ (liều, đơn vị, lượng nước, cách dùng, buổi, số lần/ngày, cách nhau min–max ngày, tối đa lần/vụ, bắt đầu khi, ngừng khi, thời tiết, an toàn). Admin sửa được.
- [x] Ô "Hướng dẫn sử dụng" (text cho trợ lý đọc) được **ghép tự động** từ phiếu theo nhãn cố định, Admin vẫn sửa tay được:
  ```
  • Liều lượng: 50 g / bình 16 lít (400–600 lít/ha)
  • Cách dùng: phun ướt đều 2 mặt lá
  • Thời điểm: sáng sớm hoặc chiều mát, 1 lần/ngày
  • Nhắc lại: cách 7–10 ngày, tối đa 3 lần/vụ
  • Bắt đầu: khi bệnh chớm xuất hiện
  • Thời tiết: không phun khi sắp mưa (trong 6 giờ)
  • Cách ly (PHI): 7 ngày trước thu hoạch
  • An toàn: mang găng tay, khẩu trang
  ```
- [x] `phi_days` vẫn lưu ở cột `PhiDays` hiện có (một nguồn duy nhất), không lặp trong phiếu.
- [x] `source_urls` thành danh sách "Dùng link này" (đã có). `image_candidates` thành ô xem trước ảnh + nút **"Dùng ảnh này"**. Ảnh không tải được thì ẩn và báo.
- [x] Đọc JSON vẫn chịu được lời dẫn và phần danh sách nguồn phía sau khối ```json.

### 3.5. Lưu phiếu cách dùng (cách B bản nhẹ)
- [x] Thêm cột `Products.UsageProfile` (`jsonb`, cho phép null) + migration. Sản phẩm cũ để null, không ảnh hưởng.
- [x] `POST /medicines`, `PATCH /medicines/{id}` nhận `usage_profile`; `GET` / `search` trả `usage_profile`. Kiểm tra server: số không âm, `interval_days.min ≤ max`, giới hạn hợp lý (≤ 365 ngày, ≤ 20 lần/vụ), chuỗi cắt độ dài.
- [x] Form sửa sản phẩm (tab 1) hiện và sửa được phiếu.
- [x] Agent **chưa** đổi: vẫn đọc `dosage_instruction` (đã có text ghép theo nhãn). Schema MCP chỉ cần cho phép trường mới (bỏ qua nếu thừa).

---

## 4. THIẾT KẾ DỮ LIỆU

### 4.1. JSON Gemini trả về
```json
{
  "identified_as": "PRODUCT | HOMEMADE | SEED | SUPPLY | PRACTICE",
  "identification_note": "",
  "mentions_differ": false,
  "differ_note": "",
  "name": "",
  "medicine_type": "Hóa học | Sinh học | Vật tư canh tác",
  "active_ingredient": "",
  "description": "• Bản chất & phân loại: …\n• Cơ chế tác động: …\n• Công dụng & đối tượng: …\n• Cây trồng áp dụng: …\n• Lưu ý & không dùng khi: …",
  "usage": {
    "dose_amount": 50, "dose_unit": "g", "water_liters": 16,
    "dose_text": "50 g / bình 16 lít",
    "spray_volume_per_ha": { "min": 400, "max": 600 },
    "method": "phun ướt đều 2 mặt lá",
    "time_of_day": ["sáng sớm", "chiều mát"],
    "times_per_day": 1,
    "interval_days": { "min": 7, "max": 10 },
    "max_applications_per_season": 3,
    "start_when": "khi bệnh chớm xuất hiện",
    "stop_when": "",
    "weather_note": "không phun khi sắp mưa",
    "avoid_rain_hours": 6,
    "safety_note": "mang găng tay, khẩu trang"
  },
  "phi_days": 7,
  "target_diseases": ["MÃ_BỆNH"],
  "source_urls": ["https://…"],
  "image_candidates": ["https://….jpg"]
}
```
Sau khối JSON, Gemini liệt kê nguồn dạng markdown (mục 3.3).

### 4.2. `Products.UsageProfile` (lưu)
Giống `usage` ở trên + `"version": 1` và `"source_url"` (link Admin đã chọn). Trường nào không biết thì `null`.

Thiết kế để dùng được cho lịch phun về sau: các con số tách riêng (`interval_days`, `max_applications_per_season`, `times_per_day`, `time_of_day`, `avoid_rain_hours`). Text chỉ để hiển thị.

---

## 5. NGOÀI PHẠM VI (task sau: lịch phun và nhắc nhở, cách B bản đầy đủ)

> Thiết kế chi tiết, bảng dữ liệu, bộ lập lịch và **lộ trình nâng cấp từ bản nhẹ**: [docs/architecture/treatment-schedule-design.md](../../docs/architecture/treatment-schedule-design.md). Tóm tắt:
- Phiếu cách dùng theo **từng cây / bệnh** (bảng `ProductUsageRules`), có trạng thái "đã kiểm duyệt"; lịch chỉ dùng phiếu đã duyệt.
- Kế hoạch điều trị cho từng ca (`TreatmentPlans`, `PlanTasks`: ngày, buổi, việc, sản phẩm, liều, ghi chú, trạng thái).
- Bộ lập lịch bằng code: cộng ngày, dừng đúng số lần, chặn theo PHI so với ngày thu hoạch, luân phiên thuốc khác nhóm tác động (chống kháng thuốc), xen biện pháp canh tác.
- Dời lịch theo dự báo mưa (công cụ `check_weather_risk` sẵn có).
- Nhắc nhở (thông báo trong app / web push / Zalo-SMS), bấm "Đã làm", bỏ lỡ thì tự dời; nhắc chụp ảnh lại để theo dõi, nặng hơn thì chuyển chuyên gia.
- Agent có công cụ tạo lịch; AI chỉ viết lời nhắc, không quyết định ngày / liều.

---

## 6. TIÊU CHÍ HOÀN THÀNH
- Bấm "Tạo SP" ở hàng mở modal trích dẫn; đoạn nằm trọn trong đoạn khác của cùng bài không hiện lặp.
- Form chỉ còn 1 nút AI (Dev) + chip Tra Google.
- Prompt có đoạn trích, yêu cầu nguồn Việt Nam, mẫu `usage`, quy tắc không đoán số, yêu cầu danh sách nguồn + ảnh dưới JSON.
- Dán câu trả lời Gemini (JSON + danh sách nguồn) → điền Mô tả, khối Cách dùng, Hướng dẫn sử dụng ghép theo nhãn, PHI, bệnh hại (gộp), link và ảnh để chọn.
- Lưu → `UsageProfile` có trong DB; mở sửa thấy lại đúng; sản phẩm cũ (null) mở / lưu bình thường.
- Trợ lý Lavi (sản phẩm đã bật lưu hành, đã gắn bệnh) trả lời được liều và khoảng cách phun lấy từ hướng dẫn; chốt chặn liều lượng không xóa các con số đó.

## 7. KIỂM THỬ DỰ KIẾN
- Script thư viện: gộp đoạn nằm trọn trong đoạn khác; prompt có `usage`, không có `healthy`; đọc JSON có danh sách nguồn phía sau; ghép text theo nhãn với trường null bị bỏ dòng.
- Thử thật với Gemini bản web: 1 thuốc hóa học, 1 chế phẩm sinh học (nấm đối kháng / Trichoderma), 1 chế phẩm tự pha (tỏi), 1 vật tư (vôi bột). Ghi lại JSON nào sai định dạng để chỉnh prompt.
- Playwright DB local: luồng Tạo SP từ hàng → modal → form → dán JSON → lưu → mở sửa.
- Core: POST / PATCH với `usage_profile` hợp lệ, sai (`min > max`, số âm), null.
- Agent: hỏi trợ lý về bệnh đã gắn sản phẩm mẫu, kiểm tra câu trả lời giữ được liều / khoảng cách phun.

## 8. RỦI RO / CÂU HỎI MỞ
- Gemini có thể trả liều theo cây khác với cây trong bài; prompt phải yêu cầu ghi rõ liều áp dụng cho cây nào. Bản nhẹ lưu 1 phiếu / sản phẩm; liều theo từng cây để task lịch phun.
- Mô tả dài làm prompt của trợ lý dài hơn khi kho có nhiều sản phẩm cùng bệnh; theo dõi độ dài, cần thì Core cắt phần mô tả khi trả cho agent.
- Nên nhắc Admin bật "Được phép lưu hành" sau khi đối chiếu nguồn, nếu không trợ lý không thấy sản phẩm.

---

## 9. KẾT QUẢ (17/11/2026)

### 9.1. Đã làm
| Nơi | Thay đổi |
|---|---|
| `Lavitree.Domain/Entities/UsageProfile.cs` | Kiểu phiếu cách dùng + `NumberRange`, `Normalize()` (cắt khoảng trắng, chuỗi rỗng → null, bỏ buổi trùng), `IsEmpty`, `Validate()` (giới hạn hợp lý, `min ≤ max`, link http(s)). |
| `Product.UsageProfile` + `LavitreeDbContext` | Cột `jsonb` null được, chuyển đổi System.Text.Json, so sánh theo nội dung. Migration `20261116192621_AddProductUsageProfile` (chỉ `AddColumn`). |
| `MedicinesController` | `POST` / `PATCH` nhận `usage_profile` (PATCH: null giữ nguyên, `{}` xóa), lỗi trả `400` kèm lý do; `GET /search`, response POST / PATCH trả `usage_profile`. Agent không đổi (Pydantic bỏ qua trường lạ). |
| `features/admin/lib/usage-profile.ts` | Kiểu TS, `normalizeUsageProfile` (đọc số dạng chuỗi, khoảng "7–10 ngày"), `formatUsageText` theo nhãn cố định `USAGE_LABELS`, `usageProfileForApi`. |
| `features/admin/lib/product-research.ts` | `dedupeContainedTexts` (bỏ đoạn nằm trọn trong đoạn khác), gộp theo bài dùng hàm này; prompt Gemini mới (nguồn Việt Nam, bám đoạn trích, `usage`, `image_candidates`, danh sách nguồn + ảnh sau JSON, không đoán số); đọc câu trả lời lấy link / ảnh cả trong JSON lẫn danh sách phía sau; bỏ `buildLinkSearchPrompt`. |
| `features/admin/components/UsageProfileEditor.tsx` | Khối "Cách dùng" (các ô số, khoảng "7-10", buổi, thời tiết, an toàn) + nút "Ghép vào Hướng dẫn sử dụng". |
| `pages/admin/AdminInventoryPage.tsx` | "Tạo SP" ở hàng mở modal trích dẫn; modal ẩn đoạn nằm trong đoạn khác, đếm lại số đoạn; bỏ nút "Tìm link với AI", chỉ còn "Sao chép prompt cho Gemini" (Dev); nạp câu trả lời điền phiếu + ghép "Hướng dẫn sử dụng" + ảnh đề xuất (bấm để dùng, ảnh lỗi tự ẩn); ô Hướng dẫn sử dụng thành ô nhiều dòng; gửi / nạp `usage_profile` khi tạo / sửa. |
| Tài liệu | `docs/architecture/treatment-schedule-design.md` (bản đầy đủ + lộ trình), `database-schema.md`, `api-contracts.md`, `docs/spec/features.md` (FEAT-06 nhánh 3). |

### 9.2. Kiểm thử
- Script thư viện (esbuild): 17/17 ca mới PASS (đoạn nằm trong đoạn khác, prompt mới, đọc câu trả lời có danh sách nguồn + ảnh, chuẩn hóa phiếu, ghép text theo nhãn, liều chữ không lặp số, phiếu rỗng → null); 23/23 ca TASK-17 vẫn PASS.
- API trên Core local + DB local: 7/7 PASS (POST chuẩn hóa phiếu; GET search trả phiếu; PATCH sai `min > max` và `times_per_day = 0` → 400 kèm lý do; PATCH không gửi phiếu giữ nguyên; link nguồn `javascript:` → 400; PATCH `{}` xóa phiếu; sản phẩm không có phiếu tạo bình thường). Migration chạy lúc khởi động, có cột `UsageProfile jsonb`.
- Playwright DB local, dữ liệu thử "Nấm T18TEST" (2 đoạn cùng bài, đoạn 2 nằm trong đoạn 1): "Tạo SP" ở hàng → modal "1 đoạn trích · 1 bài"; form không còn nút tìm link, nút duy nhất "Sao chép prompt cho Gemini (1 bài trích)"; dán câu trả lời (JSON + nguồn + ảnh) → phiếu điền đúng (Cách nhau 15-20, liều 1 kg, PHI 0), "Hướng dẫn sử dụng" 8 dòng theo nhãn, link nguồn tự điền; lưu → DB có `UsageProfile` (`interval_days` 15–20, tối đa 3 lần); mở sửa thấy lại phiếu. Đã xóa dữ liệu thử.
- `tsc --noEmit` exit 0, `dotnet build` và `npm run build` thành công.

### 9.3. Còn lại
- Chưa thử với câu trả lời thật của Gemini (cần 3–5 vật tư: thuốc hóa học, chế phẩm sinh học, chế phẩm tự pha, vật tư).
- Migration sẽ chạy trên DB dùng chung ở lần deploy Core tiếp theo (`MigrateAsync` lúc khởi động); chỉ thêm 1 cột null được.
- Sản phẩm đã có trong kho chưa có phiếu (null); cần nhập dần qua form sửa.

### 9.4. Chỉnh sau câu trả lời Gemini thật (17/11/2026)
Thử với "Phân hữu cơ hoai mục" (SUPPLY): đúng định dạng, xác định đúng loại, không bịa khoảng cách ngày / số lần. Ba lỗi đã sửa:

| Lỗi | Sửa |
|---|---|
| Gemini tự điền "sáng sớm, chiều mát, 1 lần/ngày" cho việc bón phân theo đợt (bộ lập lịch sẽ hiểu là bón hằng ngày) | Prompt: chỉ điền buổi / số lần khi nguồn ghi rõ; bón lót, bón thúc, rắc theo đợt → `times_per_day: null`. Khối Cách dùng có ghi chú tương tự. |
| "20–30 tấn/ha" chỉ nằm trong chữ, phiếu không có chỗ lưu liều theo diện tích | Thêm `dose_per_area {min, max, unit}` (C# `AreaDose`, TS `toAreaDose` đọc được chuỗi "20-30 tấn/ha"), bắt buộc có đơn vị; ô "Liều theo diện tích" + "Đơn vị diện tích" trong form; dòng "Liều lượng" ghép thêm, không lặp khi chữ đã có số. Gộp vào phiếu version 1 vì chưa có dữ liệu nào được lưu. |
| Mô tả vật tư viết "đối tượng phòng trừ … đốm vòng" (phóng đại) | Prompt: SUPPLY / PRACTICE chỉ viết "hỗ trợ / giảm nguy cơ / phòng ngừa", không viết "phòng trừ / trị / diệt" trừ khi nguồn ghi rõ. |

Kiểm thử: thư viện 21/21 PASS (thêm: đọc "20-30 tấn/ha", "50 kg/1000 m²", số không đơn vị → null; ghép liều diện tích không lặp; prompt có các quy tắc mới); API 10/10 PASS (thêm: lưu `dose_per_area`, thiếu đơn vị → 400, `min > max` → 400); Playwright luồng Tạo SP → lưu → mở sửa vẫn đúng; `tsc` exit 0.

### 9.5. Tìm đúng loại vật tư, trích nguyên văn nguồn (17/11/2026)
Thử "phân hữu cơ hoai mục": Gemini dẫn trang Khuyến nông Quốc gia (2012) cho liều "14–20 tấn/ha". Mở trang thì thấy chỉ ghi "Phân hữu cơ khoảng 20 tấn/ha" (không nói "hoai mục", bài năm 2012, tiêu đề mục ghi "cho 1.000 m²" nhưng số ghi "tấn/ha"); con số 14–20 lấy từ một bài về phân NPK. Tức là AI lấy số liệu của loại vật tư rộng hơn.

| Sửa | Chi tiết |
|---|---|
| `keyMentionSentences` | Lấy tối đa 3 câu trong đoạn trích có nhắc tên vật tư, đưa vào prompt mục **1b "Bài báo mô tả vật tư này như sau (tìm ĐÚNG loại này, KHÔNG tìm loại rộng hơn)"**. |
| Nhiệm vụ 2 của prompt | Tìm đúng loại cụ thể nhất; nguồn nói về loại rộng hơn / khác thì không lấy số liệu, nếu buộc dùng phải ghi `scope_note`. `name` phải là tên cụ thể, không dùng tên nhóm chung. |
| "Nguồn đã dùng" | Mỗi dòng có năm đăng và **câu trích nguyên văn** chứa con số đã dùng; con số không trích được thì để null. |
| `scope_note` | Trường JSON mới; form hiện cảnh báo "Lưu ý số liệu: …" khi có nội dung (nguồn loại rộng hơn, quá cũ trước 2015, đơn vị mâu thuẫn). |

**Sự cố trong lúc làm:** bản làm việc của `AdminInventoryPage.tsx` bị ghi đè bằng nội dung trước TASK-18 (lúc 03:16, có định dạng lại kiểu "format on save", khả năng do tab VS Code còn giữ nội dung cũ rồi được lưu). Đã khôi phục từ bản đã stage, giữ lại chỉnh của người dùng (ô hoạt chất khóa `text-muted-foreground/60 italic`); bản bị ghi đè được sao lưu ở scratchpad. Các sửa làm mờ placeholder (`input.tsx`, `textarea.tsx`, `globals.css`) là của người dùng, giữ nguyên, không gộp vào commit TASK-18.

Kiểm thử: thư viện 24/24 PASS (thêm: câu then chốt chỉ lấy câu có tên vật tư và bỏ Markdown; prompt có mục 1b, cấm loại rộng hơn, bắt trích nguyên văn + năm, có `scope_note`; không có đoạn trích thì không có mục 1b); 23/23 ca TASK-17 PASS; Playwright luồng Tạo SP → lưu → mở sửa đúng sau khi khôi phục; `tsc` exit 0, `npm run build` thành công.

### 9.6. Nút "Kiểm tra trích dẫn" (17/11/2026)
Gemini bản web "trích nguyên văn" câu không có trên trang (trang Khuyến nông ghi "Phân hữu cơ khoảng 20 tấn/ha", Gemini trích "Bón phân: Lượng bón cho 1 ha: Phân chuồng 15 - 20 tấn"). Chỉ chỉnh prompt không chặn được, nên kiểm tra phía server.

| Nơi | Thay đổi |
|---|---|
| `KnowledgeController` | Tách phần tải trang an toàn của `fetch-url` thành `FetchPublicHtmlAsync` (hành vi giữ nguyên). Thêm `POST /knowledge/verify-quotes` (Admin, ≤ 8 câu / 5 link, tải song song). |
| `Infrastructure/Services/QuoteMatcher.cs` | HTML → chữ; bỏ dấu; khớp nguyên văn theo dãy từ (`FOUND`), cửa sổ trượt đếm từ trùng (`PARTIAL` ≥ 80%); con số trong câu trích phải có ở đoạn trang gần câu trích nhất (±15 từ); trả đoạn trang thật để so. |
| `product-research.ts` | `extractSourceQuotes`: đọc câu trong ngoặc kép (" " hoặc “ ”) trên các dòng có link ở phần "Nguồn đã dùng". |
| `components/QuoteCheckPanel.tsx` + `AdminInventoryPage.tsx` | Dưới "Link nguồn AI đề xuất": danh sách link + câu trích, nút **Kiểm tra trích dẫn**, kết quả ✅ / ⚠️ / ❌, "Con số không có trong trang", "Trang thật ghi: …". |

Kiểm thử: thư viện 26/26 PASS (thêm đọc câu trích từ câu trả lời thật, link dạng markdown, ngoặc “ ”). API trên Core local với **trang thật**: câu bịa → `NOT_FOUND` + `missing_numbers ["15"]`; câu thật → `FOUND`; câu viết lại → `PARTIAL` 0.91; `http://127.0.0.1:5000/health` → `INVALID_URL`; không câu trích → `NO_QUOTE`; 9 mục → 400; không đăng nhập → 401/403 (~0,4 giây / lần). Sửa lỗi phát hiện khi test: con số ban đầu so với cả trang ("15" có ở chỗ khác nên không báo), đổi sang so với đoạn gần câu trích. `fetch-url` sau khi tách hàm: trang thật 200, localhost 400. Playwright: dán câu trả lời thật → toast `scope_note`, "2 câu trích", bấm kiểm tra → cả 2 câu "KHÔNG có trong trang", trang Vinachem thật ghi "Bón lót: phân chuồng 14 -20 tấn/ha".

### 9.7. Thông báo gọn + kiểm tra ưu tiên con số (17/11/2026)
Người dùng báo: toast dài, khó hiểu; "Kiểm tra trích dẫn" liên tục báo sai. Thử thật trên Chrome (web `:3000` + Gemini bản web) tìm ra nguyên nhân:

1. Web `:3000` chuyển `/api` tới Core theo `CORE_API_URL`; Core đó **chưa có** `verify-quotes` → `404`, form chỉ hiện "Không tìm thấy dữ liệu". Cần deploy Core bản mới; trên Core local cùng câu trả lời → `FOUND`.
2. Gemini viết lại câu (gộp câu, thêm "Lượng bón:"), nên câu không nguyên văn dù con số đúng.
3. Trang ghi "m²", Gemini chép "m2" → chỉ `PARTIAL`.

| Nơi | Thay đổi |
|---|---|
| `QuoteCheckPanel.tsx` | Bỏ toast. Nhãn ngắn `describeResult`: "Đúng nguyên văn"; "Số liệu có trong trang (câu được viết lại)" khi mọi con số có ở đoạn gần đó và khớp ≥ 50% từ; "Trang không ghi số X" (đỏ); "Gần đúng" / "Không thấy câu này" (vàng). Một dòng tổng kết "a/b khớp trang nguồn". `404` → "Server đang chạy chưa có chức năng này (cần Core API bản mới)". |
| `AdminInventoryPage.tsx` | "Điền form từ Gemini" chỉ còn 1 toast một dòng ("Đã điền form · +1 bệnh · 6 link · 1 lưu ý, xem dưới ô link"). `scope_note`, loại vật tư (tự pha / biện pháp / giống), `differ_note`, bệnh chưa khớp hiện trong khung vàng "Lưu ý từ Gemini" dưới ô link. Ô mô tả 1000 → 3500 ký tự (`DESCRIPTION_MAX`; prompt đòi 250–450 từ, mô tả lưu trong cột `text`). |
| `product-research.ts` (prompt) | Bắt dùng Google Search; không tìm được web thì ghi "KHÔNG TÌM ĐƯỢC WEB" vào `scope_note`, số để null. "Nguồn đã dùng": đoạn **copy nguyên văn 5–20 chữ** có chứa con số, không viết lại / gộp câu / đổi đơn vị, mỗi đoạn một dòng. |
| `QuoteMatcher.cs` | Tách chữ và số thành từ riêng (`m2` = `m 2`), chuẩn hóa `FormKD` (`²` → `2`). |

Kiểm thử thật: prompt mới với Gemini (Hydrogen, phân hữu cơ hoai mục) → 6 đoạn trích ngắn có số; Core local: 5/5 trang HTML `FOUND` (trước khi sửa `m²`: 4 `FOUND` + 1 `PARTIAL`), 1 PDF `FETCH_FAILED`. Hồi quy `t18_verify.mjs` ALL PASS (câu bịa vẫn `NOT_FOUND` + thiếu "15"). `describeResult` 6/6 PASS, thư viện ALL PASS, `tsc` 0, `npm run build` thành công. Trên `:3000`: toast một dòng, khung "Lưu ý từ Gemini", lỗi 404 báo rõ. Ghi nhận: Gemini chế độ khác có lần không tìm web (tự ghi vào `scope_note`, số để null).
