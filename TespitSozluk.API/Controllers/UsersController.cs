using System.Security.Claims;
using System.Text.RegularExpressions;
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

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    /// <summary>
    /// Geçerli kullanıcı adı: 1-20 karakter, boşluk / &lt; / &gt; içeremez.
    /// AuthController.UsernameRegex ile birebir aynı kural — tek kaynak olarak
    /// ileride ortak bir yardımcı sınıfa taşınabilir.
    /// </summary>
    private static readonly Regex UsernameRegex = new(@"^[^<>\s]{1,20}$", RegexOptions.Compiled);

    private static bool IsValidUsername(string username) =>
        !string.IsNullOrEmpty(username) && UsernameRegex.IsMatch(username);

    private readonly AppDbContext _context;
    private readonly IEntryInteractionNotificationService _entryInteractionNotifications;

    public UsersController(AppDbContext context, IEntryInteractionNotificationService entryInteractionNotifications)
    {
        _context = context;
        _entryInteractionNotifications = entryInteractionNotifications;
    }

    /// <summary>
    /// Kullanıcı adına göre canlı arama (@mention). En fazla 5 sonuç.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("search")]
    public async Task<ActionResult<IReadOnlyList<UserMentionSearchItemDto>>> SearchUsers([FromQuery] string? q)
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            return Ok(Array.Empty<UserMentionSearchItemDto>());
        }

        var term = q.Trim();
        if (term.Length == 0)
        {
            return Ok(Array.Empty<UserMentionSearchItemDto>());
        }

        // LIKE özel karakterlerini kaçır (PostgreSQL ILIKE)
        var escaped = term.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);
        var prefixPattern = $"{escaped}%";
        var containsPattern = $"%{escaped}%";

        var items = await _context.Users
            .AsNoTracking()
            .Where(u => EF.Functions.ILike(u.Username, containsPattern))
            .OrderByDescending(u => EF.Functions.ILike(u.Username, prefixPattern))
            .ThenBy(u => u.Username)
            .Take(5)
            .Select(u => new UserMentionSearchItemDto
            {
                Id = u.Id,
                Username = u.Username,
                Avatar = u.Avatar
            })
            .ToListAsync();

        return Ok(items);
    }

    /// <summary>
    /// Kullanıcı adı varlığı — tek satır, AsNoTracking; Username üzerinde index kullanılır.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("exists")]
    public async Task<ActionResult<UserExistsResponseDto>> UserExists([FromQuery] string? username)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            return Ok(new UserExistsResponseDto(false, null));
        }

        var u = username.Trim();
        if (!IsValidUsername(u))
        {
            return Ok(new UserExistsResponseDto(false, null));
        }

        var row = await _context.Users
            .AsNoTracking()
            .Where(x => x.Username.ToLower() == u.ToLower())
            .Select(x => new { x.Id })
            .FirstOrDefaultAsync();

        return Ok(new UserExistsResponseDto(row != null, row?.Id));
    }

    [AllowAnonymous]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserProfileResponseDto>> GetUser(Guid id)
    {
        var user = await _context.Users
            .Where(u => u.Id == id)
            .Select(u => new
            {
                u.Id,
                u.FirstName,
                u.LastName,
                u.Email,
                u.Bio,
                u.Avatar,
                u.HasChangedUsername,
                u.CreatedAt,
                EntryCount = u.Entries.Count
            })
            .FirstOrDefaultAsync();

        if (user == null)
        {
            return NotFound();
        }

        var followerCount = await _context.UserFollows.CountAsync(uf => uf.FollowingId == id);
        var followingCount = await _context.UserFollows.CountAsync(uf => uf.FollowerId == id);

        var totalUpvotesReceived = await _context.Entries
            .Where(e => e.AuthorId == id)
            .SumAsync(e => e.Upvotes);
        var totalDownvotesReceived = await _context.Entries
            .Where(e => e.AuthorId == id)
            .SumAsync(e => e.Downvotes);
        var totalSavesReceived = await _context.UserSavedEntries
            .CountAsync(s => _context.Entries.Any(e => e.Id == s.EntryId && e.AuthorId == id));

        var writtenEntriesCount = user.EntryCount;
        var savedEntriesCount = await _context.UserSavedEntries.CountAsync(s => s.UserId == id);
        var likedEntriesCount = await _context.EntryVotes.CountAsync(v => v.UserId == id && v.IsUpvote);
        var draftsCount = await _context.DraftEntries.CountAsync(d => d.AuthorId == id);

        var nickname = (user.FirstName + " " + user.LastName).Trim();
        if (string.IsNullOrEmpty(nickname))
        {
            nickname = "Anonim";
        }

        Guid? requestorId = null;
        if (User.Identity?.IsAuthenticated == true && Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid))
        {
            requestorId = uid;
        }

        var isOwnProfile = requestorId.HasValue && requestorId.Value == id;
        var isFollowedByCurrentUser = requestorId.HasValue && await _context.UserFollows
            .AnyAsync(uf => uf.FollowerId == requestorId.Value && uf.FollowingId == id);

        return new UserProfileResponseDto
        {
            Id = user.Id,
            Nickname = nickname,
            Avatar = user.Avatar,
            HasChangedUsername = user.HasChangedUsername,
            Bio = user.Bio,
            CreatedAt = user.CreatedAt,
            TotalEntryCount = user.EntryCount,
            TotalUpvotesReceived = totalUpvotesReceived,
            TotalDownvotesReceived = totalDownvotesReceived,
            TotalSavesReceived = totalSavesReceived,
            Email = isOwnProfile ? user.Email : null,
            FollowerCount = followerCount,
            FollowingCount = followingCount,
            IsFollowedByCurrentUser = isFollowedByCurrentUser,
            WrittenEntriesCount = writtenEntriesCount,
            SavedEntriesCount = savedEntriesCount,
            LikedEntriesCount = likedEntriesCount,
            DraftsCount = draftsCount
        };
    }

    [AllowAnonymous]
    [HttpGet("{id:guid}/liked-entries")]
    public async Task<ActionResult<PagedEntriesDto>> GetLikedEntries(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var userExists = await _context.Users.AnyAsync(u => u.Id == id);
        if (!userExists)
        {
            return NotFound();
        }

        var requestorId = User.Identity?.IsAuthenticated == true
            && Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid)
            ? (Guid?)uid
            : null;

        var query = _context.Entries
            .Include(e => e.Author)
            .Include(e => e.Topic)
            .Where(e => !e.IsAnonymous
                && _context.EntryVotes.Any(v => v.UserId == id && v.IsUpvote && v.EntryId == e.Id))
            .OrderByDescending(e => e.CreatedAt);

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

        var entryIds = entriesData.Select(e => e.Id).ToList();
        Dictionary<Guid, int> userVotes = new();
        Dictionary<Guid, int> saveCounts = new();
        HashSet<Guid> userSavedIds = new();
        if (entryIds.Count > 0)
        {
            if (requestorId.HasValue)
            {
                var votes = await _context.EntryVotes
                    .Where(v => v.UserId == requestorId.Value && entryIds.Contains(v.EntryId))
                    .Select(v => new { v.EntryId, v.IsUpvote })
                    .ToListAsync();
                userVotes = votes.ToDictionary(v => v.EntryId, v => v.IsUpvote ? 1 : -1);
            }
            var saveData = await _context.UserSavedEntries
                .Where(s => entryIds.Contains(s.EntryId))
                .GroupBy(s => s.EntryId)
                .Select(g => new { EntryId = g.Key, Count = g.Count() })
                .ToListAsync();
            saveCounts = saveData.ToDictionary(x => x.EntryId, x => x.Count);
            if (requestorId.HasValue)
            {
                var saved = await _context.UserSavedEntries
                    .Where(s => s.UserId == requestorId.Value && entryIds.Contains(s.EntryId))
                    .Select(s => s.EntryId)
                    .ToListAsync();
                userSavedIds = saved.ToHashSet();
            }
        }

        var entries = entriesData.Select(e =>
        {
            var canManage = requestorId.HasValue && e.AuthorId == requestorId.Value;
            return new EntryResponseDto
            {
                Id = e.Id,
                Content = e.Content,
                Upvotes = e.Upvotes,
                Downvotes = e.Downvotes,
                TopicId = e.TopicId,
                TopicTitle = e.TopicTitle,
                AuthorId = e.IsAnonymous ? Guid.Empty : e.AuthorId,
                AuthorName = e.IsAnonymous ? "Anonim" : e.AuthorName,
                AuthorAvatar = e.IsAnonymous ? null : e.AuthorAvatar,
                AuthorRole = e.IsAnonymous ? "User" : (e.AuthorRole ?? "User"),
                CreatedAt = e.CreatedAt,
                UpdatedAt = e.UpdatedAt,
                IsAnonymous = e.IsAnonymous,
                CanManage = canManage,
                SaveCount = saveCounts.TryGetValue(e.Id, out var sc) ? sc : 0,
                IsSavedByCurrentUser = userSavedIds.Contains(e.Id),
                UserVoteType = requestorId.HasValue && userVotes.TryGetValue(e.Id, out var vt) ? vt : 0
            };
        }).ToList();

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

    [Authorize]
    [HttpPut("bio")]
    public async Task<IActionResult> UpdateBio([FromBody] UpdateBioRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var bio = request?.Bio?.Trim();
        if (bio != null && bio.Length > 500)
        {
            return BadRequest(new { message = "Bio en fazla 500 karakter olabilir." });
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return NotFound();
        }

        user.Bio = string.IsNullOrEmpty(bio) ? null : bio;
        await _context.SaveChangesAsync();
        return Ok(new { bio = user.Bio });
    }

    [Authorize]
    [HttpPut("settings/password")]
    public async Task<IActionResult> UpdatePassword([FromBody] ChangePasswordRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        if (request == null || string.IsNullOrEmpty(request.CurrentPassword) || string.IsNullOrEmpty(request.NewPassword))
        {
            return BadRequest(new { message = "Mevcut şifre ve yeni şifre gereklidir." });
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return NotFound();
        }

        var isValid = BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash);
        if (!isValid)
        {
            return BadRequest(new { message = "Mevcut parola hatalı." });
        }

        if (request.NewPassword.Length < 8 || !request.NewPassword.Any(char.IsUpper) || !request.NewPassword.Any(char.IsDigit))
        {
            return BadRequest(new { message = "Parolanız en az 8 karakter olmalı, 1 büyük harf ve 1 rakam içermelidir." });
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _context.SaveChangesAsync();
        return Ok(new { message = "Şifre güncellendi." });
    }

    [Authorize]
    [HttpPut("settings/username")]
    public async Task<IActionResult> UpdateUsername([FromBody] ChangeUsernameRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var newUsername = request?.NewUsername?.Trim();
        if (string.IsNullOrEmpty(newUsername))
        {
            return BadRequest(new { message = "Yeni kullanıcı adı gereklidir." });
        }

        if (!IsValidUsername(newUsername))
        {
            return BadRequest(new { message = "Kullanıcı adı en fazla 20 karakter olabilir; boşluk ve < > karakterleri içeremez." });
        }

        if (ReservedUsernames.IsReserved(newUsername))
            return BadRequest(new { message = ReservedUsernames.ReservedMessage });

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return NotFound();
        }

        // Keskin Kural 2: HasChangedUsername kontrolü - veritabanına herhangi bir Write yapılmadan EN BAŞTA
        if (user.HasChangedUsername)
        {
            return BadRequest(new { message = "Kullanıcı adınızı yalnızca 1 defa değiştirebilirsiniz." });
        }

        if (string.Equals(user.Username, newUsername, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Yeni kullanıcı adı mevcut adınızdan farklı olmalıdır." });
        }

        // Keskin Kural 1: Benzersizlik kontrolü SADECE Username (Nickname) sütunu üzerinde
        var usernameExists = await _context.Users
            .Where(u => u.Id != userId)
            .AnyAsync(u => u.Username.ToLower() == newUsername.ToLower());
        if (usernameExists)
        {
            return BadRequest(new { message = "Bu kullanıcı adı zaten kullanılıyor." });
        }

        user.Username = newUsername;
        user.FirstName = newUsername;
        user.LastName = string.Empty;
        user.HasChangedUsername = true;
        await _context.SaveChangesAsync();
        return Ok(new { nickname = newUsername, message = "Kullanıcı adı güncellendi." });
    }

    [Authorize]
    [HttpPut("settings/avatar")]
    public async Task<IActionResult> UpdateAvatar([FromBody] ChangeAvatarRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            return NotFound();
        }

        var raw = request?.AvatarUrl?.Trim();
        if (string.IsNullOrEmpty(raw))
        {
            user.Avatar = null;
        }
        else
        {
            const int maxHttpUrlLength = 2048;
            const int maxDataImageLength = 262144;

            if (raw.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
            {
                if (raw.Length > maxDataImageLength)
                {
                    return BadRequest(new { message = "Gömülü görsel çok uzun (en fazla 256 KB)." });
                }

                user.Avatar = raw;
            }
            else
            {
                if (raw.Length > maxHttpUrlLength)
                {
                    return BadRequest(new { message = "Bağlantı çok uzun (en fazla 2048 karakter)." });
                }

                if (!Uri.TryCreate(raw, UriKind.Absolute, out var uri)
                    || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
                {
                    return BadRequest(new { message = "Geçerli bir http veya https adresi girin." });
                }

                user.Avatar = raw;
            }
        }

        await _context.SaveChangesAsync();
        return Ok(new { avatar = user.Avatar, message = "Avatar güncellendi." });
    }

    [Authorize]
    [EnableRateLimiting("interaction")]
    [HttpPost("{id:guid}/follow")]
    public async Task<IActionResult> ToggleFollow(Guid id)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var followerId))
        {
            return Unauthorized();
        }

        if (followerId == id)
        {
            return BadRequest(new { message = "Kendinizi takip edemezsiniz." });
        }

        var targetUser = await _context.Users.FindAsync(id);
        if (targetUser == null)
        {
            return NotFound();
        }

        var existingFollow = await _context.UserFollows
            .FirstOrDefaultAsync(uf => uf.FollowerId == followerId && uf.FollowingId == id);

        if (existingFollow != null)
        {
            _context.UserFollows.Remove(existingFollow);
            _entryInteractionNotifications.RemoveFollowNotifications(id, followerId);
            await _context.SaveChangesAsync();
            return Ok(new { isFollowing = false, message = "Takipten çıkıldı." });
        }

        var follower = await _context.Users.FindAsync(followerId);
        var followerName = follower != null ? (follower.FirstName + " " + follower.LastName).Trim() : "Bir kullanıcı";
        if (string.IsNullOrEmpty(followerName))
        {
            followerName = "Bir kullanıcı";
        }

        _context.UserFollows.Add(new UserFollow
        {
            FollowerId = followerId,
            FollowingId = id,
            CreatedAt = DateTime.UtcNow
        });

        _context.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = id,
            SenderId = followerId,
            Type = EntryInteractionNotificationTypes.Follow,
            Message = $"{followerName} seni takip etmeye başladı.",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();
        return Ok(new { isFollowing = true, message = "Takip edildi." });
    }

    [AllowAnonymous]
    [HttpGet("{id:guid}/followers")]
    public async Task<ActionResult<List<UserFollowListItemDto>>> GetFollowers(Guid id)
    {
        var userExists = await _context.Users.AnyAsync(u => u.Id == id);
        if (!userExists)
        {
            return NotFound();
        }

        var followers = await _context.UserFollows
            .Where(uf => uf.FollowingId == id)
            .Include(uf => uf.Follower)
            .OrderByDescending(uf => uf.CreatedAt)
            .Select(uf => new UserFollowListItemDto
            {
                Id = uf.Follower.Id,
                Username = (uf.Follower.FirstName + " " + uf.Follower.LastName).Trim(),
                Avatar = uf.Follower.Avatar
            })
            .ToListAsync();

        foreach (var f in followers)
        {
            if (string.IsNullOrEmpty(f.Username))
                f.Username = "Anonim";
        }

        return followers;
    }

    [AllowAnonymous]
    [HttpGet("{id:guid}/following")]
    public async Task<ActionResult<List<UserFollowListItemDto>>> GetFollowing(Guid id)
    {
        var userExists = await _context.Users.AnyAsync(u => u.Id == id);
        if (!userExists)
        {
            return NotFound();
        }

        var following = await _context.UserFollows
            .Where(uf => uf.FollowerId == id)
            .Include(uf => uf.Following)
            .OrderByDescending(uf => uf.CreatedAt)
            .Select(uf => new UserFollowListItemDto
            {
                Id = uf.Following.Id,
                Username = (uf.Following.FirstName + " " + uf.Following.LastName).Trim(),
                Avatar = uf.Following.Avatar
            })
            .ToListAsync();

        foreach (var f in following)
        {
            if (string.IsNullOrEmpty(f.Username))
                f.Username = "Anonim";
        }

        return following;
    }

    [AllowAnonymous]
    [HttpGet("{id:guid}/entries")]
    public async Task<ActionResult<PagedEntriesDto>> GetUserEntries(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool includeAnonymous = false,
        [FromQuery] string? sortBy = "newest")
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var userExists = await _context.Users.AnyAsync(u => u.Id == id);
        if (!userExists)
        {
            return NotFound();
        }

        var requestorId = User.Identity?.IsAuthenticated == true
            && Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid)
            ? (Guid?)uid
            : null;

        var isOwnProfile = requestorId.HasValue && requestorId.Value == id;

        var query = _context.Entries
            .Include(e => e.Author)
            .Include(e => e.Topic)
            .Where(e => e.AuthorId == id)
            .AsQueryable();

        if (!isOwnProfile || !includeAnonymous)
        {
            query = query.Where(e => !e.IsAnonymous);
        }

        var effectiveSort = (sortBy ?? "newest").ToLowerInvariant();
        query = effectiveSort switch
        {
            "newest" => query.OrderByDescending(e => e.CreatedAt),
            "oldest" => query.OrderBy(e => e.CreatedAt),
            "most_liked" => query.OrderByDescending(e => e.Upvotes).ThenBy(e => e.Downvotes),
            "most_disliked" => query.OrderByDescending(e => e.Downvotes).ThenBy(e => e.Upvotes),
            "most_saved" => query
                .OrderByDescending(e => _context.UserSavedEntries.Count(s => s.EntryId == e.Id)),
            _ => query.OrderByDescending(e => e.CreatedAt)
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

        var entryIds = entriesData.Select(e => e.Id).ToList();
        Dictionary<Guid, int> userVotes = new();
        Dictionary<Guid, int> saveCounts = new();
        HashSet<Guid> userSavedIds = new();
        if (entryIds.Count > 0)
        {
            if (requestorId.HasValue)
            {
                var votes = await _context.EntryVotes
                    .Where(v => v.UserId == requestorId.Value && entryIds.Contains(v.EntryId))
                    .Select(v => new { v.EntryId, v.IsUpvote })
                    .ToListAsync();
                userVotes = votes.ToDictionary(v => v.EntryId, v => v.IsUpvote ? 1 : -1);
            }
            var saveData = await _context.UserSavedEntries
                .Where(s => entryIds.Contains(s.EntryId))
                .GroupBy(s => s.EntryId)
                .Select(g => new { EntryId = g.Key, Count = g.Count() })
                .ToListAsync();
            saveCounts = saveData.ToDictionary(x => x.EntryId, x => x.Count);
            if (requestorId.HasValue)
            {
                var saved = await _context.UserSavedEntries
                    .Where(s => s.UserId == requestorId.Value && entryIds.Contains(s.EntryId))
                    .Select(s => s.EntryId)
                    .ToListAsync();
                userSavedIds = saved.ToHashSet();
            }
        }

        var entries = entriesData.Select(e =>
        {
            var canManage = isOwnProfile && requestorId.HasValue && e.AuthorId == requestorId.Value;
            return new EntryResponseDto
            {
                Id = e.Id,
                Content = e.Content,
                Upvotes = e.Upvotes,
                Downvotes = e.Downvotes,
                TopicId = e.TopicId,
                TopicTitle = e.TopicTitle,
                AuthorId = e.IsAnonymous ? Guid.Empty : e.AuthorId,
                AuthorName = e.IsAnonymous ? "Anonim" : e.AuthorName,
                AuthorAvatar = e.IsAnonymous ? null : e.AuthorAvatar,
                AuthorRole = e.IsAnonymous ? "User" : (e.AuthorRole ?? "User"),
                CreatedAt = e.CreatedAt,
                UpdatedAt = e.UpdatedAt,
                IsAnonymous = e.IsAnonymous,
                CanManage = canManage,
                SaveCount = saveCounts.TryGetValue(e.Id, out var sc) ? sc : 0,
                IsSavedByCurrentUser = userSavedIds.Contains(e.Id),
                UserVoteType = requestorId.HasValue && userVotes.TryGetValue(e.Id, out var vt) ? vt : 0
            };
        }).ToList();

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

    [Authorize]
    [HttpGet("{id:guid}/saved-entries")]
    public async Task<ActionResult<PagedEntriesDto>> GetSavedEntries(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var requestorId))
        {
            return Unauthorized();
        }

        if (requestorId != id)
        {
            return StatusCode(403, "Sadece kendi kaydettiğiniz entry'lere erişebilirsiniz.");
        }

        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var query = _context.UserSavedEntries
            .Where(s => s.UserId == id)
            .OrderByDescending(s => s.SavedAt)
            .Join(_context.Entries, s => s.EntryId, e => e.Id, (s, e) => new { Saved = s, Entry = e })
            .Join(_context.Topics, x => x.Entry.TopicId, t => t.Id, (x, t) => new { x.Saved, x.Entry, Topic = t })
            .Join(_context.Users, x => x.Entry.AuthorId, u => u.Id, (x, u) => new { x.Saved, x.Entry, x.Topic, Author = u });

        var totalCount = await query.CountAsync();

        var entriesData = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Entry.Id,
                x.Entry.Content,
                x.Entry.Upvotes,
                x.Entry.Downvotes,
                x.Entry.TopicId,
                TopicTitle = x.Topic.Title,
                x.Entry.AuthorId,
                AuthorName = x.Author.FirstName + " " + x.Author.LastName,
                AuthorAvatar = x.Author.Avatar,
                AuthorRole = x.Author.Role,
                x.Entry.CreatedAt,
                x.Entry.UpdatedAt,
                x.Entry.IsAnonymous
            })
            .ToListAsync();

        var entryIds = entriesData.Select(e => e.Id).ToList();
        Dictionary<Guid, int> userVotes = new();
        Dictionary<Guid, int> saveCounts = new();
        HashSet<Guid> userSavedIds = new();
        if (entryIds.Count > 0)
        {
            var votes = await _context.EntryVotes
                .Where(v => v.UserId == requestorId && entryIds.Contains(v.EntryId))
                .Select(v => new { v.EntryId, v.IsUpvote })
                .ToListAsync();
            userVotes = votes.ToDictionary(v => v.EntryId, v => v.IsUpvote ? 1 : -1);
            var saveData = await _context.UserSavedEntries
                .Where(s => entryIds.Contains(s.EntryId))
                .GroupBy(s => s.EntryId)
                .Select(g => new { EntryId = g.Key, Count = g.Count() })
                .ToListAsync();
            saveCounts = saveData.ToDictionary(x => x.EntryId, x => x.Count);
            userSavedIds = entryIds.ToHashSet();
        }

        var entries = entriesData.Select(e =>
        {
            var canManage = e.AuthorId == requestorId;
            return new EntryResponseDto
            {
                Id = e.Id,
                Content = e.Content,
                Upvotes = e.Upvotes,
                Downvotes = e.Downvotes,
                TopicId = e.TopicId,
                TopicTitle = e.TopicTitle,
                AuthorId = e.IsAnonymous ? Guid.Empty : e.AuthorId,
                AuthorName = e.IsAnonymous ? "Anonim" : e.AuthorName,
                AuthorAvatar = e.IsAnonymous ? null : e.AuthorAvatar,
                AuthorRole = e.IsAnonymous ? "User" : (e.AuthorRole ?? "User"),
                CreatedAt = e.CreatedAt,
                UpdatedAt = e.UpdatedAt,
                IsAnonymous = e.IsAnonymous,
                CanManage = canManage,
                SaveCount = saveCounts.TryGetValue(e.Id, out var sc) ? sc : 0,
                IsSavedByCurrentUser = true,
                UserVoteType = userVotes.TryGetValue(e.Id, out var vt) ? vt : 0
            };
        }).ToList();

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
}
