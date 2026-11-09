# TASK-09: Tối ưu trải nghiệm Web Portal (UX/UI, Responsive, Chống XSS)
* **Sprint**: Sprint 3
* **Phân hệ**: frontend/web
* **Trạng thái**: `[/] IN_PROGRESS`
* **Người phụ trách**: Thành viên A (đợt 1 do Claude Code làm theo yêu cầu trưởng nhóm)
* **Độ ưu tiên**: P1 - Quan trọng

---

## 1. BỐI CẢNH & MỤC TIÊU
- Web đã đủ chức năng sau Sprint 2 nhưng còn mang dáng "bản demo kỹ thuật": lộ mã lớp mô hình (`Tomato___Late_blight`), chữ thuật ngữ (ReAct, RAG, HITL), trang `/admin` "Tổng quan" thực chất là form nhập bài báo, mascot Lavi 3D chưa được dùng ở đâu.
- Mục tiêu: giao diện giống sản phẩm thật, nhất là phía người dùng; responsive Mobile/Tablet/Desktop; giữ nguyên logic và API.
- Tham chiếu: `docs/architecture/ui-ux.md` (§13 brand), `docs/spec/screens.md`.

---

## 2. ĐỢT 1 (08/11/2026): THƯƠNG HIỆU, TRANG CHỦ, ĐĂNG NHẬP, TỔNG QUAN ADMIN

### 2.1. Tài nguyên thương hiệu
| Tài nguyên | Dùng ở đâu |
|---|---|
| Video `lavitree_video_1.mp4` (HEVC 2560×1440, 5,5MB) → `src/assets/brand/lavitree-hero-720.{mp4,webm}` + `lavitree-hero-poster.webp` | Nền trang Đăng nhập/Đăng ký và khối giới thiệu trang chủ |
| Lavi 3D `lavi-3d-happy-720.webp` (trước đây chưa dùng) | Trang chủ, Đăng nhập/Đăng ký, màn hình chào của Chat |
| Lavi 2D `lavi-avatar-96/192.webp` | Avatar của Lavi trong hội thoại và tiêu đề Chat |

- Video chuyển sang H.264 + VP9 720p, bỏ tiếng, ghép xuôi + ngược thành 10 giây lặp liền mạch: 404KB (mp4) / 321KB (webm). Bản HEVC gốc không phát được trên nhiều trình duyệt.
- `HeroVideoBackground` chỉ hiện ảnh tĩnh khi người dùng bật giảm chuyển động (`prefers-reduced-motion`) hoặc tiết kiệm dữ liệu (`Save-Data`). Video không tiếng, `aria-hidden`.
- Lavi lơ lửng nhẹ bằng `motion-safe:animate-[lavi-float_...]` (keyframes trong `globals.css`).

### 2.2. Phía người dùng
- **Đăng nhập / Đăng ký** tách khỏi `AppShell` sang `AuthLayout`: video toàn màn hình, desktop có Lavi 3D + 3 lợi ích, mobile chỉ còn form trên nền video. Không đổi logic form.
- **Trang chủ (Khám lá)**: khối giới thiệu nền video + Lavi 3D, nút "Chụp hoặc tải ảnh lá" mở thẳng hộp chọn ảnh, nút "Hỏi trợ lý Lavi". Khi đã có kết quả, khối này đổi thành tiêu đề gọn "Kết quả khám lá".
- **Chat**: avatar Lavi 2D thay icon robot; màn hình chào dùng Lavi 3D; bỏ chữ "Tác tử ReAct Loop • Tra cứu RAG".
- **Avatar người dùng**: trước đây mọi người dùng đều hiện ảnh Lavi; nay hiện chữ cái đầu tên.
- **Lỗi có sẵn đã sửa**: trên mobile thanh trên cùng hiện 2 logo Lavitree.
- **Ẩn mã lớp mô hình** khỏi giao diện (chỉ ẩn hiển thị, giá trị gửi API giữ nguyên): kết quả khám, thẻ và hộp chi tiết Sổ tay, Lịch sử, ngữ cảnh bệnh trong Chat, ô chọn lớp bệnh khi nhập bài báo.

### 2.3. Phía Admin
- `/admin` là trang **Tổng quan** mới (`AdminOverviewPage`): ca chờ chuyên gia, đoạn tri thức chờ duyệt, thuốc tồn kho dưới 10 (kèm số thuốc đang khoá), trạng thái chỉ mục tri thức của Lavi, 5 ca chờ gần nhất, thao tác nhanh. Mỗi khối tải độc lập; một API lỗi chỉ làm khối đó hiện "Không tải được dữ liệu".
- Form nhập bài báo chuyển sang `/admin/ingest`, có mục riêng "Nhập bài báo" ở sidebar; "Thu thập Tri thức" đổi tên thành "Duyệt tri thức".
- Bỏ thanh 4 tab trùng với sidebar; tiêu đề và mô tả đổi theo mục đang mở.

### 2.4. File tác động
- Thêm: `src/app/AuthLayout.tsx`, `src/components/brand/HeroVideoBackground.tsx`, `src/pages/AdminOverviewPage.tsx`, `src/assets/brand/lavitree-hero-720.mp4`, `lavitree-hero-720.webm`, `lavitree-hero-poster.webp`
- Sửa: `src/app/router.tsx`, `src/app/AppShell.tsx`, `src/app/AdminShell.tsx`, `src/pages/{LoginPage,RegisterPage,DiagnosePage,ChatPage,HandbookPage,HistoryPage,AdminDashboard}.tsx`, `src/features/chat/ChatMessageItem.tsx`, `src/styles/globals.css`

### 2.5. Bằng chứng
- `npm ci` rồi `npm run build` (gồm `tsc`): thành công, `✓ built in 3.49s`. Trước khi `npm ci`, `tsc` báo lỗi ở hầu hết các file vì `node_modules` trên máy thiếu `class-variance-authority`; không phải lỗi code.
- Chụp màn hình bằng Chrome headless trên bản build (`vite preview`):
  - `/login` 1440×900 và khung 390px;
  - `/` 1440×1000 và khung 390px;
  - `/admin` và `/chat` với phiên ADMIN giả, không có API, nên các thẻ số liệu hiện trạng thái "Không tải được dữ liệu".
- **Chưa kiểm**: số liệu Tổng quan với Core API thật; video tự phát trên Safari iOS thật; Lighthouse.

---

## 3. VIỆC CÒN LẠI CỦA TASK-09
- [ ] Kiểm Tổng quan Admin với Core API thật (tên trường `expertReviewedAt`, `isManualApproved`, `items` của `/medicines/search`).
- [ ] Hộp "Trạng thái Reindex" trong trang Duyệt tri thức đang in JSON thô; đổi sang hiển thị dễ đọc như thẻ ở Tổng quan.
- [ ] **BUG-30 (chuyển từ S2-BONUS)**: `KnowledgeCollectorPage` (`/admin/knowledge-collector`, khoảng 3.000 dòng, không có trên sidebar) gọi `axios` thô không token nên thêm/xóa bị 401, export không có header, chỉ thấy bài đã duyệt; còn hiện "Mã mô hình". Đề xuất **bỏ trang** vì `/admin/ingest` + nút xóa ở Duyệt tri thức đã thay thế; nếu giữ thì đổi sang `apiClient` và tải export dạng blob.
- [ ] Rà responsive các trang Cửa hàng, Đơn hàng, Lịch sử ở 360px; skeleton khi tải.
- [ ] Chống XSS: rà các chỗ render Markdown/HTML từ Agent và từ bài báo (theo `ui-ux.md` §9).
- [ ] Đo Lighthouse (Performance, Accessibility) trên trang chủ và Đăng nhập.

---

## 4. ĐỢT 2 (08/11/2026): NÚT XÓA TRI THỨC, LAVI "NHOÀI RA" KHỎI KHUNG TRANG CHỦ

### 4.1. Nút xóa đoạn tri thức (Admin → Duyệt tri thức)
- Mỗi dòng có nút thùng rác, bấm thì hiện hộp xác nhận (trích đoạn + URL, nhắc dùng "Bỏ duyệt" nếu chỉ muốn tạm ẩn).
- Gọi `DELETE /api/v1/knowledge/sources/{id}` có sẵn: xóa mềm (`IsDeleted`) và Core tự gọi Agent reindex. Xóa xong bỏ dòng khỏi bảng và khỏi danh sách đang chọn.
- Trước đây API này chỉ được gọi từ `KnowledgeCollectorPage` (lỗi 401, BUG-30), nên Admin không xóa được bài nào.

### 4.2. Khối giới thiệu trang chủ
- Ảnh mới `lavi-3d-hello.png` (2056×1535, nền trong suốt) → cắt viền trống, thu về `src/assets/brand/lavi-3d-hello-820.webp` (820×788, 57KB).
- Lavi đứng ở góc phải dưới, **thân dưới khuất sau mép dưới khung video**, lá trên đầu và tai nghe tràn ra ngoài khung. Cách làm: nền video nằm trong lớp `overflow-hidden` riêng; lớp chứa Lavi dùng `clip-path: inset(-60% -20% 0 -20%)`, chỉ cắt mép dưới.
- Chuyển động (chỉ khi không bật giảm chuyển động): trồi lên một lần `lavi-peek-in` 0,9s rồi lắc nhẹ `lavi-wave` 4,5s như đang vẫy chào (keyframes trong `globals.css`).
- Cỡ: từ 1280px trở lên Lavi rộng 30rem, tràn rõ ra ngoài khung; 768–1279px rộng 22rem, nằm gọn trong khung vì khung cao hơn; dưới 768px ẩn. Chữ chừa lề phải để tay Lavi không đè lên.
- File: `src/pages/DiagnosePage.tsx`, `src/pages/AdminDashboard.tsx`, `src/styles/globals.css`, thêm `src/assets/brand/lavi-3d-hello-820.webp`.

### 4.3. Bằng chứng
- `npm run build` (gồm `tsc`): thành công.
- Chụp Chrome headless trên `vite preview` ở 1440, 1024, 820px: Lavi không đè chữ; ở 1440px lá vượt mép trên, tai nghe vượt mép phải.
- Nút xóa: đã build, **chưa bấm thử trên API thật**.
- Thấy thêm (lỗi có sẵn): ở khoảng 820px, thanh menu trên cùng bị xuống dòng chữ ("Khám / lá"); cần rà ở mục responsive.

---

## 5. ĐỢT 3 (09/11/2026): ĐẠI TU GIAO DIỆN TRỢ LÝ CHAT LAVI — FULL SCREEN, LỊCH SỬ CHAT, NEW CHAT & SỬA MÀU SẮC

### 5.1. Bối cảnh & Vấn đề khắc phục
- **Lỗi giao diện (Giao diện cũ)**:
  - Khung chat bị giới hạn bề ngang (`max-w-4xl` lồng trong `max-w-7xl` của `AppShell`), thụt sâu và để lại 2 bên lề chết lớn, trông chật chội và không giống một ứng dụng AI hội thoại hiện đại.
  - Khi màn hình ở chế độ sáng (Light Mode), thanh tiêu đề, các thẻ gợi ý câu hỏi và ô nhập liệu bị kích hoạt class nền đen đặc (`dark:bg-zinc-900`) trên nền trang màu kem/trắng, tạo cảm giác "củ chuối", chữ xám mờ khó đọc và mất đồng bộ thiết kế.
  - Thiếu chức năng Lịch sử hội thoại (Chat History) và nút Tạo cuộc trò chuyện mới (+ New Chat) khiến người dùng bị dồn hết tin nhắn vào 1 luồng duy nhất hoặc mất phiên khi reload.

### 5.2. Giải pháp Hiện thực hóa
1. **Bố cục Toàn màn hình (Full-Screen Messenger / ChatGPT style)**:
   - Điều chỉnh `AppShell.tsx`: Khi ở route `/chat`, thẻ `<main>` tự động giải phóng giới hạn container (`h-[calc(100vh-4rem)] max-w-none p-0 m-0 overflow-hidden`), lấp đầy 100% diện tích màn hình.
   - Bố cục 2 cột linh hoạt:
     - **Sidebar trái (Lịch sử hội thoại & New Chat)**: Chiều rộng 320px, có nút thu gọn/mở rộng mượt mà (`PanelLeftClose` / `PanelLeft`).
     - **Khung Chat trung tâm**: Căn giữa dòng tin nhắn tối đa 4xl tạo độ thoải mái cho mắt đọc, nền bung tràn mép màn hình.
2. **Quản lý Đa phiên Hội thoại (Chat Sessions History & New Chat)**:
   - Thêm nút **"+ Đoạn chat mới"** nổi bật trên đầu sidebar (màu xanh thương hiệu Emerald).
   - Tự động gom cụm các phiên trò chuyện, lấy câu hỏi đầu tiên làm tiêu đề, lưu trữ bền vững vào `localStorage` (`lavitree_chat_sessions_v2`).
   - Hỗ trợ xem lại lịch sử các phiên cũ, chuyển đổi tức thì giữa các phiên hoặc xóa từng đoạn chat / xóa toàn bộ lịch sử.
3. **Chuẩn hóa Màu sắc & Độ tương phản (Light / Dark Consistency)**:
   - Thay thế toàn bộ mã màu hardcode đen `dark:bg-zinc-900` bằng semantic design tokens shadcn (`bg-card`, `bg-background`, `border-border`, `text-foreground`, `text-muted-foreground`).
   - Màn hình chào Lavi 3D và 4 thẻ câu hỏi gợi ý nhanh hiển thị màu thẻ card sáng rõ, viền mượt, hover đổ màu bạc hà nhạt (`hover:bg-emerald-50/70`), chữ sắc nét tuyệt đối.
   - Hộp nhập liệu phía dưới được ghim nổi (floating pinned bar) với hiệu ứng viền sáng Emerald khi focus.

### 5.3. File tác động
- `src/features/chat/types.ts`: Bổ sung interface `ChatSession`.
- `src/features/chat/useAgentChat.ts`: Xuất các hàm `loadSession`, `setMessages`, `setConversationId`.
- `src/features/chat/ChatMessageItem.tsx`: Đồng bộ semantic color tokens `bg-card`, `border-border`.
- `src/app/AppShell.tsx`: Mở rộng layout full-bleed cho route `/chat`.
- `src/pages/ChatPage.tsx`: Viết lại toàn bộ trang với Sidebar Lịch sử, New Chat và Giao diện Messenger/ChatGPT chuẩn.
- `src/pages/AdminDashboard.tsx`: Tách ô chọn lớp bệnh mục tiêu ở form Nhập bài báo (`/admin/ingest`) thành 2 ô chọn riêng biệt: Loài cây trồng & Tên bệnh hại; Gộp các đoạn trích cùng 1 bài báo ở tab Duyệt tri thức thành 1 dòng duy nhất kèm tính năng mở rộng/thu gọn xem chi tiết từng đoạn.

### 5.4. Bằng chứng Kiểm nghiệm
- Chạy `npm run build` (bao gồm TypeScript `tsc` check): **Thành công 100%** không có bất kỳ lỗi biên dịch nào (`✓ built in 10.01s`).


