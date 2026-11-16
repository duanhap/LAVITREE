import React from 'react';
import { CalendarClock, Wand2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { isUsageEmpty, toRange, type NumberRange, type UsageProfile } from '../lib/usage-profile';

// TASK-18: Khối "Cách dùng" trong form sản phẩm. Các ô số tách riêng để lịch phun / nhắc nhở (FEAT-06) tính ngày bằng code.

const numOrNull = (v: string): number | null => {
  if (v.trim() === '') return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const rangeText = (r: NumberRange | null) =>
  !r || (r.min === null && r.max === null) ? '' : r.min === r.max || r.max === null ? String(r.min ?? '') : `${r.min ?? ''}-${r.max}`;

interface Props {
  value: UsageProfile;
  onChange: (next: UsageProfile) => void;
  /** Ghép phiếu thành text "Hướng dẫn sử dụng" (nhãn cố định). */
  onCompose: () => void;
  isSupply: boolean;
}

export const UsageProfileEditor: React.FC<Props> = ({ value, onChange, onCompose, isSupply }) => {
  const set = <K extends keyof UsageProfile>(key: K, v: UsageProfile[K]) => onChange({ ...value, [key]: v });
  const text = (key: keyof UsageProfile) => (value[key] as string | null) ?? '';
  // ô khoảng số giữ chuỗi người dùng đang gõ ("7-"), chỉ chuyển sang số khi rời ô
  const [intervalDraft, setIntervalDraft] = React.useState(rangeText(value.interval_days));
  const [volumeDraft, setVolumeDraft] = React.useState(rangeText(value.spray_volume_per_ha));
  const [areaDraft, setAreaDraft] = React.useState(rangeText(value.dose_per_area));
  React.useEffect(() => setAreaDraft(rangeText(value.dose_per_area)), [value.dose_per_area]);
  const setArea = (draft: string, unit: string | null) => {
    const r = toRange(draft);
    set('dose_per_area', r || unit ? { min: r?.min ?? null, max: r?.max ?? null, unit } : null);
  };
  React.useEffect(() => setIntervalDraft(rangeText(value.interval_days)), [value.interval_days]);
  React.useEffect(() => setVolumeDraft(rangeText(value.spray_volume_per_ha)), [value.spray_volume_per_ha]);

  const field = 'text-xs h-8';
  const lbl = 'block text-[11px] font-semibold text-muted-foreground mb-0.5';

  return (
    <div className="p-3 rounded-xl border border-border bg-secondary/20 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-xs flex items-center gap-1.5">
          <CalendarClock className="w-3.5 h-3.5 text-emerald-700" />
          <span>Cách dùng (phiếu để lên lịch phun / nhắc nhở)</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCompose}
          disabled={isUsageEmpty(value)}
          className="h-7 px-2 text-[11px] gap-1 bg-background"
          title="Ghi đè ô Hướng dẫn sử dụng bằng nội dung ghép từ phiếu (nhãn cố định)"
        >
          <Wand2 className="w-3 h-3" />
          <span>Ghép vào Hướng dẫn sử dụng</span>
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Chỉ điền số khi nguồn ghi rõ, không biết thì để trống. Thời gian cách ly lấy từ ô PHI.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className={lbl}>Liều mỗi lần pha</label>
          <Input className={field} type="number" min={0} step="any" placeholder="VD: 50"
            value={value.dose_amount ?? ''} onChange={(e) => set('dose_amount', numOrNull(e.target.value))} />
        </div>
        <div>
          <label className={lbl}>Đơn vị</label>
          <Input className={field} placeholder="g, ml, kg, gói" value={text('dose_unit')}
            onChange={(e) => set('dose_unit', e.target.value || null)} />
        </div>
        <div>
          <label className={lbl}>Pha với nước (lít)</label>
          <Input className={field} type="number" min={0} step="any" placeholder="VD: 16"
            value={value.water_liters ?? ''} onChange={(e) => set('water_liters', numOrNull(e.target.value))} />
        </div>
        <div>
          <label className={lbl}>Lượng phun / ha (lít)</label>
          <Input className={field} placeholder="VD: 400-600" value={volumeDraft}
            onChange={(e) => setVolumeDraft(e.target.value)}
            onBlur={() => set('spray_volume_per_ha', toRange(volumeDraft))} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className={lbl}>Liều theo diện tích</label>
          <Input className={field} placeholder="VD: 20-30" value={areaDraft}
            onChange={(e) => setAreaDraft(e.target.value)}
            onBlur={() => setArea(areaDraft, value.dose_per_area?.unit ?? null)} />
        </div>
        <div>
          <label className={lbl}>Đơn vị diện tích</label>
          <Input className={field} placeholder="tấn/ha, kg/1000 m²" value={value.dose_per_area?.unit ?? ''}
            onChange={(e) => setArea(areaDraft, e.target.value || null)} />
        </div>
        <div className="col-span-2">
          <label className={lbl}>Liều viết bằng chữ (khi không tách được số, VD chế phẩm tự pha)</label>
          <Input className={field} placeholder="VD: 1 kg tỏi giã nhỏ ngâm 1 lít rượu, pha 100 ml dịch với 8 lít nước"
            value={text('dose_text')} onChange={(e) => set('dose_text', e.target.value || null)} />
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground -mt-1">
        Liều theo bình nước dùng cho thuốc phun; liều theo diện tích dùng cho phân, vôi, chế phẩm rắc / bón. Bón theo đợt thì để trống "Số lần / ngày".
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className={lbl}>Cách dùng</label>
          <Input className={field} placeholder="phun ướt đều 2 mặt lá / tưới gốc / rắc quanh gốc"
            value={text('method')} onChange={(e) => set('method', e.target.value || null)} />
        </div>
        <div>
          <label className={lbl}>Buổi dùng (cách nhau bằng dấu phẩy)</label>
          <Input className={field} placeholder="sáng sớm, chiều mát"
            value={(value.time_of_day || []).join(', ')}
            onChange={(e) => {
              const list = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
              set('time_of_day', list.length ? list : null);
            }} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className={lbl}>Số lần / ngày</label>
          <Input className={field} type="number" min={1} max={10} placeholder="VD: 1"
            value={value.times_per_day ?? ''} onChange={(e) => set('times_per_day', numOrNull(e.target.value))} />
        </div>
        <div>
          <label className={lbl}>Cách nhau (ngày)</label>
          <Input className={field} placeholder="VD: 7-10" value={intervalDraft}
            onChange={(e) => setIntervalDraft(e.target.value)}
            onBlur={() => set('interval_days', toRange(intervalDraft))} />
        </div>
        <div>
          <label className={lbl}>Tối đa lần / vụ</label>
          <Input className={field} type="number" min={1} max={50} placeholder="VD: 3"
            value={value.max_applications_per_season ?? ''}
            onChange={(e) => set('max_applications_per_season', numOrNull(e.target.value))} />
        </div>
        <div>
          <label className={lbl}>Tránh mưa (giờ)</label>
          <Input className={field} type="number" min={0} max={72} placeholder="VD: 6"
            value={value.avoid_rain_hours ?? ''} onChange={(e) => set('avoid_rain_hours', numOrNull(e.target.value))} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className={lbl}>Bắt đầu khi</label>
          <Input className={field} placeholder="khi bệnh chớm xuất hiện"
            value={text('start_when')} onChange={(e) => set('start_when', e.target.value || null)} />
        </div>
        <div>
          <label className={lbl}>Ngừng khi</label>
          <Input className={field} placeholder="khi bệnh không còn lây lan"
            value={text('stop_when')} onChange={(e) => set('stop_when', e.target.value || null)} />
        </div>
        <div>
          <label className={lbl}>Thời tiết</label>
          <Input className={field} placeholder="không phun khi sắp mưa, nắng gắt"
            value={text('weather_note')} onChange={(e) => set('weather_note', e.target.value || null)} />
        </div>
        <div>
          <label className={lbl}>{isSupply ? 'An toàn khi dùng' : 'Bảo hộ an toàn'}</label>
          <Input className={field} placeholder="mang găng tay, khẩu trang"
            value={text('safety_note')} onChange={(e) => set('safety_note', e.target.value || null)} />
        </div>
      </div>
    </div>
  );
};
