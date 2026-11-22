import React from 'react';
import { CalendarClock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UsageProfile } from '@/features/admin/lib/usage-profile';
import { formatUsageProfileSummary } from '@/features/admin/lib/usage-profile';

interface Props {
  rule?: any | null; // TASK-22 sẽ đưa ProductUsageRules vào đây
  defaultProfile?: UsageProfile | null;
  onSwitchToGeneralTab?: () => void;
}

/**
 * Khối "Cách dùng cho bệnh này" (TASK-21: Chừa sẵn chỗ, hiển thị chỉ đọc cách dùng chung; TASK-22 sẽ thêm sửa)
 */
export const DiseaseUsageRule: React.FC<Props> = ({
  rule,
  defaultProfile,
  onSwitchToGeneralTab,
}) => {
  const summary = formatUsageProfileSummary(defaultProfile);

  return (
    <div className="rounded-xl border border-border bg-secondary/15 p-3.5 space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <CalendarClock className="w-3.5 h-3.5 text-primary" />
          <span>Cách dùng cho bệnh này</span>
        </div>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold bg-muted px-1.5 py-0.5 rounded">
          Chỉ đọc
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] text-muted-foreground">
          {rule ? (
            <span className="font-semibold text-foreground">Quy tắc riêng cho bệnh này:</span>
          ) : (
            <span>Đang dùng cách dùng chung của sản phẩm:</span>
          )}
        </div>

        <p className="font-medium text-foreground bg-card/80 p-2.5 rounded-lg border border-border/60 leading-relaxed">
          {summary}
        </p>

        {onSwitchToGeneralTab && (
          <div className="pt-1 flex items-center justify-end">
            <button
              type="button"
              onClick={onSwitchToGeneralTab}
              className="text-[11px] text-primary hover:text-primary-hover font-semibold inline-flex items-center gap-1 hover:underline"
            >
              <span>Sửa ở tab Thông tin sản phẩm</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
