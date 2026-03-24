using System.Net;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;

namespace TespitSozluk.API.Helpers;

/// <summary>
/// (bkz: ...) terimleri için tekil veya toplu topic çözümlemesi — N+1 yerine tek sorgu.
/// API yanıtındaki Content, geçerli bkz'lar için /?topic={id}, geçersizler için tıklanamaz (entity escape) üretir;
/// böylece istemci tarafındaki genel (bkz) regex'i geçersizleri yeşil arama linkine çevirmez.
/// </summary>
public static class BkzTopicHelper
{
    private static readonly Regex BkzRegex = new(@"\(bkz:\s*([^)]+)\)", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private const string ValidBkzAnchorClass = "text-emerald-500 font-medium hover:underline";

    /// <summary>
    /// Veritabanından: küçük harf başlık → Id ve küçük harf başlık → kanonik başlık (tek sorgu).
    /// </summary>
    public sealed class BkzTopicMaps
    {
        public Dictionary<string, Guid> TitleLowerToId { get; }
        public Dictionary<string, string> TitleLowerToCanonicalTitle { get; }

        public BkzTopicMaps(Dictionary<string, Guid> titleLowerToId, Dictionary<string, string> titleLowerToCanonicalTitle)
        {
            TitleLowerToId = titleLowerToId;
            TitleLowerToCanonicalTitle = titleLowerToCanonicalTitle;
        }

        public static BkzTopicMaps Empty { get; } = new(new Dictionary<string, Guid>(), new Dictionary<string, string>());
    }

    /// <summary>Tüm içeriklerdeki bkz terimlerini (büyük/küçük harf duyarsız tekil) torbaya ekler.</summary>
    public static void CollectBkzTermsToBag(string? content, HashSet<string> bag)
    {
        if (string.IsNullOrWhiteSpace(content)) return;
        foreach (Match m in BkzRegex.Matches(content))
        {
            var term = m.Groups[1].Value.Trim();
            if (!string.IsNullOrEmpty(term))
                bag.Add(term);
        }
    }

    /// <summary>Tek sorgu ile başlık eşleşmelerini yükler.</summary>
    public static async Task<BkzTopicMaps> LoadBkzTopicMapsAsync(
        AppDbContext context,
        HashSet<string> distinctTerms,
        CancellationToken cancellationToken = default)
    {
        if (distinctTerms.Count == 0)
            return BkzTopicMaps.Empty;

        var lowerTerms = distinctTerms.Select(t => t.ToLowerInvariant()).ToList();
        var topics = await context.Topics
            .AsNoTracking()
            .Where(t => lowerTerms.Contains(t.Title.ToLower()))
            .Select(t => new { t.Title, t.Id })
            .ToListAsync(cancellationToken);

        var titleLowerToId = new Dictionary<string, Guid>(StringComparer.Ordinal);
        var titleLowerToCanonical = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var t in topics)
        {
            var lower = t.Title.ToLowerInvariant();
            titleLowerToId[lower] = t.Id;
            titleLowerToCanonical[lower] = t.Title;
        }

        return new BkzTopicMaps(titleLowerToId, titleLowerToCanonical);
    }

    /// <summary>DTO: kanonik başlık → topic id (önceki API sözleşmesi).</summary>
    public static Dictionary<string, Guid> BuildValidBkzs(string content, BkzTopicMaps maps)
    {
        if (string.IsNullOrWhiteSpace(content)) return new Dictionary<string, Guid>();

        var matches = BkzRegex.Matches(content);
        var terms = matches
            .Select(m => m.Groups[1].Value.Trim())
            .Where(s => !string.IsNullOrEmpty(s))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (terms.Count == 0) return new Dictionary<string, Guid>();

        var result = new Dictionary<string, Guid>();
        foreach (var term in terms)
        {
            var lower = term.ToLowerInvariant();
            if (maps.TitleLowerToId.TryGetValue(lower, out var id) &&
                maps.TitleLowerToCanonicalTitle.TryGetValue(lower, out var canonical))
            {
                result[canonical] = id;
            }
        }

        return result;
    }

    /// <summary>
    /// Geçerli bkz: yeşil &lt;a href="/?topic=Id"&gt;…&lt;/a&gt;.
    /// Geçersiz: parantezler HTML entity ile verilir; istemci (bkz) regex'i eşleştirmez, yeşil arama linki oluşmaz.
    /// </summary>
    public static string ApplyBkzHtmlToContent(string? content, BkzTopicMaps maps)
    {
        if (string.IsNullOrWhiteSpace(content)) return content ?? "";

        return BkzRegex.Replace(content, m =>
        {
            var innerRaw = m.Groups[1].Value;
            var inner = innerRaw.Trim();
            if (string.IsNullOrEmpty(inner))
                return m.Value;

            var enc = WebUtility.HtmlEncode(inner);
            var display = $"&#40;bkz: {enc}&#41;";

            if (maps.TitleLowerToId.TryGetValue(inner.ToLowerInvariant(), out var id))
            {
                return $"<a href=\"/?topic={id}\" class=\"{ValidBkzAnchorClass}\">{display}</a>";
            }

            return display;
        });
    }

    /// <summary>Tek içerik: tek DB sorgusu + haritalar + validBkzs DTO.</summary>
    public static async Task<(Dictionary<string, Guid> ValidBkzs, BkzTopicMaps Maps)> BuildValidBkzsAndMapsAsync(
        AppDbContext context,
        string? content,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(content))
            return (new Dictionary<string, Guid>(), BkzTopicMaps.Empty);

        var bag = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        CollectBkzTermsToBag(content, bag);
        var maps = await LoadBkzTopicMapsAsync(context, bag, cancellationToken);
        var validBkzs = BuildValidBkzs(content, maps);
        return (validBkzs, maps);
    }
}
