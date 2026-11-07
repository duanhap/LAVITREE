using System;
using System.Threading;
using System.Threading.Tasks;
using Lavitree.Application.DTOs;

namespace Lavitree.Application.Interfaces;

public interface IWeatherService
{
    Task<WeatherForecastDto> GetWeatherForecastAsync(string location, int forecastHours = 12, CancellationToken cancellationToken = default);
}

/// <summary>Không lấy được dự báo thật và môi trường hiện tại không cho phép giả lập.</summary>
public class WeatherUnavailableException : Exception
{
    public WeatherUnavailableException() : base("Weather forecast is unavailable.") { }
}
