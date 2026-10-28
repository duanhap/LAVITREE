# TASK-01: ĐỒNG BỘ AI VISION SERVICE, ENDPOINT DỰ ĐOÁN RESNET-18 & BỘ LỌC OOD ĐA TẦNG
* **Sprint**: Sprint 1 (Full-stack Pipeline)
* **Phân hệ**: `backend/ai-service` (FastAPI)
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên B (AI Vision Specialist)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Mô tả ngắn**: Rà soát, chuẩn hóa API theo `docs/architecture/api-contracts.md` (Mục 2.1) và triển khai bộ lọc Out-of-Distribution (OOD) đa tầng thực thụ để khắc phục triệt để hiện tượng **Softmax Overconfidence** (ảnh bàn tay, mặt người, đồ vật ngoại lai vẫn bị ép ra xác suất cao 90%).
- **Trọng tâm sửa đổi & thực thi**:
  - Đổi tiền tố router thành `POST /api/v1/predict` (thay vì `/api/v1/ai/predict`).
  - Nạp thêm file `Lavitree_Selected_Classes.csv` vào `app/models/` để ánh xạ tên tiếng Việt (`plant_name`, `disease_name`) và phân cấp `tier` (`TIER_1_APPROVED`, `TIER_2_CONDITIONAL`, `TIER_3_EXCLUDED`).
  - **Triển khai `backend/ai-service/app/services/ood_filter.py` với cơ chế 2 tầng kết hợp**:
    - **Tầng 1 (Tín hiệu sơ bộ - Heuristic Vegetation Pre-check)**: Kiểm tra tỷ lệ pixel màu thực vật qua không gian màu HSV (Hue trong dải xanh lá 25–100) hoặc chỉ số ExG ($2G - R - B$). *Lưu ý nguyên tắc:* Đây chỉ là tín hiệu kiểm tra sơ bộ ban đầu nhằm loại bỏ nhanh các ảnh hoàn toàn không có thực vật (màn hình đen, mặt bàn, tờ giấy, ảnh tối đen), **tuyệt đối không coi tỷ lệ pixel xanh là bằng chứng khẳng định chắc chắn ảnh có hoặc không có lá cây** (vì lá vàng, lá cháy nâu do nấm hay lá đỏ vẫn là lá hợp lệ).
    - **Tầng 2 (Lõi OOD - Energy-based OOD Score trên Logits)**: Lấy trực tiếp vector logits $f_i(x)$ (38 chiều) trước hàm Softmax từ ResNet-18 (theo nghiên cứu Liu et al., NeurIPS 2020).
      - *Quy ước điểm Energy Score*: $S_{energy}(x) = T \cdot \log \sum_{i=1}^{38} \exp(f_i(x) / T)$ với nhiệt độ chuẩn $T = 1.0$. Mẫu thuộc miền dữ liệu (In-Distribution) có điểm $S_{energy}$ cao, mẫu ngoại lai (OOD) có $S_{energy}$ thấp rõ rệt.
      - *Cách chọn ngưỡng ($\tau_{energy}$)*: Xác định ngưỡng $\tau_{energy}$ theo **phân vị thứ 5 (5th percentile)** trên tập kiểm thử phòng lab (In-Distribution Validation Set từ PlantVillage hoặc tập con 50 ảnh lá thật), đảm bảo 95% ảnh lá hợp lệ có điểm $S_{energy} \ge \tau_{energy}$ vượt qua được ngưỡng này. Mẫu có $S_{energy} < \tau_{energy}$ sẽ bị gắn cờ `is_ood = true`.
    - **Cơ chế kết hợp (Decision Fusion Policy)**:
      1. Nếu `is_ood = true` (Energy Score thấp < $\tau_{energy}$): Từ chối chẩn đoán, cảnh báo: *"Ảnh nằm ngoài phạm vi 38 lớp cây trồng được hỗ trợ (OOD). Vui lòng không chụp vật thể lạ."*
      2. Nếu `is_ood = false` nhưng `vegetation_ratio < 5%` và `confidence < 0.70`: Bật cảnh báo bất định: *"Ảnh có tỷ lệ lá thấp và độ tin cậy chưa tối ưu, vui lòng căn chỉnh lá vào đúng khung ngắm."*
      3. Nếu `is_ood = false`, `confidence < 0.70` và `vegetation_ratio >= 5%`: Ảnh lá thật nhưng mô hình phân vân giữa các bệnh tương đồng $\rightarrow$ Gán `is_uncertain = true`, trả về Top-1, Top-3 kèm cảnh báo: *"Mô hình chưa hoàn toàn chắc chắn về loại bệnh này. Khuyến nghị chụp lại cận cảnh vết bệnh dưới đủ ánh sáng."*
      4. Nếu `is_ood = false` và `confidence >= 0.70`: Chấp thuận kết quả dự đoán (`is_uncertain = false`), áp dụng quy tắc cảnh báo theo Tier Policy (Tier 1: không cảnh báo; Tier 2: cảnh báo góc chụp cận cảnh; Tier 3: khuyến nghị tham vấn chuyên gia nông nghiệp).
  - **Quy tắc Tách bạch Logic**:
    - `is_ood`: Thuần túy xác định ảnh ngoại lai (OOD) hay ảnh lá trong tập dữ liệu.
    - `is_uncertain`: **Thuần túy xác định độ bất định của Softmax (`confidence < 0.70`)**. Tuyệt đối không tự động gán `is_uncertain = true` chỉ vì bệnh thuộc Tier 2 hay Tier 3.
    - `warning_message`: Thông điệp khuyến nghị theo phân cấp Tier 1/2/3 và bộ lọc OOD.
  - **Ánh xạ Danh mục Lớp**: Model ResNet-18 chỉ dự đoán 38 lớp (chỉ số 0 đến 37). Ánh xạ theo mã lớp `class_code` (ví dụ `Tomato___Late_blight`), tuyệt đối không ánh xạ theo số thứ tự dòng thô của CSV; bỏ qua 2 lớp `TIER_HANDBOOK` (`Orange___healthy`, `Squash___healthy`) vì 2 lớp này chỉ dành cho Sổ tay tra cứu của Core API.
  - **Bổ sung An toàn & Bảo mật AI Service (Security Hardening)**:
    - *Kiểm tra dung lượng tệp*: Giới hạn kích thước ảnh tải lên tối đa **10MB**, từ chối ngay với HTTP 400 nếu vượt quá.
    - *Xác thực ảnh bằng Pillow (Chống MIME spoofing)*: Sử dụng `PIL.Image.open()` và `verify()` trực tiếp trên luồng bytes thay vì chỉ tin cậy header `file.content_type` của client.
    - *Chống tấn công Decompression Bomb*: Thiết lập `Image.MAX_IMAGE_PIXELS = 10_000_000` (10 Megapixels) kết hợp `warnings.simplefilter('error', Image.DecompressionBombWarning)` để chặn đứng ảnh nén độc hại gây cạn kiệt RAM server.
    - *Khắc phục bẫy runtime của Pillow*: Sau khi gọi `pil_image.verify()`, con trỏ file bị đóng, bắt buộc phải gọi lại `pil_image = Image.open(io.BytesIO(contents))` trước khi đưa vào PyTorch transforms để tránh lỗi crash `seek of closed file`.
    - *Ẩn thông tin lỗi nội bộ*: Thay thế `detail=str(e)` bằng logging server nội bộ và trả về thông báo lỗi thân thiện (`detail="Đã xảy ra lỗi trong quá trình xử lý hình ảnh. Vui lòng thử lại với ảnh khác."`), không để lộ đường dẫn file hay stack trace.
  - **Cơ chế Hợp tác Song song (Day 1 Stub Endpoint)**: Vào đầu Sprint 1, Thành viên B tạo nhanh một mock/stub endpoint `POST /api/v1/predict` (hardcoded JSON trả về đúng chuẩn `api-contracts.md`) để Thành viên A có thể bắt đầu tích hợp và test Core API E2E ngay lập tức mà không phải chờ B hoàn thành toàn bộ model.


- **Tài liệu tham chiếu chuẩn duy nhất**:
  - Hợp đồng API: `docs/architecture/api-contracts.md` (Mục 2.1)
  - Danh mục phân cấp: `docs/spec/classes-tier.md`

---

## 2. ĐẶC TẢ KỸ THUẬT (SPECIFICATIONS)
- **Danh sách file tác động**:
  - `Thêm mới`: `backend/ai-service/app/models/Lavitree_Selected_Classes.csv` (sao chép từ `plan/05_chot_danh_muc_lop_va_gioi_han/`)
  - `Thêm mới`: `backend/ai-service/app/services/ood_filter.py` (bộ lọc OOD đa tầng: Energy-based score + Vegetation pre-check)
  - `Chỉnh sửa`: `backend/ai-service/app/services/predictor.py` (trích xuất logits để tính Energy Score, tích hợp `OODFilter`, mapping tiếng Việt & Tier)
  - `Chỉnh sửa`: `backend/ai-service/app/main.py` (chuẩn hóa router prefix và health check `{"status": "ok", "model_loaded": true}`)
  - `Chỉnh sửa`: `backend/ai-service/app/api/endpoints/predict.py` (giới hạn 10MB, trả về 400 nếu lỗi, bổ sung trường `is_ood`)
  - `Thêm mới`: `backend/ai-service/test_predict.py` (kiểm thử tự động các ca In-Distribution, ảnh bàn tay/mặt bàn OOD)
- **Hợp đồng dữ liệu (API Contract SSOT)**:
  - Cấu trúc Request/Response tuân thủ duy nhất theo [Mục 2.1 trong docs/architecture/api-contracts.md](../../docs/architecture/api-contracts.md#L30-L58). Không tự định nghĩa cấu trúc dữ liệu riêng lẻ.

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [ ] **Pha 0 (Day 1 - Unblock Teammate A)**: Tạo stub endpoint giả lập `POST /api/v1/predict` (hardcoded JSON đúng 100% `api-contracts.md`) để Thành viên A tích hợp và kiểm thử Core API E2E ngay trong ngày đầu tiên.
- [ ] **Pha 1**: Sao chép `Lavitree_Selected_Classes.csv` vào `backend/ai-service/app/models/`, xây dựng dictionary ánh xạ `class_code` $\rightarrow$ tiếng Việt và Tier, bỏ qua 2 lớp `TIER_HANDBOOK`.
- [ ] **Pha 2**: Viết module `ood_filter.py` cài đặt hàm tính Energy Score $S_{energy}(x)$, xác định ngưỡng $\tau_{energy}$ theo phân vị thứ 5 trên tập validation, và hàm tính tỷ lệ màu thực vật sơ bộ `calculate_vegetation_ratio`.
- [ ] **Pha 3**: Nâng cấp `predictor.py`: Giữ lại logits $f(x)$ trước Softmax, gọi `OODFilter.evaluate(tensor, logits, pil_image)` để xác định `is_ood`, ánh xạ phân cấp Tier và sinh `warning_message` theo 4 quy tắc kết hợp.
- [ ] **Pha 4**: Sửa `main.py` và `predict.py` chuẩn hóa endpoint `POST /api/v1/predict`:
  - Kiểm tra `len(contents) <= 10 * 1024 * 1024` (10MB).
  - Cấu hình `warnings.simplefilter('error', Image.DecompressionBombWarning)` và đặt `Image.MAX_IMAGE_PIXELS = 10_000_000`.
  - Xác thực ảnh bằng `PIL.Image.open().verify()`, sau đó mở lại ảnh bằng `Image.open(io.BytesIO(contents))` để tránh lỗi đóng luồng.
  - Try/catch bắt lỗi và ẩn `str(e)`, ghi log nội bộ qua logging module.
- [ ] **Pha 5**: Viết và chạy script `test_predict.py` kiểm thử:
  - 1 ảnh lá bệnh hợp lệ $\rightarrow$ `is_ood: false`, trả về bệnh chính xác.
  - 1 ảnh bàn tay / đồ vật ngoại lai $\rightarrow$ `is_ood: true`, `top1: null`, `gradcam_base64: null`.
  - 1 file giả mạo định dạng (tệp text đổi tên thành .jpg) hoặc file hỏng byte $\rightarrow$ trả về HTTP 400 hoặc 422 Unprocessable Entity.
  - Đo lường Benchmark OOD (Chống rò rỉ dữ liệu / Data Leakage): Tập 50 ảnh lá thật dùng để đo lường phải **tách biệt hoàn toàn (disjoint)** với tập ảnh dùng để xác định ngưỡng phân vị thứ 5 $\tau_{energy}$. Kết quả: Phát hiện OOD $\ge 80\%$ trên 20 ảnh ngoại lai; từ chối nhầm $\le 5\%$ trên 50 ảnh lá thật riêng biệt.
  - Thời gian phản hồi toàn trình $\le 1.0$s trên CPU.

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [ ] Stub endpoint hoàn thành trong 30 phút đầu để Thành viên A bắt đầu TASK-04 song song.
- [ ] Module `ood_filter.py` được triển khai hoàn chỉnh trong `app/services/` với ngưỡng Energy Score lấy theo phân vị thứ 5.
- [ ] Healthcheck `GET /health` trả về `{"status": "ok", "model_loaded": true}`.
- [ ] Endpoint `POST /api/v1/predict` trả về đúng cấu trúc `api-contracts.md` Mục 2.1 (khi OOD: `top1: null`, `gradcam_base64: null`).
- [ ] Benchmark OOD lượng hóa: Phát hiện OOD $\ge 80\%$ trên 20 ảnh ngoại lai; từ chối nhầm $\le 5\%$ trên 50 ảnh lá thật thuộc tập kiểm thử độc lập.
- [ ] Bảo mật: File > 10MB hoặc đuôi file sai bị từ chối 400; ảnh hỏng byte/decompression bomb bị chặn 422; lỗi ngoại lệ không lộ `str(e)`.
- [ ] Tốc độ suy luận ResNet-18 + OOD Filter đạt $\le 1.0$ giây trên CPU.



- [ ] Bằng chứng kiểm thử (Receipts):
  ```bash
  # Dán stdout kiểm thử curl / python test_predict.py tại đây khi nghiệm thu
  ```

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)
- *Ghi nhận sau khi hoàn thành task.*
