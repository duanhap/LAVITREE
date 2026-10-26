# TASK-01: ĐỒNG BỘ AI VISION SERVICE & ENDPOINT DỰ ĐOÁN RESNET-18
* **Sprint**: Sprint 1 (Full-stack Pipeline)
* **Phân hệ**: `backend/ai-service` (FastAPI)
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên B (AI Vision Specialist)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Mô tả ngắn**: Rà soát và chỉnh sửa mã nguồn hiện có trong `backend/ai-service` để khớp 100% với tài liệu hợp đồng `docs/architecture/api-contracts.md` (Mục 2.1).
- **Trọng tâm sửa đổi**:
  - Đổi tiền tố router thành `POST /api/v1/predict` (thay vì `/api/v1/ai/predict`).
  - Nạp thêm file `Lavitree_Selected_Classes.csv` vào `app/models/` để ánh xạ tên tiếng Việt (`plant_name`, `disease_name`) và phân cấp `tier` (`TIER_1_APPROVED`, `TIER_2_CONDITIONAL`, `TIER_3_EXCLUDED`).
  - Tách bạch: `is_uncertain` (chỉ theo ngưỡng `confidence < 0.70`) và `warning_message` (theo Tier policy).
  - Giới hạn kích thước ảnh tải lên tối đa **10MB**, trả về mã lỗi HTTP 400 nếu ảnh không đúng định dạng.
- **Tài liệu tham chiếu chuẩn duy nhất**:
  - Hợp đồng API: `docs/architecture/api-contracts.md` (Mục 2.1)
  - Danh mục phân cấp: `docs/spec/classes-tier.md`

---

## 2. ĐẶC TẢ KỸ THUẬT (SPECIFICATIONS)
- **Danh sách file tác động**:
  - `Thêm mới`: `backend/ai-service/app/models/Lavitree_Selected_Classes.csv` (sao chép từ `plan/05_chot_danh_muc_lop_va_gioi_han/`)
  - `Chỉnh sửa`: `backend/ai-service/app/main.py` (chuẩn hóa router prefix và health check `{"status": "ok", "model_loaded": true}`)
  - `Chỉnh sửa`: `backend/ai-service/app/api/endpoints/predict.py` (giới hạn 10MB, trả về 400 nếu lỗi)
  - `Chỉnh sửa`: `backend/ai-service/app/services/predictor.py` (load mapping tiếng Việt & Tier, cấu trúc response khớp `api-contracts.md`)
  - `Thêm mới`: `backend/ai-service/test_predict.py` (kiểm thử tự động)
- **Hợp đồng dữ liệu (API Contract SSOT)**:
  - Khớp 100% với định dạng JSON tại **Mục 2.1 trong `docs/architecture/api-contracts.md`**.
  - Ví dụ: `Tomato___Late_blight` được phân cấp chuẩn là `"TIER_2_CONDITIONAL"`.

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [ ] **Pha 1**: Sao chép `Lavitree_Selected_Classes.csv` vào `backend/ai-service/app/models/`.
- [ ] **Pha 2**: Nâng cấp `predictor.py` đọc file CSV để tạo từ điển ánh xạ `class_code -> {plant_name, disease_name, tier}`. Cập nhật logic `is_uncertain = confidence < 0.70` và sinh `warning_message`.
- [ ] **Pha 3**: Sửa `main.py` và `predict.py` chuẩn hóa endpoint `POST /api/v1/predict`, kiểm tra `file.size <= 10 * 1024 * 1024`.
- [ ] **Pha 4**: Chạy script `test_predict.py` kiểm thử thời gian phản hồi ($\le 1.0$s trên CPU).

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [ ] Healthcheck `GET /health` trả về `{"status": "ok", "model_loaded": true}`.
- [ ] Endpoint `POST /api/v1/predict` trả về đúng cấu trúc `api-contracts.md` Mục 2.1.
- [ ] Tốc độ suy luận ResNet-18 đạt $\le 1.0$ giây trên CPU.
- [ ] Bằng chứng kiểm thử (Receipts):
  ```bash
  # Dán stdout kiểm thử curl / python test_predict.py tại đây khi nghiệm thu
  ```

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)
- *Ghi nhận sau khi hoàn thành task.*
