using System;
using Lavitree.Domain.Common;

namespace Lavitree.Domain.Entities;

public class DiagnosisRecord : BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid? UserId { get; set; }
    public User? User { get; set; }

    public int DiseaseId { get; set; }
    public Disease Disease { get; set; } = null!;

    public string OriginalImageUrl { get; set; } = string.Empty;
    public string? GradCamImageUrl { get; set; }
    public float Confidence { get; set; }
    public bool IsUncertain { get; set; }
    public string? Notes { get; set; }
    public string? RecoveryStatus { get; set; } // "Đang theo dõi", "Đã phục hồi", "Tái phát"

    // TASK-A03 / BUG-52 / BUG-53: Lưu Top-3, Nhóm nhầm lẫn & Chuyển giao Chuyên gia
    public string? Top3Json { get; set; }
    public string? ConfusionGroup { get; set; }
    public bool RequiresExpert { get; set; } = false;
    public string? ExpertNotes { get; set; }
    public DateTime? ExpertReviewedAt { get; set; }
}
