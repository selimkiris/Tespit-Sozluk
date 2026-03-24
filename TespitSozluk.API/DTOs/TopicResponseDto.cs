namespace TespitSozluk.API.DTOs;

public class TopicResponseDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public Guid? AuthorId { get; set; }
    public string? AuthorName { get; set; }
    /// <summary>Görünen kullanıcı adı (nickname). Boşsa istemci AuthorName kullanabilir.</summary>
    public string? AuthorUsername { get; set; }
    /// <summary>Profil görseli URL veya emoji kısa avatar; anonim başlıkta null.</summary>
    public string? AuthorAvatar { get; set; }
    public string AuthorRole { get; set; } = "User";
    public DateTime CreatedAt { get; set; }
    public int EntryCount { get; set; }
    public bool IsFollowedByCurrentUser { get; set; }
    /// <summary>Anonim başlık veya yazar kaydı yok (silinmiş kullanıcı).</summary>
    public bool IsAnonymous { get; set; }
    /// <summary>Oturum açmış kullanıcı bu başlığın gerçek sahibi mi (anonim görünse bile).</summary>
    public bool IsTopicOwner { get; set; }
}
