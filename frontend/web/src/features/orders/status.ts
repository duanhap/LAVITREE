import { CheckCircle2, Clock, PackageCheck, Truck, XCircle, type LucideIcon } from 'lucide-react';

/**
 * Trạng thái đơn hàng dùng chung cho trang người dùng.
 * Luồng khớp AllowedStatusTransitions trong OrdersController.cs:
 * PENDING → CONFIRMED → SHIPPING → COMPLETED; hủy được trước khi hoàn tất.
 * Đơn cũ có thể lưu "Pending" nên luôn chuẩn hóa chữ hoa trước khi so sánh.
 */
export type OrderStatusKey = 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';

export interface OrderStatusMeta {
  key: OrderStatusKey | 'UNKNOWN';
  label: string;
  description: string;
  icon: LucideIcon;
  badgeClass: string;
}

const STATUS_META: Record<OrderStatusKey, OrderStatusMeta> = {
  PENDING: {
    key: 'PENDING',
    label: 'Chờ xác nhận',
    description: 'Cửa hàng đã nhận đơn và sẽ gọi xác nhận với bạn sớm.',
    icon: Clock,
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800',
  },
  CONFIRMED: {
    key: 'CONFIRMED',
    label: 'Đã xác nhận',
    description: 'Đơn đã được xác nhận, cửa hàng đang chuẩn bị hàng.',
    icon: PackageCheck,
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-800',
  },
  SHIPPING: {
    key: 'SHIPPING',
    label: 'Đang giao hàng',
    description: 'Hàng đang trên đường tới bạn. Vui lòng để ý điện thoại.',
    icon: Truck,
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-800',
  },
  COMPLETED: {
    key: 'COMPLETED',
    label: 'Đã giao hàng',
    description: 'Đơn hàng đã giao thành công. Cảm ơn bạn đã tin dùng Lavitree!',
    icon: CheckCircle2,
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800',
  },
  CANCELLED: {
    key: 'CANCELLED',
    label: 'Đã hủy',
    description: 'Đơn hàng đã bị hủy. Nếu đã chuyển khoản, cửa hàng sẽ liên hệ hoàn tiền.',
    icon: XCircle,
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800',
  },
};

// Tên cũ từng dùng ở dữ liệu mẫu
const LEGACY_ALIASES: Record<string, OrderStatusKey> = {
  PENDING_CONFIRMATION: 'PENDING',
  DELIVERED: 'COMPLETED',
};

export function normalizeOrderStatus(status: string | null | undefined): OrderStatusKey | null {
  const s = (status || '').trim().toUpperCase();
  if (s in STATUS_META) return s as OrderStatusKey;
  return LEGACY_ALIASES[s] ?? null;
}

export function getOrderStatusMeta(status: string | null | undefined): OrderStatusMeta {
  const key = normalizeOrderStatus(status);
  if (key) return STATUS_META[key];
  return {
    key: 'UNKNOWN',
    label: status || 'Không rõ',
    description: '',
    icon: Clock,
    badgeClass: 'bg-muted text-muted-foreground border-border',
  };
}

/** Các bước hiển thị trên thanh tiến trình (không gồm CANCELLED) */
export const ORDER_PROGRESS_STEPS: { key: Exclude<OrderStatusKey, 'CANCELLED'>; label: string }[] = [
  { key: 'PENDING', label: 'Đã đặt hàng' },
  { key: 'CONFIRMED', label: 'Đã xác nhận' },
  { key: 'SHIPPING', label: 'Đang giao' },
  { key: 'COMPLETED', label: 'Đã giao' },
];

export function getPaymentMethodLabel(method: string | null | undefined): { short: string; full: string } {
  switch ((method || '').toUpperCase()) {
    case 'VIETQR':
      return { short: 'VietQR', full: 'Chuyển khoản VietQR' };
    case 'COD':
    default:
      return { short: 'COD', full: 'Thanh toán khi nhận hàng (COD)' };
  }
}
