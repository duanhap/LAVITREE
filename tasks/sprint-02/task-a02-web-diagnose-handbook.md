# TASK-A02: HOÀN THIỆN WEB PORTAL KHÁM LÁ E2E, SỔ TAY BỆNH HỌC & LỊCH SỬ CÁ NHÂN
* **Sprint**: Sprint 2 (Song hành Tác tử Nông nghiệp & Hình thành Hệ thống Toàn diện)
* **Thứ tự thực hiện trong Sprint**: **Ưu tiên số 2 - Tuần 1 (P0 - Chuyển hóa kết quả Sprint 1 thành giao diện Web người dùng)**
* **Phân hệ**: `frontend/web` (React 18 + Vite + TypeScript + TailwindCSS / CSS) & Core API
* **Trạng thái**: `[ ] PENDING`
* **Người phụ trách**: Thành viên A (System, Auth & Web Lead)
* **Độ ưu tiên**: P0 - Bắt buộc cốt lõi
* **Tài liệu tham chiếu chuẩn**:
  - Đặc tả Ca sử dụng: [docs/spec/roles-usecases.md](../../docs/spec/roles-usecases.md) (UC-01 Khám lá, UC-02 Sổ tay, UC-03 Lịch sử)
  - Hợp đồng API: [docs/architecture/api-contracts.md](../../docs/architecture/api-contracts.md) (Mục 3.1 Chẩn đoán, 3.2 Lịch sử)
  - Kế hoạch Sprint 2: [docs/planning/sprint-02.md](../../docs/planning/sprint-02.md)

---

## 1. BỐI CẢNH & MỤC TIÊU (CONTEXT & OBJECTIVES)
- **Vấn đề cốt tử**:
  - Toàn bộ kết quả Sprint 1 (mô hình ResNet-18, bản đồ nhiệt Grad-CAM, bộ lọc OOD đa tầng, dữ liệu 40 bệnh học, 112 tài liệu khuyến nông) hiện mới chỉ được kiểm thử qua script terminal (`test_task04_e2e.py`).
  - Người dùng cuối (Nông dân và Hội đồng đánh giá) cần một giao diện trực quan, thẩm mỹ cao (WOW factor), phản hồi tức thì để trải nghiệm toàn trình luồng nghiệp vụ.
- **Mục tiêu cụ thể của Task**:
  1. **Hệ thống Đăng nhập / Đăng ký trên Web**:
     - `LoginPage.tsx` & `RegisterPage.tsx` kết nối với API từ `TASK-A01`.
     - Quản lý JWT Token (lưu trữ an toàn, tự động đính kèm Bearer Header trong Axios Client).
     - Điều hướng phân quyền giao diện (Farmer thấy Lịch sử/Khám lá; Admin thấy thêm nút Quản trị).
  2. **Trang Khám lá Nông nghiệp Toàn trình (`DiagnosePage.tsx`)**:
     - Khung kéo-thả hoặc chụp ảnh lá cây (hỗ trợ preview ảnh tức thì).
     - Gửi request `POST /api/v1/diagnose` đa định dạng (`multipart/form-data`).
     - Hiển thị kết quả chẩn đoán trực quan:
       - Tên cây trồng, tên bệnh tiếng Việt, mã bệnh khoa học, độ tin cậy Confidence (%).
       - Bản đồ nhiệt Grad-CAM (`layer4[-1] Jet`) đặt cạnh ảnh gốc để nông dân so sánh vùng nghi vấn bệnh.
       - Cảnh báo bất định (`is_uncertain: true`) kèm mẹo chụp ảnh cải thiện góc máy (`CaptureTip`).
       - Cảnh báo ảnh ngoại lai (`is_ood: true`) giải thích rõ ràng lý do ảnh nằm ngoài 38 lớp cây trồng.
       - Phác đồ xử lý IPM theo từng bước linh hoạt.
       - Danh mục thuốc BVTV đặc trị và liên kết nguồn tài liệu khuyến nông đối chứng.
  3. **Trang Sổ tay Bệnh học Thông minh (`HandbookPage.tsx`)**:
     - Danh mục phân cấp: Chọn 1 trong 14 loài cây $\rightarrow$ Xem danh sách các bệnh phổ biến.
     - Tìm kiếm nhanh theo tên tiếng Việt hoặc triệu chứng.
     - Xem chi tiết triệu chứng, tác nhân gây bệnh (Nấm, Vi khuẩn, Virus, Nhện hại) và biện pháp phòng ngừa.
  4. **Trang Lịch sử Khám bệnh Cá nhân (`HistoryPage.tsx`)**:
     - Hiển thị danh sách các ca chẩn đoán của người nông dân đã đăng nhập (`GET /api/v1/diagnose/history`).
     - Xem lại ảnh gốc, ảnh Grad-CAM và phác đồ điều trị của các ca khám cũ.

---

## 2. ĐẶC TẢ GIAO DIỆN & CÔNG NGHỆ (SPECIFICATIONS)

### 2.1. Cấu trúc Routing Web Portal (`frontend/web/src/`):
```text
/login       -> LoginPage.tsx
/register    -> RegisterPage.tsx
/diagnose    -> DiagnosePage.tsx (Mặc định)
/handbook    -> HandbookPage.tsx
/history     -> HistoryPage.tsx (Yêu cầu đăng nhập)
```

### 2.2. Tiêu chuẩn Thẩm mỹ & Trải nghiệm (Rich Aesthetics):
- Tone màu chủ đạo: Nông nghiệp hiện đại (Forest Green `#1B4332`, Emerald `#2D6A4F`, Light Mint `#D8F3DC`).
- Typography hiện đại từ Google Fonts (Inter / Outfit / Be Vietnam Pro).
- Hiệu ứng chuyển động mượt mà (Micro-animations, smooth hover, badge trạng thái bệnh bắt mắt).
- Responsive hoàn hảo trên màn hình Desktop và Mobile Web.

---

## 3. KẾ HOẠCH BẺ NHỎ THỰC THI 4 CHẶNG (SDLC 4 PHASES)

### Chặng 1: PLAN (Thiết kế Component & Luồng State)
- [ ] Xác định cấu trúc thư mục components, services API (Axios instance) và Auth Context.

### Chặng 2: COOK (Viết mã nguồn Frontend & Ghép API)
- [ ] **Pha 1 (Auth Client)**: Dựng `AuthContext`, `LoginPage.tsx`, `RegisterPage.tsx`, xử lý lưu token và tự động đăng xuất khi token hết hạn.
- [ ] **Pha 2 (Diagnose UI)**: Dựng `DiagnosePage.tsx`, vùng tải ảnh, thanh loading tiến trình và cụm hiển thị Grad-CAM + IPM Steps.
- [ ] **Pha 3 (Handbook UI)**: Dựng `HandbookPage.tsx`, component lọc cây trồng, thẻ bệnh học chi tiết.
- [ ] **Pha 4 (History UI)**: Dựng `HistoryPage.tsx` hiển thị lưới các ca khám bệnh kèm thumbnail và modal xem chi tiết.

### Chặng 3: VERIFY (Nghiệm thu Thực tế - Presence Gates)
- [ ] Đăng ký tài khoản mới $\rightarrow$ Đăng nhập thành công $\rightarrow$ Lưu token và chuyển hướng trang.
- [ ] Tải ảnh lá `Tomato___Late_blight` $\rightarrow$ Nhận diện chính xác, hiển thị đầy đủ Heatmap Grad-CAM và 3 bước IPM.
- [ ] Tải ảnh OOD $\rightarrow$ Hiển thị thông báo OOD thân thiện, không báo lỗi sập ứng dụng.
- [ ] Mở trang Lịch sử $\rightarrow$ Thấy ca khám vừa tạo xuất hiện trong danh sách.

### Chặng 4: SHIP (Đóng gói & Chờ xác nhận Commit)
- [ ] Cập nhật trạng thái `TASK-A02` trong `tasks/TODO.md` sang `[x] DONE`.
- [ ] Ghi nhận bằng chứng nghiệm thu vào `tasks/WORKLOG.md`.
- [ ] Báo cáo tóm tắt diff và chờ Lập trình viên xác nhận trước khi commit.
