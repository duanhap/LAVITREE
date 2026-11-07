using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Lavitree.Application.Interfaces;
using Lavitree.Domain.Entities;

namespace Lavitree.Infrastructure.Services;

public class JwtTokenService : IJwtTokenService
{
    private readonly string _secretKey;
    private readonly string _issuer;
    private readonly string _audience;

    public JwtTokenService(IConfiguration configuration)
    {
        _secretKey = Environment.GetEnvironmentVariable("JWT_SECRET_KEY")
            ?? configuration["Jwt:SecretKey"]
            ?? throw new InvalidOperationException("JWT_SECRET_KEY chưa được cấu hình trong biến môi trường hoặc file .env!");

        if (_secretKey.Length < 32)
        {
            throw new InvalidOperationException("JWT_SECRET_KEY phải có độ dài tối thiểu 32 ký tự để đảm bảo an toàn bảo mật HMAC-SHA256!");
        }

        _issuer = Environment.GetEnvironmentVariable("JWT_ISSUER")
            ?? configuration["Jwt:Issuer"]
            ?? "LavitreeCoreApi";

        _audience = Environment.GetEnvironmentVariable("JWT_AUDIENCE")
            ?? configuration["Jwt:Audience"]
            ?? "LavitreeClients";
    }

    public string GenerateToken(User user)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_secretKey);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(ClaimTypes.Name, user.FullName),
            new("name", user.FullName),
            new("full_name", user.FullName),
            new(ClaimTypes.Role, string.IsNullOrWhiteSpace(user.Role) ? "FARMER" : user.Role),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddDays(7), // Token 7 ngày cho nông dân
            Issuer = _issuer,
            Audience = _audience,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key),
                SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }
}
