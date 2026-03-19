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
}
