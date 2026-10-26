# TASK-01: THIẾT LẬP AI VISION SERVICE & ENDPOINT NHẬN DIỆN RESNET-18
* **Sprint**: Sprint 1 (Full-stack Pipeline)
* **Phân hệ**: `backend/ai-service` (FastAPI)
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên B (AI Vision Specialist)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Mô tả ngắn**: Đóng gói dịch vụ AI Vision độc lập bằng FastAPI, nạp trọng số mô hình PyTorch ResNet-18 (`best_plant_model.pt`) và danh mục 38 lớp (`class_indices.json`). Cung cấp endpoint nhận diện ảnh lá, trả về kết quả Top-1, Top-3, phân cấp Tier 1/2/3 và kiểm tra độ bất định $T < 0.70$.
- **Tài liệu tham chiếu**:
  - Spec: `docs/spec/features.md` (FEAT-02)
  - Spec: `docs/spec/classes-tier.md` (38 lớp & Tier Policy)
  - Architecture: `docs/architecture/api-contracts.md` (Mục 2.1)

---

## 2. ĐẶC TẢ KỸ THUẬT (SPECIFICATIONS)
- **Danh sách file tác động**:
  - `Thêm mới`: `backend/ai-service/app/main.py`
  - `Thêm mới`: `backend/ai-service/app/services/predictor.py`
  - `Thêm mới`: `backend/ai-service/app/models/best_plant_model.pt` (sao chép từ `plant-model-test/backend/`)
  - `Thêm mới`: `backend/ai-service/app/models/class_indices.json`
  - `Thêm mới`: `backend/ai-service/requirements.txt`
  - `Thêm mới`: `backend/ai-service/Dockerfile`
  - `Thêm mới`: `backend/ai-service/test_predict.py`
- **Hợp đồng dữ liệu (API Contract)**:
  - Endpoint: `POST /api/v1/predict`
  - Request: `multipart/form-data` chứa trường `file` (ảnh JPEG/PNG).
  - Response:
    ```json
    {
      "success": true,
      "top1": {
        "class_code": "Tomato___Late_blight",
        "plant_name": "Cà chua",
        "disease_name": "Bệnh mốc sương cà chua",
        "confidence": 0.9462,
        "tier": "Tier 1",
        "is_uncertain": false
      },
      "top3": [ ... ],
      "warning": null,
      "inference_time_ms": 28.5
    }
    ```
- **Xử lý tình huống biên (Edge Cases)**:
  - File gửi lên không phải ảnh $\rightarrow$ Trả về mã lỗi 400 kèm message: "File tải lên không phải ảnh hợp lệ".
  - Điểm tin cậy $< 0.70$ hoặc thuộc Tier 2/3 $\rightarrow$ Gán cờ `is_uncertain: true` và cảnh báo chụp lại.

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [ ] **Pha 1**: Sao chép `best_plant_model.pt` và `class_indices.json` vào thư mục `backend/ai-service/app/models/`.
- [ ] **Pha 2**: Viết module `predictor.py` định nghĩa kiến trúc ResNet-18, transform ảnh 224x224 (Normalize ImageNet), hàm suy luận `predict_leaf_disease`.
- [ ] **Pha 3**: Viết `main.py` cấu hình FastAPI, CORS middleware, endpoint `GET /health` và `POST /api/v1/predict`.
- [ ] **Pha 4**: Viết script `test_predict.py` kiểm thử gửi ảnh mẫu thực tế từ `plant-model-test`.

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
- [ ] Healthcheck `GET /health` trả về `{"status": "healthy", "model_loaded": true}`.
- [ ] Endpoint `POST /api/v1/predict` suy luận trong thời gian $< 100$ms trên CPU.
- [ ] Bằng chứng kiểm thử (Receipts):
  ```bash
  # Dán stdout kiểm thử curl / python test_predict.py tại đây khi nghiệm thu
  ```

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)
- *Ghi nhận sau khi hoàn thành task.*
