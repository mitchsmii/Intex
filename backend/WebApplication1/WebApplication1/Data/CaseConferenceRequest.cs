using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication1.Data;

[Table("case_conference_requests")]
public class CaseConferenceRequest
{
    [Key]
    [Column("request_id")]
    public int RequestId { get; set; }

    /// <summary>JSON array of resident IDs, e.g. [1, 5, 12]</summary>
    [Column("resident_ids")]
    public string ResidentIds { get; set; } = "[]";

    [Column("requested_by")]
    public string? RequestedBy { get; set; }

    [Column("requested_date")]
    public DateOnly? RequestedDate { get; set; }

    [Column("requested_time")]
    public string? RequestedTime { get; set; }

    /// <summary>JSON array of { residentId, notes } per resident</summary>
    [Column("agenda")]
    public string Agenda { get; set; } = "[]";

    /// <summary>Pending | Approved | Rejected | Counter-Proposed | Accepted</summary>
    [Column("status")]
    public string Status { get; set; } = "Pending";

    [Column("admin_notes")]
    public string? AdminNotes { get; set; }

    [Column("counter_date")]
    public DateOnly? CounterDate { get; set; }

    [Column("counter_time")]
    public string? CounterTime { get; set; }

    [Column("reviewed_by")]
    public string? ReviewedBy { get; set; }

    [Column("reviewed_at")]
    public DateTime? ReviewedAt { get; set; }

    [Column("submitted_at")]
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
}
