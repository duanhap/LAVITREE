export const MONTH_MAP: Record<string, string> = {
  january: '01', jan: '01',
  february: '02', feb: '02',
  march: '03', mar: '03',
  april: '04', apr: '04',
  may: '05',
  june: '06', jun: '06',
  july: '07', jul: '07',
  august: '08', aug: '08',
  september: '09', sept: '09', sep: '09',
  october: '10', oct: '10',
  november: '11', nov: '11',
  december: '12', dec: '12',
};

export const normalizeDateDisplay = (raw: string): string => {
  let cleaned = raw.replace(/\s+/g, ' ').trim();
  cleaned = cleaned
    .replace(/^(?:thứ\s*[2-7]|thứ\s*hai|thứ\s*ba|thứ\s*tư|thứ\s*năm|thứ\s*sáu|thứ\s*bảy|chủ\s*nhật|th\s*[2-7]|t[2-7]|cn|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)[,\s.\-]+/i, '')
    .trim();
  if (!cleaned) return '';

  const engMDY = cleaned.match(/\b([a-zA-Z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  if (engMDY) {
    const mm = MONTH_MAP[engMDY[1].toLowerCase()];
    if (mm) return `${engMDY[2].padStart(2, '0')}/${mm}/${engMDY[3]}`;
  }

  const engDMY = cleaned.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)\.?,?\s+(\d{4})\b/);
  if (engDMY) {
    const mm = MONTH_MAP[engDMY[2].toLowerCase()];
    if (mm) return `${engDMY[1].padStart(2, '0')}/${mm}/${engDMY[3]}`;
  }

  const viDate = cleaned.match(/(?:ngày\s*)?(\d{1,2})\s*tháng\s*(\d{1,2})[,\s]*(?:năm\s*)?(\d{4})/i);
  if (viDate) {
    return `${viDate[1].padStart(2, '0')}/${viDate[2].padStart(2, '0')}/${viDate[3]}`;
  }

  const iso = cleaned.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    return `${iso[3].padStart(2, '0')}/${iso[2].padStart(2, '0')}/${iso[1]}`;
  }

  const dmy = cleaned.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
  if (dmy) {
    const p1 = parseInt(dmy[1], 10);
    const p2 = parseInt(dmy[2], 10);
    if (p1 <= 12 && p2 > 12) {
      return `${dmy[2].padStart(2, '0')}/${dmy[1].padStart(2, '0')}/${dmy[3]}`;
    }
    return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;
  }

  const viMY = cleaned.match(/(?:tháng\s*)?(\d{1,2})(?:\s*năm\s*|\s*[\/\-]\s*)(\d{4})/i);
  if (viMY) {
    const mNum = parseInt(viMY[1], 10);
    if (mNum >= 1 && mNum <= 12) {
      return `${String(mNum).padStart(2, '0')}/${viMY[2]}`;
    }
  }

  const engMY = cleaned.match(/\b([a-zA-Z]+)\.?\s+(?:of\s+|,\s*)?(\d{4})\b/);
  if (engMY) {
    const mm = MONTH_MAP[engMY[1].toLowerCase()];
    if (mm) return `${mm}/${engMY[2]}`;
  }

  const yearOnly = cleaned.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearOnly && cleaned.length <= 20) return yearOnly[1];

  return cleaned.slice(0, 60);
};

// Trích xuất biểu thức ngày/tháng/năm đầu tiên ngay sau từ khóa (tránh bắt nhầm năm rải rác giữa đoạn văn)
export const extractDateFromSegment = (segment: string): string => {
  let cleaned = segment
    .replace(/^[\s:\-–—,]+/, '')
    .replace(/^(?:thứ\s*[2-7]|thứ\s*hai|thứ\s*ba|thứ\s*tư|thứ\s*năm|thứ\s*sáu|thứ\s*bảy|chủ\s*nhật|th\s*[2-7]|t[2-7]|cn|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)[,\s.\-]+/i, '')
    .replace(/^(?:on|in|date|ngày|lúc|gần\s*nhất|lần\s*cuối)\s+/i, '')
    .replace(/^(?:thứ\s*[2-7]|thứ\s*hai|thứ\s*ba|thứ\s*tư|thứ\s*năm|thứ\s*sáu|thứ\s*bảy|chủ\s*nhật|th\s*[2-7]|t[2-7]|cn|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)[,\s.\-]+/i, '')
    .trim();
  if (!cleaned) return '';

  const patterns: RegExp[] = [
    /^([a-zA-Z]+\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+(?:19|20)\d{2})\b/,
    /^(\d{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]+\.?,?\s+(?:19|20)\d{2})\b/,
    /^((?:ngày\s*)?\d{1,2}\s*tháng\s*\d{1,2}[,\s]*(?:năm\s*)?(?:19|20)\d{2})\b/i,
    /^((?:19|20)\d{2}-\d{1,2}-\d{1,2})(?:[T\s]\S*)?\b/,
    /^(\d{1,2}[\/\-.]\d{1,2}[\/\-.](?:19|20)\d{2})\b/,
    /^((?:tháng\s*)?(?:0?[1-9]|1[0-2])(?:\s*năm\s*|\s*[\/\-]\s*)(?:19|20)\d{2})\b/i,
    /^([a-zA-Z]+\.?\s+(?:19|20)\d{2})\b/,
    /^((?:19|20)\d{2})\b/,
  ];

  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m) {
      const normalized = normalizeDateDisplay(m[1]);
      if (normalized) return normalized;
    }
  }
  return '';
};

export const KNOWN_ORG_BY_HOST: Array<{ match: RegExp; name: string }> = [
  { match: /(?:^|\.)ces\.ncsu\.edu$/i, name: 'NC State Extension Publications' },
  { match: /(?:^|\.)extension\.cornell\.edu$|(?:^|\.)cornell\.edu$/i, name: 'Cornell University Cooperative Extension' },
  { match: /(?:^|\.)extension\.umn\.edu$|(?:^|\.)umn\.edu$/i, name: 'University of Minnesota Extension' },
  { match: /(?:^|\.)ifas\.ufl\.edu$|(?:^|\.)ufl\.edu$/i, name: 'UF/IFAS Extension, University of Florida' },
  { match: /(?:^|\.)extension\.wvu\.edu$|(?:^|\.)wvu\.edu$/i, name: 'West Virginia University Extension' },
  { match: /(?:^|\.)extension\.wisc\.edu$|(?:^|\.)wisc\.edu$/i, name: 'University of Wisconsin-Madison Extension' },
  { match: /(?:^|\.)extension\.uga\.edu$|(?:^|\.)uga\.edu$/i, name: 'UGA Cooperative Extension' },
  { match: /(?:^|\.)extension\.unh\.edu$|(?:^|\.)unh\.edu$/i, name: 'University of New Hampshire Extension' },
  { match: /(?:^|\.)extension\.usu\.edu$|(?:^|\.)usu\.edu$/i, name: 'Utah State University Extension' },
  { match: /(?:^|\.)udel\.edu$/i, name: 'University of Delaware Cooperative Extension' },
  { match: /(?:^|\.)umass\.edu$/i, name: 'UMass Extension' },
  { match: /(?:^|\.)ndsu\.edu$/i, name: 'NDSU Extension' },
  { match: /(?:^|\.)vegcropshotline\.org$|(?:^|\.)purdue\.edu$/i, name: 'Purdue University Extension' },
  { match: /(?:^|\.)ipm\.ucanr\.edu$|(?:^|\.)ucanr\.edu$/i, name: 'UC IPM (University of California)' },
  { match: /(?:^|\.)frontiersin\.org$/i, name: 'Frontiers in Plant Science' },
  { match: /(?:^|\.)ahdb\.org\.uk$/i, name: 'AHDB (Agriculture and Horticulture Development Board)' },
  { match: /(?:^|\.)khuyennongvn\.gov\.vn$/i, name: 'Trung tâm Khuyến nông Quốc gia' },
  { match: /(?:^|\.)vaas\.vn$/i, name: 'Viện Khoa học Nông nghiệp Việt Nam (VAAS)' },
  { match: /(?:^|\.)ppd\.gov\.vn$|(?:^|\.)bvtv\.gov\.vn$/i, name: 'Cục Bảo vệ thực vật' },
  { match: /(?:^|\.)iasvn\.org$/i, name: 'Viện Khoa học Kỹ thuật Nông nghiệp miền Nam (IAS)' },
];

export const extractKeyMetadataFromText = (
  text: string,
  sourceUrl?: string
): {
  organization: string;
  author: string;
  publishedDate: string;
  updatedDate: string;
} => {
  const result = {
    organization: '',
    author: '',
    publishedDate: '',
    updatedDate: '',
  };

  if (!text) return result;
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^(?:[#>*\-•+]+\s*)+/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean);

  // Regex không neo ^ để bắt được cả trường hợp <br> hoặc dấu chấm gộp "Publication date: ... Reviewed/Revised: ..." trên cùng 1 dòng
  const pubContextRe = /\b(?:original\s+publication\s+date|publication\s*date|date\s*published|originally\s+published(?:\s+in|\s+on)?|first\s+published(?:\s+in|\s+on)?|published(?:\s+date|\s+on|\s+in)?|posted\s*on|release\s*date|ngày\s*(?:đăng|xuất\s*bản|phát\s*hành)|đăng\s*ngày|xuất\s*bản(?:\s*ngày|\s*tháng|\s*năm)?)\s*(?:[:\-]|\s)\s*([^\n;|]+)/i;
  const updContextRe = /\b(?:reviewed\s*\/\s*revised|revised\s*\/\s*reviewed|date\s*revised|last\s*(?:updated|reviewed|modified|revised)|updated(?:\s+on|\s+in)?|revised(?:\s+on|\s+in)?|reviewed(?:\s+on|\s+in)?|modified(?:\s+on|\s+in)?|ngày\s*(?:cập\s*nhật|rà\s*soát|hiệu\s*đính)|cập\s*nhật(?:\s*lần\s*cuối|\s*gần\s*nhất|\s*ngày)?|(?:được\s*)?rà\s*soát\s*\/?\s*cập\s*nhật(?:\s*gần\s*nhất)?(?:\s*ngày)?|hiệu\s*đính(?:\s*ngày)?)\s*(?:[:\-]|\s)\s*([^\n;|]+)/i;
  const orgKeyRe = /^(?:cơ\s*quan|tổ\s*chức|đơn\s*vị(?:\s*phát\s*hành)?|organization|publisher|institution)\s*[:\-]\s*(.+)$/i;
  const authorKeyRe = /^(?:tác\s*giả|author|authors|written\s+by|prepared\s+by|biên\s*soạn|người\s*viết)\s*[:\-]\s*(.+)$/i;
  const cleanAuthorNames = (raw: string) =>
    raw
      .replace(/(\p{L})\d+(?=\s*(?:,|$|\band\b|\bvà\b))/gu, '$1')
      .replace(/\s+/g, ' ')
      .trim();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isEdgeLine = i < 15 || i >= lines.length - 15;

    let pubMatchedOnLine = false;
    if (!result.publishedDate) {
      const m = line.match(pubContextRe);
      if (m) {
        const hasColon = /\b(?:publication\s*date|date\s*published|published|posted\s*on|release\s*date|ngày\s*(?:đăng|xuất\s*bản|phát\s*hành)|đăng\s*ngày)\s*[:\-]/i.test(line);
        if (hasColon || isEdgeLine || line.length <= 180) {
          const rawVal = m[1].split(/\b(?:reviewed\s*\/\s*revised|revised\s*\/\s*reviewed|last\s*(?:updated|reviewed|modified)|updated|revised|reviewed|cập\s*nhật|rà\s*soát|hiệu\s*đính)\b/i)[0].trim();
          const parsed = extractDateFromSegment(rawVal);
          if (parsed) {
            result.publishedDate = parsed;
            pubMatchedOnLine = true;
          }
        }
      } else if (i < 10 && line.length <= 40) {
        // Nhận diện ngày đăng đứng riêng một dòng ngắn ở đầu bài
        const standaloneDate = extractDateFromSegment(line);
        if (standaloneDate && (line.length <= 30 || /^(?:th\s*[2-7]|thứ\s*\w+|\d{1,2}[\/\-.]\d{1,2}[\/\-.](?:19|20)\d{2})/i.test(line))) {
          result.publishedDate = standaloneDate;
          pubMatchedOnLine = true;
        }
      }
    }

    // Nhận diện tác giả đứng cạnh ngày đăng khi copy thủ công (Dòng 1: "My Trần", Dòng 2: "Th 2 11/08/2025")
    // Bỏ dòng 0 (thường là tiêu đề bài) và chỉ nhận dòng giống TÊN NGƯỜI: 2-5 từ, mỗi từ viết hoa chữ cái đầu,
    // không có chữ số → tránh nhận nhầm tiêu đề ngắn "Kỹ thuật trồng dưa lưới" + dòng ngày trần thành tác giả.
    if (!result.author && i > 0 && i < 8 && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const nextDate = extractDateFromSegment(nextLine);
      if (nextDate && nextLine.length <= 35) {
        const candidate = line.trim();
        const isCandidateName =
          candidate.length >= 2 &&
          candidate.length <= 40 &&
          !/[.!?:;,]$/.test(candidate) &&
          /^\p{Lu}[\p{L}.'’-]*(?:\s+\p{Lu}[\p{L}.'’-]*){1,4}$/u.test(candidate) &&
          !candidate.startsWith('#') &&
          !/^(?:trang\s*chủ|tin\s*tức|bài\s*viết|chuyên\s*mục|hướng\s*dẫn|nguyên\s*nhân|triệu\s*chứng|điều\s*trị|phòng\s*ngừa|nông\s*nghiệp)\b/i.test(candidate);
        if (isCandidateName) {
          result.author = cleanAuthorNames(candidate);
          if (!result.publishedDate) result.publishedDate = nextDate;
        }
      }
    }

    if (!result.updatedDate) {
      const m = line.match(updContextRe);
      if (m) {
        const hasColon = /\b(?:reviewed\s*\/\s*revised|revised\s*\/\s*reviewed|date\s*revised|last\s*(?:updated|reviewed|modified)|updated|revised|reviewed|cập\s*nhật|hiệu\s*đính)\s*[:\-]/i.test(line);
        if (hasColon || isEdgeLine || pubMatchedOnLine || line.length <= 160) {
          const parsed = extractDateFromSegment(m[1]);
          if (parsed) {
            result.updatedDate = parsed;
          }
        }
      }
    }

    if (!result.organization && i < 15) {
      const m = line.match(orgKeyRe);
      if (m && m[1].trim().length >= 3 && m[1].trim().length <= 120) {
        result.organization = m[1].trim();
      }
    }

    if (!result.author) {
      const m = line.match(authorKeyRe);
      if (m && m[1].trim().length >= 3 && m[1].trim().length <= 240) {
        const rolePhraseRe = /\b(?:wvu\s+extension|extension|specialist|professor|director|coordinator|fellow|educator|agent|research\s*(?:assistant|associate|technician|specialist)|assistant|associate|technician|scientist|pathology|entomology|horticulture|agronomy|agriculture|biology|natural\s+resources|resources|department|division|college|school|center|centre|faculty|university|institute)\b/i;
        const cleanedRaw = cleanAuthorNames(m[1]);
        const segments = cleanedRaw
          .split(/,\s*(?:and\s+|và\s+)?|\s+(?:and|và)\s+/i)
          .map((s) => s.trim())
          .filter(Boolean);
        const keptNames = segments.filter((seg) => !rolePhraseRe.test(seg));
        result.author = (keptNames.length > 0 ? keptNames.join(', ') : cleanedRaw).slice(0, 180);
      } else if (i < 12) {
        const byMatch = line.match(/^(?:by|written\s+by|prepared\s+by)\s+(.+)$/i);
        if (byMatch && byMatch[1].trim().length >= 4 && byMatch[1].trim().length <= 150 && !/\b(?:the|this|that|wind|rain|water|fungus)\b/i.test(byMatch[1])) {
          result.author = cleanAuthorNames(byMatch[1]);
        }
      }
    }
  }

  if (!result.author) {
    const roleRe = /\b(professor|specialist|director|researcher|research|extension|scientist|technician|associate|assistant|coordinator|fellow|educator|agent|temporary|interim|adjunct|emeritus|faculty|staff|student|entomology|plant\s+pathology|pathology|horticulture|agronomy|ornamental|vegetable|lecturer|ph\.?\s*d\.?|giáo\s*sư|phó\s*giáo\s*sư|tiến\s*sĩ|thạc\s*sĩ|kỹ\s*sư|chuyên\s*gia|nghiên\s*cứu\s*viên|giảng\s*viên)\b/i;
    const stopSectionRe = /^(keywords?|references?|find\s+more\s+information|publication\s*date|reviewed\s*\/\s*revised|từ\s*khóa|tài\s*liệu\s*tham\s*khảo)\b/i;
    const personNameRe = /^\p{Lu}[\p{L}.'-]+(?:\s+\p{Lu}\.?)?(?:\s+\p{Lu}[\p{L}.'-]+){1,4}$/u;
    const nonAuthorHeadings = /^(introduction|symptoms\s+and\s+signs|disease\s+cycle|management|pathogen|diagnostic\s+procedures|references|authors|keywords|leaf\s+scorch|strawberry)$/i;

    const extractedAuthors: string[] = [];
    const authorsHeadingIdx = lines.findIndex((l) => /^authors?:?$/i.test(l));

    if (authorsHeadingIdx !== -1) {
      const colonCandidates: string[] = [];
      const plainCandidates: string[] = [];
      for (let i = authorsHeadingIdx + 1; i < Math.min(lines.length, authorsHeadingIdx + 35); i++) {
        const rawLine = lines[i].trim();
        const hadColon = rawLine.endsWith(':');
        const cur = cleanAuthorNames(rawLine.replace(/:\s*$/, ''));
        if (stopSectionRe.test(cur)) break;
        if (roleRe.test(cur)) continue;
        if (personNameRe.test(cur) && !nonAuthorHeadings.test(cur)) {
          if (hadColon) {
            if (!colonCandidates.includes(cur)) colonCandidates.push(cur);
          } else if (!plainCandidates.includes(cur)) {
            plainCandidates.push(cur);
          }
        }
      }
      const chosen = colonCandidates.length >= 2 ? colonCandidates : [...colonCandidates, ...plainCandidates];
      chosen.forEach((name) => {
        if (!extractedAuthors.includes(name)) extractedAuthors.push(name);
      });
    } else {
      for (let i = 0; i < lines.length - 1; i++) {
        const cur = lines[i];
        if (!cur.endsWith(':')) continue;
        const candidate = cleanAuthorNames(cur.slice(0, -1));
        const nextLine = lines[i + 1];
        if (
          personNameRe.test(candidate) &&
          !nonAuthorHeadings.test(candidate) &&
          roleRe.test(nextLine) &&
          !extractedAuthors.includes(candidate)
        ) {
          extractedAuthors.push(candidate);
        }
      }
    }

    if (extractedAuthors.length === 0) {
      // Nhận diện dòng liệt kê nhiều tác giả ở đầu bài (vd: UF/IFAS "Keevan MacKenzie1, Jessica Chitwood-Brown2, ... and Gary Vallad4")
      const topByline = lines.slice(0, 10).find((l) => {
        if (l.length < 10 || l.length > 180 || /[?!:]/.test(l)) return false;
        const cleanedLine = cleanAuthorNames(l);
        const tokens = cleanedLine.split(/,\s*(?:and\s+|và\s+)?|\s+(?:and|và)\s+/i).map((t) => t.trim()).filter(Boolean);
        return (
          tokens.length >= 2 &&
          tokens.length <= 10 &&
          tokens.every((t) => personNameRe.test(t) && !nonAuthorHeadings.test(t))
        );
      });
      if (topByline) {
        result.author = cleanAuthorNames(topByline);
      }
    }

    if (!result.author && extractedAuthors.length > 0) {
      result.author = extractedAuthors.slice(0, 10).join(', ');
    }
  }

  if (!result.organization) {
    const topOrgLine = lines.slice(0, 8).find(
      (l) =>
        l.length >= 6 &&
        l.length <= 100 &&
        !l.endsWith(':') &&
        /\b(extension|university|institute|center|centre|trung\s*tâm|viện|cục|bộ\s*nông\s*nghiệp|sở\s*nông\s*nghiệp|khuyến\s*nông)\b/i.test(l)
    );
    if (topOrgLine) {
      result.organization = topOrgLine;
    } else if (sourceUrl) {
      try {
        const host = new URL(sourceUrl.trim()).hostname.toLowerCase();
        const matchedHost = KNOWN_ORG_BY_HOST.find((item) => item.match.test(host));
        if (matchedHost) result.organization = matchedHost.name;
      } catch {
        // ignore invalid URL
      }
    }
  }

  return result;
};

