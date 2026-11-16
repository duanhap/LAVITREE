# 📅 THIẾT KẾ LỊCH PHUN & NHẮC NHỞ (TREATMENT SCHEDULE) — BẢN ĐẦY ĐỦ
<!-- Thiết kế cho FEAT-06 (docs/spec/features.md). Bản nhẹ đã làm ở TASK-18; tài liệu này là đích đến và lộ trình nâng cấp. -->

## 1. Mục tiêu

Nông dân chẩn đoán ra bệnh → bấm "Lên lịch" → nhận **thời khóa biểu** từng ngày: buổi nào, làm gì, dùng sản phẩm nào, liều bao nhiêu, ghi chú; đến ngày thì được **nhắc**, làm xong bấm "Đã làm".

Ví dụ (còn 30 ngày nữa thu hoạch, mốc sương cà chua):

| Ngày | Buổi | Việc | Ghi chú |
|---|---|---|---|
| 17/11 | Sáng sớm | Phun Ridomil Gold, 50 g / bình 16 lít | Ướt đều 2 mặt lá, không phun khi sắp mưa |
| 24/11 | Chiều mát | Phun lần 2 (luân phiên thuốc gốc đồng) | Nếu trời còn ẩm |
| 01/12 | Sáng sớm | Phun lần 3 (lần cuối) | Tối đa 3 lần / vụ |
| 02/12 → 08/12 | — | Không phun thuốc | Thời gian cách ly 7 ngày |
| 09/12 | — | Được thu hoạch | |

**Nguyên tắc:** ngày, liều, số lần do **code** tính từ dữ liệu đã duyệt. AI chỉ viết lời nhắc dễ hiểu, không quyết định con số.

---

## 2. Đã có (TASK-18, bản nhẹ)

| Thành phần | Vị trí | Dùng lại ở bản đầy đủ |
|---|---|---|
| Kiểu `UsageProfile` (liều theo bình, liều theo diện tích `dose_per_area` cho phân / vôi / chế phẩm rắc, lượng nước, cách dùng, buổi, số lần / ngày, khoảng cách ngày min–max, tối đa lần / vụ, bắt đầu / ngừng khi, thời tiết, số giờ tránh mưa, an toàn, link nguồn) | `backend/core-api/src/Lavitree.Domain/Entities/UsageProfile.cs`; TS: `frontend/web/src/features/admin/lib/usage-profile.ts` | Giữ nguyên làm nội dung mỗi "phiếu" (rule) |
| Cột `Products.UsageProfile` (jsonb, null được) | migration `20261116192621_AddProductUsageProfile` | Thành **phiếu mặc định** của sản phẩm (áp dụng mọi cây / bệnh) |
| `Products.PhiDays` | có từ trước | Nguồn duy nhất của thời gian cách ly (không lặp trong phiếu) |
| `UsageProfile.Normalize()` / `Validate()` | Domain | Dùng chung cho API phiếu theo cây / bệnh |
| Text "Hướng dẫn sử dụng" ghép theo nhãn cố định (`USAGE_LABELS`) | `usage-profile.ts` | Trợ lý Lavi đọc ngay; dùng để chuyển dữ liệu cũ nếu cần |
| Prompt Gemini trả `usage` có cấu trúc | `product-research.ts` | Dùng tiếp để nhập phiếu theo cây / bệnh |
| Kiểm tra thời tiết | agent tool `check_weather_risk` | Dời lịch khi dự báo mưa |
| Bảng `TreatmentPlans` | có từ trước | **Khác mục đích**: là các bước hướng dẫn IPM chung theo bệnh, không phải lịch của từng nông dân. Lịch cá nhân dùng tên `CareSchedules` để không nhầm. |

---

## 3. Bản đầy đủ: dữ liệu

### 3.1. `ProductUsageRules` — phiếu cách dùng theo cây / bệnh, có duyệt
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `Id` | SERIAL PK | |
| `ProductId` | FK → Products | |
| `DiseaseId` | FK → Diseases, NULL | NULL = mọi bệnh |
| `PlantName` | VARCHAR(100), NULL | NULL = mọi cây (liều có thể khác theo cây) |
| `Profile` | jsonb | **Đúng kiểu `UsageProfile`** |
| `ActionGroup` | VARCHAR(20), NULL | Nhóm tác động (FRAC / IRAC) để luân phiên thuốc chống kháng |
| `IsVerified` | BOOLEAN | Chỉ phiếu đã duyệt mới được dùng để lập lịch |
| `VerifiedBy`, `VerifiedAt` | | Admin / kỹ sư duyệt |
| `SourceUrl` | VARCHAR(500) | |

Chọn phiếu khi lập lịch: (sản phẩm + bệnh + cây) → (sản phẩm + bệnh) → (sản phẩm + cây) → phiếu mặc định `Products.UsageProfile` (chỉ khi sản phẩm `IsAllowed`).

### 3.2. `CareSchedules` — lịch của một ca
| Cột | Ghi chú |
|---|---|
| `Id`, `UserId`, `DiagnosisRecordId` (NULL được) | |
| `ModelClass` / `DiseaseId`, `PlantName` | |
| `StartDate`, `ExpectedHarvestDate` (NULL được) | |
| `Status` | `ACTIVE` / `COMPLETED` / `CANCELLED` / `ESCALATED` |
| `CreatedBy` | `AGENT` / `USER` / `EXPERT` |

### 3.3. `CareTasks` — từng việc trong lịch
| Cột | Ghi chú |
|---|---|
| `Id`, `ScheduleId` | |
| `DueDate`, `TimeOfDay` (`sáng sớm` / `chiều mát`…) | |
| `Type` | `SPRAY` / `APPLY` / `PRACTICE` (tỉa lá, vệ sinh) / `CHECK_PHOTO` / `PHI_WAIT` / `HARVEST_OK` |
| `ProductId` (NULL được), `UsageRuleId` (NULL được), `DoseText` | chụp lại liều lúc tạo lịch, không đổi khi phiếu sửa sau |
| `Note` | lời nhắc do AI viết |
| `Status` | `PENDING` / `DONE` / `SKIPPED` / `MISSED` / `RESCHEDULED` |
| `DoneAt`, `RescheduledFrom` | |

### 3.4. `Notifications` (nếu chưa có)
`UserId`, `TaskId`, `Channel` (`IN_APP` / `WEB_PUSH` / `ZALO` / `SMS`), `SendAt`, `SentAt`, `Status`.

---

## 4. Bản đầy đủ: bộ lập lịch (code, không phải AI)

Đầu vào: bệnh, cây, ngày bắt đầu, ngày thu hoạch dự kiến, danh sách sản phẩm đã lọc bởi guardrail hiện có (`pre_filter_medicines`: thuốc cấm, PHI so với số ngày còn lại).

1. Chọn phiếu (mục 3.1). Thiếu `interval_days` hoặc `max_applications_per_season` → không tự lập lịch thuốc đó, chỉ ghi "theo nhãn", gợi ý hỏi kỹ sư.
2. Lần 1: ngày bắt đầu (hoặc khi đạt `start_when` nếu có điều kiện), buổi = `time_of_day[0]`.
3. Lần k+1 = lần k + `interval_days.min` (lấy min để bảo vệ cây; max dùng làm hạn chót nhắc lại).
4. Dừng khi đủ `max_applications_per_season` **hoặc** lần kế tiếp + `PhiDays` > ngày thu hoạch (không bao giờ phun trong thời gian cách ly).
5. Luân phiên: hai lần liên tiếp không cùng `ActionGroup` nếu có sản phẩm thay thế.
6. Xen việc canh tác từ `TreatmentPlans` (bước IPM) và việc `CHECK_PHOTO` sau lần phun thứ 2.
7. Thêm `PHI_WAIT` (từ lần phun cuối đến hết cách ly) và `HARVEST_OK`.
8. Thời tiết (chạy hằng ngày): nếu dự báo mưa trong `avoid_rain_hours` sau giờ phun → dời việc sang ngày khô gần nhất, vẫn giữ ràng buộc ở bước 4.

Hàm thuần (dễ unit test): `Plan(rules, phiDays, startDate, harvestDate, weather?) → CareTask[]`, đặt ở `Lavitree.Application`.

---

## 5. Bản đầy đủ: nhắc nhở và theo dõi
- Job định kỳ (Hangfire / Quartz / BackgroundService) quét `CareTasks` đến hạn → tạo `Notifications`.
- Nông dân bấm "Đã làm" / "Bỏ qua". Quá hạn chưa làm → `MISSED`, các lần sau tự dời theo `interval_days`.
- Sau lần 2: nhắc chụp ảnh lại; dùng luồng chẩn đoán hiện có so tiến triển (FEAT-06 nhánh 1). Nặng hơn → chuyển kỹ sư (luồng Escalation hiện có), đổi `Status = ESCALATED`.

## 6. Bản đầy đủ: agent và giao diện
- Tool MCP mới `create_care_schedule(disease_code, plant, harvest_days_left)` gọi Core để lập lịch; AI viết `Note` cho từng việc; câu trả lời dẫn tới trang lịch.
- Web / Android: trang "Lịch chăm sóc" (danh sách theo ngày, nút Đã làm), thông báo.
- Admin: tab "Phiếu cách dùng" trong Kho vật tư: phiếu theo cây / bệnh, nút "Duyệt".

---

## 7. Lộ trình nâng cấp từ bản nhẹ (đã tính để sửa ít)

| Bước | Việc | Ghi chú |
|---|---|---|
| 1 | Migration tạo `ProductUsageRules`; **sao chép** mỗi `Products.UsageProfile` khác null thành 1 phiếu (`DiseaseId = NULL`, `PlantName = NULL`, `IsVerified = Products.IsAllowed`) | Không xóa cột cũ; cột cũ vẫn là phiếu mặc định |
| 2 | API phiếu: `GET/POST/PATCH /medicines/{id}/usage-rules`, `POST .../verify`; dùng lại `UsageProfile.Normalize()/Validate()` | |
| 3 | Admin: khối "Cách dùng" hiện có (`UsageProfileEditor`) dùng lại cho từng phiếu, thêm chọn cây / bệnh | Component nhận `value/onChange` nên dùng lại được |
| 4 | `CareSchedules`, `CareTasks`, hàm `Plan(...)` + unit test | |
| 5 | Tool agent `create_care_schedule`, trang Lịch chăm sóc | |
| 6 | Job nhắc nhở + kênh thông báo, dời lịch theo thời tiết | Cần chọn kênh (in-app trước, Zalo / SMS sau) |

**Quy ước để giữ đường nâng cấp:**
- Không đổi tên trường JSON trong `UsageProfile`; muốn thêm trường thì thêm mới và tăng `version`.
- Không đổi nhãn trong `USAGE_LABELS` (text "Hướng dẫn sử dụng" đã lưu dựa vào nhãn).
- `PhiDays` chỉ ở `Products`, không thêm vào phiếu.
