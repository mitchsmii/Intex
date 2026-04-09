using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class NotificationsController : ControllerBase
{
    private readonly AppDbContext _context;

    public NotificationsController(AppDbContext context)
    {
        _context = context;
    }

    private string? CurrentEmail =>
        User.FindFirstValue(ClaimTypes.Email);

    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var email = CurrentEmail;
        if (string.IsNullOrEmpty(email)) return Ok(0);

        var count = await _context.Notifications
            .CountAsync(n => n.RecipientEmail == email && !n.IsRead);

        return Ok(count);
    }

    [HttpGet]
    public async Task<IActionResult> GetNotifications()
    {
        var email = CurrentEmail;
        if (string.IsNullOrEmpty(email)) return Ok(Array.Empty<object>());

        var notes = await _context.Notifications
            .Where(n => n.RecipientEmail == email && !n.IsRead)
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync();

        return Ok(notes);
    }

    [HttpPatch("{id}/read")]
    public async Task<IActionResult> MarkRead(int id)
    {
        var email = CurrentEmail;
        var note = await _context.Notifications.FindAsync(id);
        if (note == null || note.RecipientEmail != email) return NotFound();

        note.IsRead = true;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("mark-all-read")]
    public async Task<IActionResult> MarkAllRead()
    {
        var email = CurrentEmail;
        if (string.IsNullOrEmpty(email)) return NoContent();

        await _context.Notifications
            .Where(n => n.RecipientEmail == email && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));

        return NoContent();
    }
}
