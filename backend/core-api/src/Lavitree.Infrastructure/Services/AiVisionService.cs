using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Lavitree.Application.DTOs;
using Lavitree.Application.Interfaces;

namespace Lavitree.Infrastructure.Services;

public class AiVisionService : IAiVisionService
{
    private readonly HttpClient _httpClient;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public AiVisionService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<AiPredictionResponse> PredictAsync(Stream imageStream, string fileName, CancellationToken cancellationToken = default)
    {
        using var content = new MultipartFormDataContent();
        using var streamContent = new StreamContent(imageStream);
        streamContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        content.Add(streamContent, "file", fileName);

        var response = await _httpClient.PostAsync("/api/v1/ai/predict", content, cancellationToken);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        var result = JsonSerializer.Deserialize<AiPredictionResponse>(json, JsonOptions);

        return result ?? throw new InvalidOperationException("Không thể giải mã phản hồi từ AI Microservice");
    }
}
