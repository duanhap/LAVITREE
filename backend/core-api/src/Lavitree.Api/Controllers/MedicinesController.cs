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
using Lavitree.Infrastructure.Services;
using Microsoft.Extensions.Logging;
using System.Text.Json.Serialization;
using System.Security.Claims;
using Lavitree.Api.Security;
using Microsoft.AspNetCore.Authorization;
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
        [FromQuery] bool allowedOnly = true,
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null)
    {
        // BUG-34: phân trang tùy chọn (pageSize 1–200, mặc định 50); không có page thì trả đủ như trước
        if (page is < 1 || pageSize is < 1 or > 200)
        {
            return BadRequest(new { message = "page phải ≥ 1, pageSize từ 1 đến 200." });
        }

        // Danh sách có thuốc cấm chỉ dành cho Admin; khách, nông dân và Agent chỉ thấy thuốc được phép
        if (!allowedOnly && !User.IsAdmin())
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

            var dbProducts = await query.OrderBy(p => p.Id).ToListAsync(); // thứ tự cố định cho phân trang (BUG-34)
            if (allowedOnly)
            {
                // Chất bị cấm SAU khi sản phẩm được lưu (thông tư mới) cũng phải loại ngay (TASK-19)
                dbProducts = dbProducts.Where(p => !IsBannedIngredient(p.Name) && !IsBannedIngredient(p.ActiveIngredient)).ToList();
            }

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
                        .ToList(),
                    UsageProfile = p.UsageProfile
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

        var total = items.Count;
        if (page.HasValue)
        {
            var size = pageSize ?? 50;
            items = items.Skip((page.Value - 1) * size).Take(size).ToList();
        }

        return Ok(new
        {
            total,
            page,
            page_size = page.HasValue ? pageSize ?? 50 : (int?)null,
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
                ImageUrl = "", // BUG-37: file ảnh này không tồn tại trong MinIO
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
                ImageUrl = "", // BUG-37: file ảnh này không tồn tại trong MinIO
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
                ImageUrl = "", // BUG-37: file ảnh này không tồn tại trong MinIO
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
                ImageUrl = "", // BUG-37: file ảnh này không tồn tại trong MinIO
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

    // Danh mục chất cấm: bảng BannedSubstances (TASK-19), xem BannedSubstanceRegistry

    public const string FarmingSupplyType = "Vật tư canh tác";
    private static readonly HashSet<string> ValidMedicineTypes = new(StringComparer.Ordinal) { "Hóa học", "Sinh học", FarmingSupplyType };
    private static readonly HashSet<string> ValidAvailabilities = new(StringComparer.Ordinal) { "IN_STOCK", "OUT_OF_STOCK", "NOT_SOLD" };

    private static bool IsHttpUrl(string? url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var u) && (u.Scheme == Uri.UriSchemeHttp || u.Scheme == Uri.UriSchemeHttps);

    /// <summary>Chuẩn hóa + kiểm tra phiếu cách dùng (TASK-18). Phiếu rỗng → null. Lỗi → error khác null.</summary>
    private static Lavitree.Domain.Entities.UsageProfile? PrepareUsageProfile(Lavitree.Domain.Entities.UsageProfile? profile, out string? error)
    {
        error = null;
        if (profile == null) return null;
        profile.Normalize();
        if (profile.IsEmpty) return null;
        var errors = profile.Validate();
        if (errors.Count > 0)
        {
            error = "Phiếu cách dùng không hợp lệ: " + string.Join(" ", errors);
            return null;
        }
        return profile;
    }

    public static bool IsBannedIngredient(string? ingredient) => BannedSubstanceRegistry.IsBanned(ingredient);

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

        [JsonPropertyName("usage_profile")]
        public Lavitree.Domain.Entities.UsageProfile? UsageProfile { get; set; }
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

        /// <summary>null = giữ nguyên; "" = gỡ ảnh; còn lại phải là http(s).</summary>
        [JsonPropertyName("image_url")]
        public string? ImageUrl { get; set; }

        /// <summary>null = giữ nguyên; danh sách (kể cả rỗng) = thay toàn bộ liên kết bệnh hại theo ClassCode.</summary>
        [JsonPropertyName("target_diseases")]
        public List<string>? TargetDiseases { get; set; }

        /// <summary>null = giữ nguyên; phiếu (kể cả rỗng {}) = thay toàn bộ, phiếu rỗng = xóa phiếu.</summary>
        [JsonPropertyName("usage_profile")]
        public Lavitree.Domain.Entities.UsageProfile? UsageProfile { get; set; }
    }

    /// <summary>
    /// POST /api/v1/medicines
    /// Thêm thuốc/vật tư mới vào kho (Admin) (TASK-15 Pha 3)
    /// </summary>
    [HttpPost]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> CreateMedicine([FromBody] Lavitree.Application.DTOs.CreateProductRequestDto dto)
    {
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

        // Link nguồn: chỉ http/https nếu có nhập (tùy chọn tra cứu)
        var infoSourceUrl = string.IsNullOrWhiteSpace(dto.InfoSourceUrl) ? null : dto.InfoSourceUrl.Trim();
        if (infoSourceUrl != null && !IsHttpUrl(infoSourceUrl))
        {
            return BadRequest(new { detail = "Link nguồn phải là địa chỉ http(s) hợp lệ." });
        }

        // Chốt chặn thuốc cấm: quét cả tên với mọi loại (tránh khai "vật tư" để lách)
        if (IsBannedIngredient(dto.ActiveIngredient) || IsBannedIngredient(dto.Name))
        {
            var names = string.Join(", ", BannedSubstanceRegistry.FindBanned($"{dto.Name} {dto.ActiveIngredient}"));
            return BadRequest(new { detail = $"Sản phẩm chứa hoạt chất cấm sử dụng tại Việt Nam ({names}), xem tab Chất cấm. Không được phép đưa vào lưu hành." });
        }

        // PHI (thời gian cách ly trước thu hoạch): KHÔNG tự điền mặc định. Con số này được hiện cho nông dân và
        // dùng trong guardrail của Lavi (chặn thuốc khi còn ít ngày tới thu hoạch), nên phải lấy từ nhãn/nguồn.
        // Thuốc hóa học và sinh học bắt buộc nhập (khớp CHECK CK_Products_PhiDays_RequiredForMedicine và
        // schema MCP của Agent); vật tư canh tác không áp dụng → null.
        int? phiDays = null;
        if (!isFarmingSupply)
        {
            if (!dto.PhiDays.HasValue)
            {
                return BadRequest(new { detail = "Thuốc hóa học/sinh học bắt buộc nhập thời gian cách ly (PHI) theo nhãn thuốc hoặc nguồn tra cứu. Hệ thống không tự điền giá trị mặc định." });
            }
            if (dto.PhiDays.Value < 0 || dto.PhiDays.Value > 365)
            {
                return BadRequest(new { detail = "Thời gian cách ly (PHI) phải từ 0 đến 365 ngày." });
            }
            phiDays = dto.PhiDays.Value;
        }

        var usageProfile = PrepareUsageProfile(dto.UsageProfile, out var usageError);
        if (usageError != null)
        {
            return BadRequest(new { detail = usageError });
        }

        var product = new Lavitree.Domain.Entities.Product
        {
            Name = dto.Name.Trim(),
            ActiveIngredient = isFarmingSupply ? null : dto.ActiveIngredient?.Trim(),
            MedicineType = medicineType,
            Price = dto.Price,
            ImageUrl = string.IsNullOrWhiteSpace(dto.ImageUrl) ? null : dto.ImageUrl.Trim(),
            DosageInstruction = string.IsNullOrWhiteSpace(dto.DosageInstruction)
                ? (isFarmingSupply ? "Sử dụng theo hướng dẫn nhà sản xuất" : "Pha theo hướng dẫn trên bao bì")
                : dto.DosageInstruction.Trim(),
            PhiDays = phiDays,
            StockQuantity = dto.StockQuantity,
            Availability = availability,
            InfoSourceUrl = infoSourceUrl,
            UsageProfile = usageProfile,
            IsAllowed = dto.IsAllowed && !IsBannedIngredient(dto.ActiveIngredient),
            RainResistant = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.Products.Add(product);
        await _dbContext.SaveChangesAsync();

        // Gắn với các bệnh mục tiêu (target_diseases, giữ tương thích target_disease_code cũ)
        var targetCodes = (dto.TargetDiseases ?? new List<string>())
            .Append(dto.TargetDiseaseCode ?? string.Empty)
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Select(c => c.Trim().ToLower())
            .Distinct()
            .ToList();
        if (targetCodes.Count > 0)
        {
            var diseases = await _dbContext.Diseases
                .Where(d => targetCodes.Contains(d.ClassCode.ToLower()))
                .ToListAsync();
            foreach (var disease in diseases)
            {
                _dbContext.DiseaseProducts.Add(new Lavitree.Domain.Entities.DiseaseProduct
                {
                    DiseaseId = disease.Id,
                    ProductId = product.Id
                });
            }
            if (diseases.Count > 0)
            {
                await _dbContext.SaveChangesAsync();
            }
        }

        // Cập nhật trạng thái suggestion nếu được tạo từ suggestion (đồng bộ các bản ghi có cùng mention_text).
        // Chỉ đóng gợi ý có bệnh đã được gắn (hoặc không có bệnh); gợi ý cho cây / bệnh khác giữ PENDING để Admin Gắn SP sau.
        var keptPending = 0;
        if (dto.SuggestionId.HasValue)
        {
            var suggestion = await _dbContext.ProductSuggestions
                .FirstOrDefaultAsync(s => s.Id == dto.SuggestionId.Value);
            if (suggestion != null)
            {
                var targetMention = suggestion.MentionText.Trim().ToLower();
                var sameSuggestions = await _dbContext.ProductSuggestions
                    .Where(s => !s.IsDeleted && s.Status == "PENDING" && s.MentionText.Trim().ToLower() == targetMention)
                    .ToListAsync();

                if (!sameSuggestions.Any(s => s.Id == suggestion.Id))
                {
                    sameSuggestions.Add(suggestion);
                }

                var attachedCodes = await _dbContext.DiseaseProducts
                    .Where(dp => dp.ProductId == product.Id)
                    .Select(dp => dp.Disease.ClassCode.ToLower())
                    .ToListAsync();

                foreach (var s in sameSuggestions)
                {
                    var covered = s.Id == suggestion.Id
                        || string.IsNullOrWhiteSpace(s.ModelClass)
                        || attachedCodes.Contains(s.ModelClass.Trim().ToLower());
                    if (!covered)
                    {
                        keptPending++;
                        continue;
                    }
                    s.Status = "ADDED";
                    s.ProductId = product.Id;
                    s.ResolvedAt = DateTime.UtcNow;
                }
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
            stock_quantity = product.StockQuantity,
            usage_profile = product.UsageProfile,
            suggestions_kept_pending = keptPending
        });
    }

    /// <summary>
    /// PATCH /api/v1/medicines/{id}
    /// Quản lý kho thuốc (Admin): Bật/tắt IsAllowed, cập nhật PhiDays, giá và tồn kho
    /// </summary>
    [HttpPatch("{id:int}")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> UpdateMedicine(int id, [FromBody] UpdateMedicineDto dto)
    {
        var product = await _dbContext.Products.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);
        if (product == null)
        {
            return NotFound(new { detail = "Không tìm thấy sản phẩm thuốc BVTV." });
        }

        if (!string.IsNullOrWhiteSpace(dto.Name))
        {
            product.Name = dto.Name.Trim();
        }

        if (dto.ActiveIngredient != null)
        {
            var active = dto.ActiveIngredient.Trim();
            product.ActiveIngredient = active.Length > 0 ? active : null;
        }

        if (dto.DosageInstruction != null)
        {
            product.DosageInstruction = dto.DosageInstruction.Trim();
        }

        var isBanned = IsBannedIngredient(product.Name) || IsBannedIngredient(product.ActiveIngredient);
        if (isBanned)
        {
            if (dto.IsAllowed == true)
            {
                var names = string.Join(", ", BannedSubstanceRegistry.FindBanned($"{product.Name} {product.ActiveIngredient}"));
                return BadRequest(new { detail = $"Sản phẩm chứa hoạt chất cấm sử dụng tại Việt Nam ({names}) theo Thông tư 75/2025. Không thể bật lưu hành." });
            }
            product.IsAllowed = false;
        }
        else if (dto.IsAllowed.HasValue)
        {
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

        if (dto.ImageUrl != null)
        {
            var img = dto.ImageUrl.Trim();
            // Ảnh lưu đường dẫn tương đối (MinIO) được GET trả về dạng tuyệt đối; gửi lại y nguyên = không đổi.
            if (img.Length > 0 && img == FormatImageUrl(product.ImageUrl ?? string.Empty))
            {
                // giữ nguyên
            }
            else if (img.Length > 0 && !IsHttpUrl(img))
            {
                return BadRequest(new { detail = "Ảnh sản phẩm phải là địa chỉ http(s) hợp lệ." });
            }
            else
            {
                product.ImageUrl = img.Length > 0 ? img : null;
            }
        }

        if (dto.UsageProfile != null)
        {
            var usageProfile = PrepareUsageProfile(dto.UsageProfile, out var usageError);
            if (usageError != null)
            {
                return BadRequest(new { detail = usageError });
            }
            product.UsageProfile = usageProfile;
        }

        // Đổi vật tư thành thuốc mà chưa có PHI: báo lỗi rõ thay vì để CHECK constraint ném 500
        if (product.MedicineType != FarmingSupplyType && !product.PhiDays.HasValue)
        {
            return BadRequest(new { detail = "Thuốc hóa học/sinh học bắt buộc có thời gian cách ly (phi_days)." });
        }
        // Vật tư canh tác không có PHI (khớp CHECK constraint và cách tạo mới)
        if (product.MedicineType == FarmingSupplyType)
        {
            product.PhiDays = null;
        }

        // Thay toàn bộ liên kết bệnh hại khi client gửi target_diseases
        if (dto.TargetDiseases != null)
        {
            var codes = dto.TargetDiseases
                .Where(c => !string.IsNullOrWhiteSpace(c))
                .Select(c => c.Trim().ToLower())
                .Distinct()
                .ToList();
            var wanted = await _dbContext.Diseases
                .Where(d => codes.Contains(d.ClassCode.ToLower()))
                .ToListAsync();
            if (wanted.Count != codes.Count)
            {
                var found = wanted.Select(d => d.ClassCode.ToLower()).ToHashSet();
                var missing = string.Join(", ", codes.Where(c => !found.Contains(c)));
                return BadRequest(new { detail = $"Không tìm thấy bệnh hại: {missing}." });
            }
            var wantedIds = wanted.Select(d => d.Id).ToHashSet();
            var current = await _dbContext.DiseaseProducts.Where(dp => dp.ProductId == product.Id).ToListAsync();
            _dbContext.DiseaseProducts.RemoveRange(current.Where(dp => !wantedIds.Contains(dp.DiseaseId)));
            var currentIds = current.Select(dp => dp.DiseaseId).ToHashSet();
            foreach (var diseaseId in wantedIds.Where(id => !currentIds.Contains(id)))
            {
                _dbContext.DiseaseProducts.Add(new Lavitree.Domain.Entities.DiseaseProduct
                {
                    DiseaseId = diseaseId,
                    ProductId = product.Id
                });
            }
        }

        product.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        var targetDiseases = await _dbContext.DiseaseProducts
            .Where(dp => dp.ProductId == product.Id && dp.Disease != null)
            .Select(dp => dp.Disease.ClassCode)
            .ToListAsync();

        return Ok(new
        {
            image_url = FormatImageUrl(product.ImageUrl ?? string.Empty),
            target_diseases = targetDiseases,
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
            usage_profile = product.UsageProfile,
            updated_at = product.UpdatedAt
        });
    }

    /// <summary>
    /// GET /api/v1/medicines/{id:int}
    /// Lấy chi tiết một sản phẩm (TASK-21)
    /// </summary>
    [HttpGet("{id:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(int id)
    {
        var product = await _dbContext.Products
            .Include(p => p.DiseaseProducts)
                .ThenInclude(dp => dp.Disease)
                    .ThenInclude(d => d.Plant)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

        if (product == null)
        {
            return NotFound(new { detail = "Không tìm thấy sản phẩm hoặc sản phẩm đã bị xóa." });
        }

        var isAdmin = User.IsAdmin();
        if (!isAdmin)
        {
            if (!product.IsAllowed || product.Availability == "NOT_SOLD" || IsBannedIngredient(product.Name) || IsBannedIngredient(product.ActiveIngredient))
            {
                return NotFound(new { detail = "Sản phẩm không khả dụng hoặc đã dừng kinh doanh." });
            }
        }

        var targetDiseases = product.DiseaseProducts
            .Where(dp => dp.Disease != null)
            .Select(dp => dp.Disease!.ClassCode)
            .ToList();

        var diseases = product.DiseaseProducts
            .Where(dp => dp.Disease != null)
            .Select(dp => new
            {
                class_code = dp.Disease!.ClassCode,
                disease_name = dp.Disease.CommonNameVi,
                plant_name = dp.Disease.Plant?.Name ?? string.Empty
            })
            .ToList();

        return Ok(new
        {
            id = product.Id,
            name = product.Name,
            active_ingredient = product.ActiveIngredient,
            medicine_type = product.MedicineType,
            price = product.Price,
            dosage_instruction = product.DosageInstruction,
            phi_days = product.PhiDays,
            is_allowed = product.IsAllowed,
            rain_resistant = product.RainResistant,
            stock_quantity = product.StockQuantity,
            availability = product.Availability ?? "IN_STOCK",
            info_source_url = product.InfoSourceUrl,
            image_url = FormatImageUrl(product.ImageUrl ?? ""),
            usage_profile = product.UsageProfile,
            target_diseases = targetDiseases,
            diseases = diseases
        });
    }

    /// <summary>
    /// GET /api/v1/medicines/{id:int}/evidence
    /// Lấy danh sách căn cứ tài liệu của sản phẩm (TASK-21)
    /// </summary>
    [HttpGet("{id:int}/evidence")]
    [AllowAnonymous]
    public async Task<IActionResult> GetEvidence(int id, [FromQuery] string? diseaseCode)
    {
        var productExists = await _dbContext.Products.AnyAsync(p => p.Id == id && !p.IsDeleted);
        if (!productExists)
        {
            return NotFound(new { detail = "Không tìm thấy sản phẩm." });
        }

        var isAdmin = User.IsAdmin();

        var query = _dbContext.ProductSuggestions
            .Include(ps => ps.KnowledgeSource)
            .Where(ps => ps.ProductId == id
                      && (ps.Status == "LINKED" || ps.Status == "ADDED")
                      && !ps.IsDeleted
                      && ps.KnowledgeSource != null
                      && !ps.KnowledgeSource.IsDeleted);

        if (!isAdmin)
        {
            query = query.Where(ps => ps.KnowledgeSource!.IsManualApproved);
        }

        if (!string.IsNullOrWhiteSpace(diseaseCode))
        {
            var norm = diseaseCode.Trim().ToLower();
            query = query.Where(ps => ps.ModelClass.ToLower() == norm);
        }

        var rawList = await query.ToListAsync();

        // Gộp trùng: nếu cùng KnowledgeSourceId và cùng ModelClass có nhiều gợi ý cho cùng sản phẩm, chỉ trả 1 dòng (lấy suggestion_id nhỏ nhất)
        var deduplicated = rawList
            .GroupBy(ps => new { ps.KnowledgeSourceId, ps.ModelClass })
            .Select(g => g.OrderBy(ps => ps.Id).First())
            .ToList();

        // Nạp thông tin tên bệnh và cây trồng
        var classCodes = deduplicated.Select(ps => ps.ModelClass).Distinct().ToList();
        var diseases = await _dbContext.Diseases
            .Include(d => d.Plant)
            .Where(d => classCodes.Contains(d.ClassCode))
            .ToDictionaryAsync(d => d.ClassCode, StringComparer.OrdinalIgnoreCase);

        var results = deduplicated.Select(ps =>
        {
            diseases.TryGetValue(ps.ModelClass, out var d);
            var classMeta = KnowledgeController.All38Classes.FirstOrDefault(c => c.ModelClass == ps.ModelClass);
            var diseaseName = d?.CommonNameVi ?? classMeta?.DiseaseName ?? ps.ModelClass;
            var plantName = d?.Plant?.Name ?? classMeta?.PlantName ?? "Cây trồng";

            return new
            {
                suggestion_id = ps.Id,
                knowledge_source_id = ps.KnowledgeSourceId,
                model_class = ps.ModelClass,
                disease_name = diseaseName,
                plant_name = plantName,
                mention_text = ps.MentionText,
                unit_type = ps.KnowledgeSource?.UnitType ?? "TREATMENT",
                evidence_text = ps.KnowledgeSource?.EvidenceText ?? string.Empty,
                is_verbatim = ps.KnowledgeSource?.IsVerbatim ?? false,
                source_url = ps.KnowledgeSource?.SourceUrl ?? string.Empty,
                source_title = ps.KnowledgeSource?.SourceTitle ?? string.Empty,
                organization = ps.KnowledgeSource?.Organization ?? string.Empty,
                published_date = ps.KnowledgeSource?.PublishedDate,
                is_approved = ps.KnowledgeSource?.IsManualApproved ?? false,
                status = ps.Status
            };
        })
        .OrderBy(r => r.model_class)
        .ThenByDescending(r => r.is_approved)
        .ThenByDescending(r => r.published_date)
        .ToList();

        return Ok(results);
    }
}
