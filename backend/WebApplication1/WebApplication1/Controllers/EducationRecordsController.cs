using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class EducationRecordsController : ControllerBase
{
    private readonly AppDbContext _context;

    public EducationRecordsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? residentId)
    {
        var query = _context.EducationRecords.AsQueryable();
        if (!User.IsInRole("Admin"))
        {
            var username = User.Identity?.Name;
            if (string.IsNullOrEmpty(username)) return Forbid();
            var allowedIds = _context.Residents
                .Where(r => r.AssignedSocialWorker == username)
                .Select(r => (int?)r.ResidentId);
            query = query.Where(e => e.ResidentId != null && allowedIds.Contains(e.ResidentId));
        }
        if (residentId.HasValue) query = query.Where(e => e.ResidentId == residentId);
        var records = await query.OrderByDescending(e => e.RecordDate).ToListAsync();
        return Ok(records);
    }
}
