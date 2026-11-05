
Thực tế mới có `MedicinesController` bản stub (dữ liệu mock). `AuthController` chưa có, và bảng `Product` chưa có cột `PhiDays`/`IsAllowed`, nên A01 thực chất chưa làm. Dưới đây là đánh giá **thiết kế kỹ thuật** của Sprint 2 (không xét tiến độ).

## Tổng quan
Khung kế hoạch tốt: chốt contract trước rồi dựng API giả, PostgreSQL là nguồn dữ liệu chính, guardrail viết bằng code, tool chỉ đọc, `userId` lấy từ JWT, cắt bớt phạm vi hợp lý. Nhưng còn **4 lỗi thiết kế 🔴** cần sửa trước khi code, nếu không sẽ phải làm lại.

---

## 🔴 1. Trình duyệt gọi thẳng Agent ở cổng 8001, không qua kiểm soát nào
A04 ghi "đọc stream SSE từ cổng `8001`". Nhưng:
- Cổng 8001 đã bind `127.0.0.1`, nên **trình duyệt không gọi tới được**.
- Kể cả nếu mở cổng, agent-service **không có xác thực, không có rate limit**. Kẻ xấu spam chat là đốt hết quota Gemini (denial of wallet). Quy tắc "Khách chỉ được 3–5 lượt" cũng không có chỗ nào thực thi.
- Nginx mặc định gom dữ liệu lại rồi mới gửi (buffering), làm SSE không chảy ra từng chữ.

**Sửa:** chat đi qua **Core API (hoặc nginx) làm cổng vào duy nhất**.
- Kiểm tra JWT, áp hạn mức theo user hoặc IP, rồi mới chuyển tiếp sang agent qua mạng nội bộ Docker.
- Nginx tắt buffering cho đường dẫn chat: `proxy_buffering off`.
- Ghi đường đi này vào `api-contracts.md` mục 4.

## 🔴 2. Dữ liệu PHI bị lưu ở 3 nơi, nguy cơ lệch nhau
TASK-06 thêm `phi_days`, `is_allowed`, `active_ingredients` vào **bảng tri thức**. Trong khi bảng `Products` (A làm) cũng có `phi_days`/`is_allowed`, và TASK-07 lại có `offline_ipm_cache.json`. Ba nguồn như vậy chắc chắn sẽ lệch nhau. Guardrail kiểm tra PHI mà đọc nhầm nguồn thì đúng là lỗi an toàn thực phẩm.

**Sửa:**
- **PHI và tình trạng cấm/được phép chỉ lưu trong `Products`.** Bảng tri thức chỉ chứa văn bản và nguồn trích dẫn.
- File cache offline **được sinh tự động từ Postgres** bằng script export, không ai soạn tay.

## 🔴 3. TASK-06 đi ngược quyết định đã chốt và phá ranh giới giữa các service
- **"`full_content` lưu trọn 100% nội dung gốc từ URL"** và **"Admin dán URL → AI bóc tách"**: đây chính là crawl, điều đã chốt là không làm (lý do: bản quyền, HTML lộn xộn). 112 nguồn hiện chỉ có `EvidenceText` khoảng 500 ký tự, nên cắt chunk 400 ký tự gần như vô nghĩa.
  - Nếu vẫn giữ tính năng fetch URL thì phải chặn **SSRF** (kẻ xấu dùng server để gọi vào mạng nội bộ, ví dụ `http://minio:9000`) và **prompt injection** từ nội dung trang web.
- **Agent ghi thẳng vào Postgres** (`ingest.py` "Sync Postgres"). Việc này mâu thuẫn với "Agent chỉ đọc", và đụng vào schema do Core API/EF quản lý.
  - Sửa: agent chỉ dùng **tài khoản DB chỉ có quyền đọc**, hoặc đọc qua Core API. Mọi thao tác ghi đi qua Core API.
- **Duyệt bài xong thì kích hoạt cập nhật chỉ mục bằng cách nào?** A03 ghi "đây là trigger để pipeline của B băm chunk", nhưng không ghi cơ chế.
  - Sửa: Core API gọi `POST /internal/reindex` trên agent (xác thực bằng shared secret, chỉ trong mạng nội bộ), hoặc dùng nút "Đồng bộ" đã bàn trước đó.

## 🔴 4. Có tool nhưng không ai được giao làm phần backend cho nó
- **Dịch vụ thời tiết** (`check_weather_risk` cần Core API tích hợp OpenWeatherMap và cache) chỉ nằm trong "Pha 1B" của TASK-05. **Danh sách A00–A04 của A không có việc này.**
- **API thuốc bản thật:** thêm cột `PhiDays`, `IsAllowed`, `RainResistant`, `MedicineType` vào `Products`, viết migration, và **nhập dữ liệu thuốc cho 5 bệnh demo**. Hiện chỉ có stub mock cho Late blight. Không ticket nào của A nhận phần này.

Hậu quả: B sẽ phải chạy trên dữ liệu giả suốt sprint. Cần thêm 2 việc này vào A01, hoặc tạo ticket riêng.

---

## 🟠 Cần sửa trong ticket
| # | Vấn đề | Đề xuất |
|---|---|---|
| 5 | **Embedding cho tiếng Việt chưa được chọn.** Model mặc định của ChromaDB là tiếng Anh, sẽ tìm sai. BM25 cũng chưa quy định cách tách từ và xử lý dấu tiếng Việt | Ghi rõ model đa ngôn ngữ chạy local (ví dụ dòng `multilingual-MiniLM` hoặc `bge-m3`). Nếu dùng embedding của Gemini thì không chạy offline được |
| 6 | **Dữ liệu 5 bệnh demo bị sai.** Mã lớp `Pepper__bell___Bacterial_spot` sai, đúng là `Pepper,_bell___Bacterial_spot` (mã sai này đã nằm trong code `MedicinesController`). Ca 4 benchmark ghi **"Thán thư ớt"**, nhưng thán thư do nấm, không phải lớp "đốm vi khuẩn" | Sửa mã lớp, đổi Ca 4 thành đốm vi khuẩn ớt |
| 7 | **Thiếu ngày thu hoạch thì guardrail làm gì?** Spec không nói. Ngưỡng cũng không thống nhất: TASK-07 hậu kiểm theo "≤ 3 ngày" cố định, trong khi tiền lọc theo PHI của từng thuốc | Thiếu `harvest_days_left` thì **hỏi lại người dùng hoặc giả định trường hợp xấu nhất**. Bỏ ngưỡng cố định 3 ngày, chỉ dùng PHI |
| 8 | **Câu trả lời mẫu trong contract tự gợi ý "nước vôi", "Nano Bạc"**, những thứ không có trong kho hay tri thức. Đây chính là kiểu bịa mà guardrail cần ngăn | Sửa ví dụ mẫu. Thêm quy tắc: chỉ gợi ý sản phẩm hoặc biện pháp có trong Observation |
| 9 | **`conversation_id`: lưu hội thoại ở đâu?** Nếu để trong RAM thì khởi động lại là mất. Nếu lưu lại thì phải gắn với user, không thì người khác đoán ID là đọc được chat (IDOR) | MVP không lưu trạng thái giữa các lượt, hoặc lưu trong Postgres kèm `user_id` |
| 10 | **Trace (`GET /agent/trace/{id}` và file `trace_waterfall.json`)** chứa nội dung chat của người dùng. Ghi ra file theo từng phiên thì ổ đĩa đầy dần | Chỉ admin được xem. Lưu vào DB hoặc ghi file xoay vòng (ghi đè file cũ) |
| 11 | **`draft_order` và nút "Thêm vào giỏ" lấy dữ liệu do agent sinh ra** | Khi tạo đơn, Core **tự tính lại giá, kiểm tra `IsAllowed` và PHI từ DB**, không tin dữ liệu từ agent hay client. Giá trong A03 cũng phải tính ở server |
| 12 | **Lưu JWT mâu thuẫn:** A00 dùng `withCredentials` (cookie), A02 dùng header Bearer | Chọn **cookie httpOnly + `SameSite=Strict`** (web và API cùng origin qua nginx), tránh bị đánh cắp token khi dính XSS |
| 13 | **Auth thiếu các chốt cơ bản** | Đăng ký luôn gán role `FARMER` ở server, không nhận role từ body. Rate limit riêng cho `/auth/login` (chống dò mật khẩu). Admin đầu tiên tạo bằng seed. Gộp `X-Admin-Key` vào JWT role `ADMIN` |
| 14 | **Benchmark tự chấm điểm cho chính mình.** Yêu cầu Recall@3 = 100% và 15/15 pass trên bộ câu hỏi do chính người làm soạn rất dễ bị khớp quá mức (overfit). Tiêu chí "pass" của Ca 2–5 còn mơ hồ. "Mọi câu trả lời có `[DRAFT]`" mâu thuẫn với TASK-07 ("chỉ câu có kê đơn") | Viết bộ câu hỏi **trước khi** tinh chỉnh, chấm tự động bằng các check cụ thể (không chứa hoạt chất cấm, có trích nguồn, có tag khi kê đơn). Báo cáo số thật, không bắt buộc đạt 100% |

## 🟡 Nhỏ
- Contract cho Orders, duyệt bài, danh sách sản phẩm và `requires_expert` mới chỉ nằm trong ticket. Cần đưa vào `api-contracts.md` vì đó là nguồn chuẩn duy nhất.
- `requires_expert` cần cột trong DB và một luồng để nông dân bấm yêu cầu.
- Ảnh sản phẩm vẫn trỏ tới `lavitree.io.vn`.
- Đặt hàng cần trừ tồn kho an toàn khi nhiều người mua cùng lúc.

---

## Thứ tự sửa kế hoạch mình đề xuất
1. Vẽ lại đường đi của chat: **trình duyệt → nginx/Core (JWT, rate limit) → agent nội bộ**, và cập nhật contract mục 4.
2. Chốt **`Products` là nguồn duy nhất cho PHI**; cache offline sinh từ DB.
3. Viết lại TASK-06: bỏ crawl và `full_content`, RAG chạy trên `EvidenceText` đã duyệt; agent chỉ đọc; định nghĩa cơ chế reindex.
4. Thêm cho A: dịch vụ thời tiết, cột PHI/IsAllowed cho `Products`, dữ liệu thuốc 5 bệnh.
5. Sửa các mục 🟠 ngay trong từng ticket.

Mình có thể sửa trực tiếp `sprint-02.md`, TASK-05/06/07/08, A01/A03/A04 và `api-contracts.md` theo các điểm trên. Bạn có muốn mình làm không?