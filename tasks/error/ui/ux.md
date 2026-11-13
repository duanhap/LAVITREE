[x] 1. chức năng đăng nhập đăng ký phần mật khẩu không nó nút ẩn hiện để user xem được
[/] 2. Chức năng tài khoản : nếu chưa đăng nhập thì hiện đăng nhập đăng ký là đúng, đăng nhập rồi thì mới hiện có lịch sử không co nhiều chức năng khác như đổi thông tin v.v.v. (bonus các chức năng khác)
[x] 3. không có chức năng cắt ảnh, rõ ràng là đã thống nhất ai ko chính xác nếu có background rồi
[x] 4. Nút X của giao diện giỏ hàng quá nhỏ.

## Đã sửa (web, 10/11/2026)
- 1: `PasswordInput` có nút con mắt ẩn/hiện, dùng ở Đăng nhập (mật khẩu) và Đăng ký (mật khẩu + xác nhận).
- 2: Thêm trang `/account`. Khách thấy lời mời Đăng nhập/Đăng ký, không bị chuyển sang login. Người đã đăng nhập thấy hồ sơ (`GET /auth/me`) và lối tắt Lịch sử, Đơn hàng, Trợ lý, Cửa hàng, Admin, cùng nút Đăng xuất. **Còn thiếu:** đổi thông tin và đổi mật khẩu, vì Core chưa có API.
- 3: Thêm bước cắt ảnh bắt buộc trước khi khám (`LeafCropper`). Khung khóa tỉ lệ 1:1 vì AI-service resize thẳng về 224x224. Có nút Cắt lại và Đổi ảnh khác.
- 4: Nút X của Sheet/Dialog có vùng bấm 44px, icon 20px. Trong giỏ hàng, nút +/- là 36px và nút xóa là 40px.

---

## Đợt 2: tự trải nghiệm web (12/11/2026)

Nguồn: (a) Claude chạy hệ thống trên máy với Postgres local, đi trọn luồng Admin nạp bài → lưu → gợi ý vật tư → hỏi Lavi; xem trang người dùng trên production với tư cách khách. (b) Một agent khác test trang Admin trên production (code cũ, dừng trước bước Lưu).
Ký hiệu: `[x]` đã sửa trên nhánh, chưa push; `[ ]` còn lại; `[!]` cần sửa dữ liệu trên Supabase, phải được duyệt trước.

### A. Admin nạp tri thức (`/admin/ingest`)
[x] 5. Bài mới dính tiêu đề, cơ quan, năm và cả bệnh do AI đoán của bài trước. Dán bài hoặc đổi URL giờ xóa sạch kết quả cũ; metadata luôn để AI đọc lại.
[x] 6. Năm xuất bản luôn là "2024": form điền sẵn và ví dụ trong prompt AI ghi "2024". Bỏ cả hai; Agent chỉ nhận năm có thật trong bài, không thấy thì để trống.
[x] 7. Mục 3 ghi "Tùy chọn, để AI đoán" nhưng chọn sẵn "Cà chua – Mốc sương", khi tải trang lại tự nhảy sang "Táo". Giờ để trống; đổi cây không tự chọn bệnh đầu danh sách.
[x] 8. Gemini báo 503 (quá tải) khoảng một nửa số lần, mọi đoạn bị dồn vào ô "AI đánh giá là rác". Agent tự thử lại tối đa 3 lần; nếu vẫn lỗi thì hiện mọi đoạn để Admin tự gắn nhãn, kèm thông báo đúng lý do. Ô thu gọn đổi tên thành "Đoạn AI không chọn (vẫn tick để lưu được)".
[x] 9. Đoạn trích bị vỡ dấu ("nấm" thành "ná m"): phông Georgia (`font-serif`) thiếu chữ tiếng Việt có 2 dấu. Đã bỏ `font-serif`.
[x] 10. Bộ lọc khi dán bài làm mất tiêu đề bài, ngày đăng, tiêu đề mục ("Biện pháp hóa học:") nhưng lại để lọt hotline và footer lặp. Đã giữ tiêu đề, ngày và tiêu đề mục, bỏ hotline có số điện thoại và dòng trùng. Core ghép tiêu đề mục ngắn vào đoạn ngay sau, giữ dòng ngắn ở đầu bài cho AI đọc metadata.
[x] 11. Nút Lưu tắt im lặng khi vượt hạn mức. Giờ có dòng giải thích "vượt giới hạn trích dẫn … (30% bài, tối thiểu 1.200)" và nhắc chọn cây/bệnh. Mẫu số 1.200 là đúng luật (tối thiểu 1.200 ký tự), không phải lỗi.
[x] 12. AI trích tên nấm gây bệnh (Phytophthora infestans) thành "Sinh học". Prompt đã cấm đưa tác nhân gây bệnh vào mentions.
[x] 13. Thẻ vật tư/biện pháp AI trích ra chỉ xem được: đã cho phép thêm mới (phải có trong đoạn trích), xóa thẻ và đổi loại (Hóa học / Sinh học / Vật tư / Canh tác) trực tiếp trước khi lưu.
[x] 14. Đoạn dài hơn 800 ký tự bị khóa: đã thêm nút và dialog "Tách đoạn" tự động ngắt theo dấu câu gần điểm giữa (hoặc sửa thủ công), mỗi đoạn con <= 800 ký tự được tick chọn và gán nhãn độc lập.
[x] 15. "Trạng thái Reindex" hiện JSON thô: đã thiết kế lại Dialog với thẻ trạng thái trực quan, 3 chỉ số (số đoạn đã vector hóa, lần thành công gần nhất, hàng đợi), và nút làm mới trạng thái.

### B. Gợi ý vật tư (`/admin/inventory`, tab Gợi ý)
[x] 16. Tên thương mại (Ridomil Gold 68WG, Antracol 70WP) không khớp với sản phẩm đã có, Admin dễ bấm "Tạo SP" ra sản phẩm trùng. Core giờ khớp cả theo tên sản phẩm (không khớp với sản phẩm chứa hoạt chất cấm).
[x] 17. Gắn được thuốc cấm vào bệnh và gắn lại gợi ý đã xử lý. Core trả 400 và 409; danh sách chọn ở web cũng ẩn thuốc cấm. (Nông dân chưa bị ảnh hưởng vì trang khám đã lọc `IsAllowed`.)
[x] 18. Biện pháp canh tác (PRACTICE) vẫn có nút "Gắn SP"; modal "Tạo SP" ghi "đã điền sẵn từ bài báo" dù không còn điền giá/PHI. Đã ẩn nút và sửa câu.
[x] 19. Cột "Đoạn trích bằng chứng" quá hẹp: đã mở rộng (`min-w-[280px] max-w-lg`, line-clamp-3) để Admin đọc trọn vẹn ngữ cảnh đoạn trích.
[x] 20. Bộ lọc còn chữ tiếng Anh: đã Việt hóa toàn bộ bộ lọc trạng thái ("Chờ xử lý", "Đã gắn SP có sẵn", "Đã tạo SP mới", "Đã bỏ qua") và phân loại ("Thuốc BVTV hóa học", "Chế phẩm sinh học BVTV", "Vật tư canh tác", "Biện pháp canh tác").
[x] 21. Modal "Thêm thuốc" và "Sửa thông số" không thống nhất: đã đồng bộ 100%:
  - Chọn NOT_SOLD ẩn giá/tồn kho ở cả 2 modal (mặc định 0 kèm thông báo rõ ràng).
  - Modal Sửa bổ sung đầy đủ các ô: Tên sản phẩm, Hoạt chất chính, Hướng dẫn sử dụng/Liều lượng, Link nguồn tra cứu, Checkbox lưu hành (Core Backend hỗ trợ cập nhật trong `PATCH /api/v1/medicines/{id}`).
  - Thống nhất tên 3 loại sản phẩm giữa 2 modal; ẩn mã enum kỹ thuật `IN_STOCK`, `OUT_OF_STOCK`, `NOT_SOLD`.
  - Chọn "Vật tư canh tác" tự đổi hướng dẫn liều dùng sang hướng dẫn canh tác thay vì "pha theo bao bì", và điều chỉnh nhãn checkbox lưu hành sang tư vấn canh tác.

### C. Duyệt tri thức (`/admin/knowledge`) và Ảnh (`/admin/images`)
[x] 22. Modal "Thêm ảnh triệu chứng" ở trang Ảnh dính URL và cơ quan của bài đang nhập. Giờ chỉ nút "Thêm ảnh từ bài này" mới điền sẵn.
[x] 23. Một bài bị tách thành nhiều dòng khi các đoạn gắn khác bệnh; không sửa được nội dung/tiêu đề/nhãn sau khi lưu; không có "Xóa cả bài"; không phân trang; nhãn lọc còn chữ dev (`IsManualApproved = true`).
  - Đã gộp bài viết strictly theo URL nguồn (1 bài = 1 dòng), hiển thị badge `+N bệnh khác` khi các đoạn thuộc nhiều lớp bệnh.
  - Thêm nút "Xóa cả bài" và "Xóa hàng loạt" trên toolbar, kết nối API `POST /api/v1/knowledge/sources/batch-delete` soft-delete và kích hoạt reindex một lần.
  - Thêm nút "Sửa bài" dẫn sang `/admin/ingest?edit=...` để chỉnh sửa và nạp lại.
  - Bổ sung phân trang Curation (10, 20, 50 mục/trang) cho cả chế độ gộp bài và chế độ phẳng.
  - Đổi nhãn lọc sang tiếng Việt thân thiện: "Tất cả trạng thái duyệt", "Đã duyệt (sẵn sàng cho Lavi)", "Chờ duyệt".
[x] 24. Trang Ảnh: lọc bệnh không theo cây; nhãn bộ phận lộ enum `LEAF`, `FRUIT`; thiếu xem trước ảnh HTTPS và hướng dẫn dung lượng/định dạng.
  - Lọc bệnh hại giới hạn chính xác theo loài cây trồng đã chọn (và tự reset về "Tất cả bệnh hại" khi đổi cây).
  - Việt hóa hoàn toàn nhãn bộ phận cây trồng: "Lá cây", "Quả / Hoa", "Thân / Cành", "Toàn cây".
  - Bổ sung khung xem trước trực tiếp ảnh từ link HTTPS với fallback xử lý link lỗi.
  - Thêm hướng dẫn định dạng/dung lượng rõ ràng: "Định dạng hỗ trợ: JPG, PNG, WebP (tối đa 5MB). Ưu tiên ảnh chụp rõ triệu chứng thực địa trên đồng ruộng."

### D. Trang người dùng (production, xem với tư cách khách)
[ ] 25. Lavi tự giả định "còn 0 ngày thu hoạch" khi người dùng không nói, rồi bật cảnh báo đỏ "VI PHẠM PHI" cho câu hỏi chỉ hỏi bệnh gì. Chặn thuốc khi chưa rõ ngày thu hoạch vẫn đúng, nhưng phải hỏi lại người dùng thay vì nói "0 ngày".
[ ] 26. Lavi mất khoảng 28 giây mới trả lời, khung chat trống suốt thời gian đó (không thấy chữ chạy dần).
[ ] 27. Sổ tay: tìm "sương mai" ra 0 kết quả (chỉ có tên "mốc sương"), gõ không dấu cũng không ra. Cần thêm tên gọi khác và tìm không dấu.
[ ] 28. Sổ tay: 14 mục "Cây khỏe mạnh" lẫn trong danh sách bệnh, có mức độ "Nghiêm trọng"; nút "Xem phác đồ" mở ra không có phác đồ.
[ ] 29. Cửa hàng trên điện thoại bị tràn ngang, nút lọc "Vật tư canh tác" bị cắt.

### E. Dữ liệu trên Supabase (cần duyệt trước khi sửa)
[!] 30. Ô "Triệu chứng" của cả 40 bệnh là mẹo chụp ảnh; ô "Phòng ngừa" của cả 40 bệnh là cùng một câu chung chung.
[!] 31. Bệnh vàng lá gân xanh (Greening) ghi tác nhân "Nấm", đúng là vi khuẩn.
[!] 32. Trichoderma Bacillus đang là "Hóa học, PHI 7 ngày" (dữ liệu gốc là "Sinh học, 0 ngày"), nên lọc "Sinh học" ra trống và Lavi chặn nhầm chế phẩm này.
[!] 33. Còn dữ liệu test và rác trong kho tri thức: bài "heloo" / "búp chu", bài `extension.usu.edu` lưu nguyên chuỗi mẫu của prompt AI ("<Tiêu đề bài viết…>").

### Kiểm thử đợt 2 (local)
- Agent: `test_rag_accuracy -k test_08` qua (thêm test năm bịa, chuỗi mẫu, tự thử lại khi 503); `test_react_guardrails` 26/26.
- Core `dotnet build` sạch. Web `tsc` sạch, `npm run build` thành công.
- Chạy tay bằng trình duyệt trên Postgres local: dán HTML thật (tiêu đề ngoài `<article>`, hotline, footer lặp), dán bài thứ 2 không dính dữ liệu bài 1, năm lấy đúng từ bài (2015, 2022), AI tắt vẫn tự chọn đoạn được, gắn thuốc cấm bị chặn (400), gắn lại bị chặn (409), Lavi trích được bài vừa nạp.
