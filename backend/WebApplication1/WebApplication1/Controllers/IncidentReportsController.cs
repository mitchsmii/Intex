using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Route("api/[controller]")]
public class IncidentReportsController : ControllerBase
{
    private readonly AppDbContext _context;

    public IncidentReportsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? residentId,
        [FromQuery] bool? unresolvedOnly)
    {
        var query = _context.IncidentReports.AsQueryable();
        if (residentId.HasValue)    query = query.Where(i => i.ResidentId == residentId);
        if (unresolvedOnly == true) query = query.Where(i => i.Resolved != true);
        var incidents = await query.OrderByDescending(i => i.IncidentDate).ToListAsync();
        return Ok(incidents);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var ir = await _context.IncidentReports.FindAsync(id);
        if (ir == null) return NotFound();
        return Ok(ir);
    }
}
