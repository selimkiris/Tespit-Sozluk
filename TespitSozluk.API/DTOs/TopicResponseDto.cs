namespace TespitSozluk.API.DTOs;

public class TopicResponseDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public Guid? AuthorId { get; set; }
    public string? AuthorName { get; set; }
    public string AuthorRole { get; set; } = "User";
    public DateTime CreatedAt { get; set; }
    public int EntryCount { get; set; }
    public bool IsFollowedByCurrentUser { get; set; }
}
