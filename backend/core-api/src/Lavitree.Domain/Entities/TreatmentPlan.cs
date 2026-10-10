using Lavitree.Domain.Common;

namespace Lavitree.Domain.Entities;

public class TreatmentPlan : BaseEntity
{
    public int Id { get; set; }
    public int DiseaseId { get; set; }
    public Disease Disease { get; set; } = null!;

    public int StepOrder { get; set; } // 1: Cắt tỉa, 2: Phun thuốc đặc trị, 3: Phục hồi
    public string ActionTitle { get; set; } = string.Empty;
    public string Instructions { get; set; } = string.Empty;
    public string? IsolationDays { get; set; } // PHI: "7-14 ngày"
}
