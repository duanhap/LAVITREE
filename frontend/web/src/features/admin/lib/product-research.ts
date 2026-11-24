// TASK-17/18: Tra cứu vật tư bằng Gemini bản web (copy prompt → dán JSON + danh sách nguồn), gợi ý Google theo loại, tô đậm tên vật tư trong trích dẫn.
// Không phụ thuộc React để test được bằng script.
import { cleanEvidencePreview } from './guardrails';
import { normalizeUsageProfile, type UsageProfile } from './usage-profile';

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

/** Chuẩn hóa để so 2 đoạn có trùng / chứa nhau không (bỏ Markdown, dấu, khoảng trắng thừa). */
const comparableText = (text: string) => foldVi(cleanEvidencePreview(text || '')).replace(/\s+/g, ' ').trim();

/**
 * Chỉ số các đoạn cần giữ: bỏ đoạn trùng hoặc nằm TRỌN trong một đoạn khác (giữ đoạn dài hơn).
 * Ví dụ đoạn 2 "Nên làm gì sau khi nhổ bỏ cây bệnh? …" nằm trong đoạn 1 → chỉ giữ đoạn 1. Giữ thứ tự ban đầu.
 */
export const dedupeContainedTexts = (texts: string[]): number[] => {
  const norm = texts.map(comparableText);
  const order = norm.map((_, i) => i).sort((a, b) => norm[b].length - norm[a].length || a - b);
  const kept: number[] = [];
  for (const i of order) {
    if (!norm[i]) continue;
    if (kept.some((k) => norm[k].includes(norm[i]))) continue;
    kept.push(i);
  }
  return kept.sort((a, b) => a - b);
};

/** Nhiều đoạn trích nằm trong cùng 1 bài và cùng 1 bệnh → 1 khối (parts). Bỏ đoạn trùng / nằm trong đoạn khác, giữ thứ tự. */
export const mergeEvidencesByArticle = (evidences: ResearchEvidence[]): ResearchEvidence[] => {
  const groups = new Map<string, ResearchEvidence>();
  let anon = 0;
  for (const e of evidences) {
    if (!e.text || !e.text.trim()) continue;
    // Mỗi đoạn trích là 1 KnowledgeSource riêng → "cùng bài" so theo link / tiêu đề bài, sourceId chỉ là dự phòng
    const article = (e.sourceUrl || '').trim() || (e.sourceTitle || '').trim() || e.sourceId || `__${anon++}`;
    const disease = e.diseaseCode || foldVi(`${e.plantName || ''}|${e.diseaseName || ''}`);
    const key = `${article}##${disease}`;
    const g = groups.get(key);
    if (g) g.parts!.push(e.text);
    else groups.set(key, { ...e, parts: [e.text] });
  }
  // bỏ đoạn trùng / nằm trọn trong đoạn khác, trong từng khối và giữa các khối
  const blocks = Array.from(groups.values()).map((g) => {
    const parts = dedupeContainedTexts(g.parts!).map((i) => g.parts![i]);
    return { ...g, text: parts[0], parts };
  });
  const firstNorm = blocks.map((b) => b.parts.map(comparableText));
  return blocks.filter((b, bi) =>
    !b.parts.every((_, pi) => {
      const t = firstNorm[bi][pi];
      return firstNorm.some((other, oi) => oi < bi && other.some((o) => o.includes(t)));
    })
  );
};

const markMention = (text: string, mention: string, maxLen: number) =>
  splitByMention(excerptAroundMention(text, mention, maxLen), mention)
    .map((s) => (s.match ? `**${s.text}**` : s.text))
    .join('');

/** Khối "[Bài n] (cây – bệnh, k đoạn cùng bài) / Nguồn / các đoạn". */
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

/**
 * Vài câu trong đoạn trích có nhắc tên vật tư (đã bỏ Markdown, bỏ trùng), dùng để Gemini tìm ĐÚNG loại
 * như bài mô tả (ví dụ "phân bò hoai mục ủ với nấm đối kháng"), không tìm loại rộng hơn ("phân hữu cơ" nói chung).
 */
export const keyMentionSentences = (evidences: ResearchEvidence[], mention: string, max = 3): string[] => {
  const needle = foldVi(mention).trim();
  if (needle.length < 2) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const e of evidences) {
    const parts = e.parts && e.parts.length ? e.parts : [e.text];
    for (const t of parts) {
      const sentences = cleanEvidencePreview(t || '')
        .split(/(?<=[.!?;:])\s+|\n+/)
        .map((x) => x.trim())
        .filter(Boolean);
      for (const sen of sentences) {
        const key = foldVi(sen).replace(/\s+/g, ' ');
        if (!key.includes(needle) || seen.has(key)) continue;
        seen.add(key);
        out.push(sen.length > 280 ? excerptAroundMention(sen, mention, 280) : sen);
        if (out.length >= max) return out;
      }
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// 5. Prompt Gemini (nút duy nhất "Sao chép prompt cho Gemini" trong chế độ Dev) – TASK-18
// ---------------------------------------------------------------------------

/** Số khối (bài + bệnh) tối đa đưa vào prompt. */
export const MAX_PROMPT_EVIDENCES = 4;

/** Nguồn nên ưu tiên tìm theo loại vật tư / ngữ cảnh. */
const preferredSources = (kind: MentionKind, ctx: MentionContext): string =>
  ctx.homemade
    ? 'bài hướng dẫn cách pha chế, cách dùng của trung tâm khuyến nông, báo nông nghiệp, viện / trường'
    : ctx.seed
      ? 'trang giới thiệu giống của công ty giống, viện / trung tâm giống, bài kỹ thuật trồng'
      : kind === 'CHEMICAL'
        ? 'nhãn thuốc đã đăng ký, Danh mục thuốc BVTV được phép sử dụng tại Việt Nam, trang sản phẩm của nhà sản xuất / nhà phân phối, bài hướng dẫn của khuyến nông'
        : kind === 'BIOLOGICAL'
          ? 'nhãn / trang sản phẩm của nhà sản xuất chế phẩm, Danh mục thuốc BVTV (nhóm sinh học), bài hướng dẫn của khuyến nông, viện / trường'
          : kind === 'PRACTICE'
            ? 'bài kỹ thuật canh tác của khuyến nông, viện / trường, báo nông nghiệp'
            : 'trang sản phẩm của nhà sản xuất / cửa hàng vật tư nông nghiệp, bài hướng dẫn sử dụng của khuyến nông';

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
  const ctx = detectMentionContext(mention, opts.evidences);

  // gộp đoạn cùng bài + cùng bệnh, bỏ đoạn trùng / nằm trong đoạn khác, tối đa 4 khối
  const evidences = mergeEvidencesByArticle(opts.evidences).slice(0, MAX_PROMPT_EVIDENCES);
  const contexts = uniq(evidences.map((e) => [e.plantName, e.diseaseName].filter(Boolean).join(' – ')).filter(Boolean));
  const plants = uniq(evidences.map((e) => e.plantName || '').filter(Boolean));

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
    opts.sourceUrl ? `- Link Admin đã có (hãy mở và đọc trước): ${opts.sourceUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const cropText = plants.length ? plants.join(', ') : 'các loại cây trồng phù hợp tại Việt Nam';
  // TASK-29: tạo từ gợi ý thì usage là liều chung của CÂY trong đoạn trích (lưu thành liều cây); không có đoạn trích thì liều chung của sản phẩm
  const usageRule = plants.length
    ? [
        `- usage là LIỀU DÙNG TRÊN CÂY ${plants[0]}${
          plants.length > 1
            ? ` (cây chính trong đoạn trích). Đoạn trích còn nhắc ${plants.slice(1).join(', ')}: KHÔNG gộp liều các cây; ghi liều của các cây đó (kèm nguồn) vào scope_note`
            : ''
        }. Nếu nguồn chỉ có liều chung không theo cây thì dùng liều đó và ghi rõ trong scope_note.`,
        `- usage áp dụng cho MỌI bệnh của cây ${plants[0]}: dose_text / method KHÔNG nêu tên một bệnh cụ thể (không viết "Với bệnh ...").`,
      ].join('\n')
    : `- usage áp dụng chung cho ${cropText}. Nếu nhãn ghi liều khác nhau theo cây, lấy mức phổ biến và ghi các liều khác trong phần lưu ý.`;
  const keySentences = keyMentionSentences(evidences, mention);
  const scopeBlock = keySentences.length
    ? `\n## 1b. Đoạn trích tham khảo về vật tư này\n${keySentences
        .map((x) => `- "${x}"`)
        .join('\n')}\n`
    : '';

  // Bước tìm Google đặt ĐẦU prompt, kèm sẵn truy vấn (TASK-18-R6)
  const searchName = (opts.currentName || mention).replace(/\s*\([^)]*\)/g, '').trim() || mention;
  const cropQ = plants[0] ? ` ${plants[0].toLowerCase()}` : '';
  const doseHint = opts.kind === 'CHEMICAL' || opts.kind === 'BIOLOGICAL' ? 'liều lượng pha bình 16 lít' : 'liều lượng bón';
  const searchBlock = [
    `Tìm trên Google: ${searchName}${cropQ} ${doseHint} và cách sử dụng tại Việt Nam. Đọc 2–5 trang Việt Nam (khuyến nông, nhà sản xuất, cửa hàng vật tư)${opts.sourceUrl ? ` và trang ${opts.sourceUrl}` : ''}, ghi lại link và câu nguyên văn có con số. Gợi ý truy vấn thêm: "${searchName} cách sử dụng", "${searchName} khuyến nông".`,
    ``,
    `Sau khi đã tìm, trình bày kết quả theo yêu cầu dưới đây. Mọi con số phải lấy từ các trang đã tìm, kèm link và đoạn trích nguyên văn (mục 4.2).`,
  ].join('\n');

  return `${searchBlock}

## Vai trò
Bạn là kỹ sư bảo vệ thực vật, chuyên về vật tư nông nghiệp và thuốc BVTV đang lưu hành TẠI VIỆT NAM. Bạn giúp Admin dự án LAVITREE nhập danh mục thuốc/vật tư chung cho toàn bộ kho để trợ lý Lavi tư vấn cho nông dân Việt Nam.

LƯU Ý CỐT LÕI: Đây là sản phẩm/vật tư chung của kho (dùng cho nhiều loại cây trồng và bệnh hại khác nhau). Thông tin tổng quan và mô tả kỹ thuật phải mang tính bao quát toàn diện, KHÔNG bó hẹp hay viết phủ định chỉ xoay quanh duy nhất 1 bệnh hay 1 cây trồng đơn lẻ.

## 1. Vật tư cần tra cứu
${known}
${scopeBlock}
## 2. Đoạn trích từ bài báo (nếu có, để tham khảo ngữ cảnh)
${evidenceBlock}

## 3. Nhiệm vụ
1. Đọc kỹ đoạn trích (nếu có), xác định CHÍNH XÁC "${mention}" là gì trong ngữ cảnh:
   - PRODUCT: sản phẩm thương mại có nhãn (thuốc BVTV, chế phẩm sinh học đóng gói).
   - HOMEMADE: chế phẩm tự pha chế (ví dụ dịch tỏi – ớt – gừng ngâm rượu). KHÔNG bịa tên sản phẩm thương mại; ghi nguyên liệu, tỷ lệ, cách pha theo bài.
   - SEED: giống cây trồng / hạt giống.
   - SUPPLY: vật tư, dụng cụ, phân bón, vôi, bẫy, lưới, bạt.
   - PRACTICE: biện pháp canh tác, không phải vật tư.
   Nếu các đoạn trích nói về những thứ KHÁC NHAU, đặt "mentions_differ": true, giải thích trong "differ_note" và điền theo nghĩa xuất hiện nhiều nhất.
2. Tổng hợp từ 2–5 nguồn TẠI VIỆT NAM đã tìm ở dòng đầu (bài báo ở mục 2 không tính là nguồn số liệu nếu nó không ghi con số), ưu tiên: ${preferredSources(opts.kind, ctx)}.
   Thông tin và mô tả kỹ thuật phải mang tính TỔNG QUAN VỀ SẢN PHẨM/VẬT TƯ: bao quát công dụng nông nghiệp, đặc tính, các nhóm cây trồng áp dụng phổ biến tại Việt Nam${plants.length ? ` (bao gồm cả ${plants.join(', ')})` : ''}.
3. Tổng hợp ĐẦY ĐỦ cách dùng thực tế trên cây ${plants[0] || 'trồng phổ biến nhất trong nguồn'}: liều lượng và lượng nước pha, lượng phun/bón trên ha, cách dùng (phun / tưới gốc / rắc / ngâm hạt…), buổi dùng, khoảng cách ngày, thời gian cách ly trước thu hoạch, bảo hộ an toàn.
4. Trả lời theo ĐÚNG thứ tự ở mục 4: khối \`\`\`json trước, sau đó danh sách nguồn và ảnh. Không viết lời dẫn trước khối JSON.

## 4. Định dạng trả lời

### 4.1. Khối JSON (đặt đầu tiên)
\`\`\`json
{
  "identified_as": "PRODUCT | HOMEMADE | SEED | SUPPLY | PRACTICE",
  "identification_note": "1–2 câu giải thích, dựa vào đoạn trích hoặc bản chất sản phẩm",
  "scope_note": "",
  "mentions_differ": false,
  "differ_note": "",
  "name": "Tên cụ thể nhất đúng loại sản phẩm (tên thương mại nếu là PRODUCT), không dùng tên nhóm chung",
  "medicine_type": "Hóa học | Sinh học | Vật tư canh tác",
  "active_ingredient": "Hoạt chất + hàm lượng / chủng vi sinh + mật độ / nguyên liệu chính; rỗng nếu là dụng cụ",
  "description": "• Bản chất & Phân loại: ...\\n• Cơ chế tác động & Đặc tính: ...\\n• Công dụng nông nghiệp: ...\\n• Phạm vi & Cây trồng: ...\\n• Hướng dẫn & Lưu ý khi dùng: ...",
  "usage": {
    "dose_amount": 50,
    "dose_unit": "g",
    "water_liters": 16,
    "dose_text": "50 g / bình 16 lít",
    "dose_per_area": null,
    "spray_volume_per_ha": { "min": 400, "max": 600 },
    "method": "phun ướt đều 2 mặt lá",
    "time_of_day": ["sáng sớm", "chiều mát"],
    "times_per_day": 1,
    "interval_days": { "min": 7, "max": 10 },
    "max_applications_per_season": 3,
    "start_when": "khi bệnh chớm xuất hiện",
    "stop_when": "",
    "weather_note": "không phun khi trời sắp mưa hoặc nắng gắt",
    "avoid_rain_hours": 6,
    "safety_note": "mang găng tay, khẩu trang; không ăn uống khi phun"
  },
  "phi_days": 7,
  "target_diseases": ["MÃ_BỆNH"],
  "source_urls": ["https://..."],
  "image_candidates": ["https://...jpg"]
}
\`\`\`
(Các con số trong mẫu chỉ để minh họa định dạng của thuốc phun, KHÔNG được chép lại. Với phân bón, vôi, chế phẩm rắc / bón: để dose_amount / water_liters / spray_volume_per_ha là null và dùng "dose_per_area": { "min": 20, "max": 30, "unit": "tấn/ha" }.)

### 4.2. Sau khối JSON: danh sách nguồn và ảnh
## Nguồn đã dùng
1. <URL> — <loại trang: nhãn thuốc / nhà sản xuất / khuyến nông / báo…> — <năm đăng nếu có> — "<đoạn COPY NGUYÊN VĂN 5–20 chữ trên trang, có chứa con số bạn đã dùng>"
(Mỗi con số trong usage và phi_days phải có ít nhất 1 đoạn trích. Đoạn trích phải COPY y hệt chữ trên trang: không viết lại, không gộp 2 câu, không thêm "Lượng bón:", không đổi đơn vị. Chỉ trích đoạn ngắn quanh con số, giữ nguyên cả lỗi chính tả / khoảng trắng của trang. Link để trần, KHÔNG đặt link trong ngoặc kép; ngoặc kép chỉ dành cho đoạn chữ trích từ trang. Mỗi đoạn trích 1 dòng riêng; một link có nhiều đoạn thì lặp lại link ở dòng mới. Không trích được thì để con số đó null. Hệ thống sẽ tự tải trang để so khớp từng đoạn trích.)
## Ảnh sản phẩm
1. <link ảnh trực tiếp .jpg / .png / .webp> — lấy từ <URL trang>

## 5. Quy tắc
- KHÔNG ĐOÁN SỐ: con số nào (liều, lượng nước, số lần, khoảng cách ngày, PHI, số giờ tránh mưa) không có nguồn ghi rõ thì để null. Chỉ có mô tả bằng chữ thì ghi vào dose_text / method / weather_note.
${usageRule}
- Khoảng giá trị (ví dụ "7–10 ngày") ghi {"min": 7, "max": 10}; một giá trị thì min = max.
- Liều: thuốc pha nước dùng dose_amount + dose_unit + water_liters (liều cho 1 bình); phân, vôi, chế phẩm rắc / bón theo diện tích dùng dose_per_area {min, max, unit} với unit như "tấn/ha", "kg/ha", "kg/1000 m²", "kg/sào". Có con số theo diện tích thì PHẢI ghi vào dose_per_area, không chỉ để trong dose_text.
- time_of_day và times_per_day: CHỈ điền khi nguồn ghi rõ (ví dụ "phun lúc chiều mát", "ngày 2 lần"). Bón lót, bón thúc, rắc, xử lý đất theo đợt → times_per_day: null; không tự thêm "sáng sớm / chiều mát" nếu nguồn không nói.
- medicine_type: thuốc BVTV tổng hợp → "Hóa học"; vi sinh, thảo mộc, chế phẩm tự pha → "Sinh học"; giống, phân bón, vôi, bẫy, lưới, dụng cụ → "Vật tư canh tác".
- phi_days (ngày cách ly trước thu hoạch): CHỈ điền khi nguồn ghi rõ; không có hoặc là vật tư canh tác → null.
- target_diseases: CHỈ chọn mã trong danh sách ở mục 6, theo công dụng thực tế của sản phẩm. Có thể chọn nhiều mã. Với vật tư cải tạo đất chung (như vôi bột, phân bón lót không đặc hiệu cho bệnh nào) → để [].
- description: ĐÂY LÀ MÔ TẢ TỔNG QUAN SẢN PHẨM/VẬT TƯ CHO TOÀN BỘ KHO.
  Mỗi mục một dòng bắt đầu bằng "• ", viết cụ thể, dễ hiểu với nông dân, 200–350 từ.
  QUY TẮC BẮT BUỘC: TUYỆT ĐỐI KHÔNG bó hẹp mô tả chỉ xoay quanh duy nhất một bệnh hại hay một cây trồng đơn lẻ (ví dụ: KHÔNG viết câu phủ định kiểu "vôi bột không có hoạt chất đăng ký trị bệnh đốm vòng trên cà chua" hay chỉ nhắc đến duy nhất cà chua nếu sản phẩm là Vôi bột dùng chung cho nông nghiệp). Liều lượng theo từng cây trồng (và ngoại lệ cho bệnh đặc thù) được cấu hình ở phần Bệnh điều trị & Liều lượng của sản phẩm; liều trên cây chính ghi ở usage.
  Cấu trúc các mục chuẩn:
  • Bản chất & Phân loại: Thành phần chính, dạng chế phẩm, nguồn gốc.
  • Cơ chế tác động & Đặc tính: Cơ chế cải thiện đất/phòng trừ, đặc tính lý hóa hoặc sinh học.
  • Công dụng nông nghiệp: Tác dụng cải tạo, cân bằng dinh dưỡng, hỗ trợ cây trồng khỏe mạnh hoặc phòng ngừa sâu bệnh chung.
  • Phạm vi & Cây trồng: Các nhóm cây trồng phù hợp tại Việt Nam (cây ăn trái, rau màu, hoa kiểng, cây lương thực...).
  • Hướng dẫn & Lưu ý khi dùng: Cách dùng cơ bản, thời điểm, khuyến cáo an toàn bảo hộ.
  Chế phẩm tự pha: ghi rõ nguyên liệu, tỷ lệ, thời gian ngâm / ủ, cách lọc, cách pha loãng.
- Không phóng đại công dụng: phân bón, vôi, vật tư (SUPPLY) và biện pháp (PRACTICE) chỉ được viết là "hỗ trợ cây khỏe / giảm nguy cơ / phòng ngừa", KHÔNG viết "phòng trừ / trị / diệt" bệnh, trừ khi nguồn ghi rõ là trị bệnh. Với SUPPLY, đặt tên mục là "• Công dụng nông nghiệp".
- scope_note: để "" nếu mọi số liệu đúng loại vật tư trong bài. Nếu số liệu lấy từ nguồn nói về loại rộng hơn / khác, nguồn quá cũ (trước 2015) hoặc nguồn ghi đơn vị mâu thuẫn, ghi rõ ở đây.
- source_urls và image_candidates: CHỈ đưa link bạn đã thực sự mở được và đúng vật tư này. KHÔNG bịa link. Ảnh phải là link trực tiếp tới file ảnh của đúng sản phẩm; không có thì [].
- Chỉ dùng thông tin áp dụng tại Việt Nam; thuốc / hoạt chất bị cấm tại Việt Nam thì ghi rõ trong identification_note.

## 6. Danh sách mã bệnh hợp lệ (mã — cây – tên bệnh)
${diseaseList}`;
};

// ---------------------------------------------------------------------------
// 6. Đọc câu trả lời Gemini (JSON + danh sách nguồn) + khớp bệnh hại
// ---------------------------------------------------------------------------

export interface ParsedResearch {
  data: Record<string, unknown>;
  matchedDiseases: string[];
  unmatchedDiseases: string[];
  hasDiseaseField: boolean;
  sourceUrls: string[];
  imageCandidates: string[];
  /** Phiếu cách dùng đã chuẩn hóa; null nếu JSON không có "usage". */
  usage: UsageProfile | null;
  /** Câu "trích nguyên văn" trong phần "Nguồn đã dùng", theo link (TASK-18-R4, để kiểm tra trích dẫn). */
  sourceQuotes: SourceQuote[];
}

export interface SourceQuote {
  url: string;
  quote: string;
}

/**
 * Đọc các dòng "1. <URL> — loại — năm — "câu trích"" sau khối JSON. Mỗi dòng có link + câu trong ngoặc kép
 * (" " hoặc “ ”) dài ≥ 8 ký tự → 1 cặp. Một link có nhiều dòng thì giữ nhiều câu.
 */
export const extractSourceQuotes = (raw: string): SourceQuote[] => {
  const fenceEnd = raw.lastIndexOf('```');
  const tail = fenceEnd >= 0 ? raw.slice(fenceEnd + 3) : raw;
  const out: SourceQuote[] = [];
  const seen = new Set<string>();
  for (const line of tail.split(/\r?\n/)) {
    const url = (line.match(/https?:\/\/[^\s<>"'()\]]+/) || [])[0]?.replace(/[.,;:]+$/, '');
    if (!url) continue;
    // Bỏ "câu trích" thực ra là link (Gemini hay để link trong ngoặc kép) — đó không phải chữ trên trang
    const quotes = [...line.matchAll(/"([^"]{8,})"|“([^”]{8,})”/g)]
      .map((m) => (m[1] || m[2]).trim())
      .filter((q) => !/https?:\/\/|www\./i.test(q));
    for (const q of quotes) {
      const key = `${url}##${q}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ url, quote: q });
    }
  }
  return out;
};

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
  const httpList = (v: unknown) =>
    (Array.isArray(v) ? v : typeof v === 'string' ? [v] : [])
      .map((u) => String(u).trim())
      .filter((u) => /^https?:\/\/\S+$/i.test(u));
  // Link trong phần "Nguồn đã dùng" / "Ảnh sản phẩm" sau khối JSON (dự phòng khi mảng trong JSON rỗng)
  const after = raw.slice(Math.max(raw.lastIndexOf('```'), 0));
  const tailUrls = uniq((after.match(/https?:\/\/[^\s<>"'()\]]+/g) || []).map((u) => u.replace(/[.,;:]+$/, '')));
  const isImage = (u: string) => /\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(u);
  const sourceUrls = uniq([...httpList(data.source_urls), ...tailUrls.filter((u) => !isImage(u))]);
  const imageCandidates = uniq([
    ...httpList(data.image_candidates),
    ...httpList(data.image_url),
    ...tailUrls.filter(isImage),
  ]);
  const usage = data.usage && typeof data.usage === 'object' ? normalizeUsageProfile(data.usage) : null;
  return {
    data,
    matchedDiseases: uniq(matched),
    unmatchedDiseases: uniq(unmatched),
    hasDiseaseField,
    sourceUrls,
    imageCandidates,
    usage,
    sourceQuotes: extractSourceQuotes(raw),
  };
};
