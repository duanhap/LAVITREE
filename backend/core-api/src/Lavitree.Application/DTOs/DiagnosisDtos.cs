using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace Lavitree.Application.DTOs;

#region AI Service DTOs

public class AiPredictionResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; } = true;

    [JsonPropertyName("top1")]
    public AiClassPrediction? Top1 { get; set; }

    [JsonPropertyName("top3")]
    public List<AiClassPrediction> Top3 { get; set; } = new();

    [JsonPropertyName("is_ood")]
    public bool IsOod { get; set; }

    [JsonPropertyName("is_uncertain")]
    public bool IsUncertain { get; set; }

    [JsonPropertyName("warning_message")]
    public string? WarningMessage { get; set; }

    [JsonPropertyName("gradcam_base64")]
    public string? GradcamBase64 { get; set; }

    [JsonPropertyName("inference_time_ms")]
    public int InferenceTimeMs { get; set; }
}

public class AiClassPrediction
{
    [JsonPropertyName("class_code")]
    public string ClassCode { get; set; } = string.Empty;

    [JsonPropertyName("plant_name")]
    public string PlantName { get; set; } = string.Empty;

    [JsonPropertyName("disease_name")]
    public string DiseaseName { get; set; } = string.Empty;

    [JsonPropertyName("plant_name_vi")]
    public string? PlantNameVi { get; set; }

    [JsonPropertyName("disease_name_vi")]
    public string? DiseaseNameVi { get; set; }

    [JsonPropertyName("confidence")]
    public float Confidence { get; set; }

    [JsonPropertyName("capture_tip")]
    public string? CaptureTip { get; set; }

    [JsonPropertyName("confusion_group")]
    public string? ConfusionGroup { get; set; }

    [JsonPropertyName("is_healthy")]
    public bool IsHealthy { get; set; }

    public string EffectivePlantName => !string.IsNullOrEmpty(PlantName) ? PlantName : (PlantNameVi ?? string.Empty);
    public string EffectiveDiseaseName => !string.IsNullOrEmpty(DiseaseName) ? DiseaseName : (DiseaseNameVi ?? string.Empty);
}

#endregion

#region Core API Diagnose DTOs (SSOT: api-contracts.md Mục 3.1)

public class DiagnoseResponseDto
{
    [JsonPropertyName("success")]
    public bool Success { get; set; } = true;

    [JsonPropertyName("diagnosis_id")]
    public Guid? DiagnosisId { get; set; }

    [JsonPropertyName("is_ood")]
    public bool IsOod { get; set; }

    [JsonPropertyName("is_uncertain")]
    public bool IsUncertain { get; set; }

    [JsonPropertyName("warning")]
    public string? Warning { get; set; }

    [JsonPropertyName("result")]
    public DiagnoseResultDataDto? Result { get; set; }

    [JsonPropertyName("visual_evidence")]
    public VisualEvidenceDto? VisualEvidence { get; set; }

    [JsonPropertyName("treatment_guidelines")]
    public List<TreatmentStepDto> TreatmentGuidelines { get; set; } = new();

    [JsonPropertyName("recommended_products")]
    public List<ProductDto> RecommendedProducts { get; set; } = new();

    [JsonPropertyName("verified_sources")]
    public List<VerifiedSourceDto> VerifiedSources { get; set; } = new();
}

public class DiagnoseResultDataDto
{
    [JsonPropertyName("plant_name")]
    public string PlantName { get; set; } = string.Empty;

    [JsonPropertyName("disease_name")]
    public string DiseaseName { get; set; } = string.Empty;

    [JsonPropertyName("class_code")]
    public string ClassCode { get; set; } = string.Empty;

    [JsonPropertyName("confidence")]
    public float Confidence { get; set; }

    [JsonPropertyName("severity_level")]
    public string SeverityLevel { get; set; } = string.Empty;

    [JsonPropertyName("is_uncertain")]
    public bool IsUncertain { get; set; }

    [JsonPropertyName("confusion_group")]
    public string? ConfusionGroup { get; set; }

    [JsonPropertyName("warning")]
    public string? Warning { get; set; }

    [JsonPropertyName("top3")]
    public List<Top3ItemDto> Top3 { get; set; } = new();
}

public class Top3ItemDto
{
    [JsonPropertyName("class_code")]
    public string ClassCode { get; set; } = string.Empty;

    [JsonPropertyName("disease_name")]
    public string DiseaseName { get; set; } = string.Empty;

    [JsonPropertyName("confidence")]
    public float Confidence { get; set; }
}

public class VisualEvidenceDto
{
    [JsonPropertyName("original_image_url")]
    public string OriginalImageUrl { get; set; } = string.Empty;

    [JsonPropertyName("gradcam_image_url")]
    public string? GradcamImageUrl { get; set; }
}

public class TreatmentStepDto
{
    [JsonPropertyName("step_order")]
    public int StepOrder { get; set; }

    [JsonPropertyName("action_title")]
    public string ActionTitle { get; set; } = string.Empty;

    [JsonPropertyName("instructions")]
    public string Instructions { get; set; } = string.Empty;

    [JsonPropertyName("isolation_days")]
    public string? IsolationDays { get; set; }
}

public class ProductDto
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("active_ingredient")]
    public string ActiveIngredient { get; set; } = string.Empty;

    [JsonPropertyName("price")]
    public decimal Price { get; set; }

    [JsonPropertyName("unit")]
    public string Unit { get; set; } = "Gói / Chai chuẩn";

    [JsonPropertyName("image_url")]
    public string? ImageUrl { get; set; }

    [JsonPropertyName("dosage_instruction")]
    public string? DosageInstruction { get; set; }
}

public class VerifiedSourceDto
{
    [JsonPropertyName("organization")]
    public string Organization { get; set; } = string.Empty;

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("url")]
    public string Url { get; set; } = string.Empty;
}

#endregion
