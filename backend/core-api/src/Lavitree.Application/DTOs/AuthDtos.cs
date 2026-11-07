using System;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Lavitree.Application.DTOs;

public class RegisterRequestDto
{
    [Required(ErrorMessage = "Email không được để trống.")]
    [EmailAddress(ErrorMessage = "Định dạng email không hợp lệ.")]
    [MaxLength(255, ErrorMessage = "Email không được vượt quá 255 ký tự.")]
    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Mật khẩu không được để trống.")]
    [MinLength(8, ErrorMessage = "Mật khẩu phải có tối thiểu 8 ký tự.")]
    [MaxLength(72, ErrorMessage = "Mật khẩu không được vượt quá 72 ký tự.")]
    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;

    [Required(ErrorMessage = "Họ và tên không được để trống.")]
    [MaxLength(100, ErrorMessage = "Họ và tên không được vượt quá 100 ký tự.")]
    [JsonPropertyName("full_name")]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(20, ErrorMessage = "Số điện thoại không được vượt quá 20 ký tự.")]
    [RegularExpression(@"^(0[3|5|7|8|9])[0-9]{8}$|^$", ErrorMessage = "Số điện thoại phải là định dạng di động Việt Nam 10 chữ số (bắt đầu bằng 03, 05, 07, 08, 09).")]
    [JsonPropertyName("phone")]
    public string? Phone { get; set; }
}

public class LoginRequestDto
{
    [Required(ErrorMessage = "Email không được để trống.")]
    [EmailAddress(ErrorMessage = "Định dạng email không hợp lệ.")]
    [MaxLength(255, ErrorMessage = "Email không được vượt quá 255 ký tự.")]
    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Mật khẩu không được để trống.")]
    [MaxLength(72, ErrorMessage = "Mật khẩu không được vượt quá 72 ký tự.")]
    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;
}

public class UserDto
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    [JsonPropertyName("full_name")]
    public string FullName { get; set; } = string.Empty;

    [JsonPropertyName("phone")]
    public string? Phone { get; set; }

    [JsonPropertyName("role")]
    public string Role { get; set; } = "FARMER";

    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }
}

public class AuthResponseDto
{
    [JsonPropertyName("token")]
    public string Token { get; set; } = string.Empty;

    [JsonPropertyName("token_type")]
    public string TokenType { get; set; } = "Bearer";

    [JsonPropertyName("expires_in")]
    public int ExpiresIn { get; set; } = 7 * 86400; // 7 days

    [JsonPropertyName("user")]
    public UserDto User { get; set; } = null!;
}
