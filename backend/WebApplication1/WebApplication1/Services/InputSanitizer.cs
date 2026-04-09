using System.Text.RegularExpressions;

namespace WebApplication1.Services;

public static class InputSanitizer
{
    private static readonly Regex HtmlTagPattern = new Regex("<[^>]+>", RegexOptions.Compiled);

    public static string Sanitize(string? input, int maxLength = 500)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;
        var cleaned = HtmlTagPattern.Replace(input, string.Empty);
        cleaned = cleaned.Trim();
        if (cleaned.Length > maxLength) cleaned = cleaned[..maxLength];
        return cleaned;
    }
}
