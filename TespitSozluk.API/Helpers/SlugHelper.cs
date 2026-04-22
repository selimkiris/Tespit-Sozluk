using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace TespitSozluk.API.Helpers;

/// <summary>
/// SEO dostu URL slug üretimi.
/// - Türkçe karakterleri ASCII'ye çevirir (ş→s, ç→c, ğ→g, ı→i, ö→o, ü→u; İ→i, I→i).
/// - Tüm harfleri küçük harfe indirir, alfanümerik olmayan karakterleri tireyle değiştirir.
/// - Aynı başlıkta çakışmayı kesin önlemek için sonuna TopicId'nin ilk 6 hex hanesini ekler.
/// </summary>
public static class SlugHelper
{
    private const int MaxBaseLength = 60;
    private const int IdSuffixLength = 6;

    private static readonly Regex NonAlphanumericRegex =
        new(@"[^a-z0-9]+", RegexOptions.Compiled);

    private static readonly Regex MultiDashRegex =
        new(@"-{2,}", RegexOptions.Compiled);

    /// <summary>
    /// Ham başlığı, URL'e uygun tire-ayraçlı küçük harfli bir sluga çevirir.
    /// Sonuç boş çıkarsa "baslik" sabitine düşer — id-suffix ile yine benzersiz kalır.
    /// </summary>
    public static string Slugify(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return "baslik";
        }

        var transliterated = TransliterateTurkish(input);

        var normalized = transliterated
            .Normalize(NormalizationForm.FormD);

        var sb = new StringBuilder(normalized.Length);
        foreach (var ch in normalized)
        {
            var uc = CharUnicodeInfo.GetUnicodeCategory(ch);
            if (uc != UnicodeCategory.NonSpacingMark)
            {
                sb.Append(ch);
            }
        }

        var ascii = sb.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();

        ascii = NonAlphanumericRegex.Replace(ascii, "-");
        ascii = MultiDashRegex.Replace(ascii, "-");
        ascii = ascii.Trim('-');

        if (ascii.Length > MaxBaseLength)
        {
            ascii = ascii[..MaxBaseLength].TrimEnd('-');
        }

        return string.IsNullOrEmpty(ascii) ? "baslik" : ascii;
    }

    /// <summary>
    /// Başlık + TopicId'den nihai slug üretir. Çakışmaları id-suffix sayesinde önler.
    /// Örn: "Hayata Dair Tespitler" + Guid(a4b2...) → "hayata-dair-tespitler-a4b2c3"
    /// </summary>
    public static string BuildTopicSlug(string? title, Guid topicId)
    {
        var baseSlug = Slugify(title);
        var suffix = topicId.ToString("N");
        if (suffix.Length > IdSuffixLength)
        {
            suffix = suffix[..IdSuffixLength];
        }

        return $"{baseSlug}-{suffix}";
    }

    /// <summary>Türkçeye özgü harfleri ASCII karşılıklarına çevirir.</summary>
    private static string TransliterateTurkish(string input)
    {
        var sb = new StringBuilder(input.Length);
        foreach (var ch in input)
        {
            sb.Append(ch switch
            {
                'ç' => "c",
                'Ç' => "C",
                'ğ' => "g",
                'Ğ' => "G",
                'ı' => "i",
                'I' => "I",
                'İ' => "i",
                'i' => "i",
                'ö' => "o",
                'Ö' => "O",
                'ş' => "s",
                'Ş' => "S",
                'ü' => "u",
                'Ü' => "U",
                _ => ch.ToString()
            });
        }
        return sb.ToString();
    }
}
