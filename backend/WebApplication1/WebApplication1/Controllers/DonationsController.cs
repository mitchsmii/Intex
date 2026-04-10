using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DonationsController : ControllerBase
{
    private readonly AppDbContext _context;
    public DonationsController(AppDbContext context) => _context = context;

    [AllowAnonymous]
    [EnableRateLimiting("public")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDonationDto dto)
    {
        var supporterExists = await _context.Supporters.AnyAsync(s => s.SupporterId == dto.SupporterId);
        if (!supporterExists)
            return BadRequest(new { message = "Invalid supporter." });

        var donation = new Donation
        {
            SupporterId   = dto.SupporterId,
            Amount        = dto.Amount,
            CurrencyCode  = dto.CurrencyCode,
            IsRecurring   = dto.IsRecurring,
            DonationType  = dto.DonationType ?? "Monetary",
            ChannelSource = dto.ChannelSource ?? "Website",
            CampaignName  = dto.CampaignName,
            Notes         = dto.Notes,
            DonationDate  = DateOnly.FromDateTime(DateTime.UtcNow),
        };
        _context.Donations.Add(donation);
        await _context.SaveChangesAsync();
        return Ok(donation);
    }

    [AllowAnonymous]
    [HttpGet("total")]
    public async Task<IActionResult> Total()
    {
        var total = await _context.Donations.SumAsync(d => d.Amount ?? 0);
        return Ok(new { total });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 100)
    {
        if (pageSize > 500) pageSize = 500;
        if (page < 1) page = 1;

        var donations = await (
            from d in _context.Donations
            join s in _context.Supporters on d.SupporterId equals s.SupporterId into sup
            from s in sup.DefaultIfEmpty()
            orderby d.DonationDate descending
            select new
            {
                d.DonationId,
                d.SupporterId,
                SupporterName = s == null ? "Anonymous"
                    : (s.DisplayName ?? (s.FirstName + " " + s.LastName).Trim()),
                d.Amount,
                d.EstimatedValue,
                d.DonationDate,
                d.IsRecurring,
                d.DonationType,
                d.ChannelSource,
                d.CurrencyCode,
                d.CampaignName,
                d.Notes,
            }
        ).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        return Ok(donations);
    }

    [HttpGet("by-supporter/{supporterId:int}")]
    public async Task<IActionResult> BySupporterId(int supporterId)
    {
        var donations = await _context.Donations
            .Where(d => d.SupporterId == supporterId)
            .OrderByDescending(d => d.DonationDate)
            .ToListAsync();

        return Ok(donations);
    }

    [HttpGet("summary/monthly")]
    public async Task<IActionResult> MonthlySummary()
    {
        var summary = await _context.Donations
            .Where(d => d.DonationDate.HasValue)
            .GroupBy(d => new { d.DonationDate!.Value.Year, d.DonationDate.Value.Month })
            .Select(g => new
            {
                Year  = g.Key.Year,
                Month = g.Key.Month,
                Total = g.Sum(d => d.Amount ?? 0),
                Count = g.Count(),
            })
            .OrderBy(x => x.Year).ThenBy(x => x.Month)
            .ToListAsync();

        return Ok(summary);
    }

    [HttpGet("top-supporters")]
    public async Task<IActionResult> TopSupporters([FromQuery] int top = 5)
    {
        var results = await (
            from d in _context.Donations
            join s in _context.Supporters on d.SupporterId equals s.SupporterId into sup
            from s in sup.DefaultIfEmpty()
            group new { d, s } by new { d.SupporterId, s.DisplayName, s.FirstName, s.LastName, d.IsRecurring } into g
            select new
            {
                SupporterId = g.Key.SupporterId,
                Name = g.Key.DisplayName
                    ?? ((g.Key.FirstName + " " + g.Key.LastName).Trim()),
                Total       = g.Sum(x => x.d.Amount ?? 0),
                IsRecurring = g.Key.IsRecurring,
                FirstDate   = g.Min(x => x.d.DonationDate),
            }
        )
        .OrderByDescending(x => x.Total)
        .Take(top)
        .ToListAsync();

        return Ok(results);
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var donation = await _context.Donations.FindAsync(id);
        if (donation == null) return NotFound();
        _context.Donations.Remove(donation);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
