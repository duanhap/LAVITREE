import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Search,
  BookOpen,
  Sprout,
  X,
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
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/common/EmptyState';
import { EvidenceCard } from './EvidenceCard';
import { DiseaseUsageRule } from './DiseaseUsageRule';
import type { GroupedDiseaseRow } from '../types';
import type { UsageProfile } from '@/features/admin/lib/usage-profile';

interface Props {
  rows: GroupedDiseaseRow[];
  mode?: 'admin' | 'public';
  productName?: string;
  defaultProfile?: UsageProfile | null;
  onToggleRecommendation?: (modelClass: string, isRecommended: boolean) => Promise<void>;
  onAddDisease?: (modelClass: string) => Promise<void>;
  onUnlinkSnippet?: (suggestionId: number) => Promise<void>;
  unlinkingId?: number | null;
  onSwitchToGeneralTab?: () => void;
  availableClasses?: Array<{ classCode: string; diseaseName: string; plantName: string }>;
  isToggling?: boolean;
}

export const DiseaseEvidenceList: React.FC<Props> = ({
  rows,
  mode = 'admin',
  productName = '',
  defaultProfile,
  onToggleRecommendation,
  onAddDisease,
  onUnlinkSnippet,
  unlinkingId,
  onSwitchToGeneralTab,
  availableClasses = [],
  isToggling = false,
}) => {
  // Mở mặc định: các dòng SUPPORTED nếu tổng số bài <= 4, hoặc ít nhất dòng đầu
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    const totalArticles = rows.reduce((acc, r) => acc + r.articles.length, 0);

    rows.forEach((r, idx) => {
      if (idx === 0) {
        map[r.modelClass] = true;
      } else if (totalArticles <= 4 && r.status === 'SUPPORTED') {
        map[r.modelClass] = true;
      } else {
        map[r.modelClass] = false;
      }
    });
    return map;
  });

  const [addDiseaseModalOpen, setAddDiseaseModalOpen] = useState<boolean>(false);
  const [diseaseSearchTerm, setDiseaseSearchTerm] = useState<string>('');
  const [togglingClass, setTogglingClass] = useState<string | null>(null);

  const toggleRow = (modelClass: string) => {
    setOpenMap((prev) => ({ ...prev, [modelClass]: !prev[modelClass] }));
  };

  const handleToggleCheck = async (modelClass: string, current: boolean) => {
    if (!onToggleRecommendation || isToggling) return;
    setTogglingClass(modelClass);
    try {
      await onToggleRecommendation(modelClass, !current);
    } finally {
      setTogglingClass(null);
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

  const recommendedCount = rows.filter((r) => r.isRecommended).length;
  const totalArticlesCount = rows.reduce((acc, r) => acc + r.articles.length, 0);

  if (rows.length === 0) {
    return (
      <div className="py-8">
        <EmptyState
          title="Sản phẩm chưa gắn với bệnh nào"
          description="Sản phẩm này hiện chưa được thiết lập khuyên dùng cho bệnh nào và chưa có bài báo nào nhắc tới."
          actionText={mode === 'admin' ? '+ Thêm bệnh khuyên dùng' : undefined}
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
      {/* Thanh tóm tắt đầu danh sách */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl border border-border bg-card">
        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-foreground">
            Lavi khuyên dùng cho {recommendedCount} bệnh
          </span>
          <span>•</span>
          <span>{totalArticlesCount} bài nguồn đối chiếu</span>
        </div>

        {mode === 'admin' && onAddDisease && (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setDiseaseSearchTerm('');
              setAddDiseaseModalOpen(true);
            }}
            className="h-8 text-xs gap-1.5 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm bệnh</span>
          </Button>
        )}
      </div>

      {/* Danh sách các dòng bệnh */}
      <div className="space-y-3">
        {rows.map((row) => {
          const isOpen = !!openMap[row.modelClass];
          const isBusy = togglingClass === row.modelClass || isToggling;

          return (
            <div
              key={row.modelClass}
              className={`rounded-2xl border transition-all overflow-hidden ${
                row.status === 'MANUAL_ONLY'
                  ? 'border-amber-500/30 bg-amber-50/10 dark:bg-amber-950/10'
                  : row.status === 'UNRECOMMENDED_EVIDENCE'
                  ? 'border-border/60 bg-muted/20 opacity-90'
                  : 'border-border bg-card'
              }`}
            >
              {/* Header dòng bệnh */}
              <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40">
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => toggleRow(row.modelClass)}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mt-0.5 sm:mt-0"
                    title={isOpen ? 'Thu gọn' : 'Mở rộng'}
                  >
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-primary" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">
                        {row.plantName}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <Link
                        to={`/handbook/${encodeURIComponent(row.modelClass)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-sm sm:text-base text-foreground hover:text-primary transition-colors hover:underline"
                        title="Xem trang chi tiết bệnh này trong Sổ tay"
                      >
                        {row.diseaseName}
                      </Link>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {row.status === 'MANUAL_ONLY' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Nhập tay, chưa có bài nguồn</span>
                        </span>
                      )}

                      {row.status === 'SUPPORTED' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{row.articles.length} bài nguồn</span>
                        </span>
                      )}

                      {row.status === 'UNRECOMMENDED_EVIDENCE' && (
                        <span className="text-[11px] text-muted-foreground italic">
                          {row.articles.length} bài nguồn · Lavi chưa khuyên dùng
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Công tắc Khuyên dùng (Chỉ có ở Admin mode) */}
                {mode === 'admin' && onToggleRecommendation && (
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                    <span className="text-xs font-semibold text-foreground select-none">
                      Khuyên dùng
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer min-h-[40px] min-w-[50px] justify-center">
                      <input
                        type="checkbox"
                        checked={row.isRecommended}
                        disabled={isBusy}
                        onChange={() => handleToggleCheck(row.modelClass, row.isRecommended)}
                        aria-label={`Khuyên dùng cho ${row.plantName} · ${row.diseaseName}`}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-hidden peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[10px] after:left-[7px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                )}
              </div>

              {/* Nội dung khi mở rộng */}
              {isOpen && (
                <div className="p-3.5 sm:p-5 bg-card/50">
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                    {/* Cột 1: Cách dùng cho bệnh này (chỉ đọc, 40% trên xl) */}
                    <div className="xl:col-span-5">
                      <DiseaseUsageRule
                        rule={null}
                        defaultProfile={defaultProfile}
                        onSwitchToGeneralTab={onSwitchToGeneralTab}
                      />
                    </div>

                    {/* Cột 2: Danh sách thẻ bài báo căn cứ (60% trên xl) */}
                    <div className="xl:col-span-7 space-y-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 font-semibold">
                        <span>Căn cứ từ tài liệu ({row.articles.length} bài):</span>
                        {row.articles.length === 0 && mode === 'admin' && (
                          <Link
                            to={`/admin/inventory?tab=suggestions&search=${encodeURIComponent(
                              productName
                            )}`}
                            className="text-primary hover:underline text-[11px]"
                          >
                            Tìm trong Gợi ý từ bài báo →
                          </Link>
                        )}
                      </div>

                      {row.articles.length === 0 ? (
                        <div className="p-4 rounded-xl border border-dashed border-border bg-muted/20 text-center text-xs text-muted-foreground space-y-1">
                          <p>Chưa có bài báo nào nhắc tới thuốc này cho bệnh {row.diseaseName}.</p>
                          <p className="text-[11px]">
                            Bệnh này được thêm thủ công bởi Admin. Bạn có thể tra cứu thêm bài báo ở
                            tab Gợi ý từ bài báo.
                          </p>
                        </div>
                      ) : (
                        row.articles.map((art) => (
                          <EvidenceCard
                            key={art.sourceUrl || art.sourceTitle}
                            article={art}
                            mode={mode}
                            onUnlinkSnippet={onUnlinkSnippet}
                            unlinkingId={unlinkingId}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Thêm Bệnh Áp Dụng */}
      <Dialog open={addDiseaseModalOpen} onOpenChange={setAddDiseaseModalOpen}>
        <DialogContent className="max-w-md p-5 rounded-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Thêm bệnh khuyên dùng
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Chọn bệnh hại để cho phép trợ lý Lavi khuyên dùng thuốc này trong chẩn đoán và Sổ tay.
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
                    if (!onAddDisease) return;
                    setAddDiseaseModalOpen(false);
                    await onAddDisease(cls.classCode);
                  }}
                  className="w-full p-2.5 text-left text-xs hover:bg-muted/50 transition-colors flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold text-foreground group-hover:text-primary">
                      {cls.plantName} · {cls.diseaseName}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {cls.classCode}
                    </div>
                  </div>
                  <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
