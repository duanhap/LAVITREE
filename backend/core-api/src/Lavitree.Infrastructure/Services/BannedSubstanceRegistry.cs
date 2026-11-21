using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Lavitree.Domain.Entities;
using Lavitree.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Lavitree.Infrastructure.Services;

/// <summary>
/// Danh mục chất cấm đang có hiệu lực, giữ trong bộ nhớ (TASK-19). Nạp từ bảng BannedSubstances lúc khởi động,
/// sau mỗi lần Admin sửa, và định kỳ (để quyết định có ngày hiệu lực trong tương lai tự áp dụng).
/// Chưa nạp được CSDL thì dùng danh sách cũ trong code (an toàn: thà chặn nhầm còn hơn bỏ lọt).
/// </summary>
public static class BannedSubstanceRegistry
{
    public sealed record Term(string Text, string SubstanceName);

    /// <summary>
    /// Dự phòng khi chưa nạp được CSDL: trùng dữ liệu khởi tạo của migration AddBannedSubstances
    /// (Phụ lục II TT 75/2025/TT-BNNMT + danh sách cũ). Sinh từ cùng một nguồn với agent-service và web.
    /// </summary>
    public static readonly IReadOnlyList<Term> Fallback = new List<Term>
    {
        new("aldrin", "Aldrin"),
        new("lindane", "Lindane"),
        new("bhc", "Lindane"),
        new("cadmium compound", "Cadmium compound"),
        new("cadmium", "Cadmium compound"),
        new("carbofuran", "Carbofuran"),
        new("furadan", "Carbofuran"),
        new("chlordane", "Chlordane"),
        new("chlordimeform", "Chlordimeform"),
        new("ddt", "DDT"),
        new("dieldrin", "Dieldrin"),
        new("endosulfan", "Endosulfan"),
        new("thiodan", "Endosulfan"),
        new("endrin", "Endrin"),
        new("heptachlor", "Heptachlor"),
        new("isobenzan", "Isobenzan"),
        new("isodrin", "Isodrin"),
        new("lead (pb)", "Lead (Pb)"),
        new("methamidophos", "Methamidophos"),
        new("methyl parathion", "Methyl Parathion"),
        new("parathion-methyl", "Methyl Parathion"),
        new("monocrotophos", "Monocrotophos"),
        new("parathion ethyl", "Parathion Ethyl"),
        new("parathion", "Parathion Ethyl"),
        new("ethyl parathion", "Parathion Ethyl"),
        new("sodium pentachlorophenate monohydrate", "Sodium Pentachlorophenate monohydrate"),
        new("pentachlorophenol", "Pentachlorophenol"),
        new("phosphamidon", "Phosphamidon"),
        new("polychlorocamphene", "Polychlorocamphene"),
        new("toxaphene", "Polychlorocamphene"),
        new("trichlorfon", "Trichlorfon"),
        new("chlorophos", "Trichlorfon"),
        new("dipterex", "Trichlorfon"),
        new("arsenic (as)", "Arsenic (As)"),
        new("arsenic", "Arsenic (As)"),
        new("captan", "Captan"),
        new("captafol", "Captafol"),
        new("hexachlorobenzene", "Hexachlorobenzene"),
        new("mercury (hg)", "Mercury (Hg)"),
        new("mercury", "Mercury (Hg)"),
        new("selenium (se)", "Selenium (Se)"),
        new("thallium compound", "Thallium compound"),
        new("talium compond", "Thallium compound"),
        new("thallium", "Thallium compound"),
        new("2,4,5-t", "2,4,5-T"),
        new("2.4.5-t", "2,4,5-T"),
        new("paraquat", "Paraquat"),
        new("pa-ra-quat", "Paraquat"),
        new("para-quat", "Paraquat"),
        new("gramoxone", "Paraquat"),
        new("2,4-d", "2,4-D"),
        new("2.4-d", "2,4-D"),
        new("2,4d", "2,4-D"),
        new("2.4d", "2,4-D"),
        new("chlorpyrifos", "Chlorpyrifos"),
        new("glyphosate", "Glyphosate"),
    };

    private static volatile IReadOnlyList<Term> _terms = Fallback;
    public static DateTime? LoadedAtUtc { get; private set; }
    public static bool LoadedFromDatabase { get; private set; }

    public static IReadOnlyList<Term> Terms => _terms;

    /// <summary>Ngày hôm nay theo giờ Việt Nam (UTC+7), dùng so ngày hiệu lực.</summary>
    public static DateOnly TodayVn() => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

    public static bool IsBanned(string? text) => FindBanned(text).Count > 0;

    /// <summary>Tên các chất cấm có trong <paramref name="text"/> (so theo từ nguyên vẹn, không phân biệt hoa thường).</summary>
    public static List<string> FindBanned(string? text)
    {
        var found = new List<string>();
        if (string.IsNullOrWhiteSpace(text)) return found;
        var lower = text.ToLowerInvariant();
        foreach (var t in _terms)
        {
            if (!found.Contains(t.SubstanceName) && ContainsTerm(lower, t.Text)) found.Add(t.SubstanceName);
        }
        return found;
    }

    /// <summary>
    /// Có cụm <paramref name="term"/> đứng riêng trong chữ: trước nó không phải chữ / số, sau nó không phải chữ
    /// ("2,4-D" khớp "2,4-D 720SL" nhưng không khớp "2,4-DB"; "glyphosate" khớp "Glyphosate 480").
    /// </summary>
    public static bool ContainsTerm(string lowerText, string term)
    {
        if (string.IsNullOrEmpty(term)) return false;
        var start = 0;
        while (true)
        {
            var i = lowerText.IndexOf(term, start, StringComparison.Ordinal);
            if (i < 0) return false;
            var end = i + term.Length;
            var beforeOk = i == 0 || !char.IsLetterOrDigit(lowerText[i - 1]);
            var afterOk = end >= lowerText.Length || !char.IsLetter(lowerText[end]);
            if (beforeOk && afterOk) return true;
            start = i + 1;
        }
    }

    /// <summary>Các cụm so khớp của một chất: tên chung + tên khác, chữ thường, bỏ trùng.</summary>
    public static IEnumerable<string> TermsOf(BannedSubstance s) =>
        new[] { s.CommonName }.Concat(s.Aliases ?? new List<string>())
            .Select(x => (x ?? string.Empty).Trim().ToLowerInvariant())
            .Where(x => x.Length >= 3)
            .Distinct();

    public static async Task ReloadAsync(LavitreeDbContext db, CancellationToken ct = default)
    {
        var today = TodayVn();
        var substances = await db.BannedSubstances
            .AsNoTracking()
            .Where(s => !s.IsDeleted)
            .Include(s => s.Decisions)
            .ToListAsync(ct);
        var terms = substances
            .Where(s => s.IsBannedOn(today))
            .SelectMany(s => TermsOf(s).Select(t => new Term(t, s.CommonName)))
            // cụm dài so trước: "pa-ra-quat" trước "paraquat" không ảnh hưởng kết quả, chỉ để thứ tự ổn định
            .OrderByDescending(t => t.Text.Length)
            .ToList();
        _terms = terms;
        LoadedAtUtc = DateTime.UtcNow;
        LoadedFromDatabase = true;
    }
}
