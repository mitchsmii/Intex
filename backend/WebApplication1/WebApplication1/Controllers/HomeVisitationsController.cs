using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class HomeVisitationsController : ControllerBase
{
    private readonly AppDbContext _context;

    public HomeVisitationsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetHomeVisitations(
        [FromQuery] int? residentId,
        [FromQuery] int? limit)
    {
        var query = _context.HomeVisitations.AsQueryable();
        if (!User.IsInRole("Admin"))
        {
            var username = User.Identity?.Name;
            if (string.IsNullOrEmpty(username)) return Forbid();
            var allowedIds = _context.Residents
                .Where(r => r.AssignedSocialWorker == username)
                .Select(r => (int?)r.ResidentId);
            query = query.Where(h => h.ResidentId != null && allowedIds.Contains(h.ResidentId));
        }
        if (residentId.HasValue) query = query.Where(h => h.ResidentId == residentId);
        query = query.OrderByDescending(h => h.VisitDate);
        if (limit.HasValue) query = query.Take(limit.Value);

        var visitations = await query
            .GroupJoin(
                _context.SocialWorkers,
                hv => hv.SocialWorkerId,
                sw => sw.SocialWorkerId,
                (hv, sws) => new { hv, sws })
            .SelectMany(
                x => x.sws.DefaultIfEmpty(),
                (x, sw) => new
                {
                    x.hv.VisitationId,
                    x.hv.ResidentId,
                    x.hv.VisitDate,
                    SocialWorkerName = sw != null ? sw.FullName : x.hv.SocialWorker,
                    x.hv.SocialWorker,
                    x.hv.SocialWorkerId,
                    x.hv.VisitType,
                    x.hv.LocationVisited,
                    x.hv.FamilyMembersPresent,
                    x.hv.Purpose,
                    x.hv.Observations,
                    x.hv.FamilyCooperationLevel,
                    x.hv.SafetyConcernsNoted,
                    x.hv.FollowUpNeeded,
                    x.hv.FollowUpNotes,
                    x.hv.VisitOutcome
                })
            .ToListAsync();

        return Ok(visitations);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetHomeVisitation(int id)
    {
        var result = await _context.HomeVisitations
            .Where(hv => hv.VisitationId == id)
            .GroupJoin(
                _context.SocialWorkers,
                hv => hv.SocialWorkerId,
                sw => sw.SocialWorkerId,
                (hv, sws) => new { hv, sws })
            .SelectMany(
                x => x.sws.DefaultIfEmpty(),
                (x, sw) => new
                {
                    x.hv.VisitationId,
                    x.hv.ResidentId,
                    x.hv.VisitDate,
                    SocialWorkerName = sw != null ? sw.FullName : x.hv.SocialWorker,
                    x.hv.SocialWorker,
                    x.hv.SocialWorkerId,
                    x.hv.VisitType,
                    x.hv.LocationVisited,
                    x.hv.FamilyMembersPresent,
                    x.hv.Purpose,
                    x.hv.Observations,
                    x.hv.FamilyCooperationLevel,
                    x.hv.SafetyConcernsNoted,
                    x.hv.FollowUpNeeded,
                    x.hv.FollowUpNotes,
                    x.hv.VisitOutcome
                })
            .FirstOrDefaultAsync();

        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<HomeVisitation>> CreateHomeVisitation(HomeVisitation visitation)
    {
        try
        {
            visitation.VisitationId = 0;

            if (visitation.SocialWorkerId == null && !string.IsNullOrEmpty(visitation.SocialWorker))
            {
                var sw = await _context.SocialWorkers
                    .FirstOrDefaultAsync(s => s.FullName == visitation.SocialWorker);
                if (sw != null) visitation.SocialWorkerId = sw.SocialWorkerId;
            }

            _context.HomeVisitations.Add(visitation);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetHomeVisitation), new { id = visitation.VisitationId }, visitation);
        }
        catch (Exception ex)
        {
            var inner = ex.InnerException?.Message ?? "none";
            return StatusCode(500, new { error = ex.Message, inner });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateHomeVisitation(int id, HomeVisitation visitation)
    {
        if (id != visitation.VisitationId) return BadRequest();

        _context.Entry(visitation).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!await _context.HomeVisitations.AnyAsync(h => h.VisitationId == id))
                return NotFound();
            throw;
        }

        return NoContent();
    }
}
