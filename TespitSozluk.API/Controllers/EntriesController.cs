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
public class EntriesController : ControllerBase
{
    private readonly AppDbContext _context;

    public EntriesController(AppDbContext context)
    {
        _context = context;
    }

    [AllowAnonymous]
    [HttpGet("feed")]
    public async Task<ActionResult<PagedEntriesDto>> GetFeed(
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

        var query = _context.Entries
            .Include(e => e.Author)
            .Include(e => e.Topic)
            .OrderByDescending(e => e.CreatedAt);

        var totalCount = await query.CountAsync();

        var entries = await query
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
        if (userId.HasValue && entries.Count > 0)
        {
            var entryIds = entries.Select(e => e.Id).ToList();
            var votes = await _context.EntryVotes
                .Where(v => v.UserId == userId.Value && entryIds.Contains(v.EntryId))
                .Select(v => new { v.EntryId, v.IsUpvote })
                .ToListAsync();
            userVotes = votes.ToDictionary(v => v.EntryId, v => v.IsUpvote ? 1 : -1);
        }

        var result = entries.Select(e => new EntryResponseDto
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
            Items = result,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            TotalPages = totalPages,
            HasPreviousPage = page > 1,
            HasNextPage = page < totalPages
        };
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
                e.CreatedAt
            })
            .ToListAsync();

        Dictionary<Guid, int> userVotes = new();
        if (userId.HasValue && entries.Count > 0)
        {
            var entryIds = entries.Select(e => e.Id).ToList();
            var votes = await _context.EntryVotes
                .Where(v => v.UserId == userId.Value && entryIds.Contains(v.EntryId))
                .Select(v => new { v.EntryId, v.IsUpvote })
                .ToListAsync();
            userVotes = votes.ToDictionary(v => v.EntryId, v => v.IsUpvote ? 1 : -1);
        }

        var result = entries.Select(e => new EntryResponseDto
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

        return result;
    }

    [Authorize]
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

        var entry = new Entry
        {
            Id = Guid.NewGuid(),
            Content = dto.Content.Trim(),
            TopicId = dto.TopicId,
            AuthorId = authorId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Entries.Add(entry);
        await _context.SaveChangesAsync();

        var author = await _context.Users.FindAsync(authorId);
        var topic = await _context.Topics.FindAsync(entry.TopicId);
        var response = MapToResponseDto(entry, author!, topic!);

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

        entry.Content = dto.Content.Trim();
        await _context.SaveChangesAsync();

        var author = await _context.Users.FindAsync(entry.AuthorId);
        var topic = await _context.Topics.FindAsync(entry.TopicId);
        var userVoteType = 0;
        var vote = await _context.EntryVotes
            .FirstOrDefaultAsync(v => v.EntryId == id && v.UserId == authorId);
        if (vote != null) userVoteType = vote.IsUpvote ? 1 : -1;
        var response = MapToResponseDto(entry, author!, topic!, userVoteType);
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

        _context.Entries.Remove(entry);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [Authorize]
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
        }
        else if (existingVote.IsUpvote)
        {
            _context.EntryVotes.Remove(existingVote);
            entry.Upvotes--;
        }
        else
        {
            existingVote.IsUpvote = true;
            entry.Downvotes--;
            entry.Upvotes++;
        }

        await _context.SaveChangesAsync();

        var userVoteType = existingVote == null ? 1 : (existingVote.IsUpvote ? 0 : 1);
        return Ok(new { upvotes = entry.Upvotes, downvotes = entry.Downvotes, userVoteType });
    }

    [Authorize]
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
        }
        else if (!existingVote.IsUpvote)
        {
            _context.EntryVotes.Remove(existingVote);
            entry.Downvotes--;
        }
        else
        {
            existingVote.IsUpvote = false;
            entry.Upvotes--;
            entry.Downvotes++;
        }

        await _context.SaveChangesAsync();

        var userVoteType = existingVote == null ? -1 : (!existingVote.IsUpvote ? 0 : -1);
        return Ok(new { upvotes = entry.Upvotes, downvotes = entry.Downvotes, userVoteType });
    }

    private static EntryResponseDto MapToResponseDto(Entry entry, User author, Topic topic, int userVoteType = 0)
    {
        return new EntryResponseDto
        {
            Id = entry.Id,
            Content = entry.Content,
            Upvotes = entry.Upvotes,
            Downvotes = entry.Downvotes,
            TopicId = entry.TopicId,
            TopicTitle = topic.Title,
            AuthorId = entry.AuthorId,
            AuthorName = author.FirstName + " " + author.LastName,
            CreatedAt = entry.CreatedAt,
            UserVoteType = userVoteType
        };
    }
}
