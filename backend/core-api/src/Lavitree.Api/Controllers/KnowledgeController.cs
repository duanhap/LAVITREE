using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Lavitree.Domain.Entities;
using Lavitree.Infrastructure.Persistence;

namespace Lavitree.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class KnowledgeController : ControllerBase
{
    private readonly LavitreeDbContext _dbContext;

    public KnowledgeController(LavitreeDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    // Static definition of 38 classes matching KB/DANH_SACH_LOP_CAN_TIM_TRI_THUC.csv
    public record ClassMetadata(
        string ModelClass,
        string PlantName,
        string DiseaseName,
        int Phase,
        string PhaseName,
        bool IsHealthy,
        string SuggestedKeywords,
        string GuidanceNotes
    );

    private static readonly List<ClassMetadata> All38Classes = new()
    {
        // 🌾 ĐỢT 1: CÂY TRỒNG NÔNG NGHIỆP CHỦ LỰC TẠI VIỆT NAM (16 LỚP)
        new("Tomato___Late_blight", "Cà chua", "Bệnh mốc sương / sương mai cà chua", 1, "Đợt 1: Cây chủ lực", false, "tomato late blight symptoms management university extension", "Bệnh rất nguy hiểm ở VN, cần tìm triệu chứng và phòng ngừa"),
        new("Tomato___Tomato_Yellow_Leaf_Curl_Virus", "Cà chua", "Bệnh xoăn vàng lá (TYLCV)", 1, "Đợt 1: Cây chủ lực", false, "tomato yellow leaf curl virus prevention extension", "Bệnh do virus lây qua bọ phấn trắng, rất phổ biến"),
        new("Tomato___Bacterial_spot", "Cà chua", "Bệnh đốm vi khuẩn", 1, "Đợt 1: Cây chủ lực", false, "tomato bacterial spot xanthomonas agriculture extension", "Đốm đen nhỏ trên lá viền vàng"),
        new("Tomato___Septoria_leaf_spot", "Cà chua", "Bệnh đốm lá Septoria", 1, "Đợt 1: Cây chủ lực", false, "tomato septoria leaf spot control extension", "Đốm tròn tâm xám viền nâu sẫm"),
        new("Tomato___Spider_mites Two-spotted_spider_mite", "Cà chua", "Nhện đỏ hại cà chua", 1, "Đợt 1: Cây chủ lực", false, "tomato two spotted spider mites management extension", "Mặt dưới lá có tơ mịn, lá lấm chấm vàng"),
        new("Tomato___Leaf_Mold", "Cà chua", "Bệnh mốc lá cà chua", 1, "Đợt 1: Cây chủ lực", false, "tomato leaf mold passalora fulva symptoms", "Mặt dưới lá có lớp mốc nhung màu oliu/nâu"),
        new("Tomato___Tomato_mosaic_virus", "Cà chua", "Bệnh khảm lá (ToMV)", 1, "Đợt 1: Cây chủ lực", false, "tomato mosaic virus prevention agriculture extension", "Lá loang lổ xanh đậm xanh nhạt, biến dạng"),
        new("Tomato___Early_blight", "Cà chua", "Bệnh đốm vòng / Cháy lá sớm", 1, "Đợt 1: Cây chủ lực", false, "tomato early blight alternaria symptoms control", "Đốm nâu có các vòng đồng tâm, dễ nhầm Target Spot"),
        new("Tomato___Target_Spot", "Cà chua", "Bệnh đốm mắt chim / Target spot", 1, "Đợt 1: Cây chủ lực", false, "tomato target spot corynespora cassiicola extension", "Đốm hoại tử tròn, dễ nhầm Early blight"),
        new("Potato___Late_blight", "Khoai tây", "Bệnh mốc sương khoai tây", 1, "Đợt 1: Cây chủ lực", false, "potato late blight phytophthora infestans management", "Bệnh mốc sương gây thối lá củ, dịch bệnh lịch sử"),
        new("Potato___Early_blight", "Khoai tây", "Bệnh đốm vòng khoai tây", 1, "Đợt 1: Cây chủ lực", false, "potato early blight alternaria solani control extension", "Vết đốm hình tròn/bầu dục có vòng đồng tâm"),
        new("Corn_(maize)___Common_rust_", "Ngô (Bắp)", "Bệnh gỉ sắt ngô", 1, "Đợt 1: Cây chủ lực", false, "corn common rust puccinia sorghi extension", "Các ổ bột bào tử màu nâu đỏ gỉ sắt trên phiến lá"),
        new("Corn_(maize)___Northern_Leaf_Blight", "Ngô (Bắp)", "Bệnh cháy lá lớn ngô", 1, "Đợt 1: Cây chủ lực", false, "corn northern leaf blight exserohilum turcicum", "Vết bệnh dài hình thoi chạy dọc gân lá"),
        new("Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot", "Ngô (Bắp)", "Bệnh đốm xám ngô", 1, "Đợt 1: Cây chủ lực", false, "corn gray leaf spot cercospora zeae-maydis extension", "Đốm hình chữ nhật hẹp giới hạn giữa 2 gân phụ"),
        new("Pepper,_bell___Bacterial_spot", "Ớt chuông", "Bệnh đốm vi khuẩn trên ớt", 1, "Đợt 1: Cây chủ lực", false, "pepper bacterial spot xanthomonas university extension", "Đốm nhỏ giọt dầu hóa nâu rách lá"),
        new("Orange___Haunglongbing_(Citrus_greening)", "Cam / Có múi", "Bệnh vàng lá gân xanh (Greening)", 1, "Đợt 1: Cây chủ lực", false, "citrus greening huanglongbing symptoms management", "Rầy chổng cánh truyền vi khuẩn, cực quan trọng tại VN"),

        // 🍇 ĐỢT 2: CÂY ĂN QUẢ & CÂY PHỤ (10 LỚP)
        new("Apple___Apple_scab", "Táo", "Bệnh vảy táo (Scab)", 2, "Đợt 2: Cây ăn quả", false, "apple scab venturia inaequalis extension", "Đốm tròn màu oliu hóa bần trên lá"),
        new("Apple___Black_rot", "Táo", "Bệnh thối đen (Black rot)", 2, "Đợt 2: Cây ăn quả", false, "apple black rot botryosphaeria obtusa extension", "Đốm mắt ếch (frog-eye leaf spot)"),
        new("Apple___Cedar_apple_rust", "Táo", "Bệnh gỉ sắt tuyết tùng", 2, "Đợt 2: Cây ăn quả", false, "apple cedar rust gymnosporangium extension", "Đốm cam sáng mặt trên lá, có gai mặt dưới"),
        new("Grape___Black_rot", "Nho", "Bệnh thối đen trên nho", 2, "Đợt 2: Cây ăn quả", false, "grape black rot guignardia bidwellii extension", "Đốm tròn màu nâu có viền đen quanh vết bệnh"),
        new("Grape___Esca_(Black_Measles)", "Nho", "Bệnh sởi đen / Esca nho", 2, "Đợt 2: Cây ăn quả", false, "grape esca black measles symptoms management", "Phiến lá sọc vằn da hổ (tiger-stripe)"),
        new("Grape___Leaf_blight_(Isariopsis_Leaf_Spot)", "Nho", "Bệnh cháy lá nho", 2, "Đợt 2: Cây ăn quả", false, "grape isariopsis leaf spot extension", "Đốm góc cạnh màu nâu đỏ"),
        new("Peach___Bacterial_spot", "Đào", "Bệnh đốm vi khuẩn trên đào", 2, "Đợt 2: Cây ăn quả", false, "peach bacterial spot xanthomonas arboricola extension", "Vết đốm lủng lỗ thủng đạn trên phiến lá"),
        new("Cherry_(including_sour)___Powdery_mildew", "Anh đào (Cherry)", "Bệnh phấn trắng anh đào", 2, "Đợt 2: Cây ăn quả", false, "cherry powdery mildew podosphaera extension", "Lớp phấn trắng như bụi bột trên mặt lá"),
        new("Squash___Powdery_mildew", "Bí đỏ / Bí ngô", "Bệnh phấn trắng trên bí", 2, "Đợt 2: Cây ăn quả", false, "squash powdery mildew podosphaera extension", "Lá bị phủ màng phấn trắng xóa, khô rụi"),
        new("Strawberry___Leaf_scorch", "Dâu tây", "Bệnh đốm cháy lá dâu tây", 2, "Đợt 2: Cây ăn quả", false, "strawberry leaf scorch diplocarpon earlianum extension", "Các đốm tía nhỏ lan rộng cháy sém mép lá"),

        // 🌿 ĐỢT 3: CÂY KHỎE MẠNH (12 LỚP - CHỈ TÌM KỸ THUẬT CHĂM SÓC, KHÔNG TÌM THUỐC)
        new("Tomato___healthy", "Cà chua", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, "tomato cultivation care guidelines extension", "KHÔNG TÌM THUỐC; chỉ tìm chăm sóc & phòng ngừa chung"),
        new("Potato___healthy", "Khoai tây", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, "potato growing guide extension", "KHÔNG TÌM THUỐC; chăm sóc ngừa sâu bệnh củ"),
        new("Corn_(maize)___healthy", "Ngô (Bắp)", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, "corn planting care guidelines", "KHÔNG TÌM THUỐC; chăm sóc mùa vụ ngô"),
        new("Pepper,_bell___healthy", "Ớt chuông", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, "bell pepper growing tips extension", "KHÔNG TÌM THUỐC; kỹ thuật trồng ớt chuông"),
        new("Apple___healthy", "Táo", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, "apple orchard management guide", "KHÔNG TÌM THUỐC"),
        new("Grape___healthy", "Nho", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, "grapevine care cultivation extension", "KHÔNG TÌM THUỐC"),
        new("Peach___healthy", "Đào", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, "peach tree cultivation guide", "KHÔNG TÌM THUỐC"),
        new("Cherry_(including_sour)___healthy", "Anh đào (Cherry)", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, "cherry tree care orchard extension", "KHÔNG TÌM THUỐC"),
        new("Strawberry___healthy", "Dâu tây", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, "strawberry growing guide care", "KHÔNG TÌM THUỐC"),
        new("Blueberry___healthy", "Việt quất", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, "blueberry bush care university extension", "KHÔNG TÌM THUỐC"),
        new("Raspberry___healthy", "Mâm xôi", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, "raspberry planting care guidelines", "KHÔNG TÌM THUỐC"),
        new("Soybean___healthy", "Đậu nành (Đậu tương)", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, "soybean crop management extension", "KHÔNG TÌM THUỐC")
    };

    // 1. GET /api/v1/knowledge/classes
    [HttpGet("classes")]
    public async Task<IActionResult> GetClasses()
    {
        var counts = await _dbContext.KnowledgeSources
            .Where(s => !s.IsDeleted)
            .GroupBy(s => s.ModelClass)
            .Select(g => new { ModelClass = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ModelClass, x => x.Count);

        var result = All38Classes.Select(c =>
        {
            var count = counts.GetValueOrDefault(c.ModelClass, 0);
            var status = count >= 2 ? "Đủ nguồn (>=2)" : (count == 1 ? "Đang thu thập (1)" : "Chưa có nguồn");
            return new
            {
                c.ModelClass,
                c.PlantName,
                c.DiseaseName,
                c.Phase,
                c.PhaseName,
                c.IsHealthy,
                c.SuggestedKeywords,
                c.GuidanceNotes,
                SourcesCount = count,
                Status = status
            };
        });

        return Ok(result);
    }

    // 2. GET /api/v1/knowledge/stats
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var counts = await _dbContext.KnowledgeSources
            .Where(s => !s.IsDeleted)
            .GroupBy(s => s.ModelClass)
            .Select(g => new { ModelClass = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ModelClass, x => x.Count);

        var totalClasses = All38Classes.Count; // 38
        var completedClasses = All38Classes.Count(c => counts.GetValueOrDefault(c.ModelClass, 0) >= 2);
        var inProgressClasses = All38Classes.Count(c => counts.GetValueOrDefault(c.ModelClass, 0) == 1);
        var unstartedClasses = All38Classes.Count(c => counts.GetValueOrDefault(c.ModelClass, 0) == 0);
        var totalSources = await _dbContext.KnowledgeSources.CountAsync(s => !s.IsDeleted);

        // Phase 1 (16 classes)
        var p1 = All38Classes.Where(c => c.Phase == 1).ToList();
        var p1Done = p1.Count(c => counts.GetValueOrDefault(c.ModelClass, 0) >= 2);

        // Phase 2 (10 classes)
        var p2 = All38Classes.Where(c => c.Phase == 2).ToList();
        var p2Done = p2.Count(c => counts.GetValueOrDefault(c.ModelClass, 0) >= 2);

        // Phase 3 (12 classes)
        var p3 = All38Classes.Where(c => c.Phase == 3).ToList();
        var p3Done = p3.Count(c => counts.GetValueOrDefault(c.ModelClass, 0) >= 2);

        return Ok(new
        {
            TotalClasses = totalClasses,
            CompletedClasses = completedClasses,
            InProgressClasses = inProgressClasses,
            UnstartedClasses = unstartedClasses,
            TotalSources = totalSources,
            CompletionPercentage = Math.Round((double)completedClasses / totalClasses * 100, 1),
            Phase1 = new { Total = p1.Count, Completed = p1Done, Percent = Math.Round((double)p1Done / p1.Count * 100, 1) },
            Phase2 = new { Total = p2.Count, Completed = p2Done, Percent = Math.Round((double)p2Done / p2.Count * 100, 1) },
            Phase3 = new { Total = p3.Count, Completed = p3Done, Percent = Math.Round((double)p3Done / p3.Count * 100, 1) }
        });
    }

    // 3. GET /api/v1/knowledge/sources
    [HttpGet("sources")]
    public async Task<IActionResult> GetSources([FromQuery] string? modelClass, [FromQuery] string? search)
    {
        var query = _dbContext.KnowledgeSources
            .Where(s => !s.IsDeleted)
            .OrderByDescending(s => s.CreatedAt)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(modelClass))
        {
            query = query.Where(s => s.ModelClass == modelClass);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(s => s.SourceTitle.Contains(search) || 
                                     s.Organization.Contains(search) || 
                                     s.DiseaseName.Contains(search) || 
                                     s.PlantName.Contains(search));
        }

        var list = await query.ToListAsync();
        return Ok(list);
    }

    public record CreateSourceDto(
        string ModelClass,
        string PlantName,
        string DiseaseName,
        string SourceUrl,
        string SourceTitle,
        string Organization,
        string? PublishedDate,
        string? MatchLevel,
        string EvidenceText,
        string ContentType,
        bool IsManualApproved,
        string? ReviewerNotes
    );

    // 4. POST /api/v1/knowledge/sources
    [HttpPost("sources")]
    public async Task<IActionResult> CreateSource([FromBody] CreateSourceDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ModelClass) || string.IsNullOrWhiteSpace(dto.SourceUrl))
        {
            return BadRequest(new { message = "Vui lòng chọn lớp cây–bệnh và nhập đường dẫn URL." });
        }

        // Automatic domain quality evaluation
        string evaluatedQuality;
        var lowerUrl = dto.SourceUrl.ToLowerInvariant();

        if (dto.IsManualApproved)
        {
            evaluatedQuality = "Duyệt ngoại lệ";
        }
        else if (lowerUrl.Contains(".edu") || lowerUrl.Contains(".gov") || lowerUrl.Contains(".ac.uk") || 
                 lowerUrl.Contains("cals.cornell.edu") || lowerUrl.Contains("extension.") || lowerUrl.Contains("ipm.ucanr.edu"))
        {
            evaluatedQuality = "Cao (Đại học/Khuyến nông)";
        }
        else if (lowerUrl.Contains("nongnghiep.vn") || lowerUrl.Contains("khuyennongvn") || lowerUrl.Contains("vienduoctlieu") || lowerUrl.Contains("iasvn.org"))
        {
            evaluatedQuality = "Trung bình (Báo/Viện nông nghiệp)";
        }
        else
        {
            evaluatedQuality = "Cần kiểm tra (Tên miền khác)";
        }

        var source = new KnowledgeSource
        {
            Id = Guid.NewGuid(),
            ModelClass = dto.ModelClass,
            PlantName = dto.PlantName,
            DiseaseName = dto.DiseaseName,
            SourceUrl = dto.SourceUrl,
            SourceTitle = string.IsNullOrWhiteSpace(dto.SourceTitle) ? dto.SourceUrl : dto.SourceTitle,
            Organization = string.IsNullOrWhiteSpace(dto.Organization) ? "Chưa xác định" : dto.Organization,
            PublishedDate = string.IsNullOrWhiteSpace(dto.PublishedDate) ? "Không ghi ngày" : dto.PublishedDate,
            MatchLevel = string.IsNullOrWhiteSpace(dto.MatchLevel) ? "Khớp trực tiếp" : dto.MatchLevel,
            EvidenceText = dto.EvidenceText ?? string.Empty,
            ContentType = string.IsNullOrWhiteSpace(dto.ContentType) ? "Triệu chứng & Biện pháp" : dto.ContentType,
            SourceQuality = evaluatedQuality,
            IsManualApproved = dto.IsManualApproved,
            ReviewerNotes = dto.ReviewerNotes
        };

        _dbContext.KnowledgeSources.Add(source);
        await _dbContext.SaveChangesAsync();

        return Ok(source);
    }

    // 5. DELETE /api/v1/knowledge/sources/{id}
    [HttpDelete("sources/{id:guid}")]
    public async Task<IActionResult> DeleteSource(Guid id)
    {
        var item = await _dbContext.KnowledgeSources.FindAsync(id);
        if (item == null) return NotFound(new { message = "Không tìm thấy nguồn dữ liệu." });

        item.IsDeleted = true;
        await _dbContext.SaveChangesAsync();
        return Ok(new { message = "Đã xóa nguồn dữ liệu thành công." });
    }

    // 6. GET /api/v1/knowledge/export
    [HttpGet("export")]
    public async Task<IActionResult> ExportCsv()
    {
        var sources = await _dbContext.KnowledgeSources
            .Where(s => !s.IsDeleted)
            .OrderBy(s => s.ModelClass)
            .ToListAsync();

        var sb = new StringBuilder();
        // UTF-8 BOM for Excel support
        sb.Append('\uFEFF');
        sb.AppendLine("ID,Model_Class,Plant_Name,Disease_Name,Source_Title,Organization,Published_Date,Source_URL,Content_Type,Match_Level,Source_Quality,Is_Manual_Approved,Evidence_Text,Reviewer_Notes,Created_At");

        foreach (var s in sources)
        {
            var title = EscapeCsv(s.SourceTitle);
            var org = EscapeCsv(s.Organization);
            var pubDate = EscapeCsv(s.PublishedDate ?? "Không ghi ngày");
            var url = EscapeCsv(s.SourceUrl);
            var match = EscapeCsv(s.MatchLevel ?? "Khớp trực tiếp");
            var evidence = EscapeCsv(s.EvidenceText ?? "");
            var notes = EscapeCsv(s.ReviewerNotes ?? "");

            sb.AppendLine($"{s.Id},{s.ModelClass},{s.PlantName},{s.DiseaseName},{title},{org},{pubDate},{url},{s.ContentType},{match},{s.SourceQuality},{s.IsManualApproved},{evidence},{notes},{s.CreatedAt:yyyy-MM-dd HH:mm}");
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", $"Lavitree_Knowledge_Sources_{DateTime.UtcNow:yyyyMMdd}.csv");
    }

    private static string EscapeCsv(string value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }
        return value;
    }
}
