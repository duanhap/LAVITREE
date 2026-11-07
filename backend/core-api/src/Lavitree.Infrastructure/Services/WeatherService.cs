using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Lavitree.Application.DTOs;
using Lavitree.Application.Interfaces;

namespace Lavitree.Infrastructure.Services;

/// <summary>
/// WeatherService: Tra cứu thời tiết cục bộ và đánh giá rủi ro rửa trôi thuốc BVTV (SSOT: api-contracts.md Mục 3.9).
/// Áp dụng IMemoryCache TTL = 1 giờ (3600s) theo location và forecastHours để tránh lãng phí quota và giảm độ trễ (< 20ms cache hit).
/// </summary>
public class WeatherService : IWeatherService
{
    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private readonly ILogger<WeatherService> _logger;

    public WeatherService(
        HttpClient httpClient,
        IMemoryCache cache,
        ILogger<WeatherService> logger)
    {
        _httpClient = httpClient;
        _cache = cache;
        _logger = logger;
    }

    public async Task<WeatherForecastDto> GetWeatherForecastAsync(string location, int forecastHours = 12, CancellationToken cancellationToken = default)
    {
        if (forecastHours <= 0) forecastHours = 12;
        var displayLocation = string.IsNullOrWhiteSpace(location) ? "Hà Nam" : location.Trim();
        var cacheKey = $"weather_{Regex.Replace(displayLocation.ToLowerInvariant(), @"\s+", "_")}_{forecastHours}";

        if (_cache.TryGetValue<WeatherForecastDto>(cacheKey, out var cachedResult) && cachedResult != null)
        {
            _logger.LogInformation("Weather cache hit for location '{Location}' (Forecast: {Hours}h).", displayLocation, forecastHours);
            return cachedResult;
        }

        // Đọc các biến môi trường tương thích
        var apiKey = Environment.GetEnvironmentVariable("OPENWEATHER_API_KEY")
            ?? Environment.GetEnvironmentVariable("OPENWEATHERMAP_API_KEY")
            ?? Environment.GetEnvironmentVariable("WEATHER_API_KEY");

        if (string.IsNullOrWhiteSpace(apiKey) || apiKey.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("OPENWEATHER_API_KEY is not configured.");
            return SimulateOrThrow(displayLocation, forecastHours, cacheKey);
        }

        try
        {
            var forecast = await FetchFromOpenWeatherMapAsync(displayLocation, forecastHours, apiKey, cancellationToken);
            // Chỉ cache 1 giờ khi kết quả từ API thời tiết thật thành công
            _cache.Set(cacheKey, forecast, TimeSpan.FromHours(1));
            _logger.LogInformation("Cached live weather forecast for '{Location}' ({Hours}h) with TTL 1 hour.", displayLocation, forecastHours);
            return forecast;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Client tự huỷ request. HttpClient hết giờ chờ thì không vào đây mà xử lý như lỗi API.
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "OpenWeatherMap API error for '{Location}'.", displayLocation);
            return SimulateOrThrow(displayLocation, forecastHours, cacheKey);
        }
    }

    /// <summary>
    /// Production không được trả thời tiết giả: nông dân có thể phun thuốc ngay trước cơn mưa.
    /// Chỉ giả lập khi chạy Development hoặc bật rõ ENABLE_DEV_FALLBACK=true (giống danh mục thuốc).
    /// </summary>
    private WeatherForecastDto SimulateOrThrow(string location, int forecastHours, string cacheKey)
    {
        var isDevelopment = string.Equals(
            Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase);
        if (!isDevelopment && Environment.GetEnvironmentVariable("ENABLE_DEV_FALLBACK") != "true")
        {
            throw new WeatherUnavailableException();
        }

        var forecast = GenerateSimulatedForecast(location, forecastHours);
        // Dữ liệu giả lập chỉ lưu đệm ngắn hạn (1 phút) để sớm retry kết nối thật
        _cache.Set(cacheKey, forecast, TimeSpan.FromMinutes(1));
        return forecast;
    }

    private static string MapLocationToOpenWeatherQuery(string location)
    {
        var norm = location.Trim().ToLowerInvariant();
        if (norm.Contains("hà nam") || norm.Contains("ha nam")) return "Phu Ly,VN";
        if (norm.Contains("hà nội") || norm.Contains("ha noi")) return "Hanoi,VN";
        if (norm.Contains("đà lạt") || norm.Contains("lâm đồng") || norm.Contains("da lat") || norm.Contains("lam dong")) return "Da Lat,VN";
        if (norm.Contains("cần thơ") || norm.Contains("can tho")) return "Can Tho,VN";
        if (norm.Contains("hồ chí minh") || norm.Contains("sài gòn") || norm.Contains("ho chi minh") || norm.Contains("sai gon") || norm.Contains("tp.hcm")) return "Ho Chi Minh City,VN";
        if (norm.Contains("hải phòng") || norm.Contains("hai phong")) return "Hai Phong,VN";
        if (norm.Contains("đà nẵng") || norm.Contains("da nang")) return "Da Nang,VN";
        if (norm.Contains("bắc giang") || norm.Contains("bac giang")) return "Bac Giang,VN";
        if (norm.Contains("sơn la") || norm.Contains("son la")) return "Son La,VN";
        if (norm.Contains("pleiku") || norm.Contains("gia lai")) return "Pleiku,VN";
        if (norm.Contains("buôn ma thuột") || norm.Contains("đắk lắk") || norm.Contains("dak lak")) return "Buon Ma Thuot,VN";
        return $"{Uri.EscapeDataString(location.Trim())},VN";
    }

    private async Task<WeatherForecastDto> FetchFromOpenWeatherMapAsync(string location, int forecastHours, string apiKey, CancellationToken cancellationToken)
    {
        var queryCity = MapLocationToOpenWeatherQuery(location);

        // 5-day / 3-hour Forecast API: mỗi mục cách nhau 3 giờ, tối đa 40 mục.
        // Không dùng Current Weather làm dự phòng: "đang khô" không có nghĩa là khô trong các giờ tới.
        var forecastUrl = $"https://api.openweathermap.org/data/2.5/forecast?q={queryCity}&appid={apiKey}&units=metric&lang=vi";
        using var response = await _httpClient.GetAsync(forecastUrl, cancellationToken);
        response.EnsureSuccessStatusCode();

        using var jsonDoc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
        var listElement = jsonDoc.RootElement.GetProperty("list");

        int intervalsCount = Math.Clamp((int)Math.Ceiling(forecastHours / 3.0), 1, 40);
        double totalRainMm = 0.0;
        int maxRainProb = 0;
        double sumTemp = 0.0;
        int maxHumidity = 0;
        int counted = 0;

        foreach (var item in listElement.EnumerateArray())
        {
            if (counted >= intervalsCount) break;

            var main = item.GetProperty("main");
            sumTemp += main.GetProperty("temp").GetDouble();
            maxHumidity = Math.Max(maxHumidity, main.GetProperty("humidity").GetInt32());

            // pop: probability of precipitation (0.0 -> 1.0)
            if (item.TryGetProperty("pop", out var popProp))
            {
                maxRainProb = Math.Max(maxRainProb, (int)Math.Round(popProp.GetDouble() * 100));
            }

            // rain.3h: lượng mưa 3 giờ
            if (item.TryGetProperty("rain", out var rainProp) && rainProp.TryGetProperty("3h", out var r3h))
            {
                totalRainMm += r3h.GetDouble();
            }

            counted++;
        }

        if (counted == 0)
        {
            throw new InvalidOperationException("OpenWeatherMap returned an empty forecast list.");
        }

        return BuildForecastResult(location, Math.Round(sumTemp / counted, 1), maxHumidity, maxRainProb, Math.Round(totalRainMm, 1), forecastHours, isSimulated: false);
    }

    /// <summary>
    /// Thuật toán FNV-1a Hash cố định (deterministic) an toàn, không bị biến đổi giữa các lần restart server.
    /// </summary>
    private static uint ComputeDeterministicHash(string input)
    {
        uint hash = 2166136261;
        foreach (char c in input)
        {
            hash = (hash ^ c) * 16777619;
        }
        return hash;
    }

    private WeatherForecastDto GenerateSimulatedForecast(string location, int forecastHours)
    {
        var normalized = location.Trim().ToLowerInvariant();

        // Mẫu chuẩn đặc thù vùng nông nghiệp Việt Nam
        if (normalized.Contains("hà nam") || normalized.Contains("ha nam"))
        {
            return BuildForecastResult(location, 28.5, 92, 85, 20.0, forecastHours, isSimulated: true);
        }
        if (normalized.Contains("hà nội") || normalized.Contains("ha noi"))
        {
            return BuildForecastResult(location, 29.0, 88, 75, 15.0, forecastHours, isSimulated: true);
        }
        if (normalized.Contains("lâm đồng") || normalized.Contains("đà lạt") || normalized.Contains("lam dong") || normalized.Contains("da lat"))
        {
            return BuildForecastResult(location, 22.0, 85, 55, 8.0, forecastHours, isSimulated: true);
        }
        if (normalized.Contains("cần thơ") || normalized.Contains("can tho") || normalized.Contains("tiền giang"))
        {
            return BuildForecastResult(location, 31.0, 82, 45, 5.0, forecastHours, isSimulated: true);
        }
        if (normalized.Contains("sơn la") || normalized.Contains("son la") || normalized.Contains("bắc giang"))
        {
            return BuildForecastResult(location, 25.5, 70, 20, 0.0, forecastHours, isSimulated: true);
        }
        if (normalized.Contains("gia lai") || normalized.Contains("đắk lắk") || normalized.Contains("dak lak"))
        {
            return BuildForecastResult(location, 26.5, 68, 15, 0.0, forecastHours, isSimulated: true);
        }

        // Băm FNV-1a ổn định tuyệt đối
        uint hash = ComputeDeterministicHash(normalized);
        double temp = 25.0 + (hash % 90) / 10.0; // 25.0 -> 34.0 C
        int hum = 65 + (int)(hash % 30); // 65 -> 95 %
        int rainProb = Math.Clamp((int)((hash * 7u) % 100u), 0, 100);
        double rainMm = rainProb > 60 ? Math.Round((rainProb - 50) * 0.4 * (forecastHours / 12.0), 1) : 0.0;

        return BuildForecastResult(location, Math.Round(temp, 1), hum, rainProb, rainMm, forecastHours, isSimulated: true);
    }

    private static WeatherForecastDto BuildForecastResult(string location, double tempC, int humidity, int rainProb, double rainMm, int forecastHours, bool isSimulated = false)
    {
        bool isRain;
        string riskLevel;
        string recommendation;

        if (rainProb >= 70 || rainMm >= 10.0)
        {
            riskLevel = "HIGH";
            isRain = true;
            recommendation = $"Thời tiết nhiều mây/mưa ẩm trong {forecastHours} giờ tới (Xác suất mưa {rainProb}%). Nguy cơ rửa trôi thuốc rất cao, tuyệt đối không phun thuốc trừ bệnh không kháng nước.";
        }
        else if (rainProb >= 40 || rainMm >= 2.0)
        {
            riskLevel = "MEDIUM";
            isRain = rainMm > 0;
            recommendation = $"Thời tiết có thể có mưa rải rác trong {forecastHours} giờ tới (Xác suất mưa {rainProb}%). Nên ưu tiên chọn thuốc có tính bám dính tốt hoặc hoạt chất kháng mưa rửa trôi.";
        }
        else
        {
            riskLevel = "LOW";
            isRain = false;
            recommendation = $"Thời tiết khô ráo, thuận lợi trong {forecastHours} giờ tới (Xác suất mưa {rainProb}%). Thích hợp phun phòng trừ bệnh hại vào sáng sớm hoặc chiều mát.";
        }

        return new WeatherForecastDto
        {
            Location = location,
            TemperatureC = tempC,
            HumidityPercent = humidity,
            RainfallProbabilityPercent = rainProb,
            RainfallMm = rainMm,
            IsRain = isRain,
            RiskLevel = riskLevel,
            Recommendation = recommendation,
            ForecastHours = forecastHours,
            IsSimulated = isSimulated,
            CachedAt = DateTime.UtcNow
        };
    }
}
