namespace TespitSozluk.API.Services;

public interface ITurnstileService
{
    Task<bool> VerifyAsync(string token);
}
