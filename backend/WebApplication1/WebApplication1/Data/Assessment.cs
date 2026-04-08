using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication1.Data;

[Table("assessments")]
public class Assessment
{
    [Key]
    [Column("assessment_id")]
    public int AssessmentId { get; set; }

    [Column("resident_id")]
    public int ResidentId { get; set; }

    [Column("instrument")]
    public string Instrument { get; set; } = string.Empty;

    [Column("administered_date")]
    public DateOnly AdministeredDate { get; set; }

    [Column("administered_by")]
    public string AdministeredBy { get; set; } = string.Empty;

    [Column("total_score")]
    public decimal? TotalScore { get; set; }

    [Column("tick_count")]
    public int? TickCount { get; set; }

    [Column("severity_band")]
    public string? SeverityBand { get; set; }

    [Column("responses_json", TypeName = "jsonb")]
    public string? ResponsesJson { get; set; }

    [Column("worst_event")]
    public string? WorstEvent { get; set; }

    [Column("immediate_action")]
    public string? ImmediateAction { get; set; }

    [Column("observation_notes")]
    public string? ObservationNotes { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
