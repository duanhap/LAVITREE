using System;
using System.Collections.Generic;
using System.Linq;
using Lavitree.Domain.Common;

namespace Lavitree.Domain.Entities;

/// <summary>
/// Hoạt chất BVTV bị cấm (TASK-19). Trạng thái cấm KHÔNG lưu cứng: tính từ lịch sử quyết định
/// (<see cref="BannedSubstanceDecision"/>) theo văn bản pháp lý, để thông tư mới có thể bỏ cấm / cấm lại.
/// Chất không có trong kho vẫn lưu, để Lavi nhắc nông dân.
/// </summary>
public class BannedSubstance : BaseEntity
{
    public int Id { get; set; }
    /// <summary>Tên chung (common name) của hoạt chất, ví dụ "Carbofuran".</summary>
    public string CommonName { get; set; } = string.Empty;
    /// <summary>Tên thương phẩm, cách viết khác ("Furadan", "pa-ra-quat"). Dùng để so khớp.</summary>
    public List<string> Aliases { get; set; } = new();
    /// <summary>INSECTICIDE | FUNGICIDE | HERBICIDE | RODENTICIDE | OTHER</summary>
    public string Category { get; set; } = "OTHER";
    public string? Note { get; set; }

    public ICollection<BannedSubstanceDecision> Decisions { get; set; } = new List<BannedSubstanceDecision>();

    /// <summary>Quyết định đang có hiệu lực tại ngày <paramref name="today"/> (mới nhất theo ngày hiệu lực, rồi theo Id).</summary>
    public BannedSubstanceDecision? CurrentDecision(DateOnly today) =>
        Decisions
            .Where(d => !d.IsDeleted && (d.EffectiveDate == null || d.EffectiveDate <= today))
            .OrderByDescending(d => d.EffectiveDate ?? DateOnly.MinValue)
            .ThenByDescending(d => d.Id)
            .FirstOrDefault();

    public bool IsBannedOn(DateOnly today) => CurrentDecision(today)?.Action == BannedSubstanceDecision.Ban;
}

/// <summary>Một quyết định cấm / bỏ cấm theo văn bản (thông tư, quyết định). Không sửa, chỉ thêm (lịch sử).</summary>
public class BannedSubstanceDecision
{
    public const string Ban = "BAN";
    public const string Unban = "UNBAN";

    public int Id { get; set; }
    public int BannedSubstanceId { get; set; }
    /// <summary>BAN | UNBAN</summary>
    public string Action { get; set; } = Ban;
    /// <summary>Số hiệu văn bản, ví dụ "Thông tư 75/2025/TT-BNNMT".</summary>
    public string LegalDocument { get; set; } = string.Empty;
    /// <summary>Ngày hiệu lực. Null = đã có hiệu lực, chưa ghi ngày (dữ liệu chuyển từ danh sách cũ).</summary>
    public DateOnly? EffectiveDate { get; set; }
    public string? SourceUrl { get; set; }
    public string? Note { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    /// <summary>Gỡ quyết định nhập nhầm (không xóa hẳn, giữ dấu vết).</summary>
    public bool IsDeleted { get; set; }

    public BannedSubstance? BannedSubstance { get; set; }
}
