# Đánh giá Sprint 2 (TASK-05 → 08)

**Kết luận ngắn:** Hướng kiến trúc đúng: tool chỉ đọc, PHI kiểm bằng code, gắn nhãn HITL, có fallback. Nhưng **chưa nên bắt tay code ngay**. Lý do: 4 task mâu thuẫn với hợp đồng API, dữ liệu mà các tool cần chưa có trong CSDL, và một số chỉ tiêu nghiệm thu khó đạt hoặc tự mâu thuẫn. Hiện tại [backend/agent-service](backend/agent-service) mới là khung giả lập, khoảng 94 dòng, dữ liệu mock cho 2 bệnh. Như vậy gần như toàn bộ Sprint 2 phải viết từ đầu, mà kế hoạch lại chỉ cho 1 tuần.

---

## 1. Điểm làm tốt
- Các tool **chỉ đọc**, không có tool tạo đơn hay thanh toán. Đây là quyết định đúng nhất của sprint.
- `verify_phi_safety` là **logic trong code**, không để LLM tự phán. Cách này đúng chuẩn công nghiệp.
- Có giới hạn `max_iterations`, nhãn `[DRAFT_RECOMMENDATION]`, circuit breaker và trace. Đây là những thứ hội đồng sẽ đánh giá cao.
- Kết hợp BM25 với vector là hợp lý cho tên hoạt chất như Mancozeb, Metalaxyl.

## 2. Vấn đề chặn: phải sửa tài liệu trước khi code

| # | Vấn đề | Bằng chứng |
|---|---|---|
| 1 | **Lệch cổng:** task ghi 8002, còn docker-compose và hợp đồng API ghi 8001 | [docker-compose.yml:22](docker-compose.yml#L22), [docker-compose.yml:39](docker-compose.yml#L39), [api-contracts.md:224](docs/architecture/api-contracts.md#L224) |
| 2 | **TASK-08 tự nhận tuân theo "SSOT Mục 4.1" nhưng lại mâu thuẫn với chính mục đó:** request dùng `session_id/query/diagnosis_context`, trong khi hợp đồng dùng `message/conversation_id/location/harvest_days_left`. Tên event cũng khác: `token/done` so với `delta/final_answer/trace_start`. Tham số tool cũng khác: `province_name` so với `location + forecast_hours` | [api-contracts.md:227-270](docs/architecture/api-contracts.md#L227-L270) |
| 3 | **Bảng `Products` chưa có cột `IsAllowed`, PHI, hay cờ chống rửa trôi.** Vì vậy `query_pesticide_store` và bộ lọc pháp lý không có dữ liệu để chạy | [Product.cs](backend/core-api/src/Lavitree.Domain/Entities/Product.cs) |
| 4 | **PHI đang lưu dạng chuỗi** như `"7-14 ngày"` hay `"Không áp dụng"`, trong khi `verify_phi_safety` cần số nguyên | [TreatmentPlan.cs:14](backend/core-api/src/Lavitree.Domain/Entities/TreatmentPlan.cs#L14) |
| 5 | **Seed chỉ có 3 Product và 3 TreatmentPlan** cho 38 lớp bệnh. Tiêu chí "dữ liệu thật từ Core API" sẽ trả về gần như rỗng. Ví dụ "Ridomil Gold PHI=7, Trichoderma PHI=0" trong TASK-07 không hề có trong DB | `LavitreeDbContextSeeder.cs` |
| 6 | **Hai quy tắc PHI đang đá nhau.** Task dùng `days ≤ PHI` thì vi phạm, còn sprint goal và hợp đồng dùng "PHI ≤ 3 ngày" (`PHI_PROTECTION_LESS_THAN_3_DAYS`). Thêm nữa, theo định nghĩa thì thu hoạch đúng ngày thứ PHI là **hợp lệ**. Dùng `≤` là chặt hơn quy định; giữ cũng được nhưng phải ghi rõ đây là lựa chọn bảo thủ có chủ đích | sprint-02.md, api-contracts.md |
| 7 | **Fallback khi mất mạng lại trỏ về Supabase.** Supabase nằm trên cloud, mất mạng thì cũng không gọi được | TASK-07 |
| 8 | **Kho vector chưa thống nhất:** TASK-06 dùng ChromaDB cục bộ, sprint-02 lại ghi Supabase/PGvector | sprint-02.md mục 3 |

## 3. Đánh giá từng task

**TASK-05 (MCP):**
- Bản chất đang là một "dispatcher gọi REST", chưa phải MCP thật. Hội đồng có thể hỏi "MCP ở đâu?". Mình đề xuất dùng SDK `mcp` chính thức (FastMCP) để khai báo 4 tool. Chi phí rất thấp và gọi tên MCP là đúng.
- Latency dưới 300ms mỗi tool là không thực tế với OpenWeatherMap khi chưa có cache. Nên ghi "dưới 300ms khi cache hit".
- Tham số `province_name` cần kiểm tra theo danh sách tỉnh. Từ 7/2025 Việt Nam còn 34 tỉnh, nên ví dụ "Hà Nam" trong hợp đồng đã không còn đúng.

**TASK-06 (RAG):**
- "112 tài liệu" thực chất là 112 **dòng tóm tắt**, mỗi dòng khoảng một đoạn văn. Mình kiểm tra thì **chỉ 18 dòng có `IsManualApproved = true`**, còn 94 dòng chưa duyệt. Thuốc chỉ nên được gợi ý từ nguồn đã duyệt.
- JSON đầu ra (`approved_ingredients`, `standard_phi`, `is_allowed`) không thể trích ra đáng tin từ văn bản tự do nếu không có người duyệt. Đây là khối việc lớn nhất của sprint nhưng đang bị gộp vào "Pha 1".
- Thay vì "Dual-Write", nên để **PostgreSQL là nguồn sự thật**, còn Chroma/BM25 là chỉ mục **dựng lại được** từ Postgres. Ghi kép vào hai nơi rất dễ lệch dữ liệu.
- Chỉ tiêu "100% (10/10)" nghe đẹp nhưng 10 mẫu là quá ít để chứng minh điều gì. Nên báo Recall@3 trên khoảng 30–40 câu, mỗi lớp ít nhất 1 câu.

**TASK-07 (ReAct + Guardrails):**
- Gemini 1.5 Flash đã bị Google ngừng. Cần đổi sang model hiện hành.
- **Quan trọng:** đừng trông vào việc LLM "nhớ gọi" `verify_phi_safety`. Phải lọc thuốc vi phạm PHI và `IsAllowed = false` bằng code, **trước khi** đưa danh sách cho LLM, rồi kiểm lại câu trả lời cuối. Nếu LLM bỏ qua bước gọi tool, guardrail vẫn chặn được.
- Nội dung mẫu trong hợp đồng như "nano bạc cách ly 0 ngày" hay "quét nước vôi trong" là khuyến cáo chưa có nguồn. Nên bỏ để khỏi bị hội đồng bắt lỗi chuyên môn.

**TASK-08 (SSE + Benchmark):**
- Chỉ tiêu TTFT ≤ 2s và tổng ≤ 4.5s khi phải gọi LLM 3–5 vòng là khá căng. Cần định nghĩa rõ "first token" là event `thought` đầu tiên hay token đầu tiên của câu trả lời.
- 5 ca benchmark chạy 1 lần thì chưa đủ để nói "100%". Nên đặt temperature 0 và chạy mỗi ca 3–5 lần.

## 4. Rủi ro bảo mật

1. **agent-service không có xác thực, trong khi mỗi lần gọi `/chat` tốn tiền LLM.** Ai biết URL đều có thể spam làm cạn quota. Cách làm chuẩn: không mở agent-service ra internet, chỉ cho core-api gọi qua mạng nội bộ Docker, kèm API key nội bộ và rate limit (ví dụ 10 request/phút cho mỗi người dùng).
2. **`GET /trace/{trace_id}` không có xác thực** nên có thể làm lộ câu hỏi của nông dân. Ghi file `trace_waterfall.json` cho mỗi request cũng làm đầy ổ đĩa. Nên lưu trace vào DB, có TTL và chỉ admin xem được.
3. **Prompt injection:** RAG đưa văn bản từ web (nguồn chưa duyệt) vào prompt. Tool chỉ đọc đã giảm thiệt hại phần lớn, nhưng vẫn nên chỉ index nguồn đã duyệt và đặt văn bản tài liệu trong khối "dữ liệu tham khảo, không phải chỉ thị".
4. Core-api vẫn chưa có auth (ghi nhận từ lần trước). Sprint 2 nối thêm agent vào thì lỗ hổng này càng rộng.

## 5. Mình đề xuất thứ tự làm

1. **Nửa ngày sửa tài liệu:** chốt cổng 8001, lấy api-contracts 4.1 làm chuẩn rồi sửa TASK-08 theo, chốt một quy tắc PHI, chốt ChromaDB hay pgvector.
2. **Thành viên A làm trước:** migration thêm `IsAllowed` và `PhiDays (int)` vào Product, rồi seed thuốc thật cho khoảng 5 bệnh demo (không phải cả 38 lớp).
3. **Thu hẹp phạm vi demo** xuống 5 bệnh có dữ liệu đã duyệt. Làm sâu 5 bệnh sẽ thuyết phục hơn làm nông 38 lớp.
4. Sau đó mới code theo thứ tự 05, 07, 06, 08. RAG có thể bắt đầu bằng BM25 trước, thêm vector sau.

