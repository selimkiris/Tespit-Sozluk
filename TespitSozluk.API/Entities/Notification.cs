namespace TespitSozluk.API.Entities;

public class Notification
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid SenderId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>Like / Dislike / Save gibi entry-odaklı bildirimlerde yönlendirme için.</summary>
    public Guid? EntryId { get; set; }
    public Entry? Entry { get; set; }

    public User User { get; set; } = null!;
    public User Sender { get; set; } = null!;
}
