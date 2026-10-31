# 📜 HIẾN PHÁP & QUY TẮC PHÁT TRIỂN CÙNG AI AGENT (AGENTS.MD)
## Dự án: LAVITREE — Hệ thống Nông Nghiệp Thông Minh XAI
*Tài liệu quy định hành vi, giới hạn và tiêu chuẩn chất lượng cho AI Agent & Lập trình viên*

---

## 1. NGUYÊN TẮC CỐT LÕI (CORE PRINCIPLES)
1. **Tuân thủ Ngăn kéo Ngữ cảnh (Context Isolation)**:
   - Khi thực hiện một Task, AI **chỉ được đọc các file tài liệu liên quan trực tiếp** trong `docs/`.
   - Tuyệt đối không đọc tràn lan toàn bộ thư mục docs/ nếu không được yêu cầu, nhằm bảo toàn dung lượng bộ nhớ làm việc (token limit) cho tư duy thuật toán.
2. **Kỷ luật Thực nghiệm (Evidence-Based / Presence Gates)**:
   - Không tin vào lời nói suông. Một tính năng chỉ được coi là hoàn thành (`Done`) khi có **bằng chứng thực thi cụ thể** (log kết quả chạy script, HTTP status code 200, test case pass 100%).
3. **1 Task = 1 Luồng công việc tập trung**:
   - Mỗi task nhỏ xử lý dứt điểm một mục tiêu duy nhất. Tránh làm dở dang hoặc nhảy việc giữa chừng.

---

## 2. NHỮNG ĐIỀU CẤM KỴ (NEGATIVE CONSTRAINTS)
> ⛔ **VI PHẠM CÁC ĐIỀU SAU ĐỒNG NGHĨA VỚI THẤT BẠI CỦA AGENT:**

1. **CẤM bịa đặt / sinh số liệu thực nghiệm giả (Zero Tolerance for Fabricated Data / Hallucinations)**:
   - Tuyệt đối **KHÔNG tự ý bịa đặt số liệu đo đạc thực nghiệm** (ví dụ: Energy score, độ trễ latency, điểm F1-score, độ chính xác Accuracy, RAM/CPU benchmark, log mẫu) khi chưa có lệnh chạy và kết quả đo đạc thực tế trên dữ liệu thật trong terminal.
   - Khi lập task hoặc ghi nhật ký: Nếu việc đo đạc chưa diễn ra hoặc đã hoãn sang sprint sau, **bắt buộc phải ghi rõ là `[Chưa thực hiện]` hoặc `[Chuyển sang Sprint X]`**. Tuyệt đối không được "vẽ" số liệu giả vờ như nhóm đã thực nghiệm xong để lừa dối tài liệu.
2. **CẤM viết mã giả lập (Mock/Placeholder) trong Core AI & Core Logic**:
   - Model ResNet18 và trọng số `best_plant_model.pt` là thật; dữ liệu kiểm thử là thật. Tuyệt đối không viết hàm random điểm tin cậy hay fake kết quả chẩn đoán khi xây dựng AI Service (ngoại trừ Day 1 stub endpoint đã quy định rõ ràng trong hợp đồng).
3. **CẤM tự ý xóa bỏ hoặc thay đổi cấu trúc mã nguồn có sẵn**:
   - Phải đọc và hiểu mã nguồn hiện tại trong `backend/` và `frontend/` trước khi bổ sung tính năng mới.
4. **CẤM sửa đổi cấu trúc Database mà không cập nhật tài liệu**:
   - Bất kỳ sự thay đổi nào về bảng biểu, quan hệ 3NF trong PostgreSQL đều phải đồng bộ ngược lại vào `docs/architecture/database-schema.md`.
5. **CẤM commit khi test suite đang bị đỏ (Fail)**:
   - Chỉ được đánh dấu hoàn thành và tạo git commit khi các bài kiểm thử biên đã chạy thành công.
6. **CẤM sử dụng đường dẫn tuyệt đối của máy cá nhân (Absolute Machine Paths)**:
   - Tuyệt đối không ghi `file:///`, `C:\...`, `D:\...`, `/Users/...` vào mã nguồn, cấu hình hay tài liệu `.md`.
   - Mọi đường dẫn trong tài liệu Markdown và source code bắt buộc phải là **đường dẫn tương đối (Relative Path)** tính từ gốc dự án (ví dụ: `docs/architecture/database-schema.md`, `tasks/TODO.md`). Đảm bảo tính tương thích chéo nền tảng (Windows/macOS/Linux), di động khi chạy Docker, CI/CD và trên máy của thành viên khác.
7. **CẤM hồi sinh các khái niệm, quy tắc hoặc thuật ngữ ĐÃ BỊ BÃI BỎ (Zero Tolerance for Deprecated / Rejected Concepts)**:
   - Trước khi sử dụng các thuật ngữ nghiệp vụ (như cách xử lý bệnh, số bước phác đồ, phân cấp AI), Agent bắt buộc phải đối chiếu với tài liệu đặc tả hiện thời (`docs/spec/`, `docs/architecture/api-contracts.md`) và các biên bản cải tổ trong `doc/process/`.
   - Tuyệt đối KHÔNG được dựa vào thói quen suy diễn hay dữ liệu mẫu cũ để hồi sinh các quan niệm đã bị bãi bỏ (ví dụ: cấm dùng lại "phác đồ 3 bước dập khuôn" đã bị xóa bỏ ngày 26/10; cấm dùng lại "phân cấp Tier 1/2/3" đã bị xóa bỏ ngày 28/10). Tài liệu mới nhất và SSOT luôn luôn có giá trị chi phối cao nhất.
8. **CẤM tự ý chạy Git Commit / Git Push khi chưa có yêu cầu hoặc xác nhận của Lập trình viên (Explicit Commit Confirmation)**:
   - Sau khi hoàn thành code và chạy xong bài kiểm thử (Verify), Agent phải hiển thị bằng chứng nghiệm thu, tóm tắt danh sách file thay đổi và ĐỀ XUẤT commit message.
   - Chỉ được chạy `git commit` và `git push` khi Lập trình viên đã ra lệnh rõ ràng hoặc xác nhận đồng ý. Tuyệt đối không tự tiện commit/push âm thầm sau lưng người dùng.
9. **CẤM hardcode thông tin nhạy cảm / Secrets vào mã nguồn, file test hoặc cấu hình công khai (Zero Tolerance for Hardcoded Secrets)**:
   - Tuyệt đối KHÔNG viết trực tiếp mật khẩu (database password, minio secret key, JWT secret, admin secret key, API key) vào code C#, Python, script kiểm thử (`test_*.py`), file Dockerfile hoặc commit lên git.
   - Mọi biến nhạy cảm bắt buộc phải được đọc qua biến môi trường (`os.getenv(...)`, `IConfiguration`, file `.env` đã được liệt kê trong `.gitignore`).
   - File `.env.example` chỉ chứa tên biến và giá trị placeholder/mẫu giả định an toàn.
10. **CẤM mở cổng nội bộ (Internal Ports) ra Internet công khai (Zero Public Ports for Internal Services)**:
   - Các dịch vụ nội bộ (PostgreSQL, Redis, AI Service, Agent Service, MinIO console/API) trong `docker-compose.yml` khi chạy môi trường production hoặc staging tuyệt đối không bind trực tiếp `ports: - "5432:5432"` ra toàn bộ IP công khai (`0.0.0.0`).
   - Phải bind vào localhost (`127.0.0.1:5432:5432`) hoặc chỉ giao tiếp qua Docker network nội bộ (`lavitree-network`). Cổng duy nhất được công khai là Reverse Proxy (Nginx/API Gateway) hoặc port của Core API được bảo vệ bởi SSL & Rate Limiting.

---

## 3. TIÊU CHUẨN CÔNG NGHỆ & MÃ NGUỒN (CODE CONVENTIONS)
- **Backend AI Vision Service**: Python 3.10+, FastAPI, PyTorch, Torchvision, Pillow. Tuân thủ định dạng kiểu dữ liệu rõ ràng (Type hints với Pydantic v2).
- **Backend Agent Service**: Python 3.10+, FastAPI, ReAct Loop (Thought-Action-Observation), Model Context Protocol (MCP Server & Tools), Boundary Guardrails (PHI, Human-in-the-loop - Kế thừa DAY 2), Waterfall Trace Logging (DAY 3), Server-Sent Events (SSE) Streaming (DAY 1). Tuân thủ Pydantic v2 schemas.
- **Backend Core API**: .NET 8 Web API, C# Clean Architecture, CQRS (MediatR), Entity Framework Core.
- **Frontend Web**: React 18, Vite, TypeScript, TailwindCSS / CSS Modules, Axios / React Query.
- **Mobile App**: Android Native, **Kotlin**, **Jetpack Compose**, Material Design 3, CameraX (tích hợp khung ngắm 15–20cm), Retrofit 2, OkHttp, Coil (load ảnh & heatmap Grad-CAM), Coroutines/Flow. Tối ưu UX thao tác 1 tay ngoài đồng ruộng.
- **Database**: PostgreSQL 15+ (chạy Docker), thiết kế chuẩn hóa 3NF, có script Migration và Seed Data rõ ràng.
- **Quy chuẩn Đặt tên Nhánh Git (Branch Naming Conventions)**:
  - Tất cả task mới đều phải rẽ nhánh từ `main`: `git checkout -b <prefix>/task-<mã-số>-<tên-ngắn-gọn>`
  - Tính năng mới: `feat/task-03-database-setup`
  - Sửa lỗi / Vá lỗi: `fix/task-xx-fix-description`
  - Tài liệu / Cấu hình: `docs/task-xx-update-docs` hoặc `chore/task-xx-config`
  - Tuyệt đối **không push/commit trực tiếp code chưa qua nghiệm thu vào nhánh `main`**.
- **Quy chuẩn Git Commit Message**:
  - `feat: [Mã Task] Tên tính năng mới` (Ví dụ: `feat: [TASK-01] Xây dựng endpoint POST /predict`)
  - `fix: [Mã Task] Sửa lỗi`
  - `test: [Mã Task] Bổ sung script kiểm thử`
  - `docs: [Mã Task] Cập nhật tài liệu kỹ thuật`

---

## 4. QUY TRÌNH KHI GẶP LỖI HOẶC BẾ TẮC (TROUBLESHOOTING PROTOCOL)
Khi một lệnh chạy bị lỗi hoặc thư viện gặp xung đột:
1. **Dừng lại ngay lập tức**; không cố gắng chạy các lệnh xóa/cài đặt lung tung làm hỏng môi trường.
2. Đọc kỹ dòng thông báo lỗi (Error trace & Line number).
3. Đưa ra tối thiểu **2 nguyên nhân khả dĩ** và **biện pháp giải quyết** trước khi đề xuất thay đổi file hệ thống.
