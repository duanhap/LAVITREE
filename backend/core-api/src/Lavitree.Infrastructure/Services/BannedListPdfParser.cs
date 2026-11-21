using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using UglyToad.PdfPig;

namespace Lavitree.Infrastructure.Services;

/// <summary>
/// Đọc PDF "Danh mục thuốc BVTV cấm sử dụng tại Việt Nam" (ví dụ Phụ lục II TT 75/2025/TT-BNNMT) thành bảng nháp (TASK-19).
/// Chỉ đọc PDF có chữ (không OCR). Kết quả LUÔN để Admin duyệt trước khi lưu.
/// </summary>
public static class BannedListPdfParser
{
    public sealed record Item(string CommonName, List<string> Aliases, string Category, string RawText);

    public sealed record Result(string? LegalDocument, string? SignedDate, List<Item> Items, List<string> Warnings, int LineCount);

    private static readonly Regex Row = new(@"^\s*(\d{1,3})\s+(\S.*?)\s*$", RegexOptions.Compiled);
    private static readonly Regex DocNumber = new(@"Số\s*:\s*(\d{1,4}/\d{4}/[A-ZĐ][A-ZĐ\-]+)", RegexOptions.Compiled);
    private static readonly Regex SignedAt = new(@"Thời gian ký\s*:\s*(\d{4}-\d{2}-\d{2})", RegexOptions.Compiled);
    // "(Ban hành kèm theo Thông tư số     /2025/TT-BNNMT ..." (số để trống trong bản dự thảo / bản có chữ ký số)
    // So trên chữ đã bỏ dấu + chữ thường (PDF hay lưu tiếng Việt dạng tách dấu)
    private static readonly Regex IssuedWith = new(@"(thong tu|quyet dinh)\s+so\s*(\d{0,4})\s*/\s*(\d{4})\s*/\s*([a-z][a-z\-]+)", RegexOptions.Compiled);
    private static readonly Regex Annex = new(@"^phu luc\s+([ivx]+)\b", RegexOptions.Compiled);
    private static readonly Regex FileNumber = new(@"^(\d{1,4})\D", RegexOptions.Compiled);
    private static readonly Regex Paren = new(@"\(([^)]*)\)", RegexOptions.Compiled);

    public static Result Parse(byte[] pdf, string? fileName = null)
    {
        var lines = new List<string>();
        using (var doc = PdfDocument.Open(pdf))
        {
            foreach (var page in doc.GetPages())
            {
                // Gom chữ theo dòng (cùng đáy chữ, lệch ≤ 3pt), trên xuống, trái sang
                var rows = new List<(double Y, List<(double X, string Text)> Words)>();
                foreach (var w in page.GetWords())
                {
                    var y = w.BoundingBox.Bottom;
                    var row = rows.FirstOrDefault(r => Math.Abs(r.Y - y) <= 3);
                    if (row.Words == null)
                    {
                        row = (y, new List<(double, string)>());
                        rows.Add(row);
                    }
                    row.Words.Add((w.BoundingBox.Left, w.Text));
                }
                lines.AddRange(rows.OrderByDescending(r => r.Y)
                    .Select(r => string.Join(" ", r.Words.OrderBy(x => x.X).Select(x => x.Text))));
            }
        }
        return ParseLines(lines, fileName);
    }

    /// <summary>Phần thuần (test được không cần PDF): các dòng chữ → bảng nháp.</summary>
    public static Result ParseLines(IReadOnlyList<string> lines, string? fileName = null)
    {
        var warnings = new List<string>();
        var items = new List<Item>();
        string? category = null;
        string? legalDoc = null;
        string? signed = null;
        string? issuedWith = null;
        string? annex = null;
        var numberFromFileName = false;

        foreach (var raw in lines)
        {
            var line = raw.Trim();
            if (line.Length == 0) continue;
            if (legalDoc == null && DocNumber.Match(line) is { Success: true } dm)
            {
                var num = dm.Groups[1].Value;
                legalDoc = (num.Contains("/TT-") ? "Thông tư " : num.Contains("/QĐ-") ? "Quyết định " : "") + num;
            }
            if (signed == null && SignedAt.Match(line) is { Success: true } sm) signed = sm.Groups[1].Value;
            var folded = Fold(line);
            if (annex == null && Annex.Match(folded) is { Success: true } am) annex = am.Groups[1].Value.ToUpperInvariant();
            if (issuedWith == null && IssuedWith.Match(folded) is { Success: true } im)
            {
                var number = im.Groups[2].Value;
                // Số để trống: lấy chữ số đầu tên file ("75-bnnmt-pl2.pdf" → 75)
                if (number.Length == 0 && fileName != null && FileNumber.Match(Path.GetFileName(fileName)) is { Success: true } fm)
                {
                    number = fm.Groups[1].Value;
                    numberFromFileName = true;
                }
                var kind = im.Groups[1].Value == "thong tu" ? "Thông tư" : "Quyết định";
                var code = im.Groups[4].Value.ToUpperInvariant().Replace("QD-", "QĐ-");
                issuedWith = number.Length > 0 ? $"{kind} {number}/{im.Groups[3].Value}/{code}" : null;
            }

            var header = CategoryOf(line);
            if (header != null)
            {
                category = header;
                continue;
            }
            if (category == null) continue; // trước bảng: tiêu đề, số trang
            var m = Row.Match(line);
            if (!m.Success)
            {
                // Dòng bị ngắt giữa chừng ("2,4," / "5-T"): nối vào dòng trước
                if (items.Count > 0 && line.Length <= 40 && !line.Any(char.IsWhiteSpace) && items[^1].RawText.EndsWith(","))
                {
                    var prev = items[^1];
                    items[^1] = ToItem(prev.RawText + line, prev.Category);
                }
                continue;
            }
            items.Add(ToItem(m.Groups[2].Value, category));
        }

        if (items.Count == 0)
        {
            warnings.Add("Không tìm thấy dòng nào trong bảng. PDF có thể là bản scan (ảnh) hoặc không đúng mẫu Danh mục thuốc cấm.");
        }
        legalDoc ??= issuedWith;
        if (legalDoc != null && annex != null && !legalDoc.Contains("Phụ lục")) legalDoc += $", Phụ lục {annex}";
        if (legalDoc == null) warnings.Add("Không đọc được số hiệu văn bản, hãy nhập tay.");
        else if (numberFromFileName) warnings.Add($"Số hiệu văn bản lấy từ tên file ({legalDoc}), hãy kiểm tra lại.");
        if (lines.Any(l => Fold(l).Contains("phu luc i") && !Fold(l).Contains("phu luc ii")) && items.Count > 0)
        {
            warnings.Add("PDF có vẻ là Phụ lục I (danh mục ĐƯỢC PHÉP), không phải danh mục cấm. Kiểm tra lại trước khi lưu.");
        }
        return new Result(legalDoc, signed, items, warnings, lines.Count);
    }

    private static string? CategoryOf(string line)
    {
        var f = Fold(line);
        if (!f.StartsWith("thuoc ")) return null;
        if (f.Contains("tru sau")) return "INSECTICIDE";
        if (f.Contains("tru benh")) return "FUNGICIDE";
        if (f.Contains("tru chuot")) return "RODENTICIDE";
        if (f.Contains("tru co")) return "HERBICIDE";
        if (f.Contains("bao quan lam san") || f.Contains("dieu hoa sinh truong")) return "OTHER";
        return null;
    }

    /// <summary>"Trichlorfon (Chlorophos)" → Trichlorfon + [Chlorophos]; "BHC, Lindane" → BHC + [Lindane]; "Lead (Pb)" giữ nguyên.</summary>
    public static Item ToItem(string text, string category)
    {
        var raw = Regex.Replace(text.Trim(), @"\s+", " ");
        var aliases = new List<string>();
        var name = raw;
        var parens = Paren.Matches(raw).Select(x => x.Groups[1].Value.Trim()).ToList();
        // Ký hiệu hóa học ngắn (Pb, Cd, Hg) giữ trong tên, không tách thành tên khác (quá ngắn, dễ chặn nhầm)
        if (parens.Count > 0 && parens.All(p => p.Length >= 3))
        {
            name = Paren.Replace(raw, " ").Trim();
            aliases.AddRange(parens);
        }
        name = Regex.Replace(name, @"\s+", " ").Trim();
        // "BHC, Lindane": phẩy + khoảng trắng giữa hai tên chữ; "2,4,5-T" (không khoảng trắng) giữ nguyên
        var parts = Regex.Split(name, @",\s+").Select(p => p.Trim()).Where(p => p.Length > 0).ToList();
        if (parts.Count > 1 && parts.All(p => p.Any(char.IsLetter) && p.Length >= 3))
        {
            name = parts[0];
            aliases.AddRange(parts.Skip(1));
        }
        return new Item(name, aliases.Distinct(StringComparer.OrdinalIgnoreCase).ToList(), category, raw);
    }

    private static string Fold(string s) => QuoteMatcher.Fold(s);
}
