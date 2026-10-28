# 🗺️ LỘ TRÌNH TỔNG THỂ DỰ ÁN (ROADMAP.MD)
## Hệ thống Lavitree — 3 Sprints chuẩn hóa cho Nhóm 2 Người

> **Nguyên tắc phân công**:
> - **Thành viên A (System & Backend / Frontend)**: Phụ trách Core API .NET 8, PostgreSQL, MinIO, Docker Compose, Web/Mobile UI.
> - **Thành viên B (AI Vision & Autonomous Agent)**: Phụ trách AI Vision Service (ResNet-18 + Grad-CAM), Agri-Agent Service (ReAct + MCP Tools).

---

1. **Sprint 1: Nền tảng Hệ thống Toàn trình (Full-stack Pipeline)**
   - *Mục tiêu*: Kết nối luồng chẩn đoán thị giác khép kín: Client $\rightarrow$ Core API (.NET 8) $\rightarrow$ AI Vision Service (ResNet-18 + Grad-CAM) $\rightarrow$ Lưu DB PostgreSQL & MinIO S3 $\rightarrow$ Trả kết quả kèm Hướng dẫn IPM.
   - *Điều kiện chuyển tiếp (DoD)*: Bấm gửi ảnh lá thực tế $\rightarrow$ API trả kết quả Top-1/Top-3, ảnh Grad-CAM và các bước IPM trong $< 1.5$s; lưu trữ MinIO và DB thành công.

2. **Sprint 2: Trọng tâm Trí tuệ Nhân tạo Tác tử (Autonomous Agri-Agent & MCP Ecosystem)**
   - *Mục tiêu*: Hiện thực hóa kho tri thức nghiên cứu 27 DAY từ thư mục `extract/` vào `backend/agent-service` (FastAPI): Triển khai chu trình ReAct (`Thought → Action → Observation`), tích hợp 4 MCP Tools (Tri thức, Thời tiết, Kho thuốc, Rà soát PHI), chốt chặn an toàn Boundary Guardrails, Streaming SSE và Waterfall Trace Logging.
   - *Điều kiện chuyển tiếp (DoD)*: Agent giải quyết thành công kịch bản ca bệnh phức tạp ngoài vườn: tự động kiểm tra thời tiết $\rightarrow$ tra thuốc phù hợp $\rightarrow$ chặn thuốc có PHI dài sát ngày thu hoạch $\rightarrow$ xuất file `trace_waterfall.json` giải trình minh bạch.

3. **Sprint 3: Tối ưu Giao diện Web/Mobile, Quan sát (Observability) & Đóng gói Demo Offline**
   - *Mục tiêu*: Hoàn thiện giao diện Web Portal (React 18) & Mobile App (Android Kotlin Jetpack Compose) hiển thị mượt mà cả kết quả Vision lẫn Streaming Agent; Bổ sung Màn hình Quan sát Trace Log trên Admin Dashboard; Đóng gói container Docker dự phòng chạy cục bộ sẵn sàng bảo vệ đồ án.
   - *Điều kiện chuyển tiếp (DoD)*: Demo toàn trình thông suốt, kịch bản bảo vệ trước Hội đồng chạy trơn tru 100%.
