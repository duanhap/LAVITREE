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
using System.Security.Claims;
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
                    Availability = p.Availability ?? "IN_STOCK",
                    InfoSourceUrl = p.InfoSourceUrl,
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

    // Danh sách hoạt chất cấm theo TT 75/2025/TT-BNNMT & QĐ 278/QĐ-BNN-BVTV (đồng bộ guardrails.py)
    public static readonly HashSet<string> BannedIngredients = new(StringComparer.OrdinalIgnoreCase)
    {
        "paraquat",
        "pa-ra-quat",
        "para-quat",
        "gramoxone",
        "2,4-d",
        "2.4-d",
        "2,4d",
        "2.4d",
        "chlorpyrifos",
        "carbofuran",
        "glyphosate",
        "monocrotophos",
        "methamidophos",
        "endosulfan"
    };

    public const string FarmingSupplyType = "Vật tư canh tác";
    private static readonly HashSet<string> ValidMedicineTypes = new(StringComparer.Ordinal) { "Hóa học", "Sinh học", FarmingSupplyType };
    private static readonly HashSet<string> ValidAvailabilities = new(StringComparer.Ordinal) { "IN_STOCK", "OUT_OF_STOCK", "NOT_SOLD" };

    private static bool IsHttpUrl(string? url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var u) && (u.Scheme == Uri.UriSchemeHttp || u.Scheme == Uri.UriSchemeHttps);

    public static bool IsBannedIngredient(string? ingredient)
    {
        if (string.IsNullOrWhiteSpace(ingredient)) return false;
        var lower = ingredient.ToLowerInvariant();
        return BannedIngredients.Any(banned => lower.Contains(banned));
    }

    public class MedicineItemDto
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("active_ingredient")]
        public string? ActiveIngredient { get; set; }

        [JsonPropertyName("medicine_type")]
        public string MedicineType { get; set; } = "Hóa học";

        [JsonPropertyName("price")]
        public decimal Price { get; set; }

        [JsonPropertyName("dosage_instruction")]
        public string DosageInstruction { get; set; } = string.Empty;

        [JsonPropertyName("phi_days")]
        public int? PhiDays { get; set; }

        [JsonPropertyName("is_allowed")]
        public bool IsAllowed { get; set; } = true;

        [JsonPropertyName("rain_resistant")]
        public bool RainResistant { get; set; } = false;

        [JsonPropertyName("stock_quantity")]
        public int StockQuantity { get; set; } = 100;

        [JsonPropertyName("availability")]
        public string Availability { get; set; } = "IN_STOCK";

        [JsonPropertyName("info_source_url")]
        public string? InfoSourceUrl { get; set; }

        [JsonPropertyName("image_url")]
        public string ImageUrl { get; set; } = string.Empty;

        [JsonPropertyName("target_diseases")]
        public List<string> TargetDiseases { get; set; } = new();
    }

    public class UpdateMedicineDto
    {
        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("active_ingredient")]
        public string? ActiveIngredient { get; set; }

        [JsonPropertyName("dosage_instruction")]
        public string? DosageInstruction { get; set; }

        [JsonPropertyName("is_allowed")]
        public bool? IsAllowed { get; set; }

        [JsonPropertyName("phi_days")]
        public int? PhiDays { get; set; }

        [JsonPropertyName("price")]
        public decimal? Price { get; set; }

        [JsonPropertyName("stock_quantity")]
        public int? StockQuantity { get; set; }

        [JsonPropertyName("availability")]
        public string? Availability { get; set; }

        [JsonPropertyName("info_source_url")]
        public string? InfoSourceUrl { get; set; }

        [JsonPropertyName("medicine_type")]
        public string? MedicineType { get; set; }
    }

    /// <summary>
    /// POST /api/v1/medicines
    /// Thêm thuốc/vật tư mới vào kho (Admin) (TASK-15 Pha 3)
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateMedicine([FromBody] Lavitree.Application.DTOs.CreateProductRequestDto dto)
    {
        var isAdmin = User.IsInRole("ADMIN") || User.HasClaim(ClaimTypes.Role, "ADMIN") || User.HasClaim("role", "ADMIN") || AdminApiKeyAuthAttribute.HasValidKey(Request);
        if (!isAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Yêu cầu quyền Quản trị viên để thêm sản phẩm vào kho." });
        }

        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var medicineType = dto.MedicineType?.Trim() ?? string.Empty;
        if (!ValidMedicineTypes.Contains(medicineType))
        {
            return BadRequest(new { detail = "Loại sản phẩm phải là 'Hóa học', 'Sinh học' hoặc 'Vật tư canh tác'." });
        }
        var availability = string.IsNullOrWhiteSpace(dto.Availability) ? "IN_STOCK" : dto.Availability.Trim().ToUpperInvariant();
        if (!ValidAvailabilities.Contains(availability))
        {
            return BadRequest(new { detail = "Tình trạng bán phải là IN_STOCK, OUT_OF_STOCK hoặc NOT_SOLD." });
        }
        var isFarmingSupply = medicineType == FarmingSupplyType;

        // Link nguồn: chỉ http/https (chặn javascript: khi hiển thị ở trang Admin); thuốc bắt buộc có
        var infoSourceUrl = string.IsNullOrWhiteSpace(dto.InfoSourceUrl) ? null : dto.InfoSourceUrl.Trim();
        if (infoSourceUrl != null && !IsHttpUrl(infoSourceUrl))
        {
            return BadRequest(new { detail = "Link nguồn phải là địa chỉ http(s) hợp lệ." });
        }
        if (!isFarmingSupply && infoSourceUrl == null)
        {
            return BadRequest(new { detail = "Thuốc hóa học/sinh học bắt buộc có link nguồn nơi tra PHI và liều (nhãn, trang nhà sản xuất)." });
        }

        // Chốt chặn thuốc cấm: quét cả tên với mọi loại (tránh khai "vật tư" để lách)
        if (IsBannedIngredient(dto.ActiveIngredient) || IsBannedIngredient(dto.Name))
        {
            return BadRequest(new { detail = $"Hoạt chất hoặc tên sản phẩm '{dto.ActiveIngredient ?? dto.Name}' nằm trong Danh mục thuốc BVTV cấm sử dụng tại Việt Nam theo Thông tư 75/2025. Tuyệt đối không được phép đưa vào lưu hành." });
        }

        // Với thuốc hóa học & sinh học: bắt buộc nhập PHI >= 0
        if (!isFarmingSupply)
        {
            if (!dto.PhiDays.HasValue || dto.PhiDays.Value < 0 || dto.PhiDays.Value > 365)
            {
                return BadRequest(new { detail = "Thuốc BVTV hóa học/sinh học bắt buộc phải nhập thời gian cách ly (PHI) từ 0 đến 365 ngày." });
            }
        }

        var product = new Lavitree.Domain.Entities.Product
        {
            Name = dto.Name.Trim(),
            ActiveIngredient = isFarmingSupply ? null : dto.ActiveIngredient?.Trim(),
            MedicineType = medicineType,
            Price = dto.Price,
            DosageInstruction = dto.DosageInstruction.Trim(),
            PhiDays = isFarmingSupply ? null : dto.PhiDays,
            StockQuantity = dto.StockQuantity,
            Availability = availability,
            InfoSourceUrl = infoSourceUrl,
            IsAllowed = dto.IsAllowed && !IsBannedIngredient(dto.ActiveIngredient),
            RainResistant = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.Products.Add(product);
        await _dbContext.SaveChangesAsync();

        // Gắn với bệnh mục tiêu nếu có
        if (!string.IsNullOrWhiteSpace(dto.TargetDiseaseCode))
        {
            var disease = await _dbContext.Diseases
                .FirstOrDefaultAsync(d => d.ClassCode.ToLower() == dto.TargetDiseaseCode.Trim().ToLower());
            if (disease != null)
            {
                _dbContext.DiseaseProducts.Add(new Lavitree.Domain.Entities.DiseaseProduct
                {
                    DiseaseId = disease.Id,
                    ProductId = product.Id
                });
                await _dbContext.SaveChangesAsync();
            }
        }

        // Cập nhật trạng thái suggestion nếu được tạo từ suggestion
        if (dto.SuggestionId.HasValue)
        {
            var suggestion = await _dbContext.ProductSuggestions
                .FirstOrDefaultAsync(s => s.Id == dto.SuggestionId.Value);
            if (suggestion != null)
            {
                suggestion.Status = "ADDED";
                suggestion.ProductId = product.Id;
                suggestion.ResolvedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();
            }
        }

        return CreatedAtAction(nameof(Search), new { id = product.Id }, new
        {
            id = product.Id,
            name = product.Name,
            active_ingredient = product.ActiveIngredient,
            medicine_type = product.MedicineType,
            price = product.Price,
            phi_days = product.PhiDays,
            availability = product.Availability,
            is_allowed = product.IsAllowed,
            stock_quantity = product.StockQuantity
        });
    }

    /// <summary>
    /// PATCH /api/v1/medicines/{id}
    /// Quản lý kho thuốc (Admin): Bật/tắt IsAllowed, cập nhật PhiDays, giá và tồn kho
    /// </summary>
    [HttpPatch("{id:int}")]
    public async Task<IActionResult> UpdateMedicine(int id, [FromBody] UpdateMedicineDto dto)
    {
        var isAdmin = User.IsInRole("ADMIN") || User.HasClaim(ClaimTypes.Role, "ADMIN") || User.HasClaim("role", "ADMIN") || AdminApiKeyAuthAttribute.HasValidKey(Request);
        if (!isAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Yêu cầu quyền Quản trị viên để cập nhật danh mục thuốc." });
        }

        var product = await _dbContext.Products.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (product == null)
        {
            return NotFound(new { detail = "Không tìm thấy sản phẩm thuốc BVTV." });
        }

        if (!string.IsNullOrWhiteSpace(dto.Name))
        {
            var name = dto.Name.Trim();
            if (IsBannedIngredient(name))
            {
                return BadRequest(new { detail = $"Tên sản phẩm '{name}' chứa hoạt chất cấm theo Thông tư 75/2025." });
            }
            product.Name = name;
        }

        if (dto.ActiveIngredient != null)
        {
            var active = dto.ActiveIngredient.Trim();
            if (active.Length > 0 && IsBannedIngredient(active))
            {
                return BadRequest(new { detail = $"Hoạt chất '{active}' nằm trong danh mục cấm theo Thông tư 75/2025." });
            }
            product.ActiveIngredient = active.Length > 0 ? active : null;
        }

        if (dto.DosageInstruction != null)
        {
            product.DosageInstruction = dto.DosageInstruction.Trim();
        }

        if (dto.IsAllowed.HasValue)
        {
            if (dto.IsAllowed.Value && (IsBannedIngredient(product.ActiveIngredient) || IsBannedIngredient(product.Name)))
            {
                return BadRequest(new { detail = "Sản phẩm nằm trong danh mục thuốc BVTV cấm sử dụng tại Việt Nam theo Thông tư 75/2025. Không thể bật lưu hành." });
            }
            product.IsAllowed = dto.IsAllowed.Value;
        }

        if (dto.PhiDays.HasValue)
        {
            if (dto.PhiDays.Value < 0 || dto.PhiDays.Value > 365)
            {
                return BadRequest(new { detail = "Số ngày cách ly (PhiDays) phải từ 0 đến 365 ngày." });
            }
            product.PhiDays = dto.PhiDays.Value;
        }

        if (dto.Price.HasValue)
        {
            if (dto.Price.Value < 0)
            {
                return BadRequest(new { detail = "Giá bán không được âm." });
            }
            product.Price = dto.Price.Value;
        }

        if (dto.StockQuantity.HasValue)
        {
            if (dto.StockQuantity.Value < 0)
            {
                return BadRequest(new { detail = "Số lượng tồn kho không được âm." });
            }
            product.StockQuantity = dto.StockQuantity.Value;
        }

        if (!string.IsNullOrWhiteSpace(dto.Availability))
        {
            var availability = dto.Availability.Trim().ToUpperInvariant();
            if (!ValidAvailabilities.Contains(availability))
            {
                return BadRequest(new { detail = "Tình trạng bán phải là IN_STOCK, OUT_OF_STOCK hoặc NOT_SOLD." });
            }
            product.Availability = availability;
        }

        if (dto.InfoSourceUrl != null)
        {
            var url = dto.InfoSourceUrl.Trim();
            if (url.Length > 0 && !IsHttpUrl(url))
            {
                return BadRequest(new { detail = "Link nguồn phải là địa chỉ http(s) hợp lệ." });
            }
            product.InfoSourceUrl = url.Length > 0 ? url : null;
        }

        if (!string.IsNullOrWhiteSpace(dto.MedicineType))
        {
            var medicineType = dto.MedicineType.Trim();
            if (!ValidMedicineTypes.Contains(medicineType))
            {
                return BadRequest(new { detail = "Loại sản phẩm phải là 'Hóa học', 'Sinh học' hoặc 'Vật tư canh tác'." });
            }
            product.MedicineType = medicineType;
        }

        // Đổi vật tư thành thuốc mà chưa có PHI: báo lỗi rõ thay vì để CHECK constraint ném 500
        if (product.MedicineType != FarmingSupplyType && !product.PhiDays.HasValue)
        {
            return BadRequest(new { detail = "Thuốc hóa học/sinh học bắt buộc có thời gian cách ly (phi_days)." });
        }

        product.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            id = product.Id,
            name = product.Name,
            active_ingredient = product.ActiveIngredient,
            dosage_instruction = product.DosageInstruction,
            is_allowed = product.IsAllowed,
            phi_days = product.PhiDays,
            price = product.Price,
            stock_quantity = product.StockQuantity,
            availability = product.Availability,
            info_source_url = product.InfoSourceUrl,
            medicine_type = product.MedicineType,
            updated_at = product.UpdatedAt
        });
    }
}
