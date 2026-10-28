using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Lavitree.Domain.Entities;

namespace Lavitree.Infrastructure.Persistence;

public static class LavitreeDbContextSeeder
{
    public static async Task SeedAsync(LavitreeDbContext context, string? customSeedPath = null)
    {
        var seedDir = ResolveSeedDirectory(customSeedPath);
        if (seedDir == null || !Directory.Exists(seedDir))
        {
            Console.WriteLine($"[Seeder] WARNING: Seed directory not found. Searched base: {AppContext.BaseDirectory}");
            return;
        }

        Console.WriteLine($"[Seeder] Using seed data from: {seedDir}");

        // 1. Seed PlantCategories (14 categories)
        var classCsvPath = Path.Combine(seedDir, "Lavitree_Selected_Classes.csv");
        if (File.Exists(classCsvPath))
        {
            await SeedPlantCategoriesAndDiseasesAsync(context, classCsvPath);
        }
        else
        {
            Console.WriteLine($"[Seeder] WARNING: File {classCsvPath} not found.");
        }

        // 2. Seed KnowledgeSources (Idempotent: Only seed if completely empty to avoid 112 -> 224 duplicate)
        var knowledgeCsvPath = Path.Combine(seedDir, "KnowledgeSources_rows.csv");
        if (File.Exists(knowledgeCsvPath))
        {
            await SeedKnowledgeSourcesAsync(context, knowledgeCsvPath);
        }

        // 3. Seed Sample TreatmentPlans and Products (Tomato___Late_blight)
        var treatmentJsonPath = Path.Combine(seedDir, "sample_treatment_seed.json");
        await SeedTreatmentPlansAndProductsAsync(context, treatmentJsonPath);

        Console.WriteLine("[Seeder] Database seeding completed successfully.");
    }

    private static async Task SeedPlantCategoriesAndDiseasesAsync(LavitreeDbContext context, string csvPath)
    {
        var lines = await File.ReadAllLinesAsync(csvPath, Encoding.UTF8);
        if (lines.Length <= 1) return;

        var header = ParseCsvLine(lines[0]);
        int colClassId = header.IndexOf("Class_ID");
        int colModelClass = header.IndexOf("Model_Class");
        int colTenCay = header.IndexOf("Ten_Cay_VN");
        int colTenBenh = header.IndexOf("Ten_Benh_VN");
        int colLoai = header.IndexOf("Loai");
        int colCaptureTip = header.IndexOf("Capture_Tip");

        if (colModelClass == -1 || colTenCay == -1)
        {
            Console.WriteLine("[Seeder] ERROR: CSV format unexpected in Lavitree_Selected_Classes.csv");
            return;
        }

        var rows = new List<Dictionary<string, string>>();
        for (int i = 1; i < lines.Length; i++)
        {
            var line = lines[i].Trim();
            if (string.IsNullOrWhiteSpace(line)) continue;
            var parts = ParseCsvLine(line);
            if (parts.Count <= colModelClass || parts.Count <= colTenCay) continue;

            var d = new Dictionary<string, string>
            {
                ["Class_ID"] = colClassId >= 0 && parts.Count > colClassId ? parts[colClassId] : "",
                ["Model_Class"] = parts[colModelClass],
                ["Ten_Cay_VN"] = parts[colTenCay],
                ["Ten_Benh_VN"] = colTenBenh >= 0 && parts.Count > colTenBenh ? parts[colTenBenh] : parts[colModelClass],
                ["Loai"] = colLoai >= 0 && parts.Count > colLoai ? parts[colLoai] : "Bệnh",
                ["Capture_Tip"] = colCaptureTip >= 0 && parts.Count > colCaptureTip ? parts[colCaptureTip] : ""
            };
            rows.Add(d);
        }

        // 1.1. Seed PlantCategories (Unique by Name)
        var uniquePlants = rows.Select(r => r["Ten_Cay_VN"]).Distinct().OrderBy(p => p).ToList();
        var existingCategories = await context.PlantCategories.ToDictionaryAsync(p => p.Name);

        bool categoryAdded = false;
        foreach (var plantName in uniquePlants)
        {
            if (!existingCategories.ContainsKey(plantName))
            {
                var newCat = new PlantCategory
                {
                    Name = plantName,
                    ScientificName = GetScientificName(plantName),
                    IconUrl = $"/icons/plants/{Slugify(plantName)}.png",
                    CreatedAt = DateTime.UtcNow
                };
                context.PlantCategories.Add(newCat);
                existingCategories[plantName] = newCat;
                categoryAdded = true;
                Console.WriteLine($"[Seeder] Adding PlantCategory: {plantName}");
            }
        }

        if (categoryAdded)
        {
            await context.SaveChangesAsync();
            // Refresh dictionary with DB IDs
            existingCategories = await context.PlantCategories.ToDictionaryAsync(p => p.Name);
        }

        // 1.2. Seed Diseases (40 classes, Unique by ClassCode)
        var existingDiseases = await context.Diseases.ToDictionaryAsync(d => d.ClassCode);
        bool diseaseAdded = false;

        foreach (var row in rows)
        {
            var classCode = row["Model_Class"];
            if (!existingDiseases.ContainsKey(classCode))
            {
                var plantName = row["Ten_Cay_VN"];
                if (!existingCategories.TryGetValue(plantName, out var plantCat)) continue;

                var loai = row["Loai"];
                var captureTip = row["Capture_Tip"];
                var tenBenh = row["Ten_Benh_VN"];

                string pathogenType;
                if (loai.Equals("Khỏe", StringComparison.OrdinalIgnoreCase))
                {
                    pathogenType = "Khỏe mạnh";
                }
                else if (classCode.Contains("Bacterial", StringComparison.OrdinalIgnoreCase))
                {
                    pathogenType = "Vi khuẩn";
                }
                else if (classCode.Contains("virus", StringComparison.OrdinalIgnoreCase))
                {
                    pathogenType = "Virus";
                }
                else if (classCode.Contains("mites", StringComparison.OrdinalIgnoreCase))
                {
                    pathogenType = "Nhện hại";
                }
                else
                {
                    pathogenType = "Nấm";
                }

                var disease = new Disease
                {
                    PlantId = plantCat.Id,
                    ClassCode = classCode,
                    CommonNameVi = tenBenh,
                    PathogenType = pathogenType,
                    Symptoms = string.IsNullOrWhiteSpace(captureTip)
                        ? $"Triệu chứng điển hình của {tenBenh} trên cây {plantName}."
                        : captureTip,
                    Prevention = "Áp dụng biện pháp canh tác và quản lý dịch hại tổng hợp (IPM), kiểm tra vườn thường xuyên.",
                    SeverityLevel = loai.Equals("Khỏe", StringComparison.OrdinalIgnoreCase) ? 1 : 2,
                    CreatedAt = DateTime.UtcNow
                };

                context.Diseases.Add(disease);
                existingDiseases[classCode] = disease;
                diseaseAdded = true;
                Console.WriteLine($"[Seeder] Adding Disease: {classCode} ({tenBenh})");
            }
        }

        if (diseaseAdded)
        {
            await context.SaveChangesAsync();
        }
    }

    private static async Task SeedKnowledgeSourcesAsync(LavitreeDbContext context, string csvPath)
    {
        // IDEMPOTENT CHECK: If table already has records (e.g. 112 from previous import), DO NOT insert to avoid duplicates!
        if (await context.KnowledgeSources.AnyAsync())
        {
            Console.WriteLine("[Seeder] KnowledgeSources table already contains records. Skipping to prevent duplication (Idempotent Gate).");
            return;
        }

        Console.WriteLine("[Seeder] KnowledgeSources table is empty. Seeding from CSV while preserving original GUIDs...");
        var lines = await File.ReadAllLinesAsync(csvPath, Encoding.UTF8);
        if (lines.Length <= 1) return;

        var header = ParseCsvLine(lines[0]);
        int idxId = header.IndexOf("Id");
        int idxModelClass = header.IndexOf("ModelClass");
        int idxPlantName = header.IndexOf("PlantName");
        int idxDiseaseName = header.IndexOf("DiseaseName");
        int idxSourceUrl = header.IndexOf("SourceUrl");
        int idxSourceTitle = header.IndexOf("SourceTitle");
        int idxOrg = header.IndexOf("Organization");
        int idxEvidence = header.IndexOf("EvidenceText");
        int idxContentType = header.IndexOf("ContentType");
        int idxQuality = header.IndexOf("SourceQuality");
        int idxApproved = header.IndexOf("IsManualApproved");
        int idxNotes = header.IndexOf("ReviewerNotes");
        int idxMatchLevel = header.IndexOf("MatchLevel");
        int idxPubDate = header.IndexOf("PublishedDate");
        int idxScope = header.IndexOf("SourceScope");
        int idxCultivation = header.IndexOf("HasCultivationTechnique");

        var sourcesToInsert = new List<KnowledgeSource>();

        for (int i = 1; i < lines.Length; i++)
        {
            var line = lines[i].Trim();
            if (string.IsNullOrWhiteSpace(line)) continue;
            var p = ParseCsvLine(line);
            if (p.Count < 5) continue;

            Guid id = Guid.NewGuid();
            if (idxId >= 0 && idxId < p.Count && Guid.TryParse(p[idxId], out var parsedId))
            {
                id = parsedId;
            }

            var ks = new KnowledgeSource
            {
                Id = id,
                ModelClass = idxModelClass >= 0 && idxModelClass < p.Count ? p[idxModelClass] : "",
                PlantName = idxPlantName >= 0 && idxPlantName < p.Count ? p[idxPlantName] : "",
                DiseaseName = idxDiseaseName >= 0 && idxDiseaseName < p.Count ? p[idxDiseaseName] : "",
                SourceUrl = idxSourceUrl >= 0 && idxSourceUrl < p.Count ? p[idxSourceUrl] : "",
                SourceTitle = idxSourceTitle >= 0 && idxSourceTitle < p.Count ? p[idxSourceTitle] : "",
                Organization = idxOrg >= 0 && idxOrg < p.Count ? p[idxOrg] : "",
                EvidenceText = idxEvidence >= 0 && idxEvidence < p.Count ? p[idxEvidence] : "",
                ContentType = idxContentType >= 0 && idxContentType < p.Count ? p[idxContentType] : "Triệu chứng & Biện pháp",
                SourceQuality = idxQuality >= 0 && idxQuality < p.Count ? p[idxQuality] : "Cao",
                IsManualApproved = idxApproved >= 0 && idxApproved < p.Count && (p[idxApproved].Equals("true", StringComparison.OrdinalIgnoreCase) || p[idxApproved] == "1"),
                ReviewerNotes = idxNotes >= 0 && idxNotes < p.Count ? p[idxNotes] : null,
                MatchLevel = idxMatchLevel >= 0 && idxMatchLevel < p.Count ? p[idxMatchLevel] : "Khớp trực tiếp",
                PublishedDate = idxPubDate >= 0 && idxPubDate < p.Count ? p[idxPubDate] : "",
                SourceScope = idxScope >= 0 && idxScope < p.Count ? p[idxScope] : "Việt Nam",
                HasCultivationTechnique = idxCultivation >= 0 && idxCultivation < p.Count && (p[idxCultivation].Equals("true", StringComparison.OrdinalIgnoreCase) || p[idxCultivation] == "1"),
                CreatedAt = DateTime.UtcNow
            };
            sourcesToInsert.Add(ks);
        }

        if (sourcesToInsert.Count > 0)
        {
            await context.KnowledgeSources.AddRangeAsync(sourcesToInsert);
            await context.SaveChangesAsync();
            Console.WriteLine($"[Seeder] Seeded {sourcesToInsert.Count} KnowledgeSources records.");
        }
    }

    private static async Task SeedTreatmentPlansAndProductsAsync(LavitreeDbContext context, string jsonPath)
    {
        var lateBlight = await context.Diseases.FirstOrDefaultAsync(d => d.ClassCode == "Tomato___Late_blight");
        if (lateBlight == null)
        {
            Console.WriteLine("[Seeder] Target disease Tomato___Late_blight not found in DB. Skipping treatment seeding.");
            return;
        }

        // 1. Seed TreatmentPlans for Tomato___Late_blight if not exists
        var hasTreatment = await context.TreatmentPlans.AnyAsync(tp => tp.DiseaseId == lateBlight.Id);
        if (!hasTreatment)
        {
            Console.WriteLine("[Seeder] Seeding 3-step IPM TreatmentPlan for Tomato___Late_blight...");
            var steps = new List<TreatmentPlan>
            {
                new TreatmentPlan
                {
                    DiseaseId = lateBlight.Id,
                    StepOrder = 1,
                    ActionTitle = "1. Cắt tỉa và tiêu hủy lá bệnh (Biện pháp canh tác)",
                    Instructions = "Ngắt bỏ toàn bộ các lá có triệu chứng mốc sương xám/nâu đen và đem tiêu hủy xa vườn (đốt hoặc chôn lấp vôi bột). Không vứt bừa bãi xuống mương nước tưới.",
                    IsolationDays = "Không áp dụng",
                    CreatedAt = DateTime.UtcNow
                },
                new TreatmentPlan
                {
                    DiseaseId = lateBlight.Id,
                    StepOrder = 2,
                    ActionTitle = "2. Phun thuốc đặc trị nấm Phytophthora (Biện pháp Hóa học / Sinh học)",
                    Instructions = "Phun ướt đều 2 mặt lá vào sáng sớm hoặc chiều mát khi thời tiết khô ráo. Luân phiên hoạt chất để tránh kháng thuốc. Nếu gần kỳ thu hoạch (< 7 ngày), chuyển sang chế phẩm sinh học Trichoderma hoặc Nano Bạc.",
                    IsolationDays = "7 ngày",
                    CreatedAt = DateTime.UtcNow
                },
                new TreatmentPlan
                {
                    DiseaseId = lateBlight.Id,
                    StepOrder = 3,
                    ActionTitle = "3. Bón phân phục hồi và cách ly an toàn (Phục hồi sinh trưởng)",
                    Instructions = "Giảm bón đạm (N), tăng cường Kali và Canxi-Bo để làm dày vách tế bào lá, giúp cây tăng đề kháng tự nhiên. Tuân thủ nghiêm ngặt thời gian cách ly an toàn (PHI) trước khi hái quả.",
                    IsolationDays = "7-14 ngày",
                    CreatedAt = DateTime.UtcNow
                }
            };
            await context.TreatmentPlans.AddRangeAsync(steps);
            await context.SaveChangesAsync();
        }
        else
        {
            Console.WriteLine("[Seeder] TreatmentPlans for Tomato___Late_blight already exist. Skipping.");
        }

        // 2. Seed Products
        var sampleProducts = new List<Product>
        {
            new Product
            {
                Name = "Ridomil Gold 68WG",
                ActiveIngredient = "Metalaxyl-M 40g/kg + Mancozeb 640g/kg",
                Price = 65000m,
                DosageInstruction = "Pha 50g cho bình 16L nước, phun ướt đều mặt lá khi bệnh chớm xuất hiện",
                StockQuantity = 150,
                ImageUrl = "https://lavitree.io.vn/images/products/ridomil-gold.png",
                CreatedAt = DateTime.UtcNow
            },
            new Product
            {
                Name = "Antracol 70WP",
                ActiveIngredient = "Propineb 700g/kg + Kẽm (Zn++)",
                Price = 45000m,
                DosageInstruction = "Pha 40-50g cho bình 16L nước, phun phòng trừ mốc sương và thán thư",
                StockQuantity = 120,
                ImageUrl = "https://lavitree.io.vn/images/products/antracol.png",
                CreatedAt = DateTime.UtcNow
            },
            new Product
            {
                Name = "Chế phẩm sinh học Trichoderma Bacillus",
                ActiveIngredient = "Trichoderma spp. (10^9 CFU/g) + Bacillus subtilis",
                Price = 55000m,
                DosageInstruction = "Pha 30g cho bình 16L nước hoặc tưới gốc đối kháng nấm bệnh",
                StockQuantity = 200,
                ImageUrl = "https://lavitree.io.vn/images/products/trichoderma.png",
                CreatedAt = DateTime.UtcNow
            }
        };

        var productList = new List<Product>();
        foreach (var p in sampleProducts)
        {
            var existingProd = await context.Products.FirstOrDefaultAsync(x => x.Name == p.Name);
            if (existingProd == null)
            {
                context.Products.Add(p);
                productList.Add(p);
                Console.WriteLine($"[Seeder] Adding Product: {p.Name}");
            }
            else
            {
                productList.Add(existingProd);
            }
        }
        await context.SaveChangesAsync();

        // 3. Link DiseaseProducts
        foreach (var prod in productList)
        {
            var exists = await context.DiseaseProducts.AnyAsync(dp => dp.DiseaseId == lateBlight.Id && dp.ProductId == prod.Id);
            if (!exists)
            {
                context.DiseaseProducts.Add(new DiseaseProduct
                {
                    DiseaseId = lateBlight.Id,
                    ProductId = prod.Id
                });
                Console.WriteLine($"[Seeder] Linking DiseaseProduct: {lateBlight.ClassCode} <-> {prod.Name}");
            }
        }
        await context.SaveChangesAsync();
    }

    private static string? ResolveSeedDirectory(string? customPath)
    {
        if (!string.IsNullOrWhiteSpace(customPath) && Directory.Exists(customPath))
        {
            return customPath;
        }

        var candidates = new List<string>
        {
            Path.Combine(AppContext.BaseDirectory, "seed"),
            Path.Combine(AppContext.BaseDirectory, "../../../seed"),
            Path.Combine(AppContext.BaseDirectory, "../../../../seed"),
            Path.Combine(AppContext.BaseDirectory, "../../../../../seed"),
            Path.Combine(Directory.GetCurrentDirectory(), "seed"),
            Path.Combine(Directory.GetCurrentDirectory(), "backend/core-api/seed"),
            Path.Combine(Directory.GetCurrentDirectory(), "../seed")
        };

        foreach (var c in candidates)
        {
            var fullPath = Path.GetFullPath(c);
            if (Directory.Exists(fullPath) && File.Exists(Path.Combine(fullPath, "Lavitree_Selected_Classes.csv")))
            {
                return fullPath;
            }
        }

        // Try climbing parent directories
        var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
        for (int i = 0; i < 5 && dir != null; i++)
        {
            var check1 = Path.Combine(dir.FullName, "backend", "core-api", "seed");
            if (Directory.Exists(check1) && File.Exists(Path.Combine(check1, "Lavitree_Selected_Classes.csv")))
            {
                return check1;
            }
            var check2 = Path.Combine(dir.FullName, "seed");
            if (Directory.Exists(check2) && File.Exists(Path.Combine(check2, "Lavitree_Selected_Classes.csv")))
            {
                return check2;
            }
            dir = dir.Parent;
        }

        return null;
    }

    private static List<string> ParseCsvLine(string line)
    {
        var result = new List<string>();
        bool inQuotes = false;
        var sb = new StringBuilder();

        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];
            if (c == '\"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '\"')
                {
                    sb.Append('\"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                result.Add(sb.ToString().Trim());
                sb.Clear();
            }
            else
            {
                sb.Append(c);
            }
        }
        result.Add(sb.ToString().Trim());
        return result;
    }

    private static string GetScientificName(string plantName)
    {
        return plantName switch
        {
            "Cà chua" => "Solanum lycopersicum",
            "Khoai tây" => "Solanum tuberosum",
            "Ngô (Bắp)" => "Zea mays",
            "Táo" => "Malus domestica",
            "Nho" => "Vitis vinifera",
            "Ớt chuông" => "Capsicum annuum",
            "Cam / Cây có múi" => "Citrus sinensis",
            "Đào" => "Prunus persica",
            "Dâu tây" => "Fragaria × ananassa",
            "Anh đào (Cherry)" => "Prunus avium",
            "Việt quất" => "Vaccinium corymbosum",
            "Mâm xôi" => "Rubus idaeus",
            "Đậu nành (Đậu tương)" => "Glycine max",
            "Bí đỏ / Bí ngô" => "Cucurbita pepo",
            _ => "Plantae"
        };
    }

    private static string Slugify(string text)
    {
        return text.ToLowerInvariant()
            .Replace(" / ", "-")
            .Replace(" ", "-")
            .Replace("(", "")
            .Replace(")", "")
            .Replace("à", "a").Replace("á", "a").Replace("ạ", "a").Replace("ả", "a").Replace("ã", "a")
            .Replace("â", "a").Replace("ầ", "a").Replace("ấ", "a").Replace("ậ", "a").Replace("ẩ", "a").Replace("ẫ", "a")
            .Replace("ă", "a").Replace("ằ", "a").Replace("ắ", "a").Replace("ặ", "a").Replace("ẳ", "a").Replace("ẵ", "a")
            .Replace("è", "e").Replace("é", "e").Replace("ẹ", "e").Replace("ẻ", "e").Replace("ẽ", "e")
            .Replace("ê", "e").Replace("ề", "e").Replace("ế", "e").Replace("ệ", "e").Replace("ể", "e").Replace("ễ", "e")
            .Replace("ì", "i").Replace("í", "i").Replace("ị", "i").Replace("ỉ", "i").Replace("ĩ", "i")
            .Replace("ò", "o").Replace("ó", "o").Replace("ọ", "o").Replace("ỏ", "o").Replace("õ", "o")
            .Replace("ô", "o").Replace("ồ", "o").Replace("ố", "o").Replace("ộ", "o").Replace("ổ", "o").Replace("ỗ", "o")
            .Replace("ơ", "o").Replace("ờ", "o").Replace("ớ", "o").Replace("ợ", "o").Replace("ở", "o").Replace("ỡ", "o")
            .Replace("ù", "u").Replace("ú", "u").Replace("ụ", "u").Replace("ủ", "u").Replace("ũ", "u")
            .Replace("ư", "u").Replace("ừ", "u").Replace("ứ", "u").Replace("ự", "u").Replace("ử", "u").Replace("ữ", "u")
            .Replace("ỳ", "y").Replace("ý", "y").Replace("ỵ", "y").Replace("ỷ", "y").Replace("ỹ", "y")
            .Replace("đ", "d");
    }
}
