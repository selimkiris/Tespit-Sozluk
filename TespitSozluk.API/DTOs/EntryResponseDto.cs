namespace TespitSozluk.API.DTOs;

public class EntryResponseDto
{
    public Guid Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public int Upvotes { get; set; }
    public int Downvotes { get; set; }
    public Guid TopicId { get; set; }
    public string TopicTitle { get; set; } = string.Empty;
    public Guid AuthorId { get; set; }
    public string AuthorName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    /// <summary>
    /// Sadece veritabanında mevcut olan (bkz: xxx) başlıkları. Key: Topic Title, Value: Topic Id
    /// </summary>
    public Dictionary<string, Guid> ValidBkzs { get; set; } = new();
    /// <summary>
    /// 1: Upvote, -1: Downvote, 0: Yok
    /// </summary>
    public int UserVoteType { get; set; }
}
