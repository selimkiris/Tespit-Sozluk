using TespitSozluk.API.DTOs;

namespace TespitSozluk.API.Services;

/// <summary>
/// Alfabetik başlık listesi (<c>GET api/Topics/alphabetical</c>) için Redis önbelleği.
/// Redis kullanılamazsa sessizce baypas edilir; çağıran kod veritabanından üretmeye devam eder.
/// </summary>
public interface IAlphabeticalTopicsCache
{
    Task<PagedTopicsDto?> TryGetAsync(int page, int pageSize, Guid? userId, CancellationToken cancellationToken = default);

    Task TrySetAsync(int page, int pageSize, Guid? userId, PagedTopicsDto dto, CancellationToken cancellationToken = default);
}
