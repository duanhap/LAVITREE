# TASK-05: THIẾT LẬP AGENT SERVICE (PORT 8001) & CẤU TRÚC MODEL CONTEXT PROTOCOL (MCP SERVER)
* **Sprint**: Sprint 2 (Trí tuệ Nhân tạo Tác tử & Hệ sinh thái MCP)
* **Thứ tự thực hiện trong Sprint**: **Ưu tiên số 2 (Triển khai sau khi Task 06 đã có Module RAG và dữ liệu 5 bệnh demo)**
* **Phân hệ**: `backend/agent-service` (FastAPI:8001) & `backend/core-api` (.NET 8)
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên B (Agent Core & FastMCP) & Thành viên A (Core API Data Provider)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi
* **Kế thừa từ nguyên mẫu**: `extract/DAY3/lavitree_mcp_server.py` & `extract/DAY26/lavitree_mcp_architecture.py`

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Mô tả ngắn**: Chuyển đổi prototype MCP Server từ `DAY3` và `DAY26` thành microservice `backend/agent-service` chính thức (FastAPI, chạy trên cổng **`8001`**, khớp 100% với `docker-compose.yml` và hợp đồng `docs/architecture/api-contracts.md` Mục 4). Tách rời hoàn toàn các công cụ nghiệp vụ nông nghiệp (Tools) khỏi LLM Core theo chuẩn Model Context Protocol (MCP).
- **Ranh giới quan trọng kế thừa từ DAY4**:
  - **Áp dụng nguyên tắc "Chặn ghi" (Read-Only Enforcement)**: Toàn bộ 4 công cụ của Agent chỉ có quyền đọc (Read-only query), tuyệt đối không thiết kế các tool có khả năng tạo đơn hàng, thanh toán hoặc chỉnh sửa CSDL.
  - **Thay thế dữ liệu giả (Mock Dicts)**: Chuyển toàn bộ dữ liệu mock trong `DAY3` (`DISEASE_DATABASE`, `PESTICIDE_INVENTORY`, `WEATHER_LIVE_API`) thành các lời gọi kết nối trực tiếp với:
    - Module Hybrid RAG cục bộ (Task 06) cho `lookup_disease_knowledge`.
    - Endpoint REST API thật từ `backend/core-api` (.NET 8) cho `query_pesticide_store` và `check_weather_risk`.
- **Tài liệu tham chiếu chuẩn**:
  - Hợp đồng API: [docs/architecture/api-contracts.md](../../docs/architecture/api-contracts.md) (Mục 4: Agent Service API:8001)
  - Kế hoạch Sprint 2: [docs/planning/sprint-02.md](../../docs/planning/sprint-02.md)

---

## 2. ĐẶC TẢ KỸ THUẬT & 4 CÔNG CỤ MCP (SPECIFICATIONS)

### Danh sách 4 MCP Tools (Định nghĩa chuẩn FastMCP / JSON Schema):

1. `lookup_disease_knowledge`:
   - *Mô tả*: Tra cứu tài liệu khoa học khuyến nông và cơ chế phát sinh bệnh học theo mã bệnh.
   - *Tham số*: `disease_code` (string, required — ví dụ `"Tomato___Late_blight"`), `query_focus` (string, optional — ví dụ `"biện pháp sinh học"`).
   - *Nguồn dữ liệu*: Module Hybrid RAG (Task 06) truy xuất từ PostgreSQL SSOT và ChromaDB cục bộ.
2. `check_weather_risk`:
   - *Mô tả*: Tra cứu nhiệt độ, độ ẩm và nguy cơ mưa rửa trôi thuốc BVTV tại địa phương trồng cây.
   - *Tham số*: `location` (string, required — ví dụ `"Hà Nam"`, `"Lâm Đồng"`), `forecast_hours` (integer, default 12).
   - *Nguồn dữ liệu*: Core API tích hợp OpenWeatherMap API kèm bộ đệm Memory Cache 1 giờ (đảm bảo độ trễ $\le 300$ms khi cache hit).
3. `query_pesticide_store`:
   - *Mô tả*: Tra cứu danh mục thuốc BVTV chính ngạch có sẵn trong kho, giá bán, thời gian cách ly (PHI) và đặc tính bám dính chống rửa trôi.
   - *Tham số*: `disease_code` (string, required), `require_rain_resistant` (boolean, optional).
   - *Nguồn dữ liệu*: Gọi endpoint `GET /api/v1/medicines/search` của Core API (.NET 8).
4. `verify_phi_safety`:
   - *Mô tả*: Kiểm tra an toàn thời gian cách ly (Pre-Harvest Interval - PHI). Kích hoạt báo động đỏ bảo thủ nếu số ngày còn lại đến kỳ thu hoạch $\le$ thời gian cách ly của thuốc ($DaysToHarvest \le PhiDays$).
   - *Tham số*: `harvest_days_left` (integer, required), `phi_days` (integer, required).
   - *Xử lý*: Thuật toán logic thuần Python, trả về `is_safe: bool`, `risk_level: "SAFE" | "CRITICAL_VIOLATION"`, `message: str`.

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)

### Phía Thành viên A (Core API & Data Provider):
- [ ] **Pha 1A**: Hoàn thiện endpoint `GET /api/v1/medicines/search` trong `backend/core-api` truy vấn bảng `Products` và `DiseaseProducts` theo `diseaseCode`, trả về danh sách thuốc bao gồm `Id`, `Name`, `ActiveIngredient`, `Price`, `DosageInstruction`, `PhiDays (int)`, `IsAllowed (bool)` và cờ chống rửa trôi.
- [ ] **Pha 1B**: Hoàn thiện Service thời tiết trong Core API tích hợp OpenWeatherMap API, áp dụng Memory Cache 1 giờ để tiết kiệm quota gọi API ngoài.

### Phía Thành viên B (Agent Core & MCP Server):
- [ ] **Pha 2A**: Khởi tạo cấu trúc microservice tại `backend/agent-service/` với FastAPI, Pydantic v2, Python 3.10+, bind cổng **`8001`**.
- [ ] **Pha 2B**: Cài đặt `backend/agent-service/app/mcp/server.py` sử dụng chuẩn FastMCP hoặc dispatcher JSON Schema.
- [ ] **Pha 2C**: Kết nối `lookup_disease_knowledge` trực tiếp với Facade `app.rag.pipeline` (Task 06).
- [ ] **Pha 2D**: Cài đặt HTTP Client (dùng `httpx`) trong `app.mcp.client` gọi Core API `GET /api/v1/medicines/search` và Service thời tiết.
- [ ] **Pha 2E**: Viết script kiểm thử độc lập `test_mcp_tools.py` để verify cả 4 công cụ phản hồi dữ liệu thật với status 200 OK.

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [ ] Service `backend/agent-service` khởi động thành công trên cổng **`8001`**, endpoint `GET /health` trả về `{"status": "ok", "service": "agent-service", "port": 8001}`.
- [ ] Cả 4 MCP Tools phản hồi với dữ liệu thật (không dùng mock dicts trong bộ nhớ):
  - `lookup_disease_knowledge` trả về kết quả RAG cho `Tomato___Late_blight`.
  - `query_pesticide_store` trả về danh sách thuốc từ Core API có đầy đủ `PhiDays` và `IsAllowed`.
  - `check_weather_risk` trả về thông tin thời tiết trong $\le 300$ms khi cache hit.
  - `verify_phi_safety` trả về `CRITICAL_VIOLATION` khi `harvest_days_left=2` và `phi_days=7`.
- [ ] Toàn bộ 4 tools tuân thủ nguyên tắc Read-Only 100%, không tồn tại mutation/write endpoint.
- [ ] Bằng chứng nghiệm thu: Log chạy `python test_mcp_tools.py` pass 4/4 công cụ với status 200 OK.
