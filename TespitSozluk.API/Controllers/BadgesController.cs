using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;
using TespitSozluk.API.DTOs;
using TespitSozluk.API.Entities;
using TespitSozluk.API.Helpers;
using TespitSozluk.API.Services;

namespace TespitSozluk.API.Controllers;

/// <summary>
/// Entry rozetleri (Badges) API'si.
///
/// İŞ KURALLARI:
/// 1. Kullanıcılar kendi entry'lerine rozet TAKAMAZ → 400 Bad Request.
/// 2. Her yazar her bir rozet türünden AYLIK en fazla 2 adet kullanabilir.
///    Aylık pencere UTC takvim ayıdır; ayın 1'inde sıfırlanır, devretmez.
///    Bu kuralı ayrı bir envanter tablosu yerine doğrudan
///    <see cref="EntryBadge"/> üzerinde
///    <c>(GiverUserId, BadgeType, AssignedAt &gt;= ayBaşı)</c> sayımıyla
///    uyguluyoruz; bu sayede ay başında çalışan bir cron job gerekmiyor ve
///    veriler doğal bir audit trail oluşturuyor.
/// 3. Takılan rozet YALNIZCA ilk 15 dakika içinde geri alınabilir; süre geçince
///    silme istekleri 403 Forbidden ile reddedilir. (15 dk içinde silinen rozet,
///    "kullanılmamış" sayılır ve aynı ay tekrar takılabilir.)
/// 4. Aynı kullanıcı bir entry'ye, aynı rozet türünden 2. kez takamaz
///    (DB tarafında UQ index ile garanti altına alınır).
/// 5. Anonim entry'lere de rozet takılabilir; ancak profil sayfasında "alınan
///    rozet" sayılırken anonim entry'ler hariç tutulmalıdır
///    (<see cref="EntryBadge.Entry"/> → <see cref="Entry.IsAnonymous"/> filtresiyle;
///    ilişki AppDbContext'te kurgulu).
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class BadgesController : ControllerBase
{
    private const int MonthlyBadgeQuotaPerType = 2;

    /// <summary>Takılan rozetin geri alınabilme süresi (UTC).</summary>
    private static readonly TimeSpan RevokeWindow = TimeSpan.FromMinutes(15);

    private readonly AppDbContext _context;
    private readonly IPollService _pollService;
    private readonly INoviceStatusService _noviceStatus;
    private readonly IEntryInteractionNotificationService _entryInteractionNotifications;

    public BadgesController(
        AppDbContext context,
        IPollService pollService,
        INoviceStatusService noviceStatus,
        IEntryInteractionNotificationService entryInteractionNotifications)
    {
        _context = context;
        _pollService = pollService;
        _noviceStatus = noviceStatus;
        _entryInteractionNotifications = entryInteractionNotifications;
    }

    private async Task AttachPollsToEntriesAsync(IReadOnlyList<EntryResponseDto> dtos, Guid? requestorId)
    {
        if (dtos == null || dtos.Count == 0)
        {
            return;
        }

        var ids = dtos.Select(d => d.Id).ToList();
        var pollMap = await _pollService.BuildPollsForEntriesAsync(ids, requestorId, HttpContext.RequestAborted);
        if (pollMap.Count == 0)
        {
            return;
        }

        foreach (var d in dtos)
        {
            if (pollMap.TryGetValue(d.Id, out var p))
            {
                d.Poll = p;
            }
        }
    }

    private static bool IsKnownBadgeType(BadgeType type) => Enum.IsDefined(typeof(BadgeType), type);

    /// <summary>O istek anına ait UTC ay başlangıcı: yyyy-MM-01T00:00:00Z.</summary>
    private static DateTime GetCurrentMonthStartUtc(DateTime nowUtc) =>
        new(nowUtc.Year, nowUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);

    /// <summary>Bir sonraki ay başlangıcı (kotanın yenileneceği an).</summary>
    private static DateTime GetNextMonthStartUtc(DateTime monthStartUtc) =>
        monthStartUtc.AddMonths(1);

    private bool TryGetUserId(out Guid userId)
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(claim) && Guid.TryParse(claim, out userId))
        {
            return true;
        }

        userId = Guid.Empty;
        return false;
    }

    /// <summary>
    /// Rozet takma / geri alma. Aynı (kullanıcı, entry, rozet) üçlüsü zaten
    /// varsa 15 dk içinde geri alınır; yoksa yeni rozet eklenir (kotaya ve
    /// "kendi entry'n değil" kuralına uygunsa).
    /// </summary>
    /// <remarks>Body: <see cref="ToggleBadgeRequestDto"/>.</remarks>
    [Authorize]
    [EnableRateLimiting("interaction")]
    [HttpPost("toggle")]
    public async Task<ActionResult<ToggleBadgeResponseDto>> ToggleBadge([FromBody] ToggleBadgeRequestDto? dto)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (dto == null || dto.EntryId == Guid.Empty)
        {
            return BadRequest(new { message = "Geçersiz istek gövdesi." });
        }

        if (!IsKnownBadgeType(dto.BadgeType))
        {
            return BadRequest(new { message = "Geçersiz rozet türü." });
        }

        var entry = await _context.Entries
            .AsNoTracking()
            .Where(e => e.Id == dto.EntryId)
            .Select(e => new { e.Id, e.AuthorId })
            .FirstOrDefaultAsync();

        if (entry == null)
        {
            return NotFound(new { message = "Entry bulunamadı." });
        }

        if (entry.AuthorId == userId)
        {
            return BadRequest(new { message = "Kendi entry'nize rozet takamazsınız." });
        }

        var existing = await _context.EntryBadges
            .FirstOrDefaultAsync(b =>
                b.EntryId == dto.EntryId &&
                b.GiverUserId == userId &&
                b.BadgeType == dto.BadgeType);

        var nowUtc = DateTime.UtcNow;

        if (existing != null)
        {
            // Geri alma: yalnızca ilk 15 dakika.
            if (nowUtc - existing.AssignedAt > RevokeWindow)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    message = "Rozetler yalnızca ilk 15 dakika içinde geri alınabilir."
                });
            }

            try
            {
                _entryInteractionNotifications.RemoveEntryInteractionNotification(
                    entry.AuthorId,
                    userId,
                    dto.EntryId,
                    EntryInteractionNotificationTypes.Badge);
            }
            catch
            {
                // bildirim kaldırma başarısız olsa da rozeti geri almaya devam
            }

            _context.EntryBadges.Remove(existing);
            await _context.SaveChangesAsync();

            var totalsAfterRemove = await GetEntryBadgeCountsAsync(dto.EntryId, dto.BadgeType);
            return Ok(new ToggleBadgeResponseDto
            {
                IsActive = false,
                BadgeType = dto.BadgeType,
                EntryId = dto.EntryId,
                TotalForBadgeOnEntry = totalsAfterRemove.PerType,
                TotalBadgesOnEntry = totalsAfterRemove.Total
            });
        }

        // Aylık kota kontrolü — aynı türden ay içinde en fazla MonthlyBadgeQuotaPerType kullanılabilir.
        var monthStartUtc = GetCurrentMonthStartUtc(nowUtc);
        var badgesThisMonthType = await _context.EntryBadges
            .AsNoTracking()
            .CountAsync(b =>
                b.GiverUserId == userId &&
                b.BadgeType == dto.BadgeType &&
                b.AssignedAt >= monthStartUtc);

        if (badgesThisMonthType >= MonthlyBadgeQuotaPerType)
        {
            return BadRequest(new
            {
                message = "Bu ay için bu rozet türünden aylık hakkınız doldu. Hak ayın 1'inde yenilenir."
            });
        }

        var badge = new EntryBadge
        {
            Id = Guid.NewGuid(),
            EntryId = dto.EntryId,
            GiverUserId = userId,
            BadgeType = dto.BadgeType,
            AssignedAt = nowUtc
        };

        _context.EntryBadges.Add(badge);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Aynı kullanıcı + entry + tür kombinasyonunda iki paralel istek
            // gelirse UQ index ihlali oluşur. Var olan kaydı bulup başarılıymış
            // gibi cevap döneriz (idempotent toggle-on davranışı).
            var raceWinner = await _context.EntryBadges
                .AsNoTracking()
                .FirstOrDefaultAsync(b =>
                    b.EntryId == dto.EntryId &&
                    b.GiverUserId == userId &&
                    b.BadgeType == dto.BadgeType);

            if (raceWinner == null)
            {
                throw;
            }

            var totalsRace = await GetEntryBadgeCountsAsync(dto.EntryId, dto.BadgeType);
            return Ok(new ToggleBadgeResponseDto
            {
                IsActive = true,
                BadgeType = dto.BadgeType,
                EntryId = dto.EntryId,
                TotalForBadgeOnEntry = totalsRace.PerType,
                TotalBadgesOnEntry = totalsRace.Total
            });
        }

        try
        {
            _entryInteractionNotifications.TryNotifyEntryOwner(
                dto.EntryId,
                entry.AuthorId,
                userId,
                EntryInteractionNotificationTypes.Badge,
                string.Empty);
            await _context.SaveChangesAsync();
        }
        catch
        {
            // Rozet DB'ye yazıldı; bildirim yazılamazsa yine de başarı döneriz.
        }

        var totalsAfterAdd = await GetEntryBadgeCountsAsync(dto.EntryId, dto.BadgeType);
        return Ok(new ToggleBadgeResponseDto
        {
            IsActive = true,
            BadgeType = dto.BadgeType,
            EntryId = dto.EntryId,
            TotalForBadgeOnEntry = totalsAfterAdd.PerType,
            TotalBadgesOnEntry = totalsAfterAdd.Total
        });
    }

    /// <summary>
    /// Modal için: bu ay hangi rozetleri kullanmış, hangileri boşta.
    /// Her rozet türü için 1 satır döner; harcanmışsa takıldığı entry ve zaman dahil.
    /// </summary>
    [Authorize]
    [HttpGet("my-monthly-status")]
    public async Task<ActionResult<MonthlyBadgeStatusResponseDto>> GetMonthlyStatus()
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var nowUtc = DateTime.UtcNow;
        var monthStartUtc = GetCurrentMonthStartUtc(nowUtc);
        var nextResetUtc = GetNextMonthStartUtc(monthStartUtc);

        // Kullanıcının bu ay verdiği rozetler (tür başına takip).
        var usedThisMonth = await _context.EntryBadges
            .AsNoTracking()
            .Where(b => b.GiverUserId == userId && b.AssignedAt >= monthStartUtc)
            .OrderBy(b => b.AssignedAt)
            .Select(b => new { b.BadgeType, b.EntryId, b.AssignedAt })
            .ToListAsync();

        var items = new List<MonthlyBadgeStatusItemDto>();
        foreach (BadgeType type in Enum.GetValues(typeof(BadgeType)))
        {
            var rows = usedThisMonth.Where(x => x.BadgeType == type).OrderBy(x => x.AssignedAt).ToList();
            var usageDtos = rows
                .Select(r => new MonthlyBadgeUsageRowDto
                {
                    EntryId = r.EntryId,
                    AssignedAtUtc = r.AssignedAt,
                })
                .ToList();

            items.Add(new MonthlyBadgeStatusItemDto
            {
                BadgeType = type,
                MonthlyUsageCount = rows.Count,
                UsagesThisMonth = usageDtos,
                Used = rows.Count > 0,
                UsedOnEntryId = rows.Count > 0 ? rows[0].EntryId : null,
                UsedAtUtc = rows.Count > 0 ? rows[0].AssignedAt : null,
            });
        }

        return new MonthlyBadgeStatusResponseDto
        {
            MonthStartUtc = monthStartUtc,
            NextResetUtc = nextResetUtc,
            Items = items
        };
    }

    /// <summary>
    /// Bir entry'nin rozet özeti: tür başına toplam, her türün verenler listesi
    /// ve isteği yapan kullanıcının daha önce taktığı rozetler.
    /// Entry kartındaki popover ve Faz 2 modal pre-state için kullanılır.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("entries/{entryId:guid}")]
    public async Task<ActionResult<EntryBadgeSummaryDto>> GetEntryBadgeSummary(Guid entryId)
    {
        var entryExists = await _context.Entries.AsNoTracking().AnyAsync(e => e.Id == entryId);
        if (!entryExists)
        {
            return NotFound();
        }

        // Tek sorguda tüm rozet kayıtlarını ve veren kullanıcı bilgisini çek.
        var badgeRows = await _context.EntryBadges
            .AsNoTracking()
            .Where(b => b.EntryId == entryId)
            .Select(b => new
            {
                b.BadgeType,
                GiverId = b.GiverUserId,
                GiverUsername = b.Giver.Username,
                GiverAvatar = b.Giver.Avatar
            })
            .ToListAsync();

        var totalsByType = badgeRows
            .GroupBy(b => b.BadgeType)
            .ToDictionary(g => g.Key, g => g.Count());

        var total = badgeRows.Count;

        var giversByType = badgeRows
            .GroupBy(b => b.BadgeType)
            .ToDictionary(
                g => g.Key,
                g => g.Select(x => new BadgeGiverDto
                {
                    UserId = x.GiverId,
                    Username = x.GiverUsername,
                    Avatar = x.GiverAvatar
                }).ToList());

        var myBadges = new List<BadgeType>();
        if (TryGetUserId(out var userId))
        {
            myBadges = badgeRows
                .Where(b => b.GiverId == userId)
                .Select(b => b.BadgeType)
                .ToList();
        }

        return new EntryBadgeSummaryDto
        {
            EntryId = entryId,
            TotalsByType = totalsByType,
            TotalBadges = total,
            MyBadges = myBadges,
            GiversByType = giversByType
        };
    }

    /// <summary>
    /// Profil sayfası rozet koleksiyonu: kullanıcının anonim olmayan entry'lerine
    /// takılmış tüm rozetler rozet türüne göre gruplanmış halde döner.
    ///
    /// Anonim entry gizleme: <c>Entry.IsAnonymous == false</c> filtresi EF Core tarafından
    /// JOIN olarak çevrilir; anonim entry'lerdeki rozetler hiçbir zaman bu endpoint'e
    /// dahil edilmez.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("users/{userId:guid}")]
    public async Task<ActionResult<UserBadgeCollectionDto>> GetUserBadgeCollection(Guid userId)
    {
        var userExists = await _context.Users.AsNoTracking().AnyAsync(u => u.Id == userId);
        if (!userExists)
        {
            return NotFound();
        }

        // Entry.AuthorId == userId AND Entry.IsAnonymous == false — tek JOIN sorgusu.
        var badgeRows = await _context.EntryBadges
            .AsNoTracking()
            .Where(b => b.Entry.AuthorId == userId && !b.Entry.IsAnonymous)
            .Select(b => new
            {
                b.BadgeType,
                GiverId = b.GiverUserId,
                GiverUsername = b.Giver.Username,
                GiverAvatar = b.Giver.Avatar
            })
            .ToListAsync();

        // Bellek içi gruplama — satır sayısı (badge sayısı) küçük olduğundan verimli.
        var groups = badgeRows
            .GroupBy(b => b.BadgeType)
            .Select(g => new UserBadgeTypeGroupDto
            {
                BadgeType = g.Key,
                Count = g.Count(),
                Givers = g.Select(x => new BadgeGiverDto
                {
                    UserId = x.GiverId,
                    Username = x.GiverUsername,
                    Avatar = x.GiverAvatar
                }).ToList()
            })
            .OrderBy(g => g.BadgeType)
            .ToList();

        return new UserBadgeCollectionDto
        {
            UserId = userId,
            TotalBadges = badgeRows.Count,
            Groups = groups
        };
    }

    /// <summary>
    /// Profil (Alınan Rozetler): yazara ait en az bir rozet almış entry'ler, yeni→eski.
    /// Başkasının profiline bakan veya oturumsuz: yalnızca <c>!IsAnonymous</c> entry'ler.
    /// Profil sahibi: <c>includeAnonymous=true</c> ile anonim entry'ler de (yalnızca kendi profili).
    /// </summary>
    [AllowAnonymous]
    [HttpGet("received-entries/{userId:guid}")]
    public async Task<ActionResult<PagedEntriesDto>> GetReceivedBadgeEntries(
        Guid userId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool includeAnonymous = false)
    {
        if (page < 1)
        {
            page = 1;
        }

        if (pageSize < 1)
        {
            pageSize = 20;
        }

        if (pageSize > 100)
        {
            pageSize = 100;
        }

        if (!await _context.Users.AsNoTracking().AnyAsync(u => u.Id == userId))
        {
            return NotFound();
        }

        var requestorId = User.Identity?.IsAuthenticated == true
            && Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid)
            ? (Guid?)uid
            : null;

        var viewingOwnProfile = requestorId.HasValue && requestorId.Value == userId;
        var effectiveIncludeAnonymous = viewingOwnProfile && includeAnonymous;

        var query = _context.Entries
            .AsNoTracking()
            .Where(e => e.AuthorId == userId)
            .Where(e => _context.EntryBadges.Any(b => b.EntryId == e.Id));

        if (!effectiveIncludeAnonymous)
        {
            query = query.Where(e => !e.IsAnonymous);
        }

        query = query.OrderByDescending(e => e.CreatedAt);

        var totalCount = await query.CountAsync();

        var entriesData = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => new BadgeEntryRow
            {
                Id = e.Id,
                Content = e.Content,
                Upvotes = e.Upvotes,
                Downvotes = e.Downvotes,
                TopicId = e.TopicId,
                TopicTitle = e.Topic.Title,
                AuthorId = e.AuthorId,
                AuthorName = e.Author.FirstName + " " + e.Author.LastName,
                AuthorAvatar = e.Author.Avatar,
                AuthorRole = e.Author.Role,
                CreatedAt = e.CreatedAt,
                UpdatedAt = e.UpdatedAt,
                IsAnonymous = e.IsAnonymous
            })
            .ToListAsync();

        return await ProjectEntryRowsToPagedResultAsync(entriesData, totalCount, page, pageSize, requestorId);
    }

    /// <summary>
    /// Profil (Takılan Rozetler): kullanıcının verdiği rozete sahip entry'ler (entry başına tek satır).
    /// Sıra: o entry'deki bu kullanıcıya ait en son <c>AssignedAt</c> (yeni→eski).
    /// </summary>
    [AllowAnonymous]
    [HttpGet("given-entries/{userId:guid}")]
    public async Task<ActionResult<PagedEntriesDto>> GetGivenBadgeEntries(
        Guid userId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (page < 1)
        {
            page = 1;
        }

        if (pageSize < 1)
        {
            pageSize = 20;
        }

        if (pageSize > 100)
        {
            pageSize = 100;
        }

        if (!await _context.Users.AsNoTracking().AnyAsync(u => u.Id == userId))
        {
            return NotFound();
        }

        var requestorId = User.Identity?.IsAuthenticated == true
            && Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid)
            ? (Guid?)uid
            : null;

        var totalCount = await _context.EntryBadges
            .AsNoTracking()
            .Where(b => b.GiverUserId == userId)
            .Select(b => b.EntryId)
            .Distinct()
            .CountAsync();

        var pageEntryIds = await _context.EntryBadges
            .AsNoTracking()
            .Where(b => b.GiverUserId == userId)
            .GroupBy(b => b.EntryId)
            .Select(g => new { EntryId = g.Key, LastAt = g.Max(x => x.AssignedAt) })
            .OrderByDescending(x => x.LastAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => x.EntryId)
            .ToListAsync();

        var idSet = pageEntryIds.ToHashSet();
        var rows = await _context.Entries
            .AsNoTracking()
            .Where(e => idSet.Contains(e.Id))
            .Select(e => new BadgeEntryRow
            {
                Id = e.Id,
                Content = e.Content,
                Upvotes = e.Upvotes,
                Downvotes = e.Downvotes,
                TopicId = e.TopicId,
                TopicTitle = e.Topic.Title,
                AuthorId = e.AuthorId,
                AuthorName = e.Author.FirstName + " " + e.Author.LastName,
                AuthorAvatar = e.Author.Avatar,
                AuthorRole = e.Author.Role,
                CreatedAt = e.CreatedAt,
                UpdatedAt = e.UpdatedAt,
                IsAnonymous = e.IsAnonymous
            })
            .ToListAsync();

        var byId = rows.ToDictionary(x => x.Id);
        var orderedData = pageEntryIds
            .Where(id => byId.ContainsKey(id))
            .Select(id => byId[id])
            .ToList();

        return await ProjectEntryRowsToPagedResultAsync(orderedData, totalCount, page, pageSize, requestorId);
    }

    /// Rozet listesi entry'leri için <c>UsersController.GetLikedEntries</c> ile aynı maskeleme ve anket eki.
    private async Task<ActionResult<PagedEntriesDto>> ProjectEntryRowsToPagedResultAsync(
        IReadOnlyList<BadgeEntryRow> entriesData,
        int totalCount,
        int page,
        int pageSize,
        Guid? requestorId)
    {
        var entryIds = entriesData.Select(e => e.Id).ToList();

        Dictionary<Guid, int> userVotes = new();
        Dictionary<Guid, int> saveCounts = new();
        HashSet<Guid> userSavedIds = new();
        if (entryIds.Count > 0)
        {
            if (requestorId.HasValue)
            {
                var votes = await _context.EntryVotes
                    .AsNoTracking()
                    .Where(v => v.UserId == requestorId.Value && entryIds.Contains(v.EntryId))
                    .Select(v => new { v.EntryId, v.IsUpvote })
                    .ToListAsync();
                userVotes = votes.ToDictionary(v => v.EntryId, v => v.IsUpvote ? 1 : -1);
            }

            var saveData = await _context.UserSavedEntries
                .AsNoTracking()
                .Where(s => entryIds.Contains(s.EntryId))
                .GroupBy(s => s.EntryId)
                .Select(g => new { EntryId = g.Key, Count = g.Count() })
                .ToListAsync();
            saveCounts = saveData.ToDictionary(x => x.EntryId, x => x.Count);
            if (requestorId.HasValue)
            {
                var saved = await _context.UserSavedEntries
                    .AsNoTracking()
                    .Where(s => s.UserId == requestorId.Value && entryIds.Contains(s.EntryId))
                    .Select(s => s.EntryId)
                    .ToListAsync();
                userSavedIds = saved.ToHashSet();
            }
        }

        var rawContents = entriesData.Select(e => e.Content).ToList();
        var processed = await EntryPublicContentBatch.ProcessContentsAsync(_context, rawContents, HttpContext.RequestAborted);

        var noviceIds = entriesData.Where(e => !e.IsAnonymous).Select(e => e.AuthorId).Distinct().ToList();
        var noviceMap = await _noviceStatus.GetIsNoviceMapAsync(noviceIds);

        var entries = entriesData.Select((e, i) =>
        {
            var canManage = requestorId.HasValue && e.AuthorId == requestorId.Value;
            return new EntryResponseDto
            {
                Id = e.Id,
                Content = processed[i].Content,
                Upvotes = e.Upvotes,
                Downvotes = e.Downvotes,
                TopicId = e.TopicId,
                TopicTitle = e.TopicTitle,
                AuthorId = e.IsAnonymous ? Guid.Empty : e.AuthorId,
                AuthorName = e.IsAnonymous ? "Anonim" : e.AuthorName,
                AuthorAvatar = e.IsAnonymous ? null : e.AuthorAvatar,
                AuthorRole = e.IsAnonymous ? "User" : (e.AuthorRole ?? "User"),
                IsNovice = e.IsAnonymous ? false : noviceMap.GetValueOrDefault(e.AuthorId, true),
                CreatedAt = e.CreatedAt,
                UpdatedAt = e.UpdatedAt,
                IsAnonymous = e.IsAnonymous,
                CanManage = canManage,
                SaveCount = saveCounts.TryGetValue(e.Id, out var sc) ? sc : 0,
                IsSavedByCurrentUser = userSavedIds.Contains(e.Id),
                UserVoteType = requestorId.HasValue && userVotes.TryGetValue(e.Id, out var vt) ? vt : 0,
                ValidBkzs = processed[i].ValidBkzs,
            };
        }).ToList();

        await AttachPollsToEntriesAsync(entries, requestorId);

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        return Ok(new PagedEntriesDto
        {
            Items = entries,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            TotalPages = totalPages,
            HasPreviousPage = page > 1,
            HasNextPage = page < totalPages
        });
    }

    private sealed class BadgeEntryRow
    {
        public Guid Id { get; set; }
        public string Content { get; set; } = "";
        public int Upvotes { get; set; }
        public int Downvotes { get; set; }
        public Guid TopicId { get; set; }
        public string TopicTitle { get; set; } = "";
        public Guid AuthorId { get; set; }
        public string AuthorName { get; set; } = "";
        public string? AuthorAvatar { get; set; }
        public string? AuthorRole { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public bool IsAnonymous { get; set; }
    }

    private async Task<(int PerType, int Total)> GetEntryBadgeCountsAsync(Guid entryId, BadgeType type)
    {
        var perType = await _context.EntryBadges
            .AsNoTracking()
            .CountAsync(b => b.EntryId == entryId && b.BadgeType == type);
        var total = await _context.EntryBadges
            .AsNoTracking()
            .CountAsync(b => b.EntryId == entryId);
        return (perType, total);
    }
}
