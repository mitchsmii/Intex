using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class ResidentsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ResidentsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Resident>>> GetResidents()
    {
        var query = _context.Residents.AsQueryable();

        // Admins see everything; social workers see only residents assigned to them.
        if (!User.IsInRole("Admin"))
        {
            var username = User.Identity?.Name;
            if (string.IsNullOrEmpty(username)) return Forbid();
            query = query.Where(r => r.AssignedSocialWorker == username);
        }

        return await query.ToListAsync();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Resident>> GetResident(int id)
    {
        var resident = await _context.Residents.FindAsync(id);
        if (resident == null) return NotFound();

        if (!User.IsInRole("Admin"))
        {
            var username = User.Identity?.Name;
            if (resident.AssignedSocialWorker != username) return Forbid();
        }

        return resident;
    }

    [HttpGet("public-counts")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicCounts()
    {
        var residents = await _context.Residents
            .Select(r => new { r.DateClosed, r.ReintegrationStatus })
            .ToListAsync();

        return Ok(new
        {
            totalServed = residents.Count,
            activeResidents = residents.Count(r => r.DateClosed == null),
            reintegrated = residents.Count(r =>
                r.ReintegrationStatus == "Reintegrated" || r.ReintegrationStatus == "Completed")
        });
    }

    [HttpGet("next-code")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetNextCode()
    {
        var codes = await _context.Residents
            .Where(r => r.InternalCode != null && r.InternalCode.StartsWith("LS-"))
            .Select(r => r.InternalCode!)
            .ToListAsync();

        int maxNum = codes
            .Select(c => int.TryParse(c[3..], out var n) ? n : 0)
            .DefaultIfEmpty(0)
            .Max();

        int next = maxNum + 1;
        return Ok(new
        {
            internalCode = $"LS-{next:D4}",
            caseControlNo = $"CC-{next:D4}"
        });
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<Resident>> CreateResident([FromBody] CreateResidentDto dto)
    {
        if (dto.Age < 0 || dto.Age > 25)
            return BadRequest(new { message = "Age must be between 0 and 25." });
        // Generate unique codes atomically
        var codes = await _context.Residents
            .Where(r => r.InternalCode != null && r.InternalCode.StartsWith("LS-"))
            .Select(r => r.InternalCode!)
            .ToListAsync();

        int maxNum = codes
            .Select(c => int.TryParse(c[3..], out var n) ? n : 0)
            .DefaultIfEmpty(0)
            .Max();

        int next = maxNum + 1;
        var today = DateOnly.FromDateTime(DateTime.Today);

        var resident = new Resident
        {
            InternalCode = $"LS-{next:D4}",
            CaseControlNo = $"CC-{next:D4}",
            AgeUponAdmission = dto.Age.ToString(),
            PresentAge = dto.Age.ToString(),
            SafehouseId = dto.SafehouseId,
            AssignedSocialWorker = dto.AssignedSocialWorker,
            CurrentRiskLevel = dto.RiskLevel,
            InitialRiskLevel = dto.RiskLevel,
            CaseStatus = "Active",
            DateOfAdmission = today,
            CreatedAt = DateTime.UtcNow,
        };

        _context.Residents.Add(resident);
        await _context.SaveChangesAsync();

        // Create notification for the assigned social worker
        if (!string.IsNullOrEmpty(dto.SwEmail))
        {
            _context.Notifications.Add(new Notification
            {
                RecipientEmail = dto.SwEmail,
                Message = $"You have been assigned a new resident: {resident.InternalCode}",
                RelatedResidentCode = resident.InternalCode,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();
        }

        return CreatedAtAction(nameof(GetResident), new { id = resident.ResidentId }, resident);
    }

    // ─── ML feature aggregation ─────────────────────────────────────────────
    // Mirrors models/03_resident_risk/resident_risk.ipynb feature engineering
    // (cells 10–16) so the live ML inference uses the SAME feature definitions
    // the model was trained on. Any divergence here is training/serving skew.

    private static readonly Dictionary<string, int> RiskOrdinal = new(StringComparer.OrdinalIgnoreCase)
    {
        { "Low", 0 }, { "Medium", 1 }, { "High", 2 }, { "Critical", 3 }
    };

    private static readonly Dictionary<string, int> SeverityMap = new(StringComparer.OrdinalIgnoreCase)
    {
        { "low", 1 }, { "medium", 2 }, { "high", 3 }, { "critical", 4 }
    };

    private static readonly Dictionary<string, int> FamCoopMap = new(StringComparer.OrdinalIgnoreCase)
    {
        { "uncooperative", 0 }, { "poor", 1 }, { "low", 1 },
        { "neutral", 2 }, { "moderate", 3 },
        { "cooperative", 4 }, { "good", 4 }, { "high", 5 }, { "excellent", 5 }
    };

    private static readonly Dictionary<string, int> EmotionalOrd = new(StringComparer.OrdinalIgnoreCase)
    {
        { "distressed", 0 }, { "crying", 0 }, { "aggressive", 0 },
        { "sad", 1 }, { "withdrawn", 1 },
        { "anxious", 2 }, { "fearful", 2 },
        { "neutral", 3 }, { "flat", 3 },
        { "calm", 4 }, { "stable", 4 },
        { "content", 5 }, { "positive", 5 },
        { "happy", 6 }, { "joyful", 6 },
        { "improved", 7 }, { "better", 7 }
    };

    private static int? ParseLeadingInt(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var m = System.Text.RegularExpressions.Regex.Match(s, @"\d+");
        return m.Success ? int.Parse(m.Value) : (int?)null;
    }

    private static double? ParseLengthOfStayDays(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var m = System.Text.RegularExpressions.Regex.Match(s, @"\d+(\.\d+)?");
        if (!m.Success) return null;
        var num = double.Parse(m.Value, System.Globalization.CultureInfo.InvariantCulture);
        var lower = s.ToLowerInvariant();
        if (lower.Contains("year")) return num * 365;
        if (lower.Contains("month")) return num * 30;
        return num; // assume days
    }

    /// <summary>
    /// Linear regression slope of y over x = 0..n-1. Returns 0 if fewer than 2 values.
    /// Matches scipy.stats.linregress(x, vals).slope used in the training notebook.
    /// </summary>
    private static double LinregressSlope(IList<double> values)
    {
        var n = values.Count;
        if (n < 2) return 0.0;
        double meanX = (n - 1) / 2.0;
        double meanY = values.Average();
        double num = 0, den = 0;
        for (int i = 0; i < n; i++)
        {
            var dx = i - meanX;
            num += dx * (values[i] - meanY);
            den += dx * dx;
        }
        return den == 0 ? 0.0 : num / den;
    }

    /// <summary>
    /// Per-resident feature vector matching the 40 input_features expected by
    /// resident_risk_model.pkl. Field names use snake_case to match the model's
    /// training column names exactly — they are forwarded as-is to the ML API.
    /// </summary>
    public class ResidentMlFeatures
    {
        public int resident_id { get; set; }
        public string? internal_code { get; set; }
        public string? case_control_no { get; set; }
        public string? current_risk_level { get; set; }
        public string? assigned_social_worker { get; set; }
        public DateOnly? last_action_date { get; set; }
        public string? last_action_type { get; set; }

        // Demographic / case (one-hot + ordinal)
        public double safehouse_id { get; set; }
        public int sub_cat_trafficked { get; set; }
        public int sub_cat_child_labor { get; set; }
        public int sub_cat_physical_abuse { get; set; }
        public int sub_cat_sexual_abuse { get; set; }
        public int sub_cat_osaec { get; set; }
        public int is_pwd { get; set; }
        public int has_special_needs { get; set; }
        public int family_is_4ps { get; set; }
        public int family_solo_parent { get; set; }
        public int family_informal_settler { get; set; }
        public double age_upon_admission { get; set; }
        public double present_age { get; set; }
        public double length_of_stay_days { get; set; }
        public double days_in_care { get; set; }
        public double initial_risk_level_enc { get; set; }
        public int case_cat_Abandoned { get; set; }
        public int case_cat_Foundling { get; set; }
        public int case_cat_Neglected { get; set; }
        public int case_cat_Surrendered { get; set; }

        // Process recordings
        public double total_sessions { get; set; }
        public double pct_concerns_flagged { get; set; }
        public double pct_progress_noted { get; set; }
        public double pct_referral_made { get; set; }
        public double emotional_improvement_rate { get; set; }
        public double avg_session_duration { get; set; }

        // Health
        public double avg_general_health_score { get; set; }
        public double avg_nutrition_score { get; set; }
        public double avg_sleep_quality_score { get; set; }
        public double health_trend_slope { get; set; }

        // Education
        public double avg_attendance_rate { get; set; }
        public double avg_progress_percent { get; set; }
        public int enroll_Enrolled { get; set; }

        // Incidents
        public double total_incidents { get; set; }
        public double unresolved_incidents { get; set; }
        public double max_incident_severity { get; set; }

        // Home visits
        public double total_home_visits { get; set; }
        public double pct_visits_safety_concerns { get; set; }
        public double family_cooperation_enc { get; set; }

        // Interventions
        public double active_interventions { get; set; }
    }

    [HttpGet("ml-features")]
    public async Task<ActionResult<IEnumerable<ResidentMlFeatures>>> GetMlFeatures()
    {
        // Apply same role-based filter as GetResidents()
        var residentsQuery = _context.Residents.AsQueryable();
        if (!User.IsInRole("Admin"))
        {
            var username = User.Identity?.Name;
            if (string.IsNullOrEmpty(username)) return Forbid();
            residentsQuery = residentsQuery.Where(r => r.AssignedSocialWorker == username);
        }

        var residents = await residentsQuery.ToListAsync();
        var residentIds = residents.Select(r => r.ResidentId).ToHashSet();

        // Pull every related record server-side once. Datasets are small (~hundreds of rows
        // each); this is much simpler than per-resident round-trips and matches what the
        // training notebook does in pandas.
        var processRecs = await _context.ProcessRecordings
            .Where(p => p.ResidentId != null && residentIds.Contains(p.ResidentId.Value))
            .ToListAsync();
        var healthRecs = await _context.HealthWellbeingRecords
            .Where(h => h.ResidentId != null && residentIds.Contains(h.ResidentId.Value))
            .ToListAsync();
        var educationRecs = await _context.EducationRecords
            .Where(e => e.ResidentId != null && residentIds.Contains(e.ResidentId.Value))
            .ToListAsync();
        var incidentRecs = await _context.IncidentReports
            .Where(i => i.ResidentId != null && residentIds.Contains(i.ResidentId.Value))
            .ToListAsync();
        var homeVisitRecs = await _context.HomeVisitations
            .Where(v => v.ResidentId != null && residentIds.Contains(v.ResidentId.Value))
            .ToListAsync();
        var interventionRecs = await _context.InterventionPlans
            .Where(p => p.ResidentId != null && residentIds.Contains(p.ResidentId.Value))
            .ToListAsync();

        var procByRes = processRecs.GroupBy(p => p.ResidentId!.Value).ToDictionary(g => g.Key, g => g.ToList());
        var healthByRes = healthRecs.GroupBy(h => h.ResidentId!.Value).ToDictionary(g => g.Key, g => g.ToList());
        var eduByRes = educationRecs.GroupBy(e => e.ResidentId!.Value).ToDictionary(g => g.Key, g => g.ToList());
        var incByRes = incidentRecs.GroupBy(i => i.ResidentId!.Value).ToDictionary(g => g.Key, g => g.ToList());
        var hvByRes = homeVisitRecs.GroupBy(v => v.ResidentId!.Value).ToDictionary(g => g.Key, g => g.ToList());
        var ivByRes = interventionRecs.GroupBy(p => p.ResidentId!.Value).ToDictionary(g => g.Key, g => g.ToList());

        var today = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var results = new List<ResidentMlFeatures>(residents.Count);

        foreach (var r in residents)
        {
            var f = new ResidentMlFeatures
            {
                resident_id = r.ResidentId,
                internal_code = r.InternalCode,
                case_control_no = r.CaseControlNo,
                current_risk_level = r.CurrentRiskLevel,
                assigned_social_worker = r.AssignedSocialWorker,
                safehouse_id = r.SafehouseId ?? 0,
                sub_cat_trafficked = (r.SubCatTrafficked ?? false) ? 1 : 0,
                sub_cat_child_labor = (r.SubCatChildLabor ?? false) ? 1 : 0,
                sub_cat_physical_abuse = (r.SubCatPhysicalAbuse ?? false) ? 1 : 0,
                sub_cat_sexual_abuse = (r.SubCatSexualAbuse ?? false) ? 1 : 0,
                sub_cat_osaec = (r.SubCatOsaec ?? false) ? 1 : 0,
                is_pwd = (r.IsPwd ?? false) ? 1 : 0,
                has_special_needs = (r.HasSpecialNeeds ?? false) ? 1 : 0,
                family_is_4ps = (r.FamilyIs4ps ?? false) ? 1 : 0,
                family_solo_parent = (r.FamilySoloParent ?? false) ? 1 : 0,
                family_informal_settler = (r.FamilyInformalSettler ?? false) ? 1 : 0,
                age_upon_admission = ParseLeadingInt(r.AgeUponAdmission) ?? 0,
                present_age = ParseLeadingInt(r.PresentAge) ?? 0,
                length_of_stay_days = ParseLengthOfStayDays(r.LengthOfStay) ?? 0,
                days_in_care = r.DateOfAdmission.HasValue
                    ? Math.Max(0, today.DayNumber - r.DateOfAdmission.Value.DayNumber)
                    : 0,
                initial_risk_level_enc = r.InitialRiskLevel != null && RiskOrdinal.TryGetValue(r.InitialRiskLevel, out var rl) ? rl : 0,
                case_cat_Abandoned = string.Equals(r.CaseCategory, "Abandoned", StringComparison.OrdinalIgnoreCase) ? 1 : 0,
                case_cat_Foundling = string.Equals(r.CaseCategory, "Foundling", StringComparison.OrdinalIgnoreCase) ? 1 : 0,
                case_cat_Neglected = string.Equals(r.CaseCategory, "Neglected", StringComparison.OrdinalIgnoreCase) ? 1 : 0,
                case_cat_Surrendered = string.Equals(r.CaseCategory, "Surrendered", StringComparison.OrdinalIgnoreCase) ? 1 : 0,
            };

            // ── Process recordings ──
            if (procByRes.TryGetValue(r.ResidentId, out var procs) && procs.Count > 0)
            {
                f.total_sessions = procs.Count;

                // safe_bool_mean: mean over non-null booleans only
                var concernsVals = procs.Where(p => p.ConcernsFlagged.HasValue).Select(p => p.ConcernsFlagged!.Value ? 1.0 : 0.0).ToList();
                f.pct_concerns_flagged = concernsVals.Count > 0 ? concernsVals.Average() : 0;

                var progressVals = procs.Where(p => p.ProgressNoted.HasValue).Select(p => p.ProgressNoted!.Value ? 1.0 : 0.0).ToList();
                f.pct_progress_noted = progressVals.Count > 0 ? progressVals.Average() : 0;

                var referralVals = procs.Where(p => p.ReferralMade.HasValue).Select(p => p.ReferralMade!.Value ? 1.0 : 0.0).ToList();
                f.pct_referral_made = referralVals.Count > 0 ? referralVals.Average() : 0;

                // emotional_improvement_rate: mean over ALL rows of (end_enc > start_enc).
                // NaN comparisons in pandas yield False (0), so unmappable strings count as not-improved.
                var improvedVals = procs.Select(p =>
                {
                    var startOk = p.EmotionalStateObserved != null && EmotionalOrd.TryGetValue(p.EmotionalStateObserved, out var s);
                    var endOk = p.EmotionalStateEnd != null && EmotionalOrd.TryGetValue(p.EmotionalStateEnd, out var e);
                    if (!startOk || !endOk) return 0.0;
                    EmotionalOrd.TryGetValue(p.EmotionalStateObserved!, out var sv);
                    EmotionalOrd.TryGetValue(p.EmotionalStateEnd!, out var ev);
                    return ev > sv ? 1.0 : 0.0;
                }).ToList();
                f.emotional_improvement_rate = improvedVals.Count > 0 ? improvedVals.Average() : 0;

                var durVals = procs.Where(p => p.SessionDurationMinutes.HasValue).Select(p => (double)p.SessionDurationMinutes!.Value).ToList();
                f.avg_session_duration = durVals.Count > 0 ? durVals.Average() : 0;
            }

            // ── Health records ──
            if (healthByRes.TryGetValue(r.ResidentId, out var healths) && healths.Count > 0)
            {
                var gh = healths.Where(h => h.GeneralHealthScore.HasValue).Select(h => (double)h.GeneralHealthScore!.Value).ToList();
                var nu = healths.Where(h => h.NutritionScore.HasValue).Select(h => (double)h.NutritionScore!.Value).ToList();
                var sl = healths.Where(h => h.SleepQualityScore.HasValue).Select(h => (double)h.SleepQualityScore!.Value).ToList();
                f.avg_general_health_score = gh.Count > 0 ? gh.Average() : 0;
                f.avg_nutrition_score = nu.Count > 0 ? nu.Average() : 0;
                f.avg_sleep_quality_score = sl.Count > 0 ? sl.Average() : 0;

                // Health trend slope: order by record_date then linregress on general_health_score
                var ordered = healths
                    .Where(h => h.GeneralHealthScore.HasValue)
                    .OrderBy(h => h.RecordDate ?? DateOnly.MinValue)
                    .Select(h => (double)h.GeneralHealthScore!.Value)
                    .ToList();
                f.health_trend_slope = LinregressSlope(ordered);
            }

            // ── Education ──
            if (eduByRes.TryGetValue(r.ResidentId, out var edus) && edus.Count > 0)
            {
                var att = edus.Where(e => e.AttendanceRate.HasValue).Select(e => (double)e.AttendanceRate!.Value).ToList();
                var prog = edus.Where(e => e.ProgressPercent.HasValue).Select(e => (double)e.ProgressPercent!.Value).ToList();
                f.avg_attendance_rate = att.Count > 0 ? att.Average() : 0;
                f.avg_progress_percent = prog.Count > 0 ? prog.Average() : 0;

                // Latest enrollment_status by record_date
                var latest = edus
                    .Where(e => e.EnrollmentStatus != null)
                    .OrderBy(e => e.RecordDate ?? DateOnly.MinValue)
                    .LastOrDefault();
                f.enroll_Enrolled = latest != null && string.Equals(latest.EnrollmentStatus, "Enrolled", StringComparison.OrdinalIgnoreCase) ? 1 : 0;
            }

            // ── Incidents ──
            if (incByRes.TryGetValue(r.ResidentId, out var incs) && incs.Count > 0)
            {
                f.total_incidents = incs.Count;
                // Unresolved: notebook treats null Resolved as resolved (1), so unresolved = (resolved == false)
                f.unresolved_incidents = incs.Count(i => i.Resolved == false);
                f.max_incident_severity = incs
                    .Select(i => i.Severity != null && SeverityMap.TryGetValue(i.Severity, out var s) ? s : 0)
                    .DefaultIfEmpty(0)
                    .Max();
            }

            // ── Home visits ──
            if (hvByRes.TryGetValue(r.ResidentId, out var visits) && visits.Count > 0)
            {
                f.total_home_visits = visits.Count;

                var safetyVals = visits.Where(v => v.SafetyConcernsNoted.HasValue)
                    .Select(v => v.SafetyConcernsNoted!.Value ? 1.0 : 0.0).ToList();
                f.pct_visits_safety_concerns = safetyVals.Count > 0 ? safetyVals.Average() : 0;

                // Modal cooperation level → ordinal encoding
                var modal = visits
                    .Where(v => !string.IsNullOrWhiteSpace(v.FamilyCooperationLevel))
                    .GroupBy(v => v.FamilyCooperationLevel!.ToLowerInvariant())
                    .OrderByDescending(g => g.Count())
                    .FirstOrDefault();
                f.family_cooperation_enc = modal != null && FamCoopMap.TryGetValue(modal.Key, out var fc) ? fc : 0;
            }

            // ── Interventions ──
            if (ivByRes.TryGetValue(r.ResidentId, out var plans) && plans.Count > 0)
            {
                f.active_interventions = plans.Count(p =>
                    string.Equals((p.Status ?? "").Trim(), "active", StringComparison.OrdinalIgnoreCase));
            }

            // ── Last action: most recent activity touching this resident ──
            (DateOnly?, string?) latestAction = (null, null);
            if (procByRes.TryGetValue(r.ResidentId, out var pl))
            {
                var d = pl.Where(p => p.SessionDate.HasValue).Max(p => (DateOnly?)p.SessionDate);
                if (d.HasValue && (latestAction.Item1 == null || d > latestAction.Item1))
                    latestAction = (d, "Counseling session");
            }
            if (hvByRes.TryGetValue(r.ResidentId, out var vl))
            {
                var d = vl.Where(v => v.VisitDate.HasValue).Max(v => (DateOnly?)v.VisitDate);
                if (d.HasValue && (latestAction.Item1 == null || d > latestAction.Item1))
                    latestAction = (d, "Home visit");
            }
            if (incByRes.TryGetValue(r.ResidentId, out var il))
            {
                var d = il.Where(i => i.IncidentDate.HasValue).Max(i => (DateOnly?)i.IncidentDate);
                if (d.HasValue && (latestAction.Item1 == null || d > latestAction.Item1))
                    latestAction = (d, "Incident report");
            }
            if (ivByRes.TryGetValue(r.ResidentId, out var ipl))
            {
                var d = ipl.Where(p => p.UpdatedAt.HasValue)
                    .Max(p => (DateOnly?)DateOnly.FromDateTime(p.UpdatedAt!.Value));
                if (d.HasValue && (latestAction.Item1 == null || d > latestAction.Item1))
                    latestAction = (d, "Intervention plan update");
            }
            f.last_action_date = latestAction.Item1;
            f.last_action_type = latestAction.Item2;

            results.Add(f);
        }

        return Ok(results);
    }
}
