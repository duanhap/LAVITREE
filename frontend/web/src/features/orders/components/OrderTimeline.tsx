import React from 'react';
import { Check, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { ORDER_PROGRESS_STEPS, getOrderStatusMeta, normalizeOrderStatus } from '../status';

interface OrderTimelineProps {
  status: string;
  createdAt: string;
  updatedAt?: string | null;
}

/**
 * Thanh tiến trình đơn hàng. Hệ thống chỉ lưu thời điểm đặt (created_at) và lần cập nhật cuối (updated_at),
 * nên chỉ ghi giờ ở bước đầu và bước hiện tại; không bịa giờ cho các bước giữa.
 */
export const OrderTimeline: React.FC<OrderTimelineProps> = ({ status, createdAt, updatedAt }) => {
  const key = normalizeOrderStatus(status);
  const meta = getOrderStatusMeta(status);

  if (key === 'CANCELLED') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-4">
        <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-0.5">
          <p className="text-sm font-bold text-rose-900 dark:text-rose-200">Đơn hàng đã bị hủy</p>
          <p className="text-xs text-rose-800/80 dark:text-rose-300/80">{meta.description}</p>
          {updatedAt && (
            <p className="text-[11px] text-rose-700/70 dark:text-rose-300/60">Hủy lúc {formatDate(updatedAt)}</p>
          )}
        </div>
      </div>
    );
  }

  const currentIndex = Math.max(
    0,
    ORDER_PROGRESS_STEPS.findIndex(s => s.key === key)
  );
  const isDone = key === 'COMPLETED';

  return (
    <div className="space-y-4">
      <ol className="grid grid-cols-4 gap-1" aria-label="Tiến trình đơn hàng">
        {ORDER_PROGRESS_STEPS.map((step, idx) => {
          const reached = idx <= currentIndex;
          const isCurrent = idx === currentIndex && !isDone;
          return (
            <li key={step.key} className="relative flex flex-col items-center text-center">
              {/* Đường nối với bước trước */}
              {idx > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2',
                    reached ? 'bg-emerald-500' : 'bg-border'
                  )}
                />
              )}
              <span
                className={cn(
                  'relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 text-xs font-bold transition-colors',
                  reached
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-card border-border text-muted-foreground',
                  isCurrent && 'ring-4 ring-emerald-500/20'
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {reached && !isCurrent ? <Check className="w-4 h-4" aria-hidden="true" /> : idx + 1}
              </span>
              <span
                className={cn(
                  'mt-2 text-[11px] sm:text-xs leading-tight',
                  reached ? 'font-semibold text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
              {idx === 0 && (
                <span className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">{formatDate(createdAt)}</span>
              )}
              {idx === currentIndex && idx > 0 && updatedAt && (
                <span className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">{formatDate(updatedAt)}</span>
              )}
            </li>
          );
        })}
      </ol>

      {meta.description && (
        <p className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2">
          {meta.description}
        </p>
      )}
    </div>
  );
};

export default OrderTimeline;
