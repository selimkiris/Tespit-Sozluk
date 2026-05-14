using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using TespitSozluk.API.DTOs;

namespace TespitSozluk.API.Services;

public sealed class AlphabeticalTopicsRedisCache : IAlphabeticalTopicsCache
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5);

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly IConnectionMultiplexer? _mux;
    private readonly ILogger<AlphabeticalTopicsRedisCache> _logger;

    public AlphabeticalTopicsRedisCache(IConfiguration configuration, ILogger<AlphabeticalTopicsRedisCache> logger)
    {
        _logger = logger;
        var cs = configuration.GetConnectionString("Redis");
        if (string.IsNullOrWhiteSpace(cs))
        {
            return;
        }

        try
        {
            var options = ConfigurationOptions.Parse(cs.Trim());
            options.AbortOnConnectFail = false;
            options.ConnectTimeout = 5000;
            options.AsyncTimeout = 5000;
            _mux = ConnectionMultiplexer.Connect(options);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis bağlantısı kurulamadı; alfabetik başlık önbelleği devre dışı.");
        }
    }

    public async Task<PagedTopicsDto?> TryGetAsync(int page, int pageSize, Guid? userId, CancellationToken cancellationToken = default)
    {
        try
        {
            if (_mux is null) return null;

            var db = _mux.GetDatabase();
            var key = BuildCacheKey(page, pageSize, userId);
            var val = await db.StringGetAsync(key).ConfigureAwait(false);
            if (val.IsNullOrEmpty) return null;

            return JsonSerializer.Deserialize<PagedTopicsDto>((string)val!, JsonOpts);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Redis önbellek okunamadı; veritabanı yolu kullanılacak.");
            return null;
        }
    }

    public async Task TrySetAsync(int page, int pageSize, Guid? userId, PagedTopicsDto dto, CancellationToken cancellationToken = default)
    {
        try
        {
            if (_mux is null) return;

            var db = _mux.GetDatabase();
            var key = BuildCacheKey(page, pageSize, userId);
            var json = JsonSerializer.Serialize(dto, JsonOpts);
            await db.StringSetAsync(key, json, CacheTtl).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Redis önbelleğe yazılamadı; yanıt yine de veritabanından üretildi.");
        }
    }

    private static RedisKey BuildCacheKey(int page, int pageSize, Guid? userId) =>
        $"tespitsozluk:topics:alphabetical:v1:{page}:{pageSize}:{userId?.ToString("N") ?? "anon"}";
}
