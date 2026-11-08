import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, Clock, CheckCircle2, AlertCircle, ShoppingBag,
  Truck, ArrowLeft, RefreshCw, Calendar, Phone, MapPin
} from 'lucide-react';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface OrderItemDto {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  image_url: string;
}

interface OrderResponseDto {
  id: string;
  receiver_name: string;
  phone_number: string;
  shipping_address: string;
  total_amount: number;
  payment_method: string;
  order_status: string;
  notes?: string;
  created_at: string;
  items: OrderItemDto[];
}

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<OrderResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<OrderResponseDto[]>('/orders');
      setOrders(res.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING':
      case 'PENDING_CONFIRMATION':
        return (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300">
            <Clock className="w-3 h-3 mr-1" />
            Chờ xác nhận
          </Badge>
        );
      case 'CONFIRMED':
      case 'SHIPPING':
        return (
          <Badge className="bg-blue-100 text-blue-900 border-blue-300">
            <Truck className="w-3 h-3 mr-1" />
            Đang vận chuyển
          </Badge>
        );
      case 'DELIVERED':
      case 'COMPLETED':
        return (
          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Đã giao hàng
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Đã hủy
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" asChild className="gap-1 -ml-2 text-xs">
              <Link to="/store">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Về Cửa hàng</span>
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Lịch sử Đơn hàng Vật tư
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Theo dõi trạng thái giao nhận và chi tiết các đơn thuốc BVTV đã đặt.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchOrders}
          disabled={loading}
          className="gap-2 shrink-0 bg-card border-border hover:bg-muted"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-xl bg-card border border-border p-6 animate-pulse space-y-3">
              <div className="flex justify-between">
                <div className="h-4 bg-muted rounded w-1/4" />
                <div className="h-6 bg-muted rounded w-24" />
              </div>
              <div className="h-3 bg-muted rounded w-1/2" />
              <div className="h-10 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-destructive/10 border border-destructive/20 rounded-xl text-destructive space-y-3">
          <AlertCircle className="w-8 h-8 mx-auto" />
          <p className="font-semibold">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchOrders}>
            Thử lại
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-12 text-center bg-card border border-border rounded-xl space-y-3">
          <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <h3 className="text-lg font-bold text-foreground">Bạn chưa có đơn hàng nào</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Khám phá danh mục thuốc BVTV sinh học và hữu cơ chính hãng để bảo vệ mùa màng.
          </p>
          <Button className="mt-2 bg-emerald-700 hover:bg-emerald-800 text-white" asChild>
            <Link to="/store">Mua vật tư ngay</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const formattedDate = new Date(order.created_at).toLocaleString('vi-VN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <Card key={order.id} className="border-border bg-card shadow-xs overflow-hidden">
                <CardHeader className="bg-muted/30 p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-emerald-700" />
                      <CardTitle className="text-sm font-bold text-foreground">
                        Mã đơn: <span className="font-mono text-primary">{order.id}</span>
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formattedDate}
                      </span>
                      <span>•</span>
                      <span>Thanh toán: <strong className="text-foreground">{order.payment_method}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {getStatusBadge(order.order_status)}
                    <span className="text-base font-extrabold text-emerald-800">
                      {order.total_amount.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-4">
                  {/* Danh sách sản phẩm trong đơn */}
                  <div className="divide-y divide-border/60">
                    {order.items.map((item) => (
                      <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold text-[11px]">
                            {item.quantity}x
                          </span>
                          <div>
                            <span className="font-semibold text-foreground text-sm">{item.product_name}</span>
                            <div className="text-muted-foreground text-[11px]">
                              Đơn giá: {item.unit_price.toLocaleString('vi-VN')} đ
                            </div>
                          </div>
                        </div>

                        <span className="font-bold text-foreground">
                          {item.subtotal.toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Thông tin giao hàng */}
                  <div className="bg-muted/20 p-3 rounded-lg border border-border text-xs space-y-1 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>
                        Giao tới: <strong className="text-foreground">{order.receiver_name}</strong> ({order.phone_number}) – {order.shipping_address}
                      </span>
                    </div>
                    {order.notes && (
                      <div className="text-[11px] italic pl-5">
                        Ghi chú: {order.notes}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
