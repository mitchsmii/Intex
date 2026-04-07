using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DonationAllocationsController : ControllerBase
{
    private readonly AppDbContext _context;
    public DonationAllocationsController(AppDbContext context) => _context = context;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var allocations = await _context.DonationAllocations.ToListAsync();
        return Ok(allocations);
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary()
    {
        var total = await _context.DonationAllocations.SumAsync(a => a.AmountAllocated ?? 0);

        var summary = await _context.DonationAllocations
            .Where(a => a.ProgramArea != null)
            .GroupBy(a => a.ProgramArea)
            .Select(g => new
            {
                ProgramArea     = g.Key,
                AmountAllocated = g.Sum(a => a.AmountAllocated ?? 0),
            })
            .OrderByDescending(x => x.AmountAllocated)
            .ToListAsync();

        return Ok(new { total, breakdown = summary });
    }
}
