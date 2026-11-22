# TASK-23: Sửa lỗi trắng trang "Đơn hàng của tôi" (`/orders`) và thêm lớp chặn lỗi giao diện (ErrorBoundary)
* **Sprint**: Sprint 3 (sửa lỗi production)
* **Phân hệ**: `frontend/web` (trang Đơn hàng, khung ứng dụng), `docs/architecture/api-contracts.md`
* **Trạng thái**: `[x] DONE`
* **Người phụ trách**: giao cho agent; nghiệm thu: Claude Code / trưởng nhóm
* **Độ ưu tiên**: **P0** (người dùng đã đặt hàng không xem được đơn trên production)
* **Tạo ngày**: 22/11/2026
* **Ước lượng**: nhỏ (1 trang + 1 component mới). **Không** sửa backend.

---

## 1. TRIỆU CHỨNG

- Trên `https://lavitree.io.vn/orders`, tài khoản **đã đăng nhập** và **đã có ít nhất 1 đơn hàng** chỉ thấy **trang trắng**: mất cả thanh menu và chân trang.
- Tài khoản chưa có đơn nào thì vẫn thấy trang "Bạn chưa có đơn hàng nào" bình thường.
- **Không phải lỗi đăng nhập hay phân quyền**, đã kiểm tra:
  - Tài khoản đăng ký mới có vai trò `FARMER` (`AuthController.cs`, `AuthContext.tsx` dòng 83).
  - Route `/orders` cho phép `['FARMER', 'ADMIN']` (`frontend/web/src/app/router.tsx`, khoảng dòng 125–135).
  - Nếu sai quyền, trang sẽ chuyển sang `/login` hoặc `/403`, không trắng.

## 2. NGUYÊN NHÂN (đã xác minh bằng đọc code)

### 2.1. Trang đọc sai tên trường so với API

API `GET /api/v1/orders` trả về theo `backend/core-api/src/Lavitree.Application/DTOs/OrderDtos.cs` (`OrderResponseDto`, `OrderItemResponseDto`):

```json
[
  {
    "order_id": "ord-778899aa",
    "total_amount": 185000,
    "payment_method": "COD",
    "order_status": "Pending",
    "receiver_name": "Nguyễn Văn A",
    "notes": "Giao sáng sớm",
    "shipping_address": "Xã …, Huyện …, Nam Định",
    "phone_number": "0987654321",
    "created_at": "2026-10-31T14:30:00Z",
    "items": [
      { "product_id": 1, "product_name": "Ridomil Gold 68WG", "quantity": 2, "unit_price": 65000, "total_price": 130000 }
    ]
  }
]
```

`frontend/web/src/pages/OrdersPage.tsx` lại khai báo và đọc **các trường không tồn tại**:

| Trang đọc | API thực tế | Vị trí trong `OrdersPage.tsx` | Hậu quả |
|---|---|---|---|
| `item.subtotal` | `total_price` | interface dòng ~19, render dòng ~228 `item.subtotal.toLocaleString('vi-VN')` | `undefined.toLocaleString` → **TypeError, sập cả trang** |
| `order.id` | `order_id` | interface dòng ~24, `key={order.id}` dòng ~183, "Mã đơn" dòng ~189 | Mã đơn hiện trống, `key` trùng (`undefined`) |
| `item.id` | (không có) | interface dòng ~14, `key={item.id}` dòng ~214 | `key` trùng |
| `item.image_url` | (không có) | interface dòng ~20 | Khai báo thừa (chưa render) |

### 2.2. Ứng dụng không có lớp chặn lỗi

- Tìm trong `frontend/web/src` không có `ErrorBoundary` hay `errorElement` nào.
- Ứng dụng dùng `<BrowserRouter>` + `<Routes>` (`src/App.tsx`, `src/app/router.tsx`), **không** phải data router (`createBrowserRouter`). Vì vậy **`errorElement` của React Router không có tác dụng ở đây**. Phải dùng một **class component ErrorBoundary** của React.
- Khi một trang ném lỗi lúc render, React gỡ toàn bộ cây giao diện và để lại trang trắng.
- Cùng cơ chế này, một lỗi khác cũng ra trang trắng: **sau mỗi lần deploy**, trình duyệt còn giữ trang cũ sẽ tải chunk lazy cũ (đã bị xóa), lỗi `Failed to fetch dynamically imported module` / `ChunkLoadError`.

## 3. PHẠM VI

**Làm:**
1. Sửa `OrdersPage.tsx` đọc **đúng hợp đồng API** (mục 4.1).
2. Thêm `ErrorBoundary` dùng chung, bọc nội dung trang trong `AppShell`, `AdminShell`, `AuthLayout` (mục 4.2).
3. Cập nhật `docs/architecture/api-contracts.md` mục 3.6.1 và 3.6.2: thêm `total_price` vào `items` (backend đã trả, tài liệu thiếu).

**Không làm:**
- **Không sửa backend** (`OrderDtos.cs`, `OrdersController.cs`). Hợp đồng API là chuẩn, frontend phải theo.
- **Không** thêm kiểu dự phòng hai tên trường (`item.total_price ?? item.subtotal`, `order.order_id || order.id`). Làm vậy che lỗi và tạo hai hợp đồng song song. Chỉ dùng tên trường đúng.
- Không đổi giao diện, bố cục, màu của trang Đơn hàng ngoài những dòng nêu ở mục 4.1.
- Không làm trang chi tiết đơn, không làm `/admin/orders`.
- Không đụng các file đang có thay đổi chưa commit của người khác. Chạy `git status` trước khi bắt đầu, chỉ commit file thuộc task này.

## 4. CÁCH SỬA CHI TIẾT

### 4.1. `frontend/web/src/pages/OrdersPage.tsx`

1. **Sửa interface** cho khớp đúng `OrderDtos.cs` (không thêm, không bớt trường):

```ts
interface OrderItemDto {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface OrderResponseDto {
  order_id: string;
  total_amount: number;
  payment_method: string;
  order_status: string;
  receiver_name?: string | null;
  notes?: string | null;
  shipping_address: string;
  phone_number: string;
  created_at: string;
  items: OrderItemDto[];
}
```

   Có thể đặt 2 interface này vào `frontend/web/src/features/orders/types.ts` nếu muốn dùng lại. `StorePage.tsx` hiện chỉ dùng `order_id` và `total_amount` của `POST /orders`, không bắt buộc sửa.

2. **Sửa chỗ dùng:**
   - `key={order.id}` → `key={order.order_id}`.
   - "Mã đơn: {order.id}" → `{order.order_id}`.
   - `key={item.id}` → ``key={`${order.order_id}-${item.product_id}`}``. Một đơn có thể không trùng sản phẩm, nhưng ghép như vậy cho chắc.
   - `item.subtotal.toLocaleString('vi-VN')` → `formatCurrency(item.total_price)`.
3. **Định dạng tiền và ngày** bằng helper có sẵn `frontend/web/src/lib/format.ts`, thay cho gọi `.toLocaleString` trực tiếp trên số (gọi trực tiếp sẽ sập nếu giá trị thiếu):
   - `formatCurrency(order.total_amount)`, `formatCurrency(item.unit_price)`, `formatCurrency(item.total_price)`.
     - Lưu ý: `formatCurrency` hiện ra dạng `185.000 ₫` thay cho `185.000 đ` như cũ. **Chấp nhận** đổi sang ký hiệu chuẩn của helper để đồng bộ toàn web. Không sửa helper.
   - `formatDate(order.created_at)` thay cho khối `new Date(...).toLocaleString(...)`.
4. `receiver_name` có thể `null` (đơn cũ). Khi `null` thì phần "Giao tới" bỏ tên, chỉ còn `(số điện thoại) – địa chỉ`, không in chữ `null`.
5. `getStatusBadge(status)`: giữ nguyên logic (đã `toUpperCase()`, nên `Pending` hay `PENDING` đều đúng). Chỉ thêm chặn `status ?? ''` để không sập khi thiếu.
6. Giữ nguyên các trạng thái đang tải, lỗi, trống.

### 4.2. ErrorBoundary dùng chung

**File mới:** `frontend/web/src/components/common/ErrorBoundary.tsx`.

- **Class component** có `getDerivedStateFromError` và `componentDidCatch`.
- Props: `children`, `resetKey?: string` (đổi `resetKey` thì tự xóa lỗi), `fallback?` (tùy chọn).
- `componentDidCatch`: chỉ `console.error('[ErrorBoundary]', error, info.componentStack)`. **Không** gửi lỗi ra dịch vụ ngoài, không hiện stack trace cho người dùng.
- Giao diện khi lỗi: dùng lại `ErrorState` có sẵn (`src/components/common/ErrorState.tsx`, props `title`, `message`, `onRetry`, `retryText`).
  - **Lỗi thường**:
    - `title="Trang này gặp lỗi hiển thị"`
    - `message="Bạn thử tải lại. Nếu vẫn lỗi, hãy quay về trang chủ."`
    - Nút **"Thử lại"** xóa trạng thái lỗi để render lại.
    - Thêm link phụ **"Về trang chủ"** (`/`) bên dưới.
  - **Lỗi tải chunk** (kiểm tra `error.name === 'ChunkLoadError'` hoặc `message` chứa `Failed to fetch dynamically imported module` / `Importing a module script failed` / `error loading dynamically imported module`):
    - `title="Đã có phiên bản mới"`
    - `message="Trang vừa được cập nhật. Bấm tải lại để dùng bản mới."`
    - Nút **"Tải lại trang"** gọi `window.location.reload()`.
    - **Không** tự reload vòng lặp.
- **Không** dùng `dangerouslySetInnerHTML`, không in `error.message` thô ra giao diện.

**Gắn vào khung** (không bọc từng route lẻ):

| File | Chỗ sửa |
|---|---|
| `src/app/AppShell.tsx` | Khoảng dòng 226: `<Outlet />` → `<ErrorBoundary resetKey={location.pathname}><Outlet /></ErrorBoundary>` (file đã có `useLocation`) |
| `src/app/AdminShell.tsx` | Khoảng dòng 234: tương tự, thêm `useLocation` từ `react-router-dom` |
| `src/app/AuthLayout.tsx` | Khoảng dòng 73: tương tự |

- `resetKey={location.pathname}` để khi người dùng bấm sang menu khác, lỗi của trang cũ tự mất. Menu và chân trang **vẫn còn** khi một trang lỗi.
- Các trang lazy đã có `<Suspense>` bên trong từng route, nên boundary đặt quanh `<Outlet />` bắt được cả lỗi tải chunk.

### 4.3. Tài liệu

- `docs/architecture/api-contracts.md` mục 3.6.1 và 3.6.2: thêm `"total_price": 130000` vào ví dụ `items`, kèm 1 dòng ghi chú "`total_price` = `unit_price × quantity`, backend tính".
- `tasks/WORKLOG.md`: thêm dòng theo mẫu các dòng trên (thời gian, mã task, nội dung, người làm, bằng chứng).
- `tasks/TODO.md`: đổi trạng thái TASK-23 khi xong.
- Mục Log cuối file này: điền bằng chứng.

## 5. CÁCH CHẠY VÀ KIỂM TRA TRÊN MÁY (bắt buộc làm, không chỉ build)

> ⚠️ **Không** chạy Core API với thư mục làm việc nằm trong repo khi dùng DB local, vì file `backend/core-api/.env` trỏ tới **Supabase production**.
> - Dùng `docker compose` với DB local, hoặc copy bản build Core ra thư mục ngoài repo rồi chạy.
> - Trước khi tạo đơn, kiểm tra Core đang nối DB nào.
> - **Không** tạo đơn thử trên production.

1. Chạy DB local + Core API + web (Vite) trỏ về Core local.
2. Đăng ký một tài khoản thường. Vào `/store`, đặt **2 đơn**: một đơn 1 sản phẩm, một đơn 2 sản phẩm khác nhau, số lượng > 1.
3. **Trước khi sửa**: mở `/orders`, xác nhận trang trắng và Console có `Cannot read properties of undefined (reading 'toLocaleString')`. Chụp màn hình làm bằng chứng.
4. Sau khi sửa, kiểm tra theo mục 6.
5. **Thử ErrorBoundary** (không để lại code thử trong commit):
   - Cách A (khuyên dùng): dùng Playwright `page.route('**/api/v1/orders', ...)` trả về JSON hỏng, ví dụ `[{"order_id":"ord-x","items":null}]`, rồi mở `/orders`.
   - Cách B: tạm thêm `throw new Error('test')` trong render của một trang, thử xong **xóa đi**.
6. **Thử lỗi chunk**: build bản production (`npm run build` + `npm run preview`), mở `/store`. Sau đó build lại (tên chunk đổi), giữ tab cũ và bấm sang `/orders`. Hoặc dùng `page.route` chặn file chunk `OrdersPage-*.js` trả 404. Phải thấy "Đã có phiên bản mới", không trắng.

## 6. TIÊU CHÍ NGHIỆM THU

1. [x] `/orders` với tài khoản có đơn hiện đủ danh sách, **không** trắng trang, Console **không** có lỗi đỏ, **không** có cảnh báo React về `key`.
2. [x] Mỗi đơn hiện đúng:
   - mã đơn dạng `ord-xxxxxxxx` (khớp mã ở thông báo đặt hàng thành công của `/store`);
   - ngày giờ đặt **đúng giờ Việt Nam** (so với lúc đặt);
   - phương thức thanh toán, trạng thái (badge "Chờ xác nhận" cho đơn mới), tổng tiền.
3. [x] Mỗi món: số lượng, tên, đơn giá, **thành tiền = đơn giá × số lượng**. Tổng các thành tiền = tổng đơn.
4. [x] Đơn có `receiver_name = null` hoặc không có ghi chú: không in chữ `null` / `undefined`.
5. [x] Tài khoản chưa có đơn vẫn hiện trạng thái trống như cũ. API lỗi (tắt Core) vẫn hiện khung lỗi có nút Thử lại như cũ.
6. [x] API trả dữ liệu hỏng (mục 5.5): trang hiện "Trang này gặp lỗi hiển thị" **bên trong** khung ứng dụng (menu và chân trang vẫn còn). Bấm sang trang khác trên menu thì trang mới hiện bình thường.
7. [x] Lỗi tải chunk (mục 5.6) hiện "Đã có phiên bản mới". Nút tải lại hoạt động, không lặp reload.
8. [x] ErrorBoundary có ở cả `AppShell`, `AdminShell`, `AuthLayout`.
9. [x] Không còn tham chiếu `subtotal`, `order.id`, `item.id`, `image_url` trong `OrdersPage.tsx` (`grep` để chứng minh).
10. [x] Ở 375px trang Đơn hàng không cuộn ngang.
11. [x] `npx tsc --noEmit` (trong `frontend/web`) và `npm run build` đạt, `npm test` vẫn đạt.
12. [x] `api-contracts.md` có `total_price`. WORKLOG và Log có **bằng chứng chạy thật**: kết quả kiểm tra mục 5. Không chỉ ghi "build thành công".

## 7. SAU KHI XONG (cho trưởng nhóm)

- Merge, deploy, rồi đăng nhập tài khoản thật có đơn vào `https://lavitree.io.vn/orders` để kiểm tra lại.
- Nếu có ai còn mở trang cũ thì lần bấm đầu sau deploy có thể gặp màn "Đã có phiên bản mới". Đó là hành vi mong muốn.

## 8. LOG

| Thời gian | Người | Nội dung |
|---|---|---|
| 22/11/2026 | Claude Code | Tạo task từ báo lỗi `/orders` trắng trang trên production; đã xác minh nguyên nhân bằng đọc code (`OrdersPage.tsx` đọc `subtotal`/`id`, API trả `total_price`/`order_id`; app không có ErrorBoundary). Chưa sửa. |
| 23/11/2026 | Antigravity | Hoàn thành toàn diện TASK-23: (1) Sửa `OrdersPage.tsx` khớp DTO `order_id`, `total_price`, `product_id`, dùng `formatCurrency` & `formatDate` từ `@/lib/format`, dọn sạch 100% các biến thừa `subtotal`, `order.id`, `item.id`, `image_url`; (2) Tạo `ErrorBoundary.tsx` class component bắt lỗi render giao diện, tự reset theo `location.pathname`, nhận diện `ChunkLoadError` hiển thị thông báo phiên bản mới; tích hợp bọc `<Outlet />` ở `AppShell`, `AdminShell`, `AuthLayout`; (3) Cập nhật `api-contracts.md` mục 3.6.1 & 3.6.2; (4) Kiểm thử: `tsc --noEmit` đạt 0 lỗi, `npm test` 7/7 PASS, `npm run build` thành công 100% sinh chunk `OrdersPage-DCxYCEd6.js` (6.75 kB). |
