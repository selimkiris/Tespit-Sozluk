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
public class EntriesController : ControllerBase
{
    private readonly AppDbContext _context;

    public EntriesController(AppDbContext context)
    {
        _context = context;
    }

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
        var response = MapToResponseDto(entry, author!);

        return Created($"/api/entries/{entry.Id}", response);
    }

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

        return Ok(entry);
    }

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

    [HttpPost("{id}/vote")]
    public async Task<IActionResult> Vote(Guid id, [FromBody] VoteDto dto)
    {
        var voteType = dto.VoteType?.Trim().ToLowerInvariant();
        if (voteType != "upvote" && voteType != "downvote")
        {
            return BadRequest("VoteType 'upvote' veya 'downvote' olmalıdır.");
        }

        var entry = await _context.Entries.FindAsync(id);
        if (entry == null)
        {
            return NotFound();
        }

        if (voteType == "upvote")
        {
            entry.Upvotes++;
        }
        else
        {
            entry.Downvotes++;
        }

        await _context.SaveChangesAsync();

        return Ok(entry);
    }

    private static EntryResponseDto MapToResponseDto(Entry entry, User author)
    {
        return new EntryResponseDto
        {
            Id = entry.Id,
            Content = entry.Content,
            Upvotes = entry.Upvotes,
            Downvotes = entry.Downvotes,
            TopicId = entry.TopicId,
            AuthorId = entry.AuthorId,
            AuthorName = author.FirstName + " " + author.LastName,
            CreatedAt = entry.CreatedAt
        };
    }
}
