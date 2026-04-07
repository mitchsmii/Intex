using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Route("api/[controller]")]
public class IncidentReportsController : ControllerBase
{
    private readonly AppDbContext _context;
    public IncidentReportsController(AppDbContext context) => _context = context;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var incidents = await _context.IncidentReports
            .OrderByDescending(i => i.IncidentDate)
            .ToListAsync();

        return Ok(incidents);
    }
}
