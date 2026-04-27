namespace TespitSozluk.API.Entities;

/// <summary>Asenkron (istek/yanıt) özel mesaj. SignalR yok; sunucu üzerinde saklanır.</summary>
public class PrivateMessage
{
    public Guid Id { get; set; }
    public Guid SenderId { get; set; }
    public User? Sender { get; set; }
    public Guid RecipientId { get; set; }
    public User? Recipient { get; set; }

    /// <summary>Metin gövdesi. HTML yok; düz metin veya ileride sınırlı markdown.</summary>
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }

    /// <summary>Alıcı okuduğunda UTC zamanı; null = okunmadı.</summary>
    public DateTime? ReadAtUtc { get; set; }

    /// <summary>İsteğe bağlı: mesaj bu entryye atıf yapıyorsa (entry yazarı = <see cref="RecipientId" /> olmalı).</summary>
    public Guid? ReferencedEntryId { get; set; }
    public Entry? ReferencedEntry { get; set; }

    /// <summary>İsteğe bağlı: mesaj bu başlığa atıf yapıyorsa (başlık yazarı = alıcı).</summary>
    public Guid? ReferencedTopicId { get; set; }
    public Topic? ReferencedTopic { get; set; }
}
