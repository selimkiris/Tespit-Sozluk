using System.Security.Claims;
using TespitSozluk.API.Data;
using TespitSozluk.API.Entities;

namespace TespitSozluk.API.Middleware;

public class TrafficLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<TrafficLoggingMiddleware> _logger;

    // Loglama dışında tutulacak uzantılar
    private static readonly HashSet<string> _ignoredExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".js", ".css", ".map", ".ico", ".png", ".jpg", ".jpeg",
        ".gif", ".svg", ".woff", ".woff2", ".ttf", ".eot", ".webp"
    };

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
        // Pipeline'ı durdurmadan önce zaman damgasını yakala
        var timestampUtc = DateTime.UtcNow;

        // Sonraki middleware/controller'a geç
        await _next(context);

        // Yalnızca /api/ yollarını logla; statik varlıkları atla
        var path = context.Request.Path.Value ?? string.Empty;
        if (!ShouldLog(path))
            return;

        // Kullanıcı bilgileri pipeline tamamlandıktan sonra (auth işlenmiş) okunur
        Guid? userId = null;
        string? usernameSnapshot = null;

        var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userIdClaim) && Guid.TryParse(userIdClaim, out var parsedId))
        {
            userId = parsedId;
            // ClaimTypes.Name → GenerateJwtToken'da user.Username olarak set edilir.
            // Identity.Name da aynı claim'i gösterir; her iki yol da aynı değeri döner.
            usernameSnapshot =
                context.User.Identity?.Name
                ?? context.User.FindFirst(ClaimTypes.Name)?.Value;
        }

        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var port = context.Connection.RemotePort.ToString();
        var method = context.Request.Method;
        var url = $"{path}{context.Request.QueryString}";

        // Fire-and-forget: ana thread'i bloklamadan log yaz
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

    private static bool ShouldLog(string path)
    {
        if (!path.StartsWith("/api", StringComparison.OrdinalIgnoreCase))
            return false;

        var ext = Path.GetExtension(path);
        return string.IsNullOrEmpty(ext) || !_ignoredExtensions.Contains(ext);
    }
}
