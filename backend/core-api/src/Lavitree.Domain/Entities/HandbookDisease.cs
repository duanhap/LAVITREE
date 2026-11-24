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
