using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Authorize]
[Route("api/ml-predictions")]
public class MlPredictionsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IHttpClientFactory _httpFactory;
    private const string MlApiBase = "https://lighthouse-ml-api-intex.azurewebsites.net";

    public MlPredictionsController(AppDbContext context, IHttpClientFactory httpFactory)
    {
        _context = context;
        _httpFactory = httpFactory;
    }

    /// <summary>
    /// Get the latest cached predictions for a given model.
    /// </summary>
    [HttpGet("{modelName}")]
    public async Task<ActionResult<IEnumerable<object>>> GetPredictions(string modelName)
    {
        // Fetch all predictions for this model, then pick the latest per entity in memory
        var all = await _context.MlPredictions
            .Where(p => p.ModelName == modelName)
            .OrderByDescending(p => p.ComputedAt)
            .ToListAsync();

        var latest = all
            .GroupBy(p => p.EntityId)
            .Select(g => g.First())
            .Select(p => new
            {
                p.EntityId,
                p.IsPositive,
                p.Probability,
                p.ComputedAt
            })
            .ToList();

        return Ok(latest);
    }

    /// <summary>
    /// Admin-only: re-run all predictions for a model and cache them.
    /// </summary>
    [HttpPost("{modelName}/refresh")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> RefreshPredictions(string modelName)
    {
        try
        {
            var count = modelName switch
            {
                "donor-churn"        => await RefreshDonorChurn(),
                "resident-risk"      => await RefreshResidentRisk(),
                _ => throw new ArgumentException($"Unknown model: {modelName}")
            };

            return Ok(new { refreshed = count, model = modelName });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // ── Donor Churn ──────────────────────────────────────────────────────────

    private async Task<int> RefreshDonorChurn()
    {
        var supporters = await _context.Supporters.ToListAsync();
        var donations = await _context.Donations.ToListAsync();
        var client = _httpFactory.CreateClient();
        var now = DateTime.UtcNow;
        var predictions = new List<MlPrediction>();

        foreach (var s in supporters)
        {
            var myDonations = donations.Where(d => d.SupporterId == s.SupporterId).ToList();
            if (myDonations.Count == 0) continue;

            var totalAmount = myDonations.Sum(d => d.Amount ?? 0m);
            var daysSinceFirst = s.FirstDonationDate.HasValue
                ? (DateTime.UtcNow - s.FirstDonationDate.Value.ToDateTime(TimeOnly.MinValue)).Days
                : 0;
            var typeVariety = myDonations.Select(d => d.DonationType).Distinct().Count();

            var input = new
            {
                total_donation_count = myDonations.Count,
                total_amount = (double)totalAmount,
                avg_donation_amount = myDonations.Count > 0 ? (double)(totalAmount / myDonations.Count) : 0.0,
                days_since_first_donation = daysSinceFirst,
                donation_type_variety = typeVariety,
                is_recurring_donor = myDonations.Any(d => d.IsRecurring == true)
            };

            try
            {
                var resp = await PostMl(client, "/predict/donor-churn", input);
                if (resp != null)
                {
                    predictions.Add(new MlPrediction
                    {
                        ModelName = "donor-churn",
                        EntityId = s.SupporterId,
                        IsPositive = resp.Value.GetProperty("is_lapsed").GetBoolean(),
                        Probability = resp.Value.GetProperty("probability").GetDouble(),
                        ComputedAt = now,
                    });
                }
            }
            catch { /* skip failed individual predictions */ }
        }

        if (predictions.Count > 0)
        {
            // Remove old predictions for this model
            var old = await _context.MlPredictions
                .Where(p => p.ModelName == "donor-churn")
                .ToListAsync();
            _context.MlPredictions.RemoveRange(old);
            _context.MlPredictions.AddRange(predictions);
            await _context.SaveChangesAsync();
        }

        return predictions.Count;
    }

    // ── Resident Risk ────────────────────────────────────────────────────────

    private async Task<int> RefreshResidentRisk()
    {
        // Use the existing ml-features endpoint logic
        var residents = await _context.Residents
            .Where(r => r.CaseStatus == "Active")
            .ToListAsync();

        var allRecordings = await _context.ProcessRecordings.ToListAsync();
        var allHealth = await _context.HealthWellbeingRecords.ToListAsync();
        var allEducation = await _context.EducationRecords.ToListAsync();
        var allIncidents = await _context.IncidentReports.ToListAsync();
        var allVisits = await _context.HomeVisitations.ToListAsync();

        var client = _httpFactory.CreateClient();
        var now = DateTime.UtcNow;
        var predictions = new List<MlPrediction>();

        foreach (var r in residents)
        {
            var recs = allRecordings.Where(p => p.ResidentId == r.ResidentId).ToList();
            var health = allHealth.Where(h => h.ResidentId == r.ResidentId).ToList();
            var edu = allEducation.Where(e => e.ResidentId == r.ResidentId).ToList();
            var incidents = allIncidents.Where(i => i.ResidentId == r.ResidentId).ToList();
            var visits = allVisits.Where(v => v.ResidentId == r.ResidentId).ToList();

            var daysInCare = r.DateOfAdmission.HasValue
                ? (DateTime.UtcNow - r.DateOfAdmission.Value.ToDateTime(TimeOnly.MinValue)).Days
                : 0;

            var totalSessions = recs.Count;
            var pctConcerns = totalSessions > 0 ? recs.Count(p => p.ConcernsFlagged == true) / (double)totalSessions : 0;
            var pctProgress = totalSessions > 0 ? recs.Count(p => p.ProgressNoted == true) / (double)totalSessions : 0;
            var pctReferral = totalSessions > 0 ? recs.Count(p => p.ReferralMade == true) / (double)totalSessions : 0;

            var avgHealth = health.Count > 0 ? health.Average(h => (double)(h.GeneralHealthScore ?? 0)) : 3.0;
            var avgSleep = health.Count > 0 ? health.Average(h => (double)(h.SleepQualityScore ?? 0)) : 3.0;
            var avgAttendance = edu.Count > 0 ? edu.Average(e => (double)(e.AttendanceRate ?? 0)) : 0.5;

            var riskEnc = r.InitialRiskLevel switch
            {
                "Low" => 0, "Medium" => 1, "High" => 2, "Critical" => 3, _ => 1
            };

            var input = new
            {
                days_in_care = daysInCare,
                initial_risk_level_enc = riskEnc,
                total_sessions = totalSessions,
                pct_concerns_flagged = pctConcerns,
                pct_progress_noted = pctProgress,
                pct_referral_made = pctReferral,
                emotional_improvement_rate = 0.0, // simplified
                avg_general_health_score = avgHealth,
                avg_sleep_quality_score = avgSleep,
                health_trend_slope = 0.0,
                avg_attendance_rate = avgAttendance,
                total_incidents = incidents.Count,
                unresolved_incidents = incidents.Count(i => i.Resolved != true),
                total_home_visits = visits.Count,
                pct_visits_safety_concerns = visits.Count > 0
                    ? visits.Count(v => v.SafetyConcernsNoted == true) / (double)visits.Count
                    : 0.0
            };

            try
            {
                var resp = await PostMl(client, "/predict/resident-risk", input);
                if (resp != null)
                {
                    predictions.Add(new MlPrediction
                    {
                        ModelName = "resident-risk",
                        EntityId = r.ResidentId,
                        IsPositive = resp.Value.GetProperty("is_high_risk").GetBoolean(),
                        Probability = resp.Value.GetProperty("probability").GetDouble(),
                        ComputedAt = now,
                    });
                }
            }
            catch { /* skip */ }
        }

        if (predictions.Count > 0)
        {
            var old = await _context.MlPredictions
                .Where(p => p.ModelName == "resident-risk")
                .ToListAsync();
            _context.MlPredictions.RemoveRange(old);
            _context.MlPredictions.AddRange(predictions);
            await _context.SaveChangesAsync();
        }

        return predictions.Count;
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private static async Task<JsonElement?> PostMl(HttpClient client, string path, object body)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, $"{MlApiBase}{path}");
        req.Content = new StringContent(
            JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

        var resp = await client.SendAsync(req);
        if (!resp.IsSuccessStatusCode) return null;

        var json = await resp.Content.ReadAsStringAsync();
        return JsonDocument.Parse(json).RootElement;
    }
}
