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
public class TopicsController : ControllerBase
{
    private readonly AppDbContext _context;

    public TopicsController(AppDbContext context)
    {
        _context = context;
    }

    [Authorize]
    [RateLimit(RateLimitAction.CreateTopic)]
    [HttpPost]
    public async Task<IActionResult> CreateTopic([FromBody] CreateTopicDto dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var authorId))
        {
            return Unauthorized();
        }

        var trimmedTitle = dto.Title?.Trim() ?? string.Empty;
        if (trimmedTitle.Length > 70)
        {
            return BadRequest("Başlık en fazla 70 karakter olabilir.");
        }

        var titleExists = await _context.Topics
            .AnyAsync(t => t.Title.ToLower() == trimmedTitle.ToLower());
        if (titleExists)
        {
            return BadRequest("Bu başlık zaten mevcut.");
        }

        var topic = new Topic
        {
            Id = Guid.NewGuid(),
            Title = trimmedTitle,
            AuthorId = authorId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Topics.Add(topic);
        await _context.SaveChangesAsync();

        return Ok(topic);
    }

    private Guid? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return !string.IsNullOrEmpty(claim) && Guid.TryParse(claim, out var uid) ? uid : null;
    }

    private async Task<HashSet<Guid>> GetFollowedTopicIdsAsync(Guid userId)
    {
        return (await _context.UserTopicFollows
            .Where(utf => utf.UserId == userId)
            .Select(utf => utf.TopicId)
            .ToListAsync()).ToHashSet();
    }

    [AllowAnonymous]
    [HttpGet("latest")]
    public async Task<ActionResult<PagedTopicsDto>> GetLatest(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 50;
        if (pageSize > 100) pageSize = 100;

        var userId = GetCurrentUserId();
        var followedIds = userId.HasValue ? await GetFollowedTopicIdsAsync(userId.Value) : new HashSet<Guid>();

        var query = _context.Topics
            .Include(t => t.Author)
            .Include(t => t.Entries)
            .OrderByDescending(t => t.CreatedAt);

        var totalCount = await query.CountAsync();

        var topics = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var items = topics.Select(t => new TopicResponseDto
        {
            Id = t.Id,
            Title = t.Title,
            AuthorId = t.AuthorId,
            AuthorName = t.Author != null ? (t.Author.FirstName + " " + t.Author.LastName).Trim() : "Anonim",
            AuthorRole = t.Author?.Role ?? "User",
            CreatedAt = t.CreatedAt,
            EntryCount = t.Entries.Count,
            IsFollowedByCurrentUser = followedIds.Contains(t.Id)
        }).ToList();

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        return new PagedTopicsDto
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            TotalPages = totalPages,
            HasPreviousPage = page > 1,
            HasNextPage = page < totalPages
        };
    }

    [AllowAnonymous]
    [HttpGet("search")]
    public async Task<IActionResult> SearchTopics([FromQuery] string? q, [FromQuery] int limit = 10)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 1)
            return Ok(Array.Empty<object>());

        if (limit < 1 || limit > 50) limit = 10;
        var pattern = $"%{q.Trim()}%";

        var results = await _context.Topics
            .Where(t => EF.Functions.ILike(t.Title, pattern))
            .OrderBy(t => t.Title)
            .Take(limit)
            .Select(t => new { t.Id, t.Title })
            .ToListAsync();

        return Ok(results);
    }

    [AllowAnonymous]
    [HttpGet("alphabetical")]
    public async Task<ActionResult<PagedTopicsDto>> GetAlphabetical(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 50;
        if (pageSize > 100) pageSize = 100;

        var userId = GetCurrentUserId();
        var followedIds = userId.HasValue ? await GetFollowedTopicIdsAsync(userId.Value) : new HashSet<Guid>();

        var query = _context.Topics
            .Include(t => t.Author)
            .Include(t => t.Entries)
            .OrderBy(t => t.Title);

        var totalCount = await query.CountAsync();

        var topics = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var items = topics.Select(t => new TopicResponseDto
        {
            Id = t.Id,
            Title = t.Title,
            AuthorId = t.AuthorId,
            AuthorName = t.Author != null ? (t.Author.FirstName + " " + t.Author.LastName).Trim() : "Anonim",
            AuthorRole = t.Author?.Role ?? "User",
            CreatedAt = t.CreatedAt,
            EntryCount = t.Entries.Count,
            IsFollowedByCurrentUser = followedIds.Contains(t.Id)
        }).ToList();

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        return new PagedTopicsDto
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            TotalPages = totalPages,
            HasPreviousPage = page > 1,
            HasNextPage = page < totalPages
        };
    }

    [AllowAnonymous]
    [HttpGet("{id:guid}/entries")]
    public async Task<ActionResult<PagedEntriesDto>> GetEntriesByTopic(
        Guid id,
        [FromQuery] string? search,
        [FromQuery] string sortBy = "oldest",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 10;
        if (pageSize > 100) pageSize = 100;

        var userId = User.Identity?.IsAuthenticated == true
            && Guid.TryParse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value, out var uid)
            ? (Guid?)uid
            : null;

        var query = _context.Entries
            .Include(e => e.Author)
            .Include(e => e.Topic)
            .Where(e => e.TopicId == id);

        // Arama: Content VEYA Author (FirstName + LastName) içinde kelime geçenler (case insensitive)
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(e =>
                EF.Functions.ILike(e.Content, $"%{term}%") ||
                EF.Functions.ILike((e.Author.FirstName + " " + e.Author.LastName).Trim(), $"%{term}%"));
        }

        // Sıralama
        var effectiveSort = (sortBy ?? "oldest").ToLowerInvariant();
        query = effectiveSort switch
        {
            "newest" => query.OrderByDescending(e => e.CreatedAt),
            "most_liked" => query.OrderByDescending(e => e.Upvotes).ThenBy(e => e.Downvotes),
            "most_disliked" => query.OrderByDescending(e => e.Downvotes).ThenBy(e => e.Upvotes),
            "most_saved" => query
                .OrderByDescending(e => _context.UserSavedEntries.Count(s => s.EntryId == e.Id)),
            _ => query.OrderBy(e => e.CreatedAt) // oldest (varsayılan)
        };

        var totalCount = await query.CountAsync();

        var entriesData = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
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
        if (entriesData.Count > 0)
        {
            var entryIds = entriesData.Select(e => e.Id).ToList();
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

        var entries = new List<EntryResponseDto>();
        foreach (var e in entriesData)
        {
            var validBkzs = await BuildValidBkzsAsync(e.Content);
            var dto = BuildEntryResponse(e.Id, e.Content, e.Upvotes, e.Downvotes, e.TopicId, e.TopicTitle,
                e.AuthorId, e.AuthorName, e.AuthorAvatar, e.AuthorRole, e.CreatedAt, e.UpdatedAt, e.IsAnonymous, userId, userVotes,
                saveCounts.TryGetValue(e.Id, out var sc) ? sc : 0,
                userSavedIds.Contains(e.Id));
            dto.ValidBkzs = validBkzs;
            entries.Add(dto);
        }

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        return new PagedEntriesDto
        {
            Items = entries,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            TotalPages = totalPages,
            HasPreviousPage = page > 1,
            HasNextPage = page < totalPages
        };
    }

    [AllowAnonymous]
    [HttpGet("random")]
    public async Task<ActionResult<TopicResponseDto>> GetRandom()
    {
        var userId = GetCurrentUserId();
        var followedIds = userId.HasValue ? await GetFollowedTopicIdsAsync(userId.Value) : new HashSet<Guid>();

        var recentTopics = await _context.Topics
            .Include(t => t.Author)
            .Include(t => t.Entries)
            .OrderByDescending(t => t.CreatedAt)
            .Take(50)
            .ToListAsync();

        if (recentTopics.Count == 0)
        {
            return NotFound("Henüz başlık bulunmuyor.");
        }

        var randomIndex = Random.Shared.Next(recentTopics.Count);
        var t = recentTopics[randomIndex];
        return new TopicResponseDto
        {
            Id = t.Id,
            Title = t.Title,
            AuthorId = t.AuthorId,
            AuthorName = t.Author != null ? (t.Author.FirstName + " " + t.Author.LastName).Trim() : "Anonim",
            AuthorRole = t.Author?.Role ?? "User",
            CreatedAt = t.CreatedAt,
            EntryCount = t.Entries.Count,
            IsFollowedByCurrentUser = followedIds.Contains(t.Id)
        };
    }

    [AllowAnonymous]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TopicResponseDto>> GetById(Guid id)
    {
        var topic = await _context.Topics
            .Include(t => t.Author)
            .Include(t => t.Entries)
            .FirstOrDefaultAsync(t => t.Id == id);
        if (topic == null) return NotFound();

        var userId = GetCurrentUserId();
        var isFollowed = userId.HasValue && await _context.UserTopicFollows
            .AnyAsync(utf => utf.UserId == userId.Value && utf.TopicId == id);

        return new TopicResponseDto
        {
            Id = topic.Id,
            Title = topic.Title,
            AuthorId = topic.AuthorId,
            AuthorName = topic.Author != null ? (topic.Author.FirstName + " " + topic.Author.LastName).Trim() : "Anonim",
            AuthorRole = topic.Author?.Role ?? "User",
            CreatedAt = topic.CreatedAt,
            EntryCount = topic.Entries.Count,
            IsFollowedByCurrentUser = isFollowed
        };
    }

    [Authorize]
    [HttpPost("{id:guid}/follow")]
    public async Task<IActionResult> ToggleFollow(Guid id)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var topicExists = await _context.Topics.AnyAsync(t => t.Id == id);
        if (!topicExists)
        {
            return NotFound("Başlık bulunamadı.");
        }

        var existing = await _context.UserTopicFollows
            .FirstOrDefaultAsync(utf => utf.UserId == userId && utf.TopicId == id);

        if (existing != null)
        {
            _context.UserTopicFollows.Remove(existing);
            await _context.SaveChangesAsync();
            return Ok(new { isFollowed = false });
        }
        else
        {
            _context.UserTopicFollows.Add(new UserTopicFollow
            {
                UserId = userId,
                TopicId = id,
                CreatedAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();
            return Ok(new { isFollowed = true });
        }
    }

    [Authorize]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateTopic(Guid id, [FromBody] UpdateTopicDto? dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        if (dto == null || string.IsNullOrWhiteSpace(dto.Title))
        {
            return BadRequest("Başlık adı boş olamaz.");
        }

        var topic = await _context.Topics
            .Include(t => t.Entries)
            .FirstOrDefaultAsync(t => t.Id == id);
        if (topic == null)
        {
            return NotFound();
        }

        if (topic.AuthorId != (Guid?)userId)
        {
            return StatusCode(403, "Bu başlığı düzenleme yetkiniz yok.");
        }

        var hasOtherAuthorsEntries = (topic.Entries ?? Enumerable.Empty<Entry>()).Any(e => e.AuthorId != userId);
        if (hasOtherAuthorsEntries)
        {
            return StatusCode(403, "Bu başlıkta başkalarının da entry'si var, silemez/düzenleyemezsiniz.");
        }

        var newTitle = dto.Title.Trim();
        if (newTitle.Length > 70)
        {
            return BadRequest("Başlık en fazla 70 karakter olabilir.");
        }

        var titleExists = await _context.Topics
            .AnyAsync(t => t.Title.ToLower() == newTitle.ToLower() && t.Id != id);
        if (titleExists)
        {
            return BadRequest("Bu başlık adı zaten mevcut.");
        }

        topic.Title = newTitle;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [Authorize]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteTopic(Guid id)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var topic = await _context.Topics
            .Include(t => t.Entries)
            .FirstOrDefaultAsync(t => t.Id == id);
        if (topic == null)
        {
            return NotFound();
        }

        if (topic.AuthorId != (Guid?)userId)
        {
            return StatusCode(403, "Bu başlığı silme yetkiniz yok.");
        }

        var hasOtherAuthorsEntries = (topic.Entries ?? Enumerable.Empty<Entry>()).Any(e => e.AuthorId != userId);
        if (hasOtherAuthorsEntries)
        {
            return StatusCode(403, "Bu başlıkta başkalarının da entry'si var, silemez/düzenleyemezsiniz.");
        }

        _context.Topics.Remove(topic);
        await _context.SaveChangesAsync();

        return NoContent();
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

    private static EntryResponseDto BuildEntryResponse(
        Guid id, string content, int upvotes, int downvotes, Guid topicId, string topicTitle,
        Guid authorId, string authorName, string? authorAvatar, string authorRole, DateTime createdAt, DateTime? updatedAt, bool isAnonymous,
        Guid? requestorId, Dictionary<Guid, int> userVotes, int saveCount = 0, bool isSavedByCurrentUser = false)
    {
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
            AuthorName = isAnonymous ? "Anonim" : authorName,
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
