namespace TespitSozluk.API.DTOs;

/// <summary>
/// Email sadece kendi profiline bakan kullanıcıya dönülür.
/// </summary>
public class UserProfileResponseDto
{
    public Guid Id { get; set; }
    public string Nickname { get; set; } = string.Empty;
    public int TotalEntryCount { get; set; }
    public string? Email { get; set; }
}
