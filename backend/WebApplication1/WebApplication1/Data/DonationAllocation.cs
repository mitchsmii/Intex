using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication1.Data;

[Table("donation_allocations")]
public class DonationAllocation
{
    [Key]
    [Column("allocation_id")]
    public int AllocationId { get; set; }

    [Column("donation_id")]
    public int? DonationId { get; set; }

    [Column("program_area")]
    public string? ProgramArea { get; set; }

    [Column("amount_allocated")]
    public decimal? AmountAllocated { get; set; }

    [Column("notes")]
    public string? Notes { get; set; }
}
