using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Lavitree.Domain.Entities;

namespace Lavitree.Application.DTOs;

/// <summary>Một dòng ProductUsageRules (TASK-22 / TASK-29).</summary>
public class ProductUsageRuleDto
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("product_id")]
    public int ProductId { get; set; }

    /// <summary>"plant" = liều chung của cây; "disease" = liều riêng cho bệnh.</summary>
    [JsonPropertyName("scope")]
    public string Scope { get; set; } = "plant";

    [JsonPropertyName("plant_id")]
    public int PlantId { get; set; }

    [JsonPropertyName("plant_name")]
    public string? PlantName { get; set; }

    [JsonPropertyName("disease_id")]
    public int? DiseaseId { get; set; }

    [JsonPropertyName("class_code")]
    public string? ClassCode { get; set; }

    [JsonPropertyName("disease_name")]
    public string? DiseaseName { get; set; }

    [JsonPropertyName("dosage_instruction")]
    public string? DosageInstruction { get; set; }

    [JsonPropertyName("profile")]
    public UsageProfile Profile { get; set; } = new();

    [JsonPropertyName("action_group")]
    public string? ActionGroup { get; set; }

    [JsonPropertyName("source_url")]
    public string? SourceUrl { get; set; }

    [JsonPropertyName("is_verified")]
    public bool IsVerified { get; set; }

    [JsonPropertyName("verified_by")]
    public string? VerifiedBy { get; set; }

    [JsonPropertyName("verified_at")]
    public DateTime? VerifiedAt { get; set; }

    [JsonPropertyName("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>
/// Tạo liều. Có <c>class_code</c> = liều riêng cho bệnh đó; không có = liều chung của cây
/// (khi đó cần <c>plant_id</c> hoặc <c>plant_name</c>).
/// </summary>
public class CreateProductUsageRuleDto
{
    [JsonPropertyName("class_code")]
    public string? ClassCode { get; set; }

    [JsonPropertyName("plant_id")]
    public int? PlantId { get; set; }

    [JsonPropertyName("plant_name")]
    public string? PlantName { get; set; }

    [JsonPropertyName("dosage_instruction")]
    public string? DosageInstruction { get; set; }

    [JsonPropertyName("profile")]
    public UsageProfile? Profile { get; set; }

    [MaxLength(20, ErrorMessage = "Nhóm tác động (ActionGroup) tối đa 20 ký tự.")]
    [JsonPropertyName("action_group")]
    public string? ActionGroup { get; set; }

    [MaxLength(500, ErrorMessage = "Link nguồn tối đa 500 ký tự.")]
    [JsonPropertyName("source_url")]
    public string? SourceUrl { get; set; }
}

public class UpdateProductUsageRuleDto
{
    /// <summary>null = giữ nguyên; chuỗi rỗng = xóa đoạn chữ.</summary>
    [JsonPropertyName("dosage_instruction")]
    public string? DosageInstruction { get; set; }

    [JsonPropertyName("profile")]
    public UsageProfile? Profile { get; set; }

    [MaxLength(20, ErrorMessage = "Nhóm tác động (ActionGroup) tối đa 20 ký tự.")]
    [JsonPropertyName("action_group")]
    public string? ActionGroup { get; set; }

    [MaxLength(500, ErrorMessage = "Link nguồn tối đa 500 ký tự.")]
    [JsonPropertyName("source_url")]
    public string? SourceUrl { get; set; }
}

public class VerifyProductUsageRuleDto
{
    [JsonPropertyName("verified")]
    public bool Verified { get; set; }
}

/// <summary>
/// Một liều trong bản xem <c>usage_profile.plant_rules</c> / <c>usage_profile.disease_rules</c> (chỉ đọc).
/// Giữ đúng hình dạng JSON cũ để web và các form gắn vật tư không phải đổi cách đọc.
/// </summary>
public class UsageRuleView
{
    [JsonPropertyName("rule_id")]
    public int RuleId { get; set; }

    /// <summary>"plant" = bệnh đang dùng liều chung của cây; "disease" = bệnh có liều riêng.</summary>
    [JsonPropertyName("scope")]
    public string Scope { get; set; } = "plant";

    [JsonPropertyName("plant_name")]
    public string? PlantName { get; set; }

    [JsonPropertyName("dosage_instruction")]
    public string? DosageInstruction { get; set; }

    [JsonPropertyName("usage_profile")]
    public UsageProfile? UsageProfile { get; set; }

    [JsonPropertyName("source_url")]
    public string? SourceUrl { get; set; }

    [JsonPropertyName("is_verified")]
    public bool IsVerified { get; set; }
}

/// <summary>
/// Phiếu cách dùng trả về cho client: phiếu bao bì (phẳng) + bản xem liều theo cây / bệnh tính từ ProductUsageRules.
/// Hai từ điển chỉ để đọc; gửi lại trong PATCH /medicines/{id} thì bị bỏ qua (sửa liều qua /usage-rules).
/// </summary>
public class UsageProfileView : UsageProfile
{
    /// <summary>Liều chung theo cây, key = tên cây (PlantCategories.Name).</summary>
    [JsonPropertyName("plant_rules")]
    public Dictionary<string, UsageRuleView>? PlantRules { get; set; }

    /// <summary>Liều đang áp dụng cho từng bệnh đã gắn (liều riêng nếu có, không thì liều chung của cây), key = ClassCode.</summary>
    [JsonPropertyName("disease_rules")]
    public Dictionary<string, UsageRuleView>? DiseaseRules { get; set; }
}
