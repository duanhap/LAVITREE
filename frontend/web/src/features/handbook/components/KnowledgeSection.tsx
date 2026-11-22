import React, { useState } from 'react';
import {
  BookOpen,
  Activity,
  Microscope,
  ShieldCheck,
  Stethoscope,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { HandbookSection, HandbookParagraph } from '../types';

interface KnowledgeSectionProps {
  section: HandbookSection;
  onRefClick: (refIndex: number) => void;
}

const ICON_MAP = {
  BookOpen,
  Activity,
  Microscope,
  ShieldCheck,
  Stethoscope,
};

export const KnowledgeSection: React.FC<KnowledgeSectionProps> = ({
  section,
  onRefClick,
}) => {
  const Icon = ICON_MAP[section.iconName] || BookOpen;

  return (
    <section id={section.id} className="space-y-4 scroll-mt-24">
      {/* Tiêu đề mục h2 */}
      <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-foreground">
          {section.title}
        </h2>
      </div>

      {/* Danh sách các đoạn trích dẫn */}
      <div className="space-y-4">
        {section.paragraphs.map((p) => (
          <ParagraphCard key={p.id} paragraph={p} onRefClick={onRefClick} />
        ))}
      </div>
    </section>
  );
};

interface ParagraphCardProps {
  paragraph: HandbookParagraph;
  onRefClick: (refIndex: number) => void;
}

const ParagraphCard: React.FC<ParagraphCardProps> = ({ paragraph, onRefClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = paragraph.evidenceText.length > 600;

  const handleRefClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onRefClick(paragraph.refIndex);
  };

  return (
    <div
      className={`relative rounded-xl border border-border/70 bg-card p-4 transition-all hover:border-primary/40 shadow-2xs ${
        paragraph.isVerbatim ? 'border-l-4 border-l-primary/60 pl-5' : ''
      }`}
    >
      <div className="space-y-2">
        {/* Nội dung đoạn văn */}
        <p
          className={`text-sm text-foreground leading-relaxed whitespace-pre-line ${
            isLong && !isExpanded ? 'line-clamp-6' : ''
          }`}
        >
          {paragraph.evidenceText}
          {/* Nút nguồn [n] */}
          <button
            type="button"
            onClick={handleRefClick}
            aria-label={`Nguồn số ${paragraph.refIndex}`}
            className="inline-flex items-center align-super ml-1.5 px-1 py-0.2 rounded text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary hover:text-white transition-colors cursor-pointer"
          >
            [{paragraph.refIndex}]
          </button>
        </p>

        {/* Nút Xem thêm / Thu gọn nếu đoạn quá dài */}
        {isLong && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline pt-1"
          >
            {isExpanded ? (
              <>
                <span>Thu gọn</span>
                <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                <span>Xem thêm</span>
                <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        )}

        {/* Nhãn tính xác thực của đoạn trích */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
          <span className="font-medium">
            {paragraph.isVerbatim ? (
              <span className="inline-flex items-center gap-1 text-primary font-semibold">
                ✓ Trích nguyên văn tài liệu
              </span>
            ) : (
              <span>Tóm tắt từ nguồn kiểm duyệt</span>
            )}
          </span>
          <span className="text-muted-foreground/70">
            Nguồn tham khảo <strong>[{paragraph.refIndex}]</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
