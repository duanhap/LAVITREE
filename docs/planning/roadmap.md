# 🗺️ LỘ TRÌNH TỔNG THỂ DỰ ÁN (ROADMAP.MD)
## Hệ thống Lavitree — 3 Sprints chuẩn bị nghiệm thu Đồ án

> Nguyên tắc: Mỗi Sprint chỉ 1 dòng tóm tắt mục tiêu, thời hạn và tiêu chí chuyển tiếp.

---

1. **Sprint 1 (Tuần 1)**: Đóng gói AI Vision Service (FastAPI) nhận diện 38 lớp, phân tích Grad-CAM, kiểm tra độ bất định $T < 0.70$ và xuất dữ liệu Seed. $\rightarrow$ *Điều kiện xong: API test pass 100%, thời gian xử lý $< 1.5$s.*
2. **Sprint 2 (Tuần 2)**: Xây dựng Core API (.NET 8 Clean Architecture) + PostgreSQL 10 bảng (Tri thức bệnh, Lịch sử chẩn đoán, Giỏ hàng tiệm thuốc). $\rightarrow$ *Điều kiện xong: Chạy Migration thành công, CRUD API test pass qua Swagger/Postman.*
3. **Sprint 3 (Tuần 3)**: Hoàn thiện Web Portal (React 18), Admin Dashboard và đóng gói `docker-compose.yml` chạy offline 100%. $\rightarrow$ *Điều kiện xong: Demo toàn trình từ chụp ảnh lá $\rightarrow$ ra Grad-CAM $\rightarrow$ phác đồ $\rightarrow$ đặt thuốc hoàn toàn mượt mà.*
