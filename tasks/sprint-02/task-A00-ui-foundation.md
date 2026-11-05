# TASK-A00: NỀN TẢNG GIAO DIỆN (UI FOUNDATION) — TAILWIND v4, SHADCN/UI & DESIGN TOKENS
* **Sprint**: Sprint 2
* **Thứ tự thực hiện trong Sprint**: **Ưu tiên số 0 của Thành viên A** — làm trước TASK-A02/A03/A04 (các task đó dựng màn hình trên nền này)
* **Phân hệ**: `frontend/web` (chính) · `mobile/android` (chỉ phần theme)
* **Trạng thái**: `[x] DONE`
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
  - `[Chỉnh sửa]` `package.json`, `vite.config.ts` (plugin `@tailwindcss/vite`, alias `@/`), `tsconfig.json` (`paths`, `types`, `jsx`), `index.html` (bỏ link Google Fonts; favicon trỏ tới `favicon-32.png` + `apple-touch-icon.png` có sẵn trong `public/`)
  - `[Thêm mới]` `components.json` (cấu hình shadcn), `src/styles/globals.css` (token theo ui-ux.md mục 2–3)
  - `[Thêm mới]` `src/app/` — `router.tsx`, `providers.tsx`, `AppShell.tsx`, `AdminShell.tsx`, `RequireRole.tsx`, `NotFoundPage.tsx`, `ForbiddenPage.tsx`
  - `[Thêm mới]` `src/components/ui/*` (shadcn Radix), `src/components/common/` — `EmptyState`, `ErrorState`, `PageSkeleton`
  - `[Thêm mới]` `src/features/diagnose/status.ts`, `constants.ts`, `components/ResultStatusBadge.tsx`
  - `[Thêm mới]` `src/lib/api-client.ts`, `utils.ts` (`cn`), `format.ts` (giá, ngày, % theo `vi-VN`)
  - `[Thêm mới]` `src/dev/StyleguidePage.tsx` — route `/dev/styleguide`, **chỉ đăng ký khi `import.meta.env.DEV`**
  - `[Sử dụng]` Ảnh thương hiệu đã xuất sẵn trong `src/assets/brand/` (logo, avatar Lavi, Lavi 3D) — xem ui-ux.md mục 13. Logo + chữ "Lavitree" đặt trên `AppShell`/`AdminShell`; `lavi-full-512` cho `EmptyState`/404
  - `[Xóa]` `src/style.css`, `src/components/Navbar.tsx`, `src/index.css`, `src/assets/vite.svg`, `src/assets/typescript.svg`, `src/assets/hero.png`, `public/favicon.svg`, `public/icons.svg`
- **Android** (`mobile/android/app/src/main/`):
  - `[Chỉnh sửa]` `ui/theme/Color.kt`, `ui/theme/Theme.kt` theo ui-ux.md mục 11 (tắt Dynamic Color, thêm `LavitreeStatusColors`, mapping M3)
  - `[Thêm mới]` `res/font/` — Be Vietnam Pro 400/500/600/700 (`be_vietnam_pro_regular.ttf`, `be_vietnam_pro_medium.ttf`, `be_vietnam_pro_semibold.ttf`, `be_vietnam_pro_bold.ttf`) + `Type.kt`

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [x] **Pha 1 — Dọn dẹp**: xóa `style.css` và asset mẫu không dùng; bỏ Google Fonts; tạo nhánh `feat/task-a00-ui-foundation`.
- [x] **Pha 2 — Công cụ**: cài Tailwind v4 + plugin Vite, alias `@/`, `shadcn init`, khai báo đủ token & font trong `globals.css`.
- [x] **Pha 3 — Khung trang**: `AppShell` (thanh trên ≥ 768px, tab dưới < 768px, 5 mục theo screens.md mục 3), `AdminShell` (thanh bên), router + `RequireRole` + trang 404/403; gắn các trang cũ vào khung.
- [x] **Pha 4 — Dùng chung**: `QueryClientProvider`, `Toaster`, `api-client.ts` (`Authorization: Bearer <token>`, lưu token trong localStorage/memory, chuyển lỗi HTTP thành câu tiếng Việt theo ui-ux.md mục 7), `format.ts`, `EmptyState` / `ErrorState` / `PageSkeleton`.
- [x] **Pha 5 — Nhãn trạng thái**: `status.ts` (hàm `getResultStatus`), `constants.ts` (câu miễn trừ + 4 nhãn, khớp nguyên văn classes.md), `ResultStatusBadge`.
- [x] **Pha 6 — Styleguide**: trang `/dev/styleguide` hiển thị bảng màu (gồm 3 màu thương hiệu), cỡ chữ, các nút, 4 nhãn trạng thái, Alert, Skeleton, logo và Lavi ở các cỡ dùng thật; chỉ đăng ký khi `import.meta.env.DEV`.
- [x] **Pha 7 — Android theme**: cập nhật `Color.kt`, `Theme.kt`, thêm font `res/font/` và `Type.kt`.

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
> ⚠️ **BẮT BUỘC ĐẠT ĐƯỢC ĐỂ CHUYỂN TRẠNG THÁI SANG DONE:**

- [x] `npm run build` thành công, không lỗi TypeScript.
- [x] Các route cũ vẫn mở được và chức năng thu thập tri thức vẫn chạy như trước.
- [x] `/dev/styleguide` hiển thị đúng token mục 2 ui-ux.md; route này **không** có trong bản build production.
- [x] Không có mã màu hex mới trong file `.tsx` thuộc `src/app`, `src/components`, `src/features`:
  ```bash
  grep -rnE "#[0-9a-fA-F]{6}\b" src/app src/components src/features   # Kết quả: CLEAN: 0 hex colors found
  ```
- [x] Điều hướng bằng phím Tab thấy rõ viền focus (`focus-visible:ring-2 focus-visible:ring-ring`).
- [x] Android Theme & Fonts: `Color.kt`, `Theme.kt`, `Type.kt` và 4 file TTF Be Vietnam Pro trong `res/font/` đồng bộ chuẩn xác theo ui-ux.md mục 11.
- [x] Bằng chứng kiểm thử (*stdout thật từ terminal*):
  ```bash
  $ npm run build
  > lavitree-web@1.0.0 build
  > tsc && vite build

  vite v5.4.21 building for production...
  ✓ 1716 modules transformed.
  dist/index.html                                                    0.61 kB │ gzip:   0.42 kB
  dist/assets/lavi-avatar-96-ByTd-mCF.webp                           5.63 kB
  dist/assets/be-vietnam-pro-vietnamese-400-normal-BuGn0gnm.woff     6.57 kB
  dist/assets/be-vietnam-pro-vietnamese-600-normal-DkpCIyan.woff     6.88 kB
  dist/assets/be-vietnam-pro-vietnamese-500-normal-CfdwVo8-.woff     6.88 kB
  dist/assets/be-vietnam-pro-vietnamese-700-normal-By_5yT39.woff     6.89 kB
  dist/assets/be-vietnam-pro-latin-ext-400-normal-DYBYyMQr.woff      8.90 kB
  dist/assets/be-vietnam-pro-latin-ext-700-normal-4Hjo2OtD.woff      9.19 kB
  dist/assets/be-vietnam-pro-latin-ext-500-normal-CK0UkkKf.woff      9.20 kB
  dist/assets/be-vietnam-pro-latin-ext-600-normal-BeUwKxhG.woff      9.22 kB
  dist/assets/lavitree-logo-256-BpWuYtXp.webp                       10.43 kB
  dist/assets/be-vietnam-pro-vietnamese-400-normal-CRcqvyg1.woff2   11.53 kB
  dist/assets/be-vietnam-pro-vietnamese-500-normal-DREgrEoJ.woff2   12.17 kB
  dist/assets/be-vietnam-pro-vietnamese-600-normal-nyU-ZL2p.woff2   12.18 kB
  dist/assets/be-vietnam-pro-vietnamese-700-normal-Csr0PCuG.woff2   12.47 kB
  dist/assets/be-vietnam-pro-latin-ext-400-normal-CiZNW1ec.woff2    13.06 kB
  dist/assets/be-vietnam-pro-latin-ext-500-normal-h0Fp6aX0.woff2    13.55 kB
  dist/assets/lavi-avatar-192-J-TNbYMb.webp                         13.60 kB
  dist/assets/be-vietnam-pro-latin-ext-600-normal-BNd8euf0.woff2    13.61 kB
  dist/assets/be-vietnam-pro-latin-ext-700-normal-C8_gqRu2.woff2    13.85 kB
  dist/assets/be-vietnam-pro-latin-400-normal-bXgqVju9.woff         16.43 kB
  dist/assets/be-vietnam-pro-latin-700-normal-C2EtzaOi.woff         16.91 kB
  dist/assets/be-vietnam-pro-latin-500-normal-BJkVuMHw.woff         17.00 kB
  dist/assets/be-vietnam-pro-latin-600-normal-5IO4e7bK.woff         17.02 kB
  dist/assets/be-vietnam-pro-latin-400-normal-PpnXBOrz.woff2        21.17 kB
  dist/assets/be-vietnam-pro-latin-500-normal-B6LVzGNe.woff2        21.89 kB
  dist/assets/be-vietnam-pro-latin-600-normal-BZDkUTrt.woff2        22.03 kB
  dist/assets/be-vietnam-pro-latin-700-normal-DlW1Zbsh.woff2        22.15 kB
  dist/assets/lavi-full-512-m0pDBhg5.webp                           45.69 kB
  dist/assets/lavi-3d-happy-720-DtkuyeQg.webp                       60.82 kB
  dist/assets/index-ByzhthX4.css                                    51.93 kB │ gzip:   9.16 kB
  dist/assets/index-4pBmtYwF.js                                    546.14 kB │ gzip: 169.52 kB
  ✓ built in 981ms

  $ grep -rnE "#[0-9a-fA-F]{6}\b" src/app src/components src/features || echo "CLEAN: 0 hex colors found"
  CLEAN: 0 hex colors found
  ```

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)
- *31/10/2026*: Tạo task. Công nghệ giao diện đã chốt: Tailwind v4 + shadcn/ui (web), Material 3 (Android), font Be Vietnam Pro — chi tiết tại `docs/architecture/ui-ux.md`.
- *05/11/2026*: Hoàn thành toàn bộ TASK-A00 trên nhánh `feat/task-a00-ui-foundation`:
  - Dọn dẹp template cũ: xóa `style.css`, `Navbar.tsx`, `index.css`, các file `.svg` mẫu không dùng; cập nhật `index.html` trỏ favicon local WebP.
  - Cài đặt Tailwind v4 (`@tailwindcss/vite`), Radix primitives, `@fontsource/be-vietnam-pro`, Lucide React, Sonner, Zod, React Hook Form, TanStack Query.
  - Khởi tạo `src/styles/globals.css` đầy đủ token nền, chữ, nút, 4 trạng thái và 3 màu thương hiệu Lavi.
  - Xây dựng `AppShell` (desktop top navbar, mobile 5-item bottom tab bar) & `AdminShell` (sidebar có drawer mobile).
  - Hoàn thiện `ResultStatusBadge` (4 trạng thái khớp `classes.md`), `api-client.ts`, `format.ts` (vi-VN), `EmptyState`, `ErrorState`, `PageSkeleton`.
  - Xây dựng `/dev/styleguide` (chỉ nạp trong DEV) showcase toàn diện design system.
  - Đồng bộ theme Android: `Color.kt`, `Theme.kt`, `Type.kt` và nạp font Be Vietnam Pro 400/500/600/700 vào `res/font/`.
  - Build `npm run build` thành công tuyệt đối (exit 0) trong 981ms. Zero hex colors trong code mới.
