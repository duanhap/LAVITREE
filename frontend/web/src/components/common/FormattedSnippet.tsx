import React, { useState } from 'react';
import { BookOpen, FileText, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  splitByMention,
  isPureNumberMarker,
  splitTextIntoDisplayLines,
  extractHeadingAndBody,
} from '@/lib/snippet-format';

export {
  foldVi,
  splitByMention,
  isPureNumberMarker,
  splitTextIntoDisplayLines,
  cleanRawMarkdown,
  extractHeadingAndBody,
  type TextSegment,
} from '@/lib/snippet-format';

// ============================================================================
// 1. RENDER INLINE MARKDOWN & HIGHLIGHT TỪ KHÓA
// ============================================================================

const renderInlineSegments = (text: string, mention?: string): React.ReactNode => {
  if (!mention) return text;
  const segments = splitByMention(text, mention);
  return (
    <>
      {segments.map((seg, i) =>
        seg.match ? (
          <mark
            key={i}
            className="bg-amber-100 dark:bg-amber-900/60 text-amber-950 dark:text-amber-100 font-bold px-1 py-0.5 rounded not-italic border border-amber-300/60 dark:border-amber-700/60"
          >
            {seg.text}
          </mark>
        ) : (
          <React.Fragment key={i}>{seg.text}</React.Fragment>
        )
      )}
    </>
  );
};

const renderInlineMarkdown = (line: string, mention?: string): React.ReactNode => {
  const cleanedLine = line.replace(/(?:^|\s)#{1,6}\s+/g, ' ');
  const boldSegments = cleanedLine.split(/(\*\*[^*\n]+\*\*)/g);
  return (
    <>
      {boldSegments.map((seg, idx) => {
        if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
          return (
            <strong key={idx} className="font-semibold text-foreground not-italic">
              {renderInlineSegments(seg.slice(2, -2), mention)}
            </strong>
          );
        }
        const plainText = seg.replace(/\*\*/g, '');
        if (!plainText) return null;
        return <React.Fragment key={idx}>{renderInlineSegments(plainText, mention)}</React.Fragment>;
      })}
    </>
  );
};

// ============================================================================
// 2. COMPONENT CHÍNH: FormattedSnippet
// ============================================================================

export interface FormattedSnippetProps {
  /** Nội dung đoạn trích hoặc văn bản bằng chứng */
  text: string;
  /** Từ khóa cần highlight nổi bật (ví dụ: tên hoạt chất, tên nấm "Trichoderma") */
  mention?: string;
  /**
   * Chế độ hiển thị:
   * - 'full': Đầy đủ phân cấp thẻ tiêu đề, vạch màu, thẻ FAQ, gạch đầu dòng en-dash thụt lề
   * - 'compact': Dòng tóm tắt gọn gàng, tự động bóc tách heading thành badge, loại bỏ ### thô
   * - 'preview': Hiển thị 2-3 dòng có nút Thu gọn / Xem thêm
   */
  variant?: 'full' | 'compact' | 'preview';
  /** Giới hạn ký tự khi hiển thị ở chế độ compact / preview */
  maxChars?: number;
  /** Thêm nút mở Dialog xem toàn văn khi ở chế độ compact (mặc định: true) */
  showFullOnDialog?: boolean;
  /** Tiêu đề nguồn bài viết bổ sung (tùy chọn) */
  sourceTitle?: string;
  /** URL bài viết gốc để mở liên kết ngoài (tùy chọn) */
  sourceUrl?: string;
  /** CSS class tùy biến */
  className?: string;
}

export const FormattedSnippet: React.FC<FormattedSnippetProps> = ({
  text,
  mention,
  variant = 'full',
  maxChars,
  showFullOnDialog = true,
  sourceTitle,
  sourceUrl,
  className = '',
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  if (!text) return null;

  // --------------------------------------------------------------------------
  // A. CHẾ ĐỘ COMPACT: Cho thanh tóm tắt modal, bảng danh sách, thẻ inline
  // --------------------------------------------------------------------------
  if (variant === 'compact') {
    const { heading, body } = extractHeadingAndBody(text);
    const limit = maxChars || 150;
    const truncatedBody = body.length > limit ? body.slice(0, limit).trimEnd() + '…' : body;

    return (
      <div className={cn('inline-flex items-center gap-1.5 max-w-full text-xs text-muted-foreground', className)}>
        <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />

        {heading && (
          <Badge
            variant="outline"
            className="text-[10px] font-bold py-0 px-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300/70 dark:border-emerald-800 shrink-0 select-none"
          >
            {heading}
          </Badge>
        )}

        <span className="truncate italic text-foreground/80">
          “{renderInlineSegments(truncatedBody, mention)}”
        </span>

        {showFullOnDialog && body.length > 50 && (
          <>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-semibold underline underline-offset-2 shrink-0 ml-1 transition-colors cursor-pointer"
              title="Xem toàn văn đoạn trích có định dạng"
            >
              Xem đủ
            </button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-5 rounded-2xl">
                <DialogHeader className="border-b border-border/60 pb-3">
                  <DialogTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-foreground">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span>Chi tiết đoạn trích tài liệu</span>
                  </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-3 pr-1">
                  <div className="p-3.5 bg-muted/20 rounded-xl border border-border/60">
                    <FormattedSnippet text={text} mention={mention} variant="full" />
                  </div>

                  {sourceTitle && (
                    <div className="mt-3 p-2.5 bg-secondary/30 rounded-lg border border-border text-[11px] flex items-center justify-between">
                      <span className="text-muted-foreground truncate">
                        Nguồn: <strong>{sourceTitle}</strong>
                      </span>
                      {sourceUrl && (
                        <a
                          href={sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline font-medium shrink-0 ml-2"
                        >
                          <span>Mở bài viết</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <DialogFooter className="pt-2 border-t border-border/50">
                  <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} className="text-xs">
                    Đóng
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // B. CHẾ ĐỘ PREVIEW: Thẻ xem trước 2-3 dòng kèm nút Xem thêm / Thu gọn
  // --------------------------------------------------------------------------
  if (variant === 'preview') {
    return (
      <div className={cn('space-y-1.5', className)}>
        <div className={cn('transition-all', !previewExpanded && 'line-clamp-2')}>
          <FormattedSnippet text={text} mention={mention} variant="full" />
        </div>
        <button
          type="button"
          onClick={() => setPreviewExpanded(!previewExpanded)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline pt-0.5"
        >
          {previewExpanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              <span>Thu gọn</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              <span>Xem chi tiết đoạn trích</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // C. CHẾ ĐỘ FULL (MẶC ĐỊNH): Trình bày chuẩn typographic khoa học
  // --------------------------------------------------------------------------
  const lines = splitTextIntoDisplayLines(text);

  return (
    <div className={cn('space-y-1.5 text-xs sm:text-[13px]', className)}>
      {lines.map((rawLine, idx) => {
        const trimmed = rawLine.trim();
        if (!trimmed || /^(\*{1,3}|_{1,3})$/.test(trimmed)) return null;
        if (isPureNumberMarker(trimmed)) return null;

        // 1. Heading cấp 1 (# Tiêu đề chính)
        const h1Match = trimmed.match(/^#\s+(.+)$/);
        if (h1Match) {
          const h1Text = h1Match[1].replace(/^(?:(?:\d+|[IVX]+|[a-zđ])[.)/]\s*)+/i, '').trim();
          return (
            <h4
              key={idx}
              className="font-bold text-foreground text-sm sm:text-base mb-1.5 pb-1 border-b border-border/50 flex items-center gap-2"
            >
              <span className="w-1 h-3.5 bg-emerald-600 rounded-full shrink-0" />
              <span>{renderInlineMarkdown(h1Text, mention)}</span>
            </h4>
          );
        }

        // 2. Heading cấp 2-6 (## Tiêu đề con)
        const headingMatch = trimmed.match(/^#{2,6}\s+(.+)$/);
        if (headingMatch) {
          const hText = headingMatch[1].replace(/^(?:(?:\d+|[IVX]+|[a-zđ])[.)/]\s*)+/i, '').trim();
          return (
            <h5
              key={idx}
              className="font-bold text-foreground text-xs sm:text-[13px] mt-2 mb-1 flex items-center gap-2"
            >
              <span className="w-1 h-3 bg-emerald-600/80 rounded-full shrink-0" />
              <span>{renderInlineMarkdown(hText, mention)}</span>
            </h5>
          );
        }

        // 3. Thẻ danh mục trong ngoặc vuông: "[Kỹ thuật canh tác]: Hướng dẫn..."
        const tagMatch = trimmed.match(/^(\[[^\]\n]+\]:?)\s*(.*)$/);
        if (tagMatch) {
          return (
            <div key={idx} className="my-1.5 text-xs sm:text-[13px] text-foreground/90 leading-relaxed">
              <span className="inline-flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/50 border border-emerald-300/60 dark:border-emerald-800 rounded px-2 py-0.5 mr-1.5 text-[11px]">
                <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">▸</span>
                <span>{tagMatch[1].replace(/[\[\]:]/g, '')}</span>
              </span>
              <span>{renderInlineMarkdown(tagMatch[2], mention)}</span>
            </div>
          );
        }

        // 4. Tiêu đề mục / phân nhóm kết thúc bằng dấu hai chấm
        const cleanHeadingText = trimmed
          .replace(/^[-•*+–—]\s+/, '')
          .replace(/^(?:(?:\d+|[IVX]+|[a-zđ])[.)/]\s*)+/i, '')
          .trim();
        const isSectionHeader =
          /^[A-ZÀ-Ỹ][^.!?\n]{2,90}:$/.test(cleanHeadingText) ||
          /^(?:Biện pháp|Phòng trừ|Phòng ngừa|Điều trị|Cách trị|Triệu chứng|Dấu hiệu|Nguyên nhân|Đặc điểm|Tác hại|Điều kiện|Quy trình|Kỹ thuật|Lưu ý|Câu hỏi|Hướng dẫn|Trên lá|Trên thân|Trên cành|Trên quả|Trên hoa|Giai đoạn|Biểu hiện|Bộ phận)\b.*:$/i.test(cleanHeadingText);

        if (isSectionHeader) {
          const isMajorHeader =
            cleanHeadingText.length > 32 ||
            /^(?:Biện pháp phòng trừ|Triệu chứng bệnh|Nguyên nhân gây bệnh|Quy trình quản lý|Đặc điểm hình thái)\b/i.test(cleanHeadingText);

          if (isMajorHeader) {
            return (
              <div key={idx} className="font-bold text-foreground text-xs sm:text-[13px] mt-2 mb-1.5 flex items-center gap-2">
                <span className="w-1 h-3.5 bg-emerald-600 rounded-full shrink-0" />
                <span className="flex-1 text-emerald-950 dark:text-emerald-200">
                  {renderInlineMarkdown(cleanHeadingText, mention)}
                </span>
              </div>
            );
          }

          return (
            <div key={idx} className="font-semibold text-xs sm:text-[13px] mt-2.5 mb-1 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100/90 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800 text-[11px] font-bold tracking-wide">
                <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">▸</span>
                <span>{renderInlineMarkdown(cleanHeadingText.replace(/:$/, ''), mention)}</span>
              </span>
            </div>
          );
        }

        // 4b. Câu hỏi FAQ kết thúc bằng dấu hỏi (?): "Bệnh có gây chết cây không?"
        const plainForCheck = trimmed.replace(/[*_#]/g, '').trim();
        const isQuestion = plainForCheck.endsWith('?') || /^(?:(?:\d+|[IVX]+|[a-zđ])[.)/]\s*)?[A-ZÀ-Ỹ][^.:\n]{3,120}\?$/.test(plainForCheck);
        if (isQuestion) {
          const displayQuestionText = trimmed
            .replace(/^\*{1,2}\s*/, '')
            .replace(/\s*\*{1,2}$/, '')
            .replace(/^(?:(?:\d+(?:\.\d+)*|[a-zđ])[.)/]\s*|(?:câu|hỏi)\s*\d+[:.]\s*)/i, '')
            .trim();
          return (
            <div
              key={idx}
              className="font-semibold text-emerald-950 dark:text-emerald-200 text-xs sm:text-[13px] mt-2 mb-1 flex items-start gap-1.5 bg-emerald-50/80 dark:bg-emerald-950/20 px-2.5 py-1.5 rounded-md border border-emerald-200/80 dark:border-emerald-800 shadow-2xs"
            >
              <span className="font-bold text-emerald-800 dark:text-emerald-300 text-[10px] bg-emerald-200/70 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                Hỏi
              </span>
              <span className="flex-1 text-emerald-900 dark:text-emerald-200 font-medium">
                {renderInlineMarkdown(displayQuestionText, mention)}
              </span>
            </div>
          );
        }

        // 5. Gạch đầu dòng / bullet / số thứ tự / mũi tên
        const bulletMatch = trimmed.match(/^(?:[-•*+–—]|\d+[.)]|-->|->)\s+(.+)$/);
        if (bulletMatch) {
          let content = bulletMatch[1].trim();
          content = content.replace(/^(?:[-•*+–—]\s*)+/, '').trim();
          if (!content || isPureNumberMarker(content)) return null;

          const subLabelMatch = content.match(/^([A-ZÀ-Ỹa-zà-ỹ0-9\s/&,–-]+?:\s*)(.*)$/);
          if (subLabelMatch && !content.startsWith('**')) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-3 my-1 text-xs sm:text-[13px] text-foreground/90 leading-relaxed">
                <span className="text-muted-foreground/70 font-semibold shrink-0 select-none">–</span>
                <span className="flex-1">
                  <strong className="font-semibold text-foreground">{subLabelMatch[1]}</strong>
                  <span>{renderInlineMarkdown(subLabelMatch[2], mention)}</span>
                </span>
              </div>
            );
          }
          return (
            <div key={idx} className="flex items-start gap-2 pl-3 my-1 text-xs sm:text-[13px] text-foreground/90 leading-relaxed">
              <span className="text-muted-foreground/70 font-semibold shrink-0 select-none">–</span>
              <span className="flex-1">{renderInlineMarkdown(content, mention)}</span>
            </div>
          );
        }

        // 6. Đoạn văn thông thường
        return (
          <p key={idx} className="my-1 text-xs sm:text-[13px] text-foreground/90 leading-relaxed pl-2 sm:pl-3">
            {renderInlineMarkdown(trimmed, mention)}
          </p>
        );
      })}
    </div>
  );
};

export default FormattedSnippet;
