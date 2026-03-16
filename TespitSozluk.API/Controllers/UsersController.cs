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
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;

    public UsersController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserProfileDto>> GetUser(Guid id)
    {
        var user = await _context.Users
            .Include(u => u.Entries)
            .ThenInclude(e => e.Author)
            .AsSplitQuery()
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null)
        {
            return NotFound();
        }

        var entries = user.Entries
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
            .ToList();

        return new UserProfileDto
        {
            Id = user.Id,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Email = user.Email,
            CreatedAt = user.CreatedAt,
            Entries = entries
        };
    }
}
