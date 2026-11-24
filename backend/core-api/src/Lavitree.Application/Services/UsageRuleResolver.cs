using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Lavitree.Application.DTOs;
using Lavitree.Domain.Entities;

namespace Lavitree.Application.Services;

/// <summary>
/// Chọn liều cho một cặp (vật tư, bệnh) theo thứ tự cố định (TASK-29):
/// 1. liều riêng của bệnh (DiseaseId = bệnh);
/// 2. liều chung của cây chứa bệnh (PlantId = cây, DiseaseId = null);
/// 3. không có → client hiển thị phiếu bao bì của sản phẩm (Products.UsageProfile / DosageInstruction).
/// Mọi nơi cần liều theo bệnh (API sản phẩm, form gắn gợi ý, lập lịch sau này) đều đi qua lớp này.
/// </summary>
public static class UsageRuleResolver
{
    /// <summary>Bệnh đã gắn với vật tư, đủ để tra liều.</summary>
    public readonly record struct LinkedDisease(int DiseaseId, int PlantId, string ClassCode);

    /// <param name="rules">Các dòng chưa xóa của MỘT vật tư.</param>
    public static ProductUsageRule? Resolve(IEnumerable<ProductUsageRule> rules, int diseaseId, int plantId)
    {
        var list = rules as IReadOnlyCollection<ProductUsageRule> ?? rules.ToList();
        return list.FirstOrDefault(r => !r.IsDeleted && r.DiseaseId == diseaseId)
            ?? list.FirstOrDefault(r => !r.IsDeleted && r.DiseaseId == null && r.PlantId == plantId);
    }

    /// <summary>
    /// Ghép phiếu bao bì với bản xem liều theo cây / bệnh. Trả null khi không có phiếu và không có liều nào
    /// (giữ đúng hành vi cũ: <c>usage_profile: null</c>).
    /// </summary>
    /// <param name="rules">Các dòng chưa xóa của vật tư, đã nạp Plant.</param>
    public static UsageProfileView? BuildView(
        UsageProfile? packageProfile,
        IReadOnlyCollection<ProductUsageRule> rules,
        IEnumerable<LinkedDisease> linkedDiseases)
    {
        var active = rules.Where(r => !r.IsDeleted).ToList();
        if (packageProfile == null && active.Count == 0) return null;

        var view = packageProfile == null
            ? new UsageProfileView()
            : JsonSerializer.Deserialize<UsageProfileView>(JsonSerializer.Serialize(packageProfile)) ?? new UsageProfileView();

        var plantRules = new Dictionary<string, UsageRuleView>(StringComparer.OrdinalIgnoreCase);
        foreach (var r in active.Where(r => r.DiseaseId == null))
        {
            var name = r.Plant?.Name;
            if (!string.IsNullOrWhiteSpace(name)) plantRules[name] = ToView(r);
        }

        var diseaseRules = new Dictionary<string, UsageRuleView>(StringComparer.OrdinalIgnoreCase);
        foreach (var d in linkedDiseases)
        {
            var rule = Resolve(active, d.DiseaseId, d.PlantId);
            if (rule != null && !string.IsNullOrWhiteSpace(d.ClassCode)) diseaseRules[d.ClassCode] = ToView(rule);
        }

        view.PlantRules = plantRules.Count > 0 ? plantRules : null;
        view.DiseaseRules = diseaseRules.Count > 0 ? diseaseRules : null;
        return view;
    }

    public static UsageRuleView ToView(ProductUsageRule r) => new()
    {
        RuleId = r.Id,
        Scope = r.DiseaseId == null ? "plant" : "disease",
        PlantName = r.Plant?.Name,
        DosageInstruction = r.DosageInstruction,
        UsageProfile = r.Profile == null || r.Profile.IsEmpty ? null : r.Profile,
        SourceUrl = r.SourceUrl,
        IsVerified = r.IsVerified,
    };

    /// <summary>Hai liều có cùng nội dung (chữ + phiếu) không. Link nguồn không tính.</summary>
    public static bool SameContent(ProductUsageRule rule, string? dosageInstruction, UsageProfile? profile)
    {
        static string Text(string? s) => (s ?? string.Empty).Trim();
        static string Json(UsageProfile? p) => p == null || p.IsEmpty ? string.Empty : JsonSerializer.Serialize(p);
        return Text(rule.DosageInstruction) == Text(dosageInstruction) && Json(rule.Profile) == Json(profile);
    }
}
