using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;

namespace TespitSozluk.API.Services;

/// <summary>
/// 5651 Sayılı Kanun gereği trafik loglarını 18 ay (1.5 yıl) saklar;
/// bu süreyi aşan kayıtları günde bir kez otomatik olarak siler.
/// </summary>
public sealed class LogCleanupBackgroundService : BackgroundService
{
    private static readonly TimeSpan CleanupInterval = TimeSpan.FromHours(24);
    private static readonly TimeSpan RetentionPeriod = TimeSpan.FromDays(548); // ~18 ay

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<LogCleanupBackgroundService> _logger;

    public LogCleanupBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<LogCleanupBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Log temizleme servisi başlatıldı. Saklama süresi: {Days} gün.", RetentionPeriod.Days);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupExpiredLogsAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Log temizleme sırasında beklenmeyen hata oluştu.");
            }

            await Task.Delay(CleanupInterval, stoppingToken);
        }
    }

    private async Task CleanupExpiredLogsAsync(CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow - RetentionPeriod;

        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var deleted = await db.TrafficLogs
            .Where(tl => tl.TimestampUtc < cutoff)
            .ExecuteDeleteAsync(ct);

        if (deleted > 0)
            _logger.LogInformation(
                "Yasal saklama süresi dolan {Count} trafik logu silindi. (Kesim tarihi: {Cutoff:u})",
                deleted, cutoff);
    }
}
