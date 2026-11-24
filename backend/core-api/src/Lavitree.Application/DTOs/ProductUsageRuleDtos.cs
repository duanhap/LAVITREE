using System;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Lavitree.Domain.Entities;

namespace Lavitree.Application.DTOs;

public class ProductUsageRuleDto
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("product_id")]
    public int ProductId { get; set; }

    [JsonPropertyName("disease_id")]
    public int? DiseaseId { get; set; }

    [JsonPropertyName("class_code")]
    public string? ClassCode { get; set; }

    [JsonPropertyName("disease_name")]
    public string? DiseaseName { get; set; }

    [JsonPropertyName("plant_name")]
    public string? PlantName { get; set; }

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

public class CreateProductUsageRuleDto
{
    [Required(ErrorMessage = "Bệnh hại (class_code) là bắt buộc.")]
    [JsonPropertyName("class_code")]
    public string ClassCode { get; set; } = string.Empty;

    [JsonPropertyName("plant_name")]
    public string? PlantName { get; set; }

    [Required(ErrorMessage = "Phiếu cách dùng (profile) là bắt buộc.")]
    [JsonPropertyName("profile")]
    public UsageProfile Profile { get; set; } = new();

    [MaxLength(20, ErrorMessage = "Nhóm tác động (ActionGroup) tối đa 20 ký tự.")]
    [JsonPropertyName("action_group")]
    public string? ActionGroup { get; set; }

    [MaxLength(500, ErrorMessage = "Link nguồn tối đa 500 ký tự.")]
    [JsonPropertyName("source_url")]
    public string? SourceUrl { get; set; }
}

public class UpdateProductUsageRuleDto
{
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
