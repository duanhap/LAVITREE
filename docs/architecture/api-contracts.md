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
      "confusion_group": null
    },
    "top3": [
      { "class_code": "Tomato___Late_blight", "confidence": 0.9462 },
      { "class_code": "Tomato___Early_blight", "confidence": 0.0315 },
      { "class_code": "Tomato___Septoria_leaf_spot", "confidence": 0.0102 }
    ],
    "is_ood": false,
    "is_uncertain": false,
    "warning_message": "Chụp kỹ cả mặt dưới lá để thấy lớp mốc trắng.",
    "gradcam_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...",
    "inference_time_ms": 320
  }
  ```
  - `confusion_group`: mã nhóm lớp dễ nhầm (ví dụ `"TOMATO_LEAF_SPOT"` cho Early blight ↔ Target spot), `null` nếu không thuộc nhóm nào.
  - `warning_message`: sinh theo thứ tự ưu tiên trong [docs/spec/classes.md](../spec/classes.md#3-quy-tắc-sinh-warning_message-thứ-tự-ưu-tiên) (OOD → bất định → dễ nhầm → mẹo chụp `Capture_Tip`).
  - **Không còn trường `tier`** (đã bỏ phân cấp Tier 1/2/3, xem `classes.md` mục 1).

- **Response Body (`200 OK` - Trường hợp phát hiện ngoại lai `is_ood = true`)**:
  ```json
  {
    "success": true,
    "top1": null,
    "top3": [],
    "is_ood": true,
    "is_uncertain": false,
    "warning_message": "Ảnh nằm ngoài phạm vi 38 lớp cây trồng được hỗ trợ (OOD). Vui lòng không chụp vật thể lạ hoặc ảnh không rõ lá cây.",
    "gradcam_base64": null,
    "inference_time_ms": 110
  }
  ```

- **Error Responses**:
  - `400 Bad Request`: Dung lượng tệp vượt quá 10MB hoặc phần mở rộng/Content-Type không được hỗ trợ (`{"detail": "Tệp vượt quá 10MB hoặc định dạng không hỗ trợ."}`).
  - `422 Unprocessable Entity`: Tệp ảnh bị hỏng byte, không thể giải mã hình ảnh hoặc bị chặn bởi bộ lọc chống Decompression Bomb (`{"detail": "Tệp hình ảnh bị lỗi cấu trúc hoặc không thể giải mã."}`).

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
      "confusion_group": null,
      "warning": "Chụp kỹ cả mặt dưới lá để thấy lớp mốc trắng.",
      "top3": [
        { "class_code": "Tomato___Late_blight", "disease_name": "Bệnh mốc sương cà chua", "confidence": 0.9462 },
        { "class_code": "Tomato___Early_blight", "disease_name": "Bệnh đốm vòng / Cháy lá sớm", "confidence": 0.0315 },
        { "class_code": "Tomato___Septoria_leaf_spot", "disease_name": "Bệnh đốm lá Septoria", "confidence": 0.0102 }
      ]
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

- **Response Body (`200 OK` - Trường hợp ảnh ngoại lai `is_ood = true`)**:
  ```json
  {
    "success": true,
    "diagnosis_id": null,
    "is_ood": true,
    "is_uncertain": false,
    "warning": "Ảnh nằm ngoài phạm vi 38 lớp cây trồng được hỗ trợ (OOD). Vui lòng chụp lại lá cây trong khung ngắm 15–20cm.",
    "result": null,
    "visual_evidence": null,
    "treatment_guidelines": [],
    "recommended_products": [],
    "verified_sources": []
  }
  ```
  > **Chính sách Lưu trữ & Quyền riêng tư đối với ảnh OOD**: Khi `is_ood: true`, Core API **tuyệt đối không tải ảnh lên MinIO** và **không tạo bản ghi trong bảng `DiagnosisRecords`**. Điều này giúp loại bỏ rủi ro lưu trữ ảnh khuôn mặt / thông tin nhạy cảm của người dùng và tiết kiệm dung lượng lưu trữ của hệ thống.

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

### 3.4. `GET /api/v1/medicines/search` (Tra cứu Danh mục Thuốc BVTV cho Agent MCP & Store)
*Giao ước Ngày Đầu Tiên (Day 1 Contract) phục vụ công cụ `query_pesticide_store` của FastMCP Server*
- **Query Params**: 
  - `diseaseCode` (string, optional, ví dụ `Tomato___Late_blight`)
  - `requireRainResistant` (boolean, optional, mặc định `false`)
  - `allowedOnly` (boolean, optional, mặc định `true`)
- **Response Body (`200 OK`)**:
  ```json
  {
    "total": 3,
    "disease_code": "Tomato___Late_blight",
    "items": [
      {
        "id": "11111111-2222-3333-4444-555555555551",
        "name": "Ridomil Gold 68WG",
        "active_ingredient": "Metalaxyl-M 40g/kg + Mancozeb 640g/kg",
        "medicine_type": "Hóa học",
        "price": 65000,
        "dosage_instruction": "Pha 50g cho bình 16L nước, phun ướt đều mặt lá khi bệnh chớm xuất hiện",
        "phi_days": 7,
        "is_allowed": true,
        "rain_resistant": true,
        "stock_quantity": 150,
        "image_url": "https://lavitree.io.vn/images/products/ridomil-gold.png"
      },
      {
        "id": "11111111-2222-3333-4444-555555555552",
        "name": "Antracol 70WP",
        "active_ingredient": "Propineb 700g/kg + Kẽm (Zn++)",
        "medicine_type": "Hóa học",
        "price": 45000,
        "dosage_instruction": "Pha 40-50g cho bình 16L nước, phun phòng trừ mốc sương và thán thư",
        "phi_days": 7,
        "is_allowed": true,
        "rain_resistant": false,
        "stock_quantity": 120,
        "image_url": "https://lavitree.io.vn/images/products/antracol.png"
      },
      {
        "id": "11111111-2222-3333-4444-555555555553",
        "name": "Chế phẩm sinh học Trichoderma Bacillus",
        "active_ingredient": "Trichoderma spp. (10^9 CFU/g) + Bacillus subtilis",
        "medicine_type": "Sinh học",
        "price": 55000,
        "dosage_instruction": "Pha 30g cho bình 16L nước hoặc tưới gốc đối kháng nấm bệnh",
        "phi_days": 0,
        "is_allowed": true,
        "rain_resistant": true,
        "stock_quantity": 200,
        "image_url": "https://lavitree.io.vn/images/products/trichoderma.png"
      }
    ]
  }
  ```

---

### 3.5. `POST /api/v1/auth/register` & `POST /api/v1/auth/login` (Xác thực JWT Nông dân & Admin)
- **POST `/api/v1/auth/register`**:
  - Request: `{ "email": "farmer@lavitree.vn", "password": "secure_password", "full_name": "Nguyễn Văn Nông", "phone_number": "0987654321" }`
  - Response (`201 Created`):
    ```json
    {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "token_type": "Bearer",
      "expires_in": 86400,
      "user": {
        "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        "email": "farmer@lavitree.vn",
        "full_name": "Nguyễn Văn Nông",
        "role": "FARMER"
      }
    }
    ```
- **POST `/api/v1/auth/login`**:
  - Request: `{ "email": "farmer@lavitree.vn", "password": "secure_password" }`
  - Response (`200 OK`): Cấu trúc token tương tự register.

---

## 4. PHÂN HỆ 3: TÁC TỬ NÔNG NGHIỆP THÔNG MINH (`agent-service:8001`)
*Tác tử tự hành ReAct Loop kết nối công cụ MCP Tools (Kế thừa toàn diện nghiên cứu 27 DAY từ thư mục `extract/`)*

### 4.1. `POST /api/v1/agent/chat` (Hội thoại Tác tử Streaming SSE)
- **Headers**: `Accept: text/event-stream`
- **Request Body (`application/json`)**:
  ```json
  {
    "message": "Vườn cà chua của tôi bị sương mai, 2 ngày nữa thu hoạch, chiều nay có mưa không và xử lý thế nào?",
    "conversation_id": "conv-a1b2c3d4",
    "location": "Hà Nam",
    "harvest_days_left": 2,
    "current_disease_code": "Tomato___Late_blight"
  }
  ```

- **Streaming Response (`text/event-stream`)**:
  ```text
  event: trace_start
  data: {"trace_id": "tr-987654", "status": "thinking"}

  event: thought
  data: {"step": 1, "thought": "Cần kiểm tra thời tiết tại Hà Nam chiều nay để xem có nguy cơ mưa rửa trôi không."}

  event: action
  data: {"step": 1, "tool": "check_weather_risk", "params": {"location": "Hà Nam", "forecast_hours": 12}}

  event: observation
  data: {"step": 1, "result": {"is_rain": true, "rainfall_mm": 20, "humidity": 92, "recommendation": "NGUY CƠ RỬA TRÔI"}}

  event: thought
  data: {"step": 2, "thought": "Trời chiều nay có mưa to. Cây thu hoạch sau 2 ngày -> vi phạm thời gian cách ly PHI của thuốc hóa học (7-14 ngày). Phải kích hoạt Boundary Guardrail chặn thuốc BVTV hóa học, tìm giải pháp cơ học & sinh học thay thế."}

  event: delta
  data: {"token": "Chào "}
  event: delta
  data: {"token": "bác! "}
  event: delta
  data: {"token": "Vì cà chua của bác chỉ còn 2 ngày nữa là thu hoạch..."}

  event: final_answer
  data: {
    "trace_id": "tr-987654",
    "answer": "Chào bác! Hệ thống nhận diện vườn cà chua chỉ còn 2 ngày nữa là thu hoạch và chiều nay tại Hà Nam có mưa to (20mm):\n1. ⛔ KHÔNG PHUN THUỐC HÓA HỌC: Các loại thuốc như Ridomil Gold có thời gian cách ly (PHI) tối thiểu 7 ngày, nếu phun sẽ gây tồn dư độc hại.\n2. ✂️ BIỆN PHÁP CƠ HỌC: Cắt tỉa ngay các lá bị sương mai, cho vào bao kín mang đi tiêu hủy xa vườn.\n3. 🌿 BIỆN PHÁP SINH HỌC: Bác có thể quét nước vôi trong hoặc dùng chế phẩm Nano Bạc hữu cơ cách ly 0 ngày sau cơn mưa.",
    "draft_order": null,
    "guardrail_triggered": "PHI_PROTECTION_LESS_THAN_3_DAYS",
    "total_latency_ms": 1150
  }
  ```

---

### 4.2. `GET /api/v1/agent/trace/{trace_id}` (Quan sát Vết Thực thi - Agent Observability)
*Phục vụ Màn hình Waterfall Chart trên Admin Dashboard và báo cáo hội đồng*
- **Response Body (`200 OK`)**:
  ```json
  {
    "trace_id": "tr-987654",
    "timestamp": "2026-10-26T14:35:10Z",
    "total_duration_ms": 1150,
    "total_tokens": 420,
    "steps": [
      {
        "step_order": 1,
        "type": "thought",
        "content": "Kiểm tra dự báo thời tiết tại Hà Nam",
        "duration_ms": 120
      },
      {
        "step_order": 2,
        "type": "action",
        "tool_name": "check_weather_risk",
        "tool_input": {"location": "Hà Nam", "forecast_hours": 12},
        "tool_output": {"is_rain": true, "rainfall_mm": 20},
        "duration_ms": 280
      },
      {
        "step_order": 3,
        "type": "guardrail_check",
        "guardrail_name": "verify_phi_safety",
        "status": "BLOCKED_CHEMICAL_PESTICIDE",
        "reason": "Harvest days (2) < Chemical PHI (7)",
        "duration_ms": 40
      },
      {
        "step_order": 4,
        "type": "final_synthesis",
        "duration_ms": 710
      }
    ]
  }
  ```
