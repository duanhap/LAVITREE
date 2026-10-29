## Tóm tắt
| | TASK-02 (B) | TASK-04 (A) |
|---|---|---|
| Kết luận | ✅ **Đạt.** Đã sửa hết các lỗi mình nêu ở TASK-01 | ⚠️ **Chức năng đạt, nhưng có 2 lỗi bảo mật nghiêm trọng** |
| Mình đã kiểm chứng | Chạy `test_task02_gradcam.py` và `test_predict.py`: pass; có heatmap 136ms, tắt heatmap 41ms | Đọc code và quét secret. **Chưa chạy E2E**, vì test cần Core API, MinIO và Supabase cùng chạy |

---

## 🚨 Việc cần làm ngay hôm nay
1. **Admin key thật đã bị commit lên GitHub.** File [test_task04_e2e.py:7](LAVITREE/backend/core-api/test_task04_e2e.py#L7) ghi cứng `ADMIN_KEY = "..."`, và mình đã so sánh: giá trị này **trùng hoàn toàn** với `ADMIN_SECRET_KEY` trong `.env` (commit `408babd`). Nếu repo `duanhap/LAVITREE` để public thì ai cũng xóa được kho tri thức.
   - Đổi key mới trong `.env` (cả trên EC2 lẫn GitHub Secret `ENV_PRODUCTION`).
   - Sửa test để đọc key từ biến môi trường, không ghi cứng.
   - Key cũ coi như đã lộ vĩnh viễn, vì vẫn nằm trong lịch sử git.
2. **PostgreSQL mở ra Internet với mật khẩu yếu đã commit.** Trong `docker-compose.yml`, `postgres` đang map `"5432:5432"` (mở cho mọi IP) với `POSTGRES_PASSWORD: postgrespassword123` ghi thẳng trong file. Workflow `deploy.yml` lại tự deploy lên EC2. Nếu Security Group của EC2 mở cổng 5432, ai cũng vào được DB.
   - Đổi thành `127.0.0.1:5432:5432`, hoặc bỏ hẳn `ports` vì core-api gọi postgres qua mạng nội bộ Docker.
   - Đưa mật khẩu vào `.env`.

Bạn kiểm tra giúp mình repo đang public hay private, vì mình không xem được.

---

## Thành viên B: TASK-02 ✅
**Đã sửa đúng các lỗi lần trước:**
- **Single-pass**: chỉ chạy model 1 lần để vừa dự đoán vừa tính Grad-CAM.
- **Thread-safe**: endpoint đổi thành `def` (không còn chặn event loop), có thêm `threading.Lock` bọc phần model và GradCAM.
- **OOD chạy thật**: ngưỡng −2,5 đọc qua `.env`, có `python-dotenv`, docker-compose có `env_file`. Test OOD giờ chạy thật, không còn mock.
- **`mock_ood`** chỉ bật được khi `ALLOW_MOCK_OOD=true` hoặc khi chạy trong pytest.
- Đã sửa câu "dễ nhầm" bị lặp, và có test chặn lặp lại.
- Cổng 8000, 8001, 9001 đã bind `127.0.0.1`.

**🟡 Lưu ý**
- **Ngưỡng −2,5 mới chỉ dựa trên 2 ảnh** (−0,55 và −4,40 là đúng 2 con số mình đo hôm trước). Ticket yêu cầu khoảng 20 ảnh lá và 10 ảnh vật thể. Rủi ro là ảnh lá chụp ngoài vườn bị chặn nhầm ngay lúc demo. Chỉ mất khoảng 15 phút: dùng điện thoại chụp khoảng 20 lá thật rồi chạy thử.
- Code giờ tự đặt −2,5 khi thiếu biến môi trường, trong khi ticket ghi "không đặt ngưỡng cứng trong code". Xét thực tế thì chấp nhận được, nhưng nên ghi quyết định này vào ticket.

---

## Thành viên A: TASK-04 ⚠️
**✅ Làm tốt**
- Map snake_case đầy đủ bằng `JsonPropertyName`, nên `is_ood` được đọc đúng.
- Nhánh OOD **không upload MinIO và không ghi DB**, đúng chính sách bảo vệ riêng tư.
- Admin key: thiếu key thì từ chối tất cả (fail-closed), so sánh bằng `FixedTimeEquals`, đã gắn vào đủ 3 endpoint.
- MinIO: tên file theo GUID, policy chỉ cho `GetObject`. CORS chỉ cho phép domain frontend. Mật khẩu MinIO đã chuyển vào `.env`.

**🔴 Rate limit đang là giới hạn chung, không phải theo IP**
[Program.cs](LAVITREE/backend/core-api/src/Lavitree.Api/Program.cs) dùng `AddFixedWindowLimiter`, tức là **một hạn mức 60 request/phút cho toàn bộ người dùng cộng lại**. Một kẻ xấu chỉ cần gửi 60 request là mọi nông dân khác nhận lỗi 429 trong phút đó. Cơ chế chống DDoS lại thành công cụ để DDoS.
- Cách sửa: dùng `PartitionedRateLimiter` phân vùng theo `RemoteIpAddress`.
- Nếu chạy sau nginx thì bật thêm `ForwardedHeaders` để lấy đúng IP thật của người dùng.

**🟠 Cần sửa**
- **Content-Type ảnh gốc lấy từ client.** Code dùng `image.ContentType` khi upload MinIO. Kẻ xấu gửi file `.jpg` nhưng khai `text/html`, MinIO sẽ phục vụ file đó như trang HTML, có thể dẫn tới XSS (chạy script độc trên trình duyệt người xem). Nên tự suy ra Content-Type từ đuôi file.
- **Policy bucket chỉ được đặt khi bucket mới tạo.** Nếu bucket đã có sẵn (ví dụ tạo tay qua console), policy không được áp, và ảnh có thể 403 hoặc bị mở sai quyền. Nên đặt policy mỗi lần khởi động.
- **Upload MinIO lỗi vẫn lưu DB với URL giả** `/uploads/{image.FileName}`, trong đó tên file do người dùng tự đặt. Kết quả là DB chứa link chết. Nên trả lỗi hoặc để URL là `null`.
- **Nhận diện lỗi 422 bằng `ex.Message.Contains("422")`.** Cách này dễ vỡ, và lỗi 400 từ AI service sẽ bị biến thành 502. Nên dùng `ex.StatusCode`.
- **Swagger luôn bật ở production** (`IsDevelopment() || true`), lộ toàn bộ danh sách API ra ngoài.

**🟡 Để dành cho Sprint 2**
- `userId` đang lấy từ form, ai cũng gửi được `userId` của người khác để ghi vào lịch sử của họ. Khi có JWT phải lấy `userId` từ token.
- CORS đang chỉ cho `localhost`. Khi deploy EC2 cần đọc danh sách domain từ `.env`.

**🔴 Lỗi cũ của TASK-03 vẫn chưa sửa:** seeder đọc CSV từng dòng, nên với DB trống sẽ chèn **148 dòng (36 dòng rác)** thay vì 112. Lỗi này càng quan trọng hơn bây giờ, vì docker-compose đã có fallback sang Postgres local (DB trống). Gán sai tác nhân HLB và việc không dùng `sample_treatment_seed.json` cũng vẫn còn.

---

## Nhận xét chung
- **B** tiến bộ rõ: sửa đúng và đủ, test chạy đường thật, có số liệu.
- **A** làm chức năng chắc, nhưng mắc lỗi bảo mật kiểu "làm đúng bề mặt": có rate limit nhưng là giới hạn chung, có giấu secret nhưng test lại ghi cứng key thật, có bind localhost nhưng sót Postgres.
- Mình đề xuất thêm vào quy trình: **trước khi merge, chạy một lệnh quét secret** (ví dụ `gitleaks`) và **kiểm tra lại mọi `ports:` trong docker-compose**.

Thứ tự sửa mình đề xuất:
1. Đổi admin key và sửa test (A, ngay).
2. Đóng cổng Postgres (A, ngay).
3. Rate limit theo IP (A).
4. Parser CSV của seeder (A).
5. Content-Type khi upload MinIO (A).
6. Đo lại ngưỡng OOD trên khoảng 20 ảnh lá thật (B).

Mình có thể viết luôn phần sửa cho mục 1–3 (đều nhỏ). Bạn có muốn mình làm trên một nhánh mới không?