# 📜 HỢP ĐỒNG GIAO TIẾP DỮ LIỆU API (API-CONTRACTS.MD)
## Hệ thống Lavitree — Đặc tả JSON Request & Response giữa các Microservices
*Tài liệu chuẩn hóa giao tiếp giữa Mobile/Web $\leftrightarrow$ Core API $\leftrightarrow$ AI Vision & Agent Service*

---

## 1. NGUYÊN TẮC THIẾT KẾ CHUNG
- **Định dạng dữ liệu**: `application/json` (đối với dữ liệu văn bản) và `multipart/form-data` (đối với tải ảnh lên).
- **Mã phản hồi chuẩn**:
  - `200 OK`: Thành công, trả về dữ liệu.
  - `201 Created`: Tạo mới thành công (Đơn hàng, Nguồn tri thức).
  - `400 Bad Request`: Ảnh không đúng định dạng hoặc thiếu trường bắt buộc.
  - `422 Unprocessable Entity`: Ảnh không thể giải mã thành bitmap tensor.
  - `500 Internal Server Error`: Lỗi máy chủ (có log trace nội bộ).
- **Cấu trúc JSON phản hồi tiêu chuẩn**:
  ```json
  {
    "success": true,
    "message": "Thông báo ngắn gọn",
    "data": { ... },
    "timestamp": "2026-10-26T15:00:00Z"
  }
  ```

---

## 2. PHÂN HỆ 1: AI VISION SERVICE (`ai-service:8000`)
*Dịch vụ nội bộ nhận diện ảnh lá bằng ResNet18 & sinh Grad-CAM*

### 2.1. `POST /api/v1/predict` (Chẩn đoán ảnh lá cây)
- **Content-Type**: `multipart/form-data`
- **Request Parameters**:
  - `file`: File ảnh (jpg, png, webp - dung lượng $\le 10$ MB).
  - `include_heatmap` *(query, boolean, mặc định true)*: Có xuất ảnh Grad-CAM không.

- **Response Body (`200 OK`)**:
  ```json
  {
    "success": true,
    "top1": {
      "class_code": "Tomato___Late_blight",
      "plant_name": "Cà chua",
      "disease_name": "Bệnh mốc sương cà chua",
      "confidence": 0.9462,
      "tier": "TIER_2_CONDITIONAL"
    },
    "top3": [
      { "class_code": "Tomato___Late_blight", "confidence": 0.9462 },
      { "class_code": "Tomato___Early_blight", "confidence": 0.0315 },
      { "class_code": "Tomato___Septoria_leaf_spot", "confidence": 0.0102 }
    ],
    "is_uncertain": false,
    "warning_message": "Lớp bệnh Tier 2 dễ bị ảnh hưởng bởi phông nền dã ngoại. Khuyến nghị chụp cận cảnh 15-20cm trên nền trơn.",
    "gradcam_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...",
    "inference_time_ms": 320
  }
  ```

---

## 3. PHÂN HỆ 2: CORE BUSINESS API (`core-api:5000`)
*Cửa ngõ chính (Gateway) phục vụ Web Portal và Mobile Android*

### 3.1. `POST /api/v1/diagnose` (Khám lá toàn trình khép kín)
*Nông dân gửi ảnh $\rightarrow$ Core API gọi AI $\rightarrow$ Lấy hướng dẫn xử lý chuẩn IPM & vật tư từ DB $\rightarrow$ Lưu lịch sử $\rightarrow$ Trả kết quả trọn gói.*
- **Content-Type**: `multipart/form-data`
- **Request Form**:
  - `image`: File ảnh lá chụp từ camera/gallery.
  - `userId` *(UUID, optional)*: Mã người dùng đăng nhập.
  - `notes` *(string, optional)*: Ghi chú của nông dân (Ví dụ: "Vườn cà chua 2 sào").

- **Response Body (`200 OK`)**:
  ```json
  {
    "success": true,
    "diagnosis_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "result": {
      "plant_name": "Cà chua",
      "disease_name": "Bệnh mốc sương cà chua",
      "class_code": "Tomato___Late_blight",
      "confidence": 0.9462,
      "severity_level": "Nghiêm trọng (Cần xử lý trong 24-48h)",
      "is_uncertain": false,
      "warning": "Khuyến nghị chụp lại cận cảnh 15-20cm nếu ảnh có nhiều cỏ dại xung quanh."
    },
    "visual_evidence": {
      "original_image_url": "http://localhost:9000/lavitree-diagnoses/a1b2c3d4_orig.jpg",
      "gradcam_image_url": "http://localhost:9000/lavitree-diagnoses/a1b2c3d4_gradcam.jpg"
    },
    "treatment_guidelines": [
      {
        "step_order": 1,
        "action_title": "Biện pháp Canh tác & Cơ học",
        "instructions": "Cắt tỉa toàn bộ lá bệnh bị mốc trắng nhúng nước vôi, tiêu hủy cách xa vườn để tránh phát tán bào tử nấm.",
        "isolation_days": null
      },
      {
        "step_order": 2,
        "action_title": "Biện pháp Hóa sinh & Sinh học",
        "instructions": "Phun luân phiên thuốc gốc đồng hoặc hoạt chất Mancozeb / Metalaxyl vào sáng sớm khi nấm chớm xuất hiện.",
        "isolation_days": "7 ngày"
      },
      {
        "step_order": 3,
        "action_title": "Biện pháp Dinh dưỡng & Phục hồi",
        "instructions": "Bổ sung vi sinh đối kháng Trichoderma và Kali - Silic giúp cứng gân lá và phục hồi hệ rễ.",
        "isolation_days": null
      }
    ],
    "recommended_products": [
      {
        "id": 1,
        "name": "Ridomil Gold 68WP",
        "active_ingredient": "Mancozeb 64% + Metalaxyl-M 4%",
        "price": 65000,
        "unit": "Gói 100g",
        "image_url": "/images/products/ridomil.jpg"
      }
    ],
    "verified_sources": [
      {
        "organization": "Trung tâm Khuyến nông Quốc gia",
        "title": "Biện pháp phòng trừ bệnh sương mai cà chua",
        "url": "https://khuyennongvn.gov.vn/..."
      }
    ]
  }
  ```

---

### 3.2. `GET /api/v1/diagnose/history` (Lịch sử khám bệnh)
- **Query Params**: `userId`, `page=1`, `pageSize=10`
- **Response Body (`200 OK`)**:
  ```json
  {
    "total_records": 12,
    "items": [
      {
        "id": "a1b2c3d4-...",
        "created_at": "2026-10-26T14:30:00Z",
        "plant_name": "Cà chua",
        "disease_name": "Bệnh mốc sương cà chua",
        "confidence": 0.9462,
        "recovery_status": "Đang theo dõi",
        "thumbnail_url": "/uploads/diagnoses/20261026_orig.jpg"
      }
    ]
  }
  ```

---

### 3.3. `GET /api/v1/knowledge/sources` (Kho tri thức bài báo kiểm chứng)
*Khớp với KnowledgeController.cs hiện có trong backend/core-api*
- **Query Params**: `modelClass=Tomato___Late_blight`, `page=1`
- **Response Body (`200 OK`)**:
  ```json
  {
    "total": 5,
    "sources": [
      {
        "id": "0f801a5b-9ad7-40fa-ba30-efe06296910f",
        "model_class": "Tomato___Late_blight",
        "organization": "Trung tâm Khuyến nông Quốc gia",
        "source_title": "Một số loại bệnh hại trên cây cà chua và biện pháp phòng trừ",
        "source_url": "https://khuyennongvn.gov.vn/...",
        "evidence_text": "Bệnh sương mai do nấm Phytopthora infestans gây ra...",
        "source_quality": "Cao (Đại học/Khuyến nông)"
      }
    ]
  }
  ```

---

## 4. PHÂN HỆ 3: AGRI-AGENT SERVICE (`agent-service:8001`)
*Trợ lý nông nghiệp tư vấn thông minh (kế thừa từ thư mục extract/)*

### 4.1. `POST /api/v1/agent/chat` (Tư vấn hội thoại nông nghiệp)
- **Request Body**:
  ```json
  {
    "message": "Thuốc Ridomil Gold pha thế nào cho bình 16 lít hả chuyên gia?",
    "conversation_id": "conv-12345",
    "current_disease_code": "Tomato___Late_blight"
  }
  ```

- **Response Body (`200 OK` hoặc `text/event-stream` SSE Streaming)**:
  ```json
  {
    "reply": "Chào bác! Với bệnh mốc sương trên cà chua, bác dùng gói Ridomil Gold 68WP (100g) pha cho 2 bình 16 lít (tức 50g/bình). Phun ướt đều cả 2 mặt lá vào sáng sớm khi sương vừa tan. Nhớ tuân thủ thời gian cách ly 7 ngày trước khi thu hoạch bác nhé!"
  }
  ```
