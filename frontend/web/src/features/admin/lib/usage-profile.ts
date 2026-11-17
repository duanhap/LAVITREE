// TASK-18: Phiếu cách dùng vật tư (khớp Lavitree.Domain.Entities.UsageProfile, cột jsonb Products.UsageProfile).
// Con số tách riêng để lịch phun / nhắc nhở sau này (FEAT-06) tự tính ngày bằng code.
// Text "Hướng dẫn sử dụng" ghép theo NHÃN CỐ ĐỊNH (USAGE_LABELS) để trợ lý Lavi đọc ngay và để chuyển đổi dữ liệu về sau.
// Không phụ thuộc React để test được bằng script.

export interface NumberRange {
  min: number | null;
  max: number | null;
}

/** Liều theo diện tích (phân, vôi, chế phẩm rắc / bón): 20–30 "tấn/ha", 50 "kg/1000 m²". */
export interface AreaDose extends NumberRange {
  unit: string | null;
}

export interface UsageProfile {
  version?: number;
  dose_amount: number | null;
  dose_unit: string | null;
  water_liters: number | null;
  dose_text: string | null;
  dose_per_area: AreaDose | null;
  spray_volume_per_ha: NumberRange | null;
  method: string | null;
  time_of_day: string[] | null;
  times_per_day: number | null;
  interval_days: NumberRange | null;
  max_applications_per_season: number | null;
  start_when: string | null;
  stop_when: string | null;
  weather_note: string | null;
  avoid_rain_hours: number | null;
  safety_note: string | null;
  source_url: string | null;
}

export const USAGE_PROFILE_VERSION = 1;

export const emptyUsageProfile = (): UsageProfile => ({
  version: USAGE_PROFILE_VERSION,
  dose_amount: null,
  dose_unit: null,
  water_liters: null,
  dose_text: null,
  dose_per_area: null,
  spray_volume_per_ha: null,
  method: null,
  time_of_day: null,
  times_per_day: null,
  interval_days: null,
  max_applications_per_season: null,
  start_when: null,
  stop_when: null,
  weather_note: null,
  avoid_rain_hours: null,
  safety_note: null,
  source_url: null,
});

/** Nhãn cố định của từng dòng trong "Hướng dẫn sử dụng". Đổi nhãn = phải chuyển đổi dữ liệu cũ. */
export const USAGE_LABELS = {
  dose: 'Liều lượng',
  method: 'Cách dùng',
  time: 'Thời điểm',
  repeat: 'Nhắc lại',
  start: 'Bắt đầu',
  stop: 'Ngừng',
  weather: 'Thời tiết',
  phi: 'Cách ly (PHI)',
  safety: 'An toàn',
} as const;

// ---------------------------------------------------------------------------
// Đọc giá trị AI trả về (số có thể là chuỗi "7", "7-10", "7–10 ngày", "khoảng 1 tuần")
// ---------------------------------------------------------------------------

const toNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const m = String(v).replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

const toInt = (v: unknown): number | null => {
  const n = toNumber(v);
  return n === null ? null : Math.round(n);
};

const toText = (v: unknown, max = 500): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || /^(null|none|không có|khong co|n\/a|-)$/i.test(s)) return null;
  return s.length > max ? s.slice(0, max) : s;
};

export const toRange = (v: unknown): NumberRange | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? { min: v, max: v } : null;
  if (typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const min = toNumber(o.min);
    const max = toNumber(o.max);
    if (min === null && max === null) return null;
    return { min: min ?? max, max: max ?? min };
  }
  const nums = String(v).replace(/,/g, '.').match(/\d+(\.\d+)?/g);
  if (!nums || !nums.length) return null;
  const a = Number(nums[0]);
  const b = nums.length > 1 ? Number(nums[1]) : a;
  return { min: Math.min(a, b), max: Math.max(a, b) };
};

/** {min,max,unit} hoặc chuỗi "20-30 tấn/ha" / "50 kg/1000 m²". Không có đơn vị thì bỏ (không đoán đơn vị). */
export const toAreaDose = (v: unknown): AreaDose | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'object' && !Array.isArray(v)) {
    const r = toRange(v);
    const unit = toText((v as Record<string, unknown>).unit, 30);
    return r && unit ? { ...r, unit } : null;
  }
  const str = String(v).trim();
  const m = str.match(/^\s*(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\s*([^\d\s].*)$/);
  if (!m) return null;
  const a = Number(m[1].replace(',', '.'));
  const b = m[2] ? Number(m[2].replace(',', '.')) : a;
  const unit = toText(m[3], 30);
  return unit ? { min: Math.min(a, b), max: Math.max(a, b), unit } : null;
};

const toList = (v: unknown): string[] | null => {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,;]| hoặc | hay /i) : [];
  const out = Array.from(new Set(arr.map((x) => toText(x, 60)).filter((x): x is string => !!x))).slice(0, 4);
  return out.length ? out : null;
};

/** Chuyển object `usage` AI trả về thành phiếu hợp lệ (trường lạ bị bỏ, số chuỗi được tách). */
export const normalizeUsageProfile = (raw: unknown): UsageProfile => {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    version: USAGE_PROFILE_VERSION,
    dose_amount: toNumber(o.dose_amount),
    dose_unit: toText(o.dose_unit, 30),
    water_liters: toNumber(o.water_liters),
    dose_text: toText(o.dose_text),
    dose_per_area: toAreaDose(o.dose_per_area),
    spray_volume_per_ha: toRange(o.spray_volume_per_ha),
    method: toText(o.method),
    time_of_day: toList(o.time_of_day),
    times_per_day: toInt(o.times_per_day),
    interval_days: toRange(o.interval_days),
    max_applications_per_season: toInt(o.max_applications_per_season),
    start_when: toText(o.start_when),
    stop_when: toText(o.stop_when),
    weather_note: toText(o.weather_note),
    avoid_rain_hours: toInt(o.avoid_rain_hours),
    safety_note: toText(o.safety_note),
    source_url: toText(o.source_url),
  };
};

export const isUsageEmpty = (p: UsageProfile | null | undefined): boolean => {
  if (!p) return true;
  const { version: _v, ...rest } = p;
  return Object.values(rest).every((v) => v === null || v === undefined || (Array.isArray(v) && v.length === 0));
};

// ---------------------------------------------------------------------------
// Ghép "Hướng dẫn sử dụng" theo nhãn cố định
// ---------------------------------------------------------------------------

const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace('.', ','));
const fmtRange = (r: NumberRange | null) => {
  if (!r || (r.min === null && r.max === null)) return '';
  const a = r.min ?? r.max!;
  const b = r.max ?? r.min!;
  return a === b ? fmtNum(a) : `${fmtNum(a)}–${fmtNum(b)}`;
};

/** Các dòng "• Nhãn: nội dung" (bỏ dòng không có dữ liệu). phiDays lấy từ cột PhiDays của sản phẩm. */
export const formatUsageLines = (p: UsageProfile, phiDays?: number | null, isSupply = false): string[] => {
  const L = USAGE_LABELS;
  const lines: string[] = [];

  const doseParts: string[] = [];
  const numericDose =
    p.dose_amount !== null
      ? `${fmtNum(p.dose_amount)}${p.dose_unit ? ` ${p.dose_unit}` : ''}${p.water_liters !== null ? ` / bình ${fmtNum(p.water_liters)} lít` : ''}`
      : '';
  if (p.dose_text) {
    // liều bằng chữ đã chứa con số thì dùng nguyên văn, tránh lặp "1 kg (1 kg trộn 50 kg phân chuồng)"
    const textHasAmount = p.dose_amount === null || p.dose_text.replace(',', '.').includes(String(p.dose_amount));
    doseParts.push(textHasAmount ? p.dose_text : `${numericDose} (${p.dose_text})`);
  } else if (numericDose) {
    doseParts.push(numericDose);
  }
  const area = p.dose_per_area ? fmtRange(p.dose_per_area) : '';
  if (area && p.dose_per_area?.unit) {
    // liều chữ đã ghi sẵn con số này thì không lặp lại
    const already = p.dose_text && p.dose_text.replace(/\s/g, '').includes(area.replace('–', '-').replace(/\s/g, ''));
    const already2 = p.dose_text && p.dose_text.replace(/\s/g, '').includes(area.replace(/\s/g, ''));
    if (!already && !already2) doseParts.push(`${area} ${p.dose_per_area.unit}`);
  }
  const vol = fmtRange(p.spray_volume_per_ha);
  if (vol) doseParts.push(`lượng phun ${vol} lít/ha`);
  if (doseParts.length) lines.push(`• ${L.dose}: ${doseParts.join(', ')}`);

  if (p.method) lines.push(`• ${L.method}: ${p.method}`);

  const timeParts: string[] = [];
  if (p.time_of_day?.length) timeParts.push(p.time_of_day.join(' hoặc '));
  if (p.times_per_day !== null) timeParts.push(`${p.times_per_day} lần/ngày`);
  if (timeParts.length) lines.push(`• ${L.time}: ${timeParts.join(', ')}`);

  const repeatParts: string[] = [];
  const iv = fmtRange(p.interval_days);
  if (iv) repeatParts.push(`cách ${iv} ngày`);
  if (p.max_applications_per_season !== null) repeatParts.push(`tối đa ${p.max_applications_per_season} lần/vụ`);
  if (repeatParts.length) lines.push(`• ${L.repeat}: ${repeatParts.join(', ')}`);

  if (p.start_when) lines.push(`• ${L.start}: ${p.start_when}`);
  if (p.stop_when) lines.push(`• ${L.stop}: ${p.stop_when}`);

  const weatherParts: string[] = [];
  if (p.weather_note) weatherParts.push(p.weather_note);
  if (p.avoid_rain_hours !== null) weatherParts.push(`không phun nếu dự báo mưa trong ${p.avoid_rain_hours} giờ sau khi phun`);
  if (weatherParts.length) lines.push(`• ${L.weather}: ${weatherParts.join('; ')}`);

  if (!isSupply && phiDays !== null && phiDays !== undefined && !Number.isNaN(Number(phiDays))) {
    lines.push(`• ${L.phi}: ${phiDays} ngày trước thu hoạch`);
  }
  if (p.safety_note) lines.push(`• ${L.safety}: ${p.safety_note}`);
  return lines;
};

export const formatUsageText = (p: UsageProfile, phiDays?: number | null, isSupply = false): string =>
  formatUsageLines(p, phiDays, isSupply).join('\n');

/** Phiếu gửi lên API: null nếu rỗng. */
export const usageProfileForApi = (p: UsageProfile | null | undefined): UsageProfile | null =>
  !p || isUsageEmpty(p) ? null : { ...p, version: USAGE_PROFILE_VERSION };

// ---------------------------------------------------------------------------
// Mô tả + Hướng dẫn sử dụng lưu chung cột dosage_instruction
// ---------------------------------------------------------------------------

const DESC_PREFIX = 'Mô tả:';
const DOSAGE_MARKER = 'Hướng dẫn sử dụng:';

/** "Mô tả: <mô tả>\n\nHướng dẫn sử dụng:\n<hướng dẫn>" (cả hai có thể nhiều dòng). */
export const combineDescriptionDosage = (description: string, dosage: string): string => {
  const d = description.trim();
  const u = dosage.trim();
  if (!d) return u;
  return `${DESC_PREFIX} ${d}\n\n${DOSAGE_MARKER}\n${u}`.trimEnd();
};

const USAGE_LINE = new RegExp(
  '^•\\s*(' + Object.values(USAGE_LABELS).map((l) => l.replace(/[()]/g, '\\$&')).join('|') + '):'
);

/** Tách lại khi mở form sửa. Bản lưu cũ (không có dòng "Hướng dẫn sử dụng:") tách ở dòng phiếu đầu tiên, nếu không có thì ở dòng cuối. */
export const splitDescriptionDosage = (text: string): { description: string; dosage: string } => {
  const t = (text || '').replace(/\r\n/g, '\n');
  if (!t.startsWith(DESC_PREFIX)) return { description: '', dosage: t.trim() };
  const body = t.slice(DESC_PREFIX.length).trim();
  const lines = body.split('\n');
  let at = lines.findIndex((l) => l.trim() === DOSAGE_MARKER);
  if (at !== -1) {
    return { description: lines.slice(0, at).join('\n').trim(), dosage: lines.slice(at + 1).join('\n').trim() };
  }
  at = lines.findIndex((l, i) => i > 0 && USAGE_LINE.test(l.trim()));
  if (at === -1) at = lines.length > 1 ? lines.length - 1 : -1;
  if (at === -1) return { description: body, dosage: '' };
  return { description: lines.slice(0, at).join('\n').trim(), dosage: lines.slice(at).join('\n').trim() };
};

// ---------------------------------------------------------------------------
// Kiểm tra phiếu trước khi lưu: chặn số làm lịch nhắc dày đặc (FEAT-06)
// ---------------------------------------------------------------------------

const isInt = (n: number) => Number.isInteger(n);

/** Trả về câu báo lỗi đầu tiên, hoặc null nếu phiếu hợp lệ. Phiếu trống luôn hợp lệ. */
export const validateUsageProfile = (p: UsageProfile | null | undefined): string | null => {
  if (!p) return null;
  const iv = p.interval_days;
  const hasInterval = !!iv && (iv.min !== null || iv.max !== null);
  if (hasInterval) {
    for (const v of [iv!.min, iv!.max]) {
      if (v !== null && (!isInt(v) || v < 1 || v > 365)) {
        return 'Ô "Cách nhau (ngày)" phải là số ngày nguyên từ 1 đến 365.';
      }
    }
    if (iv!.min !== null && iv!.max !== null && iv!.min > iv!.max) {
      return 'Ô "Cách nhau (ngày)": số đầu phải nhỏ hơn hoặc bằng số sau (VD: 7-10).';
    }
    if (p.max_applications_per_season === null) {
      return 'Đã nhập "Cách nhau (ngày)" thì phải nhập "Tối đa lần / vụ", nếu không lịch nhắc sẽ lặp mãi.';
    }
  }
  const m = p.max_applications_per_season;
  if (m !== null && (!isInt(m) || m < 1 || m > 50)) {
    return 'Ô "Tối đa lần / vụ" phải là số nguyên từ 1 đến 50.';
  }
  const t = p.times_per_day;
  if (t !== null && (!isInt(t) || t < 1 || t > 10)) {
    return 'Ô "Số lần / ngày" phải là số nguyên từ 1 đến 10.';
  }
  const r = p.avoid_rain_hours;
  if (r !== null && (r < 0 || r > 72)) {
    return 'Ô "Tránh mưa (giờ)" phải từ 0 đến 72 giờ.';
  }
  return null;
};
