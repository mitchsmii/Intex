using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class AssessmentsController : ControllerBase
{
    private readonly AppDbContext _context;

    private static readonly HashSet<string> RequiresImmediateAction = new(StringComparer.OrdinalIgnoreCase)
    {
        "High", "Emergency", "Severe", "Extreme", "ProbablePTSD"
    };

    public AssessmentsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? residentId,
        [FromQuery] string? instrument)
    {
        var query = _context.Assessments.AsQueryable();

        if (!User.IsInRole("Admin"))
        {
            var username = User.Identity?.Name;
            if (string.IsNullOrEmpty(username)) return Forbid();
            var allowedIds = _context.Residents
                .Where(r => r.AssignedSocialWorker == username)
                .Select(r => r.ResidentId);
            query = query.Where(a => allowedIds.Contains(a.ResidentId));
        }

        if (residentId.HasValue) query = query.Where(a => a.ResidentId == residentId);
        if (!string.IsNullOrEmpty(instrument)) query = query.Where(a => a.Instrument == instrument);

        var rows = await query.OrderByDescending(a => a.AdministeredDate).ToListAsync();
        return Ok(rows);
    }

    [HttpPost]
    public async Task<ActionResult<Assessment>> CreateAssessment(Assessment assessment)
    {
        // Authorization: SW can only create for residents they're assigned to
        if (!User.IsInRole("Admin"))
        {
            var username = User.Identity?.Name;
            if (string.IsNullOrEmpty(username)) return Forbid();
            var allowed = await _context.Residents
                .AnyAsync(r => r.ResidentId == assessment.ResidentId && r.AssignedSocialWorker == username);
            if (!allowed) return Forbid();
            // Force the administered_by to match the caller — never trust the client
            assessment.AdministeredBy = username;
        }

        // Server-side enforcement of the immediate-action requirement for high-severity records
        if (!string.IsNullOrEmpty(assessment.SeverityBand)
            && RequiresImmediateAction.Contains(assessment.SeverityBand)
            && string.IsNullOrWhiteSpace(assessment.ImmediateAction))
        {
            return BadRequest(new
            {
                message = "Immediate action notes are required when severity is High, Emergency, Severe, Extreme, or Probable PTSD."
            });
        }

        // BDI item-9 hard guard: parse responses_json for item 9 and require immediate action when ≥ 2
        if (string.Equals(assessment.Instrument, "BDI", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(assessment.ResponsesJson))
        {
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(assessment.ResponsesJson);
                if (doc.RootElement.TryGetProperty("items", out var items)
                    && items.TryGetProperty("9", out var item9)
                    && item9.TryGetInt32(out var item9Score)
                    && item9Score >= 2
                    && string.IsNullOrWhiteSpace(assessment.ImmediateAction))
                {
                    return BadRequest(new
                    {
                        message = "BDI item 9 indicates suicidal ideation. Immediate action notes are required."
                    });
                }
            }
            catch
            {
                // malformed JSON — let it through; the model layer will reject if needed
            }
        }

        assessment.CreatedAt = DateTime.UtcNow;
        _context.Assessments.Add(assessment);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new { residentId = assessment.ResidentId }, assessment);
    }
}
