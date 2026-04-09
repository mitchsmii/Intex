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
    [Authorize(Roles = "Admin,SocialWorker")]
    public async Task<ActionResult<ProcessRecording>> CreateProcessRecording(ProcessRecording recording)
    {
        try
        {
            // Let the database assign the primary key
            recording.RecordingId = 0;

            // If a social_worker username was provided but no social_worker_id,
            // try to resolve the ID from the SocialWorkers table.
            if (recording.SocialWorkerId == null && !string.IsNullOrEmpty(recording.SocialWorker))
            {
                var sw = await _context.SocialWorkers
                    .FirstOrDefaultAsync(s => s.FullName == recording.SocialWorker);
                if (sw != null) recording.SocialWorkerId = sw.SocialWorkerId;
            }

 