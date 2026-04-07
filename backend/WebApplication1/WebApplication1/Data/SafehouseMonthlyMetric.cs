using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication1.Data;

[Table("safehouse_monthly_metrics")]
public class SafehouseMonthlyMetric
{
    [Key]
    [Column("metric_id")]
    public int MetricId { get; set; }

    [Column("safehouse_id")]
    public int? SafehouseId { get; set; }

    [Column("month")]
    public int? Month { get; set; }

    [Column("year")]
    public int? Year { get; set; }

    [Column("total_expenses")]
    public decimal? TotalExpenses { get; set; }

    [Column("program_expenses")]
    public decimal? ProgramExpenses { get; set; }

    [Column("admin_expenses")]
    public decimal? AdminExpenses { get; set; }

    [Column("occupancy_rate")]
    public decimal? OccupancyRate { get; set; }

    [Column("incident_count")]
    public int? IncidentCount { get; set; }
}
