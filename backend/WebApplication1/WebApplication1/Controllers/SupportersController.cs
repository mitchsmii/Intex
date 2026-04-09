using Microsoft.AspNetCore.Authorization;
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

    // Find supporter by email, or create one if they don't exist yet.
    // Returns the supporter record (existing or newly created).
    [HttpPost("upsert")]
    public async Task<IActionResult> Upsert([FromBody] UpsertSupporterDto dto)
    {
        var existing = await _context.Supporters
            .Where(s => s.Email!.ToLower() == dto.Email.ToLower())
            .FirstOrDefaultAsync();

        if (existing != null)
            return Ok(existing);

        var supporter = new Supporter
        {
            FirstName       = dto.FirstName,
            LastName        = dto.LastName,
            Email           = dto.Email,
            Phone           = dto.Phone,
            DisplayName     = string.IsNullOrWhiteSpace(dto.DisplayName)
                                ? (dto.FirstName + " " + dto.LastName).Trim()
                                : dto.DisplayName,
            SupporterType   = "Individual",
            Status          = "Active",
            CreatedAt       = DateTime.UtcNow,
        };

        _context.Supporters.Add(supporter);
        await _context.SaveChangesAsync();
        return Ok(supporter);
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

    // Email-only lookup for authenticated donors viewing their own history
    [HttpGet("lookup-by-email")]
    [Authorize]
    public async Task<IActionResult> LookupByEmail([FromQuery] string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return BadRequest(new { message = "Email is required." });

        var match = await _context.Supporters
            .Where(s => s.Email!.ToLower() == email.ToLower())
            .FirstOrDefaultAsync();

        if (match == null)
            return NotFound(new { message = "No donation history found for this account." });

        return Ok(match);
    }

    [HttpPatch("{id:int}")]
    [Authorize]
    public async Task<IActionResult> UpdatePartial(int id, [FromBody] UpdateSupporterDto dto)
    {
        var supporter = await _context.Supporters.FindAsync(id);
        if (supporter == null) return NotFound();

        if (dto.FirstName   != null) supporter.FirstName   = dto.FirstName;
        if (dto.LastName    != null) supporter.LastName    = dto.LastName;
        if (dto.DisplayName != null) supporter.DisplayName = dto.DisplayName;
        if (dto.Email       != null) supporter.Email       = dto.Email;
        if (dto.Phone       != null) supporter.Phone       = dto.Phone;

        await _context.SaveChangesAsync();
        return Ok(supporter);
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var supporter = await _context.Supporters.FindAsync(id);
        if (supporter == null) return NotFound();
        _context.Supporters.Remove(supporter);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}

