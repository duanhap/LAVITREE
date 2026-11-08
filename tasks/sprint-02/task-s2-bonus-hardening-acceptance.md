# TASK-S2-BONUS: DỌN VIỆC TỒN SPRINT 2 & NGHIỆM THU CHÉO TVA – TVB
* **Sprint**: Sprint 2 (Song hành Tác tử Nông nghiệp & Hình thành Hệ thống Toàn diện)
* **Thứ tự thực hiện trong Sprint**: **Song song với TASK-A04 / TASK-07 / TASK-08; nhóm A phải xong trước khi deploy tiếp lên production**
* **Phân hệ**: `backend/core-api`, `frontend/web`, `backend/agent-service`, `docker-compose.yml`, `frontend/web/nginx.conf`, `.github/workflows/deploy.yml`
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên A (Core API, Web, hạ tầng) & Thành viên B (Agent, RAG, Gemini)
* **Người nghiệm thu**: Mỗi dòng có cột "Nghiệm thu"; người làm không tự nghiệm thu dòng của mình.
* **Độ ưu tiên**: P0 cho nhóm A, P1 cho các nhóm còn lại
* **Nguồn**: các dòng còn `[ ]` ở mục 5 của `task-a02-web-diagnose-handbook.md` và `task-a03-store-admin-hitl.md`, review A03 ngày 08/11/2026 (`doc/hint/sprint2_TVA_TASK03_assessment.md`). Mã BUG giữ nguyên để tra lại lịch sử; mã mới bắt đầu từ BUG-70.

---

## 1. BỐI CẢNH & MỤC TIÊU
- Các task A01–A03 và 05–06 đã có code, nhưng còn việc không thuộc riêng task nào: đổi bí mật đã lộ, dữ liệu thuốc chưa đối chiếu, dữ liệu test có thể đã vào Supabase, các lỗ bảo mật nhỏ và phần hạ tầng Docker/Nginx.
- Một số việc chỉ nghiệm thu được khi chạy cả hai phía (Core API của A với Agent của B), nên cần cả hai người xác nhận.
- Mục tiêu: đóng hết các dòng dưới đây, hoặc ghi rõ lý do chuyển sang Sprint 3 (TASK-12 cho phần hạ tầng).
- Việc thuộc khung Chat Web và Android đã chuyển sang mục 5 của `task-a04-sse-chat-android-init.md`, không lặp lại ở đây.

## 2. QUY TẮC LÀM VÀ NGHIỆM THU
- Không chạy test ghi dữ liệu lên Supabase. Test A03 đã có chốt chặn (thoát mã 2); test A01/A02 chưa có, chạy trên DB local.
- Việc nào cần thao tác trên production (GitHub Secret, Supabase, đăng nhập web thật) thì người làm ghi lại **cách kiểm tra** vào mục 5, không ghi mật khẩu, khóa hay chuỗi kết nối.
- Chỉ tick khi đã chạy kiểm tra ở cột "Nghiệm thu". Đọc code thôi thì ghi "đọc code", không tick.

---

## 3. DANH SÁCH VIỆC

### 3.1. Nhóm A — Bắt buộc trước lần deploy tiếp theo
| Xong | ID | Mức | Làm | Nghiệm thu | Việc | Cách nghiệm thu |
|---|---|---|---|---|---|---|
| [ ] | BUG-01 | CRITICAL | A | B | Mật khẩu admin cũ đã lộ trong lịch sử git. Đổi trong `.env` hay GitHub Secret không đổi được mật khẩu trong DB, vì seeder chỉ ghi khi `FORCE_ADMIN_PASSWORD_RESET=true`. | Bật `FORCE_ADMIN_PASSWORD_RESET=true`, deploy một lần, rồi đặt lại `false` và deploy lại. B đăng nhập web thật: mật khẩu cũ trả 401, mật khẩu mới trả 200. |
| [ ] | BUG-70 | CRITICAL | A | B | Chưa xác nhận `JWT_SECRET_KEY` đã đổi sau khi mật khẩu bị lộ; token ADMIN cũ có thể còn sống 7 ngày. | A xác nhận đã đổi khóa trong Secret `ENV_PRODUCTION`. B dùng token cũ (nếu còn) gọi `GET /api/v1/diagnose/escalations`, phải trả 401. |
| [ ] | BUG-71 | HIGH | A | B | `deploy.yml` chỉ đọc Secret `ENV_PRODUCTION`. Nếu copy nguyên `.env` máy local thì `MINIO_PUBLIC_URL`, `CORS_ALLOWED_ORIGINS` còn `localhost`. | Trên web thật: khám 1 ảnh, mở lại trong Lịch sử thấy được ảnh gốc và Grad-CAM; trình duyệt không báo lỗi CORS. |
| [ ] | BUG-72 | HIGH | A | B | Lần chạy test A03 trước khi có chốt chặn có thể đã ghi dữ liệu giả vào Supabase: bài "nguyên văn" tự viết, ghi nguồn Trung tâm Khuyến nông Quốc gia, URL `khuyennongvn.gov.vn/benh-suong-mai-ca-chua-*` hoặc `/bai-1`, đã duyệt; ghi chú chuyên gia có liều "50g/16L"; tồn kho Ridomil bị đổi; tài khoản `farmer_a03_*` và đơn hàng test. | A chạy các câu SELECT ở mục 1 của file assessment, xóa bài tri thức qua Admin (để kích hoạt reindex), trả lại tồn kho. B hỏi chatbot về sương mai cà chua: không còn trích dẫn từ các URL trên. |
| [ ] | BUG-73 | HIGH | A | B | Hai migration mới (`AddOrderAndKnowledgeIngestionFields`, `AddReceiverNameAndNotesToOrder`) phải có trên Supabase. Core tự migrate khi khởi động, nhưng chưa ai xác nhận trên DB thật. | Bảng `__EFMigrationsHistory` có đủ 2 migration. B chạy `sync_index.py` không còn cảnh báo thiếu cột `UnitType`/`IsVerbatim`. |

### 3.2. Dữ liệu thuốc (Store và Guardrail cùng dùng)
| Xong | ID | Mức | Làm | Nghiệm thu | Việc | Cách nghiệm thu |
|---|---|---|---|---|---|---|
| [ ] | BUG-51 (gộp BUG-10) | HIGH | A | B | Cả 4 thuốc trong seed vẫn ghi "CHƯA ĐỐI CHIẾU" nhưng `is_allowed: true` và đang bán. PHI, liều dùng, chống mưa, bệnh đích chưa có nguồn. | Mỗi thuốc có nguồn tra cứu (Phụ lục của TT 75/2025/TT-BNNMT, sửa đổi bởi TT 28/2026/TT-BNNMT) ghi trong `provenance_source`. Thuốc chưa đối chiếu thì `is_allowed: false`. B kiểm tra Guardrail TASK-07 không đề xuất thuốc `is_allowed: false`. |
| [ ] | BUG-37 | MEDIUM | A | B | Ảnh thuốc trỏ tới `lavitree.io.vn/images/products/...`, chưa xác nhận tồn tại, khác contract. | Ảnh nằm trong bucket hoặc thư mục tĩnh của dự án; Store hiển thị đủ ảnh; cập nhật contract nếu đổi đường dẫn. |

### 3.3. Nghiệm thu chéo Core API ↔ Agent (cần chạy cả hai phía)
| Xong | ID | Mức | Làm | Nghiệm thu | Việc | Cách nghiệm thu |
|---|---|---|---|---|---|---|
| [ ] | BUG-74 | HIGH | A + B | Cả hai | Chặng 3 của A03 "Bỏ duyệt 1 đoạn → chat không còn trích dẫn đoạn đó" chưa chạy với Agent thật. | Duyệt 1 đoạn qua Admin → chờ `GET /api/v1/knowledge/reindex-status` có `running: false` → chat trích dẫn được. Bỏ duyệt → chờ lại → chat không còn trích dẫn. Ghi kết quả vào mục 5. |
| [ ] | BUG-75 | MEDIUM | A + B | Cả hai | Nhập bài báo với Gemini thật chưa chạy qua web (timeout web 45s, Core chờ Agent 35s, Agent chờ Gemini 30s). | Dán 1 bài thật trên Admin → có gợi ý nhãn. Tắt `GEMINI_API_KEY` hoặc agent-service → vẫn hiện danh sách đoạn, `ai_suggestion_available: false`, Admin tự gán nhãn và lưu được. |
| [ ] | BUG-05, BUG-07 | HIGH | A | B | Code thời tiết đã merge (dùng `pop`, production thiếu khóa trả 503) nhưng chưa chạy với OpenWeather thật. Ngưỡng cảnh báo mưa đang là `rainProb >= 40 || rainMm > 0`. | A gọi `/api/v1/weather?location=Hà Nam&forecastHours=12` trên môi trường có khóa thật: `is_simulated: false`, có `forecast_hours`. B chạy tool `check_weather_risk` nhận đúng dữ liệu đó. |
| [ ] | BUG-76 | LOW | B | A | `sync_index.py` còn nhánh tạm khi thiếu cột `UnitType`/`IsVerbatim`. | Sau khi xong BUG-73, bỏ nhánh tạm; `test_rag_accuracy.py` vẫn đạt. |
| [ ] | BUG-77 | LOW | A | B | Khóa chống vượt 4 đoạn/URL dùng `SemaphoreSlim` trong bộ nhớ, chỉ đúng khi chạy 1 bản Core API. | Nếu giữ 1 bản: ghi rõ vào `system-design.md`. Nếu chạy nhiều bản: đổi sang advisory lock của PostgreSQL và chạy lại phép thử 6 lần lưu đồng thời (chỉ được 4 dòng). |

### 3.4. Bảo mật Core API và Web còn mở
| Xong | ID | Mức | Làm | Nghiệm thu | Việc | Cách nghiệm thu |
|---|---|---|---|---|---|---|
| [ ] | BUG-30 | HIGH | A | B | `KnowledgeCollectorPage.tsx` gọi `axios` thô không có token: thêm, xóa bị 401; link export mở tab mới không có header. Từ khi `GET /knowledge/sources` ẩn bài chưa duyệt với khách, trang này cũng chỉ còn thấy bài đã duyệt nên kiểm tra trùng URL bị sai. | Đổi sang `apiClient`; export tải blob sau khi xác thực. Admin thêm, xóa, export được; danh sách hiện cả bài chưa duyệt. |
| [ ] | BUG-18 | HIGH | A | B | Các API Admin tự kiểm tra role trong từng hàm, chưa có `[Authorize(Roles = "ADMIN")]`; khóa `X-Admin-Key` dùng chung vẫn được chấp nhận. | Dùng policy `ADMIN`; bỏ `X-Admin-Key` ở giao diện. FARMER 403, ADMIN 200, không token 401 trên mọi endpoint Admin. |
| [ ] | BUG-32 | MEDIUM | A | B | `POST /knowledge/sources` (luồng cũ) không kiểm tra scheme của `SourceUrl`, có thể lưu `javascript:`. | Chỉ nhận `http`/`https`, giới hạn độ dài. Gửi `javascript:alert(1)` trả 400. |
| [ ] | BUG-33 | MEDIUM | A | B | Export CSV không chặn công thức (`=`, `+`, `-`, `@`). | Ô bắt đầu bằng các ký tự này có tiền tố `'`. Mở file bằng Excel không chạy công thức. |
| [ ] | BUG-31, BUG-34 (phần còn lại) | MEDIUM | A | B | Route `/knowledge` đã chuyển về Admin và `allowedOnly=false` đã chỉ cho Admin; còn thiếu phân trang ở `GET /knowledge/sources` và `GET /medicines/search`; contract ghi `id` thuốc là UUID trong khi code là số. | Có `page`/`pageSize` (giới hạn trên); contract khớp kiểu `id`. |
| [ ] | BUG-35 (phần còn lại) | LOW | A | B | `/weather` đã có rate limit và giới hạn 120 ký tự; cache chưa có `SizeLimit`. | Đặt `SizeLimit` cho `IMemoryCache` và `Size` cho từng mục cache. |
| [ ] | BUG-36 | LOW | A | B | Log `HttpClient` đã hạ xuống Warning trong `appsettings.json`; chưa kiểm tra log thật. | Chạy 1 lần gọi thời tiết, log container không chứa khóa OpenWeather. |
| [ ] | BUG-38 | MEDIUM | A | B | JWT 7 ngày không thu hồi được; chưa cố định thuật toán ký. | `ValidAlgorithms = HS256`, `OnTokenValidated` kiểm tra user còn tồn tại. Tài khoản đã xóa dùng token cũ trả 401. |
| [ ] | BUG-43 | MEDIUM | A | B | Còn mặc định `Password=postgres` (`Program.cs`) và `minioadmin` (`MinioStorageService.cs`, `docker-compose.yml`, `.env.example`). | Production thiếu biến thì báo lỗi khi khởi động thay vì dùng giá trị mặc định. |
| [ ] | BUG-78 | LOW | A | B | Từ commit `7f09125`, `appsettings.json` được ưu tiên hơn biến môi trường; chạy `dotnet run` local thì `AGENT_SERVICE_URL`, `MINIO_*` bị bỏ qua (Docker không bị vì dùng `Minio__*`). | Ghi rõ trong `.env.example` cách đặt biến dạng `Section__Key`, hoặc bỏ các giá trị localhost khỏi `appsettings.json`. |
| [ ] | BUG-79 | LOW | A | B | Test A03 để lại ca chẩn đoán test (`RequiresExpert=true`), tài khoản `farmer_a03_*` và đơn hàng, vì API không có lệnh xóa. Test A01/A02 chưa có chốt chặn Supabase. | Thêm chốt chặn Supabase cho test A01/A02; ghi rõ cách dọn dữ liệu test trên DB local. |
| [ ] | BUG-47, BUG-48 | LOW | A | B | Chưa có xử lý lỗi toàn cục và `/health`; `WeatherForecastController` mẫu còn công khai. | `UseExceptionHandler` trả ProblemDetails; `/health` trả 200; xóa controller mẫu. |
| [ ] | BUG-54 (gộp BUG-26) | MEDIUM | A | B | `react-router-dom` 6.30.6 nằm trong khoảng ảnh hưởng của GHSA-wrjc-x8rr-h8h6; `vite` còn cảnh báo khi dev. Nên làm **trước** A04 vì A04 thêm route Chat. | Commit riêng nâng phiên bản; `npm audit --omit=dev` không còn cảnh báo; chạy lại A02 E2E và các route Admin. |
| [ ] | BUG-27 | LOW | A | B | JS tải ban đầu khoảng 522 KB (gzip 163 KB). | Có thể chuyển TASK-09 Sprint 3; ghi số đo sau `npm run build`. |

### 3.5. Hạ tầng Docker, Nginx, deploy (có thể chuyển TASK-12 nếu không kịp)
| Xong | ID | Mức | Làm | Nghiệm thu | Việc | Cách nghiệm thu |
|---|---|---|---|---|---|---|
| [ ] | BUG-39 | HIGH | A | B | Code đã tự đổi `localhost` sang tên service khi chạy trong container; chưa chạy `docker compose up` để xác nhận. | `docker compose up`, khám lá thành công, Core gọi được ai-service và agent-service. |
| [ ] | BUG-40 | HIGH | A | B | `Dockerfile` của Core chỉ publish code, không chép thư mục `seed`; seeder chỉ cảnh báo rồi thoát nên DB mới không có admin và dữ liệu. | Image có `seed`; thiếu seed ở production thì báo lỗi. DB trống + `docker compose up` có admin và 14 loài cây. |
| [ ] | BUG-41 | HIGH | A | B | Nginx chỉ `listen 80`; chưa có CSP, `X-Frame-Options`, `X-Content-Type-Options`, HSTS. | Bật HTTPS và header; `curl -I` thấy đủ header. |
| [ ] | BUG-42 | MEDIUM | A | B | Mới có rate limit cho chat; `/api/` và auth chưa có; `client_max_body_size 15M` áp cho mọi route. | Thêm zone cho auth và API; giới hạn body theo route; ảnh chỉ `GET`/`HEAD`. |
| [ ] | BUG-44 | MEDIUM | A | B | Có cả `.env` gốc và `backend/core-api/.env`; `env_file` đưa mọi secret vào mọi service. | Một nguồn cấu hình; mỗi service chỉ nhận biến cần thiết. |
| [ ] | BUG-45 | MEDIUM | A | B | Chuỗi kết nối Supabase dùng `Trust Server Certificate=true`. | `SSL Mode=VerifyFull` kèm CA của Supabase, Core vẫn kết nối được. |
| [ ] | BUG-46 | MEDIUM | A | B | Chỉ `agent-service` có `.dockerignore`; web dùng `npm install`; image `pgsty/silo:latest` chưa ghim phiên bản; container chạy root. | Thêm `.dockerignore` (loại `.env`, `node_modules`), `npm ci`, ghim phiên bản, `USER` thường. |

### 3.6. Tài liệu
| Xong | ID | Mức | Làm | Nghiệm thu | Việc | Cách nghiệm thu |
|---|---|---|---|---|---|---|
| [ ] | BUG-19 (phần còn lại) | LOW | A | B | `ui-ux.md` còn ghi `expires_in` 86400 trong khi API trả 604800 (7 ngày). | Sửa tài liệu cho khớp code. |
| [ ] | BUG-80 | LOW | A + B | Cả hai | Sau khi xong bảng trên, tick lại các dòng tương ứng ở mục 5 của `task-a02` và `task-a03`, cập nhật `TODO.md` và `WORKLOG.md`. | Không còn dòng `[ ]` nào trong A02/A03 mà không có dòng tương ứng ở task này hoặc ở A04/Sprint 3. |

---

## 4. ĐIỀU KIỆN ĐÓNG TASK
- [ ] Hết dòng `[ ]` ở mục 3.1 và 3.2, có xác nhận của người nghiệm thu.
- [ ] Mục 3.3 chạy với Core + Agent thật, kết quả ghi ở mục 5.
- [ ] Mục 3.4–3.6: đã xong, hoặc ghi rõ chuyển sang task nào của Sprint 3.
- [ ] TVA và TVB cùng ký tên ở mục 5.

## 5. NHẬT KÝ THỰC HIỆN & NGHIỆM THU
| Ngày | ID | Người làm | Người nghiệm thu | Cách đã kiểm tra | Kết quả |
|---|---|---|---|---|---|
| | | | | | |
