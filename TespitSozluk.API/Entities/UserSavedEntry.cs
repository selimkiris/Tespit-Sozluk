namespace TespitSozluk.API.Entities;

public class UserSavedEntry
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid EntryId { get; set; }
    public Entry Entry { get; set; } = null!;
    public DateTime SavedAt { get; set; }
}
