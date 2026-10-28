# 📋 ĐẶC TẢ TÍNH NĂNG HỆ THỐNG (FEATURES.MD)
## Hệ thống Lavitree — 2 Trụ Cột Công Nghệ, Chuỗi Cửa Hàng Trực Tiếp & Phân Hệ Quản Trị

---

## 🏛️ TRỤ CỘT 1: THỊ GIÁC MÁY TÍNH & XAI (COMPUTER VISION & XAI ENGINE)
*Vòng lặp khép kín 4 bước giúp người dùng chẩn đoán bệnh tức thì và nhận hướng dẫn xử lý*

```text
[📸 1. Chụp ảnh lá] ──> [🔍 2. AI Chẩn đoán + Grad-CAM] ──> [📋 3. Hướng dẫn xử lý chuẩn Khuyến nông (IPM)] ──> [🛒 4. Vật tư Lavitree Store & Theo dõi]
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
  - **Cơ chế chống đoán bừa (Uncertainty Check)**: Nếu độ tin cậy $< 70\%$, hệ thống gắn cờ `is_uncertain` và khuyến nghị chụp lại. Mỗi lớp có mẹo chụp riêng (`Capture_Tip`); các lớp dễ nhầm (Early blight ↔ Target spot) luôn hiện Top-3. Chi tiết: `docs/spec/classes.md`.

#### FEAT-03: Hướng dẫn xử lý theo từng cây – tình trạng bệnh (Chuẩn Khuyến nông & IPM)
- **Mục tiêu**: Cung cấp giải pháp xử lý linh hoạt, chuẩn phương pháp Quản lý dịch hại tổng hợp (IPM), tránh lạm dụng hóa chất.
- **Mô tả**:
  - *Biện pháp Canh tác & Cơ học*: Vệ sinh đồng ruộng, cách ly và cắt tỉa cành hoại tử để ngăn chặn mầm bệnh lây lan (áp dụng cho cả cây bệnh lẫn cây khỏe).
  - *Biện pháp Hóa sinh & Sinh học (khi có nguồn phù hợp)*: Khuyến nghị các hoạt chất được phép lưu hành tại Việt Nam, hướng dẫn tỷ lệ pha bình 16L tham khảo, nhấn mạnh thời gian cách ly an toàn (PHI). *Đối với 12 lớp cây khỏe, tuyệt đối không gợi ý thuốc hóa học.*
  - *Biện pháp Phục hồi & Dinh dưỡng*: Chế độ bón phân cân đối, bổ sung vi sinh đối kháng (*Trichoderma*, *Bacillus*) để phục hồi hệ đệm của đất và tăng sức đề kháng của cây.
  - **Chính sách Bản quyền & Minh bạch tri thức (Curated Knowledge & Academic Citation)**:
    - Tri thức nông học và quy trình kỹ thuật thuộc phạm vi phổ biến cộng đồng (Public Domain / Extension Knowledge) theo Điều 15 Luật SHTT Việt Nam.
    - Mỗi nội dung hướng dẫn đều ghi rõ nguồn tham khảo chính thống và đường dẫn gốc (Cục Bảo vệ Thực vật `ppd.gov.vn`, Viện BVTV `vipp.org.vn`, Trung tâm Khuyến nông Quốc gia `khuyennongvn.gov.vn`, University Extensions) trích xuất từ 112 bản ghi `KnowledgeSources_rows.csv`.
    - Đội ngũ Kỹ sư Nông nghiệp Lavitree đóng vai trò **Hội đồng Thẩm định & Chọn lọc (Expert Curators)**, loại bỏ các hoạt chất cũ đã bị Bộ NN&PTNT cấm lưu hành.

#### FEAT-04: Cửa hàng Cung ứng Vật tư Lavitree Store
- **Mục tiêu**: Cung cấp thuốc BVTV và chế phẩm sinh học được cấp phép lưu hành, hỗ trợ giao hàng tận vườn.
- **Mô hình vận hành**:
  - Lavitree tích hợp phân hệ **Cửa hàng Cung ứng Vật tư & Chế phẩm Nông nghiệp** trực tiếp từ các đơn vị phân phối chính thức, đảm bảo nguồn gốc xuất xứ rõ ràng.
  - Tự động gợi ý xuất kho từ **Chi nhánh / Kho Lavitree gần nhất** (Kho Hà Nội, Kho Lâm Đồng, Kho Cần Thơ) để giảm chi phí vận chuyển.
  - Hỗ trợ thanh toán: COD (nhận hàng kiểm tra thanh toán) hoặc chuyển khoản VietQR tự động.

---

## 🧠 TRỤ CỘT 2: TRỢ LÝ TÁC TỬ NÔNG NGHIỆP (AGRI-AGENT & MCP TOOLS)
*Kế thừa trọn vẹn kết quả nghiên cứu 27 DAY từ thư mục `extract/`: ReAct Loop, MCP Protocol, Boundary Guardrails, Escalation & Observability*

#### FEAT-05: Tác tử Khuyến Nông Đa Công Cụ & Chuyển Giao Bác Sĩ (ReAct & Seamless Handover)
- **Mục tiêu**: Tư vấn dã ngoại đa biến số và tự động chuyển giao ca khó cho Bác sĩ con người trong cùng một luồng hội thoại.
- **Mô hình hoạt động**:
  - **1 Khung Chat Duy Nhất**: Nông dân không phải chuyển tab; toàn bộ trao đổi với AI hay với Bác sĩ người đều diễn ra tại một cửa sổ duy nhất.
  - **ReAct Loop (Reasoning + Acting - DAY 3)**:
    $$\text{User Query} \longrightarrow \text{Thought} \longrightarrow \text{Action (Call Tool)} \longrightarrow \text{Observation} \longrightarrow \text{Final Answer}$$
  - **Giao thức Model Context Protocol (MCP)**: Cung cấp 4 công cụ chuẩn hóa JSON Schema:
    1. `lookup_disease_knowledge`: Tra cứu tri thức chuẩn từ cơ sở dữ liệu PostgreSQL (112 bài báo, 38 lớp bệnh).
    2. `check_weather_risk`: Gọi API thời tiết kiểm tra nguy cơ mưa ẩm (cảnh báo hoãn phun thuốc nếu sắp mưa to để tránh rửa trôi).
    3. `query_pesticide_store`: Tra cứu thuốc đặc trị tại kho Lavitree gần nhất, số lượng tồn kho và giá niêm yết.
    4. `verify_phi_safety`: Kiểm tra khoảng cách ngày dự kiến thu hoạch của nông dân với thời gian cách ly PHI của thuốc (chặn thuốc độc hại).
  - **Chốt chặn an toàn (Boundary Guardrails - DAY 2)**:
    - *Chặn thuốc sát ngày thu hoạch*: Nếu ngày thu hoạch $\le 3$ ngày, Agent kiên quyết từ chối kê thuốc hóa học, ép chuyển sang chế phẩm sinh học hoặc biện pháp cơ học.
    - *Human-in-the-loop*: Mọi đề xuất mua thuốc đều gắn thẻ `[DRAFT_RECOMMENDATION]`, chỉ tạo đơn khi người dùng bấm xác nhận.
    - *Chống lạc đề*: Từ chối các câu hỏi nằm ngoài lĩnh vực nông nghiệp, cây trồng.
  - **Cơ chế Chuyển Giao Bác Sĩ Con Người (Seamless Handover / Escalation Policy)**:
    - Khi điểm tin cậy $< 70\%$, vết bệnh dị thường, hoặc nông dân bấm nút *"Yêu cầu Kỹ sư tư vấn"*:
    - Agent lịch sự thông báo chuyển ca, đồng thời gửi thông báo kèm hồ sơ chẩn đoán lên Admin Dashboard của Bác sĩ Lavitree.
    - Bác sĩ con người nhắn tin trực tiếp vào khung chat của nông dân với huy hiệu uy tín `[👨‍⚕️ Kỹ Sư Nông Nghiệp Lavitree]`.

#### FEAT-06: Lập Kế Hoạch Chăm Sóc & Nhật Ký Theo Dõi Phục Hồi (Crop Care Planner & Recovery Tracking)
- **Mục tiêu**: Đồng hành xuyên suốt vòng đời cây trồng, tăng tỷ lệ gắn kết (Retention) và tái mua sắm vật tư định kỳ.
- **Mô tả 2 nhánh nghiệp vụ**:
  - **Nhánh 1: Theo dõi phục hồi sau trị bệnh (Dành cho cây bệnh)**:
    - Sau chẩn đoán, hệ thống tạo lịch hẹn kiểm tra lại sau 3–5 ngày.
    - Nông dân chụp lại ảnh cùng chiếc lá đó $\rightarrow$ Vision AI so sánh ảnh Ngày 1 vs Ngày 4 để đánh giá tiến triển: *Vết nấm khô giòn mép (Hồi phục 75%)* hoặc *Nấm lan rộng (Cảnh báo đổi hoạt chất)*.
  - **Nhánh 2: Lập kế hoạch chăm sóc cây định kỳ (Dành cho 12 lớp cây khỏe `___healthy`)**:
    - Nông dân khai báo ngày tuổi cây (ví dụ: Vườn cà chua 25 ngày tuổi).
    - AI Agent tự động sinh Lịch trình chăm sóc chuẩn Khuyến nông: Thời điểm tưới nước, bón thúc NPK, tỉa chồi nách, bón Canxi-Bo chống rụng hoa.
    - AI Agent đóng vai trò **Trợ lý nhắc việc thông minh**, gửi lời nhắc kèm điều kiện thời tiết thực tế.

---

## 📊 3. PHÂN HỆ QUẢN TRỊ & GIÁM SÁT (ADMIN & OBSERVABILITY)

#### FEAT-07: Sổ tay Bệnh cây trồng (Handbook tra cứu offline)
- Cho phép tra cứu danh mục 14 loài cây và 38 phân lớp bệnh học mọi lúc mà không cần tải ảnh.
- Tích hợp bộ lọc theo loài cây (Cà chua, Khoai tây, Ngô, Táo, Nho...) và tác nhân (Nấm, Vi khuẩn, Virus, Khỏe mạnh).

#### FEAT-08: Bảng Quan sát Vết thực thi của Agent (Agent Observability & Waterfall Trace Dashboard)
- **Mục tiêu**: Minh bạch hóa toàn bộ quá trình Agent suy luận trước hội đồng chấm thi và kỹ sư hệ thống (Kế thừa DAY 3).
- **Mô tả**:
  - Giao diện Admin hiển thị biểu đồ dòng thời gian (Waterfall Chart) chi tiết từng bước: `Thought` mất bao lâu, `Action` gọi tool nào, tham số gì, `Observation` nhận dữ liệu gì, tổng latency (ms) và số lượng token tiêu thụ.
  - Cho phép xuất file `trace_waterfall.json` phục vụ báo cáo khoa học.

#### FEAT-09: Cổng Quản trị Thu thập & Thẩm định Tri thức (Knowledge Collector Dashboard)
- Giao diện Admin quản lý các nguồn tri thức URL (`KnowledgeCollectorPage.tsx`).
- Cho phép Kỹ sư Nông nghiệp Lavitree duyệt bài báo, kiểm tra tên miền (.gov.vn, .edu) và xuất dữ liệu CSV.
