using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;
using System.Web;
using Lavitree.Api.Filters;
using Lavitree.Application.DTOs;
using Lavitree.Domain.Entities;
using Lavitree.Infrastructure.Persistence;

namespace Lavitree.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class KnowledgeController : ControllerBase
{
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> _urlLocks = new();
    private readonly LavitreeDbContext _dbContext;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _memoryCache;
    private readonly IConfiguration _configuration;
    private readonly ILogger<KnowledgeController> _logger;

    public KnowledgeController(
        LavitreeDbContext dbContext,
        IHttpClientFactory httpClientFactory,
        IMemoryCache memoryCache,
        IConfiguration configuration,
        ILogger<KnowledgeController> logger)
    {
        _dbContext = dbContext;
        _httpClientFactory = httpClientFactory;
        _memoryCache = memoryCache;
        _configuration = configuration;
        _logger = logger;
    }

    public class CachedIngestionSession
    {
        public string IngestionId { get; set; } = string.Empty;
        public string ModelClass { get; set; } = string.Empty;
        public string PlantName { get; set; } = string.Empty;
        public string DiseaseName { get; set; } = string.Empty;
        public string SourceUrl { get; set; } = string.Empty;
        public string SourceTitle { get; set; } = string.Empty;
        public string Organization { get; set; } = string.Empty;
        public string? PublishedDate { get; set; }
        public List<ParagraphDto> Paragraphs { get; set; } = new();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
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
        string SuggestedKeywordsVn,
        string GuidanceNotes
    );

    private static readonly List<ClassMetadata> All38Classes = new()
    {
        // 🌾 ĐỢT 1: CÂY TRỒNG NÔNG NGHIỆP CHỦ LỰC TẠI VIỆT NAM (16 LỚP)
        new("Tomato___Late_blight", "Cà chua", "Bệnh mốc sương / sương mai cà chua", 1, "Đợt 1: Cây chủ lực", false, 
            "tomato late blight symptoms management university extension", 
            "bệnh mốc sương sương mai cà chua triệu chứng phòng trị thuốc BVTV nongnghiep", 
            "Bệnh rất nguy hiểm ở VN, cần tìm triệu chứng và phòng ngừa"),
        new("Tomato___Tomato_Yellow_Leaf_Curl_Virus", "Cà chua", "Bệnh xoăn vàng lá (TYLCV)", 1, "Đợt 1: Cây chủ lực", false, 
            "tomato yellow leaf curl virus prevention extension", 
            "bệnh xoăn vàng lá cà chua triệu chứng bọ phấn trắng phòng trị khuyennong", 
            "Bệnh do virus lây qua bọ phấn trắng, rất phổ biến"),
        new("Tomato___Bacterial_spot", "Cà chua", "Bệnh đốm vi khuẩn", 1, "Đợt 1: Cây chủ lực", false, 
            "tomato bacterial spot xanthomonas agriculture extension", 
            "bệnh đốm vi khuẩn cà chua triệu chứng thuốc BVTV nongnghiep", 
            "Đốm đen nhỏ trên lá viền vàng"),
        new("Tomato___Septoria_leaf_spot", "Cà chua", "Bệnh đốm lá Septoria", 1, "Đợt 1: Cây chủ lực", false, 
            "tomato septoria leaf spot control extension", 
            "bệnh đốm lá septoria cà chua triệu chứng phòng trị bvtv", 
            "Đốm tròn tâm xám viền nâu sẫm"),
        new("Tomato___Spider_mites Two-spotted_spider_mite", "Cà chua", "Nhện đỏ hại cà chua", 1, "Đợt 1: Cây chủ lực", false, 
            "tomato two spotted spider mites management extension", 
            "nhện đỏ hại cà chua triệu chứng cách trị thuốc đặc trị nongnghiep", 
            "Mặt dưới lá có tơ mịn, lá lấm chấm vàng"),
        new("Tomato___Leaf_Mold", "Cà chua", "Bệnh mốc lá cà chua", 1, "Đợt 1: Cây chủ lực", false, 
            "tomato leaf mold passalora fulva symptoms", 
            "bệnh mốc lá cà chua triệu chứng phòng trừ bvtv nongnghiep", 
            "Mặt dưới lá có lớp mốc nhung màu oliu/nâu"),
        new("Tomato___Tomato_mosaic_virus", "Cà chua", "Bệnh khảm lá (ToMV)", 1, "Đợt 1: Cây chủ lực", false, 
            "tomato mosaic virus prevention agriculture extension", 
            "bệnh khảm lá virus cà chua triệu chứng phòng trị khuyennong", 
            "Lá loang lổ xanh đậm xanh nhạt, biến dạng"),
        new("Tomato___Early_blight", "Cà chua", "Bệnh đốm vòng / Cháy lá sớm", 1, "Đợt 1: Cây chủ lực", false, 
            "tomato early blight alternaria symptoms control", 
            "bệnh đốm vòng cháy lá sớm cà chua triệu chứng thuốc phòng trị nongnghiep", 
            "Đốm nâu có các vòng đồng tâm, dễ nhầm Target Spot"),
        new("Tomato___Target_Spot", "Cà chua", "Bệnh đốm mắt chim / Target spot", 1, "Đợt 1: Cây chủ lực", false, 
            "tomato target spot corynespora cassiicola extension", 
            "bệnh đốm mắt chim target spot cà chua triệu chứng phòng trừ nongnghiep", 
            "Đốm hoại tử tròn, dễ nhầm Early blight"),
        new("Potato___Late_blight", "Khoai tây", "Bệnh mốc sương khoai tây", 1, "Đợt 1: Cây chủ lực", false, 
            "potato late blight phytophthora infestans management", 
            "bệnh mốc sương khoai tây triệu chứng phòng trị thuốc BVTV nongnghiep", 
            "Bệnh mốc sương gây thối lá củ, dịch bệnh lịch sử"),
        new("Potato___Early_blight", "Khoai tây", "Bệnh đốm vòng khoai tây", 1, "Đợt 1: Cây chủ lực", false, 
            "potato early blight alternaria solani control extension", 
            "bệnh đốm vòng khoai tây triệu chứng thuốc phòng trị bvtv", 
            "Vết đốm hình tròn/bầu dục có vòng đồng tâm"),
        new("Corn_(maize)___Common_rust_", "Ngô (Bắp)", "Bệnh gỉ sắt ngô", 1, "Đợt 1: Cây chủ lực", false, 
            "corn common rust puccinia sorghi extension", 
            "bệnh gỉ sắt ngô bắp triệu chứng phòng trị thuốc BVTV nongnghiep", 
            "Các ổ bột bào tử màu nâu đỏ gỉ sắt trên phiến lá"),
        new("Corn_(maize)___Northern_Leaf_Blight", "Ngô (Bắp)", "Bệnh cháy lá lớn ngô", 1, "Đợt 1: Cây chủ lực", false, 
            "corn northern leaf blight exserohilum turcicum", 
            "bệnh cháy lá lớn ngô bắp triệu chứng thuốc BVTV nongnghiep", 
            "Vết bệnh dài hình thoi chạy dọc gân lá"),
        new("Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot", "Ngô (Bắp)", "Bệnh đốm xám ngô", 1, "Đợt 1: Cây chủ lực", false, 
            "corn gray leaf spot cercospora zeae-maydis extension", 
            "bệnh đốm xám ngô bắp triệu chứng phòng trị khuyennong", 
            "Đốm hình chữ nhật hẹp giới hạn giữa 2 gân phụ"),
        new("Pepper,_bell___Bacterial_spot", "Ớt chuông", "Bệnh đốm vi khuẩn trên ớt", 1, "Đợt 1: Cây chủ lực", false, 
            "pepper bacterial spot xanthomonas university extension", 
            "bệnh đốm vi khuẩn ớt triệu chứng thuốc phòng trị nongnghiep", 
            "Đốm nhỏ giọt dầu hóa nâu rách lá"),
        new("Orange___Haunglongbing_(Citrus_greening)", "Cam / Có múi", "Bệnh vàng lá gân xanh (Greening)", 1, "Đợt 1: Cây chủ lực", false, 
            "citrus greening huanglongbing symptoms management", 
            "bệnh vàng lá gân xanh greening cam quýt rầy chổng cánh phòng trị nongnghiep", 
            "Rầy chổng cánh truyền vi khuẩn, cực quan trọng tại VN"),

        // 🍇 ĐỢT 2: CÂY ĂN QUẢ & CÂY PHỤ (10 LỚP)
        new("Apple___Apple_scab", "Táo", "Bệnh vảy táo (Scab)", 2, "Đợt 2: Cây ăn quả", false, 
            "apple scab venturia inaequalis extension", 
            "bệnh vảy táo scab triệu chứng phòng trị cây ăn quả", 
            "Đốm tròn màu oliu hóa bần trên lá"),
        new("Apple___Black_rot", "Táo", "Bệnh thối đen (Black rot)", 2, "Đợt 2: Cây ăn quả", false, 
            "apple black rot botryosphaeria obtusa extension", 
            "bệnh thối đen đốm mắt ếch táo triệu chứng phòng trị", 
            "Đốm mắt ếch (frog-eye leaf spot)"),
        new("Apple___Cedar_apple_rust", "Táo", "Bệnh gỉ sắt tuyết tùng", 2, "Đợt 2: Cây ăn quả", false, 
            "apple cedar rust gymnosporangium extension", 
            "bệnh gỉ sắt táo cedar apple rust triệu chứng phòng trị", 
            "Đốm cam sáng mặt trên lá, có gai mặt dưới"),
        new("Grape___Black_rot", "Nho", "Bệnh thối đen trên nho", 2, "Đợt 2: Cây ăn quả", false, 
            "grape black rot guignardia bidwellii extension", 
            "bệnh thối đen nho guignardia bidwellii triệu chứng phòng trị nongnghiep", 
            "Đốm tròn màu nâu có viền đen quanh vết bệnh"),
        new("Grape___Esca_(Black_Measles)", "Nho", "Bệnh sởi đen / Esca nho", 2, "Đợt 2: Cây ăn quả", false, 
            "grape esca black measles symptoms management", 
            "bệnh sởi đen esca nho triệu chứng phòng trừ", 
            "Phiến lá sọc vằn da hổ (tiger-stripe)"),
        new("Grape___Leaf_blight_(Isariopsis_Leaf_Spot)", "Nho", "Bệnh cháy lá nho", 2, "Đợt 2: Cây ăn quả", false, 
            "grape isariopsis leaf spot extension", 
            "bệnh cháy lá nho triệu chứng thuốc phòng trị", 
            "Đốm góc cạnh màu nâu đỏ"),
        new("Peach___Bacterial_spot", "Đào", "Bệnh đốm vi khuẩn trên đào", 2, "Đợt 2: Cây ăn quả", false, 
            "peach bacterial spot xanthomonas arboricola extension", 
            "bệnh đốm vi khuẩn đào triệu chứng phòng trị", 
            "Vết đốm lủng lỗ thủng đạn trên phiến lá"),
        new("Cherry_(including_sour)___Powdery_mildew", "Anh đào (Cherry)", "Bệnh phấn trắng anh đào", 2, "Đợt 2: Cây ăn quả", false, 
            "cherry powdery mildew podosphaera extension", 
            "bệnh phấn trắng anh đào cherry triệu chứng phòng trị", 
            "Lớp phấn trắng như bụi bột trên mặt lá"),
        new("Squash___Powdery_mildew", "Bí đỏ / Bí ngô", "Bệnh phấn trắng trên bí", 2, "Đợt 2: Cây ăn quả", false, 
            "squash powdery mildew podosphaera extension", 
            "bệnh phấn trắng bí đỏ bí ngô triệu chứng thuốc BVTV nongnghiep", 
            "Lá bị phủ màng phấn trắng xóa, khô rụi"),
        new("Strawberry___Leaf_scorch", "Dâu tây", "Bệnh đốm cháy lá dâu tây", 2, "Đợt 2: Cây ăn quả", false, 
            "strawberry leaf scorch diplocarpon earlianum extension", 
            "bệnh đốm cháy lá dâu tây đà lạt triệu chứng thuốc phòng trị nongnghiep", 
            "Các đốm tía nhỏ lan rộng cháy sém mép lá"),

        // 🌿 ĐỢT 3: CÂY KHỎE MẠNH (12 LỚP - CHỈ TÌM KỸ THUẬT CHĂM SÓC, KHÔNG TÌM THUỐC)
        new("Tomato___healthy", "Cà chua", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, 
            "tomato cultivation care guidelines extension", 
            "kỹ thuật trồng chăm sóc cà chua năng suất cao phòng bệnh khuyennong", 
            "KHÔNG TÌM THUỐC; chỉ tìm chăm sóc & phòng ngừa chung"),
        new("Potato___healthy", "Khoai tây", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, 
            "potato growing guide extension", 
            "kỹ thuật trồng chăm sóc khoai tây năng suất cao khuyennong", 
            "KHÔNG TÌM THUỐC; chăm sóc ngừa sâu bệnh củ"),
        new("Corn_(maize)___healthy", "Ngô (Bắp)", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, 
            "corn planting care guidelines", 
            "kỹ thuật trồng chăm sóc ngô bắp bón phân phòng bệnh khuyennong", 
            "KHÔNG TÌM THUỐC; chăm sóc mùa vụ ngô"),
        new("Pepper,_bell___healthy", "Ớt chuông", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, 
            "bell pepper growing tips extension", 
            "kỹ thuật trồng chăm sóc ớt chuông đạt năng suất cao khuyennong", 
            "KHÔNG TÌM THUỐC; kỹ thuật trồng ớt chuông"),
        new("Apple___healthy", "Táo", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, 
            "apple orchard management guide", 
            "kỹ thuật trồng chăm sóc cây táo năng suất cao khuyennong", 
            "KHÔNG TÌM THUỐC"),
        new("Grape___healthy", "Nho", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, 
            "grapevine care cultivation extension", 
            "kỹ thuật trồng chăm sóc nho ninh thuận cắt cành khuyennong", 
            "KHÔNG TÌM THUỐC"),
        new("Peach___healthy", "Đào", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, 
            "peach tree cultivation guide", 
            "kỹ thuật trồng chăm sóc cây đào bón phân tỉa cành", 
            "KHÔNG TÌM THUỐC"),
        new("Cherry_(including_sour)___healthy", "Anh đào (Cherry)", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, 
            "cherry tree care orchard extension", 
            "kỹ thuật trồng chăm sóc cây anh đào cherry", 
            "KHÔNG TÌM THUỐC"),
        new("Strawberry___healthy", "Dâu tây", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, 
            "strawberry growing guide care", 
            "kỹ thuật trồng chăm sóc dâu tây đà lạt tưới tiêu bón phân", 
            "KHÔNG TÌM THUỐC"),
        new("Blueberry___healthy", "Việt quất", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, 
            "blueberry bush care university extension", 
            "kỹ thuật trồng chăm sóc cây việt quất", 
            "KHÔNG TÌM THUỐC"),
        new("Raspberry___healthy", "Mâm xôi", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, 
            "raspberry planting care guidelines", 
            "kỹ thuật trồng chăm sóc cây mâm xôi phúc bồn tử", 
            "KHÔNG TÌM THUỐC"),
        new("Soybean___healthy", "Đậu nành (Đậu tương)", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, 
            "soybean crop management extension", 
            "kỹ thuật trồng chăm sóc đậu tương đậu nành đạt năng suất cao khuyennong", 
            "KHÔNG TÌM THUỐC"),
        new("Orange___healthy", "Cam / Có múi", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, 
            "orange citrus tree cultivation care guidelines extension", 
            "kỹ thuật trồng chăm sóc cây cam năng suất cao bón phân tưới tiêu khuyennong", 
            "KHÔNG TÌM THUỐC; kỹ thuật trồng, tưới tiêu và bón phân cam quýt"),
        new("Squash___healthy", "Bí đỏ / Bí ngô", "Cây khỏe mạnh", 3, "Đợt 3: Cây khỏe", true, 
            "squash pumpkin growing cultivation guide extension", 
            "kỹ thuật trồng chăm sóc bí đỏ bí ngô đạt năng suất cao khuyennong", 
            "KHÔNG TÌM THUỐC; kỹ thuật trồng, làm đất, thụ phấn và chăm sóc bí")
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
                c.SuggestedKeywordsVn,
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

        var totalClasses = All38Classes.Count; // 40
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

        // Phase 3 (14 classes)
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
    public async Task<IActionResult> GetSources(
        [FromQuery] string? modelClass, 
        [FromQuery] string? search,
        [FromQuery] bool? isApproved,
        CancellationToken cancellationToken)
    {
        var isAdmin = IsAdminUser(out _);

        // Khách/Nông dân không có quyền lọc hoặc xem bài chưa duyệt
        if (!isAdmin && isApproved == false)
        {
            return Forbid();
        }

        var query = _dbContext.KnowledgeSources
            .Where(s => !s.IsDeleted)
            .OrderByDescending(s => s.CreatedAt)
            .AsNoTracking();

        if (!isAdmin)
        {
            query = query.Where(s => s.IsManualApproved);
        }
        else if (isApproved.HasValue)
        {
            query = query.Where(s => s.IsManualApproved == isApproved.Value);
        }

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

        if (!isAdmin)
        {
            // Trả về DTO công khai, ẩn ReviewerNotes và các trường quản trị nội bộ
            var publicList = await query.Select(s => new
            {
                s.Id,
                s.ModelClass,
                s.PlantName,
                s.DiseaseName,
                s.SourceUrl,
                s.SourceTitle,
                s.Organization,
                s.PublishedDate,
                s.MatchLevel,
                s.SourceScope,
                s.EvidenceText,
                s.ContentType,
                s.UnitType,
                s.IsVerbatim,
                s.SourceQuality,
                s.CreatedAt
            }).ToListAsync(cancellationToken);

            return Ok(publicList);
        }

        var list = await query.ToListAsync(cancellationToken);
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
        string? SourceScope,
        string EvidenceText,
        string ContentType,
        bool? HasCultivationTechnique,
        bool IsManualApproved,
        string? ReviewerNotes
    );

    // 4. POST /api/v1/knowledge/sources
    [HttpPost("sources")]
    public async Task<IActionResult> CreateSource([FromBody] CreateSourceDto dto)
    {
        if (!IsAdminUser(out var authError))
        {
            return authError!;
        }

        if (string.IsNullOrWhiteSpace(dto.ModelClass) || string.IsNullOrWhiteSpace(dto.SourceUrl))
        {
            return BadRequest(new { message = "Vui lòng chọn lớp cây–bệnh và nhập đường dẫn URL." });
        }

        var trimmedUrl = dto.SourceUrl.Trim().TrimEnd('/');

        // Check duplicate URL logic
        var existingSources = await _dbContext.KnowledgeSources
            .Where(s => !s.IsDeleted && 
                        (s.SourceUrl.Trim().ToLower() == trimmedUrl.ToLower() || 
                         s.SourceUrl.Trim().TrimEnd('/').ToLower() == trimmedUrl.ToLower()))
            .ToListAsync();

        var existingSameClass = existingSources.FirstOrDefault(s => s.ModelClass == dto.ModelClass);

        if (dto.IsManualApproved && existingSources.Count >= 4)
        {
            return BadRequest(new { message = "Mỗi URL bài viết chỉ được phép lưu tối đa 4 đoạn nguyên văn theo quy tắc trích dẫn." });
        }

        if (existingSameClass != null && !existingSameClass.IsVerbatim)
        {
            return Conflict(new { message = $"URL này đã được lưu trước đó cho lớp '{dto.DiseaseName}' ({dto.ModelClass}) rồi. Vui lòng không lưu trùng!" });
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
            SourceScope = string.IsNullOrWhiteSpace(dto.SourceScope) ? "Việt Nam" : dto.SourceScope,
            EvidenceText = dto.EvidenceText ?? string.Empty,
            ContentType = string.IsNullOrWhiteSpace(dto.ContentType) ? "Triệu chứng & Biện pháp" : dto.ContentType,
            HasCultivationTechnique = dto.HasCultivationTechnique ?? false,
            SourceQuality = evaluatedQuality,
            IsManualApproved = dto.IsManualApproved,
            ReviewerNotes = dto.ReviewerNotes
        };

        _dbContext.KnowledgeSources.Add(source);
        await _dbContext.SaveChangesAsync();

        if (source.IsManualApproved)
        {
            await TriggerReindexAsync(source.Id.ToString(), "approve");
        }

        return Ok(source);
    }

    // 4.1. PATCH /api/v1/knowledge/sources/{id}/approve (Duyệt/Bỏ duyệt từng bài)
    [HttpPatch("sources/{id:guid}/approve")]
    public async Task<IActionResult> ApproveSource(Guid id, [FromBody] ApproveSourceRequestDto dto)
    {
        if (!IsAdminUser(out var authError))
        {
            return authError!;
        }

        var source = await _dbContext.KnowledgeSources.FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);
        if (source == null)
        {
            return NotFound(new { detail = "Không tìm thấy nguồn tri thức." });
        }

        source.IsManualApproved = dto.IsApproved;
        if (!string.IsNullOrWhiteSpace(dto.ReviewerNotes))
        {
            source.ReviewerNotes = dto.ReviewerNotes;
        }
        source.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        var reindexAction = dto.IsApproved ? "approve" : "unapprove";
        var reindexStatus = await TriggerReindexAsync(source.Id.ToString(), reindexAction);

        return Ok(new
        {
            source_id = source.Id,
            is_manual_approved = source.IsManualApproved,
            reindex_status = reindexStatus,
            updated_at = source.UpdatedAt
        });
    }

    // 4.2. PATCH /api/v1/knowledge/sources/approve-batch (Duyệt hàng loạt - Bulk Approve)
    [HttpPatch("sources/approve-batch")]
    public async Task<IActionResult> ApproveBatchSources([FromBody] ApproveBatchRequestDto dto)
    {
        if (!IsAdminUser(out var authError))
        {
            return authError!;
        }

        if (dto.SourceIds == null || dto.SourceIds.Count == 0)
        {
            return BadRequest(new { detail = "Danh sách source_ids không được để trống." });
        }

        var sources = await _dbContext.KnowledgeSources
            .Where(s => dto.SourceIds.Contains(s.Id) && !s.IsDeleted)
            .ToListAsync();

        if (sources.Count == 0)
        {
            return NotFound(new { detail = "Không tìm thấy nguồn tri thức nào phù hợp trong danh sách cung cấp." });
        }

        var now = DateTime.UtcNow;
        foreach (var s in sources)
        {
            s.IsManualApproved = dto.IsApproved;
            if (!string.IsNullOrWhiteSpace(dto.ReviewerNotes))
            {
                s.ReviewerNotes = dto.ReviewerNotes;
            }
            s.UpdatedAt = now;
        }

        await _dbContext.SaveChangesAsync();

        var reindexAction = dto.IsApproved ? "approve" : "unapprove";
        var reindexStatus = await TriggerReindexAsync(null, reindexAction);

        return Ok(new ApproveBatchResponseDto
        {
            ApprovedCount = sources.Count,
            Status = "success",
            ReindexStatus = reindexStatus,
            UpdatedAt = now
        });
    }

    // 4.3. POST /api/v1/knowledge/ingestions (Nhập bài báo - Bước 1: Dán văn bản, AI gợi ý đoạn)
    [HttpPost("ingestions")]
    public async Task<IActionResult> IngestArticle([FromBody] IngestArticleRequestDto dto)
    {
        if (!IsAdminUser(out var authError))
        {
            return authError!;
        }

        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        if (!dto.SourceUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) && 
            !dto.SourceUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { detail = "Đường dẫn bài viết phải là URL hợp lệ (http:// hoặc https://)." });
        }

        if (dto.ArticleText.Length > 50000)
        {
            return BadRequest(new { detail = "Văn bản bài báo không được vượt quá 50.000 ký tự." });
        }

        // Tách article_text thành các đoạn theo dòng trống (\n\s*\n)
        var rawParagraphs = Regex.Split(dto.ArticleText, @"\r?\n\s*\r?\n");
        var validParagraphs = new List<ParagraphDto>();
        int pIndex = 1;

        foreach (var raw in rawParagraphs)
        {
            var cleaned = raw.Trim();
            // Bỏ đoạn quá ngắn (< 40 ký tự)
            if (cleaned.Length >= 40)
            {
                validParagraphs.Add(new ParagraphDto
                {
                    Id = $"P{pIndex++}",
                    Text = cleaned,
                    SuggestedUnitType = null
                });

                if (validParagraphs.Count >= 200)
                {
                    break;
                }
            }
        }

        if (validParagraphs.Count == 0)
        {
            return BadRequest(new { detail = "Văn bản bài báo không có đoạn nào đạt độ dài tối thiểu (>= 40 ký tự)." });
        }

        // Gọi Agent Service để AI gợi ý nhãn theo số đoạn (timeout 35s, graceful fallback)
        var labelMap = await RequestAgentLabelingAsync(dto.ModelClass, validParagraphs);
        bool aiAvailable = labelMap.Count > 0;

        foreach (var p in validParagraphs)
        {
            if (labelMap.TryGetValue(p.Id, out var suggested))
            {
                p.SuggestedUnitType = suggested;
            }
        }

        var classMeta = All38Classes.FirstOrDefault(c => c.ModelClass == dto.ModelClass);
        var plantName = classMeta?.PlantName ?? "Cây trồng";
        var diseaseName = classMeta?.DiseaseName ?? dto.ModelClass;

        var ingestionId = $"ing-{Guid.NewGuid():N}"[..12];
        var expiresAt = DateTime.UtcNow.AddHours(1);

        var session = new CachedIngestionSession
        {
            IngestionId = ingestionId,
            ModelClass = dto.ModelClass,
            PlantName = plantName,
            DiseaseName = diseaseName,
            SourceUrl = dto.SourceUrl.Trim(),
            SourceTitle = dto.SourceTitle.Trim(),
            Organization = dto.Organization.Trim(),
            PublishedDate = dto.PublishedDate?.Trim(),
            Paragraphs = validParagraphs,
            CreatedAt = DateTime.UtcNow
        };

        _memoryCache.Set(ingestionId, session, TimeSpan.FromHours(1));

        return Ok(new IngestArticleResponseDto
        {
            IngestionId = ingestionId,
            ExpiresAt = expiresAt,
            Paragraphs = validParagraphs,
            AiSuggestionAvailable = aiAvailable
        });
    }

    // 4.4. POST /api/v1/knowledge/ingestions/{ingestion_id}/commit (Nhập bài báo - Bước 2: Admin tick chọn đoạn = Duyệt)
    [HttpPost("ingestions/{ingestionId}/commit")]
    public async Task<IActionResult> CommitIngestion(string ingestionId, [FromBody] CommitIngestionRequestDto dto)
    {
        if (!IsAdminUser(out var authError))
        {
            return authError!;
        }

        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        if (!_memoryCache.TryGetValue(ingestionId, out CachedIngestionSession? session) || session == null)
        {
            return StatusCode(StatusCodes.Status410Gone, new { detail = "Phiên nhập bài đã hết hạn hoặc không tồn tại. Vui lòng dán lại bài báo." });
        }

        if (dto.Selections == null || dto.Selections.Count == 0)
        {
            return BadRequest(new { detail = "Cần chọn ít nhất 1 đoạn trích dẫn để lưu." });
        }

        if (dto.Selections.Count > 4)
        {
            return BadRequest(new { detail = "Mỗi bài chỉ được trích dẫn tối đa 4 đoạn nguyên văn." });
        }

        var allowedUnitTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "SYMPTOMS", "CAUSE_CONDITIONS", "PREVENTION", "TREATMENT"
        };

        var selectedIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var sel in dto.Selections)
        {
            if (!allowedUnitTypes.Contains(sel.UnitType))
            {
                return BadRequest(new { detail = $"Loại nội dung '{sel.UnitType}' không hợp lệ. Chỉ chấp nhận: SYMPTOMS, CAUSE_CONDITIONS, PREVENTION, TREATMENT." });
            }

            if (!selectedIds.Add(sel.ParagraphId))
            {
                return BadRequest(new { detail = $"Đoạn '{sel.ParagraphId}' bị chọn trùng lặp." });
            }
        }

        // Kiểm tra tồn tại trong session RAM & độ dài <= 800 ký tự
        var sessionDict = session.Paragraphs.ToDictionary(p => p.Id, StringComparer.OrdinalIgnoreCase);
        var chosenParagraphs = new List<(string Id, string Text, string UnitType)>();

        foreach (var sel in dto.Selections)
        {
            if (!sessionDict.TryGetValue(sel.ParagraphId, out var para))
            {
                return BadRequest(new { detail = $"Không tìm thấy đoạn '{sel.ParagraphId}' trong phiên nhập bài." });
            }

            if (para.Text.Length > 800)
            {
                return BadRequest(new { detail = $"Đoạn '{sel.ParagraphId}' dài {para.Text.Length} ký tự, vượt quá giới hạn 800 ký tự cho phép." });
            }

            chosenParagraphs.Add((sel.ParagraphId, para.Text, sel.UnitType.ToUpperInvariant()));
        }

        // Kiểm tra số lượng đoạn nguyên văn đã lưu trong CSDL của URL này (chuẩn hoá)
        var normalizedUrl = NormalizeUrl(session.SourceUrl);
        var urlLock = _urlLocks.GetOrAdd(normalizedUrl, _ => new SemaphoreSlim(1, 1));
        await urlLock.WaitAsync();
        try
        {
            using var transaction = await _dbContext.Database.BeginTransactionAsync();

            var allVerbatim = await _dbContext.KnowledgeSources
                .Where(s => !s.IsDeleted && s.IsVerbatim)
                .ToListAsync();

            var existingVerbatim = allVerbatim
                .Where(s => NormalizeUrl(s.SourceUrl) == normalizedUrl)
                .ToList();

            if (existingVerbatim.Count + chosenParagraphs.Count > 4)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { detail = $"Bài báo này đã có {existingVerbatim.Count} đoạn nguyên văn. Thêm {chosenParagraphs.Count} đoạn sẽ vượt quá giới hạn tối đa 4 đoạn nguyên văn cho mỗi URL theo quy định trích dẫn hợp lý (Điều 25 Luật SHTT)." });
            }

            var createdSources = new List<KnowledgeSource>();
            var now = DateTime.UtcNow;

            foreach (var (pId, text, unitType) in chosenParagraphs)
            {
                var cleanText = text.Trim();
                // Bỏ qua nếu đoạn trùng chữ 100% với một đoạn đã lưu của cùng URL
                if (existingVerbatim.Any(e => e.EvidenceText.Trim().Equals(cleanText, StringComparison.OrdinalIgnoreCase)) ||
                    createdSources.Any(c => c.EvidenceText.Trim().Equals(cleanText, StringComparison.OrdinalIgnoreCase)))
                {
                    continue;
                }

                var contentType = unitType switch
                {
                    "SYMPTOMS" => "Triệu chứng",
                    "CAUSE_CONDITIONS" => "Nguyên nhân & Điều kiện phát sinh",
                    "PREVENTION" => "Biện pháp phòng ngừa",
                    "TREATMENT" => "Biện pháp điều trị",
                    _ => unitType
                };

                var source = new KnowledgeSource
                {
                    Id = Guid.NewGuid(),
                    ModelClass = session.ModelClass,
                    PlantName = session.PlantName,
                    DiseaseName = session.DiseaseName,
                    SourceUrl = normalizedUrl, // Lưu URL đã chuẩn hóa
                    SourceTitle = session.SourceTitle,
                    Organization = session.Organization,
                    PublishedDate = session.PublishedDate ?? "Không ghi ngày",
                    MatchLevel = "Khớp trực tiếp",
                    SourceScope = "Việt Nam",
                    EvidenceText = text, // 100% nguyên văn từ bản lưu tạm
                    ContentType = contentType,
                    UnitType = unitType,
                    IsVerbatim = true,
                    IsManualApproved = true, // Tick = Duyệt
                    SourceQuality = "Duyệt nguyên văn (HITL)",
                    ReviewerNotes = dto.ReviewerNotes ?? "Duyệt trích dẫn nguyên văn từ bài báo",
                    HasCultivationTechnique = false,
                    CreatedAt = now,
                    UpdatedAt = now
                };

                createdSources.Add(source);
            }

            if (createdSources.Count == 0)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { detail = "Tất cả các đoạn bạn chọn đều đã tồn tại trong CSDL cho bài viết này." });
            }

            _dbContext.KnowledgeSources.AddRange(createdSources);
            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();

            // Tự động gọi webhook reindex Agent Service
            var reindexStatus = await TriggerReindexAsync(null, "approve");

            return StatusCode(StatusCodes.Status201Created, new CommitIngestionResponseDto
            {
                CreatedSourceIds = createdSources.Select(s => s.Id.ToString()).ToList(),
                VerbatimCountForUrl = existingVerbatim.Count + createdSources.Count,
                ReindexStatus = reindexStatus
            });
        }
        finally
        {
            urlLock.Release();
        }
    }

    // 4.5. GET /api/v1/knowledge/reindex-status (Xem trạng thái reindex của Agent Service)
    [HttpGet("reindex-status")]
    public async Task<IActionResult> GetReindexStatus()
    {
        if (!IsAdminUser(out var authError))
        {
            return authError!;
        }

        try
        {
            var httpClient = _httpClientFactory.CreateClient("AgentServiceClient");
            var internalKey = GetInternalApiKey();

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            using var request = new HttpRequestMessage(HttpMethod.Get, "/internal/reindex/status");
            request.Headers.Add("X-Internal-Key", internalKey);

            var response = await httpClient.SendAsync(request, cts.Token);
            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync(cts.Token);
                return Content(content, "application/json");
            }

            return StatusCode((int)response.StatusCode, new { detail = "Không lấy được trạng thái reindex từ Agent service." });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Lỗi kết nối tới Agent service để lấy reindex status.");
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { detail = "Agent service chưa sẵn sàng hoặc không phản hồi." });
        }
    }

    // 5. DELETE /api/v1/knowledge/sources/{id}
    [HttpDelete("sources/{id:guid}")]
    public async Task<IActionResult> DeleteSource(Guid id)
    {
        if (!IsAdminUser(out var authError))
        {
            return authError!;
        }

        var item = await _dbContext.KnowledgeSources.FindAsync(id);
        if (item == null) return NotFound(new { message = "Không tìm thấy nguồn dữ liệu." });

        item.IsDeleted = true;
        item.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        await TriggerReindexAsync(item.Id.ToString(), "delete");

        return Ok(new { message = "Đã xóa nguồn dữ liệu thành công." });
    }

    // 6. GET /api/v1/knowledge/export
    [HttpGet("export")]
    public async Task<IActionResult> ExportCsv()
    {
        if (!IsAdminUser(out var authError))
        {
            return authError!;
        }

        var sources = await _dbContext.KnowledgeSources
            .Where(s => !s.IsDeleted)
            .OrderBy(s => s.ModelClass)
            .ToListAsync();

        var sb = new StringBuilder();
        // UTF-8 BOM for Excel support
        sb.Append('\uFEFF');
        sb.AppendLine("ID,Model_Class,Plant_Name,Disease_Name,Source_Title,Organization,Published_Date,Source_Scope,Source_URL,Content_Type,Has_Cultivation,Match_Level,Source_Quality,Is_Manual_Approved,Evidence_Text,Reviewer_Notes,Created_At");

        foreach (var s in sources)
        {
            var title = EscapeCsv(s.SourceTitle);
            var org = EscapeCsv(s.Organization);
            var pubDate = EscapeCsv(s.PublishedDate ?? "Không ghi ngày");
            var scope = EscapeCsv(s.SourceScope ?? "Việt Nam");
            var url = EscapeCsv(s.SourceUrl);
            var match = EscapeCsv(s.MatchLevel ?? "Khớp trực tiếp");
            var evidence = EscapeCsv(s.EvidenceText ?? "");
            var notes = EscapeCsv(s.ReviewerNotes ?? "");
            var hasCultivation = s.HasCultivationTechnique ? "Có" : "Không";

            sb.AppendLine($"{s.Id},{s.ModelClass},{s.PlantName},{s.DiseaseName},{title},{org},{pubDate},{scope},{url},{s.ContentType},{hasCultivation},{match},{s.SourceQuality},{s.IsManualApproved},{evidence},{notes},{s.CreatedAt:yyyy-MM-dd HH:mm}");
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

    private bool IsAdminUser(out IActionResult? errorResult)
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            if (User.IsInRole("ADMIN") || User.HasClaim(ClaimTypes.Role, "ADMIN") || User.HasClaim("role", "ADMIN"))
            {
                errorResult = null;
                return true;
            }

            errorResult = StatusCode(StatusCodes.Status403Forbidden, new { detail = "Yêu cầu quyền Quản trị viên (ADMIN) để thực hiện thao tác này." });
            return false;
        }

        if (AdminApiKeyAuthAttribute.HasValidKey(Request))
        {
            errorResult = null;
            return true;
        }

        errorResult = Unauthorized(new { detail = "Yêu cầu đăng nhập tài khoản Quản trị viên hoặc khóa X-Admin-Key hợp lệ." });
        return false;
    }

    private async Task<string> TriggerReindexAsync(string? sourceId, string action)
    {
        try
        {
            var httpClient = _httpClientFactory.CreateClient("AgentServiceClient");
            var internalKey = GetInternalApiKey();

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            using var request = new HttpRequestMessage(HttpMethod.Post, "/internal/reindex")
            {
                Content = JsonContent.Create(new AgentReindexRequest
                {
                    SourceId = sourceId,
                    Action = action
                })
            };
            request.Headers.Add("X-Internal-Key", internalKey);

            var response = await httpClient.SendAsync(request, cts.Token);
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Webhook /internal/reindex sent successfully (Action: {Action}, SourceId: {SourceId})", action, sourceId);
                return "accepted";
            }

            _logger.LogWarning("Webhook /internal/reindex returned non-success code: {StatusCode}", response.StatusCode);
            return "failed";
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to call /internal/reindex on agent-service (best-effort)");
            return "failed";
        }
    }

    private async Task<Dictionary<string, string>> RequestAgentLabelingAsync(string modelClass, List<ParagraphDto> paragraphs)
    {
        var labelMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        try
        {
            // CHỈ GỬI các đoạn có Text.Length <= 800 ký tự (các đoạn dài hơn không được chọn theo quy định và sẽ làm Agent 422)
            var eligibleParagraphs = paragraphs.Where(p => p.Text.Length <= 800).ToList();
            if (eligibleParagraphs.Count == 0)
            {
                return labelMap;
            }

            var httpClient = _httpClientFactory.CreateClient("AgentServiceClient");
            var internalKey = GetInternalApiKey();

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(35));
            var reqPayload = new AgentLabelParagraphsRequest
            {
                ModelClass = modelClass,
                Paragraphs = eligibleParagraphs.Select(p => new AgentParagraphItem { Id = p.Id, Text = p.Text }).ToList()
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, "/internal/knowledge/label-paragraphs")
            {
                Content = JsonContent.Create(reqPayload)
            };
            request.Headers.Add("X-Internal-Key", internalKey);

            var response = await httpClient.SendAsync(request, cts.Token);
            if (response.IsSuccessStatusCode)
            {
                var resDto = await response.Content.ReadFromJsonAsync<AgentLabelParagraphsResponse>(cancellationToken: cts.Token);
                if (resDto?.Labels != null)
                {
                    foreach (var item in resDto.Labels)
                    {
                        if (!string.IsNullOrWhiteSpace(item.Id) && !string.IsNullOrWhiteSpace(item.UnitType))
                        {
                            labelMap[item.Id] = item.UnitType;
                        }
                    }
                }
            }
            else
            {
                _logger.LogWarning("Agent service label-paragraphs returned status code {StatusCode}", response.StatusCode);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Timeout or error calling agent-service /internal/knowledge/label-paragraphs. Fallback to manual.");
        }

        return labelMap;
    }

    private string GetInternalApiKey()
    {
        var key = Environment.GetEnvironmentVariable("INTERNAL_API_SECRET")
               ?? _configuration["InternalApi:Secret"]
               ?? _configuration["INTERNAL_API_SECRET"];

        if (string.IsNullOrWhiteSpace(key))
        {
            throw new InvalidOperationException("Biến môi trường INTERNAL_API_SECRET chưa được cấu hình. Hệ thống từ chối thực hiện tác vụ nội bộ theo nguyên tắc Fail-Closed.");
        }

        return key;
    }

    public static string NormalizeUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return string.Empty;
        url = url.Trim();

        var hashIdx = url.IndexOf('#');
        if (hashIdx >= 0)
        {
            url = url[..hashIdx];
        }

        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            return url.Trim().TrimEnd('/').ToLowerInvariant();
        }

        var scheme = "https";
        var host = uri.Host.ToLowerInvariant();
        if (host.StartsWith("www."))
        {
            host = host[4..];
        }
        var port = (uri.Port == 80 || uri.Port == 443 || uri.IsDefaultPort) ? "" : $":{uri.Port}";
        var path = uri.AbsolutePath.TrimEnd('/');

        var query = uri.Query;
        if (!string.IsNullOrEmpty(query))
        {
            var queryParams = HttpUtility.ParseQueryString(query);
            var trackingKeys = queryParams.AllKeys
                .Where(k => string.IsNullOrWhiteSpace(k) ||
                            k.StartsWith("utm", StringComparison.OrdinalIgnoreCase) ||
                            k.Equals("fbclid", StringComparison.OrdinalIgnoreCase) ||
                            k.Equals("gclid", StringComparison.OrdinalIgnoreCase) ||
                            k.Equals("ref", StringComparison.OrdinalIgnoreCase) ||
                            k.Equals("source", StringComparison.OrdinalIgnoreCase))
                .ToList();

            foreach (var k in trackingKeys)
            {
                queryParams.Remove(k);
            }

            query = queryParams.Count > 0 ? "?" + queryParams.ToString() : "";
        }

        return $"{scheme}://{host}{port}{path}{query}".TrimEnd('/');
    }
}
