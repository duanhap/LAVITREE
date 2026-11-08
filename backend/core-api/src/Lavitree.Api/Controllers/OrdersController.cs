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

        // Lấy danh sách ProductId để query 1 lần chống N+1
        var productIds = dto.Items.Select(i => i.ProductId).Distinct().ToList();
        var products = await _dbContext.Products
            .Where(p => productIds.Contains(p.Id) && !p.IsDeleted)
            .ToDictionaryAsync(p => p.Id, cancellationToken);

        decimal totalAmount = 0;
        var orderItems = new List<OrderItem>();
        var responseItems = new List<OrderItemResponseDto>();

        foreach (var item in dto.Items)
        {
            if (!products.TryGetValue(item.ProductId, out var product))
            {
                return BadRequest(new { detail = $"Không tìm thấy sản phẩm có mã {item.ProductId} trên hệ thống." });
            }

            // Chốt chặn bảo mật SSOT: Tuyệt đối không bán thuốc bị cấm lưu hành (IsAllowed == false)
            if (!product.IsAllowed)
            {
                _logger.LogWarning("Từ chối đặt mua thuốc không được phép lưu hành: {ProductName} (ID: {ProductId})", product.Name, product.Id);
                return BadRequest(new { detail = $"Sản phẩm '{product.Name}' hiện không được phép lưu hành hoặc đã bị đình chỉ theo quy định." });
            }

            // Kiểm tra số lượng tồn kho
            if (product.StockQuantity < item.Quantity)
            {
                return BadRequest(new { detail = $"Sản phẩm '{product.Name}' không đủ tồn kho (Còn lại: {product.StockQuantity}, yêu cầu: {item.Quantity})." });
            }

            // Trừ tồn kho và tính tiền theo giá niêm yết trong CSDL
            product.StockQuantity -= item.Quantity;
            product.UpdatedAt = DateTime.UtcNow;

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
            ShippingAddress = dto.ShippingAddress.Trim(),
            PhoneNumber = dto.PhoneNumber.Trim(),
            CreatedAt = DateTime.UtcNow,
            Items = orderItems
        };

        _dbContext.Orders.Add(order);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Đã tạo thành công đơn hàng {OrderId} cho User {UserId}, tổng tiền: {TotalAmount:N0} VNĐ", order.Id, userId, totalAmount);

        var response = new OrderResponseDto
        {
            OrderId = $"ord-{order.Id.ToString()[..8]}",
            TotalAmount = order.TotalAmount,
            PaymentMethod = order.PaymentMethod,
            OrderStatus = order.Status,
            ShippingAddress = order.ShippingAddress,
            PhoneNumber = order.PhoneNumber,
            CreatedAt = order.CreatedAt,
            Items = responseItems
        };

        return StatusCode(StatusCodes.Status201Created, response);
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
    /// GET /api/v1/orders/{id}
    /// Xem chi tiết một đơn hàng kèm bảo vệ IDOR
    /// </summary>
    [HttpGet("{id}")]
    [Authorize]
    public async Task<IActionResult> GetOrderById(string id, CancellationToken cancellationToken)
    {
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
        else
        {
            var cleanId = id.StartsWith("ord-", StringComparison.OrdinalIgnoreCase) ? id[4..] : id;
            var list = await _dbContext.Orders
                .Include(o => o.Items)
                    .ThenInclude(i => i.Product)
                .Where(o => !o.IsDeleted)
                .AsNoTracking()
                .ToListAsync(cancellationToken);

            order = list.FirstOrDefault(o => o.Id.ToString("N").StartsWith(cleanId, StringComparison.OrdinalIgnoreCase) ||
                                            o.Id.ToString().StartsWith(cleanId, StringComparison.OrdinalIgnoreCase));
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
}
