import type {
  ProductDiseaseInfo,
  ProductEvidenceItem,
  GroupedDiseaseRow,
  GroupedArticleEvidence,
  EvidenceSnippet,
  DiseaseRecommendationStatus,
} from './types';

/**
 * Trích xuất 1-2 câu xung quanh tên thuốc (mention_text), tách thành { before, match, after }
 * để render <mark> an toàn mà không dùng dangerouslySetInnerHTML.
 */
export function extractSentenceWithMention(
  evidenceText: string,
  mentionText: string
): { before: string; match: string; after: string } {
  if (!evidenceText) {
    return { before: '', match: '', after: '' };
  }
  const cleanEvidence = evidenceText.trim();
  if (!mentionText || !mentionText.trim()) {
    const cut = cleanEvidence.length > 240 ? cleanEvidence.slice(0, 240) + '…' : cleanEvidence;
    return { before: cut, match: '', after: '' };
  }

  const lowerText = cleanEvidence.toLowerCase();
  const lowerMention = mentionText.trim().toLowerCase();
  const idx = lowerText.indexOf(lowerMention);

  if (idx === -1) {
    const cut = cleanEvidence.length > 240 ? cleanEvidence.slice(0, 240) + '…' : cleanEvidence;
    return { before: cut, match: '', after: '' };
  }

  // Tìm biên đầu câu (., !, ?, \n)
  let startIdx = 0;
  for (let i = idx - 1; i >= 0; i--) {
    const char = cleanEvidence[i];
    if (char === '.' || char === '!' || char === '?' || char === '\n') {
      startIdx = i + 1;
      break;
    }
  }

  // Tìm biên cuối câu (., !, ?, \n)
  let endIdx = cleanEvidence.length;
  for (let i = idx + lowerMention.length; i < cleanEvidence.length; i++) {
    const char = cleanEvidence[i];
    if (char === '.' || char === '!' || char === '?' || char === '\n') {
      endIdx = i + 1;
      break;
    }
  }

  const sentence = cleanEvidence.slice(startIdx, endIdx).trim();
  const sentenceLower = sentence.toLowerCase();
  const matchPos = sentenceLower.indexOf(lowerMention);

  if (matchPos === -1) {
    return { before: sentence, match: '', after: '' };
  }

  const before = (startIdx > 0 ? '…' : '') + sentence.slice(0, matchPos);
  const match = sentence.slice(matchPos, matchPos + lowerMention.length);
  const after = sentence.slice(matchPos + lowerMention.length) + (endIdx < cleanEvidence.length ? '…' : '');

  return { before, match, after };
}

/**
 * Gom nhóm căn cứ và bệnh áp dụng cho sản phẩm (Hàm thuần - SSOT TASK-21)
 */
export function groupProductEvidence(
  diseases: ProductDiseaseInfo[],
  evidences: ProductEvidenceItem[],
  options: { mode?: 'admin' | 'public' } = {}
): GroupedDiseaseRow[] {
  const mode = options.mode ?? 'admin';

  // 1. Phân loại bằng chứng theo model_class
  const evidenceByClass = new Map<string, ProductEvidenceItem[]>();
  for (const ev of evidences) {
    if (!ev.model_class) continue;
    // Chế độ public chỉ hiển thị đoạn đã duyệt
    if (mode === 'public' && !ev.is_approved) continue;

    const key = ev.model_class.toLowerCase();
    const list = evidenceByClass.get(key) || [];
    list.push(ev);
    evidenceByClass.set(key, list);
  }

  // 2. Tập hợp tất cả các mã lớp (hợp của DiseaseProducts và Evidences)
  const classCodeMap = new Map<string, { modelClass: string; diseaseName: string; plantName: string; isRecommended: boolean }>();

  // Thêm các bệnh đã khuyên dùng (DiseaseProducts)
  for (const d of diseases) {
    if (!d.class_code) continue;
    classCodeMap.set(d.class_code.toLowerCase(), {
      modelClass: d.class_code,
      diseaseName: d.disease_name || d.class_code,
      plantName: d.plant_name || 'Cây trồng',
      isRecommended: true,
    });
  }

  // Thêm các bệnh xuất hiện trong bằng chứng nhưng chưa khuyên dùng
  for (const ev of evidences) {
    if (!ev.model_class) continue;
    if (mode === 'public' && !ev.is_approved) continue;

    const key = ev.model_class.toLowerCase();
    if (!classCodeMap.has(key)) {
      classCodeMap.set(key, {
        modelClass: ev.model_class,
        diseaseName: ev.disease_name || ev.model_class,
        plantName: ev.plant_name || 'Cây trồng',
        isRecommended: false,
      });
    }
  }

  // 3. Xây dựng từng dòng bệnh
  const rows: GroupedDiseaseRow[] = [];

  for (const [key, meta] of classCodeMap.entries()) {
    // Trong chế độ public, chỉ hiển thị bệnh đang khuyên dùng
    if (mode === 'public' && !meta.isRecommended) continue;

    const classEvidences = evidenceByClass.get(key) || [];

    // Xác định trạng thái khuyến nghị
    let status: DiseaseRecommendationStatus;
    if (meta.isRecommended) {
      status = classEvidences.length > 0 ? 'SUPPORTED' : 'MANUAL_ONLY';
    } else {
      status = 'UNRECOMMENDED_EVIDENCE';
    }

    // Gom nhóm bài báo theo source_url (cùng URL = 1 thẻ bài báo)
    const articlesMap = new Map<string, GroupedArticleEvidence>();

    for (const ev of classEvidences) {
      const urlKey = (ev.source_url || '').trim().toLowerCase() || `${ev.source_title}:::${ev.organization}`.toLowerCase();

      let article = articlesMap.get(urlKey);
      if (!article) {
        article = {
          sourceUrl: (ev.source_url || '').trim(),
          sourceTitle: (ev.source_title || 'Tài liệu khuyến nông').trim(),
          organization: (ev.organization || '').trim(),
          publishedDate: ev.published_date || null,
          isApproved: ev.is_approved,
          snippets: [],
        };
        articlesMap.set(urlKey, article);
      }

      // Nếu có ít nhất 1 snippet chưa duyệt thì đánh dấu bài có đoạn chưa duyệt (cho admin chú ý)
      if (!ev.is_approved) {
        article.isApproved = false;
      }

      const snippet: EvidenceSnippet = {
        suggestionId: ev.suggestion_id,
        mentionText: ev.mention_text || '',
        evidenceText: (ev.evidence_text || '').trim(),
        isVerbatim: ev.is_verbatim ?? true,
        unitType: ev.unit_type || 'TREATMENT',
        isApproved: ev.is_approved,
        sentenceHighlight: extractSentenceWithMention(ev.evidence_text, ev.mention_text),
      };

      article.snippets.push(snippet);
    }

    const articles = Array.from(articlesMap.values());

    rows.push({
      modelClass: meta.modelClass,
      diseaseName: meta.diseaseName,
      plantName: meta.plantName,
      status,
      isRecommended: meta.isRecommended,
      articles,
      totalEvidenceCount: classEvidences.length,
    });
  }

  // 4. Sắp xếp: ⚠ (MANUAL_ONLY) lên đầu -> ✅ (SUPPORTED) -> ○ (UNRECOMMENDED_EVIDENCE)
  // Cùng trạng thái thì xếp theo tên cây rồi tên bệnh
  const statusRank: Record<DiseaseRecommendationStatus, number> = {
    MANUAL_ONLY: 1,
    SUPPORTED: 2,
    UNRECOMMENDED_EVIDENCE: 3,
  };

  rows.sort((a, b) => {
    const rankDiff = statusRank[a.status] - statusRank[b.status];
    if (rankDiff !== 0) return rankDiff;

    const plantDiff = a.plantName.localeCompare(b.plantName, 'vi');
    if (plantDiff !== 0) return plantDiff;

    return a.diseaseName.localeCompare(b.diseaseName, 'vi');
  });

  return rows;
}
