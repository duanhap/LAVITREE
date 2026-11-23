import React, { useState, useEffect } from 'react';
import {
  CalendarClock,
  Wand2,
  Check,
  RotateCcw,
  Save,
  Pencil,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { UsageProfileEditor } from '@/features/admin/components/UsageProfileEditor';
import { safeHref } from '@/lib/utils';
import {
  type UsageProfile,
  type DiseaseUsageRuleProfile,
  emptyUsageProfile,
  formatUsageText,
  formatUsageProfileSummary,
  isUsageEmpty,
} from '@/features/admin/lib/usage-profile';
import { toast } from 'sonner';

interface Props {
  modelClass: string;
  plantName: string;
  diseaseName: string;
  rule?: DiseaseUsageRuleProfile | null;
  defaultProfile?: UsageProfile | null;
  defaultDosage?: string;
  isSupply?: boolean;
  phiDays?: number | null;
  onSaveRule: (modelClass: string, rule: DiseaseUsageRuleProfile) => Promise<void>;
  onResetToDefault?: (modelClass: string) => Promise<void>;
}

export const DiseaseUsageRule: React.FC<Props> = ({
  modelClass,
  plantName,
  diseaseName,
  rule,
  defaultProfile,
  defaultDosage = '',
  isSupply = false,
  phiDays = null,
  onSaveRule,
  onResetToDefault,
}) => {
  const hasCustomRule = Boolean(
    rule && (rule.dosage_instruction || (rule.usage_profile && !isUsageEmpty(rule.usage_profile)))
  );

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Local form state
  const [profile, setProfile] = useState<UsageProfile>(() => {
    if (rule?.usage_profile) return { ...rule.usage_profile };
    if (defaultProfile) return { ...defaultProfile };
    return emptyUsageProfile();
  });

  const [dosageText, setDosageText] = useState<string>(() => {
    if (rule?.dosage_instruction) return rule.dosage_instruction;
    return defaultDosage || '';
  });

  const [sourceUrl, setSourceUrl] = useState<string>(() => {
    return rule?.source_url || '';
  });

  // Sync state if rule changes from outside
  useEffect(() => {
    if (rule?.usage_profile) {
      setProfile({ ...rule.usage_profile });
    } else if (defaultProfile) {
      setProfile({ ...defaultProfile });
    } else {
      setProfile(emptyUsageProfile());
    }

    if (rule?.dosage_instruction) {
      setDosageText(rule.dosage_instruction);
    } else {
      setDosageText(defaultDosage || '');
    }

    setSourceUrl(rule?.source_url || '');
  }, [rule, defaultProfile, defaultDosage]);

  // Ghép phiếu thành câu văn tự nhiên
  const handleCompose = () => {
    const text = formatUsageText(profile, phiDays, isSupply);
    if (!text) {
      toast.error('Phiếu cách dùng đang trống, chưa có thông số để ghép.');
      return;
    }
    setDosageText(text);
    toast.success('Đã tự động ghép phiếu cách dùng vào ô Hướng dẫn sử dụng!');
  };

  // Lưu quy tắc riêng cho bệnh này
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveRule(modelClass, {
        dosage_instruction: dosageText.trim() || undefined,
        usage_profile: isUsageEmpty(profile) ? undefined : profile,
        source_url: sourceUrl.trim() || undefined,
        is_verified: true,
      });
      setIsEditing(false);
      toast.success(`Đã lưu liều lượng riêng cho bệnh ${diseaseName}!`);
    } catch {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  // Khôi phục về liều mặc định
  const handleReset = async () => {
    if (!onResetToDefault) return;
    setIsResetting(true);
    try {
      await onResetToDefault(modelClass);
      setIsEditing(false);
      toast.success(`Đã khôi phục về liều mặc định cho bệnh ${diseaseName}.`);
    } catch {
      // Error handled by parent
    } finally {
      setIsResetting(false);
    }
  };

  const activeSummary = hasCustomRule
    ? formatUsageProfileSummary(rule?.usage_profile)
    : formatUsageProfileSummary(defaultProfile);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3.5 text-xs shadow-xs">
      {/* Header trạng thái */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border/60">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary shrink-0" />
          <h4 className="font-bold text-foreground text-sm">
            Cách dùng &amp; Liều lượng cho bệnh này
          </h4>
          {hasCustomRule ? (
            <Badge variant="default" className="text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-600">
              ✓ Liều riêng
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] text-muted-foreground">
              Liều mặc định
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {!isEditing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-7 text-xs gap-1.5 font-semibold text-primary border-primary/30 hover:bg-primary/10"
            >
              <Pencil className="w-3 h-3" />
              <span>{hasCustomRule ? 'Sửa liều lượng' : 'Thiết lập liều riêng'}</span>
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCompose}
                className="h-7 text-xs font-semibold gap-1 text-primary border-primary/30 hover:bg-primary/10"
                title="Tự động ghép số từ phiếu vào ô Hướng dẫn sử dụng"
              >
                <Wand2 className="w-3 h-3" />
                <span className="hidden sm:inline">Ghép vào HDSD</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
                className="h-7 text-xs"
              >
                Đóng
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Chế độ xem tóm tắt (View Mode) */}
      {!isEditing && (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-1.5">
            <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <Info className="w-3 h-3 text-primary" />
              <span>
                {hasCustomRule
                  ? 'Tóm tắt phiếu lịch phun riêng:'
                  : 'Đang áp dụng phiếu cách dùng mặc định của sản phẩm:'}
              </span>
            </div>
            <p className="font-medium text-foreground leading-relaxed">
              {activeSummary}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground block">
              Hướng dẫn sử dụng / Liều lượng (Trợ lý Lavi đọc):
            </span>
            <div className="p-3 rounded-xl bg-background border border-border/80 font-mono text-[11px] leading-relaxed text-foreground whitespace-pre-wrap">
              {(hasCustomRule ? rule?.dosage_instruction : defaultDosage) || (
                <span className="text-muted-foreground italic font-sans">
                  Chưa có hướng dẫn sử dụng cụ thể.
                </span>
              )}
            </div>
          </div>

          {rule?.source_url && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
              <span className="font-semibold text-foreground">Nguồn tham khảo liều lượng chi tiết:</span>
              <a
                href={safeHref(rule.source_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-mono inline-flex items-center gap-1 max-w-[400px] truncate"
              >
                <span className="truncate">{rule.source_url}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Chế độ chỉnh sửa (Edit Mode) */}
      {isEditing && (
        <div className="space-y-4 pt-1">
          {/* PHIẾU CÁCH DÙNG (LÊN LỊCH PHUN / NHẮC NHỞ) */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
              <span>1. Phiếu cách dùng (để lên lịch phun &amp; nhắc nhở):</span>
              <span className="text-[10px] text-muted-foreground">Điền số hoặc để trống</span>
            </div>

            <div className="p-3 bg-muted/15 rounded-xl border border-border/70">
              <UsageProfileEditor
                value={profile}
                onChange={setProfile}
                isSupply={isSupply}
                onCompose={handleCompose}
              />
            </div>
          </div>

          {/* HƯỚNG DẪN SỬ DỤNG / LIỀU LƯỢNG */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-foreground text-xs">
                2. Hướng dẫn sử dụng / Liều lượng (Trợ lý Lavi đọc trực tiếp):
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCompose}
                className="h-6 text-[11px] text-primary gap-1 hover:bg-primary/10"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Ghép từ phiếu trên</span>
              </Button>
            </div>

            <Textarea
              value={dosageText}
              onChange={(e) => setDosageText(e.target.value)}
              placeholder="VD: Pha 50g cho bình 16 lít nước, phun ướt đều tán lá khi bệnh mới xuất hiện..."
              rows={4}
              className="text-xs font-mono leading-relaxed bg-background"
            />
            <p className="text-[11px] text-muted-foreground leading-normal">
              Trợ lý Lavi đọc nguyên văn ô này khi tư vấn cho bệnh <strong>{diseaseName}</strong>. Nông dân xem thuốc cũng sẽ thấy hướng dẫn này.
            </p>
          </div>

          {/* LINK THAM KHẢO LIỀU LƯỢNG CHI TIẾT */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground text-xs block">
              3. Link nguồn tham khảo chi tiết liều lượng (URL tùy chọn):
            </label>
            <Input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="Dán link bài viết hướng dẫn chi tiết hoặc link nhãn thuốc của hãng..."
              className="text-xs bg-background font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Đường dẫn đến bài viết kỹ thuật hoặc nhãn thuốc của hãng dùng làm căn cứ đối chiếu cho liều lượng bệnh này.
            </p>
          </div>

          {/* THANH THAO TÁC LƯU */}
          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <div>
              {hasCustomRule && onResetToDefault && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isResetting || isSaving}
                  onClick={handleReset}
                  className="h-8 text-xs text-destructive hover:bg-destructive/10 gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Xóa liều riêng (Về mặc định)</span>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
                className="h-8 text-xs"
              >
                Hủy
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isSaving}
                onClick={handleSave}
                className="h-8 text-xs gap-1.5 font-bold"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Đang lưu...' : 'Lưu liều lượng'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
