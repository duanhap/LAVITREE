# TASK-08: STREAMING SSE, WATERFALL TRACE LOGGING & BENCHMARK NGHIỆM THU 5 CA LÂM SÀNG
* **Sprint**: Sprint 2 (Trí tuệ Nhân tạo Tác tử & Hệ sinh thái MCP)
* **Thứ tự thực hiện trong Sprint**: **Ưu tiên số 4 (Lắp ráp toàn trình và nghiệm thu sau khi hoàn thành Task 05, 06, 07)**
* **Phân hệ**: `backend/agent-service:8001` (FastAPI) & Client Test
* **Trạng thái**: `[x] DONE` (08/11/2026: code Pha 1–4 xong và đã review; nghiệm thu với dữ liệu và hệ thống thật chuyển sang `task-s2-bonus-hardening-acceptance.md` mục 3.7)
* **Người phụ trách**: Thành viên B (Agent Core & SSE Streaming) & Thành viên A (Client Integration Test)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi
* **Kế thừa từ nguyên mẫu**: `extract/DAY1`, `extract/DAY3/lavitree_trace_waterfall.json`, `extract/DAY26/lavitree_mcp_benchmark.py`

---

## 0. VIỆC NHẬN TỪ TASK-07 & ĐIỀU KIỆN TRƯỚC KHI NGHIỆM THU
*Chuyển sang từ TASK-07 ngày 08/11/2026. Code của Pha 1–4 đã hoàn tất; nhóm **A** phải xong trước khi nghiệm thu CSDL thật ở Pha 4, vì các ca demo cần dữ liệu thật.*

**A. Dữ liệu CSDL — chặn nghiệm thu benchmark (trưởng nhóm / Thành viên A)**
- [x] **A1. Sửa loại thuốc Trichoderma.** `[Chuyển sang TASK-S2-BONUS BUG-86]` CSDL thật ghi `Hóa học`, PHI=7 (migration điền mặc định, seeder không ghi đè), nên chính thuốc sinh học bị chặn khi sát ngày thu hoạch. Ca 1 không thể đạt nếu chưa sửa:
  ```sql
  UPDATE "Products" SET "MedicineType" = 'Sinh học', "PhiDays" = 0
  WHERE "Name" = 'Chế phẩm sinh học Trichoderma Bacillus';
  ```
  Sửa xong, B chạy lại `python scripts/export_offline_cache.py` và commit `offline_ipm_cache.json`.
- [x] **A2. Duyệt tri thức cho 5 bệnh demo** `[Chuyển sang TASK-S2-BONUS BUG-87]` qua luồng Admin (A03). Ngày 08/11 CSDL chỉ có 14/112 bài đã duyệt: Mốc sương 0, Đốm vòng 1, Đốm mục tiêu 0, Đốm vi khuẩn ớt 0, Gỉ sắt ngô 1. Chưa duyệt thì không đạt tiêu chí "citations không rỗng".
- [x] **A3. Tạo tài khoản CSDL chỉ đọc cho agent-service.** `[Chuyển sang TASK-S2-BONUS BUG-89]` `AGENT_DB_URL` đang dùng user `postgres` (toàn quyền, đọc được cả `Users`, `Orders`). Agent chỉ cần đọc `KnowledgeSources`, `Products`, `DiseaseProducts`, `Diseases`.

**B. Việc của Thành viên B**
- [x] **B1. Nối `POST /api/v1/agent/chat` vào `react_agent`**, bỏ generator giả trong `app/main.py`.
- [x] **B2. Gắn `conversation_id` với người dùng.** Server tự sinh id và kiểm tra chủ sở hữu theo `userId` từ JWT (Core chuyển xuống), chống IDOR (403), kèm giới hạn 5 lượt hỏi/ngày của Guest theo `roles-usecases.md`.
- [x] **B3. Chạy toàn luồng với Core và PostgreSQL thật** `[Chuyển sang TASK-S2-BONUS BUG-88]` `[Chưa thực hiện]`: benchmark ngày 08/11 dùng RAG từ PostgreSQL thật nhưng kho thuốc và thời tiết vẫn giả lập vì Core API không chạy.
- [x] **B4. Đo tỷ lệ Agent có gọi tool.** 100.0% số lượt trong benchmark 2026-11-08 09:33:31 (tính cả lượt offline, không gọi tool).
- [x] **B5. Nhờ kỹ sư nông nghiệp xác nhận số liệu viết tay** `[Chuyển sang TASK-S2-BONUS BUG-93]`: bảng PHI `CHEMICAL_PESTICIDES_PHI` và `UNVERIFIED_CHEMICALS` trong `guardrails.py`, biện pháp canh tác `DISEASE_METADATA` trong `export_offline_cache.py`. Chưa xác nhận thì ghi rõ là giới hạn trong báo cáo.

**C. Lưu ý thiết kế bắt buộc khi làm Pha 1–2**
- **Chỉ stream văn bản đã qua chốt chặn.** `delta` phải cắt từ câu trả lời *sau* `post_filter_response`, `strip_unsourced_dosage` và `apply_hitl_tag`. Stream thẳng token của Gemini thì người dùng sẽ thấy thuốc vi phạm PHI trước khi hậu kiểm kịp gỡ.
- **`observation` gửi ra client không kèm `full_text`** và cắt bớt kết quả tool dài (`AgentResponse.to_dict()` đã bỏ `full_text` khỏi `citations`, nhưng `steps` thì chưa).
- **`temperature`:** benchmark yêu cầu 0, `gemini_client.py` đang cố định 0.2 → đọc từ biến môi trường.
- **Thời gian phản hồi:** ngày 08/11, Gemini thật với tool giả lập mất 3,1–7,8 giây mỗi câu, vượt mục tiêu 4,5 giây ở mục 4. `thought` đầu tiên chỉ có sau lượt Gemini đầu tiên. Đo thật trước, rồi trưởng nhóm quyết định giữ hay nới mục tiêu; không ghi số chưa đo.

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Vấn đề trải nghiệm**: Vòng lặp ReAct gọi nhiều công cụ (tra cứu tri thức RAG, thời tiết, kho thuốc, kiểm tra an toàn) có thể mất từ 3 đến 5 giây để hoàn tất. Nếu bắt người dùng hoặc Hội đồng chấm thi chờ đợi màn hình trắng sẽ tạo cảm giác ứng dụng bị đơ/lag.
- **Giải pháp kế thừa từ DAY1 & DAY3**:
  1. **Server-Sent Events (SSE) Streaming theo chuẩn SSOT**: Truyền phát tức thời từng bước suy luận (`trace_start`, `thought`, `action`, `observation`) và từng token văn bản của câu trả lời cuối cùng (`delta`) tới client ngay khi chúng được sinh ra. Thời gian xuất hiện suy nghĩ đầu tiên (Time-to-First-Thought) $\le 2.0$ giây.
  2. **Waterfall Trace Logging (Minh bạch hóa XAI)**: Tự động ghi nhận chi tiết cây tiến trình thực thi vào file `trace_waterfall.json`. Đo đạc chính xác thời gian chạy từng Tool ($ms$), số lượng prompt/completion token và chi phí API, phục vụ trình diễn trước Hội đồng chấm thi.
  3. **Bộ Benchmark Đánh giá Định lượng (5 Ca Lâm sàng x 3 Lần chạy)**: Chạy kịch bản tự động trên 5 ca bệnh đại diện dã ngoại ở `temperature = 0` (mỗi ca chạy 3 lần độc lập) để đo lường định lượng: Tỷ lệ tuân thủ PHI (100%), tỷ lệ không sinh ảo giác thuốc cấm (100%), thời gian phản hồi trung bình.

---

## 2. ĐẶC TẢ KỸ THUẬT & HỢP ĐỒNG API (CHUẨN SSOT MỤC 4.1)

### Endpoint: `POST /api/v1/agent/chat` (Cổng `8001`)
- **Headers**: `Accept: text/event-stream`, `Cache-Control: no-cache`
- **Request Body (`application/json`)**:
  ```json
  {
    "message": "Vườn cà chua của tôi bị sương mai, 2 ngày nữa thu hoạch, chiều nay có mưa không và xử lý thế nào?",
    "conversation_id": "conv-a1b2c3d4",
    "location": "Hà Nam",
    "harvest_days_left": 2,
    "current_disease_code": "Tomato___Late_blight"
  }
  ```
  *(Lưu ý: Nếu `conversation_id` không được gửi, server sẽ tự sinh UUIDv4 và trả về trong event `trace_start`. Nếu `harvest_days_left` bị bỏ trống, server mặc định coi $harvest\_days\_left = 0$ để kích hoạt chốt chặn an toàn nhất).*

- **Streaming Response Payload (`text/event-stream`)**:
  ```text
  event: trace_start
  data: {"trace_id": "tr-987654", "conversation_id": "conv-a1b2c3d4", "status": "thinking"}

  event: thought
  data: {"step": 1, "thought": "Cần kiểm tra thời tiết tại Hà Nam chiều nay để xem có nguy cơ mưa rửa trôi không."}

  event: action
  data: {"step": 1, "tool": "check_weather_risk", "params": {"location": "Hà Nam", "forecast_hours": 12}}

  event: observation
  data: {"step": 1, "result": {"is_rain": true, "rainfall_mm": 20, "humidity": 92, "recommendation": "NGUY CƠ RỬA TRÔI"}}

  event: thought
  data: {"step": 2, "thought": "Trời mưa to và chỉ còn 2 ngày thu hoạch -> vi phạm thời gian cách ly PHI (7 ngày). Kích hoạt Code Guardrail chặn thuốc hóa học."}

  event: delta
  data: {"token": "Chào "}
  event: delta
  data: {"token": "bác! "}
  event: delta
  data: {"token": "Vì cà chua chỉ còn 2 ngày nữa là thu hoạch..."}

  event: final_answer
  data: {
    "trace_id": "tr-987654",
    "answer": "[DRAFT_RECOMMENDATION]\nChào bác! Hệ thống ghi nhận vườn chỉ còn 2 ngày nữa là thu hoạch và chiều nay có mưa to:\n1. ⛔ TUYỆT ĐỐI KHÔNG PHUN THUỐC HÓA HỌC: Các loại thuốc như Ridomil Gold có thời gian cách ly tối thiểu 7 ngày, vi phạm an toàn thực phẩm.\n2. ✂️ BIỆN PHÁP CƠ HỌC: Cắt tỉa ngay chùm lá bị mốc sương, thu dọn xa vườn.\n3. 🌿 BIỆN PHÁP SINH HỌC: Sử dụng chế phẩm sinh học Trichoderma hoặc bạt che luống.",
    "draft_order": null,
    "guardrail_triggered": "HARVEST_BEFORE_PHI_VIOLATION",
    "is_offline_fallback": false,
    "citations": [
      {
        "source_id": "0f801a5b-9ad7-40fa-ba30-efe06296910f",
        "source_title": "Một số loại bệnh hại trên cây cà chua và biện pháp phòng trừ",
        "organization": "Trung tâm Khuyến nông Quốc gia",
        "source_url": "https://khuyennongvn.gov.vn/...",
        "excerpt": "Bệnh sương mai do nấm Phytophthora infestans gây ra...",
        "unit_type": "SYMPTOMS",
        "is_verbatim": true
      }
    ],
    "total_latency_ms": 2150
  }
  ```
  *(Quy tắc `citations` theo `api-contracts.md` Mục 4.1: lấy trực tiếp từ `top_chunks` của RAG đã đưa vào ngữ cảnh, gộp trùng theo `source_id`; **không** để LLM tự viết nguồn/URL; không dùng RAG thì `citations: []`.)*
  *(Lưu ý: Khi Circuit Breaker OPEN hoặc ngắt kết nối mạng / Supabase Cloud, hệ thống chuyển sang Fallback Local Bundle và trả về `is_offline_fallback: true` để giao diện Web/App hiển thị badge cảnh báo "Đang dùng hướng dẫn lưu sẵn" theo UI-UX mục 6).*

### Cấu trúc File `trace_waterfall.json` (Xuất sau mỗi phiên chẩn đoán):
```json
{
  "trace_id": "tr_987654",
  "query": "Cà chua mốc sương 2 ngày thu hoạch có mưa",
  "total_duration_ms": 2150,
  "steps": [
    {"phase": "Thought_1", "duration_ms": 320},
    {"phase": "Tool_check_weather_risk", "duration_ms": 450},
    {"phase": "Thought_2", "duration_ms": 280},
    {"phase": "Tool_query_pesticide_store", "duration_ms": 210},
    {"phase": "Hard_Guardrail_PHI_Filter", "duration_ms": 5},
    {"phase": "Final_Answer_Generation", "duration_ms": 885}
  ],
  "safety_audit": {
    "phi_violation_detected": true,
    "chemical_pesticides_blocked": ["Ridomil Gold 68WG"],
    "allowed_bio_medicines": ["Trichoderma Bio"],
    "draft_recommendation_applied": true
  }
}
```

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)

- [x] **Pha 1**: Cài đặt FastAPI Streaming Endpoint `POST /api/v1/agent/chat` sử dụng `StreamingResponse` với media type `text/event-stream`.
- [x] **Pha 2**: Tích hợp luồng phát sự kiện Generator: Bắn event `trace_start`, chuyển tiếp các bước suy luận `thought`, `action`, `observation` từ ReAct loop, và stream từng token của `delta` (chỉ cắt từ câu trả lời đã qua hậu kiểm).
- [x] **Pha 3**: Viết module ghi nhận `trace_logger.py`: tính toán thời gian chạy từng phase ($ms$), lưu xoay vòng (rotating log buffer tối đa 100 phiên gần nhất, tránh đầy ổ đĩa) và format thành `trace_waterfall.json` phục vụ vẽ biểu đồ tiến trình; hỗ trợ API `GET /api/v1/agent/trace/{trace_id}`.
- [x] **Pha 4**: Xây dựng kịch bản kiểm thử tự động `run_agent_benchmark.py`:
  - 5 ca bệnh lâm sàng:
    1. Ca 1 (Cận ngày thu hoạch): Cà chua mốc sương, 2 ngày thu hoạch, trời mưa $\rightarrow$ Bắt buộc chặn thuốc hóa học.
    2. Ca 2 (Xa ngày thu hoạch): Cà chua đốm vòng, 20 ngày thu hoạch, không mưa $\rightarrow$ Đề xuất thuốc hóa học đặc trị có sẵn trong kho kèm liều lượng chuẩn.
    3. Ca 3 (Bệnh đốm mục tiêu): Cà chua đốm mục tiêu $\rightarrow$ Trích dẫn tài liệu khuyến nông RAG chính xác.
    4. Ca 4 (Đốm vi khuẩn ớt - `Pepper,_bell___Bacterial_spot`): Ớt chuông bị đốm vi khuẩn $\rightarrow$ Đề xuất thuốc phòng trừ có trong kho và cách ly đúng.
    5. Ca 5 (Gỉ sắt ngô): Ngô bị gỉ sắt $\rightarrow$ Khuyến cáo biện pháp canh tác và thuốc phù hợp.
  - Mỗi ca chạy 3 lần lặp ở `temperature = 0`, đo đạc tỷ lệ nhất quán (Consistency Rate) và tỷ lệ an toàn (Safety Rate). Kết quả đo lại ngày 08/11: benchmark 9/15 PASS (2026-11-08 09:33:31, Gemini `gemini-3.5-flash-lite`, Core giả lập theo danh mục seed (Core không chạy), RAG PostgreSQL (15 đoạn đã duyệt)); 0 lượt rơi về offline; trong 15 lượt Gemini chạy thật: TTFT 1.2–1.7 giây, tổng thời gian 3.1–6.7 giây.
- [x] **Pha 5**: Thành viên A kết nối thử nghiệm Web Client nhận stream chữ SSE mượt mà, không giật lag. `[Chuyển sang TASK-A04 BUG-82]`

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [x] Endpoint `POST /api/v1/agent/chat` tuân thủ 100% hợp đồng API SSOT Mục 4.1 (`test_task08_streaming_trace.py` 12/12; benchmark kiểm tra `delta` ghép lại khớp `final_answer`).
- [x] Time-to-First-Thought $\le 2.0$ giây: đo được 1,2–1,7 giây. Tổng thời gian $\le 4.5$ giây chưa đạt (3,1–6,7 giây) `[Chuyển sang TASK-S2-BONUS BUG-92]`.
- [x] File `trace_waterfall.json` được sinh tự động với đầy đủ các mốc thời gian suy luận (ghi vào `TRACE_EXPORT_DIR`, không commit).
- [x] `[Chuyển sang TASK-S2-BONUS BUG-87, BUG-88]` Mọi câu trả lời có dùng RAG đều có `citations` không rỗng; mỗi `source_id` trong `citations` tồn tại trong `KnowledgeSources` và đang được duyệt (kiểm tra tự động trong `run_agent_benchmark.py`, không có URL nào do LLM tự sinh).
- [x] `[Chuyển sang TASK-S2-BONUS BUG-88]` Bộ kịch bản `run_agent_benchmark.py` đạt **15/15 lượt kiểm thử PASS (100%)**:
  - Không vi phạm PHI trong cả 3 lượt chạy của Ca 1.
  - Không sinh ảo giác hoạt chất cấm trong bất kỳ lượt chạy nào.
  - Mọi câu trả lời **có kê đơn thuốc** đều có tiền tố `[DRAFT_RECOMMENDATION]` (khớp TASK-07).
- [x] Bằng chứng nghiệm thu: Báo cáo Benchmark định lượng xuất dạng bảng Markdown và file log JSON lưu tại `tasks/sprint-02/benchmark_results.json`.
  - *Lần đo gần nhất*: benchmark 9/15 PASS (2026-11-08 09:33:31, Gemini `gemini-3.5-flash-lite`, Core giả lập theo danh mục seed (Core không chạy), RAG PostgreSQL (15 đoạn đã duyệt)); 0 lượt rơi về offline; trong 15 lượt Gemini chạy thật: TTFT 1.2–1.7 giây, tổng thời gian 3.1–6.7 giây. Ca chưa đạt: BENCH_03_TARGET_SPOT_RAG 0/3, BENCH_04_PEPPER_BACTERIAL_SPOT 0/3. Lý do: Trích dẫn rỗng hoặc không phải bài đang được duyệt.
  - *Lưu ý quota*: gói miễn phí Gemini giới hạn 15 request/phút, mỗi câu hỏi tốn 3–5 request; benchmark nghỉ `BENCH_PAUSE_SECONDS` (mặc định 20 giây) giữa các lượt.
