namespace TespitSozluk.API.DTOs;

public class RegisterDto
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    /// <summary>Kayıtta kullanılan nickname (User.Username).</summary>
    public string Username { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string TurnstileToken { get; set; } = string.Empty;
}
