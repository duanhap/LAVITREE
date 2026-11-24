import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  CreditCard,
  Loader2,
  MapPin,
  MessageSquareText,
  Package,
  Phone,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  User,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ErrorState } from '@/components/common/ErrorState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { useAuth } from '@/context/AuthContext';
import { getProduct } from '@/features/products/api';
import type { ProductDetailResponse } from '@/features/products/types';
import type { OrderResponseDto } from '@/features/orders/types';
import { getPaymentMethodLabel, normalizeOrderStatus } from '@/features/orders/status';
import { OrderStatusBadge } from '@/features/orders/components/OrderStatusBadge';
import { OrderTimeline } from '@/features/orders/components/OrderTimeline';
import { getCartStorageKey, reorderItems } from '@/features/orders/reorder';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; order: OrderResponseDto }
  | { kind: 'not_found' }
  | { kind: 'error'; error: unknown };

export const OrderDetailPage: React.FC = () => {
  const { orderId = '' } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  // Ảnh & tình trạng bán hiện tại của từng sản phẩm (tải song song, lỗi thì bỏ qua)
  const [products, setProducts] = useState<Record<number, ProductDetailResponse | null>>({});
  const [copied, setCopied] = useState(false);
  const [reordering, setReordering] = useState(false);

  const fetchOrder = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await apiClient.get<OrderResponseDto>(`/orders/${encodeURIComponent(orderId)}`);
      setState({ kind: 'ready', order: res.data });
    } catch (err) {
      // 403 (đơn của người khác) hiển thị như 404 để không lộ đơn có tồn tại hay không
      if (axios.isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 403)) {
        setState({ kind: 'not_found' });
      } else {
        setState({ kind: 'error', error: err });
      }
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const order = state.kind === 'ready' ? state.order : null;

  useEffect(() => {
    if (!order) return;
    let cancelled = false;
    const ids = Array.from(new Set(order.items.map(i => i.product_id)));
    Promise.allSettled(ids.map(id => getProduct(id))).then(results => {
      if (cancelled) return;
      const map: Record<number, ProductDetailResponse | null> = {};
      results.forEach((r, idx) => {
        map[ids[idx]] = r.status === 'fulfilled' ? r.value : null;
      });
      setProducts(map);
    });
    return () => {
      cancelled = true;
    };
  }, [order]);

  const totals = useMemo(() => {
    if (!order) return { subtotal: 0, itemCount: 0 };
    return {
      subtotal: order.items.reduce((sum, i) => sum + (i.total_price ?? i.unit_price * i.quantity), 0),
      itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
    };
  }, [order]);

  const handleCopyId = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.order_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Không sao chép được mã đơn.');
    }
  };

  const handleReorder = async () => {
    if (!order || reordering) return;
    setReordering(true);
    try {
      const result = await reorderItems(order.items, getCartStorageKey(user?.id));
      if (result.added.length === 0) {
        toast.error('Các sản phẩm trong đơn này hiện không còn bán hoặc đã hết hàng.');
        return;
      }
      const reduced = result.added.filter(a => a.reduced).map(a => a.name);
      const notes = [
        result.skipped.length > 0
          ? `Bỏ qua: ${result.skipped.map(s => `${s.name} (${s.reason})`).join(', ')}.`
          : '',
        reduced.length > 0 ? `Giảm số lượng theo tồn kho: ${reduced.join(', ')}.` : '',
      ]
        .filter(Boolean)
        .join(' ');
      toast.success(`Đã thêm ${result.added.length} sản phẩm vào giỏ hàng.`, {
        description: notes || 'Giá được cập nhật theo giá bán hiện tại.',
      });
      navigate('/store?openCart=true');
    } catch {
      toast.error('Không thể thêm vào giỏ hàng. Vui lòng thử lại.');
    } finally {
      setReordering(false);
    }
  };

  if (state.kind === 'loading') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <PageSkeleton variant="detail" />
      </div>
    );
  }

  if (state.kind === 'not_found') {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center">
          <Package className="w-7 h-7 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Không tìm thấy đơn hàng</h1>
        <p className="text-sm text-muted-foreground">
          Mã đơn <span className="font-mono">{orderId}</span> không tồn tại hoặc không thuộc tài khoản của bạn.
        </p>
        <Button asChild>
          <Link to="/orders">Về danh sách đơn hàng</Link>
        </Button>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <ErrorState title="Không tải được đơn hàng" error={state.error} onRetry={fetchOrder} />
      </div>
    );
  }

  const o = state.order;
  const payment = getPaymentMethodLabel(o.payment_method);
  const isCancelled = normalizeOrderStatus(o.order_status) === 'CANCELLED';

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl animate-fade-in pb-24 lg:pb-8">
      {/* Đầu trang */}
      <div className="mb-6 space-y-3">
        <Button variant="ghost" size="sm" asChild className="gap-1 -ml-2 text-xs">
          <Link to="/orders">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Đơn hàng của tôi</span>
          </Link>
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Đơn <span className="font-mono text-primary">{o.order_id}</span>
              </h1>
              <button
                type="button"
                onClick={handleCopyId}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Sao chép mã đơn"
                title="Sao chép mã đơn"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
              <OrderStatusBadge status={o.order_status} />
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              Đặt lúc {formatDate(o.created_at)} · {totals.itemCount} sản phẩm
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={fetchOrder} className="gap-2 self-start sm:self-auto">
            <RefreshCw className="w-3.5 h-3.5" />
            Cập nhật trạng thái
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        {/* Cột trái: tiến trình + sản phẩm */}
        <div className="space-y-6 min-w-0">
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Tình trạng đơn hàng</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderTimeline status={o.order_status} createdAt={o.created_at} updatedAt={o.updated_at} />
            </CardContent>
          </Card>

          <Card className="border-border shadow-xs overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Sản phẩm đã đặt ({o.items.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {o.items.map(item => {
                  const product = products[item.product_id];
                  const loaded = item.product_id in products;
                  const stillSold = product && product.is_allowed && product.availability !== 'NOT_SOLD';
                  return (
                    <li key={`${o.order_id}-${item.product_id}`}>
                      <Link
                        to={`/store/${item.product_id}`}
                        className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3.5 hover:bg-muted/40 transition-colors group"
                      >
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg border border-border bg-muted/40 overflow-hidden shrink-0 flex items-center justify-center">
                          {product?.image_url ? (
                            <img
                              src={product.image_url}
                              alt={item.product_name}
                              loading="lazy"
                              className="w-full h-full object-contain p-1"
                            />
                          ) : !loaded ? (
                            <span className="w-full h-full animate-pulse bg-muted" />
                          ) : (
                            <Package className="w-6 h-6 text-muted-foreground/60" aria-hidden="true" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {item.product_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(item.unit_price)} × {item.quantity}
                          </p>
                          {loaded && !stillSold && (
                            <p className="text-[11px] text-amber-700 dark:text-amber-400">Hiện không còn bán</p>
                          )}
                        </div>

                        <span className="text-sm font-bold text-foreground whitespace-nowrap">
                          {formatCurrency(item.total_price ?? item.unit_price * item.quantity)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <p className="px-4 sm:px-6 py-2.5 text-[11px] text-muted-foreground bg-muted/30 border-t border-border">
                Giá trên là giá tại thời điểm đặt hàng.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Cột phải: tóm tắt (dính khi cuộn trên màn hình lớn) */}
        <aside className="space-y-6 lg:sticky lg:top-20">
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Thanh toán</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Tạm tính ({totals.itemCount} sản phẩm)</span>
                <span className="text-foreground">{formatCurrency(totals.subtotal)}</span>
              </div>
              {Math.round(o.total_amount) !== Math.round(totals.subtotal) && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Điều chỉnh</span>
                  <span className="text-foreground">{formatCurrency(o.total_amount - totals.subtotal)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-baseline">
                <span className="font-semibold text-foreground">Tổng cộng</span>
                <span className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(o.total_amount)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2">
                <CreditCard className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{payment.full}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Thông tin nhận hàng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              {o.receiver_name && (
                <div className="flex items-start gap-2.5">
                  <User className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="font-semibold text-foreground">{o.receiver_name}</span>
                </div>
              )}
              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-foreground">{o.phone_number}</span>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-foreground break-words">{o.shipping_address}</span>
              </div>
              {o.notes && (
                <div className="flex items-start gap-2.5">
                  <MessageSquareText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-muted-foreground italic break-words">{o.notes}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Nút hành động trên màn hình lớn */}
          <div className="hidden lg:flex flex-col gap-2">
            <Button onClick={handleReorder} disabled={reordering} className="gap-2 h-10">
              {reordering ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              {isCancelled ? 'Đặt lại đơn này' : 'Mua lại'}
            </Button>
            <Button variant="outline" asChild className="gap-2 h-10">
              <Link to="/store">
                <ShoppingBag className="w-4 h-4" />
                Tiếp tục mua sắm
              </Link>
            </Button>
          </div>
        </aside>
      </div>

      {/* Thanh hành động dính đáy trên điện thoại */}
      <div className="lg:hidden fixed inset-x-0 bottom-16 md:bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80 px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted-foreground">Tổng cộng</p>
          <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">{formatCurrency(o.total_amount)}</p>
        </div>
        <Button onClick={handleReorder} disabled={reordering} className="gap-2 h-10 px-5">
          {reordering ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          {isCancelled ? 'Đặt lại' : 'Mua lại'}
        </Button>
      </div>
    </div>
  );
};

export default OrderDetailPage;
