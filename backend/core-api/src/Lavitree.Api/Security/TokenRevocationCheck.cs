using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Lavitree.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;

namespace Lavitree.Api.Security;

/// <summary>
/// BUG-38: JWT sống 7 ngày, nên mỗi lần nhận vé phải xem tài khoản còn tồn tại và còn đúng quyền không.
/// Kết quả đọc CSDL được nhớ 30 giây để không truy vấn ở mọi request:
/// xóa tài khoản hoặc hạ quyền thì tối đa 30 giây sau vé cũ bị từ chối.
/// </summary>
public static class TokenRevocationCheck
{
    private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(30);

    public static async Task ValidateAsync(TokenValidatedContext context)
    {
        var principal = context.Principal;
        var idValue = principal?.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal?.FindFirstValue("sub");
        if (principal == null || !Guid.TryParse(idValue, out var userId))
        {
            context.Fail("Token không có mã người dùng hợp lệ.");
            return;
        }

        var services = context.HttpContext.RequestServices;
        var cache = services.GetRequiredService<IMemoryCache>();
        var cacheKey = $"auth:user-role:{userId}";
        if (!cache.TryGetValue(cacheKey, out string? currentRole))
        {
            var db = services.GetRequiredService<LavitreeDbContext>();
            var row = await db.Users.AsNoTracking()
                .Where(u => u.Id == userId && !u.IsDeleted)
                .Select(u => new { u.Role })
                .FirstOrDefaultAsync(context.HttpContext.RequestAborted);
            // Role trống được JwtTokenService ghi thành FARMER; chuỗi rỗng = không còn tài khoản
            currentRole = row == null ? string.Empty : (string.IsNullOrWhiteSpace(row.Role) ? "FARMER" : row.Role);
            // BUG-35: cache có SizeLimit nên mỗi mục phải khai báo Size
            cache.Set(cacheKey, currentRole, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = CacheFor, Size = 1 });
        }

        if (string.IsNullOrEmpty(currentRole))
        {
            context.Fail("Tài khoản không còn tồn tại.");
            return;
        }

        var tokenRole = principal.FindFirstValue(ClaimTypes.Role) ?? principal.FindFirstValue("role") ?? "FARMER";
        if (!string.Equals(tokenRole, currentRole, StringComparison.OrdinalIgnoreCase))
        {
            context.Fail("Quyền tài khoản đã thay đổi, cần đăng nhập lại.");
        }
    }
}
