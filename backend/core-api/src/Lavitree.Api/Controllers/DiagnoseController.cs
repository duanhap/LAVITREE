using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Lavitree.Application.DTOs;
using Lavitree.Application.Interfaces;
using Lavitree.Domain.Entities;
using Lavitree.Infrastructure.Persistence;

namespace Lavitree.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class DiagnoseController : ControllerBase
{
    private readonly IAiVisionService _aiVisionService;
    private readonly LavitreeDbContext _dbContext;

    public DiagnoseController(IAiVisionService aiVisionService, LavitreeDbContext dbContext)
    {
        _aiVisionService = aiVisionService;
        _dbContext = dbContext;
    }

    [HttpPost("scan")]
    [ProducesResponseType(typeof(DiagnosisResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ScanLeaf(IFormFile file, [FromForm] string? note)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "Vui lòng đính kèm ảnh lá cây để chẩn đoán." });
        }

        // 1. Call AI Vision Microservice
        await using var stream = file.OpenReadStream();
        var aiResult = await _aiVisionService.PredictAsync(stream, file.FileName);

        // 2. Query Knowledge Base from Database
        var disease = await _dbContext.Diseases
            .Include(d => d.Plant)
            .Include(d => d.TreatmentPlans.OrderBy(tp => tp.StepOrder))
            .Include(d => d.DiseaseProducts)
                .ThenInclude(dp => dp.Product)
            .FirstOrDefaultAsync(d => d.ClassCode == aiResult.PredictedClass);

        var recordId = Guid.NewGuid();

        // If not found in DB yet (fallback default)
        var plantName = disease?.Plant?.Name ?? "Cây trồng";
        var diseaseNameVi = disease?.CommonNameVi ?? aiResult.PredictedClass.Replace("___", " - ").Replace("_", " ");
        var symptoms = disease?.Symptoms ?? "Quan sát biểu hiện tổn thương trên bề mặt lá.";

        var treatmentSteps = disease?.TreatmentPlans.Select(tp => new TreatmentStepDto
        {
            StepOrder = tp.StepOrder,
            ActionTitle = tp.ActionTitle,
            Instructions = tp.Instructions,
            IsolationDays = tp.IsolationDays
        }).ToList() ?? new();

        var products = disease?.DiseaseProducts.Select(dp => new ProductDto
        {
            Id = dp.Product.Id,
            Name = dp.Product.Name,
            ActiveIngredient = dp.Product.ActiveIngredient,
            Price = dp.Product.Price,
            ImageUrl = dp.Product.ImageUrl,
            DosageInstruction = dp.Product.DosageInstruction
        }).ToList() ?? new();

        // 3. Save Diagnosis Record
        if (disease != null)
        {
            var record = new DiagnosisRecord
            {
                Id = recordId,
                DiseaseId = disease.Id,
                OriginalImageUrl = $"/uploads/{file.FileName}",
                Confidence = aiResult.Confidence,
                IsUncertain = aiResult.IsUncertain,
                Notes = note,
                RecoveryStatus = "Đang theo dõi"
            };
            _dbContext.DiagnosisRecords.Add(record);
            await _dbContext.SaveChangesAsync();
        }

        var response = new DiagnosisResultDto
        {
            RecordId = recordId,
            PlantName = plantName,
            DiseaseNameVi = diseaseNameVi,
            ClassCode = aiResult.PredictedClass,
            IsHealthy = aiResult.IsHealthy,
            Confidence = aiResult.Confidence,
            IsUncertain = aiResult.IsUncertain,
            WarningMessage = aiResult.Warning,
            GradCamImageUrl = aiResult.GradcamImageBase64 != null ? $"data:image/jpeg;base64,{aiResult.GradcamImageBase64}" : null,
            OriginalImageUrl = $"/uploads/{file.FileName}",
            Symptoms = symptoms,
            TreatmentSteps = treatmentSteps,
            RecommendedProducts = products,
            DiagnosedAt = DateTime.UtcNow
        };

        return Ok(response);
    }
}
