using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Route("api/[controller]")]
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
        var query = _context.SocialWorkers.AsQueryable();
        if (!string.IsNullOrEmpty(status))
            query = query.Where(s => s.Status == status);
        var workers = await query.OrderBy(s => s.FullName).ToListAsync();
        return Ok(workers);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var sw = await _context.SocialWorkers.FindAsync(id);
        if (sw == null) return NotFound();
        return Ok(sw);
    }
}
