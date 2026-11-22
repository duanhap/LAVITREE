import React, { useState } from 'react';
import {
  ImageOff,
  Check,
  ExternalLink,
  X,
  Search,
  CalendarClock,
  Wand2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { UsageProfileEditor } from './UsageProfileEditor';
import {
  type UsageProfile,
  formatUsageText,
  formatUsageProfileSummary,
  emptyUsageProfile,
  isUsageEmpty,
} from '../lib/usage-profile';
import { isIngredientBanned } from '../lib';
import { safeHref } from '@/lib/utils';
import { toast } from 'sonner';

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
  dosage_instruction: string;
  usage_profile: UsageProfile;
}

export interface ProductFormFieldsProps {
  data: ProductFormData;
  onChange: (updated: ProductFormData) => void;
  showTargetDiseases?: boolean;
  availableDiseases?: Array<{ classCode: string; commonNameVi: string; plantName: string }>;
  aiImageCandidates?: string[];
  aiSourceLinks?: string[];
  aiNotes?: Array<{ title: string; text: string }>;
  // Optional Google queries for researching
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
  const [isUsageEditorOpen, setIsUsageEditorOpen] = useState<boolean>(false);
  const [confirmComposeOpen, setConfirmComposeOpen] = useState<boolean>(false);
  const [pendingComposedText, setPendingComposedText] = useState<string>('');

  const isSupply = data.medicine_type === 'Vật tư canh tác';
  const isBanned = isIngredientBanned(data.active_ingredient) || isIngredientBanned(data.name);

  const update = <K extends keyof ProductFormData>(key: K, val: ProductFormData[K]) => {
    onChange({ ...data, [key]: val });
  };

  const handleComposeUsage = () => {
    const isSup = data.medicine_type === 'Vật tư canh tác';
    const phi = isSup || data.phi_days === '' ? null : Number(data.phi_days);
    const text = formatUsageText(data.usage_profile, phi, isSup);
    if (!text) {
      toast.error('Phiếu cách dùng đang trống, chưa có thông tin để ghép.');
      return;
    }

    if (data.dosage_instruction.trim()) {
      setPendingComposedText(text);
      setConfirmComposeOpen(true);
    } else {
      update('dosage_instruction', text);
      toast.success('Đã ghép phiếu cách dùng vào ô Hướng dẫn sử dụng.');
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Cảnh báo chất cấm */}
      {isBanned && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <strong>Cảnh báo chất cấm (TT 75/2025):</strong> Tên hoặc hoạt chất "
            {data.active_ingredient || data.name}" nằm trong danh mục cấm sử dụng tại Việt Nam. Không
            thể bật lưu hành sản phẩm này.
          </div>
        </div>
      )}

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
              className="text-xs h-9 font-medium"
            />
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
                className="text-xs h-8"
              />
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
                placeholder="• Bản chất & Phân loại: ...&#10;• Công dụng nông nghiệp: ...&#10;• Lưu ý khi dùng: ..."
                value={data.description}
                onChange={(e) => update('description', e.target.value)}
                rows={4}
                maxLength={DESCRIPTION_MAX}
                className="text-xs leading-relaxed font-sans"
              />
            ) : (
              <div className="p-2.5 bg-muted/20 rounded-lg border border-border text-xs leading-relaxed min-h-[90px] whitespace-pre-line text-foreground">
                {data.description.trim() || (
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

      {/* ================= KHỐI RỘNG HẾT TRANG: CÁCH DÙNG CHUNG & LIỀU LƯỢNG ================= */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/50 pb-2.5">
          <div>
            <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4 text-primary" />
              <span>CÁCH DÙNG CHUNG & LIỀU LƯỢNG</span>
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Áp dụng cho mọi bệnh của sản phẩm này. Trợ lý Lavi sẽ đọc nguyên văn ô bên dưới.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleComposeUsage}
              disabled={isUsageEmpty(data.usage_profile)}
              className="h-7 text-xs font-semibold gap-1 text-primary border-primary/30 hover:bg-primary/10"
              title="Ghép các trường trong phiếu thành câu văn đưa vào Hướng dẫn sử dụng"
            >
              <Wand2 className="w-3 h-3" />
              <span>Ghép vào Hướng dẫn sử dụng</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsUsageEditorOpen(!isUsageEditorOpen)}
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <span>{isUsageEditorOpen ? 'Thu gọn phiếu' : 'Mở để sửa'}</span>
              {isUsageEditorOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Tóm tắt phiếu cách dùng khi thu gọn */}
        <div className="p-2.5 rounded-lg border border-border/60 bg-muted/20 text-xs">
          <div className="text-[11px] font-semibold text-muted-foreground mb-1">
            ▸ Tóm tắt phiếu cách dùng chung:
          </div>
          <p className="font-medium text-foreground leading-relaxed">
            {formatUsageProfileSummary(data.usage_profile)}
          </p>
        </div>

        {/* Khung sửa chi tiết phiếu cách dùng (UsageProfileEditor) */}
        {isUsageEditorOpen && (
          <div className="pt-2">
            <UsageProfileEditor
              value={data.usage_profile}
              onChange={(next) => update('usage_profile', next)}
              isSupply={isSupply}
              onCompose={handleComposeUsage}
            />
          </div>
        )}

        {/* Hướng dẫn sử dụng / Liều lượng (Textarea 3-6 dòng, luôn hiện) */}
        <div className="space-y-1.5 pt-2">
          <label className="font-semibold block text-foreground">
            Hướng dẫn sử dụng / Liều lượng (Trợ lý Lavi đọc trực tiếp ô này)
          </label>
          <Textarea
            value={data.dosage_instruction}
            onChange={(e) => update('dosage_instruction', e.target.value)}
            placeholder={
              isSupply
                ? 'Sử dụng theo diện tích canh tác và hướng dẫn của nhà sản xuất'
                : 'Pha 50g cho bình 16 lít nước, phun ướt đều 2 mặt lá...'
            }
            rows={Math.min(6, Math.max(3, data.dosage_instruction.split('\n').length + 1))}
            className="text-xs font-mono leading-relaxed bg-background"
          />
          <p className="text-[11px] text-muted-foreground leading-normal">
            Trợ lý Lavi đọc nguyên văn ô này; con số liều lượng phải có ở đây thì Lavi mới được phép
            trả lời nông dân (chống bịa đặt thông số).
          </p>
        </div>
      </div>

      {/* Dialog xác nhận ghi đè khi ghép phiếu */}
      <Dialog open={confirmComposeOpen} onOpenChange={setConfirmComposeOpen}>
        <DialogContent className="max-w-md p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Thay nội dung hiện có?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Ô "Hướng dẫn sử dụng" hiện đã có nội dung. Bạn có muốn thay thế toàn bộ bằng kết quả
              ghép từ phiếu cách dùng không?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmComposeOpen(false)}
              className="text-xs"
            >
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                update('dosage_instruction', pendingComposedText);
                setConfirmComposeOpen(false);
                toast.success('Đã cập nhật Hướng dẫn sử dụng từ phiếu.');
              }}
              className="text-xs"
            >
              Thay thế
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
