namespace TespitSozluk.API.Entities;

public class UserTopicFollow
{
    public Guid UserId { get; set; }
    public Guid TopicId { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
    public Topic Topic { get; set; } = null!;
}
