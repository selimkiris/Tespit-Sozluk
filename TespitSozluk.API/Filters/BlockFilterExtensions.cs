using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;
using TespitSozluk.API.Entities;

namespace TespitSozluk.API.Filters;

/// <summary>
/// İki kullanıcı arasındaki yönlü engelleme ilişkisi. Profil sayfasında
/// "Bu kişiyi engellediniz." vs "Bu kişi sizi engelledi." ayrımı için kullanılır.
/// </summary>
public enum BlockRelationship
{
    /// <summary>Hiçbir yönde engelleme yok.</summary>
    None = 0,
    /// <summary>Aktif kullanıcı diğerini engellemiş (kaldırma yetkisi kendisinde).</summary>
    BlockedByMe = 1,
    /// <summary>Diğer taraf aktif kullanıcıyı engellemiş.</summary>
    BlockedByThem = 2,
}

/// <summary>
/// Engelleme (UserBlock + TopicBlock) için okuma tarafı filtre yardımcıları.
///
/// MİMARİ KARAR — Neden Global Query Filter değil?
/// 1) Mevcut Soft-Delete altyapısı zaten <see cref="Entities.User.IsDeleted"/> ve
///    <see cref="Entities.Entry.IsDeleted"/> üzerinde Global Query Filter kullanıyor.
///    İkinci bir kullanıcı-bağımlı filtre eklemek, <see cref="Services.UserSoftDeletionService"/>,
///    <see cref="Services.EntryDeletionService"/> ve <see cref="Services.DataRetentionCleanupService"/>
///    içindeki "topic pruning" sayımlarının yanlış sonuç vermesine yol açardı (admin'in kendi
///    engel listesi temizleme akışına sızabilirdi). Bu, kusursuz çalışan mevcut servisleri bozardı.
/// 2) Topic için "engellenen kişi başlığı açtı, ama altında başkalarının entry'si var" kuralı
///    iki tabloyu çapraz sorgulayan bir koşuldur; Global Filter ile temiz yazılması zordur.
///
/// SEÇİLEN YAKLAŞIM — Service-katmanı IQueryable Extension metotları:
/// - <see cref="ApplyBlockFilter(IQueryable{Entry}, AppDbContext, Guid?)"/> ve
///   <see cref="ApplyBlockFilter(IQueryable{Topic}, AppDbContext, Guid?)"/> ile
///   filtreyi yalnızca son-kullanıcıya servis edilen sorgulara koyarız.
/// - SQL'e EXISTS / NOT EXISTS korelasyonlu alt sorgu olarak çevrilir; UserBlocks
///   tablosunda (BlockerId, BlockedId) PK ve BlockedId üzerine ek index ile O(log n)
///   tarama yapılır.
/// - Anonim (oturumsuz) isteklerde sorgu hiç dokunulmadan döner — performans sıfır.
/// - Her endpoint kendi yapısı için filtreyi kontrollü ekler; mevcut servislere
///   yan etki sıfırdır.
/// </summary>
public static class BlockFilterExtensions
{
    /// <summary>
    /// Entry sorgusuna engelleme filtresini uygular: oturum açmış kullanıcının
    /// karşılıklı engelli olduğu kullanıcıların entry'leri ve engellediği başlıklara
    /// ait entry'ler döndürülen sonuçtan çıkarılır.
    /// </summary>
    public static IQueryable<Entry> ApplyBlockFilter(
        this IQueryable<Entry> query,
        AppDbContext context,
        Guid? currentUserId)
    {
        if (!currentUserId.HasValue)
        {
            return query;
        }

        var uid = currentUserId.Value;

        return query.Where(e =>
            !context.UserBlocks.Any(b =>
                (b.BlockerId == uid && b.BlockedId == e.AuthorId) ||
                (b.BlockerId == e.AuthorId && b.BlockedId == uid))
            && !context.TopicBlocks.Any(tb =>
                tb.UserId == uid && tb.TopicId == e.TopicId));
    }

    /// <summary>
    /// Topic sorgusuna engelleme filtresini uygular:
    ///  - Kullanıcının engellediği başlıklar gizlenir.
    ///  - Yazarı karşılıklı engelli olan başlıklar, ALTINDA başka yazarların görünür
    ///    entry'si yoksa gizlenir; entry varsa başlık listelenir (içeride engellenen
    ///    yazarın entry'leri <see cref="ApplyBlockFilter(IQueryable{Entry}, AppDbContext, Guid?)"/>
    ///    ile süzülür).
    /// </summary>
    public static IQueryable<Topic> ApplyBlockFilter(
        this IQueryable<Topic> query,
        AppDbContext context,
        Guid? currentUserId)
    {
        if (!currentUserId.HasValue)
        {
            return query;
        }

        var uid = currentUserId.Value;

        return query.Where(t =>
            // 1) Doğrudan engellenen başlıklar elenir.
            !context.TopicBlocks.Any(tb => tb.UserId == uid && tb.TopicId == t.Id)
            // 2) Karşılıklı engelli kullanıcının açtığı başlıklarda yalnızca onun entry'si
            //    varsa başlık listeden çıkar; başkasının da görünür entry'si varsa kalır.
            //    "Görünür entry": IsDeleted=false ve yazarı karşılıklı engelli değil.
            && context.Entries.Any(e =>
                e.TopicId == t.Id
                && !e.IsDeleted
                && !context.UserBlocks.Any(b =>
                    (b.BlockerId == uid && b.BlockedId == e.AuthorId) ||
                    (b.BlockerId == e.AuthorId && b.BlockedId == uid))));
    }

    /// <summary>
    /// İki kullanıcı arasında herhangi bir yönde engelleme var mı?
    /// Profil gizliliği gibi salt bilgi sızdırmama gerektiren noktalarda kullanılır.
    /// </summary>
    public static Task<bool> AreEitherBlockedAsync(
        this AppDbContext context,
        Guid a,
        Guid b,
        CancellationToken cancellationToken = default)
    {
        if (a == b)
        {
            return Task.FromResult(false);
        }

        return context.UserBlocks
            .AsNoTracking()
            .AnyAsync(x =>
                (x.BlockerId == a && x.BlockedId == b) ||
                (x.BlockerId == b && x.BlockedId == a),
                cancellationToken);
    }

    /// <summary>
    /// Aktif kullanıcı (<paramref name="me"/>) ile başka bir kullanıcı (<paramref name="other"/>)
    /// arasındaki yönlü engelleme ilişkisini döndürür. Profil görüntüleme akışında
    /// "Bu kişiyi engellediniz" / "Bu kişi sizi engelledi" ayrımı için kullanılır.
    ///
    /// Karşılıklı engelleme (her iki yön de) durumunda <see cref="BlockRelationship.BlockedByMe"/>
    /// tercih edilir; çünkü kullanıcı kendi engellemesini kaldırabilir, karşı tarafınkine
    /// müdahale edemez. Her iki yön için tek bir SQL sorgusu (max 2 satır) çalıştırılır.
    /// </summary>
    public static async Task<BlockRelationship> GetBlockRelationshipAsync(
        this AppDbContext context,
        Guid me,
        Guid other,
        CancellationToken cancellationToken = default)
    {
        if (me == other)
        {
            return BlockRelationship.None;
        }

        var rows = await context.UserBlocks
            .AsNoTracking()
            .Where(x =>
                (x.BlockerId == me && x.BlockedId == other) ||
                (x.BlockerId == other && x.BlockedId == me))
            .Select(x => x.BlockerId)
            .ToListAsync(cancellationToken);

        if (rows.Count == 0)
        {
            return BlockRelationship.None;
        }

        if (rows.Contains(me))
        {
            return BlockRelationship.BlockedByMe;
        }

        return BlockRelationship.BlockedByThem;
    }
}
