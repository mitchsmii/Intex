using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication1.Data;

[Table("ml_predictions")]
public class MlPrediction
{
    [Key]
    [Column("prediction_id")]
    public int PredictionId { get; set; }

    [Required]
    [Column("model_name")]
    public string ModelName { get; set; } = string.Empty;

    [Column("entity_id")]
    public int EntityId { get; set; }

    [Column("is_positive")]
    public bool IsPositive { get; set; }

    [Column("probability")]
    public double Probability { get; set; }

    [Column("computed_at")]
    public DateTime ComputedAt { get; set; } = DateTime.UtcNow;
}
