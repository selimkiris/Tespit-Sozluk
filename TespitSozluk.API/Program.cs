using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using TespitSozluk.API.Data;
using TespitSozluk.API.Middleware;
using TespitSozluk.API.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Veritabanı ────────────────────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── JWT Kimlik Doğrulama ──────────────────────────────────────────────────────
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]
                    ?? throw new InvalidOperationException("JWT Key yapılandırması eksik.")))
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
});

// ── Uygulama Servisleri ───────────────────────────────────────────────────────
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<IRateLimitService, RateLimitService>();
builder.Services.AddHttpClient<ITurnstileService, TurnstileService>();
builder.Services.AddScoped<IEntryDeletionService, EntryDeletionService>();
builder.Services.AddScoped<IEntryInteractionNotificationService, EntryInteractionNotificationService>();
builder.Services.AddScoped<IEntryLikesService, EntryLikesService>();
builder.Services.AddScoped<IEntryMentionService, EntryMentionService>();
builder.Services.AddScoped<IPollService, PollService>();
builder.Services.AddScoped<INoviceStatusService, NoviceStatusService>();
builder.Services.AddHostedService<LogCleanupBackgroundService>();

builder.Services.AddControllers()
    .AddJsonOptions(x =>
        x.JsonSerializerOptions.ReferenceHandler =
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ── CORS — VULN-08 ────────────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
                "http://localhost:3000",
                "https://tespit-sozluk.vercel.app",
                "https://www.tespitsozluk.com",
                "https://tespitsozluk.com"
            )
            .AllowAnyMethod()
            .AllowAnyHeader()
            .SetIsOriginAllowedToAllowWildcardSubdomains(); // Ekstra güvenlik esnekliği
    });
});

// ── ASP.NET Core Rate Limiter — VULN-07 ──────────────────────────────────────
// "interaction" politikası: oy/kaydet/takip gibi yan-etki yaratan endpoint'lere uygulanır.
// Bölümleme anahtarı: önce JWT kullanıcı ID'si, yoksa bağlantı IP'si.
// Kural: 30 saniyelik kayan pencerede kullanıcı başına en fazla 15 istek.
builder.Services.AddRateLimiter(limiterOptions =>
{
    limiterOptions.AddPolicy("interaction", httpContext =>
    {
        var partitionKey =
            httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "unknown";

        return RateLimitPartition.GetSlidingWindowLimiter(
            partitionKey,
            _ => new SlidingWindowRateLimiterOptions
            {
                Window = TimeSpan.FromSeconds(30),
                SegmentsPerWindow = 3,
                PermitLimit = 15,
                QueueLimit = 0
            });
    });

    limiterOptions.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { message = "Çok hızlı işlem yapıyorsunuz.", retryAfterSeconds = 30 },
            cancellationToken);
    };
});

// ─────────────────────────────────────────────────────────────────────────────
var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();
app.UseCors();
app.UseRateLimiter();       // CORS'tan sonra, Auth'tan önce
app.UseAuthentication();
app.UseAuthorization();

// 5651 Sayılı Kanun — trafik loglama (auth'tan sonra, kullanıcı bilgisi mevcut)
app.UseMiddleware<TrafficLoggingMiddleware>();

app.MapControllers();

app.Run();
