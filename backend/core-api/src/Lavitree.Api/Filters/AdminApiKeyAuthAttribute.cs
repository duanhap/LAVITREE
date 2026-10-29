using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Lavitree.Api.Filters;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class AdminApiKeyAuthAttribute : Attribute, IAsyncAuthorizationFilter
{
    private const string ApiKeyHeaderName = "X-Admin-Key";

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        // 1. Read secret key from environment
        var configuredKey = Environment.GetEnvironmentVariable("ADMIN_SECRET_KEY");

        // FAIL-CLOSED SECURITY: If ADMIN_SECRET_KEY is null, empty or whitespace, reject 100% of requests!
        if (string.IsNullOrWhiteSpace(configuredKey))
        {
            context.Result = new ObjectResult(new { detail = "Khóa quản trị (X-Admin-Key) chưa được cấu hình trên máy chủ." })
            {
                StatusCode = 401
            };
            return;
        }

        // 2. Check header
        if (!context.HttpContext.Request.Headers.TryGetValue(ApiKeyHeaderName, out var providedKeyHeader))
        {
            context.Result = new ObjectResult(new { detail = "Yêu cầu quyền quản trị: Thiếu header X-Admin-Key." })
            {
                StatusCode = 401
            };
            return;
        }

        var providedKey = providedKeyHeader.ToString();
        var providedBytes = Encoding.UTF8.GetBytes(providedKey);
        var configuredBytes = Encoding.UTF8.GetBytes(configuredKey);

        // 3. Constant-time comparison to prevent timing attacks
        if (providedBytes.Length != configuredBytes.Length || !CryptographicOperations.FixedTimeEquals(providedBytes, configuredBytes))
        {
            context.Result = new ObjectResult(new { detail = "Khóa quản trị (X-Admin-Key) không hợp lệ." })
            {
                StatusCode = 401
            };
            return;
        }

        await Task.CompletedTask;
    }
}
