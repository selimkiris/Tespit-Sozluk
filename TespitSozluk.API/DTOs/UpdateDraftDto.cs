namespace TespitSozluk.API.DTOs;

public class UpdateDraftDto
{
    public Guid? TopicId { get; set; }
    public string? NewTopicTitle { get; set; }
    public string Content { get; set; } = string.Empty;
    /// <summary>Yayınlandığında Tam Anonim olarak paylaşılacak (varsayılan: false)</summary>
    public bool IsAnonymous { get; set; }

    /// <summary>
    /// Anket: Null ise mevcut anket korunur (RemovePoll=false iken) veya kaldırılır (true iken).
    /// Doluysa mevcut anket bu değerle tamamen değiştirilir.
    /// </summary>
    public CreatePollDto? Poll { get; set; }

    /// <summary>True ise taslaktan anket bilgisi kaldırılır. Poll doluysa görmezden gelinir.</summary>
    public bool RemovePoll { get; set; }
}
