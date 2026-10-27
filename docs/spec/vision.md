# 🌿 BẢN ĐẶC TẢ TẦM NHÌN SẢN PHẨM (VISION.MD)
## Hệ thống Lavitree: Nông Nghiệp Thông Minh Dựa Trên Trí Tuệ Nhân Tạo Có Giải Thích (XAI)
*Đồ án Tốt nghiệp Kỹ sư CNTT — Học viện Công nghệ Bưu chính Viễn thông (PTIT)*

---

### 1. 🎯 TUYÊN NGÔN SẢN PHẨM (PRODUCT STATEMENT)
**LAVITREE** là hệ thống nông nghiệp số tích hợp **2 thành phần Trí tuệ Nhân tạo bổ trợ**:  
1. **Thị giác Máy tính có Giải thích (Computer Vision & XAI)**: Chụp ảnh lá $\rightarrow$ Phân loại 38 lớp cây trồng & bệnh học bằng ResNet-18 $\rightarrow$ Trực quan hóa vùng nấm kích hoạt nơ-ron bằng ảnh nhiệt Grad-CAM.  
2. **Trợ lý Tác tử Khuyến Nông (Agri-Agent)**: Vòng lặp ReAct kết hợp công cụ MCP (Thời tiết, Kho thuốc, Tri thức nông học, Kiểm tra an toàn PHI) $\rightarrow$ Lập luận theo ngữ cảnh thực địa để tư vấn biện pháp xử lý $\rightarrow$ Gợi ý vật tư phù hợp và theo dõi phục hồi.

---

### 2. ⚠️ BỐI CẢNH & VẤN ĐỀ THỰC TẾ (PROBLEM STATEMENT)
1. **Chẩn đoán cảm quan, sai trễ**: Nông dân phát hiện bệnh muộn khi nấm/vi khuẩn đã lan rộng cả luống, gây thất thoát 30–70% năng suất mùa vụ.
2. **Lạm dụng & dùng sai thuốc BVTV**: Mua thuốc theo truyền miệng, dùng sai hoạt chất, sai liều lượng, bỏ qua thời gian cách ly an toàn (PHI) làm thoái hóa đất và tồn dư độc tố trong nông sản.
3. **Hạn chế kỹ thuật của các giải pháp trước đây**:
   - Huấn luyện thuần túy trên ảnh phòng thí nghiệm phông nền xám đơn sắc (PlantVillage); khi đưa ra môi trường đồng ruộng tự nhiên gặp hiện tượng suy giảm hiệu năng do dịch chuyển miền dữ liệu (Domain Shift) và học đường tắt theo nền (Shortcut Learning).
   - Mô hình phân loại đơn tầng đóng vai trò "hộp đen" (Black-box), thiếu khả năng giải thích trực quan vị trí tổn thương bệnh lý.
   - Dừng lại ở nhãn phân loại học máy, thiếu hệ thống thông tin hướng dẫn chăm sóc chuẩn hóa và nguồn tài liệu khoa học đối chứng.

---

### 3. 👥 ĐỐI TƯỢNG NGƯỜI DÙNG MỤC TIÊU (TARGET USERS)
- **Nông dân & Chủ vườn**: Cần công cụ chẩn đoán nhanh trên điện thoại di động tại ruộng, hướng dẫn xử lý dễ hiểu (tính theo bình 16 lít), tư vấn tương tác trực tiếp với Bác sĩ/AI và mua thuốc chính hãng giao tận nơi.
- **Kỹ sư Nông nghiệp Lavitree (Bác sĩ Cây trồng)**: Tiếp nhận các ca bệnh khó/nguy cấp được Agent chuyển giao, hội chẩn trực tiếp với người dùng và quản lý kho vật tư chính hãng.
- **Hợp tác xã & Doanh nghiệp Nông sản**: Quản trị nhật ký vùng trồng, theo dõi phục hồi và kế hoạch chăm sóc chuẩn VietGAP.

---

### 4. 🎯 MỤC TIÊU ĐỒ ÁN & PHẠM VI HỆ THỐNG (SCOPE DEFINITION)

#### Trong phạm vi (In-Scope - Core MVP):
- **Phân loại ảnh lá**: Nhận diện **38 phân lớp** trên **14 loài cây trồng** chủ lực (Cà chua, Khoai tây, Ngô, Táo, Nho, Ớt chuông, Cam...).
- **Tối ưu hóa chụp cận cảnh**: Hệ thống thiết kế tối ưu cho ảnh chụp cận cảnh 1 phiến lá (15–20cm) có định hướng từ khung ngắm giao diện (Viewport Constraint) để giảm thiểu nhiễu nền dã ngoại.
- **Kiểm soát ngoại lai & Bất định (OOD & Uncertainty Safeguard)**:
  - Tích hợp bộ lọc OOD đa tầng: Tín hiệu màu thực vật sơ bộ kết hợp Energy-based OOD Score trên model logits.
  - Cảnh báo nghi vấn khi độ tin cậy $< 70\%$ hoặc rơi vào lớp bệnh Tier 2/3.
- **Minh bạch hóa vùng chú ý**: Trực quan hóa vùng kích hoạt bằng **Grad-CAM (`layer4[-1]`)**.
- **Hướng dẫn chăm sóc & điều trị**: Cung cấp **Hướng dẫn xử lý theo tình trạng bệnh chuẩn Khuyến nông & IPM** kèm **112 nguồn bài báo khoa học đối chứng**.
- **Trợ lý Tác tử Khuyến Nông (Agri-Agent)**: Vòng lặp ReAct, 4 công cụ chuẩn MCP (Thời tiết, Kho thuốc, Tri thức bệnh, Rà soát an toàn PHI), Boundary Guardrails, cơ chế chuyển ca chuyên gia (Human-in-the-loop) và Streaming SSE.
- **Kế Hoạch Chăm Sóc & Theo Dõi Phục Hồi**: Hẹn 3–5 ngày chụp lại so sánh vết nấm cho cây bệnh; sinh lịch trình chăm sóc định kỳ cho 12 lớp cây khỏe.
- **Kho Vật tư Lavitree Store**: Quản lý danh mục vật tư chính hãng, hỗ trợ đặt hàng giao tận nơi qua thanh toán COD / VietQR.
- **Màn hình Quan sát (Agent Observability)**: Xuất Waterfall Trace Log phục vụ minh bạch hóa tiến trình lập luận của tác tử.
- **Nền tảng hỗ trợ**: Web Portal (React Vite) và Mobile App (Android Kotlin Jetpack Compose).
- **Hạ tầng triển khai**: Đóng gói Docker Compose hỗ trợ triển khai cục bộ (Local Container Deployment), vận hành được khi không có kết nối internet.

#### Ngoài phạm vi (Out-of-Scope - Tạm hoãn):
- Chẩn đoán qua thân, vỏ gỗ, củ ngầm hay hoa quả (chỉ tập trung phiến lá).
- Kết luận thay thế kết quả xét nghiệm sinh học phân tử (Lavitree đóng vai trò Decision Support System - hệ thống hỗ trợ ra quyết định).
