# 🌿 BẢN ĐẶC TẢ TẦM NHÌN SẢN PHẨM (VISION.MD)
## Hệ thống Lavitree: Nông Nghiệp Thông Minh Dựa Trên Trí Tuệ Nhân Tạo Có Giải Thích (XAI)
*Đồ án Tốt nghiệp Kỹ sư CNTT — Học viện Công nghệ Bưu chính Viễn thông (PTIT)*

---

### 1. 🎯 TUYÊN NGÔN SẢN PHẨM (ONE-LINER PITCH)
**LAVITREE** là hệ sinh thái nông nghiệp số tích hợp **2 Trụ cột Trí tuệ Nhân tạo đột phá**:  
1. **Thị giác Máy tính có Giải thích (Computer Vision & XAI)**: Chụp ảnh lá $\rightarrow$ Nhận diện 38 lớp bệnh cây $\rightarrow$ Trực quan hóa vùng nấm bằng ảnh nhiệt Grad-CAM.  
2. **Tác tử Khuyến Nông Tự hành (Autonomous Agri-Agent)**: ReAct Loop với MCP Tools (Thời tiết, Kho thuốc, Tri thức, Rà soát PHI) $\rightarrow$ Lập luận đa biến số sinh hướng dẫn xử lý cá nhân hóa $\rightarrow$ Gợi ý vật tư an toàn & Theo dõi phục hồi.

---

### 2. ⚠️ BỐI CẢNH & NỖI ĐAU THỰC TẾ (PROBLEM STATEMENT)
1. **Chẩn đoán cảm quan, sai trễ**: Nông dân phát hiện bệnh muộn khi nấm/vi khuẩn đã lan rộng cả luống, gây thất thoát 30–70% năng suất mùa vụ.
2. **Lạm dụng & dùng sai thuốc BVTV**: Mua thuốc theo truyền miệng, dùng sai hoạt chất, sai liều lượng, bỏ qua thời gian cách ly an toàn (PHI) làm thoái hóa đất và tồn dư độc tố trong nông sản.
3. **Hạn chế của các đề tài sinh viên cũ**:
   - Chỉ huấn luyện trên ảnh phòng thí nghiệm phông nền xám, khi đem ra đồng ruộng chụp thì tỷ lệ sai lệch rất cao (Domain Shift).
   - Mô hình là "hộp đen" (Black-box), không giải thích được lý do chẩn đoán.
   - Dừng lại ở việc dán nhãn phân loại, không có hướng dẫn xử lý khép kín và nguồn bài báo khoa học đối chứng.

---

### 3. 👥 ĐỐI TƯỢNG NGƯỜI DÙNG MỤC TIÊU (TARGET USERS)
- **Nông dân & Chủ vườn**: Cần công cụ chẩn đoán nhanh trên điện thoại di động tại ruộng, hướng dẫn xử lý dễ hiểu (tính theo bình 16 lít).
- **Cán bộ Khuyến Nông & Kỹ sư nông nghiệp**: Cần công cụ tra cứu tri thức bệnh cây, kiểm chứng nguồn tài liệu uy tín (từ Viện BVTV, Bộ NN&PTNT, University Extensions).
- **Đại lý Vật tư Nông nghiệp & HTX**: Tiếp nhận đơn đặt mua vật tư/thuốc đặc trị theo đúng phác đồ điều trị được gợi ý.

---

### 4. 🎯 MỤC TIÊU ĐỒ ÁN & PHẠM VI (SCOPE DEFINITION)

#### Trong phạm vi (In-Scope - Core MVP):
- Nhận diện **38 phân lớp** trên **14 loài cây trồng** chủ lực (Cà chua, Khoai tây, Ngô, Táo, Nho, Ớt chuông, Cam...).
- Trực quan hóa vùng tổn thương bằng **Grad-CAM (layer4[-1])**.
- Cơ chế cảnh báo độ bất định khi điểm tin cậy $< 70\%$ hoặc rơi vào lớp bệnh Tier 2/3.
- Cung cấp **Hướng dẫn xử lý chuẩn Khuyến nông & Quản lý dịch hại IPM** kèm **112 nguồn bài báo khoa học đối chứng**.
- **Tác tử Khuyến Nông Tự hành (Autonomous Agri-Agent)**: ReAct Loop, 4 công cụ chuẩn MCP (Thời tiết, Kho thuốc, Tri thức bệnh, Rà soát an toàn PHI), Boundary Guardrails và Streaming SSE.
- **Bảng Quan sát Vết thực thi (Agent Observability)**: Xem Waterfall Trace Log minh bạch hóa quá trình Agent suy luận.
- Hỗ trợ đa nền tảng: **Web Portal (React Vite)** và **Mobile App (Android Kotlin Jetpack Compose)**.
- Đóng gói Docker Compose chạy mượt mà **100% Offline** khi báo cáo trước Hội đồng chấm thi.

#### Ngoài phạm vi (Out-of-Scope - Tạm hoãn):
- Chẩn đoán qua thân, vỏ gỗ, củ ngầm hay hoa quả (chỉ tập trung phiến lá).
- Kết luận thay thế kết quả xét nghiệm sinh học phân tử (Lavitree đóng vai trò Decision Support Tool).
