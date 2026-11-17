using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace Lavitree.Infrastructure.Services;

/// <summary>
/// Kiểm tra câu "trích nguyên văn" (Gemini đưa ra) có thật sự nằm trong trang nguồn không (TASK-18-R4).
/// So khớp sau khi bỏ thẻ HTML, bỏ dấu tiếng Việt, gộp khoảng trắng / dấu câu. Thuần, không gọi mạng.
/// </summary>
public static class QuoteMatcher
{
    public const string Found = "FOUND";         // có nguyên văn (sau chuẩn hóa)
    public const string Partial = "PARTIAL";     // gần đúng (≥ 80% từ khớp trong một đoạn liền) nhưng không nguyên văn
    public const string NotFound = "NOT_FOUND";  // không có trong trang

    public sealed record MatchResult(string Status, double Score, string? PageSnippet, List<string> MissingNumbers);

    private static readonly Regex DropBlocks = new(
        @"<(script|style|noscript|template|svg|head)\b[^>]*>.*?</\1\s*>|<!--.*?-->",
        RegexOptions.Singleline | RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex BlockTags = new(
        @"</?(p|div|br|li|ul|ol|tr|td|th|h[1-6]|section|article|table|blockquote)\b[^>]*>",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex AnyTag = new(@"<[^>]+>", RegexOptions.Compiled);
    private static readonly Regex Spaces = new(@"[ \t\f\v ]+", RegexOptions.Compiled);
    // Chữ và số tách riêng: "m2" = "m 2", "10kg" = "10 kg" (trang hay viết "m²", Gemini viết "m2")
    private static readonly Regex Token = new(@"\p{L}+|\p{N}+", RegexOptions.Compiled);
    // Bỏ số dính sau chữ cái (m2, CaCO3): đó là đơn vị / công thức, không phải liều
    private static readonly Regex Number = new(@"(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?", RegexOptions.Compiled);

    /// <summary>HTML → chữ thuần (bỏ script/style/comment, thẻ khối thành xuống dòng, giải mã &amp;...).</summary>
    public static string HtmlToText(string html)
    {
        if (string.IsNullOrEmpty(html)) return string.Empty;
        var s = DropBlocks.Replace(html, " ");
        s = BlockTags.Replace(s, "\n");
        s = AnyTag.Replace(s, " ");
        s = WebUtility.HtmlDecode(s);
        s = Spaces.Replace(s, " ");
        return Regex.Replace(s, @"\s*\n\s*", "\n").Trim();
    }

    /// <summary>Bỏ dấu tiếng Việt + chữ thường (đ → d).</summary>
    public static string Fold(string text)
    {
        if (string.IsNullOrEmpty(text)) return string.Empty;
        var normalized = text.Replace('đ', 'd').Replace('Đ', 'd').Normalize(NormalizationForm.FormKD); // KD: "²" → "2", "ﬁ" → "fi"
        var sb = new StringBuilder(normalized.Length);
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
    }

    private sealed record Tok(string Key, int Start, int End);

    private static List<Tok> Tokenize(string text) =>
        Token.Matches(text).Select(m => new Tok(Fold(m.Value), m.Index, m.Index + m.Length)).ToList();

    private static string NormNumber(string n) => n.Replace(',', '.').TrimEnd('0').TrimEnd('.') is { Length: > 0 } t ? t : "0";

    public static MatchResult Match(string pageText, string quote)
    {
        var quoteToks = Tokenize(quote ?? string.Empty);
        var pageToks = Tokenize(pageText ?? string.Empty);
        if (quoteToks.Count == 0 || pageToks.Count == 0)
        {
            return new MatchResult(NotFound, 0, null, new List<string>());
        }

        var qKeys = quoteToks.Select(t => t.Key).ToArray();
        var pKeys = pageToks.Select(t => t.Key).ToArray();

        // 1. Nguyên văn: dãy từ của câu trích xuất hiện liền nhau trong trang
        for (var i = 0; i + qKeys.Length <= pKeys.Length; i++)
        {
            var ok = true;
            for (var j = 0; j < qKeys.Length && ok; j++) ok = pKeys[i + j] == qKeys[j];
            if (ok)
            {
                return new MatchResult(Found, 1, Snippet(pageText!, pageToks, i, qKeys.Length), new List<string>());
            }
        }

        // 2. Gần đúng: cửa sổ trượt cùng độ dài, đếm số từ trùng (theo multiset)
        var need = qKeys.GroupBy(k => k).ToDictionary(g => g.Key, g => g.Count());
        var window = new Dictionary<string, int>();
        int matched = 0, best = 0, bestStart = 0;
        var w = Math.Min(qKeys.Length, pKeys.Length);
        for (var i = 0; i < pKeys.Length; i++)
        {
            var add = pKeys[i];
            window[add] = window.GetValueOrDefault(add) + 1;
            if (need.TryGetValue(add, out var nAdd) && window[add] <= nAdd) matched++;
            if (i >= w)
            {
                var rem = pKeys[i - w];
                if (need.TryGetValue(rem, out var nRem) && window[rem] <= nRem) matched--;
                window[rem]--;
            }
            if (i >= w - 1 && matched > best)
            {
                best = matched;
                bestStart = i - w + 1;
            }
        }

        var score = Math.Round((double)best / qKeys.Length, 2);
        // Con số trong câu trích phải có ở đoạn trang gần câu trích nhất (±15 từ), không tính số ở chỗ khác trong trang
        // (so theo giá trị: "15,0" = "15")
        var fromTok = Math.Max(0, bestStart - 15);
        var toTok = Math.Min(pageToks.Count - 1, bestStart + w - 1 + 15);
        var region = pageText![pageToks[fromTok].Start..pageToks[toTok].End];
        var regionNumbers = Number.Matches(region.Normalize(NormalizationForm.FormKD)).Select(m => NormNumber(m.Value)).ToHashSet();
        var missingNumbers = Number.Matches(quote!.Normalize(NormalizationForm.FormKD)).Select(m => m.Value)
            .Where(n => !regionNumbers.Contains(NormNumber(n)))
            .Distinct()
            .ToList();
        var status = score >= 0.8 ? Partial : NotFound;
        var snippet = score >= 0.4 ? Snippet(pageText!, pageToks, bestStart, w) : null;
        return new MatchResult(status, score, snippet, missingNumbers);
    }

    private static string Snippet(string text, List<Tok> toks, int startTok, int count)
    {
        var from = Math.Max(0, toks[startTok].Start - 60);
        var endTok = Math.Min(toks.Count - 1, startTok + Math.Max(count, 1) - 1);
        var to = Math.Min(text.Length, toks[endTok].End + 60);
        var s = text[from..to].Replace('\n', ' ').Trim();
        return (from > 0 ? "…" : "") + s + (to < text.Length ? "…" : "");
    }
}
