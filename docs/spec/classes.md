# 🌿 DANH MỤC 38 LỚP CÂY TRỒNG & CHÍNH SÁCH PHÂN CẤP TIER (CLASSES-TIER.MD)
## Phân cấp độ tin cậy AI & Chính sách cảnh báo độ bất định trên hệ thống Lavitree
*Dữ liệu nghiệm thu khoa học từ Task 05 — Đồng bộ với Lavitree_Selected_Classes.csv*

---

### 1. NGUYÊN TẮC PHÂN CẤP 3 TIER (TIERED CLASSIFICATION POLICY)

| Cấp độ | Tiêu chuẩn khoa học | Số lượng | Hành vi trên hệ thống Lavitree |
|:---:|---|:---:|---|
| **TIER 1 (Approved)** | $F1_{Lab} \ge 90\%$, đặc trưng bệnh rõ nét hoặc cây khỏe mạnh | **15 lớp** (39.5%) | Hiển thị kết quả với mức tin cậy cao (`confidence_level: "HIGH"`), mở ngay hướng dẫn xử lý & chăm sóc chuẩn IPM. |
| **TIER 2 (Conditional)** | $F1_{Lab} \ge 85\%$, bị sụt giảm ngoài dã ngoại do nhiễu nền | **21 lớp** (55.3%) | Hiển thị kết quả kèm cờ nghi ngờ (`confidence_level: "LOW_UNCERTAIN"`) và khuyến nghị: *"Chụp lại cận cảnh 15–20cm trên phông nền trơn"*. |
| **TIER 3 (Excluded)** | $F1_{Lab} < 85\%$ do triệu chứng đốm lá ban đầu quá tương đồng | **2 lớp** (5.2%) | Không khẳng định chắc nịch; cảnh báo nguy cơ nhầm lẫn và đề nghị thẩm định chuyên gia (HITL) hoặc chụp cận cảnh. |

---

### 2. BẢNG CHI TIẾT 38 LỚP CÂY TRỒNG & BỆNH HỌC

| ID | Mã Model (Class Code) | Tên cây | Tên bệnh / Tình trạng | Loại | F1 Lab | Phân cấp | Hành vi hệ thống |
|:---:|---|---|---|:---:|:---:|:---:|---|
| 0 | `Apple___Apple_scab` | Táo | Bệnh vảy táo (Scab) | Bệnh | 93.88% | **Tier 2** | Cảnh báo góc chụp, khuyến nghị chụp cận cảnh |
| 1 | `Apple___Black_rot` | Táo | Bệnh thối đen (Black rot) | Bệnh | 96.55% | **Tier 1** | Phục vụ chính thức (Độ tin cậy HIGH) |
| 2 | `Apple___Cedar_apple_rust` | Táo | Bệnh gỉ sắt tuyết tùng | Bệnh | 96.84% | **Tier 2** | Cần chụp rõ đốm cam mặt trên lá |
| 3 | `Apple___healthy` | Táo | Cây khỏe mạnh | Khỏe | 98.89% | **Tier 2** | Yêu cầu lót phông trơn tránh nhầm nền đất |
| 4 | `Blueberry___healthy` | Việt quất | Cây khỏe mạnh | Khỏe | 99.83% | **Tier 1** | Phục vụ chính thức (Độ tin cậy HIGH) |
| 5 | `Cherry_(including_sour)___Powdery_mildew` | Anh đào | Bệnh phấn trắng anh đào | Bệnh | 98.22% | **Tier 1** | Phục vụ chính thức (Độ tin cậy HIGH) |
| 6 | `Cherry_(including_sour)___healthy` | Anh đào | Cây khỏe mạnh | Khỏe | 99.40% | **Tier 2** | Tránh ánh sáng chói ngoài trời |
| 7 | `Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot` | Ngô | Bệnh đốm xám ngô | Bệnh | 87.43% | **Tier 2** | Dễ nhầm với cháy lá lớn; cần chụp cận gân lá |
| 8 | `Corn_(maize)___Common_rust_` | Ngô | Bệnh gỉ sắt ngô | Bệnh | 99.78% | **Tier 2** | Cần chụp rõ các ổ bột gỉ sắt màu nâu đỏ |
| 9 | `Corn_(maize)___Northern_Leaf_Blight` | Ngô | Bệnh cháy lá lớn ngô | Bệnh | 94.29% | **Tier 2** | Vết thoi dài dễ bị cỏ nền làm phân tán attention |
| 10 | `Corn_(maize)___healthy` | Ngô | Cây khỏe mạnh | Khỏe | 99.77% | **Tier 1** | Phục vụ chính thức (Độ tin cậy HIGH) |
| 11 | `Grape___Black_rot` | Nho | Bệnh thối đen trên nho | Bệnh | 96.93% | **Tier 2** | Chụp cận cảnh đốm tròn có viền sẫm |
| 12 | `Grape___Esca_(Black_Measles)` | Nho | Bệnh sởi đen / Esca nho | Bệnh | 97.70% | **Tier 1** | Phục vụ chính thức (Đặc trưng sọc vằn da hổ) |
| 13 | `Grape___Leaf_blight_(Isariopsis_Leaf_Spot)` | Nho | Bệnh cháy lá nho (Isariopsis) | Bệnh | 99.78% | **Tier 1** | Phục vụ chính thức (Độ tin cậy HIGH) |
| 14 | `Grape___healthy` | Nho | Cây khỏe mạnh | Khỏe | 98.61% | **Tier 2** | Khuyến cáo chụp phiến lá đơn |
| 15 | `Orange___Haunglongbing_(Citrus_greening)` | Cam | Bệnh vàng lá gân xanh (Greening) | Bệnh | 99.77% | **Tier 1** | Bệnh tối quan trọng tại VN; AI nhận diện rất chuẩn |
| 16 | `Peach___Bacterial_spot` | Đào | Bệnh đốm vi khuẩn trên đào | Bệnh | 98.12% | **Tier 1** | Phục vụ chính thức (Độ tin cậy HIGH) |
| 17 | `Peach___healthy` | Đào | Cây khỏe mạnh | Khỏe | 99.28% | **Tier 2** | Cần chụp trọn phiến lá trên nền sạch |
| 18 | `Pepper,_bell___Bacterial_spot` | Ớt chuông | Bệnh đốm vi khuẩn trên ớt | Bệnh | 99.03% | **Tier 2** | Vết đốm nhỏ dễ mất nét khi chụp xa |
| 19 | `Pepper,_bell___healthy` | Ớt chuông | Cây khỏe mạnh | Khỏe | 99.18% | **Tier 2** | Cần đưa lá lại gần khung ngắm |
| 20 | `Potato___Early_blight` | Khoai tây | Bệnh đốm vòng khoai tây | Bệnh | 97.83% | **Tier 2** | Yêu cầu chụp rõ các vòng đồng tâm |
| 21 | `Potato___Late_blight` | Khoai tây | Bệnh mốc sương khoai tây | Bệnh | 97.11% | **Tier 2** | Kiểm tra mặt dưới lá có mốc trắng |
| 22 | `Potato___healthy` | Khoai tây | Cây khỏe mạnh | Khỏe | 93.10% | **Tier 2** | Chụp phiến lá, không chụp cả luống cây |
| 23 | `Raspberry___healthy` | Mâm xôi | Cây khỏe mạnh | Khỏe | 100.0% | **Tier 1** | Phục vụ chính thức (Độ tin cậy HIGH) |
| 24 | `Soybean___healthy` | Đậu tương | Cây khỏe mạnh | Khỏe | 99.80% | **Tier 1** | Phục vụ chính thức (Độ tin cậy HIGH) |
| 25 | `Squash___Powdery_mildew` | Bí đỏ | Bệnh phấn trắng trên bí | Bệnh | 99.86% | **Tier 1** | Phục vụ chính thức (Lớp màng phấn trắng xóa) |
| 26 | `Strawberry___Leaf_scorch` | Dâu tây | Bệnh đốm cháy lá dâu tây | Bệnh | 99.51% | **Tier 1** | Phục vụ chính thức (Độ tin cậy HIGH) |
| 27 | `Strawberry___healthy` | Dâu tây | Cây khỏe mạnh | Khỏe | 100.0% | **Tier 1** | Phục vụ chính thức (Độ tin cậy HIGH) |
| 28 | `Tomato___Bacterial_spot` | Cà chua | Bệnh đốm vi khuẩn | Bệnh | 96.03% | **Tier 2** | Đốm li ti dễ nhầm ngoài trời; cần chụp cận cảnh |
| 29 | `Tomato___Early_blight` | Cà chua | Bệnh đốm vòng / Cháy lá sớm | Bệnh | 83.57% | **Tier 3** | Dễ nhầm với Target Spot (7.9%); gắn cờ cảnh báo nghi vấn |
| 30 | `Tomato___Late_blight` | Cà chua | Bệnh mốc sương cà chua | Bệnh | 92.92% | **Tier 2** | Bệnh nguy hiểm; cần chụp kỹ lớp mốc trắng mặt dưới lá |
| 31 | `Tomato___Leaf_Mold` | Cà chua | Bệnh mốc lá cà chua | Bệnh | 93.98% | **Tier 2** | Cần lật mặt dưới lá kiểm tra lớp mốc nhung |
| 32 | `Tomato___Septoria_leaf_spot` | Cà chua | Bệnh đốm lá Septoria | Bệnh | 90.83% | **Tier 2** | Cần chụp rõ đốm tròn tâm xám viền nâu |
| 33 | `Tomato___Spider_mites Two-spotted_spider_mite` | Cà chua | Nhện đỏ hại cà chua | Bệnh | 91.81% | **Tier 1** | Phục vụ chính thức (Lá lấm chấm vàng có tơ mịn) |
| 34 | `Tomato___Target_Spot` | Cà chua | Bệnh đốm mắt chim / Target spot | Bệnh | 83.58% | **Tier 3** | Precision thấp (73.8%); gắn cờ cảnh báo nghi vấn |
| 35 | `Tomato___Tomato_Yellow_Leaf_Curl_Virus` | Cà chua | Bệnh xoăn vàng lá (TYLCV) | Bệnh | 98.85% | **Tier 2** | Triệu chứng xoăn lá dễ bị ảnh hưởng bởi bóng râm |
| 36 | `Tomato___Tomato_mosaic_virus` | Cà chua | Bệnh khảm lá (ToMV) | Bệnh | 96.61% | **Tier 2** | Vết khảm loang lổ nhạy cảm với ánh sáng gay gắt |
| 37 | `Tomato___healthy` | Cà chua | Cây khỏe mạnh | Khỏe | 98.05% | **Tier 1** | Phục vụ chính thức (Độ tin cậy HIGH) |

---

### 3. QUY TẮC CẢNH BÁO TRÊN GIAO DIỆN (UI BADGE POLICY)
- 🟢 **Badge Xanh Lá ("Độ tin cậy cao")**: Khi kết quả thuộc **Tier 1** và Confidence $\ge 0.85$.
- 🟡 **Badge Vàng Cam ("Khuyến nghị chụp lại")**: Khi kết quả thuộc **Tier 2** hoặc Confidence từ $0.70 - 0.84$.
- 🔴 **Badge Đỏ ("Cảnh báo độ bất định / Nghi vấn")**: Khi kết quả thuộc **Tier 3** hoặc Confidence $< 0.70$. Hiển thị nút: *"Gửi hình ảnh nhờ Chuyên gia nông nghiệp thẩm định (HITL)"*.
