[x] 1. chức năng đăng nhập đăng ký phần mật khẩu không nó nút ẩn hiện để user xem được
[/] 2. Chức năng tài khoản : nếu chưa đăng nhập thì hiện đăng nhập đăng ký là đúng, đăng nhập rồi thì mới hiện có lịch sử không co nhiều chức năng khác như đổi thông tin v.v.v. (bonus các chức năng khác)
[x] 3. không có chức năng cắt ảnh, rõ ràng là đã thống nhất ai ko chính xác nếu có background rồi
[x] 4. Nút X của giao diện giỏ hàng quá nhỏ.

## Đã sửa (web, 10/11/2026)
- 1: `PasswordInput` có nút con mắt ẩn/hiện, dùng ở Đăng nhập (mật khẩu) và Đăng ký (mật khẩu + xác nhận).
- 2: Thêm trang `/account`. Khách thấy lời mời Đăng nhập/Đăng ký, không bị chuyển sang login. Người đã đăng nhập thấy hồ sơ (`GET /auth/me`) và lối tắt Lịch sử, Đơn hàng, Trợ lý, Cửa hàng, Admin, cùng nút Đăng xuất. **Còn thiếu:** đổi thông tin và đổi mật khẩu, vì Core chưa có API.
- 3: Thêm bước cắt ảnh bắt buộc trước khi khám (`LeafCropper`). Khung khóa tỉ lệ 1:1 vì AI-service resize thẳng về 224x224. Có nút Cắt lại và Đổi ảnh khác.
- 4: Nút X của Sheet/Dialog có vùng bấm 44px, icon 20px. Trong giỏ hàng, nút +/- là 36px và nút xóa là 40px.
