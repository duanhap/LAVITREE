using System;
using Lavitree.Domain.Common;

namespace Lavitree.Domain.Entities;

public class KnowledgeSource : BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    // Model Class mapping (e.g. "Tomato___Late_blight")
    public string ModelClass { get; set; } = string.Empty;
    public string PlantName { get; set; } = string.Empty;
    public string DiseaseName { get; set; } = string.Empty;

    // Source Metadata
    public string SourceUrl { get; set; } = string.Empty;
    public string SourceTitle { get; set; } = string.Empty;
    public string Organization { get; set; } = string.Empty; // Tác giả / Viện nghiên cứu / Trường ĐH
    public string? PublishedDate { get; set; } = string.Empty; // Ngày / Năm xuất bản hoặc cập nhật
    public string SourceScope { get; set; } = "Việt Nam"; // Việt Nam | Quốc tế
    
    // Evidence Content
    public string EvidenceText { get; set; } = string.Empty; // Ý chính trích dẫn triệu chứng / phòng ngừa
    public string ContentType { get; set; } = "Triệu chứng & Biện pháp"; // Triệu chứng | Phòng ngừa | Canh tác | Thuốc điều trị
    public string MatchLevel { get; set; } = "Khớp trực tiếp"; // Khớp trực tiếp | Gần nghĩa / Cần kiểm tra | Tham khảo chung

    // Quality & Approval Status
    public string SourceQuality { get; set; } = "Cao"; // Cao | Trung bình | Duyệt ngoại lệ
    public bool IsManualApproved { get; set; } = false; // Đã bàn bạc nội bộ / Duyệt ngoại lệ
    public string? ReviewerNotes { get; set; } // Ghi chú của nhóm khi duyệt ngoại lệ
}
