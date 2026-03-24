using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using TespitSozluk.API.Services;

namespace TespitSozluk.API.Filters;

/// <summary>
/// Belirtilen eylem için sliding-window timestamp tabanlı rate limiting uygular.
/// Kimliği doğrulanmış isteklerde UserId bazlı çalışır.
/// Limit aşıldığında 429 Too Many Requests + retryAfterSeconds döner.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public class RateLimitAttribute : ActionFilterAttribute
{
    public RateLimitAction Action { get; }

    public RateLimitAttribute(RateLimitAction action)
    {
        Action = action;
    }

    public override async Task OnActionExecutionAsync(
        ActionExecutingContext context,
        ActionExecutionDelegate next)
    {
        var rateLimitService = context.HttpContext.RequestServices
            .GetRequiredService<IRateLimitService>();

        // UserId bazlı: kimliği doğrulanmamış istekler bu filtere takılmaz
        var key = context.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (string.IsNullOrEmpty(key))
        {
            await next();
            return;
        }

        var result = rateLimitService.CheckAndRecord(key, Action);

        if (!result.IsAllowed)
        {
            context.Result = new ObjectResult(new
            {
                message = "Çok hızlı işlem yapıyorsunuz.",
                retryAfterSeconds = result.RetryAfterSeconds
            })
            {
                StatusCode = StatusCodes.Status429TooManyRequests
            };

            context.HttpContext.Response.Headers["Retry-After"] =
                ((int)result.RetryAfterSeconds).ToString();

            return;
        }

        await next();
    }
}
