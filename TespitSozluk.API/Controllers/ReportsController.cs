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
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ReportsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpPost]
    public async Task<IActionResult> CreateReport([FromBody] CreateReportRequestDto dto)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var reporterId))
        {
            return Unauthorized();
        }

        var targetCount = (dto.EntryId.HasValue ? 1 : 0) + (dto.TopicId.HasValue ? 1 : 0) + (dto.UserId.HasValue ? 1 : 0);
        if (targetCount != 1)
        {
            return BadRequest(new { message = "Tam olarak bir hedef (entry, başlık veya kullanıcı) belirtilmelidir." });
        }

        if (string.IsNullOrWhiteSpace(dto.Reason))
        {
            return BadRequest(new { message = "Şikayet sebebi gereklidir." });
        }

        if (dto.EntryId.HasValue)
        {
            var entryExists = await _context.Entries.AnyAsync(e => e.Id == dto.EntryId.Value);
            if (!entryExists)
            {
                return NotFound(new { message = "Entry bulunamadı." });
            }
        }

        if (dto.TopicId.HasValue)
        {
            var topicExists = await _context.Topics.AnyAsync(t => t.Id == dto.TopicId.Value);
            if (!topicExists)
            {
                return NotFound(new { message = "Başlık bulunamadı." });
            }
        }

        if (dto.UserId.HasValue)
        {
            if (dto.UserId.Value == reporterId)
            {
                return BadRequest(new { message = "Kendi profilinizi şikayet edemezsiniz." });
            }

            var userExists = await _context.Users.AnyAsync(u => u.Id == dto.UserId.Value);
            if (!userExists)
            {
                return NotFound(new { message = "Kullanıcı bulunamadı." });
            }
        }

        var report = new Report
        {
            ReporterId = reporterId,
            ReportedEntryId = dto.EntryId,
            ReportedTopicId = dto.TopicId,
            ReportedUserId = dto.UserId,
            Reason = dto.Reason.Trim(),
            Details = string.IsNullOrWhiteSpace(dto.Details) ? null : dto.Details.Trim(),
        };

        _context.Reports.Add(report);
        await _context.SaveChangesAsync();

        return Ok();
    }
}
