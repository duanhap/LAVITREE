using System;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.AspNetCore.RateLimiting;
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

// 4. Rate Limiting Configuration (diagnose_policy)
builder.Services.AddRateLimiter(options =>
{
    var rateLimit = int.TryParse(Environment.GetEnvironmentVariable("RATE_LIMIT_PER_MINUTE"), out var limit) ? limit : 60;
    options.AddFixedWindowLimiter("diagnose_policy", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = rateLimit;
        opt.QueueLimit = 0;
    });
    options.RejectionStatusCode = Microsoft.AspNetCore.Http.StatusCodes.Status429TooManyRequests;
});

// 5. CORS Configuration (Restricted to frontend domains)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://localhost:5173")
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
});

var app = builder.Build();

// 6. HTTP Request Pipeline
if (app.Environment.IsDevelopment() || true)
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Lavitree Core Web API v1");
    });
}

app.UseCors("AllowFrontend");
app.UseRateLimiter();
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
