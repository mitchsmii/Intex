using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Authorize]
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
        if (!User.IsInRole("Admin"))
        {
            var username = User.Identity?.Name;
            if (string.IsNullOrEmpty(username)) return Forbid();
            var allowedIds = _context.Residents
                .Where(r => r.AssignedSocialWorker == username)
                .Select(r => (int?)r.ResidentId);
            query = query.Where(i => i.ResidentId != null && allowedIds.Contains(i.ResidentId));
        }
        if (residentId.HasValue) query = query.Where(i => i.ResidentId == residentId);
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

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateIncident(int id, IncidentReport incident)
    {
        if (id != incident.IncidentId) return BadRequest();

        if (!User.IsInRole("Admin"))
        {
            var username = User.Identity?.Name;
            if (string.IsNullOrEmpty(username)) return Forbid();
            var existing = await _context.IncidentReports.AsNoTracking()
                .FirstOrDefaultAsync(i => i.IncidentId == id);
            if (existing == null) return NotFound();
            var allowed = await _context.Residents
                .AnyAsync(r => r.ResidentId == existing.ResidentId && r.AssignedSocialWorker == username);
            if (!allowed) return Forbid();
        }

        _context.Entry(incident).State = EntityState.Modified;
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!await _context.IncidentReports.AnyAsync(i => i.IncidentId == id))
                return NotFound();
            throw;
        }
        return NoContent();
    }
}
