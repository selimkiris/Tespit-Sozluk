namespace TespitSozluk.API.Entities;

/// <summary>
/// Bir kullanıcının belirli bir başlığı (Topic) gizlemesi (engellemesi).
///
/// İş kuralları:
/// - <c>UserId</c> + <c>TopicId</c> birlikte birincil anahtardır.
/// - Bir kullanıcı engellediği başlığa ait entry'leri, başlık listelerini ve takipleri
///   (<see cref="UserTopicFollow"/>) anasayfasında, keşfette veya başlık görünümünde
///   GÖREMEZ (<see cref="Filters.BlockFilterExtensions"/> üzerinden uygulanır).
/// - Engelleme yazıldığı an mevcut başlık takibi (<see cref="UserTopicFollow"/>) düşürülür.
/// - Cascade: hem User hem Topic için Cascade — başlık veya kullanıcı silinince satır gider.
/// </summary>
public class TopicBlock
{
    /// <summary>Başlığı gizleyen kullanıcı.</summary>
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    /// <summary>Gizlenen başlık.</summary>
    public Guid TopicId { get; set; }
    public Topic Topic { get; set; } = null!;

    /// <summary>UTC oluşturma zamanı; "Engellenen başlıklar" listesinde sıralama için.</summary>
    public DateTime CreatedAt { get; set; }
}
