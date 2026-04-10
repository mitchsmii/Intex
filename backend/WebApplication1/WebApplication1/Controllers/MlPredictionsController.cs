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
    private readonly ILogger<MlPredictionsController> _logger;
    private const string MlApiBase = "https://lighthouse-ml-api-intex.azurewebsites.net";

    public MlPredictionsController(AppDbContext context, IHttpClientFactory httpFactory, ILogger<MlPredictionsController> logger)
    {
        _context = context;
        _httpFactory = httpFactory;
        _logger = logger;
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
                "donor-churn"              => await RefreshDonorChurn(),
                "resident-risk"            => await RefreshResidentRisk(),
                "reintegration-journey"    => await RefreshReintegrationJourney(),
                _ => throw new ArgumentException($"Unknown model: {modelName}")
            };

            return Ok(new { refreshed = count, model = modelName });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ML prediction refresh failed for model {ModelName}", modelName);
            return StatusCode(500, new { error = "An internal error occurred. Check server logs for details." });
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

    // ── Reintegration Journey ─────────────────────────────────────────────

    private async Task<int> RefreshReintegrationJourney()
    {
        var residents = await _context.Residents
            .Where(r => r.CaseStatus == "Active")
            .ToListAsync();

        var allRecordings = await _context.ProcessRecordings.ToListAsync();
        var allHealth = await _context.HealthWellbeingRecords.ToListAsync();
        var allEducation = await _context.EducationRecords.ToListAsync();
        var allIncidents = await _context.IncidentReports.ToListAsync();
        var allVisits = await _context.HomeVisitations.ToListAsync();
        var allPlans = await _context.InterventionPlans.ToListAsync();

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
            var plans = allPlans.Where(p => p.ResidentId == r.ResidentId).ToList();

            var input = BuildReintegrationInput(r, recs, health, edu, incidents, visits, plans);

            try
            {
                var resp = await PostMl(client, "/predict/reintegration-journey", input);
                if (resp != null)
                {
                    var clusterId = resp.Value.GetProperty("cluster_id").GetInt32();
                    var clusterName = resp.Value.GetProperty("cluster_name").GetString() ?? "";
                    predictions.Add(new MlPrediction
                    {
                        ModelName = "reintegration-journey",
                        EntityId = r.ResidentId,
                        IsPositive = clusterName.Contains("Active"),
                        Probability = clusterId,
                        ComputedAt = now,
                    });
                }
            }
            catch { /* skip */ }
        }

        if (predictions.Count > 0)
        {
            var old = await _context.MlPredictions
                .Where(p => p.ModelName == "reintegration-journey")
                .ToListAsync();
            _context.MlPredictions.RemoveRange(old);
            _context.MlPredictions.AddRange(predictions);
            await _context.SaveChangesAsync();
        }

        return predictions.Count;
    }

    private static object BuildReintegrationInput(
        Resident r,
        List<ProcessRecording> recs,
        List<HealthWellbeingRecord> health,
        List<EducationRecord> edu,
        List<IncidentReport> incidents,
        List<HomeVisitation> visits,
        List<InterventionPlan> plans)
    {
        var daysInCare = r.DateOfAdmission.HasValue
            ? (DateTime.UtcNow - r.DateOfAdmission.Value.ToDateTime(TimeOnly.MinValue)).Days
            : 0;

        var riskOrder = new Dictionary<string, int>
            { { "Critical", 4 }, { "High", 3 }, { "Medium", 2 }, { "Low", 1 } };
        var initialRisk = riskOrder.GetValueOrDefault(r.InitialRiskLevel ?? "", 3);
        var currentRisk = riskOrder.GetValueOrDefault(r.CurrentRiskLevel ?? "", 3);

        var abuseComplexity = new[] {
            r.SubCatOrphaned, r.SubCatTrafficked, r.SubCatChildLabor,
            r.SubCatPhysicalAbuse, r.SubCatSexualAbuse, r.SubCatOsaec,
            r.SubCatCicl, r.SubCatAtRisk, r.SubCatStreetChild, r.SubCatChildWithHiv
        }.Count(b => b == true);

        var avgHealth = health.Count > 0 ? health.Average(h => (double)(h.GeneralHealthScore ?? 0)) : 3.0;
        var avgNutrition = health.Count > 0 ? health.Average(h => (double)(h.NutritionScore ?? 0)) : 3.0;
        var avgSleep = health.Count > 0 ? health.Average(h => (double)(h.SleepQualityScore ?? 0)) : 3.0;
        var avgEnergy = health.Count > 0 ? health.Average(h => (double)(h.EnergyLevelScore ?? 0)) : 3.0;

        var healthScores = health
            .OrderBy(h => h.RecordDate)
            .Select(h => (double)(h.GeneralHealthScore ?? 0))
            .ToList();
        var healthTrend = 0.0;
        if (healthScores.Count >= 2)
        {
            var mid = healthScores.Count / 2;
            healthTrend = healthScores.Skip(mid).Average() - healthScores.Take(mid).Average();
        }

        var avgProgress = edu.Count > 0 ? edu.Average(e => (double)(e.ProgressPercent ?? 0)) : 0.0;
        var avgAttendance = edu.Count > 0 ? edu.Average(e => (double)(e.AttendanceRate ?? 0)) : 0.0;

        var totalSessions = recs.Count;
        var pctProgress = totalSessions > 0 ? recs.Count(p => p.ProgressNoted == true) / (double)totalSessions : 0;
        var pctConcerns = totalSessions > 0 ? recs.Count(p => p.ConcernsFlagged == true) / (double)totalSessions : 0;

        var completedPlans = plans.Count(p => (p.Status ?? "").Equals("Completed", StringComparison.OrdinalIgnoreCase));
        var activePlans = plans.Count(p => (p.Status ?? "").Equals("Active", StringComparison.OrdinalIgnoreCase));

        var coopMap = new Dictionary<string, double>
            { { "High", 3 }, { "Moderate", 2 }, { "Neutral", 1 }, { "Low", 0 } };
        var avgCoop = visits.Count > 0
            ? visits.Average(v => coopMap.GetValueOrDefault(v.FamilyCooperationLevel ?? "", 1))
            : 1.0;
        var pctSafety = visits.Count > 0
            ? visits.Count(v => v.SafetyConcernsNoted == true) / (double)visits.Count
            : 0.0;
        var outcomeMap = new Dictionary<string, double>
            { { "Favorable", 1 }, { "Neutral", 0 }, { "Unfavorable", -1 } };
        var avgOutcome = visits.Count > 0
            ? visits.Average(v => outcomeMap.GetValueOrDefault(v.VisitOutcome ?? "", 0))
            : 0.0;

        var sevMap = new Dictionary<string, double>
            { { "High", 3 }, { "Medium", 2 }, { "Low", 1 } };
        var avgSeverity = incidents.Count > 0
            ? incidents.Average(i => sevMap.GetValueOrDefault(i.Severity ?? "", 1))
            : 1.0;
        var unresolvedInc = incidents.Count(i => i.Resolved != true);
        var daysSinceInc = incidents.Count > 0
            ? incidents.Where(i => i.IncidentDate.HasValue)
                .Select(i => (DateTime.UtcNow - i.IncidentDate!.Value.ToDateTime(TimeOnly.MinValue)).Days)
                .DefaultIfEmpty(999).Min()
            : 999;

        return new
        {
            days_in_care = daysInCare,
            risk_improved = currentRisk < initialRisk ? 1 : 0,
            abuse_complexity = abuseComplexity,
            avg_health_score = avgHealth,
            avg_nutrition_score = avgNutrition,
            avg_sleep_score = avgSleep,
            avg_energy_score = avgEnergy,
            health_record_count = health.Count,
            health_trend = healthTrend,
            avg_education_progress = avgProgress,
            avg_attendance_rate = avgAttendance,
            education_record_count = edu.Count,
            total_counseling_sessions = totalSessions,
            pct_sessions_with_progress = pctProgress,
            pct_sessions_with_concerns = pctConcerns,
            total_intervention_plans = plans.Count,
            completed_plans = completedPlans,
            active_plans = activePlans,
            plan_completion_rate = plans.Count > 0 ? completedPlans / (double)plans.Count : 0.0,
            total_visitations = visits.Count,
            avg_family_cooperation = avgCoop,
            pct_safety_concerns = pctSafety,
            avg_visit_outcome = avgOutcome,
            total_incidents = incidents.Count,
            avg_incident_severity = avgSeverity,
            unresolved_incidents = unresolvedInc,
            days_since_last_incident = daysSinceInc,
        };
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
