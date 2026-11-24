/**
 * snippet-format.ts
 * Các hàm thuần (Pure Functions) xử lý, chuẩn hóa, phân tách và bóc tách định dạng
 * cho các đoạn trích tri thức, bằng chứng nghiên cứu & Markdown.
 * SSOT dùng chung cho FormattedSnippet, FormattedEvidence và các trang Admin / Public.
 */

export interface TextSegment {
  text: string;
  match: boolean;
}

/** Bỏ dấu từng ký tự, giữ nguyên độ dài để vị trí khớp đúng ký tự tiếng Việt. */
export const foldVi = (text: string): string =>
  Array.from(text || '')
    .map((c) => {
      if (c === 'đ' || c === 'Đ') return 'd';
      const base = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return (base.length === 1 ? base : c).toLowerCase();
    })
    .join('');

/** Tách chuỗi thành các phân đoạn khớp / không khớp từ khóa mention (không phân biệt hoa thường / dấu). */
export const splitByMention = (text: string, mention?: string): TextSegment[] => {
  const src = text || '';
  const needle = foldVi((mention || '').trim());
  if (!src || needle.length < 2) return [{ text: src, match: false }];

  const chars = Array.from(src);
  const hayChars = Array.from(foldVi(src)).map((c) => (c.length === 1 ? c : '\u0000'));
  if (hayChars.length !== chars.length) return [{ text: src, match: false }];

  const segments: TextSegment[] = [];
  let pos = 0;
  let last = 0;
  const hayStr = hayChars.join('');

  while (pos <= hayStr.length - needle.length) {
    const idx = hayStr.indexOf(needle, pos);
    if (idx === -1) break;
    const before = idx === 0 ? ' ' : hayStr[idx - 1];
    const after = hayStr[idx + needle.length] ?? ' ';
    const isWord = (ch: string) => /[\p{L}\p{N}]/u.test(ch);
    if (!isWord(before) && !isWord(after)) {
      if (idx > last) segments.push({ text: chars.slice(last, idx).join(''), match: false });
      segments.push({ text: chars.slice(idx, idx + needle.length).join(''), match: true });
      last = idx + needle.length;
    }
    pos = idx + 1;
  }
  if (last < chars.length) segments.push({ text: chars.slice(last).join(''), match: false });
  return segments.length ? segments : [{ text: src, match: false }];
};

/** Nhận diện dòng chỉ chứa số thứ tự đơn lẻ hoặc marker ('1.', '2.', '4.', '1.1', '• 4.', '**4.**', 'IV.') */
export const isPureNumberMarker = (text: string): boolean => {
  if (!text) return false;
  const stripped = text
    .trim()
    .replace(/^[•\-*+–—\s\u00A0\u200B]+/, '')
    .replace(/[\s\u00A0\u200B*_#]/g, '');
  return /^(?:\d+(?:\.\d+)*|[IVXLCDM]+|[a-zđ])[.)/:]?$/i.test(stripped);
};

/**
 * Tách đoạn văn thành các dòng hiển thị thông minh, tự động nhận diện gạch đầu dòng,
 * câu hỏi FAQ và tiêu đề Markdown dính liền (Chuẩn hóa SSOT từ Admin Ingest & Sổ tay).
 */
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
  normalized = normalized.replace(
    /([.:?!])\s+(Qua bài viết|Tổng kết|Tóm lại|Lời kết|Như vậy|Để lựa chọn|Bệnh [^.:\n]{3,50} là một trong những|Nơi cung cấp)\b/gi,
    '$1\n$2'
  );

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

/** Dọn dẹp sạch toàn bộ Markdown thô và bullet để hiển thị dạng chuỗi thuần */
export const cleanRawMarkdown = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/(?:^|\s)#{1,6}\s+/g, ' ')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/(?:^|[\n\r]|(?<=[.:;!\s]))\s*[-•*+–—]\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/** Trích xuất tiêu đề đề mục (nếu có) và phần thân văn bản còn lại */
export const extractHeadingAndBody = (rawText: string): { heading: string | null; body: string } => {
  if (!rawText) return { heading: null, body: '' };

  const trimmed = rawText.trim();
  // Khớp markdown heading: "### Biện pháp phòng chống: ..." hoặc "## Triệu chứng..."
  const mdHeadingMatch = trimmed.match(/^#{1,6}\s+([^:\n]+:?)(.*)$/s);
  if (mdHeadingMatch) {
    const heading = mdHeadingMatch[1].replace(/[:#]/g, '').trim();
    const body = cleanRawMarkdown(mdHeadingMatch[2]);
    return { heading, body };
  }

  // Khớp tiêu đề kết thúc bằng dấu hai chấm ở đầu chuỗi: "Biện pháp phòng ngừa: ..."
  const colonHeadingMatch = trimmed.match(/^([A-ZÀ-Ỹ][^.!?\n]{3,60}:)(.*)$/s);
  if (colonHeadingMatch) {
    const heading = colonHeadingMatch[1].replace(/:$/, '').trim();
    const body = cleanRawMarkdown(colonHeadingMatch[2]);
    return { heading, body };
  }

  return { heading: null, body: cleanRawMarkdown(trimmed) };
};

/**
 * Chuẩn hóa mô tả triệu chứng:
 * Loại bỏ các khẩu lệnh chụp ảnh camera từ dataset huấn luyện AI (ví dụ: "Chụp cận cảnh 15–20cm", "Chụp rõ", "Chụp trọn...")
 * để chuyển thành câu văn mô tả triệu chứng bệnh học tự nhiên và thân thiện với nông dân.
 */
export const cleanSymptomText = (text?: string, commonNameVi?: string, plantName?: string): string => {
  if (!text) {
    return commonNameVi && plantName ? `Triệu chứng nhận biết và đặc điểm bệnh ${commonNameVi} trên cây ${plantName}.` : '';
  }

  let cleaned = cleanRawMarkdown(text);

  // 1. Loại bỏ các cụm chụp ảnh camera thường gặp ở đầu câu
  cleaned = cleaned
    .replace(/^Chụp cận cảnh\s+\d+[–-]\d+cm\s*/i, '')
    .replace(/^Chụp cận cảnh[;,]?\s*/i, '')
    .replace(/^Chụp rõ\s*/i, '')
    .replace(/^Chụp cận\s*/i, '')
    .replace(/^Chụp trọn\s*/i, '')
    .replace(/^Chụp kỹ cả\s*/i, '')
    .replace(/^Chụp thêm\s*/i, '')
    .replace(/^Chụp phần ngọn có\s*/i, 'Phần ngọn có ')
    .replace(/^Chụp một phiến lá đơn[,.]?\s*/i, '')
    .replace(/^Chụp một đoạn phiến lá[,.]?\s*/i, '')
    .replace(/^Chụp từng phiến lá[,.]?\s*/i, '')
    .replace(/^Chụp trọn phiến lá[,.]?\s*/i, '')
    .replace(/^Chụp\s+/i, '')
    .replace(/^Đưa lá lại gần[;,]?\s*/i, '')
    .replace(/^Lật mặt dưới lá,\s*chụp\s*/i, 'Mặt dưới lá xuất hiện ')
    .replace(/^Tránh ánh nắng chói trực tiếp khi chụp[;,.]?\s*/i, '')
    .replace(/^Tránh nắng gắt[;,.]?\s*/i, '');

  // 2. Loại bỏ các chỉ dẫn bối cảnh chụp ở cuối câu
  cleaned = cleaned
    .replace(/,\s*đặt lá trên nền trơn\.?$/i, '.')
    .replace(/,\s*tránh để cỏ nền lọt vào khung\.?$/i, '.')
    .replace(/,\s*tránh để lẫn nền đất trong khung hình\.?$/i, '.')
    .replace(/,\s*đủ ánh sáng\.?$/i, '.')
    .trim();

  // 3. Viết hoa chữ cái đầu tiên và bảo đảm kết thúc bằng dấu chấm
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    if (!/[.!?]$/.test(cleaned)) {
      cleaned += '.';
    }
  }

  if (cleaned.length < 5 && commonNameVi && plantName) {
    return `Triệu chứng nhận biết và đặc điểm bệnh ${commonNameVi} trên cây ${plantName}.`;
  }

  return cleaned;
};
