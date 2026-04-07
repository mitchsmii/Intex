using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HomeVisitationsController : ControllerBase
{
    private readonly AppDbContext _context;

    public HomeVisitationsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<HomeVisitation>>> GetHomeVisitations(
        [FromQuery] int? residentId,
        [FromQuery] int? limit)
    {
        var query = _context.HomeVisitations.AsQueryable();
        if (residentId.HasValue) query = query.Where(h => h.ResidentId == residentId);
        query = query.OrderByDescending(h => h.VisitDate);
        if (limit.HasValue) query = query.Take(limit.Value);
        return await query.ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<HomeVisitation>> GetHomeVisitation(int id)
    {
        var hv = await _context.HomeVisitations.FindAsync(id);
        if (hv == null) return NotFound();
        return hv;
    }
}
