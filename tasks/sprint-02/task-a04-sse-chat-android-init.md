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
- Nối các token từ event `delta` vào câu trả lời thời gian thực; khi nhận event `final_answer` thì render Markdown phác đồ điều trị hoàn chỉnh.

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
- [ ] **Pha 1 (Web SSE Client)**: Xây dựng custom hook `useAgentChat` trong React để đọc stream SSE từ cổng `8001`.
- [ ] **Pha 2 (Chat UI)**: Dựng giao diện hộp chat nổi (Floating Chat Bubble) hoặc trang trò chuyện chuyên dụng, hỗ trợ hiển thị Markdown và code blocks.
- [ ] **Pha 3 (Android Init)**: Khởi tạo project Android Studio tại `mobile/android/`, cấu hình dependencies (Compose, CameraX, Retrofit).
- [ ] **Pha 4 (Android Compose UI)**: Dựng khung giao diện `DiagnoseScreen` và `ChatScreen` chạy mượt mà trên Android Emulator / thiết bị thật.

### Chặng 3: VERIFY (Nghiệm thu Thực tế - Presence Gates)
- [ ] Gửi câu hỏi từ Khung Chat Web tới Stub/Endpoint SSE $\rightarrow$ Nhận được các sự kiện stream tuần tự không bị nghẽn buffer.
- [ ] Chạy lệnh build Android `./gradlew assembleDebug` thành công 100%, không bị lỗi dependency hay xung đột phiên bản JVM.
- [ ] Ứng dụng Android khởi động hiển thị màn hình Compose chào mừng và sẵn sàng xin quyền Camera.

### Chặng 4: SHIP (Đóng gói & Chờ xác nhận Commit)
- [ ] Cập nhật trạng thái `TASK-A04` trong `tasks/TODO.md` sang `[x] DONE`.
- [ ] Ghi nhận kết quả vào `tasks/WORKLOG.md`.
- [ ] Báo cáo tóm tắt diff và chờ Lập trình viên xác nhận trước khi commit.
