using Lavitree.Domain.Common;

namespace Lavitree.Domain.Entities;

public class TreatmentPlan : BaseEntity
{
    public int Id { get; set; }
    public int DiseaseId { get; set; }
    public Disease Disease { get; set; } = null!;

    public int StepOrder { get; set; } // Thứ tự bước: 1. Canh tác/Cắt tỉa, 2. Biện pháp Sinh học/Hóa học (khi có), 3. Phục hồi dinh dưỡng (hoặc quy trình chăm sóc nếu cây khỏe)
    public string ActionTitle { get; set; } = string.Empty;
    public string Instructions { get; set; } = string.Empty;
    public string? IsolationDays { get; set; } // PHI (thời gian cách ly an toàn nếu dùng thuốc BVTV): ví dụ "7-14 ngày"
}
