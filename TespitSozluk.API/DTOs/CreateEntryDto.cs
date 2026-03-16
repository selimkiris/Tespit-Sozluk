namespace TespitSozluk.API.DTOs;

public class CreateEntryDto
{
    public Guid TopicId { get; set; }
    public string Content { get; set; } = string.Empty;
}
