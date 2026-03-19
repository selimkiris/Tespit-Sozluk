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
        if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2)
        {
            return new SearchResultDto();
        }

        var searchTerm = q.Trim().ToLowerInvariant();
        var searchPattern = $"%{searchTerm}%";

        var topics = await _context.Topics
            .Where(t => EF.Functions.ILike(t.Title, searchPattern))
            .Select(t => new TopicSearchResultDto
            {
                Id = t.Id,
                Title = t.Title
            })
            .Take(10)
            .ToListAsync();

        var users = await _context.Users
            .Where(u =>
                EF.Functions.ILike(u.FirstName, searchPattern) ||
                EF.Functions.ILike(u.LastName, searchPattern) ||
                EF.Functions.ILike(u.FirstName + " " + u.LastName, searchPattern) ||
                EF.Functions.ILike(u.LastName + " " + u.FirstName, searchPattern))
            .Select(u => new UserSearchResultDto
            {
                Id = u.Id,
                Name = (u.FirstName + " " + u.LastName).Trim(),
                Avatar = u.Avatar
            })
            .Take(10)
            .ToListAsync();

        return new SearchResultDto
        {
            Topics = topics,
            Users = users
        };
    }
}
