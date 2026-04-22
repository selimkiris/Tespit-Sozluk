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
    /// <summary>Kullanıcının açtığı toplam başlık sayısı (AuthorId eşleşmesi, anonim dahil).</summary>
    public int TotalTopicCount { get; set; }
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
}
