using System;
using Lavitree.Domain.Common;

namespace Lavitree.Domain.Entities;

/// <summary>
/// Phiếu cách dùng thuốc theo từng bệnh / cây trồng (TASK-22).
/// Cung cấp dữ liệu chi tiết có kiểm định để AI Agent lập lịch phun (CareSchedules / CareTasks).
/// </summary>
public class ProductUsageRule : BaseEntity
{
    public int Id { get; set; }

    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;

    /// <summary>Bệnh áp dụng (null = áp dụng mọi bệnh của cây).</summary>
    public int? DiseaseId { get; set; }
    public Disease? Disease { get; set; }

    /// <summary>Tên loài cây trồng (null = lấy theo cây của DiseaseId hoặc mọi cây).</summary>
    public string? PlantName { get; set; }

    /// <summary>Nội dung phiếu cách dùng (liều, lượng nước, buổi, khoảng cách ngày...).</summary>
    public UsageProfile Profile { get; set; } = new();

    /// <summary>Nhóm tác động (FRAC / IRAC) để luân phiên thuốc chống kháng.</summary>
    public string? ActionGroup { get; set; }

    /// <summary>Link nguồn tra cứu hoặc nhãn thuốc tham khảo.</summary>
    public string? SourceUrl { get; set; }

    /// <summary>Đã đối chiếu với nhãn hoặc nguồn. Chỉ phiếu đã đối chiếu mới dùng để lập lịch.</summary>
    public bool IsVerified { get; set; } = false;

    public string? VerifiedBy { get; set; }
    public DateTime? VerifiedAt { get; set; }
}
