namespace TespitSozluk.API.Entities;

/// <summary>
/// Bir kullanıcının (Blocker) başka bir kullanıcıyı (Blocked) engellemesi.
///
/// İş kuralları:
/// - <c>BlockerId</c> + <c>BlockedId</c> birlikte birincil anahtardır (aynı çiftin
///   ikinci kez eklenmesi imkânsızdır).
/// - Bir kullanıcı kendini engelleyemez (<see cref="Controllers.BlocksController"/> doğrular).
/// - Engelleme satırı yazıldığı anda, iki taraf arasındaki tüm etkileşim verileri
///   (<see cref="EntryVote"/>, <see cref="UserFollow"/>, <see cref="EntryBadge"/>,
///   <see cref="PrivateMessage"/>, <see cref="UserSavedEntry"/>, engellenenin başlıklarına
///   ait <see cref="UserTopicFollow"/>) kalıcı olarak temizlenir
///   (<see cref="Services.IBlockingService"/>).
/// - Cascade davranışı: <c>Blocker</c> kullanıcısı silindiğinde satır cascade ile gider;
///   <c>Blocked</c> tarafı için Restrict — engellenen taraf silinmeden önce ilgili satırlar
///   <see cref="Services.IUserSoftDeletionService"/> tarafından el ile temizlenir
///   (PostgreSQL'in çoklu cascade-yolu hatasından kaçınmak için).
/// </summary>
public class UserBlock
{
    /// <summary>Engelleyen kullanıcı.</summary>
    public Guid BlockerId { get; set; }
    public User Blocker { get; set; } = null!;

    /// <summary>Engellenen kullanıcı.</summary>
    public Guid BlockedId { get; set; }
    public User Blocked { get; set; } = null!;

    /// <summary>UTC oluşturma zamanı; "Engellediklerim" listesinde sıralama için.</summary>
    public DateTime CreatedAt { get; set; }
}
