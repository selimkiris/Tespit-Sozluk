using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;
using TespitSozluk.API.Filters;

namespace TespitSozluk.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StatsController : ControllerBase
{
    private readonly AppDbContext _context;

    public StatsController(AppDbContext context)
    {
        _context = context;
    }

    /// <remarks>
    /// Başlık sayısı, sol menüdeki <c>GET api/Topics/latest</c> ile aynı görünürlük kurallarını kullanır:
    /// <see cref="BlockFilterExtensions"/> üzerinden <c>ApplyBlockFilter</c> ile oturum açmış kullanıcı için
    /// engellenen başlıklar ve yalnızca engellenen yazarlara ait görünür entry olan başlıklar sayıdan çıkar;
    /// görünür entry kuralı uygulanır (sidebar ile aynı).
    /// </remarks>
    [AllowAnonymous]
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var usersCount = await _context.Users.CountAsync();
        var currentUserId = GetCurrentUserId();
        var topicsCount = await _context.Topics
            .AsNoTracking()
            .ApplyBlockFilter(_context, currentUserId)
            .CountAsync();
        var entriesCount = await _context.Entries.CountAsync();

        return Ok(new
        {
            users = usersCount,
            topics = topicsCount,
            entries = entriesCount
        });
    }

    private Guid? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return !string.IsNullOrEmpty(claim) && Guid.TryParse(claim, out var uid) ? uid : null;
    }
}
