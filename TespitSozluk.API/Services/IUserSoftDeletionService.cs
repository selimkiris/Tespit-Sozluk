namespace TespitSozluk.API.Services;

/// <summary>
/// Akıllı kullanıcı silme: sosyal etkileşimler kalıcı silinir; kullanıcı ve entry'leri
/// yasal saklama için soft-delete (Admin ve self-delete ortak mantık).
/// </summary>
public interface IUserSoftDeletionService
{
    /// <returns>Kullanıcı yoksa false.</returns>
    Task<bool> SoftDeleteUserAsync(Guid userId, CancellationToken cancellationToken = default);
}
