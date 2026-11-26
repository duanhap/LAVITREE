using System;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Lavitree.Api.Security;
using Lavitree.Domain.Entities;
using Lavitree.Infrastructure.Persistence;

namespace Lavitree.Api.Controllers;

[ApiController]
[Route("api/v1/handbook")]
public class HandbookController : ControllerBase
{
    private readonly LavitreeDbContext _dbContext;
    private readonly ILogger<HandbookController> _logger;

    public HandbookController(LavitreeDbContext dbContext, ILogger<HandbookController> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <summary>
    /// API công khai lấy bài cẩm nang chuẩn biên tập theo mã bệnh AI.
    /// Nếu bài chưa có hoặc đang là bản nháp (DRAFT), trả về is_fallback = true để giao diện ghép tự động.
    /// </summary>
    [HttpGet("articles/{classCode}")]
    public async Task<IActionResult> GetPublicArticle(string classCode)
    {
        if (string.IsNullOrWhiteSpace(classCode))
        {
            return BadRequest(new { detail = "Mã lớp bệnh (classCode) không được để trống." });
        }

        var decoded = Uri.UnescapeDataString(classCode.Trim());
        var article = await _dbContext.HandbookDiseases
            .AsNoTracking()
            .FirstOrDefaultAsync(h => h.ClassCode == decoded);

        if (article == null || article.Status == "DRAFT")
        {
            return Ok(new
            {
                is_fallback = true,
                class_code = decoded,
                message = "Chưa có bài cẩm nang được xuất bản, hiển thị nội dung ghép tự động."
            });
        }

        return Ok(new
        {
            is_fallback = false,
            id = article.Id,
            disease_id = article.DiseaseId,
            class_code = article.ClassCode,
            title = article.Title,
            summary = article.Summary,
            content_markdown = article.ContentMarkdown,
            author_name = article.AuthorName,
            faq_json = article.FaqJson,
            status = article.Status,
            review_reason = article.ReviewReason,
            published_at = article.PublishedAt,
            last_reviewed_at = article.LastReviewedAt,
            updated_at = article.UpdatedAt
        });
    }

    /// <summary>
    /// API Admin: Lấy chi tiết bài cẩm nang để biên tập (kể cả DRAFT), kèm danh sách đoạn trích nguồn đã duyệt.
    /// </summary>
    [HttpGet("admin/articles/{classCode}")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> GetAdminArticle(string classCode)
    {
        if (string.IsNullOrWhiteSpace(classCode))
        {
            return BadRequest(new { detail = "Mã lớp bệnh không được để trống." });
        }

        var decoded = Uri.UnescapeDataString(classCode.Trim());
        var disease = await _dbContext.Diseases
            .Include(d => d.Plant)
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.ClassCode == decoded);

        if (disease == null)
        {
            return NotFound(new { detail = $"Không tìm thấy bệnh có mã '{decoded}'." });
        }

        var article = await _dbContext.HandbookDiseases
            .AsNoTracking()
            .FirstOrDefaultAsync(h => h.ClassCode == decoded);

        var approvedSources = await _dbContext.KnowledgeSources
            .Where(k => k.ModelClass == decoded && k.IsManualApproved && !k.IsDeleted)
            .OrderByDescending(k => k.CreatedAt)
            .Select(k => new
            {
                k.Id,
                k.SourceTitle,
                k.SourceUrl,
                k.UnitType,
                k.ContentType,
                k.EvidenceText,
                k.Organization,
                k.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            disease_info = new
            {
                id = disease.Id,
                class_code = disease.ClassCode,
                common_name_vi = disease.CommonNameVi,
                plant_name = disease.Plant?.Name ?? string.Empty,
                pathogen_type = disease.PathogenType,
                pathogen_name = disease.PathogenName
            },
            article = article == null ? null : new
            {
                id = article.Id,
                disease_id = article.DiseaseId,
                class_code = article.ClassCode,
                title = article.Title,
                summary = article.Summary,
                content_markdown = article.ContentMarkdown,
                author_name = article.AuthorName,
                faq_json = article.FaqJson,
                status = article.Status,
                review_reason = article.ReviewReason,
                published_at = article.PublishedAt,
                last_reviewed_at = article.LastReviewedAt,
                updated_at = article.UpdatedAt
            },
            approved_knowledge_sources = approvedSources
        });
    }

    public class SaveHandbookArticleDto
    {
        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("summary")]
        public string? Summary { get; set; }

        [JsonPropertyName("content_markdown")]
        public string ContentMarkdown { get; set; } = string.Empty;

        [JsonPropertyName("contentMarkdown")]
        public string? ContentMarkdownCamel
        {
            get => ContentMarkdown;
            set { if (!string.IsNullOrWhiteSpace(value)) ContentMarkdown = value; }
        }

        [JsonPropertyName("author_name")]
        public string AuthorName { get; set; } = "Ban Chuyên môn BVTV Lavitree";

        [JsonPropertyName("authorName")]
        public string? AuthorNameCamel
        {
            get => AuthorName;
            set { if (!string.IsNullOrWhiteSpace(value)) AuthorName = value; }
        }

        [JsonPropertyName("faq_json")]
        public string? FaqJson { get; set; }

        [JsonPropertyName("faqJson")]
        public string? FaqJsonCamel
        {
            get => FaqJson;
            set { if (!string.IsNullOrWhiteSpace(value)) FaqJson = value; }
        }

        [JsonPropertyName("status")]
        public string Status { get; set; } = "DRAFT"; // DRAFT hoặc PUBLISHED
    }

    /// <summary>
    /// API Admin: Tạo mới hoặc cập nhật bài cẩm nang (Lưu nháp hoặc Xuất bản).
    /// </summary>
    [HttpPut("admin/articles/{classCode}")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> SaveAdminArticle(string classCode, [FromBody] SaveHandbookArticleDto dto)
    {
        if (string.IsNullOrWhiteSpace(classCode))
        {
            return BadRequest(new { detail = "Mã lớp bệnh không được để trống." });
        }

        var decoded = Uri.UnescapeDataString(classCode.Trim());
        var disease = await _dbContext.Diseases
            .FirstOrDefaultAsync(d => d.ClassCode == decoded);

        if (disease == null)
        {
            return NotFound(new { detail = $"Không tìm thấy bệnh có mã '{decoded}'." });
        }

        if (string.IsNullOrWhiteSpace(dto.Title))
        {
            return BadRequest(new { detail = "Tiêu đề bài viết cẩm nang không được để trống." });
        }

        var status = (dto.Status ?? "DRAFT").Trim().ToUpperInvariant();
        if (status != "DRAFT" && status != "PUBLISHED")
        {
            status = "DRAFT";
        }

        if (status == "PUBLISHED" && string.IsNullOrWhiteSpace(dto.ContentMarkdown))
        {
            return BadRequest(new { detail = "Không thể xuất bản bài cẩm nang khi nội dung đang để trống." });
        }

        var article = await _dbContext.HandbookDiseases
            .FirstOrDefaultAsync(h => h.ClassCode == decoded);

        var now = DateTime.UtcNow;

        if (article == null)
        {
            article = new HandbookDisease
            {
                DiseaseId = disease.Id,
                ClassCode = disease.ClassCode,
                Title = dto.Title.Trim(),
                Summary = dto.Summary?.Trim(),
                ContentMarkdown = dto.ContentMarkdown ?? string.Empty,
                AuthorName = string.IsNullOrWhiteSpace(dto.AuthorName) ? "Ban Chuyên môn BVTV Lavitree" : dto.AuthorName.Trim(),
                FaqJson = string.IsNullOrWhiteSpace(dto.FaqJson) ? "[]" : dto.FaqJson.Trim(),
                Status = status,
                ReviewReason = null,
                PublishedAt = status == "PUBLISHED" ? now : null,
                LastReviewedAt = status == "PUBLISHED" ? now : null,
                CreatedAt = now,
                UpdatedAt = now
            };
            _dbContext.HandbookDiseases.Add(article);
        }
        else
        {
            article.Title = dto.Title.Trim();
            article.Summary = dto.Summary?.Trim();
            article.ContentMarkdown = dto.ContentMarkdown ?? string.Empty;
            article.AuthorName = string.IsNullOrWhiteSpace(dto.AuthorName) ? "Ban Chuyên môn BVTV Lavitree" : dto.AuthorName.Trim();
            article.FaqJson = string.IsNullOrWhiteSpace(dto.FaqJson) ? "[]" : dto.FaqJson.Trim();
            article.Status = status;
            article.UpdatedAt = now;

            if (status == "PUBLISHED")
            {
                article.PublishedAt ??= now;
                article.LastReviewedAt = now;
                article.ReviewReason = null; // Admin đã chủ động rà soát và lưu bài
            }
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = status == "PUBLISHED" ? "Đã xuất bản bài cẩm nang thành công." : "Đã lưu bản nháp bài cẩm nang.",
            article = new
            {
                id = article.Id,
                disease_id = article.DiseaseId,
                class_code = article.ClassCode,
                title = article.Title,
                summary = article.Summary,
                content_markdown = article.ContentMarkdown,
                author_name = article.AuthorName,
                faq_json = article.FaqJson,
                status = article.Status,
                review_reason = article.ReviewReason,
                published_at = article.PublishedAt,
                last_reviewed_at = article.LastReviewedAt,
                updated_at = article.UpdatedAt
            }
        });
    }

    /// <summary>
    /// API Admin: Xác nhận đã rà soát bài cẩm nang (Review Ack), chuyển từ NEEDS_REVIEW về PUBLISHED.
    /// </summary>
    [HttpPost("admin/articles/{classCode}/review-ack")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> AcknowledgeReview(string classCode)
    {
        if (string.IsNullOrWhiteSpace(classCode))
        {
            return BadRequest(new { detail = "Mã lớp bệnh không được để trống." });
        }

        var decoded = Uri.UnescapeDataString(classCode.Trim());
        var article = await _dbContext.HandbookDiseases
            .FirstOrDefaultAsync(h => h.ClassCode == decoded);

        if (article == null)
        {
            return NotFound(new { detail = $"Chưa có bài cẩm nang cho bệnh '{decoded}'." });
        }

        var now = DateTime.UtcNow;
        article.Status = "PUBLISHED";
        article.ReviewReason = null;
        article.LastReviewedAt = now;
        article.UpdatedAt = now;

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message = "Đã xác nhận rà soát thành công, bài cẩm nang đã trở lại trạng thái Đã xuất bản.",
            status = article.Status,
            last_reviewed_at = article.LastReviewedAt
        });
    }
}
