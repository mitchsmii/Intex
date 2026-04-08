using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class AdmissionChecklistsController : ControllerBase
{
    private readonly AppDbContext _context;

    public AdmissionChecklistsController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Admin: returns all submissions. Social worker: returns only their own.
    /// Optional ?status=Pending|Approved|Rejected filter.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status)
    {
        var query = _context.AdmissionChecklists.AsQueryable();

        if (!User.IsInRole("Admin"))
        {
            var email = User.Identity?.Name;
            if (string.IsNullOrEmpty(email)) return Forbid();
            query = query.Where(c => c.SocialWorkerEmail == email);
        }

        if (!string.IsNullOrEmpty(status))
            query = query.Where(c => c.Status == status);

        var result = await query.OrderByDescending(c => c.SubmittedAt).ToListAsync();
        return Ok(result);
    }

    /// <summary>Returns count of Pending submissions (admin only).</summary>
    [HttpGet("pending-count")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> PendingCount()
    {
        var count = await _context.AdmissionChecklists
            .CountAsync(c => c.Status == "Pending");
        return Ok(count);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var item = await _context.AdmissionChecklists.FindAsync(id);
        if (item == null) return NotFound();
        return Ok(item);
    }

    /// <summary>Social worker submits a checklist for a resident.</summary>
    [HttpPost]
    public async Task<IActionResult> Submit([FromBody] SubmitChecklistDto dto)
    {
        var email = User.Identity?.Name;

        var resident = await _context.Residents
            .FirstOrDefaultAsync(r => r.ResidentId == dto.ResidentId);
        if (resident == null) return NotFound("Resident not found.");

        if (!User.IsInRole("Admin") && resident.AssignedSocialWorker != email)
            return Forbid();

        // Only one pending submission allowed per resident at a time
        var existing = await _context.AdmissionChecklists
            .FirstOrDefaultAsync(c => c.ResidentId == dto.ResidentId && c.Status == "Pending");
        if (existing != null)
            return Conflict(new { message = "A pending submission already exists for this resident." });

        var checklist = new AdmissionChecklist
        {
            ResidentId        = dto.ResidentId,
            ResidentCode      = resident.InternalCode,
            SocialWorkerEmail = email,
            ResidentInFacility = dto.ResidentInFacility,
            CheckedItems      = JsonSerializer.Serialize(dto.CheckedItems ?? []),
            Status            = "Pending",
            SubmittedAt       = DateTime.UtcNow,
        };

        _context.AdmissionChecklists.Add(checklist);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = checklist.ChecklistId }, checklist);
    }

    /// <summary>Admin approves a submission.</summary>
    [HttpPatch("{id}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Approve(int id, [FromBody] ReviewDto dto)
    {
        var item = await _context.AdmissionChecklists.FindAsync(id);
        if (item == null) return NotFound();

        item.Status     = "Approved";
        item.ReviewedAt = DateTime.UtcNow;
        item.ReviewedBy = User.Identity?.Name;
        item.AdminNotes = dto.Notes;
        await _context.SaveChangesAsync();
        return Ok(item);
    }

    /// <summary>Admin rejects a submission.</summary>
    [HttpPatch("{id}/reject")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Reject(int id, [FromBody] ReviewDto dto)
    {
        var item = await _context.AdmissionChecklists.FindAsync(id);
        if (item == null) return NotFound();

        item.Status     = "Rejected";
        item.ReviewedAt = DateTime.UtcNow;
        item.ReviewedBy = User.Identity?.Name;
        item.AdminNotes = dto.Notes;
        await _context.SaveChangesAsync();
        return Ok(item);
    }
}

public record SubmitChecklistDto(
    int ResidentId,
    bool ResidentInFacility,
    List<string>? CheckedItems
);

public record ReviewDto(string? Notes);
