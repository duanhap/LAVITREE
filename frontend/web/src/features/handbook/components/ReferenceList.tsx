import React from 'react';
import { BookOpen, ExternalLink, ShieldCheck } from 'lucide-react';
import { safeHref } from '@/lib/utils';
import type { HandbookReference } from '../types';

interface ReferenceListProps {
  references: HandbookReference[];
  activeRefIndex?: number | null;
}

export const ReferenceList: React.FC<ReferenceListProps> = ({
  references,
  activeRefIndex,
}) => {
  if (references.length === 0) return null;

  return (
    <section id="nguon-tham-khao" className="space-y-4 pt-6 border-t border-border scroll-mt-24">
      <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
          <BookOpen className="h-4 w-4" />
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-foreground">
          Nguồn tài liệu tham khảo ({references.length})
        </h2>
      </div>

      <ol className="space-y-3">
        {references.map((ref) => {
          const validUrl = safeHref(ref.sourceUrl);
          const isActive = activeRefIndex === ref.index;

          return (
            <li
              key={ref.key}
              id={`nguon-${ref.index}`}
              className={`rounded-xl border p-3.5 text-xs transition-all duration-500 ${
                isActive
                  ? 'bg-primary/10 border-primary ring-2 ring-primary/30 shadow-xs'
                  : 'bg-card border-border/70 hover:border-border'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-secondary text-primary font-bold text-[11px]">
                  {ref.index}
                </span>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-foreground leading-relaxed">
                    <strong className="font-semibold text-primary">{ref.organization}</strong>
                    <span>—</span>
                    <span className="italic">"{ref.sourceTitle}"</span>
                    {ref.year && (
                      <span className="text-muted-foreground font-normal">({ref.year})</span>
                    )}
                    {ref.sourceScope && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground border border-border/50">
                        {ref.sourceScope}
                      </span>
                    )}
                  </div>

                  {validUrl && (
                    <div className="pt-0.5">
                      <a
                        href={validUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline hover:text-primary-hover"
                      >
                        <span>Mở bài viết gốc</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Tuyên bố miễn trừ trách nhiệm */}
      <div className="rounded-xl border border-border bg-secondary/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
        <p>
          Thông tin tham khảo khoa học, không thay thế cho các chỉ dẫn trực tiếp của cán bộ khuyến nông và cơ quan bảo vệ thực vật địa phương.
        </p>
      </div>
    </section>
  );
};
