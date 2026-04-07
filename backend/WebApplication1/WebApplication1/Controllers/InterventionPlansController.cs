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
    public async Task<ActionResult<IEnumerable<InterventionPlan>>> GetInterventionPlans(
        [FromQuery] int? residentId,
        [FromQuery] string? status)
    {
        var query = _context.InterventionPlans.AsQueryable();
        if (residentId.HasValue) query = query.Where(p => p.ResidentId == residentId);
        if (!string.IsNullOrEmpty(status)) query = query.Where(p => p.Status == status);
        return await query.OrderByDescending(p => p.UpdatedAt).ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<InterventionPlan>> GetInterventionPlan(int id)
    {
        var plan = await _context.InterventionPlans.FindAsync(id);
        if (plan == null) return NotFound();
        return plan;
    }
}
