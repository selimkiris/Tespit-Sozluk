using System.Text.Json;

namespace TespitSozluk.API.Services;

public class TurnstileService : ITurnstileService
{
    private readonly HttpClient _httpClient;
    private readonly string _secretKey;

    public TurnstileService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _secretKey = configuration["Turnstile:SecretKey"]
            ?? throw new InvalidOperationException("Turnstile:SecretKey yapılandırması eksik.");
    }

    public async Task<bool> VerifyAsync(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
            return false;

        var formData = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("secret", _secretKey),
            new KeyValuePair<string, string>("response", token)
        });

        var response = await _httpClient.PostAsync(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            formData);

        if (!response.IsSuccessStatusCode)
            return false;

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);

        return doc.RootElement.TryGetProperty("success", out var successProp)
               && successProp.GetBoolean();
    }
}
