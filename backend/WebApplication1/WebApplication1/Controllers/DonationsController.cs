using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DonationsController : ControllerBase
{
    private readonly AppDbContext _context;
    public DonationsController(AppDbContext context) => _context = context;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
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
                    : (s.IsAnonymous == true ? "Anonymous"
                        : (s.FirstName + " " + s.LastName).Trim()),
                d.Amount,
                d.DonationDate,
                d.IsRecurring,
                d.Frequency,
                d.Currency,
                d.PaymentMethod,
                d.Notes,
            }
        ).ToListAsync();

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
            group new { d, s } by new { d.SupporterId, s.FirstName, s.LastName, s.IsAnonymous, d.IsRecurring } into g
            select new
            {
                SupporterId = g.Key.SupporterId,
                Name = g.Key.IsAnonymous == true ? "Anonymous"
                    : (g.Key.FirstName + " " + g.Key.LastName).Trim(),
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
}
