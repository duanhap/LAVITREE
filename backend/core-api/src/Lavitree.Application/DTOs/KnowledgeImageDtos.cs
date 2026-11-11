using System;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Lavitree.Application.DTOs;

public class KnowledgeImageDto
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("model_class")]
    public string ModelClass { get; set; } = string.Empty;

    [JsonPropertyName("plant_name")]
    public string PlantName { get; set; } = string.Empty;

    [JsonPropertyName("disease_name")]
    public string DiseaseName { get; set; } = string.Empty;

    [JsonPropertyName("source_url")]
    public string SourceUrl { get; set; } = string.Empty;

    [JsonPropertyName("image_url")]
    public string ImageUrl { get; set; } = string.Empty;

    [JsonPropertyName("storage_key")]
    public string? StorageKey { get; set; }

    [JsonPropertyName("caption")]
    public string Caption { get; set; } = string.Empty;

    [JsonPropertyName("plant_part")]
    public string PlantPart { get; set; } = "LEAF"; // LEAF | FRUIT | STEM | WHOLE_PLANT

    [JsonPropertyName("credit")]
    public string Credit { get; set; } = string.Empty;

    [JsonPropertyName("license_note")]
    public string? LicenseNote { get; set; }

    [JsonPropertyName("is_manual_approved")]
    public bool IsManualApproved { get; set; }

    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }
}

public class CreateKnowledgeImageRequestDto
{
    [Required(ErrorMessage = "Mã lớp bệnh (model_class) không được để trống.")]
    public string ModelClass { get; set; } = string.Empty;

    [Required(ErrorMessage = "Đường dẫn bài viết gốc (source_url) không được để trống.")]
    [Url(ErrorMessage = "Đường dẫn bài viết phải là URL hợp lệ.")]
    public string SourceUrl { get; set; } = string.Empty;

    [MaxLength(500, ErrorMessage = "URL ảnh không được vượt quá 500 ký tự.")]
    public string? ImageUrl { get; set; }

    [Required(ErrorMessage = "Chú thích ảnh triệu chứng không được để trống.")]
    [MaxLength(300, ErrorMessage = "Chú thích không được vượt quá 300 ký tự.")]
    public string Caption { get; set; } = string.Empty;

    [Required(ErrorMessage = "Bộ phận cây không được để trống.")]
    [RegularExpression(@"^(LEAF|FRUIT|STEM|WHOLE_PLANT)$", ErrorMessage = "Bộ phận cây phải thuộc: LEAF, FRUIT, STEM, WHOLE_PLANT.")]
    public string PlantPart { get; set; } = "LEAF";

    [Required(ErrorMessage = "Nguồn / Tác giả sở hữu ảnh không được để trống.")]
    [MaxLength(200, ErrorMessage = "Tác giả / nguồn ảnh không được vượt quá 200 ký tự.")]
    public string Credit { get; set; } = string.Empty;

    [MaxLength(200, ErrorMessage = "Ghi chú giấy phép không được vượt quá 200 ký tự.")]
    public string? LicenseNote { get; set; }

    public bool? IsManualApproved { get; set; } = true;
}

public class ApproveKnowledgeImageRequestDto
{
    [JsonPropertyName("is_approved")]
    public bool IsApproved { get; set; } = true;
}
