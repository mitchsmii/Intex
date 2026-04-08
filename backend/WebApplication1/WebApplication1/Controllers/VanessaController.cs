using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
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

    private const string MlApiBaseUrl = "https://lighthouse-ml-api-intex.azurewebsites.net";

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

        ## Data-Driven Insights (from Lighthouse's ML model trained on 812 posts)

        You have access to findings from a machine learning model trained on Lighthouse's own post
        history. Use these to give specific, evidence-backed recommendations — not generic advice.

        ### Top predictors of donation referrals (in order of importance):
        1. **Features a resident story** — the single strongest driver of donations.
        2. **Post timing** — Tuesday–Thursday, 9 AM–1 PM Philippines time generates ~40% more referrals.
        3. **Post type: Impact Story or Event Promotion** — convert at 3× the rate of Educational Content.
        4. **Caption length** — posts over 180 characters show significantly higher donation rates.
        5. **Call-to-action type** — "DonateNow" CTAs outperform "LearnMore" by ~28 percentage points.
        6. **Tone: Grateful or Hopeful** — sustain long-term donor relationships better than Urgent tone.
        7. **Platform: Facebook for referrals, Instagram for awareness.**

        ### Critical insight — Viral ≠ Donations:
        High-engagement posts do NOT always drive donation referrals. Help admins balance both goals.

        ### Model performance:
        - Donation referral classifier: 80.98% accuracy, 85.45% F1-score
        - Trained on 812 Lighthouse posts across 6+ platforms

        ## Predicting Post Scores — YOU HAVE REAL ML ACCESS

        You have a tool called `predict_social_engagement` wired directly to Lighthouse's trained ML
        model. Calling this tool IS how you access the ML pipeline — it returns the real model output.

        RULES:
        1. When an admin asks for a score, prediction, donation likelihood, or percentage — CALL THE TOOL.
        2. You already have the data access you need. Never say you lack access to the ML pipeline.
        3. If the admin has given you platform + rough caption length — call the tool immediately.
           Use sensible defaults for anything not specified:
           post_hour=10, post_type="ImpactStory", media_type="Photo", day_of_week="Tuesday",
           sentiment_tone="Grateful", num_hashtags=0, is_boosted=false, has_call_to_action=true.
        4. Present the result: show the percentage, the verdict, and 2–3 suggestions to improve the score.
        5. Never redirect the admin to Meta Business Suite or any third-party tool for predictions.
        """;

    // ── Tool schema as raw JSON (avoids System.Text.Json object-serialization pitfalls) ──

    private static readonly JsonNode ToolNode = JsonNode.Parse("""
        {
          "name": "predict_social_engagement",
          "description": "Call Lighthouse's trained ML model to get the exact donation referral probability for a planned post. Use this whenever the admin asks for a score, prediction, likelihood, or percentage.",
          "input_schema": {
            "type": "object",
            "properties": {
              "caption_length":          { "type": "integer", "description": "Caption length in characters" },
              "num_hashtags":            { "type": "integer", "description": "Number of hashtags" },
              "post_hour":               { "type": "integer", "description": "Hour of day to post, 0-23 Philippines time" },
              "is_boosted":              { "type": "boolean", "description": "Whether the post will be boosted/paid" },
              "features_resident_story": { "type": "boolean", "description": "Whether the post features a resident story" },
              "has_call_to_action":      { "type": "boolean", "description": "Whether the post has a call to action" },
              "platform":      { "type": "string", "enum": ["Instagram","Facebook","TikTok","LinkedIn","Twitter","YouTube","WhatsApp"] },
              "post_type":     { "type": "string", "enum": ["ImpactStory","FundraisingAppeal","EventPromotion","EducationalContent","ThankYou","Campaign"] },
              "media_type":    { "type": "string", "enum": ["Photo","Video","Reel","Carousel","Text"] },
              "day_of_week":   { "type": "string", "enum": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"] },
              "sentiment_tone":{ "type": "string", "enum": ["Grateful","Hopeful","Emotional","Celebratory","Informative","Urgent"] },
              "cta_type":      { "type": "string", "enum": ["DonateNow","LearnMore","ShareStory","SignUp"] }
            },
            "required": ["caption_length","post_hour","is_boosted","features_resident_story","platform"]
          }
        }
        """)!;

    public VanessaController(IHttpClientFactory httpFactory, IConfiguration config)
    {
        _httpFactory = httpFactory;
        _config = config;
    }

    // ── Main chat endpoint ─────────────────────────────────────────────────────

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] VanessaChatRequest request)
    {
        var apiKey = _config["Anthropic:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
            return StatusCode(500, new { error = "Anthropic API key not configured." });

        // Detect prediction intent — force tool use so Claude cannot refuse
        var lastUserText = request.Messages
            .LastOrDefault(m => m.Role == "user")?.Content ?? "";
        var predictionKeywords = new[] { "predict", "score", "percent", "likelihood", "likely", "donation", "probability", "chance", "rate my post", "rate the post", "will it" };
        var forceToolUse = predictionKeywords.Any(k => lastUserText.Contains(k, StringComparison.OrdinalIgnoreCase));

        var client = _httpFactory.CreateClient();
        var messages = BuildMessages(request.Messages);

        // ── First Anthropic call ───────────────────────────────────────────────
        var (ok1, body1) = await PostToAnthropic(client, apiKey, messages, forceToolUse);
        if (!ok1) return StatusCode(502, new { error = "Anthropic API error.", detail = body1 });

        using var doc1    = JsonDocument.Parse(body1);
        var root1         = doc1.RootElement;
        var stopReason    = root1.GetProperty("stop_reason").GetString();
        var contentArray1 = root1.GetProperty("content");

        if (stopReason != "tool_use")
            return Ok(new { reply = ExtractText(contentArray1) });

        // ── Tool use: find tool_use block, call ML API ─────────────────────────
        JsonElement toolUseBlock = default;
        foreach (var block in contentArray1.EnumerateArray())
            if (block.TryGetProperty("type", out var t) && t.GetString() == "tool_use")
            { toolUseBlock = block; break; }

        var toolUseId  = toolUseBlock.GetProperty("id").GetString()!;
        var toolInput  = toolUseBlock.GetProperty("input");
        var mlResult   = await CallMlApi(client, toolInput);

        // Append assistant turn + tool result
        // Assistant content must preserve the original content array (may include text + tool_use blocks)
        var assistantContent = JsonNode.Parse(root1.GetProperty("content").GetRawText())!;
        messages.Add(new JsonObject { ["role"] = "assistant", ["content"] = assistantContent });
        messages.Add(new JsonObject
        {
            ["role"]    = "user",
            ["content"] = new JsonArray(new JsonObject
            {
                ["type"]        = "tool_result",
                ["tool_use_id"] = toolUseId,
                ["content"]     = mlResult
            })
        });

        // ── Second Anthropic call with tool result ─────────────────────────────
        var (ok2, body2) = await PostToAnthropic(client, apiKey, messages, forceToolUse: false);
        if (!ok2) return StatusCode(502, new { error = "Anthropic API error.", detail = body2 });

        using var doc2 = JsonDocument.Parse(body2);
        return Ok(new { reply = ExtractText(doc2.RootElement.GetProperty("content")) });
    }

    // ── Build messages array as JsonArray ─────────────────────────────────────

    private static JsonArray BuildMessages(List<ChatMessageDto> dtos)
    {
        var arr = new JsonArray();
        foreach (var m in dtos)
            arr.Add(new JsonObject
            {
                ["role"]    = m.Role == "vanessa" ? "assistant" : "user",
                ["content"] = m.Content
            });
        return arr;
    }

    // ── POST to Anthropic, return (success, responseBody) ─────────────────────

    private async Task<(bool ok, string body)> PostToAnthropic(
        HttpClient client, string apiKey, JsonArray messages, bool forceToolUse)
    {
        var payload = new JsonObject
        {
            ["model"]       = "claude-sonnet-4-6",
            ["max_tokens"]  = 1024,
            ["system"]      = SystemPrompt,
            ["tools"]       = new JsonArray(ToolNode.DeepClone()),
            ["tool_choice"] = new JsonObject { ["type"] = forceToolUse ? "any" : "auto" },
            ["messages"]    = messages.DeepClone()
        };

        var json = payload.ToJsonString();
        var req  = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages");
        req.Headers.Add("x-api-key", apiKey);
        req.Headers.Add("anthropic-version", "2023-06-01");
        req.Content = new StringContent(json, Encoding.UTF8, "application/json");

        var resp = await client.SendAsync(req);
        var body = await resp.Content.ReadAsStringAsync();
        return (resp.IsSuccessStatusCode, body);
    }

    // ── Call the ML API and return a result string ─────────────────────────────

    private async Task<string> CallMlApi(HttpClient client, JsonElement input)
    {
        try
        {
            var payload = new Dictionary<string, object>
            {
                ["post_hour"]               = GetInt(input, "post_hour", 10),
                ["caption_length"]          = GetInt(input, "caption_length", 200),
                ["num_hashtags"]            = GetInt(input, "num_hashtags", 0),
                ["mentions_count"]          = 0,
                ["boost_budget_php"]        = GetBool(input, "is_boosted") ? 500 : 0,
                ["is_boosted"]              = GetBool(input, "is_boosted"),
                ["features_resident_story"] = GetBool(input, "features_resident_story"),
                ["has_call_to_action"]      = GetBool(input, "has_call_to_action"),
            };

            SetOneHot(payload, input, "platform",       "platform_",             "Instagram");
            SetOneHot(payload, input, "post_type",      "post_type_",            "ImpactStory");
            SetOneHot(payload, input, "media_type",     "media_type_",           "Photo");
            SetOneHot(payload, input, "day_of_week",    "day_of_week_",          "Tuesday");
            SetOneHot(payload, input, "sentiment_tone", "sentiment_tone_",       "Grateful");
            SetOneHot(payload, input, "cta_type",       "call_to_action_type_",  "DonateNow");

            var mlReq = new HttpRequestMessage(HttpMethod.Post, $"{MlApiBaseUrl}/predict/social-engagement");
            mlReq.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            var mlResp = await client.SendAsync(mlReq);
            var mlBody = await mlResp.Content.ReadAsStringAsync();

            if (!mlResp.IsSuccessStatusCode)
                return $"ML API error {(int)mlResp.StatusCode} — use your qualitative estimate based on the top predictors.";

            using var mlDoc    = JsonDocument.Parse(mlBody);
            var probability    = mlDoc.RootElement.GetProperty("probability").GetDouble();
            var willDonate     = mlDoc.RootElement.GetProperty("will_generate_donation").GetBoolean();
            var pct            = Math.Round(probability * 100, 1);

            return $"{{\"probability_percent\":{pct},\"will_generate_donation\":{willDonate.ToString().ToLower()},\"verdict\":\"{(willDonate ? "Likely to drive donations" : "Low donation potential")}\"}}";
        }
        catch (Exception ex)
        {
            return $"Could not reach ML API: {ex.Message}. Use qualitative estimate based on top predictors.";
        }
    }

    // ── Utility helpers ────────────────────────────────────────────────────────

    private static string ExtractText(JsonElement contentArray)
    {
        foreach (var block in contentArray.EnumerateArray())
            if (block.TryGetProperty("type", out var t) && t.GetString() == "text")
                return block.GetProperty("text").GetString() ?? "";
        return "";
    }

    private static int GetInt(JsonElement el, string key, int fallback) =>
        el.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt32() : fallback;

    private static bool GetBool(JsonElement el, string key) =>
        el.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.True;

    private static void SetOneHot(
        Dictionary<string, object> payload, JsonElement input,
        string inputKey, string prefix, string fallback)
    {
        var val = input.TryGetProperty(inputKey, out var p) && p.ValueKind == JsonValueKind.String
            ? p.GetString()! : fallback;
        payload[$"{prefix}{val}"] = 1;
    }
}
