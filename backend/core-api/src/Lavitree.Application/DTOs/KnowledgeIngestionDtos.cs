using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Lavitree.Application.DTOs;

public class IngestArticleRequestDto
{
    [Required(ErrorMessage = "Lớp bệnh (model_class) không được để trống.")]
    [JsonPropertyName("model_class")]
    public string ModelClass { get; set; } = string.Empty;

    [Required(ErrorMessage = "Đường dẫn bài viết (source_url) không được để trống.")]
    [Url(ErrorMessage = "Đường dẫn bài viết phải là URL hợp lệ (http:// hoặc https://).")]
    [JsonPropertyName("source_url")]
    public string SourceUrl { get; set; } = string.Empty;

    [Required(ErrorMessage = "Tiêu đề bài viết (source_title) không được để trống.")]
    [MaxLength(500, ErrorMessage = "Tiêu đề không được vượt quá 500 ký tự.")]
    [JsonPropertyName("source_title")]
    public string SourceTitle { get; set; } = string.Empty;

    [Required(ErrorMessage = "Cơ quan / Tác giả (organization) không được để trống.")]
    [MaxLength(255, ErrorMessage = "Tên cơ quan không được vượt quá 255 ký tự.")]
    [JsonPropertyName("organization")]
    public string Organization { get; set; } = string.Empty;

    [JsonPropertyName("published_date")]
    public string? PublishedDate { get; set; }

    [Required(ErrorMessage = "Nội dung bài báo (article_text) không được để trống.")]
    [MaxLength(50000, ErrorMessage = "Văn bản bài báo không được vượt quá 50.000 ký tự.")]
    [JsonPropertyName("article_text")]
    public string ArticleText { get; set; } = string.Empty;
}

public class ParagraphDto
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("text")]
    public string Text { get; set; } = string.Empty;

    [JsonPropertyName("suggested_unit_type")]
    public string? SuggestedUnitType { get; set; }
}

public class IngestArticleResponseDto
{
    [JsonPropertyName("ingestion_id")]
    public string IngestionId { get; set; } = string.Empty;

    [JsonPropertyName("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [JsonPropertyName("paragraphs")]
    public List<ParagraphDto> Paragraphs { get; set; } = new();

    [JsonPropertyName("ai_suggestion_available")]
    public bool AiSuggestionAvailable { get; set; } = true;
}

public class CommitSelectionDto
{
    [Required(ErrorMessage = "Mã đoạn (paragraph_id) không được để trống.")]
    [JsonPropertyName("paragraph_id")]
    public string ParagraphId { get; set; } = string.Empty;

    [Required(ErrorMessage = "Loại nội dung (unit_type) không được để trống.")]
    [RegularExpression(@"^(SYMPTOMS|CAUSE_CONDITIONS|PREVENTION|TREATMENT)$", ErrorMessage = "unit_type phải thuộc: SYMPTOMS, CAUSE_CONDITIONS, PREVENTION, TREATMENT.")]
    [JsonPropertyName("unit_type")]
    public string UnitType { get; set; } = string.Empty;
}

public class CommitIngestionRequestDto
{
    [Required(ErrorMessage = "Danh sách đoạn trích không được để trống.")]
    [MinLength(1, ErrorMessage = "Cần chọn ít nhất 1 đoạn trích dẫn.")]
    [MaxLength(4, ErrorMessage = "Mỗi bài chỉ được trích dẫn tối đa 4 đoạn nguyên văn.")]
    [JsonPropertyName("selections")]
    public List<CommitSelectionDto> Selections { get; set; } = new();

    [MaxLength(1000, ErrorMessage = "Ghi chú duyệt không được vượt quá 1000 ký tự.")]
    [JsonPropertyName("reviewer_notes")]
    public string? ReviewerNotes { get; set; }
}

public class CommitIngestionResponseDto
{
    [JsonPropertyName("created_source_ids")]
    public List<string> CreatedSourceIds { get; set; } = new();

    [JsonPropertyName("verbatim_count_for_url")]
    public int VerbatimCountForUrl { get; set; }

    [JsonPropertyName("reindex_status")]
    public string ReindexStatus { get; set; } = "accepted"; // accepted | failed
}

public class ApproveSourceRequestDto
{
    [JsonPropertyName("is_approved")]
    public bool IsApproved { get; set; } = true;

    [MaxLength(1000, ErrorMessage = "Ghi chú không được vượt quá 1000 ký tự.")]
    [JsonPropertyName("reviewer_notes")]
    public string? ReviewerNotes { get; set; }
}

public class ApproveBatchRequestDto
{
    [Required(ErrorMessage = "Danh sách source_ids không được để trống.")]
    [MinLength(1, ErrorMessage = "Cần ít nhất 1 mã bài viết để duyệt.")]
    [JsonPropertyName("source_ids")]
    public List<Guid> SourceIds { get; set; } = new();

    [JsonPropertyName("is_approved")]
    public bool IsApproved { get; set; } = true;

    [MaxLength(1000, ErrorMessage = "Ghi chú không được vượt quá 1000 ký tự.")]
    [JsonPropertyName("reviewer_notes")]
    public string? ReviewerNotes { get; set; }
}

public class ApproveBatchResponseDto
{
    [JsonPropertyName("approved_count")]
    public int ApprovedCount { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = "success";

    [JsonPropertyName("reindex_status")]
    public string ReindexStatus { get; set; } = "accepted";

    [JsonPropertyName("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

// DTO giao tiếp nội bộ với agent-service
public class AgentLabelParagraphsRequest
{
    [JsonPropertyName("model_class")]
    public string ModelClass { get; set; } = string.Empty;

    [JsonPropertyName("paragraphs")]
    public List<AgentParagraphItem> Paragraphs { get; set; } = new();
}

public class AgentParagraphItem
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("text")]
    public string Text { get; set; } = string.Empty;
}

public class AgentLabelParagraphsResponse
{
    [JsonPropertyName("labels")]
    public List<AgentParagraphLabel> Labels { get; set; } = new();
}

public class AgentParagraphLabel
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("unit_type")]
    public string UnitType { get; set; } = string.Empty;
}

public class AgentReindexRequest
{
    [JsonPropertyName("source_id")]
    public string? SourceId { get; set; }

    [JsonPropertyName("action")]
    public string Action { get; set; } = "approve"; // approve | unapprove | delete | manual
}
