## TASK-05 chưa đạt, chưa nên đánh `DONE`
Test của B đúng là pass 9/9 khi mình chạy lại, nhưng **Core API không hề chạy**, nên kết quả này không chứng minh được tool lấy dữ liệu thật. Lỗi lớn nhất: khi Core hỏng, tool vẫn trả dữ liệu giả như bình thường.

Mình chỉ review, không sửa file nào của B. Toàn bộ code của B đang chưa commit.

## 🔴 Phải sửa trước khi nghiệm thu
**1. Core lỗi thì trả danh mục thuốc viết cứng** ([client.py:137-139](backend/agent-service/app/mcp/client.py#L137-L139))
- Core tắt hoặc trả 500/503: tool vẫn trả 4 thuốc kèm giá và tồn kho, chỉ có thêm cờ `is_fallback`.
- Danh mục giả này không lọc theo bệnh: hỏi gỉ sắt ngô vẫn ra Ridomil, bệnh không tồn tại vẫn ra 4 thuốc.
- Core vừa bỏ fallback ở production (BUG-09), và router ngoại tuyến của TASK-07 có thể không nhận ra sự cố vì tool không báo lỗi.

**2. Thời tiết giả có thể khiến nông dân phun thuốc lúc trời mưa** ([client.py:318-321](backend/agent-service/app/mcp/client.py#L318-L321))
- Core tắt: Đà Lạt và Hà Nội đều báo "khô ráo, rủi ro LOW"; riêng Hà Nam luôn báo mưa.
- Kết quả giả còn bị lưu 1 giờ: mình giả lập Core sống lại và đang mưa, tool vẫn báo khô và không gọi Core lần nào. Core chỉ cho lưu dữ liệu giả 1 phút.

**3. Bằng chứng nghiệm thu không đúng**
- Log ghi `Could not connect to Core API`, và nhiệt độ 24.0°C chính là số viết cứng ở [client.py:68](backend/agent-service/app/mcp/client.py#L68).
- [test_mcp_tools.py:149-150](backend/agent-service/test_mcp_tools.py#L149-L150) chỉ kiểm tra có tên thuốc mà danh mục giả luôn có.
- Test Read-Only ([dòng 252](backend/agent-service/test_mcp_tools.py#L252)) chỉ dò từ khoá trong phần mô tả tool.
- Cần trả TASK-05 trong `TODO.md` và ticket về `IN PROGRESS`.

## 🟠 Lỗi nghiêm trọng
| # | Lỗi | Kết quả kiểm tra | Cách sửa |
|---|---|---|---|
| 4 | [tools.py:54](backend/agent-service/app/mcp/tools.py#L54) cắt tài liệu còn 220 ký tự, nên AI có thể mất liều lượng | 22/22 bài bị cắt, độ dài trung vị 506 ký tự | Thêm trường chứa toàn văn cho AI |
| 5 | B tự thêm `allowed_only` ngoài ticket, AI có thể đặt `false` ([schema.py:130](backend/agent-service/app/mcp/schema.py#L130)) | Lấy được Paraquat; thuốc cấm từ Core cũng không bị lọc lại | Bỏ tham số, luôn lọc ở client |
| 6 | Thiếu dữ liệu thì tự coi là an toàn ([client.py:118-119](backend/agent-service/app/mcp/client.py#L118-L119)) | Thiếu trường thì thành `is_allowed=true`, `phi_days=7` | Bắt buộc có 2 trường này, thiếu thì báo lỗi |
| 7 | `forecast_hours` bị bỏ qua, Core cũng chỉ lấy thời tiết hiện tại ([WeatherService.cs:106](backend/core-api/src/Lavitree.Infrastructure/Services/WeatherService.cs#L106)) | Tham số không được gửi tới Core, nên chưa trả lời đúng "chiều nay có mưa không" | A đổi sang API dự báo, B truyền tham số |
| 8 | `/api/v1/mcp/*` không cần khoá ([main.py:45](backend/agent-service/app/main.py#L45)) | Không có khoá vẫn trả 200; nginx và port chỉ mở localhost nên hiện chỉ gọi được từ nội bộ | Gắn `check_internal_auth` khi `include_router` |
| 9 | Khoá OpenWeather lộ trong log, do log INFO của httpx in cả URL ([client.py:278](backend/agent-service/app/mcp/client.py#L278)) | Khoá giả xuất hiện trong log; hiện compose chưa truyền khoá này cho Agent | Xoá nhánh gọi trực tiếp, nhánh này cũng sai thiết kế |
| 10 | Input sai vẫn trả 200, lộ lỗi nội bộ ([server.py:87](backend/agent-service/app/mcp/server.py#L87)); lỗi có chữ "not found" thành 404 ([dòng 231](backend/agent-service/app/mcp/server.py#L231)) | Giả lập lỗi nội bộ: đường dẫn server lộ ra response | Trả 422/500 với thông báo chung, tìm tool trước khi gọi |
| 11 | Cache thời tiết không giới hạn và chồng lên cache của Core ([client.py:24](backend/agent-service/app/mcp/client.py#L24)) | 5.000 địa danh giữ cả 5.000 mục; dữ liệu có thể cũ tới khoảng 2 giờ | Xoá cache ở Agent |

**Lệch dữ liệu PHI:** [schema.py:171](backend/agent-service/app/mcp/schema.py#L171) giới hạn PHI ≤ 365, nhưng Paraquat trong seed là 999. Tool sẽ báo lỗi thay vì báo vi phạm, nên cần nới giới hạn hoặc đổi seed.

## Việc của A (Core, mới đọc code, chưa chạy)
- **Dễ bị spam (lỗ hổng DDoS):** `/api/v1/weather` và `/medicines/search` public, không rate limit, và request đi qua nginx được. Spam địa danh khác nhau sẽ đốt quota OpenWeather. [MedicinesController.cs:61-65](backend/core-api/src/Lavitree.Api/Controllers/MedicinesController.cs#L61-L65) còn tải cả bảng thuốc ở mỗi request.
- **Có thể lộ khoá OpenWeather:** khoá nằm trên URL, mà .NET 8 ở mức log Information thường in cả URL. Nên hạ `System.Net.Http.HttpClient` xuống `Warning`.
- **Thời tiết giả ở production:** thiếu khoá thì Core vẫn trả dữ liệu giả ([WeatherService.cs:80](backend/core-api/src/Lavitree.Infrastructure/Services/WeatherService.cs#L80)). Địa danh ngoài danh sách còn có thể đổi kết quả sau mỗi lần khởi động, vì `GetHashCode` của .NET không cố định ([dòng 169](backend/core-api/src/Lavitree.Infrastructure/Services/WeatherService.cs#L169)).
- **Hợp đồng API lệch code:** mục 3.4 ghi `id` là UUID nhưng code dùng `int`, và chưa có `is_fallback`. Nếu Core làm đúng theo tài liệu, client của B sẽ lỗi rồi lại trả danh mục giả.

## Phần B làm đúng
- `verify_phi_safety` đúng logic, kể cả ca biên `≤`.
- 4 tool thực sự chỉ đọc: toàn bộ mã MCP chỉ dùng `GET`, không truy vấn DB trực tiếp.
- Tên trường khớp với DTO của Core.
- RAG không trích dẫn nhầm bệnh khác.
- 4 khai báo tool được `google-genai` chấp nhận (mới kiểm tra định dạng, chưa gọi Gemini thật).

## Đề xuất cho B
1. **Xoá phần giả và phần thừa trong `client.py`:** danh mục thuốc giả, thời tiết giả, nhánh gọi OpenWeather trực tiếp và cache ở Agent. Riêng bước này xử lý được lỗi 1, 2, 9 và 11.
2. **Báo lỗi rõ khi Core hỏng:** để router của TASK-07 chuyển sang chế độ ngoại tuyến.
3. **Sửa các lỗi 4–8 và 10.**
4. **Viết lại test:** dùng Core giả để kiểm tra các ca 503, thiếu trường và thuốc cấm. Sau đó chạy một lần với Core và DB thật, kiểm tra `is_fallback=false` và `is_simulated=false`, rồi lưu log làm bằng chứng.

**Chưa kiểm chứng:** mình chưa chạy tool với Core và DB thật, nên phần này vẫn cần B làm ở bước 4.

**Lưu ý cho báo cáo đồ án:** đây là REST dispatcher, ticket cho phép, nhưng không phải giao thức MCP chuẩn. Vì vậy đừng ghi "chuẩn FastMCP".

Bạn muốn mình ghi phần này thành `doc/hint/sprint2_TVB_TASK05_assessment.md` để gửi B, hay mình sửa luôn như TASK-06?