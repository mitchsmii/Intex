using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProcessRecordingsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ProcessRecordingsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProcessRecording>>> GetProcessRecordings(
        [FromQuery] int? residentId,
        [FromQuery] int? limit)
    {
        var query = _context.ProcessRecordings.AsQueryable();
        if (residentId.HasValue) query = query.Where(p => p.ResidentId == residentId);
        query = query.OrderByDescending(p => p.SessionDate);
        if (limit.HasValue) query = query.Take(limit.Value);
        return await query.ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ProcessRecording>> GetProcessRecording(int id)
    {
        var pr = await _context.ProcessRecordings.FindAsync(id);
        if (pr == null) return NotFound();
        return pr;
    }
}
