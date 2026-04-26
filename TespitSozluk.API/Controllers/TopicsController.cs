using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TespitSozluk.API.Data;
using TespitSozluk.API.DTOs;
using TespitSozluk.API.Entities;
using TespitSozluk.API.Helpers;
using TespitSozluk.API.Services;

namespace TespitSozluk.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TopicsController : ControllerBase
{
    /// <summary>CreateEntry ile aynı 1 dakikalık pencere üst sınırı (RateLimitService kurallarıyla uyumlu).</summary>
    private const int MaxEntriesPerRollingMinute = 3;

    private readonly AppDbContext _context;
    private readonly IRateLimitService _rateLimitService;
    private readonly IEntryMentionService _entryMentionService;
    private readonly IEntryInteractionNotificationService _entryInteractionNotifications;
    private readonly IPollService _pollService;
    private readonly ILogger<TopicsController> _logger;

    public TopicsController(
        AppDbContext context,
        IRateLimitService rateLimitService,
        IEntryMentionService entryMentionService,
        IEntryInteractionNotificationService entryInteractionNotifications,
        IPollService pollService,
        ILogger<TopicsController> logger)
    {
        _context = context;
        _rateLimitService = rateLimitService;
        _entryMentionService = entryMentionService;
        _entryInteractionNotifications = entryInteractionNotifications;
        _pollService = pollService;
        _logger = logger;
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> CreateTopic([FromBody] CreateTopicDto dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var authorId))
        {
            return Unauthorized();
        }

        var trimmedTitle = dto.Title?.Trim() ?? string.Empty;
        if (trimmedTitle.Length > 60)
        {
            return BadRequest("Başlık en fazla 60 karakter olabilir.");
        }

        var entryContentRaw = dto.FirstEntryContent ?? string.Empty;
        var normalizedEntry = NormalizeEntryContentForCreate(entryContentRaw);
        // Yeni politika: ilk entry metni boş olabilir, ANCAK içerisinde anket varsa.
        // Hem metin hem anket yoksa BadRequest.
        if (string.IsNullOrEmpty(normalizedEntry) && dto.Poll == null)
        {
            return BadRequest("İlk entry içeriği veya anket gerekli.");
        }

        var titleExists = await _context.Topics
            .AnyAsync(t => t.Title.ToLower() == trimmedTitle.ToLower());
        if (titleExists)
        {
            return BadRequest("Bu başlık zaten mevcut.");
        }

        // ── Topic/Entry INSERT öncesi bariyerler (hiçbir Topic/Entry yazılmadan) ──

        var oneMinuteAgo = DateTime.UtcNow.AddMinutes(-1);
        var entriesLastMinute = await _context.Entries.AsNoTracking()
            .CountAsync(e => e.AuthorId == authorId && e.CreatedAt >= oneMinuteAgo);
        if (entriesLastMinute >= MaxEntriesPerRollingMinute)
        {
            var oldestInWindow = await _context.Entries.AsNoTracking()
                .Where(e => e.AuthorId == authorId && e.CreatedAt >= oneMinuteAgo)
                .OrderBy(e => e.CreatedAt)
                .Select(e => e.CreatedAt)
                .FirstAsync();

            var retryAfterSeconds = Math.Max(
                1,
                Math.Ceiling((oldestInWindow.AddMinutes(1) - DateTime.UtcNow).TotalSeconds));

            Response.Headers["Retry-After"] = ((int)retryAfterSeconds).ToString();
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                message = "Çok hızlı işlem yapıyorsunuz.",
                retryAfterSeconds
            });
        }

        var topicRl = _rateLimitService.CheckAndRecord(userIdClaim, RateLimitAction.CreateTopic);
        if (!topicRl.IsAllowed)
        {
            Response.Headers["Retry-After"] = ((int)topicRl.RetryAfterSeconds).ToString();
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                message = "Çok hızlı işlem yapıyorsunuz.",
                retryAfterSeconds = topicRl.RetryAfterSeconds
            });
        }

        var entryRl = _rateLimitService.CheckAndRecord(userIdClaim, RateLimitAction.CreateEntry);
        if (!entryRl.IsAllowed)
        {
            Response.Headers["Retry-After"] = ((int)entryRl.RetryAfterSeconds).ToString();
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                message = "Çok hızlı işlem yapıyorsunuz.",
                retryAfterSeconds = entryRl.RetryAfterSeconds
            });
        }

        var topicId = Guid.NewGuid();
        var entryId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        // SEO slug — Slugify(Title) + TopicId'nin ilk 6 hex hanesi. Çakışma olasılığı pratik olarak sıfır;
        // yine de paranoyak bir güvenlik ağı olarak aynı slug varsa yeni bir Guid üretip yeniden dene.
        var slug = SlugHelper.BuildTopicSlug(trimmedTitle, topicId);
        var slugRetryGuard = 0;
        while (await _context.Topics.AsNoTracking().AnyAsync(t => t.Slug == slug) && slugRetryGuard < 5)
        {
            topicId = Guid.NewGuid();
            slug = SlugHelper.BuildTopicSlug(trimmedTitle, topicId);
            slugRetryGuard++;
        }

        var topic = new Topic
        {
            Id = topicId,
            Title = trimmedTitle,
            Slug = slug,
            AuthorId = authorId,
            CreatedAt = now,
            IsAnonymous = dto.IsAnonymous
        };

        var entry = new Entry
        {
            Id = entryId,
            Content = string.Empty,
            TopicId = topicId,
            AuthorId = authorId,
            IsAnonymous = dto.IsAnonymous,
            CreatedAt = now
        };

        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            _context.Topics.Add(topic);
            _context.Entries.Add(entry);
            entry.Content = await _entryMentionService.ApplyMentionsAndQueueNotificationsAsync(
                normalizedEntry,
                entryId,
                authorId);

            // Opsiyonel anket: dto.Poll doluysa atomik olarak Topic + Entry + Poll oluştur.
            if (dto.Poll != null)
            {
                try
                {
                    _pollService.CreatePollForEntry(entry, dto.Poll, authorId);
                }
                catch (PollValidationException ex)
                {
                    await transaction.RollbackAsync();
                    return BadRequest(new { message = ex.Message });
                }
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        var created = await _context.Topics
            .Include(t => t.Author)
            .FirstAsync(t => t.Id == topic.Id);

        return Ok(MapTopicToDto(created, authorId, false, 1, canManageTopic: true));
    }

    private static string NormalizeEntryContentForCreate(string content)
    {
        if (string.IsNullOrEmpty(content))
        {
            return content;
        }

        content = Regex.Replace(
            content,
            @"^(<p>\s*</p>|<p><br\s*/?></p>|<br\s*/?>|\s)+",
            "",
            RegexOptions.IgnoreCase);
        content = Regex.Replace(
            content,
            @"(<p>\s*</p>|<p><br\s*/?></p>|<br\s*/?>|\s)+$",
            "",
            RegexOptions.IgnoreCase);
        return content.Trim();
    }

    private static TopicResponseDto MapTopicToDto(Topic topic, Guid? currentUserId, bool isFollowed, int entryCount, bool canManageTopic)
    {
        var author = topic.Author;
        var effectiveAnon = topic.IsAnonymous || !topic.AuthorId.HasValue || author == null;
        var isOwner = currentUserId.HasValue && topic.AuthorId.HasValue && topic.AuthorId.Value == currentUserId.Value;

        return new TopicResponseDto
        {
            Id = topic.Id,
            Title = topic.Title,
            Slug = topic.Slug ?? string.Empty,
            AuthorId = effectiveAnon ? null : topic.AuthorId,
            AuthorName = effectiveAnon
                ? "Anonim"
                : ($"{author!.FirstName} {author.LastName}").Trim(),
            AuthorUsername = effectiveAnon || author == null || string.IsNullOrWhiteSpace(author.Username)
                ? null
                : author.Username.Trim(),
            AuthorAvatar = effectiveAnon ? null : author?.Avatar,
            AuthorRole = author?.Role ?? "User",
            CreatedAt = topic.CreatedAt,
            EntryCount = entryCount,
            IsFollowedByCurrentUser = isFollowed,
            IsAnonymous = effectiveAnon,
            IsTopicOwner = isOwner,
            CanManageTopic = canManageTopic
        };
    }

    /// <summary>
    /// Liste ve tekil sorgularda entry metinlerini çekmeden TopicResponseDto üretir (SQL tarafında Count).
    /// </summary>
    private static TopicResponseDto MapTopicProjectionToDto(
        Guid id,
        string title,
        string? slug,
        Guid? authorId,
        DateTime createdAt,
        bool isAnonymousTopic,
        bool hasAuthor,
        string? authorFirstName,
        string? authorLastName,
        string? authorUsername,
        string? authorAvatar,
        string? authorRole,
        int entryCount,
        Guid? currentUserId,
        bool isFollowed,
        bool canManageTopic)
    {
        var effectiveAnon = isAnonymousTopic || !authorId.HasValue || !hasAuthor;
        var isOwner = currentUserId.HasValue && authorId.HasValue && authorId.Value == currentUserId.Value;

        return new TopicResponseDto
        {
            Id = id,
            Title = title,
            Slug = slug ?? string.Empty,
            AuthorId = effectiveAnon ? null : authorId,
            AuthorName = effectiveAnon
                ? "Anonim"
                : ($"{authorFirstName ?? ""} {authorLastName ?? ""}").Trim(),
            AuthorUsername = effectiveAnon || string.IsNullOrWhiteSpace(authorUsername)
                ? null
                : authorUsername!.Trim(),
            AuthorAvatar = effectiveAnon ? null : authorAvatar,
            AuthorRole = string.IsNullOrEmpty(authorRole) ? "User" : authorRole!,
            CreatedAt = createdAt,
            EntryCount = entryCount,
            IsFollowedByCurrentUser = isFollowed,
            IsAnonymous = effectiveAnon,
            IsTopicOwner = isOwner,
            CanManageTopic = canManageTopic
        };
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

    /// <summary>
    /// Oturum sahibinin açtığı başlıklarda, başka bir kullanıcıya ait entry olan başlık Id'leri.
    /// </summary>
    private async Task<HashSet<Guid>> GetTopicIdsWithForeignEntriesAsync(Guid currentUserId, List<Guid> topicIdsOwnedByCurrentUser)
    {
        if (topicIdsOwnedByCurrentUser.Count == 0) return new HashSet<Guid>();
        return (await _context.Entries.AsNoTracking()
            .Where(e => topicIdsOwnedByCurrentUser.Contains(e.TopicId) && e.AuthorId != currentUserId)
            .Select(e => e.TopicId)
            .Distinct()
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

        var query = _context.Topics.AsNoTracking()
            .OrderByDescending(t =>
                t.Entries.Select(e => (DateTime?)e.CreatedAt).Max() ?? t.CreatedAt);

        var totalCount = await query.CountAsync();

        var rows = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.Slug,
                t.AuthorId,
                t.CreatedAt,
                t.IsAnonymous,
                HasAuthor = t.Author != null,
                AuthorFirstName = t.Author != null ? t.Author.FirstName : null,
                AuthorLastName = t.Author != null ? t.Author.LastName : null,
                AuthorUsername = t.Author != null ? t.Author.Username : null,
                AuthorAvatar = t.Author != null ? t.Author.Avatar : null,
                AuthorRole = t.Author != null ? t.Author.Role : null,
                EntryCount = t.Entries.Count()
            })
            .ToListAsync();

        HashSet<Guid> topicIdsWithForeignEntries = new();
        if (userId.HasValue && rows.Count > 0)
        {
            var myTopicIds = rows.Where(r => r.AuthorId == userId.Value).Select(r => r.Id).ToList();
            topicIdsWithForeignEntries = await GetTopicIdsWithForeignEntriesAsync(userId.Value, myTopicIds);
        }

        var items = rows
            .Select(r => MapTopicProjectionToDto(
                r.Id,
                r.Title,
                r.Slug,
                r.AuthorId,
                r.CreatedAt,
                r.IsAnonymous,
                r.HasAuthor,
                r.AuthorFirstName,
                r.AuthorLastName,
                r.AuthorUsername,
                r.AuthorAvatar,
                r.AuthorRole,
                r.EntryCount,
                userId,
                followedIds.Contains(r.Id),
                userId.HasValue && r.AuthorId == userId && !topicIdsWithForeignEntries.Contains(r.Id)))
            .ToList();

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

    /// <summary>
    /// Başlık varlığı — tek satır, AsNoTracking; başlık eşleşmesi CreateTopic ile aynı (büyük/küçük harf duyarsız).
    /// </summary>
    [AllowAnonymous]
    [HttpGet("exists")]
    public async Task<ActionResult<TopicExistsResponseDto>> TopicExists([FromQuery] string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Ok(new TopicExistsResponseDto(false, null));
        }

        var n = name.Trim();
        if (n.Length > 60)
        {
            return Ok(new TopicExistsResponseDto(false, null));
        }

        var row = await _context.Topics
            .AsNoTracking()
            .Where(t => t.Title.ToLower() == n.ToLower())
            .Select(t => new { t.Id })
            .FirstOrDefaultAsync();

        return Ok(new TopicExistsResponseDto(row != null, row?.Id));
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

        var query = _context.Topics.AsNoTracking()
            .OrderBy(t => t.Title);

        var totalCount = await query.CountAsync();

        var rows = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.Slug,
                t.AuthorId,
                t.CreatedAt,
                t.IsAnonymous,
                HasAuthor = t.Author != null,
                AuthorFirstName = t.Author != null ? t.Author.FirstName : null,
                AuthorLastName = t.Author != null ? t.Author.LastName : null,
                AuthorUsername = t.Author != null ? t.Author.Username : null,
                AuthorAvatar = t.Author != null ? t.Author.Avatar : null,
                AuthorRole = t.Author != null ? t.Author.Role : null,
                EntryCount = t.Entries.Count()
            })
            .ToListAsync();

        HashSet<Guid> topicIdsWithForeignEntriesAlpha = new();
        if (userId.HasValue && rows.Count > 0)
        {
            var myTopicIds = rows.Where(r => r.AuthorId == userId.Value).Select(r => r.Id).ToList();
            topicIdsWithForeignEntriesAlpha = await GetTopicIdsWithForeignEntriesAsync(userId.Value, myTopicIds);
        }

        var items = rows
            .Select(r => MapTopicProjectionToDto(
                r.Id,
                r.Title,
                r.Slug,
                r.AuthorId,
                r.CreatedAt,
                r.IsAnonymous,
                r.HasAuthor,
                r.AuthorFirstName,
                r.AuthorLastName,
                r.AuthorUsername,
                r.AuthorAvatar,
                r.AuthorRole,
                r.EntryCount,
                userId,
                followedIds.Contains(r.Id),
                userId.HasValue && r.AuthorId == userId && !topicIdsWithForeignEntriesAlpha.Contains(r.Id)))
            .ToList();

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

        var bkzBag = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var mentionBag = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var e in entriesData)
        {
            BkzTopicHelper.CollectBkzTermsToBag(e.Content, bkzBag);
            MentionHelper.CollectMentionHandlesToBag(e.Content, mentionBag);
        }

        var mentionMaps = await MentionHelper.LoadMentionUserMapsAsync(_context, mentionBag, Array.Empty<Guid>());
        var bkzMaps = await BkzTopicHelper.LoadBkzTopicMapsAsync(_context, bkzBag);

        var entries = new List<EntryResponseDto>();
        foreach (var e in entriesData)
        {
            var contentForBkz = MentionHelper.ApplyMentionsMarkdown(e.Content, mentionMaps);
            var validBkzs = BkzTopicHelper.BuildValidBkzs(contentForBkz, bkzMaps);
            var contentOut = BkzTopicHelper.ApplyBkzHtmlToContent(contentForBkz, bkzMaps);
            var dto = BuildEntryResponse(e.Id, contentOut, e.Upvotes, e.Downvotes, e.TopicId, e.TopicTitle,
                e.AuthorId, e.AuthorName, e.AuthorAvatar, e.AuthorRole, e.CreatedAt, e.UpdatedAt, e.IsAnonymous, userId, userVotes,
                saveCounts.TryGetValue(e.Id, out var sc) ? sc : 0,
                userSavedIds.Contains(e.Id));
            dto.ValidBkzs = validBkzs;
            entries.Add(dto);
        }

        if (entries.Count > 0)
        {
            var pollMap = await _pollService.BuildPollsForEntriesAsync(
                entries.Select(e => e.Id).ToList(), userId, HttpContext.RequestAborted);
            if (pollMap.Count > 0)
            {
                foreach (var e in entries)
                {
                    if (pollMap.TryGetValue(e.Id, out var p)) e.Poll = p;
                }
            }
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

        var recentTopics = await _context.Topics.AsNoTracking()
            .OrderByDescending(t => t.CreatedAt)
            .Take(50)
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.Slug,
                t.AuthorId,
                t.CreatedAt,
                t.IsAnonymous,
                HasAuthor = t.Author != null,
                AuthorFirstName = t.Author != null ? t.Author.FirstName : null,
                AuthorLastName = t.Author != null ? t.Author.LastName : null,
                AuthorUsername = t.Author != null ? t.Author.Username : null,
                AuthorAvatar = t.Author != null ? t.Author.Avatar : null,
                AuthorRole = t.Author != null ? t.Author.Role : null,
                EntryCount = t.Entries.Count()
            })
            .ToListAsync();

        if (recentTopics.Count == 0)
        {
            return NotFound("Henüz başlık bulunmuyor.");
        }

        var r = recentTopics[Random.Shared.Next(recentTopics.Count)];
        var canManageRandom = false;
        if (userId.HasValue && r.AuthorId == userId)
        {
            canManageRandom = !await _context.Entries.AsNoTracking()
                .AnyAsync(e => e.TopicId == r.Id && e.AuthorId != userId.Value);
        }

        return MapTopicProjectionToDto(
            r.Id,
            r.Title,
            r.Slug,
            r.AuthorId,
            r.CreatedAt,
            r.IsAnonymous,
            r.HasAuthor,
            r.AuthorFirstName,
            r.AuthorLastName,
            r.AuthorUsername,
            r.AuthorAvatar,
            r.AuthorRole,
            r.EntryCount,
            userId,
            followedIds.Contains(r.Id),
            canManageRandom);
    }

    [AllowAnonymous]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TopicResponseDto>> GetById(Guid id)
    {
        var row = await _context.Topics.AsNoTracking()
            .Where(t => t.Id == id)
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.Slug,
                t.AuthorId,
                t.CreatedAt,
                t.IsAnonymous,
                HasAuthor = t.Author != null,
                AuthorFirstName = t.Author != null ? t.Author.FirstName : null,
                AuthorLastName = t.Author != null ? t.Author.LastName : null,
                AuthorUsername = t.Author != null ? t.Author.Username : null,
                AuthorAvatar = t.Author != null ? t.Author.Avatar : null,
                AuthorRole = t.Author != null ? t.Author.Role : null,
                EntryCount = t.Entries.Count()
            })
            .FirstOrDefaultAsync();
        if (row == null) return NotFound();

        var userId = GetCurrentUserId();
        var isFollowed = userId.HasValue && await _context.UserTopicFollows
            .AsNoTracking()
            .AnyAsync(utf => utf.UserId == userId.Value && utf.TopicId == id);

        var canManageById = false;
        if (userId.HasValue && row.AuthorId.HasValue && row.AuthorId.Value == userId.Value)
        {
            canManageById = !await _context.Entries.AsNoTracking()
                .AnyAsync(e => e.TopicId == id && e.AuthorId != userId.Value);
        }

        return MapTopicProjectionToDto(
            row.Id,
            row.Title,
            row.Slug,
            row.AuthorId,
            row.CreatedAt,
            row.IsAnonymous,
            row.HasAuthor,
            row.AuthorFirstName,
            row.AuthorLastName,
            row.AuthorUsername,
            row.AuthorAvatar,
            row.AuthorRole,
            row.EntryCount,
            userId,
            isFollowed,
            canManageById);
    }

    /// <summary>
    /// SEO dostu URL için: ID yerine Slug ile başlık getirir. Mevcut GetById(id) endpoint'i
    /// aynen korunur; bu endpoint onun yanında çalışır ve aynı DTO şeklini döner.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("slug/{slug}")]
    public async Task<ActionResult<TopicResponseDto>> GetBySlug(string slug)
    {
        if (string.IsNullOrWhiteSpace(slug))
        {
            return NotFound();
        }

        var normalizedSlug = slug.Trim().ToLowerInvariant();

        var row = await _context.Topics.AsNoTracking()
            .Where(t => t.Slug == normalizedSlug)
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.Slug,
                t.AuthorId,
                t.CreatedAt,
                t.IsAnonymous,
                HasAuthor = t.Author != null,
                AuthorFirstName = t.Author != null ? t.Author.FirstName : null,
                AuthorLastName = t.Author != null ? t.Author.LastName : null,
                AuthorUsername = t.Author != null ? t.Author.Username : null,
                AuthorAvatar = t.Author != null ? t.Author.Avatar : null,
                AuthorRole = t.Author != null ? t.Author.Role : null,
                EntryCount = t.Entries.Count()
            })
            .FirstOrDefaultAsync();
        if (row == null) return NotFound();

        var userId = GetCurrentUserId();
        var isFollowed = userId.HasValue && await _context.UserTopicFollows
            .AsNoTracking()
            .AnyAsync(utf => utf.UserId == userId.Value && utf.TopicId == row.Id);

        var canManageBySlug = false;
        if (userId.HasValue && row.AuthorId.HasValue && row.AuthorId.Value == userId.Value)
        {
            canManageBySlug = !await _context.Entries.AsNoTracking()
                .AnyAsync(e => e.TopicId == row.Id && e.AuthorId != userId.Value);
        }

        return MapTopicProjectionToDto(
            row.Id,
            row.Title,
            row.Slug,
            row.AuthorId,
            row.CreatedAt,
            row.IsAnonymous,
            row.HasAuthor,
            row.AuthorFirstName,
            row.AuthorLastName,
            row.AuthorUsername,
            row.AuthorAvatar,
            row.AuthorRole,
            row.EntryCount,
            userId,
            isFollowed,
            canManageBySlug);
    }

    /// <summary>
    /// Slug üzerinden başlığın entry'lerini, mevcut `GET /api/Topics/{id}/entries` ile birebir
    /// aynı biçimde döner. Önce slug→id çözümlemesi yapılır, sonra ID tabanlı metoda devredilir.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("slug/{slug}/entries")]
    public async Task<ActionResult<PagedEntriesDto>> GetEntriesByTopicSlug(
        string slug,
        [FromQuery] string? search,
        [FromQuery] string sortBy = "oldest",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        if (string.IsNullOrWhiteSpace(slug))
        {
            return NotFound();
        }

        var normalizedSlug = slug.Trim().ToLowerInvariant();
        var topicId = await _context.Topics.AsNoTracking()
            .Where(t => t.Slug == normalizedSlug)
            .Select(t => (Guid?)t.Id)
            .FirstOrDefaultAsync();

        if (topicId == null)
        {
            return NotFound();
        }

        return await GetEntriesByTopic(topicId.Value, search, sortBy, page, pageSize);
    }

    [Authorize]
    [EnableRateLimiting("interaction")]
    [HttpPost("{id:guid}/follow")]
    public async Task<IActionResult> ToggleFollow(Guid id)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var topicRow = await _context.Topics
            .AsNoTracking()
            .Select(t => new { t.Id, t.AuthorId })
            .FirstOrDefaultAsync(t => t.Id == id);
        if (topicRow == null)
        {
            return NotFound("Başlık bulunamadı.");
        }

        var existing = await _context.UserTopicFollows
            .FirstOrDefaultAsync(utf => utf.UserId == userId && utf.TopicId == id);

        if (existing != null)
        {
            if (topicRow.AuthorId is Guid authorId && authorId != Guid.Empty)
            {
                try
                {
                    _entryInteractionNotifications.RemoveTopicFollowNotification(authorId, userId, id);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Başlık takip bildirimi silinemedi. TopicId={TopicId}", id);
                }
            }

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

            if (topicRow.AuthorId is Guid topicAuthorId &&
                topicAuthorId != Guid.Empty &&
                topicAuthorId != userId)
            {
                var topicFollowMessages = new[]
                {
                    "👓 Gizemli birisi başlığını takip etmeye başladı.",
                    "👓 Gizemli birisi başlığını takip etti, gündeme oturuyorsun.",
                    "👓 Başlığın tuttu, takip edenler var.",
                };
                var message = topicFollowMessages[Random.Shared.Next(topicFollowMessages.Length)];
                try
                {
                    _entryInteractionNotifications.TryNotifyTopicAuthorOnFollow(id, topicAuthorId, userId, message);
                    await _context.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Başlık takip bildirimi kaydedilemedi. TopicId={TopicId}, AuthorId={AuthorId}", id, topicAuthorId);
                }
            }

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

        var topic = await _context.Topics.FirstOrDefaultAsync(t => t.Id == id);
        if (topic == null)
        {
            return NotFound();
        }

        if (!topic.AuthorId.HasValue || topic.AuthorId.Value != userId)
        {
            return StatusCode(403, "Bu başlığı düzenleme yetkiniz yok.");
        }

        var newTitle = dto.Title.Trim();
        if (newTitle.Length > 60)
        {
            return BadRequest("Başlık en fazla 60 karakter olabilir.");
        }

        var titleChanged = !string.Equals(newTitle, topic.Title, StringComparison.Ordinal);
        var anonChanged = dto.IsAnonymous.HasValue && dto.IsAnonymous.Value != topic.IsAnonymous;

        // Başlık adı değişiyorsa, altında başka yazarların entry'leri olamaz (mevcut kısıt).
        // Sadece anonimlik değişiyorsa (başlık adı aynı) bu kısıt devreye girmez —
        // anonimlik Topic tablosunda izole bir bayraktır, başkalarının entry'lerini etkilemez.
        if (titleChanged)
        {
            var hasOtherAuthorsEntries = await _context.Entries
                .AnyAsync(e => e.TopicId == id && e.AuthorId != userId);
            if (hasOtherAuthorsEntries)
            {
                return StatusCode(403, "Bu başlıkta başkalarının da entry'si var, silemez/düzenleyemezsiniz.");
            }

            var titleExists = await _context.Topics
                .AnyAsync(t => t.Title.ToLower() == newTitle.ToLower() && t.Id != id);
            if (titleExists)
            {
                return BadRequest("Bu başlık adı zaten mevcut.");
            }

            topic.Title = newTitle;
        }

        // KRİTİK: Yalnızca Topic.IsAnonymous alanı güncellenir.
        // Bu başlığa ait ilk entry veya diğer hiçbir entry'nin IsAnonymous değeri
        // bu endpoint tarafından DEĞİŞTİRİLMEZ — başlık ve entry anonimliği bağımsızdır.
        if (anonChanged)
        {
            topic.IsAnonymous = dto.IsAnonymous!.Value;
        }

        if (titleChanged || anonChanged)
        {
            await _context.SaveChangesAsync();
        }

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

        var topic = await _context.Topics.FirstOrDefaultAsync(t => t.Id == id);
        if (topic == null)
        {
            return NotFound();
        }

        if (!topic.AuthorId.HasValue || topic.AuthorId.Value != userId)
        {
            return StatusCode(403, "Bu başlığı silme yetkiniz yok.");
        }

        var hasOtherAuthorsEntries = await _context.Entries
            .AnyAsync(e => e.TopicId == id && e.AuthorId != userId);
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

}
