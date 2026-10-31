using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
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
    private readonly IMinioStorageService _minioStorageService;
    private readonly LavitreeDbContext _dbContext;
    private readonly ILogger<DiagnoseController> _logger;

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp", ".bmp"
    };

    private static string GetSafeContentType(string extension) => extension.ToLowerInvariant() switch
    {
        ".jpg" or ".jpeg" => "image/jpeg",
        ".png" => "image/png",
        ".webp" => "image/webp",
        ".bmp" => "image/bmp",
        _ => "application/octet-stream"
    };

    private const long MaxFileSize = 10 * 1024 * 1024; // 10MB
    private const string BucketName = "lavitree-diagnoses";

    public DiagnoseController(
        IAiVisionService aiVisionService,
        IMinioStorageService minioStorageService,
        LavitreeDbContext dbContext,
        ILogger<DiagnoseController> logger)
    {
        _aiVisionService = aiVisionService;
        _minioStorageService = minioStorageService;
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <summary>
    /// POST /api/v1/diagnose - Khám lá toàn trình khép kín (SSOT: api-contracts.md Mục 3.1)
    /// </summary>
    [HttpPost]
    [Route("")]
    [EnableRateLimiting("diagnose_policy")]
    [RequestSizeLimit(MaxFileSize)]
    [ProducesResponseType(typeof(DiagnoseResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> DiagnoseLeaf(
        [FromForm] IFormFile? image,
        [FromForm] Guid? userId,
        [FromForm] string? notes,
        CancellationToken cancellationToken)
    {
        // 1. Kiểm tra sự tồn tại của tệp
        if (image == null || image.Length == 0)
        {
            return BadRequest(new { detail = "Vui lòng đính kèm ảnh lá cây để chẩn đoán." });
        }

        // 2. Kiểm tra phần mở rộng tệp và dung lượng <= 10MB (HTTP 400)
        var fileExtension = Path.GetExtension(image.FileName);
        if (string.IsNullOrEmpty(fileExtension) || !AllowedExtensions.Contains(fileExtension) || image.Length > MaxFileSize)
        {
            return BadRequest(new { detail = "Tệp vượt quá 10MB hoặc định dạng không hỗ trợ." });
        }

        AiPredictionResponse aiResult;
        try
        {
            await using var imageStream = image.OpenReadStream();
            aiResult = await _aiVisionService.PredictAsync(imageStream, image.FileName, includeHeatmap: true, cancellationToken);
        }
        catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.UnprocessableEntity || ex.Message.Contains("422"))
        {
            _logger.LogWarning(ex, "Ảnh gửi sang AI Service bị lỗi giải mã hoặc decompression bomb (HTTP 422).");
            return UnprocessableEntity(new { detail = "Tệp hình ảnh bị lỗi cấu trúc hoặc không thể giải mã." });
        }
        catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.BadRequest || ex.Message.Contains("400"))
        {
            _logger.LogWarning(ex, "AI Service từ chối yêu cầu không hợp lệ (HTTP 400).");
            return BadRequest(new { detail = "Tệp hình ảnh không hợp lệ hoặc vượt quá kích thước cho phép." });
        }

        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi gọi AI Microservice từ Core API.");
            return StatusCode(StatusCodes.Status502BadGateway, new { detail = "Không thể kết nối tới dịch vụ trí tuệ nhân tạo (AI Service)." });
        }

        // 3. XỬ LÝ QUYỀN RIÊNG TƯ & LƯU TRỮ KHI ẢNH BỊ OOD (OUT-OF-DISTRIBUTION)
        // Khi is_ood = true: Tuyệt đối KHÔNG tải ảnh lên MinIO và KHÔNG tạo bản ghi trong DiagnosisRecords!
        if (aiResult.IsOod)
        {
            _logger.LogInformation("Phát hiện ảnh ngoại lai (OOD). Áp dụng OOD Privacy Policy: Bỏ qua upload MinIO và bỏ qua ghi CSDL.");

            var oodResponse = new DiagnoseResponseDto
            {
                Success = true,
                DiagnosisId = null,
                IsOod = true,
                IsUncertain = false,
                Warning = aiResult.WarningMessage ?? "Ảnh nằm ngoài phạm vi 38 lớp cây trồng được hỗ trợ (OOD). Vui lòng chụp lại lá cây trong khung ngắm 15–20cm.",
                Result = null,
                VisualEvidence = null,
                TreatmentGuidelines = new List<TreatmentStepDto>(),
                RecommendedProducts = new List<ProductDto>(),
                VerifiedSources = new List<VerifiedSourceDto>()
            };

            return Ok(oodResponse);
        }

        // 4. XỬ LÝ ẢNH HỢP LỆ (IN-DISTRIBUTION)
        var diagnosisId = Guid.NewGuid();

        // 4.1. Tải ảnh gốc lên MinIO (Sử dụng Safe Content-Type suy luận từ file extension)
        string originalImageUrl;
        try
        {
            await using var origStream = image.OpenReadStream();
            var origObjectName = $"{diagnosisId}_orig{fileExtension}";
            var safeContentType = GetSafeContentType(fileExtension);
            originalImageUrl = await _minioStorageService.UploadFileAsync(
                BucketName,
                origObjectName,
                origStream,
                safeContentType,
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi tải ảnh gốc lên MinIO storage.");
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { detail = "Không thể lưu trữ hình ảnh lên hệ thống lưu trữ MinIO. Vui lòng thử lại sau." });
        }

        // 4.2. Giải mã và tải ảnh Grad-CAM Heatmap lên MinIO
        string? gradCamImageUrl = null;
        if (!string.IsNullOrWhiteSpace(aiResult.GradcamBase64))
        {
            try
            {
                var rawBase64 = aiResult.GradcamBase64;
                var commaIndex = rawBase64.IndexOf(',');
                if (commaIndex >= 0)
                {
                    rawBase64 = rawBase64.Substring(commaIndex + 1);
                }
                var gradcamBytes = Convert.FromBase64String(rawBase64);
                using var gradcamStream = new MemoryStream(gradcamBytes);
                var gradcamObjectName = $"{diagnosisId}_gradcam.jpg";
                gradCamImageUrl = await _minioStorageService.UploadFileAsync(
                    BucketName,
                    gradcamObjectName,
                    gradcamStream,
                    "image/jpeg",
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi giải mã hoặc tải ảnh Grad-CAM lên MinIO storage.");
            }
        }

        // 4.3. Truy vấn Tri thức CSDL theo ClassCode dự đoán
        var predictedClass = aiResult.Top1?.ClassCode ?? "";
        var disease = await _dbContext.Diseases
            .Include(d => d.Plant)
            .Include(d => d.TreatmentPlans.OrderBy(tp => tp.StepOrder))
            .Include(d => d.DiseaseProducts)
                .ThenInclude(dp => dp.Product)
            .FirstOrDefaultAsync(d => d.ClassCode == predictedClass, cancellationToken);

        // Fallback metadata nếu lớp bệnh chưa có trong DB
        var plantName = disease?.Plant?.Name ?? aiResult.Top1?.EffectivePlantName ?? "Cây trồng";
        var diseaseName = disease?.CommonNameVi ?? aiResult.Top1?.EffectiveDiseaseName ?? predictedClass;

        string severityLevel;
        if (aiResult.Top1?.IsHealthy == true || predictedClass.EndsWith("___healthy", StringComparison.OrdinalIgnoreCase))
        {
            severityLevel = "Cây khỏe mạnh (Không phát hiện bệnh)";
        }
        else
        {
            severityLevel = (disease?.SeverityLevel ?? 2) switch
            {
                1 => "Nhẹ (Theo dõi định kỳ)",
                3 => "Khẩn cấp (Cần xử lý ngay lập tức)",
                _ => "Nghiêm trọng (Cần xử lý trong 24-48h)"
            };
        }

        // Lấy tên tiếng Việt cho Top3 dự đoán
        var top3Codes = aiResult.Top3.Select(t => t.ClassCode).ToList();
        var top3Dict = await _dbContext.Diseases
            .Where(d => top3Codes.Contains(d.ClassCode))
            .ToDictionaryAsync(d => d.ClassCode, d => d.CommonNameVi, cancellationToken);

        // Trích xuất phác đồ xử lý chuẩn IPM
        var treatmentGuidelines = disease?.TreatmentPlans.Select(tp => new TreatmentStepDto
        {
            StepOrder = tp.StepOrder,
            ActionTitle = tp.ActionTitle,
            Instructions = tp.Instructions,
            IsolationDays = tp.IsolationDays
        }).ToList() ?? new List<TreatmentStepDto>();

        // Trích xuất danh mục thuốc BVTV đặc trị
        var recommendedProducts = disease?.DiseaseProducts.Select(dp => new ProductDto
        {
            Id = dp.Product.Id,
            Name = dp.Product.Name,
            ActiveIngredient = dp.Product.ActiveIngredient,
            Price = dp.Product.Price,
            Unit = "Gói / Chai chuẩn",
            ImageUrl = dp.Product.ImageUrl,
            DosageInstruction = dp.Product.DosageInstruction
        }).ToList() ?? new List<ProductDto>();

        // Trích xuất 1-3 tài liệu khuyến nông đối chứng từ KnowledgeSources
        var verifiedSources = await _dbContext.KnowledgeSources
            .Where(s => !s.IsDeleted && s.ModelClass == predictedClass)
            .OrderByDescending(s => s.CreatedAt)
            .Take(3)
            .Select(s => new VerifiedSourceDto
            {
                Organization = s.Organization,
                Title = s.SourceTitle,
                Url = s.SourceUrl
            })
            .ToListAsync(cancellationToken);

        // 4.4. Lưu vết ca chẩn đoán vào DiagnosisRecords trong PostgreSQL
        if (disease != null)
        {
            var diagnosisRecord = new DiagnosisRecord
            {
                Id = diagnosisId,
                UserId = userId,
                DiseaseId = disease.Id,
                OriginalImageUrl = originalImageUrl,
                GradCamImageUrl = gradCamImageUrl,
                Confidence = aiResult.Top1?.Confidence ?? 0f,
                IsUncertain = aiResult.IsUncertain,
                Notes = notes,
                RecoveryStatus = "Đang theo dõi",
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.DiagnosisRecords.Add(diagnosisRecord);
            await _dbContext.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Saved DiagnosisRecord {DiagnosisId} for disease {ClassCode}.", diagnosisId, predictedClass);
        }

        // 4.5. Đóng gói phản hồi trọn gói đúng 100% api-contracts.md Mục 3.1
        var response = new DiagnoseResponseDto
        {
            Success = true,
            DiagnosisId = diagnosisId,
            IsOod = false,
            IsUncertain = aiResult.IsUncertain,
            Warning = aiResult.WarningMessage ?? aiResult.Top1?.CaptureTip,
            Result = new DiagnoseResultDataDto
            {
                PlantName = plantName,
                DiseaseName = diseaseName,
                ClassCode = predictedClass,
                Confidence = aiResult.Top1?.Confidence ?? 0f,
                SeverityLevel = severityLevel,
                IsUncertain = aiResult.IsUncertain,
                ConfusionGroup = aiResult.Top1?.ConfusionGroup,
                Warning = aiResult.WarningMessage ?? aiResult.Top1?.CaptureTip,
                Top3 = aiResult.Top3.Select(t => new Top3ItemDto
                {
                    ClassCode = t.ClassCode,
                    DiseaseName = top3Dict.TryGetValue(t.ClassCode, out var dName) 
                        ? dName 
                        : (t.ClassCode == predictedClass ? diseaseName : t.ClassCode),
                    Confidence = t.Confidence
                }).ToList()
            },
            VisualEvidence = new VisualEvidenceDto
            {
                OriginalImageUrl = originalImageUrl,
                GradcamImageUrl = gradCamImageUrl
            },
            TreatmentGuidelines = treatmentGuidelines,
            RecommendedProducts = recommendedProducts,
            VerifiedSources = verifiedSources
        };

        return Ok(response);
    }
}
