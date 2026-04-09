using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication1.Data;

[Table("social_media_posts")]
public class SocialMediaPost
{
    [Key]
    [Column("post_id")]
    public int PostId { get; set; }

    /// <summary>Instagram | Facebook | Email</summary>
    [Column("platform")]
    public string Platform { get; set; } = string.Empty;

    [Column("post_date")]
    public DateOnly PostDate { get; set; }

    [Column("caption")]
    public string? Caption { get; set; }

    /// <summary>Space- or comma-separated hashtags (Instagram/Facebook only)</summary>
    [Column("hashtags")]
    public string? Hashtags { get; set; }

    // ── Social reach metrics (Instagram / Facebook) ──────────────────────────
    [Column("reach")]
    public int? Reach { get; set; }

    [Column("likes")]
    public int? Likes { get; set; }

    [Column("comments")]
    public int? Comments { get; set; }

    /// <summary>Saves (Instagram) or Shares (Facebook)</summary>
    [Column("secondary_metric")]
    public int? SecondaryMetric { get; set; }

    /// <summary>"Saves" or "Shares"</summary>
    [Column("secondary_label")]
    public string? SecondaryLabel { get; set; }

    // ── Email campaign metrics ────────────────────────────────────────────────
    [Column("emails_sent")]
    public int? EmailsSent { get; set; }

    [Column("emails_opened")]
    public int? EmailsOpened { get; set; }

    [Column("emails_clicked")]
    public int? EmailsClicked { get; set; }

    [Column("open_rate")]
    public decimal? OpenRate { get; set; }
}
