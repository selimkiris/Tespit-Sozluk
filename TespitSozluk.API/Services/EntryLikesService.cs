using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;
using TespitSozluk.API.DTOs;

namespace TespitSozluk.API.Services;

public class EntryLikesService : IEntryLikesService
{
    private readonly AppDbContext _context;

    public EntryLikesService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<EntryUpvotersQueryResult> GetUpvotersForEntryAuthorAsync(Guid entryId, Guid requestorId)
    {
        var entry = await _context.Entries
            .AsNoTracking()
            .Select(e => new { e.Id, e.AuthorId })
            .FirstOrDefaultAsync(e => e.Id == entryId);

        if (entry == null)
        {
            return new EntryUpvotersQueryResult { EntryExists = false, RequestorIsAuthor = false };
        }

        if (entry.AuthorId != requestorId)
        {
            return new EntryUpvotersQueryResult
            {
                EntryExists = true,
                RequestorIsAuthor = false
            };
        }

        var upvoters = await _context.EntryVotes
            .AsNoTracking()
            .Where(v => v.EntryId == entryId && v.IsUpvote)
            .Join(_context.Users.AsNoTracking(),
                v => v.UserId,
                u => u.Id,
                (_, u) => new UserSearchResultDto
                {
                    Id = u.Id,
                    Name = string.Empty,
                    Username = u.Username,
                    Avatar = u.Avatar
                })
            .OrderBy(u => u.Username)
            .ToListAsync();

        return new EntryUpvotersQueryResult
        {
            EntryExists = true,
            RequestorIsAuthor = true,
            Upvoters = upvoters
        };
    }
}
