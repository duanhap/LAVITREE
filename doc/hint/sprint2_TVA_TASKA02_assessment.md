**TASK-A02 chưa đạt DONE, và có một việc phải làm ngay: mật khẩu admin mới đang lộ công khai trên GitHub.** Giao diện và luồng chính đã tốt lên nhiều, nhưng một số BUG được tick dù chưa sửa xong, và 2 BUG đã biến mất khỏi danh sách.

Máy này vẫn không có `dotnet` và Docker, nên mình chưa chạy backend hay 13/14 test; phần stdout trong task chỉ đọc lại chứ chưa đối chứng. Mình đã build frontend thành công, chạy `npm audit`, thử các chuỗi `next` độc hại và quét secret. Mình chưa sửa code hay file task nào, chỉ tạo lại `dist`.

## 🚨 Làm ngay: mật khẩu admin đang công khai
Commit `629f79d` đã vào `main`, và repo public. Mình kiểm tra trực tiếp trên GitHub thì mật khẩu admin hiện tại, trùng với cả hai file `.env`, xuất hiện ở:
- [WORKLOG.md](LAVITREE/tasks/WORKLOG.md)
- [task-a01-auth-jwt.md](LAVITREE/tasks/sprint-02/task-a01-auth-jwt.md)
- [task-a02-web-diagnose-handbook.md](LAVITREE/tasks/sprint-02/task-a02-web-diagnose-handbook.md)
- [2026-11-07.md](LAVITREE/doc/process/2026-11-07.md)

Mình không thử đăng nhập, nhưng nên coi tài khoản admin đã bị lộ. Việc cần làm theo thứ tự:
1. Tạo mật khẩu mới, chỉ lưu trong `.env`, rồi khởi động lại API để seeder cập nhật hash.
2. Đổi luôn `JWT_SECRET_KEY`, vì token đã phát hành vẫn sống 7 ngày và đổi mật khẩu không thu hồi được.
3. Xóa mật khẩu khỏi 4 file trên. Commit `9ae9e78` chưa push nhưng cũng chứa mật khẩu này, nên hãy xóa trước khi push.

## BUG bị mất hoặc bị viết lại
- **BUG-23 và BUG-24 biến mất khỏi danh sách nhưng chưa được sửa:** ảnh vẫn giữ EXIF/GPS trong bucket công khai, vẫn có ảnh mồ côi khi không tìm thấy bệnh, và chưa có quota.
- **BUG-22 và BUG-26 bị bỏ bớt nội dung:** phần giới hạn 72 byte, ký tự xuống dòng trong email và lỗ hổng `vite` đã bị bỏ khỏi mô tả rồi tick xong.

## BUG đã tick nhưng chưa xong

| BUG | Thực tế |
|---|---|
| **07** | Chỉ đổi câu chữ. "Xác suất mưa" vẫn bằng độ phủ mây × 0,9, nên trời nhiều mây có thể ra `HIGH` và `is_rain=true`, như dòng 89% trong stdout. Sai dữ liệu này ảnh hưởng trực tiếp đến lời khuyên phun thuốc. |
| **05, 06** | API lỗi ở production vẫn trả thời tiết giả thay vì 503, và `GetHashCode()` vẫn đổi sau mỗi lần khởi động. Agent chưa đọc `is_simulated`. |
| **03** | Seeder vẫn nối lại liên kết thuốc–bệnh mà Admin đã gỡ. Thuốc bị tắt thì liên kết bị xóa hẳn khi khởi động. |
| **10** | `provenance_source` không vào DB hay API. Mình không tìm thấy Thông tư 03/2017; danh mục gốc là [Thông tư 03/2016](https://www.vietnamtradeportal.gov.vn/kcfinder/upload/files/03.2016.TT-BNNPTNT.pdf), được sửa bởi [06/2017](https://thuvienphapluat.vn/van-ban/Tai-nguyen-Moi-truong/Thong-tu-06-2017-TT-BNNPTNT-sua-doi-03-2016-TT-BNNPTNT-thuoc-bao-ve-thuc-vat-duoc-su-dung-334159.aspx) và [15/2017](https://thuvienphapluat.vn/van-ban/Xuat-nhap-khau/Circular-15-2017-TT-BNNPTNT-amendment-03-2016-TTBNNPTNT-banned-plant-protection-substances-361731.aspx). Trích dẫn chung cũng chưa chứng minh được PHI và liều dùng. Riêng [QĐ 278](https://thuvienphapluat.vn/van-ban/Linh-vuc-khac/Quyet-dinh-278-QD-BNN-BVTV-loai-bo-thuoc-bao-ve-thuc-vat-chua-hoat-chat-2-4-d-paraquat-2017-340421.aspx) về Paraquat là có thật. |
| **11** | Vẫn chưa có test token ký sai khóa, `alg=none`, token hết hạn, hash trong DB và 429. Test không khẳng định `is_simulated=false`, chỉ in ra. Test vẫn chạy trên DB thật và không dọn dữ liệu. |
| **16** | Vẫn còn lỗ hổng open redirect, xem mục 1 bên dưới. |
| **25** | "Nguồn đã xác thực" vẫn tính cả nguồn được xếp hạng tự động theo chuỗi URL như `.edu`, chưa phải người duyệt. Chưa thấy ghi nhận đã thống nhất với B. |
| **26** | `npm audit` vẫn còn `vite` mức high, `esbuild` và `react-router` mức moderate. Riêng `follow-redirects` đã hết, còn `vite` giờ chỉ là công cụ dev. |
| **27** | "Giảm xuống 297 KB" chỉ tính một file. Tải ban đầu thực tế là 520,8 KB (gzip 162 KB), so với 546 KB (gzip 169,5 KB), chỉ giảm 4,6%. |

Ngoài ra, các tick "Đã chạy (Pass)" của phần giao diện chưa có bằng chứng, vì chưa có test frontend hay test trên trình duyệt.

## Lỗi mới
1. **Open redirect và trang trắng:** [RequireRole.tsx:21](LAVITREE/frontend/web/src/app/RequireRole.tsx#L21) cho qua `/%09/evil.com`, chuỗi này được phân giải thành `https://evil.com/`. Mình đã thử phần lọc và phân giải URL, chưa thử toàn bộ luồng trên trình duyệt. Còn `?next=%25` làm `decodeURIComponent` ném lỗi ngay khi render trang Login.
2. **Ảnh so sánh Grad-CAM bị lệch khi vừa hiện:** ở [ImageCompare.tsx:109](LAVITREE/frontend/web/src/features/diagnose/components/ImageCompare.tsx#L109), lần render đầu `ref` còn `null`, nên ảnh gốc co theo vị trí thanh trượt và lệch với heatmap đến khi người dùng tương tác. Nên dùng `clip-path` và thêm `touch-none` cho điện thoại.
3. **Chi tiết lịch sử sai trạng thái:** [DiagnoseController.cs:531](LAVITREE/backend/core-api/src/Lavitree.Api/Controllers/DiagnoseController.cs#L531) đặt `confusion_group = null`, nên ca "Dễ nhầm" lại hiện "Kết quả tham khảo". Top-3 cũng chỉ còn 1 dòng, và `notes` bị gán vào `warning`.
4. **Email trong JWT có thể thành mảng:** [JwtTokenService.cs](LAVITREE/backend/core-api/src/Lavitree.Infrastructure/Services/JwtTokenService.cs) thêm hai claim cùng ra tên `email`. Khi đó menu sẽ hiện email bị lặp, và `user.email.split` có thể lỗi. Điều này suy từ cách thư viện hoạt động, nên cần giải mã một token thật để xác nhận.
5. **Seeder đặt lại mật khẩu admin mỗi lần khởi động:** đổi mật khẩu trên giao diện sau này sẽ bị ghi đè. Thiếu biến môi trường thì API không khởi động được, kể cả khi admin đã tồn tại.
6. **Regex số điện thoại sai:** `0[3|5|7|8|9]` chấp nhận cả `0|12345678`; mình đã chạy thử.
7. **Token hết hạn khi đang khám lá:** API coi đây là khách nên không lưu, không trả 401. Giao diện vẫn như đã đăng nhập và không báo gì.
8. **Upload dễ hết thời gian chờ:** timeout 30 giây áp dụng cho cả ảnh 10 MB trên mạng yếu. Nén ảnh ở trình duyệt sẽ giải quyết việc này và cũng loại được EXIF.
9. **Lỗi nhỏ về hiển thị và quy ước:**
   - Lỗi mạng ở Lịch sử lại hiện "Chưa có hồ sơ"; `/placeholder.png` không tồn tại.
   - Ca 🔴 thiếu nút "Chụp lại" và "Nhờ chuyên gia thẩm định".
   - Giao diện ghi "38 bệnh" dù 38 lớp gồm cả lá khỏe, còn API trả 40 mục.
   - Form chưa dùng `react-hook-form` + `zod` theo `AGENTS.md`.
10. **Contract còn thiếu:** chưa có `/diseases/by-class`, `/history/{id}`, `is_fallback`. Vẫn ghi `phone_number` và Guest "gán null".

## Những phần đã làm tốt
- **Bảo mật dữ liệu:** `/history/{id}` trả 404 cho user khác; thuốc cấm được lọc trong chẩn đoán, sổ tay và lịch sử; khách không còn lưu ảnh.
- **Auth:** có `AuthContext`, giải mã UTF-8 đúng, phân biệt lỗi `23505`, rate limit đặt đúng chỗ, và đã có migration.
- **Giao diện:** OOD không lộ tên bệnh, thuốc hay ảnh; không có mã hex trong code mới; `/dev/styleguide` không lọt vào bản build.
- **Tài liệu:** schema DB đã được cập nhật.

## Thứ tự sửa đề xuất
1. Đổi mật khẩu và khóa JWT, xóa mật khẩu khỏi tài liệu, rồi mới push.
2. Sửa thời tiết (BUG-05, 06, 07) và seeder, vì ảnh hưởng đến lời khuyên về thuốc.
3. Sửa open redirect, ảnh Grad-CAM, trạng thái ở chi tiết lịch sử và claim email.
4. Khôi phục BUG-23, BUG-24, bổ sung test còn thiếu, rồi mới tính A02 là DONE.

Bạn có muốn mình ghi toàn bộ phần này vào `task-a03`, đồng thời mở lại các BUG tick sai trong A02 và thay mật khẩu trong tài liệu bằng ghi chú an toàn không? Mình sẽ không commit.

Nguồn đã dùng: [Thông tư 03/2016](https://www.vietnamtradeportal.gov.vn/kcfinder/upload/files/03.2016.TT-BNNPTNT.pdf), [Thông tư 06/2017](https://thuvienphapluat.vn/van-ban/Tai-nguyen-Moi-truong/Thong-tu-06-2017-TT-BNNPTNT-sua-doi-03-2016-TT-BNNPTNT-thuoc-bao-ve-thuc-vat-duoc-su-dung-334159.aspx), [Thông tư 15/2017](https://thuvienphapluat.vn/van-ban/Xuat-nhap-khau/Circular-15-2017-TT-BNNPTNT-amendment-03-2016-TTBNNPTNT-banned-plant-protection-substances-361731.aspx), [Quyết định 278](https://thuvienphapluat.vn/van-ban/Linh-vuc-khac/Quyet-dinh-278-QD-BNN-BVTV-loai-bo-thuoc-bao-ve-thuc-vat-chua-hoat-chat-2-4-d-paraquat-2017-340421.aspx).