# 📋 DANH SÁCH TÍNH NĂNG CỐT LÕI (FEATURES.MD)
## Hệ thống Lavitree — Phân rã tính năng MVP (Khép kín 4 Bước)

---

### 1. VÒNG LẶP NGHIỆP VỤ CỐT LÕI (CORE 4-STEP LOOP)

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
  - Nhận diện 38 phân lớp trên mô hình ResNet18 trong thời gian $< 0.5$ giây.
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

### 2. CÁC TÍNH NĂNG BỔ TRỢ & QUẢN TRỊ (SUPPORTING FEATURES)

#### FEAT-05: Sổ tay Bệnh cây trồng (Handbook tra cứu offline)
- Cho phép tra cứu danh mục 14 loài cây và 38 phân lớp bệnh học mọi lúc mà không cần tải ảnh.
- Tích hợp bộ lọc theo loài cây (Cà chua, Khoai tây, Ngô, Táo, Nho...) và tác nhân (Nấm, Vi khuẩn, Virus, Khỏe mạnh).

#### FEAT-06: Trợ lý Khuyến Nông thông minh (Agri-Agent Chatbot)
- Trợ lý ảo tư vấn giải đáp thắc mắc bằng giọng văn gần gũi, hỗ trợ Streaming SSE trả lời từng chữ mượt mà.
- Tích hợp **Boundary Guardrails (DAY 2)**: Chặn câu hỏi ngoài ngành nông nghiệp và fallback offline khi không có internet.

#### FEAT-07: Cổng Quản trị Thu thập Tri thức (Knowledge Collector Dashboard)
- Giao diện Admin quản lý các nguồn tri thức URL (`KnowledgeCollectorPage.tsx`).
- Kiểm tra độ uy tín tên miền (gov.vn, extension.edu...), duyệt bài báo và xuất dữ liệu CSV.
