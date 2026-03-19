using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;
using TespitSozluk.API.DTOs;
using TespitSozluk.API.Entities;
using TespitSozluk.API.Filters;
using TespitSozluk.API.Services;

namespace TespitSozluk.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EntriesController : ControllerBase
{
    private record FeedEntryData(Guid Id, string Content, int Upvotes, int Downvotes, Guid TopicId, string TopicTitle,
        Guid AuthorId, string AuthorName, string? AuthorAvatar, string AuthorRole, DateTime CreatedAt, DateTime? UpdatedAt, bool IsAnonymous);

    private readonly AppDbContext _context;

    public EntriesController(AppDbContext context)
    {
        _context = context;
    }

    [AllowAnonymous]
    [HttpGet("feed")]
    public async Task<ActionResult<PagedEntriesDto>> GetFeed(
        [FromQuery] string feedMode = "recent",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 50;
        if (pageSize > 100) pageSize = 100;

        var userId = User.Identity?.IsAuthenticated == true
            && Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid)
            ? (Guid?)uid
            : null;

        IQueryable<Entry> baseQuery = _context.Entries
            .Include(e => e.Author)
            .Include(e => e.Topic);

        List<FeedEntryData> entries;
        int totalCount;
        int effectivePageSize = pageSize;

        switch (feedMode?.ToLowerInvariant() ?? "recent")
        {
            case "following":
                if (!userId.HasValue)
                {
                    return new PagedEntriesDto
                    {
                        Items = new List<EntryResponseDto>(),
                        Page = page,
                        PageSize = pageSize,
                        TotalCount = 0,
                        TotalPages = 0,
                        HasPreviousPage = false,
                        HasNextPage = false
                    };
                }
                var followedAuthorIds = await _context.UserFollows
                    .Where(uf => uf.FollowerId == userId.Value)
                    .Select(uf => uf.FollowingId)
                    .ToListAsync();
                var followedTopicIds = await _context.UserTopicFollows
                    .Where(utf => utf.UserId == userId.Value)
                    .Select(utf => utf.TopicId)
                    .ToListAsync();
                var followingQuery = baseQuery.Where(e =>
                    followedAuthorIds.Contains(e.AuthorId) || followedTopicIds.Contains(e.TopicId));
                totalCount = await followingQuery.CountAsync();
                var followingData = await followingQuery
                    .OrderByDescending(e => e.CreatedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(e => new FeedEntryData(e.Id, e.Content, e.Upvotes, e.Downvotes, e.TopicId, e.Topic!.Title,
                        e.AuthorId, e.Author!.FirstName + " " + e.Author.LastName, e.Author!.Avatar, e.Author!.Role, e.CreatedAt, e.UpdatedAt, e.IsAnonymous))
                    .ToListAsync();
                entries = followingData;
                break;

            case "discover":
                var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);
                var pool = await baseQuery
                    .Where(e => e.CreatedAt >= thirtyDaysAgo)
                    .OrderByDescending(e => e.CreatedAt)
                    .Take(500)
                    .Select(e => new FeedEntryData(e.Id, e.Content, e.Upvotes, e.Downvotes, e.TopicId, e.Topic!.Title,
                        e.AuthorId, e.Author!.FirstName + " " + e.Author.LastName, e.Author!.Avatar, e.Author!.Role, e.CreatedAt, e.UpdatedAt, e.IsAnonymous))
                    .ToListAsync();
                var shuffled = pool.OrderBy(_ => Guid.NewGuid()).ToList();
                var discoverTake = Math.Min(20, Math.Max(10, pageSize));
                effectivePageSize = discoverTake;
                totalCount = shuffled.Count;
                entries = shuffled
                    .Skip(discoverTake * (page - 1))
                    .Take(discoverTake)
                    .ToList();
                break;

            default:
                var recentQuery = baseQuery.OrderByDescending(e => e.CreatedAt);
                totalCount = await recentQuery.CountAsync();
                entries = await recentQuery
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(e => new FeedEntryData(e.Id, e.Content, e.Upvotes, e.Downvotes, e.TopicId, e.Topic!.Title,
                        e.AuthorId, e.Author!.FirstName + " " + e.Author.LastName, e.Author!.Avatar, e.Author!.Role, e.CreatedAt, e.UpdatedAt, e.IsAnonymous))
                    .ToListAsync();
                break;
        }

        Dictionary<Guid, int> userVotes = new();
        Dictionary<Guid, int> saveCounts = new();
        HashSet<Guid> userSavedIds = new();
        if (entries.Count > 0)
        {
            var entryIds = entries.Select(e => e.Id).ToList();
            if (userId.HasValue)
            {
                var votes = await _context.EntryVotes
                    .Where(v => v.UserId == userId.Value && entryIds.Contains(v.EntryId))
                    .Select(v => new { v.EntryId, v.IsUpvote })
                    .ToListAsync();
                userVotes = votes.ToDictionary(v => v.EntryId, v => v.IsUpvote ? 1 : -1);
            }
            (saveCounts, userSavedIds) = await GetSaveDataAsync(entryIds, userId);
        }

        var result = new List<EntryResponseDto>();
        foreach (var e in entries)
        {
            var validBkzs = await BuildValidBkzsAsync(e.Content);
            var dto = MapToPublicResponse(e.Id, e.Content, e.Upvotes, e.Downvotes, e.TopicId, e.TopicTitle,
                e.AuthorId, e.AuthorName, e.AuthorAvatar, e.AuthorRole, e.CreatedAt, e.UpdatedAt, e.IsAnonymous, userId, userVotes,
                saveCounts.TryGetValue(e.Id, out var sc) ? sc : 0,
                userSavedIds.Contains(e.Id));
            dto.ValidBkzs = validBkzs;
            result.Add(dto);
        }

        var totalPages = (int)Math.Ceiling(totalCount / (double)effectivePageSize);

        return new PagedEntriesDto
        {
            Items = result,
            Page = page,
            PageSize = effectivePageSize,
            TotalCount = totalCount,
            TotalPages = totalPages,
            HasPreviousPage = page > 1,
            HasNextPage = page < totalPages
        };
    }

    [AllowAnonymous]
    [HttpGet("{id}")]
    public async Task<ActionResult<EntryResponseDto>> GetEntryById(Guid id)
    {
        var entry = await _context.Entries
            .Include(e => e.Author)
            .Include(e => e.Topic)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (entry == null)
        {
            return NotFound();
        }

        var userId = User.Identity?.IsAuthenticated == true
            && Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid)
            ? (Guid?)uid
            : null;

        Dictionary<Guid, int> userVotes = new();
        var (saveCounts, userSavedIds) = await GetSaveDataAsync(new List<Guid> { id }, userId);
        if (userId.HasValue)
        {
            var vote = await _context.EntryVotes
                .FirstOrDefaultAsync(v => v.EntryId == id && v.UserId == userId.Value);
            if (vote != null)
            {
                userVotes[id] = vote.IsUpvote ? 1 : -1;
            }
        }

        var authorName = entry.IsAnonymous ? "Anonim" : (entry.Author!.FirstName + " " + entry.Author.LastName);
        var authorAvatar = entry.IsAnonymous ? null : entry.Author!.Avatar;
        var authorRole = entry.Author?.Role ?? "User";
        var validBkzs = await BuildValidBkzsAsync(entry.Content);
        var dto = MapToPublicResponse(
            entry.Id, entry.Content, entry.Upvotes, entry.Downvotes,
            entry.TopicId, entry.Topic!.Title, entry.AuthorId, authorName, authorAvatar, authorRole,
            entry.CreatedAt, entry.UpdatedAt, entry.IsAnonymous,
            userId, userVotes,
            saveCounts.TryGetValue(id, out var sc) ? sc : 0,
            userSavedIds.Contains(id));
        dto.ValidBkzs = validBkzs;

        return dto;
    }

    [AllowAnonymous]
    [HttpGet]
    public async Task<ActionResult<List<EntryResponseDto>>> GetEntries([FromQuery] Guid? topicId)
    {
        var userId = User.Identity?.IsAuthenticated == true
            && Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid)
            ? (Guid?)uid
            : null;

        var query = _context.Entries
            .Include(e => e.Author)
            .Include(e => e.Topic)
            .AsQueryable();

        if (topicId.HasValue)
        {
            query = query.Where(e => e.TopicId == topicId.Value);
        }

        var entries = await query
            .OrderByDescending(e => e.CreatedAt)
            .Select(e => new
            {
                e.Id,
                e.Content,
                e.Upvotes,
                e.Downvotes,
                e.TopicId,
                TopicTitle = e.Topic.Title,
                e.AuthorId,
                AuthorName = e.Author.FirstName + " " + e.Author.LastName,
                AuthorAvatar = e.Author.Avatar,
                AuthorRole = e.Author.Role,
                e.CreatedAt,
                e.UpdatedAt,
                e.IsAnonymous
            })
            .ToListAsync();

        Dictionary<Guid, int> userVotes = new();
        Dictionary<Guid, int> saveCounts = new();
        HashSet<Guid> userSavedIds = new();
        if (entries.Count > 0)
        {
            var entryIds = entries.Select(e => e.Id).ToList();
            if (userId.HasValue)
            {
                var votes = await _context.EntryVotes
                    .Where(v => v.UserId == userId.Value && entryIds.Contains(v.EntryId))
                    .Select(v => new { v.EntryId, v.IsUpvote })
                    .ToListAsync();
                userVotes = votes.ToDictionary(v => v.EntryId, v => v.IsUpvote ? 1 : -1);
            }
            (saveCounts, userSavedIds) = await GetSaveDataAsync(entryIds, userId);
        }

        var result = new List<EntryResponseDto>();
        foreach (var e in entries)
        {
            var validBkzs = await BuildValidBkzsAsync(e.Content);
            var dto = MapToPublicResponse(e.Id, e.Content, e.Upvotes, e.Downvotes, e.TopicId, e.TopicTitle,
                e.AuthorId, e.AuthorName, e.AuthorAvatar, e.AuthorRole, e.CreatedAt, e.UpdatedAt, e.IsAnonymous, userId, userVotes,
                saveCounts.TryGetValue(e.Id, out var sc) ? sc : 0,
                userSavedIds.Contains(e.Id));
            dto.ValidBkzs = validBkzs;
            result.Add(dto);
        }

        return result;
    }

    [Authorize]
    [RateLimit(RateLimitAction.CreateEntry)]
    [HttpPost]
    public async Task<IActionResult> CreateEntry([FromBody] CreateEntryDto dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var authorId))
        {
            return Unauthorized();
        }

        var topicExists = await _context.Topics.AnyAsync(t => t.Id == dto.TopicId);
        if (!topicExists)
        {
            return NotFound("Başlık bulunamadı.");
        }

        var entry = new Entry
        {
            Id = Guid.NewGuid(),
            Content = dto.Content.Trim(),
            TopicId = dto.TopicId,
            AuthorId = authorId,
            IsAnonymous = dto.IsAnonymous,
            CreatedAt = DateTime.UtcNow
        };

        _context.Entries.Add(entry);
        await _context.SaveChangesAsync();

        var author = await _context.Users.FindAsync(authorId);
        var topic = await _context.Topics.FindAsync(entry.TopicId);
        var response = MapToResponseDto(entry, author!, topic!, 0, true);
        response.ValidBkzs = await BuildValidBkzsAsync(entry.Content);
        response.SaveCount = 0;
        response.IsSavedByCurrentUser = false;

        return Created($"/api/entries/{entry.Id}", response);
    }

    [Authorize]
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateEntry(Guid id, [FromBody] UpdateEntryDto dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var authorId))
        {
            return Unauthorized();
        }

        var entry = await _context.Entries.FindAsync(id);
        if (entry == null)
        {
            return NotFound();
        }

        if (entry.AuthorId != authorId)
        {
            return StatusCode(403, "Bu içeriği düzenleme yetkiniz yok.");
        }

        entry.Content = dto.Content.Trim();
        entry.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var author = await _context.Users.FindAsync(entry.AuthorId);
        var topic = await _context.Topics.FindAsync(entry.TopicId);
        var userVoteType = 0;
        var vote = await _context.EntryVotes
            .FirstOrDefaultAsync(v => v.EntryId == id && v.UserId == authorId);
        if (vote != null) userVoteType = vote.IsUpvote ? 1 : -1;
        var response = MapToResponseDto(entry, author!, topic!, userVoteType, true);
        response.ValidBkzs = await BuildValidBkzsAsync(entry.Content);
        var (saveCounts, userSavedIds) = await GetSaveDataAsync(new List<Guid> { id }, authorId);
        response.SaveCount = saveCounts.TryGetValue(id, out var sc) ? sc : 0;
        response.IsSavedByCurrentUser = userSavedIds.Contains(id);
        return Ok(response);
    }

    [Authorize]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteEntry(Guid id)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var authorId))
        {
            return Unauthorized();
        }

        var entry = await _context.Entries.FindAsync(id);
        if (entry == null)
        {
            return NotFound();
        }

        if (entry.AuthorId != authorId)
        {
            return StatusCode(403, "Bu içeriği silme yetkiniz yok.");
        }

        _context.Entries.Remove(entry);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [Authorize]
    [HttpPost("{id}/upvote")]
    public async Task<IActionResult> Upvote(Guid id)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var entry = await _context.Entries.FindAsync(id);
        if (entry == null)
        {
            return NotFound();
        }

        var existingVote = await _context.EntryVotes
            .FirstOrDefaultAsync(v => v.EntryId == id && v.UserId == userId);

        if (existingVote == null)
        {
            _context.EntryVotes.Add(new EntryVote
            {
                Id = Guid.NewGuid(),
                EntryId = id,
                UserId = userId,
                IsUpvote = true
            });
            entry.Upvotes++;
        }
        else if (existingVote.IsUpvote)
        {
            _context.EntryVotes.Remove(existingVote);
            entry.Upvotes--;
        }
        else
        {
            existingVote.IsUpvote = true;
            entry.Downvotes--;
            entry.Upvotes++;
        }

        await _context.SaveChangesAsync();

        var userVoteType = existingVote == null ? 1 : (existingVote.IsUpvote ? 0 : 1);
        return Ok(new { upvotes = entry.Upvotes, downvotes = entry.Downvotes, userVoteType });
    }

    [Authorize]
    [HttpPost("{id}/downvote")]
    public async Task<IActionResult> Downvote(Guid id)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var entry = await _context.Entries.FindAsync(id);
        if (entry == null)
        {
            return NotFound();
        }

        var existingVote = await _context.EntryVotes
            .FirstOrDefaultAsync(v => v.EntryId == id && v.UserId == userId);

        if (existingVote == null)
        {
            _context.EntryVotes.Add(new EntryVote
            {
                Id = Guid.NewGuid(),
                EntryId = id,
                UserId = userId,
                IsUpvote = false
            });
            entry.Downvotes++;
        }
        else if (!existingVote.IsUpvote)
        {
            _context.EntryVotes.Remove(existingVote);
            entry.Downvotes--;
        }
        else
        {
            existingVote.IsUpvote = false;
            entry.Upvotes--;
            entry.Downvotes++;
        }

        await _context.SaveChangesAsync();

        var userVoteType = existingVote == null ? -1 : (!existingVote.IsUpvote ? 0 : -1);
        return Ok(new { upvotes = entry.Upvotes, downvotes = entry.Downvotes, userVoteType });
    }

    [Authorize]
    [HttpPost("{id}/save")]
    public async Task<IActionResult> ToggleSave(Guid id)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var entry = await _context.Entries.FindAsync(id);
        if (entry == null)
        {
            return NotFound();
        }

        var existing = await _context.UserSavedEntries
            .FirstOrDefaultAsync(s => s.UserId == userId && s.EntryId == id);

        if (existing != null)
        {
            _context.UserSavedEntries.Remove(existing);
            await _context.SaveChangesAsync();
            var newCount = await _context.UserSavedEntries.CountAsync(s => s.EntryId == id);
            return Ok(new { saveCount = newCount, isSavedByCurrentUser = false });
        }
        else
        {
            _context.UserSavedEntries.Add(new UserSavedEntry
            {
                UserId = userId,
                EntryId = id,
                SavedAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();
            var newCount = await _context.UserSavedEntries.CountAsync(s => s.EntryId == id);
            return Ok(new { saveCount = newCount, isSavedByCurrentUser = true });
        }
    }

    private async Task<(Dictionary<Guid, int> saveCounts, HashSet<Guid> userSavedIds)> GetSaveDataAsync(List<Guid> entryIds, Guid? userId)
    {
        if (entryIds.Count == 0) return (new Dictionary<Guid, int>(), new HashSet<Guid>());
        var saveCounts = await _context.UserSavedEntries
            .Where(s => entryIds.Contains(s.EntryId))
            .GroupBy(s => s.EntryId)
            .Select(g => new { EntryId = g.Key, Count = g.Count() })
            .ToListAsync();
        var dict = saveCounts.ToDictionary(x => x.EntryId, x => x.Count);
        var userSavedIds = new HashSet<Guid>();
        if (userId.HasValue)
        {
            var ids = await _context.UserSavedEntries
                .Where(s => s.UserId == userId.Value && entryIds.Contains(s.EntryId))
                .Select(s => s.EntryId)
                .ToListAsync();
            userSavedIds = ids.ToHashSet();
        }
        return (dict, userSavedIds);
    }

    /// <summary>Public API yanıtları için: IsAnonymous ise Author'ı maskeler. CanManage = isOwner.</summary>
    private static EntryResponseDto MapToPublicResponse(
        Guid id, string content, int upvotes, int downvotes, Guid topicId, string topicTitle,
        Guid authorId, string authorName, string? authorAvatar, string authorRole, DateTime createdAt, DateTime? updatedAt, bool isAnonymous,
        Guid? requestorId, Dictionary<Guid, int> userVotes, int saveCount = 0, bool isSavedByCurrentUser = false)
    {
        const string anonimName = "Anonim";
        var canManage = requestorId.HasValue && requestorId.Value == authorId;
        return new EntryResponseDto
        {
            Id = id,
            Content = content,
            Upvotes = upvotes,
            Downvotes = downvotes,
            TopicId = topicId,
            TopicTitle = topicTitle,
            AuthorId = isAnonymous ? Guid.Empty : authorId,
            AuthorName = isAnonymous ? anonimName : authorName,
            AuthorAvatar = isAnonymous ? null : authorAvatar,
            AuthorRole = isAnonymous ? "User" : (authorRole ?? "User"),
            CreatedAt = createdAt,
            UpdatedAt = updatedAt,
            IsAnonymous = isAnonymous,
            CanManage = canManage,
            SaveCount = saveCount,
            IsSavedByCurrentUser = isSavedByCurrentUser,
            ValidBkzs = new Dictionary<string, Guid>(),
            UserVoteType = requestorId.HasValue && userVotes.TryGetValue(id, out var vt) ? vt : 0
        };
    }

    private static EntryResponseDto MapToResponseDto(Entry entry, User author, Topic topic, int userVoteType = 0, bool canManage = false)
    {
        const string anonimName = "Anonim";
        var isAnon = entry.IsAnonymous;
        return new EntryResponseDto
        {
            Id = entry.Id,
            Content = entry.Content,
            Upvotes = entry.Upvotes,
            Downvotes = entry.Downvotes,
            TopicId = entry.TopicId,
            TopicTitle = topic.Title,
            AuthorId = isAnon ? Guid.Empty : entry.AuthorId,
            AuthorName = isAnon ? anonimName : (author.FirstName + " " + author.LastName),
            AuthorAvatar = isAnon ? null : author.Avatar,
            AuthorRole = isAnon ? "User" : (author.Role ?? "User"),
            CreatedAt = entry.CreatedAt,
            UpdatedAt = entry.UpdatedAt,
            IsAnonymous = isAnon,
            CanManage = canManage,
            SaveCount = 0,
            IsSavedByCurrentUser = false,
            ValidBkzs = new Dictionary<string, Guid>(),
            UserVoteType = userVoteType
        };
    }

    private async Task<Dictionary<string, Guid>> BuildValidBkzsAsync(string content)
    {
        if (string.IsNullOrWhiteSpace(content)) return new Dictionary<string, Guid>();

        var regex = new Regex(@"\(bkz:\s*([^)]+)\)", RegexOptions.IgnoreCase);
        var matches = regex.Matches(content);
        var terms = matches
            .Select(m => m.Groups[1].Value.Trim())
            .Where(s => !string.IsNullOrEmpty(s))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (terms.Count == 0) return new Dictionary<string, Guid>();

        var lowerTerms = terms.Select(t => t.ToLower()).ToList();
        var topics = await _context.Topics
            .Where(t => lowerTerms.Contains(t.Title.ToLower()))
            .Select(t => new { t.Title, t.Id })
            .ToListAsync();

        var dict = new Dictionary<string, Guid>();
        foreach (var t in topics)
        {
            dict[t.Title] = t.Id;
        }
        return dict;
    }
}
