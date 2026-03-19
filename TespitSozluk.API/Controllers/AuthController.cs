using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using TespitSozluk.API.Data;
using TespitSozluk.API.DTOs;
using TespitSozluk.API.Entities;
using TespitSozluk.API.Filters;
using TespitSozluk.API.Services;

namespace TespitSozluk.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ITurnstileService _turnstileService;

    public AuthController(AppDbContext context, IConfiguration configuration, ITurnstileService turnstileService)
    {
        _context = context;
        _configuration = configuration;
        _turnstileService = turnstileService;
    }

    [RateLimit(RateLimitAction.Register)]
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto dto)
    {
        var isTurnstileValid = await _turnstileService.VerifyAsync(dto.TurnstileToken);
        if (!isTurnstileValid)
            return BadRequest(new { message = "Bot doğrulaması başarısız oldu." });

        var emailExists = await _context.Users.AnyAsync(u => u.Email.ToLower() == dto.Email.ToLower());
        if (emailExists)
        {
            return BadRequest("Bu e-posta adresi zaten kayıtlı.");
        }

        // Şifre kuralları: min 8 karakter, 1 büyük harf, 1 rakam
        if (string.IsNullOrEmpty(dto.Password) || dto.Password.Length < 8 ||
            !dto.Password.Any(char.IsUpper) || !dto.Password.Any(char.IsDigit))
        {
            return BadRequest(new { message = "Şifreniz en az 8 karakter olmalı, 1 büyük harf ve 1 rakam içermelidir." });
        }

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);

        var displayName = (dto.FirstName + " " + dto.LastName).Trim();
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = dto.Email,
            PasswordHash = passwordHash,
            FirstName = dto.FirstName,
            LastName = dto.LastName,
            Username = string.IsNullOrEmpty(displayName) ? ("user_" + Guid.NewGuid().ToString("N")[..8]) : displayName,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok("Kayıt başarıyla tamamlandı.");
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var isTurnstileValid = await _turnstileService.VerifyAsync(dto.TurnstileToken);
        if (!isTurnstileValid)
            return BadRequest(new { message = "Bot doğrulaması başarısız oldu." });

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == dto.Email.ToLower());

        if (user == null)
        {
            return BadRequest("E-posta veya şifre hatalı.");
        }

        var isValidPassword = BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash);
        if (!isValidPassword)
        {
            return BadRequest("E-posta veya şifre hatalı.");
        }

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
    /// Üretim ortamında bu endpoint kaldırılmalı veya devre dışı bırakılmalıdır.
    /// </summary>
    [HttpPost("setup-admin")]
    public async Task<IActionResult> SetupAdmin()
    {
        var adminEmail = _configuration["AdminSetupEmail"]
            ?? throw new InvalidOperationException("AdminSetupEmail yapılandırması eksik.");

        var adminExists = await _context.Users
            .AnyAsync(u => u.Email.ToLower() == adminEmail);

        if (adminExists)
        {
            return Conflict("Admin hesabı zaten mevcut.");
        }

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

        return Ok(new
        {
            message = "Admin hesabı başarıyla oluşturuldu.",
            email = adminEmail
        });
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
