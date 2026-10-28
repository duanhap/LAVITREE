# TASK-05: THIẾT LẬP AGENT SERVICE & CẤU TRÚC MODEL CONTEXT PROTOCOL (MCP SERVER)
* **Sprint**: Sprint 2 (Trí tuệ Nhân tạo Tác tử & Hệ sinh thái MCP)
* **Phân hệ**: `backend/agent-service` (FastAPI) & `backend/core-api` (.NET 8)
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên B (Agent Core) & Thành viên A (Data Provider)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi
* **Kế thừa từ nguyên mẫu**: `extract/DAY3/lavitree_mcp_server.py` & `extract/DAY26/lavitree_mcp_architecture.py`

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Mô tả ngắn**: Chuyển đổi prototype MCP Server từ `DAY3` và `DAY26` thành microservice `backend/agent-service` (FastAPI, chạy cổng 8002). Tách rời hoàn toàn các công cụ nghiệp vụ nông nghiệp (Tools) khỏi LLM Core theo chuẩn Model Context Protocol (MCP).
- **Ranh giới quan trọng kế thừa từ DAY4**:
  - **Áp dụng nguyên tắc "Chặn ghi" (Read-Only Enforcement)**: Toàn bộ 4 công cụ của Agent chỉ có quyền đọc (Read-only query), tuyệt đối không thiết kế các tool có khả năng tạo đơn hàng, thanh toán hoặc chỉnh sửa CSDL.
  - **Thay thế dữ liệu giả (Mock Dicts)**: Chuyển toàn bộ dữ liệu mock trong `DAY3` (`DISEASE_DATABASE`, `PESTICIDE_INVENTORY`, `WEATHER_LIVE_API`) thành các lời gọi REST API kết nối trực tiếp với `backend/core-api` (.NET 8) và dịch vụ thời tiết thật.
- **Tài liệu tham chiếu chuẩn**:
  - Hợp đồng API: [docs/architecture/api-contracts.md](../../docs/architecture/api-contracts.md) (Mục 4: Agent Service API)
  - Kế hoạch Sprint 2: [docs/planning/sprint-02.md](../../docs/planning/sprint-02.md)


---

## 2. ĐẶC TẢ KỸ THUẬT & 4 CÔNG CỤ MCP (SPECIFICATIONS)

### Danh sách 4 MCP Tools chuẩn JSON Schema:
1. `lookup_disease_knowledge`:
   - *Mô tả*: Tra cứu tài liệu khoa học chuẩn khuyến nông và thông tin mầm bệnh theo mã bệnh hoặc triệu chứng.
   - *Tham số*: `disease_id` (string, required).
   - *Nguồn dữ liệu*: Kết nối với Module Hybrid RAG (Task 06) truy xuất 112 tài liệu khuyến nông.
2. `check_weather_risk`:
   - *Mô tả*: Tra cứu nhiệt độ, độ ẩm và nguy cơ mưa rửa trôi thuốc BVTV tại địa phương trồng cây.
   - *Tham số*: `province_name` (string, required).
   - *Nguồn dữ liệu*: Core API gọi OpenWeatherMap (hoặc mock weather provider nếu offline), có cơ chế cache 1 giờ.
3. `query_pesticide_store`:
   - *Mô tả*: Tra cứu danh mục thuốc bảo vệ thực vật chính ngạch có sẵn trong kho, giá bán và đặc tính bám dính chống rửa trôi.
   - *Tham số*: `disease_id` (string, required), `require_rain_resistant` (boolean, optional).
   - *Nguồn dữ liệu*: Gọi endpoint `GET /api/v1/medicines/search` của Core API.
4. `verify_phi_safety`:
   - *Mô tả*: Kiểm tra an toàn thời gian cách ly (Pre-Harvest Interval - PHI). Kích hoạt báo động đỏ nếu số ngày còn lại đến kỳ thu hoạch $\le$ thời gian cách ly của thuốc.
   - *Tham số*: `days_until_harvest` (integer, required), `pesticide_phi_days` (integer, required).
   - *Xử lý*: Thuật toán logic nội bộ, trả về `is_safe: bool`, `risk_level: "SAFE" | "CRITICAL_VIOLATION"`, `action_required: str`.

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)

### Phía Thành viên A (Core API & Data Provider):
- [ ] **Pha 1A**: Viết endpoint `GET /api/v1/medicines/search` trong `backend/core-api` truy vấn bảng `Products` và `DiseaseProducts` theo mã bệnh, trả về danh sách thuốc, hoạt chất, giá bán, đặc tính chống rửa trôi và thời gian cách ly (PHI).
- [ ] **Pha 1B**: Viết Service thời tiết trong Core API tích hợp OpenWeatherMap API, áp dụng Memory Cache 1 giờ để tiết kiệm quota gọi API.

### Phía Thành viên B (Agent Core & MCP Server):
- [ ] **Pha 2A**: Khởi tạo cấu trúc dự án `backend/agent-service/` với FastAPI, Pydantic v2, Python 3.10+.
- [ ] **Pha 2B**: Chuyển mã nguồn `extract/DAY3/lavitree_mcp_server.py` vào `backend/agent-service/app/mcp/server.py`.
- [ ] **Pha 2C**: Cài đặt `MCPToolDispatcher` để chuyển hướng các lệnh gọi tool sang REST Client gọi Core API (thay cho mock data).
- [ ] **Pha 2D**: Viết script kiểm thử độc lập `test_mcp_tools.py` để verify cả 4 công cụ phản hồi dữ liệu thật với status 200 OK.

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [ ] Service `backend/agent-service` khởi động thành công trên cổng `8002`, có endpoint health check `GET /health` trả về status ok.
- [ ] Cả 4 MCP Tools thực thi thành công thông qua `test_mcp_tools.py` với dữ liệu trả về từ Core API thật.
- [ ] Xác nhận không có bất kỳ tool nào có quyền ghi hay sửa đổi cơ sở dữ liệu (Tuân thủ Read-only).
- [ ] Bằng chứng nghiệm thu: Xuất log chạy `test_mcp_tools.py` pass 4/4 công cụ với latency mỗi tool $< 300$ms.
