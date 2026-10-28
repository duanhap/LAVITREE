# TASK-08: STREAMING SSE, WATERFALL TRACE LOGGING & BENCHMARK NGHIỆM THU ĐỒ ÁN
* **Sprint**: Sprint 2 (Trí tuệ Nhân tạo Tác tử & Hệ sinh thái MCP)
* **Phân hệ**: `backend/agent-service` (FastAPI) & Client Test
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên B (Agent Core) & Thành viên A (Client Integration)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi
* **Kế thừa từ nguyên mẫu**: `extract/DAY1`, `extract/DAY3/lavitree_trace_waterfall.json`, `extract/DAY26/lavitree_mcp_benchmark.py`

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Vấn đề trải nghiệm**: Vòng lặp ReAct gọi nhiều công cụ (tra cứu tri thức, thời tiết, kho thuốc, kiểm tra an toàn) có thể mất từ 3 đến 6 giây để hoàn tất. Nếu bắt người dùng hoặc Hội đồng chấm thi chờ đợi màn hình trắng sẽ tạo cảm giác ứng dụng bị đơ/lag.
- **Giải pháp kế thừa từ DAY1 & DAY3**:
  1. **Server-Sent Events (SSE) Streaming**: Truyền phát tức thời từng bước suy luận (`Thought`, `Tool Calling`, `Observation`) và từng token văn bản của câu trả lời cuối cùng (`Final Answer`) tới client ngay khi chúng được sinh ra. Thời gian xuất hiện ký tự đầu tiên (Time-to-First-Token) $\le 2.0$ giây.
  2. **Waterfall Trace Logging (Minh bạch hóa XAI)**: Tự động ghi nhận chi tiết cây tiến trình thực thi vào file `trace_waterfall.json`. Đo đạc chính xác thời gian chạy từng Tool ($ms$), số lượng prompt/completion token và chi phí API, phục vụ trình diễn trước Hội đồng chấm thi.
  3. **Benchmark Đánh giá Định lượng**: Chạy bộ kịch bản tự động trên 5 ca lâm sàng dã ngoại (kế thừa từ `DAY26/lavitree_mcp_benchmark.py`) để đo lường các chỉ số cốt lõi: Tỷ lệ tuân thủ PHI (100%), tỷ lệ chọn đúng thuốc (100%), thời gian phản hồi trung bình.

---

## 2. ĐẶC TẢ KỸ THUẬT & HỢP ĐỒNG API (SPECIFICATIONS)

### Endpoint: `POST /api/v1/agent/chat` (Hợp đồng SSOT: `api-contracts.md` Mục 4.1)
- **Headers**: `Accept: text/event-stream`, `Cache-Control: no-cache`
- **Request Body**:
  ```json
  {
    "session_id": "session_farm_01",
    "query": "Cà chua bị mốc sương, sắp mưa rồi có nên xịt Ridomil Gold không?",
    "diagnosis_context": {
      "disease_code": "Tomato___Late_blight",
      "plant_name": "Cà chua",
      "days_until_harvest": 5
    }
  }
  ```
- **SSE Event Stream Payload**:
  - `event: thought`: `{"step": 1, "content": "Phân tích điều kiện thời tiết tại địa phương..."}`
  - `event: action`: `{"tool": "check_weather_risk", "args": {"province_name": "Đà Lạt"}}`
  - `event: observation`: `{"humidity": 92, "rain_risk": "Cao"}`
  - `event: token`: `{"text": "Chào "}` $\rightarrow$ `{"text": "bà "}` $\rightarrow$ `{"text": "con, "}`
  - `event: done`: `{"trace_id": "tr_99182", "total_latency_ms": 3200, "phi_safe": false}`

### Cấu trúc File `trace_waterfall.json` (Xuất sau mỗi phiên chẩn đoán):
```json
{
  "trace_id": "tr_20261028_01",
  "query": "Cà chua mốc sương sát ngày thu hoạch",
  "total_duration_ms": 3410,
  "steps": [
    {"phase": "Thought_1", "duration_ms": 420},
    {"phase": "Tool_check_weather", "duration_ms": 610},
    {"phase": "Tool_query_pesticide", "duration_ms": 310},
    {"phase": "Guardrail_verify_phi", "duration_ms": 15},
    {"phase": "Final_Answer_Generation", "duration_ms": 2045}
  ],
  "safety_audit": {
    "phi_violation_detected": true,
    "chemical_pesticide_blocked": true,
    "draft_recommendation_applied": true
  }
}
```

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [ ] **Pha 1 (Thành viên B)**: Cài đặt endpoint `POST /api/v1/agent/chat` trong FastAPI sử dụng `StreamingResponse` (media_type="text/event-stream").
- [ ] **Pha 2 (Thành viên B)**: Tích hợp module `WaterfallTracer` ghi nhận timestamp và duration của từng bước ReAct.
- [ ] **Pha 3 (Thành viên B)**: Kế thừa `extract/DAY26/lavitree_mcp_benchmark.py` để tạo script kiểm thử `run_agent_benchmark.py` chạy qua 5 ca kiểm thử thực tế.
- [ ] **Pha 4 (Thành viên A)**: Viết script test client Python/PowerShell gửi request SSE stream và in từng token ra console mượt mà.
- [ ] **Pha 5**: Đo kiểm hiệu năng: Đảm bảo Time-to-First-Token $\le 2.0$s và tổng thời gian phản hồi $\le 4.5$s.

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [ ] Endpoint `POST /api/v1/agent/chat` truyền stream SSE ổn định, không bị đứt kết nối giữa chừng.
- [ ] File `trace_waterfall.json` được tự động sinh ra sau mỗi lượt tương tác, ghi nhận đầy đủ chi tiết các bước.
- [ ] Script `run_agent_benchmark.py` chạy thành công 5/5 ca lâm sàng, xuất báo cáo chỉ số an toàn đạt 100%.
- [ ] Bằng chứng nghiệm thu: Video demo hoặc log streaming token hiển thị trực quan và file `trace_waterfall.json` đầy đủ các mốc thời gian.
