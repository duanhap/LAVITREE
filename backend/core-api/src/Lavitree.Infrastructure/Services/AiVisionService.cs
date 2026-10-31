using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Lavitree.Application.DTOs;
using Lavitree.Application.Interfaces;

namespace Lavitree.Infrastructure.Services;

public class AiVisionService : IAiVisionService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<AiVisionService> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public AiVisionService(HttpClient httpClient, ILogger<AiVisionService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<AiPredictionResponse> PredictAsync(Stream imageStream, string fileName, bool includeHeatmap = true, CancellationToken cancellationToken = default)
    {
        using var content = new MultipartFormDataContent();
        using var streamContent = new StreamContent(imageStream);

        // Detect content type
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        var mime = ext switch
        {
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".bmp" => "image/bmp",
            _ => "image/jpeg"
        };

        streamContent.Headers.ContentType = new MediaTypeHeaderValue(mime);
        content.Add(streamContent, "file", fileName);

        var endpointUrl = $"/api/v1/predict?include_heatmap={includeHeatmap.ToString().ToLowerInvariant()}";
        _logger.LogInformation("Calling AI Service: {EndpointUrl}", endpointUrl);

        var response = await _httpClient.PostAsync(endpointUrl, content, cancellationToken);
        var json = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("AI Vision Service returned error status {StatusCode}: {ResponseJson}", response.StatusCode, json);
            throw new HttpRequestException($"AI Vision Service returned {(int)response.StatusCode}: {json}", null, response.StatusCode);
        }

        var result = JsonSerializer.Deserialize<AiPredictionResponse>(json, JsonOptions);
        return result ?? throw new InvalidOperationException("Không thể giải mã phản hồi từ AI Microservice");
    }
}
