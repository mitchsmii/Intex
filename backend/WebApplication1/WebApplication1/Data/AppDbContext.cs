using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace WebApplication1.Data;

public class AppDbContext : IdentityDbContext<IdentityUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> AppUsers { get; set; }
    public DbSet<Resident> Residents { get; set; }
    public DbSet<Safehouse> Safehouses { get; set; }
    public DbSet<Supporter> Supporters { get; set; }
    public DbSet<Donation> Donations { get; set; }
    public DbSet<DonationAllocation> DonationAllocations { get; set; }
    public DbSet<SafehouseMonthlyMetric> SafehouseMonthlyMetrics { get; set; }
    public DbSet<IncidentReport> IncidentReports { get; set; }
    public DbSet<InterventionPlan> InterventionPlans { get; set; }
}
