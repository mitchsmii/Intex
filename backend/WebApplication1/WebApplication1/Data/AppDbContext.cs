using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace WebApplication1.Data;

public class AppDbContext : IdentityDbContext<IdentityUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> AppUsers { get; set; }
<<<<<<< Updated upstream
    public DbSet<Resident> Residents { get; set; }
    public DbSet<Safehouse> Safehouses { get; set; }
=======
>>>>>>> Stashed changes
}
