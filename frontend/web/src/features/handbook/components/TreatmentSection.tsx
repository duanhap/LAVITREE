import React from 'react';
import { AlertTriangle, Stethoscope, Clock, ShieldCheck } from 'lucide-react';
import type { HandbookSection } from '../types';

interface TreatmentPlanItem {
  stepOrder: number;
  actionTitle: string;
  instructions: string;
  isolationDays?: string;
}

interface TreatmentSectionProps {
  section?: HandbookSection;
  treatmentPlans?: TreatmentPlanItem[];
  onRefClick: (refIndex: number) => void;
  isHealthy?: boolean;
}

export const TreatmentSection: React.FC<TreatmentSectionProps> = ({
  section,
  treatmentPlans = [],
  onRefClick,
  isHealthy,
}) => {
  const hasParagraphs = section && section.paragraphs.length > 0;
  const hasPlans = treatmentPlans.length > 0;

  if (!hasParagraphs && !hasPlans) return null;

  return (
    <section id="xu-ly" className="space-y-4 scroll-mt-24">
      {/* Tiêu đề mục h2 */}
      <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
          <Stethoscope className="h-4 w-4" />
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-foreground">
          {isHealthy ? 'Quy trình chăm sóc & Duy trì sinh trưởng' : 'Biện pháp xử lý & Phác đồ điều trị'}
        </h2>
      </div>

      {/* Hộp cảnh báo an toàn thuốc BVTV */}
      {!isHealthy && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5 shadow-2xs">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <p className="leading-relaxed">
            <strong>Lưu ý an toàn:</strong> Tuân thủ nghiêm ngặt liều lượng, nồng độ và thời gian cách ly (PHI) ghi trên nhãn thuốc. Tham vấn ý kiến của cán bộ khuyến nông / bảo vệ thực vật địa phương trước khi sử dụng thuốc hóa học.
          </p>
        </div>
      )}

      {/* Đoạn tri thức TREATMENT đã kiểm duyệt */}
      {hasParagraphs && (
        <div className="space-y-3">
          {section.paragraphs.map((p) => (
            <div
              key={p.id}
              className={`rounded-xl border border-border/70 bg-card p-4 transition-all hover:border-primary/40 shadow-2xs ${
                p.isVerbatim ? 'border-l-4 border-l-primary/60 pl-5' : ''
              }`}
            >
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                {p.evidenceText}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onRefClick(p.refIndex);
                  }}
                  className="inline-flex items-center align-super ml-1.5 px-1 py-0.2 rounded text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary hover:text-white transition-colors cursor-pointer"
                >
                  [{p.refIndex}]
                </button>
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Phác đồ IPM từng bước (TreatmentPlans) */}
      {hasPlans && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Quy trình điều trị theo phác đồ quản lý dịch hại tổng hợp ({treatmentPlans.length} bước)
          </h3>

          <div className="space-y-2.5">
            {treatmentPlans.map((plan) => (
              <div
                key={plan.stepOrder}
                className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-2xs hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">
                      {plan.stepOrder}
                    </span>
                    <h4 className="text-sm font-bold text-foreground">
                      {plan.actionTitle}
                    </h4>
                  </div>
                  {plan.isolationDays && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-secondary text-primary border border-border/60">
                      <Clock className="h-3 w-3" />
                      Cách ly: {plan.isolationDays}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pl-8">
                  {plan.instructions}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
