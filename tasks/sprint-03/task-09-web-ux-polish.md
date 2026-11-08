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
- [ ] `KnowledgeCollectorPage` (công cụ thu thập nội bộ, không nằm trên sidebar) vẫn hiện "Mã mô hình"; giữ hay bỏ do trưởng nhóm quyết định.
- [ ] Rà responsive các trang Cửa hàng, Đơn hàng, Lịch sử ở 360px; skeleton khi tải.
- [ ] Chống XSS: rà các chỗ render Markdown/HTML từ Agent và từ bài báo (theo `ui-ux.md` §9).
- [ ] Đo Lighthouse (Performance, Accessibility) trên trang chủ và Đăng nhập.
