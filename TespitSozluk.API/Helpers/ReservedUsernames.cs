using System.Globalization;
using System.Text;

namespace TespitSozluk.API.Helpers;

/// <summary>
/// Yasaklı nickname kontrolü: Türkçe harf ve özel karakter varyasyonlarını normalize edip kök kelimelerle eşleştirir.
/// </summary>
public static class ReservedUsernames
{
    public const string ReservedMessage =
        "Bu kullanıcı adı sistem tarafından rezerve edilmiştir ve alınamaz.";

    /// <summary>
    /// Kısa token yalnızca tam eşleşmede yasak ("modern" gibi yanlış pozitifleri önlemek için alt dize aranmaz).
    /// </summary>
    private const string ModExact = "mod";

    /// <summary>
    /// Normalize edilmiş kullanıcı adında geçmesi yasak kökler (tam kelime veya içerik olarak).
    /// </summary>
    private static readonly string[] ForbiddenSubstrings =
    [
        "tespitsozluk",
        "admin",
        "yonetici",
        "moderator",
        "destek",
        "support",
        "anonim",
        "anonymous",
        "sistem",
        "system",
        "resmi",
        "official",
        "root",
        "staff",
        "webmaster",
    ];

    /// <summary>
    /// a) Küçük harf (TR kültürü: I/İ tutarlılığı), b) Türkçe harfleri Latin karşılıklarına,
    /// c) Harf ve rakam dışındaki tüm karakterleri kaldırır (nokta, tire, alt çizgi vb.).
    /// </summary>
    public static string NormalizeForReservedCheck(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;

        var tr = CultureInfo.GetCultureInfo("tr-TR");
        var sb = new StringBuilder(input.Trim().Length);

        foreach (var ch in input.Trim())
        {
            var lower = char.ToLower(ch, tr);
            var mapped = MapTurkishLatin(lower);
            if (mapped is >= 'a' and <= 'z' || char.IsAsciiDigit(mapped))
                sb.Append(mapped);
        }

        return sb.ToString();
    }

    private static char MapTurkishLatin(char c) =>
        c switch
        {
            'ç' => 'c',
            'ğ' => 'g',
            'ı' => 'i',
            'ö' => 'o',
            'ş' => 's',
            'ü' => 'u',
            'i' => 'i',
            _ => c,
        };

    public static bool IsReserved(string? username)
    {
        var n = NormalizeForReservedCheck(username);
        if (n.Length == 0)
            return false;

        if (string.Equals(n, ModExact, StringComparison.Ordinal))
            return true;

        foreach (var fragment in ForbiddenSubstrings)
        {
            if (n.Contains(fragment, StringComparison.Ordinal))
                return true;
        }

        return false;
    }
}
