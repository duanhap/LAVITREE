// Bản sao BANNED_INGREDIENTS của backend/agent-service/app/agent/guardrails.py.
// Chỉ để cảnh báo sớm trên form; Core kiểm tra lại. Sửa thì sửa cả 3 nơi (Pha 4 gộp về CSDL).
export const BANNED_INGREDIENTS = [
  'paraquat', 'pa-ra-quat', 'para-quat', 'gramoxone',
  '2,4-d', '2.4-d', '2,4d', '2.4d',
  'chlorpyrifos', 'carbofuran', 'glyphosate', 'monocrotophos', 'methamidophos', 'endosulfan'
];

export const isIngredientBanned = (text?: string | null): boolean => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BANNED_INGREDIENTS.some((b) => lower.includes(b));
};

// Dọn dẹp ký tự Markdown thô cho đoạn trích hiển thị
export const cleanEvidencePreview = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^[*\-+•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
};
