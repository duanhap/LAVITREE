import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Search,
  BookOpen,
  Trash2,
  FileText,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Layers,
  Sparkles,
  Pencil,
  Check,
  ExternalLink,
  Settings,
  Save,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/common/EmptyState';
import { EvidenceCard } from './EvidenceCard';
import { DiseaseUsageRule, type SaveDiseaseRulePayload } from './DiseaseUsageRule';
import { UsageProfileEditor } from '@/features/admin/components/UsageProfileEditor';
import type { GroupedDiseaseRow, ProductUsageRuleItem } from '../types';
import type { UsageProfile, DiseaseUsageRuleProfile } from '@/features/admin/lib/usage-profile';
import { isUsageEmpty, emptyUsageProfile, formatUsageText } from '@/features/admin/lib/usage-profile';

interface Props {
  rows: GroupedDiseaseRow[];
  mode?: 'admin' | 'public';
  productName?: string;
  defaultProfile?: UsageProfile | null;
  defaultDosage?: string;
  diseaseRules?: Record<string, DiseaseUsageRuleProfile> | null;
  plantRules?: Record<string, DiseaseUsageRuleProfile> | null;
  usageRules?: ProductUsageRuleItem[] | null;
  isSupply?: boolean;
  phiDays?: number | null;
  onSaveDiseaseRule?: (modelClass: string, payload: SaveDiseaseRulePayload) => Promise<void>;
  onSaveCropRule?: (plantName: string, payload: SaveDiseaseRulePayload) => Promise<void>;
  onVerifyDiseaseRule?: (ruleId: number, verified: boolean) => Promise<void>;
  onResetDiseaseRule?: (modelClass: string, ruleId?: number) => Promise<void>;
  onRemoveDisease?: (modelClass: string) => Promise<void>;
  onAddDisease?: (modelClass: string) => Promise<void>;
  onUnlinkSnippet?: (suggestionId: number) => Promise<void>;
  unlinkingId?: number | null;
  availableClasses?: Array<{ classCode: string; diseaseName: string; plantName: string }>;
}

const getPlantEmoji = (plantName?: string | null): string => {
  if (!plantName) return '🌱';
  const p = plantName.toLowerCase();
  if (p.includes('cà chua') || p.includes('tomato')) return '🍅';
  if (p.includes('ngô') || p.includes('bắp') || p.includes('corn') || p.includes('maize')) return '🌽';
  if (p.includes('nho') || p.includes('grape')) return '🍇';
  if (p.includes('khoai tây') || p.includes('potato')) return '🥔';
  if (p.includes('lúa') || p.includes('gạo') || p.includes('rice')) return '🌾';
  if (p.includes('táo') || p.includes('apple')) return '🍎';
  if (p.includes('ớt') || p.includes('pepper')) return '🌶️';
  if (p.includes('cam') || p.includes('quýt') || p.includes('bưởi') || p.includes('citrus')) return '🍊';
  if (p.includes('dưa hấu') || p.includes('watermelon')) return '🍉';
  if (p.includes('dưa chuột') || p.includes('cucumber')) return '🥒';
  if (p.includes('dâu tây') || p.includes('strawberry')) return '🍓';
  return '🌿';
};

interface CropGroupData {
  plantName: string;
  rawPlantName: string;
  diseases: GroupedDiseaseRow[];
  cropRule?: DiseaseUsageRuleProfile | null;
  cropDosageText: string;
  cropProfile?: UsageProfile | null;
}

export const DiseaseEvidenceList: React.FC<Props> = ({
  rows,
  mode = 'admin',
  productName = '',
  defaultProfile,
  defaultDosage = '',
  diseaseRules,
  plantRules,
  usageRules,
  isSupply = false,
  phiDays = null,
  onSaveDiseaseRule,
  onSaveCropRule,
  onVerifyDiseaseRule,
  onResetDiseaseRule,
  onRemoveDisease,
  onAddDisease,
  onUnlinkSnippet,
  unlinkingId,
  availableClasses = [],
}) => {
  // Trạng thái mở xem căn cứ / bài báo cho từng dòng bệnh
  const [openSnippetsMap, setOpenSnippetsMap] = useState<Record<string, boolean>>({});
  // Trạng thái chỉnh sửa liều lượng cây trồng nào
  const [editingCropPlant, setEditingCropPlant] = useState<string | null>(null);
  const [cropEditText, setCropEditText] = useState<string>('');
  const [cropEditProfile, setCropEditProfile] = useState<UsageProfile>(emptyUsageProfile());
  const [isSavingCrop, setIsSavingCrop] = useState<boolean>(false);

  // Trạng thái tùy chỉnh liều riêng cho bệnh cá biệt nào (nếu cần)
  const [customizingDiseaseClass, setCustomizingDiseaseClass] = useState<string | null>(null);

  const [addDiseaseModalOpen, setAddDiseaseModalOpen] = useState<boolean>(false);
  const [diseaseSearchTerm, setDiseaseSearchTerm] = useState<string>('');
  const [confirmRemoveClass, setConfirmRemoveClass] = useState<GroupedDiseaseRow | null>(null);
  const [isRemoving, setIsRemoving] = useState<boolean>(false);
  const [selectedPlant, setSelectedPlant] = useState<string>('');

  // TASK-28: Gom nhóm danh sách bệnh theo từng Cây trồng
  const cropGroups = useMemo<CropGroupData[]>(() => {
    const map = new Map<string, CropGroupData>();

    for (const row of rows) {
      const rawPlant = (row.plantName || 'Cây trồng').trim();
      const plant = rawPlant.replace(/^Cây\s+/i, '');
      const key = plant.toLowerCase();

      if (!map.has(key)) {
        // Tìm quy tắc riêng cho Cây từ plantRules (hỗ trợ case-insensitive và tiền tố Cây)
        const plantRule =
          plantRules?.[plant] ||
          plantRules?.[rawPlant] ||
          plantRules?.[`Cây ${plant}`] ||
          Object.entries(plantRules || {}).find(
            ([k]) =>
              k.toLowerCase() === plant.toLowerCase() ||
              k.toLowerCase() === rawPlant.toLowerCase() ||
              k.toLowerCase().replace(/^cây\s+/i, '') === plant.toLowerCase()
          )?.[1];

        map.set(key, {
          plantName: plant,
          rawPlantName: rawPlant,
          diseases: [],
          cropRule: plantRule || null,
          cropDosageText: plantRule?.dosage_instruction?.trim() || '',
        });
      }

      const group = map.get(key)!;
      group.diseases.push(row);

      const ruleItem = usageRules?.find(
        (r) =>
          (r.class_code && r.class_code.toLowerCase() === row.modelClass.toLowerCase()) ||
          (r.disease_name && r.disease_name.toLowerCase() === row.diseaseName.toLowerCase())
      );
      const legacyRule =
        diseaseRules?.[row.modelClass] ||
        Object.entries(diseaseRules || {}).find(
          ([k]) => k.toLowerCase() === (row.modelClass || '').toLowerCase()
        )?.[1];

      // TASK-29: khối "Liều cho Cây" chỉ lấy liều chung của cây (scope "plant"). Liều riêng của một bệnh
      // (scope "disease") hiện ở dòng của bệnh đó, không được dùng làm liều của cả cây.
      const isPlantScoped = !legacyRule?.scope || legacyRule.scope === 'plant';
      if (!group.cropRule?.dosage_instruction && isPlantScoped) {
        const diseaseDoseText = legacyRule?.dosage_instruction?.trim();
        if (diseaseDoseText) {
          // Ưu tiên đoạn hướng dẫn chi tiết dài của bệnh (ví dụ mốc sương trên cà chua)
          if (!group.cropDosageText || diseaseDoseText.length > group.cropDosageText.length) {
            group.cropDosageText = diseaseDoseText;
            if (!group.cropRule && legacyRule) {
              group.cropRule = legacyRule;
            }
          }
        } else if (!group.cropDosageText) {
          const doseFallback = legacyRule?.usage_profile?.dose_text || ruleItem?.profile?.dose_text;
          if (doseFallback?.trim()) {
            group.cropDosageText = doseFallback.trim();
          }
        }
      }

      // Kế thừa các ô thông số kỹ thuật (Profile) cho Cây trồng
      if (group.cropRule?.usage_profile && !isUsageEmpty(group.cropRule.usage_profile)) {
        group.cropProfile = group.cropRule.usage_profile;
      } else if (!group.cropProfile || isUsageEmpty(group.cropProfile)) {
        const prof = isPlantScoped
          ? (legacyRule?.usage_profile || (ruleItem?.scope === 'plant' ? ruleItem.profile : null)) || null
          : null;
        if (prof && !isUsageEmpty(prof)) {
          group.cropProfile = prof;
        } else if (defaultProfile && !isUsageEmpty(defaultProfile)) {
          group.cropProfile = defaultProfile;
        }
      }
    }

    // Chưa có chữ: chỉ lấy dose_text khi phiếu thuộc riêng cây/bệnh này.
    // KHÔNG lấy liều chung của sản phẩm (defaultDosage / defaultProfile) làm liều của Cây:
    // nút "Lưu liều" sẽ lưu đoạn này thành liều chung của cây
    // (đã làm mất đoạn liều mốc sương của Trichoderma). Liều chung chỉ hiển thị, có ghi chú riêng.
    for (const group of map.values()) {
      if (!group.cropDosageText && group.cropProfile !== defaultProfile && group.cropProfile?.dose_text?.trim()) {
        group.cropDosageText = group.cropProfile.dose_text.trim();
      }
    }

    return Array.from(map.values());
  }, [rows, plantRules, diseaseRules, usageRules, defaultProfile, defaultDosage]);

  // Bộ lọc theo tab Cây trồng (Mỗi cây 1 tab, không để ALL đầu - TASK-28)
  const activePlantName = selectedPlant || cropGroups[0]?.plantName || '';

  const visibleCropGroups = useMemo(() => {
    if (!activePlantName) return cropGroups;
    return cropGroups.filter(
      (g) =>
        g.plantName.toLowerCase() === activePlantName.toLowerCase() ||
        g.rawPlantName.toLowerCase() === activePlantName.toLowerCase()
    );
  }, [cropGroups, activePlantName]);

  const toggleSnippetRow = (modelClass: string) => {
    setOpenSnippetsMap((prev) => ({ ...prev, [modelClass]: !prev[modelClass] }));
  };

  const handleStartEditCrop = (crop: CropGroupData) => {
    setEditingCropPlant(crop.plantName);
    setCropEditText(crop.cropDosageText || '');
    setCropEditProfile(
      crop.cropProfile
        ? { ...crop.cropProfile }
        : defaultProfile
        ? { ...defaultProfile }
        : emptyUsageProfile()
    );
  };

  const handleSaveCrop = async (crop: CropGroupData) => {
    if (!onSaveCropRule) return;
    setIsSavingCrop(true);
    try {
      await onSaveCropRule(crop.plantName, {
        dosageInstruction: cropEditText.trim() || undefined,
        profile: cropEditProfile,
        sourceUrl: crop.cropRule?.source_url || undefined,
      });
      setEditingCropPlant(null);
    } finally {
      setIsSavingCrop(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!confirmRemoveClass || !onRemoveDisease) return;
    setIsRemoving(true);
    try {
      await onRemoveDisease(confirmRemoveClass.modelClass);
      setConfirmRemoveClass(null);
    } finally {
      setIsRemoving(false);
    }
  };

  // Lọc các bệnh chưa có trong danh sách cho modal "+ Thêm bệnh"
  const existingClasses = useMemo(() => {
    return new Set(rows.map((r) => r.modelClass.toLowerCase()));
  }, [rows]);

  const unassignedClasses = useMemo(() => {
    return availableClasses.filter((c) => !existingClasses.has(c.classCode.toLowerCase()));
  }, [availableClasses, existingClasses]);

  const filteredUnassignedClasses = useMemo(() => {
    const q = diseaseSearchTerm.trim().toLowerCase();
    if (!q) return unassignedClasses;
    return unassignedClasses.filter(
      (c) =>
        c.diseaseName.toLowerCase().includes(q) ||
        c.plantName.toLowerCase().includes(q) ||
        c.classCode.toLowerCase().includes(q)
    );
  }, [unassignedClasses, diseaseSearchTerm]);

  if (rows.length === 0) {
    return (
      <div className="py-8">
        <EmptyState
          title="Thuốc này chưa gắn với bệnh hại nào"
          description="Hãy thêm các bệnh hại mà thuốc này đặc trị để thiết lập liều lượng riêng và cho phép Lavi tư vấn tới nông dân."
          actionText={mode === 'admin' ? '+ Thêm bệnh cho thuốc này' : undefined}
          onAction={mode === 'admin' ? () => setAddDiseaseModalOpen(true) : undefined}
        />
        {mode === 'admin' && (
          <div className="text-center mt-3">
            <Link
              to={`/admin/inventory?tab=suggestions&search=${encodeURIComponent(productName)}`}
              className="text-xs text-primary hover:underline font-semibold"
            >
              Tìm trong Gợi ý từ bài báo →
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Thanh công cụ danh sách bệnh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-border bg-card">
        <div>
          <h3 className="font-bold text-foreground text-sm sm:text-base">
            Danh sách bệnh điều trị ({rows.length} bệnh trên {cropGroups.length} cây trồng)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quản lý liều lượng theo từng loại cây trồng và danh mục bệnh hại đặc trị tương ứng.
          </p>
        </div>

        {mode === 'admin' && onAddDisease && (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setDiseaseSearchTerm('');
              setAddDiseaseModalOpen(true);
            }}
            className="h-8 text-xs gap-1.5 font-bold self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm bệnh điều trị</span>
          </Button>
        )}
      </div>

      {/* TASK-28: Tab Cây trồng (Mỗi cây 1 tab, không để ALL đầu) */}
      {cropGroups.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {cropGroups.map((g) => {
            const isActive = activePlantName.toLowerCase() === g.plantName.toLowerCase();
            return (
              <button
                key={g.plantName}
                type="button"
                onClick={() => setSelectedPlant(g.plantName)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span>{getPlantEmoji(g.plantName)} Cây {g.plantName}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isActive
                      ? 'bg-primary-foreground/25 text-primary-foreground font-bold'
                      : 'bg-background/80 text-muted-foreground'
                  }`}
                >
                  {g.diseases.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* TASK-28: HIỂN THỊ CÁC KHỐI GOM NHÓM THEO CÂY TRỒNG */}
      <div className="space-y-6">
        {visibleCropGroups.map((crop) => {
          const isEditingCrop = editingCropPlant === crop.plantName;
          const cropDosage = crop.cropDosageText;
          const productDefaultDosage = defaultDosage?.trim() || '';

          return (
            <div
              key={crop.plantName}
              className="rounded-2xl border border-border/90 bg-card overflow-hidden shadow-2xs space-y-0 transition-all"
            >
              {/* HEADER CÂY TRỒNG */}
              <div className="bg-muted/30 p-4 border-b border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl p-2 rounded-xl bg-background border border-border shadow-2xs leading-none">
                    {getPlantEmoji(crop.plantName)}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-extrabold text-base text-foreground">
                        Cây {crop.plantName}
                      </h4>
                      <Badge className="bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold">
                        {crop.diseases.length} bệnh đặc trị
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Áp dụng liều lượng và phác đồ chuyên biệt cho cây trồng này
                    </p>
                  </div>
                </div>

                {mode === 'admin' && onAddDisease && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDiseaseSearchTerm(crop.plantName);
                      setAddDiseaseModalOpen(true);
                    }}
                    className="h-8 text-xs gap-1.5 font-bold self-start sm:self-auto bg-background hover:bg-muted"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm bệnh cho Cây {crop.plantName}</span>
                  </Button>
                )}
              </div>

              <div className="p-4 sm:p-5 space-y-5">
                {/* 1. KHỐI LIỀU LƯỢNG KHUYẾN CÁO CHO CÂY {plantName} */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                      <h5 className="font-extrabold text-sm text-foreground">
                        💧 Liều lượng khuyến cáo cho Cây {crop.plantName}:
                      </h5>
                    </div>

                    {mode === 'admin' && onSaveCropRule && !isEditingCrop && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          onClick={() => handleStartEditCrop(crop)}
                          className="h-7 text-xs font-bold gap-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Chỉnh sửa liều Cây {crop.plantName}</span>
                        </Button>

                        {/* TASK-29: không còn nút "Đồng bộ cho n bệnh": mọi bệnh của cây tự dùng liều chung này */}
                      </div>
                    )}
                  </div>

                  {/* Khi đang chỉnh sửa liều cây (Mở trực tiếp form 1-click, dùng UsageProfileEditor chuẩn như form gán/tạo sản phẩm) */}
                  {isEditingCrop ? (
                    <div className="p-4 rounded-xl border border-emerald-500/40 bg-card shadow-xs space-y-3.5">
                      <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
                        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs sm:text-sm">
                          <Pencil className="w-4 h-4 text-emerald-600" />
                          <span>Thiết lập Phiếu cách dùng & Liều lượng cho Cây {crop.plantName}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingCropPlant(null)}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          <span>Hủy</span>
                        </Button>
                      </div>

                      {/* Thanh tra cứu Google nhãn thuốc */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 bg-muted/30 rounded-lg border border-border/60">
                        {(() => {
                          const q = encodeURIComponent(`${productName || 'Thuốc BVTV'} liều lượng cách dùng trên cây ${crop.plantName}`);
                          return (
                            <a
                              href={`https://www.google.com/search?q=${q}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 font-medium text-[11px]"
                            >
                              <Search className="w-3 h-3" />
                              <span>Tra Google nhãn thuốc &amp; liều dùng Cây {crop.plantName}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          );
                        })()}
                        <span className="text-[11px] text-muted-foreground">
                          Áp dụng đồng bộ cho {crop.diseases.length} bệnh hại trên Cây {crop.plantName}
                        </span>
                      </div>

                      {/* 1. Phiếu cách dùng UsageProfileEditor (giống hệt form gán và tạo sản phẩm từ vật tư) */}
                      <div className="border border-border/80 rounded-xl p-3 bg-muted/20 space-y-3">
                        <UsageProfileEditor
                          value={cropEditProfile}
                          onChange={setCropEditProfile}
                          isSupply={isSupply}
                          onCompose={() => {
                            const text = formatUsageText(cropEditProfile, phiDays, isSupply);
                            if (text) setCropEditText(text);
                          }}
                        />

                        {/* 2. Textarea Hướng dẫn sử dụng / Liều lượng */}
                        <div className="space-y-1.5 pt-1">
                          <label className="text-xs font-semibold block text-foreground">
                            Hướng dẫn sử dụng / Liều lượng (Trợ lý Lavi sẽ đọc cho nông dân):
                          </label>
                          <Textarea
                            value={cropEditText}
                            onChange={(e) => setCropEditText(e.target.value)}
                            rows={5}
                            placeholder={
                              defaultDosage?.trim()
                                ? `Nhập hướng dẫn liều dùng cho Cây ${crop.plantName}. Liều chung của sản phẩm (tham khảo): ${defaultDosage.trim()}`
                                : `Nhập hướng dẫn liều dùng cho Cây ${crop.plantName}...`
                            }
                            className="text-xs leading-relaxed font-medium bg-background"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Đoạn này áp dụng cho mọi bệnh của Cây {crop.plantName} trong sản phẩm, trừ bệnh đã đặt liều riêng. Chỉnh câu chữ tùy ý rồi bấm Lưu bên dưới.
                          </p>
                        </div>
                      </div>

                      {/* Nút hành động */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isSavingCrop}
                          onClick={() => setEditingCropPlant(null)}
                          className="h-8 text-xs"
                        >
                          Hủy bỏ
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isSavingCrop}
                          onClick={() => handleSaveCrop(crop)}
                          className="h-8 text-xs font-bold gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{isSavingCrop ? 'Đang lưu...' : `💾 Lưu liều chung cho Cây ${crop.plantName}`}</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Chế độ xem: Hiển thị văn bản liều lượng kèm các ô kỹ thuật */
                    <div className="p-3.5 rounded-lg bg-card border border-border/80 space-y-2.5 shadow-2xs">
                      <p className="text-xs text-foreground leading-relaxed font-medium whitespace-pre-line">
                        {cropDosage || (
                          <>
                            {productDefaultDosage && (
                              <span className="block mb-1">{productDefaultDosage}</span>
                            )}
                            <span className="text-muted-foreground italic">
                              {productDefaultDosage
                                ? 'Trên đây là liều chung của sản phẩm. '
                                : ''}
                              Chưa có liều riêng cho Cây {crop.plantName}. Bấm &quot;Chỉnh sửa liều Cây {crop.plantName}&quot; ở trên để thiết lập.
                            </span>
                          </>
                        )}
                      </p>

                      {/* CÁC Ô THÔNG SỐ KỸ THUẬT HIỂN THỊ RÕ RÀNG */}
                      {crop.cropProfile && !isUsageEmpty(crop.cropProfile) && (
                        <div className="pt-2 border-t border-border/50 space-y-1.5">
                          <span className="font-semibold text-foreground text-[11px] block">
                            {crop.cropProfile === defaultProfile
                              ? 'Thông số chung của sản phẩm (chưa có liều riêng cho cây này):'
                              : 'Thông số kỹ thuật áp dụng:'}
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                            {crop.cropProfile.dose_amount && (
                              <div className="p-2 rounded-lg bg-muted/40 border border-border/60">
                                <span className="text-muted-foreground block text-[10px]">Liều pha:</span>
                                <strong className="text-foreground">{crop.cropProfile.dose_amount} {crop.cropProfile.dose_unit || ''}</strong>
                              </div>
                            )}
                            {crop.cropProfile.water_liters && (
                              <div className="p-2 rounded-lg bg-muted/40 border border-border/60">
                                <span className="text-muted-foreground block text-[10px]">Lượng nước:</span>
                                <strong className="text-foreground">{crop.cropProfile.water_liters} lít / bình</strong>
                              </div>
                            )}
                            {crop.cropProfile.dose_per_area && (
                              <div className="p-2 rounded-lg bg-muted/40 border border-border/60 col-span-2 sm:col-span-1">
                                <span className="text-muted-foreground block text-[10px]">Liều theo diện tích:</span>
                                <strong className="text-foreground">
                                  {crop.cropProfile.dose_per_area.min && crop.cropProfile.dose_per_area.max && crop.cropProfile.dose_per_area.min !== crop.cropProfile.dose_per_area.max
                                    ? `${crop.cropProfile.dose_per_area.min}–${crop.cropProfile.dose_per_area.max}`
                                    : crop.cropProfile.dose_per_area.min || crop.cropProfile.dose_per_area.max}{' '}
                                  {crop.cropProfile.dose_per_area.unit || ''}
                                </strong>
                              </div>
                            )}
                            {crop.cropProfile.method && (
                              <div className="p-2 rounded-lg bg-muted/40 border border-border/60 col-span-2">
                                <span className="text-muted-foreground block text-[10px]">Cách dùng:</span>
                                <strong className="text-foreground">{crop.cropProfile.method}</strong>
                              </div>
                            )}
                            {crop.cropProfile.interval_days && (
                              <div className="p-2 rounded-lg bg-muted/40 border border-border/60">
                                <span className="text-muted-foreground block text-[10px]">Cách nhau:</span>
                                <strong className="text-foreground">
                                  {typeof crop.cropProfile.interval_days === 'object'
                                    ? `${crop.cropProfile.interval_days.min || ''}–${crop.cropProfile.interval_days.max || ''} ngày`
                                    : `${crop.cropProfile.interval_days} ngày`}
                                </strong>
                              </div>
                            )}
                            {crop.cropProfile.time_of_day && crop.cropProfile.time_of_day.length > 0 && (
                              <div className="p-2 rounded-lg bg-muted/40 border border-border/60">
                                <span className="text-muted-foreground block text-[10px]">Thời điểm:</span>
                                <strong className="text-foreground">{crop.cropProfile.time_of_day.join(', ')}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. KHỐI DANH MỤC CÁC BỆNH HẠI THUỘC CÂY TRỒNG NÀY */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Danh mục bệnh hại trên Cây {crop.plantName} ({crop.diseases.length} bệnh):
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Bấm vào bệnh để xem căn cứ trích dẫn
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {crop.diseases.map((row) => {
                      const isSnippetOpen = !!openSnippetsMap[row.modelClass];
                      const isCustomizing = customizingDiseaseClass === row.modelClass;

                      // Kiểm tra xem bệnh này có quy tắc riêng độc lập không
                      const ruleItem = usageRules?.find(
                        (r) =>
                          (r.class_code && r.class_code.toLowerCase() === row.modelClass.toLowerCase()) ||
                          (r.disease_name && r.disease_name.toLowerCase() === row.diseaseName.toLowerCase())
                      );
                      const legacyRule = diseaseRules?.[row.modelClass];
                      const effectiveRule = ruleItem || legacyRule;

                      const isVerified = Boolean(effectiveRule?.is_verified);
                      const actionGroup = ruleItem?.action_group;

                      const diseaseDoseText =
                        (effectiveRule && 'dosage_instruction' in effectiveRule
                          ? effectiveRule.dosage_instruction
                          : effectiveRule && 'profile' in effectiveRule
                          ? effectiveRule.profile?.dose_text
                          : '') || '';

                      // Có liều riêng đặc thù nếu khác liều cây
                      const hasSpecificOverride = Boolean(
                        diseaseDoseText &&
                          crop.cropDosageText &&
                          diseaseDoseText.trim() !== crop.cropDosageText.trim()
                      );

                      return (
                        <div
                          key={row.modelClass}
                          className="rounded-xl border border-border/80 bg-background shadow-2xs overflow-hidden transition-all"
                        >
                          {/* Hàng thông tin tóm tắt bệnh */}
                          <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-muted/15 transition-colors">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span className="text-base">🦠</span>
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Link
                                    to={`/handbook/${encodeURIComponent(row.modelClass)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-bold text-sm text-foreground hover:text-primary transition-colors hover:underline truncate"
                                    title="Xem trang chi tiết bệnh này trong Sổ tay"
                                  >
                                    {row.diseaseName}
                                  </Link>

                                  {actionGroup && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] font-mono font-semibold text-blue-700 dark:text-blue-400 bg-blue-500/10 border-blue-500/20 flex items-center gap-1"
                                    >
                                      <Layers className="w-2.5 h-2.5" />
                                      <span>{actionGroup}</span>
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  {hasSpecificOverride ? (
                                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                      <ShieldAlert className="w-3 h-3" />
                                      <span>Liều riêng đặc thù</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                      <ShieldCheck className="w-3 h-3" />
                                      <span>Dùng liều Cây {crop.plantName}</span>
                                    </span>
                                  )}

                                  {row.articles.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => toggleSnippetRow(row.modelClass)}
                                      className="inline-flex items-center gap-1 text-[10.5px] font-medium text-primary bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                                      title="Xem các bài báo khoa học chứng minh hiệu quả"
                                    >
                                      <BookOpen className="w-3 h-3" />
                                      <span>{row.articles.length} bài báo tham khảo</span>
                                      {isSnippetOpen ? (
                                        <ChevronUp className="w-3 h-3" />
                                      ) : (
                                        <ChevronDown className="w-3 h-3" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Các nút hành động cho bệnh */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {mode === 'admin' && onSaveDiseaseRule && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setCustomizingDiseaseClass(
                                      isCustomizing ? null : row.modelClass
                                    )
                                  }
                                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                                  title="Tùy chỉnh riêng cho bệnh này (nếu khác liều chung của cây)"
                                >
                                  <Settings className="w-3 h-3 mr-1" />
                                  <span className="hidden sm:inline">
                                    {isCustomizing ? 'Đóng' : 'Tùy chỉnh'}
                                  </span>
                                </Button>
                              )}

                              {mode === 'admin' && onRemoveDisease && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setConfirmRemoveClass(row)}
                                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  title={`Gỡ bệnh ${row.diseaseName} khỏi sản phẩm`}
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  <span className="hidden sm:inline">Gỡ</span>
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* FORM TÙY CHỈNH RIÊNG CHO BỆNH (NẾU CÓ) */}
                          {isCustomizing && onSaveDiseaseRule && (
                            <div className="p-3.5 bg-muted/20 border-t border-border/60">
                              <div className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                                <Settings className="w-3.5 h-3.5 text-primary" />
                                <span>Thiết lập liều đặc thù cho bệnh {row.diseaseName}</span>
                              </div>
                              <DiseaseUsageRule
                                modelClass={row.modelClass}
                                plantName={row.plantName}
                                diseaseName={row.diseaseName}
                                rule={effectiveRule}
                                defaultProfile={defaultProfile}
                                defaultDosage={crop.cropDosageText || defaultDosage}
                                isSupply={isSupply}
                                phiDays={phiDays}
                                onSaveRule={onSaveDiseaseRule}
                                onVerifyRule={onVerifyDiseaseRule}
                                onResetToDefault={onResetDiseaseRule}
                              />
                            </div>
                          )}

                          {/* KHỐI HIỂN THỊ CĂN CỨ BÀI BÁO THAM KHẢO KHI BẤM XEM */}
                          {isSnippetOpen && (
                            <div className="p-3.5 sm:p-4 bg-muted/15 border-t border-border/60 space-y-3">
                              <div className="flex items-center justify-between text-xs font-bold text-foreground pb-1 border-b border-border/40">
                                <div className="flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-primary" />
                                  <span>Tài liệu tham khảo cho {row.diseaseName} ({row.articles.length} bài)</span>
                                </div>
                                {mode === 'admin' && (
                                  <Link
                                    to={`/admin/inventory?tab=suggestions&search=${encodeURIComponent(productName)}`}
                                    className="text-primary hover:underline text-[11px]"
                                  >
                                    Tìm thêm bài báo →
                                  </Link>
                                )}
                              </div>

                              <div className="space-y-3">
                                {row.articles.map((article, aIdx) => (
                                  <EvidenceCard
                                    key={aIdx}
                                    article={article}
                                    mode={mode}
                                    onUnlinkSnippet={onUnlinkSnippet}
                                    unlinkingId={unlinkingId}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL THÊM BỆNH ĐIỀU TRỊ */}
      <Dialog open={addDiseaseModalOpen} onOpenChange={setAddDiseaseModalOpen}>
        <DialogContent className="max-w-md p-5 rounded-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Thêm bệnh vào danh mục điều trị
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Chọn bệnh hại mà thuốc này đặc trị để thiết lập phiếu lên lịch và hướng dẫn sử dụng.
            </DialogDescription>
          </DialogHeader>

          <div className="relative my-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={diseaseSearchTerm}
              onChange={(e) => setDiseaseSearchTerm(e.target.value)}
              placeholder="Tìm theo tên bệnh, tên cây hoặc mã..."
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[300px]">
            {filteredUnassignedClasses.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground italic">
                {diseaseSearchTerm
                  ? 'Không tìm thấy bệnh hại phù hợp với từ khóa.'
                  : 'Tất cả các bệnh trong hệ thống đã được thêm vào sản phẩm này.'}
              </div>
            ) : (
              filteredUnassignedClasses.map((item) => (
                <div
                  key={item.classCode}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 hover:bg-muted/30 transition-colors text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-foreground truncate">{item.diseaseName}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      Cây: <span className="font-medium text-foreground">{item.plantName}</span> • Mã: <span className="font-mono">{item.classCode}</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (onAddDisease) {
                        onAddDisease(item.classCode);
                        setAddDiseaseModalOpen(false);
                      }
                    }}
                    className="h-7 text-xs px-2.5 font-bold shrink-0"
                  >
                    Thêm bệnh
                  </Button>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-border mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddDiseaseModalOpen(false)}
              className="text-xs"
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG XÁC NHẬN GỠ BỆNH */}
      <Dialog open={!!confirmRemoveClass} onOpenChange={(open) => !open && setConfirmRemoveClass(null)}>
        <DialogContent className="max-w-md p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <span>Gỡ bệnh khỏi danh mục điều trị?</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Bạn có chắc muốn gỡ bệnh <strong>{confirmRemoveClass?.diseaseName}</strong> (Cây {confirmRemoveClass?.plantName}) khỏi sản phẩm này? Mọi phiếu quy tắc cách dùng riêng của bệnh này cũng sẽ bị hủy.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isRemoving}
              onClick={() => setConfirmRemoveClass(null)}
              className="text-xs"
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isRemoving}
              onClick={handleConfirmRemove}
              className="text-xs font-bold"
            >
              {isRemoving ? 'Đang gỡ...' : 'Xác nhận gỡ bệnh'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
