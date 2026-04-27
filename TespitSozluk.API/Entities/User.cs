namespace TespitSozluk.API.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? PasswordResetToken { get; set; }
    public DateTime? PasswordResetTokenExpires { get; set; }
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

    /// <summary>Özel mesaj gelen kutusu kuralı. Varsayılan: herkes.</summary>
    public MessagingInboxMode MessagingInboxMode { get; set; } = MessagingInboxMode.Everyone;

    /// <summary>
    /// <see cref="MessagingInboxMode.MinimumLevel"/> seçildiğinde: kabul edilen asgari
    /// seviye indeksi 0–10 (UserLevelHelper ile aynı ölçek). Diğer modlarda yok sayılır.
    /// </summary>
    public byte? MessagingMinLevelThreshold { get; set; }

    public ICollection<Topic> Topics { get; set; } = new List<Topic>();
    public ICollection<Entry> Entries { get; set; } = new List<Entry>();
}
