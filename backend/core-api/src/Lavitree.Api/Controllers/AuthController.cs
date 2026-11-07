using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Lavitree.Application.DTOs;
using Lavitree.Application.Interfaces;
using Lavitree.Domain.Entities;
using Lavitree.Infrastructure.Persistence;

using Microsoft.AspNetCore.RateLimiting;

namespace Lavitree.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly LavitreeDbContext _dbContext;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly ILogger<AuthController> _logger;

    // Hash mẫu cố định dùng để chạy VerifyPassword khi user không tồn tại, chống tấn công dò email qua thời gian (Timing Attack)
    private static readonly string DummyHash = BCrypt.Net.BCrypt.HashPassword("DummyPasswordForTimingMitigation123!", workFactor: 11);

    public AuthController(
        LavitreeDbContext dbContext,
        IPasswordHasher passwordHasher,
        IJwtTokenService jwtTokenService,
        ILogger<AuthController> logger)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _jwtTokenService = jwtTokenService;
        _logger = logger;
    }

    /// <summary>
    /// POST /api/v1/auth/register
    /// Đăng ký tài khoản Nông dân mới (SSOT: api-contracts.md Mục 3.5)
    /// </summary>
    [HttpPost("register")]
    [EnableRateLimiting("auth_policy")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register([FromBody] RegisterRequestDto dto, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var cleanEmail = dto.Email.Trim().ToLowerInvariant();

        // 1. Kiểm tra email đã tồn tại hay chưa (kể cả bản ghi xóa mềm vì DB unique constraint vẫn chặn)
        var emailExists = await _dbContext.Users.AnyAsync(u => u.Email == cleanEmail, cancellationToken);
        if (emailExists)
        {
            return BadRequest(new { detail = "Email này đã được sử dụng. Vui lòng đăng nhập hoặc chọn email khác." });
        }

        // 2. Băm mật khẩu bằng BCrypt
        var passwordHash = _passwordHasher.HashPassword(dto.Password);

        // 3. Khởi tạo đối tượng User mới
        var newUser = new User
        {
            Id = Guid.NewGuid(),
            Email = cleanEmail,
            PasswordHash = passwordHash,
            FullName = dto.FullName.Trim(),
            Phone = dto.Phone?.Trim(),
            Role = "FARMER", // Mặc định tài khoản tạo từ cổng đăng ký là Nông dân
            CreatedAt = DateTime.UtcNow
        };

        try
        {
            _dbContext.Users.Add(newUser);
            await _dbContext.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Đã đăng ký tài khoản mới thành công: {Email} (ID: {UserId})", cleanEmail, newUser.Id);
        }
        catch (DbUpdateException ex)
        {
            if (ex.InnerException is Npgsql.PostgresException pgEx && pgEx.SqlState == "23505")
            {
                _logger.LogWarning(ex, "Đăng ký thất bại do trùng email trên CSDL (PostgreSQL 23505 Unique Violation): {Email}", cleanEmail);
                return BadRequest(new { detail = "Email này đã được sử dụng. Vui lòng đăng nhập hoặc chọn email khác." });
            }

            _logger.LogError(ex, "Lỗi cập nhật CSDL khi đăng ký tài khoản mới: {Email}", cleanEmail);
            return StatusCode(StatusCodes.Status500InternalServerError, new { detail = "Đã xảy ra lỗi khi tạo tài khoản trên hệ thống." });
        }

        // 4. Sinh JWT Token
        var token = _jwtTokenService.GenerateToken(newUser);

        var response = new AuthResponseDto
        {
            Token = token,
            TokenType = "Bearer",
            ExpiresIn = 7 * 86400, // 7 ngày
            User = new UserDto
            {
                Id = newUser.Id,
                Email = newUser.Email,
                FullName = newUser.FullName,
                Phone = newUser.Phone,
                Role = newUser.Role,
                CreatedAt = newUser.CreatedAt
            }
        };

        return StatusCode(StatusCodes.Status201Created, response);
    }

    /// <summary>
    /// POST /api/v1/auth/login
    /// Đăng nhập hệ thống Lavitree (SSOT: api-contracts.md Mục 3.5)
    /// </summary>
    [HttpPost("login")]
    [EnableRateLimiting("auth_policy")]
    [ProducesResponseType(typeof(AuthResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto dto, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var cleanEmail = dto.Email.Trim().ToLowerInvariant();

        // 1. Tìm tài khoản theo email
        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Email == cleanEmail && !u.IsDeleted, cancellationToken);

        // 2. Chống Timing Attack: Luôn thực thi VerifyPassword kể cả khi user không tồn tại
        bool isPasswordValid;
        if (user != null)
        {
            isPasswordValid = _passwordHasher.VerifyPassword(dto.Password, user.PasswordHash);
        }
        else
        {
            _passwordHasher.VerifyPassword(dto.Password, DummyHash);
            isPasswordValid = false;
        }

        if (!isPasswordValid || user == null)
        {
            _logger.LogWarning("Đăng nhập thất bại cho email {Email}: Sai email hoặc mật khẩu.", cleanEmail);
            return Unauthorized(new { detail = "Email hoặc mật khẩu không chính xác." });
        }

        // 3. Sinh JWT Token hợp lệ
        var token = _jwtTokenService.GenerateToken(user);
        _logger.LogInformation("Người dùng {Email} (Role: {Role}) đăng nhập thành công.", user.Email, user.Role);

        var response = new AuthResponseDto
        {
            Token = token,
            TokenType = "Bearer",
            ExpiresIn = 7 * 86400,
            User = new UserDto
            {
                Id = user.Id,
                Email = user.Email,
                FullName = user.FullName,
                Phone = user.Phone,
                Role = user.Role,
                CreatedAt = user.CreatedAt
            }
        };

        return Ok(response);
    }

    /// <summary>
    /// GET /api/v1/auth/me
    /// Lấy thông tin tài khoản hiện tại từ JWT Token đã xác thực
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetCurrentUser(CancellationToken cancellationToken)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;

        if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized(new { detail = "Mã định danh người dùng trong token không hợp lệ." });
        }

        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted, cancellationToken);
        if (user == null)
        {
            return NotFound(new { detail = "Không tìm thấy thông tin tài khoản trong cơ sở dữ liệu." });
        }

        var userDto = new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            FullName = user.FullName,
            Phone = user.Phone,
            Role = user.Role,
            CreatedAt = user.CreatedAt
        };

        return Ok(userDto);
    }
}
