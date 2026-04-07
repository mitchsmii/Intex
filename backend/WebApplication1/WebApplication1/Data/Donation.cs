using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication1.Data;

[Table("donations")]
public class Donation
{
    [Key]
    [Column("donation_id")]
    public int DonationId { get; set; }

    [Column("supporter_id")]
    public int? SupporterId { get; set; }

    [Column("amount")]
    public decimal? Amount { get; set; }

    [Column("donation_date")]
    public DateTime? DonationDate { get; set; }

    [Column("is_recurring")]
    public bool? IsRecurring { get; set; }

    [Column("frequency")]
    public string? Frequency { get; set; }

    [Column("currency")]
    public string? Currency { get; set; }

    [Column("payment_method")]
    public string? PaymentMethod { get; set; }

    [Column("payment_reference")]
    public string? PaymentReference { get; set; }

    [Column("notes")]
    public string? Notes { get; set; }
}
