namespace TespitSozluk.API.Helpers;

/// <summary>
/// Profil seviyesi: üst seviyeye çıkmak için o satırdaki gün, anonim olmayan entry ve başlık
/// eşiklerinin üçü de aynı anda sağlanmalıdır. Gün kuralı <see cref="NoviceStatusHelper"/> ile aynı
/// DateTime tabanlı mantıktır (<c>CreatedAt &lt;= utcNow.AddDays(-eşik)</c>).
/// </summary>
public static class UserLevelHelper
{
    private static readonly (int MinDays, int MinEntries, int MinTopics, string Name)[] Levels =
    {
        (20, 20, 3, "Level 0"),
        (30, 30, 5, "Level 1"),
        (60, 50, 10, "Level 2"),
        (90, 70, 20, "Level 3"),
        (120, 100, 35, "Level 4"),
        (150, 150, 40, "Level 5"),
        (180, 180, 50, "Level 6"),
        (210, 220, 60, "Level 7"),
        (280, 280, 75, "Level 8"),
        (330, 350, 100, "Level 9"),
        (400, 500, 200, "Level 10"),
    };

    /// <param name="publicEntryCount">Anonim olmayan entry sayısı.</param>
    /// <param name="publicTopicCount">Anonim olmayan başlık sayısı.</param>
    public static string GetLevelName(
        DateTime userCreatedAt,
        int publicEntryCount,
        int publicTopicCount,
        DateTime utcNow)
    {
        for (var i = Levels.Length - 1; i >= 0; i--)
        {
            var row = Levels[i];
            if (userCreatedAt <= utcNow.AddDays(-row.MinDays)
                && publicEntryCount >= row.MinEntries
                && publicTopicCount >= row.MinTopics)
            {
                return row.Name;
            }
        }

        return "Çömez";
    }
}
