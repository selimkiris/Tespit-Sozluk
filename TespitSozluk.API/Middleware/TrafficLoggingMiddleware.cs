using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using TespitSozluk.API.Data;
using TespitSozluk.API.Entities;

namespace TespitSozluk.API.Middleware;

public class TrafficLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<TrafficLoggingMiddleware> _logger;

    /// <summary>
    /// 5651: Yalnızca entry / başlık / kimlik (kayıt-giriş) ile ilgili POST'lar.
    /// Segment sınırı: /api/Auth ile /api/Authentication ayrılır.
    /// </summary>
    private static readonly string[] TrafficLogApiPrefixes =
    [
        "/api/Entries",
        "/api/Topics",
        "/api/Auth",
        "/api/Users",
    ];

    public TrafficLoggingMiddleware(
        RequestDelegate next,
        IServiceScopeFactory scopeFactory,
        ILogger<TrafficLoggingMiddleware> logger)
    {
        _next = next;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var method = context.Request.Method;
        if (HttpMethods.IsGet(method) || HttpMethods.IsOptions(method) || HttpMethods.IsHead(method))
        {
            await _next(context);
            return;
        }

        var path = context.Request.Path.Value ?? string.Empty;
        if (!HttpMethods.IsPost(method) || !MatchesTrafficLogPrefix(path))
        {
            await _next(context);
            return;
        }

        var timestampUtc = DateTime.UtcNow;
        await _next(context);

        Guid? userId = null;
        string? usernameSnapshot = null;

        var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userIdClaim) && Guid.TryParse(userIdClaim, out var parsedId))
        {
            userId = parsedId;
            usernameSnapshot =
                context.User.Identity?.Name
                ?? context.User.FindFirst(ClaimTypes.Name)?.Value;
        }

        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var port = context.Connection.RemotePort.ToString();
        var url = $"{path}{context.Request.QueryString}";

        _ = Task.Run(async () =>
        {
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var log = new TrafficLog
                {
                    IpAddress = ip,
                    Port = port,
                    RequestedUrl = url,
                    HttpMethod = method,
                    TimestampUtc = timestampUtc,
                    UserId = userId,
                    UsernameSnapshot = usernameSnapshot
                };

                db.TrafficLogs.Add(log);
                await db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Trafik logu yazılırken hata oluştu.");
            }
        });
    }

    private static bool MatchesTrafficLogPrefix(string path)
    {
        foreach (var prefix in TrafficLogApiPrefixes)
        {
            if (!path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                continue;

            if (path.Length == prefix.Length)
                return true;

            if (path[prefix.Length] == '/')
                return true;
        }

        return false;
    }
}
