import type {
  PublicKnowledgeSource,
  DiseaseArticle,
  HandbookSection,
  HandbookReference,
  HandbookParagraph,
  SectionUnitType,
} from './types';

interface SectionDefinition {
  unitType: SectionUnitType;
  id: string;
  defaultTitle: string;
  healthyTitle?: string;
  iconName: 'BookOpen' | 'Activity' | 'Microscope' | 'ShieldCheck' | 'Stethoscope';
}

const SECTION_DEFS: SectionDefinition[] = [
  {
    unitType: 'SUMMARY',
    id: 'tong-quan',
    defaultTitle: 'Tổng quan',
    iconName: 'BookOpen',
  },
  {
    unitType: 'SYMPTOMS',
    id: 'trieu-chung',
    defaultTitle: 'Triệu chứng nhận biết',
    healthyTitle: 'Đặc điểm cây khỏe',
    iconName: 'Activity',
  },
  {
    unitType: 'CAUSE_CONDITIONS',
    id: 'nguyen-nhan',
    defaultTitle: 'Nguyên nhân & điều kiện phát sinh',
    iconName: 'Microscope',
  },
  {
    unitType: 'PREVENTION',
    id: 'phong-ngua',
    defaultTitle: 'Phòng ngừa',
    healthyTitle: 'Kỹ thuật chăm sóc',
    iconName: 'ShieldCheck',
  },
  {
    unitType: 'TREATMENT',
    id: 'xu-ly',
    defaultTitle: 'Xử lý',
    iconName: 'Stethoscope',
  },
];

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function extractYear(publishedDate?: string | null): string | null {
  if (!publishedDate) return null;
  const match = publishedDate.match(/(?:19|20)\d{2}/);
  return match ? match[0] : null;
}

/**
 * Phân tích và trích xuất số thứ tự phân cấp từ đầu một đoạn văn hoặc tiêu đề đầu tiên.
 * Hỗ trợ các định dạng: "## 1. ", "## 1/ ", "### 2.1. ", "1. ", "1/ ", "1) ", "Phần 1: "
 */
function extractLeadingSectionNumber(text: string): { raw: string; values: number[] } | null {
  const trimmed = text.trim();
  const match =
    trimmed.match(/^(?:#{1,6}\s*)?(?:(?:mục|bước|phần|điều)\s+)?(\d+(?:\.\d+)*)[\.\/\)\:\-\s]/i) ||
    trimmed.match(/(?:^|\n)\s*#{1,6}\s*(?:(?:mục|bước|phần|điều)\s+)?(\d+(?:\.\d+)*)[\.\/\)\:\-\s]/i);

  if (!match) return null;

  const raw = match[1];
  const parts = raw.split('.').map(Number);
  return { raw, values: parts };
}

/**
 * So sánh 2 số thứ tự phân cấp (ví dụ: [1] < [2] < [2, 1] < [2, 2] < [3])
 */
function compareHierarchyNumbers(a: number[], b: number[]): number {
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i++) {
    const valA = i < a.length ? a[i] : 0;
    const valB = i < b.length ? b[i] : 0;
    if (valA !== valB) return valA - valB;
  }
  return 0;
}

/**
 * Kiểm tra xem trong toàn bộ văn bản của 1 đoạn có chứa nhiều số thứ tự hay không
 */
function hasMultipleInternalNumbers(text: string): boolean {
  const matches = text.match(/(?:^|\n)\s*(?:#{1,6}\s*)?(?:(?:mục|bước|phần)\s+)?(\d+(?:\.\d+)*)[\.\/\)\:\-]/gi);
  if (!matches) return false;
  const uniqueNums = new Set(
    matches.map((m) => {
      const numMatch = m.match(/\d+(?:\.\d+)*/);
      return numMatch ? numMatch[0] : '';
    }).filter(Boolean)
  );
  return uniqueNums.size > 1;
}

/**
 * Lược bỏ số thứ tự mồ côi (chỉ có duy nhất 1 số trong mục, không có số đối ứng)
 */
function stripOrphanLeadingNumber(text: string): string {
  let result = text.replace(/^(\s*#{1,6}\s*)(?:(?:mục|bước|phần|điều)\s+)?\d+(?:\.\d+)*[\.\/\)\:\-]?\s*/i, '$1');
  result = result.replace(/^(\s*)(?:(?:mục|bước|phần|điều)\s+)?\d+(?:\.\d+)*[\.\/\)\:\-]\s*/i, '$1');
  result = result.replace(/(\n\s*#{1,6}\s*)(?:(?:mục|bước|phần|điều)\s+)?\d+(?:\.\d+)*[\.\/\)\:\-]?\s*/gi, '$1');
  return result;
}

function normalizeSource(raw: any): PublicKnowledgeSource {
  return {
    id: String(raw.id ?? ''),
    modelClass: raw.modelClass ?? raw.model_class ?? '',
    plantName: raw.plantName ?? raw.plant_name ?? '',
    diseaseName: raw.diseaseName ?? raw.disease_name ?? '',
    sourceUrl: raw.sourceUrl ?? raw.source_url ?? '',
    sourceTitle: raw.sourceTitle ?? raw.source_title ?? '',
    organization: raw.organization ?? '',
    publishedDate: raw.publishedDate ?? raw.published_date ?? null,
    evidenceText: raw.evidenceText ?? raw.evidence_text ?? '',
    unitType: raw.unitType ?? raw.unit_type ?? 'SUMMARY',
    isVerbatim: raw.isVerbatim ?? raw.is_verbatim ?? false,
    sourceScope: raw.sourceScope ?? raw.source_scope,
    createdAt: raw.createdAt ?? raw.created_at ?? null,
  };
}

export function buildDiseaseArticle(
  rawSources: PublicKnowledgeSource[],
  options: { isHealthy?: boolean } = {}
): DiseaseArticle {
  const isHealthy = options.isHealthy ?? false;

  // 1. Phân loại và chuẩn hóa unitType
  const groupedSources = new Map<SectionUnitType, PublicKnowledgeSource[]>();
  SECTION_DEFS.forEach((def) => groupedSources.set(def.unitType, []));

  let latestDate: string | null = null;

  for (const rawItem of rawSources) {
    const item = normalizeSource(rawItem);
    if (!item.evidenceText || item.evidenceText.trim().length === 0) continue;

    // Cập nhật ngày mới nhất
    if (item.createdAt) {
      if (!latestDate || new Date(item.createdAt) > new Date(latestDate)) {
        latestDate = item.createdAt;
      }
    }

    const rawType = (item.unitType || '').trim().toUpperCase();
    const unitType: SectionUnitType =
      rawType === 'SYMPTOMS' ||
      rawType === 'CAUSE_CONDITIONS' ||
      rawType === 'PREVENTION' ||
      rawType === 'TREATMENT'
        ? (rawType as SectionUnitType)
        : 'SUMMARY';

    groupedSources.get(unitType)!.push(item);
  }

  // 2. Sắp xếp theo CreatedAt tăng dần rồi Id, lọc trùng nội dung trong mỗi mục
  const dedupedGrouped = new Map<SectionUnitType, PublicKnowledgeSource[]>();

  for (const def of SECTION_DEFS) {
    const list = groupedSources.get(def.unitType) || [];
    list.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return a.id.localeCompare(b.id);
    });

    const seenTexts = new Set<string>();
    const uniqueList: PublicKnowledgeSource[] = [];

    for (const item of list) {
      const key = normalizeText(item.evidenceText);
      if (!seenTexts.has(key)) {
        seenTexts.add(key);
        uniqueList.push(item);
      }
    }

    // 2.1 Sắp xếp theo số thứ tự (nếu có) hoặc lược bỏ số mồ côi theo yêu cầu người dùng:
    // "các đoạn nếu nằm trong 1 mục mà có đánh số thứ tự mà ko có số thứ tự khác thì bỏ đi nhá, mục nào có số thứ tứ tự thì cố làm sao mà sắp xếp đc nhá"
    const itemNumberMap = new Map<string, { raw: string; values: number[] }>();
    const allDistinctNumbers = new Set<string>();

    for (const item of uniqueList) {
      const numInfo = extractLeadingSectionNumber(item.evidenceText);
      if (numInfo) {
        itemNumberMap.set(item.id, numInfo);
        allDistinctNumbers.add(numInfo.values[0].toString());
      }
    }

    if (allDistinctNumbers.size > 1) {
      // Có nhiều số thứ tự (ví dụ: 1, 2, 2.1, 2.2, 2.3, 2.4) => Sắp xếp theo số thứ tự phân cấp
      uniqueList.sort((a, b) => {
        const numA = itemNumberMap.get(a.id);
        const numB = itemNumberMap.get(b.id);
        if (numA && numB) {
          const comp = compareHierarchyNumbers(numA.values, numB.values);
          if (comp !== 0) return comp;
        } else if (numA) {
          return 1; // Đoạn không đánh số (mở đầu) đặt trước
        } else if (numB) {
          return -1;
        }
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.id.localeCompare(b.id);
      });
    } else if (allDistinctNumbers.size <= 1) {
      // Trong mục chỉ có 1 số thứ tự duy nhất (hoặc không có số khác đối ứng)
      // => Lược bỏ số thứ tự mồ côi (ví dụ "## 4. Quản lý..." -> "## Quản lý...")
      for (const item of uniqueList) {
        const numInfo = itemNumberMap.get(item.id);
        if (numInfo && !hasMultipleInternalNumbers(item.evidenceText)) {
          item.evidenceText = stripOrphanLeadingNumber(item.evidenceText);
        }
      }
    }

    dedupedGrouped.set(def.unitType, uniqueList);
  }

  // 3. Đánh số nguồn [1]...[n] theo thứ tự xuất hiện đầu tiên (đi từ mục 1 đến 5)
  const references: HandbookReference[] = [];
  const refKeyToIndex = new Map<string, number>();

  const sections: HandbookSection[] = [];
  let totalApprovedParagraphs = 0;

  for (const def of SECTION_DEFS) {
    const items = dedupedGrouped.get(def.unitType) || [];
    if (items.length === 0) continue;

    const paragraphs: HandbookParagraph[] = [];

    const isSummary = def.unitType === 'SUMMARY';

    for (const src of items) {
      totalApprovedParagraphs += 1;

      let evidenceToRender = src.evidenceText.trim();

      // Trong mục Tổng quan: Loại bỏ hoàn toàn các câu hỏi FAQ để không bị lặp lại với mục FAQ ở cuối trang
      if (isSummary) {
        // 1. Tách bỏ phần đề mục "Câu hỏi thường gặp" nếu có
        const faqSplit = evidenceToRender.split(/(?:^|\n)\s*(?:#{1,6}\s*)?(?:\d+[.)/]\s*)?câu hỏi thường gặp/i);
        evidenceToRender = faqSplit[0].trim();

        // 2. Lọc bỏ tiếp các dòng câu hỏi kết thúc bằng '?' hoặc mũi tên trả lời nếu còn sót lại trong tổng quan
        if (evidenceToRender.includes('?')) {
          const lines = evidenceToRender.split(/\r?\n/);
          const nonFaqLines: string[] = [];
          for (let i = 0; i < lines.length; i++) {
            const l = lines[i].trim();
            const plain = l.replace(/[*_#]/g, '').trim();
            const isQ = plain.endsWith('?') || /^(?:câu\s*\d+|hỏi|faq)\b/i.test(plain);
            if (isQ) {
              let j = i + 1;
              while (
                j < lines.length &&
                (lines[j].trim().startsWith('-->') ||
                  lines[j].trim().startsWith('->') ||
                  !lines[j].trim().startsWith('#'))
              ) {
                const nextPlain = lines[j].trim().replace(/[*_#]/g, '');
                if (nextPlain.endsWith('?') || /^(?:câu\s*\d+|hỏi|faq)\b/i.test(nextPlain)) break;
                j++;
              }
              i = j - 1;
              continue;
            }
            nonFaqLines.push(lines[i]);
          }
          evidenceToRender = nonFaqLines.join('\n').trim();
        }

        // Nếu cả đoạn văn trong SUMMARY thực chất là 100% câu hỏi FAQ thì không thêm vào mục Tổng quan
        if (!evidenceToRender || evidenceToRender.length < 15) {
          continue;
        }
      }

      let refIndex = 0;
      const trimmedUrl = (src.sourceUrl || '').trim();

      // Chỉ đánh số trích dẫn nguồn cho các mục ngoài Tổng quan (theo yêu cầu người dùng)
      if (!isSummary) {
        const refKey = trimmedUrl.length > 0
          ? trimmedUrl.toLowerCase()
          : `${src.sourceTitle || ''}:::${src.organization || ''}`.trim().toLowerCase();

        const existing = refKeyToIndex.get(refKey);
        if (existing !== undefined) {
          refIndex = existing;
        } else {
          refIndex = references.length + 1;
          refKeyToIndex.set(refKey, refIndex);
          references.push({
            index: refIndex,
            key: refKey,
            organization: src.organization?.trim() || 'Nguồn kiểm duyệt',
            sourceTitle: src.sourceTitle?.trim() || 'Tài liệu khuyến nông',
            sourceUrl: trimmedUrl,
            year: extractYear(src.publishedDate),
            sourceScope: src.sourceScope || 'Việt Nam',
          });
        }
      }

      paragraphs.push({
        id: src.id,
        evidenceText: evidenceToRender,
        isVerbatim: src.isVerbatim ?? false,
        refIndex,
        sourceUrl: trimmedUrl,
      });
    }

    sections.push({
      id: def.id,
      unitType: def.unitType,
      title: isHealthy && def.healthyTitle ? def.healthyTitle : def.defaultTitle,
      iconName: def.iconName,
      paragraphs,
    });
  }

  return {
    sections,
    references,
    totalApprovedParagraphs,
    totalUniqueSources: references.length,
    latestUpdatedAt: latestDate,
  };
}
