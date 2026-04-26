namespace TespitSozluk.API.Entities;

/// <summary>
/// Bir entry'ye iliştirilebilen opsiyonel anket. 1-1 ilişki (PollOwnership): her entry
/// en fazla bir ankete sahip olabilir. Entry silindiğinde ilgili Poll (ve alt tüm
/// PollOption/PollVote kayıtları) cascade olarak silinir.
/// </summary>
public class Poll
{
    public Guid Id { get; set; }

    /// <summary>Hangi entry'ye ait (unique — her entry en fazla 1 anket).</summary>
    public Guid EntryId { get; set; }
    public Entry Entry { get; set; } = null!;

    /// <summary>Anket sorusu / başlığı. Opsiyoneldir (boş bırakılabilir).</summary>
    public string? Question { get; set; }

    /// <summary>Kullanıcı birden fazla seçeneği işaretleyebilir mi? Varsayılan: false.</summary>
    public bool AllowMultiple { get; set; }

    /// <summary>Başka kullanıcılar yeni seçenek ekleyebilir mi? Varsayılan: false.</summary>
    public bool AllowUserOptions { get; set; }

    public DateTime CreatedAt { get; set; }

    public ICollection<PollOption> Options { get; set; } = new List<PollOption>();
    public ICollection<PollVote> Votes { get; set; } = new List<PollVote>();
}
