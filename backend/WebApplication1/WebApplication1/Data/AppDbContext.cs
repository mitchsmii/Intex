using Microsoft.EntityFrameworkCore;

namespace WebApplication1.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<Resident> Residents { get; set; }
    public DbSet<Safehouse> Safehouses { get; set; }
}
