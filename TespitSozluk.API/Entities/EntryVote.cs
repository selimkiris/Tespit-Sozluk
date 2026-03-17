namespace TespitSozluk.API.Entities;

public class EntryVote
{
    public Guid Id { get; set; }
    public Guid EntryId { get; set; }
    public Entry Entry { get; set; } = null!;
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public bool IsUpvote { get; set; }
}
