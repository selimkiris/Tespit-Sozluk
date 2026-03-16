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
    public async Task<ActionResult<List<TopicResponseDto>>> GetLatest()
    {
        var topics = await _context.Topics
            .Include(t => t.Author)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new TopicResponseDto
            {
                Id = t.Id,
                Title = t.Title,
                AuthorId = t.AuthorId,
                AuthorName = t.Author.FirstName + " " + t.Author.LastName,
                CreatedAt = t.CreatedAt
            })
            .ToListAsync();

        return topics;
    }

    [AllowAnonymous]
    [HttpGet("alphabetical")]
    public async Task<ActionResult<List<TopicResponseDto>>> GetAlphabetical()
    {
        var topics = await _context.Topics
            .Include(t => t.Author)
            .OrderBy(t => t.Title)
            .Select(t => new TopicResponseDto
            {
                Id = t.Id,
                Title = t.Title,
                AuthorId = t.AuthorId,
                AuthorName = t.Author.FirstName + " " + t.Author.LastName,
                CreatedAt = t.CreatedAt
            })
            .ToListAsync();

        return topics;
    }
}
