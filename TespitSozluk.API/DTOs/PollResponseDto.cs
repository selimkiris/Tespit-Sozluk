namespace TespitSozluk.API.DTOs;

public class PollResponseDto
{
    public Guid Id { get; set; }
    public string? Question { get; set; }
    public bool AllowMultiple { get; set; }
    public bool AllowUserOptions { get; set; }

    public List<PollOptionResponseDto> Options { get; set; } = new();

    /// <summary>İstek yapan kullanıcı bu ankette oy kullandı mı?</summary>
    public bool HasVoted { get; set; }

    /// <summary>
    /// Toplam oy kullanan kişi sayısı. Oy vermeyen kullanıcıya hiç rakam sızdırmamak için
    /// `HasVoted == false` iken null döner.
    /// </summary>
    public int? TotalVotes { get; set; }

    /// <summary>
    /// Ankete sahip entry'nin yazarının Id'si — ön yüzde "yeni seçenek ekleme" alanını
    /// entry sahibine göstermek gibi UX kararlarında kullanılabilir. Anket sahibi her
    /// zaman entry yazarıdır; entry anonimse ön yüze Guid.Empty maskelenmiş halde gider.
    /// </summary>
    public Guid OwnerId { get; set; }
}
