namespace TespitSozluk.API.Services;

public enum RateLimitAction
{
    Register,
    CreateEntry,
    CreateTopic
}

public record RateLimitResult(bool IsAllowed, double RetryAfterSeconds = 0);

public interface IRateLimitService
{
    /// <summary>
    /// Belirtilen anahtar ve eylem için rate limit kontrolü yapar.
    /// Limit aşılmamışsa isteği kaydeder ve IsAllowed=true döner.
    /// Limit aşıldıysa IsAllowed=false ve RetryAfterSeconds ile ne zaman tekrar denenebileceğini döner.
    /// </summary>
    RateLimitResult CheckAndRecord(string key, RateLimitAction action);
}
