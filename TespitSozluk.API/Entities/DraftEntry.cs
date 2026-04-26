namespace TespitSozluk.API.Entities;

public class DraftEntry
{
    public Guid Id { get; set; }
    public Guid AuthorId { get; set; }
    public User Author { get; set; } = null!;
    public string Content { get; set; } = string.Empty;
    public Guid? TopicId { get; set; }
    public Topic? Topic { get; set; }
    public string? NewTopicTitle { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    /// <summary>Yayınlandığında Tam Anonim olarak paylaşılacak.</summary>
    public bool IsAnonymous { get; set; }

    /// <summary>
    /// Anket taslağı için JSON serileştirilmiş `CreatePollDto` payload'ı.
    /// PostgreSQL'de `jsonb` kolonu olarak saklanır; null ise anket yok.
    ///
    /// Bu kolonun jsonb seçilmesinin sebebi:
    ///  - Esnek şema (yeni anket alanı eklemek migration gerektirmez),
    ///  - Anket verisi sadece taslak ömrü boyunca saklanır; ilişkisel sorgulamaya gerek yok,
    ///  - Yayınlamada PollService bu JSON'u CreatePollDto'ya parse edip ilişkisel
    ///    Poll/PollOption tablolarına işler.
    /// </summary>
    public string? PollData { get; set; }
}
