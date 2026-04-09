using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using WebApplication1.Data;

namespace WebApplication1.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly UserManager<IdentityUser> _userManager;
    private readonly SignInManager<IdentityUser> _signInManager;
    private readonly IConfiguration _configuration;
    private readonly AppDbContext _context;
    private readonly IHttpClientFactory _httpClientFactory;

    public AuthController(
        UserManager<IdentityUser> userManager,
        SignInManager<IdentityUser> signInManager,
        IConfiguration configuration,
        AppDbContext context,
        IHttpClientFactory httpClientFactory)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _configuration = configuration;
        _context = context;
        _httpClientFactory = httpClientFactory;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Username and password are required." });

        var user = await _userManager.FindByNameAsync(request.Username);
        if (user == null)
            return Unauthorized(new { message = "Invalid username or password" });

        var result = await _signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: false);
        if (!result.Succeeded)
            return Unauthorized(new { message = "Invalid username or password" });

        var roles = await _userManager.GetRolesAsync(user);
        var token = GenerateJwtToken(user, roles);

        return Ok(new
        {
            token,
            user = new
            {
                id = user.Id,
                username = user.UserName,
                email = user.Email,
                roles
            }
        });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId == null)
            return Unauthorized(new { message = "Invalid token" });

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null)
            return Unauthorized(new { message = "User not found" });

        var roles = await _userManager.GetRolesAsync(user);

        return Ok(new
        {
            id = user.Id,
            username = user.UserName,
            email = user.Email,
            roles
        });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Email and password are required." });

        var existing = await _userManager.FindByEmailAsync(request.Email);
        if (existing != null)
            return Conflict(new { message = "An account with this email already exists." });

        var user = new IdentityUser
        {
            UserName = request.Email,
            Email = request.Email,
            EmailConfirmed = true
        };

        var result = await _userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            var errors = result.Errors.Select(e => e.Description);
            return BadRequest(new { message = string.Join(" ", errors) });
        }

        await _userManager.AddToRoleAsync(user, "Donor");

        // Create supporter row using raw SQL — avoids EF Core RETURNING clause that breaks PgBouncer
        await _context.Database.ExecuteSqlRawAsync(
            "INSERT INTO supporters (supporter_type, first_name, last_name, email, phone, status, created_at) " +
            "VALUES ({0}, {1}, {2}, {3}, {4}, {5}, {6})",
            "Individual",
            request.FirstName?.Trim() ?? "",
            request.LastName?.Trim() ?? "",
            request.Email,
            request.Phone?.Trim() ?? "",
            "Active",
            DateTime.UtcNow);

        var roles = await _userManager.GetRolesAsync(user);
        var token = GenerateJwtToken(user, roles);

        return Ok(new
        {
            token,
            user = new { id = user.Id, username = user.UserName, email = user.Email, roles }
        });
    }

    [HttpPost("google")]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.IdToken))
            return BadRequest(new { message = "ID token is required." });

        // Validate with Google tokeninfo endpoint
        var client = _httpClientFactory.CreateClient();
        var response = await client.GetAsync(
            $"https://oauth2.googleapis.com/tokeninfo?id_token={Uri.EscapeDataString(request.IdToken)}");

        if (!response.IsSuccessStatusCode)
            return Unauthorized(new { message = "Invalid Google token." });

        var json = await response.Content.ReadAsStringAsync();
        var payload = JsonSerializer.Deserialize<JsonElement>(json);

        var clientId = _configuration["Google:ClientId"];
        var aud = payload.GetProperty("aud").GetString();
        if (aud != clientId)
            return Unauthorized(new { message = "Token audience mismatch." });

        var email = payload.GetProperty("email").GetString()!;
        var firstName = payload.TryGetProperty("given_name", out var gn) ? gn.GetString() : null;
        var lastName  = payload.TryGetProperty("family_name", out var fn) ? fn.GetString() : null;

        // Find or create Identity user
        var user = await _userManager.FindByEmailAsync(email);
        if (user == null)
        {
            user = new IdentityUser { UserName = email, Email = email, EmailConfirmed = true };
            var createResult = await _userManager.CreateAsync(user);
            if (!createResult.Succeeded)
                return StatusCode(500, new { message = "Failed to create user." });

            await _userManager.AddToRoleAsync(user, "Donor");

            // Create supporter row using raw SQL — avoids EF Core RETURNING clause that breaks PgBouncer
            await _context.Database.ExecuteSqlRawAsync(
                "INSERT INTO supporters (supporter_type, first_name, last_name, email, status, created_at) " +
                "VALUES ({0}, {1}, {2}, {3}, {4}, {5})",
                "Individual",
                firstName ?? "",
                lastName ?? "",
                email,
                "Active",
                DateTime.UtcNow);
        }
        else
        {
            // Ensure existing user has Donor role (guards against partial registrations)
            if (!await _userManager.IsInRoleAsync(user, "Donor"))
                await _userManager.AddToRoleAsync(user, "Donor");
        }

        var roles = await _userManager.GetRolesAsync(user);
        var token = GenerateJwtToken(user, roles);

        return Ok(new
        {
            token,
            user = new { id = user.Id, username = user.UserName, email = user.Email, roles }
        });
    }

    private string GenerateJwtToken(IdentityUser user, IList<string> roles)
    {
        var jwtSection = _configuration.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSection["Key"]!));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.UserName ?? string.Empty),
            new(ClaimTypes.Email, user.Email ?? string.Empty)
        };

        foreach (var role in roles)
            claims.Add(new Claim(ClaimTypes.Role, role));

        var token = new JwtSecurityToken(
            issuer: jwtSection["Issuer"],
            audience: jwtSection["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class RegisterRequest
{
    public string Email     { get; set; } = string.Empty;
    public string Password  { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName  { get; set; }
    public string? Phone     { get; set; }
}

public class GoogleLoginRequest
{
    public string IdToken { get; set; } = string.Empty;
}
