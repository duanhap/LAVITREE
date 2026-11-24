// Danh mục chất cấm (TASK-19): nguồn là Core GET /banned-substances (bảng BannedSubstances, Admin cập nhật trên tab Chất cấm).
// Danh sách dưới đây chỉ là dự phòng khi chưa tải được (trùng dữ liệu khởi tạo của migration AddBannedSubstances).
// Web chỉ cảnh báo sớm; Core luôn kiểm tra lại khi lưu.
const FALLBACK_BANNED_TERMS: [string, string][] = [
  ["aldrin", "Aldrin"],
  ["lindane", "Lindane"],
  ["bhc", "Lindane"],
  ["cadmium compound", "Cadmium compound"],
  ["cadmium", "Cadmium compound"],
  ["carbofuran", "Carbofuran"],
  ["furadan", "Carbofuran"],
  ["chlordane", "Chlordane"],
  ["chlordimeform", "Chlordimeform"],
  ["ddt", "DDT"],
  ["dieldrin", "Dieldrin"],
  ["endosulfan", "Endosulfan"],
  ["thiodan", "Endosulfan"],
  ["endrin", "Endrin"],
  ["heptachlor", "Heptachlor"],
  ["isobenzan", "Isobenzan"],
  ["isodrin", "Isodrin"],
  ["lead (pb)", "Lead (Pb)"],
  ["methamidophos", "Methamidophos"],
  ["methyl parathion", "Methyl Parathion"],
  ["parathion-methyl", "Methyl Parathion"],
  ["monocrotophos", "Monocrotophos"],
  ["parathion ethyl", "Parathion Ethyl"],
  ["parathion", "Parathion Ethyl"],
  ["ethyl parathion", "Parathion Ethyl"],
  ["sodium pentachlorophenate monohydrate", "Sodium Pentachlorophenate monohydrate"],
  ["pentachlorophenol", "Pentachlorophenol"],
  ["phosphamidon", "Phosphamidon"],
  ["polychlorocamphene", "Polychlorocamphene"],
  ["toxaphene", "Polychlorocamphene"],
  ["trichlorfon", "Trichlorfon"],
  ["chlorophos", "Trichlorfon"],
  ["dipterex", "Trichlorfon"],
  ["arsenic (as)", "Arsenic (As)"],
  ["arsenic", "Arsenic (As)"],
  ["captan", "Captan"],
  ["captafol", "Captafol"],
  ["hexachlorobenzene", "Hexachlorobenzene"],
  ["mercury (hg)", "Mercury (Hg)"],
  ["mercury", "Mercury (Hg)"],
  ["selenium (se)", "Selenium (Se)"],
  ["thallium compound", "Thallium compound"],
  ["talium compond", "Thallium compound"],
  ["thallium", "Thallium compound"],
  ["2,4,5-t", "2,4,5-T"],
  ["2.4.5-t", "2,4,5-T"],
  ["paraquat", "Paraquat"],
  ["pa-ra-quat", "Paraquat"],
  ["para-quat", "Paraquat"],
  ["gramoxone", "Paraquat"],
  ["2,4-d", "2,4-D"],
  ["2.4-d", "2,4-D"],
  ["2,4d", "2,4-D"],
  ["2.4d", "2,4-D"],
  ["chlorpyrifos", "Chlorpyrifos"],
  ["glyphosate", "Glyphosate"],
];

let bannedTerms: [string, string][] = FALLBACK_BANNED_TERMS;

/** Thay danh sách bằng bản Core trả về (terms: [{ text, substance }]). */
export const setBannedTerms = (terms: { text: string; substance: string }[]) => {
  bannedTerms = terms.map((t) => [t.text.toLowerCase(), t.substance]);
};

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const LETTER = /\p{L}/u;

/** Cụm đứng riêng: trước không phải chữ / số, sau không phải chữ (giống Core BannedSubstanceRegistry.ContainsTerm). */
export const containsTerm = (lowerText: string, term: string): boolean => {
  if (!term) return false;
  let from = 0;
  for (; ;) {
    const i = lowerText.indexOf(term, from);
    if (i < 0) return false;
    const end = i + term.length;
    const before = i === 0 || !LETTER_OR_DIGIT.test(lowerText[i - 1]);
    const after = end >= lowerText.length || !LETTER.test(lowerText[end]);
    if (before && after) return true;
    from = i + 1;
  }
};

/** Tên chung các chất cấm có trong chữ. */
export const findBannedSubstances = (text?: string | null): string[] => {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const [term, name] of bannedTerms) {
    if (!found.includes(name) && containsTerm(lower, term)) found.push(name);
  }
  return found;
};

export const isIngredientBanned = (text?: string | null): boolean => findBannedSubstances(text).length > 0;

// Dọn dẹp ký tự Markdown thô cho đoạn trích hiển thị
export const cleanEvidencePreview = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/(?:^|\s)#{1,6}\s+/g, ' ')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/(?:^|[\n\r])\s*[-•*+–—]\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};
