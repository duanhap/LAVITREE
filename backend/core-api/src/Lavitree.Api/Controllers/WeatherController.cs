using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Lavitree.Application.DTOs;
using Lavitree.Application.Interfaces;

namespace Lavitree.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[EnableRateLimiting("public_api_policy")]
public class WeatherController : ControllerBase
{
    private readonly IWeatherService _weatherService;

    public WeatherController(IWeatherService weatherService)
    {
        _weatherService = weatherService;
    }

    /// <summary>
    /// GET /api/v1/weather
    /// Tra cứu Thời tiết Cục bộ kèm Bộ nhớ đệm 1 Giờ (SSOT: api-contracts.md Mục 3.9)
    /// Phục vụ công cụ check_weather_risk của FastMCP Agent và màn hình tra cứu của Nông dân.
    /// </summary>
    /// <param name="location">Tên tỉnh/thành hoặc địa danh (mặc định: Hà Nam)</param>
    /// <param name="forecastHours">Số giờ dự báo tương lai (mặc định: 12)</param>
    /// <returns>Dữ liệu khí tượng và rủi ro rửa trôi thuốc BVTV</returns>
    [HttpGet]
    [ProducesResponseType(typeof(WeatherForecastDto), 200)]
    [ProducesResponseType(400)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetWeather(
        [FromQuery] string? location,
        [FromQuery] int forecastHours = 12)
    {
        var targetLocation = string.IsNullOrWhiteSpace(location) ? "Hà Nam" : location.Trim();

        // Endpoint public: chặn địa danh dài và số giờ tuỳ ý để không làm phình cache theo từng cặp giá trị
        if (targetLocation.Length > 120)
        {
            return BadRequest(new { message = "location tối đa 120 ký tự." });
        }
        if (forecastHours < 1 || forecastHours > 72)
        {
            return BadRequest(new { message = "forecastHours phải từ 1 đến 72." });
        }

        try
        {
            var result = await _weatherService.GetWeatherForecastAsync(targetLocation, forecastHours, HttpContext.RequestAborted);
            return Ok(result);
        }
        catch (WeatherUnavailableException)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                message = "Dịch vụ dự báo thời tiết tạm thời không khả dụng."
            });
        }
    }
}
