using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TespitSozluk.API.Data;

namespace TespitSozluk.API.Services;

/// <summary>
/// Soft-delete edilmiş kullanıcıları ve entry içeriklerini yasal saklama süresi (547 gün)
/// dolduktan sonra kalıcı olarak siler.
/// </summary>
public sealed class DataRetentionCleanupService : BackgroundService
{
    private static readonly TimeSpan CleanupInterval = TimeSpan.FromHours(24);
    private static readonly TimeSpan RetentionPeriod = TimeSpan.FromDays(547);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DataRetentionCleanupService> _logger;

    public DataRetentionCleanupService(
        IServiceScopeFactory scopeFactory,
        ILogger<DataRetentionCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Kullanıcı/entry saklama temizliği başlatıldı. Saklama: {Days} gün.",
            RetentionPeriod.Days);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PurgeExpiredSoftDeletedAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Kullanıcı/entry saklama temizliği sırasında beklenmeyen hata.");
            }

            await Task.Delay(CleanupInterval, stoppingToken);
        }
    }

    private async Task PurgeExpiredSoftDeletedAsync(CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow - RetentionPeriod;

        List<Guid> expiredUserIds;
        await using (var listScope = _scopeFactory.CreateAsyncScope())
        {
            var db = listScope.ServiceProvider.GetRequiredService<AppDbContext>();
            expiredUserIds = await db.Users.IgnoreQueryFilters()
                .Where(u => u.IsDeleted && u.DeletedAtUtc != null && u.DeletedAtUtc < cutoff)
                .Select(u => u.Id)
                .ToListAsync(ct);
        }

        foreach (var userId in expiredUserIds)
        {
            List<Guid> entryIds;
            await using (var idScope = _scopeFactory.CreateAsyncScope())
            {
                var db = idScope.ServiceProvider.GetRequiredService<AppDbContext>();
                entryIds = await db.Entries.IgnoreQueryFilters()
                    .Where(e => e.AuthorId == userId)
                    .Select(e => e.Id)
                    .ToListAsync(ct);
            }

            foreach (var entryId in entryIds)
            {
                await using var entryScope = _scopeFactory.CreateAsyncScope();
                var db = entryScope.ServiceProvider.GetRequiredService<AppDbContext>();
                var entryDeletion = entryScope.ServiceProvider.GetRequiredService<IEntryDeletionService>();
                var entry = await db.Entries.IgnoreQueryFilters()
                    .FirstOrDefaultAsync(e => e.Id == entryId, ct);
                if (entry is not null)
                    await entryDeletion.DeleteEntryAndPruneEmptyTopicAsync(entry, ct);
            }

            await using (var userScope = _scopeFactory.CreateAsyncScope())
            {
                var db = userScope.ServiceProvider.GetRequiredService<AppDbContext>();
                var user = await db.Users.IgnoreQueryFilters()
                    .FirstOrDefaultAsync(u => u.Id == userId, ct);
                if (user is null || !user.IsDeleted)
                    continue;

                db.Users.Remove(user);
                await db.SaveChangesAsync(ct);
            }

            _logger.LogInformation(
                "Yasal saklama süresi dolan kullanıcı kalıcı silindi: {UserId}",
                userId);
        }
    }
}
