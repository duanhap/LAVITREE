using System.Collections.Generic;
using Lavitree.Domain.Common;

namespace Lavitree.Domain.Entities;

public class Product : BaseEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ActiveIngredient { get; set; } // Hoạt chất (cho phép null nếu là Vật tư canh tác)
    public decimal Price { get; set; }
    public string? ImageUrl { get; set; }
    public string DosageInstruction { get; set; } = string.Empty; // Liều lượng pha bình 16L
    public int StockQuantity { get; set; } = 100;

    // Thuộc tính bảo vệ thực vật & thời gian cách ly (SSOT: api-contracts.md, sprint-02.md & task-15 v2)
    public int? PhiDays { get; set; } // Thời gian cách ly trước thu hoạch (ngày, bắt buộc với thuốc, null với vật tư)
    public bool IsAllowed { get; set; } = true; // Lưu hành theo danh mục Cục BVTV
    public bool RainResistant { get; set; } = false; // Chống mưa rửa trôi
    public string MedicineType { get; set; } = "Hóa học"; // "Hóa học", "Sinh học" hoặc "Vật tư canh tác"
    public string Availability { get; set; } = "IN_STOCK"; // "IN_STOCK", "OUT_OF_STOCK", "NOT_SOLD"
    public string? InfoSourceUrl { get; set; } // Link nguồn tra cứu thông số/nhãn thuốc BVTV

    // Navigation
    public ICollection<DiseaseProduct> DiseaseProducts { get; set; } = new List<DiseaseProduct>();
    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
    public ICollection<ProductSuggestion> ProductSuggestions { get; set; } = new List<ProductSuggestion>();
}
