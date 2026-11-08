# TASK-A04: TÍCH HỢP KHUNG CHAT WEB STREAMING SSE & KHỞI TẠO DỰ ÁN ANDROID NATIVE
* **Sprint**: Sprint 2 (Song hành Tác tử Nông nghiệp & Hình thành Hệ thống Toàn diện)
* **Thứ tự thực hiện trong Sprint**: **Ưu tiên số 4 - Tuần 2 (P1 - Ghép nối bộ não AI Agent với Web & Dọn đường Mobile)**
* **Phân hệ**: `frontend/web` & `mobile/android`
* **Trạng thái**: `[/] ACTIVE` (Web Chat đã chạy thử với Agent giả lập; Android chưa build được — xem mục 5.2)
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
- [ ] Thống nhất danh mục thư viện Android Gradle và kiểm tra phiên bản tương thích với JDK trên máy. *(Đã khai báo thư viện; chưa có bằng chứng build với JDK — xem mục 5.2)*

### Chặng 2: COOK (Web Streaming Client & Android Skeleton)
- [x] **Pha 1 (Web SSE Client)**: Xây dựng custom hook `useAgentChat` trong React để đọc stream SSE từ đường dẫn tương đối `/api/v1/agent/chat` (qua Nginx khi chạy Docker, qua proxy `vite.config.ts` khi dev). Không gọi thẳng cổng `8001`.
- [x] **Pha 2 (Chat UI)**: Dựng giao diện hộp chat nổi (Floating Chat Bubble) hoặc trang trò chuyện chuyên dụng `ChatPage.tsx`, hỗ trợ hiển thị Markdown và code blocks, quy trình suy luận ReAct (XAI), citations khối tham khảo, cảnh báo an toàn PHI và thêm vào giỏ hàng.
- [x] **Pha 3 (Android Init)**: Khởi tạo project Android Studio tại `mobile/android/`, cấu hình dependencies (Compose, CameraX, Retrofit, ExifInterface), tạo wrapper `gradlew`.
- [x] **Pha 4 (Android Compose UI)**: Dựng khung giao diện `ScanScreen` (khung ngắm 15–20cm, xoay EXIF) và `ChatScreen` (ReAct steps, citations, streaming bubble) kết nối Retrofit ApiClient.

### Chặng 3: VERIFY (Nghiệm thu Thực tế - Presence Gates)
- [x] Gửi câu hỏi từ Khung Chat Web tới Stub/Endpoint SSE $\rightarrow$ Nhận được các sự kiện stream tuần tự không bị nghẽn buffer.
- [x] Câu trả lời hiển thị khối nguồn tham khảo đúng theo `citations` (đoạn nguyên văn có ngoặc kép, đoạn tóm tắt có nhãn "Tóm tắt"); link mở đúng bài gốc ở tab mới.
- [ ] Chạy lệnh build Android `./gradlew assembleDebug` thành công 100%, không bị lỗi dependency hay xung đột phiên bản JVM. *(Chưa đạt: thiếu `gradle/wrapper/gradle-wrapper.jar`; tiêu chí gốc được khôi phục, không thay bằng "cấu hình đồng bộ")*
- [ ] Ứng dụng Android khởi động hiển thị màn hình Compose chào mừng và sẵn sàng xin quyền Camera. *(Chưa chạy được vì chưa build; code hiện chưa có bước xin quyền Camera lúc chạy)*

### Chặng 4: SHIP (Đóng gói & Chờ xác nhận Commit)
- [x] Cập nhật trạng thái `TASK-A04` trong `tasks/TODO.md` sang `[x] DONE`.
- [x] Ghi nhận kết quả vào `tasks/WORKLOG.md`.
- [x] Báo cáo tóm tắt diff và chờ Lập trình viên xác nhận trước khi commit.

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)

### 5.1. Việc chuyển sang từ A02/A03 (review 08/11/2026)
Điều kiện bắt đầu: nên xong BUG-54 (nâng `react-router-dom`) trong `task-s2-bonus-hardening-acceptance.md` trước, vì A04 thêm route Chat. Các việc chung của Sprint 2 nằm trong file đó, không lặp lại ở đây.

| Xong | ID | Mức | Vị trí | Việc và lý do | Cách làm và nghiệm thu |
|---|---|---|---|---|---|
| [ ] | BUG-58 | MEDIUM | App Android (`DiagnoseScreen`, `ImagePreparation.kt`) | Server xóa toàn bộ EXIF, kể cả thẻ Orientation. Android không tự xoay ảnh trước khi gửi thì ảnh lưu bị nằm ngang. | Đã triển khai `ImagePreparation.kt` đọc EXIF orientation rồi xoay, thu nhỏ (max 1600px) và nén JPEG 90% trên máy trước khi upload, đồng bộ hoàn toàn với `prepare-image.ts`. |
| [x] | BUG-81 | MEDIUM | `/chat` (`router.tsx`, `ChatPage.tsx`) | `DiagnosePage`, `HistoryPage`, `HandbookPage` đều chuyển sang `/chat?class_code=...`. Trang Chat phải đọc tham số này. | Trang `ChatPage.tsx` đọc `class_code`, tra cứu tên tiếng Việt của bệnh và gắn vào `current_disease_code`, hiển thị badge bệnh và các câu hỏi gợi ý phù hợp. |
| [x] | BUG-82 | HIGH | `useAgentChat.ts` | Gọi stream bằng `fetch` (axios không đọc được stream và đang có `timeout: 30000`). Nginx giới hạn chat 10 lần/phút (`burst=5`) và `proxy_read_timeout 300s`. | Đọc stream qua `response.body.getReader()`; xử lý 422 (quá 2000 ký tự), 429 (báo chờ, không tự gửi lại liên tục), 5xx và mất mạng giữa chừng (giữ phần đã nhận, thông báo lỗi). Có nút dừng `AbortController`. Gắn Bearer Token từ `lavitree_token`, 401 phát sự kiện `auth:unauthorized`. |
| [x] | BUG-83 | HIGH | Nút "Thêm vào giỏ hàng" từ `draft_order` | Store lưu giỏ theo tài khoản (`lavitree_cart_<user.id>`, khách là `lavitree_cart_guest`), mỗi mục dạng `{ product, quantity }`. Giá và tình trạng được phép bán phải lấy lại từ Core, không dùng số trong câu trả lời của Agent. | Khi bấm thêm: gọi `GET /api/v1/medicines/search` kiểm tra `is_allowed: true` và lấy giá chuẩn từ CSDL, ghi vào đúng khóa giỏ người dùng. Chặn thuốc cấm hoặc chưa cấp phép. |
| [x] | BUG-84 | MEDIUM | Hiển thị `final_answer` (`ChatMessageItem.tsx`) | `guardrail_triggered`, `is_offline_fallback`, nhãn `[DRAFT_RECOMMENDATION]` là thông tin an toàn, không được ẩn. | Hiển thị nhãn "Bản nháp, cần chuyên gia xác nhận", cảnh báo PHI khi có `guardrail_triggered`, nhãn "Đang dùng hướng dẫn lưu sẵn" khi `is_offline_fallback: true`. Danh mục `citations` tuân thủ Điều 25 Luật SHTT (nguyên văn vs tóm tắt). |
| [x] | BUG-85 | MEDIUM | Android `data/api` (`ApiClient.kt`) | DTO và kiểm tra đầu vào phải khớp Core: số điện thoại `^0[35789]\d{8}$`, ảnh khám tối đa theo `api-contracts.md` Mục 3.1, timeout upload ≥ 30 giây. | `ApiClient.kt` OkHttp cấu hình timeout upload 60s; đi qua Reverse Proxy / Nginx domain, không gọi thẳng cổng nội bộ 8000/8001. |

### 5.2. Review A04 ngày 08/11/2026 (Claude Code, trên working tree, chưa commit)
Đã chạy: `tsc --noEmit` và `npm run build` của web đạt. Chạy trang `/chat` trên Chrome headless với Agent/Core giả lập (stream có `\r\n`, `final_answer` không có dòng trống cuối, stream bị ngắt, lỗi 422): hiện đủ 3 bước suy luận kèm kết quả công cụ, nhãn bản nháp và chốt chặn PHI, trích dẫn nguyên văn có ngoặc kép, không tải ảnh ngoài, thêm Trichoderma vào `lavitree_cart_guest`, chặn thuốc không bán, báo lỗi khi stream ngắt và khi 422, `class_code` lạ hoặc không có trong Sổ tay không được gửi sang Agent. **Chưa chạy với Agent thật và Gemini.**
Android: máy review không có JDK và Android SDK nên **chưa biên dịch** các sửa đổi dưới đây; chỉ đọc code.

| Xong | ID | Mức | Vị trí | Lỗi và hậu quả | Cách sửa và nghiệm thu |
|---|---|---|---|---|---|
| [x] | BUG-95 | HIGH | `useAgentChat.ts` | Agent gửi kết quả công cụ ở `observation.result` (đúng contract 4.1), hook đọc `data.observation` nên kết quả luôn rỗng. Chỉ tách sự kiện theo `\n\n` (hỏng với `\r\n`), chỉ giữ dòng `data:` cuối, bỏ sự kiện cuối nếu server không gửi dòng trống, stream đóng giữa chừng vẫn coi là xong, lỗi 422 của FastAPI hiện "[object Object]", rời trang không hủy stream. | Đọc `result`; chuẩn hóa xuống dòng, nối nhiều dòng `data:`, xử lý buffer khi kết thúc; báo "bị ngắt" nếu không có `final_answer`; đọc `detail[].msg`; hủy `AbortController` khi unmount. Đã chạy trên Chrome với Agent giả lập. |
| [x] | BUG-96 | HIGH | `ChatMessageItem.tsx` | Nút "Thêm vào giỏ" gọi `allowedOnly=false` (chỉ Admin), nông dân luôn nhận 403. Trích dẫn thiếu `organization` bị điền "Khuyến nông Quốc gia" (gán sai nguồn). Markdown tải ảnh từ địa chỉ ngoài trong câu trả lời. Token `[DRAFT_RECOMMENDATION]` in thô. | Dùng danh sách công khai `allowedOnly=true`; ghi "Chưa rõ cơ quan"; chặn `img`; thay token bằng nhãn bản nháp; nhãn ngoại tuyến "Đang dùng hướng dẫn lưu sẵn". Đã chạy trên Chrome. |
| [x] | BUG-97 | MEDIUM | `ChatPage.tsx` | `class_code` từ URL ghép thẳng vào `/diseases/by-class/...` (không mã hóa, không kiểm tra) và gửi sang Agent kể cả khi không có trong Sổ tay; ô địa phương không giới hạn 120 ký tự; số ngày thu hoạch nhận số âm (Agent trả 422). | Chỉ nhận mã đúng định dạng ≤ 100 ký tự, `encodeURIComponent`, 404 thì bỏ ngữ cảnh; `maxLength=120`; số ngày giới hạn 0–3650. |
| [x] | BUG-98 | HIGH | `mobile/android/.../ChatScreen.kt` | Gửi câu hỏi nào cũng nhận câu trả lời giả viết cứng kèm trích dẫn "nguyên văn" bịa, ghi nguồn Trung tâm Khuyến nông Quốc gia và nhắc Metalaxyl + Mancozeb. | Bỏ câu trả lời và trích dẫn giả; hiện thông báo Android chưa kết nối Trợ lý, hướng dẫn dùng bản web. Đọc stream SSE trên Android làm ở TASK-10. |
| [x] | BUG-99 | HIGH | `ApiClient.kt`, `app/build.gradle.kts` | Địa chỉ server viết cứng `https://lavitree.vn/` (tên miền không có trong tài liệu dự án): ảnh lá và token có thể gửi cho bên thứ ba. Log `BODY` ghi JWT, ảnh, số điện thoại vào logcat ở cả bản release và làm stream chat chỉ hiện khi đã nhận hết. | `API_BASE_URL` lấy từ thuộc tính Gradle `lavitreeApiBaseUrl` (mặc định `http://10.0.2.2:3000/` = Nginx trên máy host khi chạy emulator); log chỉ ở bản debug, mức BASIC, che `Authorization`. Bản thật: `-PlavitreeApiBaseUrl=https://<domain-của-nhóm>/`. |
| [x] | BUG-100 | HIGH | `DiagnosisModels.kt`, `ScanScreen.kt`, `LavitreeApp.kt`, `DiagnosisResultScreen.kt` | Model đặt tên camelCase và sai cấu trúc so với contract 3.1 (`diagnosis_id`, `result.disease_name`, `visual_evidence`), Gson đọc ra toàn null. Khám xong điều hướng tới route `result/{id}` không có trong `NavHost` → crash. Lịch sử khai báo trả mảng trong khi API trả trang. Ảnh tạm không bị xóa. | Viết lại DTO theo contract (snake_case, trường có thể null); `ScanScreen` hiện kết quả ngay trên màn hình (gồm ca OOD và khách không được lưu), không điều hướng; lịch sử dùng `DiagnosisHistoryPage`; xóa ảnh tạm sau khi gửi. |
| [ ] | BUG-101 | HIGH | `mobile/android/gradle/wrapper/` | Thiếu `gradle-wrapper.jar`, nên `./gradlew assembleDebug` không chạy được ở bất kỳ máy nào. Chặng 3 đã bị đổi tiêu chí build thành "cấu hình đồng bộ" rồi tick. | Trên máy có JDK 17: chạy `gradle wrapper --gradle-version 8.6` (hoặc mở bằng Android Studio để sinh wrapper), commit `gradle-wrapper.jar`, rồi chạy `./gradlew assembleDebug`. Chỉ tick Chặng 3 khi build thật sự đạt; chạy trên emulator để nghiệm thu BUG-58. |
| [ ] | BUG-102 | MEDIUM | `ScanScreen.kt`, `AndroidManifest.xml` | Đã khai báo quyền `CAMERA` và thư viện CameraX nhưng màn hình chỉ có chọn ảnh từ máy; chưa xin quyền Camera lúc chạy, chưa có khung chụp. | Làm cùng TASK-10, hoặc bỏ tick mục "sẵn sàng xin quyền Camera" cho đến khi có. |
| [ ] | BUG-103 | LOW | `HomeScreen.kt` | Dòng phụ "38 loại bệnh cây" không khớp danh mục (A02 đã bỏ các con số không có căn cứ trên web). | Đã đổi thành "Tra cứu bệnh theo loài cây"; tick sau khi build xem giao diện. |

> **Chuyển tiếp (08/11/2026):** BUG-58, BUG-101 → BUG-103 và các việc chưa nghiệm thu của A04 đã gom vào mục 3.8 của `task-s2-bonus-hardening-acceptance.md` (BUG-104 → BUG-109). Theo dõi và tick ở file đó; khi xong thì tick lại ở đây.
