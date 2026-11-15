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
  let host = '';
  if (sourceUrl) {
    try {
      host = new URL(sourceUrl.trim()).hostname.toLowerCase();
    } catch {
      host = '';
    }
  }
  const org = (organization || '').toLowerCase();

  if (host.endsWith('.vn')) return 'Việt Nam';
  if ((host.endsWith('.edu') || host.endsWith('.gov') || host.includes('.ac.')) && !host.endsWith('.vn')) {
    return 'Quốc tế';
  }
  if (
    host.includes('extension.') ||
    host.includes('cabi.org') ||
    host.includes('fao.org') ||
    host.includes('apsnet.org') ||
    host.includes('mdpi.com') ||
    host.includes('sciencedirect.com') ||
    /\b(extension|university|usda|cabi|fao)\b/i.test(org) ||
    org.includes('đại học tiểu bang')
  ) {
    return 'Quốc tế';
  }
  if (
    org.includes('việt nam') ||
    org.includes('khuyến nông') ||
    org.includes('cục bvtv') ||
    org.includes('nông nghiệp') ||
    org.includes('viện cây') ||
    org.includes('học viện nông nghiệp') ||
    org.includes('sở nn') ||
    org.includes('trung tâm sản phẩm sinh học')
  ) {
    return 'Việt Nam';
  }
  if (savedScope && /quốc tế|nước ngoài|international|foreign/i.test(savedScope)) {
    return 'Quốc tế';
  }
  return 'Việt Nam';
};

