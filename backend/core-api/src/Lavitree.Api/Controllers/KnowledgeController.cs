using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Net.Sockets;
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
using Lavitree.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Lavitree.Application.DTOs;
using Lavitree.Application.Interfaces;
using Lavitree.Domain.Entities;
using Lavitree.Infrastructure.Persistence;
using Lavitree.Infrastructure.Services;

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
    private readonly IMinioStorageService _minioStorageService;

    public KnowledgeController(
        LavitreeDbContext dbContext,
        IHttpClientFactory httpClientFactory,
        IMemoryCache memoryCache,
        IConfiguration configuration,
        ILogger<KnowledgeController> logger,
        IMinioStorageService minioStorageService)
    {
        _dbContext = dbContext;
        _httpClientFactory = httpClientFactory;
        _memoryCache = memoryCache;
        _configuration = configuration;
        _logger = logger;
        _minioStorageService = minioStorageService;
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
        public int ArticleLength { get; set; }
        public string ArticleText { get; set; } = string.Empty;
        public List<ParagraphDto> Paragraphs { get; set; } = new();
        public SuggestedMetadataDto? SuggestedMetadata { get; set; }
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

    // BUG-31: giới hạn số dòng trả về
    private const int MaxSourcesPageSize = 200;
    private const int MaxPublicSourcesWithoutPaging = 500;

    // 3. GET /api/v1/knowledge/sources
    // Có page (từ 1) thì trả đúng trang (pageSize 1–200, mặc định 50). Không có page: Admin nhận đủ
    // (trang Duyệt tri thức cần toàn bộ), khách / nông dân tối đa 500 dòng mới nhất.
    // Header X-Total-Count luôn cho biết tổng số dòng khớp bộ lọc.
    [HttpGet("sources")]
    [EnableRateLimiting("public_api_policy")]
    public async Task<IActionResult> GetSources(
        [FromQuery] string? modelClass, 
        [FromQuery] string? search,
        [FromQuery] bool? isApproved,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        CancellationToken cancellationToken)
    {
        var isAdmin = User.IsAdmin();

        if (page is < 1 || pageSize is < 1 or > MaxSourcesPageSize)
        {
            return BadRequest(new { detail = $"page phải ≥ 1, pageSize từ 1 đến {MaxSourcesPageSize}." });
        }

        // Khách/Nông dân không có quyền lọc hoặc xem bài chưa duyệt
        if (!isAdmin && isApproved == false)
        {
            return Forbid();
        }

        var query = _dbContext.KnowledgeSources
            .Where(s => !s.IsDeleted)
            .OrderByDescending(s => s.CreatedAt)
            .ThenBy(s => s.Id) // nhiều đoạn cùng thời điểm tạo: cần thứ tự cố định để phân trang không lặp / sót
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

        Response.Headers["X-Total-Count"] = (await query.CountAsync(cancellationToken)).ToString();
        if (page.HasValue)
        {
            var size = pageSize ?? 50;
            query = query.Skip((page.Value - 1) * size).Take(size);
        }
        else if (!isAdmin)
        {
            query = query.Take(MaxPublicSourcesWithoutPaging);
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
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> CreateSource([FromBody] CreateSourceDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ModelClass) || string.IsNullOrWhiteSpace(dto.SourceUrl))
        {
            return BadRequest(new { message = "Vui lòng chọn lớp cây–bệnh và nhập đường dẫn URL." });
        }

        // BUG-32: link nguồn hiện cho nông dân bấm, chỉ nhận http/https (chặn javascript:, data:, file:)
        if (dto.SourceUrl.Length > 2048
            || !Uri.TryCreate(dto.SourceUrl.Trim(), UriKind.Absolute, out var sourceUri)
            || (sourceUri.Scheme != Uri.UriSchemeHttp && sourceUri.Scheme != Uri.UriSchemeHttps))
        {
            return BadRequest(new { message = "Đường dẫn nguồn phải là URL http:// hoặc https:// (tối đa 2048 ký tự)." });
        }

        var trimmedUrl = dto.SourceUrl.Trim().TrimEnd('/');

        // Check duplicate URL logic
        var existingSources = await _dbContext.KnowledgeSources
            .Where(s => !s.IsDeleted && 
                        (s.SourceUrl.Trim().ToLower() == trimmedUrl.ToLower() || 
                         s.SourceUrl.Trim().TrimEnd('/').ToLower() == trimmedUrl.ToLower()))
            .ToListAsync();

        var existingSameClass = existingSources.FirstOrDefault(s => s.ModelClass == dto.ModelClass);

        if (dto.IsManualApproved && existingSources.Count >= 8)
        {
            return BadRequest(new { message = "Mỗi URL bài viết chỉ được phép lưu tối đa 8 đoạn nguyên văn theo quy tắc trích dẫn (TASK-15)." });
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
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> ApproveSource(Guid id, [FromBody] ApproveSourceRequestDto dto)
    {
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
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> ApproveBatchSources([FromBody] ApproveBatchRequestDto dto)
    {
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

    private static readonly HashSet<string> VerbatimUnitTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "SYMPTOMS", "CAUSE_CONDITIONS", "PREVENTION", "TREATMENT"
    };

    private static string CollapseWhitespace(string text) => Regex.Replace(text, @"\s+", " ").Trim();

    private static string ContentTypeForUnit(string unitType) => unitType switch
    {
        "SYMPTOMS" => "Triệu chứng",
        "CAUSE_CONDITIONS" => "Nguyên nhân & Điều kiện phát sinh",
        "PREVENTION" => "Biện pháp phòng ngừa",
        "TREATMENT" => "Biện pháp điều trị",
        _ => unitType
    };

    private static string ResolveSourceScope(string? requestedScope, string? sourceUrl, string? organization)
    {
        if (!string.IsNullOrWhiteSpace(requestedScope))
        {
            var trimmed = requestedScope.Trim();
            if (trimmed.Contains("quốc tế", StringComparison.OrdinalIgnoreCase)
                || trimmed.Contains("nước ngoài", StringComparison.OrdinalIgnoreCase)
                || trimmed.Contains("international", StringComparison.OrdinalIgnoreCase)
                || trimmed.Contains("foreign", StringComparison.OrdinalIgnoreCase))
            {
                return "Quốc tế";
            }
            if (trimmed.Contains("việt nam", StringComparison.OrdinalIgnoreCase)
                || trimmed.Contains("vietnam", StringComparison.OrdinalIgnoreCase)
                || trimmed.Equals("vn", StringComparison.OrdinalIgnoreCase))
            {
                return "Việt Nam";
            }
        }

        var url = (sourceUrl ?? string.Empty).ToLowerInvariant();
        var org = (organization ?? string.Empty).ToLowerInvariant();

        string host = string.Empty;
        if (Uri.TryCreate(sourceUrl, UriKind.Absolute, out var parsedUri))
        {
            host = parsedUri.Host.ToLowerInvariant();
        }

        if (host.EndsWith(".vn"))
        {
            return "Việt Nam";
        }

        if ((host.EndsWith(".edu") || host.EndsWith(".gov") || host.Contains(".ac.")) && !host.EndsWith(".vn"))
        {
            return "Quốc tế";
        }

        if (host.Contains("extension.")
            || host.Contains("cabi.org")
            || host.Contains("fao.org")
            || host.Contains("apsnet.org")
            || host.Contains("mdpi.com")
            || host.Contains("sciencedirect.com")
            || org.Contains("extension")
            || org.Contains("university")
            || org.Contains("usda")
            || org.Contains("cabi")
            || org.Contains("fao")
            || org.Contains("đại học tiểu bang"))
        {
            return "Quốc tế";
        }

        if (org.Contains("việt nam")
            || org.Contains("khuyến nông")
            || org.Contains("cục bvtv")
            || org.Contains("nông nghiệp")
            || org.Contains("viện cây")
            || org.Contains("học viện nông nghiệp")
            || org.Contains("sở nn"))
        {
            return "Việt Nam";
        }

        return "Việt Nam";
    }

    private async Task<List<KnowledgeSource>> LoadArticleRowsAsync(string normalizedUrl, bool tracking)
    {
        // URL cũ (seed CSV) có thể chưa chuẩn hoá nên so khớp sau khi chuẩn hoá cả hai phía
        var query = _dbContext.KnowledgeSources.Where(s => !s.IsDeleted);
        if (!tracking) query = query.AsNoTracking();
        var all = await query.ToListAsync();
        return all.Where(s => NormalizeUrl(s.SourceUrl) == normalizedUrl)
            .OrderByDescending(s => s.IsVerbatim)
            .ThenBy(s => s.CreatedAt)
            .ToList();
    }

    // 4.2a. GET /api/v1/knowledge/sources/by-url?url=... (Mở lại bài đã lưu để sửa)
    [HttpGet("sources/by-url")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> GetArticleByUrl([FromQuery] string? url)
    {
        var normalizedUrl = NormalizeUrl(url ?? string.Empty);
        if (string.IsNullOrEmpty(normalizedUrl))
        {
            return BadRequest(new { detail = "URL bài viết không hợp lệ (chỉ hỗ trợ http:// hoặc https://)." });
        }

        var rows = await LoadArticleRowsAsync(normalizedUrl, tracking: false);
        if (rows.Count == 0)
        {
            return NotFound(new { detail = "Không tìm thấy bài viết đã lưu với URL này." });
        }

        return Ok(new
        {
            source_url = rows[0].SourceUrl,
            normalized_url = normalizedUrl,
            verbatim_count = rows.Count(r => r.IsVerbatim),
            verbatim_chars = rows.Where(r => r.IsVerbatim).Sum(r => (r.EvidenceText ?? string.Empty).Length),
            sources = rows
        });
    }

    // 4.2b. PATCH /api/v1/knowledge/sources/by-url (Sửa thông tin chung của bài, áp cho mọi đoạn cùng URL)
    [HttpPatch("sources/by-url")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> UpdateArticle([FromBody] UpdateArticleRequestDto dto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var normalizedUrl = NormalizeUrl(dto.SourceUrl);
        if (string.IsNullOrEmpty(normalizedUrl))
        {
            return BadRequest(new { detail = "URL bài viết không hợp lệ (chỉ hỗ trợ http:// hoặc https://)." });
        }
        ClassMetadata? classMeta = null;
        if (!string.IsNullOrWhiteSpace(dto.ModelClass))
        {
            classMeta = All38Classes.FirstOrDefault(c => c.ModelClass == dto.ModelClass.Trim());
            if (classMeta == null)
            {
                return BadRequest(new { detail = $"Mã lớp '{dto.ModelClass}' không thuộc 38 lớp được hỗ trợ." });
            }
        }

        var urlLock = _urlLocks.GetOrAdd(normalizedUrl, _ => new SemaphoreSlim(1, 1));
        await urlLock.WaitAsync();
        try
        {
            var rows = await LoadArticleRowsAsync(normalizedUrl, tracking: true);
            if (rows.Count == 0)
            {
                return NotFound(new { detail = "Không tìm thấy bài viết đã lưu với URL này." });
            }

            var now = DateTime.UtcNow;
            var changedIds = new List<Guid>();
            foreach (var s in rows)
            {
                var before = (s.ModelClass, s.SourceTitle, s.Organization, s.PublishedDate, s.SourceScope);
                if (classMeta != null)
                {
                    s.ModelClass = classMeta.ModelClass;
                    s.PlantName = classMeta.PlantName;
                    s.DiseaseName = classMeta.DiseaseName;
                }
                if (!string.IsNullOrWhiteSpace(dto.SourceTitle)) s.SourceTitle = dto.SourceTitle.Trim();
                if (!string.IsNullOrWhiteSpace(dto.Organization)) s.Organization = dto.Organization.Trim();
                if (dto.PublishedDate != null)
                {
                    s.PublishedDate = string.IsNullOrWhiteSpace(dto.PublishedDate) ? "Không ghi ngày" : dto.PublishedDate.Trim();
                }
                if (!string.IsNullOrWhiteSpace(dto.SourceScope))
                {
                    s.SourceScope = ResolveSourceScope(dto.SourceScope, normalizedUrl, s.Organization);
                }

                if (before != (s.ModelClass, s.SourceTitle, s.Organization, s.PublishedDate, s.SourceScope))
                {
                    // Sửa xong phải duyệt lại; bỏ duyệt + reindex để Lavi không dùng bản cũ trong lúc chờ
                    s.IsManualApproved = false;
                    s.ReviewerNotes = "Đã sửa thông tin bài, chờ duyệt lại";
                    s.UpdatedAt = now;
                    changedIds.Add(s.Id);
                }
            }

            if (changedIds.Count == 0)
            {
                return Ok(new { updated_count = 0, reindex_status = "skipped" });
            }

            if (classMeta != null)
            {
                // Gợi ý vật tư chưa xử lý đi theo bệnh mới của bài
                var pending = await _dbContext.ProductSuggestions
                    .Where(p => !p.IsDeleted && p.Status == "PENDING" && changedIds.Contains(p.KnowledgeSourceId))
                    .ToListAsync();
                foreach (var p in pending) p.ModelClass = classMeta.ModelClass;
            }

            await _dbContext.SaveChangesAsync();
            var reindexStatus = await TriggerReindexAsync(null, "unapprove");

            return Ok(new { updated_count = changedIds.Count, reindex_status = reindexStatus });
        }
        finally
        {
            urlLock.Release();
        }
    }

    // 4.2c. PATCH /api/v1/knowledge/sources/{id} (Sửa một đoạn: nguyên văn chỉ đổi loại, tóm tắt sửa được chữ)
    [HttpPatch("sources/{id:guid}")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> UpdateSourceUnit(Guid id, [FromBody] UpdateSourceUnitRequestDto dto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var source = await _dbContext.KnowledgeSources.FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);
        if (source == null)
        {
            return NotFound(new { detail = "Không tìm thấy đoạn tri thức." });
        }

        var changed = false;
        if (!string.IsNullOrWhiteSpace(dto.ModelClass))
        {
            var targetClass = dto.ModelClass.Trim();
            var classMeta = All38Classes.FirstOrDefault(c => c.ModelClass == targetClass);
            if (classMeta == null)
            {
                return BadRequest(new { detail = $"Mã lớp '{dto.ModelClass}' không thuộc 38 lớp được hỗ trợ." });
            }
            if (source.ModelClass != classMeta.ModelClass)
            {
                source.ModelClass = classMeta.ModelClass;
                source.PlantName = classMeta.PlantName;
                source.DiseaseName = classMeta.DiseaseName;

                var pendingSuggestions = await _dbContext.ProductSuggestions
                    .Where(p => !p.IsDeleted && p.Status == "PENDING" && p.KnowledgeSourceId == source.Id)
                    .ToListAsync();
                foreach (var p in pendingSuggestions)
                {
                    p.ModelClass = classMeta.ModelClass;
                }

                changed = true;
            }
        }

        if (!string.IsNullOrWhiteSpace(dto.UnitType))
        {
            var unit = dto.UnitType.Trim().ToUpperInvariant();
            if (!source.IsVerbatim)
            {
                if (unit != (source.UnitType ?? "SUMMARY").ToUpperInvariant())
                {
                    return BadRequest(new { detail = "Đoạn tóm tắt không đổi loại được. Muốn có đoạn Triệu chứng/Phòng trị, hãy dán lại bài và chọn đoạn nguyên văn." });
                }
            }
            else
            {
                if (!VerbatimUnitTypes.Contains(unit))
                {
                    return BadRequest(new { detail = $"Loại nội dung '{dto.UnitType}' không hợp lệ. Chỉ chấp nhận: SYMPTOMS, CAUSE_CONDITIONS, PREVENTION, TREATMENT." });
                }
                if (!string.Equals(source.UnitType, unit, StringComparison.OrdinalIgnoreCase))
                {
                    source.UnitType = unit;
                    source.ContentType = ContentTypeForUnit(unit);
                    changed = true;
                }
            }
        }

        if (dto.EvidenceText != null && dto.EvidenceText.Trim() != (source.EvidenceText ?? string.Empty).Trim())
        {
            if (source.IsVerbatim)
            {
                // Sửa chữ thì không còn là nguyên văn của bài báo, Lavi sẽ trích sai lời nguồn
                return BadRequest(new { detail = "Không sửa chữ trong đoạn nguyên văn. Nếu cần đoạn khác, hãy xoá đoạn này rồi dán lại bài để chọn đoạn mới." });
            }
            if (dto.EvidenceText.Trim().Length < 20)
            {
                return BadRequest(new { detail = "Đoạn tóm tắt phải có ít nhất 20 ký tự." });
            }
            source.EvidenceText = dto.EvidenceText.Trim();
            changed = true;
        }

        if (!changed)
        {
            return Ok(new { source_id = source.Id, is_manual_approved = source.IsManualApproved, reindex_status = "skipped" });
        }

        source.IsManualApproved = false;
        source.ReviewerNotes = "Đã sửa đoạn, chờ duyệt lại";
        source.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        var reindexStatus = await TriggerReindexAsync(source.Id.ToString(), "unapprove");
        return Ok(new { source_id = source.Id, is_manual_approved = false, reindex_status = reindexStatus });
    }

    // 4.2d. POST /api/v1/knowledge/fetch-url (Tải HTML bài báo từ URL an toàn chống SSRF cho Admin)
    [HttpPost("fetch-url")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> FetchArticleUrl([FromBody] FetchUrlRequestDto dto, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var (currentUri, validationError) = await ValidateSafePublicUrlAsync(dto.Url, cancellationToken);
        if (currentUri == null)
        {
            return BadRequest(new { detail = validationError ?? "URL không hợp lệ." });
        }

        var fetched = await FetchPublicHtmlAsync(currentUri, cancellationToken);
        if (fetched.Html == null)
        {
            return fetched.ErrorStatus == 400
                ? BadRequest(new { detail = fetched.Error })
                : StatusCode(StatusCodes.Status422UnprocessableEntity, new { detail = fetched.Error });
        }

        return Ok(new FetchUrlResponseDto
        {
            Url = fetched.FinalUri!.ToString(),
            Html = fetched.Html
        });
    }

    // 4.2e. POST /api/v1/knowledge/verify-quotes (TASK-18-R4)
    // Kiểm tra câu "trích nguyên văn" AI đưa ra có thật trong trang nguồn không. Tải trang qua FetchPublicHtmlAsync (chống SSRF).
    private const int MaxVerifyItems = 8;
    private const int MaxVerifyUrls = 5;

    [HttpPost("verify-quotes")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> VerifyQuotes([FromBody] VerifyQuotesRequestDto dto, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }
        var items = (dto.Items ?? new List<VerifyQuoteItemDto>())
            .Where(i => !string.IsNullOrWhiteSpace(i.Url))
            .Select(i => new VerifyQuoteItemDto { Url = i.Url.Trim(), Quote = i.Quote?.Trim() })
            .ToList();
        if (items.Count == 0)
        {
            return BadRequest(new { detail = "Không có link nào để kiểm tra." });
        }
        if (items.Count > MaxVerifyItems || items.Select(i => i.Url).Distinct().Count() > MaxVerifyUrls)
        {
            return BadRequest(new { detail = $"Kiểm tra tối đa {MaxVerifyItems} câu trích trên {MaxVerifyUrls} link mỗi lần." });
        }

        // Tải mỗi link một lần, song song
        var pages = new Dictionary<string, (string? Text, string? Error, bool Invalid)>();
        var tasks = items.Select(i => i.Url).Distinct().Select(async url =>
        {
            var (uri, invalid) = await ValidateSafePublicUrlAsync(url, cancellationToken);
            if (uri == null) return (url, (Text: (string?)null, Error: invalid, Invalid: true));
            var fetched = await FetchPublicHtmlAsync(uri, cancellationToken);
            return fetched.Html == null
                ? (url, (Text: (string?)null, Error: fetched.Error, Invalid: fetched.ErrorStatus == 400))
                : (url, (Text: QuoteMatcher.HtmlToText(fetched.Html), Error: (string?)null, Invalid: false));
        });
        foreach (var (url, page) in await Task.WhenAll(tasks))
        {
            pages[url] = page;
        }

        var results = items.Select(i =>
        {
            var page = pages[i.Url];
            if (page.Text == null)
            {
                return new VerifyQuoteResultDto
                {
                    Url = i.Url,
                    Quote = i.Quote,
                    Status = page.Invalid ? "INVALID_URL" : "FETCH_FAILED",
                    Detail = page.Error
                };
            }
            if (string.IsNullOrWhiteSpace(i.Quote))
            {
                return new VerifyQuoteResultDto { Url = i.Url, Status = "NO_QUOTE", Detail = "Trang mở được nhưng không có câu trích để đối chiếu." };
            }
            var m = QuoteMatcher.Match(page.Text, i.Quote);
            return new VerifyQuoteResultDto
            {
                Url = i.Url,
                Quote = i.Quote,
                Status = m.Status,
                Score = m.Score,
                PageSnippet = m.PageSnippet,
                MissingNumbers = m.MissingNumbers
            };
        }).ToList();

        return Ok(new { results });
    }

    private sealed record SafeFetchResult(string? Html, Uri? FinalUri, int ErrorStatus, string? Error);

    /// <summary>
    /// Tải HTML từ URL công khai, chống SSRF (chặn IP nội bộ lúc kết nối, kiểm tra lại từng lần chuyển hướng,
    /// tối đa 3 lần), tối đa 2 MB, hết giờ 15 giây. Dùng chung cho fetch-url và verify-quotes.
    /// ErrorStatus: 400 = URL không an toàn, 422 = trang không tải được.
    /// </summary>
    private async Task<SafeFetchResult> FetchPublicHtmlAsync(Uri currentUri, CancellationToken cancellationToken)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(TimeSpan.FromSeconds(15));

        using var handler = new SocketsHttpHandler
        {
            AllowAutoRedirect = false,
            UseProxy = false,
            ConnectTimeout = TimeSpan.FromSeconds(10),
            AutomaticDecompression = DecompressionMethods.All,
            ConnectCallback = async (context, token) =>
            {
                var hostIps = await Dns.GetHostAddressesAsync(context.DnsEndPoint.Host, token);
                var safeIps = hostIps.Where(ip => !IsPrivateOrReservedIp(ip)).ToArray();
                if (safeIps.Length == 0 || safeIps.Length != hostIps.Length)
                {
                    throw new HttpRequestException("Địa chỉ IP đích nằm trong dải mạng nội bộ bị chặn (SSRF protection).");
                }

                Exception? lastEx = null;
                foreach (var ip in safeIps)
                {
                    var socket = new Socket(ip.AddressFamily, SocketType.Stream, ProtocolType.Tcp)
                    {
                        NoDelay = true
                    };
                    try
                    {
                        await socket.ConnectAsync(ip, context.DnsEndPoint.Port, token);
                        return new NetworkStream(socket, ownsSocket: true);
                    }
                    catch (Exception ex)
                    {
                        socket.Dispose();
                        lastEx = ex;
                    }
                }
                throw lastEx ?? new HttpRequestException("Không thể kết nối tới máy chủ bài báo.");
            }
        };

        using var httpClient = new HttpClient(handler)
        {
            Timeout = TimeSpan.FromSeconds(15)
        };

        try
        {
            HttpResponseMessage? response = null;
            const int maxRedirects = 3;

            for (int hop = 0; hop <= maxRedirects; hop++)
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, currentUri);
                req.Headers.TryAddWithoutValidation("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36");
                req.Headers.TryAddWithoutValidation("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
                req.Headers.TryAddWithoutValidation("Accept-Language", "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7");

                response?.Dispose();
                response = await httpClient.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cts.Token);

                var statusCode = (int)response.StatusCode;
                if (statusCode is 301 or 302 or 303 or 307 or 308 && response.Headers.Location != null)
                {
                    if (hop == maxRedirects)
                    {
                        response.Dispose();
                        return new SafeFetchResult(null, null, 422, "Trang web chuyển hướng quá nhiều lần. Vui lòng mở trang gốc và nhấn Ctrl+A, Ctrl+C để copy thủ công.");
                    }

                    var nextUri = response.Headers.Location.IsAbsoluteUri
                        ? response.Headers.Location
                        : new Uri(currentUri, response.Headers.Location);

                    var (validatedNext, redirectErr) = await ValidateSafePublicUrlAsync(nextUri.ToString(), cts.Token);
                    if (validatedNext == null)
                    {
                        response.Dispose();
                        return new SafeFetchResult(null, null, 400, redirectErr ?? "Chuyển hướng sang URL không an toàn (SSRF protection).");
                    }

                    currentUri = validatedNext;
                    continue;
                }

                break;
            }

            if (response == null)
            {
                return new SafeFetchResult(null, null, 422, "Trang web không phản hồi. Vui lòng mở trang gốc và nhấn Ctrl+A, Ctrl+C để copy thủ công.");
            }

            using (response)
            {
                if (!response.IsSuccessStatusCode)
                {
                    return new SafeFetchResult(null, null, 422, $"Trang web không cho phép tải tự động hoặc phản hồi lỗi (HTTP {(int)response.StatusCode}). Vui lòng mở trang gốc và nhấn Ctrl+A, Ctrl+C để copy thủ công.");
                }

                var mediaType = response.Content.Headers.ContentType?.MediaType;
                if (!string.IsNullOrWhiteSpace(mediaType) &&
                    !mediaType.Contains("html", StringComparison.OrdinalIgnoreCase) &&
                    !mediaType.Contains("xml", StringComparison.OrdinalIgnoreCase) &&
                    !mediaType.StartsWith("text/", StringComparison.OrdinalIgnoreCase))
                {
                    return new SafeFetchResult(null, null, 422, $"URL trả về định dạng '{mediaType}' không phải trang web HTML. Vui lòng copy nội dung thủ công.");
                }

                var html = await ReadLimitedHtmlAsync(response.Content, maxBytes: 2 * 1024 * 1024, cts.Token);
                if (string.IsNullOrWhiteSpace(html))
                {
                    return new SafeFetchResult(null, null, 422, "Trang web trả về nội dung trống (có thể trang dùng JavaScript render). Vui lòng mở trang gốc và nhấn Ctrl+A, Ctrl+C để copy thủ công.");
                }

                return new SafeFetchResult(html, currentUri, 0, null);
            }
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Failed to fetch article URL safely: {Url}", currentUri);
            if (ex.Message.Contains("SSRF", StringComparison.OrdinalIgnoreCase))
            {
                return new SafeFetchResult(null, null, 400, ex.Message);
            }
            return new SafeFetchResult(null, null, 422, "Trang web không cho phép tải tự động hoặc phản hồi lỗi. Vui lòng mở trang gốc và nhấn Ctrl+A, Ctrl+C để copy thủ công.");
        }
        catch (OperationCanceledException)
        {
            return new SafeFetchResult(null, null, 422, "Hết thời gian chờ tải trang web (15s). Vui lòng mở trang gốc và nhấn Ctrl+A, Ctrl+C để copy thủ công.");
        }
    }

    // 4.3. POST /api/v1/knowledge/ingestions (Nhập bài báo - Bước 1: Dán văn bản, AI gợi ý đoạn)
    [HttpPost("ingestions")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> IngestArticle([FromBody] IngestArticleRequestDto dto)
    {
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

        // Gom tiêu đề mục, câu dẫn kết thúc bằng dấu ':' hoặc '?' và các ý con cùng mục trước khi tách đoạn
        var coalescedText = CoalesceArticleParagraphs(dto.ArticleText);
        // Tách article_text đã gom thành các đoạn theo dòng trống (\n\s*\n)
        var rawParagraphs = Regex.Split(coalescedText, @"\r?\n\s*\r?\n");
        var validParagraphs = new List<ParagraphDto>();
        int pIndex = 1;

        // Tiêu đề mục ngắn ("Biện pháp hóa học:", "4. Biện pháp quản lý", "Disease Cycle") được ghép vào đoạn ngay sau
        // để không mất ngữ cảnh; dòng ngắn và dòng siêu dữ liệu đơn thuần (< 240 ký tự) không đẩy vào danh sách đoạn
        // vì BuildArticleMetaContext(dto.ArticleText) đã gửi ngữ cảnh đầu/cuối bài qua META_CONTEXT cho Agent Service.
        string? pendingHeading = null;
        foreach (var raw in rawParagraphs)
        {
            var cleaned = Regex.Replace(raw.Trim(), @"[ \t]+", " ");
            if (cleaned.Length == 0 || IsContactOrAdNoise(cleaned)) continue;
            if (Regex.IsMatch(cleaned, @"^#\s+\S") && !cleaned.Contains('\n') && !Regex.IsMatch(cleaned, @"[.!?]$") && cleaned.Length < 180)
            {
                continue;
            }

            if (cleaned.Length < 40)
            {
                if (IsSectionHeading(cleaned))
                {
                    pendingHeading = cleaned;
                }
                continue;
            }
            if (IsStandaloneMetadataBlock(cleaned))
            {
                continue;
            }
            if (pendingHeading != null)
            {
                if (Regex.IsMatch(pendingHeading, @"^#{2,6}\s+"))
                {
                    cleaned = $"{pendingHeading}\n{cleaned}";
                }
                else
                {
                    cleaned = pendingHeading.EndsWith(':') || pendingHeading.EndsWith('.') || pendingHeading.EndsWith('!') || pendingHeading.EndsWith('?')
                        ? $"{pendingHeading} {cleaned}"
                        : $"{pendingHeading}: {cleaned}";
                }
                pendingHeading = null;
            }

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

        // Gọi Agent Service để AI gợi ý nhãn theo số đoạn & trích xuất metadata (timeout 35s, graceful fallback)
        var (labelMap, agentMetadata) = await RequestAgentLabelingAsync(dto.ModelClass, validParagraphs, dto.ArticleText);
        bool aiAvailable = labelMap.Count > 0 || agentMetadata != null;

        foreach (var p in validParagraphs)
        {
            if (labelMap.TryGetValue(p.Id, out var labelItem))
            {
                p.SuggestedUnitType = labelItem.UnitType;
                p.Mentions = labelItem.Mentions ?? new List<MentionDto>();
            }
        }

        // Ưu tiên: Nếu Admin đã điền ở Bước 1 thì dùng của Admin, ngược lại lấy gợi ý từ Agent
        var chosenModelClass = !string.IsNullOrWhiteSpace(dto.ModelClass) 
            ? dto.ModelClass.Trim() 
            : (agentMetadata?.ModelClass?.Trim() ?? string.Empty);

        var chosenSourceTitle = !string.IsNullOrWhiteSpace(dto.SourceTitle)
            ? dto.SourceTitle.Trim()
            : (agentMetadata?.SourceTitle?.Trim() ?? string.Empty);

        var chosenOrg = !string.IsNullOrWhiteSpace(dto.Organization)
            ? dto.Organization.Trim()
            : (agentMetadata?.Organization?.Trim() ?? string.Empty);

        var chosenDate = !string.IsNullOrWhiteSpace(dto.PublishedDate)
            ? dto.PublishedDate.Trim()
            : agentMetadata?.PublishedDate?.Trim();

        var classMeta = All38Classes.FirstOrDefault(c => c.ModelClass == chosenModelClass);
        var plantName = classMeta?.PlantName ?? "Cây trồng";
        var diseaseName = classMeta?.DiseaseName ?? chosenModelClass;

        var ingestionId = $"ing-{Guid.NewGuid():N}"[..12];
        var expiresAt = DateTime.UtcNow.AddHours(1);

        var suggestedMetadataDto = new SuggestedMetadataDto
        {
            ModelClass = string.IsNullOrWhiteSpace(chosenModelClass) ? null : chosenModelClass,
            SourceTitle = string.IsNullOrWhiteSpace(chosenSourceTitle) ? null : chosenSourceTitle,
            Organization = string.IsNullOrWhiteSpace(chosenOrg) ? null : chosenOrg,
            PublishedDate = chosenDate
        };

        var session = new CachedIngestionSession
        {
            IngestionId = ingestionId,
            ModelClass = chosenModelClass,
            PlantName = plantName,
            DiseaseName = diseaseName,
            SourceUrl = dto.SourceUrl.Trim(),
            SourceTitle = chosenSourceTitle,
            Organization = chosenOrg,
            PublishedDate = chosenDate,
            ArticleLength = dto.ArticleText.Length,
            ArticleText = dto.ArticleText,
            Paragraphs = validParagraphs,
            SuggestedMetadata = suggestedMetadataDto,
            CreatedAt = DateTime.UtcNow
        };

        // BUG-35: cache có SizeLimit nên phải khai báo Size; ưu tiên cao để phiên của Admin
        // không bị dọn trước các mục thời tiết khi cache gần đầy
        _memoryCache.Set(ingestionId, session, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1),
            Size = 1,
            Priority = CacheItemPriority.High
        });

        return Ok(new IngestArticleResponseDto
        {
            IngestionId = ingestionId,
            ExpiresAt = expiresAt,
            ArticleLength = dto.ArticleText.Length,
            Paragraphs = validParagraphs,
            SuggestedMetadata = suggestedMetadataDto,
            AiSuggestionAvailable = aiAvailable
        });
    }

    // 4.4. POST /api/v1/knowledge/ingestions/{ingestion_id}/commit (Nhập bài báo - Bước 2: Admin tick chọn đoạn = Duyệt)
    [HttpPost("ingestions/{ingestionId}/commit")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> CommitIngestion(string ingestionId, [FromBody] CommitIngestionRequestDto dto)
    {
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

        var maxChunks = GetIngestConfigInt("INGEST_MAX_CHUNKS", "KnowledgeIngestion:MaxChunks", 30, 1, 100);
        var maxChunkChars = GetIngestConfigInt("INGEST_MAX_CHUNK_CHARS", "KnowledgeIngestion:MaxChunkChars", 5000, 100, 10000);
        var maxRatioPercent = GetIngestConfigInt("INGEST_MAX_RATIO_PERCENT", "KnowledgeIngestion:MaxRatioPercent", 90, 10, 100);
        var minQuotaFloor = GetIngestConfigInt("INGEST_MIN_QUOTA_FLOOR", "KnowledgeIngestion:MinQuotaFloor", 20000, 500, 50000);

        if (dto.Selections.Count > maxChunks)
        {
            return BadRequest(new { detail = $"Mỗi bài chỉ được trích dẫn tối đa {maxChunks} đoạn nguyên văn." });
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

        // Kiểm tra tồn tại trong session RAM & độ dài <= 1500 ký tự (hỗ trợ đoạn tách và chỉnh sửa mentions)
        var sessionDict = session.Paragraphs.ToDictionary(p => p.Id, StringComparer.OrdinalIgnoreCase);
        var chosenParagraphs = new List<(string Id, string Text, string UnitType, List<MentionDto> Mentions, string? ModelClass)>();

        foreach (var sel in dto.Selections)
        {
            string chosenText;
            List<MentionDto> chosenMentions;

            // Đoạn gốc (P3) hoặc đoạn tách từ đoạn gốc (P3_1, P3_2). So với đoạn đã tách trong phiên,
            // không so với toàn văn: Core đã ghép tiêu đề mục vào đầu đoạn và gộp khoảng trắng nên
            // đoạn hợp lệ không còn nằm nguyên chuỗi trong toàn văn. So khớp phân biệt hoa thường.
            var baseId = sel.ParagraphId;
            if (!sessionDict.ContainsKey(baseId))
            {
                var cut = baseId.IndexOf('_');
                if (cut > 0) baseId = baseId[..cut];
            }

            if (!sessionDict.TryGetValue(baseId, out var para))
            {
                return BadRequest(new { detail = $"Không tìm thấy đoạn '{sel.ParagraphId}' trong phiên nhập bài." });
            }

            var isSplitPart = !string.Equals(baseId, sel.ParagraphId, StringComparison.OrdinalIgnoreCase);
            if (isSplitPart && string.IsNullOrWhiteSpace(sel.CustomText))
            {
                return BadRequest(new { detail = $"Thiếu nội dung đoạn tách '{sel.ParagraphId}'." });
            }

            if (!string.IsNullOrWhiteSpace(sel.CustomText))
            {
                chosenText = CollapseWhitespace(sel.CustomText);
                if (!CollapseWhitespace(para.Text).Contains(chosenText, StringComparison.Ordinal))
                {
                    return BadRequest(new { detail = $"Nội dung đoạn '{sel.ParagraphId}' không khớp nguyên văn với đoạn {baseId} của bài báo (không được sửa chữ, quy định Điều 25 Luật SHTT)." });
                }
            }
            else
            {
                chosenText = para.Text;
            }
            chosenMentions = sel.Mentions ?? (isSplitPart ? null : para.Mentions) ?? new List<MentionDto>();

            // Dòng ngắn đầu bài (tiêu đề, ngày đăng) chỉ để AI đọc thông tin bài, không lưu thành tri thức
            if (!isSplitPart && chosenText.Length < 40)
            {
                return BadRequest(new { detail = $"Đoạn '{sel.ParagraphId}' quá ngắn ({chosenText.Length} ký tự). Dòng tiêu đề, ngày đăng chỉ để AI đọc thông tin bài, không lưu thành đoạn tri thức." });
            }

            if (chosenText.Length < 30)
            {
                return BadRequest(new { detail = $"Đoạn '{sel.ParagraphId}' quá ngắn ({chosenText.Length} ký tự, tối thiểu 30 ký tự)." });
            }

            if (chosenText.Length > maxChunkChars)
            {
                return BadRequest(new { detail = $"Đoạn '{sel.ParagraphId}' dài {chosenText.Length} ký tự, vượt quá giới hạn {maxChunkChars} ký tự cho phép." });
            }

            chosenParagraphs.Add((sel.ParagraphId, chosenText, sel.UnitType.ToUpperInvariant(), chosenMentions, sel.ModelClass));
        }

        // Quy tắc trích dẫn: Tổng số ký tự các đoạn trích dẫn <= max(minQuotaFloor, maxRatioPercent% độ dài bài viết)
        var totalSelectedChars = chosenParagraphs.Sum(p => p.Text.Length);
        var allowedCharsQuota = Math.Max(minQuotaFloor, (int)Math.Floor(session.ArticleLength * (maxRatioPercent / 100.0)));
        if (session.ArticleLength > 0 && totalSelectedChars > allowedCharsQuota)
        {
            return BadRequest(new { detail = $"Tổng độ dài các đoạn đã chọn ({totalSelectedChars:N0} ký tự) vượt quá giới hạn trích dẫn ({allowedCharsQuota:N0} ký tự, tối đa {maxRatioPercent}% độ dài bài báo)." });
        }

        // Kiểm tra số lượng đoạn nguyên văn đã lưu trong CSDL của URL này (chuẩn hoá)
        var normalizedUrl = NormalizeUrl(session.SourceUrl);
        if (string.IsNullOrEmpty(normalizedUrl))
        {
            return BadRequest(new { detail = "URL bài viết không hợp lệ (chỉ hỗ trợ http:// hoặc https://)." });
        }
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

            if (existingVerbatim.Count + chosenParagraphs.Count > maxChunks)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { detail = $"Bài báo này đã có {existingVerbatim.Count} đoạn nguyên văn. Thêm {chosenParagraphs.Count} đoạn sẽ vượt quá giới hạn tối đa {maxChunks} đoạn nguyên văn cho mỗi URL." });
            }

            // Hạn mức ký tự tính CỘNG DỒN với các đoạn đã lưu trước đó của cùng URL
            var existingChars = existingVerbatim.Sum(s => (s.EvidenceText ?? string.Empty).Length);
            if (session.ArticleLength > 0 && existingChars + totalSelectedChars > allowedCharsQuota)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { detail = $"Bài báo này đã lưu {existingChars:N0} ký tự nguyên văn. Thêm {totalSelectedChars:N0} ký tự sẽ vượt giới hạn trích dẫn {allowedCharsQuota:N0} ký tự ({maxRatioPercent}% bài, tối thiểu {minQuotaFloor:N0})." });
            }

            // Xác định metadata cuối cùng do Admin duyệt / sửa ở Bước 2
            var finalModelClass = !string.IsNullOrWhiteSpace(dto.ModelClass) 
                ? dto.ModelClass.Trim() 
                : session.ModelClass;

            if (string.IsNullOrWhiteSpace(finalModelClass))
            {
                await transaction.RollbackAsync();
                return BadRequest(new { detail = "Vui lòng chọn Cây trồng - Bệnh hại mục tiêu trước khi phê duyệt lưu." });
            }

            var classMeta = All38Classes.FirstOrDefault(c => c.ModelClass == finalModelClass);
            if (classMeta == null)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { detail = $"Mã lớp '{finalModelClass}' không thuộc 38 lớp được hỗ trợ." });
            }
            var plantName = classMeta.PlantName;
            var diseaseName = classMeta.DiseaseName;

            var finalSourceTitle = !string.IsNullOrWhiteSpace(dto.SourceTitle)
                ? dto.SourceTitle.Trim()
                : (!string.IsNullOrWhiteSpace(session.SourceTitle) ? session.SourceTitle : "Bài báo khuyến nông");

            var finalOrg = !string.IsNullOrWhiteSpace(dto.Organization)
                ? dto.Organization.Trim()
                : (!string.IsNullOrWhiteSpace(session.Organization) ? session.Organization : "Trung tâm Khuyến nông");

            var finalDate = !string.IsNullOrWhiteSpace(dto.PublishedDate)
                ? dto.PublishedDate.Trim()
                : (session.PublishedDate ?? "Không ghi ngày");

            var createdSources = new List<KnowledgeSource>();
            var now = DateTime.UtcNow;

            foreach (var (pId, text, unitType, mentions, selModelClass) in chosenParagraphs)
            {
                var cleanText = text.Trim();
                // Bỏ qua nếu đoạn trùng chữ 100% với một đoạn đã lưu của cùng URL
                if (existingVerbatim.Any(e => e.EvidenceText.Trim().Equals(cleanText, StringComparison.OrdinalIgnoreCase)) ||
                    createdSources.Any(c => c.EvidenceText.Trim().Equals(cleanText, StringComparison.OrdinalIgnoreCase)))
                {
                    continue;
                }

                // Hỗ trợ chuyên mục / bệnh hại riêng cho từng đoạn
                var segModelClass = finalModelClass;
                var segPlantName = plantName;
                var segDiseaseName = diseaseName;
                if (!string.IsNullOrWhiteSpace(selModelClass))
                {
                    var segMeta = All38Classes.FirstOrDefault(c => c.ModelClass == selModelClass.Trim());
                    if (segMeta != null)
                    {
                        segModelClass = segMeta.ModelClass;
                        segPlantName = segMeta.PlantName;
                        segDiseaseName = segMeta.DiseaseName;
                    }
                }

                var contentType = ContentTypeForUnit(unitType);

                var source = new KnowledgeSource
                {
                    Id = Guid.NewGuid(),
                    ModelClass = segModelClass,
                    PlantName = segPlantName,
                    DiseaseName = segDiseaseName,
                    SourceUrl = normalizedUrl, // Lưu URL đã chuẩn hóa
                    SourceTitle = finalSourceTitle,
                    Organization = finalOrg,
                    PublishedDate = finalDate,
                    MatchLevel = "Khớp trực tiếp",
                    SourceScope = ResolveSourceScope(dto.SourceScope, normalizedUrl, finalOrg),
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

            // Pha 3 (TASK-15 mục 5.1): CHỈ LƯU GỢI Ý, không tự gắn thuốc với bệnh (quyết định số 1).
            // Khớp hoạt chất thì ghi sẵn ProductId để Admin bấm "Gắn SP" xác nhận; endpoint link mới tạo DiseaseProducts.
            var allProducts = await _dbContext.Products
                .AsNoTracking()
                .Where(p => !p.IsDeleted)
                .ToListAsync();

            // Gợi ý Admin đã bỏ qua không hiện lại với cùng cụm từ và cùng bệnh (theo từng mã bệnh của đoạn)
            var targetClasses = createdSources.Select(s => s.ModelClass).Distinct().ToList();
            var dismissedRows = await _dbContext.ProductSuggestions
                .AsNoTracking()
                .Where(s => !s.IsDeleted && s.Status == "DISMISSED" && targetClasses.Contains(s.ModelClass))
                .Select(s => new { s.ModelClass, s.MentionText })
                .ToListAsync();

            var dismissedMentions = new HashSet<(string ModelClass, string MentionText)>(
                dismissedRows.Select(s => (s.ModelClass.Trim().ToLowerInvariant(), s.MentionText.Trim().ToLowerInvariant())));

            foreach (var createdSource in createdSources)
            {
                var matchedPara = chosenParagraphs.FirstOrDefault(cp => cp.Text == createdSource.EvidenceText);
                if (matchedPara.Mentions == null || matchedPara.Mentions.Count == 0) continue;

                var segClassKey = createdSource.ModelClass.Trim().ToLowerInvariant();
                var seenInSource = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var mention in matchedPara.Mentions)
                {
                    var mentionText = mention.Text?.Trim() ?? string.Empty;
                    var mentionKind = (mention.Kind ?? string.Empty).Trim().ToUpperInvariant();
                    if (mentionText.Length < 2 || mentionText.Length > 200 || !ValidMentionKinds.Contains(mentionKind)) continue;

                    // Chống bịa lớp 2 ở Core: cụm từ phải có nguyên văn trong đoạn đã lưu
                    if (!createdSource.EvidenceText.Contains(mentionText, StringComparison.OrdinalIgnoreCase)) continue;
                    if (!seenInSource.Add(mentionText) || dismissedMentions.Contains((segClassKey, mentionText.ToLowerInvariant()))) continue;

                    // So khớp theo HOẠT CHẤT (không theo tên thương mại); biện pháp canh tác không có sản phẩm
                    Product? matchedProduct = null;
                    if (mentionKind is "CHEMICAL" or "BIOLOGICAL" or "SUPPLY")
                    {
                        // Ưu tiên trùng tên sản phẩm đã có trong kho (tên thương mại), sau đó mới khớp hoạt chất
                        matchedProduct = allProducts.FirstOrDefault(p =>
                            !MedicinesController.IsBannedIngredient(p.Name) &&
                            !MedicinesController.IsBannedIngredient(p.ActiveIngredient) &&
                            mentionText.Length >= 5 && p.Name.Trim().Length >= 5 &&
                            (p.Name.Contains(mentionText, StringComparison.OrdinalIgnoreCase) ||
                             mentionText.Contains(p.Name.Trim(), StringComparison.OrdinalIgnoreCase)));
                    }
                    if (matchedProduct == null && mentionKind is "CHEMICAL" or "BIOLOGICAL")
                    {
                        matchedProduct = allProducts.FirstOrDefault(p =>
                            !MedicinesController.IsBannedIngredient(p.Name) &&
                            !MedicinesController.IsBannedIngredient(p.ActiveIngredient) &&
                            !string.IsNullOrWhiteSpace(p.ActiveIngredient) &&
                            p.ActiveIngredient.Trim().Length >= 4 &&
                            mentionText.Length >= 4 &&
                            (p.ActiveIngredient.Contains(mentionText, StringComparison.OrdinalIgnoreCase) ||
                             mentionText.Contains(p.ActiveIngredient.Trim(), StringComparison.OrdinalIgnoreCase)));
                    }

                    _dbContext.ProductSuggestions.Add(new ProductSuggestion
                    {
                        KnowledgeSourceId = createdSource.Id,
                        ModelClass = createdSource.ModelClass,
                        MentionText = mentionText,
                        Kind = mentionKind,
                        Status = "PENDING",
                        ProductId = matchedProduct?.Id,
                        CreatedAt = now
                    });
                }
            }

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
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> GetReindexStatus()
    {
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
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> DeleteSource(Guid id)
    {
        var item = await _dbContext.KnowledgeSources.FindAsync(id);
        if (item == null) return NotFound(new { message = "Không tìm thấy nguồn dữ liệu." });

        var now = DateTime.UtcNow;
        item.IsDeleted = true;
        item.UpdatedAt = now;

        // Cascade xóa mềm các gợi ý vật tư liên kết với đoạn trích này
        var relatedSuggestions = await _dbContext.ProductSuggestions
            .Where(ps => ps.KnowledgeSourceId == id && !ps.IsDeleted)
            .ToListAsync();
        foreach (var s in relatedSuggestions)
        {
            s.IsDeleted = true;
            s.UpdatedAt = now;
        }

        await _dbContext.SaveChangesAsync();

        await TriggerReindexAsync(item.Id.ToString(), "delete");

        return Ok(new { message = "Đã xóa nguồn dữ liệu thành công." });
    }

    // 5b. POST /api/v1/knowledge/sources/batch-delete
    [HttpPost("sources/batch-delete")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> BatchDeleteSources([FromBody] List<Guid> ids)
    {
        if (ids == null || ids.Count == 0)
        {
            return BadRequest(new { detail = "Danh sách ID xóa không được để trống." });
        }

        var items = await _dbContext.KnowledgeSources
            .Where(s => ids.Contains(s.Id) && !s.IsDeleted)
            .ToListAsync();

        if (items.Count == 0)
        {
            return Ok(new { message = "Không có đoạn nào cần xóa.", deleted_count = 0 });
        }

        var now = DateTime.UtcNow;
        foreach (var item in items)
        {
            item.IsDeleted = true;
            item.UpdatedAt = now;
        }

        // Cascade xóa mềm các gợi ý vật tư liên kết với các đoạn trích bị xóa
        var relatedSuggestions = await _dbContext.ProductSuggestions
            .Where(ps => ids.Contains(ps.KnowledgeSourceId) && !ps.IsDeleted)
            .ToListAsync();
        foreach (var s in relatedSuggestions)
        {
            s.IsDeleted = true;
            s.UpdatedAt = now;
        }

        await _dbContext.SaveChangesAsync();
        // Agent chỉ nhận action approve/unapprove/delete/manual (Literal trong app/main.py);
        // "batch_delete" bị 422 → không reindex → Lavi vẫn trích đoạn đã xóa. Agent rebuild toàn bộ nên dùng "delete".
        await TriggerReindexAsync(items.First().Id.ToString(), "delete");

        return Ok(new { message = $"Đã xóa thành công {items.Count} đoạn tri thức.", deleted_count = items.Count });
    }

    // 6. GET /api/v1/knowledge/export
    [HttpGet("export")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> ExportCsv()
    {
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

            sb.AppendLine($"{s.Id},{EscapeCsv(s.ModelClass)},{EscapeCsv(s.PlantName)},{EscapeCsv(s.DiseaseName)},{title},{org},{pubDate},{scope},{url},{EscapeCsv(s.ContentType)},{hasCultivation},{match},{EscapeCsv(s.SourceQuality)},{s.IsManualApproved},{evidence},{notes},{s.CreatedAt:yyyy-MM-dd HH:mm}");
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", $"Lavitree_Knowledge_Sources_{DateTime.UtcNow:yyyyMMdd}.csv");
    }

    private static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        // BUG-33: ô bắt đầu bằng = + - @ (hoặc tab / xuống dòng) bị Excel hiểu là công thức (CSV injection).
        // Thêm dấu ' phía trước để Excel hiện nguyên văn, không chạy.
        if ("=+-@\t\r".IndexOf(value[0]) >= 0)
        {
            value = "'" + value;
        }
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }
        return value;
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

    private static string BuildArticleMetaContext(string? rawArticleText)
    {
        if (string.IsNullOrWhiteSpace(rawArticleText)) return string.Empty;
        var lines = Regex.Split(rawArticleText, @"\r?\n")
            .Select(l => Regex.Replace(l.Trim(), @"[ \t]+", " "))
            .Where(l => !string.IsNullOrWhiteSpace(l))
            .ToList();
        if (lines.Count == 0) return string.Empty;

        var head = lines.Take(10).ToList();
        var tail = lines.Count > 10
            ? lines.Skip(Math.Max(10, lines.Count - 15)).ToList()
            : new List<string>();

        var contextText = tail.Count > 0
            ? $"[HEAD]\n{string.Join("\n", head)}\n[TAIL]\n{string.Join("\n", tail)}"
            : $"[HEAD]\n{string.Join("\n", head)}";

        return contextText.Length > 1800 ? contextText[..1800] : contextText;
    }

    private async Task<(Dictionary<string, AgentParagraphLabel> LabelMap, AgentSuggestedMetadata? Metadata)> RequestAgentLabelingAsync(
        string? modelClass,
        List<ParagraphDto> paragraphs,
        string? rawArticleText = null)
    {
        var labelMap = new Dictionary<string, AgentParagraphLabel>(StringComparer.OrdinalIgnoreCase);
        AgentSuggestedMetadata? metadata = null;

        try
        {
            // Gửi các đoạn <= 5000 ký tự (khớp schema Agent) để các đoạn dài hoặc cần tách vẫn được AI gán nhãn và trích xuất mentions
            var eligibleParagraphs = paragraphs.Where(p => p.Text.Length <= 5000).ToList();
            if (eligibleParagraphs.Count == 0)
            {
                return (labelMap, metadata);
            }

            var metaContext = BuildArticleMetaContext(rawArticleText);
            var payloadParagraphs = (!string.IsNullOrWhiteSpace(metaContext)
                    ? eligibleParagraphs.Take(199)
                    : eligibleParagraphs.Take(200))
                .Select(p => new AgentParagraphItem { Id = p.Id, Text = p.Text })
                .ToList();

            if (!string.IsNullOrWhiteSpace(metaContext))
            {
                payloadParagraphs.Add(new AgentParagraphItem { Id = "META_CONTEXT", Text = metaContext });
            }

            var httpClient = _httpClientFactory.CreateClient("AgentServiceClient");
            var internalKey = GetInternalApiKey();

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(35));
            var reqPayload = new AgentLabelParagraphsRequest
            {
                ModelClass = modelClass,
                Paragraphs = payloadParagraphs
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
                            labelMap[item.Id] = item;
                        }
                    }
                }
                metadata = resDto?.Metadata;
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

        return (labelMap, metadata);
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

    private int GetIngestConfigInt(string envKey, string configKey, int defaultValue, int minValue, int maxValue)
    {
        var raw = Environment.GetEnvironmentVariable(envKey)
               ?? _configuration[configKey]
               ?? _configuration[envKey];
        return int.TryParse(raw, out var val) && val >= minValue && val <= maxValue ? val : defaultValue;
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
            return string.Empty;
        }

        if (!string.Equals(uri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
        {
            return string.Empty;
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

    private const string KnowledgeBucketName = "lavitree-images";

    // Số điện thoại VN (0xxx xxx xxx, +84...) đi kèm từ khóa liên hệ/quảng cáo: hotline lọt khi dán bài
    private static readonly Regex PhoneRegex = new(@"(\+84|\b0)\d{2,3}[\s.\-]?\d{3}[\s.\-]?\d{3,4}\b", RegexOptions.Compiled);
    private static readonly Regex ContactKeywordRegex = new(
        @"hotline|zalo|liên hệ|tư vấn miễn phí|đặt hàng|mua hàng|gọi ngay|inbox|fanpage|bạn đang đọc bài viết|đăng ký nhận bản tin|chia sẻ facebook",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex SectionHeadingRegex = new(@"(:\s*$)|(^(\d+|[IVX]+|[a-zđ])[.)]\s+\S)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex CommonHeadingWordsRegex = new(
        @"^(introduction|symptoms(\s+and\s+signs)?|signs(\s+and\s+symptoms)?|disease\s+cycle|causal\s+agent|pathogen|management|control|chemical\s+control|cultural\s+control|biological\s+control|diagnostic\s+procedures|prevention|treatment|summary|overview|giới\s+thiệu|triệu\s+chứng(\s+và\s+dấu\s+hiệu)?|dấu\s+hiệu\s+nhận\s+biết|nguyên\s+nhân(\s+và\s+điều\s+kiện\s+phát\s+sinh)?|đặc\s+điểm\s+phát\s+sinh|điều\s+kiện\s+phát\s+sinh|vòng\s+đời|tác\s+hại|biện\s+pháp\s+phòng\s+trừ|biện\s+pháp\s+phòng\s+ngừa|biện\s+pháp\s+quản\s+lý|cách\s+trị|phòng\s+ngừa|điều\s+trị|hoạt\s+chất\s+khuyến\s+cáo)$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex MetadataKeyLineRegex = new(
        @"^(?:original\s+publication\s+date|originally\s+published|first\s+published|publication\s*date|reviewed\s*\/\s*revised|revised\s*\/\s*reviewed|date\s*revised|last\s*(?:updated|reviewed|modified)|published(?:\s*(?:date|on|in))?|updated(?:\s*(?:on|in))?|revised(?:\s*(?:on|in))?|reviewed(?:\s*(?:on|in))?|authors?|written\s+by|prepared\s+by|người\s*viết|cơ\s*quan|tác\s*giả|ngày\s*(?:đăng|xuất\s*bản|cập\s*nhật)|cập\s*nhật)\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex HeadingStarterExclusionRegex = new(
        @"^(đây là|đó là|biện pháp này|cách này|khi |nếu |dù |mặc dù |ngoài ra|tuy nhiên|do đó|vì vậy|trong bài|dưới đây là)(?=\s|$)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex RoleLineRegex = new(
        @"\b(professor|specialist|director|researcher|research\s+(?:specialist|assistant|associate|technician)|extension\s+(?:specialist|agent|educator)|scientist|technician|entomology|plant\s+pathology|pathology|horticulture|agronomy|lecturer)\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex PromoLinkRegex = new(
        @"^[•\-*]?\s*(website|trang\s*chủ|fanpage|youtube|shopee|lazada|tiktok|hệ\s*thống\s*cửa\s*hàng)\s*:",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static bool IsContactOrAdNoise(string text) =>
        text.Length <= 300 && ContactKeywordRegex.IsMatch(text) &&
        (PhoneRegex.IsMatch(text) || text.Length <= 120);

    private static string StripMarkdownInline(string text) =>
        Regex.Replace(text.Trim(), @"^(?:#{1,6}|[•\-*+])\s+", "").Replace("**", "").Trim();

    private static bool IsStandaloneMetadataBlock(string text)
    {
        var trimmed = Regex.Replace(text.Trim(), @"^(?:[#>*\-•+]+\s*)+", "").Replace("**", "").Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.Contains('\n') || trimmed.Length > 240) return false;
        return MetadataKeyLineRegex.IsMatch(trimmed)
            && (trimmed.Contains(':') || Regex.IsMatch(trimmed, @"\b\d{4}\b"));
    }

    private static bool IsTitleHeaderBlock(string text, int idx)
    {
        var trimmed = text.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.Contains('\n') || IsStandaloneMetadataBlock(trimmed)) return false;
        if (Regex.IsMatch(trimmed, @"^#\s+\S")) return true;
        return idx == 0 && !Regex.IsMatch(trimmed, @"^#{2,6}\s+") && trimmed.Length < 140 && !Regex.IsMatch(trimmed, @"[.!?;]$");
    }

    private static bool IsQuestionOrFaqBlock(string text)
    {
        var trimmed = text.Trim();
        if (trimmed.Contains('\n')) return false;
        var plain = StripMarkdownInline(trimmed);
        return plain.Length <= 250
            && Regex.IsMatch(plain, @"\?\s*$")
            && (Regex.IsMatch(plain, @"^(?:(?:\d+(?:\.\d+)*[.)/]?|[a-zđ][.)])\s*)?(?:\*\*)?[^\n*]{4,150}\?", RegexOptions.IgnoreCase)
                || Regex.IsMatch(plain, @"\b(khi nào|ở đâu|tại sao|như thế nào|bao nhiêu|là gì|có được không|có nên|có thể)\b", RegexOptions.IgnoreCase));
    }

    private static bool IsNumberedSubHeading(string text)
    {
        var trimmed = text.Trim();
        if (trimmed.Contains('\n')) return false;
        var plain = StripMarkdownInline(trimmed);
        return Regex.IsMatch(plain, @"^(?:\d+\.\d+\.?|[a-zđ][.)])\s+\S", RegexOptions.IgnoreCase) && plain.Length <= 140;
    }

    private static bool IsSectionHeading(string text)
    {
        var trimmed = text.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.Contains('\n') || IsStandaloneMetadataBlock(trimmed) || Regex.IsMatch(trimmed, @"^#\s+\S"))
        {
            return false;
        }

        // Câu hỏi kết thúc bằng '?' không phải là Section Heading
        if (IsQuestionOrFaqBlock(trimmed)) return false;

        // Mục đánh số phụ như 1.1, 4.1. hoặc a), b) là sub-heading
        if (IsNumberedSubHeading(trimmed)) return false;

        var plain = StripMarkdownInline(trimmed);
        if (plain.Length < 3 || plain.Length > 120 || HeadingStarterExclusionRegex.IsMatch(plain)) return false;

        // Chỉ nhận đề mục lớn: H2 (##)
        if (Regex.IsMatch(trimmed, @"^##\s+\S")) return true;

        // H3 (###) chỉ là Section Heading nếu KHÔNG phải mục con có số thập phân
        if (Regex.IsMatch(trimmed, @"^###\s+\S"))
        {
            if (Regex.IsMatch(trimmed, @"^###\s+(?:\d+\.\d+\.?|[a-zđ][.)])\s+", RegexOptions.IgnoreCase)) return false;
            return true;
        }

        var withoutTrailingColon = plain.TrimEnd();
        var endsWithColon = withoutTrailingColon.EndsWith(':')
            && !withoutTrailingColon[..^1].Contains(':')
            && !Regex.IsMatch(plain, @"\.\s+\S");
        // Chỉ nhận các đề mục lớn: "1.", "2/", "I.", "II."
        var numberedHeading = Regex.IsMatch(plain, @"^(\d+|[IVX]+)[.)/]\s+[A-ZÀ-Ỹ\d]", RegexOptions.IgnoreCase)
            && !plain.EndsWith('.');
        return endsWithColon || numberedHeading || CommonHeadingWordsRegex.IsMatch(plain);
    }

    private static bool IsSubItemBlock(string b)
    {
        var trimmed = b.Trim();
        if (string.IsNullOrEmpty(trimmed)) return false;
        if (Regex.IsMatch(trimmed, @"^(?:[•\-*+]|--?>|==?>)\s*\S")) return true;
        if (IsQuestionOrFaqBlock(trimmed)) return true;
        if (IsNumberedSubHeading(trimmed)) return true;
        if (trimmed.Length <= 400 && Regex.IsMatch(trimmed, @"^(?:[•\-*+]|--?>|==?>\s*)?(?:\*\*)?(?:\d+(\.\d+)*[.)/]?\s*)?[^:.\n!?*]{2,80}(?:\*\*)?:\s*(?:\*\*)?\s*\S?"))
        {
            return true;
        }
        return false;
    }

    private static string FormatSubItemMarkdown(string b)
    {
        var trimmed = b.Trim();
        if (trimmed.Contains('\n') || Regex.IsMatch(trimmed, @"^#{1,6}\s+")) return trimmed;
        if (trimmed.StartsWith("• ")) return $"- {trimmed[2..]}";
        if (Regex.IsMatch(trimmed, @"^([-*+]\s+|\d+[.)]\s+|--?>\s+)")) return trimmed;
        if (trimmed.Length <= 265 && !trimmed.Contains("**") && !Regex.IsMatch(trimmed, @"^#{1,6}\s+"))
        {
            var m = Regex.Match(trimmed, @"^([^:.\n!?*]{2,60}):\s+(\S[\s\S]*)$");
            if (m.Success)
            {
                return $"- **{m.Groups[1].Value.Trim()}:** {m.Groups[2].Value.Trim()}";
            }
        }
        return trimmed;
    }

    private static bool IsIncompleteLeadIn(string text)
    {
        var plain = text.Replace("**", "").Trim();
        return (Regex.IsMatch(plain, @":\s*$") && plain.Length <= 380)
            || (!plain.Contains('\n') && Regex.IsMatch(plain, @"\?\s*$") && plain.Length <= 160);
    }

    private static string CoalesceArticleParagraphs(string rawText)
    {
        if (string.IsNullOrWhiteSpace(rawText)) return string.Empty;
        const int maxGroupChars = 1600;
        var rawBlocks = Regex.Split(rawText, @"\r?\n\s*\r?\n")
            .Select(s => Regex.Replace(s.Trim(), @"[ \t]+", " "))
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToList();

        var output = new List<string>();
        var pendingHeading = string.Empty;
        var currentGroup = string.Empty;
        var currentHasSubItems = false;

        void Flush()
        {
            if (!string.IsNullOrEmpty(currentGroup))
            {
                output.Add(currentGroup);
                currentGroup = string.Empty;
                currentHasSubItems = false;
            }
        }

        for (int idx = 0; idx < rawBlocks.Count; idx++)
        {
            var rawBlock = rawBlocks[idx];
            var plain = StripMarkdownInline(rawBlock);
            var isRole = !plain.Contains('\n') && plain.Length <= 120 && !Regex.IsMatch(plain, @"[.!?;]$") && RoleLineRegex.IsMatch(plain);
            var isStray = PromoLinkRegex.IsMatch(plain)
                || (idx > 0 && !rawBlock.Contains('\n') && plain.Length < 90 && !IsStandaloneMetadataBlock(rawBlock) && !IsSectionHeading(rawBlock) && !IsSubItemBlock(rawBlock) && !isRole && !Regex.IsMatch(plain, @"[.!?:;]"));
            if (isStray) continue;

            if (IsStandaloneMetadataBlock(rawBlock) || IsTitleHeaderBlock(rawBlock, idx))
            {
                pendingHeading = string.Empty;
                Flush();
                output.Add(rawBlock);
                continue;
            }

            if (IsSectionHeading(rawBlock))
            {
                var prefixMatch = Regex.Match(rawBlock.Trim(), @"^(#{2,6})\s+");
                var prefix = prefixMatch.Success ? prefixMatch.Groups[1].Value : "##";
                var headingBody = Regex.Replace(rawBlock.Trim(), @"^#{2,6}\s+", "").Replace("**", "").Trim();
                var newHeading = $"{prefix} {headingBody}";

                if (!string.IsNullOrEmpty(pendingHeading))
                {
                    pendingHeading = $"{pendingHeading}\n{newHeading}";
                    continue;
                }

                Flush();
                pendingHeading = newHeading;
                continue;
            }

            var b = FormatSubItemMarkdown(rawBlock);

            if (!string.IsNullOrEmpty(pendingHeading))
            {
                currentGroup = $"{pendingHeading}\n{b}";
                currentHasSubItems = IsSubItemBlock(b);
                pendingHeading = string.Empty;
                continue;
            }

            if (!string.IsNullOrEmpty(currentGroup))
            {
                var startsWithHeading = Regex.IsMatch(b, @"^#{1,6}\s+") && !IsNumberedSubHeading(b) && !IsQuestionOrFaqBlock(b);
                var sub = IsSubItemBlock(b);
                var isShortFaqPair = IsQuestionOrFaqBlock(currentGroup) || Regex.IsMatch(b, @"^--?>\s+");
                var shouldMerge = !startsWithHeading && (IsIncompleteLeadIn(currentGroup)
                    || isShortFaqPair
                    || (sub && (currentGroup.Length <= 1100 || currentHasSubItems))
                    || (currentGroup.Length < 450 && b.Length < 450));
                if (shouldMerge && currentGroup.Length + 1 + b.Length <= maxGroupChars)
                {
                    currentGroup = $"{currentGroup}\n{b}";
                    if (sub) currentHasSubItems = true;
                    continue;
                }
                Flush();
            }

            currentGroup = b;
            currentHasSubItems = IsSubItemBlock(b);
        }
        Flush();
        if (!string.IsNullOrEmpty(pendingHeading))
        {
            output.Add(pendingHeading);
            pendingHeading = string.Empty;
        }

        return string.Join("\n\n", output);
    }

    private static bool IsPrivateOrReservedIp(IPAddress ip)
    {
        if (ip.IsIPv4MappedToIPv6)
        {
            ip = ip.MapToIPv4();
        }

        if (IPAddress.IsLoopback(ip))
        {
            return true;
        }

        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            var b = ip.GetAddressBytes();
            if (b[0] == 0) return true;                                  // 0.0.0.0/8
            if (b[0] == 10) return true;                                 // 10.0.0.0/8
            if (b[0] == 127) return true;                                // 127.0.0.0/8
            if (b[0] == 169 && b[1] == 254) return true;                 // 169.254.0.0/16 (Link-local & Cloud Metadata)
            if (b[0] == 172 && b[1] >= 16 && b[1] <= 31) return true;    // 172.16.0.0/12
            if (b[0] == 192 && b[1] == 168) return true;                 // 192.168.0.0/16
            if (b[0] == 100 && b[1] >= 64 && b[1] <= 127) return true;   // 100.64.0.0/10 (CGNAT)
            if (b[0] == 192 && b[1] == 0 && b[2] == 0) return true;      // 192.0.0.0/24
            if (b[0] == 192 && b[1] == 0 && b[2] == 2) return true;      // 192.0.2.0/24
            if (b[0] == 198 && (b[1] == 18 || b[1] == 19)) return true;  // 198.18.0.0/15
            if (b[0] == 198 && b[1] == 51 && b[2] == 100) return true;   // 198.51.100.0/24
            if (b[0] == 203 && b[1] == 0 && b[2] == 113) return true;    // 203.0.113.0/24
            if (b[0] >= 224) return true;                                // 224.0.0.0/4 Multicast & 240.0.0.0/4 Reserved
            return false;
        }

        if (ip.AddressFamily == AddressFamily.InterNetworkV6)
        {
            if (ip.Equals(IPAddress.IPv6Any) || ip.Equals(IPAddress.IPv6None)) return true;
            if (ip.IsIPv6LinkLocal || ip.IsIPv6Multicast || ip.IsIPv6SiteLocal || ip.IsIPv6Teredo) return true;
            var b = ip.GetAddressBytes();
            if ((b[0] & 0xFE) == 0xFC) return true;                      // fc00::/7 Unique Local
            if (b[0] == 0xFE && (b[1] & 0xC0) == 0x80) return true;      // fe80::/10 Link Local
            // 64:ff9b::/96 & 64:ff9b:1::/48 (NAT64 có thể nhúng IPv4 nội bộ)
            if (b[0] == 0x00 && b[1] == 0x64 && b[2] == 0xFF && b[3] == 0x9B) return true;
            // 2002::/16 (6to4 nhúng IPv4 ở 2 byte tiếp theo)
            if (b[0] == 0x20 && b[1] == 0x02) return true;
            // ::/96 (IPv4-compatible IPv6 đã deprecated)
            if (b.Take(12).All(x => x == 0)) return true;
            return false;
        }

        return true;
    }

    private static async Task<(Uri? Uri, string? Error)> ValidateSafePublicUrlAsync(string rawUrl, CancellationToken ct)
    {
        if (!Uri.TryCreate(rawUrl.Trim(), UriKind.Absolute, out var uri))
        {
            return (null, "Đường dẫn URL không hợp lệ.");
        }

        if (!string.Equals(uri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
        {
            return (null, "Chỉ hỗ trợ giao thức http:// hoặc https://.");
        }

        var host = uri.DnsSafeHost.Trim().TrimEnd('.').ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(host) ||
            host == "localhost" ||
            host == "127.0.0.1" ||
            host == "0.0.0.0" ||
            host == "::1" ||
            host.EndsWith(".local", StringComparison.Ordinal) ||
            host.EndsWith(".internal", StringComparison.Ordinal) ||
            host.EndsWith(".localhost", StringComparison.Ordinal))
        {
            return (null, "URL không được phép trỏ tới địa chỉ nội bộ (SSRF protection).");
        }

        if (IPAddress.TryParse(host, out var literalIp))
        {
            if (IsPrivateOrReservedIp(literalIp))
            {
                return (null, "URL không được phép trỏ tới IP mạng nội bộ hoặc riêng tư (SSRF protection).");
            }
            return (uri, null);
        }

        IPAddress[] addresses;
        try
        {
            addresses = await Dns.GetHostAddressesAsync(host, ct);
        }
        catch (Exception)
        {
            return (null, "Không thể phân giải tên miền của URL này.");
        }

        if (addresses.Length == 0 || addresses.Any(IsPrivateOrReservedIp))
        {
            return (null, "Tên miền trỏ tới địa chỉ IP nội bộ hoặc không hợp lệ (SSRF protection).");
        }

        return (uri, null);
    }

    private static async Task<string> ReadLimitedHtmlAsync(HttpContent content, int maxBytes, CancellationToken ct)
    {
        await using var stream = await content.ReadAsStreamAsync(ct);
        using var ms = new MemoryStream();
        var buffer = new byte[16384];
        var totalRead = 0;

        while (totalRead < maxBytes)
        {
            var toRead = Math.Min(buffer.Length, maxBytes - totalRead);
            var read = await stream.ReadAsync(buffer.AsMemory(0, toRead), ct);
            if (read == 0) break;
            ms.Write(buffer, 0, read);
            totalRead += read;
        }

        var bytes = ms.ToArray();
        var encoding = Encoding.UTF8;
        var charset = content.Headers.ContentType?.CharSet?.Trim('"', '\'', ' ');
        if (!string.IsNullOrWhiteSpace(charset))
        {
            try
            {
                encoding = Encoding.GetEncoding(charset);
            }
            catch
            {
                encoding = Encoding.UTF8;
            }
        }

        return encoding.GetString(bytes);
    }
    private static readonly HashSet<string> ValidMentionKinds = new(StringComparer.Ordinal)
    {
        "CHEMICAL", "BIOLOGICAL", "SUPPLY", "PRACTICE"
    };
    private static readonly HashSet<string> AllowedImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp"
    };

    // =========================================================================
    // 5. QUẢN LÝ ẢNH TRIỆU CHỨNG (TASK-15 PHA 2)
    // =========================================================================

    // 5.1. GET /api/v1/knowledge/images
    [HttpGet("images")]
    public async Task<IActionResult> GetKnowledgeImages(
        [FromQuery] string? model_class = null,
        [FromQuery] string? plant_part = null,
        [FromQuery] bool? is_approved = null,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        var isAdmin = User.IsAdmin();

        var query = _dbContext.KnowledgeImages
            .AsNoTracking()
            .Where(img => !img.IsDeleted);

        // Khách hoặc người dùng thường chỉ thấy ảnh đã duyệt
        if (!isAdmin)
        {
            query = query.Where(img => img.IsManualApproved);
        }
        else if (is_approved.HasValue)
        {
            query = query.Where(img => img.IsManualApproved == is_approved.Value);
        }

        if (!string.IsNullOrWhiteSpace(model_class))
        {
            query = query.Where(img => img.ModelClass == model_class.Trim());
        }

        if (!string.IsNullOrWhiteSpace(plant_part))
        {
            query = query.Where(img => img.PlantPart == plant_part.Trim().ToUpperInvariant());
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(img =>
                img.Caption.ToLower().Contains(s) ||
                img.Credit.ToLower().Contains(s) ||
                img.ModelClass.ToLower().Contains(s));
        }

        var list = await query
            .OrderByDescending(img => img.CreatedAt)
            .ToListAsync(cancellationToken);

        var dtoList = list.Select(img =>
        {
            var classMeta = All38Classes.FirstOrDefault(c => c.ModelClass == img.ModelClass);
            var displayUrl = !string.IsNullOrWhiteSpace(img.StorageKey)
                ? _minioStorageService.GetPublicUrl(KnowledgeBucketName, img.StorageKey)
                : (img.ImageUrl ?? string.Empty);

            return new KnowledgeImageDto
            {
                Id = img.Id,
                ModelClass = img.ModelClass,
                PlantName = classMeta?.PlantName ?? "Cây trồng",
                DiseaseName = classMeta?.DiseaseName ?? img.ModelClass,
                SourceUrl = img.SourceUrl,
                ImageUrl = displayUrl,
                StorageKey = img.StorageKey,
                Caption = img.Caption,
                PlantPart = img.PlantPart,
                Credit = img.Credit,
                LicenseNote = img.LicenseNote,
                IsManualApproved = img.IsManualApproved,
                CreatedAt = img.CreatedAt
            };
        }).ToList();

        return Ok(dtoList);
    }

    // 5.2. POST /api/v1/knowledge/images (Admin tải ảnh lên MinIO hoặc dán HTTPS URL)
    [HttpPost("images")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> CreateKnowledgeImage(
        [FromForm] CreateKnowledgeImageRequestDto dto,
        [FromForm] IFormFile? file = null,
        CancellationToken cancellationToken = default)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var classMeta = All38Classes.FirstOrDefault(c => c.ModelClass == dto.ModelClass);
        if (classMeta == null)
        {
            return BadRequest(new { detail = $"Mã lớp '{dto.ModelClass}' không thuộc 38 lớp được hỗ trợ." });
        }

        if (!dto.SourceUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !dto.SourceUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { detail = "Đường dẫn bài viết gốc (source_url) phải là URL hợp lệ." });
        }

        string? storageKey = null;
        string? externalImageUrl = null;

        if (file != null && file.Length > 0)
        {
            var ext = Path.GetExtension(file.FileName);
            if (string.IsNullOrEmpty(ext) || !AllowedImageExtensions.Contains(ext))
            {
                return BadRequest(new { detail = "Định dạng tệp không được hỗ trợ. Chỉ chấp nhận .jpg, .jpeg, .png, .webp." });
            }

            if (file.Length > 10 * 1024 * 1024)
            {
                return BadRequest(new { detail = "Kích thước tệp vượt quá giới hạn 10MB." });
            }

            byte[] cleanImage;
            try
            {
                await using var origStream = file.OpenReadStream();
                cleanImage = await ImageMetadataStripper.StripAsync(origStream, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Lỗi giải mã hoặc xóa metadata của ảnh tải lên.");
                return UnprocessableEntity(new { detail = "Tệp hình ảnh bị lỗi cấu trúc hoặc không thể giải mã." });
            }

            var objectName = $"knowledge-images/{Guid.NewGuid():N}_{dto.PlantPart.ToLowerInvariant()}{ext}";
            var contentType = ext.ToLowerInvariant() switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".webp" => "image/webp",
                _ => "application/octet-stream"
            };

            try
            {
                using var memStream = new MemoryStream(cleanImage);
                await _minioStorageService.UploadFileAsync(
                    KnowledgeBucketName,
                    objectName,
                    memStream,
                    contentType,
                    cancellationToken);
                storageKey = objectName;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi tải ảnh triệu chứng lên MinIO.");
                return StatusCode(StatusCodes.Status502BadGateway, new { detail = "Lỗi khi lưu trữ ảnh lên dịch vụ MinIO." });
            }
        }
        else if (!string.IsNullOrWhiteSpace(dto.ImageUrl))
        {
            var trimmedUrl = dto.ImageUrl.Trim();
            if (!trimmedUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { detail = "Ảnh ngoài bắt buộc phải sử dụng giao thức HTTPS bảo mật (https://)." });
            }
            externalImageUrl = trimmedUrl;
        }
        else
        {
            return BadRequest(new { detail = "Vui lòng đính kèm tệp ảnh tải lên hoặc cung cấp đường dẫn ảnh ngoài (https://)." });
        }

        var imageEntity = new KnowledgeImage
        {
            ModelClass = dto.ModelClass.Trim(),
            SourceUrl = NormalizeUrl(dto.SourceUrl),
            ImageUrl = externalImageUrl,
            StorageKey = storageKey,
            Caption = dto.Caption.Trim(),
            PlantPart = dto.PlantPart.Trim().ToUpperInvariant(),
            Credit = dto.Credit.Trim(),
            LicenseNote = dto.LicenseNote?.Trim(),
            IsManualApproved = dto.IsManualApproved ?? true,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.KnowledgeImages.Add(imageEntity);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var displayUrl = !string.IsNullOrWhiteSpace(imageEntity.StorageKey)
            ? _minioStorageService.GetPublicUrl(KnowledgeBucketName, imageEntity.StorageKey)
            : (imageEntity.ImageUrl ?? string.Empty);

        return StatusCode(StatusCodes.Status201Created, new KnowledgeImageDto
        {
            Id = imageEntity.Id,
            ModelClass = imageEntity.ModelClass,
            PlantName = classMeta.PlantName,
            DiseaseName = classMeta.DiseaseName,
            SourceUrl = imageEntity.SourceUrl,
            ImageUrl = displayUrl,
            StorageKey = imageEntity.StorageKey,
            Caption = imageEntity.Caption,
            PlantPart = imageEntity.PlantPart,
            Credit = imageEntity.Credit,
            LicenseNote = imageEntity.LicenseNote,
            IsManualApproved = imageEntity.IsManualApproved,
            CreatedAt = imageEntity.CreatedAt
        });
    }

    // 5.3. PATCH /api/v1/knowledge/images/{id}/approve (Admin duyệt / bỏ duyệt ảnh)
    [HttpPatch("images/{id}/approve")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> ApproveKnowledgeImage(
        int id,
        [FromBody] ApproveKnowledgeImageRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var image = await _dbContext.KnowledgeImages.FirstOrDefaultAsync(img => img.Id == id && !img.IsDeleted, cancellationToken);
        if (image == null)
        {
            return NotFound(new { detail = "Không tìm thấy ảnh triệu chứng." });
        }

        image.IsManualApproved = dto.IsApproved;
        image.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { message = $"Đã cập nhật trạng thái duyệt ảnh #{id}.", is_approved = image.IsManualApproved });
    }

    // 5.4. DELETE /api/v1/knowledge/images/{id} (Admin gỡ ảnh)
    [HttpDelete("images/{id}")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> DeleteKnowledgeImage(
        int id,
        CancellationToken cancellationToken = default)
    {
        var image = await _dbContext.KnowledgeImages.FirstOrDefaultAsync(img => img.Id == id && !img.IsDeleted, cancellationToken);
        if (image == null)
        {
            return NotFound(new { detail = "Không tìm thấy ảnh triệu chứng." });
        }

        image.IsDeleted = true;
        image.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { message = $"Đã xóa ảnh triệu chứng #{id} thành công." });
    }

    // =========================================================================
    // 6. GỢI Ý VẬT TƯ & THUỐC TỪ TRI THỨC (TASK-15 PHA 3)
    // =========================================================================

    // 6.1. GET /api/v1/knowledge/product-suggestions
    [HttpGet("product-suggestions")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> GetProductSuggestions(
        [FromQuery] string? model_class = null,
        [FromQuery] string? kind = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        // 1. Tự động đồng bộ soft-delete các gợi ý mồ côi (nếu đoạn trích liên quan đã bị xóa mềm hoặc xóa hẳn trước đó)
        var orphanedSuggestions = await _dbContext.ProductSuggestions
            .Include(ps => ps.KnowledgeSource)
            .Where(ps => !ps.IsDeleted && (ps.KnowledgeSource == null || ps.KnowledgeSource.IsDeleted))
            .ToListAsync(cancellationToken);

        if (orphanedSuggestions.Count > 0)
        {
            var now = DateTime.UtcNow;
            foreach (var os in orphanedSuggestions)
            {
                os.IsDeleted = true;
                os.UpdatedAt = now;
            }
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        // 2. Chỉ truy vấn các gợi ý còn hiệu lực VÀ đoạn trích bằng chứng còn tồn tại (chưa bị xóa)
        var query = _dbContext.ProductSuggestions
            .Include(ps => ps.KnowledgeSource)
            .Include(ps => ps.Product)
            .Where(ps => !ps.IsDeleted && ps.KnowledgeSource != null && !ps.KnowledgeSource.IsDeleted)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(model_class) && model_class != "ALL")
        {
            query = query.Where(ps => ps.ModelClass == model_class);
        }

        if (!string.IsNullOrWhiteSpace(kind) && kind != "ALL")
        {
            query = query.Where(ps => ps.Kind == kind);
        }

        if (!string.IsNullOrWhiteSpace(status) && status != "ALL")
        {
            query = query.Where(ps => ps.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLower();
            query = query.Where(ps => ps.MentionText.ToLower().Contains(q) ||
                                      (ps.KnowledgeSource != null && ps.KnowledgeSource.EvidenceText.ToLower().Contains(q)));
        }

        var list = await query
            .OrderByDescending(ps => ps.CreatedAt)
            .Take(200)
            .ToListAsync(cancellationToken);

        var results = list.Select(ps =>
        {
            var classMeta = All38Classes.FirstOrDefault(c => c.ModelClass == ps.ModelClass);
            return new ProductSuggestionDto
            {
                Id = ps.Id,
                KnowledgeSourceId = ps.KnowledgeSourceId,
                ModelClass = ps.ModelClass,
                PlantName = classMeta?.PlantName ?? "Cây trồng",
                DiseaseName = classMeta?.DiseaseName ?? ps.ModelClass,
                MentionText = ps.MentionText,
                Kind = ps.Kind,
                Status = ps.Status,
                ProductId = ps.ProductId,
                ProductName = ps.Product?.Name,
                EvidenceText = ps.KnowledgeSource?.EvidenceText,
                SourceUrl = ps.KnowledgeSource?.SourceUrl,
                SourceTitle = ps.KnowledgeSource?.SourceTitle,
                CreatedAt = ps.CreatedAt,
                ResolvedAt = ps.ResolvedAt
            };
        }).ToList();

        return Ok(results);
    }

    // 6.2. POST /api/v1/knowledge/product-suggestions/{id}/link
    [HttpPost("product-suggestions/{id}/link")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> LinkProductSuggestion(
        int id,
        [FromBody] LinkProductSuggestionRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var suggestion = await _dbContext.ProductSuggestions
            .Include(ps => ps.KnowledgeSource)
            .FirstOrDefaultAsync(ps => ps.Id == id && !ps.IsDeleted, cancellationToken);

        if (suggestion == null)
        {
            return NotFound(new { detail = "Không tìm thấy gợi ý vật tư." });
        }

        var product = await _dbContext.Products
            .FirstOrDefaultAsync(p => p.Id == dto.ProductId && !p.IsDeleted, cancellationToken);

        if (product == null)
        {
            return NotFound(new { detail = "Không tìm thấy sản phẩm cần gắn kết." });
        }

        if (suggestion.Status != "PENDING")
        {
            return Conflict(new { detail = "Gợi ý này đã được xử lý trước đó." });
        }

        // Không bao giờ gắn thuốc cấm vào bệnh, kể cả khi trang kết quả khám đã lọc IsAllowed
        if (MedicinesController.IsBannedIngredient(product.Name) || MedicinesController.IsBannedIngredient(product.ActiveIngredient))
        {
            return BadRequest(new { detail = $"Sản phẩm '{product.Name}' chứa hoạt chất cấm, không được gắn vào bệnh." });
        }

        // Tự động gắn kết cho tất cả các bản ghi có cùng mention_text đang chờ xử lý
        var targetMention = suggestion.MentionText.Trim().ToLower();
        var sameSuggestions = await _dbContext.ProductSuggestions
            .Where(ps => !ps.IsDeleted && ps.Status == "PENDING" && ps.MentionText.Trim().ToLower() == targetMention)
            .ToListAsync(cancellationToken);

        if (!sameSuggestions.Any(s => s.Id == suggestion.Id))
        {
            sameSuggestions.Add(suggestion);
        }

        foreach (var s in sameSuggestions)
        {
            s.Status = "LINKED";
            s.ProductId = product.Id;
            s.ResolvedAt = DateTime.UtcNow;

            // Tự động liên kết vào DiseaseProducts nếu bệnh đã có trong bảng Diseases
            if (!string.IsNullOrWhiteSpace(s.ModelClass))
            {
                var disease = await _dbContext.Diseases
                    .FirstOrDefaultAsync(d => d.ClassCode == s.ModelClass, cancellationToken);
                if (disease != null)
                {
                    var exists = await _dbContext.DiseaseProducts
                        .AnyAsync(dp => dp.DiseaseId == disease.Id && dp.ProductId == product.Id, cancellationToken);
                    if (!exists)
                    {
                        _dbContext.DiseaseProducts.Add(new DiseaseProduct
                        {
                            DiseaseId = disease.Id,
                            ProductId = product.Id
                        });
                    }
                }
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { message = $"Đã gắn gợi ý '{suggestion.MentionText}' (áp dụng cho {sameSuggestions.Count} đoạn) với sản phẩm '{product.Name}' thành công." });
    }

    // 6.3. POST /api/v1/knowledge/product-suggestions/{id}/dismiss
    [HttpPost("product-suggestions/{id}/dismiss")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> DismissProductSuggestion(
        int id,
        CancellationToken cancellationToken = default)
    {
        var suggestion = await _dbContext.ProductSuggestions
            .FirstOrDefaultAsync(ps => ps.Id == id && !ps.IsDeleted, cancellationToken);

        if (suggestion == null)
        {
            return NotFound(new { detail = "Không tìm thấy gợi ý vật tư." });
        }

        // Tự động bỏ qua cho tất cả các bản ghi có cùng mention_text đang chờ xử lý
        var targetMention = suggestion.MentionText.Trim().ToLower();
        var sameSuggestions = await _dbContext.ProductSuggestions
            .Where(ps => !ps.IsDeleted && ps.Status == "PENDING" && ps.MentionText.Trim().ToLower() == targetMention)
            .ToListAsync(cancellationToken);

        if (!sameSuggestions.Any(s => s.Id == suggestion.Id))
        {
            sameSuggestions.Add(suggestion);
        }

        foreach (var s in sameSuggestions)
        {
            s.Status = "DISMISSED";
            s.ResolvedAt = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { message = $"Đã bỏ qua gợi ý '{suggestion.MentionText}' (áp dụng cho {sameSuggestions.Count} đoạn)." });
    }

    // 6.4. DELETE /api/v1/knowledge/product-suggestions/{id}
    [HttpDelete("product-suggestions/{id:int}")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> DeleteProductSuggestion(
        int id,
        CancellationToken cancellationToken = default)
    {
        var suggestion = await _dbContext.ProductSuggestions
            .FirstOrDefaultAsync(ps => ps.Id == id && !ps.IsDeleted, cancellationToken);

        if (suggestion == null)
        {
            return NotFound(new { detail = "Không tìm thấy gợi ý vật tư." });
        }

        // Tự động xóa mềm cho tất cả các bản ghi có cùng mention_text
        var targetMention = suggestion.MentionText.Trim().ToLower();
        var sameSuggestions = await _dbContext.ProductSuggestions
            .Where(ps => !ps.IsDeleted && ps.MentionText.Trim().ToLower() == targetMention)
            .ToListAsync(cancellationToken);

        if (!sameSuggestions.Any(s => s.Id == suggestion.Id))
        {
            sameSuggestions.Add(suggestion);
        }

        var now = DateTime.UtcNow;
        foreach (var s in sameSuggestions)
        {
            s.IsDeleted = true;
            s.UpdatedAt = now;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { message = $"Đã xóa gợi ý '{suggestion.MentionText}' ({sameSuggestions.Count} bản ghi) thành công." });
    }

    // 6.5. DELETE /api/v1/knowledge/product-suggestions/dismissed
    [HttpDelete("product-suggestions/dismissed")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> DeleteDismissedProductSuggestions(CancellationToken cancellationToken = default)
    {
        var targetList = await _dbContext.ProductSuggestions
            .Include(ps => ps.KnowledgeSource)
            .Where(ps => !ps.IsDeleted && (ps.Status == "DISMISSED" || ps.KnowledgeSource == null || ps.KnowledgeSource.IsDeleted))
            .ToListAsync(cancellationToken);

        if (targetList.Count == 0)
        {
            return Ok(new { message = "Không có gợi ý đã bỏ qua hoặc mồ côi nào cần dọn dẹp.", deleted_count = 0 });
        }

        var now = DateTime.UtcNow;
        foreach (var s in targetList)
        {
            s.IsDeleted = true;
            s.UpdatedAt = now;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { message = $"Đã dọn dẹp thành công {targetList.Count} gợi ý (bao gồm đã bỏ qua và mồ côi từ đoạn trích đã xóa).", deleted_count = targetList.Count });
    }
}
