import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package, Clock, CheckCircle2, AlertCircle,
  Truck, RefreshCw, Search, Eye, MoreVertical,
  Check, X, Phone, MapPin, User, Calendar, CreditCard,
  Copy, ExternalLink, Filter, ShoppingBag
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

// Khớp AllowedStatusTransitions trong OrdersController.cs: không quay lùi, COMPLETED / CANCELLED là trạng thái cuối
const ALLOWED_NEXT_STATUS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'SHIPPING', 'CANCELLED'],
  CONFIRMED: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const canMoveTo = (current: string | null | undefined, target: string) =>
  (ALLOWED_NEXT_STATUS[(current || '').toUpperCase()] || []).includes(target);

interface OrderItemDto {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface AdminOrderDto {
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
  user_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  items: OrderItemDto[];
}

type StatusFilterType = 'ALL' | 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';

export const AdminOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<AdminOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderDto | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Dialog xác nhận hủy đơn
  const [cancelTargetOrder, setCancelTargetOrder] = useState<AdminOrderDto | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<AdminOrderDto[]>('/orders/admin');
      setOrders(res.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Cập nhật trạng thái đơn hàng
  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      setUpdatingId(orderId);
      const res = await apiClient.patch<AdminOrderDto>(`/orders/${orderId}/status`, {
        status: newStatus
      });

      const updated = res.data;
      setOrders(prev => prev.map(o => (o.order_id === orderId ? { ...o, ...updated, order_status: newStatus } : o)));

      if (selectedOrder && selectedOrder.order_id === orderId) {
        setSelectedOrder(prev => (prev ? { ...prev, ...updated, order_status: newStatus } : null));
      }

      setActionSuccessMsg(`Cập nhật đơn ${orderId} sang trạng thái "${getStatusLabel(newStatus)}" thành công!`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err) {
      toast.error(`Lỗi khi cập nhật trạng thái đơn: ${getErrorMessage(err)}`);
      // 409: đơn vừa bị người khác cập nhật; 400: trạng thái trên màn hình đã cũ. Tải lại để thấy đúng.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409 || status === 400) {
        fetchOrders();
      }
    } finally {
      setUpdatingId(null);
      setCancelTargetOrder(null);
    }
  };

  const getStatusLabel = (status: string) => {
    switch ((status || '').toUpperCase()) {
      case 'PENDING':
        return 'Chờ xác nhận';
      case 'CONFIRMED':
        return 'Đã xác nhận';
      case 'SHIPPING':
        return 'Đang giao hàng';
      case 'COMPLETED':
      case 'DELIVERED':
        return 'Hoàn thành';
      case 'CANCELLED':
        return 'Đã hủy';
      default:
        return status;
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'PENDING':
        return (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200">
            <Clock className="w-3 h-3 mr-1" />
            Chờ xác nhận
          </Badge>
        );
      case 'CONFIRMED':
        return (
          <Badge className="bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950 dark:text-sky-200">
            <Check className="w-3 h-3 mr-1" />
            Đã xác nhận
          </Badge>
        );
      case 'SHIPPING':
        return (
          <Badge className="bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200">
            <Truck className="w-3 h-3 mr-1" />
            Đang giao
          </Badge>
        );
      case 'COMPLETED':
      case 'DELIVERED':
        return (
          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Hoàn thành
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="destructive" className="bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Đã hủy
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Tính toán thống kê
  const stats = useMemo(() => {
    const total = orders.length;
    let pending = 0;
    let shipping = 0;
    let completed = 0;
    let revenue = 0;

    for (const o of orders) {
      const s = (o.order_status || '').toUpperCase();
      if (s === 'PENDING') pending++;
      else if (s === 'CONFIRMED' || s === 'SHIPPING') shipping++;
      else if (s === 'COMPLETED' || s === 'DELIVERED') {
        completed++;
        revenue += o.total_amount;
      }
    }

    return { total, pending, shipping, completed, revenue };
  }, [orders]);

  // Bộ lọc dữ liệu hiển thị
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const s = (o.order_status || '').toUpperCase();
      const matchStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'COMPLETED'
          ? s === 'COMPLETED' || s === 'DELIVERED'
          : s === statusFilter;

      if (!matchStatus) return false;

      if (!search.trim()) return true;

      const q = search.toLowerCase().trim();
      const matchId = o.order_id.toLowerCase().includes(q);
      const matchReceiver = (o.receiver_name || '').toLowerCase().includes(q);
      const matchPhone = (o.phone_number || '').includes(q);
      const matchAddr = (o.shipping_address || '').toLowerCase().includes(q);
      const matchCustomer = (o.customer_name || '').toLowerCase().includes(q);

      return matchId || matchReceiver || matchPhone || matchAddr || matchCustomer;
    });
  }, [orders, statusFilter, search]);

  const copyOrderId = (id: string) => {
    navigator.clipboard.writeText(id);
    setActionSuccessMsg(`Đã sao chép mã đơn: ${id}`);
    setTimeout(() => setActionSuccessMsg(null), 2500);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Quản lý Đơn hàng Toàn sàn
            </h1>
            <Badge variant="outline" className="text-xs bg-muted">
              {orders.length} đơn
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Theo dõi, xác nhận và cập nhật trạng thái đơn hàng vật tư từ bà con nông dân.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrders}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Thông báo thành công */}
      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-sm flex items-center justify-between animate-fade-in dark:bg-emerald-950 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-lg shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Tổng đơn hàng</p>
              <h3 className="text-xl font-bold text-foreground">{stats.total}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 text-amber-800 rounded-lg shrink-0 dark:bg-amber-950 dark:text-amber-300">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Chờ xác nhận</p>
              <h3 className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-800 rounded-lg shrink-0 dark:bg-blue-950 dark:text-blue-300">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Đang giao hàng</p>
              <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.shipping}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-lg shrink-0 dark:bg-emerald-950 dark:text-emerald-300">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Doanh thu hoàn tất</p>
              <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate">
                {formatCurrency(stats.revenue)}
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bộ lọc & Tìm kiếm */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
        {/* Status Filter Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-sm scrollbar-none">
          <Button
            size="sm"
            variant={statusFilter === 'ALL' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('ALL')}
            className="h-8 text-xs font-medium rounded-full"
          >
            Tất cả ({orders.length})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'PENDING' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('PENDING')}
            className="h-8 text-xs font-medium rounded-full"
          >
            Chờ xác nhận ({stats.pending})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'CONFIRMED' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('CONFIRMED')}
            className="h-8 text-xs font-medium rounded-full"
          >
            Đã xác nhận
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'SHIPPING' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('SHIPPING')}
            className="h-8 text-xs font-medium rounded-full"
          >
            Đang giao ({stats.shipping})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'COMPLETED' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('COMPLETED')}
            className="h-8 text-xs font-medium rounded-full"
          >
            Hoàn thành ({stats.completed})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'CANCELLED' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('CANCELLED')}
            className="h-8 text-xs font-medium rounded-full"
          >
            Đã hủy
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80 shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo mã đơn, khách, SĐT..."
            className="pl-9 h-9 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Bảng danh sách đơn hàng */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
          <RefreshCw className="w-8 h-8 animate-spin text-primary mb-3" />
          <p className="text-sm">Đang tải danh sách đơn hàng...</p>
        </div>
      ) : error ? (
        <div className="p-6 border border-rose-200 bg-rose-50 text-rose-800 rounded-xl text-center space-y-3 dark:bg-rose-950 dark:text-rose-200">
          <AlertCircle className="w-8 h-8 mx-auto text-rose-600" />
          <p className="text-sm font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchOrders}>
            Thử lại
          </Button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-xl border-border bg-card/50 space-y-3">
          <Package className="w-10 h-10 mx-auto text-muted-foreground/60" />
          <h3 className="text-base font-semibold text-foreground">Không tìm thấy đơn hàng nào</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {search || statusFilter !== 'ALL'
              ? 'Không có đơn nào khớp với bộ lọc hiện tại. Thử xóa tìm kiếm hoặc chọn bộ lọc khác.'
              : 'Hiện chưa có đơn hàng nào phát sinh trên hệ thống.'}
          </p>
          {(search || statusFilter !== 'ALL') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
              }}
            >
              Xóa bộ lọc
            </Button>
          )}
        </div>
      ) : (
        <div className="border border-border rounded-xl bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs font-semibold">
                  <th className="py-3 px-4">Mã & Ngày đặt</th>
                  <th className="py-3 px-4">Khách hàng / Nhận hàng</th>
                  <th className="py-3 px-4">Sản phẩm đặt mua</th>
                  <th className="py-3 px-4 text-center">Thanh toán</th>
                  <th className="py-3 px-4 text-right">Tổng tiền</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredOrders.map(order => {
                  const s = (order.order_status || '').toUpperCase();
                  const isUpdating = updatingId === order.order_id;

                  return (
                    <tr
                      key={order.order_id}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* Cột 1: Mã đơn & Ngày */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-1.5 font-mono font-medium text-foreground">
                          <span>{order.order_id}</span>
                          <button
                            onClick={() => copyOrderId(order.order_id)}
                            title="Sao chép mã đơn"
                            className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span>{formatDate(order.created_at)}</span>
                        </div>
                      </td>

                      {/* Cột 2: Khách hàng */}
                      <td className="py-3.5 px-4 align-top max-w-[240px]">
                        <div className="font-medium text-foreground">
                          {order.receiver_name || order.customer_name || 'Khách hàng'}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 shrink-0 text-muted-foreground/80" />
                          <a
                            href={`tel:${order.phone_number}`}
                            className="hover:underline text-primary"
                          >
                            {order.phone_number}
                          </a>
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5" title={order.shipping_address}>
                          <MapPin className="w-3 h-3 inline mr-1 text-muted-foreground/80" />
                          {order.shipping_address}
                        </div>
                      </td>

                      {/* Cột 3: Sản phẩm */}
                      <td className="py-3.5 px-4 align-top max-w-[280px]">
                        <div className="space-y-1">
                          {order.items.slice(0, 2).map((item, idx) => (
                            <div key={idx} className="text-xs flex items-baseline justify-between gap-2">
                              <span className="font-medium text-foreground line-clamp-1" title={item.product_name}>
                                • {item.product_name}
                              </span>
                              <span className="text-muted-foreground shrink-0 font-mono">
                                x{item.quantity}
                              </span>
                            </div>
                          ))}
                          {order.items.length > 2 && (
                            <div className="text-[11px] text-muted-foreground italic">
                              + thêm {order.items.length - 2} sản phẩm khác...
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Cột 4: Phương thức TT */}
                      <td className="py-3.5 px-4 align-top text-center">
                        <Badge
                          variant="outline"
                          className={
                            order.payment_method === 'VIETQR'
                              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-stone-50 text-stone-700 border-stone-200 dark:bg-stone-900 dark:text-stone-300'
                          }
                        >
                          {order.payment_method === 'VIETQR' ? 'VietQR' : 'COD'}
                        </Badge>
                      </td>

                      {/* Cột 5: Tổng tiền */}
                      <td className="py-3.5 px-4 align-top text-right font-semibold text-foreground">
                        {formatCurrency(order.total_amount)}
                      </td>

                      {/* Cột 6: Trạng thái */}
                      <td className="py-3.5 px-4 align-top text-center">
                        {getStatusBadge(order.order_status)}
                      </td>

                      {/* Cột 7: Thao tác */}
                      <td className="py-3.5 px-4 align-top text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Xem
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isUpdating}
                                className="h-8 w-8 p-0"
                              >
                                {isUpdating ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <MoreVertical className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 text-xs">
                              <DropdownMenuItem onClick={() => setSelectedOrder(order)}>
                                <Eye className="w-3.5 h-3.5 mr-2" />
                                Xem chi tiết hóa đơn
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              {/* Tùy chọn chuyển trạng thái nhanh */}
                              {s === 'PENDING' && (
                                <DropdownMenuItem
                                  onClick={() => handleUpdateStatus(order.order_id, 'CONFIRMED')}
                                  className="text-sky-600 dark:text-sky-400 font-medium"
                                >
                                  <Check className="w-3.5 h-3.5 mr-2" />
                                  Xác nhận đơn
                                </DropdownMenuItem>
                              )}

                              {(s === 'PENDING' || s === 'CONFIRMED') && (
                                <DropdownMenuItem
                                  onClick={() => handleUpdateStatus(order.order_id, 'SHIPPING')}
                                  className="text-blue-600 dark:text-blue-400 font-medium"
                                >
                                  <Truck className="w-3.5 h-3.5 mr-2" />
                                  Bắt đầu giao hàng
                                </DropdownMenuItem>
                              )}

                              {s === 'SHIPPING' && (
                                <DropdownMenuItem
                                  onClick={() => handleUpdateStatus(order.order_id, 'COMPLETED')}
                                  className="text-emerald-600 dark:text-emerald-400 font-medium"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                                  Đã giao thành công
                                </DropdownMenuItem>
                              )}

                              {s !== 'CANCELLED' && s !== 'COMPLETED' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setCancelTargetOrder(order)}
                                    className="text-rose-600 dark:text-rose-400"
                                  >
                                    <X className="w-3.5 h-3.5 mr-2" />
                                    Hủy đơn hàng
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DIALOG CHI TIẾT ĐƠN HÀNG */}
      <Dialog open={!!selectedOrder} onOpenChange={open => !open && setSelectedOrder(null)}>
        {selectedOrder && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-xl flex items-center gap-2">
                    <span>Đơn hàng: {selectedOrder.order_id}</span>
                    <button
                      onClick={() => copyOrderId(selectedOrder.order_id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Đặt lúc: {formatDate(selectedOrder.created_at)}
                  </DialogDescription>
                </div>
                <div>{getStatusBadge(selectedOrder.order_status)}</div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2 text-sm">
              {/* Thông tin giao hàng */}
              <div className="p-3 bg-muted/40 rounded-lg space-y-2 border border-border/60">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Thông tin nhận hàng
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Người nhận:</span>{' '}
                    <strong className="text-foreground">{selectedOrder.receiver_name || selectedOrder.customer_name || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Số điện thoại:</span>{' '}
                    <a href={`tel:${selectedOrder.phone_number}`} className="font-semibold text-primary underline">
                      {selectedOrder.phone_number}
                    </a>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Địa chỉ nhận:</span>{' '}
                    <span className="text-foreground">{selectedOrder.shipping_address}</span>
                  </div>
                  {selectedOrder.customer_email && (
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">Tài khoản đặt mua:</span>{' '}
                      <span className="text-foreground">{selectedOrder.customer_name} ({selectedOrder.customer_email})</span>
                    </div>
                  )}
                  {selectedOrder.notes && (
                    <div className="sm:col-span-2 p-2 bg-amber-50/70 border border-amber-200/60 rounded text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      <strong>Ghi chú từ nông dân:</strong> {selectedOrder.notes}
                    </div>
                  )}
                </div>
              </div>

              {/* Danh sách mặt hàng */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Chi tiết sản phẩm ({selectedOrder.items.length})
                </h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border text-muted-foreground">
                        <th className="py-2 px-3 text-left">Sản phẩm</th>
                        <th className="py-2 px-3 text-right">Đơn giá</th>
                        <th className="py-2 px-3 text-center">SL</th>
                        <th className="py-2 px-3 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {selectedOrder.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="py-2.5 px-3 font-medium text-foreground">
                            {item.product_name}
                          </td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-medium">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-foreground">
                            {formatCurrency(item.total_price || item.unit_price * item.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 border-t border-border font-medium">
                        <td colSpan={3} className="py-2.5 px-3 text-right text-muted-foreground">
                          Phương thức thanh toán:
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold">
                          {selectedOrder.payment_method === 'VIETQR' ? 'VietQR (Chuyển khoản)' : 'COD (Thu tiền tận nơi)'}
                        </td>
                      </tr>
                      <tr className="bg-muted/60 border-t border-border text-sm font-bold">
                        <td colSpan={3} className="py-3 px-3 text-right text-foreground">
                          Tổng cộng thanh toán:
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(selectedOrder.total_amount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Điều khiển chuyển trạng thái trong Modal */}
              <div className="pt-2 border-t border-border">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Chuyển trạng thái đơn:
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={(selectedOrder.order_status || '').toUpperCase() === 'CONFIRMED' ? 'default' : 'outline'}
                    disabled={updatingId === selectedOrder.order_id || !canMoveTo(selectedOrder.order_status, 'CONFIRMED')}
                    onClick={() => handleUpdateStatus(selectedOrder.order_id, 'CONFIRMED')}
                    className="h-8 text-xs gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Xác nhận đơn
                  </Button>
                  <Button
                    size="sm"
                    variant={(selectedOrder.order_status || '').toUpperCase() === 'SHIPPING' ? 'default' : 'outline'}
                    disabled={updatingId === selectedOrder.order_id || !canMoveTo(selectedOrder.order_status, 'SHIPPING')}
                    onClick={() => handleUpdateStatus(selectedOrder.order_id, 'SHIPPING')}
                    className="h-8 text-xs gap-1"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    Đang giao hàng
                  </Button>
                  <Button
                    size="sm"
                    variant={(selectedOrder.order_status || '').toUpperCase() === 'COMPLETED' ? 'default' : 'outline'}
                    disabled={updatingId === selectedOrder.order_id || !canMoveTo(selectedOrder.order_status, 'COMPLETED')}
                    onClick={() => handleUpdateStatus(selectedOrder.order_id, 'COMPLETED')}
                    className="h-8 text-xs gap-1 text-emerald-600 hover:text-emerald-700"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Hoàn tất giao hàng
                  </Button>
                  {canMoveTo(selectedOrder.order_status, 'CANCELLED') && (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={updatingId === selectedOrder.order_id}
                      onClick={() => setCancelTargetOrder(selectedOrder)}
                      className="h-8 text-xs gap-1 ml-auto"
                    >
                      <X className="w-3.5 h-3.5" />
                      Hủy đơn
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="border-t pt-3">
              <Button variant="outline" size="sm" onClick={() => setSelectedOrder(null)}>
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* DIALOG XÁC NHẬN HỦY ĐƠN HÀNG */}
      <Dialog open={!!cancelTargetOrder} onOpenChange={open => !open && setCancelTargetOrder(null)}>
        {cancelTargetOrder && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-rose-600 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Xác nhận hủy đơn hàng?
              </DialogTitle>
              <DialogDescription className="text-sm pt-2 space-y-2">
                <p>
                  Bạn có chắc chắn muốn hủy đơn hàng <strong>{cancelTargetOrder.order_id}</strong> của khách hàng{' '}
                  <strong>{cancelTargetOrder.receiver_name || cancelTargetOrder.phone_number}</strong> không?
                </p>
                <div className="p-2.5 bg-amber-50 text-amber-900 border border-amber-200 rounded text-xs dark:bg-amber-950 dark:text-amber-200">
                  ⚠️ <strong>Lưu ý:</strong> Khi hủy đơn hàng, hệ thống sẽ tự động hoàn trả số lượng tồn kho cho các sản phẩm trong đơn.
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelTargetOrder(null)}
              >
                Giữ lại
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={updatingId === cancelTargetOrder.order_id}
                onClick={() => handleUpdateStatus(cancelTargetOrder.order_id, 'CANCELLED')}
              >
                {updatingId === cancelTargetOrder.order_id ? 'Đang hủy...' : 'Đồng ý hủy đơn'}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default AdminOrdersPage;
