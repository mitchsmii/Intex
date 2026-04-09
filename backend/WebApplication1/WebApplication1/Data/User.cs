using System.ComponentModel.DataAnnotations.Schema;

namespace WebApplication1.Data;

[Table("users")]
public class User
{
    [Column("id")]
    public int Id { get; set; }

    [Column("first_name")]
    public string FirstName { get; set; } = string.Empty;

    [Column("last_name")]
    public string LastName { get; set; } = string.Empty;
}
