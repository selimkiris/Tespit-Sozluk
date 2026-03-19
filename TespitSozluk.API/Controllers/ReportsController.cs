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

        if (!dto.EntryId.HasValue && !dto.TopicId.HasValue)
        {
            return BadRequest(new { message = "EntryId veya TopicId'den en az biri gereklidir." });
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

        var report = new Report
        {
            ReporterId = reporterId,
            ReportedEntryId = dto.EntryId,
            ReportedTopicId = dto.TopicId,
            Reason = dto.Reason.Trim(),
            Details = string.IsNullOrWhiteSpace(dto.Details) ? null : dto.Details.Trim(),
        };

        _context.Reports.Add(report);
        await _context.SaveChangesAsync();

        return Ok();
    }
}
