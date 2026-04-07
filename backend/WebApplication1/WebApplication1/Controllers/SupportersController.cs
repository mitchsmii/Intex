using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SupportersController : ControllerBase
{
    private readonly AppDbContext _context;
    public SupportersController(AppDbContext context) => _context = context;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var supporters = await _context.Supporters.ToListAsync();
        return Ok(supporters);
    }

    [HttpGet("lookup")]
    public async Task<IActionResult> Lookup(
        [FromQuery] string firstName,
        [FromQuery] string lastName,
        [FromQuery] string email)
    {
        var match = await _context.Supporters
            .Where(s =>
                s.FirstName!.ToLower() == firstName.ToLower() &&
                s.LastName!.ToLower() == lastName.ToLower() &&
                s.Email!.ToLower() == email.ToLower())
            .FirstOrDefaultAsync();

        if (match == null)
            return NotFound(new { message = "No supporter found with those details." });

        return Ok(match);
    }
}
