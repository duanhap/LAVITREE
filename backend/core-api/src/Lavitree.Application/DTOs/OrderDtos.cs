using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Lavitree.Application.DTOs;

public class CreateOrderItemDto
{
    [Required(ErrorMessage = "Mã sản phẩm (product_id) không được để trống.")]
    [JsonPropertyName("product_id")]
    public int ProductId { get; set; }

    [Range(1, 100, ErrorMessage = "Số lượng sản phẩm đặt mua phải từ 1 đến 100.")]
    [JsonPropertyName("quantity")]
    public int Quantity { get; set; } = 1;
}

public class CreateOrderDto
{
    [Required(ErrorMessage = "Danh sách sản phẩm không được để trống.")]
    [MinLength(1, ErrorMessage = "Đơn hàng phải có ít nhất 1 sản phẩm.")]
    [JsonPropertyName("items")]
    public List<CreateOrderItemDto> Items { get; set; } = new();

    [Required(ErrorMessage = "Địa chỉ nhận hàng không được để trống.")]
    [MaxLength(500, ErrorMessage = "Địa chỉ nhận hàng không được vượt quá 500 ký tự.")]
    [JsonPropertyName("shipping_address")]
    public string ShippingAddress { get; set; } = string.Empty;

    [Required(ErrorMessage = "Số điện thoại người nhận không được để trống.")]
    [RegularExpression(@"^(0[35789])[0-9]{8}$", ErrorMessage = "Số điện thoại người nhận phải là định dạng di động Việt Nam 10 chữ số.")]
    [JsonPropertyName("phone_number")]
    public string PhoneNumber { get; set; } = string.Empty;

    [JsonPropertyName("phone")]
    public string? Phone
    {
        get => PhoneNumber;
        set { if (!string.IsNullOrWhiteSpace(value)) PhoneNumber = value; }
    }

    [JsonPropertyName("payment_method")]
    public string PaymentMethod { get; set; } = "COD"; // COD | VIETQR
}

public class OrderItemResponseDto
{
    [JsonPropertyName("product_id")]
    public int ProductId { get; set; }

    [JsonPropertyName("product_name")]
    public string ProductName { get; set; } = string.Empty;

    [JsonPropertyName("quantity")]
    public int Quantity { get; set; }

    [JsonPropertyName("unit_price")]
    public decimal UnitPrice { get; set; }

    [JsonPropertyName("total_price")]
    public decimal TotalPrice => UnitPrice * Quantity;
}

public class OrderResponseDto
{
    [JsonPropertyName("order_id")]
    public string OrderId { get; set; } = string.Empty;

    [JsonPropertyName("total_amount")]
    public decimal TotalAmount { get; set; }

    [JsonPropertyName("payment_method")]
    public string PaymentMethod { get; set; } = "COD";

    [JsonPropertyName("order_status")]
    public string OrderStatus { get; set; } = "Pending";

    [JsonPropertyName("shipping_address")]
    public string ShippingAddress { get; set; } = string.Empty;

    [JsonPropertyName("phone_number")]
    public string PhoneNumber { get; set; } = string.Empty;

    [JsonPropertyName("created_at")]
    public DateTime CreatedAt { get; set; }

    [JsonPropertyName("items")]
    public List<OrderItemResponseDto> Items { get; set; } = new();
}
