using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;

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

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var usersCount = await _context.Users.CountAsync();
        var topicsCount = await _context.Topics.CountAsync();
        var entriesCount = await _context.Entries.CountAsync();

        return Ok(new
        {
            users = usersCount,
            topics = topicsCount,
            entries = entriesCount
        });
    }
}
