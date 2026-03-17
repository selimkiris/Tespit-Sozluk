using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;
using TespitSozluk.API.DTOs;
using TespitSozluk.API.Entities;

namespace TespitSozluk.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TopicsController : ControllerBase
{
    private readonly AppDbContext _context;

    public TopicsController(AppDbContext context)
    {
        _context = context;
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

        var titleExists = await _context.Topics
            .AnyAsync(t => t.Title.ToLower() == dto.Title.Trim().ToLower());
        if (titleExists)
        {
            return BadRequest("Bu başlık zaten mevcut.");
        }

        var topic = new Topic
        {
            Id = Guid.NewGuid(),
            Title = dto.Title.Trim(),
            AuthorId = authorId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Topics.Add(topic);
        await _context.SaveChangesAsync();

        return Ok(topic);
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

        var query = _context.Topics
            .Include(t => t.Author)
            .Include(t => t.Entries)
            .OrderByDescending(t => t.CreatedAt);

        var totalCount = await query.CountAsync();

        var topics = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new TopicResponseDto
            {
                Id = t.Id,
                Title = t.Title,
                AuthorId = t.AuthorId,
                AuthorName = t.Author.FirstName + " " + t.Author.LastName,
                CreatedAt = t.CreatedAt,
                EntryCount = t.Entries.Count
            })
            .ToListAsync();

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        return new PagedTopicsDto
        {
            Items = topics,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            TotalPages = totalPages,
            HasPreviousPage = page > 1,
            HasNextPage = page < totalPages
        };
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

        var query = _context.Topics
            .Include(t => t.Author)
            .Include(t => t.Entries)
            .OrderBy(t => t.Title);

        var totalCount = await query.CountAsync();

        var topics = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new TopicResponseDto
            {
                Id = t.Id,
                Title = t.Title,
                AuthorId = t.AuthorId,
                AuthorName = t.Author.FirstName + " " + t.Author.LastName,
                CreatedAt = t.CreatedAt,
                EntryCount = t.Entries.Count
            })
            .ToListAsync();

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        return new PagedTopicsDto
        {
            Items = topics,
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
            .Where(e => e.TopicId == id)
            .OrderBy(e => e.CreatedAt);

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
                e.CreatedAt
            })
            .ToListAsync();

        Dictionary<Guid, int> userVotes = new();
        if (userId.HasValue && entriesData.Count > 0)
        {
            var entryIds = entriesData.Select(e => e.Id).ToList();
            var votes = await _context.EntryVotes
                .Where(v => v.UserId == userId.Value && entryIds.Contains(v.EntryId))
                .Select(v => new { v.EntryId, v.IsUpvote })
                .ToListAsync();
            userVotes = votes.ToDictionary(v => v.EntryId, v => v.IsUpvote ? 1 : -1);
        }

        var entries = entriesData.Select(e => new EntryResponseDto
        {
            Id = e.Id,
            Content = e.Content,
            Upvotes = e.Upvotes,
            Downvotes = e.Downvotes,
            TopicId = e.TopicId,
            TopicTitle = e.TopicTitle,
            AuthorId = e.AuthorId,
            AuthorName = e.AuthorName,
            CreatedAt = e.CreatedAt,
            UserVoteType = userId.HasValue && userVotes.TryGetValue(e.Id, out var vt) ? vt : 0
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

    [AllowAnonymous]
    [HttpGet("random")]
    public async Task<ActionResult<TopicResponseDto>> GetRandom()
    {
        var recentTopics = await _context.Topics
            .Include(t => t.Author)
            .OrderByDescending(t => t.CreatedAt)
            .Take(50)
            .Select(t => new TopicResponseDto
            {
                Id = t.Id,
                Title = t.Title,
                AuthorId = t.AuthorId,
                AuthorName = t.Author.FirstName + " " + t.Author.LastName,
                CreatedAt = t.CreatedAt
            })
            .ToListAsync();

        if (recentTopics.Count == 0)
        {
            return NotFound("Henüz başlık bulunmuyor.");
        }

        var randomIndex = Random.Shared.Next(recentTopics.Count);
        return recentTopics[randomIndex];
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

        var topic = await _context.Topics
            .Include(t => t.Entries)
            .FirstOrDefaultAsync(t => t.Id == id);
        if (topic == null)
        {
            return NotFound();
        }

        if (topic.AuthorId != userId)
        {
            return StatusCode(403, "Bu başlığı düzenleme yetkiniz yok.");
        }

        var hasOtherAuthorsEntries = (topic.Entries ?? Enumerable.Empty<Entry>()).Any(e => e.AuthorId != userId);
        if (hasOtherAuthorsEntries)
        {
            return StatusCode(403, "Bu başlıkta başkalarının da entry'si var, silemez/düzenleyemezsiniz.");
        }

        var newTitle = dto.Title.Trim();
        var titleExists = await _context.Topics
            .AnyAsync(t => t.Title.ToLower() == newTitle.ToLower() && t.Id != id);
        if (titleExists)
        {
            return BadRequest("Bu başlık adı zaten mevcut.");
        }

        topic.Title = newTitle;
        await _context.SaveChangesAsync();

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

        var topic = await _context.Topics
            .Include(t => t.Entries)
            .FirstOrDefaultAsync(t => t.Id == id);
        if (topic == null)
        {
            return NotFound();
        }

        if (topic.AuthorId != userId)
        {
            return StatusCode(403, "Bu başlığı silme yetkiniz yok.");
        }

        var hasOtherAuthorsEntries = (topic.Entries ?? Enumerable.Empty<Entry>()).Any(e => e.AuthorId != userId);
        if (hasOtherAuthorsEntries)
        {
            return StatusCode(403, "Bu başlıkta başkalarının da entry'si var, silemez/düzenleyemezsiniz.");
        }

        _context.Topics.Remove(topic);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
