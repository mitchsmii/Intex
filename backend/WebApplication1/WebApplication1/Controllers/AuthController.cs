using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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
    private readonly AppDbContext _context;
    private readonly IEmailSender _emailSender;
    private readonly ILogger<AuthController> _logger;
    private readonly ITokenBlacklist _tokenBlacklist;

    public AuthController(
        UserManager<IdentityUser> userManager,
        SignInManager<IdentityUser> signInManager,
        IConfiguration configuration,
        AppDbContext context,
        IEmailSender emailSender,
        ILogger<AuthController> logger,
        ITokenBlacklist tokenBlacklist)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _configuration = configuration;
        _context = context;
        _emailSender = emailSender;
        _logger = logger;
        _tokenBlacklist = tokenBlacklist;
    }

    private static string Sanitize(string? input, int maxLength = 500)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;
        var cleaned = Regex.Replace(input, "<[^>]+>", string.Empty);
        cleaned = cleaned.Trim();
        if (cleaned.Length > maxLength) cleaned = cleaned[..maxLength];
        return cleaned;
    }

    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var username = Sanitize(request.Username);
        var password = Sanitize(request.Password);

        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
            return BadRequest(new { message = "Username and password are required." });

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        var user = await _userManager.FindByNameAsync(username)
            ?? await _userManager.FindByEmailAsync(username);
        if (user == null)
        {
            _logger.LogWarning("Failed login: unknown username {Username} from {IP}", username, ip);
            return Unauthorized(new { message = "Invalid username or password" });
        }

        var result = await _signInManager.CheckPasswordSignInAsync(user, password, lockoutOnFailure: true);
        if (!result.Succeeded)
        {
            if (result.IsLockedOut)
            {
                _logger.LogWarning("Account locked out: {Username} from {IP}", username, ip);
                return Unauthorized(new { message = "Account locked. Try again in 15 minutes." });
            }
            _logger.LogWarning("Failed login: bad password for {Username} from {IP}", username, ip);
            return Unauthorized(new { message = "Invalid username or password" });
        }

        _logger.LogInformation("Successful login: {Username} from {IP}", username, ip);

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
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> VerifyTwoFactor([FromBody] TwoFactorVerifyRequest request)
    {
        var userId = Sanitize(request.UserId);
        var code = Sanitize(request.Code);

        if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(code))
            return BadRequest(new { message = "UserId and Code are required." });

        var user = await _userManager.FindByIdAsync(userId);
        if (user == null)
            return Unauthorized(new { message = "Invalid request." });

        var valid = await _userManager.VerifyTwoFactorTokenAsync(user, "Email", code);
        if (!valid)
        {
            _logger.LogWarning("Failed 2FA attempt for user {UserId} from {IP}",
                userId, HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown");
            return Unauthorized(new { message = "Invalid or expired code." });
        }

        _logger.LogInformation("Successful 2FA verification for user {UserId}", userId);

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

    [HttpPost("register")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var email = Sanitize(request.Email);
        var password = request.Password ?? "";
        var confirmPassword = request.ConfirmPassword ?? "";
        var firstName = Sanitize(request.FirstName);
        var lastName = Sanitize(request.LastName);

        // Validate required fields
        if (string.IsNullOrWhiteSpace(email) ||
            string.IsNullOrWhiteSpace(password) ||
            string.IsNullOrWhiteSpace(confirmPassword) ||
            string.IsNullOrWhiteSpace(firstName) ||
            string.IsNullOrWhiteSpace(lastName))
            return BadRequest(new { message = "All fields are required." });

        // Validate email format
        if (!Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
            return BadRequest(new { message = "Invalid email format." });

        // Validate password length
        if (password.Length < 14)
            return BadRequest(new { message = "Password must be at least 14 characters." });

        // Validate passwords match
        if (password != confirmPassword)
            return BadRequest(new { message = "Passwords do not match." });

        // Check if email already taken
        var existingUser = await _userManager.FindByEmailAsync(email);
        if (existingUser != null)
            return Conflict(new { message = "An account with that email already exists." });

        // Create Identity user
        var user = new IdentityUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true
        };

        var createResult = await _userManager.CreateAsync(user, password);
        if (!createResult.Succeeded)
        {
            var errors = string.Join("; ", createResult.Errors.Select(e => e.Description));
            return BadRequest(new { message = errors });
        }

        // Add to Donor role
        await _userManager.AddToRoleAsync(user, "Donor");

        // Create supporter row (best-effort — don't fail registration if this errors)
        try
        {
            await _context.Database.ExecuteSqlRawAsync(
                "INSERT INTO supporters (supporter_type, first_name, last_name, email, status, created_at) " +
                "VALUES ({0}, {1}, {2}, {3}, {4}, {5})",
                "Individual", firstName, lastName, email, "Active", DateTime.UtcNow);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create supporter row for {Email} — user account still created.", email);
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

    [HttpPost("logout")]
    [Authorize]
    public IActionResult Logout()
    {
        var jti = User.FindFirstValue(JwtRegisteredClaimNames.Jti);
        var expClaim = User.FindFirstValue(JwtRegisteredClaimNames.Exp);

        if (jti != null && long.TryParse(expClaim, out var expUnix))
        {
            var expiry = DateTimeOffset.FromUnixTimeSeconds(expUnix);
            _tokenBlacklist.Revoke(jti, expiry);
        }

        _logger.LogInformation("User {UserId} logged out", User.FindFirstValue(ClaimTypes.NameIdentifier));
        return Ok(new { message = "Logged out successfully." });
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
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
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

public class RegisterRequest
{
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
    public string ConfirmPassword { get; set; } = "";
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
}
