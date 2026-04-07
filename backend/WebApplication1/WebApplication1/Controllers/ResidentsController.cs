using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class ResidentsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ResidentsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Resident>>> GetResidents()
    {
        var query = _context.Residents.AsQueryable();

        // Admins see everything; social workers see only residents assigned to them.
        if (!User.IsInRole("Admin"))
        {
            var username = User.Identity?.Name;
            if (string.IsNullOrEmpty(username)) return Forbid();
            query = query.Where(r => r.AssignedSocialWorker == username);
        }

        return await query.ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Resident>> GetResident(int id)
    {
        var resident = await _context.Residents.FindAsync(id);
        if (resident == null) return NotFound();

        if (!User.IsInRole("Admin"))
        {
            var username = User.Identity?.Name;
            if (resident.AssignedSocialWorker != username) return Forbid();
        }

        return resident;
    }
}
