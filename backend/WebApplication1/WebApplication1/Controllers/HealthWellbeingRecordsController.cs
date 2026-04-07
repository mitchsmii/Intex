using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class HealthWellbeingRecordsController : ControllerBase
{
    private readonly AppDbContext _context;

    public HealthWellbeingRecordsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? residentId)
    {
        var query = _context.HealthWellbeingRecords.AsQueryable();
        if (!User.IsInRole("Admin"))
        {
            var username = User.Identity?.Name;
            if (string.IsNullOrEmpty(username)) return Forbid();
            var allowedIds = _context.Residents
                .Where(r => r.AssignedSocialWorker == username)
                .Select(r => (int?)r.ResidentId);
            query = query.Where(h => h.ResidentId != null && allowedIds.Contains(h.ResidentId));
        }
        if (residentId.HasValue) query = query.Where(h => h.ResidentId == residentId);
        var records = await query.OrderByDescending(h => h.RecordDate).ToListAsync();
        return Ok(records);
    }
}
