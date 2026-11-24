import React, { useState, useEffect } from 'react';
import {
  CalendarClock,
  Wand2,
  Check,
  RotateCcw,
  Save,
  Pencil,
  Sparkles,
  Info,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Layers,
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
import type { ProductUsageRuleItem } from '../types';
import { toast } from 'sonner';

export interface SaveDiseaseRulePayload {
  profile: UsageProfile;
  actionGroup?: string;
  sourceUrl?: string;
  dosageInstruction?: string;
  ruleId?: number;
}

interface Props {
  modelClass: string;
  plantName: string;
  diseaseName: string;
  rule?: ProductUsageRuleItem | DiseaseUsageRuleProfile | null;
  defaultProfile?: UsageProfile | null;
  defaultDosage?: string;
  isSupply?: boolean;
  phiDays?: number | null;
  onSaveRule: (modelClass: string, payload: SaveDiseaseRulePayload) => Promise<void>;
  onVerifyRule?: (ruleId: number, verified: boolean) => Promise<void>;
  onResetToDefault?: (modelClass: string, ruleId?: number) => Promise<void>;
}

export const DiseaseUsageRule: React.FC<Props> = ({
  modelClass,
  plantName: _plantName,
  diseaseName,
  rule,
  defaultProfile,
  defaultDosage = '',
  isSupply = false,
  phiDays = null,
  onSaveRule,
  onVerifyRule,
  onResetToDefault,
}) => {
  // Trích xuất an toàn từ ProductUsageRuleItem (bảng riêng) hoặc DiseaseUsageRuleProfile (JSONB cũ)
  const ruleId = rule && 'id' in rule ? (rule as ProductUsageRuleItem).id : undefined;
  const ruleProfile: UsageProfile | null = rule
    ? ('profile' in rule ? (rule as ProductUsageRuleItem).profile : (rule as DiseaseUsageRuleProfile).usage_profile) || null
    : null;
  const ruleDosageText =
    (ruleProfile?.dose_text || (rule && 'dosage_instruction' in rule ? (rule as DiseaseUsageRuleProfile).dosage_instruction : '')) || '';
  const ruleActionGroup = rule && 'action_group' in rule ? (rule as ProductUsageRuleItem).action_group || '' : '';
  const ruleSourceUrl = rule?.source_url || '';
  const isVerified = Boolean(rule?.is_verified);
  const verifiedBy = rule && 'verified_by' in rule ? (rule as ProductUsageRuleItem).verified_by : null;
  const verifiedAt = rule && 'verified_at' in rule ? (rule as ProductUsageRuleItem).verified_at : null;

  const hasCustomRule = Boolean(
    rule && (ruleDosageText || (ruleProfile && !isUsageEmpty(ruleProfile)) || ruleActionGroup)
  );

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Local form state
  const [profile, setProfile] = useState<UsageProfile>(() => {
    if (ruleProfile) return { ...ruleProfile };
    if (defaultProfile) return { ...defaultProfile };
    return emptyUsageProfile();
  });

  const [dosageText, setDosageText] = useState<string>(() => {
    if (ruleDosageText) return ruleDosageText;
    return defaultDosage || '';
  });

  const [actionGroup, setActionGroup] = useState<string>(() => {
    return ruleActionGroup;
  });

  const [sourceUrl, setSourceUrl] = useState<string>(() => {
    return ruleSourceUrl;
  });

  // Đồng bộ lại khi rule từ bên ngoài thay đổi
  useEffect(() => {
    if (ruleProfile) {
      setProfile({ ...ruleProfile });
    } else if (defaultProfile) {
      setProfile({ ...defaultProfile });
    } else {
      setProfile(emptyUsageProfile());
    }

    if (ruleDosageText) {
      setDosageText(ruleDosageText);
    } else {
      setDosageText(defaultDosage || '');
    }

    setActionGroup(ruleActionGroup);
    setSourceUrl(ruleSourceUrl);
  }, [rule, defaultProfile, defaultDosage, ruleProfile, ruleDosageText, ruleActionGroup, ruleSourceUrl]);

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

  // Lưu quy tắc riêng cho bệnh này (TASK-22)
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const nextProfile: UsageProfile = {
        ...profile,
        dose_text: dosageText.trim() || null,
      };

      await onSaveRule(modelClass, {
        profile: nextProfile,
        actionGroup: actionGroup.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        dosageInstruction: dosageText.trim() || undefined,
        ruleId,
      });
      setIsEditing(false);
      toast.success(`Đã lưu phiếu cách dùng riêng cho bệnh ${diseaseName}!`);
    } catch {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  // Xác nhận đối chiếu với nhãn thuốc
  const handleToggleVerify = async (newStatus: boolean) => {
    if (!ruleId || !onVerifyRule) return;
    setIsVerifying(true);
    try {
      await onVerifyRule(ruleId, newStatus);
    } catch {
      // Error handled by parent
    } finally {
      setIsVerifying(false);
    }
  };

  // Khôi phục về liều mặc định (xóa phiếu riêng)
  const handleReset = async () => {
    if (!onResetToDefault) return;
    setIsResetting(true);
    try {
      await onResetToDefault(modelClass, ruleId);
      setIsEditing(false);
      toast.success(`Đã xóa liều riêng, khôi phục về liều chung cho bệnh ${diseaseName}.`);
    } catch {
      // Error handled by parent
    } finally {
      setIsResetting(false);
    }
  };

  const activeSummary = hasCustomRule
    ? formatUsageProfileSummary(ruleProfile)
    : formatUsageProfileSummary(defaultProfile);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3.5 text-xs shadow-xs">
      {/* Header trạng thái */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border/60">
        <div className="flex items-center gap-2 flex-wrap">
          <CalendarClock className="w-4 h-4 text-primary shrink-0" />
          <h4 className="font-bold text-foreground text-sm">
            Cách dùng &amp; Liều lượng cho bệnh này
          </h4>

          {/* Huy hiệu trạng thái quy tắc (TASK-22) */}
          {hasCustomRule ? (
            isVerified ? (
              <Badge variant="default" className="text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-600 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Cách dùng riêng ✓</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                <span>Cách dùng riêng · chưa đối chiếu</span>
              </Badge>
            )
          ) : (
            <Badge variant="secondary" className="text-[10px] text-muted-foreground">
              Dùng cách dùng chung
            </Badge>
          )}

          {/* Nhóm tác động FRAC / IRAC nếu có */}
          {ruleActionGroup && (
            <Badge variant="outline" className="text-[10px] font-mono font-semibold text-blue-700 dark:text-blue-400 bg-blue-500/10 border-blue-500/20 flex items-center gap-1">
              <Layers className="w-2.5 h-2.5" />
              <span>{ruleActionGroup}</span>
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
              <span>{hasCustomRule ? 'Sửa phiếu cách dùng' : 'Thiết lập cách dùng riêng'}</span>
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
          {/* Hộp xác nhận đối chiếu (Verification Box) khi đã có phiếu riêng */}
          {hasCustomRule && ruleId && (
            <div
              className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition-colors ${
                isVerified
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-950 dark:text-emerald-200'
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-950 dark:text-amber-200'
              }`}
            >
              <div className="flex items-start sm:items-center gap-2 min-w-0">
                {isVerified ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                    <span>{isVerified ? 'Đã đối chiếu nhãn/nguồn kỹ thuật' : 'Chưa đối chiếu với nhãn thuốc'}</span>
                    {ruleActionGroup && (
                      <span className="font-mono text-[11px] text-primary font-bold">
                        (Nhóm: {ruleActionGroup})
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isVerified
                      ? `Quy tắc này đã được xác nhận (bởi ${verifiedBy || 'Admin'}${
                          verifiedAt ? ` lúc ${new Date(verifiedAt).toLocaleDateString('vi-VN')}` : ''
                        }) và sẵn sàng để AI Agent lập lịch phun.`
                      : 'Chỉ các quy tắc đã được Admin đối chiếu nhãn thuốc mới được AI Agent đưa vào lịch chăm sóc (CareSchedules / CareTasks).'}
                  </p>
                </div>
              </div>

              {onVerifyRule && (
                <Button
                  type="button"
                  size="sm"
                  variant={isVerified ? 'outline' : 'default'}
                  disabled={isVerifying}
                  onClick={() => handleToggleVerify(!isVerified)}
                  className={`h-7 text-xs font-semibold shrink-0 gap-1.5 self-start sm:self-auto ${
                    isVerified
                      ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15'
                      : 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isVerifying ? 'Đang cập nhật...' : isVerified ? 'Hủy đối chiếu' : 'Xác nhận đối chiếu'}</span>
                </Button>
              )}
            </div>
          )}

          {/* Tóm tắt phiếu cách dùng */}
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

          {/* Hướng dẫn sử dụng dạng text */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground block">
              Hướng dẫn sử dụng / Liều lượng (Trợ lý Lavi đọc):
            </span>
            <div className="p-3 rounded-xl bg-background border border-border/80 font-mono text-[11px] leading-relaxed text-foreground whitespace-pre-wrap">
              {(hasCustomRule ? ruleDosageText : defaultDosage) || (
                <span className="text-muted-foreground italic font-sans">
                  Chưa có hướng dẫn sử dụng cụ thể.
                </span>
              )}
            </div>
          </div>

          {ruleSourceUrl && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
              <span className="font-semibold text-foreground">Nguồn tham khảo liều lượng chi tiết:</span>
              <a
                href={safeHref(ruleSourceUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-mono inline-flex items-center gap-1 max-w-[400px] truncate"
              >
                <span className="truncate">{ruleSourceUrl}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Chế độ chỉnh sửa (Edit Mode) */}
      {isEditing && (
        <div className="space-y-4 pt-1">
          {/* Cảnh báo quy tắc kiểm định */}
          {hasCustomRule && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-[11px] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Lưu ý kiểm định:</strong> Mọi thay đổi thông số sau khi lưu sẽ tự động chuyển về trạng thái <strong>Chưa đối chiếu</strong> để yêu cầu kiểm tra lại với nhãn thuốc thực tế.
              </span>
            </div>
          )}

          {/* 1. PHIẾU CÁCH DÙNG (LÊN LỊCH PHUN / NHẮC NHỞ) */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
              <span>1. Phiếu cách dùng (để AI Agent lập lịch phun &amp; nhắc nhở):</span>
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

          {/* 2. HƯỚNG DẪN SỬ DỤNG / LIỀU LƯỢNG */}
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

          {/* 3. NHÓM TÁC ĐỘNG FRAC / IRAC (TASK-22) */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground text-xs flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>3. Nhóm tác động luân phiên (FRAC / IRAC mã số - tùy chọn):</span>
            </label>
            <Input
              value={actionGroup}
              onChange={(e) => setActionGroup(e.target.value)}
              placeholder="VD: FRAC 4, FRAC 11, IRAC 1A..."
              maxLength={20}
              className="text-xs bg-background font-mono max-w-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Mã nhóm cơ chế tác động quốc tế (FRAC cho thuốc trừ bệnh, IRAC cho thuốc trừ sâu). AI Agent sử dụng mã này để tự động luân phiên nhóm thuốc, tránh phát sinh tính kháng thuốc.
            </p>
          </div>

          {/* 4. LINK THAM KHẢO LIỀU LƯỢNG CHI TIẾT */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground text-xs block">
              4. Link nguồn tham khảo chi tiết liều lượng (URL tùy chọn):
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
                  <span>Xóa liều riêng (Dùng cách dùng chung)</span>
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
