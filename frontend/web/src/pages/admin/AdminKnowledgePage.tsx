import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search,
  ExternalLink,
  Layers,
  RefreshCw,
  Database,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Edit3,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Globe,
  Code2,
  AlertTriangle,
  Check,
  X,
  Clock,
  HelpCircle,
  Eye,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

import type { KnowledgeSourceItem, GroupedArticle } from '@/features/admin/types';
import {
  formatTopicLabel,
  isHealthyTopic,
  inferSourceScope,
  getAgriTranslation,
} from '@/features/admin/lib';
import { useDiseaseOptions } from '@/features/admin/hooks/useDiseaseOptions';

const KNOWLEDGE_FILTERS_STORAGE_KEY = 'lavitree_admin_knowledge_filters';

interface SavedKnowledgeFilters {
  plant?: string;
  diseaseClass?: string;
  origin?: 'ALL' | 'Việt Nam' | 'Quốc tế';
  approval?: 'ALL' | 'APPROVED' | 'PENDING';
  search?: string;
  page?: number;
}

const getSavedKnowledgeFilters = (): SavedKnowledgeFilters | null => {
  try {
    const raw = sessionStorage.getItem(KNOWLEDGE_FILTERS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

export const AdminKnowledgePage: React.FC = () => {
  const navigate = useNavigate();
  const { diseases, uniquePlants } = useDiseaseOptions();
  const savedFilters = useMemo(() => getSavedKnowledgeFilters(), []);

  // ==================== STATE DUYỆT TRI THỨC ==================== 
  const [sources, setSources] = useState<KnowledgeSourceItem[]>([]);
  const [loadingSources, setLoadingSources] = useState<boolean>(false);
  const [sourceFilterPlant, setSourceFilterPlant] = useState<string>(savedFilters?.plant || 'ALL');
  const [sourceFilterClass, setSourceFilterClass] = useState<string>(savedFilters?.diseaseClass || 'ALL');
  const [sourceOriginFilter, setSourceOriginFilter] = useState<'ALL' | 'Việt Nam' | 'Quốc tế'>(savedFilters?.origin || 'ALL');
  const [sourceApprovalFilter, setSourceApprovalFilter] = useState<'ALL' | 'APPROVED' | 'PENDING'>(savedFilters?.approval || 'ALL');
  const [sourceSearch, setSourceSearch] = useState<string>(savedFilters?.search || '');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeSourceItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteArticleTarget, setDeleteArticleTarget] = useState<GroupedArticle | null>(null);
  const [deletingArticle, setDeletingArticle] = useState<boolean>(false);
  const [deleteBatchModalOpen, setDeleteBatchModalOpen] = useState<boolean>(false);
  const [deletingBatch, setDeletingBatch] = useState<boolean>(false);
  const [curationPage, setCurationPage] = useState<number>(savedFilters?.page || 1);
  const [curationPageSize, setCurationPageSize] = useState<number>(10);
  const [batchActionLoading, setBatchActionLoading] = useState<boolean>(false);

  // Lưu trạng thái bộ lọc vào sessionStorage khi người dùng thay đổi
  useEffect(() => {
    try {
      sessionStorage.setItem(
        KNOWLEDGE_FILTERS_STORAGE_KEY,
        JSON.stringify({
          plant: sourceFilterPlant,
          diseaseClass: sourceFilterClass,
          origin: sourceOriginFilter,
          approval: sourceApprovalFilter,
          search: sourceSearch,
          page: curationPage,
        })
      );
    } catch {}
  }, [sourceFilterPlant, sourceFilterClass, sourceOriginFilter, sourceApprovalFilter, sourceSearch, curationPage]);

  // Badge hiển thị xuất xứ bài báo (Việt Nam / Nước ngoài)
  const renderOriginPill = (scope: 'Việt Nam' | 'Quốc tế', compact = false) => (
    <span
      className={`inline-flex items-center rounded font-semibold border ${
        compact ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-[11px]'
      } ${
        scope === 'Quốc tế'
          ? 'bg-purple-50 text-purple-800 border-purple-200'
          : 'bg-sky-50 text-sky-800 border-sky-200'
      }`}
    >
      {scope === 'Quốc tế'
        ? (compact ? '🌐 Nước ngoài' : '🌐 Bài báo Nước ngoài')
        : (compact ? '🇻🇳 Việt Nam' : '🇻🇳 Bài báo Việt Nam')}
    </span>
  );

  // Reindex Status Dialog
  const [reindexStatusOpen, setReindexStatusOpen] = useState<boolean>(false);
  const [reindexStatusData, setReindexStatusData] = useState<any>(null);
  const [loadingReindexStatus, setLoadingReindexStatus] = useState<boolean>(false);
  const [showRawReindexJson, setShowRawReindexJson] = useState<boolean>(false);

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      setLoadingSources(true);
      const res = await apiClient.get<KnowledgeSourceItem[]>('/knowledge/sources');
      setSources(res.data || []);
      setSelectedSourceIds([]);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingSources(false);
    }
  };

  const handleToggleApprove = async (id: string, currentApproved: boolean) => {
    try {
      const res = await apiClient.patch(`/knowledge/sources/${id}/approve`, {
        is_approved: !currentApproved,
        reviewer_notes: !currentApproved ? 'Đã duyệt qua Admin Dashboard' : 'Bỏ duyệt khỏi RAG',
      });

      setSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isManualApproved: !currentApproved } : s))
      );

      const syncStatus = res.data.reindex_status === 'accepted' ? 'Đang đồng bộ vào bộ nhớ AI Lavi' : res.data.reindex_status;
      toast.success(
        !currentApproved
          ? `Đã duyệt đoạn tri thức. (${syncStatus})`
          : `Đã bỏ duyệt đoạn tri thức. (${syncStatus})`
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Xóa mềm (IsDeleted) qua Core API; Core tự gọi Agent reindex nên Lavi không còn trích dẫn bài này.
  const handleDeleteSource = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await apiClient.delete(`/knowledge/sources/${deleteTarget.id}`);
      setSources((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setSelectedSourceIds((prev) => prev.filter((id) => id !== deleteTarget.id));
      toast.success('Đã xóa đoạn tri thức. Lavi sẽ không dùng đoạn này nữa.');
      setDeleteTarget(null);
      
      
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleBatchApprove = async (isApproved: boolean) => {
    if (selectedSourceIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một bài viết để duyệt hàng loạt.');
      return;
    }

    try {
      setBatchActionLoading(true);
      const res = await apiClient.patch('/knowledge/sources/approve-batch', {
        source_ids: selectedSourceIds,
        is_approved: isApproved,
        reviewer_notes: isApproved ? 'Duyệt hàng loạt qua Admin Portal' : 'Bỏ duyệt hàng loạt',
      });

      setSources((prev) =>
        prev.map((s) => (selectedSourceIds.includes(s.id) ? { ...s, isManualApproved: isApproved } : s))
      );
      setSelectedSourceIds([]);

      toast.success(
        `Đã ${isApproved ? 'duyệt' : 'bỏ duyệt'} ${res.data.approved_count} bài viết thành công. Reindex: ${res.data.reindex_status}`
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBatchActionLoading(false);
    }
  };

  const checkReindexStatus = async () => {
    try {
      setLoadingReindexStatus(true);
      setReindexStatusOpen(true);
      const res = await apiClient.get('/knowledge/reindex-status');
      setReindexStatusData(res.data);
    } catch (err) {
      setReindexStatusData({ error: getErrorMessage(err) });
    } finally {
      setLoadingReindexStatus(false);
    }
  };

  const filteredSources = sources.filter((s) => {
    if (sourceFilterPlant !== 'ALL' && s.plantName !== sourceFilterPlant) return false;
    if (sourceFilterClass !== 'ALL' && s.modelClass !== sourceFilterClass) return false;
    if (sourceOriginFilter !== 'ALL' && inferSourceScope(s.sourceUrl, s.organization, s.sourceScope) !== sourceOriginFilter) {
      return false;
    }
    if (sourceApprovalFilter === 'APPROVED' && !s.isManualApproved) return false;
    if (sourceApprovalFilter === 'PENDING' && s.isManualApproved) return false;

    if (sourceSearch.trim()) {
      const q = sourceSearch.toLowerCase();
      const matchTitle = s.sourceTitle.toLowerCase().includes(q);
      const matchOrg = s.organization.toLowerCase().includes(q);
      const matchPlant = (s.plantName || '').toLowerCase().includes(q);
      const matchDisease = s.diseaseName.toLowerCase().includes(q);
      const matchTopic = formatTopicLabel(s.diseaseName, s.modelClass).toLowerCase().includes(q);
      if (!matchTitle && !matchOrg && !matchPlant && !matchDisease && !matchTopic) return false;
    }

    return true;
  });

  // Chế độ xem: Gộp theo bài viết (mặc định bật) và Quản lý mở rộng chi tiết bài
  const [groupByArticle, setGroupByArticle] = useState<boolean>(true);
  const [expandedArticleKeys, setExpandedArticleKeys] = useState<Set<string>>(new Set());

  const toggleExpandArticle = (key: string) => {
    setExpandedArticleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const groupedArticles = React.useMemo<GroupedArticle[]>(() => {
    const map = new Map<string, GroupedArticle>();

    filteredSources.forEach((s) => {
      // Nhánh 3: Gom nhóm bài viết strictly theo URL bài báo (hoặc Title nếu không có URL)
      // 1 bài báo = 1 dòng duy nhất trên bảng, các bệnh khác nhau được tổng hợp vào diseasesList
      const normalizedUrl = (s.sourceUrl || '').trim().toLowerCase();
      const normalizedTitle = (s.sourceTitle || '').trim().toLowerCase();
      const key = normalizedUrl || normalizedTitle || `source_${s.id}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          sourceTitle: s.sourceTitle,
          sourceUrl: s.sourceUrl,
          organization: s.organization,
          sourceScope: inferSourceScope(s.sourceUrl, s.organization, s.sourceScope),
          primaryPlantName: s.plantName,
          primaryDiseaseName: s.diseaseName,
          primaryModelClass: s.modelClass,
          diseasesList: [{ plantName: s.plantName, diseaseName: s.diseaseName, modelClass: s.modelClass }],
          paragraphs: [],
          approvedCount: 0,
          totalCount: 0,
        });
      }
      const group = map.get(key)!;
      group.paragraphs.push(s);
      group.totalCount += 1;
      if (s.isManualApproved) {
        group.approvedCount += 1;
      }
      if (!group.diseasesList.some((d) => d.modelClass === s.modelClass)) {
        group.diseasesList.push({ plantName: s.plantName, diseaseName: s.diseaseName, modelClass: s.modelClass });
      }
    });

    return Array.from(map.values());
  }, [filteredSources]);

  // Phân trang cho Danh sách Tri thức (Curation)
  const curationTotalItems = groupByArticle ? groupedArticles.length : filteredSources.length;
  const curationTotalPages = Math.max(1, Math.ceil(curationTotalItems / curationPageSize));
  const safeCurationPage = Math.min(curationPage, curationTotalPages);

  const pagedArticles = React.useMemo(() => {
    const start = (safeCurationPage - 1) * curationPageSize;
    return groupedArticles.slice(start, start + curationPageSize);
  }, [groupedArticles, safeCurationPage, curationPageSize]);

  const pagedSources = React.useMemo(() => {
    const start = (safeCurationPage - 1) * curationPageSize;
    return filteredSources.slice(start, start + curationPageSize);
  }, [filteredSources, safeCurationPage, curationPageSize]);

  const handleToggleApproveArticle = async (article: GroupedArticle) => {
    const isAllApproved = article.approvedCount === article.totalCount;
    const targetApproved = !isAllApproved;
    const targetIds = article.paragraphs.map((p) => p.id);

    try {
      setBatchActionLoading(true);
      await apiClient.patch('/knowledge/sources/approve-batch', {
        source_ids: targetIds,
        is_approved: targetApproved,
        reviewer_notes: targetApproved ? 'Duyệt toàn bộ bài báo' : 'Bỏ duyệt toàn bộ bài báo',
      });

      setSources((prev) =>
        prev.map((s) => (targetIds.includes(s.id) ? { ...s, isManualApproved: targetApproved } : s))
      );

      toast.success(
        targetApproved
          ? `Đã duyệt toàn bộ ${targetIds.length} đoạn của bài viết "${article.sourceTitle}".`
          : `Đã bỏ duyệt ${targetIds.length} đoạn của bài viết "${article.sourceTitle}".`
      );
    } catch (err: any) {
      toast.error('Lỗi khi thao tác bài viết: ' + getErrorMessage(err));
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Xóa toàn bộ các đoạn của 1 bài báo (Nhánh 3)
  const handleDeleteArticle = async () => {
    if (!deleteArticleTarget) return;
    const targetIds = deleteArticleTarget.paragraphs.map((p) => p.id);
    try {
      setDeletingArticle(true);
      await apiClient.post('/knowledge/sources/batch-delete', targetIds);
      setSources((prev) => prev.filter((s) => !targetIds.includes(s.id)));
      setSelectedSourceIds((prev) => prev.filter((id) => !targetIds.includes(id)));
      toast.success(
        `Đã xóa toàn bộ ${targetIds.length} đoạn của bài viết "${deleteArticleTarget.sourceTitle}". Lavi sẽ không trích dẫn bài này nữa.`
      );
      setDeleteArticleTarget(null);
      
      
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingArticle(false);
    }
  };

  // Xóa hàng loạt các đoạn đã chọn qua checkbox (Nhánh 3)
  const handleBatchDelete = async () => {
    if (selectedSourceIds.length === 0) return;
    try {
      setDeletingBatch(true);
      await apiClient.post('/knowledge/sources/batch-delete', selectedSourceIds);
      setSources((prev) => prev.filter((s) => !selectedSourceIds.includes(s.id)));
      toast.success(`Đã xóa ${selectedSourceIds.length} đoạn tri thức đã chọn.`);
      setSelectedSourceIds([]);
      setDeleteBatchModalOpen(false);
      
      
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingBatch(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Duyệt tri thức
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kiểm duyệt các đoạn tri thức đã nạp vào hệ thống RAG của Lavi.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={checkReindexStatus}
          className="gap-2 shrink-0 bg-card border-border hover:bg-muted"
          title="Kiểm tra trạng thái nạp dữ liệu tri thức vào bộ nhớ AI Lavi"
        >
          <Database className="w-4 h-4 text-emerald-700" />
          <span>Đồng bộ tri thức</span>
        </Button>
      </div>

      {/* Nội dung danh sách tri thức */}
      <div className="space-y-4">
          {/* Toolbar lọc */}
          <div className="bg-card p-4 rounded-xl border border-border shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Tìm theo tiêu đề, cơ quan, cây, bệnh..."
                  value={sourceSearch}
                  onChange={(e) => {
                    setSourceSearch(e.target.value);
                    setCurationPage(1);
                  }}
                  className="pl-8 text-xs h-9 bg-background"
                />
              </div>

              <select
                value={sourceFilterPlant}
                onChange={(e) => {
                  setSourceFilterPlant(e.target.value);
                  setSourceFilterClass('ALL');
                  setCurationPage(1);
                }}
                className="h-9 px-2.5 bg-background border border-border rounded-lg text-xs"
              >
                <option value="ALL">Tất cả cây trồng ({uniquePlants.length})</option>
                {uniquePlants.map((plant) => (
                  <option key={plant} value={plant}>
                    {plant}
                  </option>
                ))}
              </select>

              <select
                value={sourceFilterClass}
                onChange={(e) => {
                  setSourceFilterClass(e.target.value);
                  setCurationPage(1);
                }}
                className="h-9 px-2.5 bg-background border border-border rounded-lg text-xs"
              >
                <option value="ALL">
                  {sourceFilterPlant === 'ALL'
                    ? 'Tất cả chuyên mục & bệnh hại'
                    : `Tất cả chuyên mục của ${sourceFilterPlant}`}
                </option>
                {diseases
                  .filter((d) => sourceFilterPlant === 'ALL' || d.plantName === sourceFilterPlant)
                  .map((d) => (
                    <option key={d.classCode} value={d.classCode}>
                      {sourceFilterPlant === 'ALL'
                        ? `${d.plantName} – ${formatTopicLabel(d.commonNameVi, d.classCode)}`
                        : formatTopicLabel(d.commonNameVi, d.classCode)}
                    </option>
                  ))}
              </select>

              <select
                value={sourceOriginFilter}
                onChange={(e) => {
                  setSourceOriginFilter(e.target.value as 'ALL' | 'Việt Nam' | 'Quốc tế');
                  setCurationPage(1);
                }}
                className="h-9 px-2.5 bg-background border border-border rounded-lg text-xs"
              >
                <option value="ALL">Tất cả nguồn (VN &amp; Nước ngoài)</option>
                <option value="Việt Nam">🇻🇳 Bài báo Việt Nam</option>
                <option value="Quốc tế">🌐 Bài báo Nước ngoài (Quốc tế)</option>
              </select>

              <select
                value={sourceApprovalFilter}
                onChange={(e) => {
                  setSourceApprovalFilter(e.target.value as any);
                  setCurationPage(1);
                }}
                className="h-9 px-2.5 bg-background border border-border rounded-lg text-xs"
              >
                <option value="ALL">Tất cả trạng thái duyệt</option>
                <option value="APPROVED">Đã duyệt (sẵn sàng cho Lavi)</option>
                <option value="PENDING">Chờ duyệt</option>
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {selectedSourceIds.length > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={batchActionLoading}
                    onClick={() => handleBatchApprove(true)}
                    className="h-9 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs"
                  >
                    Duyệt hàng loạt ({selectedSourceIds.length})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={batchActionLoading}
                    onClick={() => handleBatchApprove(false)}
                    className="h-9 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    Bỏ duyệt hàng loạt
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={batchActionLoading}
                    onClick={() => setDeleteBatchModalOpen(true)}
                    className="h-9 text-xs font-semibold gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa hàng loạt ({selectedSourceIds.length})</span>
                  </Button>
                </>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={fetchSources}
                disabled={loadingSources}
                className="h-9 bg-card border-border hover:bg-muted text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingSources ? 'animate-spin' : ''}`} />
                Làm mới
              </Button>

              {/* Nút chuyển đổi chế độ xem: Gộp theo bài viết hoặc xem từng dòng */}
              <Button
                variant={groupByArticle ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setGroupByArticle(!groupByArticle);
                  setCurationPage(1);
                }}
                className={`h-9 text-xs gap-1.5 ${groupByArticle
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white font-semibold'
                    : 'bg-card border-border hover:bg-muted text-foreground'
                  }`}
                title={
                  groupByArticle
                    ? 'Đang gộp theo bài viết. Bấm để xem danh sách phẳng từng dòng'
                    : 'Đang xem từng dòng. Bấm để gộp theo bài viết'
                }
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{groupByArticle ? 'Gộp bài viết' : 'Từng dòng'}</span>
              </Button>
            </div>
          </div>

          {/* Table */}
          <Card className="border-border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                {groupByArticle ? (
                  // ==================== BẢNG CHẾ ĐỘ GỘP THEO BÀI VIẾT ====================
                  <>
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                      <tr>
                        <th className="p-3 w-8">
                          <input
                            type="checkbox"
                            checked={
                              filteredSources.length > 0 &&
                              filteredSources.every((s) => selectedSourceIds.includes(s.id))
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSourceIds(filteredSources.map((s) => s.id));
                              } else {
                                setSelectedSourceIds([]);
                              }
                            }}
                            className="rounded"
                          />
                        </th>
                        <th className="p-3">Bài viết &amp; Cơ quan</th>
                        <th className="p-3">Cây &amp; Chuyên mục</th>
                        <th className="p-3 text-center">Các đoạn trích</th>
                        <th className="p-3 text-center">Trạng thái duyệt</th>
                        <th className="p-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {loadingSources ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground">
                            Đang tải danh sách nguồn tri thức...
                          </td>
                        </tr>
                      ) : groupedArticles.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground">
                            Không tìm thấy bài viết nào phù hợp.
                          </td>
                        </tr>
                      ) : (
                        pagedArticles.map((group) => {
                          const isExpanded = expandedArticleKeys.has(group.key);
                          const isGroupAllSelected = group.paragraphs.every((p) =>
                            selectedSourceIds.includes(p.id)
                          );
                          const isGroupSomeSelected =
                            !isGroupAllSelected &&
                            group.paragraphs.some((p) => selectedSourceIds.includes(p.id));
                          const isAllApproved = group.approvedCount === group.totalCount;

                          return (
                            <React.Fragment key={group.key}>
                              {/* Dòng bài viết tổng hợp */}
                              <tr
                                className={`hover:bg-muted/30 transition-colors ${isExpanded ? 'bg-muted/20 font-medium' : ''
                                  }`}
                              >
                                <td className="p-3">
                                  <input
                                    type="checkbox"
                                    checked={isGroupAllSelected}
                                    ref={(el) => {
                                      if (el) el.indeterminate = isGroupSomeSelected;
                                    }}
                                    onChange={(e) => {
                                      const groupIds = group.paragraphs.map((p) => p.id);
                                      if (e.target.checked) {
                                        setSelectedSourceIds((prev) => [
                                          ...prev,
                                          ...groupIds.filter((id) => !prev.includes(id)),
                                        ]);
                                      } else {
                                        setSelectedSourceIds((prev) =>
                                          prev.filter((id) => !groupIds.includes(id))
                                        );
                                      }
                                    }}
                                    className="rounded"
                                  />
                                </td>
                                <td className="p-3 max-w-[280px]">
                                  <div className="min-w-0">
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/admin/ingest?edit=${encodeURIComponent(group.sourceUrl)}`)}
                                      className="font-bold text-foreground text-left line-clamp-1 hover:text-emerald-700 hover:underline block cursor-pointer"
                                      title="Mở chi tiết bài viết"
                                    >
                                      {group.sourceTitle}
                                    </button>
                                    <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                      {group.organization}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                      {renderOriginPill(group.sourceScope, true)}
                                      <a
                                        href={group.sourceUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[10px] text-emerald-700 hover:underline inline-flex items-center gap-0.5"
                                      >
                                        <span>Xem bài gốc</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <span className="font-semibold text-foreground block">{group.primaryPlantName}</span>
                                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                    <span className="text-[11px] text-muted-foreground">
                                      {formatTopicLabel(group.primaryDiseaseName, group.primaryModelClass)}
                                    </span>
                                    {group.diseasesList.length > 1 && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-300 px-1 py-0"
                                        title={`Bài báo đề cập đến ${group.diseasesList.length} chuyên mục: ${group.diseasesList.map((d) => `${d.plantName} – ${formatTopicLabel(d.diseaseName, d.modelClass)}`).join(', ')}`}
                                      >
                                        +{group.diseasesList.length - 1} chuyên mục khác
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 text-center whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 text-foreground text-xs font-medium border border-border/60">
                                    <Layers className="w-3.5 h-3.5 text-emerald-700" />
                                    <span>{group.totalCount} đoạn</span>
                                  </span>
                                </td>
                                <td className="p-3 text-center whitespace-nowrap">
                                  {isAllApproved ? (
                                    <Badge className="bg-emerald-700 text-white text-[10px] gap-1">
                                      <Check className="w-3 h-3" />
                                      Đã duyệt ({group.approvedCount}/{group.totalCount})
                                    </Badge>
                                  ) : group.approvedCount === 0 ? (
                                    <Badge
                                      variant="outline"
                                      className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] gap-1"
                                    >
                                      <Clock className="w-3 h-3" />
                                      Chưa duyệt (0/{group.totalCount})
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="bg-blue-50 text-blue-800 border-blue-300 text-[10px] gap-1"
                                    >
                                      Duyệt một phần ({group.approvedCount}/{group.totalCount})
                                    </Badge>
                                  )}
                                </td>
                                <td className="p-3 text-right whitespace-nowrap space-x-1.5">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => navigate(`/admin/ingest?edit=${encodeURIComponent(group.sourceUrl)}`)}
                                    className="h-7 px-3 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-1.5"
                                    title="Mở bài viết để xem thông tin, duyệt từng đoạn, hoặc nạp thêm đoạn mới"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>Mở bài viết</span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setDeleteArticleTarget(group)}
                                    className="h-7 px-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
                                    title="Xóa toàn bộ các đoạn của bài viết này khỏi kho tri thức"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Xóa bài</span>
                                  </Button>
                                </td>
                              </tr>

                              {/* Dòng mở rộng đã được thay thế bằng màn hình chi tiết bài viết tập trung */}
                              {false && (
                                <tr className="bg-muted/20 border-b border-border/80">
                                  <td colSpan={6} className="p-3 sm:p-4 pl-6 sm:pl-12">
                                    <div className="space-y-2.5 rounded-xl border border-border/70 bg-card p-3 sm:p-3.5 shadow-2xs">
                                      <div className="text-xs font-semibold text-foreground flex items-center justify-between border-b border-border/60 pb-2">
                                        <span className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                                          <FileText className="w-3.5 h-3.5 text-emerald-700" />
                                          Chi tiết {group.paragraphs.length} đoạn trích của bài báo:
                                        </span>
                                        <span className="text-[11px] text-muted-foreground font-normal">
                                          Đã duyệt {group.approvedCount}/{group.totalCount} đoạn
                                        </span>
                                      </div>

                                      <div className="space-y-2">
                                        {group.paragraphs.map((p, pIdx) => {
                                          const isParagraphSelected = selectedSourceIds.includes(p.id);
                                          return (
                                            <div
                                              key={p.id}
                                              className={`p-2.5 sm:p-3 rounded-lg border text-xs transition-colors ${isParagraphSelected
                                                  ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20'
                                                  : 'border-border/70 bg-background hover:border-border'
                                                }`}
                                            >
                                              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                                                <div className="flex items-center gap-2">
                                                  <input
                                                    type="checkbox"
                                                    checked={isParagraphSelected}
                                                    onChange={(e) => {
                                                      if (e.target.checked) {
                                                        setSelectedSourceIds((prev) => [...prev, p.id]);
                                                      } else {
                                                        setSelectedSourceIds((prev) =>
                                                          prev.filter((id) => id !== p.id)
                                                        );
                                                      }
                                                    }}
                                                    className="rounded"
                                                  />
                                                  <span className="font-semibold text-foreground text-xs">
                                                    Đoạn #{pIdx + 1}
                                                  </span>
                                                  {p.isVerbatim ? (
                                                    <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px]">
                                                      Nguyên văn
                                                    </Badge>
                                                  ) : (
                                                    <Badge
                                                      variant="outline"
                                                      className="text-muted-foreground text-[10px]"
                                                    >
                                                      Tóm tắt
                                                    </Badge>
                                                  )}
                                                  <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground border border-border">
                                                    {p.unitType || 'SUMMARY'}
                                                  </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                  {p.isManualApproved ? (
                                                    <Badge className="bg-emerald-700 text-white text-[10px] gap-1">
                                                      <Check className="w-2.5 h-2.5" />
                                                      Đã duyệt
                                                    </Badge>
                                                  ) : (
                                                    <Badge
                                                      variant="outline"
                                                      className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] gap-1"
                                                    >
                                                      <Clock className="w-2.5 h-2.5" />
                                                      Chưa duyệt
                                                    </Badge>
                                                  )}

                                                  <Button
                                                    size="sm"
                                                    variant={p.isManualApproved ? 'outline' : 'default'}
                                                    onClick={() =>
                                                      handleToggleApprove(p.id, p.isManualApproved)
                                                    }
                                                    className={`h-6 px-2 text-[11px] ${p.isManualApproved
                                                        ? 'text-muted-foreground hover:text-destructive'
                                                        : 'bg-emerald-700 hover:bg-emerald-800 text-white font-semibold'
                                                      }`}
                                                  >
                                                    {p.isManualApproved ? 'Bỏ duyệt' : 'Duyệt'}
                                                  </Button>

                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => setDeleteTarget(p)}
                                                    className="h-6 w-6 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                                    title="Xóa đoạn này"
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              </div>

                                              <p className="text-muted-foreground italic leading-relaxed text-xs pl-6">
                                                "{p.evidenceText}"
                                              </p>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </>
                ) : (
                  // ==================== BẢNG CHẾ ĐỘ DANH SÁCH TỪNG DÒNG (FLAT LIST) ====================
                  <>
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                      <tr>
                        <th className="p-3 w-8">
                          <input
                            type="checkbox"
                            checked={
                              filteredSources.length > 0 &&
                              filteredSources.every((s) => selectedSourceIds.includes(s.id))
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSourceIds(filteredSources.map((s) => s.id));
                              } else {
                                setSelectedSourceIds([]);
                              }
                            }}
                            className="rounded"
                          />
                        </th>
                        <th className="p-3">Bài viết &amp; Cơ quan</th>
                        <th className="p-3">Cây &amp; Chuyên mục</th>
                        <th className="p-3">Dạng bài</th>
                        <th className="p-3">Nội dung trích đoạn</th>
                        <th className="p-3 text-center">Trạng thái</th>
                        <th className="p-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {loadingSources ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground">
                            Đang tải danh sách nguồn tri thức...
                          </td>
                        </tr>
                      ) : filteredSources.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground">
                            Không tìm thấy bài viết nào phù hợp.
                          </td>
                        </tr>
                      ) : (
                        pagedSources.map((s) => {
                          const isSelected = selectedSourceIds.includes(s.id);
                          return (
                            <tr
                              key={s.id}
                              className={`hover:bg-muted/30 transition-colors ${isSelected ? 'bg-emerald-50/40' : ''
                                }`}
                            >
                              <td className="p-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedSourceIds((prev) => [...prev, s.id]);
                                    } else {
                                      setSelectedSourceIds((prev) => prev.filter((id) => id !== s.id));
                                    }
                                  }}
                                  className="rounded"
                                />
                              </td>
                              <td className="p-3 max-w-[220px]">
                                <div className="font-bold text-foreground line-clamp-1">{s.sourceTitle}</div>
                                <div className="text-[11px] text-muted-foreground line-clamp-1">{s.organization}</div>
                                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                  {renderOriginPill(inferSourceScope(s.sourceUrl, s.organization, s.sourceScope), true)}
                                  <a
                                    href={s.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] text-emerald-700 hover:underline inline-flex items-center gap-0.5"
                                  >
                                    <span>Xem bài gốc</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </div>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <span className="font-semibold text-foreground block">{s.plantName}</span>
                                <span className="text-[11px] text-muted-foreground">
                                  {formatTopicLabel(s.diseaseName, s.modelClass)}
                                </span>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                {s.isVerbatim ? (
                                  <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px]">
                                    Nguyên văn
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                    Tóm tắt
                                  </Badge>
                                )}
                                <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                                  {s.unitType || 'SUMMARY'}
                                </div>
                              </td>
                              <td className="p-3 max-w-[280px]">
                                <p className="line-clamp-2 italic text-muted-foreground">
                                  "{s.evidenceText}"
                                </p>
                              </td>
                              <td className="p-3 text-center whitespace-nowrap">
                                {s.isManualApproved ? (
                                  <Badge className="bg-emerald-700 text-white text-[10px]">
                                    <Check className="w-3 h-3 mr-1" />
                                    Đã duyệt
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Chưa duyệt
                                  </Badge>
                                )}
                              </td>
                              <td className="p-3 text-right whitespace-nowrap">
                                <Button
                                  size="sm"
                                  variant={s.isManualApproved ? 'outline' : 'default'}
                                  onClick={() => handleToggleApprove(s.id, s.isManualApproved)}
                                  className={`h-7 px-2.5 text-xs ${s.isManualApproved
                                      ? 'text-muted-foreground hover:text-destructive'
                                      : 'bg-emerald-700 hover:bg-emerald-800 text-white font-semibold'
                                    }`}
                                >
                                  {s.isManualApproved ? 'Bỏ duyệt' : 'Duyệt bài'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDeleteTarget(s)}
                                  className="ml-1 h-7 w-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  aria-label="Xóa đoạn tri thức"
                                  title="Xóa đoạn tri thức"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </>
                )}
              </table>
            </div>

            {/* Pagination Bar (Phân trang tri thức - Nhánh 3) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t border-border bg-card/60 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>
                  Hiển thị {curationTotalItems === 0 ? 0 : (safeCurationPage - 1) * curationPageSize + 1}–
                  {Math.min(safeCurationPage * curationPageSize, curationTotalItems)} trong tổng số{' '}
                  <strong className="text-foreground">{curationTotalItems}</strong> {groupByArticle ? 'bài viết' : 'đoạn trích'}
                </span>
                <span className="text-border">|</span>
                <div className="flex items-center gap-1.5">
                  <span>Mỗi trang:</span>
                  <select
                    value={curationPageSize}
                    onChange={(e) => {
                      setCurationPageSize(Number(e.target.value));
                      setCurationPage(1);
                    }}
                    className="h-7 px-2 bg-background border border-border rounded text-xs"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurationPage <= 1}
                  onClick={() => setCurationPage((p) => Math.max(1, p - 1))}
                  className="h-7 px-2.5 text-xs gap-1"
                >
                  <ChevronLeft className="w-3 h-3" />
                  <span>Trước</span>
                </Button>
                <span className="px-2 text-xs font-medium text-foreground">
                  Trang {safeCurationPage} / {curationTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurationPage >= curationTotalPages}
                  onClick={() => setCurationPage((p) => Math.min(curationTotalPages, p + 1))}
                  className="h-7 px-2.5 text-xs gap-1"
                >
                  <span>Sau</span>
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </Card>
      </div>

      {/* Các Dialog xác nhận xoá và kiểm tra trạng thái reindex */}
                  <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Xóa đoạn tri thức này?</DialogTitle>
                        <DialogDescription>
                          Lavi sẽ không còn dùng đoạn này để trả lời. Muốn tạm ẩn thì dùng "Bỏ duyệt" thay vì xóa.
                        </DialogDescription>
                      </DialogHeader>
                      {deleteTarget && (
                        <div className="space-y-1 rounded-md border bg-muted/40 p-3 text-xs">
                          <p className="line-clamp-3 italic text-muted-foreground">"{deleteTarget.evidenceText}"</p>
                          <p className="truncate text-muted-foreground">{deleteTarget.sourceUrl}</p>
                        </div>
                      )}
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                          Hủy
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteSource} disabled={deleting}>
                          {deleting ? 'Đang xóa...' : 'Xóa'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* ========================================================================================= */}
                  {/* DIALOG XÁC NHẬN XÓA CẢ BÀI BÁO (NHÁNH 3) */}
                  {/* ========================================================================================= */}
                  <Dialog
                    open={deleteArticleTarget !== null}
                    onOpenChange={(open) => {
                      if (!open && !deletingArticle) setDeleteArticleTarget(null);
                    }}
                  >
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
                          <Trash2 className="w-4 h-4 text-destructive" />
                          <span>Xóa toàn bộ bài viết này?</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                          Thao tác này sẽ xóa mềm toàn bộ <strong>{deleteArticleTarget?.totalCount || 0} đoạn trích</strong> thuộc bài viết này. Trợ lý Lavi sẽ lập tức reindex và ngừng trích dẫn toàn bộ nội dung của bài.
                        </DialogDescription>
                      </DialogHeader>
                      {deleteArticleTarget && (
                        <div className="space-y-2 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs">
                          <p className="font-bold text-foreground">{deleteArticleTarget.sourceTitle}</p>
                          <p className="text-[11px] text-muted-foreground">{deleteArticleTarget.organization}</p>
                          <p className="truncate text-[10px] text-muted-foreground font-mono">{deleteArticleTarget.sourceUrl}</p>
                          <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                            Số bệnh liên quan:{' '}
                            <span className="font-semibold">
                              {deleteArticleTarget.diseasesList.map((d) => d.diseaseName).join(', ')}
                            </span>
                          </div>
                        </div>
                      )}
                      <DialogFooter>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteArticleTarget(null)}
                          disabled={deletingArticle}
                        >
                          Hủy
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDeleteArticle}
                          disabled={deletingArticle}
                          className="font-semibold"
                        >
                          {deletingArticle ? 'Đang xóa cả bài...' : 'Xác nhận xóa cả bài'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* ========================================================================================= */}
                  {/* DIALOG XÁC NHẬN XÓA HÀNG LOẠT (NHÁNH 3) */}
                  {/* ========================================================================================= */}
                  <Dialog
                    open={deleteBatchModalOpen}
                    onOpenChange={(open) => {
                      if (!open && !deletingBatch) setDeleteBatchModalOpen(false);
                    }}
                  >
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
                          <Trash2 className="w-4 h-4 text-destructive" />
                          <span>Xóa hàng loạt {selectedSourceIds.length} đoạn tri thức?</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                          Bạn đã chọn <strong>{selectedSourceIds.length} đoạn trích</strong> từ các bài báo khác nhau. Tất cả đoạn này sẽ bị gỡ bỏ khỏi kho tri thức của Lavi.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs text-muted-foreground">
                        Hệ thống sẽ đồng bộ hóa lại vector embeddings trong một lần thao tác duy nhất.
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteBatchModalOpen(false)}
                          disabled={deletingBatch}
                        >
                          Hủy
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleBatchDelete}
                          disabled={deletingBatch}
                          className="font-semibold"
                        >
                          {deletingBatch ? 'Đang xóa...' : `Xóa ${selectedSourceIds.length} đoạn`}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={reindexStatusOpen} onOpenChange={setReindexStatusOpen}>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                          <Database className="w-4 h-4 text-emerald-700" />
                          <span>Đồng bộ tri thức vào Trợ lý AI Lavi</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                          Bộ nhớ của trợ lý AI Lavi được lập chỉ mục vector (Semantic Search) và từ khóa (BM25) từ các đoạn bài báo khuyến nông đã duyệt. Bấm "Làm mới trạng thái" để kiểm tra xem dữ liệu mới nhất đã được nạp đầy đủ vào bộ nhớ AI hay chưa.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="py-2 text-xs space-y-3">
                        {loadingReindexStatus ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-700" />
                            Đang truy vấn trạng thái từ Agent Service...
                          </div>
                        ) : reindexStatusData ? (
                          <>
                            {/* Trạng thái hoạt động chính */}
                            {reindexStatusData.running ? (
                              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2.5 text-blue-900">
                                <RefreshCw className="w-4 h-4 animate-spin text-blue-700 shrink-0" />
                                <div>
                                  <div className="font-semibold text-xs">Đang đồng bộ dữ liệu vector trong nền</div>
                                  <div className="text-[11px] text-blue-700">Agent Service đang tính toán embedding cho các bài viết mới.</div>
                                </div>
                              </div>
                            ) : reindexStatusData.last_error ? (
                              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2.5 text-destructive">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <div>
                                  <div className="font-semibold text-xs">Lần đồng bộ gần nhất gặp sự cố</div>
                                  <div className="text-[11px] opacity-90">{reindexStatusData.last_error}</div>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-emerald-900">
                                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                                <div>
                                  <div className="font-semibold text-xs">Hệ thống đồng bộ hoạt động bình thường</div>
                                  <div className="text-[11px] text-emerald-700">Kho tri thức đã được lập chỉ mục và sẵn sàng cho Trợ lý Lavi.</div>
                                </div>
                              </div>
                            )}

                            {/* 3 Metric cards */}
                            <div className="grid grid-cols-3 gap-2">
                              <div className="p-2.5 bg-muted/40 border border-border rounded-lg text-center">
                                <div className="text-[10px] text-muted-foreground uppercase font-medium">Đoạn đã lập chỉ mục</div>
                                <div className="text-base font-bold text-foreground mt-0.5 font-mono">
                                  {reindexStatusData.indexed_documents?.toLocaleString('vi-VN') ?? 0}
                                </div>
                              </div>

                              <div className="p-2.5 bg-muted/40 border border-border rounded-lg text-center">
                                <div className="text-[10px] text-muted-foreground uppercase font-medium">Lần thành công gần nhất</div>
                                <div className="text-[11px] font-semibold text-foreground mt-1">
                                  {reindexStatusData.last_success_at
                                    ? new Date(reindexStatusData.last_success_at).toLocaleString('vi-VN', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                    : 'Chưa có'}
                                </div>
                              </div>

                              <div className="p-2.5 bg-muted/40 border border-border rounded-lg text-center">
                                <div className="text-[10px] text-muted-foreground uppercase font-medium">Hàng đợi nền</div>
                                <div className="text-[11px] font-semibold mt-1">
                                  {reindexStatusData.pending ? (
                                    <span className="text-amber-700">Có yêu cầu chờ</span>
                                  ) : (
                                    <span className="text-emerald-700">Đã đồng bộ hết</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Collapsible raw JSON */}
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => setShowRawReindexJson(!showRawReindexJson)}
                                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium"
                              >
                                {showRawReindexJson ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                <span>{showRawReindexJson ? 'Ẩn phản hồi JSON' : 'Xem phản hồi JSON kỹ thuật'}</span>
                              </button>
                              {showRawReindexJson && (
                                <pre className="mt-2 p-3 bg-muted rounded-lg font-mono text-[10px] overflow-x-auto border border-border max-h-40">
                                  {JSON.stringify(reindexStatusData, null, 2)}
                                </pre>
                              )}
                            </div>
                          </>
                        ) : (
                          <p className="text-muted-foreground py-4 text-center">Không có dữ liệu phản hồi.</p>
                        )}
                      </div>

                      <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loadingReindexStatus}
                          onClick={checkReindexStatus}
                          className="gap-1.5 text-xs"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${loadingReindexStatus ? 'animate-spin' : ''}`} />
                          Làm mới trạng thái
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setReindexStatusOpen(false)}>
                          Đóng
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
    </div>
  );
};

export default AdminKnowledgePage;
