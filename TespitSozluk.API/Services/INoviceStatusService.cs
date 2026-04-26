namespace TespitSozluk.API.Services;

public interface INoviceStatusService
{
    /// <summary>
    /// Verilen sayaç ve kullanıcı bilgisiyle çömezlik hesaplanır (profil yanıtı gibi tekil senaryolar için).
    /// </summary>
    bool IsNovice(
        string? userRole,
        Guid userId,
        DateTime userCreatedAt,
        int nonAnonymousEntryCount,
        int nonAnonymousTopicCount);

    /// <summary>
    /// Birden fazla yazar için tek geçişte hesap: kullanıcı satırları + entry/topic toplu sayımları.
    /// </summary>
    Task<Dictionary<Guid, bool>> GetIsNoviceMapAsync(
        IReadOnlyCollection<Guid> userIds,
        CancellationToken cancellationToken = default);
}
