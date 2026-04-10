using Microsoft.Extensions.Caching.Memory;

namespace WebApplication1.Services;

public interface ITokenBlacklist
{
    void Revoke(string jti, DateTimeOffset expiry);
    bool IsRevoked(string jti);
}

/// <summary>
/// In-process JWT revocation list backed by IMemoryCache.
/// Entries auto-expire when the token would have expired anyway,
/// so the cache never grows unboundedly.
/// Note: restarting the process clears the list — acceptable for this
/// deployment scale. For multi-instance deployments swap the cache
/// for a shared Redis store.
/// </summary>
public class InMemoryTokenBlacklist : ITokenBlacklist
{
    private readonly IMemoryCache _cache;

    public InMemoryTokenBlacklist(IMemoryCache cache) => _cache = cache;

    public void Revoke(string jti, DateTimeOffset expiry)
    {
        var ttl = expiry - DateTimeOffset.UtcNow;
        if (ttl > TimeSpan.Zero)
            _cache.Set($"revoked:{jti}", true, ttl);
    }

    public bool IsRevoked(string jti) => _cache.TryGetValue($"revoked:{jti}", out _);
}
