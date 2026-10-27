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
      - *Cách chọn ngưỡng ($\tau_{energy}$)*: Xác định ngưỡng $\tau_{energy}$ theo phân vị (percentile) thứ 95% trên tập kiểm thử phòng lab (In-Distribution Validation Set từ PlantVillage), đảm bảo 95% ảnh lá hợp lệ vượt qua được ngưỡng này. Mẫu có $S_{energy} < \tau_{energy}$ sẽ bị gắn cờ `is_ood = true`.
    - **Cơ chế kết hợp (Decision Fusion Policy)**:
      1. Nếu `is_ood = true` (Energy Score thấp): Từ chối chẩn đoán, cảnh báo: *"Ảnh nằm ngoài phạm vi 38 lớp cây trồng được hỗ trợ (OOD). Vui lòng không chụp vật thể lạ."*
      2. Nếu `is_ood = false` nhưng `vegetation_ratio < 5%` và `confidence < 0.70`: Bật cảnh báo bất định: *"Ảnh có tỷ lệ lá thấp và độ tin cậy chưa tối ưu, vui lòng căn chỉnh lá vào đúng khung ngắm."*
      3. Nếu `is_ood = false` và `confidence >= 0.70`: Chấp thuận kết quả dự đoán, áp dụng quy tắc cảnh báo theo Tier Policy.
  - Tách bạch: `is_ood` (theo Energy/Vegetation filter), `is_uncertain` (khi `confidence < 0.70` hoặc rơi vào Tier 2/3), và `warning_message` (theo Tier policy & OOD).
  - Giới hạn kích thước ảnh tải lên tối đa **10MB**, trả về mã lỗi HTTP 400 nếu ảnh không đúng định dạng.
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
  - Khớp 100% với định dạng JSON tại **Mục 2.1 trong `docs/architecture/api-contracts.md`**, bổ sung trường `is_ood: bool`.

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [ ] **Pha 1**: Sao chép `Lavitree_Selected_Classes.csv` vào `backend/ai-service/app/models/`.
- [ ] **Pha 2**: Viết module `ood_filter.py` cài đặt hàm tính Energy Score $S_{energy}(x)$ và hàm tính tỷ lệ màu thực vật sơ bộ `calculate_vegetation_ratio`.
- [ ] **Pha 3**: Nâng cấp `predictor.py`: Giữ lại logits $f(x)$ trước Softmax, gọi `OODFilter.evaluate(tensor, logits, pil_image)` để xác định `is_ood`, ánh xạ phân cấp Tier và sinh `warning_message`.
- [ ] **Pha 4**: Sửa `main.py` và `predict.py` chuẩn hóa endpoint `POST /api/v1/predict`, kiểm tra `file.size <= 10 * 1024 * 1024`.
- [ ] **Pha 5**: Viết và chạy script `test_predict.py` kiểm thử:
  - 1 ảnh lá bệnh hợp lệ $\rightarrow$ `is_ood: false`, trả về bệnh chính xác.
  - 1 ảnh bàn tay / đồ vật ngoại lai $\rightarrow$ `is_ood: true` và cảnh báo từ chối.
  - Thời gian phản hồi toàn trình $\le 1.0$s trên CPU.

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [ ] Module `ood_filter.py` được triển khai hoàn chỉnh trong `app/services/`.
- [ ] Healthcheck `GET /health` trả về `{"status": "ok", "model_loaded": true}`.
- [ ] Endpoint `POST /api/v1/predict` trả về đúng cấu trúc `api-contracts.md` Mục 2.1 kèm cờ `is_ood`.
- [ ] Ảnh bàn tay/đồ vật không có lá bị phát hiện và gắn cờ `is_ood: true`.
- [ ] Tốc độ suy luận ResNet-18 + OOD Filter đạt $\le 1.0$ giây trên CPU.
- [ ] Bằng chứng kiểm thử (Receipts):
  ```bash
  # Dán stdout kiểm thử curl / python test_predict.py tại đây khi nghiệm thu
  ```

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)
- *Ghi nhận sau khi hoàn thành task.*
