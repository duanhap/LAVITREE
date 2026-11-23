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
import { DiseaseUsageRule } from './DiseaseUsageRule';
import type { GroupedDiseaseRow } from '../types';
import type { UsageProfile, DiseaseUsageRuleProfile } from '@/features/admin/lib/usage-profile';
import { isUsageEmpty } from '@/features/admin/lib/usage-profile';

interface Props {
  rows: GroupedDiseaseRow[];
  mode?: 'admin' | 'public';
  productName?: string;
  defaultProfile?: UsageProfile | null;
  defaultDosage?: string;
  diseaseRules?: Record<string, DiseaseUsageRuleProfile> | null;
  isSupply?: boolean;
  phiDays?: number | null;
  onSaveDiseaseRule?: (modelClass: string, rule: DiseaseUsageRuleProfile) => Promise<void>;
  onResetDiseaseRule?: (modelClass: string) => Promise<void>;
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
  isSupply = false,
  phiDays = null,
  onSaveDiseaseRule,
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
          const customRule = diseaseRules?.[row.modelClass];
          const hasCustomRule = Boolean(
            customRule &&
              (customRule.dosage_instruction ||
                (customRule.usage_profile && !isUsageEmpty(customRule.usage_profile)))
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
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {hasCustomRule ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          ✓ Đã có liều lượng riêng
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          Dùng liều mặc định
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
                  {/* PHẦN 1: CÁCH DÙNG & LIỀU LƯỢNG CHO BỆNH NÀY */}
                  {onSaveDiseaseRule && (
                    <DiseaseUsageRule
                      modelClass={row.modelClass}
                      plantName={row.plantName}
                      diseaseName={row.diseaseName}
                      rule={customRule}
                      defaultProfile={defaultProfile}
                      defaultDosage={defaultDosage}
                      isSupply={isSupply}
                      phiDays={phiDays}
                      onSaveRule={onSaveDiseaseRule}
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
                      <div className="space-y-3 pt-1">
                        {row.articles.map((art) => (
                          <EvidenceCard
                            key={art.sourceUrl || art.sourceTitle}
                            article={art}
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

      {/* Modal Thêm Bệnh Điều Trị */}
      <Dialog open={addDiseaseModalOpen} onOpenChange={setAddDiseaseModalOpen}>
        <DialogContent className="max-w-md p-5 rounded-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Thêm bệnh điều trị cho thuốc này
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Chọn bệnh hại trong danh mục để liên kết và thiết lập liều lượng riêng.
            </DialogDescription>
          </DialogHeader>

          <div className="relative my-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên bệnh (đốm lá, sương mai, phấn trắng)..."
              value={diseaseSearchTerm}
              onChange={(e) => setDiseaseSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-border border rounded-xl border-border max-h-[300px]">
            {filteredUnassignedClasses.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                Không tìm thấy bệnh hại phù hợp.
              </div>
            ) : (
              filteredUnassignedClasses.map((cls) => (
                <button
                  key={cls.classCode}
                  type="button"
                  onClick={async () => {
                    if (onAddDisease) {
                      await onAddDisease(cls.classCode);
                      setAddDiseaseModalOpen(false);
                      // Mở luôn accordion bệnh vừa thêm
                      setOpenMap((prev) => ({ ...prev, [cls.classCode]: true }));
                    }
                  }}
                  className="w-full text-left p-2.5 hover:bg-muted/50 transition-colors flex items-center justify-between gap-2 group"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                      {cls.diseaseName}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {cls.plantName} • {cls.classCode}
                    </div>
                  </div>
                  <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Xác nhận gỡ bệnh */}
      <Dialog
        open={Boolean(confirmRemoveClass)}
        onOpenChange={(open) => !open && setConfirmRemoveClass(null)}
      >
        <DialogContent className="max-w-sm p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <span>Gỡ bệnh điều trị?</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
              Bạn có chắc chắn muốn bỏ bệnh{' '}
              <strong>{confirmRemoveClass?.diseaseName}</strong> ({confirmRemoveClass?.plantName}) khỏi danh sách điều trị của thuốc này? Trợ lý Lavi sẽ ngừng gợi ý thuốc này cho bệnh trên.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border mt-2">
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
              {isRemoving ? 'Đang gỡ...' : 'Gỡ bệnh'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
