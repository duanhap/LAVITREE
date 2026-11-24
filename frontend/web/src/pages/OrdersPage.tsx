import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, AlertCircle, ArrowLeft, RefreshCw, Calendar, MapPin, ChevronRight
} from 'lucide-react';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import laviWavingImg from '@/assets/brand/lavi-waving-3d.webp';
import type { OrderResponseDto } from '@/features/orders/types';
import { getPaymentMethodLabel } from '@/features/orders/status';
import { OrderStatusBadge } from '@/features/orders/components/OrderStatusBadge';

// Mỗi thẻ chỉ hiện vài sản phẩm đầu cho gọn; xem đủ ở trang chi tiết
const PREVIEW_ITEM_COUNT = 2;

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
        <div className="p-10 text-center bg-card border border-dashed border-border rounded-2xl space-y-4 max-w-md mx-auto shadow-2xs">
          <div className="relative mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl scale-75" />
            <img
              src={laviWavingImg}
              alt="Lavi vẫy chào"
              className="relative w-32 h-32 object-contain mx-auto drop-shadow-sm select-none"
            />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-foreground">Bạn chưa có đơn hàng nào</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Khám phá danh mục thuốc BVTV sinh học và hữu cơ chính hãng theo chuẩn Thông tư 75/2025 để bảo vệ mùa màng.
            </p>
          </div>
          <Button className="mt-2 bg-primary hover:bg-primary-hover text-white h-10 px-6 shadow-xs" asChild>
            <Link to="/store">Mua vật tư ngay</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => {
            const preview = order.items.slice(0, PREVIEW_ITEM_COUNT);
            const hiddenCount = order.items.length - preview.length;
            const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
            return (
              <li key={order.order_id}>
                <Link
                  to={`/orders/${encodeURIComponent(order.order_id)}`}
                  className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label={`Xem chi tiết đơn ${order.order_id}`}
                >
                  <Card className="border-border bg-card shadow-xs overflow-hidden transition-all group-hover:border-primary/50 group-hover:shadow-md">
                    <CardHeader className="bg-muted/30 p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Package className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                          <CardTitle className="text-sm font-bold text-foreground">
                            Mã đơn: <span className="font-mono text-primary">{order.order_id}</span>
                          </CardTitle>
                          <OrderStatusBadge status={order.order_status} />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                            {formatDate(order.created_at)}
                          </span>
                          <span aria-hidden="true">•</span>
                          <span>{itemCount} sản phẩm</span>
                          <span aria-hidden="true">•</span>
                          <span>{getPaymentMethodLabel(order.payment_method).short}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <span className="text-base font-extrabold text-emerald-800 dark:text-emerald-400">
                          {formatCurrency(order.total_amount)}
                        </span>
                        <span className="inline-flex items-center text-xs font-semibold text-primary">
                          Xem chi tiết
                          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </span>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-5 space-y-3">
                      <div className="divide-y divide-border/60">
                        {preview.map((item) => (
                          <div key={`${order.order_id}-${item.product_id}`} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-xs gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-7 h-6 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center font-bold text-[11px] shrink-0">
                                {item.quantity}x
                              </span>
                              <span className="font-semibold text-foreground text-sm truncate">{item.product_name}</span>
                            </div>
                            <span className="font-bold text-foreground whitespace-nowrap shrink-0">
                              {formatCurrency(item.total_price)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {hiddenCount > 0 && (
                        <p className="text-xs text-muted-foreground">+ {hiddenCount} sản phẩm khác</p>
                      )}

                      <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                        <span className="truncate">
                          {order.receiver_name ? <strong className="text-foreground">{order.receiver_name}</strong> : null}
                          {order.receiver_name ? ' · ' : ''}
                          {order.shipping_address}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default OrdersPage;
