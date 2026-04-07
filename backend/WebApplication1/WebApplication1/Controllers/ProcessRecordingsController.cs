using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class ProcessRecordingsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ProcessRecordingsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetProcessRecordings(
        [FromQuery] int? residentId,
        [FromQuery] int? limit)
    {
        var query = _context.ProcessRecordings.AsQueryable();
        if (!User.IsInRole("Admin"))
        {
            var username = User.Identity?.Name;
            if (string.IsNullOrEmpty(username)) return Forbid();
            var allowedIds = _context.Residents
                .Where(r => r.AssignedSocialWorker == username)
                .Select(r => (int?)r.ResidentId);
            query = query.Where(p => p.ResidentId != null && allowedIds.Contains(p.ResidentId));
        }
        if (residentId.HasValue) query = query.Where(p => p.ResidentId == residentId);
        query = query.OrderByDescending(p => p.SessionDate);
        if (limit.HasValue) query = query.Take(limit.Value);

        var recordings = await query
            .GroupJoin(
                _context.SocialWorkers,
                pr => pr.SocialWorkerId,
                sw => sw.SocialWorkerId,
                (pr, sws) => new { pr, sws })
            .SelectMany(
                x => x.sws.DefaultIfEmpty(),
                (x, sw) => new
                {
                    x.pr.RecordingId,
                    x.pr.ResidentId,
                    x.pr.SessionDate,
                    SocialWorkerName = sw != null ? sw.FullName : x.pr.SocialWorker,
                    x.pr.SocialWorker,
                    x.pr.SocialWorkerId,
                    x.pr.SessionType,
                    x.pr.SessionDurationMinutes,
                    x.pr.EmotionalStateObserved,
                    x.pr.EmotionalStateEnd,
                    x.pr.SessionNarrative,
                    x.pr.InterventionsApplied,
                    x.pr.FollowUpActions,
                    x.pr.ProgressNoted,
                    x.pr.ConcernsFlagged,
                    x.pr.ReferralMade
                })
            .ToListAsync();

        return Ok(recordings);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetProcessRecording(int id)
    {
        var result = await _context.ProcessRecordings
            .Where(pr => pr.RecordingId == id)
            .GroupJoin(
                _context.SocialWorkers,
                pr => pr.SocialWorkerId,
                sw => sw.SocialWorkerId,
                (pr, sws) => new { pr, sws })
            .SelectMany(
                x => x.sws.DefaultIfEmpty(),
                (x, sw) => new
                {
                    x.pr.RecordingId,
                    x.pr.ResidentId,
                    x.pr.SessionDate,
                    SocialWorkerName = sw != null ? sw.FullName : x.pr.SocialWorker,
                    x.pr.SocialWorker,
                    x.pr.SocialWorkerId,
                    x.pr.SessionType,
                    x.pr.SessionDurationMinutes,
                    x.pr.EmotionalStateObserved,
                    x.pr.EmotionalStateEnd,
                    x.pr.SessionNarrative,
                    x.pr.InterventionsApplied,
                    x.pr.FollowUpActions,
                    x.pr.ProgressNoted,
                    x.pr.ConcernsFlagged,
                    x.pr.ReferralMade
                })
            .FirstOrDefaultAsync();

        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<ProcessRecording>> CreateProcessRecording(ProcessRecording recording)
    {
        _context.ProcessRecordings.Add(recording);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetProcessRecording), new { id = recording.RecordingId }, recording);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateProcessRecording(int id, ProcessRecording recording)
    {
        if (id != recording.RecordingId) return BadRequest();

        _context.Entry(recording).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!await _context.ProcessRecordings.AnyAsync(p => p.RecordingId == id))
                return NotFound();
            throw;
        }

        return NoContent();
    }
}
