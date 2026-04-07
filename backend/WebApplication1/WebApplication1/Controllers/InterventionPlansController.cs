using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InterventionPlansController : ControllerBase
{
    private readonly AppDbContext _context;

    public InterventionPlansController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? residentId,
        [FromQuery] string? status)
    {
        var query = _context.InterventionPlans.AsQueryable();
        if (residentId.HasValue)           query = query.Where(p => p.ResidentId == residentId);
        if (!string.IsNullOrEmpty(status)) query = query.Where(p => p.Status == status);
        var plans = await query.OrderByDescending(p => p.UpdatedAt).ToListAsync();
        return Ok(plans);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var plan = await _context.InterventionPlans.FindAsync(id);
        if (plan == null) return NotFound();
        return Ok(plan);
    }

    [HttpGet("upcoming")]
    public async Task<IActionResult> Upcoming([FromQuery] int days = 14)
    {
        var today  = DateOnly.FromDateTime(DateTime.UtcNow);
        var cutoff = today.AddDays(days);

        var plans = await _context.InterventionPlans
            .Where(p =>
                p.CaseConferenceDate.HasValue &&
                p.CaseConferenceDate.Value >= today &&
                p.CaseConferenceDate.Value <= cutoff)
            .OrderBy(p => p.CaseConferenceDate)
            .ToListAsync();

        var residentIds = plans
            .Select(p => p.ResidentId)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var residents = await _context.Residents
            .Where(r => residentIds.Contains(r.ResidentId))
            .Select(r => new { r.ResidentId, r.InternalCode, r.SafehouseId, r.AssignedSocialWorker })
            .ToListAsync();

        var result = plans.Select(p =>
        {
            var r = residents.FirstOrDefault(x => x.ResidentId == p.ResidentId);
            return new
            {
                p.PlanId,
                p.ResidentId,
                ResidentCode         = r?.InternalCode,
                SafehouseId          = r?.SafehouseId,
                AssignedSocialWorker = r?.AssignedSocialWorker,
                p.PlanCategory,
                p.PlanDescription,
                p.CaseConferenceDate,
                p.TargetDate,
                p.Status,
            };
        });

        return Ok(result);
    }
}
