using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using WebApplication1.Data;
using WebApplication1.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddHttpClient();
builder.Services.AddOpenApi();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<ITokenBlacklist, InMemoryTokenBlacklist>();

// Background service: refresh ML predictions daily at 3 AM UTC
builder.Services.AddHostedService<WebApplication1.Services.MlRefreshService>();

// EF Core + Npgsql
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ASP.NET Identity
builder.Services.AddIdentity<IdentityUser, IdentityRole>(options =>
{
    options.Password.RequiredLength = 14;
    options.Password.RequireUppercase = false;
    options.Password.RequireLowercase = false;
    options.Password.RequireDigit = false;
    options.Password.RequireNonAlphanumeric = false;

    options.Lockout.AllowedForNewUsers = true;
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
})
.AddEntityFrameworkStores<AppDbContext>()
.AddDefaultTokenProviders();

builder.Services.Configure<Microsoft.AspNetCore.Identity.DataProtectionTokenProviderOptions>(o =>
    o.TokenLifespan = TimeSpan.FromMinutes(10));

// JWT
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtKey = Encoding.UTF8.GetBytes(jwtSection["Key"]!);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSection["Issuer"],
        ValidAudience = jwtSection["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(jwtKey)
    };
    options.Events = new JwtBearerEvents
    {
        OnTokenValidated = context =>
        {
            var blacklist = context.HttpContext.RequestServices
                .GetRequiredService<ITokenBlacklist>();
            var jti = context.Principal?.FindFirstValue(JwtRegisteredClaimNames.Jti);
            if (jti != null && blacklist.IsRevoked(jti))
                context.Fail("Token has been revoked.");
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddSingleton<JwtSecurityTokenHandler>();

// Email sender
builder.Services.AddTransient<WebApplication1.Services.IEmailSender, WebApplication1.Services.SmtpEmailSender>();

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
                "http://localhost:5173",
                "http://localhost:5174",
                "http://localhost:5175",
                "http://localhost:5176",
                "http://localhost:3000",
                "https://intex-ochre.vercel.app"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// Rate limiting
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Strict limiter for auth endpoints: 5 attempts per minute per IP
    options.AddFixedWindowLimiter("auth", config =>
    {
        config.PermitLimit = 5;
        config.Window = TimeSpan.FromMinutes(1);
        config.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        config.QueueLimit = 0;
    });

    // Limiter for anonymous public endpoints: 30 requests per minute per IP
    options.AddFixedWindowLimiter("public", config =>
    {
        config.PermitLimit = 30;
        config.Window = TimeSpan.FromMinutes(1);
        config.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        config.QueueLimit = 0;
    });
});

var app = builder.Build();

// Create Identity tables and seed data on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    // Use raw SQL to create Identity tables (bypasses Npgsql/PgBouncer migration bug)
    var conn = db.Database.GetDbConnection();
    await conn.OpenAsync();
    using var cmd = conn.CreateCommand();
    cmd.CommandText = """
        CREATE TABLE IF NOT EXISTS "AspNetRoles" (
            "Id" text NOT NULL, "Name" varchar(256), "NormalizedName" varchar(256),
            "ConcurrencyStamp" text, CONSTRAINT "PK_AspNetRoles" PRIMARY KEY ("Id"));
        CREATE TABLE IF NOT EXISTS "AspNetUsers" (
            "Id" text NOT NULL, "UserName" varchar(256), "NormalizedUserName" varchar(256),
            "Email" varchar(256), "NormalizedEmail" varchar(256), "EmailConfirmed" boolean NOT NULL DEFAULT false,
            "PasswordHash" text, "SecurityStamp" text, "ConcurrencyStamp" text, "PhoneNumber" text,
            "PhoneNumberConfirmed" boolean NOT NULL DEFAULT false, "TwoFactorEnabled" boolean NOT NULL DEFAULT false,
            "LockoutEnd" timestamptz, "LockoutEnabled" boolean NOT NULL DEFAULT false,
            "AccessFailedCount" integer NOT NULL DEFAULT 0,
            CONSTRAINT "PK_AspNetUsers" PRIMARY KEY ("Id"));
        CREATE TABLE IF NOT EXISTS "AspNetRoleClaims" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY, "RoleId" text NOT NULL, "ClaimType" text, "ClaimValue" text,
            CONSTRAINT "PK_AspNetRoleClaims" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_AspNetRoleClaims_AspNetRoles_RoleId" FOREIGN KEY ("RoleId") REFERENCES "AspNetRoles" ("Id") ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS "AspNetUserClaims" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY, "UserId" text NOT NULL, "ClaimType" text, "ClaimValue" text,
            CONSTRAINT "PK_AspNetUserClaims" PRIMARY KEY ("Id"),
            CONSTRAINT "FK_AspNetUserClaims_AspNetUsers_UserId" FOREIGN KEY ("UserId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS "AspNetUserLogins" (
            "LoginProvider" text NOT NULL, "ProviderKey" text NOT NULL, "ProviderDisplayName" text, "UserId" text NOT NULL,
            CONSTRAINT "PK_AspNetUserLogins" PRIMARY KEY ("LoginProvider", "ProviderKey"),
            CONSTRAINT "FK_AspNetUserLogins_AspNetUsers_UserId" FOREIGN KEY ("UserId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS "AspNetUserRoles" (
            "UserId" text NOT NULL, "RoleId" text NOT NULL,
            CONSTRAINT "PK_AspNetUserRoles" PRIMARY KEY ("UserId", "RoleId"),
            CONSTRAINT "FK_AspNetUserRoles_AspNetRoles_RoleId" FOREIGN KEY ("RoleId") REFERENCES "AspNetRoles" ("Id") ON DELETE CASCADE,
            CONSTRAINT "FK_AspNetUserRoles_AspNetUsers_UserId" FOREIGN KEY ("UserId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS "AspNetUserTokens" (
            "UserId" text NOT NULL, "LoginProvider" text NOT NULL, "Name" text NOT NULL, "Value" text,
            CONSTRAINT "PK_AspNetUserTokens" PRIMARY KEY ("UserId", "LoginProvider", "Name"),
            CONSTRAINT "FK_AspNetUserTokens_AspNetUsers_UserId" FOREIGN KEY ("UserId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE);
        CREATE INDEX IF NOT EXISTS "IX_AspNetRoleClaims_RoleId" ON "AspNetRoleClaims" ("RoleId");
        CREATE UNIQUE INDEX IF NOT EXISTS "RoleNameIndex" ON "AspNetRoles" ("NormalizedName");
        CREATE INDEX IF NOT EXISTS "IX_AspNetUserClaims_UserId" ON "AspNetUserClaims" ("UserId");
        CREATE INDEX IF NOT EXISTS "IX_AspNetUserLogins_UserId" ON "AspNetUserLogins" ("UserId");
        CREATE INDEX IF NOT EXISTS "IX_AspNetUserRoles_RoleId" ON "AspNetUserRoles" ("RoleId");
        CREATE INDEX IF NOT EXISTS "EmailIndex" ON "AspNetUsers" ("NormalizedEmail");
        CREATE UNIQUE INDEX IF NOT EXISTS "UserNameIndex" ON "AspNetUsers" ("NormalizedUserName");

        CREATE TABLE IF NOT EXISTS sw_notifications (
            notification_id SERIAL PRIMARY KEY,
            recipient_email VARCHAR(256) NOT NULL,
            message TEXT NOT NULL,
            related_resident_code VARCHAR(50),
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS ix_sw_notifications_recipient ON sw_notifications (recipient_email) WHERE is_read = FALSE;

        -- Sync residents sequence so new INSERTs don't collide with existing rows
        SELECT setval(
            pg_get_serial_sequence('residents', 'resident_id'),
            COALESCE((SELECT MAX(resident_id) FROM residents), 0),
            true
        );
        """;
    await cmd.ExecuteNonQueryAsync();

    // Seed roles and admin user via raw SQL (Identity's SaveChanges hits PgBouncer bugs)
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();

    string[] roles = ["Admin", "Donor", "SocialWorker"];
    foreach (var role in roles)
    {
        if (!await roleManager.RoleExistsAsync(role))
            await roleManager.CreateAsync(new IdentityRole(role));
    }

    // Seed test users (create via Identity, assign roles via raw SQL to dodge PgBouncer bug)
    var seedUsers = new[]
    {
        new { UserName = "admin", Email = "admin@cove.org", Password = builder.Configuration["SeedUsers:Admin:Password"] ?? throw new InvalidOperationException("SeedUsers:Admin:Password is not configured."), Role = "ADMIN" },
        new { UserName = "donor", Email = "donor@cove.org", Password = builder.Configuration["SeedUsers:Donor:Password"] ?? throw new InvalidOperationException("SeedUsers:Donor:Password is not configured."), Role = "DONOR" },
        new { UserName = "socialworker", Email = "sw@cove.org", Password = builder.Configuration["SeedUsers:SocialWorker:Password"] ?? throw new InvalidOperationException("SeedUsers:SocialWorker:Password is not configured."), Role = "SOCIALWORKER" },
    };

    foreach (var seed in seedUsers)
    {
        var existing = await userManager.FindByNameAsync(seed.UserName);
        if (existing == null)
        {
            var newUser = new IdentityUser { UserName = seed.UserName, Email = seed.Email };
            await userManager.CreateAsync(newUser, seed.Password);
            existing = await userManager.FindByNameAsync(seed.UserName);
        }

        if (existing != null)
        {
            using var roleCmd = conn.CreateCommand();
            var pUserId = roleCmd.CreateParameter();
            pUserId.ParameterName = "userId";
            pUserId.Value = existing.Id;
            roleCmd.Parameters.Add(pUserId);
            var pRole = roleCmd.CreateParameter();
            pRole.ParameterName = "roleName";
            pRole.Value = seed.Role;
            roleCmd.Parameters.Add(pRole);
            roleCmd.CommandText = """
                INSERT INTO "AspNetUserRoles" ("UserId", "RoleId")
                SELECT @userId, r."Id"
                FROM "AspNetRoles" r
                WHERE r."NormalizedName" = @roleName
                AND NOT EXISTS (
                    SELECT 1 FROM "AspNetUserRoles" ur
                    WHERE ur."UserId" = @userId AND ur."RoleId" = r."Id"
                )
                """;
            await roleCmd.ExecuteNonQueryAsync();
        }
    }

    await conn.CloseAsync();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    app.UseHsts();
    // Return a plain JSON 500 instead of crashing with no response headers
    app.UseExceptionHandler(err => err.Run(async ctx =>
    {
        ctx.Response.StatusCode  = 500;
        ctx.Response.ContentType = "application/json";
        await ctx.Response.WriteAsync("{\"message\":\"An internal error occurred.\"}");
    }));
}

app.UseCors("AllowFrontend");
app.UseRateLimiter();

// Only redirect to HTTPS in production — in dev the frontend calls http://localhost:5280
// and the self-signed cert would break every request.
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Security headers
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()";
    context.Response.Headers["Content-Security-Policy"] =
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self'; " +
        "img-src 'self' https:; " +
        "font-src 'self'; " +
        "connect-src 'self';";
    await next();
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
