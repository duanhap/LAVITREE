using System;
using Lavitree.Domain.Common;

namespace Lavitree.Domain.Entities;

public class KnowledgeImage : BaseEntity
{
    public int Id { get; set; }
    
    // 38 mã lớp chuẩn (ví dụ: "Tomato___Late_blight")
    public string ModelClass { get; set; } = string.Empty;
    
    // Link bài viết gốc chứa ảnh
    public string SourceUrl { get; set; } = string.Empty;
    
    // URL ảnh ngoài (chỉ HTTPS)
    public string? ImageUrl { get; set; }
    
    // Key lưu trữ trên MinIO (nếu Admin tải ảnh lên)
    public string? StorageKey { get; set; }
    
    // Chú thích triệu chứng (ví dụ: "Vết bệnh dạng giọt dầu mặt dưới lá")
    public string Caption { get; set; } = string.Empty;
    
    // Bộ phận cây: LEAF | FRUIT | STEM | WHOLE_PLANT
    public string PlantPart { get; set; } = "LEAF";
    
    // Tác giả / cơ quan sở hữu ảnh
    public string Credit { get; set; } = string.Empty;
    
    // Ghi chú giấy phép bản quyền ("Ảnh nhóm tự chụp", "CC BY 4.0", "Khuyến nông VN"...)
    public string? LicenseNote { get; set; }
    
    // Trạng thái kiểm duyệt (mặc định true khi Admin tự thêm)
    public bool IsManualApproved { get; set; } = true;
}

