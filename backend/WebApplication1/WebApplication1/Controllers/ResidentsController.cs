using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
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
        return await _context.Residents.ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Resident>> GetResident(int id)
    {
        var resident = await _context.Residents.FindAsync(id);
        if (resident == null) return NotFound();
        return resident;
    }
}
