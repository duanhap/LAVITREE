## TASK-07 chưa đạt, không nên để `DONE`
Bộ 6/6 test của B pass khi mình chạy lại, nhưng không chứng minh được hệ thống an toàn. Khi thử **Gemini thật**, với model mặc định của docker-compose, Agent không chạy xong được vòng ReAct nào có gọi tool. Mình chỉ review, không sửa file nào của B.

## 🔴 Phải sửa trước khi nghiệm thu
**1. Model 3.5 báo lỗi ngay khi gọi tool** ([react_agent.py:291-294](backend/agent-service/app/agent/react_agent.py#L291-L294))
- Code tự dựng lại `function_call` nên mất `thought_signature`. `gemini-3.5-flash-lite` trả `400 INVALID_ARGUMENT` ở cả 2/2 lần, và Agent âm thầm rơi về offline.
- **Cách sửa đã thử trên SDK:** trả nguyên `candidates[0].content`, rồi gộp mọi `function_response` vào một lượt `user`. Kết quả chạy đủ vòng 3/3 lần.

**2. Hậu kiểm không chặn được thuốc vi phạm PHI** ([guardrails.py:114](backend/agent-service/app/agent/guardrails.py#L114))

Mình cho Gemini giả trả lời sai để xem code có chặn không:

| Câu trả lời của AI | Còn tên thuốc | Có cảnh báo |
|---|---|---|
| Còn 2 ngày: "pha Ridomil 50g, phun ngay" | Có | **Không** |
| Còn 5 ngày, PHI 7: "phun thuốc hóa học Ridomil" | Có | **Không** |
| Còn 2 ngày: "hoạt chất Mancozeb liều 50g" | Có | **Không** |
| Đã gọi tool, AI vẫn bảo phun Ridomil | Có | Có, nhưng thuốc vẫn nằm trong câu trả lời |

Code chỉ dò từ "hóa học" khi còn ≤3 ngày, không đối chiếu tên thuốc với PHI. Câu cảnh báo `⛔ NGUY CƠ TỒN DƯ` trong ticket cũng không có trong code. Gemini thật có tự từ chối ở 2 lượt thử (L1, L9), nhưng đó là do model, không phải chốt chặn bằng code.

**3. Offline đưa phác đồ của cây khác** ([resilience.py:132-151](backend/agent-service/app/agent/resilience.py#L132-L151))
- "Cà phê gỉ sắt" và mã bệnh táo → phác đồ **gỉ sắt ngô**.
- "Khoai tây đốm vòng" → phác đồ **cà chua**.
- "Lúa đốm vi khuẩn" → phác đồ **ớt chuông**.

Với 30 ngày tới thu hoạch, cả 4 ca đều kèm thuốc hóa học và citation của bệnh khác.

**4. Citation offline bị viết tay, không lấy từ DB** ([export_offline_cache.py:21](backend/agent-service/scripts/export_offline_cache.py#L21))
- Script không đọc PostgreSQL như ticket yêu cầu, mà chỉ ghi một dict viết sẵn ra file.
- **4/5 citation có `source_id`, URL và tiêu đề không tồn tại trong seed**, dù vẫn gắn `is_verbatim=true`.
- Kiểm tra 4 URL đó: 2 trả 404, 1 lỗi kết nối, 1 trả 200 (chưa xác minh nội dung).
- Một số liên kết thuốc–bệnh không có trong seed của Core, ví dụ Target Spot → Score, Ngô → Trichoderma.
- Đây là nguồn trích dẫn tự tạo, rất rủi ro khi bảo vệ đồ án.

**5. Core lỗi nhưng không chuyển sang offline** ([react_agent.py:252-269](backend/agent-service/app/agent/react_agent.py#L252-L269))
- Khi Core sập, guardrail vẫn báo `PERMITTED`, "Tất cả thuốc đều đáp ứng an toàn PHI". Câu "trời không mưa, cứ phun" vẫn được giữ nguyên.
- Circuit Breaker cũng không bọc Weather API như ticket yêu cầu.

**6. Bộ test không bảo vệ được phần an toàn**

Mình cố ý phá code ngay trong bộ nhớ, và test vẫn pass cả 6/6:
- Bỏ hậu kiểm.
- Đưa cả danh sách thuốc chưa lọc cho AI.
- Tăng giới hạn vòng lặp lên 60.

Ngoài ra, các test ReAct không gọi Gemini thật lần nào. Ticket yêu cầu thuốc PHI=7 không được xuất hiện, nhưng test không kiểm tra điều đó, và chính câu trả lời mẫu của test có chữ Ridomil.

## 🟠 Lỗi nghiêm trọng
| Lỗi | Kết quả kiểm tra | Hướng sửa |
|---|---|---|
| Tin ô nhập số ngày hơn câu chat | Chat "2 ngày nữa thu hoạch", ô nhập 30 → vẫn đưa Ridomil kèm liều | Lấy số nhỏ hơn hoặc hỏi lại |
| Trả lời không có nguồn | Ridomil kèm liều lượng mà 0 citation; prompt chưa cập nhật từ 10/10 | Bắt buộc tra RAG, không có nguồn thì không nêu liều |
| Sót thuốc cấm ([guardrails.py:11](backend/agent-service/app/agent/guardrails.py#L11)) | Lọt `2.4-D` (đúng tên trong seed), Gramoxone, Pa-ra-quat; tên có Paraquat nhưng trống hoạt chất vẫn qua | Kiểm cả tên và hoạt chất, thêm tên thương mại |
| Thuốc hóa học PHI=0 khi không rõ ngày thu hoạch | Vẫn qua, ticket yêu cầu chặn toàn bộ | Xét thêm `medicine_type` |
| Nhãn HITL dò theo từ khoá ([guardrails.py:23](backend/agent-service/app/agent/guardrails.py#L23)) | 4/4 câu kê đơn Mancozeb, Aliette, Kasumin, Copper không có nhãn | Gắn nhãn cho mọi câu trả lời tư vấn |
| Cảnh báo tự mâu thuẫn | Còn 10 ngày: vừa khuyên Ridomil, vừa ghi "tuyệt đối KHÔNG PHUN" | Chỉ cảnh báo đúng thuốc bị chặn |
| Lỗi 500 ([react_agent.py:217](backend/agent-service/app/agent/react_agent.py#L217)) | Gemini trả `parts=None` → `TypeError` chưa được bắt, trái tiêu chí "không 500" | Xử lý phản hồi rỗng, chuyển offline |
| Không giới hạn số tool mỗi lượt | 5 lượt, mỗi lượt 50 lệnh → **250 lần gọi tool** | Giới hạn tổng số lần gọi |
| Không có timeout Gemini ([gemini_client.py:29](backend/agent-service/app/agent/gemini_client.py#L29)) | Code không đặt timeout, có nguy cơ treo luồng | Đặt 30 giây như `pipeline.py` |
| Viết cứng model ([gemini_client.py:9](backend/agent-service/app/agent/gemini_client.py#L9)) | Mặc định `gemini-2.5-flash`, có thể bị tắt sớm nhất 01/12/2026 | Dùng chung một mặc định với compose |
| Lỗi của một người làm cả hệ thống offline | 3 lỗi 400 → người dùng khác cũng bị offline 60 giây; HALF_OPEN cho qua không giới hạn | Không tính lỗi 4xx do input, chỉ cho 1 lượt thăm dò |
| `/api/v1/agent/run` không cần khoá | Trả 200 và lộ lỗi Gemini trong `reason`; endpoint chưa có trong hợp đồng | Thêm `check_internal_auth`, ẩn lỗi. nginx đang chặn nên hiện chỉ gọi được từ nội bộ |
| Bộ nhớ chat | Không giới hạn số phiên (đã thử 20.000); biết `conversation_id` là đọc được lịch sử | Giới hạn số phiên, gắn phiên với người dùng |
| Hết 5 vòng | Trả câu viết sẵn, bỏ dữ liệu đã thu thập, trái ticket | Gọi thêm một lượt để tổng hợp |

**Hai điểm cần biết thêm:**
- **`/api/v1/agent/chat` vẫn là bản giả:** còn 100 ngày vẫn báo mưa 20mm và bảo "KHÔNG PHUN". Đây là việc của TASK-08, nhưng nghĩa là người dùng web chưa đi vào ReAct.
- **Quota có thể làm hỏng buổi demo:** `gemini-2.5-flash` hết quota miễn phí theo ngày sau khoảng 20 lượt gọi, mà mỗi câu hỏi tốn 2–4 lượt. Lượt test này đã dùng hết quota model đó hôm nay.

## Phần B làm đúng
- Tiền lọc PHI đúng, kể cả ca biên và ca không rõ ngày thu hoạch.
- Vòng ReAct dừng đúng sau 5 lượt.
- STM giữ đúng 3 lượt và tự hủy theo TTL.
- Offline phản hồi rất nhanh, khoảng 0,5ms.
- Khoá Gemini không xuất hiện trong log.
- Gemini thật từ chối in system prompt.
- Hai bộ test cũ vẫn pass: MCP 9/9 (Core giả lập), RAG 11/11.

Lúc đầu mình nghi role `assistant` sẽ làm Gemini báo lỗi, nhưng thử thật thì lượt hỏi nối tiếp vẫn chạy và giữ được ngữ cảnh, nên đây không phải lỗi.

**Chưa kiểm chứng được:** thử prompt injection xin liều Paraquat và ca không rõ ngày thu hoạch trên Gemini thật bị 429 nên chưa có kết quả. Toàn bộ lượt này dùng Core giả, chưa chạy với Core thật.

## Thứ tự sửa đề xuất cho B
1. **Sửa vòng lặp Gemini (lỗi 1) và thêm timeout:** chưa sửa thì chưa test thật được gì.
2. **Viết lại hậu kiểm theo danh mục thuốc và PHI:** phát hiện vi phạm thì thay cả câu trả lời bằng phác đồ an toàn, không chỉ nối thêm cảnh báo.
3. **Làm lại offline:**
   - Xuất dữ liệu thật từ DB.
   - Bỏ dò từ khoá; không khớp đúng cây và bệnh thì chỉ trả khuyến cáo chung.
4. **Nối lỗi tool với offline và Circuit Breaker,** rồi xử lý các lỗi 🟠.
5. **Viết lại test:** phải phát hiện được 3 kiểu phá code ở trên, và có bài chạy với Gemini thật.

Ticket, `TODO.md` và `WORKLOG.md` đang ghi "hoàn thành 100%, chặn 100%", nên cần trả về `IN PROGRESS`.

Bạn muốn mình ghi phần này thành `doc/hint/Sprint2_task07_TVB_assessment.md` để gửi B, hay mình sửa luôn như TASK-06?

---

## Review lần 2 (08/11/2026): sau đợt sửa của B
B đã sửa đúng: giữ `candidate.content` và gộp `function_response`, trích dẫn offline lấy từ dữ liệu thật, lọc thuốc cấm theo cả tên, giới hạn phiên STM, thêm `check_internal_auth` cho `/api/v1/agent/run`.

Vẫn còn lỗi, đã sửa trực tiếp trong nhánh:
| Lỗi | Hậu quả |
|---|---|
| `HttpOptions(timeout=30.0)` tính theo mili giây | Gemini thật luôn hết giờ, Agent luôn trả lời offline |
| Cắt bớt `function_call` nhưng vẫn gửi nguyên lượt của model | Số lời gọi và số phản hồi lệch nhau, Gemini có thể báo lỗi 400 |
| `record_success()` sau mỗi lượt Gemini | Core sập nhưng Circuit Breaker không bao giờ mở, vẫn tốn quota |
| Hậu kiểm chỉ gỡ câu có tên thuốc, theo danh mục cố định | Sót "Pha 50g cho bình 16L", sót thuốc ngoài danh mục, gỡ nhầm thuốc còn đủ PHI |
| Không đọc được "2 ngày nữa là thu hoạch" | Ô nhập 30 ngày vẫn thắng câu chat, Ridomil lọt qua |
| Ghép các đoạn text bằng xuống dòng | Câu trả lời bị cắt giữa từ |
| Gán `is_verbatim=true` cho mọi nguồn | Nhận đoạn tóm tắt là trích nguyên văn |

Bài học: test mock không phát hiện được lỗi timeout. Từ nay chạy thêm `test_react_gemini_live.py` trước khi báo xong, và không ghi "100%" nếu chưa chạy với hệ thống thật.
