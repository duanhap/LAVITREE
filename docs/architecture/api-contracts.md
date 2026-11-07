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
  - `image`: File ảnh lá chụp từ camera/gallery (Bắt buộc).
  - `notes` *(string, optional)*: Ghi chú của nông dân (Ví dụ: "Vườn cà chua 2 sào").
  - *(Bảo mật - Vá IDOR)*: Đã loại bỏ hoàn toàn tham số `userId` khỏi Form data. Hệ thống tự động trích xuất `userId` từ Header `Authorization: Bearer <jwt_token>` nếu người dùng đã đăng nhập, hoặc gán `null` cho khách vãng lai.

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


### 3.2. `GET /api/v1/diagnose/history` (Lịch sử khám bệnh cá nhân)
- **Headers**: `Authorization: Bearer <jwt_token>` (Bắt buộc; trích xuất `userId` trực tiếp từ JWT Claims, bảo mật chống rò rỉ dữ liệu chẩn đoán của người dùng khác)
- **Query Params**: `page=1` (mặc định: 1), `pageSize=10` (mặc định: 10, tối đa: 50)
- **Lưu ý nghiệp vụ**: Bỏ hẳn tham số `userId` trên Query String để ngăn chặn lỗ hổng IDOR (Insecure Direct Object References).
- **Response Body (`200 OK`)**:
  ```json
  {
    "total_records": 12,
    "page": 1,
    "page_size": 10,
    "items": [
      {
        "id": "a1b2c3d4-...",
        "created_at": "2026-10-26T14:30:00Z",
        "plant_name": "Cà chua",
        "disease_name": "Bệnh mốc sương cà chua",
        "class_code": "Tomato___Late_blight",
        "confidence": 0.9462,
        "is_uncertain": false,
        "recovery_status": "Đang theo dõi",
        "original_image_url": "http://localhost:3000/lavitree-diagnoses/a1b2c3d4_orig.jpg",
        "gradcam_image_url": "http://localhost:3000/lavitree-diagnoses/a1b2c3d4_cam.jpg"
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
        "unit_type": "SUMMARY",
        "is_verbatim": false,
        "is_manual_approved": true,
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
  - `allowedOnly` (boolean, optional, mặc định `true`). `false` chỉ dành cho Admin (JWT role `ADMIN` hoặc `X-Admin-Key`), không có quyền thì `403`.
- **Rate limit**: `PUBLIC_API_RATE_LIMIT_PER_MINUTE` (mặc định 60 request/phút/IP), vượt thì `429`. Agent gửi `X-Internal-Key` hợp lệ nên không bị tính chung vào giới hạn này (áp dụng cả Mục 3.9).
- **Lỗi CSDL ở Production**: `503`. `is_fallback: true` chỉ xuất hiện khi chạy Development hoặc `ENABLE_DEV_FALLBACK=true`, nghĩa là danh mục mẫu, không phải kho thật.
- **Response Body (`200 OK`)**:
  ```json
  {
    "total": 3,
    "disease_code": "Tomato___Late_blight",
    "is_fallback": false,
    "items": [
      {
        "id": 1,
        "name": "Ridomil Gold 68WG",
        "active_ingredient": "Metalaxyl-M 40g/kg + Mancozeb 640g/kg",
        "medicine_type": "Hóa học",
        "price": 65000,
        "dosage_instruction": "Pha 50g cho bình 16L nước, phun ướt đều mặt lá khi bệnh chớm xuất hiện",
        "phi_days": 7,
        "is_allowed": true,
        "rain_resistant": true,
        "stock_quantity": 150,
        "image_url": "/lavitree-diagnoses/products/ridomil-gold.png"
      },
      {
        "id": 2,
        "name": "Antracol 70WP",
        "active_ingredient": "Propineb 700g/kg + Kẽm (Zn++)",
        "medicine_type": "Hóa học",
        "price": 45000,
        "dosage_instruction": "Pha 40-50g cho bình 16L nước, phun phòng trừ mốc sương và thán thư",
        "phi_days": 7,
        "is_allowed": true,
        "rain_resistant": false,
        "stock_quantity": 120,
        "image_url": "/lavitree-diagnoses/products/antracol.png"
      },
      {
        "id": 3,
        "name": "Chế phẩm sinh học Trichoderma Bacillus",
        "active_ingredient": "Trichoderma spp. (10^9 CFU/g) + Bacillus subtilis",
        "medicine_type": "Sinh học",
        "price": 55000,
        "dosage_instruction": "Pha 30g cho bình 16L nước hoặc tưới gốc đối kháng nấm bệnh",
        "phi_days": 0,
        "is_allowed": true,
        "rain_resistant": true,
        "stock_quantity": 200,
        "image_url": "/lavitree-diagnoses/products/trichoderma.png"
      }
    ]
  }
  ```

---

  *(Lưu ý về URL ảnh: Backend trả về đường dẫn tương đối `/lavitree-diagnoses/products/...` hoặc tự động tiền tố từ biến môi trường `MINIO_PUBLIC_URL`. Nginx tự động reverse proxy đường dẫn `/lavitree-diagnoses/` sang MinIO container port 9000. Nhờ đó, cả ở localhost lẫn Production server trên AWS EC2 hay domain thật, ảnh đều hiển thị mượt mà không bị lỗi hardcode localhost).*

---

### 3.5. `POST /api/v1/auth/register` & `POST /api/v1/auth/login` (Xác thực JWT Nông dân & Admin)
- **POST `/api/v1/auth/register`**:
  - Request: `{ "email": "farmer@lavitree.vn", "password": "secure_password", "full_name": "Nguyễn Văn Nông", "phone_number": "0987654321" }`
  - Response (`201 Created`):
    ```json
    {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "token_type": "Bearer",
      "expires_in": 604800,
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

---

### 3.6. `POST /api/v1/orders` (Tạo đơn hàng Vật tư Nông nghiệp - COD)
- **Headers**: `Authorization: Bearer <jwt_token>` (Bắt buộc; trích xuất `userId` từ token claims).
- **Request Body (`application/json`)**:
  ```json
  {
    "items": [
      { "product_id": 1, "quantity": 2 },
      { "product_id": 3, "quantity": 1 }
    ],
    "shipping_address": "Xã Nghĩa Bình, Huyện Nghĩa Hưng, Nam Định",
    "phone_number": "0987654321",
    "payment_method": "COD"
  }
  ```
- **Quy tắc Nghiệp vụ & Bảo mật**:
  - Backend Core API **tự truy vấn bảng `Products`** để tính lại đơn giá và tổng tiền, **kiểm tra `IsAllowed == true`** (từ chối bán thuốc bị cấm).
  - Tuyệt đối không nhận giá tiền (`price`) từ Client hay Agent gửi lên.
- **Response Body (`201 Created`)**:
  ```json
  {
    "order_id": "ord-778899aa",
    "total_amount": 185000,
    "payment_method": "COD",
    "order_status": "Pending",
    "created_at": "2026-10-31T14:30:00Z"
  }
  ```

---

### 3.7. `PATCH /api/v1/knowledge/sources/{id}/approve` & `PATCH /api/v1/knowledge/sources/approve-batch` (Duyệt Nguồn Tri thức Đơn lẻ & Hàng loạt - HITL)
- **Headers**: `Authorization: Bearer <Admin_JWT>` (Bắt buộc tài khoản có Claim `role: ADMIN`).
- **Endpoint duyệt 1 bài**: `PATCH /api/v1/knowledge/sources/{id}/approve`
  - **Request Body (`application/json`)**:
    ```json
    {
      "is_approved": true,
      "reviewer_notes": "Đã đối chiếu hoạt chất hợp lệ theo Thông tư Cục BVTV"
    }
    ```
  - **Response Body (`200 OK`)**:
    ```json
    {
      "source_id": "0f801a5b-9ad7-40fa-ba30-efe06296910f",
      "is_manual_approved": true,
      "updated_at": "2026-10-31T14:35:00Z"
    }
    ```
- **Endpoint duyệt hàng loạt (Bulk Approve)**: `PATCH /api/v1/knowledge/sources/approve-batch`
  - *Mục đích*: Cho phép Admin chọn nhiều bài viết (hoặc duyệt toàn bộ bài của 5 bệnh demo hạt nhân) chỉ trong 1 cú click.
  - **Request Body (`application/json`)**:
    ```json
    {
      "source_ids": [
        "0f801a5b-9ad7-40fa-ba30-efe06296910f",
        "11111111-2222-3333-4444-555555555555"
      ],
      "is_approved": true,
      "reviewer_notes": "Duyệt hàng loạt bài viết chuẩn cho 5 bệnh demo hạt nhân"
    }
    ```
  - **Response Body (`200 OK`)**:
    ```json
    {
      "approved_count": 2,
      "status": "success",
      "updated_at": "2026-10-31T14:35:00Z"
    }
    ```
- **Bỏ duyệt**: Gửi `"is_approved": false` (đơn lẻ hoặc hàng loạt) để ngừng dùng bài trong RAG mà không xóa.
- **Cơ chế Đồng bộ RAG**: Sau khi cập nhật `IsManualApproved` (duyệt hoặc bỏ duyệt) trong PostgreSQL, Core API tự động gửi webhook nội bộ `POST http://agent-service:8001/internal/reindex` để Agent tái tạo vector ChromaDB và chỉ mục BM25 ở luồng nền (Mục 4.3).

---

### 3.8. `POST /api/v1/diagnose/{id}/request-expert` (Chuyển ca bệnh khó cho Chuyên gia / Bác sĩ)
- **Headers**: `Authorization: Bearer <jwt_token>`
- **Request Body (`application/json`)**:
  ```json
  {
    "farmer_notes": "Vết bệnh lan nhanh dù đã cắt tỉa lá và cách ly"
  }
  ```
- **Response Body (`200 OK`)**:
  ```json
  {
    "diagnosis_id": "a1b2c3d4-...",
    "requires_expert": true,
    "message": "Đã gửi thông tin ca bệnh tới Bác sĩ Cây trồng phụ trách khu vực."
  }
  ```

---

### 3.9. `GET /api/v1/weather` (Tra cứu Thời tiết Cục bộ kèm Bộ nhớ đệm 1 Giờ)
*Phục vụ công cụ `check_weather_risk` của FastMCP Agent và màn hình tra cứu của Nông dân*
- **Query Params**:
  - `location` (string, tối đa 120 ký tự, ví dụ `Hà Nam` hoặc `Hà Nội`; bỏ trống thì mặc định `Hà Nam`)
  - `forecastHours` (integer, 1–72, mặc định `12`): số giờ dự báo tính từ hiện tại.
- **Headers**: Tùy chọn `Authorization: Bearer <token>`
- **Cơ chế Hoạt động**:
  - Core API đóng vai trò Reverse Proxy gọi tới dịch vụ khí tượng (OpenWeatherMap API hoặc mock provider).
  - Áp dụng bộ nhớ đệm `IMemoryCache` thời hạn **1 giờ (TTL = 3600s)** theo khóa địa danh chuẩn hóa và `forecastHours`.
  - Dùng OpenWeatherMap Forecast API (mỗi mục cách nhau 3 giờ), lấy lượng mưa cộng dồn và xác suất mưa cao nhất trong khoảng dự báo.
  - Tránh lãng phí quota API bên ngoài và tối ưu độ trễ phản hồi (< 20ms khi cache hit).
- **Response Body (`200 OK`)**:
  ```json
  {
    "location": "Hà Nam",
    "temperature_c": 28.5,
    "humidity_percent": 92,
    "rainfall_probability_percent": 85,
    "rainfall_mm": 20,
    "is_rain": true,
    "risk_level": "HIGH",
    "recommendation": "Thời tiết nhiều mây/mưa ẩm (Xác suất mưa 85%). Nguy cơ rửa trôi thuốc rất cao, tuyệt đối không phun thuốc trừ bệnh không kháng nước.",
    "forecast_hours": 12,
    "is_simulated": false,
    "cached_at": "2026-10-31T14:00:00Z"
  }
  ```
- **Lỗi**:
  - `400`: `location` quá dài hoặc `forecastHours` ngoài khoảng 1–72.
  - `429`: vượt `PUBLIC_API_RATE_LIMIT_PER_MINUTE`.
  - `503`: thiếu khoá hoặc OpenWeatherMap lỗi. Production không trả thời tiết giả; `is_simulated: true` chỉ xuất hiện khi chạy Development hoặc `ENABLE_DEV_FALLBACK=true`.

---

### 3.10. `POST /api/v1/knowledge/ingestions` (Nhập bài báo — Bước 1: Dán văn bản, AI đề xuất đoạn trích)
*Chức năng chính của Kho tri thức (TASK-A03). Admin dán văn bản bài báo; hệ thống **không tự tải URL** (không có rủi ro SSRF, đọc được cả bài PDF/trang dựng bằng JavaScript vì Admin tự copy chữ).*
- **Headers**: `Authorization: Bearer <Admin_JWT>` (role `ADMIN`).
- **Request Body (`application/json`)**:
  ```json
  {
    "model_class": "Tomato___Late_blight",
    "source_url": "https://khuyennongvn.gov.vn/...",
    "source_title": "Một số loại bệnh hại trên cây cà chua và biện pháp phòng trừ",
    "organization": "Trung tâm Khuyến nông Quốc gia",
    "published_date": "2023",
    "article_text": "<toàn bộ chữ của bài báo do Admin copy và dán vào>"
  }
  ```
- **Xử lý phía Core API**:
  1. Kiểm tra: `source_url` là `http/https`; `article_text` dài tối đa 50.000 ký tự.
  2. Tách `article_text` thành các đoạn theo dòng trống, bỏ đoạn quá ngắn (< 40 ký tự), đánh số `P1, P2, …` (tối đa 200 đoạn).
  3. Gọi Agent `POST /internal/knowledge/label-paragraphs` (Mục 4.4) để nhận đề xuất nhãn theo **số đoạn**.
  4. Lưu tạm danh sách đoạn trong bộ nhớ (`IMemoryCache`, hết hạn 1 giờ) theo `ingestion_id`. **Không ghi toàn văn vào PostgreSQL.**
- **Response Body (`200 OK`)**:
  ```json
  {
    "ingestion_id": "ing-5f2c9a",
    "expires_at": "2026-11-03T15:00:00Z",
    "paragraphs": [
      { "id": "P1", "text": "Bệnh sương mai do nấm Phytophthora infestans gây ra...", "suggested_unit_type": "CAUSE_CONDITIONS" },
      { "id": "P2", "text": "Vết bệnh ban đầu là những đốm xanh xám...", "suggested_unit_type": "SYMPTOMS" },
      { "id": "P3", "text": "Liên hệ tòa soạn...", "suggested_unit_type": null }
    ],
    "ai_suggestion_available": true
  }
  ```
  - Agent lỗi, trả `503` hoặc không phản hồi (Mục 4.4) → vẫn trả `200` với `suggested_unit_type: null` cho mọi đoạn và `ai_suggestion_available: false`; Admin tự gán nhãn.

### 3.11. `POST /api/v1/knowledge/ingestions/{ingestion_id}/commit` (Nhập bài báo — Bước 2: Admin tick chọn đoạn = Duyệt)
- **Headers**: `Authorization: Bearer <Admin_JWT>` (role `ADMIN`).
- **Request Body (`application/json`)**:
  ```json
  {
    "selections": [
      { "paragraph_id": "P2", "unit_type": "SYMPTOMS" },
      { "paragraph_id": "P1", "unit_type": "CAUSE_CONDITIONS" }
    ],
    "reviewer_notes": "Đã đối chiếu với bài gốc"
  }
  ```
  - Client chỉ gửi **số đoạn**, không gửi chữ. Core tự lấy chữ từ bản lưu tạm theo `ingestion_id`, nên đoạn được lưu **chắc chắn là nguyên văn**.
- **Quy tắc kiểm tra (Core API)**:
  - `unit_type` thuộc: `SYMPTOMS` | `CAUSE_CONDITIONS` | `PREVENTION` | `TREATMENT` (`SUMMARY` chỉ dành cho dữ liệu cũ, không chọn được ở đây).
  - **Tối đa 4 đoạn nguyên văn cho mỗi `source_url`** (tính cả các đoạn đã lưu trước đó). Mỗi đoạn dài tối đa 800 ký tự. Vượt giới hạn → `400`.
  - Đoạn trùng chữ với một đoạn đã lưu của cùng `source_url` → bỏ qua, không lưu lần hai.
  - `ingestion_id` hết hạn → `410 Gone` (Admin dán lại bài).
- **Kết quả**: Mỗi đoạn được tick → 1 dòng `KnowledgeSources` với `EvidenceText` = chữ của đoạn, `UnitType` = nhãn đã chọn, `IsVerbatim = true`, `IsManualApproved = true` (**tick chọn chính là duyệt**). Sau đó Core gọi `POST /internal/reindex` (Mục 4.3).
- **Response Body (`201 Created`)**:
  ```json
  {
    "created_source_ids": ["c1f7a83b-9a2e-4b6a-81a1-8d4e9f123456", "d2e8b94c-0b3f-5c7b-92b5-9e5f0a234567"],
    "verbatim_count_for_url": 2,
    "reindex_status": "accepted"
  }
  ```
- **Quy tắc sửa / gỡ sau khi lưu**: Không cho sửa chữ của đoạn `IsVerbatim = true` (sửa thì không còn là nguyên văn). Chỉ được đổi `UnitType`, bỏ duyệt (`PATCH .../approve` với `is_approved: false`, Mục 3.7) hoặc xóa.

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
  - `conversation_id`: (string, optional). Nếu Client không gửi, Server Agent tự sinh `UUIDv4` mới và trả về ngay trong sự kiện `trace_start`.
  - Giới hạn độ dài (vượt thì `422`): `message` 1–2000 ký tự, `conversation_id` ≤ 64, `location` ≤ 120, `current_disease_code` ≤ 100, `harvest_days_left` từ 0 đến 3650.
  - `harvest_days_left`: (int, optional). Nếu Client bỏ trống (null/omitted), Agent mặc định giả định tình huống cận thu hoạch an toàn nhất ($DaysToHarvest = 0 \rightarrow$ chặn toàn bộ thuốc hóa học) và gắn câu hỏi yêu cầu nông dân xác nhận lại số ngày dự kiến thu hoạch trong câu trả lời.

- **Streaming Response (`text/event-stream`)**:
  ```text
  event: trace_start
  data: {"trace_id": "tr-987654", "conversation_id": "conv-a1b2c3d4", "status": "thinking"}

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
    "answer": "[DRAFT_RECOMMENDATION]\nChào bác! Hệ thống nhận diện vườn cà chua chỉ còn 2 ngày nữa là thu hoạch và chiều nay tại Hà Nam có mưa to (20mm):\n1. ⛔ KHÔNG PHUN THUỐC HÓA HỌC: Các loại thuốc như Ridomil Gold có thời gian cách ly (PHI) tối thiểu 7 ngày, nếu phun sẽ gây tồn dư độc hại.\n2. ✂️ BIỆN PHÁP CƠ HỌC: Cắt tỉa ngay các lá bị sương mai, cho vào bao kín mang đi tiêu hủy xa vườn.\n3. 🌿 BIỆN PHÁP SINH HỌC: Bác sử dụng chế phẩm sinh học Trichoderma Bacillus (thời gian cách ly 0 ngày) tưới gốc hoặc bọc che luống để ngăn nấm lây lan.",
    "draft_order": null,
    "guardrail_triggered": "HARVEST_BEFORE_PHI_VIOLATION",
    "is_offline_fallback": false,
    "citations": [
      {
        "source_id": "0f801a5b-9ad7-40fa-ba30-efe06296910f",
        "source_title": "Một số loại bệnh hại trên cây cà chua và biện pháp phòng trừ",
        "organization": "Trung tâm Khuyến nông Quốc gia",
        "source_url": "https://khuyennongvn.gov.vn/...",
        "excerpt": "Bệnh sương mai do nấm Phytophthora infestans gây ra...",
        "unit_type": "SYMPTOMS",
        "is_verbatim": true
      }
    ],
    "total_latency_ms": 1150
  }
  ```
  *(Lưu ý: Khi Circuit Breaker OPEN hoặc mất kết nối mạng, `is_offline_fallback: true` để giao diện hiển thị nhãn "Đang dùng hướng dẫn lưu sẵn")*
  - **Quy tắc `citations` (bắt buộc — điều kiện "chỉ dẫn nguồn gốc" khi trích dẫn, Điều 25 Luật SHTT & Điều 28 NĐ 17/2023/NĐ-CP)**:
    - Lấy **trực tiếp từ kết quả RAG** (các đoạn đã đưa vào ngữ cảnh cho LLM), **không để LLM tự viết** nguồn hay URL. Gộp trùng theo `source_id`.
    - Không dùng tri thức RAG nào → `citations: []`; giao diện hiển thị "Không có tài liệu tham khảo".
    - `is_verbatim = true`: giao diện hiển thị `excerpt` trong dấu ngoặc kép (trích nguyên văn). `false`: hiển thị là "Tóm tắt" (không đặt trong ngoặc kép).
    - Chế độ offline: `citations` lấy từ trường nguồn được kết xuất sẵn trong `offline_ipm_cache.json`.

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

---

### 4.3. `POST /internal/reindex` (Kích hoạt Tái lập Chỉ mục Vector & BM25 Nội bộ)
*Endpoint nội bộ dành cho Core API thông báo Agent Service khi Admin duyệt bài viết tri thức mới (`PATCH /api/v1/knowledge/sources/{id}/approve`)*
- **Network Scope**: Chỉ gọi nội bộ giữa các container trong Docker Network. Nginx chặn toàn bộ đường dẫn ngoài `/internal/*`.
- **Headers**:
  - `Content-Type: application/json`
  - `X-Internal-Key: <INTERNAL_API_SECRET>` (Bắt buộc; từ chối `401 Unauthorized` nếu sai key)
- **Request Body (`application/json`)**:
  ```json
  {
    "source_id": "0f801a5b-9ad7-40fa-ba30-efe06296910f",
    "action": "approve"
  }
  ```
  - `action`: `approve` | `unapprove` | `delete` | `manual`. Chỉ dùng để ghi log; Agent luôn xử lý giống nhau (xem dưới).
- **Khi nào Core gọi**: sau khi duyệt (đơn lẻ / hàng loạt: gọi **1 lần** cho cả lô), bỏ duyệt, xóa bài, hoặc khi Admin bấm nút "Đồng bộ lại chỉ mục".
- **Xử lý phía Agent** (dựng lại toàn bộ, idempotent, chạy nền):
  - Agent ghi nhận yêu cầu, trả `202 Accepted` ngay rồi dựng chỉ mục ở luồng nền (khoảng 20 giây với 22 bài trên CPU), nên chat không bị đứng và Core không vượt timeout 5s.
  - Truy vấn **toàn bộ** bài `IsManualApproved = true AND IsDeleted = false` bằng tài khoản DB chỉ đọc (`AGENT_DB_URL`).
  - Dựng lại ChromaDB (id document = `Id` của bản ghi) và BM25 từ đầu. Nhờ vậy bài bị bỏ duyệt hoặc bị xóa cũng được gỡ khỏi chỉ mục, và gọi lặp lại không sinh bản trùng. Không còn bài đã duyệt nào thì chỉ mục thành rỗng.
  - Yêu cầu đến giữa lúc đang dựng được gộp lại và chạy thêm đúng một lượt, nên lượt cuối luôn đọc dữ liệu mới nhất. Chỉ mục cũ vẫn phục vụ chat cho tới khi chỉ mục mới dựng xong.
  - DB lỗi: tự thử lại tối đa 5 lần, cách nhau 5 giây. Hết lượt thử thì **giữ nguyên chỉ mục cũ**, không dùng CSV seed (CSV chỉ dùng ở máy dev khi bật `RAG_ALLOW_CSV_FALLBACK=1`).
  - Agent cũng tự chạy một lượt khi khởi động, nên container mới có dữ liệu mà không cần chờ Admin duyệt bài.
- **Xử lý lỗi phía Core (best-effort)**: Việc duyệt trong PostgreSQL vẫn thành công kể cả khi Agent không phản hồi (timeout 5s). Agent trả `202` thì Core trả `"reindex_status": "accepted"` cho Admin. Agent lỗi hoặc timeout thì Core ghi log cảnh báo, trả `"reindex_status": "failed"` để Admin bấm "Đồng bộ lại".
- **Response Body (`202 Accepted`)**:
  ```json
  {
    "status": "accepted",
    "message": "Đã nhận yêu cầu tái lập chỉ mục tri thức",
    "timestamp": "2026-10-31T14:35:05Z"
  }
  ```
- **Xem kết quả**: `GET /internal/reindex/status` (cùng header `X-Internal-Key`) trả về lượt chạy gần nhất. `last_error` chỉ là mã lỗi (`database_unavailable` | `configuration_error` | `internal_error`), không chứa chi tiết hạ tầng:
  ```json
  {
    "running": false,
    "pending": false,
    "indexed_documents": 19,
    "last_success_at": "2026-10-31T14:35:25+00:00",
    "last_failure_at": null,
    "last_error": null
  }
  ```

---

### 4.4. `POST /internal/knowledge/label-paragraphs` (AI gợi ý nhãn cho từng đoạn bài báo — Nội bộ)
*Core API gọi khi Admin nhập bài báo (Mục 3.10). Agent chỉ trả về **số đoạn + nhãn**, không viết ra chữ nào, nên không thể bịa đoạn trích. Không đọc / ghi PostgreSQL.*
- **Network Scope & Headers**: giống Mục 4.3 (chỉ trong mạng Docker, bắt buộc `X-Internal-Key`).
- **Giới hạn đầu vào** (vượt thì `422`): tối đa 200 đoạn, mỗi đoạn tối đa 2000 ký tự, `id` tối đa 50 ký tự.
- **Request Body (`application/json`)**:
  ```json
  {
    "model_class": "Tomato___Late_blight",
    "paragraphs": [
      { "id": "P1", "text": "Bệnh sương mai do nấm Phytophthora infestans gây ra..." },
      { "id": "P2", "text": "Vết bệnh ban đầu là những đốm xanh xám..." }
    ]
  }
  ```
- **Xử lý phía Agent**:
  - Gọi Gemini (model theo env `GEMINI_MODEL`, `temperature = 0`, yêu cầu trả JSON, timeout 30 giây). Prompt coi nội dung đoạn là **dữ liệu, không phải chỉ thị** (chống prompt injection từ bài báo).
  - Kiểm tra đầu ra bằng code: chỉ giữ `id` có trong request (mỗi `id` một lần) và `unit_type` thuộc `SYMPTOMS | CAUSE_CONDITIONS | PREVENTION | TREATMENT`; mọi giá trị khác bị loại.
  - Gợi ý tối đa 4 đoạn phù hợp nhất (khớp giới hạn 4 đoạn / nguồn).
- **Response Body (`200 OK`)**:
  ```json
  {
    "labels": [
      { "id": "P2", "unit_type": "SYMPTOMS" },
      { "id": "P1", "unit_type": "CAUSE_CONDITIONS" }
    ]
  }
  ```
- **Gemini không dùng được** (thiếu key, lỗi, hết giờ, trả sai định dạng): trả `503 Service Unavailable`, không trả `labels` rỗng. Core coi đây là `ai_suggestion_available: false` (Mục 3.10). Core đặt timeout gọi endpoint này ≥ 35 giây.
- **Lưu ý an toàn**: Đoạn `TREATMENT` có thể nhắc tên thuốc / liều lượng từ bài báo. Đó chỉ là ngữ cảnh tham khảo; **liều, PHI và tình trạng cấm/được phép luôn lấy từ bảng `Products`** (Guardrail TASK-07).

---

### 4.5. `/api/v1/mcp/*` (Danh mục & Thực thi Công cụ MCP Nội bộ)
*Lớp dispatcher REST + JSON Schema cho 4 công cụ chỉ đọc. Không phải giao thức MCP JSON-RPC.*
- **Network Scope & Headers**: giống Mục 4.3 (chỉ trong mạng Docker, bắt buộc `X-Internal-Key`, sai hoặc thiếu thì `401`).
- **`GET /api/v1/mcp/tools`**: trả `{"tools": [{"name", "description", "inputSchema"}]}`.
- **`POST /api/v1/mcp/tools/{tool_name}`**: body `{"arguments": {...}}`, trả `{"tool", "is_error", "result", "error_code", "error_message", "execution_time_ms"}`.
- **Mã lỗi** (`detail` luôn là thông báo chung, không có chi tiết nội bộ):
  - `404`: không có tool này.
  - `422`: tham số thiếu, thừa hoặc sai kiểu.
  - `503`: Core API lỗi, không kết nối được hoặc trả dữ liệu thiếu/sai. Tool không tự tạo dữ liệu thay thế; ReAct Loop (TASK-07) dựa vào lỗi này để chuyển sang phác đồ ngoại tuyến.
  - `500`: lỗi nội bộ khác.
- **`query_pesticide_store`** luôn chỉ trả thuốc được cấp phép; không có tham số để lấy thuốc cấm.
