# TASK-02: CHUẨN HÓA & TỐI ƯU HÓA BẢN ĐỒ NHIỆT GRAD-CAM (`layer4[-1]`)
* **Sprint**: Sprint 1 (Full-stack Pipeline)
* **Phân hệ**: `backend/ai-service` (FastAPI)
* **Trạng thái**: `[x] DONE`
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
  - `Chỉnh sửa`: `backend/ai-service/app/services/gradcam.py` (bổ sung `generate_heatmap_from_score`, Data URI chuẩn)
  - `Chỉnh sửa`: `backend/ai-service/app/services/predictor.py` (Single-pass inference + `threading.Lock`)
  - `Chỉnh sửa`: `backend/ai-service/app/api/endpoints/predict.py` (tiếp nhận query param `include_heatmap`, đổi sang `def` đồng bộ chạy threadpool)
- **Hợp đồng dữ liệu (API Contract SSOT)**:
  - Cấu trúc trường `gradcam_base64` tuân thủ duy nhất theo [Mục 2.1 trong docs/architecture/api-contracts.md](../../docs/architecture/api-contracts.md#L30-L58).

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [x] **Pha 1**: Cập nhật hàm `predict()` trong `predictor.py` nhận cờ `include_heatmap: bool = True`. Nếu `False`, gán `gradcam_base64 = null`.
- [x] **Pha 2**: Tinh chỉnh `gradcam.py` để xử lý mượt mà trên bộ nhớ RAM (không ghi file tạm ra đĩa cứng), trả về chuỗi Base64 chuẩn `data:image/jpeg;base64,...`.
  - *Mẹo tối ưu hiệu năng (Single-pass inference)*: Khi `include_heatmap = True`, gộp bước dự đoán và trích xuất gradient thành 1 lượt forward pass duy nhất (bật gradient hook trên `layer4[-1]`), thay vì chạy model 2 lần riêng biệt. Điều này giúp cắt giảm ~72% thời gian khi tắt heatmap và giữ thời gian tạo heatmap chỉ ~105ms trên CPU.
- [x] **Pha 3**: Kiểm tra benchmark độ trễ khi bật heatmap vs khi tắt heatmap qua `test_task02_gradcam.py`.


---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [x] Gửi request kèm `include_heatmap=true` trả về chuỗi `gradcam_base64` hợp lệ.
- [x] Gửi request kèm `include_heatmap=false` trả về `gradcam_base64: null` với độ trễ giảm rõ rệt (giảm 72%).
- [x] Bằng chứng kiểm thử (Receipts - Output thực tế từ `python test_task02_gradcam.py`):
  ```text
  === KIỂM THỬ TASK-02: GRAD-CAM SINGLE-PASS INFERENCE & BENCHMARK ===

  [1/3] Đo đạc khi BẬT Grad-CAM heatmap (include_heatmap=True)...
     Các lần đo: ['146.2ms', '95.0ms', '95.2ms', '96.7ms', '92.5ms']
     Thời gian trung bình khi CÓ Heatmap: 105.1ms

  [2/3] Đo đạc khi TẮT Grad-CAM heatmap (include_heatmap=False)...
     Các lần đo: ['29.0ms', '29.7ms', '29.6ms', '28.9ms', '29.7ms']
     Thời gian trung bình khi TẮT Heatmap: 29.4ms

  [3/3] Đánh giá hiệu quả tối ưu:
     - Tiết kiệm thời gian khi tắt heatmap: 75.7ms (72.0%)
     - Cả 2 trường hợp đều đáp ứng xuất sắc tiêu chuẩn <= 1000ms trên CPU!

   -> PASSED: Task 02 Single-Pass Grad-CAM hoàn thành xuất sắc!
  ```

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)
- **Tối ưu Single-Pass Inference**: Thay vì gọi forward pass 2 lần (lần 1 lấy logits, lần 2 tính đạo hàm trong `generate_heatmap`), ta truyền trực tiếp `outputs[0, predicted_idx]` vào `generate_heatmap_from_score(score)` để backward từ lượt forward duy nhất.
- **Thread-Safety**: Bổ sung `threading.Lock` trong `PlantPredictor` để đảm bảo an toàn luồng khi nhiều request truy cập đồng thời, không bị ghi đè activations hay gradients của hook.
- **Non-blocking Server**: Đổi endpoint `predict_plant_disease` sang `def` thường để FastAPI tự động dispatch sang threadpool, giải phóng Event Loop chính cho health check `/health`.
- **Zero Disk I/O**: Quá trình hòa trộn màu Jet Colormap (alpha=0.45) và nén JPEG chất lượng 90 diễn ra hoàn toàn trong `io.BytesIO` trên RAM.

