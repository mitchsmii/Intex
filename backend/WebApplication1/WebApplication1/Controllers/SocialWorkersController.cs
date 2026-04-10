using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SocialWorkersController : ControllerBase
{
    private readonly AppDbContext _context;

    public SocialWorkersController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status)
    {
        // First try the social_workers table
        var tableWorkers = await _context.SocialWorkers.ToListAsync();

        if (tableWorkers.Count > 0)
        {
            var query = tableWorkers.AsQueryable();
            if (!string.IsNullOrEmpty(status))
                query = query.Where(s => s.Status == status);
            return Ok(query.OrderBy(s => s.FullName).ToList());
        }

        // Fallback: derive distinct names from residents + process_recordings
        var fromResidents = await _context.Residents
            .Where(r => r.AssignedSocialWorker != null && r.AssignedSocialWorker != "")
            .Select(r => r.AssignedSocialWorker!)
            .Distinct()
            .ToListAsync();

        var fromRecordings = await _context.ProcessRecordings
            .Where(p => p.SocialWorker != null && p.SocialWorker != "")
            .Select(p => p.SocialWorker!)
            .Distinct()
            .ToListAsync();

        var allNames = fromResidents
            .Union(fromRecordings, StringComparer.OrdinalIgnoreCase)
            .OrderBy(n => n)
            .Select(name => new
            {
                SocialWorkerId = 0,
                FullName = name,
                FirstName = (string?)null,
                LastName  = (string?)null,
                Email     = (string?)null,
                Phone     = (string?)null,
                SafehouseId = (int?)null,
                Status    = "Active",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            })
            .ToList();

        return Ok(allNames);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var sw = await _context.SocialWorkers.FindAsync(id);
        if (sw == null) return NotFound();
        return Ok(sw);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateSocialWorkerDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.FullName))
            return BadRequest(new { message = "Full name is required." });

        var sw = new SocialWorker
        {
            FullName    = dto.FullName.Trim(),
            FirstName   = dto.FirstName?.Trim(),
            LastName    = dto.LastName?.Trim(),
            Email       = dto.Email?.Trim(),
            Phone       = dto.Phone?.Trim(),
            SafehouseId = dto.SafehouseId,
            Status      = "Active",
            CreatedAt   = DateTime.UtcNow,
            UpdatedAt   = DateTime.UtcNow,
        };

        _context.SocialWorkers.Add(sw);
        await _context.SaveChangesAsync();
        return Ok(sw);
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var sw = await _context.SocialWorkers.FindAsync(id);
        if (sw == null) return NotFound();
        _context.SocialWorkers.Remove(sw);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
