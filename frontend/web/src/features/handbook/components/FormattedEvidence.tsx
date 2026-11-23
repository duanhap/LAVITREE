import React from 'react';

// Nhận diện dòng chỉ chứa số thứ tự đơn lẻ, bullet đơn độc hoặc marker ('1.', '2.', '4.', '1.1', '• 4.', '**4.**', 'IV.')
const isPureNumberMarker = (text: string): boolean => {
  if (!text) return false;
  const stripped = text
    .trim()
    .replace(/^[•\-*+–—\s\u00A0\u200B]+/, '')
    .replace(/[\s\u00A0\u200B*_#]/g, '');
  return /^(?:\d+(?:\.\d+)*|[IVXLCDM]+|[a-zđ])[.)/:]?$/i.test(stripped);
};

// Render Markdown inline: **in đậm** và làm sạch ký tự #
const renderInlineMarkdown = (line: string): React.ReactNode => {
  const cleanedLine = line.replace(/(?:^|\s)#{1,6}\s+/g, ' ');
  const boldSegments = cleanedLine.split(/(\*\*[^*\n]+\*\*)/g);
  return (
    <>
      {boldSegments.map((seg, idx) => {
        if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
          return (
            <strong key={idx} className="font-semibold text-foreground not-italic">
              {seg.slice(2, -2)}
            </strong>
          );
        }
        const plainText = seg.replace(/\*\*/g, '');
        if (!plainText) return null;
        return <React.Fragment key={idx}>{plainText}</React.Fragment>;
      })}
    </>
  );
};

// Hàm tách đoạn văn thành các dòng hiển thị thông minh, tự động nhận diện gạch đầu dòng, câu hỏi FAQ và tiêu đề dính liền
export const splitTextIntoDisplayLines = (text: string): string[] => {
  if (!text) return [];
  let normalized = text;
  // 0. Tách khi gặp ký hiệu heading Markdown (###, ##, #) bị dính sau dấu câu hoặc khoảng trắng
  normalized = normalized.replace(/([.:?!;]|\s)\s*(#{1,6}\s+)/g, '$1\n$2');
  normalized = normalized.replace(/(#{1,6}\s+[^:\n]{3,80}:)\s*([A-ZÀ-Ỹ])/g, '$1\n$2');

  // 0a. Chuẩn hóa double bullets "- - ", "• - ", "- • " thành 1 bullet duy nhất "- "
  normalized = normalized.replace(/(^|[\n\r])\s*(?:[-•*+]\s+)+([-•*+]\s+)/g, '$1$2');

  // 0b. Tách tiêu đề mục kết thúc bằng dấu hai chấm khi dính liền với câu hỏi in đậm (**Câu hỏi?**)
  normalized = normalized.replace(/(^|[\n\r])([^:\n\-•*+]{5,90}:)\s*(\*{1,2}[A-ZÀ-Ỹ0-9])/g, '$1$2\n$3');

  // 1. Sau bất kỳ dấu hỏi chấm (?) nào kèm đóng ngoặc kép/sao (**, *, ") -> Ngắt dòng ngay
  normalized = normalized.replace(/\?(\*{1,2}|_{1,2}|["'”’])?\s*/g, '?$1\n');

  // 2. Trước bất kỳ câu hỏi nào kết thúc bằng (?) -> Tách dòng khỏi câu dẫn hoặc câu trả lời phía trước
  normalized = normalized.replace(/([.:!;])\s*(?=(?:\*{1,2}|_{1,2})?[^?\n]{3,150}\?)/g, '$1\n');

  // 3. Tách các gạch đầu dòng / bullet / số thứ tự bị dính liền vào cùng dòng
  normalized = normalized.replace(/([.:?!;])\s*([-•*+]\s+)/g, '$1\n$2');
  normalized = normalized.replace(/([.:?!;])\s*(\d+[.)/]\s+)/g, '$1\n$2');

  // 4. Tách mũi tên / gạch trả lời FAQ: "--> Thường phát triển..." hoặc "-> Chủ yếu..."
  normalized = normalized.replace(/([.:?!;?])\s*(-->|->|=>)\s*/g, '$1\n$2 ');

  // 5. Tách tiêu đề mục kết thúc bằng dấu hai chấm (chỉ khi không phải gạch đầu dòng)
  normalized = normalized.replace(/(^|[\n\r])([^:\n\-•*+]{5,90}:)\s*([A-ZÀ-Ỹ0-9])/g, '$1$2\n$3');

  // 6. Tách đoạn kết bài / chuyển ý / lời khuyên kết luận
  normalized = normalized.replace(/([.:?!])\s+(Qua bài viết|Tổng kết|Tóm lại|Lời kết|Như vậy|Để lựa chọn|Bệnh [^.:\n]{3,50} là một trong những|Nơi cung cấp)\b/gi, '$1\n$2');

  // Kiểm tra xem đoạn văn có dãy số thứ tự nối tiếp nhau hay không
  const findNumbers = (str: string): number[] => {
    const matches = str.match(/(?:^|[\n\r]|\s)(\d+)[.)/]\s+[A-ZÀ-Ỹ]/g) || [];
    return matches.map((m) => parseInt(m.replace(/\D/g, ''), 10)).filter((n) => !isNaN(n));
  };
  const seqNums = findNumbers(normalized);
  const hasSequentialNumbers = seqNums.some((num, i) => i > 0 && num === seqNums[i - 1] + 1);

  return normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => {
      if (!l || /^(\*{1,3}|_{1,3})$/.test(l)) return false;
      if (isPureNumberMarker(l)) return false;
      return true;
    })
    .map((l) => {
      let cleaned = l;
      cleaned = cleaned.replace(/^(?:[-•*+–—]\s+)+([-•*+–—]\s+)/, '$1');
      cleaned = cleaned.replace(/^[-•*+–—]\s+[-•*+–—]\s+/, '- ');

      if (cleaned.endsWith('?') || /\?\s*$/.test(cleaned)) {
        cleaned = cleaned.replace(/^(?:\*{1,2})?(?:(?:\d+(?:\.\d+)*|[a-zđ])[.)/]\s*|(?:câu|hỏi)\s*\d+[:.]\s*)(?:\*{1,2})?/i, '');
      } else if (!hasSequentialNumbers) {
        cleaned = cleaned.replace(/^((?:[-•*+–—]\s+)?)(?:\*{1,2})?(?:\d+(?:\.\d+)*|[a-zđ])[.)/]\s+(?:\*{1,2})?([A-ZÀ-Ỹ])/i, '$1$2');
      }
      return cleaned.trim();
    })
    .filter((l) => Boolean(l) && !isPureNumberMarker(l));
};

interface FormattedEvidenceProps {
  text: string;
  className?: string;
}

export const FormattedEvidence: React.FC<FormattedEvidenceProps> = ({ text, className = '' }) => {
  const lines = splitTextIntoDisplayLines(text);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {lines.map((rawLine, idx) => {
        const trimmed = rawLine.trim();
        if (!trimmed || /^(\*{1,3}|_{1,3})$/.test(trimmed)) return null;
        if (isPureNumberMarker(trimmed)) return null;

        // 1. Heading cấp 1 (# Tiêu đề chính)
        const h1Match = trimmed.match(/^#\s+(.+)$/);
        if (h1Match) {
          const h1Text = h1Match[1].replace(/^(?:(?:\d+|[IVX]+|[a-zđ])[.)/]\s*)+/i, '').trim();
          return (
            <h4 key={idx} className="font-bold text-foreground text-sm sm:text-base mb-1.5 pb-1 border-b border-border/50 flex items-center gap-2">
              <span className="w-1 h-3.5 bg-emerald-600 rounded-full shrink-0" />
              <span>{renderInlineMarkdown(h1Text)}</span>
            </h4>
          );
        }

        // 2. Heading cấp 2-6 (## Tiêu đề con)
        const headingMatch = trimmed.match(/^#{2,6}\s+(.+)$/);
        if (headingMatch) {
          const hText = headingMatch[1].replace(/^(?:(?:\d+|[IVX]+|[a-zđ])[.)/]\s*)+/i, '').trim();
          return (
            <h5 key={idx} className="font-bold text-foreground text-xs sm:text-[13px] mt-2 mb-1 flex items-center gap-2">
              <span className="w-1 h-3 bg-emerald-600/80 rounded-full shrink-0" />
              <span>{renderInlineMarkdown(hText)}</span>
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
              <span>{renderInlineMarkdown(tagMatch[2])}</span>
            </div>
          );
        }

        // 4. Tiêu đề mục / phân nhóm kết thúc bằng dấu hai chấm
        // e.g. "Biện pháp phòng trừ bệnh mốc đen:", "Biện pháp canh tác:", "Biện pháp sinh học:", "Trên thân cành:", "Trên quả:", "Trên lá:"
        const cleanHeadingText = trimmed
          .replace(/^[-•*+–—]\s+/, '')
          .replace(/^(?:(?:\d+|[IVX]+|[a-zđ])[.)/]\s*)+/i, '')
          .trim();
        const isSectionHeader =
          /^[A-ZÀ-Ỹ][^.!?\n]{2,90}:$/.test(cleanHeadingText) ||
          /^(?:Biện pháp|Phòng trừ|Phòng ngừa|Điều trị|Cách trị|Triệu chứng|Dấu hiệu|Nguyên nhân|Đặc điểm|Tác hại|Điều kiện|Quy trình|Kỹ thuật|Lưu ý|Câu hỏi|Hướng dẫn|Trên lá|Trên thân|Trên cành|Trên quả|Trên hoa|Giai đoạn|Biểu hiện|Bộ phận)\b.*:$/i.test(cleanHeadingText);

        if (isSectionHeader) {
          // A. Nếu là tiêu đề lớn/dài hoặc câu dẫn mở đầu (ví dụ: "Biện pháp phòng trừ bệnh mốc đen trên cà chua:")
          // -> Render dạng thanh đề mục với vạch đứng sắc nét, không dùng chấm tròn
          const isMajorHeader =
            cleanHeadingText.length > 32 ||
            /^(?:Biện pháp phòng trừ|Triệu chứng bệnh|Nguyên nhân gây bệnh|Quy trình quản lý|Đặc điểm hình thái)\b/i.test(cleanHeadingText);

          if (isMajorHeader) {
            return (
              <div key={idx} className="font-bold text-foreground text-xs sm:text-[13px] mt-2 mb-1.5 flex items-center gap-2">
                <span className="w-1 h-3.5 bg-emerald-600 rounded-full shrink-0" />
                <span className="flex-1 text-emerald-950 dark:text-emerald-200">{renderInlineMarkdown(cleanHeadingText)}</span>
              </div>
            );
          }

          // B. Nếu là phân nhóm cụ thể (ví dụ: "Biện pháp canh tác:", "Biện pháp sinh học:", "Biện pháp hóa học:", "Trên thân cành:", "Trên quả:", "Trên lá:")
          // -> Dùng huy hiệu Tag nổi bật với mũi tên ▸ thay vì chấm tròn xanh trùng lặp
          return (
            <div key={idx} className="font-semibold text-xs sm:text-[13px] mt-2.5 mb-1 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100/90 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800 text-[11px] font-bold tracking-wide">
                <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">▸</span>
                <span>{renderInlineMarkdown(cleanHeadingText.replace(/:$/, ''))}</span>
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
            <div key={idx} className="font-semibold text-emerald-950 dark:text-emerald-200 text-xs sm:text-[13px] mt-2 mb-1 flex items-start gap-1.5 bg-emerald-50/80 dark:bg-emerald-950/20 px-2.5 py-1.5 rounded-md border border-emerald-200/80 dark:border-emerald-800 shadow-2xs">
              <span className="font-bold text-emerald-800 dark:text-emerald-300 text-[10px] bg-emerald-200/70 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded shrink-0 mt-0.5">Hỏi</span>
              <span className="flex-1 text-emerald-900 dark:text-emerald-200 font-medium">{renderInlineMarkdown(displayQuestionText)}</span>
            </div>
          );
        }

        // 5. Gạch đầu dòng / bullet / số thứ tự:
        // Thay vì dùng dấu chấm xanh • giống các tiêu đề, dùng dấu gạch ngang en-dash "–" thanh lịch, thụt lề rõ ràng
        const bulletMatch = trimmed.match(/^(?:[-•*+–—]|\d+[.)]|-->|->)\s+(.+)$/);
        if (bulletMatch) {
          let content = bulletMatch[1].trim();
          content = content.replace(/^(?:[-•*+–—]\s*)+/, '').trim();
          if (!content || isPureNumberMarker(content)) return null;

          // Tách nhãn in đậm ở đầu gạch đầu dòng (ví dụ: "Một số hoạt chất hiệu quả: Mancozeb...")
          const subLabelMatch = content.match(/^([A-ZÀ-Ỹa-zà-ỹ0-9\s/&,–-]+?:\s*)(.*)$/);
          if (subLabelMatch && !content.startsWith('**')) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-3 my-1 text-xs sm:text-[13px] text-foreground/90 leading-relaxed">
                <span className="text-muted-foreground/70 font-semibold shrink-0 select-none">–</span>
                <span className="flex-1">
                  <strong className="font-semibold text-foreground">{subLabelMatch[1]}</strong>
                  <span>{renderInlineMarkdown(subLabelMatch[2])}</span>
                </span>
              </div>
            );
          }
          return (
            <div key={idx} className="flex items-start gap-2 pl-3 my-1 text-xs sm:text-[13px] text-foreground/90 leading-relaxed">
              <span className="text-muted-foreground/70 font-semibold shrink-0 select-none">–</span>
              <span className="flex-1">
                {renderInlineMarkdown(content)}
              </span>
            </div>
          );
        }

        // 6. Đoạn văn thông thường
        return (
          <p key={idx} className="my-1 text-xs sm:text-[13px] text-foreground/90 leading-relaxed pl-2 sm:pl-3">
            {renderInlineMarkdown(trimmed)}
          </p>
        );
      })}
    </div>
  );
};
