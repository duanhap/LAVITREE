import React, { useState } from 'react';
import { AlertTriangle, Stethoscope, ChevronUp, ChevronDown } from 'lucide-react';
import type { HandbookSection } from '../types';
import { FormattedEvidence } from './FormattedEvidence';

interface TreatmentSectionProps {
  section?: HandbookSection;
  onRefClick: (refIndex: number) => void;
  isHealthy?: boolean;
}

export const TreatmentSection: React.FC<TreatmentSectionProps> = ({
  section,
  onRefClick,
  isHealthy,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const hasParagraphs = Boolean(section && section.paragraphs.length > 0);

  if (!hasParagraphs) return null;

  return (
    <section id="xu-ly" className="space-y-3.5 scroll-mt-24">
      {/* Tiêu đề mục h2 - Bấm để thu gọn/mở rộng */}
      <div
        className="flex items-center justify-between pb-2 border-b border-border/60 cursor-pointer select-none group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Stethoscope className="h-4 w-4" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors">
            {isHealthy ? 'Quy trình chăm sóc & Duy trì sinh trưởng' : 'Biện pháp xử lý & Can thiệp'}
          </h2>
          <span className="text-xs text-muted-foreground font-normal">
            ({section?.paragraphs.length || 0} đoạn)
          </span>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground font-medium py-1 px-2 rounded-md hover:bg-secondary transition-colors"
        >
          <span>{isOpen ? 'Thu gọn' : 'Xem chi tiết'}</span>
          {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {isOpen && (
        <div className="space-y-3.5">
          {/* Hộp cảnh báo an toàn thuốc BVTV */}
          {!isHealthy && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 sm:p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5 shadow-2xs">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <p className="leading-relaxed">
                <strong>Lưu ý an toàn:</strong> Tuân thủ nghiêm ngặt nguyên tắc 4 đúng (Đúng thuốc, Đúng lúc, Đúng liều lượng, Đúng cách) và thời gian cách ly (PHI) ghi trên nhãn thuốc. Luôn ưu tiên biện pháp canh tác và chế phẩm sinh học trước khi can thiệp hóa học.
              </p>
            </div>
          )}

          {/* Các đoạn tri thức xử lý đã kiểm duyệt - Định dạng chuẩn Admin */}
          {section?.paragraphs.map((p) => (
            <div
              key={p.id}
              className="relative rounded-xl border border-border/60 bg-muted/20 dark:bg-muted/10 p-3.5 pl-4 sm:p-4 sm:pl-4.5 border-l-4 border-l-emerald-600 transition-all hover:border-primary/40 shadow-2xs space-y-2"
            >
              <FormattedEvidence text={p.evidenceText} />

              {p.refIndex > 0 && (
                <div className="flex items-center justify-end pt-1.5 border-t border-border/30">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onRefClick(p.refIndex);
                    }}
                    aria-label={`Nguồn số ${p.refIndex}`}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-600 hover:text-white transition-colors cursor-pointer"
                  >
                    <span>Nguồn trích dẫn [{p.refIndex}]</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
