using System.Text.Json.Serialization;
using TespitSozluk.API.Entities;

namespace TespitSozluk.API.DTOs;

/// <summary>
/// <c>POST /api/Badges/toggle</c> request gövdesi.
/// Aynı (kullanıcı, entry, rozet) üçlüsü zaten varsa rozet kaldırılır
/// (15 dk kuralına tabidir); yoksa eklenmek üzere validate edilir.
/// </summary>
public class ToggleBadgeRequestDto
{
    public Guid EntryId { get; set; }
    public BadgeType BadgeType { get; set; }
}

/// <summary>
/// Toggle cevabı. <see cref="IsActive"/> = true rozetin yeni eklendiğini,
/// false rozetin kaldırıldığını ifade eder.
/// </summary>
public class ToggleBadgeResponseDto
{
    public bool IsActive { get; set; }
    public BadgeType BadgeType { get; set; }
    public Guid EntryId { get; set; }
    /// <summary>Entry'nin bu rozet türünden toplam alma sayısı (toggle sonrası).</summary>
    public int TotalForBadgeOnEntry { get; set; }
    /// <summary>Entry'nin tüm rozet türlerinden toplam alma sayısı (toggle sonrası).</summary>
    public int TotalBadgesOnEntry { get; set; }
}

/// <summary>Bu ay tek bir rozet ataması (entry + zaman).</summary>
public class MonthlyBadgeUsageRowDto
{
    public Guid EntryId { get; set; }
    public DateTime AssignedAtUtc { get; set; }
}

/// <summary>Aylık durum tablosundaki tek satır.</summary>
public class MonthlyBadgeStatusItemDto
{
    public BadgeType BadgeType { get; set; }

    /// <summary>Bu ay bu türden verilen rozet adedi (0–2).</summary>
    public int MonthlyUsageCount { get; set; }

    /// <summary>Bu ay bu tür için yapılan atamalar (en fazla 2).</summary>
    public List<MonthlyBadgeUsageRowDto> UsagesThisMonth { get; set; } = new();

    /// <summary>Eski istemci uyumu: ilk atama varsa ilk entry id.</summary>
    public Guid? UsedOnEntryId { get; set; }

    /// <summary>Eski istemci uyumu: ilk atamanın zamanı.</summary>
    public DateTime? UsedAtUtc { get; set; }

    /// <summary>Eski istemci uyumu: bu ay en az bir kullanım oldu mu.</summary>
    public bool Used { get; set; }
}

/// <summary>
/// <c>GET /api/Badges/my-monthly-status</c> cevabı. Her rozet türü için 1 satır
/// içerir; modal aynı sırayla render edebilir.
/// </summary>
public class MonthlyBadgeStatusResponseDto
{
    /// <summary>Bu kotanın hesaplandığı ay (UTC) — yyyy-MM-01 00:00:00Z.</summary>
    public DateTime MonthStartUtc { get; set; }

    /// <summary>Kullanılmayan rozetlerin devretmediği bir sonraki yenilenme anı (UTC).</summary>
    public DateTime NextResetUtc { get; set; }

    public List<MonthlyBadgeStatusItemDto> Items { get; set; } = new();
}

/// <summary>Rozet veren kullanıcının özet bilgisi (entry/profil popovers için).</summary>
public class BadgeGiverDto
{
    public Guid UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? Avatar { get; set; }
}

/// <summary>
/// <c>GET /api/Badges/entries/{entryId}</c> cevabı. Entry başına rozet sayıları,
/// verenler ve isteği yapan kullanıcının daha önce hangi rozetleri taktığı.
/// Frontend modalı entry'i açarken bu özet ile inisializasyon yapar;
/// entry card rozet ikonlarının popover'ı için de kullanılır.
/// </summary>
public class EntryBadgeSummaryDto
{
    public Guid EntryId { get; set; }

    /// <summary>Rozet türü → toplam adet.</summary>
    [JsonPropertyName("totalsByType")]
    public Dictionary<BadgeType, int> TotalsByType { get; set; } = new();

    /// <summary>Toplam rozet sayısı (tüm türler).</summary>
    public int TotalBadges { get; set; }

    /// <summary>İstek yapan kullanıcının bu entry'ye taktığı rozet türleri.</summary>
    public List<BadgeType> MyBadges { get; set; } = new();

    /// <summary>
    /// Rozet türü → o rozeti veren kullanıcıların listesi.
    /// Entry card popover'ında "Bu rozeti verenler" listesi için kullanılır.
    /// </summary>
    [JsonPropertyName("giversByType")]
    public Dictionary<BadgeType, List<BadgeGiverDto>> GiversByType { get; set; } = new();
}

/// <summary>Tek rozet türü grubu (profil sayfası rozet koleksiyonu için).</summary>
public class UserBadgeTypeGroupDto
{
    public BadgeType BadgeType { get; set; }
    public int Count { get; set; }
    public List<BadgeGiverDto> Givers { get; set; } = new();
}

/// <summary>
/// <c>GET /api/Badges/users/{userId}</c> cevabı.
/// Kullanıcının anonim olmayan entry'lerine takılmış tüm rozetlerin
/// tür bazında gruplanmış özeti. Profil sayfası "Rozet Koleksiyonu" için.
/// </summary>
public class UserBadgeCollectionDto
{
    public Guid UserId { get; set; }
    public int TotalBadges { get; set; }
    public List<UserBadgeTypeGroupDto> Groups { get; set; } = new();
}
