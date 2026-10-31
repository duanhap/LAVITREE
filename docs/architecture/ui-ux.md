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
4. **Đường đi mạng** (làm trong TASK-A04): nginx hiện chuyển mọi `/api/` sang core-api, nên phải thêm `location /api/v1/agent/` → `agent-service:8001` với `proxy_buffering off;` và `proxy_read_timeout` đủ dài (thiếu dòng này stream sẽ dồn về một lần). Vite dev proxy thêm rule tương ứng **đặt trước** rule `/api`. Trình duyệt không gọi thẳng cổng 8001 (AGENTS.md điều 10).
5. Chế độ Agent ngoại tuyến (TASK-07): contract chưa có trường báo hiệu → cần Thành viên B bổ sung (ví dụ `"mode": "offline"` trong `final_answer`) để UI hiện nhãn "Đang dùng hướng dẫn lưu sẵn".

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
- Khuyến nghị cho TASK-A01: Core API trả JWT trong **cookie `HttpOnly; Secure; SameSite=Lax`**, client gọi API với `withCredentials: true`. Không lưu token trong `localStorage` (một lỗi XSS là lộ token).
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
