using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;
using TespitSozluk.API.Entities;
using TespitSozluk.API.Services;

namespace TespitSozluk.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IEntryDeletionService _entryDeletionService;

    public AdminController(AppDbContext context, IEntryDeletionService entryDeletionService)
    {
        _context = context;
        _entryDeletionService = entryDeletionService;
    }

    // ─────────────────────────────────────────────
    // ENTRY YÖNETİMİ
    // ─────────────────────────────────────────────

    /// <summary>Belirtilen entry'yi kalıcı olarak siler.</summary>
    [HttpDelete("entries/{entryId:guid}")]
    public async Task<IActionResult> DeleteEntry(Guid entryId)
    {
        var entry = await _context.Entries.FindAsync(entryId);
        if (entry is null) return NotFound("Entry bulunamadı.");

        await _entryDeletionService.DeleteEntryAndPruneEmptyTopicAsync(entry);
        return Ok("Entry kalıcı olarak silindi.");
    }

    // ─────────────────────────────────────────────
    // BAŞLIK (TOPIC) YÖNETİMİ
    // ─────────────────────────────────────────────

    /// <summary>Başlığı ve altındaki tüm entry'leri kalıcı olarak siler.</summary>
    [HttpDelete("topics/{topicId:guid}")]
    public async Task<IActionResult> DeleteTopic(Guid topicId)
    {
        var topic = await _context.Topics
            .Include(t => t.Entries)
            .FirstOrDefaultAsync(t => t.Id == topicId);

        if (topic is null) return NotFound("Başlık bulunamadı.");

        _context.Topics.Remove(topic);
        await _context.SaveChangesAsync();
        return Ok("Başlık ve tüm entry'leri kalıcı olarak silindi.");
    }

    /// <summary>Başlığın adını (Title) değiştirir.</summary>
    [HttpPatch("topics/{topicId:guid}/rename")]
    public async Task<IActionResult> RenameTopic(Guid topicId, [FromBody] RenameTopicRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NewTitle))
            return BadRequest("Yeni başlık adı boş olamaz.");

        if (request.NewTitle.Length > 60)
            return BadRequest("Başlık en fazla 60 karakter olabilir.");

        var topic = await _context.Topics.FindAsync(topicId);
        if (topic is null) return NotFound("Başlık bulunamadı.");

        topic.Title = request.NewTitle.Trim();
        await _context.SaveChangesAsync();
        return Ok(new { message = "Başlık adı güncellendi.", newTitle = topic.Title });
    }

    /// <summary>
    /// Kaynak başlıktaki TÜM entry'leri hedef başlığa taşır.
    /// İşlem sonunda içi boşalan kaynak başlık kalıcı olarak silinir.
    /// Taşınan entry yazarlarına otomatik SystemAlert bildirimi gönderilir.
    /// </summary>
    [HttpPost("topics/{sourceTopicId:guid}/move-entries-to/{targetTopicId:guid}")]
    public async Task<IActionResult> MoveEntriesAndDeleteSource(Guid sourceTopicId, Guid targetTopicId)
    {
        if (sourceTopicId == targetTopicId)
            return BadRequest("Kaynak ve hedef başlık aynı olamaz.");

        var sourceTopic = await _context.Topics
            .Include(t => t.Entries)
            .FirstOrDefaultAsync(t => t.Id == sourceTopicId);

        if (sourceTopic is null) return NotFound("Kaynak başlık bulunamadı.");

        var targetTopic = await _context.Topics.FindAsync(targetTopicId);
        if (targetTopic is null) return NotFound("Hedef başlık bulunamadı.");

        var movedCount = sourceTopic.Entries.Count;

        // Taşınan entry'lerin benzersiz yazar ID'leri
        var affectedAuthorIds = sourceTopic.Entries
            .Select(e => e.AuthorId)
            .Distinct()
            .ToList();

        foreach (var entry in sourceTopic.Entries)
        {
            entry.TopicId = targetTopicId;
        }

        // Kaynak başlık silinmeden önce etkilenen yazarlara bildirim gönder
        var adminId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var encodedSourceTitle = WebUtility.HtmlEncode(sourceTopic.Title);
        var encodedTargetTitle = WebUtility.HtmlEncode(targetTopic.Title);
        var systemAlertHtml = $"""
            <div class="system-alert text-sm text-gray-700">
              <p><strong>Sistem Bilgilendirmesi:</strong></p>
              <p>Entry girdiğiniz <strong>"{encodedSourceTitle}"</strong> başlığı, <a href="/?topic={targetTopicId}" class="text-blue-500 underline font-medium">"{encodedTargetTitle}"</a> başlığı ile birleştirilmiş ve eski başlık silinmiştir. Entry'leriniz yeni başlığa başarıyla taşındı.</p>
            </div>
            """;

        var notifications = affectedAuthorIds.Select(authorId => new Notification
        {
            Id = Guid.NewGuid(),
            UserId = authorId,
            SenderId = adminId,
            Type = "SystemAlert",
            Message = systemAlertHtml,
            IsRead = false,
            CreatedAt = DateTime.UtcNow,
        });

        _context.Notifications.AddRange(notifications);
        _context.Topics.Remove(sourceTopic);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Entry'ler taşındı ve kaynak başlık silindi.",
            movedEntryCount = movedCount,
            notifiedAuthorCount = affectedAuthorIds.Count
        });
    }

    // ─────────────────────────────────────────────
    // AKILLI KULLANICI SİLME
    // ─────────────────────────────────────────────

    /// <summary>
    /// Kullanıcıyı tüm bağlı verileriyle akıllıca siler:
    /// - Oylar, kaydedilenler, takipler, bildirimler, taslaklar silinir.
    /// - Entry'ler silinir.
    /// - Kullanıcının açtığı başlıklarda YALNIZCA kendi entry'leri varsa başlık silinir;
    ///   başka yazarların entry'leri de varsa AuthorId null yapılır (anonim başlık).
    /// </summary>
    [HttpDelete("users/{userId:guid}")]
    public async Task<IActionResult> DeleteUser(Guid userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user is null) return NotFound("Kullanıcı bulunamadı.");

        var currentAdminId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if (userId == currentAdminId)
            return BadRequest("Kendinizi silemezsiniz.");

        if (user.Role == "Admin")
            return BadRequest("Başka bir admin hesabı silinemez.");

        // Kullanıcının açtığı başlıkları, tüm entry'leriyle birlikte yükle
        var ownedTopics = await _context.Topics
            .Where(t => t.AuthorId == userId)
            .Include(t => t.Entries)
            .ToListAsync();

        foreach (var topic in ownedTopics)
        {
            var hasOtherAuthors = topic.Entries.Any(e => e.AuthorId != userId);
            if (hasOtherAuthors)
            {
                topic.AuthorId = null; // Anonim başlık
            }
            else
            {
                // Sadece bu kullanıcının entry'leri var → başlığı sil
                _context.Topics.Remove(topic);
            }
        }

        // Kullanıcının oylarını sil
        var votes = await _context.EntryVotes
            .Where(v => v.UserId == userId)
            .ToListAsync();
        _context.EntryVotes.RemoveRange(votes);

        // Kullanıcının kaydettiklerini sil
        var savedEntries = await _context.UserSavedEntries
            .Where(s => s.UserId == userId)
            .ToListAsync();
        _context.UserSavedEntries.RemoveRange(savedEntries);

        // Takip ilişkilerini sil (hem follower hem following tarafı)
        var follows = await _context.UserFollows
            .Where(f => f.FollowerId == userId || f.FollowingId == userId)
            .ToListAsync();
        _context.UserFollows.RemoveRange(follows);

        // Konu takiplerini sil
        var topicFollows = await _context.UserTopicFollows
            .Where(tf => tf.UserId == userId)
            .ToListAsync();
        _context.UserTopicFollows.RemoveRange(topicFollows);

        // Bildirimleri sil (hem alınan hem gönderilen)
        var notifications = await _context.Notifications
            .Where(n => n.UserId == userId || n.SenderId == userId)
            .ToListAsync();
        _context.Notifications.RemoveRange(notifications);

        // Taslakları sil
        var drafts = await _context.DraftEntries
            .Where(d => d.AuthorId == userId)
            .ToListAsync();
        _context.DraftEntries.RemoveRange(drafts);

        // Şikayetlerini sil (reporter olduğu)
        var reports = await _context.Reports
            .Where(r => r.ReporterId == userId)
            .ToListAsync();
        _context.Reports.RemoveRange(reports);

        // Entry'leri sil
        var entries = await _context.Entries
            .Where(e => e.AuthorId == userId)
            .ToListAsync();
        _context.Entries.RemoveRange(entries);

        // Kullanıcıyı sil
        _context.Users.Remove(user);

        await _context.SaveChangesAsync();

        return Ok("Kullanıcı ve tüm bağlı verileri başarıyla silindi.");
    }

    // ─────────────────────────────────────────────
    // KULLANICI E-POSTA ERİŞİMİ (ADMIN ÖZEL)
    // ─────────────────────────────────────────────

    /// <summary>Belirli bir kullanıcının e-posta adresini döner (yalnızca Admin görebilir).</summary>
    [HttpGet("users/{userId:guid}/email")]
    public async Task<IActionResult> GetUserEmail(Guid userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user is null) return NotFound("Kullanıcı bulunamadı.");
        return Ok(new { email = user.Email });
    }

    // ─────────────────────────────────────────────
    // ADMİN MESAJI — KULLANICIYA BİLGİLENDİRME
    // ─────────────────────────────────────────────

    /// <summary>
    /// Hedef kullanıcıya AdminMessage tipinde bilgilendirme mesajı gönderir.
    /// </summary>
    [HttpPost("send-message")]
    public async Task<IActionResult> SendAdminMessage([FromBody] AdminMessageRequest request)
    {
        if (request.TargetUserId == Guid.Empty)
            return BadRequest("Hedef kullanıcı belirtilmedi.");

        if (string.IsNullOrWhiteSpace(request.Message))
            return BadRequest("Mesaj boş olamaz.");

        var targetUser = await _context.Users.FindAsync(request.TargetUserId);
        if (targetUser is null) return NotFound("Hedef kullanıcı bulunamadı.");

        var adminId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        if (request.TargetUserId == adminId)
            return BadRequest("Kendinize mesaj gönderemezsiniz.");

        var htmlMessage = $"""
            <div class="admin-message p-3 bg-blue-50 border-l-4 border-blue-500 rounded-md">
              <p class="font-bold text-blue-700 mb-1">Tespit Sözlük Yönetimi'nden Mesaj:</p>
              <p class="text-sm text-gray-700">{System.Net.WebUtility.HtmlEncode(request.Message.Trim())}</p>
            </div>
            """;

        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = request.TargetUserId,
            SenderId = adminId,
            Type = "AdminMessage",
            Message = htmlMessage,
            IsRead = false,
            CreatedAt = DateTime.UtcNow,
        };

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Mesaj başarıyla gönderildi.", notificationId = notification.Id });
    }

    // ─────────────────────────────────────────────
    // İLAHİ FERMAN — KULLANICIYA RESMİ UYARI
    // ─────────────────────────────────────────────

    /// <summary>
    /// Hedef kullanıcıya OfficialWarning tipinde resmi bir uyarı bildirimi gönderir.
    /// Bildirim mesajı, ilgili içeriğin URL'sini içeren hazır bir HTML şablonuyla oluşturulur.
    /// </summary>
    [HttpPost("warn-user")]
    public async Task<IActionResult> WarnUser([FromBody] WarnUserRequest request)
    {
        if (request.TargetUserId == Guid.Empty)
            return BadRequest("Hedef kullanıcı belirtilmedi.");

        var targetUser = await _context.Users.FindAsync(request.TargetUserId);
        if (targetUser is null) return NotFound("Hedef kullanıcı bulunamadı.");

        var adminId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        if (request.TargetUserId == adminId)
            return BadRequest("Kendinize uyarı gönderemezsiniz.");

        if (targetUser.Role == "Admin")
            return BadRequest("Başka bir admin hesabına uyarı gönderilemez.");

        // Hedef URL ve içerik tipi adı belirle
        string targetUrl = "#";
        string itemTypeName = "İçeriğiniz";

        if (request.EntryId.HasValue)
        {
            targetUrl = $"/entry/{request.EntryId.Value}";
            itemTypeName = "Entryniz";
        }
        else if (request.TopicId.HasValue)
        {
            targetUrl = $"/?topic={request.TopicId.Value}";
            itemTypeName = "Başlığınız";
        }

        var adminMessage = string.IsNullOrWhiteSpace(request.CustomMessage)
            ? "çok fazla argo kullanıyorsunuz, lütfen kurallara uyun. Aksi takdirde hesabınız silinecektir."
            : System.Net.WebUtility.HtmlEncode(request.CustomMessage.Trim());

        var htmlMessage = $"""
            <div class="official-warning">
              <h4 class="warning-header">🛡️ RESMİ UYARI</h4>
              <p class="warning-subject">
                <a href="{targetUrl}" target="_blank" class="item-link">{itemTypeName}</a> Şikayet Edildi:
              </p>
              <div class="admin-msg-content">
                {adminMessage}
              </div>
              <div class="signature-container">
                <span>Tespit Sözlük</span>
                <svg class="verified-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                  <path d="m9 12 2 2 4-4"/>
                </svg>
              </div>
            </div>
            """;

        var notification = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = request.TargetUserId,
            SenderId = adminId,
            Type = "OfficialWarning",
            Message = htmlMessage,
            IsRead = false,
            CreatedAt = DateTime.UtcNow,
        };

        _context.Notifications.Add(notification);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Resmi uyarı başarıyla gönderildi.", notificationId = notification.Id });
    }

    // ─────────────────────────────────────────────
    // ŞİKAYET (REPORT) YÖNETİMİ
    // ─────────────────────────────────────────────

    /// <summary>
    /// Tüm şikayetleri listeler. Çözülmemişler en üstte gelir.
    /// </summary>
    [HttpGet("reports")]
    public async Task<IActionResult> GetReports([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 50;

        var query = _context.Reports
            .Include(r => r.Reporter)
            .Include(r => r.ReportedEntry).ThenInclude(e => e!.Topic)
            .Include(r => r.ReportedEntry).ThenInclude(e => e!.Author)
            .Include(r => r.ReportedTopic).ThenInclude(t => t!.Author)
            .Include(r => r.ReportedTopic).ThenInclude(t => t!.Entries)
            .Include(r => r.ReportedUser)
            .OrderBy(r => r.IsResolved)
            .ThenByDescending(r => r.CreatedAt);

        var total = await query.CountAsync();
        var reports = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new
            {
                r.Id,
                r.Reason,
                r.Details,
                r.IsResolved,
                r.CreatedAt,
                Reporter = new { r.Reporter.Id, r.Reporter.Username, r.Reporter.Email },
                ReportedEntry = r.ReportedEntry == null ? null : new
                {
                    r.ReportedEntry.Id,
                    r.ReportedEntry.Content,
                    r.ReportedEntry.CreatedAt,
                    r.ReportedEntry.Upvotes,
                    r.ReportedEntry.Downvotes,
                    TopicId = r.ReportedEntry.TopicId,
                    TopicTitle = r.ReportedEntry.Topic.Title,
                    AuthorId = r.ReportedEntry.AuthorId,
                    AuthorName = r.ReportedEntry.Author.Username,
                    AuthorAvatar = r.ReportedEntry.Author.Avatar,
                    AuthorRole = r.ReportedEntry.Author.Role,
                    r.ReportedEntry.IsAnonymous
                },
                ReportedTopic = r.ReportedTopic == null ? null : new
                {
                    r.ReportedTopic.Id,
                    r.ReportedTopic.Title,
                    AuthorId = r.ReportedTopic.AuthorId,
                    AuthorName = r.ReportedTopic.Author != null ? r.ReportedTopic.Author.Username : null,
                    AuthorAvatar = r.ReportedTopic.Author != null ? r.ReportedTopic.Author.Avatar : null,
                    AuthorRole = r.ReportedTopic.Author != null ? r.ReportedTopic.Author.Role : "User",
                    EntryCount = r.ReportedTopic.Entries.Count
                },
                ReportedUser = r.ReportedUser == null ? null : new
                {
                    r.ReportedUser.Id,
                    r.ReportedUser.Username,
                    r.ReportedUser.Avatar,
                    AuthorRole = r.ReportedUser.Role
                }
            })
            .ToListAsync();

        return Ok(new { total, page, pageSize, reports });
    }

    /// <summary>Çözülmemiş (bekleyen) şikayetlerin sayısını döner.</summary>
    [HttpGet("reports/unread-count")]
    public async Task<IActionResult> GetUnreadReportsCount()
    {
        var count = await _context.Reports.CountAsync(r => !r.IsResolved);
        return Ok(count);
    }

    /// <summary>Şikayet çözüm durumunu toggle eder (Çözüldü ↔ Bekliyor).</summary>
    [HttpPatch("reports/{reportId:guid}/resolve")]
    public async Task<IActionResult> ToggleResolveReport(Guid reportId)
    {
        var report = await _context.Reports.FindAsync(reportId);
        if (report is null) return NotFound("Şikayet bulunamadı.");

        report.IsResolved = !report.IsResolved;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = report.IsResolved ? "Şikayet çözüldü olarak işaretlendi." : "Şikayet yeniden açıldı.",
            reportId,
            isResolved = report.IsResolved
        });
    }
}

public record RenameTopicRequest(string NewTitle);

public record WarnUserRequest(
    Guid TargetUserId,
    Guid? EntryId,
    Guid? TopicId,
    string CustomMessage
);

public record AdminMessageRequest(
    Guid TargetUserId,
    string Message
);
