# TASK-A04: TÍCH HỢP KHUNG CHAT WEB STREAMING SSE & KHỞI TẠO DỰ ÁN ANDROID NATIVE
* **Sprint**: Sprint 2 (Song hành Tác tử Nông nghiệp & Hình thành Hệ thống Toàn diện)
* **Thứ tự thực hiện trong Sprint**: **Ưu tiên số 4 - Tuần 2 (P1 - Ghép nối bộ não AI Agent với Web & Dọn đường Mobile)**
* **Phân hệ**: `frontend/web` & `mobile/android`
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên A (System, Auth, Web & Early Mobile)
* **Độ ưu tiên**: P1 - Quan trọng
* **Tài liệu tham chiếu chuẩn**:
  - Hợp đồng SSE: [docs/architecture/api-contracts.md](../../docs/architecture/api-contracts.md) (Mục 4.1 Chat Streaming SSE)
  - Kế hoạch Sprint 2: [docs/planning/sprint-02.md](../../docs/planning/sprint-02.md) (Quy tắc Day 1 Stub & Khởi tạo Android sớm)

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Vấn đề cốt tử**:
  1. Thành viên B phát triển Agent Service trên cổng `8001` với cơ chế truyền phát Server-Sent Events (SSE). Phía giao diện Web cần một Khung Chat Trợ lý AI (Agri-Chat Widget) có khả năng đọc luồng stream thời gian thực, bóc tách từng sự kiện (`trace_start`, `thought`, `action`, `observation`, `delta`, `final_answer`).
  2. Để giải phóng áp lực cho Sprint 3 (tránh việc Sprint 3 vừa phải học Android, vừa dựng khung, vừa test phần cứng), dự án **Android Native** cần được khởi tạo sạch sẽ ngay từ tuần 2 của Sprint 2 với kiến trúc hiện đại (Kotlin + Jetpack Compose + CameraX + Retrofit).
- **Mục tiêu cụ thể của Task**:
  1. **Khung Chat Trợ lý Nông nghiệp trên Web (`ChatWidget.tsx` / `ChatPage.tsx`)**:
     - *Tuần 1*: Kết nối với **Mock SSE Stub** của Thành viên B để dựng giao diện mượt mà.
     - *Tuần 2*: Ghép nối chính thức với endpoint SSE thật từ Task 08 qua Nginx Reverse Proxy (`POST /api/v1/agent/chat`). Trình duyệt và App mobile tuyệt đối không gọi thẳng port 8001 nội bộ (đã cấu hình proxy trong `nginx.conf` và `vite.config.ts`).
     - Hiển thị tiến trình suy luận: Khối "Trợ lý đang suy nghĩ..." hiển thị các bước ReAct (`thought` $\rightarrow$ `action`), nhãn `[DRAFT_RECOMMENDATION]`, cảnh báo cách ly an toàn PHI và nút "Thêm vào giỏ hàng" đối với đơn thuốc đề xuất.
     - **Hiển thị nguồn tham khảo** (bắt buộc — điều kiện ghi nguồn khi trích dẫn, Điều 25 Luật SHTT): dưới mỗi câu trả lời, render danh sách `citations` từ `final_answer` gồm tiêu đề, cơ quan, link mở bài gốc (`target="_blank" rel="noopener noreferrer"`). `is_verbatim = true` → hiển thị `excerpt` trong ngoặc kép kèm nhãn "Trích nguyên văn"; `false` → nhãn "Tóm tắt". `citations` rỗng → dòng "Không có tài liệu tham khảo".
  2. **Khởi tạo Dự án Android Native (`mobile/android/`)**:
     - Cấu hình Gradle sạch bằng Kotlin DSL, SDK 34, Java 17.
     - Tích hợp Jetpack Compose BOM, Material Design 3 (chủ đề màu Lavitree).
     - Cấu hình thư viện CameraX chụp ảnh lá cây (chuẩn bị cho khung ngắm 15–20cm).
     - Cấu hình Retrofit 2 + OkHttp + Moshi/Kotlinx Serialization để kết nối Core API.
     - Dựng sẵn bộ khung 2 màn hình chính dạng Preview: `DiagnoseScreen` (Khám lá) và `ChatScreen` (Hỏi đáp tác tử).

---

## 2. ĐẶC TẢ GIAO DIỆN & CẤU TRÚC MOBILE (SPECIFICATIONS)

### 2.1. Bóc tách Luồng SSE trên Web (`EventSource` / `fetch` Stream):
- Đọc stream chunk bằng `ReadableStreamDefaultReader` từ `response.body`.
- Tách dòng theo chuẩn SSE `event: ...` và `data: ...`.
- Nối các token từ event `delta` vào câu trả lời thời gian thực; khi nhận event `final_answer` thì render Markdown phác đồ điều trị hoàn chỉnh kèm khối nguồn tham khảo từ `citations`.
- **Bảo mật hiển thị**: render Markdown với HTML thô bị tắt (ví dụ `react-markdown` không bật `rehype-raw`); chỉ cho mở link `citations` có `http/https` (chặn `javascript:`), vì nội dung trả lời và đoạn trích có thể đến từ bài báo bên ngoài.

### 2.2. Cấu trúc Dự án Android (`mobile/android/`):
```text
mobile/android/
├── app/
│   ├── src/main/java/com/lavitree/mobile/
│   │   ├── ui/
│   │   │   ├── theme/          # Color, Type, Theme Lavitree
│   │   │   ├── diagnose/       # DiagnoseScreen & CameraView (CameraX)
│   │   │   └── chat/           # ChatScreen & MessageBubble
│   │   ├── data/
│   │   │   ├── api/            # Retrofit Service interfaces
│   │   │   └── model/          # DTOs khớp api-contracts.md
│   │   └── MainActivity.kt
│   └── build.gradle.kts
├── build.gradle.kts
└── settings.gradle.kts
```

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI 4 CHẶNG (SDLC 4 PHASES)

### Chặng 1: PLAN (Thống nhất Protocol Stream & Android Setup)
- [ ] Thống nhất danh mục thư viện Android Gradle và kiểm tra phiên bản tương thích với JDK trên máy.

### Chặng 2: COOK (Web Streaming Client & Android Skeleton)
- [ ] **Pha 1 (Web SSE Client)**: Xây dựng custom hook `useAgentChat` trong React để đọc stream SSE từ đường dẫn tương đối `/api/v1/agent/chat` (qua Nginx khi chạy Docker, qua proxy `vite.config.ts` khi dev). Không gọi thẳng cổng `8001`.
- [ ] **Pha 2 (Chat UI)**: Dựng giao diện hộp chat nổi (Floating Chat Bubble) hoặc trang trò chuyện chuyên dụng, hỗ trợ hiển thị Markdown và code blocks.
- [ ] **Pha 3 (Android Init)**: Khởi tạo project Android Studio tại `mobile/android/`, cấu hình dependencies (Compose, CameraX, Retrofit).
- [ ] **Pha 4 (Android Compose UI)**: Dựng khung giao diện `DiagnoseScreen` và `ChatScreen` chạy mượt mà trên Android Emulator / thiết bị thật.

### Chặng 3: VERIFY (Nghiệm thu Thực tế - Presence Gates)
- [ ] Gửi câu hỏi từ Khung Chat Web tới Stub/Endpoint SSE $\rightarrow$ Nhận được các sự kiện stream tuần tự không bị nghẽn buffer.
- [ ] Câu trả lời hiển thị khối nguồn tham khảo đúng theo `citations` (đoạn nguyên văn có ngoặc kép, đoạn tóm tắt có nhãn "Tóm tắt"); link mở đúng bài gốc ở tab mới.
- [ ] Chạy lệnh build Android `./gradlew assembleDebug` thành công 100%, không bị lỗi dependency hay xung đột phiên bản JVM.
- [ ] Ứng dụng Android khởi động hiển thị màn hình Compose chào mừng và sẵn sàng xin quyền Camera.

### Chặng 4: SHIP (Đóng gói & Chờ xác nhận Commit)
- [ ] Cập nhật trạng thái `TASK-A04` trong `tasks/TODO.md` sang `[x] DONE`.
- [ ] Ghi nhận kết quả vào `tasks/WORKLOG.md`.
- [ ] Báo cáo tóm tắt diff và chờ Lập trình viên xác nhận trước khi commit.

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)

### 5.1. Việc chuyển sang từ A02/A03 (review 08/11/2026)
Điều kiện bắt đầu: nên xong BUG-54 (nâng `react-router-dom`) trong `task-s2-bonus-hardening-acceptance.md` trước, vì A04 thêm route Chat. Các việc chung của Sprint 2 nằm trong file đó, không lặp lại ở đây.

| Xong | ID | Mức | Vị trí | Việc và lý do | Cách làm và nghiệm thu |
|---|---|---|---|---|---|
| [ ] | BUG-58 | MEDIUM | App Android (`DiagnoseScreen`) | Server xóa toàn bộ EXIF, kể cả thẻ Orientation. Android không tự xoay ảnh trước khi gửi thì ảnh lưu bị nằm ngang. | Đọc Orientation rồi xoay, thu nhỏ và nén ảnh trên máy trước khi upload, giống `frontend/web/src/features/diagnose/prepare-image.ts`. Chụp dọc trên máy thật → ảnh trong Lịch sử đúng chiều. |
| [ ] | BUG-81 | MEDIUM | `/chat` (`router.tsx` đang là `ComingSoonPage`) | `DiagnosePage`, `HistoryPage`, `HandbookPage` đều chuyển sang `/chat?class_code=...`. Trang Chat phải đọc tham số này. | Gửi `class_code` vào `current_disease_code` (≤ 100 ký tự, chỉ nhận mã có trong danh sách lớp). Mở Chat từ 3 trang trên → câu hỏi đầu tiên có ngữ cảnh đúng bệnh. |
| [ ] | BUG-82 | HIGH | `useAgentChat` | Gọi stream bằng `fetch` (axios không đọc được stream và đang có `timeout: 30000`). Nginx giới hạn chat 10 lần/phút (`burst=5`) và `proxy_read_timeout 300s`. | Đọc stream qua `response.body.getReader()`; xử lý 422 (quá 2000 ký tự), 429 (báo chờ, không tự gửi lại liên tục), 5xx và mất mạng giữa chừng (hiện lỗi, giữ phần đã nhận). Có nút dừng (`AbortController`). Nếu gửi token: lấy từ `lavitree_token`, 401 thì phát sự kiện `auth:unauthorized` như `api-client.ts`. |
| [ ] | BUG-83 | HIGH | Nút "Thêm vào giỏ hàng" từ `draft_order` | Store lưu giỏ theo tài khoản (`lavitree_cart_<user.id>`, khách là `lavitree_cart_guest`), mỗi mục dạng `{ product, quantity }`. Giá và tình trạng được phép bán phải lấy lại từ Core, không dùng số trong câu trả lời của Agent. | Khi bấm thêm: gọi `GET /api/v1/medicines/search` lấy sản phẩm theo `product_id`, chỉ thêm khi `is_allowed: true`, ghi vào đúng khóa giỏ của người đang đăng nhập. Đặt hàng vẫn qua `POST /api/v1/orders` (Core tự tính giá). Thử với `product_id` của thuốc đang khóa → không thêm được. |
| [ ] | BUG-84 | MEDIUM | Hiển thị `final_answer` | `guardrail_triggered`, `is_offline_fallback`, nhãn `[DRAFT_RECOMMENDATION]` là thông tin an toàn, không được ẩn. Thời tiết trong câu trả lời đến từ tool của Agent; Core trả 503 khi thiếu khóa nên giao diện không được tự điền số liệu. | Hiện nhãn "Bản nháp, cần chuyên gia xác nhận", cảnh báo PHI khi có `guardrail_triggered`, nhãn "Đang dùng hướng dẫn lưu sẵn" khi `is_offline_fallback: true`. `citations: []` → "Không có tài liệu tham khảo". |
| [ ] | BUG-85 | MEDIUM | Android `data/api` | DTO và kiểm tra đầu vào phải khớp Core: số điện thoại `^0[35789]\d{8}$`, ảnh khám tối đa theo `api-contracts.md` Mục 3.1, timeout upload ≥ 30 giây. | Retrofit/OkHttp đặt timeout riêng cho upload; không gọi thẳng cổng nội bộ (`8001`, `5000`), chỉ đi qua domain Nginx. |
