using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TespitSozluk.API.Data;
using TespitSozluk.API.DTOs;
using TespitSozluk.API.Entities;
using TespitSozluk.API.Filters;
using TespitSozluk.API.Helpers;
using TespitSozluk.API.Services;

namespace TespitSozluk.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EntriesController : ControllerBase
{
    private record FeedEntryData(Guid Id, string Content, int Upvotes, int Downvotes, Guid TopicId, string TopicTitle,
        Guid AuthorId, string AuthorName, string? AuthorAvatar, string AuthorRole, DateTime CreatedAt, DateTime? UpdatedAt, bool IsAnonymous);

    private readonly AppDbContext _context;
    private readonly IEntryDeletionService _entryDeletionService;
    private readonly IEntryInteractionNotificationService _entryInteractionNotifications;
    private readonly IEntryLikesService _entryLikesService;
    private readonly IEntryMentionService _entryMentionService;
    private readonly IPollService _pollService;
    private readonly INoviceStatusService _noviceStatus;
    private readonly ILogger<EntriesController> _logger;

    public EntriesController(
        AppDbContext context,
        IEntryDeletionService entryDeletionService,
        IEntryInteractionNotificationService entryInteractionNotifications,
        IEntryLikesService entryLikesService,
        IEntryMentionService entryMentionService,
        IPollService pollService,
        INoviceStatusService noviceStatus,
        ILogger<EntriesController> logger)
    {
        _context = context;
        _entryDeletionService = entryDeletionService;
        _entryInteractionNotifications = entryInteractionNotifications;
        _entryLikesService = entryLikesService;
        _entryMentionService = entryMentionService;
        _pollService = pollService;
        _noviceStatus = noviceStatus;
        _logger = logger;
    }

    /// <summary>
    /// Entry içeriğini normalleştirir: baştaki/sondaki boş paragraf, br ve whitespace temizlenir.
    /// </summary>
    private static string NormalizeEntryHtml(string? content)
    {
        if (string.IsNullOrEmpty(content)) return string.Empty;
        var c = System.Text.RegularExpressions.Regex.Replace(
            content,
            @"^(<p>\s*</p>|<p><br\s*/?></p>|<br\s*/?>|\s)+",
            "",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        c = System.Text.RegularExpressions.Regex.Replace(
            c,
            @"(<p>\s*</p>|<p><br\s*/?></p>|<br\s*/?>|\s)+$",
            "",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        return c.Trim();
    }

    /// <summary>Verilen entry-DTO listesine ait anket verilerini tek batch'te iliştirir.</summary>
    private async Task AttachPollsAsync(IList<EntryResponseDto> dtos, Guid? requestorId)
    {
        if (dtos == null || dtos.Count == 0) return;
        var ids = dtos.Select(d => d.Id).ToList();
        var pollMap = await _pollService.BuildPollsForEntriesAsync(ids, requestorId, HttpContext.RequestAborted);
        if (pollMap.Count == 0) return;
        foreach (var dto in dtos)
        {
            if (pollMap.TryGetValue(dto.Id, out var p)) dto.Poll = p;
        }
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

        var bkzBag = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var mentionBag = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var e in entries)
        {
            BkzTopicHelper.CollectBkzTermsToBag(e.Content, bkzBag);
            MentionHelper.CollectMentionHandlesToBag(e.Content, mentionBag);
        }

        var mentionMaps = await MentionHelper.LoadMentionUserMapsAsync(_context, mentionBag, Array.Empty<Guid>());
        var bkzMaps = await BkzTopicHelper.LoadBkzTopicMapsAsync(_context, bkzBag);

        var feedNoviceIds = entries.Where(e => !e.IsAnonymous).Select(e => e.AuthorId).Distinct().ToList();
        var feedNoviceMap = await _noviceStatus.GetIsNoviceMapAsync(feedNoviceIds);

        var result = new List<EntryResponseDto>();
        foreach (var e in entries)
        {
            var contentForBkz = MentionHelper.ApplyMentionsMarkdown(e.Content, mentionMaps);
            var validBkzs = BkzTopicHelper.BuildValidBkzs(contentForBkz, bkzMaps);
            var contentOut = BkzTopicHelper.ApplyBkzHtmlToContent(contentForBkz, bkzMaps);
            var aNov = e.IsAnonymous ? false : feedNoviceMap.GetValueOrDefault(e.AuthorId, true);
            var dto = MapToPublicResponse(e.Id, contentOut, e.Upvotes, e.Downvotes, e.TopicId, e.TopicTitle,
                e.AuthorId, e.AuthorName, e.AuthorAvatar, e.AuthorRole, e.CreatedAt, e.UpdatedAt, e.IsAnonymous, userId, userVotes,
                saveCounts.TryGetValue(e.Id, out var sc) ? sc : 0,
                userSavedIds.Contains(e.Id),
                aNov);
            dto.ValidBkzs = validBkzs;
            result.Add(dto);
        }

        await AttachPollsAsync(result, userId);

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
        var mentionBagSingle = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        MentionHelper.CollectMentionHandlesToBag(entry.Content, mentionBagSingle);
        var mentionMapsSingle = await MentionHelper.LoadMentionUserMapsAsync(_context, mentionBagSingle, Array.Empty<Guid>());
        var contentForBkzSingle = MentionHelper.ApplyMentionsMarkdown(entry.Content, mentionMapsSingle);
        var (validBkzs, bkzMaps) = await BkzTopicHelper.BuildValidBkzsAndMapsAsync(_context, contentForBkzSingle);
        var contentOut = BkzTopicHelper.ApplyBkzHtmlToContent(contentForBkzSingle, bkzMaps);
        var singleNovice = entry.IsAnonymous
            ? false
            : (await _noviceStatus.GetIsNoviceMapAsync(new[] { entry.AuthorId })).GetValueOrDefault(entry.AuthorId, true);
        var dto = MapToPublicResponse(
            entry.Id, contentOut, entry.Upvotes, entry.Downvotes,
            entry.TopicId, entry.Topic!.Title, entry.AuthorId, authorName, authorAvatar, authorRole,
            entry.CreatedAt, entry.UpdatedAt, entry.IsAnonymous,
            userId, userVotes,
            saveCounts.TryGetValue(id, out var sc) ? sc : 0,
            userSavedIds.Contains(id),
            singleNovice);
        dto.ValidBkzs = validBkzs;

        var singleList = new List<EntryResponseDto> { dto };
        await AttachPollsAsync(singleList, userId);

        return dto;
    }

    /// <summary>Yalnızca entry sahibi: beğenen (upvote) kullanıcıların listesi. Kaydetme ve downvote dahil değildir.</summary>
    [Authorize]
    [HttpGet("{id:guid}/likes")]
    public async Task<ActionResult<IReadOnlyList<UserSearchResultDto>>> GetEntryLikes(Guid id)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var requestorId))
        {
            return Unauthorized();
        }

        var result = await _entryLikesService.GetUpvotersForEntryAuthorAsync(id, requestorId);
        if (!result.EntryExists)
        {
            return NotFound();
        }

        if (!result.RequestorIsAuthor)
        {
            return Forbid();
        }

        return Ok(result.Upvoters);
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

        var bkzBag = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var mentionBag = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var e in entries)
        {
            BkzTopicHelper.CollectBkzTermsToBag(e.Content, bkzBag);
            MentionHelper.CollectMentionHandlesToBag(e.Content, mentionBag);
        }

        var mentionMaps = await MentionHelper.LoadMentionUserMapsAsync(_context, mentionBag, Array.Empty<Guid>());
        var bkzMaps = await BkzTopicHelper.LoadBkzTopicMapsAsync(_context, bkzBag);

        var noviceIdsList = entries.Where(e => !e.IsAnonymous).Select(e => e.AuthorId).Distinct().ToList();
        var noviceMapList = await _noviceStatus.GetIsNoviceMapAsync(noviceIdsList);

        var result = new List<EntryResponseDto>();
        foreach (var e in entries)
        {
            var contentForBkz = MentionHelper.ApplyMentionsMarkdown(e.Content, mentionMaps);
            var validBkzs = BkzTopicHelper.BuildValidBkzs(contentForBkz, bkzMaps);
            var contentOut = BkzTopicHelper.ApplyBkzHtmlToContent(contentForBkz, bkzMaps);
            var aNov = e.IsAnonymous ? false : noviceMapList.GetValueOrDefault(e.AuthorId, true);
            var dto = MapToPublicResponse(e.Id, contentOut, e.Upvotes, e.Downvotes, e.TopicId, e.TopicTitle,
                e.AuthorId, e.AuthorName, e.AuthorAvatar, e.AuthorRole, e.CreatedAt, e.UpdatedAt, e.IsAnonymous, userId, userVotes,
                saveCounts.TryGetValue(e.Id, out var sc) ? sc : 0,
                userSavedIds.Contains(e.Id),
                aNov);
            dto.ValidBkzs = validBkzs;
            result.Add(dto);
        }

        await AttachPollsAsync(result, userId);

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

        dto.Content = NormalizeEntryHtml(dto.Content);

        // Yeni politika: entry metni boş olabilir, ANCAK içerisinde anket varsa.
        // Hem metin hem anket yoksa BadRequest.
        if (string.IsNullOrWhiteSpace(dto.Content) && dto.Poll == null)
        {
            return BadRequest("Entry içeriği veya anket gerekli.");
        }

        var entry = new Entry
        {
            Id = Guid.NewGuid(),
            Content = string.Empty,
            TopicId = dto.TopicId,
            AuthorId = authorId,
            IsAnonymous = dto.IsAnonymous,
            CreatedAt = DateTime.UtcNow
        };

        _context.Entries.Add(entry);
        entry.Content = await _entryMentionService.ApplyMentionsAndQueueNotificationsAsync(
            (dto.Content ?? string.Empty).Trim(),
            entry.Id,
            authorId);

        // Opsiyonel anket: yalnızca dto.Poll doluysa oluştur. Mevcut entry akışı (anketsiz)
        // aynen korunur; Poll doğrulaması burada başarısız olursa entry de oluşturulmaz.
        if (dto.Poll != null)
        {
            try
            {
                _pollService.CreatePollForEntry(entry, dto.Poll, authorId);
            }
            catch (PollValidationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        await _context.SaveChangesAsync();

        var author = await _context.Users.FindAsync(authorId);
        var topic = await _context.Topics.FindAsync(entry.TopicId);
        var noviceMapCreate = await _noviceStatus.GetIsNoviceMapAsync(new[] { authorId });
        var isNoviceCreate = entry.IsAnonymous ? false : noviceMapCreate.GetValueOrDefault(authorId, true);
        var response = MapToResponseDto(entry, author!, topic!, 0, true, isNoviceCreate);
        var mentionBagCreate = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        MentionHelper.CollectMentionHandlesToBag(entry.Content, mentionBagCreate);
        var mentionMapsCreate = await MentionHelper.LoadMentionUserMapsAsync(_context, mentionBagCreate, Array.Empty<Guid>());
        var contentForBkzCreate = MentionHelper.ApplyMentionsMarkdown(entry.Content, mentionMapsCreate);
        var (validBkzs, bkzMaps) = await BkzTopicHelper.BuildValidBkzsAndMapsAsync(_context, contentForBkzCreate);
        response.ValidBkzs = validBkzs;
        response.Content = BkzTopicHelper.ApplyBkzHtmlToContent(contentForBkzCreate, bkzMaps);
        response.SaveCount = 0;
        response.IsSavedByCurrentUser = false;

        if (dto.Poll != null)
        {
            var pollMap = await _pollService.BuildPollsForEntriesAsync(new[] { entry.Id }, authorId, HttpContext.RequestAborted);
            if (pollMap.TryGetValue(entry.Id, out var pollDto))
            {
                response.Poll = pollDto;
            }
        }

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

        dto.Content = NormalizeEntryHtml(dto.Content);

        // ── Anket güncelleme/silme/oluşturma niyetini önceden ölç ──
        // Update sonrası entry'nin ankete sahip olup olmayacağını belirlemek için.
        var hasPollPayload = dto.Poll != null;
        var willHavePoll = hasPollPayload // yeni anket payload'ı varsa
            || (!dto.RemovePoll && await _context.Polls.AsNoTracking().AnyAsync(p => p.EntryId == entry.Id));

        // Yeni politika: entry metni boş olabilir, ANCAK içerisinde anket olacaksa.
        if (string.IsNullOrWhiteSpace(dto.Content) && !willHavePoll)
        {
            return BadRequest("Entry içeriği veya anket gerekli.");
        }

        entry.Content = (dto.Content ?? string.Empty).Trim();
        entry.UpdatedAt = DateTime.UtcNow;

        // ── Anonimlik güncellemesi (opsiyonel) ──
        // dto.IsAnonymous yalnızca yollandıysa (null değilse) geçerlidir.
        // KRİTİK: Güncellenen entry, ilgili başlığın İLK ENTRY'si ise (TopicId bazında
        // en eski CreatedAt; eşitlikte Id sıralaması ile tiebreaker) başlığın
        // IsAnonymous değeri de aynı değere çekilir. Aksi halde yalnızca entry güncellenir.
        if (dto.IsAnonymous.HasValue && dto.IsAnonymous.Value != entry.IsAnonymous)
        {
            entry.IsAnonymous = dto.IsAnonymous.Value;

            var firstEntryId = await _context.Entries
                .AsNoTracking()
                .Where(e => e.TopicId == entry.TopicId)
                .OrderBy(e => e.CreatedAt)
                .ThenBy(e => e.Id)
                .Select(e => e.Id)
                .FirstOrDefaultAsync();

            if (firstEntryId == entry.Id)
            {
                var topicToSync = await _context.Topics.FirstOrDefaultAsync(t => t.Id == entry.TopicId);
                if (topicToSync != null && topicToSync.IsAnonymous != entry.IsAnonymous)
                {
                    topicToSync.IsAnonymous = entry.IsAnonymous;
                }
            }
        }

        // ── Anket güncelleme ──
        // 1) dto.Poll doluysa: upsert (yeni oluştur veya mevcudu güncelle).
        // 2) Aksi halde dto.RemovePoll true ise: mevcut anketi sil.
        // 3) Hiçbiri yoksa: anket dokunulmaz.
        if (dto.Poll != null)
        {
            try
            {
                await _pollService.UpdatePollForEntryAsync(entry, dto.Poll, authorId, HttpContext.RequestAborted);
            }
            catch (PollValidationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
        else if (dto.RemovePoll)
        {
            await _pollService.DeletePollForEntryAsync(entry.Id, HttpContext.RequestAborted);
        }

        await _context.SaveChangesAsync();

        var author = await _context.Users.FindAsync(entry.AuthorId);
        var topic = await _context.Topics.FindAsync(entry.TopicId);
        var userVoteType = 0;
        var vote = await _context.EntryVotes
            .FirstOrDefaultAsync(v => v.EntryId == id && v.UserId == authorId);
        if (vote != null) userVoteType = vote.IsUpvote ? 1 : -1;
        var noviceMapUpdate = await _noviceStatus.GetIsNoviceMapAsync(new[] { entry.AuthorId });
        var isNoviceUpdate = entry.IsAnonymous ? false : noviceMapUpdate.GetValueOrDefault(entry.AuthorId, true);
        var response = MapToResponseDto(entry, author!, topic!, userVoteType, true, isNoviceUpdate);
        var mentionBagUpdate = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        MentionHelper.CollectMentionHandlesToBag(entry.Content, mentionBagUpdate);
        var mentionMapsUpdate = await MentionHelper.LoadMentionUserMapsAsync(_context, mentionBagUpdate, Array.Empty<Guid>());
        var contentForBkzUpdate = MentionHelper.ApplyMentionsMarkdown(entry.Content, mentionMapsUpdate);
        var (validBkzs, bkzMaps) = await BkzTopicHelper.BuildValidBkzsAndMapsAsync(_context, contentForBkzUpdate);
        response.ValidBkzs = validBkzs;
        response.Content = BkzTopicHelper.ApplyBkzHtmlToContent(contentForBkzUpdate, bkzMaps);
        var (saveCounts, userSavedIds) = await GetSaveDataAsync(new List<Guid> { id }, authorId);
        response.SaveCount = saveCounts.TryGetValue(id, out var sc) ? sc : 0;
        response.IsSavedByCurrentUser = userSavedIds.Contains(id);

        var updateList = new List<EntryResponseDto> { response };
        await AttachPollsAsync(updateList, authorId);

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

        await _entryDeletionService.DeleteEntryAndPruneEmptyTopicAsync(entry);

        return NoContent();
    }

    [Authorize]
    [EnableRateLimiting("interaction")]
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

        var shouldNotifyLike = false;
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
            shouldNotifyLike = true;
        }
        else if (existingVote.IsUpvote)
        {
            _context.EntryVotes.Remove(existingVote);
            entry.Upvotes--;
            try
            {
                _entryInteractionNotifications.RemoveEntryInteractionNotification(
                    entry.AuthorId, userId, id, EntryInteractionNotificationTypes.Like);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Beğeni bildirimi kaldırılamadı. EntryId={EntryId}", id);
            }
        }
        else
        {
            try
            {
                _entryInteractionNotifications.RemoveEntryInteractionNotification(
                    entry.AuthorId, userId, id, EntryInteractionNotificationTypes.Dislike);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Ayak bildirimi kaldırılamadı. EntryId={EntryId}", id);
            }

            existingVote.IsUpvote = true;
            entry.Downvotes--;
            entry.Upvotes++;
            shouldNotifyLike = true;
        }

        await _context.SaveChangesAsync();

        if (shouldNotifyLike)
        {
            try
            {
                _entryInteractionNotifications.TryNotifyEntryOwner(
                    id,
                    entry.AuthorId,
                    userId,
                    EntryInteractionNotificationTypes.Like,
                    "Girdinizi beğendi.");
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Beğeni bildirimi kaydedilemedi. EntryId={EntryId}", id);
            }
        }

        var userVoteType = existingVote == null ? 1 : (existingVote.IsUpvote ? 0 : 1);
        return Ok(new { upvotes = entry.Upvotes, downvotes = entry.Downvotes, userVoteType });
    }

    [Authorize]
    [EnableRateLimiting("interaction")]
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

        var shouldNotifyDislike = false;
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
            shouldNotifyDislike = true;
        }
        else if (!existingVote.IsUpvote)
        {
            _context.EntryVotes.Remove(existingVote);
            entry.Downvotes--;
            try
            {
                _entryInteractionNotifications.RemoveEntryInteractionNotification(
                    entry.AuthorId, userId, id, EntryInteractionNotificationTypes.Dislike);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Ayak bildirimi kaldırılamadı. EntryId={EntryId}", id);
            }
        }
        else
        {
            try
            {
                _entryInteractionNotifications.RemoveEntryInteractionNotification(
                    entry.AuthorId, userId, id, EntryInteractionNotificationTypes.Like);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Beğeni bildirimi kaldırılamadı. EntryId={EntryId}", id);
            }

            existingVote.IsUpvote = false;
            entry.Upvotes--;
            entry.Downvotes++;
            shouldNotifyDislike = true;
        }

        await _context.SaveChangesAsync();

        if (shouldNotifyDislike)
        {
            try
            {
                _entryInteractionNotifications.TryNotifyEntryOwner(
                    id,
                    entry.AuthorId,
                    userId,
                    EntryInteractionNotificationTypes.Dislike,
                    "Girdinizi beğenmedi.");
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Ayak bildirimi kaydedilemedi. EntryId={EntryId}", id);
            }
        }

        var userVoteType = existingVote == null ? -1 : (!existingVote.IsUpvote ? 0 : -1);
        return Ok(new { upvotes = entry.Upvotes, downvotes = entry.Downvotes, userVoteType });
    }

    [Authorize]
    [EnableRateLimiting("interaction")]
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
            try
            {
                _entryInteractionNotifications.RemoveEntryInteractionNotification(
                    entry.AuthorId, userId, id, EntryInteractionNotificationTypes.Save);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Kaydet bildirimi kaldırılamadı. EntryId={EntryId}", id);
            }

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

            try
            {
                _entryInteractionNotifications.TryNotifyEntryOwner(
                    id,
                    entry.AuthorId,
                    userId,
                    EntryInteractionNotificationTypes.Save,
                    "Girdinizi kaydetti.");
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Kaydet bildirimi kaydedilemedi. EntryId={EntryId}", id);
            }

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
        Guid? requestorId, Dictionary<Guid, int> userVotes, int saveCount = 0, bool isSavedByCurrentUser = false, bool authorIsNovice = false)
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
            IsNovice = isAnonymous ? false : authorIsNovice,
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

    private static EntryResponseDto MapToResponseDto(Entry entry, User author, Topic topic, int userVoteType = 0, bool canManage = false, bool authorIsNovice = false)
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
            IsNovice = isAnon ? false : authorIsNovice,
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

}
