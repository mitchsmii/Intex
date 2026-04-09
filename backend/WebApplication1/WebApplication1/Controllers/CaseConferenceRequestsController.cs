using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class CaseConferenceRequestsController : ControllerBase
{
    private readonly AppDbContext _context;

    public CaseConferenceRequestsController(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Admin sees all requests. Social workers see only their own.
    /// Optional ?status filter.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status)
    {
        var query = _context.CaseConferenceRequests.AsQueryable();

        if (!User.IsInRole("Admin"))
        {
            var email = User.Identity?.Name;
            if (string.IsNullOrEmpty(email)) return Forbid();
            query = query.Where(r => r.RequestedBy == email);
        }

        if (!string.IsNullOrEmpty(status))
            query = query.Where(r => r.Status == status);

        var result = await query.OrderByDescending(r => r.SubmittedAt).ToListAsync();
        return Ok(result);
    }

    /// <summary>Count of Pending requests (admin badge).</summary>
    [HttpGet("pending-count")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> PendingCount()
    {
        var count = await _context.CaseConferenceRequests
            .CountAsync(r => r.Status == "Pending");
        return Ok(count);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var item = await _context.CaseConferenceRequests.FindAsync(id);
        if (item == null) return NotFound();
        return Ok(item);
    }

    /// <summary>Social worker submits a conference request.</summary>
    [HttpPost]
    public async Task<IActionResult> Submit([FromBody] SubmitConferenceRequestDto dto)
    {
        var email = User.Identity?.Name;

        var request = new CaseConferenceRequest
        {
            ResidentIds   = JsonSerializer.Serialize(dto.ResidentIds ?? []),
            RequestedBy   = email,
            RequestedDate = dto.RequestedDate,
            RequestedTime = dto.RequestedTime,
            Agenda        = JsonSerializer.Serialize(dto.Agenda ?? []),
            Status        = "Pending",
            SubmittedAt   = DateTime.UtcNow,
        };

        _context.CaseConferenceRequests.Add(request);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = request.RequestId }, request);
    }

    /// <summary>Admin approves a request.</summary>
    [HttpPatch("{id:int}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Approve(int id, [FromBody] ConferenceReviewDto dto)
    {
        var item = await _context.CaseConferenceRequests.FindAsync(id);
        if (item == null) return NotFound();

        item.Status     = "Approved";
        item.ReviewedAt = DateTime.UtcNow;
        item.ReviewedBy = User.Identity?.Name;
        item.AdminNotes = dto.Notes;

        // Notify the requesting SW
        if (!string.IsNullOrEmpty(item.RequestedBy))
        {
            _context.Notifications.Add(new Notification
            {
                RecipientEmail = item.RequestedBy,
                Message = $"Your case conference for {item.RequestedDate?.ToString("MMM d, yyyy") ?? "TBD"} has been approved.",
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
            });
        }

        await _context.SaveChangesAsync();
        return Ok(item);
    }

    /// <summary>Admin rejects a request.</summary>
    [HttpPatch("{id:int}/reject")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Reject(int id, [FromBody] ConferenceReviewDto dto)
    {
        var item = await _context.CaseConferenceRequests.FindAsync(id);
        if (item == null) return NotFound();

        item.Status     = "Rejected";
        item.ReviewedAt = DateTime.UtcNow;
        item.ReviewedBy = User.Identity?.Name;
        item.AdminNotes = dto.Notes;

        if (!string.IsNullOrEmpty(item.RequestedBy))
        {
            _context.Notifications.Add(new Notification
            {
                RecipientEmail = item.RequestedBy,
                Message = $"Your case conference request for {item.RequestedDate?.ToString("MMM d, yyyy") ?? "TBD"} was declined."
                    + (string.IsNullOrEmpty(dto.Notes) ? "" : $" Reason: {dto.Notes}"),
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
            });
        }

        await _context.SaveChangesAsync();
        return Ok(item);
    }

    /// <summary>Admin proposes an alternative date/time.</summary>
    [HttpPatch("{id:int}/counter-propose")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CounterPropose(int id, [FromBody] CounterProposeDto dto)
    {
        var item = await _context.CaseConferenceRequests.FindAsync(id);
        if (item == null) return NotFound();

        item.Status      = "Counter-Proposed";
        item.CounterDate = dto.CounterDate;
        item.CounterTime = dto.CounterTime;
        item.ReviewedAt  = DateTime.UtcNow;
        item.ReviewedBy  = User.Identity?.Name;
        item.AdminNotes  = dto.Notes;

        if (!string.IsNullOrEmpty(item.RequestedBy))
        {
            _context.Notifications.Add(new Notification
            {
                RecipientEmail = item.RequestedBy,
                Message = $"Admin suggested {dto.CounterDate?.ToString("MMM d, yyyy") ?? "TBD"} at {dto.CounterTime} "
                    + $"instead of {item.RequestedDate?.ToString("MMM d, yyyy") ?? "TBD"} at {item.RequestedTime} for your conference."
                    + (string.IsNullOrEmpty(dto.Notes) ? "" : $" Note: {dto.Notes}"),
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
            });
        }

        await _context.SaveChangesAsync();
        return Ok(item);
    }

    /// <summary>Social worker accepts a counter-proposed time.</summary>
    [HttpPatch("{id:int}/accept")]
    public async Task<IActionResult> Accept(int id)
    {
        var item = await _context.CaseConferenceRequests.FindAsync(id);
        if (item == null) return NotFound();
        if (item.Status != "Counter-Proposed")
            return BadRequest("Can only accept a counter-proposed request.");

        // Verify the requesting SW is the one accepting
        var email = User.Identity?.Name;
        if (!User.IsInRole("Admin") && item.RequestedBy != email)
            return Forbid();

        item.Status = "Accepted";

        // Notify the admin who counter-proposed
        if (!string.IsNullOrEmpty(item.ReviewedBy))
        {
            _context.Notifications.Add(new Notification
            {
                RecipientEmail = item.ReviewedBy,
                Message = $"{item.RequestedBy} accepted the counter-proposed conference time: "
                    + $"{item.CounterDate:MMM d, yyyy} at {item.CounterTime}.",
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
            });
        }

        await _context.SaveChangesAsync();
        return Ok(item);
    }
}

public record SubmitConferenceRequestDto(
    List<int>? ResidentIds,
    DateOnly? RequestedDate,
    string? RequestedTime,
    List<AgendaItemDto>? Agenda
);

public record AgendaItemDto(int ResidentId, string? Notes);

public record ConferenceReviewDto(string? Notes);

public record CounterProposeDto(
    DateOnly? CounterDate,
    string? CounterTime,
    string? Notes
);
