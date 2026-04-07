using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InterventionPlansController : ControllerBase
{
    private readonly AppDbContext _context;
    public InterventionPlansController(AppDbContext context) => _context = context;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var plans = await _context.InterventionPlans.ToListAsync();
        return Ok(plans);
    }

    [HttpGet("upcoming")]
    public async Task<IActionResult> Upcoming([FromQuery] int days = 14)
    {
        var today    = DateOnly.FromDateTime(DateTime.UtcNow);
        var cutoff   = today.AddDays(days);

        var plans = await _context.InterventionPlans
            .Where(p =>
                p.StartDate.HasValue &&
                p.StartDate.Value >= today &&
                p.StartDate.Value <= cutoff &&
                (p.Status == "Scheduled" || p.Status == "Active" || p.Status == "Pending"))
            .OrderBy(p => p.StartDate)
            .ToListAsync();

        // Join with residents to get the internal code
        var residentIds = plans.Select(p => p.ResidentId).Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
        var residents   = await _context.Residents
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
                ResidentCode       = r?.InternalCode,
                SafehouseId        = r?.SafehouseId,
                AssignedSocialWorker = r?.AssignedSocialWorker,
                p.Goals,
                p.StartDate,
                p.EndDate,
                p.Status,
                p.CreatedBy,
            };
        });

        return Ok(result);
    }
}
