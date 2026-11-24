# TASK-27: Quản trị Biên tập Cẩm nang Bệnh học (Handbook CMS), Bảng `HandbookDiseases` & Cơ chế Cảnh báo Lỗi thời (Staleness Invalidation)

* **Sprint**: Sprint 3 (Phân hệ Cẩm nang & Quản trị Tri thức Nông nghiệp)
* **Phân hệ**:
  * `backend/core-api`: Entity & Bảng mới `HandbookDiseases`, API CRUD bài cẩm nang Admin, logic tự động gắn cờ `NEEDS_REVIEW` khi đoạn trích tri thức bị xóa/bỏ duyệt.
  * `frontend/web`:
    * Màn hình Quản trị Danh mục Bệnh `/admin/diseases`: Badge trạng thái Cẩm nang & Trình soạn thảo Markdown Editor kèm quản lý FAQ, tác giả, tham chiếu đoạn trích song song.
    * Màn hình Sổ tay Bệnh học `/handbook/:classCode`: Ưu tiên hiển thị bài cẩm nang chuẩn biên tập; Banner cảnh báo cho Admin khi nguồn trích dẫn bị thay đổi.
* **Độ ưu tiên**: P1 (Nâng cấp trải nghiệm đọc Cẩm nang chuyên nghiệp, xóa bỏ tình trạng hiển thị chắp vá, bảo toàn tính toàn vẹn dữ liệu khoa học).
* **Trạng thái**: `[ ] PENDING` (Đã đặc tả xong kiến trúc, sẵn sàng triển khai)
* **Tạo ngày**: 24/11/2026

---

## 1. MỤC TIÊU VÀ ĐỘNG LỰC (BỐI CẢNH)

### 1.1. Vấn đề thực tế
1. **Trang Sổ tay hiển thị chắp vá (Vấn đề từ TASK-20)**:
   - Hiện tại `/handbook/:classCode` tự động ghép thô các đoạn trích rời rạc (`KnowledgeSource`) mà Admin duyệt từ bài báo.
   - Các đoạn trích này vốn phục vụ cho **AI Chatbot (RAG)** tìm kiếm câu trả lời ngắn. Khi xếp chồng lên nhau thành bài viết cho nông dân đọc, câu từ bị rời rạc, lặp ý, thiếu tính hệ thống và không có tác giả biên tập chuẩn mực.
2. **Nhu cầu biên tập bài viết chuẩn (CMS Editorial)**:
   - Admin/Kỹ sư BVTV cần một nơi để tự tay viết/biên tập một bài cẩm nang hoàn chỉnh bằng Markdown (có tiêu đề rõ ràng, bảng biểu so sánh, ghi chú lưu ý thuốc, danh sách câu hỏi FAQ thực tế).
3. **Bài toán toàn vẹn dữ liệu & Lỗi thời (Data Lineage & Staleness Invalidation)**:
   - Khi bài cẩm nang được viết dựa trên các bài báo/đoạn trích khoa học, nếu một ngày nào đó Admin **Bỏ duyệt** (`is_approved = false`) hoặc **Xóa** một đoạn trích trong `/admin/ingest` hay `/admin/knowledge` (ví dụ do thuốc bị cấm hoặc bài báo sai lệch), bài cẩm nang sẽ rơi vào tình trạng **căn cứ khoa học bị khuyết thiếu** mà Admin không hề hay biết nếu không có hệ thống cảnh báo tự động.

---

## 2. KIẾN TRÚC CƠ SỞ DỮ LIỆU: BẢNG `HandbookDiseases`

### 2.1. Tại sao tạo bảng riêng `HandbookDiseases` thay vì nhồi vào `Diseases`?
- **Nguyên lý Single Responsibility (SRP)**:
  - `Diseases`: Thực thể lõi (Core Domain Entity) phục vụ phân loại của AI chẩn đoán bệnh (`ClassCode`, `PlantId`, `PathogenType`, `PathogenName`, `SeverityLevel`). Bảng này cần nhẹ, truy vấn nhanh cho Model AI và các dropdown chẩn đoán.
  - `HandbookDiseases`: Thực thể xuất bản nội dung (Editorial / CMS Entity) chứa nội dung văn bản Markdown dài hàng chục KB, FAQ JSON, tác giả biên tập, trạng thái xuất bản và lịch sử rà soát.
- **Tương thích ngược & An toàn**:
  - Tách bảng giúp không ảnh hưởng đến seed data hay các quan hệ hiện tại của `Diseases` (TreatmentPlans, DiagnosisRecords, DiseaseProducts).
  - Cho phép quản lý trạng thái Nháp (`DRAFT`), Đã xuất bản (`PUBLISHED`), và Cần rà soát (`NEEDS_REVIEW`).

### 2.2. Chi tiết Entity `HandbookDisease` (`backend/core-api/src/Lavitree.Domain/Entities/HandbookDisease.cs`)

```csharp
using System;
using Lavitree.Domain.Common;

namespace Lavitree.Domain.Entities;

public class HandbookDisease : BaseEntity
{
    public int Id { get; set; }

    // Liên kết với thực thể Disease
    public int DiseaseId { get; set; }
    public Disease Disease { get; set; } = null!;

    // Mã lớp AI (Redundant key giúp truy vấn nhanh không cần JOIN)
    public string ClassCode { get; set; } = string.Empty; // e.g. "Tomato___Tomato_mosaic_virus"

    // Nội dung bài cẩm nang
    public string Title { get; set; } = string.Empty; // Tiêu đề cẩm nang
    public string? Summary { get; set; } // Tóm tắt ngắn đầu bài (1-2 câu)
    public string ContentMarkdown { get; set; } = string.Empty; // Nội dung bài viết Markdown chuẩn

    // Tác giả & Đơn vị biên soạn
    public string AuthorName { get; set; } = "Ban Chuyên môn BVTV Lavitree"; // Tên kỹ sư / đơn vị

    // Danh sách câu hỏi thường gặp FAQ (JSON string: Array of { question, answer })
    public string FaqJson { get; set; } = "[]";

    // Vòng đời xuất bản & Quản trị lỗi thời
    public string Status { get; set; } = "DRAFT"; // DRAFT | PUBLISHED | NEEDS_REVIEW
    public string? ReviewReason { get; set; } // Ghi rõ lý do tại sao bài bị đánh dấu cần rà soát
    public DateTime? LastReviewedAt { get; set; } // Thời điểm Admin xác nhận đã rà soát xong
    public DateTime? PublishedAt { get; set; } // Thời điểm xuất bản công khai
}
```

---

## 3. THAY ĐỔI BACKEND (CORE API)

### 3.1. Entity Configuration & Migration
- Đăng ký `DbSet<HandbookDisease> HandbookDiseases { get; set; }` trong `LavitreeDbContext.cs`.
- Cấu hình quan hệ:
  - `Disease` có quan hệ 1 - 0..1 với `HandbookDisease` (Unique Index trên `DiseaseId` và `ClassCode`).
- Migration EF Core: `AddHandbookDiseaseTable`.

### 3.2. Endpoints API (`HandbookController.cs` hoặc `DiseasesController.cs`)

1. **`GET /api/v1/handbook/articles/{classCode}`** (Công khai cho người dùng & nông dân):
   - Đọc bài viết từ `HandbookDiseases` theo `ClassCode`.
   - Nếu có bài viết và `Status` thuộc `['PUBLISHED', 'NEEDS_REVIEW']`: Trả về nội dung bài viết Markdown, FAQ JSON, Tác giả, Ngày cập nhật.
   - Nếu **chưa có bài viết** (`404` hoặc chưa Publish): Trả về cờ `isFallback: true` để Frontend tự động fallback sang cơ chế ghép nối tự động từ `KnowledgeSources` hiện tại (TASK-20). Đảm bảo 100% không bị trang trắng.

2. **`GET /api/v1/admin/handbook/articles/{classCode}`** (`[Authorize(Policy = AuthPolicies.AdminOnly)]`):
   - Lấy toàn bộ thông tin bài cẩm nang (kể cả bản `DRAFT`), kèm `Status`, `ReviewReason`, `LastReviewedAt`.
   - Trả về kèm danh sách các đoạn trích nguồn đã duyệt (`approvedKnowledgeSources`) của bệnh đó để Admin đối chiếu khi viết.

3. **`PUT /api/v1/admin/handbook/articles/{classCode}`** (`[Authorize(Policy = AuthPolicies.AdminOnly)]`):
   - Body: `{ title, summary, content_markdown, faq_items: [{ question, answer }], author_name, status: "DRAFT" | "PUBLISHED" }`.
   - Lưu hoặc cập nhật bản ghi `HandbookDisease`.
   - Nếu Admin bấm "Xuất bản" (`PUBLISHED`), tự động xóa `ReviewReason` và cập nhật `LastReviewedAt = DateTime.UtcNow`.

4. **`POST /api/v1/admin/handbook/articles/{classCode}/review-ack`** (`[Authorize(Policy = AuthPolicies.AdminOnly)]`):
   - Cho phép Admin đánh dấu "Đã rà soát": Chuyển trạng thái từ `NEEDS_REVIEW` trở lại `PUBLISHED`.

### 3.3. Cơ chế Cảnh báo Lỗi thời (Staleness Invalidation Logic)

1. **Trong `KnowledgeController.cs`**:
   - Khi Admin gọi API:
     - `DELETE /api/v1/knowledge/sources/{id}` (Xóa đoạn trích)
     - `PATCH /api/v1/knowledge/sources/{id}/approval` với `is_approved = false` (Bỏ duyệt đoạn trích)
   - Sau khi thực hiện thao tác xóa/bỏ duyệt:
     - Tìm kiếm `HandbookDisease` có `ClassCode == source.ModelClass` và `Status == 'PUBLISHED'`.
     - Nếu tồn tại: Tự động cập nhật:
       ```csharp
       handbook.Status = "NEEDS_REVIEW";
       handbook.ReviewReason = $"Đoạn trích nguồn '{source.SourceTitle}' ({source.UnitType}) vừa bị bỏ duyệt/xóa vào {DateTime.UtcNow:dd/MM/yyyy HH:mm}. Vui lòng rà soát lại căn cứ khoa học của bài cẩm nang.";
       ```
2. **API Danh sách Bệnh Admin**:
   - `GET /api/v1/diseases`: Bổ sung trường `handbookStatus` (`NONE`, `DRAFT`, `PUBLISHED`, `NEEDS_REVIEW`) và `handbookReviewReason` để trang `/admin/diseases` hiển thị Badge cảnh báo.

---

## 4. THAY ĐỔI FRONTEND (WEB)

### 4.1. Màn hình Quản trị `/admin/diseases`
1. **Cột Trạng thái Cẩm nang trên Bảng Danh sách**:
   - `Chưa có bài` (Badge xám).
   - `Bản nháp` (Badge vàng nhạt).
   - `Đã xuất bản` (Badge xanh lá `PUBLISHED`).
   - `⚠️ Cần rà soát` (Badge cam nhấp nháy nhẹ `NEEDS_REVIEW` kèm tooltip hiển thị `ReviewReason`).
2. **Nút Thao tác**: Thêm nút **"Biên tập Cẩm nang"** (Icon `BookOpenEdit`) bên cạnh nút "Sửa tác nhân".
3. **Màn hình / Drawer Soạn thảo Cẩm nang (Handbook Editor)**:
   - **Bố cục 2 cột (Split View)**:
     - **Cột Trái (Editor)**:
       - Tiêu đề bài viết & Tác giả biên soạn.
       - Trình soạn thảo Markdown (hỗ trợ thanh công cụ: Bold, Italic, Heading 2/3, Bullet, Bảng, Callout, Chèn trích dẫn).
       - Trình quản lý FAQ: Thêm câu hỏi, nhập câu trả lời, kéo thả sắp xếp FAQ.
     - **Cột Phải (Live Preview & Nguồn tham khảo)**:
       - Tab 1: **Xem trước trực tiếp** (Live Preview đúng giao diện người nông dân sẽ thấy).
       - Tab 2: **Kho đoạn trích nguồn đã duyệt** của bệnh này (có nút "Chép vào bài" để Admin nhanh chóng lấy số liệu khoa học đưa vào bài viết).
   - **Nút hành động**: "Lưu bản nháp" (Draft) và "Xuất bản ngay" (Publish).

### 4.2. Màn hình Sổ tay Người dùng `/handbook/:classCode`
1. **Ưu tiên hiển thị bài viết chuẩn**:
   - Nếu backend trả về bài viết từ `HandbookDiseases`:
     - Render bài viết Markdown với typography đẹp mắt (đúng token thiết kế `ui-ux.md`).
     - Mục FAQ hiển thị dạng Accordion mượt mà từ `faq_items`.
     - Tác giả hiển thị trang trọng: *"Biên soạn bởi: [AuthorName] • Cập nhật lần cuối: [UpdatedAt]"*.
     - Phía cuối bài viết vẫn tích hợp sẵn:
       - Thư viện ảnh mẫu triệu chứng thực tế (`KnowledgeImages`).
       - Sản phẩm thuốc điều trị liên quan (`DiseaseProducts`).
       - Căn cứ khoa học & Tài liệu tham khảo gốc ([1], [2]...).
   - Nếu chưa có bài viết từ `HandbookDiseases`: Giữ nguyên luồng tự động ghép từ `KnowledgeSources` hiện tại (TASK-20).
2. **Banner Cảnh báo dành riêng cho Admin (Admin Invalidation Banner)**:
   - Khi Admin đăng nhập và truy cập trang Handbook của một bệnh đang có trạng thái `NEEDS_REVIEW`:
   - Hiển thị thanh thông báo màu vàng trên đầu trang:
     > ⚠️ **Cảnh báo Quản trị viên**: *Dữ liệu nguồn của bài cẩm nang này vừa có thay đổi ({ReviewReason}).*  
     > Nút: **[Chỉnh sửa cẩm nang ngay]** hoặc **[Xác nhận đã rà soát]**.

---

## 5. KẾ HOẠCH KIỂM THỬ & NGHIỆM THU

### 5.1. Ca kiểm thử Backend
1. **Tạo mới & Cập nhật bài Cẩm nang**:
   - Gọi `PUT /api/v1/admin/handbook/articles/{classCode}` lưu nháp và xuất bản thành công.
   - Gọi `GET /api/v1/handbook/articles/{classCode}` trả về đúng Markdown và danh sách FAQ.
2. **Kiểm thử Tự động Gắn cờ Lỗi thời (Staleness Trigger)**:
   - Xuất bản bài cẩm nang cho bệnh `Tomato___Tomato_mosaic_virus` (`Status = PUBLISHED`).
   - Vào xóa hoặc bỏ duyệt một đoạn trích thuộc bệnh `Tomato___Tomato_mosaic_virus`.
   - Kiểm tra `HandbookDisease` tự động đổi sang `Status = NEEDS_REVIEW` kèm nội dung `ReviewReason` chính xác.
3. **Kiểm thử Xác nhận Rà soát (Review Ack)**:
   - Gọi `POST /api/v1/admin/handbook/articles/{classCode}/review-ack` -> Chuyển trạng thái về lại `PUBLISHED`.
4. **Kiểm thử Tương thích ngược (Fallback)**:
   - Truy cập bệnh chưa có bài cẩm nang -> Hệ thống tự động ghép nối đoạn trích cũ theo TASK-20, không lỗi 404/500.

### 5.2. Ca kiểm thử Frontend
1. **Editor Markdown**:
   - Gõ nội dung ở cột trái -> Cột phải render live preview chuẩn xác theo token Tailwind/shadcn.
   - Thêm 2 câu hỏi FAQ -> Lưu và tải lại trang hiển thị đúng 2 câu hỏi trong Accordion.
2. **Cảnh báo trên giao diện**:
   - Khi có đoạn trích bị bỏ duyệt -> Bảng `/admin/diseases` hiện Badge cam `⚠️ Cần rà soát`.
   - Vào trang `/handbook/...` với quyền Admin thấy banner cảnh báo màu vàng.
   - Bấm nút xác nhận rà soát -> Banner biến mất, badge chuyển sang xanh lá.

---

## 6. QUY TẮC THỰC THI (GUARDRAILS)
- Không chạy migration trực tiếp lên Supabase; chỉ chạy trên Postgres local/test.
- Không dùng `dangerouslySetInnerHTML` không an toàn; sử dụng thư viện Markdown an toàn (`react-markdown` kết hợp plugin vệ sinh DOM `rehype-sanitize`).
- Mọi link ngoài trong Markdown bắt buộc đi qua `safeHref()` và mở tab mới `target="_blank" rel="noopener noreferrer"`.
- Cập nhật `database-schema.md`, `api-contracts.md` và `WORKLOG.md` khi hoàn thành task.
