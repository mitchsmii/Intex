using System.Net;
using System.Text.RegularExpressions;

namespace WebApplication1.Services;

public static class InputSanitizer
{
    private static readonly Regex HtmlTagPattern =
        new Regex("<[^>]+>", RegexOptions.Compiled);

    private static readonly Regex DangerousProtocol =
        new Regex(@"javascript\s*:", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static string Sanitize(string? input, int maxLength = 500)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;
        // Decode HTML entities first to catch encoded attacks like &#106;avascript:
        var decoded = WebUtility.HtmlDecode(input);
        // Remove HTML tags
        var cleaned = HtmlTagPattern.Replace(decoded, string.Empty);
        // Block javascript: protocol (handles URL-based XSS)
        cleaned = DangerousProtocol.Replace(cleaned, string.Empty);
        cleaned = cleaned.Trim();
        if (cleaned.Length > maxLength) cleaned = cleaned[..maxLength];
        return cleaned;
    }
}
