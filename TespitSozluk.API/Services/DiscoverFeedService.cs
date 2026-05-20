using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using TespitSozluk.API.Data;
using TespitSozluk.API.Entities;

namespace TespitSozluk.API.Services;

public sealed record DiscoverFeedEntry(
    Guid Id,
    string Content,
    int Upvotes,
    int Downvotes,
    Guid TopicId,
    string TopicTitle,
    Guid AuthorId,
    string AuthorName,
    string? AuthorAvatar,
    string AuthorRole,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    bool IsAnonymous);

public sealed record DiscoverFeedPageResult(
    IReadOnlyList<DiscoverFeedEntry> Entries,
    int TotalCount,
    int EffectivePageSize);

public interface IDiscoverFeedService
{
    Task<DiscoverFeedPageResult> GetPageAsync(
        AppDbContext context,
        Guid? userId,
        string sessionKey,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
}

public sealed class DiscoverFeedService : IDiscoverFeedService
{
    public const string PoolCacheKey = "tespitsozluk:discover:pool";

    private const int PoolSize = 500;
    private const int ExcludeRecentCount = 15;
    private static readonly TimeSpan PoolCacheDuration = TimeSpan.FromMinutes(15);

    private readonly IMemoryCache _cache;
    private readonly ILogger<DiscoverFeedService> _logger;

    public DiscoverFeedService(IMemoryCache cache, ILogger<DiscoverFeedService> logger)
    {
        _cache = cache;
        _logger = logger;
    }

    public async Task<DiscoverFeedPageResult> GetPageAsync(
        AppDbContext context,
        Guid? userId,
        string sessionKey,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var discoverTake = Math.Min(20, Math.Max(10, pageSize));

        List<DiscoverFeedEntry> pool;
        try
        {
            pool = await GetOrCreateCachedPoolAsync(context, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Keşfet önbelleği kullanılamadı; veritabanı yedek yolu devreye alınıyor.");
            pool = await LoadPoolFromDatabaseAsync(context, cancellationToken);
        }

        var visible = await FilterBlockedAsync(context, pool, userId, cancellationToken);
        var ordered = GetOrCreateSessionOrder(visible, sessionKey, reshuffle: page == 1);

        var totalCount = ordered.Count;
        var entries = ordered
            .Skip(discoverTake * (page - 1))
            .Take(discoverTake)
            .ToList();

        return new DiscoverFeedPageResult(entries, totalCount, discoverTake);
    }

    private static string SessionCacheKey(string sessionKey) =>
        $"tespitsozluk:discover:session:{sessionKey}";

    /// <summary>
    /// Oturum bazlı karıştırılmış liste. page=1'de yeniden karıştırılır; page&gt;1 aynı sırayı kullanır.
    /// </summary>
    private List<DiscoverFeedEntry> GetOrCreateSessionOrder(
        List<DiscoverFeedEntry> visible,
        string sessionKey,
        bool reshuffle)
    {
        var cacheKey = SessionCacheKey(sessionKey);

        if (!reshuffle
            && _cache.TryGetValue(cacheKey, out List<DiscoverFeedEntry>? existing)
            && existing is { Count: > 0 })
        {
            return existing;
        }

        var shuffled = visible.OrderBy(_ => Guid.NewGuid()).ToList();
        _cache.Set(cacheKey, shuffled, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = PoolCacheDuration
        });
        return shuffled;
    }

    private async Task<List<DiscoverFeedEntry>> GetOrCreateCachedPoolAsync(
        AppDbContext context,
        CancellationToken cancellationToken)
    {
        if (_cache.TryGetValue(PoolCacheKey, out List<DiscoverFeedEntry>? cached) && cached != null)
        {
            return cached;
        }

        return await _cache.GetOrCreateAsync(PoolCacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = PoolCacheDuration;
            return await LoadPoolFromDatabaseAsync(context, cancellationToken);
        }) ?? [];
    }

    private static async Task<List<DiscoverFeedEntry>> LoadPoolFromDatabaseAsync(
        AppDbContext context,
        CancellationToken cancellationToken)
    {
        var last15Ids = await context.Entries
            .AsNoTracking()
            .OrderByDescending(e => e.CreatedAt)
            .Take(ExcludeRecentCount)
            .Select(e => e.Id)
            .ToListAsync(cancellationToken);

        return await context.Entries
            .AsNoTracking()
            .Include(e => e.Author)
            .Include(e => e.Topic)
            .Where(e => !last15Ids.Contains(e.Id))
            .OrderBy(_ => Guid.NewGuid())
            .Take(PoolSize)
            .Select(e => new DiscoverFeedEntry(
                e.Id,
                e.Content,
                e.Upvotes,
                e.Downvotes,
                e.TopicId,
                e.Topic!.Title,
                e.AuthorId,
                e.Author!.FirstName + " " + e.Author.LastName,
                e.Author!.Avatar,
                e.Author!.Role,
                e.CreatedAt,
                e.UpdatedAt,
                e.IsAnonymous))
            .ToListAsync(cancellationToken);
    }

    private static async Task<List<DiscoverFeedEntry>> FilterBlockedAsync(
        AppDbContext context,
        List<DiscoverFeedEntry> pool,
        Guid? userId,
        CancellationToken cancellationToken)
    {
        if (!userId.HasValue || pool.Count == 0)
        {
            return pool;
        }

        var uid = userId.Value;

        var blockedAuthorIds = await context.UserBlocks
            .AsNoTracking()
            .Where(b => b.BlockerId == uid || b.BlockedId == uid)
            .Select(b => b.BlockerId == uid ? b.BlockedId : b.BlockerId)
            .ToListAsync(cancellationToken);

        var blockedTopicIds = await context.TopicBlocks
            .AsNoTracking()
            .Where(tb => tb.UserId == uid)
            .Select(tb => tb.TopicId)
            .ToListAsync(cancellationToken);

        if (blockedAuthorIds.Count == 0 && blockedTopicIds.Count == 0)
        {
            return pool;
        }

        var authorSet = blockedAuthorIds.Count > 0 ? blockedAuthorIds.ToHashSet() : null;
        var topicSet = blockedTopicIds.Count > 0 ? blockedTopicIds.ToHashSet() : null;

        return pool.Where(e =>
            (authorSet == null || !authorSet.Contains(e.AuthorId))
            && (topicSet == null || !topicSet.Contains(e.TopicId))).ToList();
    }
}
