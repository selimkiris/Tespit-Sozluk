namespace TespitSozluk.API.DTOs;

/// <summary>
/// Email sadece kendi profiline bakan kullanıcıya dönülür.
/// </summary>
public class UserProfileResponseDto
{
    public Guid Id { get; set; }
    public string Nickname { get; set; } = string.Empty;
    public string? Avatar { get; set; }
    public bool HasChangedUsername { get; set; }
    public string? Bio { get; set; }
    public DateTime CreatedAt { get; set; }
    public int TotalEntryCount { get; set; }
    /// <summary>Kullanıcının açtığı toplam başlık sayısı (anonim olmayan).</summary>
    public int TotalTopicCount { get; set; }

    /// <summary>Kayıt süresi, anonim olmayan entry ve başlık sayılarına göre hesaplanan seviye adı.</summary>
    public string LevelName { get; set; } = string.Empty;
    public int TotalUpvotesReceived { get; set; }
    public int TotalDownvotesReceived { get; set; }
    public int TotalSavesReceived { get; set; }
    public string? Email { get; set; }
    public int FollowerCount { get; set; }
    public int FollowingCount { get; set; }
    public bool IsFollowedByCurrentUser { get; set; }
    /// <summary>Yazdığı entry sayısı</summary>
    public int WrittenEntriesCount { get; set; }
    /// <summary>Kaydettiği entry sayısı</summary>
    public int SavedEntriesCount { get; set; }
    /// <summary>Upvote attığı (beğendiği) entry sayısı</summary>
    public int LikedEntriesCount { get; set; }
    /// <summary>Taslak sayısı</summary>
    public int DraftsCount { get; set; }

    /// <summary>Anonim olmayan entry'lerde alınan toplam rozet (rozet satırı sayısı).</summary>
    public int BadgesReceivedNonAnonymousCount { get; set; }

    /// <summary>Tüm entry'lerde (anonim dahil) alınan toplam rozet — profil özeti / anonim filtresi metni için.</summary>
    public int BadgesReceivedTotalCount { get; set; }

    /// <summary>Verilen rozet ataması sayısı (<c>EntryBadges</c> satırı).</summary>
    public int BadgesGivenTotalCount { get; set; }

    /// <summary>Profil sahibi çömez (novice) statüsünde mi (20 gün + 20 entry + 3 başlık şartları).</summary>
    public bool IsNovice { get; set; }

    /// <summary>
    /// İstemcinin profil sahibiyle olan engelleme ilişkisi. Üç değerden biri:
    /// <list type="bullet">
    ///   <item><c>"None"</c> — engel yok, tüm profil verisi döner.</item>
    ///   <item><c>"BlockedByMe"</c> — istemci profili engellemiş; yalnızca <see cref="Id"/> ve <see cref="Nickname"/> doludur.</item>
    ///   <item><c>"BlockedByThem"</c> — profil sahibi istemciyi engellemiş; yalnızca <see cref="Id"/> ve <see cref="Nickname"/> doludur.</item>
    /// </list>
    /// İki yönlü engelleme varsa <c>"BlockedByMe"</c> tercih edilir (kullanıcının kaldırma yetkisi vardır).
    /// </summary>
    public string BlockStatus { get; set; } = "None";
}
