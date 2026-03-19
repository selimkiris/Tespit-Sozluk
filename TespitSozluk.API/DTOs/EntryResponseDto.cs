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
    public string? AuthorAvatar { get; set; }
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
    /// <summary>Tam anonim modda true. Public API'lerde Author her zaman anonymize edilir.</summary>
    public bool IsAnonymous { get; set; }
    /// <summary>Yazarın rolü: "User" veya "Admin". IsAnonymous ise her zaman "User".</summary>
    public string AuthorRole { get; set; } = "User";
    /// <summary>İstek yapan kullanıcı bu entry'nin yazarı mı (düzenle/sil yetkisi)</summary>
    public bool CanManage { get; set; }
    /// <summary>Kaç kullanıcı bu entry'yi kaydetti</summary>
    public int SaveCount { get; set; }
    /// <summary>İstek yapan kullanıcı bu entry'yi kaydetmiş mi</summary>
    public bool IsSavedByCurrentUser { get; set; }
}
