namespace TespitSozluk.API.Helpers;

/// <summary>
/// Çömez: kayıt süresi, entry ve başlık eşiklerinin hepsi sağlanmadan kullanıcı "çömez" sayılır.
/// Yönetici ve (opsiyonel) muaf tutulan resmi hesap asla çömez değildir.
/// </summary>
public static class NoviceStatusHelper
{
    public const int MinAccountAgeDays = 20;
    public const int MinNonAnonymousEntryCount = 20;
    public const int MinNonAnonymousTopicCount = 3;

    /// <param name="nonAnonymousEntryCount">Anonim olmayan entry sayısı (istatistiklerle aynı kural).</param>
    /// <param name="nonAnonymousTopicCount">Anonim olmayan açılan başlık sayısı.</param>
    public static bool ComputeIsNovice(
        string? userRole,
        Guid userId,
        DateTime userCreatedAt,
        int nonAnonymousEntryCount,
        int nonAnonymousTopicCount,
        DateTime utcNow,
        Guid? exemptOfficialUserId)
    {
        if (string.Equals(userRole, "Admin", StringComparison.Ordinal))
        {
            return false;
        }

        if (exemptOfficialUserId.HasValue && userId == exemptOfficialUserId.Value)
        {
            return false;
        }

        if (userCreatedAt > utcNow.AddDays(-MinAccountAgeDays))
        {
            return true;
        }

        if (nonAnonymousEntryCount < MinNonAnonymousEntryCount)
        {
            return true;
        }

        if (nonAnonymousTopicCount < MinNonAnonymousTopicCount)
        {
            return true;
        }

        return false;
    }
}
