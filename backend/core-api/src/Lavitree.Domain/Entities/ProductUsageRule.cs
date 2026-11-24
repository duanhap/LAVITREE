using System;
using Lavitree.Domain.Common;

namespace Lavitree.Domain.Entities;

/// <summary>
/// Liều dùng của một vật tư theo cây trồng (TASK-22, tách khỏi JSON ở TASK-29).
/// <list type="bullet">
/// <item><c>DiseaseId == null</c>: liều chung của vật tư cho cây <c>PlantId</c>; mọi bệnh của cây tự dùng liều này.</item>
/// <item><c>DiseaseId != null</c>: liều riêng (ngoại lệ) cho một bệnh; bệnh phải thuộc cây <c>PlantId</c>.</item>
/// </list>
/// Mỗi (vật tư, cây) chỉ có 1 liều chung và mỗi (vật tư, bệnh) chỉ có 1 liều riêng (chỉ mục duy nhất, bỏ qua dòng đã xóa).
/// Thứ tự lấy liều: xem <c>UsageRuleResolver</c>.
/// </summary>
public class ProductUsageRule : BaseEntity
{
    public int Id { get; set; }

    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;

    /// <summary>Cây trồng áp dụng (bắt buộc).</summary>
    public int PlantId { get; set; }
    public PlantCategory Plant { get; set; } = null!;

    /// <summary>Bệnh áp dụng; null = liều chung cho mọi bệnh của cây.</summary>
    public int? DiseaseId { get; set; }
    public Disease? Disease { get; set; }

    /// <summary>Đoạn hướng dẫn liều bằng chữ, hiển thị cho người dùng.</summary>
    public string? DosageInstruction { get; set; }

    /// <summary>Phiếu cách dùng dạng số (liều, lượng nước, buổi, khoảng cách ngày...).</summary>
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
