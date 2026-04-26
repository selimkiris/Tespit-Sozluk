namespace TespitSozluk.API.DTOs;

public class PollOptionResponseDto
{
    public Guid Id { get; set; }
    public string Text { get; set; } = string.Empty;

    /// <summary>Seçenek, anket sahibi değil de başka bir kullanıcı tarafından mı eklendi?</summary>
    public bool IsUserAdded { get; set; }

    /// <summary>İstek yapan kullanıcı bu seçeneğe oy verdi mi (anonim; yalnızca kendi için).</summary>
    public bool IsVotedByCurrentUser { get; set; }

    /// <summary>
    /// Bu seçeneğe düşen toplam oy sayısı. GİZLİLİK KRİTİK:
    /// İstek yapan kullanıcı ankette henüz oy kullanmadıysa `null` döner —
    /// ön yüz böylece yüzde/bar göstermez.
    /// </summary>
    public int? VoteCount { get; set; }

    /// <summary>Toplam içindeki yüzdelik pay (0–100). Kullanıcı oy vermediyse `null`.</summary>
    public double? Percent { get; set; }
}
