using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;

namespace Lavitree.Domain.Entities;

/// <summary>
/// Phiếu cách dùng vật tư (TASK-18). Lưu ở cột jsonb <c>Products.UsageProfile</c>.
/// Các con số tách riêng để bộ lập lịch phun / nhắc nhở (FEAT-06, xem docs/architecture/treatment-schedule-design.md)
/// tự tính ngày bằng code. Bản đầy đủ dùng lại đúng kiểu này cho từng cây / bệnh (bảng ProductUsageRules).
/// Thời gian cách ly KHÔNG nằm ở đây: dùng <c>Products.PhiDays</c> (một nguồn duy nhất).
/// Trường không biết thì null, không đoán.
/// </summary>
public class UsageProfile
{
    public const int CurrentVersion = 1;
    public const int MaxText = 500;

    [JsonPropertyName("version")]
    public int Version { get; set; } = CurrentVersion;

    /// <summary>Lượng thuốc mỗi lần pha, ví dụ 50 (g) hoặc 20 (ml).</summary>
    [JsonPropertyName("dose_amount")]
    public decimal? DoseAmount { get; set; }

    /// <summary>Đơn vị liều: g, ml, kg, lít, gói, viên...</summary>
    [JsonPropertyName("dose_unit")]
    public string? DoseUnit { get; set; }

    /// <summary>Lượng nước pha cùng liều trên (lít), ví dụ 16 (bình 16 lít).</summary>
    [JsonPropertyName("water_liters")]
    public decimal? WaterLiters { get; set; }

    /// <summary>Liều viết bằng chữ khi không tách được số (chế phẩm tự pha, vôi rắc theo m²...).</summary>
    [JsonPropertyName("dose_text")]
    public string? DoseText { get; set; }

    /// <summary>Liều theo diện tích cho phân, vôi, chế phẩm rắc / bón: ví dụ 20–30 "tấn/ha", 50 "kg/1000 m²".</summary>
    [JsonPropertyName("dose_per_area")]
    public AreaDose? DosePerArea { get; set; }

    /// <summary>Lượng dung dịch phun trên 1 ha (lít).</summary>
    [JsonPropertyName("spray_volume_per_ha")]
    public NumberRange? SprayVolumePerHa { get; set; }

    /// <summary>Cách dùng: phun ướt đều 2 mặt lá, tưới gốc, rắc quanh gốc, ngâm hạt...</summary>
    [JsonPropertyName("method")]
    public string? Method { get; set; }

    /// <summary>Buổi dùng: "sáng sớm", "chiều mát"...</summary>
    [JsonPropertyName("time_of_day")]
    public List<string>? TimeOfDay { get; set; }

    [JsonPropertyName("times_per_day")]
    public int? TimesPerDay { get; set; }

    /// <summary>Khoảng cách giữa 2 lần dùng (ngày).</summary>
    [JsonPropertyName("interval_days")]
    public NumberRange? IntervalDays { get; set; }

    [JsonPropertyName("max_applications_per_season")]
    public int? MaxApplicationsPerSeason { get; set; }

    [JsonPropertyName("start_when")]
    public string? StartWhen { get; set; }

    [JsonPropertyName("stop_when")]
    public string? StopWhen { get; set; }

    [JsonPropertyName("weather_note")]
    public string? WeatherNote { get; set; }

    /// <summary>Không dùng nếu dự báo mưa trong số giờ này sau khi phun.</summary>
    [JsonPropertyName("avoid_rain_hours")]
    public int? AvoidRainHours { get; set; }

    [JsonPropertyName("safety_note")]
    public string? SafetyNote { get; set; }

    /// <summary>Link nguồn của phiếu (Admin đã chọn).</summary>
    [JsonPropertyName("source_url")]
    public string? SourceUrl { get; set; }

    /// <summary>Quy tắc và liều lượng riêng theo từng bệnh hại (key = classCode như Tomato___Late_blight).</summary>
    [JsonPropertyName("disease_rules")]
    public Dictionary<string, DiseaseUsageRuleProfile>? DiseaseRules { get; set; }

    /// <summary>Cắt khoảng trắng, chuỗi rỗng thành null, cắt độ dài, bỏ buổi trùng.</summary>
    public UsageProfile Normalize()
    {
        static string? Clean(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return null;
            var t = s.Trim();
            return t.Length > MaxText ? t[..MaxText] : t;
        }

        Version = CurrentVersion;
        DoseUnit = Clean(DoseUnit);
        DoseText = Clean(DoseText);
        Method = Clean(Method);
        StartWhen = Clean(StartWhen);
        StopWhen = Clean(StopWhen);
        WeatherNote = Clean(WeatherNote);
        SafetyNote = Clean(SafetyNote);
        SourceUrl = Clean(SourceUrl);
        TimeOfDay = TimeOfDay?
            .Select(Clean)
            .Where(s => s != null)
            .Select(s => s!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(4)
            .ToList();
        if (TimeOfDay is { Count: 0 }) TimeOfDay = null;
        if (SprayVolumePerHa is { Min: null, Max: null }) SprayVolumePerHa = null;
        if (DosePerArea != null)
        {
            DosePerArea.Unit = Clean(DosePerArea.Unit);
            if (DosePerArea.Unit is { Length: > 30 }) DosePerArea.Unit = DosePerArea.Unit[..30];
            if (DosePerArea is { Min: null, Max: null }) DosePerArea = null;
        }
        if (IntervalDays is { Min: null, Max: null }) IntervalDays = null;

        if (DiseaseRules != null)
        {
            var cleanedRules = new Dictionary<string, DiseaseUsageRuleProfile>(StringComparer.OrdinalIgnoreCase);
            foreach (var kvp in DiseaseRules)
            {
                if (string.IsNullOrWhiteSpace(kvp.Key)) continue;
                var rule = kvp.Value;
                if (rule != null)
                {
                    rule.UsageProfile?.Normalize();
                    if (!string.IsNullOrWhiteSpace(rule.DosageInstruction) || (rule.UsageProfile != null && !rule.UsageProfile.IsEmpty))
                    {
                        cleanedRules[kvp.Key.Trim()] = rule;
                    }
                }
            }
            DiseaseRules = cleanedRules.Count > 0 ? cleanedRules : null;
        }

        return this;
    }

    /// <summary>Phiếu không có thông tin nào (sau Normalize) thì coi như không có phiếu.</summary>
    [JsonIgnore]
    public bool IsEmpty =>
        DoseAmount == null && DoseUnit == null && WaterLiters == null && DoseText == null && DosePerArea == null &&
        SprayVolumePerHa == null && Method == null && TimeOfDay == null && TimesPerDay == null &&
        IntervalDays == null && MaxApplicationsPerSeason == null && StartWhen == null && StopWhen == null &&
        WeatherNote == null && AvoidRainHours == null && SafetyNote == null && SourceUrl == null &&
        (DiseaseRules == null || DiseaseRules.Count == 0);

    /// <summary>Kiểm tra giới hạn hợp lý. Trả danh sách lỗi (rỗng = hợp lệ).</summary>
    public List<string> Validate()
    {
        var errors = new List<string>();
        if (DoseAmount is < 0 or > 100000) errors.Add("Liều lượng phải từ 0 đến 100000.");
        if (WaterLiters is < 0 or > 100000) errors.Add("Lượng nước pha phải từ 0 đến 100000 lít.");
        if (TimesPerDay is < 1 or > 10) errors.Add("Số lần mỗi ngày phải từ 1 đến 10.");
        if (MaxApplicationsPerSeason is < 1 or > 50) errors.Add("Số lần tối đa mỗi vụ phải từ 1 đến 50.");
        if (AvoidRainHours is < 0 or > 72) errors.Add("Số giờ tránh mưa phải từ 0 đến 72.");
        CheckRange(IntervalDays, 0, 365, "Khoảng cách giữa 2 lần dùng (ngày)", errors);
        CheckRange(SprayVolumePerHa, 0, 100000, "Lượng dung dịch / ha", errors);
        CheckRange(DosePerArea, 0, 1000000, "Liều theo diện tích", errors);
        if (DosePerArea != null && DosePerArea.Unit == null) errors.Add("Liều theo diện tích phải có đơn vị (ví dụ tấn/ha, kg/1000 m²).");
        if (SourceUrl != null &&
            !(Uri.TryCreate(SourceUrl, UriKind.Absolute, out var u) && (u.Scheme == Uri.UriSchemeHttp || u.Scheme == Uri.UriSchemeHttps)))
        {
            errors.Add("Link nguồn của phiếu cách dùng phải là http(s).");
        }
        return errors;
    }

    private static void CheckRange(NumberRange? r, decimal min, decimal max, string label, List<string> errors)
    {
        if (r == null) return;
        if (r.Min is { } a && (a < min || a > max)) errors.Add($"{label}: giá trị nhỏ nhất phải từ {min} đến {max}.");
        if (r.Max is { } b && (b < min || b > max)) errors.Add($"{label}: giá trị lớn nhất phải từ {min} đến {max}.");
        if (r.Min is { } lo && r.Max is { } hi && lo > hi) errors.Add($"{label}: giá trị nhỏ nhất không được lớn hơn giá trị lớn nhất.");
    }
}

/// <summary>Liều theo diện tích: khoảng số + đơn vị (tấn/ha, kg/1000 m², kg/sào...).</summary>
public class AreaDose : NumberRange
{
    [JsonPropertyName("unit")]
    public string? Unit { get; set; }
}

/// <summary>Khoảng số (min–max). Chỉ một giá trị thì để min = max.</summary>
public class NumberRange
{
    [JsonPropertyName("min")]
    public decimal? Min { get; set; }

    [JsonPropertyName("max")]
    public decimal? Max { get; set; }
}

/// <summary>Quy tắc và liều lượng riêng theo từng bệnh hại của thuốc (TASK-21 / TASK-22).</summary>
public class DiseaseUsageRuleProfile
{
    [JsonPropertyName("dosage_instruction")]
    public string? DosageInstruction { get; set; }

    [JsonPropertyName("usage_profile")]
    public UsageProfile? UsageProfile { get; set; }

    [JsonPropertyName("source_url")]
    public string? SourceUrl { get; set; }

    [JsonPropertyName("is_verified")]
    public bool IsVerified { get; set; } = true;
}
