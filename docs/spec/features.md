# 📋 ĐẶC TẢ TÍNH NĂNG HỆ THỐNG (FEATURES.MD)
## Hệ thống Lavitree — 2 Trụ Cột Công Nghệ & Các Phân Hệ Quản Trị

---

## 🏛️ TRỤ CỘT 1: THỊ GIÁC MÁY TÍNH & XAI (COMPUTER VISION & XAI ENGINE)
*Vòng lặp khép kín 4 bước giúp người dùng chẩn đoán bệnh tức thì và nhận hướng dẫn xử lý*

```text
[📸 1. Chụp ảnh lá] ──> [🔍 2. AI Chẩn đoán + Grad-CAM] ──> [📋 3. Hướng dẫn xử lý chuẩn Khuyến nông (IPM)] ──> [🛒 4. Vật tư & Theo dõi phục hồi]
```

#### FEAT-01: Chụp ảnh lá với Khung ngắm định hướng (Camera Viewport Constraint)
- **Mục tiêu**: Loại bỏ nhiễu nền dã ngoại (đất cát, cỏ dại, bàn tay cầm lá).
- **Mô tả**: Trên Mobile App (CameraX) và Web Camera, hiển thị khung chữ nhật định hướng yêu cầu đưa lá lại gần (khoảng cách 15–20cm), chiếm $\ge 70\%$ diện tích khung hình.
- **Quy tắc**: Cảnh báo nếu ảnh quá tối hoặc bị rung mờ trước khi gửi.

#### FEAT-02: Nhận diện bệnh cây bằng AI & Trực quan hóa Grad-CAM
- **Mục tiêu**: Đưa ra kết quả chẩn đoán minh bạch, có giải thích.
- **Mô tả**:
  - Nhận diện 38 phân lớp trên mô hình ResNet-18 trong thời gian $< 0.5$ giây.
  - Trả về Top-1 (kèm độ tin cậy) và Top-3 ứng viên.
  - Sinh bản đồ nhiệt **Grad-CAM (layer4[-1])** phủ màu Jet lên ảnh gốc, chỉ rõ vùng đốm bệnh kích hoạt mạng nơ-ron.
  - **Cơ chế chống đoán bừa (Uncertainty Check)**: Nếu độ tin cậy $< 70\%$ hoặc thuộc lớp Tier 2/3, hệ thống tự động gắn nhãn cảnh báo nghi ngờ và khuyến nghị chụp lại.

#### FEAT-03: Hướng dẫn xử lý theo từng cây – tình trạng bệnh (Chuẩn Khuyến nông & IPM)
- **Mục tiêu**: Cung cấp giải pháp xử lý linh hoạt, chuẩn phương pháp Quản lý dịch hại tổng hợp (IPM), tránh lạm dụng hóa chất.
- **Mô tả**:
  - *Biện pháp Canh tác & Cơ học*: Vệ sinh đồng ruộng, cách ly và cắt tỉa cành hoại tử để ngăn chặn mầm bệnh lây lan (áp dụng cho cả cây bệnh lẫn cây khỏe).
  - *Biện pháp Hóa sinh & Sinh học (khi có nguồn phù hợp)*: Khuyến nghị các hoạt chất được phép lưu hành tại Việt Nam, hướng dẫn tỷ lệ pha bình 16L tham khảo, nhấn mạnh thời gian cách ly an toàn (PHI). *Đối với 12 lớp cây khỏe, tuyệt đối không gợi ý thuốc hóa học.*
  - *Biện pháp Phục hồi & Dinh dưỡng*: Chế độ bón phân cân đối, bổ sung vi sinh đối kháng (*Trichoderma*, *Bacillus*) để phục hồi hệ đệm của đất và tăng sức đề kháng của cây.
  - **Minh bạch tri thức**: Mỗi nội dung hướng dẫn đều ghi rõ nguồn tham khảo chính thống (Cục Bảo vệ Thực vật, Viện BVTV, Trung tâm Khuyến nông Quốc gia, University Extensions) trích xuất từ 112 bản ghi `KnowledgeSources_rows.csv`.

#### FEAT-04: Vật tư Nông nghiệp phù hợp & Nhật ký phục hồi (Supplies & Tracking)
- **Mục tiêu**: Gợi ý vật tư/thuốc đặc trị phù hợp và theo dõi tiến triển khỏi bệnh.
- **Mô tả**:
  - Gợi ý các loại vật tư/chế phẩm/thuốc BVTV phù hợp có sẵn tại đại lý liên kết (hỗ trợ thanh toán COD / VietQR, có bước người dùng xác nhận).
  - Lưu lượt khám vào **Nhật ký bệnh (Diagnosis History)**: cho phép nông dân chụp ảnh lại sau 3–5 ngày để theo dõi tiến triển phục hồi của cây trồng.

---

## 🧠 TRỤ CỘT 2: TÁC TỬ NÔNG NGHIỆP THÔNG MINH (AUTONOMOUS AGRI-AGENT & MCP TOOLS)
*Kế thừa trọn vẹn kết quả nghiên cứu 27 DAY từ thư mục `extract/`: ReAct Loop, MCP Protocol, Boundary Guardrails & Observability*

#### FEAT-05: Tác tử Khuyến Nông Đa Công Cụ (Autonomous Agri-Agent with ReAct Loop)
- **Mục tiêu**: Tư vấn giải quyết các ca bệnh thực tế phức tạp ngoài đồng ruộng bằng cơ chế lập luận đa biến số (thời tiết, ngày thu hoạch, tồn kho thuốc).
- **Mô hình hoạt động**:
  - **ReAct Loop (Reasoning + Acting)**: Hoạt động theo chu trình khép kín:
    $$\text{User Query} \longrightarrow \text{Thought} \longrightarrow \text{Action (Call Tool)} \longrightarrow \text{Observation} \longrightarrow \text{Final Answer}$$
  - **Giao thức Model Context Protocol (MCP)**: Tách rời bộ não AI và công cụ thực thi. MCP Server cung cấp 4 công cụ chuẩn hóa JSON Schema:
    1. `lookup_disease_knowledge`: Tra cứu tri thức chuẩn từ cơ sở dữ liệu PostgreSQL (112 bài báo, 38 lớp bệnh).
    2. `check_weather_risk`: Gọi API thời tiết để kiểm tra nhiệt độ, độ ẩm và dự báo mưa (cảnh báo hoãn phun nếu sắp mưa to để tránh rửa trôi thuốc).
    3. `query_pesticide_store`: Tra cứu thuốc đặc trị tại kho đại lý liên kết, số lượng tồn kho và giá niêm yết.
    4. `verify_phi_safety`: Kiểm tra khoảng cách ngày dự kiến thu hoạch của nông dân với thời gian cách ly PHI của thuốc (chặn thuốc độc hại).
  - **Bộ chốt chặn ranh giới an toàn (Boundary Guardrails - Kế thừa DAY 2)**:
    - *Chặn thuốc sát ngày thu hoạch*: Nếu ngày thu hoạch $\le 3$ ngày, Agent kiên quyết từ chối kê thuốc hóa học, ép chuyển sang chế phẩm sinh học hoặc biện pháp cơ học.
    - *Human-in-the-loop*: Mọi đề xuất mua thuốc đều gắn thẻ `[DRAFT_RECOMMENDATION]`, chỉ tạo đơn khi người dùng bấm xác nhận.
    - *Chống lạc đề (Off-topic Filter)*: Từ chối các câu hỏi nằm ngoài lĩnh vực nông nghiệp, cây trồng.
  - **Hạ cấp an toàn (Graceful Degradation - Kế thừa DAY 2)**:
    - 80% câu hỏi tra cứu thông thường $\rightarrow$ Trả lời từ Cache/Workflow tĩnh (0đ token, phản hồi tức thì 0.05s).
    - 20% ca đa biến số $\rightarrow$ Kích hoạt ReAct Agent gọi Tool.
    - Mất mạng internet $\rightarrow$ Fallback 100% về chế độ Rule Offline.
  - **Truyền phát thời gian thực (Streaming SSE - Kế thừa DAY 1)**: Phản hồi từng từ qua Server-Sent Events (SSE) với độ trễ First-Token $< 0.4$ giây, tối ưu cho 4G dã ngoại.

---

## 📊 3. PHÂN HỆ QUẢN TRỊ & GIÁM SÁT (ADMIN & OBSERVABILITY)

#### FEAT-06: Sổ tay Bệnh cây trồng (Handbook tra cứu offline)
- Cho phép tra cứu danh mục 14 loài cây và 38 phân lớp bệnh học mọi lúc mà không cần tải ảnh.
- Tích hợp bộ lọc theo loài cây (Cà chua, Khoai tây, Ngô, Táo, Nho...) và tác nhân (Nấm, Vi khuẩn, Virus, Khỏe mạnh).

#### FEAT-07: Bảng Quan sát Vết thực thi của Agent (Agent Observability & Waterfall Trace Dashboard)
- **Mục tiêu**: Minh bạch hóa toàn bộ quá trình Agent suy luận trước hội đồng chấm thi và kỹ sư hệ thống (Kế thừa DAY 3).
- **Mô tả**:
  - Giao diện Admin hiển thị biểu đồ dòng thời gian (Waterfall Chart) chi tiết từng bước: `Thought` mất bao lâu, `Action` gọi tool nào, tham số gì, `Observation` nhận dữ liệu gì, tổng latency (ms) và số lượng token tiêu thụ.
  - Cho phép xuất file `trace_waterfall.json` phục vụ báo cáo khoa học.

#### FEAT-08: Cổng Quản trị Thu thập Tri thức (Knowledge Collector Dashboard)
- Giao diện Admin quản lý các nguồn tri thức URL (`KnowledgeCollectorPage.tsx`).
- Kiểm tra độ uy tín tên miền (gov.vn, extension.edu...), duyệt bài báo và xuất dữ liệu CSV.
