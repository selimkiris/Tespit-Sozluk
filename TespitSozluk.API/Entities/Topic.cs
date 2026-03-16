namespace TespitSozluk.API.Entities;

public class Topic
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public Guid AuthorId { get; set; }
    public User Author { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public ICollection<Entry> Entries { get; set; } = new List<Entry>();
}
