namespace TespitSozluk.API.DTOs;

public class UserFollowListItemDto
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? Avatar { get; set; }
}
