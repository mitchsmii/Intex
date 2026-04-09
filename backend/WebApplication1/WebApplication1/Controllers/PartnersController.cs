using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class PartnersController : ControllerBase
{
    private readonly AppDbContext _context;
    public PartnersController(AppDbContext context) => _context = context;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var partners = await _context.Partners
            .OrderBy(p => p.PartnerId)
            .ToListAsync();
        return Ok(partners);
    }
}
