namespace TespitSozluk.API.Entities;

public class PollOption
{
    public Guid Id { get; set; }

    public Guid PollId { get; set; }
    public Poll Poll { get; set; } = null!;

    /// <summary>Seçenek metni (maksimum 300 karakter; DbContext'te uygulanır).</summary>
    public string Text { get; set; } = string.Empty;

    /// <summary>Görüntüleme sırası. Küçük olan üstte gösterilir.</summary>
    public int SortOrder { get; set; }

    /// <summary>
    /// Bu seçeneği ekleyen kullanıcı. Anket sahibinin oluşturduğu orijinal seçenekler için null.
    /// AllowUserOptions açıkken diğer kullanıcıların eklediği seçeneklerde dolu olur.
    /// Kullanıcı silinirse seçenek korunur (SetNull).
    /// </summary>
    public Guid? CreatedByUserId { get; set; }

    public DateTime CreatedAt { get; set; }

    public ICollection<PollVote> Votes { get; set; } = new List<PollVote>();
}
