using System.Text.RegularExpressions;

namespace TespitSozluk.API.Helpers;

public static class MessagingContentHelper
{
    private static readonly Regex TagRegex = new("<[^>]+>", RegexOptions.Compiled);

    /// <summary>Entry HTML gövdesinden kısa düz metin (referans alıntısı için).</summary>
    public static string PlainTextPreview(string? html, int maxLength = 140)
    {
        if (string.IsNullOrWhiteSpace(html)) return string.Empty;
        var s = TagRegex.Replace(html, " ");
        s = System.Net.WebUtility.HtmlDecode(s) ?? s;
        s = Regex.Replace(s, @"\s+", " ", RegexOptions.None).Trim();
        if (s.Length <= maxLength) return s;
        return s[..maxLength].TrimEnd() + "…";
    }

    private static readonly Regex InlineMarkdownImage = new(
        @"!\[[^\]]*]\([^)]+\)",
        RegexOptions.Compiled);

    /// <summary>DM sohbet listesi için: düz metin veya sınırlı markdown içeren gövde önizlemesi.</summary>
    public static string ConversationListPreview(string? text, int maxLength = 120)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var s = InlineMarkdownImage.Replace(text, " [görsel] ");
        s = Regex.Replace(s, @"\s+", " ", RegexOptions.None).Trim();
        if (s.Length <= maxLength) return s;
        return s[..maxLength].TrimEnd() + "…";
    }
}
