namespace TespitSozluk.API.DTOs;

public class UserSearchResultDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    /// <summary>Benzersiz görünen kullanıcı adı (nickname).</summary>
    public string? Username { get; set; }
    public string? Avatar { get; set; }
}
