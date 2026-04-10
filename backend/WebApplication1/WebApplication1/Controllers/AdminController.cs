using System.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<AdminController> _logger;
    private readonly UserManager<IdentityUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly IConfiguration _configuration;

    public AdminController(
        AppDbContext context,
        ILogger<AdminController> logger,
        UserManager<IdentityUser> userManager,
        RoleManager<IdentityRole> roleManager,
        IConfiguration configuration)
    {
        _context = context;
        _logger = logger;
        _userManager = userManager;
        _roleManager = roleManager;
        _configuration = configuration;
    }

    // POST /api/admin/seed-social-worker-users
    // Creates one AspNet user per row in social_workers, username = full_name (e.g. "SW-01"),
    // password from config, role = "SocialWorker". Idempotent — skips existing usernames.
    [HttpPost("seed-social-worker-users")]
    public async Task<IActionResult> SeedSocialWorkerUsers()
    {
        var defaultPassword = _configuration["SeedUsers:SocialWorker:Password"]
                              ?? throw new InvalidOperationException("SeedUsers:SocialWorker:Password is not configured.");
        const string roleName = "SocialWorker";

        if (!await _roleManager.RoleExistsAsync(roleName))
            await _roleManager.CreateAsync(new IdentityRole(roleName));

        var workers = await _context.SocialWorkers
            .Where(s => s.Status == "Active" && s.FullName != null)
            .ToListAsync();

        var created = new List<string>();
        var skipped = new List<string>();
        var failed = new List<object>();

        foreach (var sw in workers)
        {
            var username = sw.FullName.Trim();
            if (string.IsNullOrEmpty(username)) continue;

            var existing = await _userManager.FindByNameAsync(username);
            if (existing != null)
            {
                if (!await _userManager.IsInRoleAsync(existing, roleName))
                    await _userManager.AddToRoleAsync(existing, roleName);
                skipped.Add(username);
                continue;
            }

            var user = new IdentityUser
            {
                UserName = username,
                Email = $"{username.ToLower()}@cove.local",
                EmailConfirmed = true,
            };

            var result = await _userManager.CreateAsync(user, defaultPassword);
            if (!result.Succeeded)
            {
                failed.Add(new { username, errors = result.Errors.Select(e => e.Description) });
                continue;
            }

            await _userManager.AddToRoleAsync(user, roleName);
            created.Add(username);
        }

        return Ok(new
        {
            created,
            skipped,
            failed,
            note = "Login with username=SW-XX (matching social_workers.full_name)."
        });
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
                var p = cmd.CreateParameter();
                p.ParameterName = "code";
                p.Value = code;
                cmd.Parameters.Add(p);
                cmd.CommandText = """
                    INSERT INTO social_workers (full_name, status, created_at, updated_at)
                    SELECT @code, 'Active', NOW(), NOW()
                    WHERE NOT EXISTS (
                        SELECT 1 FROM social_workers WHERE LOWER(TRIM(full_name)) = LOWER(@code)
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
            return StatusCode(500, new { message = "Backfill failed. Check server logs for details." });
        }
    }
}
