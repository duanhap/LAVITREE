# 🌿 DANH MỤC 38 LỚP CÂY TRỒNG & CHÍNH SÁCH CẢNH BÁO (CLASSES.MD)
## Danh mục lớp nhận diện, mức độ kiểm chứng thực tế và quy tắc cảnh báo trên Lavitree
*Nguồn dữ liệu duy nhất: `backend/core-api/seed/Lavitree_Selected_Classes.csv` (bản sao tại `backend/ai-service/app/models/`). Bảng bên dưới được sinh từ CSV — khi sửa, sửa CSV trước.*

---

### 1. VÌ SAO KHÔNG DÙNG PHÂN CẤP TIER 1/2/3 NỮA
Phiên bản trước chia 38 lớp thành Tier 1 (Approved) / Tier 2 (Conditional) / Tier 3 (Excluded). Rà soát lại số liệu cho thấy cách chia này **không phản ánh độ tin cậy thật**:
- Toàn bộ 15 lớp "Tier 1" là những lớp **không có ảnh ngoài đồng (PlantDoc) để kiểm thử**; còn mọi lớp có ảnh ngoài đồng đều cho F1 từ 0.00 đến 0.35 và bị xếp Tier 2. Tức "Tier 1" thực chất là *"chưa được kiểm chứng"*, không phải *"đã được chứng minh tốt"*.
- PlantDoc chỉ có 4–12 ảnh mỗi lớp, chênh 1 ảnh đúng/sai làm F1 đổi khoảng 10 điểm — không đủ để xếp hạng từng lớp.
- Sau khi tách `is_uncertain` khỏi Tier, Tier không còn tác động tới logic xử lý nào, chỉ dùng để chọn câu cảnh báo.

➡️ **Quyết định**: Bỏ trường `tier` khỏi API và logic hệ thống. Thay bằng 3 tín hiệu trung thực hơn (mục 2). Số liệu kiểm thử giữ nguyên để đưa vào chương *Đánh giá & Giới hạn* của báo cáo.

---

### 2. CÁC TÍN HIỆU THAY THẾ TIER

| Tín hiệu | Ý nghĩa | Nguồn | Dùng ở đâu |
|---|---|---|---|
| `is_uncertain` | Model không chắc chắn với **ảnh này** | `confidence < 0.70` | API `predict` / `diagnose` |
| `Capture_Tip` | Mẹo chụp riêng cho **từng lớp** (ví dụ: chụp mặt dưới lá để thấy mốc trắng) | Cột `Capture_Tip` trong CSV | Ghép vào `warning_message` |
| `Confusion_Group` | Cặp lớp đã được chứng minh **dễ nhầm** trong lab | Cột `Confusion_Group` (hiện có `TOMATO_LEAF_SPOT`: Early blight ↔ Target spot) | Luôn hiện Top-3 và gợi ý hỏi chuyên gia |
| `Field_Evidence` | Mức kiểm chứng ngoài đồng: `FIELD_TESTED` (22 lớp) / `NO_FIELD_DATA` (16 lớp) / `HANDBOOK_ONLY` (2 lớp) | Cột `Field_Evidence` | **Chỉ dùng cho báo cáo & sổ tay**, không thay đổi logic chẩn đoán |

---

### 3. QUY TẮC SINH `warning_message` (THỨ TỰ ƯU TIÊN)
1. `is_ood = true` → *"Ảnh nằm ngoài phạm vi 38 lớp cây trồng được hỗ trợ. Vui lòng chụp lại lá cây trong khung ngắm 15–20cm."*
2. `is_uncertain = true` → *"Mô hình chưa chắc chắn về kết quả này. Hãy chụp lại cận cảnh vết bệnh dưới đủ ánh sáng."* + `Capture_Tip` của Top-1.
3. Top-1 thuộc một `Confusion_Group` → *"Bệnh này dễ nhầm với {lớp còn lại trong nhóm}. Xem thêm các khả năng khác bên dưới hoặc nhờ chuyên gia xác nhận."* + `Capture_Tip`.
4. Các trường hợp còn lại → `Capture_Tip` của Top-1.

> Mọi kết quả đều là **gợi ý tham khảo** (Decision Support), không thay thế chẩn đoán của chuyên gia. Câu này luôn hiển thị cố định trên UI, không phụ thuộc lớp bệnh.

---

### 4. QUY TẮC HIỂN THỊ TRÊN GIAO DIỆN (UI BADGE POLICY)
- 🟢 **"Kết quả tham khảo"**: `is_uncertain = false` và Top-1 không thuộc `Confusion_Group`.
- 🟡 **"Dễ nhầm – xem thêm khả năng khác"**: `is_uncertain = false` nhưng Top-1 thuộc `Confusion_Group`. Hiển thị Top-3.
- 🔴 **"Chưa chắc chắn – nên chụp lại"**: `is_uncertain = true`. Hiển thị Top-3 và nút *"Nhờ chuyên gia thẩm định"*.
- ⚪ **"Không nhận diện được lá cây"**: `is_ood = true`. Không hiển thị kết quả bệnh.

*Không dùng nhãn "Độ tin cậy cao" vì độ chính xác ngoài đồng chưa được chứng minh.*

---

### 5. BẢNG CHI TIẾT 38 LỚP NHẬN DIỆN

| ID | Mã Model (Class Code) | Tên cây | Tên bệnh / Tình trạng | F1 Lab | F1 ngoài đồng | Kiểm chứng ngoài đồng | Mẹo chụp (`Capture_Tip`) |
|:---:|---|---|---|:---:|:---:|---|---|
| 0 | `Apple___Apple_scab` | Táo | Bệnh vảy táo (Scab) | 93.9% | 0.00 (10 ảnh) | Đã test – kém | Chụp cận cảnh 15–20cm các vết vảy nâu ô liu trên mặt lá, đặt lá trên nền trơn. |
| 1 | `Apple___Black_rot` | Táo | Bệnh thối đen (Black rot) | 96.5% | — | Chưa có dữ liệu | Chụp rõ đốm tròn có viền tím sẫm trên phiến lá. |
| 2 | `Apple___Cedar_apple_rust` | Táo | Bệnh gỉ sắt tuyết tùng | 96.8% | 0.00 (10 ảnh) | Đã test – kém | Chụp rõ các đốm màu cam vàng ở mặt trên lá. |
| 3 | `Apple___healthy` | Táo | Cây khỏe mạnh | 98.9% | 0.29 (9 ảnh) | Đã test – kém | Đặt lá trên nền trơn, tránh để lẫn nền đất trong khung hình. |
| 4 | `Blueberry___healthy` | Việt quất | Cây khỏe mạnh | 99.8% | — | Chưa có dữ liệu | Chụp một phiến lá đơn, đủ ánh sáng. |
| 5 | `Cherry_(including_sour)___Powdery_mildew` | Anh đào (Cherry) | Bệnh phấn trắng anh đào | 98.2% | — | Chưa có dữ liệu | Chụp rõ lớp phấn trắng trên mặt lá. |
| 6 | `Cherry_(including_sour)___healthy` | Anh đào (Cherry) | Cây khỏe mạnh | 99.4% | 0.27 (10 ảnh) | Đã test – kém | Tránh ánh nắng chói trực tiếp khi chụp. |
| 7 | `Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot` | Ngô (Bắp) | Bệnh đốm xám ngô | 87.4% | 0.18 (4 ảnh) | Đã test – kém | Chụp cận các vết đốm dài chạy dọc gân lá; bệnh này dễ nhầm với cháy lá lớn. |
| 8 | `Corn_(maize)___Common_rust_` | Ngô (Bắp) | Bệnh gỉ sắt ngô | 99.8% | 0.31 (10 ảnh) | Đã test – kém | Chụp rõ các ổ bột gỉ sắt màu nâu đỏ trên lá. |
| 9 | `Corn_(maize)___Northern_Leaf_Blight` | Ngô (Bắp) | Bệnh cháy lá lớn ngô | 94.3% | 0.35 (12 ảnh) | Đã test – kém | Chụp trọn vết bệnh hình thoi dài, tránh để cỏ nền lọt vào khung. |
| 10 | `Corn_(maize)___healthy` | Ngô (Bắp) | Cây khỏe mạnh | 99.8% | — | Chưa có dữ liệu | Chụp một đoạn phiến lá, đủ ánh sáng. |
| 11 | `Grape___Black_rot` | Nho | Bệnh thối đen trên nho | 96.9% | 0.00 (12 ảnh) | Đã test – kém | Chụp cận các đốm tròn có viền sẫm màu. |
| 12 | `Grape___Esca_(Black_Measles)` | Nho | Bệnh sởi đen / Bệnh Esca nho | 97.7% | — | Chưa có dữ liệu | Chụp rõ các sọc vằn vàng nâu giữa các gân lá. |
| 13 | `Grape___Leaf_blight_(Isariopsis_Leaf_Spot)` | Nho | Bệnh cháy lá nho (Isariopsis) | 99.8% | — | Chưa có dữ liệu | Chụp rõ các đốm nâu sẫm hình dạng không đều trên lá. |
| 14 | `Grape___healthy` | Nho | Cây khỏe mạnh | 98.6% | 0.17 (8 ảnh) | Đã test – kém | Chụp một phiến lá đơn. |
| 15 | `Orange___Haunglongbing_(Citrus_greening)` | Cam / Cây có múi | Bệnh vàng lá gân xanh (Greening) | 99.8% | — | Chưa có dữ liệu | Chụp rõ vùng vàng loang lổ không đối xứng hai bên gân chính. Bệnh cần xét nghiệm để khẳng định. |
| 16 | `Peach___Bacterial_spot` | Đào | Bệnh đốm vi khuẩn trên đào | 98.1% | — | Chưa có dữ liệu | Chụp cận các đốm nhỏ góc cạnh, có thể thủng lỗ trên lá. |
| 17 | `Peach___healthy` | Đào | Cây khỏe mạnh | 99.3% | 0.20 (9 ảnh) | Đã test – kém | Chụp trọn phiến lá trên nền sạch. |
| 18 | `Pepper,_bell___Bacterial_spot` | Ớt chuông | Bệnh đốm vi khuẩn trên ớt | 99.0% | 0.10 (8 ảnh) | Đã test – kém | Đưa lá lại gần; vết đốm nhỏ dễ mất nét khi chụp xa. |
| 19 | `Pepper,_bell___healthy` | Ớt chuông | Cây khỏe mạnh | 99.2% | 0.00 (9 ảnh) | Đã test – kém | Đưa lá lại gần khung ngắm. |
| 20 | `Potato___Early_blight` | Khoai tây | Bệnh đốm vòng khoai tây | 97.8% | — | Chưa có dữ liệu | Chụp rõ các vòng đồng tâm trên vết bệnh. |
| 21 | `Potato___Late_blight` | Khoai tây | Bệnh mốc sương khoai tây | 97.1% | 0.00 (8 ảnh) | Đã test – kém | Chụp thêm mặt dưới lá để kiểm tra lớp mốc trắng. |
| 22 | `Potato___healthy` | Khoai tây | Cây khỏe mạnh | 93.1% | 0.00 (8 ảnh) | Đã test – kém | Chụp từng phiến lá, không chụp cả luống cây. |
| 23 | `Raspberry___healthy` | Mâm xôi | Cây khỏe mạnh | 100.0% | — | Chưa có dữ liệu | Chụp một phiến lá đơn, đủ ánh sáng. |
| 24 | `Soybean___healthy` | Đậu nành (Đậu tương) | Cây khỏe mạnh | 99.8% | — | Chưa có dữ liệu | Chụp một phiến lá đơn, đủ ánh sáng. |
| 25 | `Squash___Powdery_mildew` | Bí đỏ / Bí ngô | Bệnh phấn trắng trên bí | 99.9% | — | Chưa có dữ liệu | Chụp rõ lớp phấn trắng trên mặt lá. |
| 26 | `Strawberry___Leaf_scorch` | Dâu tây | Bệnh đốm cháy lá dâu tây | 99.5% | — | Chưa có dữ liệu | Chụp cận các đốm tím sẫm trên lá. |
| 27 | `Strawberry___healthy` | Dâu tây | Cây khỏe mạnh | 100.0% | — | Chưa có dữ liệu | Chụp một phiến lá đơn, đủ ánh sáng. |
| 28 | `Tomato___Bacterial_spot` | Cà chua | Bệnh đốm vi khuẩn | 96.0% | 0.00 (8 ảnh) | Đã test – kém | Chụp cận cảnh; các đốm li ti dễ mất nét khi chụp ngoài trời. |
| 29 | `Tomato___Early_blight` | Cà chua | Bệnh đốm vòng / Cháy lá sớm | 83.6% | 0.12 (9 ảnh) | Đã test – kém ⚠️ dễ nhầm | Chụp rõ các vòng đồng tâm; bệnh này dễ nhầm với đốm mắt cua (Target spot). |
| 30 | `Tomato___Late_blight` | Cà chua | Bệnh mốc sương (Late blight) | 92.9% | 0.06 (9 ảnh) | Đã test – kém | Chụp kỹ cả mặt dưới lá để thấy lớp mốc trắng. |
| 31 | `Tomato___Leaf_Mold` | Cà chua | Bệnh mốc lá cà chua | 94.0% | 0.00 (6 ảnh) | Đã test – kém | Lật mặt dưới lá, chụp lớp mốc nhung màu ô liu. |
| 32 | `Tomato___Septoria_leaf_spot` | Cà chua | Bệnh đốm lá Septoria | 90.8% | 0.22 (11 ảnh) | Đã test – kém | Chụp rõ các đốm tròn tâm xám viền nâu. |
| 33 | `Tomato___Spider_mites Two-spotted_spider_mite` | Cà chua | Nhện đỏ hại cà chua | 91.8% | — | Chưa có dữ liệu | Chụp cận các chấm vàng li ti và tơ mịn ở mặt dưới lá. |
| 34 | `Tomato___Target_Spot` | Cà chua | Bệnh đốm mắt chim / Target spot | 83.6% | — | Chưa có dữ liệu ⚠️ dễ nhầm | Chụp rõ tâm vết bệnh; bệnh này dễ nhầm với đốm vòng (Early blight). |
| 35 | `Tomato___Tomato_Yellow_Leaf_Curl_Virus` | Cà chua | Bệnh xoăn vàng lá (TYLCV) | 98.9% | 0.19 (10 ảnh) | Đã test – kém | Chụp phần ngọn có lá xoăn vàng, tránh bóng râm. |
| 36 | `Tomato___Tomato_mosaic_virus` | Cà chua | Bệnh khảm lá (ToMV) | 96.6% | 0.00 (10 ảnh) | Đã test – kém | Tránh nắng gắt; chụp rõ vùng khảm loang xanh đậm – xanh nhạt. |
| 37 | `Tomato___healthy` | Cà chua | Cây khỏe mạnh | 98.0% | 0.00 (6 ảnh) | Đã test – kém | Chụp một phiến lá đơn, đủ ánh sáng. |

**2 lớp bổ trợ sổ tay** (`HANDBOOK_ONLY`, model không nhận diện): `Orange___healthy` (Cam / Cây có múi), `Squash___healthy` (Bí đỏ / Bí ngô). Chỉ dùng cho bảng `Diseases` và Sổ tay để 4 bài báo trong `KnowledgeSources` không bị mồ côi.

---

### 6. GHI CHÚ CHO CHƯƠNG ĐÁNH GIÁ CỦA BÁO CÁO
- Trên PlantVillage (ảnh lab, nền trơn): F1 từ 83.6% đến 100%.
- Trên PlantDoc (ảnh ngoài đồng): F1 từ 0.00 đến 0.35 trên 22 lớp có dữ liệu → mô hình **chưa dùng được với ảnh ngoài đồng tùy ý**. Hệ thống xử lý giới hạn này bằng khung ngắm cận cảnh 15–20cm, bộ lọc OOD, cờ `is_uncertain` và mẹo chụp theo từng lớp.
- 16 lớp chưa có dữ liệu ngoài đồng: không được trình bày là "đáng tin cậy", chỉ ghi "chưa kiểm chứng".
- Hướng cải thiện (ngoài phạm vi MVP): fine-tune với augmentation nền đồng ruộng hoặc bổ sung ảnh PlantDoc (xem `plan/bonus_nghien_cuu_cai_tien_mo_hinh_ngoai_canh.md`).
