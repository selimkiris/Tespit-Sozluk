using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;
using TespitSozluk.API.DTOs;
using TespitSozluk.API.Services;

namespace TespitSozluk.API.Controllers;

/// <summary>
/// Engelleme (Block) altyapısının kullanıcıya açık tüm uçları.
///
/// Tüm yazma uçları "interaction" rate-limit politikası ile sınırlıdır;
/// otomasyon / kötüye kullanım denemeleri 429 ile reddedilir.
/// </summary>
[ApiController]
[Authorize]
[Route("api/[controller]")]
public class BlocksController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IBlockingService _blockingService;

    public BlocksController(AppDbContext context, IBlockingService blockingService)
    {
        _context = context;
        _blockingService = blockingService;
    }

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

    // ─────────────────────────────────────────────
    // Kullanıcı Engelleme
    // ─────────────────────────────────────────────

    /// <summary>Hedef kullanıcıyı engeller; karşılıklı tüm etkileşim verilerini temizler.</summary>
    [EnableRateLimiting("interaction")]
    [HttpPost("users/{id:guid}")]
    public async Task<IActionResult> BlockUser(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var result = await _blockingService.BlockUserAsync(userId, id, cancellationToken);
        return result switch
        {
            BlockOperationResult.Ok => Ok(new { isBlocked = true, message = "Kullanıcı engellendi." }),
            BlockOperationResult.SelfBlock => BadRequest(new { message = "Kendinizi engelleyemezsiniz." }),
            BlockOperationResult.UserNotFound => NotFound(new { message = "Kullanıcı bulunamadı." }),
            _ => StatusCode(500, new { message = "Beklenmedik durum." })
        };
    }

    /// <summary>Kullanıcı engellemesini kaldırır.</summary>
    [EnableRateLimiting("interaction")]
    [HttpDelete("users/{id:guid}")]
    public async Task<IActionResult> UnblockUser(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var result = await _blockingService.UnblockUserAsync(userId, id, cancellationToken);
        return result switch
        {
            BlockOperationResult.Ok => Ok(new { isBlocked = false, message = "Engelleme kaldırıldı." }),
            BlockOperationResult.SelfBlock => BadRequest(new { message = "Geçersiz işlem." }),
            BlockOperationResult.NotFound => NotFound(new { message = "Engelleme kaydı yok." }),
            _ => StatusCode(500, new { message = "Beklenmedik durum." })
        };
    }

    // ─────────────────────────────────────────────
    // Başlık Engelleme
    // ─────────────────────────────────────────────

    /// <summary>Başlığı engeller (kullanıcı için tüm listelerde görünmez olur).</summary>
    [EnableRateLimiting("interaction")]
    [HttpPost("topics/{id:guid}")]
    public async Task<IActionResult> BlockTopic(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var result = await _blockingService.BlockTopicAsync(userId, id, cancellationToken);
        return result switch
        {
            BlockOperationResult.Ok => Ok(new { isBlocked = true, message = "Başlık engellendi." }),
            BlockOperationResult.TopicNotFound => NotFound(new { message = "Başlık bulunamadı." }),
            _ => StatusCode(500, new { message = "Beklenmedik durum." })
        };
    }

    /// <summary>Başlık engellemesini kaldırır.</summary>
    [EnableRateLimiting("interaction")]
    [HttpDelete("topics/{id:guid}")]
    public async Task<IActionResult> UnblockTopic(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var result = await _blockingService.UnblockTopicAsync(userId, id, cancellationToken);
        return result switch
        {
            BlockOperationResult.Ok => Ok(new { isBlocked = false, message = "Engelleme kaldırıldı." }),
            BlockOperationResult.NotFound => NotFound(new { message = "Engelleme kaydı yok." }),
            _ => StatusCode(500, new { message = "Beklenmedik durum." })
        };
    }

    // ─────────────────────────────────────────────
    // Ayarlar — Listeler
    // ─────────────────────────────────────────────

    /// <summary>"Engellediğim Kullanıcılar" — Ayarlar sayfası listesi (yenisi en üstte).</summary>
    [HttpGet("users")]
    public async Task<ActionResult<IReadOnlyList<BlockedUserListItemDto>>> GetBlockedUsers(
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        // UserBlocks ↔ Users (Blocked) join — Tek SELECT, AsNoTracking.
        // Görünen ad: FirstName + " " + LastName (boşsa Username, o da boşsa "Anonim").
        var rows = await _context.UserBlocks
            .AsNoTracking()
            .Where(b => b.BlockerId == userId)
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => new
            {
                Id = b.BlockedId,
                b.Blocked.FirstName,
                b.Blocked.LastName,
                b.Blocked.Username,
                b.Blocked.Avatar,
                BlockedAtUtc = b.CreatedAt,
            })
            .ToListAsync(cancellationToken);

        var items = rows.Select(r =>
        {
            var display = (r.FirstName + " " + r.LastName).Trim();
            if (string.IsNullOrEmpty(display))
            {
                display = string.IsNullOrWhiteSpace(r.Username) ? "Anonim" : r.Username;
            }
            return new BlockedUserListItemDto
            {
                Id = r.Id,
                Username = display,
                Avatar = r.Avatar,
                BlockedAtUtc = r.BlockedAtUtc,
            };
        }).ToList();

        return Ok(items);
    }

    /// <summary>"Engellediğim Başlıklar" — Ayarlar sayfası listesi (yenisi en üstte).</summary>
    [HttpGet("topics")]
    public async Task<ActionResult<IReadOnlyList<BlockedTopicListItemDto>>> GetBlockedTopics(
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var items = await _context.TopicBlocks
            .AsNoTracking()
            .Where(tb => tb.UserId == userId)
            .OrderByDescending(tb => tb.CreatedAt)
            .Select(tb => new BlockedTopicListItemDto
            {
                Id = tb.TopicId,
                Title = tb.Topic.Title,
                Slug = tb.Topic.Slug,
                BlockedAtUtc = tb.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(items);
    }
}
