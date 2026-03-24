namespace TespitSozluk.API.DTOs;

/// <summary>@mention canlı araması için minimal kullanıcı bilgisi.</summary>
public class UserMentionSearchItemDto
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? Avatar { get; set; }
}
