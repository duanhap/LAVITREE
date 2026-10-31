using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Lavitree.Infrastructure.Persistence;

namespace Lavitree.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class MedicinesController : ControllerBase
{
    private readonly LavitreeDbContext _dbContext;

    public MedicinesController(LavitreeDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <summary>
    /// GET /api/v1/medicines/search
    /// Giao ước Ngày Đầu Tiên (Day 1 Contract - SSOT: api-contracts.md Mục 3.4)
    /// Cung cấp dữ liệu thuốc BVTV cho FastMCP Tool query_pesticide_store và Lavitree Store.
    /// </summary>
    [HttpGet("search")]
    public async Task<IActionResult> Search(
        [FromQuery] string? diseaseCode,
        [FromQuery] bool? requireRainResistant,
        [FromQuery] bool allowedOnly = true)
    {
        // 1. Dữ liệu chuẩn mẫu hạt nhân (Tomato___Late_blight & các bệnh lâm sàng demo)
        var sampleMedicines = new List<MedicineItemDto>
        {
            new MedicineItemDto
            {
                Id = 1,
                Name = "Ridomil Gold 68WG",
                ActiveIngredient = "Metalaxyl-M 40g/kg + Mancozeb 640g/kg",
                MedicineType = "Hóa học",
                Price = 65000m,
                DosageInstruction = "Pha 50g cho bình 16L nước, phun ướt đều mặt lá khi bệnh chớm xuất hiện",
                PhiDays = 7,
                IsAllowed = true,
                RainResistant = true,
                StockQuantity = 150,
                ImageUrl = "http://localhost:3000/lavitree-diagnoses/products/ridomil-gold.png",
                TargetDiseases = new List<string> { "Tomato___Late_blight", "Potato___Late_blight" }
            },
            new MedicineItemDto
            {
                Id = 2,
                Name = "Antracol 70WP",
                ActiveIngredient = "Propineb 700g/kg + Kẽm (Zn++)",
                MedicineType = "Hóa học",
                Price = 45000m,
                DosageInstruction = "Pha 40-50g cho bình 16L nước, phun phòng trừ mốc sương và thán thư",
                PhiDays = 7,
                IsAllowed = true,
                RainResistant = false,
                StockQuantity = 120,
                ImageUrl = "http://localhost:3000/lavitree-diagnoses/products/antracol.png",
                TargetDiseases = new List<string> { "Tomato___Late_blight", "Tomato___Early_blight", "Pepper,_bell___Bacterial_spot" }
            },
            new MedicineItemDto
            {
                Id = 3,
                Name = "Chế phẩm sinh học Trichoderma Bacillus",
                ActiveIngredient = "Trichoderma spp. (10^9 CFU/g) + Bacillus subtilis",
                MedicineType = "Sinh học",
                Price = 55000m,
                DosageInstruction = "Pha 30g cho bình 16L nước hoặc tưới gốc đối kháng nấm bệnh",
                PhiDays = 0,
                IsAllowed = true,
                RainResistant = true,
                StockQuantity = 200,
                ImageUrl = "http://localhost:3000/lavitree-diagnoses/products/trichoderma.png",
                TargetDiseases = new List<string> { "Tomato___Late_blight", "Tomato___Early_blight", "Tomato___Target_Spot" }
            },
            new MedicineItemDto
            {
                Id = 4,
                Name = "Thuốc trừ nấm Score 250EC",
                ActiveIngredient = "Difenoconazole 250g/L",
                MedicineType = "Hóa học",
                Price = 85000m,
                DosageInstruction = "Pha 10ml cho bình 16L nước, phun khi vết đốm vừa xuất hiện",
                PhiDays = 14,
                IsAllowed = true,
                RainResistant = true,
                StockQuantity = 80,
                ImageUrl = "http://localhost:3000/lavitree-diagnoses/products/score.png",
                TargetDiseases = new List<string> { "Tomato___Early_blight", "Corn_(maize)___Common_rust_" }
            },
            new MedicineItemDto
            {
                Id = 5,
                Name = "Thuốc trừ nấm cấm Paraquat / 2.4-D Cũ (Đã bị Cục BVTV cấm)",
                ActiveIngredient = "Paraquat Dichloride",
                MedicineType = "Hóa chất cấm",
                Price = 30000m,
                DosageInstruction = "Bị cấm lưu hành, tuyệt đối không sử dụng",
                PhiDays = 999,
                IsAllowed = false, // Dùng để kiểm thử Hard Guardrail lọc thuốc cấm
                RainResistant = false,
                StockQuantity = 0,
                ImageUrl = "",
                TargetDiseases = new List<string> { "Tomato___Late_blight" }
            }
        };

        // 2. Nếu CSDL đã có sản phẩm thật trong bảng Products, đồng bộ dữ liệu
        try
        {
            var dbProducts = await _dbContext.Products
                .Include(p => p.DiseaseProducts)
                    .ThenInclude(dp => dp.Disease)
                .AsNoTracking()
                .ToListAsync();

            if (dbProducts.Any())
            {
                foreach (var p in dbProducts)
                {
                    var existing = sampleMedicines.FirstOrDefault(m => m.Name.Equals(p.Name, StringComparison.OrdinalIgnoreCase));
                    if (existing != null)
                    {
                        existing.Id = p.Id;
                        existing.Price = p.Price;
                        existing.StockQuantity = p.StockQuantity;
                        if (!string.IsNullOrWhiteSpace(p.ImageUrl)) existing.ImageUrl = p.ImageUrl;
                        if (!string.IsNullOrWhiteSpace(p.DosageInstruction)) existing.DosageInstruction = p.DosageInstruction;
                    }
                }
            }
        }
        catch
        {
            // Fallback âm thầm sử dụng danh mục mẫu nếu CSDL đang khởi động
        }

        // 3. Áp dụng các bộ lọc nghiệp vụ
        var query = sampleMedicines.AsQueryable();

        if (!string.IsNullOrWhiteSpace(diseaseCode))
        {
            query = query.Where(m => m.TargetDiseases.Any(d => d.Equals(diseaseCode, StringComparison.OrdinalIgnoreCase)));
        }

        if (requireRainResistant.HasValue && requireRainResistant.Value)
        {
            query = query.Where(m => m.RainResistant);
        }

        if (allowedOnly)
        {
            query = query.Where(m => m.IsAllowed);
        }

        var items = query.ToList();

        return Ok(new
        {
            total = items.Count,
            disease_code = diseaseCode ?? "ALL",
            items
        });
    }

    public class MedicineItemDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string ActiveIngredient { get; set; } = string.Empty;
        public string MedicineType { get; set; } = "Hóa học";
        public decimal Price { get; set; }
        public string DosageInstruction { get; set; } = string.Empty;
        public int PhiDays { get; set; } = 7;
        public bool IsAllowed { get; set; } = true;
        public bool RainResistant { get; set; } = false;
        public int StockQuantity { get; set; } = 100;
        public string ImageUrl { get; set; } = string.Empty;
        public List<string> TargetDiseases { get; set; } = new();
    }
}
