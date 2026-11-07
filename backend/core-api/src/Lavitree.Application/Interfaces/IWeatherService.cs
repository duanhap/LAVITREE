using System.Threading;
using System.Threading.Tasks;
using Lavitree.Application.DTOs;

namespace Lavitree.Application.Interfaces;

public interface IWeatherService
{
    Task<WeatherForecastDto> GetWeatherForecastAsync(string location, CancellationToken cancellationToken = default);
}
