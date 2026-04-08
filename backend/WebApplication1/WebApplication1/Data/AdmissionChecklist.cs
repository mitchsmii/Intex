using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication1.Data;

[Table("admission_checklists")]
public class AdmissionChecklist
{
    [Key]
    [Column("checklist_id")]
    public int ChecklistId { get; set; }

    [Column("resident_id")]
    public int ResidentId { get; set; }

    [Column("resident_code")]
    public string? ResidentCode { get; set; }

    [Column("social_worker_email")]
    public string? SocialWorkerEmail { get; set; }

    [Column("resident_in_facility")]
    public bool ResidentInFacility { get; set; }

    /// <summary>JSON array of checked item labels, e.g. ["Intake form signed", "Room assigned"]</summary>
    [Column("checked_items")]
    public string CheckedItems { get; set; } = "[]";

    /// <summary>Pending | Approved | Rejected</summary>
    [Column("status")]
    public string Status { get; set; } = "Pending";

    [Column("submitted_at")]
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;

    [Column("reviewed_at")]
    public DateTime? ReviewedAt { get; set; }

    [Column("reviewed_by")]
    public string? ReviewedBy { get; set; }

    [Column("admin_notes")]
    public string? AdminNotes { get; set; }
}
