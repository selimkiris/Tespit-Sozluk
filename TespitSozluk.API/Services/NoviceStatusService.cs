using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;
using TespitSozluk.API.Helpers;

namespace TespitSozluk.API.Services;

public sealed class NoviceStatusService : INoviceStatusService
{
    private readonly AppDbContext _context;
    private readonly Guid? _exemptOfficialUserId;

    public NoviceStatusService(AppDbContext context, IConfiguration configuration)
    {
        _context = context;
        var raw = configuration["Novice:ExemptUserId"];
        if (!string.IsNullOrWhiteSpace(raw) && Guid.TryParse(raw, out var g))
        {
            _exemptOfficialUserId = g;
        }
    }

    public bool IsNovice(
        string? userRole,
        Guid userId,
        DateTime userCreatedAt,
        int nonAnonymousEntryCount,
        int nonAnonymousTopicCount) =>
        NoviceStatusHelper.ComputeIsNovice(
            userRole,
            userId,
            userCreatedAt,
            nonAnonymousEntryCount,
            nonAnonymousTopicCount,
            DateTime.UtcNow,
            _exemptOfficialUserId);

    public async Task<Dictionary<Guid, bool>> GetIsNoviceMapAsync(
        IReadOnlyCollection<Guid> userIds,
        CancellationToken cancellationToken = default)
    {
        if (userIds == null || userIds.Count == 0)
        {
            return new Dictionary<Guid, bool>();
        }

        var distinct = userIds.Distinct().ToList();
        if (distinct.Count == 0)
        {
            return new Dictionary<Guid, bool>();
        }

        var userRows = await _context.Users
            .AsNoTracking()
            .Where(u => distinct.Contains(u.Id))
            .Select(u => new { u.Id, u.Role, u.CreatedAt })
            .ToListAsync(cancellationToken);

        var entryGroups = await _context.Entries
            .AsNoTracking()
            .Where(e => distinct.Contains(e.AuthorId) && !e.IsAnonymous)
            .GroupBy(e => e.AuthorId)
            .Select(g => new { AuthorId = g.Key, Cnt = g.Count() })
            .ToListAsync(cancellationToken);

        var topicGroups = await _context.Topics
            .AsNoTracking()
            .Where(t => t.AuthorId != null && distinct.Contains(t.AuthorId.Value) && !t.IsAnonymous)
            .GroupBy(t => t.AuthorId!.Value)
            .Select(g => new { AuthorId = g.Key, Cnt = g.Count() })
            .ToListAsync(cancellationToken);

        var entryDict = entryGroups.ToDictionary(x => x.AuthorId, x => x.Cnt);
        var topicDict = topicGroups.ToDictionary(x => x.AuthorId, x => x.Cnt);
        var utc = DateTime.UtcNow;

        var result = new Dictionary<Guid, bool>(distinct.Count);
        var userById = userRows.ToDictionary(x => x.Id, x => x);
        foreach (var id in distinct)
        {
            if (!userById.TryGetValue(id, out var row))
            {
                result[id] = true;
                continue;
            }

            var entries = entryDict.GetValueOrDefault(id, 0);
            var topics = topicDict.GetValueOrDefault(id, 0);
            result[id] = NoviceStatusHelper.ComputeIsNovice(
                row.Role,
                id,
                row.CreatedAt,
                entries,
                topics,
                utc,
                _exemptOfficialUserId);
        }

        return result;
    }
}
