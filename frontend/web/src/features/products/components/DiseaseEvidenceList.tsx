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
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import type { GroupedDiseaseRow, ProductUsageRuleItem } from '../types';
import type { UsageProfile, DiseaseUsageRuleProfile } from '@/features/admin/lib/usage-profile';
import { isUsageEmpty } from '@/features/admin/lib/usage-profile';

interface Props {
  rows: GroupedDiseaseRow[];
  mode?: 'admin' | 'public';
  productName?: string;
  defaultProfile?: UsageProfile | null;
  defaultDosage?: string;
  diseaseRules?: Record<string, DiseaseUsageRuleProfile> | null;
  usageRules?: ProductUsageRuleItem[] | null;
  isSupply?: boolean;
  phiDays?: number | null;
  onSaveDiseaseRule?: (modelClass: string, payload: SaveDiseaseRulePayload) => Promise<void>;
  onVerifyDiseaseRule?: (ruleId: number, verified: boolean) => Promise<void>;
  onResetDiseaseRule?: (modelClass: string, ruleId?: number) => Promise<void>;
  onRemoveDisease?: (modelClass: string) => Promise<void>;
  onAddDisease?: (modelClass: string) => Promise<void>;
  onUnlinkSnippet?: (suggestionId: number) => Promise<void>;
  unlinkingId?: number | null;
  availableClasses?: Array<{ classCode: string; diseaseName: string; plantName: string }>;
}

export const DiseaseEvidenceList: React.FC<Props> = ({
  rows,
  mode = 'admin',
  productName = '',
  defaultProfile,
  defaultDosage = '',
  diseaseRules,
  usageRules,
  isSupply = false,
  phiDays = null,
  onSaveDiseaseRule,
  onVerifyDiseaseRule,
  onResetDiseaseRule,
  onRemoveDisease,
  onAddDisease,
  onUnlinkSnippet,
  unlinkingId,
  availableClasses = [],
}) => {
  // Mở mặc định tất cả các dòng nếu <= 3 dòng, hoặc dòng đầu tiên
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    rows.forEach((r, idx) => {
      map[r.modelClass] = rows.length <= 3 || idx === 0;
    });
    return map;
  });

  const [addDiseaseModalOpen, setAddDiseaseModalOpen] = useState<boolean>(false);
  const [diseaseSearchTerm, setDiseaseSearchTerm] = useState<string>('');
  const [confirmRemoveClass, setConfirmRemoveClass] = useState<GroupedDiseaseRow | null>(null);
  const [isRemoving, setIsRemoving] = useState<boolean>(false);

  const toggleRow = (modelClass: string) => {
    setOpenMap((prev) => ({ ...prev, [modelClass]: !prev[modelClass] }));
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
    <div className="space-y-4">
      {/* Thanh công cụ danh sách bệnh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-border bg-card">
        <div>
          <h3 className="font-bold text-foreground text-sm sm:text-base">
            Danh sách bệnh điều trị ({rows.length})
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bấm vào từng bệnh để thiết lập phiếu lên lịch phun và hướng dẫn sử dụng riêng.
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

      {/* Danh sách các Accordion bệnh */}
      <div className="space-y-3">
        {rows.map((row) => {
          const isOpen = !!openMap[row.modelClass];

          // Tìm quy tắc từ bảng ProductUsageRules trước (TASK-22), nếu không có thì fallback sang JSONB cũ
          const ruleItem = usageRules?.find(
            (r) =>
              (r.class_code && r.class_code.toLowerCase() === row.modelClass.toLowerCase()) ||
              (r.disease_name && r.disease_name.toLowerCase() === row.diseaseName.toLowerCase())
          );
          const legacyRule = diseaseRules?.[row.modelClass];
          const effectiveRule = ruleItem || legacyRule;

          const isVerified = Boolean(effectiveRule?.is_verified);
          const actionGroup = ruleItem?.action_group;

          const hasCustomRule = Boolean(
            ruleItem
              ? ruleItem.profile && (!isUsageEmpty(ruleItem.profile) || ruleItem.profile.dose_text || ruleItem.action_group)
              : legacyRule && (legacyRule.dosage_instruction || (legacyRule.usage_profile && !isUsageEmpty(legacyRule.usage_profile)))
          );

          return (
            <div
              key={row.modelClass}
              className="rounded-2xl border border-border bg-card shadow-xs transition-all overflow-hidden"
            >
              {/* Header dòng bệnh */}
              <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 border-b border-border/40 hover:bg-muted/10 transition-colors">
                <div
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  onClick={() => toggleRow(row.modelClass)}
                >
                  <button
                    type="button"
                    aria-label={isOpen ? 'Thu gọn' : 'Mở rộng'}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                  >
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-primary" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] font-bold text-primary border-primary/30 bg-primary/5 uppercase tracking-wide">
                        {row.plantName}
                      </Badge>
                      <Link
                        to={`/handbook/${encodeURIComponent(row.modelClass)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="font-bold text-sm sm:text-base text-foreground hover:text-primary transition-colors hover:underline truncate"
                        title="Xem trang chi tiết bệnh này trong Sổ tay"
                      >
                        {row.diseaseName}
                      </Link>

                      {actionGroup && (
                        <Badge variant="outline" className="text-[10px] font-mono font-semibold text-blue-700 dark:text-blue-400 bg-blue-500/10 border-blue-500/20 flex items-center gap-1">
                          <Layers className="w-2.5 h-2.5" />
                          <span>{actionGroup}</span>
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {hasCustomRule ? (
                        isVerified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Cách dùng riêng ✓</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                            <ShieldAlert className="w-3 h-3" />
                            <span>Cách dùng riêng · chưa đối chiếu</span>
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          Dùng cách dùng chung
                        </span>
                      )}

                      {row.articles.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          <BookOpen className="w-3 h-3" />
                          <span>{row.articles.length} bài báo tham khảo</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nút thao tác nhanh bên phải */}
                {mode === 'admin' && onRemoveDisease && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmRemoveClass(row);
                    }}
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                    title={`Bỏ bệnh ${row.diseaseName} khỏi sản phẩm này`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline ml-1 text-xs">Gỡ bệnh</span>
                  </Button>
                )}
              </div>

              {/* Nội dung khi mở Accordion */}
              {isOpen && (
                <div className="p-3.5 sm:p-5 bg-muted/10 space-y-4">
                  {/* PHẦN 1: CÁCH DÙNG & LIỀU LƯỢNG CHO BỆNH NÀY (TASK-22) */}
                  {onSaveDiseaseRule && (
                    <DiseaseUsageRule
                      modelClass={row.modelClass}
                      plantName={row.plantName}
                      diseaseName={row.diseaseName}
                      rule={effectiveRule}
                      defaultProfile={defaultProfile}
                      defaultDosage={defaultDosage}
                      isSupply={isSupply}
                      phiDays={phiDays}
                      onSaveRule={onSaveDiseaseRule}
                      onVerifyRule={onVerifyDiseaseRule}
                      onResetToDefault={onResetDiseaseRule}
                    />
                  )}

                  {/* PHẦN 2: BÀI BÁO THAM KHẢO TỪ TÀI LIỆU (NẾU CÓ) */}
                  <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 font-semibold border-b border-border/50">
                      <div className="flex items-center gap-1.5 text-foreground font-bold">
                        <FileText className="w-4 h-4 text-primary" />
                        <span>Tài liệu tham khảo từ bài báo ({row.articles.length} bài)</span>
                      </div>
                      {row.articles.length === 0 && mode === 'admin' && (
                        <Link
                          to={`/admin/inventory?tab=suggestions&search=${encodeURIComponent(productName)}`}
                          className="text-primary hover:underline text-[11px]"
                        >
                          Tìm trong Gợi ý từ bài báo →
                        </Link>
                      )}
                    </div>

                    {row.articles.length === 0 ? (
                      <div className="p-3.5 rounded-xl border border-dashed border-border bg-muted/20 text-center text-xs text-muted-foreground space-y-1">
                        <p>Chưa có bài báo nghiên cứu nào trong hệ thống trích dẫn thuốc này cho bệnh {row.diseaseName}.</p>
                        <p className="text-[11px]">
                          Bệnh này được Admin thêm thủ công. Trợ lý Lavi vẫn sẽ dùng liều lượng đã thiết lập ở trên để tư vấn nông dân.
                        </p>
                      </div>
                    ) : (
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
                    )}
                  </div>
                </div>
              )}
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
              Chọn bệnh hại mà thuốc này đặc trị để thiết lập phiếu lên lịch và hướng dẫn sử dụng riêng.
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
