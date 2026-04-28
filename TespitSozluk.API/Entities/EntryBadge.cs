namespace TespitSozluk.API.Entities;

/// <summary>
/// Bir kullanıcının (Giver) başkasının entry'sine taktığı rozet kaydı.
/// Tek satır tek "rozet takma" olayını temsil eder; geri alma kaydı silmek demektir.
///
/// İş kuralları (BadgesController içinde uygulanır):
/// - Kullanıcı kendi entry'sine rozet takamaz.
/// - Aynı kullanıcı bir entry'ye, aynı türden yalnızca 1 adet rozet takabilir
///   (UQ index: <c>EntryId, GiverUserId, BadgeType</c>).
/// - Her yazar AYLIK olarak her bir rozet türünden yalnızca 1 adet kullanabilir
///   (devretmez); bu kural ayrı bir envanter tablosu yerine
///   <c>(GiverUserId, BadgeType, AssignedAt &gt;= ayBaşı)</c> sorgusuyla doğrulanır.
/// - Takılan rozet yalnızca ilk 15 dakika içinde geri alınabilir; süre geçtikten
///   sonra silme istekleri 403 ile reddedilir.
/// </summary>
public class EntryBadge
{
    public Guid Id { get; set; }

    /// <summary>Rozetin takıldığı entry. Entry silinirse cascade ile temizlenir.</summary>
    public Guid EntryId { get; set; }
    public Entry Entry { get; set; } = null!;

    /// <summary>Rozeti TAKAN kullanıcı (entry sahibinden farklı olmak zorunda). Hesap silinirse cascade.</summary>
    public Guid GiverUserId { get; set; }
    public User Giver { get; set; } = null!;

    public BadgeType BadgeType { get; set; }

    /// <summary>UTC. Aylık kota ve 15 dakikalık geri alma penceresi bu zamandan hesaplanır.</summary>
    public DateTime AssignedAt { get; set; }
}
