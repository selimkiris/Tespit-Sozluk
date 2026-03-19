namespace TespitSozluk.API.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    /// <summary>Benzersiz görünen ad (Nickname). Kullanıcı adı değişikliğinde güncellenir.</summary>
    public string Username { get; set; } = string.Empty;
    /// <summary>Hakkımda metni. Maksimum 500 karakter.</summary>
    public string? Bio { get; set; }
    /// <summary>Emoji veya kısa string avatar.</summary>
    public string? Avatar { get; set; }
    /// <summary>Kullanıcı adı bir kez değiştirildi mi?</summary>
    public bool HasChangedUsername { get; set; } = false;
    /// <summary>Kullanıcı rolü: "User" (varsayılan) veya "Admin".</summary>
    public string Role { get; set; } = "User";
    public DateTime CreatedAt { get; set; }
    public ICollection<Topic> Topics { get; set; } = new List<Topic>();
    public ICollection<Entry> Entries { get; set; } = new List<Entry>();
}
