using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SafehousesController : ControllerBase
{
    private readonly AppDbContext _context;

    public SafehousesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Safehouse>>> GetSafehouses()
    {
        return await _context.Safehouses.ToListAsync();
    }
}
