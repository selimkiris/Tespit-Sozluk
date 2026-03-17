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
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;

    public UsersController(AppDbContext context)
    {
        _context = context;
    }

    [AllowAnonymous]
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserProfileResponseDto>> GetUser(Guid id)
    {
        var user = await _context.Users
            .Where(u => u.Id == id)
            .Select(u => new
            {
                u.Id,
                u.FirstName,
                u.LastName,
                u.Email,
                EntryCount = u.Entries.Count
            })
            .FirstOrDefaultAsync();

        if (user == null)
        {
            return NotFound();
        }

        var nickname = (user.FirstName + " " + user.LastName).Trim();
        if (string.IsNullOrEmpty(nickname))
        {
            nickname = "Anonim";
        }

        var requestorId = User.Identity?.IsAuthenticated == true
            && Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid)
            ? (Guid?)uid
            : null;

        var isOwnProfile = requestorId.HasValue && requestorId.Value == id;

        return new UserProfileResponseDto
        {
            Id = user.Id,
            Nickname = nickname,
            TotalEntryCount = user.EntryCount,
            Email = isOwnProfile ? user.Email : null
        };
    }

    [AllowAnonymous]
    [HttpGet("{id:guid}/entries")]
    public async Task<ActionResult<PagedEntriesDto>> GetUserEntries(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var userExists = await _context.Users.AnyAsync(u => u.Id == id);
        if (!userExists)
        {
            return NotFound();
        }

        var requestorId = User.Identity?.IsAuthenticated == true
            && Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid)
            ? (Guid?)uid
            : null;

        var query = _context.Entries
            .Include(e => e.Author)
            .Include(e => e.Topic)
            .Where(e => e.AuthorId == id)
            .OrderByDescending(e => e.CreatedAt);

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

        var entryIds = entriesData.Select(e => e.Id).ToList();
        Dictionary<Guid, int> userVotes = new();
        if (requestorId.HasValue && entryIds.Count > 0)
        {
            var votes = await _context.EntryVotes
                .Where(v => v.UserId == requestorId.Value && entryIds.Contains(v.EntryId))
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
            UserVoteType = requestorId.HasValue && userVotes.TryGetValue(e.Id, out var vt) ? vt : 0
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
}
