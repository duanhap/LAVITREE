using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Lavitree.Application.DTOs;
using Lavitree.Application.Interfaces;

namespace Lavitree.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
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
    /// <returns>Dữ liệu khí tượng và rủi ro rửa trôi thuốc BVTV</returns>
    [HttpGet]
    [ProducesResponseType(typeof(WeatherForecastDto), 200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> GetWeather([FromQuery] string? location)
    {
        var targetLocation = string.IsNullOrWhiteSpace(location) ? "Hà Nam" : location.Trim();

        var result = await _weatherService.GetWeatherForecastAsync(targetLocation, HttpContext.RequestAborted);
        return Ok(result);
    }
}
