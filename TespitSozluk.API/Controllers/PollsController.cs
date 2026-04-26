using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TespitSozluk.API.DTOs;
using TespitSozluk.API.Services;

namespace TespitSozluk.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PollsController : ControllerBase
{
    private readonly IPollService _pollService;

    public PollsController(IPollService pollService)
    {
        _pollService = pollService;
    }

    private Guid? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return !string.IsNullOrEmpty(claim) && Guid.TryParse(claim, out var uid) ? uid : null;
    }

    [AllowAnonymous]
    [HttpGet("{pollId:guid}")]
    public async Task<ActionResult<PollResponseDto>> GetPoll(Guid pollId)
    {
        var userId = GetCurrentUserId();
        var dto = await _pollService.GetPollForUserAsync(pollId, userId, HttpContext.RequestAborted);
        if (dto == null) return NotFound();
        return Ok(dto);
    }

    /// <summary>
    /// Anket oyu kullan. Politika: oylar KALICIDIR; aynı kullanıcı bu ankete yeniden
    /// oy kullanamaz, "geri al" özelliği kaldırılmıştır. AllowMultiple=false iken
    /// birden fazla seçenek yollanamaz. Anonimlik: cevap gövdesine "hangi kullanıcı
    /// hangi seçeneği işaretledi" bilgisi SIZDIRILMAZ; yalnızca toplam/yüzde döner
    /// ve yalnızca oy kullanan kişi görür.
    /// </summary>
    [Authorize]
    [EnableRateLimiting("interaction")]
    [HttpPost("{pollId:guid}/vote")]
    public async Task<ActionResult<PollResponseDto>> CastVote(Guid pollId, [FromBody] CastPollVoteDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        try
        {
            var result = await _pollService.CastVoteAsync(
                pollId, userId.Value, dto?.OptionIds ?? new List<Guid>(), HttpContext.RequestAborted);
            return Ok(result.Poll);
        }
        catch (PollValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Anket sahibi AllowUserOptions açtıysa herkes yeni seçenek ekleyebilir.</summary>
    [Authorize]
    [EnableRateLimiting("interaction")]
    [HttpPost("{pollId:guid}/options")]
    public async Task<ActionResult<PollResponseDto>> AddOption(Guid pollId, [FromBody] AddPollOptionDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        try
        {
            var result = await _pollService.AddOptionAsync(pollId, userId.Value, dto?.Text ?? string.Empty, HttpContext.RequestAborted);
            return Ok(result.Poll);
        }
        catch (PollValidationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
