using System;
using System.Text.Json.Serialization;

namespace Lavitree.Application.DTOs;

/// <summary>
/// DTO thời tiết cục bộ và đánh giá rủi ro rửa trôi thuốc BVTV (SSOT: api-contracts.md Mục 3.9)
/// </summary>
public class WeatherForecastDto
{
    [JsonPropertyName("location")]
    public string Location { get; set; } = string.Empty;

    [JsonPropertyName("temperature_c")]
    public double TemperatureC { get; set; }

    [JsonPropertyName("humidity_percent")]
    public int HumidityPercent { get; set; }

    [JsonPropertyName("rainfall_probability_percent")]
    public int RainfallProbabilityPercent { get; set; }

    [JsonPropertyName("rainfall_mm")]
    public double RainfallMm { get; set; }

    [JsonPropertyName("is_rain")]
    public bool IsRain { get; set; }

    [JsonPropertyName("risk_level")]
    public string RiskLevel { get; set; } = "LOW";

    [JsonPropertyName("recommendation")]
    public string Recommendation { get; set; } = string.Empty;

    [JsonPropertyName("forecast_hours")]
    public int ForecastHours { get; set; } = 12;

    [JsonPropertyName("is_simulated")]
    public bool IsSimulated { get; set; } = false;

    [JsonPropertyName("cached_at")]
    public DateTime CachedAt { get; set; } = DateTime.UtcNow;
}
