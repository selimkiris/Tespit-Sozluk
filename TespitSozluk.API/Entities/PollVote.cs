namespace TespitSozluk.API.Entities;

/// <summary>
/// Bir kullanıcının bir anket seçeneğine verdiği oy. Anonim oylama için bu tablo
/// hiçbir public endpoint üzerinden user-option eşleşmesi sızdırmaz (yalnızca toplam
/// sayılar döner). Gizlilik servislerin içinde korunur.
///
/// Unique index: (PollOptionId, UserId) — aynı seçeneğe çifte oy engeli.
/// Tekil seçim (AllowMultiple=false) zorlaması PollService.CastVote içinde yapılır.
/// </summary>
public class PollVote
{
    public Guid Id { get; set; }

    public Guid PollId { get; set; }
    public Poll Poll { get; set; } = null!;

    public Guid PollOptionId { get; set; }
    public PollOption Option { get; set; } = null!;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public DateTime CreatedAt { get; set; }
}
