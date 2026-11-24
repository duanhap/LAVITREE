using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Lavitree.Api.Security;
using Lavitree.Application.DTOs;
using Lavitree.Domain.Entities;
using Lavitree.Infrastructure.Persistence;

namespace Lavitree.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class OrdersController : ControllerBase
{
    private readonly LavitreeDbContext _dbContext;
    private readonly ILogger<OrdersController> _logger;

    public OrdersController(LavitreeDbContext dbContext, ILogger<OrdersController> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <summary>
    /// POST /api/v1/orders
    /// Tạo đơn hàng Vật tư Nông nghiệp - COD (api-contracts.md Mục 3.6)
    /// </summary>
    [HttpPost]
    [Authorize]
    [ProducesResponseType(typeof(OrderResponseDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderDto dto, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                     ?? User.FindFirst("sub")?.Value
                     ?? User.FindFirst("nameid")?.Value;

        if (string.IsNullOrWhiteSpace(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized(new { detail = "Phiên làm việc không hợp lệ hoặc đã hết hạn." });
        }

        using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            decimal totalAmount = 0;
            var orderItems = new List<OrderItem>();
            var responseItems = new List<OrderItemResponseDto>();

            foreach (var item in dto.Items)
            {
                var product = await _dbContext.Products
                    .AsNoTracking()
                    .FirstOrDefaultAsync(p => p.Id == item.ProductId && !p.IsDeleted, cancellationToken);

                if (product == null)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    return BadRequest(new { detail = $"Không tìm thấy sản phẩm có mã {item.ProductId} trên hệ thống." });
                }

                // Chốt chặn bảo mật SSOT: Tuyệt đối không bán thuốc bị cấm lưu hành (IsAllowed == false)
                if (!product.IsAllowed)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    _logger.LogWarning("Từ chối đặt mua thuốc không được phép lưu hành: {ProductName} (ID: {ProductId})", product.Name, product.Id);
                    return BadRequest(new { detail = $"Sản phẩm '{product.Name}' hiện không được phép lưu hành hoặc đã bị đình chỉ theo quy định." });
                }

                // Chốt chặn hàng tham khảo không kinh doanh (Availability == NOT_SOLD)
                if (string.Equals(product.Availability, "NOT_SOLD", StringComparison.OrdinalIgnoreCase))
                {
                    await transaction.RollbackAsync(cancellationToken);
                    return BadRequest(new { detail = $"Sản phẩm '{product.Name}' là mặt hàng tham khảo, cửa hàng không trực tiếp kinh doanh. Bà con vui lòng tìm mua tại đại lý vật tư nông nghiệp địa phương." });
                }

                // Trừ tồn kho ATOMIC có điều kiện trực tiếp trên CSDL để chống Race Condition (bán âm kho)
                var affected = await _dbContext.Products
                    .Where(p => p.Id == item.ProductId && p.IsAllowed && p.Availability != "NOT_SOLD" && !p.IsDeleted && p.StockQuantity >= item.Quantity)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(p => p.StockQuantity, p => p.StockQuantity - item.Quantity)
                        .SetProperty(p => p.UpdatedAt, DateTime.UtcNow), cancellationToken);

                if (affected == 0)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    return BadRequest(new { detail = $"Sản phẩm '{product.Name}' không đủ tồn kho để đáp ứng số lượng {item.Quantity}." });
                }

                var unitPrice = product.Price;
                totalAmount += unitPrice * item.Quantity;

                orderItems.Add(new OrderItem
                {
                    ProductId = product.Id,
                    Quantity = item.Quantity,
                    UnitPrice = unitPrice
                });

                responseItems.Add(new OrderItemResponseDto
                {
                    ProductId = product.Id,
                    ProductName = product.Name,
                    Quantity = item.Quantity,
                    UnitPrice = unitPrice
                });
            }

            var order = new Order
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                TotalAmount = totalAmount,
                Status = "Pending",
                PaymentMethod = dto.PaymentMethod?.ToUpperInvariant() == "VIETQR" ? "VIETQR" : "COD",
                ReceiverName = dto.ReceiverName?.Trim(),
                Notes = dto.Notes?.Trim(),
                ShippingAddress = dto.ShippingAddress.Trim(),
                PhoneNumber = dto.PhoneNumber.Trim(),
                CreatedAt = DateTime.UtcNow,
                Items = orderItems
            };

            _dbContext.Orders.Add(order);
            await _dbContext.SaveChangesAsync(cancellationToken);

            await transaction.CommitAsync(cancellationToken);

            _logger.LogInformation("Đã tạo thành công đơn hàng {OrderId} cho User {UserId}, tổng tiền: {TotalAmount:N0} VNĐ", order.Id, userId, totalAmount);

            var response = new OrderResponseDto
            {
                OrderId = $"ord-{order.Id.ToString()[..8]}",
                TotalAmount = order.TotalAmount,
                PaymentMethod = order.PaymentMethod,
                OrderStatus = order.Status,
                ReceiverName = order.ReceiverName,
                Notes = order.Notes,
                ShippingAddress = order.ShippingAddress,
                PhoneNumber = order.PhoneNumber,
                CreatedAt = order.CreatedAt,
                Items = responseItems
            };

            return StatusCode(StatusCodes.Status201Created, response);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "Lỗi xảy ra trong quá trình tạo đơn hàng cho User {UserId}", userId);
            throw;
        }
    }

    /// <summary>
    /// GET /api/v1/orders
    /// Lấy danh sách lịch sử đơn hàng của người dùng hiện tại
    /// </summary>
    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetMyOrders(CancellationToken cancellationToken)
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                     ?? User.FindFirst("sub")?.Value;

        if (string.IsNullOrWhiteSpace(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized(new { detail = "Phiên làm việc không hợp lệ." });
        }

        var orders = await _dbContext.Orders
            .Where(o => o.UserId == userId && !o.IsDeleted)
            .Include(o => o.Items)
                .ThenInclude(i => i.Product)
            .OrderByDescending(o => o.CreatedAt)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var result = orders.Select(o => new OrderResponseDto
        {
            OrderId = $"ord-{o.Id.ToString()[..8]}",
            TotalAmount = o.TotalAmount,
            PaymentMethod = o.PaymentMethod,
            OrderStatus = o.Status,
            ReceiverName = o.ReceiverName,
            Notes = o.Notes,
            ShippingAddress = o.ShippingAddress,
            PhoneNumber = o.PhoneNumber,
            CreatedAt = o.CreatedAt,
            Items = o.Items.Select(i => new OrderItemResponseDto
            {
                ProductId = i.ProductId,
                ProductName = i.Product?.Name ?? "Sản phẩm",
                Quantity = i.Quantity,
                UnitPrice = i.UnitPrice
            }).ToList()
        }).ToList();

        return Ok(result);
    }

    /// <summary>
    /// GET /api/v1/orders/admin
    /// Lấy toàn bộ danh sách đơn hàng cho Admin quản lý
    /// </summary>
    [HttpGet("admin")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> GetAllOrdersForAdmin(
        [FromQuery] string? status,
        [FromQuery] string? search,
        CancellationToken cancellationToken)
    {
        var query = _dbContext.Orders
            .Where(o => !o.IsDeleted)
            .Include(o => o.Items)
                .ThenInclude(i => i.Product)
            .Include(o => o.User)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "ALL", StringComparison.OrdinalIgnoreCase))
        {
            var targetStatus = status.Trim();
            query = query.Where(o => EF.Functions.ILike(o.Status, targetStatus));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            var cleanId = s.StartsWith("ord-", StringComparison.OrdinalIgnoreCase) ? s[4..] : s;
            query = query.Where(o =>
                EF.Functions.ILike(o.ReceiverName ?? "", $"%{s}%") ||
                EF.Functions.ILike(o.PhoneNumber, $"%{s}%") ||
                EF.Functions.ILike(o.ShippingAddress, $"%{s}%") ||
                (o.User != null && EF.Functions.ILike(o.User.FullName, $"%{s}%")) ||
                (o.User != null && EF.Functions.ILike(o.User.Email, $"%{s}%")) ||
                EF.Functions.ILike(o.Id.ToString(), $"%{cleanId}%"));
        }

        var orders = await query
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(cancellationToken);

        var result = orders.Select(o => new OrderResponseDto
        {
            OrderId = $"ord-{o.Id.ToString()[..8]}",
            UserId = o.UserId,
            CustomerName = o.User?.FullName,
            CustomerEmail = o.User?.Email,
            CustomerPhone = o.User?.Phone,
            TotalAmount = o.TotalAmount,
            PaymentMethod = o.PaymentMethod,
            OrderStatus = o.Status,
            ReceiverName = o.ReceiverName,
            Notes = o.Notes,
            ShippingAddress = o.ShippingAddress,
            PhoneNumber = o.PhoneNumber,
            CreatedAt = o.CreatedAt,
            UpdatedAt = o.UpdatedAt,
            Items = o.Items.Select(i => new OrderItemResponseDto
            {
                ProductId = i.ProductId,
                ProductName = i.Product?.Name ?? "Sản phẩm",
                Quantity = i.Quantity,
                UnitPrice = i.UnitPrice
            }).ToList()
        }).ToList();

        return Ok(result);
    }

    /// <summary>
    /// GET /api/v1/orders/{id}
    /// Xem chi tiết một đơn hàng kèm bảo vệ IDOR
    /// </summary>
    [HttpGet("{id}")]
    [Authorize]
    public async Task<IActionResult> GetOrderById(string id, CancellationToken cancellationToken)
    {
        if (string.Equals(id, "admin", StringComparison.OrdinalIgnoreCase))
        {
            return NotFound(new { detail = "Không tìm thấy đơn hàng yêu cầu." });
        }

        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                     ?? User.FindFirst("sub")?.Value;
        var role = User.FindFirst(ClaimTypes.Role)?.Value
                ?? User.FindFirst("role")?.Value;

        if (string.IsNullOrWhiteSpace(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
        {
            return Unauthorized(new { detail = "Phiên làm việc không hợp lệ." });
        }

        var isAdmin = string.Equals(role, "ADMIN", StringComparison.OrdinalIgnoreCase);

        Order? order = null;
        if (Guid.TryParse(id, out var parsedGuid))
        {
            order = await _dbContext.Orders
                .Include(o => o.Items)
                    .ThenInclude(i => i.Product)
                .AsNoTracking()
                .FirstOrDefaultAsync(o => o.Id == parsedGuid && !o.IsDeleted, cancellationToken);
        }
        else if (id.StartsWith("ord-", StringComparison.OrdinalIgnoreCase))
        {
            var cleanId = id[4..].Trim().ToLowerInvariant();
            // Chỉ nhận hex và dấu gạch (tối đa 36 ký tự của GUID): chặn ký tự đại diện LIKE (% và _) khớp với đơn bất kỳ
            if (cleanId.Length is >= 8 and <= 36 && cleanId.All(c => Uri.IsHexDigit(c) || c == '-'))
            {
                // Truy vấn trực tiếp bằng tiền tố GUID trên CSDL, không nạp toàn bộ bảng lên RAM.
                // Không phải Admin thì chỉ tìm trong đơn của chính mình, tránh khớp nhầm đơn người khác cùng tiền tố.
                var prefixQuery = _dbContext.Orders
                    .Include(o => o.Items)
                        .ThenInclude(i => i.Product)
                    .AsNoTracking()
                    .Where(o => !o.IsDeleted && EF.Functions.Like(o.Id.ToString(), cleanId + "%"));
                if (!isAdmin)
                {
                    prefixQuery = prefixQuery.Where(o => o.UserId == userId);
                }
                order = await prefixQuery.FirstOrDefaultAsync(cancellationToken);
            }
        }

        if (order == null)
        {
            return NotFound(new { detail = "Không tìm thấy đơn hàng yêu cầu." });
        }

        // Bảo vệ IDOR: Nếu không thuộc user và không phải ADMIN -> trả 403 Forbidden
        if (order.UserId != userId && !isAdmin)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { detail = "Bạn không có quyền truy cập đơn hàng này." });
        }

        var response = new OrderResponseDto
        {
            OrderId = $"ord-{order.Id.ToString()[..8]}",
            TotalAmount = order.TotalAmount,
            PaymentMethod = order.PaymentMethod,
            OrderStatus = order.Status,
            ReceiverName = order.ReceiverName,
            Notes = order.Notes,
            ShippingAddress = order.ShippingAddress,
            PhoneNumber = order.PhoneNumber,
            CreatedAt = order.CreatedAt,
            Items = order.Items.Select(i => new OrderItemResponseDto
            {
                ProductId = i.ProductId,
                ProductName = i.Product?.Name ?? "Sản phẩm",
                Quantity = i.Quantity,
                UnitPrice = i.UnitPrice
            }).ToList()
        };

        return Ok(response);
    }

    private static readonly Dictionary<string, HashSet<string>> AllowedStatusTransitions = new()
    {
        ["PENDING"] = new() { "CONFIRMED", "SHIPPING", "CANCELLED" },
        ["CONFIRMED"] = new() { "SHIPPING", "CANCELLED" },
        ["SHIPPING"] = new() { "COMPLETED", "CANCELLED" },
        ["COMPLETED"] = new(),
        ["CANCELLED"] = new(),
    };

    /// <summary>
    /// PATCH /api/v1/orders/{id}/status
    /// Cập nhật trạng thái đơn hàng (Dành riêng cho Quản trị viên)
    /// </summary>
    [HttpPatch("{id}/status")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<IActionResult> UpdateOrderStatus(
        string id,
        [FromBody] UpdateOrderStatusDto dto,
        CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var validStatuses = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "PENDING", "CONFIRMED", "SHIPPING", "COMPLETED", "CANCELLED"
        };

        var targetStatus = dto.Status?.Trim().ToUpperInvariant() ?? "";
        if (!validStatuses.Contains(targetStatus))
        {
            return BadRequest(new { detail = $"Trạng thái '{dto.Status}' không hợp lệ. Trạng thái cho phép: PENDING, CONFIRMED, SHIPPING, COMPLETED, CANCELLED." });
        }

        Order? order = null;
        if (Guid.TryParse(id, out var parsedGuid))
        {
            order = await _dbContext.Orders
                .Include(o => o.Items)
                    .ThenInclude(i => i.Product)
                .Include(o => o.User)
                .FirstOrDefaultAsync(o => o.Id == parsedGuid && !o.IsDeleted, cancellationToken);
        }
        else if (id.StartsWith("ord-", StringComparison.OrdinalIgnoreCase))
        {
            var cleanId = id[4..].Trim().ToLowerInvariant();
            if (cleanId.Length is >= 8 and <= 36 && cleanId.All(c => Uri.IsHexDigit(c) || c == '-'))
            {
                var matches = await _dbContext.Orders
                    .Include(o => o.Items)
                        .ThenInclude(i => i.Product)
                    .Include(o => o.User)
                    .Where(o => !o.IsDeleted && EF.Functions.Like(o.Id.ToString(), cleanId + "%"))
                    .Take(2)
                    .ToListAsync(cancellationToken);
                if (matches.Count > 1)
                {
                    return Conflict(new { detail = "Mã đơn rút gọn trùng với nhiều đơn hàng. Vui lòng dùng mã đầy đủ." });
                }
                order = matches.FirstOrDefault();
            }
        }

        if (order == null)
        {
            return NotFound(new { detail = "Không tìm thấy đơn hàng yêu cầu." });
        }

        var currentStatus = order.Status.Trim().ToUpperInvariant();
        if (currentStatus == targetStatus)
        {
            return Ok(new { message = "Trạng thái đơn hàng không thay đổi.", order_id = $"ord-{order.Id.ToString()[..8]}", order_status = order.Status });
        }

        // Chỉ cho đi tiếp theo luồng giao hàng. Đơn đã hoàn tất hoặc đã hủy là trạng thái cuối:
        // không hủy đơn đã giao xong (sẽ cộng kho sai), không quay lùi trạng thái.
        if (!AllowedStatusTransitions.TryGetValue(currentStatus, out var allowedNext) || !allowedNext.Contains(targetStatus))
        {
            return BadRequest(new { detail = $"Không thể chuyển đơn hàng từ '{currentStatus}' sang '{targetStatus}'." });
        }

        await using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        // Chốt trạng thái nguyên tử: chỉ cập nhật khi đơn vẫn đang ở trạng thái vừa đọc.
        // Hai admin bấm cùng lúc thì chỉ 1 người thành công, kho không bị cộng hoàn 2 lần.
        var now = DateTime.UtcNow;
        var orderId = order.Id;
        var expectedStatus = order.Status;
        var claimed = await _dbContext.Orders
            .Where(o => o.Id == orderId && !o.IsDeleted && o.Status == expectedStatus)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.Status, targetStatus)
                .SetProperty(o => o.UpdatedAt, now), cancellationToken);
        if (claimed == 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Conflict(new { detail = "Đơn hàng vừa được cập nhật bởi người khác. Vui lòng tải lại danh sách." });
        }

        // Hủy đơn: hoàn trả tồn kho cho các sản phẩm trong đơn (cùng transaction với việc đổi trạng thái)
        if (targetStatus == "CANCELLED")
        {
            foreach (var item in order.Items)
            {
                await _dbContext.Products
                    .Where(p => p.Id == item.ProductId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(p => p.StockQuantity, p => p.StockQuantity + item.Quantity)
                        .SetProperty(p => p.UpdatedAt, now), cancellationToken);
            }
            _logger.LogInformation("Đã hoàn trả tồn kho cho các sản phẩm thuộc đơn {OrderId} do Admin hủy đơn.", order.Id);
        }

        await transaction.CommitAsync(cancellationToken);

        order.Status = targetStatus;
        order.UpdatedAt = now;

        _logger.LogInformation("Admin đã cập nhật trạng thái đơn hàng {OrderId} từ {OldStatus} sang {NewStatus}", order.Id, currentStatus, targetStatus);

        var response = new OrderResponseDto
        {
            OrderId = $"ord-{order.Id.ToString()[..8]}",
            UserId = order.UserId,
            CustomerName = order.User?.FullName,
            CustomerEmail = order.User?.Email,
            CustomerPhone = order.User?.Phone,
            TotalAmount = order.TotalAmount,
            PaymentMethod = order.PaymentMethod,
            OrderStatus = order.Status,
            ReceiverName = order.ReceiverName,
            Notes = order.Notes,
            ShippingAddress = order.ShippingAddress,
            PhoneNumber = order.PhoneNumber,
            CreatedAt = order.CreatedAt,
            UpdatedAt = order.UpdatedAt,
            Items = order.Items.Select(i => new OrderItemResponseDto
            {
                ProductId = i.ProductId,
                ProductName = i.Product?.Name ?? "Sản phẩm",
                Quantity = i.Quantity,
                UnitPrice = i.UnitPrice
            }).ToList()
        };

        return Ok(response);
    }
}
