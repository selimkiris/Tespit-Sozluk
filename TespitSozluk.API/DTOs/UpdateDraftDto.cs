namespace TespitSozluk.API.DTOs;

public class UpdateDraftDto
{
    public Guid? TopicId { get; set; }
    public string? NewTopicTitle { get; set; }
    public string Content { get; set; } = string.Empty;
    /// <summary>Yayınlandığında Tam Anonim olarak paylaşılacak (varsayılan: false)</summary>
    public bool IsAnonymous { get; set; }
}
