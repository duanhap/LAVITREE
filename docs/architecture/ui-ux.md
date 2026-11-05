# 🎨 HỆ THỐNG THIẾT KẾ GIAO DIỆN (UI-UX.MD)
## Hệ thống Lavitree — Design System dùng chung cho Web Portal & Android App
*SSOT về công nghệ giao diện, màu sắc, chữ, thành phần và cách hiển thị dữ liệu. Danh sách màn hình & quyền truy cập: [docs/spec/screens.md](../spec/screens.md).*
*Mọi task chạm vào `frontend/web/` hoặc `mobile/android/` **bắt buộc** đọc file này trước khi code.*

---

## 1. CÔNG NGHỆ ĐÃ CHỐT (31/10/2026)

| Lớp | Web (`frontend/web`) | Android (`mobile/android`) |
|---|---|---|
| Nền tảng | React 18 + Vite + TypeScript | Kotlin + Jetpack Compose |
| Kiểu dáng | **Tailwind CSS v4** (`@tailwindcss/vite`) | **Material Design 3** |
| Thành phần | **shadcn/ui** (Radix) — code nằm trong `src/components/ui/` | Material 3 Components |
| Icon | `lucide-react` | Material Symbols |
| Gọi API | Axios + **TanStack Query** | Retrofit 2 + OkHttp + Coroutines/Flow |
| Form | **react-hook-form + zod** | State trong ViewModel |
| Stream SSE | `@microsoft/fetch-event-source` | OkHttp SSE (`okhttp-sse`) |
| Bảng Admin | TanStack Table (mẫu data-table của shadcn) | — |
| Biểu đồ (S3) | Recharts (shadcn charts) | — |
| Font | **Be Vietnam Pro** tự host qua `@fontsource/be-vietnam-pro` | Be Vietnam Pro trong `res/font/` |

**Lý do**: AI sinh Tailwind/shadcn ổn định và nhất quán; token khai báo một chỗ nên không còn mã màu tùy tiện; Radix lo sẵn bàn phím & trình đọc màn hình. **Không dùng** MUI/Ant Design (khó tạo nhận diện riêng), không dùng Google Fonts CDN (demo offline Sprint 3 sẽ mất font).

---

## 2. BẢNG MÀU (DESIGN TOKENS)
Một bảng duy nhất cho cả hai nền tảng. Tỉ lệ tương phản đã tính theo WCAG 2.1 (chữ thường cần ≥ 4.5:1). **Sprint 2 chỉ làm giao diện sáng** — dễ đọc dưới nắng; giao diện tối chưa nằm trong phạm vi.

| Token (CSS) | Hex | Dùng cho | Tương phản |
|---|---|---|---|
| `--background` | `#FAFAF7` | Nền trang | — |
| `--card` | `#FFFFFF` | Nền thẻ, hộp thoại | — |
| `--foreground` | `#1C2420` | Chữ chính | 15.2 trên nền trang |
| `--muted-foreground` | `#5B6660` | Chữ phụ, chú thích | 5.7 trên nền trang |
| `--border` / `--input` | `#E3E6E1` | Viền, ô nhập | (trang trí) |
| `--primary` | `#2E6B3F` | Nút chính, liên kết, mục đang chọn | 6.4 với chữ trắng |
| `--primary-hover` | `#245633` | Nút chính khi rê/nhấn | 8.6 với chữ trắng |
| `--secondary` | `#EEF3EC` | Nút phụ, nền nhấn nhẹ | 5.7 với chữ `--primary` |
| `--destructive` | `#B91C1C` | Xóa, lỗi, chặn | 6.5 với chữ trắng |
| `--ring` | `#2E6B3F` | Viền focus bàn phím | — |

**Màu trạng thái** — tách khỏi màu thương hiệu để nhãn kết quả không bị nhìn như nút bấm:

| Token (chữ / nền) | Hex | Dùng cho | Tương phản |
|---|---|---|---|
| `--status-ok` / `--status-ok-bg` | `#115E59` / `#CCFBF1` | 🟢 Kết quả tham khảo, thành công | 6.7 |
| `--status-confusion` / `-bg` | `#92400E` / `#FEF3C7` | 🟡 Dễ nhầm, cảnh báo | 6.4 |
| `--status-uncertain` / `-bg` | `#B91C1C` / `#FEE2E2` | 🔴 Chưa chắc chắn, guardrail chặn | 5.3 |
| `--status-ood` / `-bg` | `#475569` / `#F1F5F9` | ⚪ Không nhận diện được lá | 6.9 |
| `--info` / `--info-bg` | `#1D4ED8` / `#DBEAFE` | Bước suy luận của Agent, thông tin | 5.5 |

**Màu thương hiệu** — lấy mẫu từ mascot Lavi (mục 13). **Chỉ dùng để trang trí**, không dùng làm màu chữ hay nền cho chữ trắng:

| Token | Hex | Dùng cho | Ghi chú |
|---|---|---|---|
| `--brand-mint` | `#A6E3CC` | Viền phát sáng, nền minh họa, vòng quanh avatar Lavi | Chữ trắng trên nền này chỉ đạt 1.45 → cấm |
| `--brand-mint-soft` | `#E6F7F0` | Nền bong bóng chat của Lavi, banner chào mừng | Chữ `--foreground` 14.3 · chữ `--primary` 5.8 |
| `--brand-glow` | `#5EEAD4` | Đèn LED, hiệu ứng "đang suy nghĩ" | Chỉ dùng cho hiệu ứng, không chứa chữ |

> Ảnh Grad-CAM dùng bảng màu Jet (xanh → đỏ). Không đặt nhãn đỏ/xanh dương sát cạnh ảnh heatmap để tránh đọc nhầm.

---

## 3. CHỮ, KHOẢNG CÁCH, BO GÓC

- **Font**: Be Vietnam Pro, các độ đậm 400 / 500 / 600 / 700. Số liệu (giá, %, ms) dùng `tabular-nums`.
- **Cỡ chữ** (px): 12 nhãn phụ · 14 chú thích · **16 nội dung (tối thiểu cho đoạn văn)** · 18 tiêu đề thẻ · 20 / 24 tiêu đề mục · 30 tiêu đề trang. Dòng cao 1.5 cho nội dung.
- **Khoảng cách**: bội số 4px (dùng thang mặc định của Tailwind). Khoảng giữa các khối lớn: 24px (mobile) / 32px (desktop).
- **Bo góc**: 8px nút & ô nhập · 12px thẻ · 9999px nhãn tròn (badge).
- **Đổ bóng**: chỉ dùng cho thẻ nổi, menu, hộp thoại. Không dùng nền gradient.
- **Điểm ngắt**: `md` = 768px (đổi thanh điều hướng trên ↔ tab dưới), `lg` = 1024px (kết quả chẩn đoán chia 2 cột: ảnh | thông tin).
- **Định dạng**: giá `65.000 ₫` (`Intl.NumberFormat('vi-VN')`), ngày `31/10/2026 14:30`, độ tin cậy `94,6%`.

---

## 4. HỆ THỐNG NHÃN TRẠNG THÁI (`ResultStatusBadge`)
Nguồn quy tắc: [classes.md mục 4](../spec/classes.md). **Luôn có icon + chữ**, không bao giờ chỉ dựa vào màu.

| Trạng thái | Icon (lucide) | Chữ trên nhãn | Token |
|---|---|---|---|
| `reference` | `CircleCheck` | Kết quả tham khảo | `status-ok` |
| `confusion` | `TriangleAlert` | Dễ nhầm – xem thêm khả năng khác | `status-confusion` |
| `uncertain` | `CircleAlert` | Chưa chắc chắn – nên chụp lại | `status-uncertain` |
| `ood` | `ImageOff` | Không nhận diện được lá cây | `status-ood` |

Hàm suy ra trạng thái đặt ở **một chỗ duy nhất** `src/features/diagnose/status.ts`: `is_ood` → `ood`; `is_uncertain` → `uncertain`; có `confusion_group` → `confusion`; còn lại → `reference`. Các câu cố định (miễn trừ, nhãn) đặt trong `src/features/diagnose/constants.ts`, khớp nguyên văn `classes.md`.

---

## 5. THƯ VIỆN THÀNH PHẦN

**Lấy từ shadcn** (`npx shadcn add ...`): button, card, badge, alert, input, textarea, label, form, select, tabs, dialog, sheet, dropdown-menu, sonner (toast), skeleton, table, pagination, avatar, separator, tooltip, collapsible.

**Thành phần riêng của Lavitree** (`src/components/common/` hoặc trong từng feature):

| Thành phần | Nhiệm vụ |
|---|---|
| `AppShell` / `AdminShell` | Khung trang: thanh trên + tab dưới (người dùng) · thanh bên (Admin) |
| `ImageDropzone` | Kéo thả / chọn / chụp ảnh; kiểm tra định dạng jpg-png-webp và ≤ 10MB; thu nhỏ cạnh dài về ≤ 2048px trước khi gửi |
| `CaptureGuide` | Khung ngắm 15–20cm, lá chiếm ≥ 70% khung (FEAT-01) |
| `ResultStatusBadge` | Mục 4 |
| `DiagnosisWarning` | Alert hiển thị `warning_message` theo màu trạng thái |
| `Top3List` | 3 khả năng + thanh độ tin cậy; tự mở khi `confusion` / `uncertain` |
| `ImageCompare` | Thanh trượt so sánh ảnh gốc ↔ Grad-CAM; bàn phím dùng được (phím mũi tên) |
| `TreatmentSteps` | Render N bước IPM từ API, nhãn "Cách ly N ngày" |
| `SourceList` | Nguồn kiểm chứng, link `target="_blank" rel="noopener noreferrer"` |
| `ChatMessage`, `ReasoningSteps`, `GuardrailAlert`, `DraftOrderCard` | Mục 6 |
| `EmptyState`, `ErrorState`, `PageSkeleton` | Mục 7 |

---

## 6. HIỂN THỊ CHAT STREAMING SSE (W-04, M-04)
Hợp đồng sự kiện: [api-contracts.md mục 4.1](api-contracts.md).

| Sự kiện | Giao diện |
|---|---|
| `trace_start` | Bong bóng trợ lý hiện chấm nhấp nháy "Đang suy nghĩ…" |
| `thought` | Thêm 1 dòng vào `ReasoningSteps` (thu gọn mặc định, tiêu đề "Xem cách Trợ lý suy luận (N bước)") |
| `action` | Dòng công cụ có icon + tên tiếng Việt (bảng dưới), hiện trạng thái "đang chạy" |
| `observation` | Đánh dấu công cụ đó xong; nội dung kết quả chỉ hiện khi mở rộng |
| `delta` | Nối `token` vào câu trả lời, hiện con trỏ nhấp nháy ở cuối |
| `final_answer` | Thay toàn bộ nội dung bằng `answer` (nguồn chuẩn); nếu có `guardrail_triggered` → `GuardrailAlert` đặt **trên** câu trả lời; nếu có `draft_order` → `DraftOrderCard` dưới câu trả lời |

Tên công cụ hiển thị: `lookup_disease_knowledge` → *Tra cứu tri thức* · `check_weather_risk` → *Kiểm tra thời tiết* · `query_pesticide_store` → *Tra kho vật tư* · `verify_phi_safety` → *Kiểm tra thời gian cách ly*.

**Quy tắc kỹ thuật bắt buộc**
1. Endpoint là `POST`, nên **không dùng `EventSource`** của trình duyệt (chỉ hỗ trợ GET). Dùng `fetch-event-source`, có nút **Dừng** (`AbortController`).
2. Câu trả lời render Markdown bằng `react-markdown` **không bật HTML thô** (chặn XSS từ đầu ra LLM).
3. Mất kết nối giữa chừng → giữ phần chữ đã nhận + dòng "Kết nối bị gián đoạn" + nút "Thử lại". Không tự gửi lại.
4. **Đường đi mạng** (đã cấu hình trong `nginx.conf` và `vite.config.ts`): Thêm route riêng `location /api/v1/agent/` → `agent-service:8001` với `proxy_buffering off;`, `proxy_cache off;` và `proxy_read_timeout 300s;` để SSE streaming không bị gom cục. Vite dev proxy đã cấu hình rule `/api/v1/agent` **đặt trước** `/api`. Trình duyệt tuyệt đối không gọi thẳng cổng 8001 (AGENTS.md điều 10).
5. **Chế độ Agent ngoại tuyến** (TASK-07 & TASK-08): Contract SSE đã bổ sung trường `is_offline_fallback: boolean` trong event payload `final_answer` (theo [api-contracts.md mục 4.1](api-contracts.md#L274)). Khi `is_offline_fallback === true`, UI hiển thị badge nhãn `[Đang dùng hướng dẫn lưu sẵn]` với token `--status-warning` ngay dưới tiêu đề phản hồi.

---

## 7. TRẠNG THÁI TẢI / RỖNG / LỖI
Mọi màn hình gọi API phải có đủ 3 trạng thái. Tải: `Skeleton` đúng hình bố cục (không dùng vòng xoay toàn trang). Rỗng: `EmptyState` có 1 câu giải thích + 1 hành động.

| Lỗi | Câu hiển thị cho người dùng |
|---|---|
| 400 | Ảnh vượt 10MB hoặc không đúng định dạng (jpg, png, webp). |
| 401 | Phiên đăng nhập đã hết hạn. → chuyển `/login?next=...` |
| 403 | Bạn không có quyền truy cập trang này. |
| 422 | Ảnh bị lỗi, không đọc được. Vui lòng chụp lại. |
| 429 | Bạn thao tác quá nhanh / đã hết lượt hỏi hôm nay. Thử lại sau ít phút. |
| 5xx, mất mạng | Hệ thống đang bận hoặc mất kết nối. + nút "Thử lại" |

Không bao giờ hiện nguyên văn lỗi kỹ thuật / stack trace cho người dùng.

---

## 8. QUY TẮC TRẢI NGHIỆM NGOÀI VƯỜN
- Vùng bấm tối thiểu **44×44px (web) / 48×48dp (Android)**.
- Trên màn hẹp, nút hành động chính đặt ở nửa dưới màn hình, bấm được bằng ngón cái.
- Tương phản tối thiểu WCAG AA (đã đảm bảo ở mục 2); focus bàn phím luôn nhìn thấy (`--ring`).
- Câu chữ ngắn, xưng "bạn", không viết hoa toàn bộ câu dài, không dùng thuật ngữ máy học trên giao diện người dùng (nói "độ tin cậy của mô hình", không nói "softmax").
- Ảnh luôn có `alt` mô tả; mọi icon đứng một mình có `aria-label`.

---

## 9. XÁC THỰC PHÍA CLIENT
- **Quyết định của nhóm (TASK-A01, api-contracts.md)**: Core API trả JWT trong body, client gửi `Authorization: Bearer <token>` qua interceptor của `api-client.ts`.
- Vì token đọc được bằng JavaScript nên một lỗi XSS là đủ để lộ token. Bắt buộc giảm rủi ro:
  - Không dùng `dangerouslySetInnerHTML`; Markdown của Agent render không bật HTML thô (mục 6).
  - nginx đặt header `Content-Security-Policy` chặn script lạ (`script-src 'self'`).
  - Đăng xuất hoặc nhận lỗi 401 → xóa token và cache của TanStack Query.
  - Cân nhắc rút `expires_in` (hiện 86400s = 24h) xuống ngắn hơn khi có cơ chế làm mới token.
- Phương án mạnh hơn nếu còn thời gian ở Sprint 3: chuyển sang cookie `HttpOnly; Secure; SameSite=Lax`.
- Thông tin hiển thị (tên, vai trò) lấy từ `GET /api/v1/auth/me`, giữ trong TanStack Query; ẩn/hiện menu theo vai trò chỉ để tiện dùng — quyền thật do backend kiểm tra.

---

## 10. QUY ƯỚC MÃ NGUỒN WEB

```text
frontend/web/src/
├── app/            # router, providers (QueryClient, Toaster), AppShell, AdminShell, guard theo vai trò
├── components/
│   ├── ui/         # sinh bởi shadcn — chỉ sửa khi cần đổi hành vi chung
│   └── common/     # thành phần dùng lại nhiều feature (mục 5)
├── features/       # diagnose · handbook · chat · history · store · auth · admin
│   └── <feature>/  # api.ts (hook TanStack Query) · components/ · pages/ · types.ts
├── lib/            # api-client.ts (axios), sse.ts, utils.ts (cn), format.ts
└── styles/globals.css  # @import "tailwindcss"; token mục 2; @theme inline
```

- ⛔ Cấm mã màu hex và `style={{...}}` trong `.tsx` (trừ giá trị động như vị trí thanh trượt). Dùng class Tailwind gắn token: `bg-primary`, `text-status-uncertain`...
- Gộp class bằng `cn()`; biến thể thành phần dùng `cva` theo mẫu shadcn.
- Import tuyệt đối qua alias `@/` (cấu hình trong `tsconfig.json` và `vite.config.ts`).
- Kiểu dữ liệu response đặt trong `features/<feature>/types.ts`, bám đúng `api-contracts.md`.

**Mẫu khai báo token** (`styles/globals.css`):
```css
:root {
  --background: #FAFAF7; --foreground: #1C2420; --primary: #2E6B3F; /* ...đủ mục 2 */
  --radius: 0.75rem;
}
@theme inline {
  --color-background: var(--background);
  --color-primary: var(--primary);
  --color-status-uncertain: var(--status-uncertain);
  --font-sans: "Be Vietnam Pro", system-ui, sans-serif;
}
```

---

## 11. ÁNH XẠ SANG ANDROID (MATERIAL 3)

| Vai trò M3 | Token web | Vai trò M3 | Token web |
|---|---|---|---|
| `primary` / `onPrimary` | `--primary` / `#FFFFFF` | `surface` | `--card` |
| `primaryContainer` / `onPrimaryContainer` | `--secondary` / `--primary` | `background` | `--background` |
| `error` / `onError` | `--destructive` / `#FFFFFF` | `onSurface` | `--foreground` |
| `outline` | `--border` | `onSurfaceVariant` | `--muted-foreground` |

- 4 màu trạng thái + `info` không có sẵn trong M3 → khai báo `data class LavitreeStatusColors` và cung cấp qua `CompositionLocal` trong `Theme.kt`.
- Tắt Dynamic Color (Material You) để giữ màu thương hiệu.
- `ui/theme/Color.kt` hiện có (`ForestGreen #2E7D32`...) được thay toàn bộ theo bảng mục 2.

---

## 12. CHECKLIST TRƯỚC KHI MERGE TASK GIAO DIỆN
- [ ] Không có hex / inline style mới trong `.tsx`; Android không có `Color(0x...)` ngoài `Color.kt`.
- [ ] Màn hình có đủ trạng thái tải / rỗng / lỗi (mục 7).
- [ ] Kiểm tra ở 2 bề rộng: 375px và 1280px.
- [ ] Dùng được hoàn toàn bằng bàn phím (Tab, Enter, Esc) trên các luồng chính.
- [ ] Màn hình kết quả đúng thứ tự khối & quy tắc ở [screens.md mục 4](../spec/screens.md).
- [ ] `npm run build` không lỗi; dán ảnh chụp màn hình thật vào phần bằng chứng của task.
- [ ] Mascot Lavi chỉ xuất hiện ở đúng ngữ cảnh cho phép (mục 13.4); ảnh dùng bản tối ưu trong `assets/brand`, không import file gốc trong `design/brand/`.

---

## 13. THƯƠNG HIỆU: LOGO & MASCOT LAVI

### 13.1. Câu chuyện nhân vật
**Lavi** là một chú slime trong suốt màu mint, tượng trưng cho **giọt nước** nuôi cây. Lavi có:
- **Hai lá mầm** trên đầu: đại diện cho cây trồng.
- **Tai nghe có mic**: trợ lý AI luôn lắng nghe nhà nông.
- **Đế công nghệ và vòng sáng**: đang lơ lửng, sẵn sàng hỗ trợ.

Logo là chữ **L** cách điệu từ hai chiếc lá, màu trắng, đặt trong ô vuông bo góc màu xanh lá đậm.

**Tính cách:** thân thiện, khiêm tốn, nói ngắn gọn dễ hiểu. Lavi **không phán quyết**: luôn nói "gợi ý", "nên", "có thể", khớp với tinh thần "kết quả tham khảo" ở classes.md. Lavi xưng "Lavi" hoặc "mình", gọi người dùng là "bạn". → Thành viên B dùng đúng vai này trong system prompt của Agent (TASK-07) để giao diện và giọng trả lời đồng nhất.

### 13.2. Kho ảnh & quy tắc đặt file

```text
design/brand/                          ← FILE GỐC (PNG 1024–2400px, nền trong suốt) — chỉ để xuất bản mới, KHÔNG import vào app
├── logo/lavitree-logo.png
└── mascot/
    ├── lavi-avatar.png                ← 2D, nét viền rõ — avatar chatbot
    └── lavi-3d-happy.png              ← 3D, nháy mắt vui — minh họa giao diện

frontend/web/
├── public/                            ← favicon-32.png · apple-touch-icon.png (180) · icon-512.png
└── src/assets/brand/                  ← import trong React (Vite tự gắn hash, cache tốt)
    ├── lavitree-logo-64.webp · lavitree-logo-256.webp
    ├── lavi-avatar-96.webp · lavi-avatar-192.webp     ← đã cắt chỉ còn đầu + lá
    ├── lavi-full-512.webp
    └── lavi-3d-happy-720.webp

mobile/android/app/src/main/res/drawable-nodpi/
    lavitree_logo.webp · lavi_avatar.webp · lavi_3d_happy.webp
```

- **Tên file**: `lavi-<kiểu>-<biểu-cảm>-<cỡ>.webp` cho web (gạch ngang); Android bắt buộc chữ thường + gạch dưới (`lavi_3d_thinking.webp`).
- **Thêm biểu cảm mới** theo 3 bước:
  1. Lưu file gốc PNG vào `design/brand/mascot/`.
  2. Xuất bản WebP: cỡ hiển thị lớn nhất ×2, cắt bỏ viền trong suốt.
  3. Cập nhật bảng 13.4 trong file này.
- **Icon launcher Android**: dùng Android Studio → *Image Asset* (adaptive icon) từ `design/brand/logo/lavitree-logo.png`, không tự cắt tay.
- `design/` nằm ngoài `docs/`, vì `docs/brand/*` đang bị `.gitignore` bỏ qua.

### 13.3. Quy tắc dùng logo
- Cỡ tối thiểu **24px**. Chừa khoảng trống xung quanh ≥ 1/4 chiều rộng logo.
- Đặt logo trên nền sáng (`--background`, `--card`). Không đổi màu, không kéo méo, không thêm bóng.
- Dùng một bản logo cho mọi cỡ, kể cả favicon: logo nền xanh đậm giữ được chữ L trắng ở 16–32px.
- Thanh điều hướng hiển thị logo 32–40px kèm chữ "Lavitree" (Be Vietnam Pro 700, màu `--foreground`).

### 13.4. Lavi xuất hiện ở đâu — và KHÔNG ở đâu

| Ngữ cảnh | Ảnh dùng | Ghi chú |
|---|---|---|
| Avatar tin nhắn của trợ lý (W-04, M-04) | `lavi-avatar-96/192` | Hình tròn 32–40px, nền `--brand-mint-soft` |
| Màn chào khung Chat lúc chưa có tin nhắn | `lavi-3d-happy-720` | Cao khoảng 160px + câu chào + 3 câu hỏi gợi ý |
| Hero trang chủ / onboarding | `lavi-3d-happy-720` | Tối đa 1 lần mỗi màn hình |
| Trạng thái rỗng (`EmptyState`), trang 404 | `lavi-full-512` | Cao khoảng 120px |
| Nút mở nhanh Trợ lý (góc dưới phải) | `lavi-avatar-96` | 56px, kèm `aria-label="Mở trợ lý Lavi"` |
| ⛔ **Màn kết quả chẩn đoán** | — | Đây là thông tin quan trọng, cần nghiêm túc. Không đặt mascot đang cười cạnh kết quả bệnh |
| ⛔ Cảnh báo 🔴 / ⚪, guardrail chặn thuốc, trang lỗi hệ thống | — | Chỉ dùng icon + chữ (mục 4, mục 7) cho tới khi có biểu cảm phù hợp |
| ⛔ Admin Portal | — | Công cụ nội bộ, chỉ dùng logo |

**Quy tắc vàng**: biểu cảm của Lavi phải khớp với nội dung. Chưa có biểu cảm phù hợp thì **không hiện Lavi**, không lấy tạm ảnh vui.

### 13.5. Lộ trình biểu cảm (gắn với sự kiện SSE ở mục 6)

| Biểu cảm | File (dự kiến) | Khi nào dùng | Trạng thái |
|---|---|---|---|
| Mặc định – mỉm cười | `lavi-avatar.png` | Avatar, tin nhắn cũ | ✅ Có |
| Vui – nháy mắt | `lavi-3d-happy.png` | Màn chào, onboarding, `final_answer` thành công | ✅ Có |
| Đang suy nghĩ | `lavi-3d-thinking` | `trace_start`, `thought`, `action`, `observation` | ⏳ Chưa có — tạm dùng avatar + hiệu ứng nhịp sáng (13.6) |
| Lo lắng / cảnh báo | `lavi-3d-alert` | `guardrail_triggered`, kết quả 🔴 dẫn sang Chat | ⏳ Chưa có — tạm ẩn mascot |
| Buồn / xin lỗi | `lavi-3d-sorry` | Lỗi mạng, 5xx, Guest hết lượt hỏi | ⏳ Chưa có |
| Ngủ gật | `lavi-3d-offline` | Agent chạy chế độ ngoại tuyến (TASK-07) | ⏳ Chưa có |
| Vẫy tay chào | `lavi-3d-welcome` | Đăng nhập / đăng ký thành công | ⏳ Chưa có |

Khi tạo biểu cảm mới: dùng **cùng công cụ, cùng góc nhìn ¾, cùng ánh sáng** với `lavi-3d-happy.png` (đính kèm ảnh này làm tham chiếu) để bộ ảnh đồng nhất.

### 13.6. Chuyển động
- **Lơ lửng khi chờ**: dịch lên xuống 4px, chu kỳ 3 giây (`animate-[float_3s_ease-in-out_infinite]`). Chỉ áp dụng cho ảnh lớn ở màn chào, không áp dụng cho avatar trong danh sách tin nhắn.
- **Đang suy nghĩ**: vòng sáng `--brand-glow` nhịp nhẹ quanh avatar của tin nhắn đang stream. Dừng ngay khi nhận `final_answer`.
- Tôn trọng `prefers-reduced-motion: reduce` → tắt mọi chuyển động. Không dùng thư viện animation nặng (Lottie) trong Sprint 2.

### 13.7. Khả năng tiếp cận
- Avatar trong tin nhắn là ảnh trang trí (`alt=""`), vì tên "Lavi" đã có ở dòng tiêu đề tin nhắn. Ảnh minh họa đứng một mình dùng `alt="Lavi – trợ lý cây trồng của Lavitree"`.
- Mascot **không bao giờ là kênh duy nhất truyền thông tin**: trạng thái luôn có chữ đi kèm.
