using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Text.Json.Serialization;
using Lavitree.Api.Filters;
using Lavitree.Infrastructure.Persistence;

namespace Lavitree.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[EnableRateLimiting("public_api_policy")]
public class MedicinesController : ControllerBase
{
    private readonly LavitreeDbContext _dbContext;
    private readonly string _publicUrl;
    private readonly ILogger<MedicinesController> _logger;
    private readonly IWebHostEnvironment _env;

    public MedicinesController(
        LavitreeDbContext dbContext,
        ILogger<MedicinesController> logger,
        IWebHostEnvironment env)
    {
        _dbContext = dbContext;
        _logger = logger;
        _env = env;
        _publicUrl = Environment.GetEnvironmentVariable("MINIO_PUBLIC_URL")?.TrimEnd('/') ?? "";
    }

    private string FormatImageUrl(string relativePath)
    {
        if (string.IsNullOrEmpty(relativePath) || relativePath.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || relativePath.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return relativePath;
        }
        return string.IsNullOrEmpty(_publicUrl) ? relativePath : $"{_publicUrl}{relativePath}";
    }

    /// <summary>
    /// GET /api/v1/medicines/search
    /// Giao ước Ngày Đầu Tiên (Day 1 Contract - SSOT: api-contracts.md Mục 3.4)
    /// Cung cấp dữ liệu thuốc BVTV cho FastMCP Tool query_pesticide_store và Lavitree Store.
    /// Tối ưu hóa: Truy vấn và lọc trực tiếp tại PostgreSQL bằng SQL để tránh tải toàn bộ bảng lên RAM.
    /// </summary>
    [HttpGet("search")]
    public async Task<IActionResult> Search(
        [FromQuery] string? diseaseCode,
        [FromQuery] bool? requireRainResistant,
        [FromQuery] bool allowedOnly = true)
    {
        // Danh sách có thuốc cấm chỉ dành cho Admin; khách, nông dân và Agent chỉ thấy thuốc được phép
        if (!allowedOnly && !User.IsInRole("ADMIN") && !AdminApiKeyAuthAttribute.HasValidKey(Request))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "Chỉ quản trị viên được xem thuốc không được cấp phép."
            });
        }

        List<MedicineItemDto> items;
        bool isFallback = false;

        try
        {
            // Xây dựng IQueryable lọc trực tiếp tại CSDL (chống tràn RAM khi bảng Products có hàng ngàn thuốc)
            var query = _dbContext.Products
                .Include(p => p.DiseaseProducts)
                    .ThenInclude(dp => dp.Disease)
                .AsNoTracking()
                .AsQueryable();

            if (allowedOnly)
            {
                query = query.Where(p => p.IsAllowed);
            }

            if (requireRainResistant.HasValue && requireRainResistant.Value)
            {
                query = query.Where(p => p.RainResistant);
            }

            if (!string.IsNullOrWhiteSpace(diseaseCode))
            {
                var normCode = diseaseCode.Trim().ToLower();
                query = query.Where(p => p.DiseaseProducts.Any(dp => dp.Disease != null && dp.Disease.ClassCode.ToLower() == normCode));
            }

            var dbProducts = await query.ToListAsync();

            if (dbProducts.Count > 0)
            {
                items = dbProducts.Select(p => new MedicineItemDto
                {
                    Id = p.Id,
                    Name = p.Name,
                    ActiveIngredient = p.ActiveIngredient,
                    MedicineType = p.MedicineType,
                    Price = p.Price,
                    DosageInstruction = p.DosageInstruction,
                    PhiDays = p.PhiDays,
                    IsAllowed = p.IsAllowed,
                    RainResistant = p.RainResistant,
                    StockQuantity = p.StockQuantity,
                    ImageUrl = FormatImageUrl(p.ImageUrl ?? ""),
                    TargetDiseases = p.DiseaseProducts
                        .Where(dp => dp.Disease != null)
                        .Select(dp => dp.Disease.ClassCode)
                        .ToList()
                }).ToList();
            }
            else
            {
                // Kiểm tra xem bảng Products có trống hoàn toàn không (hay chỉ là không khớp điều kiện tìm kiếm)
                var hasAnyProducts = await _dbContext.Products.AnyAsync();
                if (!hasAnyProducts && (_env.IsDevelopment() || Environment.GetEnvironmentVariable("ENABLE_DEV_FALLBACK") == "true"))
                {
                    _logger.LogWarning("[MedicinesController] CSDL Products rỗng hoàn toàn, kích hoạt fallback cho Development.");
                    var fallbackQuery = GetFallbackMedicines().AsQueryable();

                    if (allowedOnly)
                    {
                        fallbackQuery = fallbackQuery.Where(m => m.IsAllowed);
                    }
                    if (requireRainResistant.HasValue && requireRainResistant.Value)
                    {
                        fallbackQuery = fallbackQuery.Where(m => m.RainResistant);
                    }
                    if (!string.IsNullOrWhiteSpace(diseaseCode))
                    {
                        fallbackQuery = fallbackQuery.Where(m => m.TargetDiseases.Any(d => d.Equals(diseaseCode, StringComparison.OrdinalIgnoreCase)));
                    }

                    items = fallbackQuery.ToList();
                    isFallback = true;
                }
                else
                {
                    items = new List<MedicineItemDto>();
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[MedicinesController] Lỗi khi truy vấn CSDL danh mục thuốc.");
            if (_env.IsDevelopment() || Environment.GetEnvironmentVariable("ENABLE_DEV_FALLBACK") == "true")
            {
                _logger.LogWarning("[MedicinesController] Fallback sang danh mục mẫu do lỗi kết nối CSDL trong chế độ Dev.");
                var fallbackQuery = GetFallbackMedicines().AsQueryable();

                if (allowedOnly)
                {
                    fallbackQuery = fallbackQuery.Where(m => m.IsAllowed);
                }
                if (requireRainResistant.HasValue && requireRainResistant.Value)
                {
                    fallbackQuery = fallbackQuery.Where(m => m.RainResistant);
                }
                if (!string.IsNullOrWhiteSpace(diseaseCode))
                {
                    fallbackQuery = fallbackQuery.Where(m => m.TargetDiseases.Any(d => d.Equals(diseaseCode, StringComparison.OrdinalIgnoreCase)));
                }

                items = fallbackQuery.ToList();
                isFallback = true;
            }
            else
            {
                // BUG-09: Ở môi trường Production không nuốt lỗi, trả HTTP 503 Service Unavailable
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new
                {
                    message = "Dịch vụ tra cứu thuốc BVTV tạm thời không khả dụng do gián đoạn cơ sở dữ liệu."
                });
            }
        }

        return Ok(new
        {
            total = items.Count,
            disease_code = diseaseCode ?? "ALL",
            is_fallback = isFallback,
            items
        });
    }

    private List<MedicineItemDto> GetFallbackMedicines()
    {
        return new List<MedicineItemDto>
        {
            new MedicineItemDto
            {
                Id = 1,
                Name = "Ridomil Gold 68WG",
                ActiveIngredient = "Metalaxyl-M 40g/kg + Mancozeb 640g/kg",
                MedicineType = "Hóa học",
                Price = 65000m,
                DosageInstruction = "Pha 50g cho bình 16L nước, phun ướt đều mặt lá khi bệnh chớm xuất hiện",
                PhiDays = 7,
                IsAllowed = true,
                RainResistant = true,
                StockQuantity = 150,
                ImageUrl = FormatImageUrl("/lavitree-diagnoses/products/ridomil-gold.png"),
                TargetDiseases = new List<string> { "Tomato___Late_blight", "Potato___Late_blight" }
            },
            new MedicineItemDto
            {
                Id = 2,
                Name = "Antracol 70WP",
                ActiveIngredient = "Propineb 700g/kg + Kẽm (Zn++)",
                MedicineType = "Hóa học",
                Price = 45000m,
                DosageInstruction = "Pha 40-50g cho bình 16L nước, phun phòng trừ mốc sương và thán thư",
                PhiDays = 7,
                IsAllowed = true,
                RainResistant = false,
                StockQuantity = 120,
                ImageUrl = FormatImageUrl("/lavitree-diagnoses/products/antracol.png"),
                TargetDiseases = new List<string> { "Tomato___Late_blight", "Tomato___Early_blight", "Pepper,_bell___Bacterial_spot" }
            },
            new MedicineItemDto
            {
                Id = 3,
                Name = "Chế phẩm sinh học Trichoderma Bacillus",
                ActiveIngredient = "Trichoderma spp. (10^9 CFU/g) + Bacillus subtilis",
                MedicineType = "Sinh học",
                Price = 55000m,
                DosageInstruction = "Pha 30g cho bình 16L nước hoặc tưới gốc đối kháng nấm bệnh",
                PhiDays = 0,
                IsAllowed = true,
                RainResistant = true,
                StockQuantity = 200,
                ImageUrl = FormatImageUrl("/lavitree-diagnoses/products/trichoderma.png"),
                TargetDiseases = new List<string> { "Tomato___Late_blight", "Tomato___Early_blight", "Tomato___Target_Spot" }
            },
            new MedicineItemDto
            {
                Id = 4,
                Name = "Thuốc trừ nấm Score 250EC",
                ActiveIngredient = "Difenoconazole 250g/L",
                MedicineType = "Hóa học",
                Price = 85000m,
                DosageInstruction = "Pha 10ml cho bình 16L nước, phun khi vết đốm vừa xuất hiện",
                PhiDays = 14,
                IsAllowed = true,
                RainResistant = true,
                StockQuantity = 80,
                ImageUrl = FormatImageUrl("/lavitree-diagnoses/products/score.png"),
                TargetDiseases = new List<string> { "Tomato___Early_blight", "Corn_(maize)___Common_rust_" }
            },
            new MedicineItemDto
            {
                Id = 5,
                Name = "Thuốc trừ cỏ cấm Paraquat / 2.4-D Cũ (Đã bị Cục BVTV cấm)",
                ActiveIngredient = "Paraquat Dichloride",
                MedicineType = "Hóa chất cấm",
                Price = 30000m,
                DosageInstruction = "Bị cấm lưu hành, tuyệt đối không sử dụng",
                PhiDays = 999,
                IsAllowed = false, // Dùng để kiểm thử Hard Guardrail lọc thuốc cấm
                RainResistant = false,
                StockQuantity = 0,
                ImageUrl = "",
                TargetDiseases = new List<string> { "Tomato___Late_blight" }
            }
        };
    }

    public class MedicineItemDto
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("active_ingredient")]
        public string ActiveIngredient { get; set; } = string.Empty;

        [JsonPropertyName("medicine_type")]
        public string MedicineType { get; set; } = "Hóa học";

        [JsonPropertyName("price")]
        public decimal Price { get; set; }

        [JsonPropertyName("dosage_instruction")]
        public string DosageInstruction { get; set; } = string.Empty;

        [JsonPropertyName("phi_days")]
        public int PhiDays { get; set; } = 7;

        [JsonPropertyName("is_allowed")]
        public bool IsAllowed { get; set; } = true;

        [JsonPropertyName("rain_resistant")]
        public bool RainResistant { get; set; } = false;

        [JsonPropertyName("stock_quantity")]
        public int StockQuantity { get; set; } = 100;

        [JsonPropertyName("image_url")]
        public string ImageUrl { get; set; } = string.Empty;

        [JsonPropertyName("target_diseases")]
        public List<string> TargetDiseases { get; set; } = new();
    }
}
