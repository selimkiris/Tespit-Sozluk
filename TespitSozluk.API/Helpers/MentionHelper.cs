using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;

namespace TespitSozluk.API.Helpers;

/// <summary>
/// @nickname → <c>[@kullanici](/user/{id})</c> dönüşümü için toplu çözümleme (bkz ile aynı strateji).
/// <c>[</c> ile başlamayan @ eşleşir; kayıtlı markdown mention satır içi tekrar işlenmez.
/// </summary>
public static class MentionHelper
{
    /// <summary>Parantez içi veya markdown link içi @ değil, gerçek mention.</summary>
    private static readonly Regex MentionRegex = new(@"(?<!\[)@([^\s@]+)", RegexOptions.Compiled);

    public static MatchCollection GetMentionMatches(string? content) =>
        MentionRegex.Matches(content ?? string.Empty);

    public sealed class MentionUserMaps
    {
        private readonly Dictionary<string, (Guid Id, string Username)> _byLowerUsername;
        private readonly Dictionary<Guid, string> _idToUsername;

        public MentionUserMaps(
            Dictionary<string, (Guid Id, string Username)> byLowerUsername,
            Dictionary<Guid, string> idToUsername)
        {
            _byLowerUsername = byLowerUsername;
            _idToUsername = idToUsername;
        }

        public static MentionUserMaps Empty { get; } =
            new(new Dictionary<string, (Guid Id, string Username)>(StringComparer.Ordinal),
                new Dictionary<Guid, string>());

        public bool IsEmpty => _byLowerUsername.Count == 0 && _idToUsername.Count == 0;

        public bool TryResolveMention(string capturedHandle, out (Guid Id, string Username) user)
        {
            return _byLowerUsername.TryGetValue(capturedHandle.ToLowerInvariant(), out user);
        }

        public bool TryGetUsernameById(Guid userId, out string username) =>
            _idToUsername.TryGetValue(userId, out username!);
    }

    public static void CollectMentionHandlesToBag(string? content, HashSet<string> bag)
    {
        if (string.IsNullOrWhiteSpace(content)) return;
        foreach (Match m in MentionRegex.Matches(content))
        {
            var h = m.Groups[1].Value;
            if (!string.IsNullOrEmpty(h))
                bag.Add(h);
        }
    }

    /// <summary>
    /// Tek sorguda: etiketlenen kullanıcı adları + bildirim metni için ek kullanıcı id'leri (ör. yazar).
    /// </summary>
    public static async Task<MentionUserMaps> LoadMentionUserMapsAsync(
        AppDbContext context,
        HashSet<string> distinctHandles,
        IReadOnlyCollection<Guid> includeUserIds,
        CancellationToken cancellationToken = default)
    {
        var lowered = distinctHandles
            .Where(s => !string.IsNullOrEmpty(s))
            .Select(s => s.ToLowerInvariant())
            .Distinct()
            .ToList();

        var idSet = includeUserIds.Count > 0 ? includeUserIds.ToHashSet() : null;

        if (lowered.Count == 0 && (idSet == null || idSet.Count == 0))
            return MentionUserMaps.Empty;

        var users = await context.Users
            .AsNoTracking()
            .Where(u =>
                (idSet != null && idSet.Contains(u.Id)) ||
                lowered.Contains(u.Username.ToLower()))
            .Select(u => new { u.Id, u.Username })
            .ToListAsync(cancellationToken);

        var byLower = new Dictionary<string, (Guid Id, string Username)>(StringComparer.Ordinal);
        var idToUsername = new Dictionary<Guid, string>();
        foreach (var u in users)
        {
            idToUsername[u.Id] = u.Username;
            var key = u.Username.ToLowerInvariant();
            byLower.TryAdd(key, (u.Id, u.Username));
        }

        return new MentionUserMaps(byLower, idToUsername);
    }

    /// <summary>Veritabanında olmayan nick'lere dokunulmaz (kör link oluşmaz).</summary>
    public static string ApplyMentionsMarkdown(string? content, MentionUserMaps maps)
    {
        if (string.IsNullOrEmpty(content) || maps.IsEmpty)
            return content ?? string.Empty;

        return MentionRegex.Replace(content, m =>
        {
            var captured = m.Groups[1].Value;
            if (!maps.TryResolveMention(captured, out var u))
                return m.Value;

            return $"[@{u.Username}](/user/{u.Id})";
        });
    }
}
