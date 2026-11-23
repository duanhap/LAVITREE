import React, { useState, useMemo } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import type { PublicKnowledgeSource } from '../types';
import { splitTextIntoDisplayLines } from './FormattedEvidence';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  sourceTitle?: string;
}

interface FaqSectionProps {
  plantName: string;
  diseaseName: string;
  pathogenType: string;
  sources?: PublicKnowledgeSource[];
  isHealthy?: boolean;
}

export const FaqSection: React.FC<FaqSectionProps> = ({
  sources = [],
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('faq-0');

  // CHỈ trích xuất đúng các câu hỏi FAQ thực tế từ các đoạn tri thức đã được Admin phê duyệt
  const faqs = useMemo<FaqItem[]>(() => {
    const list: FaqItem[] = [];
    let count = 0;

    for (const src of sources) {
      const text = src.evidenceText || '';
      // Chỉ nhận diện FAQ nếu đoạn văn có đề mục câu hỏi hoặc chứa dấu hỏi chấm thực sự
      if (!text.includes('?') && !/câu hỏi/i.test(text)) continue;

      const lines = splitTextIntoDisplayLines(text);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const plain = line.replace(/[*_#]/g, '').trim();

        // Nhận diện câu hỏi: kết thúc bằng '?' hoặc có tiền tố Câu hỏi/Hỏi
        const isQ =
          (plain.endsWith('?') || /^(?:câu\s*\d+|hỏi|faq)\b/i.test(plain)) &&
          plain.length >= 8 &&
          plain.length <= 160 &&
          /^[A-ZÀ-Ỹ0-9]/.test(plain.replace(/^[•\-*+–—\s\d.)/]+/g, ''));

        if (isQ) {
          const qText = line
            .replace(/^\*{1,2}\s*/, '')
            .replace(/\s*\*{1,2}$/, '')
            .replace(/^(?:(?:\d+(?:\.\d+)*|[a-zđ])[.)/]\s*|(?:câu|hỏi)\s*\d+[:.]\s*)/i, '')
            .replace(/^(?:[-•*+–—]\s*)+/, '')
            .trim();

          // Thu thập các dòng câu trả lời ngay sau câu hỏi cho đến khi gặp câu hỏi kế tiếp hoặc heading mới
          const aLines: string[] = [];
          for (let j = i + 1; j < lines.length; j++) {
            const nextL = lines[j].trim();
            const nextPlain = nextL.replace(/[*_#]/g, '').trim();
            const nextIsQ =
              (nextPlain.endsWith('?') || /^(?:câu\s*\d+|hỏi|faq)\b/i.test(nextPlain)) &&
              nextPlain.length >= 8 &&
              nextPlain.length <= 160;
            if (nextIsQ || nextL.startsWith('#')) break;
            aLines.push(nextL);
          }

          if (aLines.length > 0 && qText.length > 5) {
            list.push({
              id: `faq-${count++}`,
              question: qText,
              answer: aLines.join('\n\n'),
              sourceTitle: src.sourceTitle,
            });
            i += aLines.length;
          }
        }
      }
    }

    return list;
  }, [sources]);

  // Nếu bài báo/nguồn tài liệu không có đoạn trích FAQ nào thì không hiển thị mục này
  if (faqs.length === 0) return null;

  return (
    <section id="faq" className="space-y-3.5 scroll-mt-24">
      {/* Tiêu đề mục h2 - Bấm để thu gọn/mở rộng */}
      <div
        className="flex items-center justify-between pb-2 border-b border-border/60 cursor-pointer select-none group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            <HelpCircle className="h-4 w-4" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors">
            Câu hỏi thường gặp & Giải đáp (FAQ)
          </h2>
          <span className="text-xs text-muted-foreground font-normal">
            ({faqs.length} câu hỏi trích từ tài liệu)
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
        <div className="space-y-2.5">
          {faqs.map((faq, idx) => {
            const isExpanded = expandedFaqId === faq.id;
            return (
              <div
                key={faq.id}
                className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-2xs transition-all hover:border-emerald-500/40"
              >
                {/* Hàng câu hỏi */}
                <button
                  type="button"
                  onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                  className="w-full text-left p-3.5 sm:p-4 flex items-start justify-between gap-3 bg-muted/15 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-2.5 flex-1">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 text-[11px] bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300/60 dark:border-emerald-800 px-2 py-0.5 rounded-md shrink-0 mt-0.5">
                      Hỏi #{idx + 1}
                    </span>
                    <h3 className="font-semibold text-xs sm:text-sm text-foreground leading-snug">
                      {faq.question}
                    </h3>
                  </div>
                  <div className="text-muted-foreground shrink-0 mt-0.5">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </button>

                {/* Khung câu trả lời */}
                {isExpanded && (
                  <div className="p-3.5 sm:p-4 pt-2.5 border-t border-border/40 bg-card space-y-2">
                    <div className="flex items-start gap-2.5">
                      <span className="font-bold text-primary text-[11px] bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md shrink-0 mt-0.5">
                        Đáp
                      </span>
                      <div className="text-xs sm:text-[13px] text-foreground/90 leading-relaxed whitespace-pre-line pl-1">
                        {faq.answer}
                      </div>
                    </div>
                    {faq.sourceTitle && (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1.5 border-t border-border/30 justify-end">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        <span>Trích từ tài liệu: <strong>{faq.sourceTitle}</strong></span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
