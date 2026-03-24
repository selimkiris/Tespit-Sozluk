using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;
using TespitSozluk.API.DTOs;
using TespitSozluk.API.Entities;

namespace TespitSozluk.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class DraftsController : ControllerBase
{
    private const int DraftsPageSize = 25;

    private readonly AppDbContext _context;

    public DraftsController(AppDbContext context)
    {
        _context = context;
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

        var drafts = await baseQuery
            .OrderByDescending(d => d.UpdatedAt)
            .Skip((page - 1) * DraftsPageSize)
            .Take(DraftsPageSize)
            .Select(d => new DraftResponseDto
            {
                Id = d.Id,
                AuthorId = d.AuthorId,
                Content = d.Content,
                TopicId = d.TopicId,
                TopicTitle = d.Topic != null ? d.Topic.Title : null,
                NewTopicTitle = d.NewTopicTitle,
                IsAnonymous = d.IsAnonymous,
                CreatedAt = d.CreatedAt,
                UpdatedAt = d.UpdatedAt
            })
            .ToListAsync();

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

        var draft = await _context.DraftEntries
            .Include(d => d.Topic)
            .Where(d => d.Id == id && d.AuthorId == authorId)
            .Select(d => new DraftResponseDto
            {
                Id = d.Id,
                AuthorId = d.AuthorId,
                Content = d.Content,
                TopicId = d.TopicId,
                TopicTitle = d.Topic != null ? d.Topic.Title : null,
                NewTopicTitle = d.NewTopicTitle,
                IsAnonymous = d.IsAnonymous,
                CreatedAt = d.CreatedAt,
                UpdatedAt = d.UpdatedAt
            })
            .FirstOrDefaultAsync();

        if (draft == null)
        {
            return NotFound();
        }

        return draft;
    }

    [HttpPost]
    public async Task<ActionResult<DraftResponseDto>> CreateDraft([FromBody] CreateDraftDto dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var authorId))
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(dto.Content))
        {
            return BadRequest("İçerik boş olamaz.");
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

        if (!string.IsNullOrEmpty(dto.Content))
        {
            dto.Content = System.Text.RegularExpressions.Regex.Replace(
                dto.Content,
                @"^(<p>\s*</p>|<p><br\s*/?></p>|<br\s*/?>|\s)+",
                "",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase
            );
            dto.Content = System.Text.RegularExpressions.Regex.Replace(
                dto.Content,
                @"(<p>\s*</p>|<p><br\s*/?></p>|<br\s*/?>|\s)+$",
                "",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase
            );
            dto.Content = dto.Content.Trim();
        }

        var draft = new DraftEntry
        {
            Id = Guid.NewGuid(),
            AuthorId = authorId,
            Content = dto.Content.Trim(),
            TopicId = topicId,
            NewTopicTitle = newTopicTitle,
            IsAnonymous = dto.IsAnonymous,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
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
            UpdatedAt = draft.UpdatedAt
        };

        return Created($"/api/Drafts/{draft.Id}", response);
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

        if (string.IsNullOrWhiteSpace(dto.Content))
        {
            return BadRequest("İçerik boş olamaz.");
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

        if (!string.IsNullOrEmpty(dto.Content))
        {
            dto.Content = System.Text.RegularExpressions.Regex.Replace(
                dto.Content,
                @"^(<p>\s*</p>|<p><br\s*/?></p>|<br\s*/?>|\s)+",
                "",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase
            );
            dto.Content = System.Text.RegularExpressions.Regex.Replace(
                dto.Content,
                @"(<p>\s*</p>|<p><br\s*/?></p>|<br\s*/?>|\s)+$",
                "",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase
            );
            dto.Content = dto.Content.Trim();
        }

        draft.Content = dto.Content.Trim();
        draft.TopicId = topicId;
        draft.NewTopicTitle = newTopicTitle;
        draft.IsAnonymous = dto.IsAnonymous;
        draft.UpdatedAt = DateTime.UtcNow;

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
            UpdatedAt = draft.UpdatedAt
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
    public async Task<ActionResult<object>> PublishDraft(Guid id)
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

        Guid targetTopicId;
        string? message = null;

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
                var newTopic = new Topic
                {
                    Id = Guid.NewGuid(),
                    Title = draft.NewTopicTitle.Trim(),
                    AuthorId = authorId,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Topics.Add(newTopic);
                await _context.SaveChangesAsync();
                targetTopicId = newTopic.Id;
            }
        }
        else
        {
            return BadRequest("Taslakta ne başlık ID'si ne de yeni başlık adı bulunuyor.");
        }

        if (!string.IsNullOrEmpty(draft.Content))
        {
            draft.Content = System.Text.RegularExpressions.Regex.Replace(
                draft.Content,
                @"^(<p>\s*</p>|<p><br\s*/?></p>|<br\s*/?>|\s)+",
                "",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase
            );
            draft.Content = System.Text.RegularExpressions.Regex.Replace(
                draft.Content,
                @"(<p>\s*</p>|<p><br\s*/?></p>|<br\s*/?>|\s)+$",
                "",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase
            );
            draft.Content = draft.Content.Trim();
        }

        var entry = new Entry
        {
            Id = Guid.NewGuid(),
            Content = draft.Content.Trim(),
            TopicId = targetTopicId,
            AuthorId = authorId,
            IsAnonymous = draft.IsAnonymous,
            CreatedAt = DateTime.UtcNow
        };

        _context.Entries.Add(entry);
        _context.DraftEntries.Remove(draft);
        await _context.SaveChangesAsync();

        var result = new
        {
            entryId = entry.Id,
            topicId = targetTopicId,
            message
        };

        return Ok(result);
    }
}
