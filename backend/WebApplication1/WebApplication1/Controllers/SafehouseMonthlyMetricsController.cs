using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SafehouseMonthlyMetricsController : ControllerBase
{
    private readonly AppDbContext _context;
    public SafehouseMonthlyMetricsController(AppDbContext context) => _context = context;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var metrics = await _context.SafehouseMonthlyMetrics.ToListAsync();
        return Ok(metrics);
    }

    [HttpGet("latest")]
    public async Task<IActionResult> Latest()
    {
        // Return the most recent metric row for each safehouse
        var latest = await _context.SafehouseMonthlyMetrics
            .GroupBy(m => m.SafehouseId)
            .Select(g => g.OrderByDescending(m => m.MonthStart).First())
            .ToListAsync();

        return Ok(latest);
    }
}
