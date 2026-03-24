using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;
using TespitSozluk.API.Data;
using TespitSozluk.API.DTOs;
using TespitSozluk.API.Entities;
using TespitSozluk.API.Services;

namespace TespitSozluk.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private const string RegisterSuccessIpCachePrefix = "reg:ok:";
    private static readonly TimeSpan RegisterSuccessCooldown = TimeSpan.FromHours(1);
    private const int RegisterSuccessMaxPerWindow = 3;

    private sealed class RegisterIpSuccessState
    {
        public int SuccessCount { get; set; }
        public DateTime? CooldownUntilUtc { get; set; }
    }

    private const string LoginFailIpCachePrefix = "login:fail:";
    private static readonly TimeSpan LoginFailWindow = TimeSpan.FromMinutes(15);
    private const int LoginFailMaxAttempts = 5;

    /// <summary>
    /// Geçerli kullanıcı adı: 1-20 karakter, boşluk / &lt; / &gt; içeremez.
    /// </summary>
    private static readonly Regex UsernameRegex = new(@"^[^<>\s]{1,20}$", RegexOptions.Compiled);

    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ITurnstileService _turnstileService;
    private readonly IMemoryCache _memoryCache;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        AppDbContext context,
        IConfiguration configuration,
        ITurnstileService turnstileService,
        IMemoryCache memoryCache,
        ILogger<AuthController> logger)
    {
        _context = context;
        _configuration = configuration;
        _turnstileService = turnstileService;
        _memoryCache = memoryCache;
        _logger = logger;
    }

    /// <summary>
    /// Kullanıcı adını backend kurallarına göre doğrular.
    /// Kural: 1-20 karakter, boşluk ve HTML özel karakterleri (&lt;, &gt;) yasak.
    /// </summary>
    private static bool IsValidUsername(string username) =>
        !string.IsNullOrEmpty(username) && UsernameRegex.IsMatch(username);

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto dto)
    {
        var clientIp = GetClientIpAddress();
        var registerCooldownKey = RegisterSuccessIpCachePrefix + clientIp;
        if (!_memoryCache.TryGetValue(registerCooldownKey, out RegisterIpSuccessState? registerState) ||
            registerState == null)
        {
            registerState = new RegisterIpSuccessState();
        }

        if (registerState.CooldownUntilUtc.HasValue &&
            DateTime.UtcNow >= registerState.CooldownUntilUtc.Value)
        {
            registerState.SuccessCount = 0;
            registerState.CooldownUntilUtc = null;
            _memoryCache.Set(registerCooldownKey, registerState, CreateRegisterSuccessCacheEntryOptions(registerState));
        }

        if (registerState.SuccessCount >= RegisterSuccessMaxPerWindow &&
            registerState.CooldownUntilUtc.HasValue &&
            DateTime.UtcNow < registerState.CooldownUntilUtc.Value)
        {
            var remainingSec = (registerState.CooldownUntilUtc.Value - DateTime.UtcNow).TotalSeconds;
            if (remainingSec > 0)
            {
                var message = FormatRegisterCooldownMessage(remainingSec);
                Response.Headers.RetryAfter = ((int)Math.Ceiling(remainingSec)).ToString();
                return StatusCode(StatusCodes.Status429TooManyRequests, new
                {
                    message,
                    retryAfterSeconds = Math.Ceiling(remainingSec)
                });
            }
        }

        var emailNormalized = dto.Email.Trim().ToLowerInvariant();
        var emailExists = await _context.Users.AnyAsync(u => u.Email.ToLower() == emailNormalized);
        if (emailExists)
            return BadRequest(new { message = "Bu e-posta adresi başka bir kullanıcı tarafından alınmış, senin haberin yok muydu?" });

        var nick = string.IsNullOrWhiteSpace(dto.Username)
            ? (dto.FirstName + " " + dto.LastName).Trim()
            : dto.Username.Trim();

        if (string.IsNullOrEmpty(nick))
            return BadRequest(new { message = "Nickname gerekli." });

        if (!IsValidUsername(nick))
            return BadRequest(new { message = "Kullanıcı adı en fazla 20 karakter olabilir; boşluk ve < > karakterleri içeremez." });

        var nickNormalized = nick.ToLowerInvariant();
        var usernameTaken = await _context.Users.AnyAsync(u => u.Username.ToLower() == nickNormalized);
        if (usernameTaken)
            return BadRequest(new { message = "Bu nick zaten seçilmiş, başka bir tane bul" });

        var isTurnstileValid = await _turnstileService.VerifyAsync(dto.TurnstileToken);
        if (!isTurnstileValid)
            return BadRequest(new { message = "Bot doğrulaması başarısız oldu." });

        // Şifre kuralları: min 8 karakter, 1 büyük harf, 1 rakam
        if (string.IsNullOrEmpty(dto.Password) || dto.Password.Length < 8 ||
            !dto.Password.Any(char.IsUpper) || !dto.Password.Any(char.IsDigit))
        {
            return BadRequest(new { message = "Parolanız en az 8 karakter olmalı, 1 büyük harf ve 1 rakam içermelidir." });
        }

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = dto.Email.Trim(),
            PasswordHash = passwordHash,
            FirstName = nick,
            LastName = string.Empty,
            Username = nick,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        registerState.SuccessCount++;
        if (registerState.SuccessCount >= RegisterSuccessMaxPerWindow)
            registerState.CooldownUntilUtc = DateTime.UtcNow.Add(RegisterSuccessCooldown);

        _memoryCache.Set(registerCooldownKey, registerState, CreateRegisterSuccessCacheEntryOptions(registerState));

        return Ok("Kayıt başarıyla tamamlandı.");
    }

    /// <summary>
    /// İstemcinin gerçek IP adresini döner.
    /// X-Forwarded-For başlığı kullanıcı tarafından serbestçe sahtelenebileceğinden
    /// (VULN-03) doğrudan TCP bağlantısının RemoteIpAddress'i kullanılır.
    /// Önünde nginx/Cloudflare gibi bir reverse proxy varsa, proxy'yi güvenilir
    /// bilinen IP olarak <see cref="Microsoft.AspNetCore.HttpOverrides.ForwardedHeadersOptions.KnownProxies"/>
    /// listesine ekleyip UseForwardedHeaders() middleware'ini devreye alın.
    /// </summary>
    private string GetClientIpAddress() =>
        HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    private bool IsLoginBruteForceBlocked(string clientIp, out double retryAfterSeconds)
    {
        retryAfterSeconds = 0;
        var key = LoginFailIpCachePrefix + clientIp;
        if (!_memoryCache.TryGetValue(key, out List<DateTime>? failures) || failures == null || failures.Count == 0)
            return false;

        var now = DateTime.UtcNow;
        failures.RemoveAll(t => (now - t) > LoginFailWindow);
        _memoryCache.Set(key, failures, CreateLoginFailCacheEntryOptions());

        if (failures.Count < LoginFailMaxAttempts)
            return false;

        var oldest = failures.Min();
        retryAfterSeconds = Math.Max(0, (oldest + LoginFailWindow - now).TotalSeconds);
        return true;
    }

    private void RecordLoginFailure(string clientIp)
    {
        var key = LoginFailIpCachePrefix + clientIp;
        var now = DateTime.UtcNow;
        var failures = _memoryCache.TryGetValue(key, out List<DateTime>? list) && list != null
            ? list
            : new List<DateTime>();
        failures.RemoveAll(t => (now - t) > LoginFailWindow);
        failures.Add(now);
        _memoryCache.Set(key, failures, CreateLoginFailCacheEntryOptions());
    }

    private static MemoryCacheEntryOptions CreateLoginFailCacheEntryOptions() =>
        new() { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(16) };

    private static MemoryCacheEntryOptions CreateRegisterSuccessCacheEntryOptions(RegisterIpSuccessState state)
    {
        var cooldownUntil = state.CooldownUntilUtc ?? DateTime.UtcNow.Add(RegisterSuccessCooldown);
        return new MemoryCacheEntryOptions
        {
            AbsoluteExpiration = new DateTimeOffset(cooldownUntil)
        };
    }

    private static string FormatRegisterCooldownMessage(double remainingSecondsTotal)
    {
        var sn = Math.Max(0, (int)Math.Ceiling(remainingSecondsTotal));
        string hesaplananZaman;
        if (sn < 60)
            hesaplananZaman = $"{sn} saniye";
        else if (sn < 3600)
            hesaplananZaman = $"{sn / 60} dakika";
        else if (sn < 86400)
            hesaplananZaman = $"{sn / 3600} saat";
        else
            hesaplananZaman = $"{sn / 86400} gün";

        return $"Çok hızlı gidiyorsunuz, {hesaplananZaman} sonra tekrar deneyiniz.";
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var clientIp = GetClientIpAddress();
        var loginFailKey = LoginFailIpCachePrefix + clientIp;

        if (IsLoginBruteForceBlocked(clientIp, out var loginRetryAfterSec))
        {
            Response.Headers.RetryAfter = ((int)Math.Ceiling(loginRetryAfterSec)).ToString();
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                message = "Çok fazla hatalı deneme, 15 dakika bekleyin",
                retryAfterSeconds = Math.Ceiling(loginRetryAfterSec)
            });
        }

        var isTurnstileValid = await _turnstileService.VerifyAsync(dto.TurnstileToken);
        if (!isTurnstileValid)
            return BadRequest(new { message = "Bot doğrulaması başarısız oldu." });

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == dto.Email.ToLower());

        if (user == null)
        {
            RecordLoginFailure(clientIp);
            return BadRequest("Ya hafızan zayıf ya da yazmayı bilmiyorsun (E-posta veya Parola yanlış)");
        }

        var isValidPassword = BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash);
        if (!isValidPassword)
        {
            RecordLoginFailure(clientIp);
            return BadRequest("Ya hafızan zayıf ya da yazmayı bilmiyorsun (E-posta veya Parola yanlış)");
        }

        _memoryCache.Remove(loginFailKey);

        var token = GenerateJwtToken(user);

        var response = new AuthResponseDto
        {
            Token = token,
            UserId = user.Id,
            Email = user.Email,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Username = user.Username,
            Avatar = user.Avatar,
            HasChangedUsername = user.HasChangedUsername,
            Role = user.Role
        };

        return Ok(response);
    }

    [Authorize]
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        return Ok("Çıkış başarılı. İstemci tarafında token silinmelidir.");
    }

    /// <summary>
    /// Tek seferlik admin kurulum endpoint'i. Veritabanında admin yoksa oluşturur.
    /// İstek header'ında X-Setup-Secret: &lt;AdminSetupSecret&gt; değeri zorunludur.
    /// </summary>
    [HttpPost("setup-admin")]
    public async Task<IActionResult> SetupAdmin([FromHeader(Name = "X-Setup-Secret")] string? setupSecret)
    {
        var expectedSecret = _configuration["AdminSetupSecret"];
        if (string.IsNullOrWhiteSpace(expectedSecret) || setupSecret != expectedSecret)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Geçersiz veya eksik kurulum anahtarı." });

        var adminEmail = _configuration["AdminSetupEmail"]
            ?? throw new InvalidOperationException("AdminSetupEmail yapılandırması eksik.");

        var adminExists = await _context.Users
            .AnyAsync(u => u.Email.ToLower() == adminEmail.ToLower());

        if (adminExists)
            return Conflict(new { message = "Admin hesabı zaten mevcut." });

        var adminPassword = _configuration["AdminSetupPassword"]
            ?? throw new InvalidOperationException("AdminSetupPassword yapılandırması eksik.");

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword);

        var admin = new User
        {
            Id = Guid.NewGuid(),
            Email = adminEmail,
            PasswordHash = passwordHash,
            FirstName = "Tespit",
            LastName = "Sözlük",
            Username = "Tespit Sözlük",
            Avatar = "https://i.ibb.co/senin-logon.png",
            Role = "Admin",
            HasChangedUsername = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(admin);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Admin hesabı başarıyla oluşturuldu." });
    }

    /// <summary>
    /// Şifre sıfırlama tokenı oluşturur. Kullanıcının var olup olmadığından bağımsız olarak
    /// her zaman aynı jenerik mesajı döner (user enumeration önlemi — VULN-09).
    /// Token HTTP yanıtına yazılmaz; yalnızca DB'ye kaydedilir ve loglanır (VULN-01).
    /// Gerçek ortamda bu token e-posta servis entegrasyonuyla kullanıcıya gönderilmelidir.
    /// </summary>
    [HttpPost("generate-reset-token")]
    public async Task<IActionResult> GeneratePasswordResetToken([FromBody] GeneratePasswordResetTokenRequest dto)
    {
        const string genericMessage = "Eğer bu e-posta sistemde kayıtlıysa, şifre sıfırlama bağlantısı gönderilmiştir.";

        if (string.IsNullOrWhiteSpace(dto.Email))
            return BadRequest(new { message = "E-posta gerekli." });

        var emailNormalized = dto.Email.Trim().ToLower();
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == emailNormalized);

        if (user == null)
        {
            // Kasıtlı olarak 404 dönmüyoruz — kullanıcının varlığını sızdırmamak için.
            return Ok(new { message = genericMessage });
        }

        var token = Guid.NewGuid().ToString();
        user.PasswordResetToken = token;
        user.PasswordResetTokenExpires = DateTime.UtcNow.AddMinutes(15);
        await _context.SaveChangesAsync();

        // TODO: E-posta servisi entegre edildiğinde token bu satır yerine e-posta ile gönderilmeli.
        _logger.LogWarning(
            "[PasswordReset] UserId={UserId} için token oluşturuldu. Token: {Token} | Geçerlilik: {Expires} UTC",
            user.Id, token, user.PasswordResetTokenExpires);

        return Ok(new { message = genericMessage });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Token) || string.IsNullOrWhiteSpace(dto.NewPassword))
            return BadRequest(new { message = "Token ve yeni şifre gerekli." });

        if (dto.NewPassword.Length < 8 ||
            !dto.NewPassword.Any(char.IsUpper) || !dto.NewPassword.Any(char.IsDigit))
        {
            return BadRequest(new { message = "Parolanız en az 8 karakter olmalı, 1 büyük harf ve 1 rakam içermelidir." });
        }

        var now = DateTime.UtcNow;
        var user = await _context.Users
            .FirstOrDefaultAsync(u =>
                u.PasswordResetToken == dto.Token &&
                u.PasswordResetTokenExpires != null &&
                u.PasswordResetTokenExpires > now);

        if (user == null)
            return BadRequest(new { message = "Geçersiz veya süresi dolmuş token." });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpires = null;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Şifre başarıyla güncellendi." });
    }

    private string GenerateJwtToken(User user)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key yapılandırması eksik.")));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role)
        };

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(24),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
