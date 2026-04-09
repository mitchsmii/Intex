using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using WebApplication1.Data;
using WebApplication1.Services;

namespace WebApplication1.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly UserManager<IdentityUser> _userManager;
    private readonly SignInManager<IdentityUser> _signInManager;
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly AppDbContext _context;
    private readonly IEmailSender _emailSender;

    public AuthController(
        UserManager<IdentityUser> userManager,
        SignInManager<IdentityUser> signInManager,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        AppDbContext context,
        IEmailSender emailSender)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
        _context = context;
        _emailSender = emailSender;
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

        // Check if 2FA is enabled
        if (user.TwoFactorEnabled)
        {
            var code = await _userManager.GenerateTwoFactorTokenAsync(user, "Email");
            await _emailSender.SendAsync(
                user.Email ?? "",
                "Your Cove verification code",
                $"Your 6-digit verification code is: {code}\n\nThis code expires in 10 minutes.");
            return Ok(new { requires2FA = true, userId = user.Id });
        }

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

    [HttpPost("2fa/verify")]
    public async Task<IActionResult> VerifyTwoFactor([FromBody] TwoFactorVerifyRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.UserId) || string.IsNullOrWhiteSpace(request.Code))
            return BadRequest(new { message = "UserId and Code are required." });

        var user = await _userManager.FindByIdAsync(request.UserId);
        if (user == null)
            return Unauthorized(new { message = "Invalid request." });

        var valid = await _userManager.VerifyTwoFactorTokenAsync(user, "Email", request.Code);
        if (!valid)
            return Unauthorized(new { message = "Invalid or expired code." });

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

    [HttpPost("google")]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.IdToken))
            return BadRequest(new { message = "idToken is required." });

        // Validate the Google ID token via Google's tokeninfo endpoint
        var httpClient = _httpClientFactory.CreateClient();
        var response = await httpClient.GetAsync(
            $"https://oauth2.googleapis.com/tokeninfo?id_token={Uri.EscapeDataString(request.IdToken)}");

        if (!response.IsSuccessStatusCode)
            return Unauthorized(new { message = "Invalid Google token." });

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        // Verify audience matches our client ID
        var configuredClientId = _configuration["Google:ClientId"];
        if (root.TryGetProperty("aud", out var audProp))
        {
            var aud = audProp.GetString();
            if (aud != configuredClientId)
                return Unauthorized(new { message = "Token audience mismatch." });
        }
        else
        {
            return Unauthorized(new { message = "Invalid token claims." });
        }

        var email = root.TryGetProperty("email", out var emailProp) ? emailProp.GetString() : null;
        var firstName = root.TryGetProperty("given_name", out var fnProp) ? fnProp.GetString() : null;
        var lastName = root.TryGetProperty("family_name", out var lnProp) ? lnProp.GetString() : null;

        if (string.IsNullOrWhiteSpace(email))
            return BadRequest(new { message = "Google account must have an email address." });

        // Find or create user
        var user = await _userManager.FindByEmailAsync(email);
        if (user == null)
        {
            user = new IdentityUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true
            };
            var createResult = await _userManager.CreateAsync(user);
            if (!createResult.Succeeded)
                return StatusCode(500, new { message = "Failed to create user account." });

            // Add to Donor role
            await _userManager.AddToRoleAsync(user, "Donor");

            // Create a supporter row
            await _context.Database.ExecuteSqlRawAsync(
                "INSERT INTO supporters (supporter_type, first_name, last_name, email, status, created_at) " +
                "VALUES ({0}, {1}, {2}, {3}, {4}, {5})",
                "Individual", firstName ?? "", lastName ?? "", email, "Active", DateTime.UtcNow);
        }

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

public class TwoFactorVerifyRequest
{
    public string UserId { get; set; } = "";
    public string Code { get; set; } = "";
}

public class GoogleLoginRequest
{
    public string IdToken { get; set; } = "";
}
