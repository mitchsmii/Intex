using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace WebApplication1.Controllers;

public record ChatMessageDto(string Role, string Content);
public record VanessaChatRequest(List<ChatMessageDto> Messages);

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class VanessaController : ControllerBase
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _config;

    private const string SystemPrompt = """
        You are Vanessa, a social media strategy advisor for Lighthouse Sanctuary — a 501(c)(3) nonprofit
        in the Philippines that provides shelter, rehabilitation, and reintegration services for child
        survivors of abuse and trafficking.

        Your job is to help the Lighthouse Sanctuary admin team:
        - Write compelling, emotionally resonant captions for Instagram and Facebook
        - Plan content calendars and weekly posting strategies
        - Analyze post performance and suggest improvements
        - Grow reach and donor engagement online
        - Write effective email subject lines and newsletter content
        - Use hashtag strategies tailored to the nonprofit and Philippines context

        Always be warm, specific, and actionable. Reference Lighthouse Sanctuary's four pillars
        (Safety, Healing, Justice, Empowerment) when relevant. Tailor advice to a faith-based
        nonprofit serving children in the Philippines — never give generic marketing advice.

        Privacy is paramount: never suggest content that could identify individual survivors.
        Frame all content around hope, transformation, and community impact.

        Keep responses concise and practical. Use bullet points or short numbered lists when giving
        multiple tips. When writing sample captions, provide 1–2 options they can use immediately.
        """;

    public VanessaController(IHttpClientFactory httpFactory, IConfiguration config)
    {
        _httpFactory = httpFactory;
        _config = config;
    }

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] VanessaChatRequest request)
    {
        var apiKey = _config["Anthropic:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
            return StatusCode(500, new { error = "Anthropic API key not configured." });

        // Map frontend roles (vanessa→assistant) to Anthropic roles (user/assistant)
        var messages = request.Messages
            .Select(m => new { role = m.Role == "vanessa" ? "assistant" : "user", content = m.Content })
            .ToList();

        var body = new
        {
            model = "claude-sonnet-4-6",
            max_tokens = 1024,
            system = SystemPrompt,
            messages
        };

        var client = _httpFactory.CreateClient();
        var httpRequest = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages");
        httpRequest.Headers.Add("x-api-key", apiKey);
        httpRequest.Headers.Add("anthropic-version", "2023-06-01");
        httpRequest.Content = JsonContent.Create(body);
        httpRequest.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");

        var response = await client.SendAsync(httpRequest);
        var responseBody = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            return StatusCode((int)response.StatusCode, new { error = "Anthropic API error.", detail = responseBody });

        using var doc = JsonDocument.Parse(responseBody);
        var text = doc.RootElement
            .GetProperty("content")[0]
            .GetProperty("text")
            .GetString();

        return Ok(new { reply = text });
    }
}
