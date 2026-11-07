import React from 'react';
import type { TreatmentStep } from '../types';
import { ShieldCheck, Clock, CheckCircle } from 'lucide-react';

interface TreatmentStepsProps {
  steps: TreatmentStep[];
}

export const TreatmentSteps: React.FC<TreatmentStepsProps> = ({ steps }) => {
  if (!steps || steps.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">
          Phác đồ Xử lý Dịch hại Tổng hợp (IPM)
        </h3>
        <span className="ml-auto text-xs text-muted-foreground font-medium">
          {steps.length} bước tiêu chuẩn
        </span>
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => {
          const hasIsolation = !!step.isolation_days && step.isolation_days.trim() !== '' && !step.isolation_days.toLowerCase().includes('không');
          return (
            <div
              key={index}
              className="relative rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 shadow-xs"
            >
              <div className="flex items-start gap-3">
                {/* Số thứ tự bước */}
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white text-xs font-bold shadow-xs">
                  {step.step_order || index + 1}
                </div>

                <div className="flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold text-sm text-foreground">
                      {step.action_title}
                    </h4>

                    {/* Nhãn Cách ly nếu có */}
                    {hasIsolation && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-status-confusion-bg px-2.5 py-0.5 text-xs font-medium text-status-confusion border border-status-confusion/30">
                        <Clock className="h-3 w-3" />
                        Cách ly: {step.isolation_days}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {step.instructions}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TreatmentSteps;
