using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Lavitree.Domain.Entities;
using Lavitree.Infrastructure.Persistence;

namespace Lavitree.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class DiseasesController : ControllerBase
{
    private readonly LavitreeDbContext _dbContext;

    public DiseasesController(LavitreeDbContext dbContext)
    {
        _dbContext = dbContext;
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

        var results = await query.Select(d => new
        {
            d.Id,
            d.ClassCode,
            PlantName = d.Plant.Name,
            d.CommonNameVi,
            d.PathogenType,
            d.SeverityLevel,
            d.Symptoms,
            d.Prevention
        }).ToListAsync();

        return Ok(results);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var disease = await _dbContext.Diseases
            .Include(d => d.Plant)
            .Include(d => d.TreatmentPlans.OrderBy(tp => tp.StepOrder))
            .Include(d => d.DiseaseProducts)
                .ThenInclude(dp => dp.Product)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (disease == null) return NotFound(new { message = "Không tìm thấy thông tin bệnh." });

        return Ok(disease);
    }
}
