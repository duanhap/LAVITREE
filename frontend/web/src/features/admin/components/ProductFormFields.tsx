import React, { useState } from 'react';
import {
  ImageOff,
  Check,
  ExternalLink,
  X,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { UsageProfile } from '../lib/usage-profile';
import { isIngredientBanned } from '../lib';
import { safeHref } from '@/lib/utils';

export interface ProductFormData {
  name: string;
  medicine_type: string;
  active_ingredient: string;
  price: number;
  stock_quantity: number;
  phi_days: number | '';
  availability: string;
  description: string;
  image_url: string;
  info_source_url: string;
  is_allowed: boolean;
  target_diseases?: string[];
  dosage_instruction?: string;
  usage_profile?: UsageProfile;
}

export interface ProductFormFieldsProps {
  data: ProductFormData;
  onChange: (updated: ProductFormData) => void;
  showTargetDiseases?: boolean;
  availableDiseases?: Array<{ classCode: string; commonNameVi: string; plantName: string }>;
  aiImageCandidates?: string[];
  aiSourceLinks?: string[];
  aiNotes?: Array<{ title: string; text: string }>;
  googleQueries?: Array<{ label: string; url: string; query: string }>;
}

const DESCRIPTION_MAX = 3500;

export const ProductFormFields: React.FC<ProductFormFieldsProps> = ({
  data,
  onChange,
  showTargetDiseases = false,
  availableDiseases = [],
  aiImageCandidates = [],
  aiSourceLinks = [],
  aiNotes = [],
  googleQueries = [],
}) => {
  const [descPreviewMode, setDescPreviewMode] = useState<boolean>(false);
  const [medImageFailed, setMedImageFailed] = useState<boolean>(false);

  const isSupply = data.medicine_type === 'Vật tư canh tác';
  const isBanned = isIngredientBanned(data.active_ingredient) || isIngredientBanned(data.name);

  const update = <K extends keyof ProductFormData>(key: K, val: ProductFormData[K]) => {
    onChange({ ...data, [key]: val });
  };

  return (
    <div className="space-y-4 text-xs">
      {/* KHỐI 2 CỘT TỔNG QUAN: Cột trái (Ảnh & Link, 280px), Cột phải (Các trường chính) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ================= CỘT TRÁI (280px trên lg, chiếm 4 cols) ================= */}
        <div className="lg:col-span-4 space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="space-y-2">
            <label className="font-semibold block text-foreground">Ảnh sản phẩm</label>

            {/* Xem trước ảnh (160px) */}
            <div className="w-full h-40 rounded-xl border border-dashed border-border bg-muted/20 overflow-hidden flex items-center justify-center relative">
              {data.image_url ? (
                medImageFailed ? (
                  <div className="flex flex-col items-center justify-center text-amber-600 dark:text-amber-400 p-2 text-center">
                    <ImageOff className="w-8 h-8 mb-1" />
                    <span className="text-[11px] font-medium">Lỗi tải ảnh</span>
                    <span className="text-[9px] text-muted-foreground mt-0.5">
                      (Trang nguồn chặn nhúng ngoài, URL vẫn lưu)
                    </span>
                  </div>
                ) : (
                  <>
                    <img
                      src={data.image_url}
                      alt="Xem trước ảnh sản phẩm"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain p-1"
                      onError={() => setMedImageFailed(true)}
                      onLoad={() => setMedImageFailed(false)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        update('image_url', '');
                        setMedImageFailed(false);
                      }}
                      className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-destructive hover:text-white transition-colors"
                      title="Gỡ ảnh"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                )
              ) : (
                <div className="text-center text-muted-foreground p-3">
                  <ImageOff className="w-8 h-8 mx-auto mb-1 opacity-40" />
                  <span className="text-[11px]">Chưa có ảnh sản phẩm</span>
                </div>
              )}
            </div>

            <Input
              type="url"
              placeholder="https://example.com/anh-san-pham.jpg"
              value={data.image_url}
              onChange={(e) => {
                update('image_url', e.target.value.trim());
                setMedImageFailed(false);
              }}
              className="text-xs h-8"
            />

            {/* Ảnh AI đề xuất nếu có */}
            {aiImageCandidates.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-semibold text-muted-foreground">
                  Ảnh AI đề xuất:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {aiImageCandidates.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => {
                        update('image_url', u);
                        setMedImageFailed(false);
                      }}
                      className={`relative w-12 h-12 rounded-md border overflow-hidden bg-background ${
                        data.image_url === u
                          ? 'border-primary ring-2 ring-primary/40'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <img
                        src={u}
                        alt="Ảnh đề xuất"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Link nhãn thuốc / nguồn */}
          <div className="space-y-1.5 pt-2 border-t border-border">
            <label className="font-semibold block text-foreground">Link nhãn thuốc / Nguồn</label>
            <Input
              type="url"
              placeholder="https://..."
              value={data.info_source_url}
              onChange={(e) => update('info_source_url', e.target.value.trim())}
              className="text-xs h-8"
            />
            {googleQueries.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-[10px]">
                <span className="text-muted-foreground flex items-center gap-0.5">
                  <Search className="w-2.5 h-2.5" /> Tra:
                </span>
                {googleQueries.map((q) => (
                  <a
                    key={q.url}
                    href={q.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-foreground hover:text-primary font-medium"
                  >
                    <span>{q.label}</span>
                    <ExternalLink className="w-2 h-2" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Công tắc Lưu hành */}
          <div className="pt-2 border-t border-border">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                disabled={isBanned}
                checked={data.is_allowed && !isBanned}
                onChange={(e) => update('is_allowed', e.target.checked)}
                className="w-4 h-4 rounded text-primary focus:ring-primary"
              />
              <span className="font-semibold text-xs text-foreground">
                Đang lưu hành (Lavi được tư vấn)
              </span>
            </label>
            {isBanned && (
              <p className="text-[10px] text-destructive mt-1">
                Sản phẩm chứa hoạt chất cấm, không thể bật lưu hành.
              </p>
            )}
          </div>
        </div>

        {/* ================= CỘT PHẢI (Chiếm 8 cols trên lg) ================= */}
        <div className="lg:col-span-8 space-y-3.5 rounded-xl border border-border bg-card p-4">
          {/* Tên sản phẩm */}
          <div>
            <label className="font-semibold block mb-1 text-foreground">
              Tên thuốc / Tên sản phẩm <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              placeholder="Ví dụ: Ridomil Gold 68WG, Vôi bột nông nghiệp..."
              value={data.name}
              onChange={(e) => update('name', e.target.value)}
              required
              className={`text-xs h-9 font-medium ${isIngredientBanned(data.name) ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            />
            {isIngredientBanned(data.name) && (
              <div className="mt-1.5 p-2 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-[11px] flex items-start gap-1.5 leading-tight">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <div>
                  <strong>Cảnh báo chất cấm (TT 75/2025):</strong> Tên sản phẩm "{data.name}" chứa hoạt chất cấm theo TT 75/2025. Không thể bật lưu hành sản phẩm này.
                </div>
              </div>
            )}
          </div>

          {/* Phân loại & Hoạt chất (1 hàng) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1 text-foreground">
                Loại sản phẩm <span className="text-destructive">*</span>
              </label>
              <select
                value={data.medicine_type}
                onChange={(e) => {
                  const t = e.target.value;
                  const next = { ...data, medicine_type: t };
                  if (t === 'Vật tư canh tác') {
                    next.phi_days = '';
                    next.active_ingredient = '';
                  }
                  onChange(next);
                }}
                className="w-full h-8 px-2.5 bg-background border border-input rounded-md text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="Hóa học">Thuốc BVTV hóa học</option>
                <option value="Sinh học">Chế phẩm sinh học BVTV</option>
                <option value="Vật tư canh tác">Vật tư canh tác (vôi, bẫy, lưới...)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-1 text-foreground">
                Hoạt chất chính {isSupply && <span className="text-muted-foreground font-normal">(Không áp dụng)</span>}
              </label>
              <Input
                type="text"
                placeholder={isSupply ? 'Không áp dụng' : 'Ví dụ: Metalaxyl-M + Mancozeb'}
                disabled={isSupply}
                value={data.active_ingredient}
                onChange={(e) => update('active_ingredient', e.target.value)}
                className={`text-xs h-8 ${!isSupply && isIngredientBanned(data.active_ingredient) ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
              {!isSupply && isIngredientBanned(data.active_ingredient) && (
                <div className="mt-1.5 p-2 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-[11px] flex items-start gap-1.5 leading-tight">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <div>
                    <strong>Cảnh báo chất cấm (TT 75/2025):</strong> Hoạt chất "{data.active_ingredient}" nằm trong danh mục cấm sử dụng tại Việt Nam. Không thể bật lưu hành sản phẩm này.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Giá, Tồn kho & PHI (3 ô chung 1 hàng) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold block mb-1 text-foreground">Giá bán (VNĐ)</label>
              <Input
                type="number"
                min="0"
                value={data.price}
                onChange={(e) => update('price', Math.max(0, parseFloat(e.target.value) || 0))}
                className="text-xs h-8"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1 text-foreground">Tồn kho (gói/chai)</label>
              <Input
                type="number"
                min="0"
                value={data.stock_quantity}
                onChange={(e) =>
                  update('stock_quantity', Math.max(0, parseInt(e.target.value, 10) || 0))
                }
                className="text-xs h-8"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1 text-foreground">
                PHI (ngày)
                {!isSupply ? (
                  <span className="text-destructive font-normal ml-0.5">*</span>
                ) : (
                  <span className="text-muted-foreground font-normal ml-0.5">(Ẩn)</span>
                )}
              </label>
              <Input
                type="number"
                min="0"
                max="365"
                disabled={isSupply}
                placeholder={isSupply ? '—' : 'VD: 7, 14'}
                value={data.phi_days}
                onChange={(e) =>
                  update(
                    'phi_days',
                    e.target.value === '' ? '' : Math.min(365, Math.max(0, parseInt(e.target.value, 10) || 0))
                  )
                }
                className="text-xs h-8"
              />
            </div>
          </div>

          {/* Tình trạng kinh doanh */}
          <div>
            <label className="font-semibold block mb-1 text-foreground">Tình trạng kinh doanh</label>
            <select
              value={data.availability}
              onChange={(e) => update('availability', e.target.value)}
              className="w-full h-8 px-2.5 bg-background border border-input rounded-md text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="IN_STOCK">Đang bán (cho phép đặt mua)</option>
              <option value="OUT_OF_STOCK">Tạm hết hàng (tạm ẩn nút mua)</option>
              <option value="NOT_SOLD">Cửa hàng không bán (chỉ tư vấn kỹ thuật)</option>
            </select>
          </div>

          {/* Mô tả sản phẩm */}
          <div>
            <div className="flex justify-between items-center mb-1 flex-wrap gap-1">
              <label className="font-semibold text-foreground">Mô tả sản phẩm / Đặc tính kỹ thuật</label>
              <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/40">
                <button
                  type="button"
                  onClick={() => setDescPreviewMode(false)}
                  className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                    !descPreviewMode
                      ? 'bg-background text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  ✏️ Soạn thảo
                </button>
                <button
                  type="button"
                  onClick={() => setDescPreviewMode(true)}
                  className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                    descPreviewMode
                      ? 'bg-background text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  👁️ Xem trước
                </button>
              </div>
            </div>

            {!descPreviewMode ? (
              <Textarea
                placeholder="• Bản chất & Phân loại: ...&#10;• Cơ chế tác động & Đặc tính: ...&#10;• Công dụng nông nghiệp: ...&#10;• Phạm vi & Cây trồng: ...&#10;• Hướng dẫn & Lưu ý khi dùng: ..."
                value={data.description}
                onChange={(e) => update('description', e.target.value)}
                rows={5}
                maxLength={DESCRIPTION_MAX}
                className="text-xs leading-relaxed font-sans"
              />
            ) : (
              <div className="p-3 bg-muted/20 rounded-xl border border-border text-xs leading-relaxed min-h-[90px] text-foreground space-y-2.5">
                {data.description.trim() ? (
                  data.description
                    .split('\n')
                    .map((l) => l.trim())
                    .filter(Boolean)
                    .map((line, idx) => {
                      const isBullet = /^[•\-*]|\d+\./.test(line);
                      const cleanContent = isBullet ? line.replace(/^([•\-*]|\d+\.)\s*/, '') : line;
                      const colonIdx = cleanContent.indexOf(':');
                      const hasTitle = colonIdx > 0 && colonIdx < 60;
                      const title = hasTitle ? cleanContent.slice(0, colonIdx).trim() : null;
                      const body = hasTitle ? cleanContent.slice(colonIdx + 1).trim() : cleanContent;

                      return (
                        <div key={idx} className="flex items-start gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 mt-1.5 shrink-0" />
                          <div className="flex-1">
                            {hasTitle ? (
                              <>
                                <strong className="font-bold text-foreground mr-1">
                                  {title}:
                                </strong>
                                <span className="text-foreground/90">{body}</span>
                              </>
                            ) : (
                              <span className="text-foreground/90">{cleanContent}</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <span className="text-muted-foreground italic">Chưa có mô tả sản phẩm.</span>
                )}
              </div>
            )}
          </div>

          {/* Bệnh hại mục tiêu (Chỉ hiện khi showTargetDiseases = true, e.g. trong modal tạo mới) */}
          {showTargetDiseases && (
            <div className="pt-2 border-t border-border">
              <label className="font-semibold block mb-1 text-foreground">Bệnh hại mục tiêu</label>
              {data.target_diseases && data.target_diseases.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {data.target_diseases.map((code) => {
                    const d = availableDiseases.find((x) => x.classCode === code);
                    return (
                      <span
                        key={code}
                        className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-secondary text-primary border border-border text-[11px]"
                      >
                        <span>{d ? `${d.plantName} – ${d.commonNameVi}` : code}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = (data.target_diseases || []).filter((c) => c !== code);
                            update('target_diseases', next);
                          }}
                          className="rounded-full p-0.5 hover:bg-muted"
                          title="Bỏ bệnh này"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <select
                value=""
                onChange={(e) => {
                  const code = e.target.value;
                  if (code) {
                    const prev = data.target_diseases || [];
                    if (!prev.includes(code)) {
                      update('target_diseases', [...prev, code]);
                    }
                  }
                }}
                className="w-full h-8 px-2.5 bg-background border border-input rounded-md text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">+ Thêm bệnh hại cho sản phẩm này...</option>
                {availableDiseases
                  .filter((d) => !(data.target_diseases || []).includes(d.classCode))
                  .map((d) => (
                    <option key={d.classCode} value={d.classCode}>
                      {d.plantName} – {d.commonNameVi}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
