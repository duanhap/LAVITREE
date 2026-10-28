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

1. **CẤM viết mã giả lập (Mock/Placeholder) trong Core AI & Core Logic**:
   - Model ResNet18 và trọng số `best_plant_model.pt` là thật; dữ liệu kiểm thử là thật. Tuyệt đối không viết hàm random điểm tin cậy hay fake kết quả chẩn đoán khi xây dựng AI Service.
2. **CẤM tự ý xóa bỏ hoặc thay đổi cấu trúc mã nguồn có sẵn**:
   - Phải đọc và hiểu mã nguồn hiện tại trong `backend/` và `frontend/` trước khi bổ sung tính năng mới.
3. **CẤM sửa đổi cấu trúc Database mà không cập nhật tài liệu**:
   - Bất kỳ sự thay đổi nào về bảng biểu, quan hệ 3NF trong PostgreSQL đều phải đồng bộ ngược lại vào [docs/architecture/database-schema.md](file:///d:/PTIT%20Do%20An/LAVITREE/docs/architecture/database-schema.md).
4. **CẤM commit khi test suite đang bị đỏ (Fail)**:
   - Chỉ được đánh dấu hoàn thành và tạo git commit khi các bài kiểm thử biên đã chạy thành công.

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
