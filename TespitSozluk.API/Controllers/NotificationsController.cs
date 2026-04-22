using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TespitSozluk.API.Data;
using TespitSozluk.API.DTOs;
using TespitSozluk.API.Services;

namespace TespitSozluk.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<NotificationsController> _logger;

    public NotificationsController(AppDbContext context, ILogger<NotificationsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<NotificationResponseDto>>> GetNotifications()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        try
        {
            var cutoffUtc = DateTime.UtcNow.AddMonths(-1);
            await _context.Notifications
                .Where(n => n.UserId == userId && n.CreatedAt < cutoffUtc)
                .ExecuteDeleteAsync();

            // Entry: TopicId (mention/beğeni derin link); TopicId: başlık takibi. Include yok; EF projeksiyonda join üretir.
            var notifications = await _context.Notifications
                .AsNoTracking()
                .Include(n => n.Sender)
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .Select(n => new NotificationResponseDto
                {
                    Id = n.Id,
                    EntryId = n.EntryId,
                    TopicId = n.TopicId ?? (n.Entry != null ? n.Entry.TopicId : null),
                    SenderId = n.Type == EntryInteractionNotificationTypes.TopicFollow ? Guid.Empty : n.SenderId,
                    ActorId = n.Type == EntryInteractionNotificationTypes.TopicFollow ? Guid.Empty : n.SenderId,
                    SenderName = n.Type == EntryInteractionNotificationTypes.TopicFollow
                        ? string.Empty
                        : n.Sender.FirstName + " " + n.Sender.LastName,
                    Type = n.Type,
                    Message = n.Message,
                    IsRead = n.IsRead,
                    CreatedAt = n.CreatedAt
                })
                .ToListAsync();

            return notifications;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Bildirim listesi alınamadı (UserId={UserId}). Muhtemel sebep: veritabanı şeması güncel değil; API dizininde 'dotnet ef database update' çalıştırın.", userId);
            return Ok(new List<NotificationResponseDto>());
        }
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<int>> GetUnreadCount()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        try
        {
            var count = await _context.Notifications
                .AsNoTracking()
                .CountAsync(n => n.UserId == userId && !n.IsRead);

            return count;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Okunmamış bildirim sayısı alınamadı (UserId={UserId}).", userId);
            return Ok(0);
        }
    }

    [HttpPut("mark-all-read")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));

        return NoContent();
    }

    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);

        if (notification == null)
        {
            return NotFound();
        }

        notification.IsRead = true;
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
