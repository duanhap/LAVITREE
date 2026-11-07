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
/// Áp dụng IMemoryCache TTL = 1 giờ (3600s) theo location để tránh lãng phí quota và giảm độ trễ (< 20ms cache hit).
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

    public async Task<WeatherForecastDto> GetWeatherForecastAsync(string location, CancellationToken cancellationToken = default)
    {
        var displayLocation = string.IsNullOrWhiteSpace(location) ? "Hà Nam" : location.Trim();
        var cacheKey = $"weather_{Regex.Replace(displayLocation.ToLowerInvariant(), @"\s+", "_")}";

        if (_cache.TryGetValue<WeatherForecastDto>(cacheKey, out var cachedResult) && cachedResult != null)
        {
            _logger.LogInformation("Weather cache hit for location '{Location}'.", displayLocation);
            return cachedResult;
        }

        WeatherForecastDto forecast;

        // BUG-04: Đọc cả 3 biến môi trường tương thích
        var apiKey = Environment.GetEnvironmentVariable("OPENWEATHER_API_KEY")
            ?? Environment.GetEnvironmentVariable("OPENWEATHERMAP_API_KEY")
            ?? Environment.GetEnvironmentVariable("WEATHER_API_KEY");

        if (!string.IsNullOrWhiteSpace(apiKey) && !apiKey.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                forecast = await FetchFromOpenWeatherMapAsync(displayLocation, apiKey, cancellationToken);
                // BUG-05: Chỉ cache 1 giờ khi kết quả từ API thời tiết thật thành công
                _cache.Set(cacheKey, forecast, TimeSpan.FromHours(1));
                _logger.LogInformation("Cached live weather forecast for '{Location}' with TTL 1 hour.", displayLocation);
                return forecast;
            }
            catch (OperationCanceledException)
            {
                // BUG-05: Client hủy request thì ném tiếp, không fallback giả mạo
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "OpenWeatherMap API error for '{Location}'. Falling back to local meteorological engine.", displayLocation);
                forecast = GenerateSimulatedForecast(displayLocation);
                // Dữ liệu giả lập chỉ lưu đệm ngắn hạn (1 phút) để sớm retry kết nối thật
                _cache.Set(cacheKey, forecast, TimeSpan.FromMinutes(1));
                return forecast;
            }
        }
        else
        {
            forecast = GenerateSimulatedForecast(displayLocation);
            _cache.Set(cacheKey, forecast, TimeSpan.FromMinutes(1));
            return forecast;
        }
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

    private async Task<WeatherForecastDto> FetchFromOpenWeatherMapAsync(string location, string apiKey, CancellationToken cancellationToken)
    {
        var queryCity = MapLocationToOpenWeatherQuery(location);
        var url = $"https://api.openweathermap.org/data/2.5/weather?q={queryCity}&appid={apiKey}&units=metric&lang=vi";
        using var response = await _httpClient.GetAsync(url, cancellationToken);
        response.EnsureSuccessStatusCode();

        using var jsonDoc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
        var root = jsonDoc.RootElement;

        double tempC = 28.0;
        int humidity = 80;
        double rainMm = 0.0;
        int rainProb = 30;

        if (root.TryGetProperty("main", out var main))
        {
            if (main.TryGetProperty("temp", out var tempProp)) tempC = Math.Round(tempProp.GetDouble(), 1);
            if (main.TryGetProperty("humidity", out var humProp)) humidity = humProp.GetInt32();
        }

        if (root.TryGetProperty("rain", out var rain))
        {
            if (rain.TryGetProperty("1h", out var r1h)) rainMm = Math.Round(r1h.GetDouble(), 1);
            else if (rain.TryGetProperty("3h", out var r3h)) rainMm = Math.Round(r3h.GetDouble() / 3.0, 1);
        }

        if (root.TryGetProperty("clouds", out var clouds) && clouds.TryGetProperty("all", out var allProp))
        {
            rainProb = Math.Clamp((int)(allProp.GetInt32() * 0.9), 0, 100);
        }

        return BuildForecastResult(location, tempC, humidity, rainProb, rainMm, isSimulated: false);
    }

    private WeatherForecastDto GenerateSimulatedForecast(string location)
    {
        var normalized = location.Trim().ToLowerInvariant();

        // Mẫu chuẩn đặc thù vùng nông nghiệp Việt Nam
        if (normalized.Contains("hà nam") || normalized.Contains("ha nam"))
        {
            return BuildForecastResult(location, 28.5, 92, 85, 20.0, isSimulated: true);
        }
        if (normalized.Contains("hà nội") || normalized.Contains("ha noi"))
        {
            return BuildForecastResult(location, 29.0, 88, 75, 15.0, isSimulated: true);
        }
        if (normalized.Contains("lâm đồng") || normalized.Contains("đà lạt") || normalized.Contains("lam dong") || normalized.Contains("da lat"))
        {
            return BuildForecastResult(location, 22.0, 85, 55, 8.0, isSimulated: true);
        }
        if (normalized.Contains("cần thơ") || normalized.Contains("can tho") || normalized.Contains("tiền giang"))
        {
            return BuildForecastResult(location, 31.0, 82, 45, 5.0, isSimulated: true);
        }
        if (normalized.Contains("sơn la") || normalized.Contains("son la") || normalized.Contains("bắc giang"))
        {
            return BuildForecastResult(location, 25.5, 70, 20, 0.0, isSimulated: true);
        }
        if (normalized.Contains("gia lai") || normalized.Contains("đắk lắk") || normalized.Contains("dak lak"))
        {
            return BuildForecastResult(location, 26.5, 68, 15, 0.0, isSimulated: true);
        }

        // BUG-06: Thuật toán băm an toàn (uint & Math.Clamp), tuyệt đối không tràn số âm
        uint hash = (uint)normalized.GetHashCode();
        double temp = 25.0 + (hash % 90) / 10.0; // 25.0 -> 34.0 C
        int hum = 65 + (int)(hash % 30); // 65 -> 95 %
        int rainProb = Math.Clamp((int)((hash * 7u) % 100u), 0, 100); // 0 -> 99 %
        double rainMm = rainProb > 60 ? Math.Round((rainProb - 50) * 0.4, 1) : 0.0;

        return BuildForecastResult(location, Math.Round(temp, 1), hum, rainProb, rainMm, isSimulated: true);
    }

    private static WeatherForecastDto BuildForecastResult(string location, double tempC, int humidity, int rainProb, double rainMm, bool isSimulated = false)
    {
        bool isRain;
        string riskLevel;
        string recommendation;

        // BUG-07: Nội dung khuyến nghị chuẩn xác theo độ che phủ mây và xác suất mưa hiện thời
        if (rainProb >= 70 || rainMm >= 10.0)
        {
            riskLevel = "HIGH";
            isRain = true;
            recommendation = $"Thời tiết nhiều mây/mưa ẩm (Xác suất mưa {rainProb}%). Nguy cơ rửa trôi thuốc rất cao, tuyệt đối không phun thuốc trừ bệnh không kháng nước.";
        }
        else if (rainProb >= 40 || rainMm >= 2.0)
        {
            riskLevel = "MEDIUM";
            isRain = false;
            recommendation = $"Thời tiết có thể có mưa rải rác (Xác suất mưa {rainProb}%). Nên ưu tiên chọn thuốc có tính bám dính tốt hoặc hoạt chất kháng mưa rửa trôi.";
        }
        else
        {
            riskLevel = "LOW";
            isRain = false;
            recommendation = $"Thời tiết khô ráo, thuận lợi (Xác suất mưa {rainProb}%). Thích hợp phun phòng trừ bệnh hại vào sáng sớm hoặc chiều mát.";
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
            IsSimulated = isSimulated,
            CachedAt = DateTime.UtcNow
        };
    }
}
