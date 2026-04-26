using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;
using TespitSozluk.API.DTOs;
using TespitSozluk.API.Entities;
using TespitSozluk.API.Helpers;
using TespitSozluk.API.Services;

namespace TespitSozluk.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class DraftsController : ControllerBase
{
    private const int DraftsPageSize = 25;

    private readonly AppDbContext _context;
    private readonly IPollService _pollService;

    public DraftsController(AppDbContext context, IPollService pollService)
    {
        _context = context;
        _pollService = pollService;
    }

    [HttpGet]
    public async Task<ActionResult<DraftsPagedResponseDto>> GetMyDrafts([FromQuery] int page = 1)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var authorId))
        {
            return Unauthorized();
        }

        if (page < 1)
        {
            page = 1;
        }

        var baseQuery = _context.DraftEntries.Where(d => d.AuthorId == authorId);

        var totalCount = await baseQuery.CountAsync();

        var rows = await baseQuery
            .OrderByDescending(d => d.UpdatedAt)
            .Skip((page - 1) * DraftsPageSize)
            .Take(DraftsPageSize)
            .Select(d => new
            {
                d.Id,
                d.AuthorId,
                d.Content,
                d.TopicId,
                TopicTitle = d.Topic != null ? d.Topic.Title : null,
                d.NewTopicTitle,
                d.IsAnonymous,
                d.CreatedAt,
                d.UpdatedAt,
                d.PollData
            })
            .ToListAsync();

        var drafts = rows.Select(r => new DraftResponseDto
        {
            Id = r.Id,
            AuthorId = r.AuthorId,
            Content = r.Content,
            TopicId = r.TopicId,
            TopicTitle = r.TopicTitle,
            NewTopicTitle = r.NewTopicTitle,
            IsAnonymous = r.IsAnonymous,
            CreatedAt = r.CreatedAt,
            UpdatedAt = r.UpdatedAt,
            Poll = _pollService.DeserializeDraftPoll(r.PollData)
        }).ToList();

        if (drafts.Count > 0)
        {
            var raw = drafts.Select(d => d.Content).ToList();
            var processed = await EntryPublicContentBatch.ProcessContentsAsync(_context, raw, HttpContext.RequestAborted);
            for (var i = 0; i < drafts.Count; i++)
            {
                drafts[i].Content = processed[i].Content;
            }
        }

        return new DraftsPagedResponseDto
        {
            Items = drafts,
            TotalCount = totalCount,
            Page = page,
            PageSize = DraftsPageSize
        };
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<DraftResponseDto>> GetDraft(Guid id)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var authorId))
        {
            return Unauthorized();
        }

        var row = await _context.DraftEntries
            .Include(d => d.Topic)
            .Where(d => d.Id == id && d.AuthorId == authorId)
            .Select(d => new
            {
                d.Id,
                d.AuthorId,
                d.Content,
                d.TopicId,
                TopicTitle = d.Topic != null ? d.Topic.Title : null,
                d.NewTopicTitle,
                d.IsAnonymous,
                d.CreatedAt,
                d.UpdatedAt,
                d.PollData
            })
            .FirstOrDefaultAsync();

        if (row == null)
        {
            return NotFound();
        }

        return new DraftResponseDto
        {
            Id = row.Id,
            AuthorId = row.AuthorId,
            Content = row.Content,
            TopicId = row.TopicId,
            TopicTitle = row.TopicTitle,
            NewTopicTitle = row.NewTopicTitle,
            IsAnonymous = row.IsAnonymous,
            CreatedAt = row.CreatedAt,
            UpdatedAt = row.UpdatedAt,
            Poll = _pollService.DeserializeDraftPoll(row.PollData)
        };
    }

    [HttpPost]
    public async Task<ActionResult<DraftResponseDto>> CreateDraft([FromBody] CreateDraftDto dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var authorId))
        {
            return Unauthorized();
        }

        // Yeni politika: taslak içeriği boş olabilir, ANCAK içerisinde anket varsa.
        if (string.IsNullOrWhiteSpace(dto.Content) && dto.Poll == null)
        {
            return BadRequest("İçerik veya anket gerekli.");
        }

        // TopicId veya NewTopicTitle'dan en az biri dolu olmalı (veya ikisi de - o zaman TopicId öncelikli)
        if (!dto.TopicId.HasValue && string.IsNullOrWhiteSpace(dto.NewTopicTitle))
        {
            return BadRequest("Mevcut başlık seçin veya yeni başlık adı girin.");
        }

        Guid? topicId = null;
        string? newTopicTitle = null;

        if (dto.TopicId.HasValue)
        {
            var topicExists = await _context.Topics.AnyAsync(t => t.Id == dto.TopicId.Value);
            if (!topicExists)
            {
                return NotFound("Seçilen başlık bulunamadı.");
            }
            topicId = dto.TopicId;
        }
        else
        {
            newTopicTitle = dto.NewTopicTitle?.Trim();
            if (string.IsNullOrEmpty(newTopicTitle))
            {
                return BadRequest("Yeni başlık adı boş olamaz.");
            }
            if (newTopicTitle.Length > 60)
            {
                return BadRequest("Başlık en fazla 60 karakter olabilir.");
            }
        }

        dto.Content = NormalizeDraftContent(dto.Content);

        var draft = new DraftEntry
        {
            Id = Guid.NewGuid(),
            AuthorId = authorId,
            Content = (dto.Content ?? string.Empty).Trim(),
            TopicId = topicId,
            NewTopicTitle = newTopicTitle,
            IsAnonymous = dto.IsAnonymous,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            // Anket: dto.Poll varsa jsonb olarak serileştir; yoksa null.
            PollData = _pollService.SerializeDraftPoll(dto.Poll)
        };

        _context.DraftEntries.Add(draft);
        await _context.SaveChangesAsync();

        var topic = topicId.HasValue ? await _context.Topics.FindAsync(topicId) : null;
        var response = new DraftResponseDto
        {
            Id = draft.Id,
            AuthorId = draft.AuthorId,
            Content = draft.Content,
            TopicId = draft.TopicId,
            TopicTitle = topic?.Title,
            NewTopicTitle = draft.NewTopicTitle,
            IsAnonymous = draft.IsAnonymous,
            CreatedAt = draft.CreatedAt,
            UpdatedAt = draft.UpdatedAt,
            Poll = _pollService.DeserializeDraftPoll(draft.PollData)
        };

        return Created($"/api/Drafts/{draft.Id}", response);
    }

    private static string NormalizeDraftContent(string? content)
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

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<DraftResponseDto>> UpdateDraft(Guid id, [FromBody] UpdateDraftDto dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var authorId))
        {
            return Unauthorized();
        }

        var draft = await _context.DraftEntries
            .Include(d => d.Topic)
            .FirstOrDefaultAsync(d => d.Id == id && d.AuthorId == authorId);

        if (draft == null)
        {
            return NotFound();
        }

        // Update sonrası taslakta anket olacak mı? (yeni payload veya korunan eski)
        var willHavePoll = dto.Poll != null
            || (!dto.RemovePoll && !string.IsNullOrWhiteSpace(draft.PollData));

        // Yeni politika: taslak içeriği boş olabilir, ANCAK içerisinde anket varsa.
        if (string.IsNullOrWhiteSpace(dto.Content) && !willHavePoll)
        {
            return BadRequest("İçerik veya anket gerekli.");
        }

        Guid? topicId = null;
        string? newTopicTitle = null;

        if (dto.TopicId.HasValue)
        {
            var topicExists = await _context.Topics.AnyAsync(t => t.Id == dto.TopicId.Value);
            if (!topicExists)
            {
                return NotFound("Seçilen başlık bulunamadı.");
            }
            topicId = dto.TopicId;
        }
        else if (!string.IsNullOrWhiteSpace(dto.NewTopicTitle))
        {
            newTopicTitle = dto.NewTopicTitle.Trim();
            if (newTopicTitle.Length > 60)
            {
                return BadRequest("Başlık en fazla 60 karakter olabilir.");
            }
        }
        else
        {
            return BadRequest("Mevcut başlık seçin veya yeni başlık adı girin.");
        }

        dto.Content = NormalizeDraftContent(dto.Content);

        draft.Content = (dto.Content ?? string.Empty).Trim();
        draft.TopicId = topicId;
        draft.NewTopicTitle = newTopicTitle;
        draft.IsAnonymous = dto.IsAnonymous;
        draft.UpdatedAt = DateTime.UtcNow;

        // Anket güncelleme:
        // - Poll yollandıysa: jsonb'ı tamamen yeni payload ile değiştir.
        // - Poll yok + RemovePoll=true: PollData null'a çek.
        // - Hiçbiri: PollData dokunulmaz.
        if (dto.Poll != null)
        {
            draft.PollData = _pollService.SerializeDraftPoll(dto.Poll);
        }
        else if (dto.RemovePoll)
        {
            draft.PollData = null;
        }

        await _context.SaveChangesAsync();

        var topic = topicId.HasValue ? await _context.Topics.FindAsync(topicId) : null;
        return new DraftResponseDto
        {
            Id = draft.Id,
            AuthorId = draft.AuthorId,
            Content = draft.Content,
            TopicId = draft.TopicId,
            TopicTitle = topic?.Title,
            NewTopicTitle = draft.NewTopicTitle,
            IsAnonymous = draft.IsAnonymous,
            CreatedAt = draft.CreatedAt,
            UpdatedAt = draft.UpdatedAt,
            Poll = _pollService.DeserializeDraftPoll(draft.PollData)
        };
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteDraft(Guid id)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var authorId))
        {
            return Unauthorized();
        }

        var draft = await _context.DraftEntries
            .FirstOrDefaultAsync(d => d.Id == id && d.AuthorId == authorId);

        if (draft == null)
        {
            return NotFound();
        }

        _context.DraftEntries.Remove(draft);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("{id:guid}/publish")]
    public async Task<ActionResult<object>> PublishDraft(Guid id, [FromBody] PublishDraftDto? dto = null)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var authorId))
        {
            return Unauthorized();
        }

        var draft = await _context.DraftEntries
            .Include(d => d.Topic)
            .FirstOrDefaultAsync(d => d.Id == id && d.AuthorId == authorId);

        if (draft == null)
        {
            return NotFound("Taslak bulunamadı.");
        }

        var publishAsAnonymous = dto?.IsAnonymous ?? draft.IsAnonymous;

        Guid targetTopicId;
        string? message = null;
        Topic? pendingNewTopic = null;

        if (draft.TopicId.HasValue)
        {
            targetTopicId = draft.TopicId.Value;
            var topicExists = await _context.Topics.AnyAsync(t => t.Id == targetTopicId);
            if (!topicExists)
            {
                return BadRequest("Başlık artık mevcut değil.");
            }
        }
        else if (!string.IsNullOrWhiteSpace(draft.NewTopicTitle))
        {
            var titleLower = draft.NewTopicTitle.Trim().ToLowerInvariant();
            var existingTopic = await _context.Topics
                .FirstOrDefaultAsync(t => t.Title.ToLower() == titleLower);

            if (existingTopic != null)
            {
                targetTopicId = existingTopic.Id;
                message = "Bu başlık başka bir yazar tarafından açılmış, entry'niz mevcut başlığa eklendi.";
            }
            else
            {
                // Slug zorunlu ve Topics.Slug üzerinde unique index var; boş bırakılırsa
                // ikinci yayınlamada (veya çakışmada) DbUpdateException → 500 oluşur.
                var trimmedTitle = draft.NewTopicTitle.Trim();
                var topicId = Guid.NewGuid();
                var slug = SlugHelper.BuildTopicSlug(trimmedTitle, topicId);
                var slugRetryGuard = 0;
                while (await _context.Topics.AsNoTracking().AnyAsync(t => t.Slug == slug) && slugRetryGuard < 5)
                {
                    topicId = Guid.NewGuid();
                    slug = SlugHelper.BuildTopicSlug(trimmedTitle, topicId);
                    slugRetryGuard++;
                }

                pendingNewTopic = new Topic
                {
                    Id = topicId,
                    Title = trimmedTitle,
                    Slug = slug,
                    AuthorId = authorId,
                    CreatedAt = DateTime.UtcNow,
                    IsAnonymous = publishAsAnonymous
                };
                targetTopicId = topicId;
            }
        }
        else
        {
            return BadRequest("Taslakta ne başlık ID'si ne de yeni başlık adı bulunuyor.");
        }

        draft.Content = NormalizeDraftContent(draft.Content);

        // Yeni politika: yayında entry metni boş olabilir, ANCAK içerisinde anket olacaksa.
        var draftPollDto = _pollService.DeserializeDraftPoll(draft.PollData);
        if (string.IsNullOrWhiteSpace(draft.Content) && draftPollDto == null)
        {
            return BadRequest("İçerik veya anket gerekli.");
        }

        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            if (pendingNewTopic != null)
            {
                _context.Topics.Add(pendingNewTopic);
            }

            var entry = new Entry
            {
                Id = Guid.NewGuid(),
                Content = (draft.Content ?? string.Empty).Trim(),
                TopicId = targetTopicId,
                AuthorId = authorId,
                IsAnonymous = publishAsAnonymous,
                CreatedAt = DateTime.UtcNow
            };

            _context.Entries.Add(entry);

            // Taslakta anket varsa: ilişkisel Poll/PollOption tablolarına dönüştür; tek SaveChanges ile commit.
            if (draftPollDto != null)
            {
                try
                {
                    _pollService.CreatePollForEntry(entry, draftPollDto, authorId);
                }
                catch (PollValidationException ex)
                {
                    await transaction.RollbackAsync();
                    _context.ChangeTracker.Clear();
                    return BadRequest(new { message = ex.Message });
                }
            }

            _context.DraftEntries.Remove(draft);
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new
            {
                entryId = entry.Id,
                topicId = targetTopicId,
                message
            });
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }
}
