using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;

namespace TespitSozluk.API.Helpers;

/// <summary>
/// EntriesController entry listesi ile aynı: mention markdown + bkz HTML + ValidBkzs.
/// Profil / taslak gibi uçlarda ham içerik dönülmesini önler.
/// </summary>
public static class EntryPublicContentBatch
{
    public static async Task<List<(string Content, Dictionary<string, Guid> ValidBkzs)>> ProcessContentsAsync(
        AppDbContext context,
        IReadOnlyList<string> contents,
        CancellationToken cancellationToken = default)
    {
        var bkzBag = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var mentionBag = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var c in contents)
        {
            BkzTopicHelper.CollectBkzTermsToBag(c, bkzBag);
            MentionHelper.CollectMentionHandlesToBag(c, mentionBag);
        }

        var mentionMaps = await MentionHelper.LoadMentionUserMapsAsync(context, mentionBag, Array.Empty<Guid>(), cancellationToken);
        var bkzMaps = await BkzTopicHelper.LoadBkzTopicMapsAsync(context, bkzBag, cancellationToken);

        var result = new List<(string, Dictionary<string, Guid>)>(contents.Count);
        foreach (var c in contents)
        {
            var contentForBkz = MentionHelper.ApplyMentionsMarkdown(c, mentionMaps);
            var validBkzs = BkzTopicHelper.BuildValidBkzs(contentForBkz, bkzMaps);
            var contentOut = BkzTopicHelper.ApplyBkzHtmlToContent(contentForBkz, bkzMaps);
            result.Add((contentOut, validBkzs));
        }

        return result;
    }
}
