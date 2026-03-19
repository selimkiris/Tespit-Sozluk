using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Memory;

namespace TespitSozluk.API.Services;

public class RateLimitService : IRateLimitService
{
    private readonly IMemoryCache _cache;

    // Her cache anahtarı için ayrı bir kilit nesnesi; paralel isteklerde timestamp listesi tutarlı kalsın.
    private readonly ConcurrentDictionary<string, object> _keyLocks = new();

    public RateLimitService(IMemoryCache cache)
    {
        _cache = cache;
    }

    public RateLimitResult CheckAndRecord(string key, RateLimitAction action)
    {
        var cacheKey = $"rl:{action}:{key}";
        var lockObj = _keyLocks.GetOrAdd(cacheKey, _ => new object());

        lock (lockObj)
        {
            var now = DateTime.UtcNow;
            var timestamps = _cache.Get<List<DateTime>>(cacheKey) ?? [];

            // 25 saatten eski timestamp'leri temizle (günlük pencereden taşanlar)
            timestamps.RemoveAll(t => (now - t).TotalHours > 25);

            var rules = GetRules(action);
            double maxRetryAfterSeconds = 0;
            bool isLimited = false;

            foreach (var rule in rules)
            {
                var windowStart = now - rule.Window;
                var countInWindow = timestamps.Count(t => t >= windowStart);

                if (countInWindow >= rule.MaxRequests)
                {
                    isLimited = true;

                    // Bu penceredeki en eski timestamp ne zaman "düşecek" → o anda bir slot açılacak.
                    // Birden fazla pencere limitini aştıysa en geç açılanı beklemeliyiz (maksimum al).
                    var oldestInWindow = timestamps
                        .Where(t => t >= windowStart)
                        .OrderBy(t => t)
                        .First();

                    var secondsUntilSlot = (oldestInWindow + rule.Window - now).TotalSeconds;
                    maxRetryAfterSeconds = Math.Max(maxRetryAfterSeconds, Math.Ceiling(secondsUntilSlot));
                }
            }

            if (isLimited)
            {
                return new RateLimitResult(false, maxRetryAfterSeconds);
            }

            // Limit aşılmadı → mevcut isteği kaydet
            timestamps.Add(now);
            _cache.Set(cacheKey, timestamps, TimeSpan.FromHours(25));

            return new RateLimitResult(true);
        }
    }

    // ─── Limit Kuralları ─────────────────────────────────────────────────────

    private record RateLimitRule(TimeSpan Window, int MaxRequests);

    private static List<RateLimitRule> GetRules(RateLimitAction action) => action switch
    {
        RateLimitAction.Register => [
            new(TimeSpan.FromHours(1),  5),
            new(TimeSpan.FromDays(1),  10)
        ],
        RateLimitAction.CreateEntry => [
            new(TimeSpan.FromMinutes(1),   3),
            new(TimeSpan.FromHours(1),    60),
            new(TimeSpan.FromDays(1),    200)
        ],
        RateLimitAction.CreateTopic => [
            new(TimeSpan.FromHours(1), 12),
            new(TimeSpan.FromDays(1),  50)
        ],
        _ => []
    };
}
