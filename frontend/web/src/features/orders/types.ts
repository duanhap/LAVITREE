/**
 * Kiểu dữ liệu đơn hàng phía người dùng, khớp OrderDtos.cs và api-contracts.md mục 3.6.1–3.6.2
 */

export interface OrderItemDto {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface OrderResponseDto {
  order_id: string;
  total_amount: number;
  payment_method: string;
  order_status: string;
  receiver_name?: string | null;
  notes?: string | null;
  shipping_address: string;
  phone_number: string;
  created_at: string;
  updated_at?: string | null;
  items: OrderItemDto[];
}
