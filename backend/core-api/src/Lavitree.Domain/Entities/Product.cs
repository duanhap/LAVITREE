using System.Collections.Generic;
using Lavitree.Domain.Common;

namespace Lavitree.Domain.Entities;

public class Product : BaseEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ActiveIngredient { get; set; } = string.Empty; // Hoạt chất
    public decimal Price { get; set; }
    public string? ImageUrl { get; set; }
    public string DosageInstruction { get; set; } = string.Empty; // Liều lượng pha bình 16L
    public int StockQuantity { get; set; } = 100;

    // Navigation
    public ICollection<DiseaseProduct> DiseaseProducts { get; set; } = new List<DiseaseProduct>();
    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}
