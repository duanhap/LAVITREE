# TASK-02: ENDPOINT TRÍCH XUẤT BẢN ĐỒ NHIỆT GRAD-CAM (`layer4[-1]`)
* **Sprint**: Sprint 1 (Full-stack Pipeline)
* **Phân hệ**: `backend/ai-service` (FastAPI)
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên B (AI Vision Specialist)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Mô tả ngắn**: Tích hợp thuật toán Explainable AI (Grad-CAM) vào mô hình ResNet-18 tại tầng tích chập cuối cùng (`model.layer4[-1]`). Tạo bản đồ nhiệt trực quan hóa vùng nơ-ron tập trung nhận diện đốm nấm trên phiến lá, phủ Jet colormap mờ 50% lên ảnh gốc và trả về dưới dạng Base64 khi tham số `include_heatmap=true`.
- **Tài liệu tham chiếu**:
  - Spec: `docs/spec/features.md` (FEAT-02)
  - Research: `plan/04_phan_tich_gradcam_tieu_bieu.md`
  - Architecture: `docs/architecture/api-contracts.md` (Mục 2.1)

---

## 2. ĐẶC TẢ KỸ THUẬT (SPECIFICATIONS)
- **Danh sách file tác động**:
  - `Thêm mới`: `backend/ai-service/app/services/gradcam.py`
  - `Chỉnh sửa`: `backend/ai-service/app/main.py`
- **Hợp đồng dữ liệu (API Contract)**:
  - Query param: `include_heatmap=true`
  - Response có thêm trường `gradcam_heatmap_base64` (chuỗi Base64 ảnh JPEG).

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [ ] **Pha 1**: Cài đặt lớp `GradCAM` bằng PyTorch hook (forward & backward hook trên `layer4[-1]`).
- [ ] **Pha 2**: Tính toán trọng số gradients, hàm kích hoạt ReLU, resize heatmap về 224x224 và phủ Jet colormap lên ảnh gốc bằng OpenCV / PIL.
- [ ] **Pha 3**: Tích hợp vào endpoint `POST /api/v1/predict` và benchmark thời gian sinh heatmap ($< 150$ms).

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [ ] Tham số `include_heatmap=true` sinh chuỗi base64 hợp lệ, giải mã hiển thị được ảnh heatmap.
- [ ] Bằng chứng kiểm thử (Receipts):
  ```bash
  # Dán stdout kiểm thử tại đây khi nghiệm thu
  ```

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)
- *Ghi nhận sau khi hoàn thành task.*
