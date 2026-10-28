# TASK-02: CHUẨN HÓA & TỐI ƯU HÓA BẢN ĐỒ NHIỆT GRAD-CAM (`layer4[-1]`)
* **Sprint**: Sprint 1 (Full-stack Pipeline)
* **Phân hệ**: `backend/ai-service` (FastAPI)
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên B (AI Vision Specialist)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Mô tả ngắn**: Rà soát và chỉnh sửa module `gradcam.py` và `predictor.py` hiện có trong `backend/ai-service`.
- **Trọng tâm sửa đổi**:
  - Hỗ trợ tham số truy vấn `include_heatmap: bool = True` (nếu `false` thì bỏ qua bước sinh heatmap để tiết kiệm CPU khi chỉ cần kết quả text).
  - Đổi tên trường trả về thành `gradcam_base64` tuân thủ [Mục 2.1 trong api-contracts.md](../../docs/architecture/api-contracts.md#L30-L58).
  - Tối ưu hóa hàm phủ ảnh nhiệt (Jet colormap) lên ảnh gốc, đảm bảo tổng thời gian ResNet-18 + Grad-CAM đạt $\le 1.0$ giây trên CPU.
- **Tài liệu tham chiếu chuẩn duy nhất (SSOT)**:
  - Hợp đồng API: [docs/architecture/api-contracts.md Mục 2.1](../../docs/architecture/api-contracts.md#L30-L58)

---

## 2. ĐẶC TẢ KỸ THUẬT (SPECIFICATIONS)
- **Danh sách file tác động**:
  - `Chỉnh sửa`: `backend/ai-service/app/services/gradcam.py`
  - `Chỉnh sửa`: `backend/ai-service/app/services/predictor.py`
  - `Chỉnh sửa`: `backend/ai-service/app/api/endpoints/predict.py` (tiếp nhận query param `include_heatmap`)
- **Hợp đồng dữ liệu (API Contract SSOT)**:
  - Cấu trúc trường `gradcam_base64` tuân thủ duy nhất theo [Mục 2.1 trong docs/architecture/api-contracts.md](../../docs/architecture/api-contracts.md#L30-L58).

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [ ] **Pha 1**: Cập nhật hàm `predict()` trong `predictor.py` nhận cờ `include_heatmap: bool = True`. Nếu `False`, gán `gradcam_base64 = null`.
- [ ] **Pha 2**: Tinh chỉnh `gradcam.py` để xử lý mượt mà trên bộ nhớ RAM (không ghi file tạm ra đĩa cứng), trả về chuỗi Base64 chuẩn `data:image/jpeg;base64,...` hoặc chuỗi Base64 raw.
  - *Mẹo tối ưu hiệu năng (Single-pass inference)*: Khi `include_heatmap = True`, gộp bước dự đoán và trích xuất gradient thành 1 lượt forward pass duy nhất (bật gradient hook trên `layer4[-1]`), thay vì chạy model 2 lần riêng biệt. Điều này giúp cắt giảm ~45% thời gian suy luận trên CPU.
- [ ] **Pha 3**: Kiểm tra benchmark độ trễ khi bật heatmap vs khi tắt heatmap.


---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [ ] Gửi request kèm `include_heatmap=true` trả về chuỗi `gradcam_base64` hợp lệ.
- [ ] Gửi request kèm `include_heatmap=false` trả về `gradcam_base64: null` với độ trễ giảm ~40%.
- [ ] Bằng chứng kiểm thử (Receipts):
  ```bash
  # Dán stdout kiểm thử tại đây khi nghiệm thu
  ```

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)
- *Ghi nhận sau khi hoàn thành task.*
