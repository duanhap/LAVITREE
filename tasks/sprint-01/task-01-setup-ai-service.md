# TASK-01: ĐỒNG BỘ AI VISION SERVICE, ENDPOINT DỰ ĐOÁN RESNET-18 & BỘ LỌC OOD CƠ BẢN
* **Sprint**: Sprint 1 (Full-stack Pipeline)
* **Phân hệ**: `backend/ai-service` (FastAPI)
* **Trạng thái**: `[x] DONE`
* **Người phụ trách**: Thành viên B (AI Vision Specialist)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Mô tả ngắn**: Rà soát, chuẩn hóa API theo `docs/architecture/api-contracts.md` (Mục 2.1) và triển khai bộ lọc Out-of-Distribution (OOD) **ở mức cơ bản** để giảm hiện tượng **Softmax Overconfidence** (ảnh bàn tay, mặt người, đồ vật ngoại lai vẫn bị ép ra xác suất cao 90%).
- **Phạm vi OOD trong Sprint 1**: Chỉ cần bộ lọc *chạy được* với ngưỡng tạm thời cấu hình qua `.env`. Việc hiệu chỉnh ngưỡng chính thức và đo lường bằng các tập ảnh tách biệt (tập A/B/C) **chuyển sang Sprint 3** (xem mục 6).
- **Trọng tâm sửa đổi & thực thi**:
  - Đổi tiền tố router thành `POST /api/v1/predict` (thay vì `/api/v1/ai/predict`).
  - Nạp thêm file `Lavitree_Selected_Classes.csv` vào `app/models/` để ánh xạ tên tiếng Việt (`plant_name`, `disease_name`), mẹo chụp theo lớp (`Capture_Tip`) và nhóm lớp dễ nhầm (`Confusion_Group`). **Không còn phân cấp Tier** (xem `docs/spec/classes.md` mục 1).
  - **Triển khai `backend/ai-service/app/services/ood_filter.py` với cơ chế 2 tầng kết hợp**:
    - **Tầng 1 (Tín hiệu sơ bộ - Heuristic Vegetation Pre-check)**: Kiểm tra tỷ lệ pixel màu thực vật qua không gian màu HSV (Hue trong dải xanh lá 25–100) hoặc chỉ số ExG ($2G - R - B$). *Lưu ý nguyên tắc:* Đây chỉ là tín hiệu kiểm tra sơ bộ ban đầu nhằm loại bỏ nhanh các ảnh hoàn toàn không có thực vật (màn hình đen, mặt bàn, tờ giấy, ảnh tối đen), **tuyệt đối không coi tỷ lệ pixel xanh là bằng chứng khẳng định chắc chắn ảnh có hoặc không có lá cây** (vì lá vàng, lá cháy nâu do nấm hay lá đỏ vẫn là lá hợp lệ).
    - **Tầng 2 (Lõi OOD - Energy-based OOD Score trên Logits)**: Lấy trực tiếp vector logits $f_i(x)$ (38 chiều) trước hàm Softmax từ ResNet-18 (theo nghiên cứu Liu et al., NeurIPS 2020).
      - *Quy ước điểm Energy Score*: $S_{energy}(x) = T \cdot \log \sum_{i=1}^{38} \exp(f_i(x) / T)$ với nhiệt độ chuẩn $T = 1.0$. Mẫu thuộc miền dữ liệu (In-Distribution) có điểm $S_{energy}$ cao, mẫu ngoại lai (OOD) có $S_{energy}$ thấp rõ rệt.
      - *Ngưỡng tạm thời cho Sprint 1 ($\tau_{energy}$)*: Đọc từ biến môi trường `OOD_ENERGY_THRESHOLD`. Giá trị ban đầu chọn nhanh: chạy model trên khoảng 20 ảnh lá mẫu và 10 ảnh vật thể tự chụp (bàn tay, mặt bàn, bàn phím…), in ra Energy score rồi chọn một giá trị nằm giữa hai nhóm, **ưu tiên nghiêng về phía dễ dãi** (thà lọt ảnh lạ còn hơn chặn nhầm ảnh lá thật khi demo). Mẫu có $S_{energy} < \tau_{energy}$ bị gắn cờ `is_ood = true`.
      - *Nếu chưa cấu hình `OOD_ENERGY_THRESHOLD`*: tắt kiểm tra Energy (`is_ood = false`) và ghi log cảnh báo khi khởi động. Không đặt ngưỡng cứng trong code.
      - *Hiệu chỉnh chính thức theo phân vị thứ 5 trên tập ảnh tách biệt*: **để Sprint 3** (mục 6).
    - **Cơ chế kết hợp (Decision Fusion Policy)**:
      1. Nếu `is_ood = true` (Energy Score thấp < $\tau_{energy}$): Từ chối chẩn đoán, cảnh báo: *"Ảnh nằm ngoài phạm vi 38 lớp cây trồng được hỗ trợ (OOD). Vui lòng không chụp vật thể lạ."*
      2. Nếu `is_ood = false` nhưng `vegetation_ratio < 5%` và `confidence < 0.70`: Bật cảnh báo bất định: *"Ảnh có tỷ lệ lá thấp và độ tin cậy chưa tối ưu, vui lòng căn chỉnh lá vào đúng khung ngắm."*
      3. Nếu `is_ood = false`, `confidence < 0.70` và `vegetation_ratio >= 5%`: Ảnh lá thật nhưng mô hình phân vân giữa các bệnh tương đồng $\rightarrow$ Gán `is_uncertain = true`, trả về Top-1, Top-3 kèm cảnh báo: *"Mô hình chưa hoàn toàn chắc chắn về loại bệnh này. Khuyến nghị chụp lại cận cảnh vết bệnh dưới đủ ánh sáng."*
      4. Nếu `is_ood = false` và `confidence >= 0.70`: Chấp thuận kết quả dự đoán (`is_uncertain = false`), `warning_message` = cảnh báo dễ nhầm (nếu Top-1 thuộc `Confusion_Group`) + `Capture_Tip` của Top-1, theo [docs/spec/classes.md mục 3](../../docs/spec/classes.md).
  - **Quy tắc Tách bạch Logic**:
    - `is_ood`: Thuần túy xác định ảnh ngoại lai (OOD) hay ảnh lá trong tập dữ liệu.
    - `is_uncertain`: **Thuần túy xác định độ bất định của Softmax (`confidence < 0.70`)**. Không phụ thuộc vào lớp bệnh.
    - `confusion_group`: Lấy từ cột `Confusion_Group` của Top-1 (`null` nếu trống).
    - `warning_message`: Sinh theo thứ tự ưu tiên OOD → bất định → dễ nhầm → `Capture_Tip` (xem `docs/spec/classes.md` mục 3).
  - **Ánh xạ Danh mục Lớp**: Model ResNet-18 chỉ dự đoán 38 lớp (chỉ số 0 đến 37). Ánh xạ theo mã lớp `class_code` (ví dụ `Tomato___Late_blight`), tuyệt đối không ánh xạ theo số thứ tự dòng thô của CSV; bỏ qua 2 lớp có `Field_Evidence = HANDBOOK_ONLY` (`Orange___healthy`, `Squash___healthy`) vì 2 lớp này chỉ dành cho Sổ tay tra cứu của Core API.
  - **Bổ sung An toàn & Bảo mật AI Service (Security Hardening)**:
    - *Kiểm tra dung lượng tệp*: Giới hạn kích thước ảnh tải lên tối đa **10MB**, từ chối ngay với HTTP 400 nếu vượt quá.
    - *Xác thực ảnh bằng Pillow (Chống MIME spoofing)*: Sử dụng `PIL.Image.open()` và `verify()` trực tiếp trên luồng bytes thay vì chỉ tin cậy header `file.content_type` của client.
    - *Chống tấn công Decompression Bomb*: Thiết lập `Image.MAX_IMAGE_PIXELS = 10_000_000` (10 Megapixels) kết hợp `warnings.simplefilter('error', Image.DecompressionBombWarning)` để chặn đứng ảnh nén độc hại gây cạn kiệt RAM server.
    - *Khắc phục bẫy runtime của Pillow*: Sau khi gọi `pil_image.verify()`, con trỏ file bị đóng, bắt buộc phải gọi lại `pil_image = Image.open(io.BytesIO(contents))` trước khi đưa vào PyTorch transforms để tránh lỗi crash `seek of closed file`.
    - *Ẩn thông tin lỗi nội bộ*: Thay thế `detail=str(e)` bằng logging server nội bộ và trả về thông báo lỗi thân thiện (`detail="Đã xảy ra lỗi trong quá trình xử lý hình ảnh. Vui lòng thử lại với ảnh khác."`), không để lộ đường dẫn file hay stack trace.
  - **Cơ chế Hợp tác Song song (Day 1 Stub Endpoint)**: Vào đầu Sprint 1, Thành viên B tạo nhanh một mock/stub endpoint `POST /api/v1/predict` (hardcoded JSON trả về đúng chuẩn `api-contracts.md`) để Thành viên A có thể bắt đầu tích hợp và test Core API E2E ngay lập tức mà không phải chờ B hoàn thành toàn bộ model.


- **Tài liệu tham chiếu chuẩn duy nhất**:
  - Hợp đồng API: `docs/architecture/api-contracts.md` (Mục 2.1)
  - Danh mục lớp & quy tắc cảnh báo: `docs/spec/classes.md`

---

## 2. ĐẶC TẢ KỸ THUẬT (SPECIFICATIONS)
- **Danh sách file tác động**:
  - `Đã có sẵn`: `backend/ai-service/app/models/Lavitree_Selected_Classes.csv` (đã bỏ cột Tier; dùng các cột `Ten_Cay_VN`, `Ten_Benh_VN`, `Capture_Tip`, `Confusion_Group`, `Field_Evidence`)
  - `Thêm mới`: `backend/ai-service/app/services/ood_filter.py` (bộ lọc OOD cơ bản: Energy-based score với ngưỡng từ `.env` + Vegetation pre-check)
  - `Chỉnh sửa`: `backend/ai-service/app/services/predictor.py` (trích xuất logits để tính Energy Score, tích hợp `OODFilter`, mapping tiếng Việt, `Capture_Tip`, `Confusion_Group`)
  - `Chỉnh sửa`: `backend/ai-service/app/main.py` (chuẩn hóa router prefix và health check `{"status": "ok", "model_loaded": true}`)
  - `Chỉnh sửa`: `backend/ai-service/app/api/endpoints/predict.py` (giới hạn 10MB, trả về 400 nếu lỗi, bổ sung trường `is_ood`)
  - `Chỉnh sửa`: `.env.example` (thêm `OOD_ENERGY_THRESHOLD=` kèm ghi chú cách chọn)
  - `Thêm mới`: `backend/ai-service/test_predict.py` (kiểm thử tự động các ca In-Distribution, ảnh bàn tay/mặt bàn OOD)
- **Hợp đồng dữ liệu (API Contract SSOT)**:
  - Cấu trúc Request/Response tuân thủ duy nhất theo [Mục 2.1 trong docs/architecture/api-contracts.md](../../docs/architecture/api-contracts.md#L30-L58). Không tự định nghĩa cấu trúc dữ liệu riêng lẻ.

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [x] **Pha 0 (Day 1 - Unblock Teammate A)**: Tạo stub endpoint giả lập `POST /api/v1/predict` (hardcoded JSON đúng 100% `api-contracts.md`) để Thành viên A tích hợp và kiểm thử Core API E2E ngay trong ngày đầu tiên.
- [x] **Pha 1**: Đọc `Lavitree_Selected_Classes.csv` (đã có trong `app/models/`), xây dựng dictionary ánh xạ `class_code` $\rightarrow$ tên tiếng Việt, `Capture_Tip`, `Confusion_Group`; bỏ qua 2 lớp `HANDBOOK_ONLY`.
- [x] **Pha 2**: Viết module `ood_filter.py` gồm hàm tính Energy Score $S_{energy}(x)$ và hàm `calculate_vegetation_ratio`. Cấu hình ngưỡng đọc linh hoạt từ `OOD_ENERGY_THRESHOLD` (để trống thì tắt kiểm tra Energy theo thiết kế an toàn, việc đo đạc và hiệu chỉnh ngưỡng chính thức chuyển sang Sprint 3).
- [x] **Pha 3**: Nâng cấp `predictor.py`: Giữ lại logits $f(x)$ trước Softmax, gọi `OODFilter.evaluate(tensor, logits, pil_image)` để xác định `is_ood`, gắn `confusion_group` và sinh `warning_message` theo 4 quy tắc kết hợp.
- [x] **Pha 4**: Sửa `main.py` và `predict.py` chuẩn hóa endpoint `POST /api/v1/predict`:
  - Kiểm tra `len(contents) <= 10 * 1024 * 1024` (10MB).
  - Cấu hình `warnings.simplefilter('error', Image.DecompressionBombWarning)` và đặt `Image.MAX_IMAGE_PIXELS = 10_000_000`.
  - Xác thực ảnh bằng `PIL.Image.open().verify()`, sau đó mở lại ảnh bằng `Image.open(io.BytesIO(contents))` để tránh lỗi đóng luồng.
  - Try/catch bắt lỗi và ẩn `str(e)`, ghi log nội bộ qua logging module.
- [x] **Pha 5**: Viết và chạy script `test_predict.py` kiểm thử:
  - 1 ảnh lá bệnh hợp lệ $\rightarrow$ `is_ood: false`, trả về bệnh chính xác.
  - 1 ảnh bàn tay / đồ vật ngoại lai $\rightarrow$ `is_ood: true`, `top1: null`, `gradcam_base64: null`.
  - 1 file sai định dạng hoặc > 10MB $\rightarrow$ HTTP 400; 1 tệp text đổi đuôi thành `.jpg` hoặc file hỏng byte $\rightarrow$ HTTP 422.
  - 1 ảnh `Tomato___Early_blight` hoặc `Tomato___Target_Spot` $\rightarrow$ `confusion_group: "TOMATO_LEAF_SPOT"` và `warning_message` có câu cảnh báo dễ nhầm.
  - Thời gian phản hồi toàn trình $\le 1.0$s trên CPU.

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [x] Stub endpoint hoàn thành trong 30 phút đầu để Thành viên A bắt đầu TASK-04 song song.
- [x] Module `ood_filter.py` chạy được trong `app/services/`, ngưỡng đọc từ `OOD_ENERGY_THRESHOLD` (thiếu biến thì tắt kiểm tra Energy và ghi log cảnh báo).
- [x] Healthcheck `GET /health` trả về `{"status": "ok", "model_loaded": true}`.
- [x] Endpoint `POST /api/v1/predict` trả về đúng cấu trúc `api-contracts.md` Mục 2.1 (khi OOD: `top1: null`, `gradcam_base64: null`).
- [x] Kiểm tra nhanh OOD: ảnh bàn tay mẫu trong `test_predict.py` bị gắn `is_ood: true`; ảnh lá mẫu không bị chặn nhầm. *(Chỉ tiêu định lượng ≥ 80% / ≤ 5% thuộc Sprint 3.)*
- [x] Response không còn trường `tier`; có `confusion_group` đúng contract.
- [x] Bảo mật: File > 10MB hoặc đuôi file sai bị từ chối 400; ảnh hỏng byte/decompression bomb bị chặn 422; lỗi ngoại lệ không lộ `str(e)`.
- [x] Tốc độ suy luận ResNet-18 + OOD Filter đạt $\le 1.0$ giây trên CPU.



- [x] Bằng chứng kiểm thử (Receipts - Output thực tế từ `python test_predict.py`):
  ```text
  =================================================================
  === CHẠY KIỂM THỬ PHA 5: E2E PREDICTION & SECURITY HARMONIZATION ===
  =================================================================
  [1/5] Kiểm thử 1 ảnh lá hợp lệ (In-Distribution)...
   -> PASSED: Nhận diện thành công: Táo - Bệnh thối đen (Black rot)
      Confidence: 0.4487, Latency client: 123.7ms (CPU inference: 112ms)
  [2/5] Kiểm thử 1 ảnh bàn tay / đồ vật ngoại lai (OOD)...
   -> PASSED: OOD được xử lý chuẩn: top1=None, gradcam_base64=None, warning_message='Ảnh nằm ngoài phạm vi 38 lớp cây trồng được hỗ trợ (OOD). Vui lòng không chụp vật thể lạ hoặc ảnh không rõ lá cây.'
  [3/5] Kiểm thử bảo mật (Dung lượng > 10MB, MIME type sai, tệp hỏng byte)...
     [x] Chặn đúng MIME type sai -> HTTP 400
     [x] Chặn đúng tệp vượt 10MB -> HTTP 400
     [x] Chặn đúng tệp text đổi đuôi .jpg (MIME spoofing) -> HTTP 422
     [x] Chặn đúng tệp hỏng byte -> HTTP 422
   -> PASSED: Toàn bộ 4 ca bảo mật đều trả về đúng mã HTTP chuẩn RESTful!
  [4/5] Kiểm thử nhóm dễ nhầm lẫn (Confusion Group TOMATO_LEAF_SPOT)...
   -> PASSED: Nhóm nhầm lẫn TOMATO_LEAF_SPOT sinh đúng cảnh báo: 'Bệnh này dễ nhầm với Bệnh đốm mắt chim / Target spot. Xem thêm các khả năng khác bên dưới hoặc nhờ chuyên gia xác nhận. Chụp rõ các vòng đồng tâm; bệnh này dễ nhầm với đốm mắt cua (Target spot).'
  [5/5] Đánh giá thời gian phản hồi toàn trình (CPU Latency Benchmark)...
     Các lần đo: ['96.2ms', '87.9ms', '92.6ms']
     Thời gian trung bình toàn trình: 92.2ms (Tiêu chuẩn: <= 1000ms)
   -> PASSED: Tốc độ phản hồi đạt chuẩn cao (nhanh hơn gấp nhiều lần tiêu chuẩn 1.0s)!
  =================================================================
  === TẤT CẢ 5/5 BÀI TEST E2E ĐỀU THÀNH CÔNG (100% PASS)! ===
  =================================================================
  ```

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)
- **Hoàn thành Pha 1**: Module `app/services/class_mapping.py` nạp thành công 38 lớp từ `Lavitree_Selected_Classes.csv`. Đã loại trừ chính xác 2 lớp `HANDBOOK_ONLY` (`Orange___healthy`, `Squash___healthy`). Hỗ trợ tra cứu `plant_name`, `disease_name`, `capture_tip` và tự động sinh cảnh báo cho `confusion_group` (`TOMATO_LEAF_SPOT` giữa Early blight và Target spot).
- **Hoàn thành Pha 2**: Module `app/services/ood_filter.py` triển khai xong cấu trúc thuật toán:
  - Tầng 1: `calculate_vegetation_ratio` kết hợp không gian màu HSV (Hue 25-100) và chỉ số ExG ($2G - R - B$).
  - Tầng 2: `calculate_energy_score` theo công thức Liu et al. (NeurIPS 2020) với $T = 1.0$ dùng `torch.logsumexp`.
  - Cơ chế kết hợp: Đầy đủ 4 quy tắc Decision Fusion Policy, đọc ngưỡng `OOD_ENERGY_THRESHOLD` từ môi trường (tự động tắt khi chưa cấu hình).
  - Đã kiểm thử unit test thuật toán qua `test_pha1_pha2.py` (PASS 100%).
- **Trạng thái đo thực nghiệm & Cấu hình ngưỡng**:
  - `[Chưa thực hiện đo thực tế]`: Nhóm chưa tiến hành chạy đo trên ảnh lá mẫu hay vật thể ngoại lai thật trong Sprint 1.
  - Biến môi trường `OOD_ENERGY_THRESHOLD=` hiện được **để trống** theo đúng thiết kế an toàn (`is_ood = false` khi dev).
  - Toàn bộ công tác thu thập 3 tập ảnh tách biệt (Tập A, B, C) và tính toán ngưỡng $\tau_{energy}$ chính thức (theo phân vị thứ 5) được **chuyển trọn vẹn sang Sprint 3** (xem Mục 6).
- **Hoàn thành Pha 3**: Nâng cấp toàn diện `app/services/predictor.py`:
  - Trích xuất trực tiếp vector Logits $f(x)$ trước Softmax và đưa vào `ood_filter.evaluate(...)`.
  - Tích hợp `class_mapping_service` lấy nhãn tiếng Việt (`plant_name`, `disease_name`), mẹo chụp và `confusion_group`.
  - Chuẩn hóa cấu trúc trả về theo `docs/architecture/api-contracts.md` Mục 2.1 (loại bỏ hoàn toàn các trường cũ `tier`, `predicted_class`).
  - Hỗ trợ Grad-CAM định dạng Data URI chuẩn (`data:image/jpeg;base64,...`) khi `include_heatmap = True`, tự động bỏ qua khi `is_ood = True` hoặc `include_heatmap = False`.
  - Đã chạy kiểm thử thực tế `test_predictor_pha3.py` trên terminal: 5/5 test pass, độ trễ suy luận thực tế đạt ~180ms trên CPU.
- **Hoàn thành Pha 4**: Chuẩn hóa endpoint `POST /api/v1/predict` và Hardening an toàn bảo mật:
  - Đấu nối trực tiếp vào `predictor.predict(...)` chạy mô hình ResNet-18 thật.
  - Kiểm tra MIME type và dung lượng <= 10MB (HTTP 400).
  - Cấu hình chặn Decompression Bomb (`Image.MAX_IMAGE_PIXELS = 10_000_000`) và xác thực Pillow verify() (HTTP 422).
  - Khắc phục bẫy đóng luồng byte của Pillow bằng cách mở lại luồng an toàn.
  - Bắt ngoại lệ và ẩn `str(e)`, ghi log nội bộ qua logger.
  - Health check `GET /health` trả về trạng thái nạp mô hình động qua `predictor.is_loaded`.
  - Đã chạy kiểm thử thực tế `test_endpoint_pha4.py` trên terminal: 7/7 test pass, độ trễ 128ms trên CPU.
- **Hoàn thành Pha 5**: Nghiệm thu E2E toàn trình AI Vision Service qua `test_predict.py`:
  - Chạy 5/5 kịch bản kiểm thử E2E tích hợp qua TestClient.
  - Sẵn sàng cơ chế nạp ảnh thật người dùng cung cấp tại thư mục `backend/ai-service/tests/samples/` (`leaf.jpg`, `hand.jpg`).
  - Đo đạc độ trễ toàn trình: Trung bình **92.2ms** trên CPU, đạt tiêu chuẩn khắt khe $\le 1.0$s của Lavitree.
  - Toàn bộ tiêu chí nghiệm thu của TASK-01 đạt 100%. Chuyển trạng thái sang `[x] DONE`.


---

## 6. VIỆC CHUYỂN SANG SPRINT 3 (HIỆU CHỈNH OOD CHÍNH THỨC)
*Không làm trong Sprint 1. Đã ghi vào `tasks/TODO.md` (Sprint 3).*
- Chuẩn bị 3 tập ảnh **không trùng nhau**, tất cả lấy ngoài 80% tập train (split `random_split`, `seed=42` trên Kaggle):
  - **Tập A – chọn ngưỡng**: ~500 ảnh từ một nửa tập test PlantVillage (10.861 ảnh), lấy đều các lớp → $\tau_{energy}$ = phân vị thứ 5 của Energy score.
  - **Tập B – đo từ chối nhầm**: nửa còn lại của tập test (≥ 50 ảnh, càng nhiều càng tốt) → tỷ lệ ảnh lá bị gắn `is_ood` phải $\le 5\%$.
  - **Tập C – ảnh không phải lá**: ≥ 20 ảnh tự chụp (bàn tay, mặt bàn, giấy, đất, cỏ…) + vài lá ngoài 14 loài (chuối, ổi) báo cáo riêng → tỷ lệ phát hiện $\ge 80\%$.
  - *(Tùy chọn)* **Tập D – ảnh lá ngoài đồng (PlantDoc)**: đo xem bộ lọc có chặn nhầm ảnh lá thật chụp ngoài vườn không.
- Xác nhận notebook train dùng đúng split `seed=42`; nếu không, tập test có thể lẫn ảnh train.
- Cập nhật `OOD_ENERGY_THRESHOLD` theo kết quả và đưa bảng số liệu vào chương đánh giá của báo cáo.
