using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
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
        [FromForm] string? notes,
        CancellationToken cancellationToken)
    {
        // 0. Trích xuất userId an toàn từ JWT Token (Fix IDOR: Không nhận userId từ form-data)
        Guid? authenticatedUserId = null;
        if (User.Identity?.IsAuthenticated == true)
        {
            var subClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;
            if (Guid.TryParse(subClaim, out var parsedGuid))
            {
                authenticatedUserId = parsedGuid;
            }
        }

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

        // 2.1. Kiểm tra độ dài ghi chú (tối đa 1000 ký tự - BUG-22)
        if (!string.IsNullOrEmpty(notes) && notes.Length > 1000)
        {
            return BadRequest(new { detail = "Ghi chú không được vượt quá 1000 ký tự." });
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
        bool isGuest = authenticatedUserId == null;
        Guid? diagnosisId = null;
        string originalImageUrl = "";
        string? gradCamImageUrl = null;

        if (!isGuest)
        {
            diagnosisId = Guid.NewGuid();

            // 4.1. Tải ảnh gốc lên MinIO (Sử dụng Safe Content-Type suy luận từ file extension)
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
        }
        else
        {
            // Guest Policy (SSOT: docs/spec/screens.md:98):
            // "Guest: kết quả chỉ lưu trong phiên trình duyệt; dưới kết quả hiện gợi ý 'Đăng nhập để lưu lịch sử'."
            // Không lưu ảnh vào MinIO và không lưu lịch sử vào CSDL để bảo vệ quyền riêng tư người dùng.
            // Cung cấp data URL Grad-CAM để giao diện trình duyệt hiển thị thanh so sánh tức thì.
            _logger.LogInformation("Khách vãng lai (Guest) thực hiện chẩn đoán: Không lưu ảnh lên MinIO và không ghi CSDL.");
            if (!string.IsNullOrWhiteSpace(aiResult.GradcamBase64))
            {
                gradCamImageUrl = aiResult.GradcamBase64.StartsWith("data:", StringComparison.OrdinalIgnoreCase)
                    ? aiResult.GradcamBase64
                    : $"data:image/jpeg;base64,{aiResult.GradcamBase64}";
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

        // Trích xuất danh mục thuốc BVTV đặc trị (BUG-02: Bắt buộc lọc IsAllowed và !IsDeleted)
        var recommendedProducts = disease?.DiseaseProducts
            .Where(dp => dp.Product != null && dp.Product.IsAllowed && !dp.Product.IsDeleted)
            .Select(dp => new ProductDto
        {
            Id = dp.Product.Id,
            Name = dp.Product.Name,
            ActiveIngredient = dp.Product.ActiveIngredient,
            Price = dp.Product.Price,
            Unit = "Gói / Chai chuẩn",
            ImageUrl = dp.Product.ImageUrl,
            DosageInstruction = dp.Product.DosageInstruction
        }).ToList() ?? new List<ProductDto>();

        // Trích xuất 1-3 tài liệu khuyến nông đối chứng từ KnowledgeSources (BUG-25)
        var verifiedSources = await _dbContext.KnowledgeSources
            .Where(s => !s.IsDeleted && s.ModelClass == predictedClass && (s.SourceQuality.StartsWith("Cao") || s.IsManualApproved))
            .OrderByDescending(s => s.CreatedAt)
            .Take(3)
            .Select(s => new VerifiedSourceDto
            {
                Organization = s.Organization,
                Title = s.SourceTitle,
                Url = s.SourceUrl
            })
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        // 4.4. Lưu vết ca chẩn đoán vào DiagnosisRecords trong PostgreSQL (Chỉ lưu khi đã đăng nhập)
        if (!isGuest && disease != null && diagnosisId.HasValue)
        {
            var diagnosisRecord = new DiagnosisRecord
            {
                Id = diagnosisId.Value,
                UserId = authenticatedUserId,
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
            _logger.LogInformation("Saved DiagnosisRecord {DiagnosisId} for user {UserId}, disease {ClassCode}.", diagnosisId, authenticatedUserId, predictedClass);
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

    /// <summary>
    /// GET /api/v1/diagnose/history - Lịch sử khám bệnh cá nhân (SSOT: api-contracts.md Mục 3.2)
    /// </summary>
    [HttpGet("history")]
    [Authorize]
    [ProducesResponseType(typeof(DiagnosisHistoryResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetHistory(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;

        if (string.IsNullOrEmpty(subClaim) || !Guid.TryParse(subClaim, out var userId))
        {
            return Unauthorized(new { detail = "Định danh người dùng trong token không hợp lệ." });
        }

        page = Math.Clamp(page, 1, 10000);
        pageSize = Math.Clamp(pageSize, 1, 50);

        var query = _dbContext.DiagnosisRecords
            .Where(r => r.UserId == userId && !r.IsDeleted)
            .Include(r => r.Disease)
                .ThenInclude(d => d.Plant)
            .AsNoTracking();

        var totalRecords = await query.CountAsync(cancellationToken);

        var records = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = records.Select(r => new DiagnosisHistoryItemDto
        {
            Id = r.Id,
            CreatedAt = r.CreatedAt,
            PlantName = r.Disease?.Plant?.Name ?? "Cây trồng",
            DiseaseName = r.Disease?.CommonNameVi ?? r.Disease?.ClassCode ?? "Bệnh chưa phân loại",
            ClassCode = r.Disease?.ClassCode ?? string.Empty,
            Confidence = r.Confidence,
            IsUncertain = r.IsUncertain,
            RecoveryStatus = r.RecoveryStatus ?? "Đang theo dõi",
            Notes = r.Notes,
            OriginalImageUrl = r.OriginalImageUrl,
            GradcamImageUrl = r.GradCamImageUrl
        }).ToList();

        var response = new DiagnosisHistoryResponseDto
        {
            TotalRecords = totalRecords,
            Page = page,
            PageSize = pageSize,
            Items = items
        };

        return Ok(response);
    }

    /// <summary>
    /// GET /api/v1/diagnose/history/{id} - Chi tiết hồ sơ khám bệnh cá nhân (SSOT: screens.md W-08 & BUG-17)
    /// </summary>
    [HttpGet("history/{id:guid}")]
    [Authorize]
    [ProducesResponseType(typeof(DiagnoseResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetHistoryDetail(Guid id, CancellationToken cancellationToken)
    {
        var subClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;
        var roleClaim = User.FindFirst(ClaimTypes.Role)?.Value ?? "FARMER";

        if (string.IsNullOrEmpty(subClaim) || !Guid.TryParse(subClaim, out var userId))
        {
            return Unauthorized(new { detail = "Định danh người dùng trong token không hợp lệ." });
        }

        var record = await _dbContext.DiagnosisRecords
            .Include(r => r.Disease)
                .ThenInclude(d => d.Plant)
            .Include(r => r.Disease)
                .ThenInclude(d => d.TreatmentPlans.OrderBy(tp => tp.StepOrder))
            .Include(r => r.Disease)
                .ThenInclude(d => d.DiseaseProducts.Where(dp => dp.Product != null && dp.Product.IsAllowed && !dp.Product.IsDeleted))
                    .ThenInclude(dp => dp.Product)
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted, cancellationToken);

        if (record == null)
        {
            return NotFound(new { detail = "Không tìm thấy hồ sơ chẩn đoán yêu cầu." });
        }

        // Quyền truy cập: Chỉ chủ sở hữu ca khám hoặc ADMIN mới được xem (BUG-17)
        if (record.UserId != userId && !string.Equals(roleClaim, "ADMIN", StringComparison.OrdinalIgnoreCase))
        {
            return NotFound(new { detail = "Không tìm thấy hồ sơ chẩn đoán yêu cầu." });
        }

        var disease = record.Disease;
        var predictedClass = disease?.ClassCode ?? string.Empty;

        // Trích xuất phác đồ xử lý IPM
        var treatmentGuidelines = disease?.TreatmentPlans.Select(tp => new TreatmentStepDto
        {
            StepOrder = tp.StepOrder,
            ActionTitle = tp.ActionTitle,
            Instructions = tp.Instructions,
            IsolationDays = tp.IsolationDays
        }).ToList() ?? new List<TreatmentStepDto>();

        // Trích xuất danh mục thuốc gợi ý
        var recommendedProducts = disease?.DiseaseProducts
            .Where(dp => dp.Product != null && dp.Product.IsAllowed && !dp.Product.IsDeleted)
            .Select(dp => new ProductDto
            {
                Id = dp.Product.Id,
                Name = dp.Product.Name,
                ActiveIngredient = dp.Product.ActiveIngredient,
                Price = dp.Product.Price,
                Unit = "Gói / Chai chuẩn",
                ImageUrl = dp.Product.ImageUrl,
                DosageInstruction = dp.Product.DosageInstruction
            }).ToList() ?? new List<ProductDto>();

        // Trích xuất tài liệu khuyến nông đối chứng
        var verifiedSources = await _dbContext.KnowledgeSources
            .Where(s => !s.IsDeleted && s.ModelClass == predictedClass && (s.SourceQuality.StartsWith("Cao") || s.IsManualApproved))
            .OrderByDescending(s => s.CreatedAt)
            .Take(3)
            .Select(s => new VerifiedSourceDto
            {
                Organization = s.Organization,
                Title = s.SourceTitle,
                Url = s.SourceUrl
            })
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        string severityLevel;
        if (predictedClass.EndsWith("___healthy", StringComparison.OrdinalIgnoreCase))
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

        var response = new DiagnoseResponseDto
        {
            Success = true,
            DiagnosisId = record.Id,
            IsOod = false,
            IsUncertain = record.IsUncertain,
            Warning = record.IsUncertain ? "Độ tin cậy chưa đạt ngưỡng tối ưu, nên chụp lại trong điều kiện ánh sáng tốt hơn." : null,
            Result = new DiagnoseResultDataDto
            {
                PlantName = disease?.Plant?.Name ?? "Cây trồng",
                DiseaseName = disease?.CommonNameVi ?? predictedClass,
                ClassCode = predictedClass,
                Confidence = record.Confidence,
                SeverityLevel = severityLevel,
                IsUncertain = record.IsUncertain,
                ConfusionGroup = null,
                Warning = record.Notes,
                Top3 = new List<Top3ItemDto>
                {
                    new()
                    {
                        ClassCode = predictedClass,
                        DiseaseName = disease?.CommonNameVi ?? predictedClass,
                        Confidence = record.Confidence
                    }
                }
            },
            VisualEvidence = new VisualEvidenceDto
            {
                OriginalImageUrl = record.OriginalImageUrl,
                GradcamImageUrl = record.GradCamImageUrl
            },
            TreatmentGuidelines = treatmentGuidelines,
            RecommendedProducts = recommendedProducts,
            VerifiedSources = verifiedSources
        };

        return Ok(response);
    }
}
