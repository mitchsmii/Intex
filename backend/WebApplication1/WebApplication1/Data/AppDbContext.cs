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

    // Donation / supporter tables
    public DbSet<Supporter> Supporters { get; set; }
    public DbSet<Donation> Donations { get; set; }
    public DbSet<DonationAllocation> DonationAllocations { get; set; }
    public DbSet<SafehouseMonthlyMetric> SafehouseMonthlyMetrics { get; set; }

    // Case-management tables
    public DbSet<SocialWorker> SocialWorkers { get; set; }
    public DbSet<ProcessRecording> ProcessRecordings { get; set; }
    public DbSet<HomeVisitation> HomeVisitations { get; set; }
    public DbSet<InterventionPlan> InterventionPlans { get; set; }
    public DbSet<IncidentReport> IncidentReports { get; set; }
    public DbSet<EducationRecord> EducationRecords { get; set; }
    public DbSet<HealthWellbeingRecord> HealthWellbeingRecords { get; set; }
    public DbSet<Notification> Notifications { get; set; }
    public DbSet<Assessment> Assessments { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // residents.resident_id uses a PostgreSQL sequence — don't send a value in INSERT
        modelBuilder.Entity<Resident>()
            .Property(r => r.ResidentId)
            .ValueGeneratedOnAdd();

        // sw_notifications.notification_id uses SERIAL
        modelBuilder.Entity<Notification>()
            .Property(n => n.NotificationId)
            .ValueGeneratedOnAdd();

        modelBuilder.Entity<ProcessRecording>()
            .HasIndex(p => p.SocialWorkerId)
            .HasDatabaseName("IX_process_recordings_social_worker_id");

        modelBuilder.Entity<HomeVisitation>()
            .HasIndex(h => h.SocialWorkerId)
            .HasDatabaseName("IX_home_visitations_social_worker_id");

        modelBuilder.Entity<SocialWorker>()
            .HasIndex(s => s.SafehouseId)
            .HasDatabaseName("IX_social_workers_safehouse_id");

        modelBuilder.Entity<Assessment>()
            .Property(a => a.AssessmentId)
            .ValueGeneratedOnAdd();

        modelBuilder.Entity<Assessment>()
            .HasIndex(a => a.ResidentId)
            .HasDatabaseName("ix_assessments_resident_id");
    }
}
