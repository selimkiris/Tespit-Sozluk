namespace TespitSozluk.API.Entities;

public class Entry
{
    public Guid Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public int Upvotes { get; set; }
    public int Downvotes { get; set; }
    public Guid TopicId { get; set; }
    public Topic Topic { get; set; } = null!;
    public Guid AuthorId { get; set; }
    public User Author { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    /// <summary>Tam anonim modda yazar bilgisi gösterilmez.</summary>
    public bool IsAnonymous { get; set; }

    /// <summary>Yazar uçurulduğunda içerik yasal saklama için gizlenir; süre dolunca kalıcı silinir.</summary>
    public bool IsDeleted { get; set; } = false;

    /// <summary>Yazar uçurulduğunda işaretlenir (UTC).</summary>
    public DateTime? DeletedAtUtc { get; set; }

    /// <summary>
    /// Opsiyonel anket. Mevcut entry akışı anketsiz şekilde çalışmaya devam eder;
    /// yalnızca ankete sahip entry'lerde dolu olur. Entry silindiğinde cascade ile temizlenir.
    /// </summary>
    public Poll? Poll { get; set; }
}
