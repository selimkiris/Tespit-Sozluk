namespace TespitSozluk.API.DTOs;

public class NotificationResponseDto
{
    public Guid Id { get; set; }
    public Guid? EntryId { get; set; }
    /// <summary>Entry'nin bağlı olduğu başlık (mention vb. derin link için).</summary>
    public Guid? TopicId { get; set; }
    public Guid SenderId { get; set; }
    /// <summary>İşlemi yapan kullanıcı (SenderId ile aynı; istemci uyumluluğu için).</summary>
    public Guid ActorId { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
}
