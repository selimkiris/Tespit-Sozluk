using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;
using TespitSozluk.API.DTOs;
using TespitSozluk.API.Entities;
using TespitSozluk.API.Filters;
using TespitSozluk.API.Helpers;
using TespitSozluk.API.Services;

namespace TespitSozluk.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MessagesController : ControllerBase
{
    private const int MaxContentLength = 10_000;
    private readonly AppDbContext _context;
    private readonly IMessagingPermissionService _messagingPermission;

    public MessagesController(
        AppDbContext context,
        IMessagingPermissionService messagingPermission)
    {
        _context = context;
        _messagingPermission = messagingPermission;
    }

    private static string DisplayName(string first, string last)
    {
        var s = (first + " " + last).Trim();
        return string.IsNullOrEmpty(s) ? "Anonim" : s;
    }

    private static PrivateMessageResponseDto ToDto(
        PrivateMessage m,
        string sFirst, string sLast, string? sAvatar,
        string rFirst, string rLast, string? rAvatar)
    {
        return new PrivateMessageResponseDto
        {
            Id = m.Id,
            SenderId = m.SenderId,
            SenderDisplayName = DisplayName(sFirst, sLast),
            SenderAvatar = sAvatar,
            RecipientId = m.RecipientId,
            RecipientDisplayName = DisplayName(rFirst, rLast),
            RecipientAvatar = rAvatar,
            Content = m.Content,
            CreatedAtUtc = m.CreatedAtUtc,
            ReadAtUtc = m.ReadAtUtc,
            Reference = MapReference(m)
        };
    }

    /// <summary>
    /// Gelen kutusunda okunmamış mesaj adedi. Navbar / rozet için hafif uç.
    /// Kimliği doğrulanmamış veya id çözülemeyen isteklerde 500 vermemek için 0 döner.
    /// </summary>
    [HttpGet("unread-count")]
    [AllowAnonymous]
    public async Task<ActionResult<int>> GetUnreadCount()
    {
        if (!TryGetUserId(out var userId))
        {
            return Ok(0);
        }

        try
        {
            var c = await _context.PrivateMessages
                .AsNoTracking()
                .CountAsync(m => m.RecipientId == userId && m.ReadAtUtc == null);
            return Ok(c);
        }
        catch
        {
            // Şema/DB uyumsuzluğu veya geçici hata: istemciyi 500'den koru; rozet 0 kalsın.
            return Ok(0);
        }
    }

    private static PrivateMessageReferenceDto? MapReference(PrivateMessage m)
    {
        if (m.ReferencedEntryId is not null
            && m.ReferencedEntry is { } re
            && re.Topic is { } t)
        {
            return new PrivateMessageReferenceDto
            {
                Kind = "entry",
                Id = re.Id,
                Title = t.Title,
                TopicTitle = t.Title,
                TopicSlug = t.Slug,
                TopicId = t.Id,
                Snippet = MessagingContentHelper.PlainTextPreview(re.Content)
            };
        }

        if (m.ReferencedTopicId is not null
            && m.ReferencedTopic is { } top)
        {
            return new PrivateMessageReferenceDto
            {
                Kind = "topic",
                Id = top.Id,
                Title = top.Title,
                TopicTitle = top.Title,
                TopicSlug = top.Slug,
                TopicId = top.Id,
                Snippet = null
            };
        }

        return null;
    }

    /// <summary>
    /// Tüm sohbetler: son mesaj ve karşı taraftan gelen (henüz okunmamış) mesaj adedi, son aktiviteye göre azalan sırada.
    /// </summary>
    [HttpGet("conversations")]
    public async Task<ActionResult<IReadOnlyList<ConversationSummaryDto>>> GetConversations(
        CancellationToken cancellationToken = default)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var lastMessages = await _context.PrivateMessages
            .AsNoTracking()
            .Where(m => m.SenderId == userId || m.RecipientId == userId)
            .GroupBy(m => m.SenderId == userId ? m.RecipientId : m.SenderId)
            .Select(g => g.OrderByDescending(m => m.CreatedAtUtc).ThenByDescending(m => m.Id).First())
            .ToListAsync(cancellationToken);

        if (lastMessages.Count == 0)
        {
            return Array.Empty<ConversationSummaryDto>();
        }

        var otherIds = lastMessages
            .Select(m => m.SenderId == userId ? m.RecipientId : m.SenderId)
            .Distinct()
            .ToList();

        var users = await _context.Users
            .AsNoTracking()
            .Where(u => otherIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u, cancellationToken);

        var unreadList = await _context.PrivateMessages
            .AsNoTracking()
            .Where(m => m.RecipientId == userId && m.ReadAtUtc == null)
            .GroupBy(m => m.SenderId)
            .Select(g => new { OtherId = g.Key, C = g.Count() })
            .ToListAsync(cancellationToken);
        var unread = unreadList.ToDictionary(x => x.OtherId, x => x.C);

        var list = new List<ConversationSummaryDto>(lastMessages.Count);
        foreach (var m in lastMessages.OrderByDescending(x => x.CreatedAtUtc).ThenByDescending(x => x.Id))
        {
            var otherId = m.SenderId == userId ? m.RecipientId : m.SenderId;
            if (!users.TryGetValue(otherId, out var o))
            {
                continue;
            }

            list.Add(new ConversationSummaryDto
            {
                OtherUserId = otherId,
                OtherDisplayName = DisplayName(o.FirstName, o.LastName),
                OtherAvatar = o.Avatar,
                LastMessagePreview = MessagingContentHelper.ConversationListPreview(m.Content, 200),
                LastMessageAtUtc = m.CreatedAtUtc,
                UnreadCount = unread.TryGetValue(otherId, out var c) ? c : 0
            });
        }

        return list;
    }

    /// <summary>İki kullanıcı arası tüm geçmiş; eskiden yeniye. Yalnızca bu çifti ilgilendiren satırlar.</summary>
    [HttpGet("thread/{otherUserId:guid}")]
    public async Task<ActionResult<IReadOnlyList<PrivateMessageResponseDto>>> GetThread(
        Guid otherUserId, CancellationToken cancellationToken = default)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (otherUserId == userId)
        {
            return BadRequest(new { message = "Geçersiz alıcı." });
        }

        if (!await _context.Users.AsNoTracking().AnyAsync(u => u.Id == otherUserId, cancellationToken))
        {
            return NotFound();
        }

        var rows = await _context.PrivateMessages
            .AsNoTracking()
            .Where(m =>
                (m.SenderId == userId && m.RecipientId == otherUserId)
                || (m.SenderId == otherUserId && m.RecipientId == userId))
            .OrderBy(m => m.CreatedAtUtc)
            .Include(m => m.Sender)
            .Include(m => m.Recipient)
            .Include(m => m.ReferencedEntry)!.ThenInclude(e => e!.Topic)
            .Include(m => m.ReferencedTopic)
            .ToListAsync(cancellationToken);

        return rows.Select(m => ToDto(
            m,
            m.Sender?.FirstName ?? string.Empty,
            m.Sender?.LastName ?? string.Empty,
            m.Sender?.Avatar,
            m.Recipient?.FirstName ?? string.Empty,
            m.Recipient?.LastName ?? string.Empty,
            m.Recipient?.Avatar)).ToList();
    }

    /// <summary>Alıcının, belirli gönderenle olan thread’de tüm okunmamış mesajlarını okundu yapar.</summary>
    [HttpPut("thread/{otherUserId:guid}/read")]
    [EnableRateLimiting("interaction")]
    public async Task<IActionResult> MarkThreadRead(
        Guid otherUserId, CancellationToken cancellationToken = default)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (otherUserId == userId)
        {
            return BadRequest(new { message = "Geçersiz alıcı." });
        }

        if (!await _context.Users.AsNoTracking().AnyAsync(u => u.Id == otherUserId, cancellationToken))
        {
            return NotFound();
        }

        var now = DateTime.UtcNow;
        var updated = await _context.PrivateMessages
            .Where(m => m.RecipientId == userId
                        && m.SenderId == otherUserId
                        && m.ReadAtUtc == null)
            .ExecuteUpdateAsync(
                s => s.SetProperty(m => m.ReadAtUtc, _ => now),
                cancellationToken);

        return Ok(new { updated = updated });
    }

    [HttpPost]
    [EnableRateLimiting("interaction")]
    public async Task<ActionResult<PrivateMessageResponseDto>> Send([FromBody] SendPrivateMessageRequest? request)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (request == null)
        {
            return BadRequest(new { message = "İstek gövdesi gerekli." });
        }

        var content = request.Content?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(content))
        {
            return BadRequest(new { message = "Mesaj metni gerekli." });
        }

        if (content.Length > MaxContentLength)
        {
            return BadRequest(new { message = $"Mesaj en fazla {MaxContentLength} karakter olabilir." });
        }

        if (request.RecipientId == Guid.Empty)
        {
            return BadRequest(new { message = "Geçerli bir alıcı gerekli." });
        }

        if (request.RecipientId == userId)
        {
            return BadRequest(new { message = "Kendinize mesaj gönderemezsiniz." });
        }

        if (await _context.AreEitherBlockedAsync(userId, request.RecipientId, HttpContext.RequestAborted))
        {
            return StatusCode(403, new { message = "Bu kullanıcıyla mesajlaşamazsınız." });
        }

        if (request.ReferencedEntryId is not null && request.ReferencedTopicId is not null)
        {
            return BadRequest(new { message = "Aynı anda yalnızca bir referans (entry veya başlık) verilebilir." });
        }

        if (request.ReferencedEntryId is Guid reNotEmpty && reNotEmpty == Guid.Empty)
        {
            return BadRequest(new { message = "Geçersiz entry referansı." });
        }

        if (request.ReferencedTopicId is Guid rtNotEmpty && rtNotEmpty == Guid.Empty)
        {
            return BadRequest(new { message = "Geçersiz başlık referansı." });
        }

        Guid? refEntry = null;
        Guid? refTopic = null;
        if (request.ReferencedEntryId is { } reId)
        {
            var en = await _context.Entries
                .AsNoTracking()
                .Select(e => new { e.Id, e.AuthorId })
                .FirstOrDefaultAsync(e => e.Id == reId);
            if (en == null)
            {
                return BadRequest(new { message = "Entry bulunamadı veya artık yok." });
            }

            if (en.AuthorId != request.RecipientId)
            {
                return BadRequest(new { message = "Referans, alıcının entry'si ile eşleşmiyor." });
            }

            refEntry = reId;
        }

        if (request.ReferencedTopicId is { } rtId)
        {
            var top = await _context.Topics
                .AsNoTracking()
                .Select(t => new { t.Id, t.AuthorId })
                .FirstOrDefaultAsync(t => t.Id == rtId);
            if (top == null)
            {
                return BadRequest(new { message = "Başlık bulunamadı veya artık yok." });
            }

            if (top.AuthorId is not Guid a || a != request.RecipientId)
            {
                return BadRequest(new { message = "Referans, alıcının başlığı ile eşleşmiyor." });
            }

            refTopic = rtId;
        }

        var eval = await _messagingPermission.EvaluateSendAsync(userId, request.RecipientId, HttpContext.RequestAborted);
        if (eval.RecipientNotFound)
        {
            return NotFound(new { message = "Kullanıcı bulunamadı." });
        }

        if (!eval.IsAllowed)
        {
            return StatusCode(403, new { message = eval.DenyMessage ?? "Mesaj gönderilemedi." });
        }

        var now = DateTime.UtcNow;
        var msg = new PrivateMessage
        {
            Id = Guid.NewGuid(),
            SenderId = userId,
            RecipientId = request.RecipientId,
            Content = content,
            CreatedAtUtc = now,
            ReferencedEntryId = refEntry,
            ReferencedTopicId = refTopic
        };

        try
        {
            _context.PrivateMessages.Add(msg);
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // FK / eşzamanlı silme: doğrulama sonrası entry veya başlık kalkmış olabilir.
            return BadRequest(new { message = "Referans artık geçerli değil veya mesaj kaydedilemedi." });
        }

        var full = await _context.PrivateMessages
            .AsNoTracking()
            .Include(m => m.Sender)
            .Include(m => m.Recipient)
            .Include(m => m.ReferencedEntry)!.ThenInclude(e => e!.Topic)
            .Include(m => m.ReferencedTopic)
            .FirstOrDefaultAsync(m => m.Id == msg.Id);

        if (full == null)
        {
            return BadRequest(new { message = "Mesaj kaydedildi ancak yanıt oluşturulamadı." });
        }

        return ToDto(
            full,
            full.Sender?.FirstName ?? string.Empty,
            full.Sender?.LastName ?? string.Empty,
            full.Sender?.Avatar,
            full.Recipient?.FirstName ?? string.Empty,
            full.Recipient?.LastName ?? string.Empty,
            full.Recipient?.Avatar);
    }

    [HttpPut("{id:guid}/read")]
    [EnableRateLimiting("interaction")]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var found = await _context.PrivateMessages
            .FirstOrDefaultAsync(m => m.Id == id);
        if (found == null)
        {
            return NotFound();
        }

        if (found.RecipientId != userId)
        {
            return StatusCode(403, new { message = "Bu mesajı yalnızca alıcı okundu olarak işaretleyebilir." });
        }

        if (found.ReadAtUtc == null)
        {
            found.ReadAtUtc = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        return Ok(new { readAtUtc = found.ReadAtUtc });
    }

    private bool TryGetUserId(out Guid userId)
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(claim) || !Guid.TryParse(claim, out userId))
        {
            userId = default;
            return false;
        }

        return true;
    }
}
