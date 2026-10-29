using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Lavitree.Application.DTOs;

namespace Lavitree.Application.Interfaces;

public interface IAiVisionService
{
    Task<AiPredictionResponse> PredictAsync(Stream imageStream, string fileName, bool includeHeatmap = true, CancellationToken cancellationToken = default);
}
