namespace TespitSozluk.API.Services;

/// <summary>
/// Engelleme (Block) altyapısı için servis sözleşmesi.
///
/// Tüm yazma işlemleri (Block/Unblock) tek bir DB transaction'ı içinde yürütülür;
/// ETKİLEŞİM TEMİZLİĞİ ile birlikte atomiktir — yarım engelleme durumu oluşmaz.
/// </summary>
public interface IBlockingService
{
    /// <summary>
    /// <paramref name="blockerId"/> kullanıcısı, <paramref name="blockedId"/> kullanıcısını engeller.
    /// Halihazırda engelliyse no-op (idempotent). İşlem sonunda iki taraf arasındaki
    /// tüm sosyal etkileşim verisi (oylar, takipler, rozetler, PM'ler, çiviler ve
    /// engellenenin başlıklarına olan takipler) kalıcı olarak temizlenir.
    /// </summary>
    /// <returns>
    ///  - <c>BlockOperationResult.Ok</c>: işlem başarılı (yeni veya zaten mevcut)
    ///  - <c>BlockOperationResult.SelfBlock</c>: kullanıcı kendini engellemeye çalıştı
    ///  - <c>BlockOperationResult.UserNotFound</c>: hedef kullanıcı yok / soft-deleted
    /// </returns>
    Task<BlockOperationResult> BlockUserAsync(
        Guid blockerId,
        Guid blockedId,
        CancellationToken cancellationToken = default);

    /// <summary>Engellemeyi kaldırır. Satır yoksa <c>NotFound</c> döner.</summary>
    Task<BlockOperationResult> UnblockUserAsync(
        Guid blockerId,
        Guid blockedId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// <paramref name="userId"/> kullanıcısı, <paramref name="topicId"/> başlığını gizler.
    /// Halihazırda engelliyse no-op. Mevcut başlık takibi (UserTopicFollow) aynı transaction
    /// içinde düşürülür.
    /// </summary>
    Task<BlockOperationResult> BlockTopicAsync(
        Guid userId,
        Guid topicId,
        CancellationToken cancellationToken = default);

    /// <summary>Başlık engellemesini kaldırır.</summary>
    Task<BlockOperationResult> UnblockTopicAsync(
        Guid userId,
        Guid topicId,
        CancellationToken cancellationToken = default);
}

public enum BlockOperationResult
{
    Ok = 0,
    SelfBlock = 1,
    UserNotFound = 2,
    TopicNotFound = 3,
    NotFound = 4
}
