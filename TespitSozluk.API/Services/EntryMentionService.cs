using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;
using TespitSozluk.API.Entities;
using TespitSozluk.API.Helpers;

namespace TespitSozluk.API.Services;

public class EntryMentionService : IEntryMentionService
{
    private readonly AppDbContext _context;

    public EntryMentionService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<string> ApplyMentionsAndQueueNotificationsAsync(
        string content,
        Guid entryId,
        Guid authorId,
        MentionHelper.MentionUserMaps? preloadedMentionMaps = null,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrEmpty(content))
        {
            return content;
        }

        var matches = MentionHelper.GetMentionMatches(content);
        if (matches.Count == 0)
        {
            return content;
        }

        MentionHelper.MentionUserMaps maps;
        if (preloadedMentionMaps != null)
        {
            maps = preloadedMentionMaps;
        }
        else
        {
            var bag = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            MentionHelper.CollectMentionHandlesToBag(content, bag);
            maps = await MentionHelper.LoadMentionUserMapsAsync(_context, bag, new[] { authorId }, cancellationToken);
        }

        var transformed = MentionHelper.ApplyMentionsMarkdown(content, maps);

        var authorUsername = await ResolveAuthorUsernameAsync(authorId, maps, cancellationToken);

        var notifiedIds = new HashSet<Guid>();
        foreach (Match m in matches)
        {
            var captured = m.Groups[1].Value;
            if (!maps.TryResolveMention(captured, out var u) || u.Id == authorId)
            {
                continue;
            }

            if (!notifiedIds.Add(u.Id))
            {
                continue;
            }

            _context.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = u.Id,
                SenderId = authorId,
                Type = EntryInteractionNotificationTypes.Mention,
                Message = $"{authorUsername} seni bir entry'de etiketledi.",
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
                EntryId = entryId
            });
        }

        return transformed;
    }

    private async Task<string> ResolveAuthorUsernameAsync(
        Guid authorId,
        MentionHelper.MentionUserMaps maps,
        CancellationToken cancellationToken)
    {
        if (maps.TryGetUsernameById(authorId, out var un))
            return un;

        return await _context.Users
            .AsNoTracking()
            .Where(a => a.Id == authorId)
            .Select(a => a.Username)
            .FirstAsync(cancellationToken);
    }
}
