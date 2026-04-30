namespace TespitSozluk.API.DTOs;

/// <summary>Ayarlar sayfası — engellenen kullanıcı satırı.</summary>
public class BlockedUserListItemDto
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? Avatar { get; set; }
    public DateTime BlockedAtUtc { get; set; }
}

/// <summary>Ayarlar sayfası — engellenen başlık satırı.</summary>
public class BlockedTopicListItemDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public DateTime BlockedAtUtc { get; set; }
}
