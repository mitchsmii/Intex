using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Services;

/// <summary>
/// Background service that refreshes ML predictions once daily at 3 AM UTC.
/// Runs inside the ASP.NET host — no extra infrastructure needed.
/// </summary>
public class MlRefreshService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<MlRefreshService> _logger;
    private const string MlApiBase = "https://lighthouse-ml-api-intex.azurewebsites.net";

    public MlRefreshService(
        IServiceScopeFactory scopeFactory,
        IHttpClientFactory httpFactory,
        ILogger<MlRefreshService> logger)
    {
        _scopeFactory = scopeFactory;
        _httpFactory = httpFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Wait for the app to fully start before running the first refresh
        await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);

        // Run once on startup, then daily at 3 AM UTC
        await RunRefresh(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;
            var next3am = now.Date.AddHours(3);
            if (next3am <= now) next3am = next3am.AddDays(1);
            var delay = next3am - now;

            _logger.LogInformation("ML refresh scheduled for {NextRun} ({Delay})", next3am, delay);
            await Task.Delay(delay, stoppingToken);
            await RunRefresh(stoppingToken);
        }
    }

    private async Task RunRefresh(CancellationToken ct)
    {
        _logger.LogInformation("Starting ML prediction refresh...");
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var client = _httpFactory.CreateClient();
            var now = DateTime.UtcNow;

            var donorCount = await RefreshDonorChurn(db, client, now, ct);
            var riskCount = await RefreshResidentRisk(db, client, now, ct);

            _logger.LogInformation(
                "ML refresh complete: {DonorCount} donor-churn, {RiskCount} resident-risk predictions cached",
                donorCount, riskCount);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "ML prediction refresh failed");
        }
    }

    // ── Donor Churn ──────────────────────────────────────────────────────────

    private async Task<int> RefreshDonorChurn(AppDbContext db, HttpClient client, DateTime now, CancellationToken ct)
    {
        var supporters = await db.Supporters.ToListAsync(ct);
        var donations = await db.Donations.ToListAsync(ct);
        var predictions = new List<MlPrediction>();

        foreach (var s in supporters)
        {
            ct.ThrowIfCancellationRequested();
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
                var resp = await PostMl(client, "/predict/donor-churn", input, ct);
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
            catch (OperationCanceledException) { throw; }
            catch { /* skip individual failures */ }
        }

        if (predictions.Count > 0)
        {
            var old = await db.MlPredictions
                .Where(p => p.ModelName == "donor-churn")
                .ToListAsync(ct);
            db.MlPredictions.RemoveRange(old);
            db.MlPredictions.AddRange(predictions);
            await db.SaveChangesAsync(ct);
        }

        return predictions.Count;
    }

    // ── Resident Risk ────────────────────────────────────────────────────────

    private async Task<int> RefreshResidentRisk(AppDbContext db, HttpClient client, DateTime now, CancellationToken ct)
    {
        var residents = await db.Residents.Where(r => r.CaseStatus == "Active").ToListAsync(ct);
        var allRecordings = await db.ProcessRecordings.ToListAsync(ct);
        var allHealth = await db.HealthWellbeingRecords.ToListAsync(ct);
        var allEducation = await db.EducationRecords.ToListAsync(ct);
        var allIncidents = await db.IncidentReports.ToListAsync(ct);
        var allVisits = await db.HomeVisitations.ToListAsync(ct);
        var predictions = new List<MlPrediction>();

        foreach (var r in residents)
        {
            ct.ThrowIfCancellationRequested();
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
                emotional_improvement_rate = 0.0,
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
                var resp = await PostMl(client, "/predict/resident-risk", input, ct);
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
            catch (OperationCanceledException) { throw; }
            catch { /* skip */ }
        }

        if (predictions.Count > 0)
        {
            var old = await db.MlPredictions.Where(p => p.ModelName == "resident-risk").ToListAsync(ct);
            db.MlPredictions.RemoveRange(old);
            db.MlPredictions.AddRange(predictions);
            await db.SaveChangesAsync(ct);
        }

        return predictions.Count;
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private static async Task<JsonElement?> PostMl(HttpClient client, string path, object body, CancellationToken ct)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, $"{MlApiBase}{path}");
        req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        var resp = await client.SendAsync(req, ct);
        if (!resp.IsSuccessStatusCode) return null;
        var json = await resp.Content.ReadAsStringAsync(ct);
        return JsonDocument.Parse(json).RootElement;
    }
}
