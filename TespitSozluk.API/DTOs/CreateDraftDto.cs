namespace TespitSozluk.API.DTOs;

public class CreateDraftDto
{
    /// <summary>
    /// Mevcut başlığın ID'si. TopicId veya NewTopicTitle'dan biri dolu olmalı.
    /// </summary>
    public Guid? TopicId { get; set; }

    /// <summary>
    /// Yeni açılacak başlığın adı. TopicId null ise bu kullanılır.
    /// </summary>
    public string? NewTopicTitle { get; set; }

    public string Content { get; set; } = string.Empty;
    /// <summary>Yayınlandığında Tam Anonim olarak paylaşılacak (varsayılan: false)</summary>
    public bool IsAnonymous { get; set; }

    /// <summary>
    /// Opsiyonel anket taslağı. Null ise anket yok. Taslakta yarım anket de saklanabilir
    /// (örn: Question boş, 1 seçenek). Yayın anında PollService doğrulamayı yapar.
    /// </summary>
    public CreatePollDto? Poll { get; set; }
}
