using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Lavitree.Api.Security;
using Lavitree.Domain.Entities;
using Lavitree.Infrastructure.Persistence;

namespace Lavitree.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class DiseasesController : ControllerBase
{
    private static readonly HashSet<string> ValidPathogenTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "Nấm",
        "Vi khuẩn",
        "Virus",
        "Nhện hại",
        "Khỏe mạnh"
    };

    private readonly LavitreeDbContext _dbContext;
    private readonly ILogger<DiseasesController> _logger;

    public DiseasesController(LavitreeDbContext dbContext, ILogger<DiseasesController> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? plantId, [FromQuery] string? keyword)
    {
        var query = _dbContext.Diseases
            .Include(d => d.Plant)
            .AsNoTracking();

        if (plantId.HasValue)
        {
            query = query.Where(d => d.PlantId == plantId.Value);
        }

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            query = query.Where(d => d.CommonNameVi.Contains(keyword) || d.ClassCode.Contains(keyword));
        }

        // Đếm số đoạn tri thức đã kiểm duyệt bằng 1 truy vấn GroupBy chống N+1 (TASK-20)
        var approvedCounts = await _dbContext.KnowledgeSources
            .Where(k => k.IsManualApproved && !k.IsDeleted && !string.IsNullOrWhiteSpace(k.ModelClass))
            .GroupBy(k => k.ModelClass)
            .Select(g => new { ModelClass = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ModelClass, x => x.Count);

        var dbDiseases = await query.ToListAsync();

        var results = dbDiseases.Select(d => new
        {
            d.Id,
            d.ClassCode,
            PlantName = d.Plant?.Name ?? string.Empty,
            d.CommonNameVi,
            d.PathogenType,
            d.PathogenName,
            ApprovedKnowledgeCount = approvedCounts.TryGetValue(d.ClassCode, out var c) ? c : 0,
            d.SeverityLevel,
            d.Symptoms,
            d.Prevention
        }).ToList();

        return Ok(results);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var disease = await _dbContext.Diseases
            .Include(d => d.Plant)
            .Include(d => d.TreatmentPlans.OrderBy(tp => tp.StepOrder))
            .Include(d => d.DiseaseProducts.Where(dp => dp.Product != null && dp.Product.IsAllowed && !dp.Product.IsDeleted))
                .ThenInclude(dp => dp.Product)
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id);

        if (disease == null) return NotFound(new { message = "Không tìm thấy thông tin bệnh." });

        var result = new
        {
            disease.Id,
            disease.ClassCode,
            PlantName = disease.Plant?.Name ?? "Cây trồng",
            disease.CommonNameVi,
            disease.PathogenType,
            disease.PathogenName,
            disease.SeverityLevel,
            disease.Symptoms,
            CaptureTip = disease.Symptoms,
            disease.Prevention,
            TreatmentPlans = disease.TreatmentPlans.Select(tp => new
            {
                tp.StepOrder,
                tp.ActionTitle,
                tp.Instructions,
                tp.IsolationDays
            }),
            Products = disease.DiseaseProducts.Where(dp => dp.Product != null).Select(dp => new
            {
                dp.Product.Id,
                dp.Product.Name,
                dp.Product.ActiveIngredient,
                dp.Product.Price,
                dp.Product.ImageUrl,
                dp.Product.DosageInstruction
            })
        };

        return Ok(result);
    }

    [HttpGet("by-class/{classCode}")]
    public async Task<IActionResult> GetByClassCode(string classCode)
    {
        var disease = await _dbContext.Diseases
            .Include(d => d.Plant)
            .Include(d => d.TreatmentPlans.OrderBy(tp => tp.StepOrder))
            .Include(d => d.DiseaseProducts.Where(dp => dp.Product != null && dp.Product.IsAllowed && !dp.Product.IsDeleted))
                .ThenInclude(dp => dp.Product)
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.ClassCode == classCode);

        if (disease == null) return NotFound(new { message = "Không tìm thấy thông tin bệnh với mã lớp này." });

        var result = new
        {
            disease.Id,
            disease.ClassCode,
            PlantName = disease.Plant?.Name ?? "Cây trồng",
            disease.CommonNameVi,
            disease.PathogenType,
            disease.PathogenName,
            disease.SeverityLevel,
            disease.Symptoms,
            CaptureTip = disease.Symptoms,
            disease.Prevention,
            TreatmentPlans = disease.TreatmentPlans.Select(tp => new
            {
                tp.StepOrder,
                tp.ActionTitle,
                tp.Instructions,
                tp.IsolationDays
            }),
            Products = disease.DiseaseProducts.Where(dp => dp.Product != null).Select(dp => new
            {
                dp.Product.Id,
                dp.Product.Name,
                dp.Product.ActiveIngredient,
                dp.Product.Price,
                dp.Product.ImageUrl,
                dp.Product.DosageInstruction
            })
        };

        return Ok(result);
    }

    /// <summary>
    /// PATCH /api/v1/diseases/{id}
    /// Cập nhật loại tác nhân và tên khoa học của tác nhân (Admin Only - TASK-20)
    /// </summary>
    [HttpPatch("{id:int}")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> UpdatePathogen(int id, [FromBody] UpdateDiseasePathogenDto dto)
    {
        var disease = await _dbContext.Diseases.Include(d => d.Plant).FirstOrDefaultAsync(d => d.Id == id);
        if (disease == null)
        {
            return NotFound(new { detail = $"Không tìm thấy bệnh với mã định danh {id}." });
        }

        if (string.IsNullOrWhiteSpace(dto.PathogenType))
        {
            return BadRequest(new { detail = "Loại tác nhân (pathogen_type) không được để trống." });
        }

        var cleanType = dto.PathogenType.Trim();
        var matchedType = ValidPathogenTypes.FirstOrDefault(t => string.Equals(t, cleanType, StringComparison.OrdinalIgnoreCase));
        if (matchedType == null)
        {
            return BadRequest(new { detail = $"Loại tác nhân '{cleanType}' không hợp lệ. Chỉ chấp nhận: Nấm, Vi khuẩn, Virus, Nhện hại, Khỏe mạnh." });
        }

        string? cleanName = null;
        if (dto.PathogenName != null)
        {
            var raw = dto.PathogenName.Trim();
            if (raw.Length > 200)
            {
                return BadRequest(new { detail = "Tên khoa học tác nhân (pathogen_name) không được vượt quá 200 ký tự." });
            }
            if (raw.Contains('<') || raw.Contains('>'))
            {
                return BadRequest(new { detail = "Tên khoa học tác nhân không được chứa ký tự '<' hoặc '>'." });
            }
            cleanName = raw.Length > 0 ? raw : null;
        }

        disease.PathogenType = matchedType;
        disease.PathogenName = cleanName;
        disease.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                  ?? User.FindFirst("sub")?.Value
                  ?? "unknown";

        _logger.LogInformation("Admin {UserId} sửa tác nhân bệnh {ClassCode}", userId, disease.ClassCode);

        return Ok(new
        {
            id = disease.Id,
            class_code = disease.ClassCode,
            plant_name = disease.Plant?.Name ?? string.Empty,
            common_name_vi = disease.CommonNameVi,
            pathogen_type = disease.PathogenType,
            pathogen_name = disease.PathogenName,
            updated_at = disease.UpdatedAt
        });
    }
}

public class UpdateDiseasePathogenDto
{
    [JsonPropertyName("pathogen_type")]
    public string? PathogenType { get; set; }

    [JsonPropertyName("pathogen_name")]
    public string? PathogenName { get; set; }
}
