using System;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using System.Threading.RateLimiting;
using Lavitree.Application.Interfaces;
using Lavitree.Infrastructure.Persistence;
using Lavitree.Infrastructure.Services;

// 0. Load .env file (Traverse up to find .env in project or root directory)
DotNetEnv.Env.TraversePath().Load();

var builder = WebApplication.CreateBuilder(args);

// 1. Database Configuration (PostgreSQL / Supabase)
var envConn = Environment.GetEnvironmentVariable("SUPABASE_CONNECTION_STRING");
var dbPassword = Environment.GetEnvironmentVariable("DB_PASSWORD");

// Determine base connection string
var connectionString = !string.IsNullOrWhiteSpace(envConn) && !envConn.Contains("YOUR_PASSWORD_HERE") && !envConn.Contains("[YOUR-DATABASE-PASSWORD]")
    ? envConn
    : (builder.Configuration.GetConnectionString("DefaultConnection")
       ?? "Host=localhost;Port=5432;Database=LavitreeDb;Username=postgres;Password=postgres;");

// Replace password placeholder if DB_PASSWORD is provided
if (!string.IsNullOrWhiteSpace(dbPassword))
{
    connectionString = connectionString
        .Replace("[YOUR-DATABASE-PASSWORD]", dbPassword)
        .Replace("YOUR_PASSWORD_HERE", dbPassword);
}

builder.Services.AddDbContext<LavitreeDbContext>(options =>
    options.UseNpgsql(connectionString));

// 2. Register AI Vision Service HttpClient
var aiServiceBaseUrl = Environment.GetEnvironmentVariable("AI_SERVICE_URL")
    ?? builder.Configuration["AiService:BaseUrl"]
    ?? "http://localhost:8000";

builder.Services.AddHttpClient<IAiVisionService, AiVisionService>(client =>
{
    client.BaseAddress = new Uri(aiServiceBaseUrl);
    client.Timeout = TimeSpan.FromSeconds(30);
});

// 3. Register MinIO Object Storage Service
builder.Services.AddSingleton<IMinioStorageService, MinioStorageService>();

// 4. Register Auth Services (Password Hasher & JWT Token Service)
builder.Services.AddSingleton<IPasswordHasher, BcryptPasswordHasher>();
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();

// 5. Authentication & JWT Bearer Configuration (Fail-Closed: Tối thiểu 32 ký tự, không hardcode secret)
var jwtSecretKey = Environment.GetEnvironmentVariable("JWT_SECRET_KEY")
    ?? builder.Configuration["Jwt:SecretKey"]
    ?? throw new InvalidOperationException("JWT_SECRET_KEY chưa được cấu hình trong biến môi trường hoặc file .env!");

if (jwtSecretKey.Length < 32)
{
    throw new InvalidOperationException("JWT_SECRET_KEY phải có độ dài tối thiểu 32 ký tự để đảm bảo an toàn HMAC-SHA256!");
}

var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? "LavitreeCoreApi";
var jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? "LavitreeClients";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecretKey)),
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

// 6. Rate Limiting Configuration (diagnose_policy partitioned per client IP)
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
    // Trust loopback and Docker internal networks (127.0.0.1/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
    options.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(System.Net.IPAddress.Parse("127.0.0.1"), 8));
    options.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(System.Net.IPAddress.Parse("10.0.0.0"), 8));
    options.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(System.Net.IPAddress.Parse("172.16.0.0"), 12));
    options.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(System.Net.IPAddress.Parse("192.168.0.0"), 16));
});

builder.Services.AddRateLimiter(options =>
{
    var rateLimit = int.TryParse(Environment.GetEnvironmentVariable("RATE_LIMIT_PER_MINUTE"), out var limit) ? limit : 60;
    options.AddPolicy("diagnose_policy", httpContext =>
    {
        var clientIp = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown_client";
        return RateLimitPartition.GetFixedWindowLimiter(clientIp, _ => new FixedWindowRateLimiterOptions
        {
            Window = TimeSpan.FromMinutes(1),
            PermitLimit = rateLimit,
            QueueLimit = 0
        });
    });
    options.RejectionStatusCode = Microsoft.AspNetCore.Http.StatusCodes.Status429TooManyRequests;
});

// 7. CORS Configuration (Restricted to frontend domains)
builder.Services.AddCors(options =>
{
    var corsOriginsEnv = Environment.GetEnvironmentVariable("CORS_ALLOWED_ORIGINS");
    var origins = !string.IsNullOrWhiteSpace(corsOriginsEnv)
        ? corsOriginsEnv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        : new[] { "http://localhost:3000", "http://localhost:5173" };

    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(origins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Lavitree Core Web API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "Nhập token JWT dạng: Bearer {token}",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(_ => new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecuritySchemeReference("Bearer"),
            new List<string>()
        }
    });
});

var app = builder.Build();

// 8. HTTP Request Pipeline
app.UseForwardedHeaders();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Lavitree Core Web API v1");
    });
}

app.UseCors("AllowFrontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// 5. Automatic Database Seeding (Idempotent)
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<LavitreeDbContext>();
    await LavitreeDbContextSeeder.SeedAsync(dbContext);
}

if (args.Contains("--seed-only"))
{
    Console.WriteLine("[App] Seeding completed in --seed-only mode. Exiting.");
    return;
}

app.Run();
