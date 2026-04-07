using System.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

// TEMPORARY: This controller contains a one-time backfill endpoint.
// Protect with [Authorize(Roles = "Admin")] before production use.
[ApiController]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<AdminController> _logger;

    public AdminController(AppDbContext context, ILogger<AdminController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpPost("backfill-social-workers")]
    public async Task<IActionResult> BackfillSocialWorkers()
    {
        try
        {
            var conn = _context.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open)
                await conn.OpenAsync();

            // Step 1: Collect distinct SW codes from both tables
            var allCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = """
                    SELECT DISTINCT TRIM(social_worker) FROM process_recordings
                    WHERE social_worker IS NOT NULL AND TRIM(social_worker) != ''
                    UNION
                    SELECT DISTINCT TRIM(social_worker) FROM home_visitations
                    WHERE social_worker IS NOT NULL AND TRIM(social_worker) != ''
                    """;
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                    allCodes.Add(reader.GetString(0));
            }

            _logger.LogInformation("Found {Count} distinct social worker codes", allCodes.Count);

            // Step 2: Insert new social workers (skip existing)
            int inserted = 0;
            foreach (var code in allCodes)
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = $"""
                    INSERT INTO social_workers (full_name, status, created_at, updated_at)
                    SELECT '{code.Replace("'", "''")}', 'Active', NOW(), NOW()
                    WHERE NOT EXISTS (
                        SELECT 1 FROM social_workers WHERE LOWER(TRIM(full_name)) = LOWER('{code.Replace("'", "''")}')
                    )
                    """;
                var rows = await cmd.ExecuteNonQueryAsync();
                if (rows > 0) inserted++;
            }

            _logger.LogInformation("Inserted {Count} new social worker records", inserted);

            // Step 3: Update process_recordings FK
            int prUpdated;
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = """
                    UPDATE process_recordings pr
                    SET social_worker_id = sw.social_worker_id
                    FROM social_workers sw
                    WHERE LOWER(TRIM(pr.social_worker)) = LOWER(TRIM(sw.full_name))
                    AND pr.social_worker_id IS NULL
                    AND pr.social_worker IS NOT NULL
                    """;
                prUpdated = await cmd.ExecuteNonQueryAsync();
            }

            // Step 4: Update home_visitations FK
            int hvUpdated;
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = """
                    UPDATE home_visitations hv
                    SET social_worker_id = sw.social_worker_id
                    FROM social_workers sw
                    WHERE LOWER(TRIM(hv.social_worker)) = LOWER(TRIM(sw.full_name))
                    AND hv.social_worker_id IS NULL
                    AND hv.social_worker IS NOT NULL
                    """;
                hvUpdated = await cmd.ExecuteNonQueryAsync();
            }

            _logger.LogInformation("Linked {PrCount} process recordings, {HvCount} home visitations",
                prUpdated, hvUpdated);

            return Ok(new
            {
                socialWorkersInserted = inserted,
                processRecordingsLinked = prUpdated,
                homeVisitationsLinked = hvUpdated,
                totalCodesFound = allCodes.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Backfill failed");
            return StatusCode(500, new { message = "Backfill failed", error = ex.Message });
        }
    }
}
