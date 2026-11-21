using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Security.Claims;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Lavitree.Api.Filters;
using Lavitree.Domain.Entities;
using Lavitree.Infrastructure.Persistence;
using Lavitree.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Lavitree.Api.Controllers;

/// <summary>
/// Danh mục chất cấm (TASK-19). Đọc công khai (Lavi + web dùng để chặn / nhắc), sửa chỉ Admin.
/// Trạng thái cấm tính từ lịch sử quyết định theo văn bản; thêm quyết định UNBAN khi thông tư mới bỏ cấm.
/// </summary>
[ApiController]
[Route("api/v1/banned-substances")]
[EnableRateLimiting("public_api_policy")]
public class BannedSubstancesController : ControllerBase
{
    private static readonly HashSet<string> Categories = new(StringComparer.Ordinal) { "INSECTICIDE", "FUNGICIDE", "HERBICIDE", "RODENTICIDE", "OTHER" };
    private static readonly HashSet<string> Actions = new(StringComparer.Ordinal) { BannedSubstanceDecision.Ban, BannedSubstanceDecision.Unban };
    private const int MaxImportItems = 300;
    private const int MaxAliases = 30;

    private readonly LavitreeDbContext _db;

    public BannedSubstancesController(LavitreeDbContext db)
    {
        _db = db;
    }

    // GET /api/v1/banned-substances
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var isAdmin = IsAdmin();
        var today = BannedSubstanceRegistry.TodayVn();
        var substances = await _db.BannedSubstances.AsNoTracking()
            .Where(s => !s.IsDeleted)
            .Include(s => s.Decisions)
            .OrderBy(s => s.CommonName)
            .ToListAsync(ct);
        return Ok(new BannedListDto
        {
            Today = today,
            Items = substances.Select(s => ToDto(s, today, isAdmin)).ToList(),
            Terms = BannedSubstanceRegistry.Terms.Select(t => new BannedTermDto { Text = t.Text, Substance = t.SubstanceName }).ToList(),
            LoadedFromDatabase = BannedSubstanceRegistry.LoadedFromDatabase,
        });
    }

    // POST /api/v1/banned-substances
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateBannedSubstanceDto dto, CancellationToken ct)
    {
        if (!CheckAdmin(out var authError)) return authError!;
        var fields = CleanFields(dto.CommonName, dto.Aliases, dto.Category, dto.Note, out var error);
        if (error != null) return BadRequest(new { detail = error });
        var decision = CleanDecision(dto.Decision, out error);
        if (error != null) return BadRequest(new { detail = error });

        if (await FindByNameAsync(fields.CommonName, null, ct) != null)
        {
            return Conflict(new { detail = $"Đã có chất '{fields.CommonName}'. Thêm quyết định mới cho chất đó thay vì tạo trùng." });
        }
        var entity = new BannedSubstance { CommonName = fields.CommonName, Aliases = fields.Aliases, Category = fields.Category, Note = fields.Note };
        decision!.CreatedBy = CurrentActor();
        entity.Decisions.Add(decision);
        _db.BannedSubstances.Add(entity);
        await _db.SaveChangesAsync(ct);
        await BannedSubstanceRegistry.ReloadAsync(_db, ct);
        return Ok(ToDto(entity, BannedSubstanceRegistry.TodayVn(), true));
    }

    // PATCH /api/v1/banned-substances/{id}: sửa tên, tên khác, nhóm, ghi chú (không đổi trạng thái cấm)
    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateBannedSubstanceDto dto, CancellationToken ct)
    {
        if (!CheckAdmin(out var authError)) return authError!;
        var entity = await _db.BannedSubstances.Include(s => s.Decisions).FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted, ct);
        if (entity == null) return NotFound(new { detail = "Không tìm thấy chất này." });

        var fields = CleanFields(dto.CommonName ?? entity.CommonName, dto.Aliases ?? entity.Aliases, dto.Category ?? entity.Category,
            dto.Note ?? entity.Note, out var error);
        if (error != null) return BadRequest(new { detail = error });
        if (await FindByNameAsync(fields.CommonName, id, ct) != null)
        {
            return Conflict(new { detail = $"Đã có chất khác tên '{fields.CommonName}'." });
        }
        entity.CommonName = fields.CommonName;
        entity.Aliases = fields.Aliases;
        entity.Category = fields.Category;
        entity.Note = fields.Note;
        await _db.SaveChangesAsync(ct);
        await BannedSubstanceRegistry.ReloadAsync(_db, ct);
        return Ok(ToDto(entity, BannedSubstanceRegistry.TodayVn(), true));
    }

    // POST /api/v1/banned-substances/{id}/decisions: thêm quyết định cấm / bỏ cấm theo văn bản mới
    [HttpPost("{id:int}/decisions")]
    public async Task<IActionResult> AddDecision(int id, [FromBody] DecisionInputDto dto, CancellationToken ct)
    {
        if (!CheckAdmin(out var authError)) return authError!;
        var entity = await _db.BannedSubstances.Include(s => s.Decisions).FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted, ct);
        if (entity == null) return NotFound(new { detail = "Không tìm thấy chất này." });
        var decision = CleanDecision(dto, out var error);
        if (error != null) return BadRequest(new { detail = error });
        decision!.CreatedBy = CurrentActor();
        entity.Decisions.Add(decision);
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        await BannedSubstanceRegistry.ReloadAsync(_db, ct);
        return Ok(ToDto(entity, BannedSubstanceRegistry.TodayVn(), true));
    }

    // DELETE /api/v1/banned-substances/{id}/decisions/{decisionId}: gỡ quyết định nhập nhầm (giữ dấu vết)
    [HttpDelete("{id:int}/decisions/{decisionId:int}")]
    public async Task<IActionResult> RemoveDecision(int id, int decisionId, CancellationToken ct)
    {
        if (!CheckAdmin(out var authError)) return authError!;
        var entity = await _db.BannedSubstances.Include(s => s.Decisions).FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted, ct);
        var decision = entity?.Decisions.FirstOrDefault(d => d.Id == decisionId && !d.IsDeleted);
        if (entity == null || decision == null) return NotFound(new { detail = "Không tìm thấy quyết định này." });
        if (entity.Decisions.Count(d => !d.IsDeleted) <= 1)
        {
            return BadRequest(new { detail = "Mỗi chất phải còn ít nhất một quyết định. Muốn bỏ cấm thì thêm quyết định 'Bỏ cấm' theo văn bản mới." });
        }
        decision.IsDeleted = true;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        await BannedSubstanceRegistry.ReloadAsync(_db, ct);
        return Ok(ToDto(entity, BannedSubstanceRegistry.TodayVn(), true));
    }

    // DELETE /api/v1/banned-substances/{id}: xóa chất nhập nhầm (xóa mềm). Chất hết bị cấm thì dùng quyết định UNBAN.
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!CheckAdmin(out var authError)) return authError!;
        var entity = await _db.BannedSubstances.FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted, ct);
        if (entity == null) return NotFound(new { detail = "Không tìm thấy chất này." });
        entity.IsDeleted = true;
        await _db.SaveChangesAsync(ct);
        await BannedSubstanceRegistry.ReloadAsync(_db, ct);
        return NoContent();
    }

    // POST /api/v1/banned-substances/import: nhập nhiều chất theo MỘT văn bản. dry_run = true chỉ xem trước, không lưu.
    [HttpPost("import")]
    public async Task<IActionResult> Import([FromBody] ImportBannedDto dto, CancellationToken ct)
    {
        if (!CheckAdmin(out var authError)) return authError!;
        var template = CleanDecision(new DecisionInputDto
        {
            Action = dto.Action, LegalDocument = dto.LegalDocument, EffectiveDate = dto.EffectiveDate, SourceUrl = dto.SourceUrl, Note = dto.Note,
        }, out var error);
        if (error != null) return BadRequest(new { detail = error });
        var rows = dto.Items ?? new List<ImportItemDto>();
        if (rows.Count == 0) return BadRequest(new { detail = "Danh sách nhập đang trống." });
        if (rows.Count > MaxImportItems) return BadRequest(new { detail = $"Mỗi lần nhập tối đa {MaxImportItems} chất." });

        var existing = await _db.BannedSubstances.Include(s => s.Decisions).Where(s => !s.IsDeleted).ToListAsync(ct);
        var today = BannedSubstanceRegistry.TodayVn();
        var results = new List<ImportResultDto>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var actor = CurrentActor();

        foreach (var row in rows)
        {
            var fields = CleanFields(row.CommonName, row.Aliases, row.Category, row.Note, out var rowError);
            var result = new ImportResultDto { CommonName = fields.CommonName, Aliases = fields.Aliases, Category = fields.Category };
            results.Add(result);
            if (rowError != null)
            {
                result.Status = "INVALID";
                result.Message = rowError;
                continue;
            }
            if (!seen.Add(fields.CommonName))
            {
                result.Status = "DUPLICATE";
                result.Message = "Trùng với một dòng phía trên.";
                continue;
            }
            var rowTerms = new[] { fields.CommonName }.Concat(fields.Aliases).Select(x => x.ToLowerInvariant()).ToHashSet();
            var match = existing.FirstOrDefault(s => string.Equals(s.CommonName, fields.CommonName, StringComparison.OrdinalIgnoreCase))
                ?? existing.FirstOrDefault(s => BannedSubstanceRegistry.TermsOf(s).Any(rowTerms.Contains))
                // "Cadmium compound (Cd)" trong PDF = "Cadmium compound" đã có: so sau khi bỏ phần trong ngoặc
                ?? existing.FirstOrDefault(s => BannedSubstanceRegistry.TermsOf(s).Select(MatchKey).Intersect(rowTerms.Select(MatchKey)).Any());
            if (match == null)
            {
                result.Status = "NEW";
                result.Message = template!.Action == BannedSubstanceDecision.Ban ? "Thêm mới vào danh mục cấm." : "Chưa có trong danh mục, sẽ lưu kèm quyết định bỏ cấm.";
                if (!dto.DryRun)
                {
                    var entity = new BannedSubstance { CommonName = fields.CommonName, Aliases = fields.Aliases, Category = fields.Category, Note = fields.Note };
                    entity.Decisions.Add(CloneDecision(template, actor));
                    _db.BannedSubstances.Add(entity);
                    existing.Add(entity);
                }
                continue;
            }

            result.ExistingId = match.Id;
            result.ExistingName = match.CommonName;
            var already = match.Decisions.Any(d => !d.IsDeleted && d.Action == template!.Action
                && string.Equals(d.LegalDocument, template.LegalDocument, StringComparison.OrdinalIgnoreCase));
            if (already)
            {
                result.Status = "NO_CHANGE";
                result.Message = "Đã có quyết định này theo cùng văn bản.";
                continue;
            }
            var newAliases = rowTerms.Except(BannedSubstanceRegistry.TermsOf(match)).ToList();
            result.Status = "ADD_DECISION";
            var wasBanned = match.IsBannedOn(today);
            result.Message = template!.Action == BannedSubstanceDecision.Ban
                ? (wasBanned ? "Đã đang cấm, ghi thêm căn cứ văn bản mới." : "Đang không cấm, sẽ cấm lại.")
                : (wasBanned ? "Đang cấm, sẽ BỎ CẤM." : "Đang không cấm, ghi thêm văn bản.");
            if (newAliases.Count > 0) result.Message += $" Thêm tên khác: {string.Join(", ", newAliases)}.";
            if (!dto.DryRun)
            {
                match.Decisions.Add(CloneDecision(template, actor));
                if (newAliases.Count > 0) match.Aliases = match.Aliases.Concat(newAliases).Distinct().Take(MaxAliases).ToList();
                match.UpdatedAt = DateTime.UtcNow;
            }
        }

        if (!dto.DryRun)
        {
            await _db.SaveChangesAsync(ct);
            await BannedSubstanceRegistry.ReloadAsync(_db, ct);
        }
        return Ok(new ImportResponseDto { DryRun = dto.DryRun, Results = results });
    }

    // POST /api/v1/banned-substances/parse-pdf: đọc PDF danh mục cấm thành bảng nháp (không lưu gì)
    private const long MaxPdfBytes = 10 * 1024 * 1024;

    [HttpPost("parse-pdf")]
    [RequestSizeLimit(MaxPdfBytes + 64 * 1024)]
    public async Task<IActionResult> ParsePdf(IFormFile? file, CancellationToken ct)
    {
        if (!CheckAdmin(out var authError)) return authError!;
        if (file == null || file.Length == 0) return BadRequest(new { detail = "Chưa chọn file PDF." });
        if (file.Length > MaxPdfBytes) return BadRequest(new { detail = "File PDF tối đa 10 MB." });

        byte[] bytes;
        using (var ms = new System.IO.MemoryStream())
        {
            await file.CopyToAsync(ms, ct);
            bytes = ms.ToArray();
        }
        // Kiểm tra chữ ký file, không tin phần mở rộng / Content-Type
        if (bytes.Length < 5 || bytes[0] != '%' || bytes[1] != 'P' || bytes[2] != 'D' || bytes[3] != 'F')
        {
            return BadRequest(new { detail = "File không phải PDF." });
        }
        BannedListPdfParser.Result parsed;
        try
        {
            parsed = BannedListPdfParser.Parse(bytes, file.FileName);
        }
        catch (Exception)
        {
            return BadRequest(new { detail = "Không đọc được file PDF (file hỏng hoặc có mật khẩu)." });
        }
        return Ok(new ParsePdfResponseDto
        {
            LegalDocument = parsed.LegalDocument,
            SignedDate = parsed.SignedDate,
            LineCount = parsed.LineCount,
            Warnings = parsed.Warnings,
            Items = parsed.Items.Select(i => new ImportItemDto { CommonName = i.CommonName, Aliases = i.Aliases, Category = i.Category, Note = null }).ToList(),
        });
    }

    // ---------------------------------------------------------------------

    private sealed record Fields(string CommonName, List<string> Aliases, string Category, string? Note);

    private static Fields CleanFields(string? commonName, IEnumerable<string>? aliases, string? category, string? note, out string? error)
    {
        error = null;
        var name = (commonName ?? string.Empty).Trim();
        var cat = string.IsNullOrWhiteSpace(category) ? "OTHER" : category.Trim().ToUpperInvariant();
        var list = (aliases ?? Enumerable.Empty<string>())
            .Select(a => (a ?? string.Empty).Trim())
            .Where(a => a.Length > 0 && !string.Equals(a, name, StringComparison.OrdinalIgnoreCase))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var cleanNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        if (name.Length < 3 || name.Length > 200) error = "Tên hoạt chất phải từ 3 đến 200 ký tự.";
        else if (list.Count > MaxAliases) error = $"Tối đa {MaxAliases} tên khác.";
        else if (list.Any(a => a.Length < 3 || a.Length > 200)) error = "Mỗi tên khác phải từ 3 đến 200 ký tự (tên quá ngắn dễ chặn nhầm).";
        else if (!Categories.Contains(cat)) error = "Nhóm phải là INSECTICIDE, FUNGICIDE, HERBICIDE, RODENTICIDE hoặc OTHER.";
        else if (cleanNote is { Length: > 2000 }) error = "Ghi chú tối đa 2000 ký tự.";
        return new Fields(name, list, cat, cleanNote);
    }

    private static BannedSubstanceDecision? CleanDecision(DecisionInputDto? dto, out string? error)
    {
        error = null;
        if (dto == null)
        {
            error = "Cần căn cứ văn bản (số hiệu thông tư / quyết định).";
            return null;
        }
        var action = (dto.Action ?? string.Empty).Trim().ToUpperInvariant();
        var doc = (dto.LegalDocument ?? string.Empty).Trim();
        var url = string.IsNullOrWhiteSpace(dto.SourceUrl) ? null : dto.SourceUrl.Trim();
        if (!Actions.Contains(action)) error = "Quyết định phải là BAN (cấm) hoặc UNBAN (bỏ cấm).";
        else if (doc.Length < 3 || doc.Length > 200) error = "Số hiệu văn bản phải từ 3 đến 200 ký tự (ví dụ: Thông tư 75/2025/TT-BNNMT).";
        else if (url != null && !(url.Length <= 1000 && Uri.TryCreate(url, UriKind.Absolute, out var u) && (u.Scheme == Uri.UriSchemeHttp || u.Scheme == Uri.UriSchemeHttps)))
            error = "Link văn bản phải là địa chỉ http(s).";
        else if (dto.EffectiveDate is { } d && (d.Year < 1990 || d.Year > 2100)) error = "Ngày hiệu lực không hợp lệ.";
        else if (dto.Note is { Length: > 2000 }) error = "Ghi chú tối đa 2000 ký tự.";
        if (error != null) return null;
        return new BannedSubstanceDecision
        {
            Action = action, LegalDocument = doc, EffectiveDate = dto.EffectiveDate, SourceUrl = url,
            Note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim(),
        };
    }

    private static string MatchKey(string term) =>
        System.Text.RegularExpressions.Regex.Replace(System.Text.RegularExpressions.Regex.Replace(term, @"\([^)]*\)", " "), @"\s+", " ").Trim().ToLowerInvariant();

    private static BannedSubstanceDecision CloneDecision(BannedSubstanceDecision t, string actor) => new()
    {
        Action = t.Action, LegalDocument = t.LegalDocument, EffectiveDate = t.EffectiveDate, SourceUrl = t.SourceUrl, Note = t.Note, CreatedBy = actor,
    };

    private Task<BannedSubstance?> FindByNameAsync(string name, int? exceptId, CancellationToken ct)
    {
        var lower = name.ToLower();
        return _db.BannedSubstances.FirstOrDefaultAsync(s => !s.IsDeleted && s.CommonName.ToLower() == lower && (exceptId == null || s.Id != exceptId), ct);
    }

    private static BannedSubstanceDto ToDto(BannedSubstance s, DateOnly today, bool isAdmin)
    {
        var current = s.CurrentDecision(today);
        var upcoming = s.Decisions.Where(d => !d.IsDeleted && d.EffectiveDate > today).OrderBy(d => d.EffectiveDate).FirstOrDefault();
        return new BannedSubstanceDto
        {
            Id = s.Id,
            CommonName = s.CommonName,
            Aliases = s.Aliases,
            Category = s.Category,
            Note = s.Note,
            IsBanned = current?.Action == BannedSubstanceDecision.Ban,
            CurrentLegalDocument = current?.LegalDocument,
            CurrentEffectiveDate = current?.EffectiveDate,
            UpcomingAction = upcoming?.Action,
            UpcomingEffectiveDate = upcoming?.EffectiveDate,
            UpdatedAt = s.UpdatedAt ?? s.CreatedAt,
            Decisions = s.Decisions.Where(d => !d.IsDeleted)
                .OrderByDescending(d => d.EffectiveDate ?? DateOnly.MinValue).ThenByDescending(d => d.Id)
                .Select(d => new DecisionDto
                {
                    Id = d.Id, Action = d.Action, LegalDocument = d.LegalDocument, EffectiveDate = d.EffectiveDate,
                    SourceUrl = d.SourceUrl, Note = d.Note, CreatedAt = d.CreatedAt, CreatedBy = isAdmin ? d.CreatedBy : null,
                }).ToList(),
        };
    }

    private bool IsAdmin() =>
        (User.Identity?.IsAuthenticated == true && (User.IsInRole("ADMIN") || User.HasClaim(ClaimTypes.Role, "ADMIN") || User.HasClaim("role", "ADMIN")))
        || AdminApiKeyAuthAttribute.HasValidKey(Request);

    private bool CheckAdmin(out IActionResult? error)
    {
        if (IsAdmin())
        {
            error = null;
            return true;
        }
        error = User.Identity?.IsAuthenticated == true
            ? StatusCode(StatusCodes.Status403Forbidden, new { detail = "Yêu cầu quyền Quản trị viên (ADMIN)." })
            : Unauthorized(new { detail = "Yêu cầu đăng nhập tài khoản Quản trị viên hoặc khóa X-Admin-Key hợp lệ." });
        return false;
    }

    private string CurrentActor() =>
        User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value
        ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value ?? "admin-key";

    // ---------------------------------------------------------------------
    // DTO

    public class DecisionInputDto
    {
        [JsonPropertyName("action")] public string? Action { get; set; }
        [JsonPropertyName("legal_document")] public string? LegalDocument { get; set; }
        [JsonPropertyName("effective_date")] public DateOnly? EffectiveDate { get; set; }
        [JsonPropertyName("source_url")] public string? SourceUrl { get; set; }
        [JsonPropertyName("note")] public string? Note { get; set; }
    }

    public class CreateBannedSubstanceDto
    {
        [JsonPropertyName("common_name")] public string? CommonName { get; set; }
        [JsonPropertyName("aliases")] public List<string>? Aliases { get; set; }
        [JsonPropertyName("category")] public string? Category { get; set; }
        [JsonPropertyName("note")] public string? Note { get; set; }
        [JsonPropertyName("decision")] public DecisionInputDto? Decision { get; set; }
    }

    public class UpdateBannedSubstanceDto
    {
        [JsonPropertyName("common_name")] public string? CommonName { get; set; }
        [JsonPropertyName("aliases")] public List<string>? Aliases { get; set; }
        [JsonPropertyName("category")] public string? Category { get; set; }
        [JsonPropertyName("note")] public string? Note { get; set; }
    }

    public class ImportItemDto
    {
        [JsonPropertyName("common_name")] public string? CommonName { get; set; }
        [JsonPropertyName("aliases")] public List<string>? Aliases { get; set; }
        [JsonPropertyName("category")] public string? Category { get; set; }
        [JsonPropertyName("note")] public string? Note { get; set; }
    }

    public class ImportBannedDto
    {
        [JsonPropertyName("action")] public string? Action { get; set; }
        [JsonPropertyName("legal_document")] public string? LegalDocument { get; set; }
        [JsonPropertyName("effective_date")] public DateOnly? EffectiveDate { get; set; }
        [JsonPropertyName("source_url")] public string? SourceUrl { get; set; }
        [JsonPropertyName("note")] public string? Note { get; set; }
        [JsonPropertyName("dry_run")] public bool DryRun { get; set; } = true;
        [JsonPropertyName("items")] public List<ImportItemDto>? Items { get; set; }
    }

    public class ImportResultDto
    {
        [JsonPropertyName("common_name")] public string CommonName { get; set; } = string.Empty;
        [JsonPropertyName("aliases")] public List<string> Aliases { get; set; } = new();
        [JsonPropertyName("category")] public string Category { get; set; } = "OTHER";
        /// <summary>NEW | ADD_DECISION | NO_CHANGE | DUPLICATE | INVALID</summary>
        [JsonPropertyName("status")] public string Status { get; set; } = string.Empty;
        [JsonPropertyName("message")] public string? Message { get; set; }
        [JsonPropertyName("existing_id")] public int? ExistingId { get; set; }
        [JsonPropertyName("existing_name")] public string? ExistingName { get; set; }
    }

    public class ParsePdfResponseDto
    {
        [JsonPropertyName("legal_document")] public string? LegalDocument { get; set; }
        [JsonPropertyName("signed_date")] public string? SignedDate { get; set; }
        [JsonPropertyName("line_count")] public int LineCount { get; set; }
        [JsonPropertyName("warnings")] public List<string> Warnings { get; set; } = new();
        [JsonPropertyName("items")] public List<ImportItemDto> Items { get; set; } = new();
    }

    public class ImportResponseDto
    {
        [JsonPropertyName("dry_run")] public bool DryRun { get; set; }
        [JsonPropertyName("results")] public List<ImportResultDto> Results { get; set; } = new();
    }

    public class DecisionDto
    {
        [JsonPropertyName("id")] public int Id { get; set; }
        [JsonPropertyName("action")] public string Action { get; set; } = string.Empty;
        [JsonPropertyName("legal_document")] public string LegalDocument { get; set; } = string.Empty;
        [JsonPropertyName("effective_date")] public DateOnly? EffectiveDate { get; set; }
        [JsonPropertyName("source_url")] public string? SourceUrl { get; set; }
        [JsonPropertyName("note")] public string? Note { get; set; }
        [JsonPropertyName("created_at")] public DateTime CreatedAt { get; set; }
        [JsonPropertyName("created_by")] public string? CreatedBy { get; set; }
    }

    public class BannedSubstanceDto
    {
        [JsonPropertyName("id")] public int Id { get; set; }
        [JsonPropertyName("common_name")] public string CommonName { get; set; } = string.Empty;
        [JsonPropertyName("aliases")] public List<string> Aliases { get; set; } = new();
        [JsonPropertyName("category")] public string Category { get; set; } = "OTHER";
        [JsonPropertyName("note")] public string? Note { get; set; }
        [JsonPropertyName("is_banned")] public bool IsBanned { get; set; }
        [JsonPropertyName("current_legal_document")] public string? CurrentLegalDocument { get; set; }
        [JsonPropertyName("current_effective_date")] public DateOnly? CurrentEffectiveDate { get; set; }
        [JsonPropertyName("upcoming_action")] public string? UpcomingAction { get; set; }
        [JsonPropertyName("upcoming_effective_date")] public DateOnly? UpcomingEffectiveDate { get; set; }
        [JsonPropertyName("updated_at")] public DateTime UpdatedAt { get; set; }
        [JsonPropertyName("decisions")] public List<DecisionDto> Decisions { get; set; } = new();
    }

    public class BannedTermDto
    {
        [JsonPropertyName("text")] public string Text { get; set; } = string.Empty;
        [JsonPropertyName("substance")] public string Substance { get; set; } = string.Empty;
    }

    public class BannedListDto
    {
        [JsonPropertyName("today")] public DateOnly Today { get; set; }
        [JsonPropertyName("items")] public List<BannedSubstanceDto> Items { get; set; } = new();
        [JsonPropertyName("terms")] public List<BannedTermDto> Terms { get; set; } = new();
        [JsonPropertyName("loaded_from_database")] public bool LoadedFromDatabase { get; set; }
    }
}
