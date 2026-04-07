using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication1.Data;

[Table("intervention_plans")]
public class InterventionPlan
{
    [Key]
    [Column("plan_id")]
    public int PlanId { get; set; }

    [Column("resident_id")]
    public int? ResidentId { get; set; }

    [Column("created_by")]
    public string? CreatedBy { get; set; }

    [Column("start_date")]
    public DateOnly? StartDate { get; set; }

    [Column("end_date")]
    public DateOnly? EndDate { get; set; }

    [Column("goals")]
    public string? Goals { get; set; }

    [Column("status")]
    public string? Status { get; set; }

    [Column("notes")]
    public string? Notes { get; set; }
}
