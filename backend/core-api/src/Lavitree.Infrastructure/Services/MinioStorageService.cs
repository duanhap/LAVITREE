using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Minio;
using Minio.DataModel.Args;
using Lavitree.Application.Interfaces;

namespace Lavitree.Infrastructure.Services;

public class MinioStorageService : IMinioStorageService
{
    private readonly IMinioClient _minioClient;
    private readonly string _publicUrl;
    private readonly ILogger<MinioStorageService> _logger;
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, bool> _initializedBuckets = new();

    public MinioStorageService(IConfiguration configuration, ILogger<MinioStorageService> logger)
    {
        _logger = logger;

        // BUG-78: appsettings.json không ghi sẵn localhost nữa nên MINIO_ENDPOINT / MINIO_PUBLIC_URL trong .env
        // có hiệu lực khi chạy `dotnet run`. Docker dùng Minio__Endpoint / Minio__PublicUrl.
        var endpoint = FirstConfigured(configuration["Minio:Endpoint"], Environment.GetEnvironmentVariable("MINIO_ENDPOINT"))
            ?? "localhost:9000";

        // BUG-43: "minioadmin" là mật khẩu mặc định ai cũng biết, chỉ dùng khi chạy máy dev.
        // Production thiếu khóa thì dừng khởi động, không lặng lẽ chạy với khóa yếu.
        var accessKey = RequireCredential(configuration["Minio:AccessKey"], "MINIO_ACCESS_KEY");
        var secretKey = RequireCredential(configuration["Minio:SecretKey"], "MINIO_SECRET_KEY");

        _publicUrl = FirstConfigured(configuration["Minio:PublicUrl"], Environment.GetEnvironmentVariable("MINIO_PUBLIC_URL"))
            ?? "http://localhost:9000";

        // Remove http:// or https:// if provided in endpoint
        var cleanEndpoint = endpoint.Replace("http://", "").Replace("https://", "").TrimEnd('/');
        var isContainer = Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER") == "true";
        if (isContainer && (cleanEndpoint.Contains("localhost") || cleanEndpoint.Contains("127.0.0.1")))
        {
            cleanEndpoint = "minio:9000";
        }
        bool useSsl = endpoint.StartsWith("https://", StringComparison.OrdinalIgnoreCase);

        _minioClient = new MinioClient()
            .WithEndpoint(cleanEndpoint)
            .WithCredentials(accessKey, secretKey)
            .WithSSL(useSsl)
            .Build();
    }

    private static string? FirstConfigured(params string?[] values) =>
        values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim();

    private static string RequireCredential(string? configured, string envName)
    {
        var value = !string.IsNullOrWhiteSpace(configured) ? configured : Environment.GetEnvironmentVariable(envName);
        if (!string.IsNullOrWhiteSpace(value)) return value;

        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
            ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");
        if (string.Equals(environment, "Development", StringComparison.OrdinalIgnoreCase)) return "minioadmin";

        throw new InvalidOperationException($"Chưa cấu hình {envName} cho MinIO (không dùng khóa mặc định ngoài môi trường Development).");
    }

    public async Task EnsureBucketExistsAsync(string bucketName, CancellationToken cancellationToken = default)
    {
        if (_initializedBuckets.ContainsKey(bucketName))
        {
            return;
        }

        try
        {
            var beArgs = new BucketExistsArgs().WithBucket(bucketName);
            bool exists = await _minioClient.BucketExistsAsync(beArgs, cancellationToken);
            if (!exists)
            {
                var mbArgs = new MakeBucketArgs().WithBucket(bucketName);
                await _minioClient.MakeBucketAsync(mbArgs, cancellationToken);
                _logger.LogInformation("Bucket {BucketName} created successfully.", bucketName);
            }

            // Security Policy: Only s3:GetObject allowed for objects, NO s3:ListBucket
            var policyJson = $@"{{
                ""Version"": ""2012-10-17"",
                ""Statement"": [
                    {{
                        ""Effect"": ""Allow"",
                        ""Principal"": {{""AWS"": [""*""]}},
                        ""Action"": [""s3:GetObject""],
                        ""Resource"": [""arn:aws:s3:::{bucketName}/*""]
                    }}
                ]
            }}";

            var spArgs = new SetPolicyArgs().WithBucket(bucketName).WithPolicy(policyJson);
            await _minioClient.SetPolicyAsync(spArgs, cancellationToken);
            _logger.LogInformation("Bucket policy applied to {BucketName}: s3:GetObject only (ListBucket denied).", bucketName);

            _initializedBuckets.TryAdd(bucketName, true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while ensuring MinIO bucket {BucketName} exists.", bucketName);
            // Non-blocking in case MinIO is offline during local unit testing
        }
    }

    public async Task<string> UploadFileAsync(string bucketName, string objectName, Stream stream, string contentType, CancellationToken cancellationToken = default)
    {
        await EnsureBucketExistsAsync(bucketName, cancellationToken);

        if (stream.CanSeek)
        {
            stream.Position = 0;
        }

        var putObjectArgs = new PutObjectArgs()
            .WithBucket(bucketName)
            .WithObject(objectName)
            .WithStreamData(stream)
            .WithObjectSize(stream.Length)
            .WithContentType(contentType);

        await _minioClient.PutObjectAsync(putObjectArgs, cancellationToken);
        _logger.LogInformation("Uploaded object {ObjectName} to bucket {BucketName}.", objectName, bucketName);

        return GetPublicUrl(bucketName, objectName);
    }

    public async Task DeleteFileAsync(string bucketName, string objectName, CancellationToken cancellationToken = default)
    {
        try
        {
            var removeArgs = new RemoveObjectArgs()
                .WithBucket(bucketName)
                .WithObject(objectName);
            await _minioClient.RemoveObjectAsync(removeArgs, cancellationToken);
            _logger.LogInformation("Deleted object {ObjectName} from bucket {BucketName}.", objectName, bucketName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete object {ObjectName} from bucket {BucketName}.", objectName, bucketName);
        }
    }

    public string GetPublicUrl(string bucketName, string objectName)
    {
        var cleanBaseUrl = _publicUrl.TrimEnd('/');
        return $"{cleanBaseUrl}/{bucketName}/{objectName}";
    }
}
