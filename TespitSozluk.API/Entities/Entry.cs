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
}
