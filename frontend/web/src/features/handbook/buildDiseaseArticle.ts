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

    for (const src of items) {
      totalApprovedParagraphs += 1;

      // Xác định khóa nhận diện nguồn: URL nếu có, nếu không thì SourceTitle + Organization
      const trimmedUrl = (src.sourceUrl || '').trim();
      const refKey = trimmedUrl.length > 0
        ? trimmedUrl.toLowerCase()
        : `${src.sourceTitle || ''}:::${src.organization || ''}`.trim().toLowerCase();

      let refIndex = refKeyToIndex.get(refKey);
      if (refIndex === undefined) {
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

      paragraphs.push({
        id: src.id,
        evidenceText: src.evidenceText.trim(),
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
