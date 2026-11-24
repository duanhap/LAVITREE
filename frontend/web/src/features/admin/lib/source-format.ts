export const buildCombinedOrg = (org: string, author: string): string => {
  const o = org.trim();
  const a = author.trim();
  if (o && a) return `${o} (Tác giả: ${a})`;
  if (a) return `Tác giả: ${a}`;
  return o;
};

export const parseCombinedOrg = (raw?: string | null): { org: string; author: string } => {
  const text = (raw || '').trim();
  if (!text) return { org: '', author: '' };
  // Hỗ trợ cả dạng "Cơ quan (Tác giả: ...)" và "Cơ quan / Tác giả: ..."
  const authorMatch = text.match(/^(.*?)\s*(?:\((?:Tác giả|Author):\s*(.*?)\)|\/\s*(?:Tác giả|Author):\s*(.+))$/i);
  if (authorMatch) {
    return { org: authorMatch[1].trim(), author: (authorMatch[2] ?? authorMatch[3] ?? '').trim() };
  }
  if (/^(?:Tác giả|Author):/i.test(text)) {
    return { org: '', author: text.replace(/^(?:Tác giả|Author):\s*/i, '').trim() };
  }
  return { org: text, author: '' };
};

export const buildCombinedDate = (pubDate: string, upDate: string): string => {
  const p = pubDate.trim();
  const u = upDate.trim();
  if (p && u) return `${p} (Cập nhật: ${u})`;
  if (u) return `Cập nhật: ${u}`;
  return p;
};

export const parseCombinedDate = (raw?: string | null): { pubDate: string; upDate: string } => {
  const text = (raw || '').trim();
  if (!text || text === 'Không ghi ngày') return { pubDate: '', upDate: '' };
  const upPrefixRe = /^(?:Được\s+rà\s+soát(?:\s*\/\s*cập\s+nhật)?|Cập\s+nhật|Updated|Revised|Reviewed(?:\s*\/\s*Revised)?|Modified)\s*:?\s*/i;
  const dateMatch = text.match(/^(.*?)\s*\((.+)\)$/);
  if (dateMatch) {
    return {
      pubDate: dateMatch[1].trim(),
      upDate: dateMatch[2].trim().replace(upPrefixRe, '').trim(),
    };
  }
  if (upPrefixRe.test(text)) {
    return { pubDate: '', upDate: text.replace(upPrefixRe, '').trim() };
  }
  return { pubDate: text, upDate: '' };
};

// Suy luận nguồn bài báo ("Việt Nam" hoặc "Quốc tế") từ URL, cơ quan hoặc giá trị đã lưu trong CSDL
export const inferSourceScope = (
  sourceUrl?: string | null,
  organization?: string | null,
  savedScope?: string | null
): 'Việt Nam' | 'Quốc tế' => {
  // 1. Ưu tiên số 1: Giá trị đã lưu trong Cơ sở dữ liệu của bài viết
  if (savedScope && savedScope.trim()) {
    const s = savedScope.trim();
    if (/quốc tế|nước ngoài|international|foreign/i.test(s)) return 'Quốc tế';
    if (/việt nam|trong nước|vietnam|\bvn\b/i.test(s)) return 'Việt Nam';
  }

  // 2. Suy luận theo tên miền (URL)
  let host = '';
  if (sourceUrl) {
    try {
      host = new URL(sourceUrl.trim()).hostname.toLowerCase();
    } catch {
      host = '';
    }
  }
  const org = (organization || '').toLowerCase();

  // Tên miền Việt Nam
  if (host.endsWith('.vn')) return 'Việt Nam';

  // Tên miền giáo dục/chính phủ nước ngoài
  if ((host.endsWith('.edu') || host.endsWith('.gov') || host.includes('.ac.')) && !host.endsWith('.vn')) {
    return 'Quốc tế';
  }

  // Tạp chí & Cổng tri thức nông nghiệp quốc tế uy tín
  if (
    host.includes('frontiersin.org') ||
    host.includes('sciencedirect.com') ||
    host.includes('springer.com') ||
    host.includes('nature.com') ||
    host.includes('wiley.com') ||
    host.includes('mdpi.com') ||
    host.includes('cabi.org') ||
    host.includes('fao.org') ||
    host.includes('apsnet.org') ||
    host.includes('extension.') ||
    /\b(extension|university|usda|cabi|fao|springer|nature|frontiers)\b/i.test(org) ||
    org.includes('đại học tiểu bang') ||
    org.includes('nam phi') ||
    org.includes('hoa kỳ')
  ) {
    return 'Quốc tế';
  }

  // Cơ quan, viện nghiên cứu chính thống tại Việt Nam
  if (
    org.includes('việt nam') ||
    org.includes('cục bảo vệ thực vật') ||
    org.includes('cục bvtv') ||
    org.includes('trung tâm khuyến nông') ||
    org.includes('khuyến nông quốc gia') ||
    org.includes('học viện nông nghiệp việt nam') ||
    org.includes('viện bảo vệ thực vật') ||
    org.includes('viện cây lương thực') ||
    org.includes('bộ nông nghiệp') ||
    org.includes('sở nông nghiệp')
  ) {
    return 'Việt Nam';
  }

  return 'Việt Nam';
};

