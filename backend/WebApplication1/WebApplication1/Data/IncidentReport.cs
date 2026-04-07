using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication1.Data;

[Table("incident_reports")]
public class IncidentReport
{
    [Key]
    [Column("incident_id")]
    public int IncidentId { get; set; }

    [Column("resident_id")]
    public int? ResidentId { get; set; }

    [Column("reported_by")]
    public string? ReportedBy { get; set; }

    [Column("report_date")]
    public DateOnly? ReportDate { get; set; }

    [Column("incident_type")]
    public string? IncidentType { get; set; }

    [Column("severity")]
    public string? Severity { get; set; }

    [Column("description")]
    public string? Description { get; set; }

    [Column("resolved")]
    public bool? Resolved { get; set; }

    [Column("resolution_notes")]
    public string? ResolutionNotes { get; set; }
}
