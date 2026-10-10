using System;
using System.Collections.Generic;

namespace Lavitree.Application.DTOs;

public class DiagnosisResultDto
{
    public Guid RecordId { get; set; }
    public string PlantName { get; set; } = string.Empty;
    public string DiseaseNameVi { get; set; } = string.Empty;
    public string ClassCode { get; set; } = string.Empty;
    public bool IsHealthy { get; set; }
    public float Confidence { get; set; }
    public bool IsUncertain { get; set; }
    public string? WarningMessage { get; set; }
    public string? GradCamImageUrl { get; set; }
    public string OriginalImageUrl { get; set; } = string.Empty;
    public string Symptoms { get; set; } = string.Empty;
    public List<TreatmentStepDto> TreatmentSteps { get; set; } = new();
    public List<ProductDto> RecommendedProducts { get; set; } = new();
    public DateTime DiagnosedAt { get; set; }
}

public class TreatmentStepDto
{
    public int StepOrder { get; set; }
    public string ActionTitle { get; set; } = string.Empty;
    public string Instructions { get; set; } = string.Empty;
    public string? IsolationDays { get; set; }
}

public class ProductDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ActiveIngredient { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string? ImageUrl { get; set; }
    public string DosageInstruction { get; set; } = string.Empty;
}

public class AiPredictionResponse
{
    public string PredictedClass { get; set; } = string.Empty;
    public float Confidence { get; set; }
    public bool IsUncertain { get; set; }
    public string? Warning { get; set; }
    public bool IsHealthy { get; set; }
    public string? GradcamImageBase64 { get; set; }
}
