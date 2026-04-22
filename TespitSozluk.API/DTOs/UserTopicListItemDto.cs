namespace TespitSozluk.API.DTOs;

/// <summary>
/// Kullanıcı profilinde "açtığı başlıklar" sekmesi için özet satır.
/// Alfabetik sıralama için <see cref="Title"/> kullanılır.
/// </summary>
public class UserTopicListItemDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    /// <summary>SEO dostu URL parçası; linklemede kullanılır.</summary>
    public string Slug { get; set; } = string.Empty;
    /// <summary>Bu başlığa ait toplam entry sayısı.</summary>
    public int EntryCount { get; set; }
    /// <summary>Bu başlığı takip eden kullanıcı sayısı.</summary>
    public int FollowerCount { get; set; }
    /// <summary>Anonim açılmış başlıklar için true (yalnızca sahip görebilir).</summary>
    public bool IsAnonymous { get; set; }
    public DateTime CreatedAt { get; set; }
}
