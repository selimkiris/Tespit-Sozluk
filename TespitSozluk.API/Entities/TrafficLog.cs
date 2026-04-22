namespace TespitSozluk.API.Entities;

public class TrafficLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>İstek sahibinin IP adresi.</summary>
    public string IpAddress { get; set; } = string.Empty;

    /// <summary>İstek sahibinin kaynak portu (varsa).</summary>
    public string? Port { get; set; }

    /// <summary>İstenen tam URL yolu.</summary>
    public string RequestedUrl { get; set; } = string.Empty;

    /// <summary>HTTP metodu (GET, POST, PUT, DELETE vb.).</summary>
    public string HttpMethod { get; set; } = string.Empty;

    /// <summary>İsteğin UTC zaman damgası. 5651 sayılı Kanun gereği saklanır.</summary>
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;

    /// <summary>Giriş yapmış kullanıcının ID'si; anonim isteklerde null.</summary>
    public Guid? UserId { get; set; }

    /// <summary>
    /// İstek anındaki kullanıcı adının anlık görüntüsü.
    /// Kullanıcı silinse veya adını değiştirse bile kim olduğu bilinebilir.
    /// </summary>
    public string? UsernameSnapshot { get; set; }

    /// <summary>Navigation property — isteğe bağlı; kullanıcı silinince null kalır.</summary>
    public User? User { get; set; }
}
