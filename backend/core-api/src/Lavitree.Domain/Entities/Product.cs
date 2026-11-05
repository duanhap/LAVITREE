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

    // Thuộc tính bảo vệ thực vật & thời gian cách ly (SSOT: api-contracts.md & sprint-02.md)
    public int PhiDays { get; set; } = 7; // Thời gian cách ly trước thu hoạch (ngày)
    public bool IsAllowed { get; set; } = true; // Lưu hành theo danh mục Cục BVTV
    public bool RainResistant { get; set; } = false; // Chống mưa rửa trôi
    public string MedicineType { get; set; } = "Hóa học"; // "Hóa học" hoặc "Sinh học"

    // Navigation
    public ICollection<DiseaseProduct> DiseaseProducts { get; set; } = new List<DiseaseProduct>();
    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}
