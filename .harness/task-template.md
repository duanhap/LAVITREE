# 📋 MẪU PHIẾU GIAO VIỆC CHUẨN HÓA (TASK-TEMPLATE.MD)
<!-- Hướng dẫn: Copy file này thành tasks/TASK-XX-ten-task.md khi bắt đầu làm tính năng mới -->

# TASK-[MÃ SỐ]: [TÊN TÍNH NĂNG NGẮN GỌN]
* **Sprint**: [Sprint 1 / Sprint 2 / Sprint 3]
* **Phân hệ**: [backend/ai-service | backend/core-api | frontend/web | mobile | docker]
* **Trạng thái**: `[ ] PENDING` <!-- Chuyển sang [/] IN_PROGRESS khi bắt đầu, [x] DONE khi nghiệm thu xong -->
* **Người phụ trách**: [Tên bạn / AI Agent]
* **Độ ưu tiên**: [P0 - Bắt buộc cốt lõi | P1 - Quan trọng | P2 - Cải tiến mở rộng]

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Mô tả ngắn**: Giải thích lý do làm tính năng này và nó phục vụ luồng nghiệp vụ nào của Lavitree.
- **Tài liệu tham chiếu**: 
  - Spec: `docs/spec/[tên-file].md`
  - Architecture: `docs/architecture/[tên-file].md`

---

## 2. ĐẶC TẢ KỸ THUẬT (SPECIFICATIONS)
- **Danh sách file tác động**:
  - `[Thêm mới/Chỉnh sửa]`: Đường dẫn file tương đối
- **Hợp đồng dữ liệu (API Contract / Schema)**:
  ```json
  // Request / Input
  {
    "param": "value"
  }
  
  // Response / Output
  {
    "status": "success",
    "data": {}
  }
  ```
- **Xử lý các tình huống biên (Edge Cases & Error Handling)**:
  - Trường hợp 1: Nhập sai định dạng $\rightarrow$ Trả về mã lỗi 400 kèm message rõ nghĩa.
  - Trường hợp 2: Quá thời gian timeout $\rightarrow$ Bắt exception và ghi log.

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI (COOKING PHASES)
- [ ] **Pha 1**: Chuẩn bị cấu trúc thư mục, models/schemas và biến môi trường.
- [ ] **Pha 2**: Viết logic nghiệp vụ chính (Service / Handler).
- [ ] **Pha 3**: Tạo endpoint/giao diện kết nối (Controller / Router).
- [ ] **Pha 4**: Viết script kiểm thử tự động (`test_...py` hoặc script bash/powershell).

---

## 4. TIÊU CHÍ NGHIỆM THU & BẰNG CHỨNG (ACCEPTANCE CRITERIA & RECEIPTS)
> ⚠️ **BẮT BUỘC ĐẠT ĐƯỢC ĐỂ CHUYỂN TRẠNG THÁI SANG DONE:**

- [ ] Bài kiểm thử tự động chạy Pass 100% không có cảnh báo nghiêm trọng.
- [ ] Mã HTTP status code trả về đúng chuẩn RESTful.
- [ ] Bằng chứng kiểm thử (Receipts - *Bắt buộc dán stdout thật từ terminal, cấm tự bịa đặt số liệu/log*):
  ```bash
  # Dán lệnh cURL / PowerShell / Python test và output thực tế chứng minh code hoạt động tại đây
  ```

---

## 5. NHẬT KÝ THỰC HIỆN (EXECUTION NOTES)
- *[Thời gian]*: Ghi nhận ngắn các quyết định kỹ thuật phát sinh trong quá trình code. 
- *Lưu ý*: Nếu phép đo/benchmark chưa diễn ra hoặc dời sang Sprint sau, ghi rõ `[Chưa thực hiện / Dời sang Sprint X]`. Tuyệt đối không sinh số liệu giả lập.
