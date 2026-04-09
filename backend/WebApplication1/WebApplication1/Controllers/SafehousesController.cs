using Microsoft.AspNetCore.Authorization;
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

    // Public endpoint — returns only non-sensitive fields (no capacity/occupancy)
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<IEnumerable<object>>> GetSafehouses()
    {
        var safehouses = await _context.Safehouses.ToListAsync();
        var result = safehouses.Select(s => new
        {
            s.SafehouseId,
            s.SafehouseCode,
            s.Name,
            s.Region,
            s.City,
            s.Province,
            s.Country,
            s.OpenDate,
            s.Status
        });
        return Ok(result);
    }

    // Admin-only endpoint — returns full Safehouse including capacity and occupancy
    [HttpGet("admin")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<IEnumerable<Safehouse>>> GetSafehousesAdmin()
    {
        return await _context.Safehouses.ToListAsync();
    }
}
