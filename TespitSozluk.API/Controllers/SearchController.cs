using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;
using TespitSozluk.API.DTOs;

namespace TespitSozluk.API.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/[controller]")]
public class SearchController : ControllerBase
{
    private readonly AppDbContext _context;

    public SearchController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<SearchResultDto>> Search([FromQuery] string? q)
    {
        if (string.IsNullOrWhiteSpace(q))
        {
            return new SearchResultDto();
        }

        var searchTerm = q.Trim().ToLowerInvariant();

        var topics = await _context.Topics
            .Include(t => t.Author)
            .Where(t => t.Title.ToLower().Contains(searchTerm))
            .Select(t => new TopicResponseDto
            {
                Id = t.Id,
                Title = t.Title,
                AuthorId = t.AuthorId,
                AuthorName = t.Author.FirstName + " " + t.Author.LastName,
                CreatedAt = t.CreatedAt
            })
            .ToListAsync();

        var entries = await _context.Entries
            .Include(e => e.Author)
            .Where(e => e.Content.ToLower().Contains(searchTerm))
            .Select(e => new EntryResponseDto
            {
                Id = e.Id,
                Content = e.Content,
                Upvotes = e.Upvotes,
                Downvotes = e.Downvotes,
                TopicId = e.TopicId,
                AuthorId = e.AuthorId,
                AuthorName = e.Author.FirstName + " " + e.Author.LastName,
                CreatedAt = e.CreatedAt
            })
            .ToListAsync();

        return new SearchResultDto
        {
            Topics = topics,
            Entries = entries
        };
    }
}
