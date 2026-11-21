using System.Security.Claims;

namespace Lavitree.Api.Security;

/// <summary>Tên policy phân quyền dùng chung (BUG-18).</summary>
public static class AuthPolicies
{
    /// <summary>Chỉ tài khoản đã đăng nhập có role ADMIN. Gắn bằng [Authorize(Policy = AuthPolicies.AdminOnly)].</summary>
    public const string AdminOnly = "AdminOnly";
}

public static class ClaimsPrincipalExtensions
{
    /// <summary>
    /// Dùng cho API công khai nhưng Admin thấy thêm dữ liệu (ví dụ bài chưa duyệt).
    /// API chỉ dành cho Admin thì dùng policy AdminOnly, không tự kiểm tra trong hàm.
    /// </summary>
    public static bool IsAdmin(this ClaimsPrincipal user) =>
        user.Identity?.IsAuthenticated == true
        && (user.IsInRole("ADMIN") || user.HasClaim("role", "ADMIN"));
}
