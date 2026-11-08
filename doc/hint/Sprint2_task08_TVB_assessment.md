# Review TASK-08 (08/11/2026)
B nối được `/chat` vào ReAct thật, stream `delta` sau chốt chặn, bỏ `full_text` khỏi `observation`, thêm kiểm tra chủ phiên và giới hạn lượt của khách. Hướng làm đúng, nhưng còn các lỗi dưới đây. Tất cả đã sửa trong nhánh `feat/task-08-streaming-sse-waterfall-benchmark`.

## 🔴 Bảo mật
| Lỗi | Thử thật | Đã sửa |
|---|---|---|
| Tin header `X-User-Id`/`X-User-Role` không cần khóa nội bộ. nginx chuyển nguyên header của trình duyệt | Gửi `X-User-Role: ADMIN` đọc được hội thoại của người khác (200) | Chỉ tin khi kèm `X-Internal-Key` hợp lệ → 403 |
| `DEFAULT_JWT_SECRET` viết trong code, dùng khi thiếu biến môi trường (vi phạm AGENTS.md điều 9) | Token tự ký bằng khóa trong repo được nhận (200) | Bỏ khóa mặc định: thiếu `JWT_SECRET_KEY` thì 503; bắt buộc `exp`, kiểm `iss`/`aud` như Core |
| Lấy IP từ `X-Forwarded-For` | 8 lượt với 8 IP giả đều 200 | Chỉ dùng `X-Real-IP` (nginx ghi đè) → lượt 6 bị 429 |
| Trừ lượt hỏi ngay trong `get_user_context` | Xem trace 5 lần là hết lượt chat | Chỉ trừ khi gọi `/chat` |

## 🔴 Số liệu benchmark không trung thực (vi phạm AGENTS.md điều 1)
- **TTFT không đo:** `ttft_ms = min(total_latency_ms * 0.45, 1850.0)` luôn ≤ 1,85 giây. Nay đo thời điểm client nhận sự kiện `thought` đầu tiên qua HTTP thật (uvicorn); TestClient gom cả phản hồi nên không đo được TTFT.
- **Kho thuốc giả có sản phẩm không tồn tại:** Daconil, Kasumin (lại ghi "Sinh học"), Champion, Tilt Super. Nay dùng đúng danh mục seed của Core.
- **Lượt offline vẫn tính PASS:** lần chạy của B có 4/15 lượt Gemini không chạy (hết quota). Nay tính FAIL.
- **Không kiểm trích dẫn với CSDL**, Ca 2–5 không kiểm PHI. Nay kiểm cả hai.
- **Ticket ghi "B3. Chạy với Core thật ✓"** nhưng Core không chạy, kho thuốc là dữ liệu giả.

## 🟠 Code
- `run_stream()` chép lại 450 dòng của vòng ReAct, đã lệch bản gốc: ép "chưa rõ ngày thu hoạch" thành 0 ngày (câu trả lời ghi "còn 0 ngày"), lỗi bất ngờ làm đứt luồng SSE không có `final_answer`, Gemini trả rỗng thì không chuyển offline. Nay `run()` và `run_stream()` dùng chung `_events()`, nên 25 test của TASK-07 bảo vệ cả luồng stream.
- `trace_logger` ghi file vào cả thư mục chạy lệnh và gốc repo mỗi lượt chat; `total_tokens` là số ước lượng từ số ký tự nhưng ghi như số đo. Nay ghi một file vào `TRACE_EXPORT_DIR`, token lấy từ `usage_metadata` của Gemini, không có thì để `null`.
- `test_rag_accuracy.py` đỏ từ commit của B (`/chat` không còn trả trích dẫn giả; `FakeEmbedding` thiếu `name()` sau khi thêm `embedding_function`). Đã sửa test.

## Kết quả đo lại
benchmark 9/15 PASS (2026-11-08 09:33:31, Gemini `gemini-3.5-flash-lite`, Core giả lập theo danh mục seed (Core không chạy), RAG PostgreSQL (15 đoạn đã duyệt)); 0 lượt rơi về offline; trong 15 lượt Gemini chạy thật: TTFT 1.2–1.7 giây, tổng thời gian 3.1–6.7 giây.
Ca chưa đạt: BENCH_03_TARGET_SPOT_RAG 0/3, BENCH_04_PEPPER_BACTERIAL_SPOT 0/3. Lý do: Trích dẫn rỗng hoặc không phải bài đang được duyệt.

Bài học: số liệu trong báo cáo phải là số đo được; không đạt thì ghi không đạt và lý do. Trước khi đánh dấu ✓ cho "chạy với hệ thống thật", ghi rõ thành phần nào thật, thành phần nào giả lập.
