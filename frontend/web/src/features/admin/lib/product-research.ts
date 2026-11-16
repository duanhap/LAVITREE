// TASK-17: Tra cứu vật tư bằng AI web (copy prompt → dán JSON), gợi ý Google theo loại, tô đậm tên vật tư trong trích dẫn.
// Không phụ thuộc React để test được bằng script.
import { cleanEvidencePreview } from './guardrails';

export interface ResearchEvidence {
  text: string;
  plantName?: string;
  diseaseName?: string;
  diseaseCode?: string;
  sourceId?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  /** Sau khi gộp: các đoạn trích cùng bài + cùng bệnh (text = đoạn đầu tiên). */
  parts?: string[];
}

export interface ResearchDisease {
  classCode: string;
  plantName: string;
  commonNameVi: string;
}

export type MentionKind = 'CHEMICAL' | 'BIOLOGICAL' | 'SUPPLY' | 'PRACTICE' | string;

// ---------------------------------------------------------------------------
// 1. So khớp không phân biệt hoa thường / dấu tiếng Việt
// ---------------------------------------------------------------------------

/** Bỏ dấu từng ký tự, giữ nguyên độ dài để vị trí khớp trên chuỗi đã bỏ dấu dùng lại được cho chuỗi gốc. */
export const foldVi = (text: string): string =>
  Array.from(text || '')
    .map((c) => {
      if (c === 'đ' || c === 'Đ') return 'd';
      const base = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
      return (base.length === 1 ? base : c).toLowerCase();
    })
    .join('');

export interface TextSegment {
  text: string;
  match: boolean;
}

/** Cắt chuỗi thành các đoạn, đánh dấu những chỗ trùng tên vật tư (mọi lần xuất hiện). */
export const splitByMention = (text: string, mention: string): TextSegment[] => {
  const src = text || '';
  const needle = foldVi((mention || '').trim());
  if (!src || needle.length < 2) return [{ text: src, match: false }];
  // Array.from để chỉ số khớp đúng ký tự Unicode (emoji, ký tự ngoài BMP)
  const chars = Array.from(src);
  // ký tự ngoài BMP (emoji) đổi thành 1 ký tự giữ chỗ để chỉ số code unit == chỉ số ký tự
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
    // Chỉ khớp nguyên từ: "tỏi" không khớp trong "tỏitây"
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

/** Đoạn ngắn quanh lần xuất hiện đầu tiên của tên vật tư (đã dọn Markdown). Không thấy tên → lấy đầu đoạn. */
export const excerptAroundMention = (rawText: string, mention: string, maxLen = 420): string => {
  const text = cleanEvidencePreview(rawText || '');
  if (text.length <= maxLen) return text;
  const segs = splitByMention(text, mention);
  let idx = -1;
  let acc = 0;
  for (const s of segs) {
    if (s.match) {
      idx = acc;
      break;
    }
    acc += Array.from(s.text).length;
  }
  const chars = Array.from(text);
  if (idx === -1) return chars.slice(0, maxLen).join('').trimEnd() + '…';
  let start = Math.max(0, idx - Math.floor(maxLen * 0.4));
  let end = Math.min(chars.length, start + maxLen);
  start = Math.max(0, end - maxLen);
  // bám theo khoảng trắng để không cắt giữa từ
  while (start > 0 && chars[start - 1] !== ' ' && idx - start < maxLen * 0.6) start--;
  while (end < chars.length && chars[end] !== ' ' && end - start < maxLen + 30) end++;
  return (start > 0 ? '…' : '') + chars.slice(start, end).join('').trim() + (end < chars.length ? '…' : '');
};

// ---------------------------------------------------------------------------
// 2. Nhận diện ngữ cảnh: chế phẩm tự pha, giống cây
// ---------------------------------------------------------------------------

// Trên chuỗi đã bỏ dấu. Tránh từ quá ngắn dễ trùng ("nâu" → "nau" trùng "màu nâu").
const HOMEMADE_RE = /\b(pha che|tu pha|ngam (voi|trong|ruou|nuoc)|ngam ruou|u voi|u cung|gia nho|xay nhuyen|nau (voi|lay nuoc)|dun soi|dich chiet|chiet xuat tu|tu lam|loc lay nuoc|nuoc cot)\b/;
const SEED_RE = /\b(giong|hat giong|cay giong)\b/;

export interface MentionContext {
  homemade: boolean;
  seed: boolean;
}

export const detectMentionContext = (mention: string, evidences: ResearchEvidence[]): MentionContext => {
  const m = foldVi(mention);
  const near = evidences.map((e) => foldVi(excerptAroundMention(e.text, mention, 260))).join(' ');
  return {
    homemade: HOMEMADE_RE.test(m) || HOMEMADE_RE.test(near),
    seed: SEED_RE.test(m),
  };
};

export const kindFromMedicineType = (medicineType?: string): MentionKind =>
  medicineType === 'Sinh học' ? 'BIOLOGICAL' : medicineType === 'Vật tư canh tác' ? 'SUPPLY' : 'CHEMICAL';

export const KIND_LABEL: Record<string, string> = {
  CHEMICAL: 'Thuốc BVTV hóa học',
  BIOLOGICAL: 'Chế phẩm sinh học',
  SUPPLY: 'Vật tư canh tác',
  PRACTICE: 'Biện pháp canh tác',
};

// ---------------------------------------------------------------------------
// 3. Gợi ý tìm Google theo loại vật tư
// ---------------------------------------------------------------------------

export interface GoogleQuery {
  label: string;
  query: string;
  url: string;
}

const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

export const buildGoogleQueries = (opts: {
  name: string;
  activeIngredient?: string;
  kind: MentionKind;
  evidences?: ResearchEvidence[];
  plantNames?: string[];
}): GoogleQuery[] => {
  const name = (opts.name || '').trim();
  if (!name) return [];
  const evidences = opts.evidences || [];
  const ctx = detectMentionContext(name, evidences);
  const plant = uniq((opts.plantNames || evidences.map((e) => e.plantName || '')).filter(Boolean))[0] || '';
  const ai = (opts.activeIngredient || '').trim();
  const out: { label: string; query: string }[] = [];

  if (ctx.homemade) {
    out.push({ label: 'Cách pha chế', query: `cách pha chế ${name} trừ sâu bệnh ${plant}`.trim() });
  }
  if (ctx.seed) {
    out.push({ label: 'Thông tin giống', query: `giống ${name.replace(/^(hạt )?giống\s+/i, '')} đặc điểm năng suất` });
  } else if (opts.kind === 'CHEMICAL') {
    out.push({ label: 'Nhãn thuốc & PHI', query: `"${name}" nhãn thuốc thời gian cách ly` });
    out.push({ label: 'Liều dùng', query: `${ai && foldVi(ai) !== foldVi(name) ? `"${name}" ${ai}` : `"${name}"`} thuốc BVTV liều dùng` });
  } else if (opts.kind === 'BIOLOGICAL') {
    if (!ctx.homemade) out.push({ label: 'Chế phẩm sinh học', query: `"${name}" chế phẩm sinh học cách dùng` });
  } else if (opts.kind === 'PRACTICE') {
    out.push({ label: 'Kỹ thuật', query: `${name} kỹ thuật canh tác ${plant}`.trim() });
  } else {
    out.push({ label: 'Cách dùng', query: `${name} nông nghiệp cách dùng` });
  }
  if (plant) out.push({ label: `Theo cây ${plant}`, query: `${name} ${plant} phòng trừ bệnh` });

  const seen = new Set<string>();
  return out
    .filter((q) => (seen.has(q.query) ? false : (seen.add(q.query), true)))
    .slice(0, 3)
    .map((q) => ({ ...q, url: `https://www.google.com/search?q=${encodeURIComponent(q.query)}` }));
};

// ---------------------------------------------------------------------------
// 4. Gộp đoạn trích cùng bài + cùng bệnh
// ---------------------------------------------------------------------------

/** Nhiều đoạn trích nằm trong cùng 1 bài và cùng 1 bệnh → 1 khối (parts). Bỏ đoạn trùng nội dung, giữ thứ tự. */
export const mergeEvidencesByArticle = (evidences: ResearchEvidence[]): ResearchEvidence[] => {
  const groups = new Map<string, ResearchEvidence>();
  const seenText = new Set<string>();
  for (const e of evidences) {
    if (!e.text || !e.text.trim()) continue;
    const textKey = foldVi(cleanEvidencePreview(e.text)).slice(0, 200);
    if (seenText.has(textKey)) continue;
    seenText.add(textKey);
    // Mỗi đoạn trích là 1 KnowledgeSource riêng → "cùng bài" so theo link / tiêu đề bài, sourceId chỉ là dự phòng
    const article = (e.sourceUrl || '').trim() || (e.sourceTitle || '').trim() || e.sourceId || `__${seenText.size}`;
    const disease = e.diseaseCode || foldVi(`${e.plantName || ''}|${e.diseaseName || ''}`);
    const key = `${article}##${disease}`;
    const g = groups.get(key);
    if (g) g.parts!.push(e.text);
    else groups.set(key, { ...e, parts: [e.text] });
  }
  return Array.from(groups.values());
};

const markMention = (text: string, mention: string, maxLen: number) =>
  splitByMention(excerptAroundMention(text, mention, maxLen), mention)
    .map((s) => (s.match ? `**${s.text}**` : s.text))
    .join('');

/** Khối "[Bài n] (cây – bệnh, k đoạn cùng bài) / Nguồn / các đoạn" dùng chung cho 2 prompt. */
const buildEvidenceBlock = (evidences: ResearchEvidence[], mention: string, emptyText: string): string =>
  evidences.length
    ? evidences
        .map((e, i) => {
          const parts = e.parts && e.parts.length ? e.parts : [e.text];
          const per = parts.length > 1 ? Math.max(260, Math.floor(700 / parts.length)) : 520;
          const body = parts.map((t) => `"${markMention(t, mention, per)}"`).join('\n…\n');
          const src = [e.sourceTitle, e.sourceUrl].filter(Boolean).join(' — ');
          const info = [
            [e.plantName, e.diseaseName].filter(Boolean).join(' – '),
            parts.length > 1 ? `${parts.length} đoạn cùng bài` : '',
          ]
            .filter(Boolean)
            .join(', ');
          return `[Bài ${i + 1}]${info ? ` (${info})` : ''}${src ? `\nNguồn: ${src}` : ''}\n${body}`;
        })
        .join('\n\n')
    : emptyText;

// ---------------------------------------------------------------------------
// 5. Prompt điền form (JSON) – nút "Sao chép Prompt" trong chế độ Dev
// ---------------------------------------------------------------------------

/** Số khối (bài + bệnh) tối đa đưa vào prompt. */
export const MAX_PROMPT_EVIDENCES = 4;

export const buildProductResearchPrompt = (opts: {
  mention: string;
  kind: MentionKind;
  evidences: ResearchEvidence[];
  diseases: ResearchDisease[];
  currentName?: string;
  activeIngredient?: string;
  sourceUrl?: string;
}): string => {
  const mention = (opts.mention || opts.currentName || '').trim();
  const kindLabel = KIND_LABEL[opts.kind] ? `${KIND_LABEL[opts.kind]} (${opts.kind})` : opts.kind;

  // gộp đoạn cùng bài + cùng bệnh, bỏ đoạn trùng, tối đa 4 khối
  const evidences = mergeEvidencesByArticle(opts.evidences).slice(0, MAX_PROMPT_EVIDENCES);

  const contexts = uniq(
    evidences.map((e) => [e.plantName, e.diseaseName].filter(Boolean).join(' – ')).filter(Boolean)
  );

  const evidenceBlock = buildEvidenceBlock(
    evidences,
    mention,
    '(Không có đoạn trích – Admin nhập thủ công. Hãy dựa vào tên, hoạt chất và link nếu có.)'
  );

  const diseaseList = opts.diseases
    .filter((d) => !/healthy/i.test(d.classCode))
    .map((d) => `- ${d.classCode} — ${d.plantName} – ${d.commonNameVi}`)
    .join('\n');

  const known = [
    `- Tên nhắc trong bài: "${mention}"`,
    `- Loại do AI gán khi đọc bài: ${kindLabel} (có thể sai, hãy tự kiểm tra)`,
    contexts.length ? `- Cây / bệnh trong các đoạn trích: ${contexts.join('; ')}` : '',
    opts.currentName && opts.currentName.trim() !== mention ? `- Tên Admin đang nhập: ${opts.currentName.trim()}` : '',
    opts.activeIngredient ? `- Hoạt chất Admin đang nhập: ${opts.activeIngredient}` : '',
    opts.sourceUrl ? `- Link Admin đã có (hãy mở và đọc): ${opts.sourceUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `Bạn là chuyên gia vật tư nông nghiệp và thuốc bảo vệ thực vật tại Việt Nam, giúp Admin dự án LAVITREE nhập danh mục vật tư cho trợ lý tư vấn nông dân.

## 1. Vật tư cần tra cứu
${known}

## 2. Các đoạn trích từ bài báo (tên vật tư được đánh dấu **...**)
${evidenceBlock}

## 3. Nhiệm vụ
1. Đọc kỹ các đoạn trích, xác định CHÍNH XÁC "${mention}" là gì trong ngữ cảnh:
   - PRODUCT: sản phẩm thương mại có nhãn (thuốc BVTV, chế phẩm sinh học đóng gói).
   - HOMEMADE: chế phẩm tự pha chế (ví dụ dịch tỏi – ớt – gừng ngâm rượu). KHÔNG bịa tên sản phẩm thương mại; ghi nguyên liệu, cách pha vào description và dosage_instruction.
   - SEED: giống cây trồng / hạt giống.
   - SUPPLY: vật tư, dụng cụ, phân bón, vôi, bẫy, lưới, bạt.
   - PRACTICE: biện pháp canh tác, không phải vật tư.
   Nếu các đoạn trích nói về những thứ KHÁC NHAU, đặt "mentions_differ": true, giải thích trong "differ_note" và điền thông tin theo nghĩa xuất hiện nhiều nhất.
2. Tìm trên web 1–3 nguồn đáng tin (nhãn thuốc, trang nhà sản xuất / nhà phân phối, Cục Bảo vệ thực vật, trung tâm khuyến nông, viện / trường) và đọc để điền thông tin. Chỉ đưa link bạn đã thực sự mở được, KHÔNG bịa link.
3. Chỉ trả về DUY NHẤT một khối \`\`\`json theo mẫu ở mục 4, không kèm lời dẫn.

## 4. Mẫu JSON
\`\`\`json
{
  "identified_as": "PRODUCT | HOMEMADE | SEED | SUPPLY | PRACTICE",
  "identification_note": "1–2 câu giải thích, dựa vào đoạn trích",
  "mentions_differ": false,
  "differ_note": "",
  "name": "Tên chuẩn, ngắn gọn",
  "medicine_type": "Hóa học | Sinh học | Vật tư canh tác",
  "active_ingredient": "Hoạt chất / chủng vi sinh / nguyên liệu chính, rỗng nếu là dụng cụ",
  "description": "• Bản chất & Phân loại: ...\\n• Công dụng nông nghiệp: ...\\n• Phạm vi & Cây trồng: ...\\n• Hướng dẫn & Lưu ý khi dùng: ...",
  "dosage_instruction": "Liều lượng / cách pha / cách dùng thực tế",
  "phi_days": null,
  "image_url": "",
  "source_urls": ["https://..."],
  "target_diseases": ["MÃ_BỆNH"]
}
\`\`\`

## 5. Quy tắc
- medicine_type: thuốc BVTV tổng hợp → "Hóa học"; vi sinh, thảo mộc, chế phẩm tự pha → "Sinh học"; giống, phân bón, vôi, bẫy, lưới, dụng cụ → "Vật tư canh tác".
- phi_days (số ngày cách ly trước thu hoạch): CHỈ điền khi nguồn ghi rõ con số; không có hoặc là vật tư canh tác → null. TUYỆT ĐỐI không tự đoán.
- target_diseases: CHỈ chọn mã trong danh sách ở mục 6, dựa trên công dụng thực tế của vật tư và các đoạn trích. Có thể chọn nhiều mã. Không có bệnh phù hợp hoặc vật tư dùng chung (vôi, phân bón, bạt…) → [].
- description: mỗi mục một dòng, bắt đầu bằng "• ", không viết thành một đoạn văn dài; 150–300 từ.
- image_url: link ảnh trực tiếp (.jpg / .png / .webp) của đúng sản phẩm, không có thì để "".

## 6. Danh sách mã bệnh hợp lệ (mã — cây – tên bệnh)
${diseaseList}`;
};

// ---------------------------------------------------------------------------
// 6. Prompt "Tìm link với AI": chỉ nhờ AI tìm bài viết / trang nguồn, không điền form
// ---------------------------------------------------------------------------

export const buildLinkSearchPrompt = (opts: {
  mention: string;
  kind: MentionKind;
  evidences: ResearchEvidence[];
  currentName?: string;
  activeIngredient?: string;
}): string => {
  const mention = (opts.mention || opts.currentName || '').trim();
  const evidences = mergeEvidencesByArticle(opts.evidences).slice(0, MAX_PROMPT_EVIDENCES);
  const ctx = detectMentionContext(mention, opts.evidences);
  const kindLabel = KIND_LABEL[opts.kind] || opts.kind;
  const contexts = uniq(
    evidences.map((e) => [e.plantName, e.diseaseName].filter(Boolean).join(' – ')).filter(Boolean)
  );
  const want = ctx.homemade
    ? 'bài hướng dẫn cách pha chế / cách dùng (trung tâm khuyến nông, báo nông nghiệp, viện / trường)'
    : ctx.seed
      ? 'trang giới thiệu giống (công ty giống, viện / trung tâm giống) và bài kỹ thuật trồng'
      : opts.kind === 'CHEMICAL'
        ? 'nhãn thuốc / trang sản phẩm của nhà sản xuất hoặc nhà phân phối, bài hướng dẫn sử dụng'
        : opts.kind === 'BIOLOGICAL'
          ? 'trang sản phẩm của nhà sản xuất, bài hướng dẫn sử dụng chế phẩm'
          : opts.kind === 'PRACTICE'
            ? 'bài kỹ thuật canh tác (khuyến nông, viện / trường, báo nông nghiệp)'
            : 'trang sản phẩm / cửa hàng vật tư nông nghiệp, bài hướng dẫn sử dụng';

  const known = [
    `- Tên nhắc trong bài: "${mention}"`,
    opts.currentName && opts.currentName.trim() !== mention ? `- Tên Admin đang nhập: ${opts.currentName.trim()}` : '',
    opts.activeIngredient ? `- Hoạt chất: ${opts.activeIngredient}` : '',
    `- Loại (AI gán khi đọc bài, có thể sai): ${kindLabel}`,
    contexts.length ? `- Cây / bệnh trong bài: ${contexts.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `Tôi đang tìm nguồn thông tin về một vật tư nông nghiệp ở Việt Nam. Hãy tìm trên web giúp tôi link các bài viết / trang nguồn.

## Vật tư
${known}

## Đoạn trích bài báo nhắc tới vật tư này (tên được đánh dấu **...**)
${buildEvidenceBlock(evidences, mention, '(Không có đoạn trích.)')}

## Yêu cầu
- Dựa vào đoạn trích để hiểu đúng "${mention}" là gì (sản phẩm bán sẵn, chế phẩm tự pha, giống, vật tư hay biện pháp) rồi mới tìm.
- Ưu tiên: ${want}.
- Trả về 3–5 link, mỗi link một dòng theo mẫu:
  1. <URL> — <loại trang> — <1 câu: trang có thông tin gì (liều dùng, thời gian cách ly, cách pha, ảnh sản phẩm…)>
- Chỉ đưa link bạn đã thực sự mở được và đúng vật tư này. KHÔNG bịa link. Không tìm được thì nói rõ là không tìm thấy.
- Nếu "${mention}" không phải sản phẩm bán sẵn (ví dụ tự pha chế), nói rõ ở dòng đầu.`;
};

// ---------------------------------------------------------------------------
// 7. Đọc JSON AI trả về + khớp bệnh hại
// ---------------------------------------------------------------------------

export interface ParsedResearch {
  data: Record<string, unknown>;
  matchedDiseases: string[];
  unmatchedDiseases: string[];
  hasDiseaseField: boolean;
  sourceUrls: string[];
}

export const extractJsonObject = (raw: string): Record<string, unknown> | null => {
  if (!raw || !raw.trim()) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let body = fenced ? fenced[1] : raw;
  const obj = body.match(/\{[\s\S]*\}/);
  if (obj) body = obj[0];
  const attempts = [body, body.replace(/,\s*([}\]])/g, '$1')];
  for (const a of attempts) {
    try {
      const parsed = JSON.parse(a);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      /* thử cách tiếp theo */
    }
  }
  return null;
};

const diseaseNames = (d: ResearchDisease): string[] => {
  const en = (d.classCode.split('___')[1] || '').replace(/_/g, ' ');
  const paren = (d.commonNameVi.match(/\(([^)]+)\)/) || [])[1] || '';
  const viNoParen = d.commonNameVi.replace(/\([^)]*\)/g, '').trim();
  return uniq([d.classCode, en, d.commonNameVi, viNoParen, paren].map((s) => foldVi(s).trim()).filter((s) => s.length >= 4));
};

const diseasePlants = (d: ResearchDisease): string[] =>
  uniq([d.plantName, (d.classCode.split('___')[0] || '').replace(/_/g, ' ')].map((s) => foldVi(s).replace(/[(),]/g, ' ').trim()).filter(Boolean));

/** Khớp 1 chuỗi bệnh (mã, tên Việt, tên Anh) với danh sách bệnh. Trả [] nếu không khớp hoặc mơ hồ. */
export const matchDisease = (input: string, diseases: ResearchDisease[], contextPlants: string[] = []): string[] => {
  const n = foldVi(String(input || '')).trim();
  if (!n || n === 'none' || n.includes('khong chi dinh')) return [];
  const pool = diseases.filter((d) => !/healthy/i.test(d.classCode));
  const exact = pool.find((d) => foldVi(d.classCode) === n);
  if (exact) return [exact.classCode];
  let hits = pool.filter((d) => diseaseNames(d).some((nm) => n === nm || n.includes(nm) || (n.length >= 6 && nm.includes(n))));
  if (hits.length > 1) {
    const byInputPlant = hits.filter((d) => diseasePlants(d).some((p) => p && n.includes(p)));
    if (byInputPlant.length) hits = byInputPlant;
    else {
      const ctx = contextPlants.map((p) => foldVi(p));
      const byCtx = hits.filter((d) => diseasePlants(d).some((p) => ctx.includes(p)));
      if (byCtx.length) hits = byCtx;
    }
  }
  return hits.length > 0 && hits.length <= 3 ? hits.map((d) => d.classCode) : [];
};

export const parseProductResearchJson = (
  raw: string,
  diseases: ResearchDisease[],
  contextPlants: string[] = []
): ParsedResearch | null => {
  const data = extractJsonObject(raw);
  if (!data) return null;
  const rawDiseases: string[] = [];
  const hasDiseaseField = data.target_diseases !== undefined || data.target_disease_code !== undefined;
  for (const key of ['target_diseases', 'target_disease_code']) {
    const v = data[key];
    if (Array.isArray(v)) rawDiseases.push(...v.map((x) => String(x)));
    else if (typeof v === 'string') rawDiseases.push(...v.split(/[,;]/));
  }
  const matched: string[] = [];
  const unmatched: string[] = [];
  for (const r of rawDiseases.map((x) => x.trim()).filter(Boolean)) {
    const f = foldVi(r);
    if (f === 'none' || f.includes('khong chi dinh')) continue;
    const m = matchDisease(r, diseases, contextPlants);
    if (m.length) matched.push(...m);
    else unmatched.push(r);
  }
  const urls = (Array.isArray(data.source_urls) ? data.source_urls : typeof data.source_urls === 'string' ? [data.source_urls] : [])
    .map((u) => String(u).trim())
    .filter((u) => /^https?:\/\/\S+$/i.test(u));
  return { data, matchedDiseases: uniq(matched), unmatchedDiseases: uniq(unmatched), hasDiseaseField, sourceUrls: uniq(urls) };
};
