using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Authorize]
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
        var query = _context.Residents.AsQueryable();

        // Admins see everything; social workers see only residents assigned to them.
        if (!User.IsInRole("Admin"))
        {
            var username = User.Identity?.Name;
            if (string.IsNullOrEmpty(username)) return Forbid();
            query = query.Where(r => r.AssignedSocialWorker == username);
        }

        return await query.ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Resident>> GetResident(int id)
    {
        var resident = await _context.Residents.FindAsync(id);
        if (resident == null) return NotFound();

        if (!User.IsInRole("Admin"))
        {
            var username = User.Identity?.Name;
            if (resident.AssignedSocialWorker != username) return Forbid();
        }

        return resident;
    }

    [HttpGet("next-code")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetNextCode()
    {
        var codes = await _context.Residents
            .Where(r => r.InternalCode != null && r.InternalCode.StartsWith("LS-"))
            .Select(r => r.InternalCode!)
            .ToListAsync();

        int maxNum = codes
            .Select(c => int.TryParse(c[3..], out var n) ? n : 0)
            .DefaultIfEmpty(0)
            .Max();

        int next = maxNum + 1;
        return Ok(new
        {
            internalCode = $"LS-{next:D4}",
            caseControlNo = $"CC-{next:D4}"
        });
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<Resident>> CreateResident([FromBody] CreateResidentDto dto)
    {
        // Generate unique codes atomically
        var codes = await _context.Residents
            .Where(r => r.InternalCode != null && r.InternalCode.StartsWith("LS-"))
            .Select(r => r.InternalCode!)
            .ToListAsync();

        int maxNum = codes
            .Select(c => int.TryParse(c[3..], out var n) ? n : 0)
            .DefaultIfEmpty(0)
            .Max();

        int next = maxNum + 1;
        var today = DateOnly.FromDateTime(DateTime.Today);

        var resident = new Resident
        {
            InternalCode = $"LS-{next:D4}",
            CaseControlNo = $"CC-{next:D4}",
            AgeUponAdmission = dto.Age.ToString(),
            PresentAge = dto.Age.ToString(),
            SafehouseId = dto.SafehouseId,
            AssignedSocialWorker = dto.AssignedSocialWorker,
            CurrentRiskLevel = dto.RiskLevel,
            InitialRiskLevel = dto.RiskLevel,
            CaseStatus = "Active",
            DateOfAdmission = today,
            CreatedAt = DateTime.UtcNow,
        };

        _context.Residents.Add(resident);
        await _context.SaveChangesAsync();

        // Create notification for the assigned social worker
        if (!string.IsNullOrEmpty(dto.SwEmail))
        {
            _context.Notifications.Add(new Notification
            {
                RecipientEmail = dto.SwEmail,
                Message = $"You have been assigned a new resident: {resident.InternalCode}",
                RelatedResidentCode = resident.InternalCode,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();
        }

        return CreatedAtAction(nameof(GetResident), new { id = resident.ResidentId }, resident);
    }
}
