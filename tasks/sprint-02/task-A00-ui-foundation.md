# TASK-A00: NỀN TẢNG GIAO DIỆN (UI FOUNDATION) — TAILWIND v4, SHADCN/UI & DESIGN TOKENS
* **Sprint**: Sprint 2
* **Thứ tự thực hiện trong Sprint**: **Ưu tiên số 0 của Thành viên A** — làm trước TASK-A02/A03/A04 (các task đó dựng màn hình trên nền này)
* **Phân hệ**: `frontend/web` (chính) · `mobile/android` (chỉ phần theme)
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên A
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi
* **Ước lượng**: 1–1,5 ngày

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Mô tả ngắn**: Giao diện web hiện tại là bản demo phục vụ thu thập URL tri thức: CSS thuần + khoảng 370 chỗ `style={{}}` inline, mã màu viết tay không thống nhất, màu web và Android lệch nhau. Sprint 2 sẽ dựng thêm khoảng 15 màn hình (Auth, Lịch sử, Store, Chat SSE, Admin). Task này dựng **một nền chung duy nhất** để mọi màn hình sau chỉ việc lắp ghép, không ai tự chế màu/kiểu riêng.
- **Phạm vi**: Cài đặt công cụ, token, khung trang, router, thành phần dùng chung. **Không** viết lại nghiệp vụ của các trang — việc đó thuộc A02/A03/A04.
- **Tài liệu tham chiếu**:
  - Design system: [docs/architecture/ui-ux.md](../../docs/architecture/ui-ux.md) (toàn bộ)
  - Màn hình & quyền: [docs/spec/screens.md](../../docs/spec/screens.md) mục 1, 3, 6
  - Quy tắc nhãn trạng thái: [docs/spec/classes.md](../../docs/spec/classes.md) mục 3–4

---

## 2. ĐẶC TẢ KỸ THUẬT (SPECIFICATIONS)

- **Danh sách file tác động** (`frontend/web/`):
  - `[Chỉnh sửa]` `package.json`, `vite.config.ts` (plugin `@tailwindcss/vite`, alias `@/`), `tsconfig.json` (`paths`), `index.html` (bỏ link Google Fonts, đổi favicon `vite.svg` → `favicon.svg`)
  - `[Thêm mới]` `components.json` (cấu hình shadcn), `src/styles/globals.css` (token theo ui-ux.md mục 2–3)
  - `[Thêm mới]` `src/app/` — `router.tsx`, `providers.tsx`, `AppShell.tsx`, `AdminShell.tsx`, `RequireRole.tsx`, `NotFoundPage.tsx`, `ForbiddenPage.tsx`
  - `[Thêm mới]` `src/components/ui/*` (sinh bởi shadcn), `src/components/common/` — `EmptyState`, `ErrorState`, `PageSkeleton`
  - `[Thêm mới]` `src/features/diagnose/status.ts`, `constants.ts`, `components/ResultStatusBadge.tsx`
  - `[Thêm mới]` `src/lib/api-client.ts`, `utils.ts` (`cn`), `format.ts` (giá, ngày, % theo `vi-VN`)
  - `[Thêm mới]` `src/dev/StyleguidePage.tsx` — route `/dev/styleguide`, **chỉ đăng ký khi `import.meta.env.DEV`**
  - `[Xóa]` `src/style.css` (CSS mẫu của Vite, không được import), `src/assets/vite.svg`, `src/assets/typescript.svg` (sau khi grep xác nhận không còn nơi dùng)
  - `[Chỉnh sửa]` `src/index.css` → gộp vào `globals.css`; các trang cũ (`DiagnosePage`, `HandbookPage`, `KnowledgeCollectorPage`, `AdminDashboard`) **giữ nguyên nội dung**, chỉ đặt vào trong `AppShell` / `AdminShell`
- **Android** (`mobile/android/app/src/main/`):
  - `[Chỉnh sửa]` `ui/theme/Color.kt`, `ui/theme/Theme.kt` theo ui-ux.md mục 11 (tắt Dynamic Color, thêm `LavitreeStatusColors`)
  - `[Thêm mới]` `res/font/` — Be Vietnam Pro 400/500/600/700 + `Type.kt`

- **Gói cần cài**:
  ```bash
  npm i tailwindcss @tailwindcss/vite @tanstack/react-query @fontsource/be-vietnam-pro clsx tailwind-merge class-variance-authority
  npm i react-hook-form zod @hookform/resolvers   # dùng từ A02
  npx shadcn@latest init
  npx shadcn@latest add button card badge alert input textarea label form select tabs dialog sheet dropdown-menu sonner skeleton table pagination avatar separator tooltip collapsible
  ```

- **Xử lý tình huống biên**:
  - shadcn CLI báo xung đột peer dependency với React 18 → ghi lại thông báo thật vào mục 5, xử lý bằng cách cài đúng phiên bản tương thích; **không** tự nâng React lên 19 khi chưa thống nhất.
  - Route trang cũ phải giữ nguyên đường dẫn (`/`, `/handbook`, `/knowledge`, `/admin`, `/admin/knowledge`) để không gãy luồng thu thập tri thức đang dùng.
  - `RequireRole` chỉ điều hướng giao diện; khi TASK-A01 chưa xong thì đọc vai trò từ một hook `useCurrentUser()` trả `null` (Guest) — không giả lập đăng nhập.

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [ ] **Pha 1 — Dọn dẹp**: xóa `style.css` và asset mẫu không dùng; bỏ Google Fonts; tạo nhánh `feat/task-A00-ui-foundation`.
- [ ] **Pha 2 — Công cụ**: cài Tailwind v4 + plugin Vite, alias `@/`, `shadcn init`, khai báo đủ token & font trong `globals.css`.
- [ ] **Pha 3 — Khung trang**: `AppShell` (thanh trên ≥ 768px, tab dưới < 768px, 5 mục theo screens.md mục 3), `AdminShell` (thanh bên), router + `RequireRole` + trang 404/403; gắn các trang cũ vào khung.
- [ ] **Pha 4 — Dùng chung**: `QueryClientProvider`, `Toaster`, `api-client.ts` (`withCredentials: true`, chuyển lỗi HTTP thành câu tiếng Việt theo ui-ux.md mục 7), `format.ts`, `EmptyState` / `ErrorState` / `PageSkeleton`.
- [ ] **Pha 5 — Nhãn trạng thái**: `status.ts` (hàm `getResultStatus`), `constants.ts` (câu miễn trừ + 4 nhãn, khớp nguyên văn classes.md), `ResultStatusBadge`.
- [ ] **Pha 6 — Styleguide**: trang `/dev/styleguide` hiển thị bảng màu, cỡ chữ, các nút, 4 nhãn trạng thái, Alert, Skeleton.
- [ ] **Pha 7 — Android theme**: cập nhật `Color.kt`, `Theme.kt`, thêm font; 3 màn hình hiện có (Home/Scan/Result) vẫn build được.

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
> ⚠️ **BẮT BUỘC ĐẠT ĐƯỢC ĐỂ CHUYỂN TRẠNG THÁI SANG DONE:**

- [ ] `npm run build` thành công, không lỗi TypeScript.
- [ ] Các route cũ vẫn mở được và chức năng thu thập tri thức vẫn chạy như trước.
- [ ] `/dev/styleguide` hiển thị đúng token mục 2 ui-ux.md; route này **không** có trong bản build production.
- [ ] Không có mã màu hex mới trong file `.tsx` thuộc `src/app`, `src/components`, `src/features`:
  ```bash
  grep -rnE "#[0-9a-fA-F]{6}\b" src/app src/components src/features   # kỳ vọng: không có kết quả
  ```
- [ ] Ảnh chụp màn hình styleguide ở bề rộng 375px và 1280px; điều hướng bằng phím Tab thấy rõ viền focus.
- [ ] Android: `./gradlew assembleDebug` thành công.
- [ ] Bằng chứng kiểm thử (*dán stdout thật từ terminal, cấm tự bịa log*):
  ```bash
  # [Chưa thực hiện]
  ```

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)
- *31/10/2026*: Tạo task. Công nghệ giao diện đã chốt: Tailwind v4 + shadcn/ui (web), Material 3 (Android), font Be Vietnam Pro — chi tiết tại `docs/architecture/ui-ux.md`.
