**A03 chưa đóng được.** Build sạch và cả ba bộ test đều qua, nhưng mình tìm ra 3 lỗi nghiêm trọng mà test không bắt được. Có cả việc cần kiểm tra ngay trên DB thật. Commit fix khẩn `7f09125` đã sửa đúng cả 3 lỗi lần trước.

## Mình đã kiểm tra những gì
- **Build:** `dotnet build` 0 lỗi, 0 cảnh báo; `tsc` và `npm run build` đều qua.
- **Test của TVA:** chạy trên môi trường riêng (DB nhúng, AI/Agent/S3 giả lập, không đụng Supabase). A03 đạt 21/21, A02 16/16. A01 chỉ hỏng test thời tiết vì môi trường giả lập không có khóa OpenWeather; A03 không sửa code thời tiết.
- **Phép thử tự viết:** gửi đồng thời, URL biến thể, dữ liệu lớn, gọi không token, Agent trả 503.

## 🔴 Nghiêm trọng
1. **Test A03 có thể đã ghi dữ liệu giả vào Supabase.** [test_task_a03_e2e.py](LAVITREE/backend/core-api/test_task_a03_e2e.py) đọc `.env` (đang trỏ Supabase) và không dọn gì sau khi chạy. Nếu TVA chạy với `.env` đó thì DB thật đang có:
   - 2–3 đoạn "nguyên văn" **tự viết nhưng ghi nguồn là Trung tâm Khuyến nông Quốc gia**, với URL giả `https://khuyennongvn.gov.vn/benh-suong-mai-ca-chua-xxxxxx`. Các đoạn này đã được duyệt, nên chatbot sẽ trích dẫn chúng như nguồn thật, kể cả đoạn nhắc Metalaxyl + Mancozeb.
   - Một kết luận chuyên gia giả có liều "Ridomil 50g/16L".
   - Tồn kho Ridomil bị đặt thành 99, thuốc id 5 bị đặt `is_allowed=false`, cùng các đơn hàng và tài khoản test.

   Mình không truy cập Supabase. Bạn kiểm tra bằng:
   ```sql
   SELECT "Id","SourceUrl","CreatedAt" FROM "KnowledgeSources" WHERE "SourceUrl" LIKE 'https://khuyennongvn.gov.vn/benh-suong-mai-ca-chua-%' OR "SourceUrl" = 'https://khuyennongvn.gov.vn/bai-1';
   SELECT "Id","ExpertNotes" FROM "DiagnosisRecords" WHERE "ExpertNotes" LIKE '%50g/16L%';
   ```
   Nếu có kết quả thì xóa các dòng đó (tri thức xóa qua Admin để kích hoạt reindex) và trả lại tồn kho cho Ridomil. Sau đó sửa test để mặc định từ chối chạy khi chuỗi kết nối là Supabase.

2. **Bán vượt tồn kho.** Mình đặt tồn kho bằng 3 rồi gửi đồng thời 10 đơn: **7 đơn được tạo** và tồn kho còn 2. [OrdersController.cs:81-88](LAVITREE/backend/core-api/src/Lavitree.Api/Controllers/OrdersController.cs#L81-L88) đọc tồn kho rồi mới trừ mà không khóa. Cách sửa: trừ bằng một lệnh SQL có điều kiện (`UPDATE ... SET StockQuantity = StockQuantity - @q WHERE Id=@id AND StockQuantity >= @q`, 0 dòng thì trả 400), hoặc dùng `xmin` làm concurrency token.

3. **BUG-51 được tick xong nhưng chưa làm.** Seed vẫn ghi "CHƯA ĐỐI CHIẾU" cho cả 4 thuốc, và cả 4 vẫn `is_allowed: true`, đang bán. Trong khi đó trang Store ghi **"100% Cấp phép lưu hành & Chuẩn PHI — Theo Thông tư 75/2025"**. Đây là thông tin sai cho nông dân. Chưa đối chiếu xong thì phải khóa bán và bỏ dòng chữ đó.

## 🟠 Cao
4. **Giới hạn 4 đoạn mỗi bài bị vượt dễ dàng.** Thêm `?utm=1`, đổi `http`, viết hoa domain hoặc thêm `#x` là lưu được 16 đoạn của cùng một bài. Gửi đồng thời 6 lần lưu cùng một phiên nhập thì tạo **12 dòng, có dòng trùng chữ**. Cách sửa: chuẩn hóa URL (scheme, host chữ thường, bỏ fragment và query theo dõi) rồi lưu vào một cột, kèm khóa theo URL hoặc unique index.
5. **Mã nội bộ viết cứng trong code.** `"Lavitree_Internal_Secret_2026_SecureKey"` xuất hiện 3 lần ([KnowledgeController.cs:791](LAVITREE/backend/core-api/src/Lavitree.Api/Controllers/KnowledgeController.cs#L791), 913, 951), vi phạm `AGENTS.md`. Thiếu env thì phải báo lỗi chứ không dùng giá trị mặc định.
6. **`GET /knowledge/sources` ai cũng xem được.** Không cần token vẫn trả 114 dòng, trong đó 78 bài chưa duyệt, kèm `reviewerNotes`. Lỗi này có từ trước, nhưng A03 dùng chính API này cho Admin. Nên tách ra: bản công khai chỉ trả bài đã duyệt, bản Admin mới trả đầy đủ.
7. **Luồng ca bệnh khó mới làm một nửa** (BUG-53 cũng bị tick xong):
   - Web chưa có chỗ nào gọi `request-expert`, nên nông dân không gửi được ca và tab của Admin luôn trống.
   - Nông dân không xem được câu trả lời của chuyên gia.
   - Ghi chú của nông dân và của chuyên gia nằm chung cột `ExpertNotes`, nên `expert-review` **ghi đè mất ghi chú của nông dân** (mình gửi chuỗi rỗng và ghi chú bị xóa thật).
   - Không giới hạn độ dài: ghi chú 300.000 ký tự vẫn được nhận.

## 🟡 Trung bình
8. **Timeout của web vẫn 30 giây**, ngắn hơn 35 giây Core chờ Agent, mình đã nhắc lần trước. Lệnh gọi `POST /knowledge/ingestions` ([AdminDashboard.tsx:177](LAVITREE/frontend/web/src/pages/AdminDashboard.tsx#L177)) cần đặt `timeout: 45000`.
9. **Đoạn dài hơn 2000 ký tự làm mất toàn bộ gợi ý AI.** Core gửi nguyên đoạn cho Agent (mình bắt được một đoạn 2959 ký tự). Agent thật sẽ trả 422 nên cả bài mất gợi ý. Cách sửa: chỉ gửi những đoạn ≤ 800 ký tự (cũng là những đoạn được phép chọn).
10. **AI tự tick sẵn các đoạn nó gợi ý.** Vì "tick = duyệt", Admin có thể bấm Lưu mà không đọc. Nên để mặc định không tick.
11. **Mất tên người nhận và ghi chú.** Form gửi `receiver_name` và `notes` nhưng backend không có trường nào lưu, nên đơn hàng không có tên người nhận.
12. **Tài liệu chưa cập nhật:**
    - `database-schema.md` thiếu 5 cột mới của `DiagnosisRecords`.
    - `api-contracts.md` thiếu `PATCH /medicines/{id}`, `GET /orders`, `GET /orders/{id}`, `escalations`, `expert-review`, `reindex-status`.
13. **Một số mục bị tick xong mà không có bằng chứng:**
    - Chặng 3 "Bỏ duyệt → chat không còn trích đoạn đó": không có test nào kiểm tra.
    - BUG-56 "dọn sạch dữ liệu test": sai, xem mục 1.
    - Thông báo hiện "Reindex: accepted" thô; nên ghi "đang đồng bộ".

## ⚪ Thấp
- `GET /orders/{id}` nhận mã ngắn bằng cách tải **toàn bộ bảng Orders** lên RAM mỗi lần gọi, và `ord-` rỗng cũng khớp một đơn bất kỳ. Nên dùng mã đầy đủ.
- Trang lịch sử vẫn suy nhóm dễ nhầm từ `class_code`, bỏ qua cột `ConfusionGroup` vừa lưu.
- Danh sách `items` và `source_ids` không giới hạn số phần tử.
- Gọi `escalations` không có token trả 403 thay vì 401.
- Store báo lỗi bằng `alert()`; giỏ hàng trong `localStorage` dùng chung cho mọi tài khoản trên cùng máy.
- MinIO tự dùng mật khẩu `minioadmin` khi thiếu secret.
- Commit `7f09125` cho `appsettings.json` được ưu tiên hơn biến môi trường. Trong Docker thì không sao vì compose đặt dạng `Minio__*`, nhưng chạy local thì `AGENT_SERVICE_URL` và `MINIO_*` bị bỏ qua.

## Những phần đã làm đúng
- Giá tính từ DB; chặn thuốc cấm; nông dân bị 403 ở mọi API của Admin.
- Chữ của đoạn được lấy từ bản lưu tạm, không nhận từ client; phiên hết hạn trả 410.
- Agent trả 503 thì vẫn hiện danh sách đoạn với `ai_suggestion_available:false`.
- Reindex: 202 được hiểu là `accepted`, có gửi `X-Internal-Key`, timeout 5 giây và 35 giây tách riêng.
- Xóa ảnh mồ côi khi ghi DB lỗi (BUG-57); lưu Top-3 vào `Top3Json`; sửa parser ở trang Thu thập tri thức.

## Nên làm theo thứ tự
1. Kiểm tra Supabase theo mục 1 và dọn dữ liệu giả nếu có.
2. Sửa mục 2–7.
3. Mở lại BUG-51 và BUG-53 trong `task-a03`; sửa trạng thái A03 trong `TODO.md`.
4. Sửa nhóm trung bình rồi chạy lại toàn bộ test.

Bạn muốn mình ghi các lỗi này vào mục 5 của `task-a03` (dạng BUG-59 trở đi), sửa luôn mục 2, 4, 5, 8, 9 hay sửa test để không chạy được trên Supabase? Mình sẽ không commit khi bạn chưa xác nhận.

Môi trường thử nghiệm đã tắt, worktree tạm đã xóa, thư mục làm việc của bạn không bị thay đổi.