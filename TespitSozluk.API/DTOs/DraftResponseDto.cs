namespace TespitSozluk.API.DTOs;

public class DraftResponseDto
{
    public Guid Id { get; set; }
    public Guid AuthorId { get; set; }
    public string Content { get; set; } = string.Empty;
    public Guid? TopicId { get; set; }
    public string? TopicTitle { get; set; }
    public string? NewTopicTitle { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    /// <summary>Yayınlandığında Tam Anonim olarak paylaşılacak</summary>
    public bool IsAnonymous { get; set; }

    /// <summary>
    /// Taslakta saklı anket (varsa). Frontend, taslak listesi/edit ekranında bu veriyi
    /// önizleme olarak göstermek ve PollComposer'a yüklemek için kullanır.
    /// </summary>
    public CreatePollDto? Poll { get; set; }
}
