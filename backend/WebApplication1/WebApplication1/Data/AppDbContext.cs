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
    public DbSet<SocialWorker> SocialWorkers { get; set; }
    public DbSet<ProcessRecording> ProcessRecordings { get; set; }
    public DbSet<HomeVisitation> HomeVisitations { get; set; }
    public DbSet<InterventionPlan> InterventionPlans { get; set; }
    public DbSet<IncidentReport> IncidentReports { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<ProcessRecording>()
            .HasIndex(p => p.SocialWorkerId)
            .HasDatabaseName("IX_process_recordings_social_worker_id");

        modelBuilder.Entity<HomeVisitation>()
            .HasIndex(h => h.SocialWorkerId)
            .HasDatabaseName("IX_home_visitations_social_worker_id");

        modelBuilder.Entity<SocialWorker>()
            .HasIndex(s => s.SafehouseId)
            .HasDatabaseName("IX_social_workers_safehouse_id");
    }
}
