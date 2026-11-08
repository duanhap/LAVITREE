import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  FileText, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw,
  ExternalLink, Search, Filter, Layers, Database, Package,
  UserCheck, AlertTriangle, Check, X, Clock, HelpCircle, Eye
} from 'lucide-react';
import { toast } from 'sonner';

interface DiseaseOption {
  classCode: string;
  plantName: string;
  commonNameVi: string;
}

interface ParagraphItem {
  id: string;
  text: string;
  suggested_unit_type: string | null;
}

interface IngestionResponse {
  ingestion_id: string;
  expires_at: string;
  paragraphs: ParagraphItem[];
  ai_suggestion_available: boolean;
}

interface KnowledgeSourceItem {
  id: string;
  modelClass: string;
  plantName: string;
  diseaseName: string;
  sourceUrl: string;
  sourceTitle: string;
  organization: string;
  publishedDate?: string;
  evidenceText: string;
  contentType: string;
  unitType?: string;
  isVerbatim: boolean;
  isManualApproved: boolean;
  reviewerNotes?: string;
  createdAt: string;
}

interface MedicineItem {
  id: number;
  name: string;
  active_ingredient: string;
  medicine_type: string;
  price: number;
  dosage_instruction: string;
  phi_days: number;
  is_allowed: boolean;
  rain_resistant: boolean;
  stock_quantity: number;
}

interface EscalationItem {
  id: string;
  userId?: string;
  userName: string;
  userPhone?: string;
  diseaseName: string;
  plantName: string;
  classCode: string;
  confidence: number;
  originalImageUrl?: string;
  gradCamImageUrl?: string;
  notes?: string;
  expertNotes?: string;
  expertReviewedAt?: string;
  createdAt: string;
}

interface AdminDashboardProps {
  defaultTab?: 'ingestion' | 'curation' | 'inventory' | 'escalations';
}

const SECTION_COPY: Record<string, { title: string; description: string }> = {
  ingestion: {
    title: 'Nhập bài báo',
    description: 'Dán nguyên văn bài khuyến nông, chọn đoạn cần lưu và gắn nhãn trước khi đưa vào kho tri thức.',
  },
  curation: {
    title: 'Duyệt tri thức',
    description: 'Duyệt hoặc gỡ duyệt các đoạn trích. Chỉ đoạn đã duyệt mới được trợ lý Lavi dùng để trả lời.',
  },
  inventory: {
    title: 'Kho vật tư & thuốc',
    description: 'Quản lý giá, tồn kho, thời gian cách ly (PHI) và trạng thái được phép lưu hành.',
  },
  escalations: {
    title: 'Ca chuyên gia',
    description: 'Các ca khám độ tin cậy thấp hoặc nông dân yêu cầu chuyên gia xem lại.',
  },
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ defaultTab = 'ingestion' }) => {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [diseases, setDiseases] = useState<DiseaseOption[]>([]);

  // ==================== TAB 1: NHẬP BÀI BÁO (HITL INGESTION) ====================
  const [ingestClass, setIngestClass] = useState<string>('Tomato___Late_blight');
  const [ingestUrl, setIngestUrl] = useState<string>('');
  const [ingestTitle, setIngestTitle] = useState<string>('');
  const [ingestOrg, setIngestOrg] = useState<string>('');
  const [ingestDate, setIngestDate] = useState<string>('2024');
  const [ingestText, setIngestText] = useState<string>('');
  const [ingesting, setIngesting] = useState<boolean>(false);
  const [ingestionResult, setIngestionResult] = useState<IngestionResponse | null>(null);

  // Chọn đoạn để commit
  const [selectedParagraphs, setSelectedParagraphs] = useState<Record<string, { selected: boolean; unitType: string }>>({});
  const [commitNotes, setCommitNotes] = useState<string>('Đã đối chiếu với bài viết gốc');
  const [committing, setCommitting] = useState<boolean>(false);

  // ==================== TAB 2: KIỂM DUYỆT TRI THỨC (CURATION) ====================
  const [sources, setSources] = useState<KnowledgeSourceItem[]>([]);
  const [loadingSources, setLoadingSources] = useState<boolean>(false);
  const [sourceFilterClass, setSourceFilterClass] = useState<string>('ALL');
  const [sourceApprovalFilter, setSourceApprovalFilter] = useState<'ALL' | 'APPROVED' | 'PENDING'>('ALL');
  const [sourceSearch, setSourceSearch] = useState<string>('');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [batchActionLoading, setBatchActionLoading] = useState<boolean>(false);

  // Reindex Status Dialog
  const [reindexStatusOpen, setReindexStatusOpen] = useState<boolean>(false);
  const [reindexStatusData, setReindexStatusData] = useState<any>(null);
  const [loadingReindexStatus, setLoadingReindexStatus] = useState<boolean>(false);

  // ==================== TAB 3: KHO THUỐC BVTV ====================
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [loadingMedicines, setLoadingMedicines] = useState<boolean>(false);
  const [medSearch, setMedSearch] = useState<string>('');
  const [editingMed, setEditingMed] = useState<MedicineItem | null>(null);
  const [medSaving, setMedSaving] = useState<boolean>(false);

  // ==================== TAB 4: CA CHUYÊN GIA ====================
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [loadingEscalations, setLoadingEscalations] = useState<boolean>(false);
  const [selectedEscalation, setSelectedEscalation] = useState<EscalationItem | null>(null);
  const [expertNoteInput, setExpertNoteInput] = useState<string>('');
  const [reviewSubmitting, setReviewSubmitting] = useState<boolean>(false);

  // Load danh mục 38/40 lớp bệnh
  useEffect(() => {
    const fetchDiseases = async () => {
      try {
        const res = await apiClient.get('/diseases');
        setDiseases(res.data || []);
      } catch {
        // fallback
      }
    };
    fetchDiseases();
  }, []);

  // Sync defaultTab prop when route changes
  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  // Load data for active tab
  useEffect(() => {
    if (activeTab === 'curation') {
      fetchSources();
    } else if (activeTab === 'inventory') {
      fetchMedicines();
    } else if (activeTab === 'escalations') {
      fetchEscalations();
    }
  }, [activeTab]);

  // ==================== TAB 1 LOGIC ====================
  const handleParseArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestUrl.trim() || !ingestTitle.trim() || !ingestOrg.trim() || !ingestText.trim()) {
      toast.error('Vui lòng điền đầy đủ URL, Tiêu đề, Cơ quan và dán nội dung bài báo.');
      return;
    }

    try {
      setIngesting(true);
      const res = await apiClient.post<IngestionResponse>('/knowledge/ingestions', {
        model_class: ingestClass,
        source_url: ingestUrl.trim(),
        source_title: ingestTitle.trim(),
        organization: ingestOrg.trim(),
        published_date: ingestDate.trim(),
        article_text: ingestText.trim(),
      }, { timeout: 45000 });

      setIngestionResult(res.data);

      // Khởi tạo state chọn đoạn: MẶC ĐỊNH KHÔNG TICK ĐOẠN NÀO ĐỂ ADMIN ĐỌC VÀ CHỦ ĐỘNG DUYỆT (Mục 10)
      const initialMap: Record<string, { selected: boolean; unitType: string }> = {};

      res.data.paragraphs.forEach((p) => {
        initialMap[p.id] = {
          selected: false,
          unitType: p.suggested_unit_type || 'SYMPTOMS',
        };
      });

      setSelectedParagraphs(initialMap);
      toast.success(
        res.data.ai_suggestion_available
          ? `Tách thành công ${res.data.paragraphs.length} đoạn. AI đã gợi ý nhãn phân loại.`
          : `Tách thành công ${res.data.paragraphs.length} đoạn (Agent bận, vui lòng tự gán nhãn).`
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIngesting(false);
    }
  };

  const handleCommitParagraphs = async () => {
    if (!ingestionResult) return;

    const selections = Object.entries(selectedParagraphs)
      .filter(([_, val]) => val.selected)
      .map(([id, val]) => ({
        paragraph_id: id,
        unit_type: val.unitType,
      }));

    if (selections.length === 0) {
      toast.error('Vui lòng tick chọn ít nhất 1 đoạn nguyên văn để phê duyệt.');
      return;
    }

    if (selections.length > 4) {
      toast.error('Mỗi bài viết chỉ được trích dẫn tối đa 4 đoạn nguyên văn.');
      return;
    }

    try {
      setCommitting(true);
      const res = await apiClient.post(`/knowledge/ingestions/${ingestionResult.ingestion_id}/commit`, {
        selections,
        reviewer_notes: commitNotes.trim(),
      });

      const reindexText = res.data.reindex_status === 'accepted' ? 'Đang đồng bộ vector nền' : (res.data.reindex_status === 'failed' ? 'Lỗi kết nối đồng bộ' : res.data.reindex_status);
      toast.success(
        `Đã lưu và duyệt ${res.data.created_source_ids?.length || selections.length} đoạn nguyên văn vào CSDL (${reindexText}).`
      );

      // Reset form
      setIngestionResult(null);
      setIngestText('');
      setIngestTitle('');
      setIngestUrl('');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCommitting(false);
    }
  };

  const countSelected = Object.values(selectedParagraphs).filter((v) => v.selected).length;

  // ==================== TAB 2 LOGIC ====================
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

      toast.success(
        !currentApproved
          ? `Đã duyệt bài viết. Reindex: ${res.data.reindex_status}`
          : `Đã bỏ duyệt bài viết. Reindex: ${res.data.reindex_status}`
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
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
    if (sourceFilterClass !== 'ALL' && s.modelClass !== sourceFilterClass) return false;
    if (sourceApprovalFilter === 'APPROVED' && !s.isManualApproved) return false;
    if (sourceApprovalFilter === 'PENDING' && s.isManualApproved) return false;

    if (sourceSearch.trim()) {
      const q = sourceSearch.toLowerCase();
      const matchTitle = s.sourceTitle.toLowerCase().includes(q);
      const matchOrg = s.organization.toLowerCase().includes(q);
      const matchDisease = s.diseaseName.toLowerCase().includes(q);
      if (!matchTitle && !matchOrg && !matchDisease) return false;
    }

    return true;
  });

  // ==================== TAB 3 LOGIC ====================
  const fetchMedicines = async () => {
    try {
      setLoadingMedicines(true);
      const res = await apiClient.get('/medicines/search', {
        params: { allowedOnly: false },
      });
      setMedicines(res.data.items || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingMedicines(false);
    }
  };

  const handleToggleMedicineAllowed = async (med: MedicineItem) => {
    try {
      const res = await apiClient.patch(`/medicines/${med.id}`, {
        is_allowed: !med.is_allowed,
      });

      setMedicines((prev) =>
        prev.map((m) => (m.id === med.id ? { ...m, is_allowed: res.data.is_allowed } : m))
      );

      toast.success(
        res.data.is_allowed
          ? `Đã bật lưu hành thuốc '${med.name}'.`
          : `Đã dừng lưu hành thuốc '${med.name}'.`
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleSaveMedicineEdit = async () => {
    if (!editingMed) return;

    try {
      setMedSaving(true);
      const res = await apiClient.patch(`/medicines/${editingMed.id}`, {
        phi_days: editingMed.phi_days,
        price: editingMed.price,
        stock_quantity: editingMed.stock_quantity,
        is_allowed: editingMed.is_allowed,
      });

      setMedicines((prev) =>
        prev.map((m) => (m.id === editingMed.id ? { ...m, ...res.data } : m))
      );

      setEditingMed(null);
      toast.success(`Đã cập nhật thông tin thuốc '${res.data.name}'.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setMedSaving(false);
    }
  };

  const filteredMedicines = medicines.filter((m) => {
    if (!medSearch.trim()) return true;
    const q = medSearch.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.active_ingredient.toLowerCase().includes(q);
  });

  // ==================== TAB 4 LOGIC ====================
  const fetchEscalations = async () => {
    try {
      setLoadingEscalations(true);
      const res = await apiClient.get<EscalationItem[]>('/diagnose/escalations');
      setEscalations(res.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingEscalations(false);
    }
  };

  const handleSaveExpertReview = async () => {
    if (!selectedEscalation || !expertNoteInput.trim()) {
      toast.error('Vui lòng nhập kết luận và hướng dẫn điều trị của chuyên gia.');
      return;
    }

    try {
      setReviewSubmitting(true);
      const res = await apiClient.patch(`/diagnose/${selectedEscalation.id}/expert-review`, {
        expert_notes: expertNoteInput.trim(),
      });

      setEscalations((prev) =>
        prev.map((e) =>
          e.id === selectedEscalation.id
            ? { ...e, expertNotes: res.data.expert_notes, expertReviewedAt: res.data.expert_reviewed_at }
            : e
        )
      );

      setSelectedEscalation(null);
      setExpertNoteInput('');
      toast.success('Đã gửi phản hồi phác đồ điều trị của chuyên gia tới nông dân.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {SECTION_COPY[activeTab]?.title ?? 'Quản trị'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {SECTION_COPY[activeTab]?.description}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={checkReindexStatus}
          className="gap-2 shrink-0 bg-card border-border hover:bg-muted"
        >
          <Database className="w-4 h-4 text-emerald-700" />
          <span>Trạng thái Reindex</span>
        </Button>
      </div>

      {/* Điều hướng giữa các mục nằm ở sidebar AdminShell; trang này chỉ hiển thị nội dung mục đang chọn */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">

        {/* ========================================================================================= */}
        {/* TAB 1: NHẬP BÀI BÁO NGUYÊN VĂN (HITL INGESTION) */}
        {/* ========================================================================================= */}
        <TabsContent value="ingestion" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Cột trái: Form nhập bài */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="border-border bg-card shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-700" />
                    <span>Dán văn bản bài báo khuyến nông</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Server không tự tải URL để chống SSRF. Admin copy văn bản từ bài báo/PDF dán vào đây.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <form onSubmit={handleParseArticle} className="space-y-3.5 text-xs">
                    <div>
                      <label className="font-semibold text-foreground block mb-1">
                        1. Lớp bệnh mục tiêu *
                      </label>
                      <select
                        value={ingestClass}
                        onChange={(e) => setIngestClass(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs focus:ring-2 focus:ring-ring outline-hidden"
                      >
                        {diseases.map((d) => (
                          <option key={d.classCode} value={d.classCode}>
                            {d.plantName} — {d.commonNameVi}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-foreground block mb-1">
                        2. Đường dẫn URL nguồn *
                      </label>
                      <Input
                        type="url"
                        placeholder="https://khuyennongvn.gov.vn/..."
                        value={ingestUrl}
                        onChange={(e) => setIngestUrl(e.target.value)}
                        required
                        className="text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-foreground block mb-1">
                        3. Tiêu đề bài viết *
                      </label>
                      <Input
                        type="text"
                        placeholder="Kỹ thuật phòng trừ bệnh mốc sương trên cà chua vụ đông"
                        value={ingestTitle}
                        onChange={(e) => setIngestTitle(e.target.value)}
                        required
                        className="text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-semibold text-foreground block mb-1">
                          4. Cơ quan / Tác giả *
                        </label>
                        <Input
                          type="text"
                          placeholder="Trung tâm Khuyến nông Quốc gia"
                          value={ingestOrg}
                          onChange={(e) => setIngestOrg(e.target.value)}
                          required
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-foreground block mb-1">
                          Năm xuất bản
                        </label>
                        <Input
                          type="text"
                          placeholder="2024"
                          value={ingestDate}
                          onChange={(e) => setIngestDate(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-semibold text-foreground">
                          5. Dán toàn văn bài báo *
                        </label>
                        <span className="text-[10px] text-muted-foreground">
                          {ingestText.length.toLocaleString('vi-VN')} / 50.000 ký tự
                        </span>
                      </div>
                      <Textarea
                        rows={10}
                        placeholder="Dán toàn bộ nội dung bài báo vào đây. Hệ thống sẽ tách thành các đoạn P1, P2... và gửi sang Agent Service để AI gợi ý nhãn."
                        value={ingestText}
                        onChange={(e) => setIngestText(e.target.value)}
                        required
                        maxLength={50000}
                        className="text-xs font-mono resize-y"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={ingesting}
                      className="w-full gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-10"
                    >
                      {ingesting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Đang phân tích &amp; Tách đoạn...</span>
                        </>
                      ) : (
                        <>
                          <Layers className="w-4 h-4" />
                          <span>Tách đoạn &amp; Gọi AI Gợi ý Nhãn</span>
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Cột phải: Danh sách đoạn trích và chọn commit */}
            <div className="lg:col-span-7 space-y-4">
              {!ingestionResult ? (
                <div className="p-12 text-center bg-card border border-border rounded-xl h-full flex flex-col items-center justify-center space-y-3">
                  <FileText className="w-12 h-12 text-muted-foreground/30" />
                  <h3 className="text-base font-bold text-foreground">Chưa có dữ liệu bài báo</h3>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Điền thông tin và bấm nút "Tách đoạn &amp; Gọi AI Gợi ý Nhãn" ở cột bên trái để bắt đầu trích dẫn nguyên văn.
                  </p>
                </div>
              ) : (
                <Card className="border-border bg-card shadow-xs flex flex-col h-full">
                  <CardHeader className="pb-3 border-b border-border">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                          <span>Các đoạn văn bản đã tách ({ingestionResult.paragraphs.length} đoạn)</span>
                          {ingestionResult.ai_suggestion_available ? (
                            <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px]">
                              AI đã gợi ý nhãn
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-700 border-amber-300 text-[10px]">
                              Tự gán nhãn
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          Tick chọn <strong>tối đa 4 đoạn nguyên văn</strong> (≤ 800 ký tự/đoạn). Tick = Duyệt.
                        </CardDescription>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={countSelected > 4 ? 'bg-destructive text-white' : 'bg-muted text-foreground'}
                        >
                          Đã chọn: {countSelected} / 4 đoạn
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 flex-1 overflow-y-auto max-h-[560px] space-y-3">
                    {ingestionResult.paragraphs.map((para) => {
                      const state = selectedParagraphs[para.id] || { selected: false, unitType: 'SYMPTOMS' };
                      const isTooLong = para.text.length > 800;

                      return (
                        <div
                          key={para.id}
                          className={`p-3.5 rounded-lg border transition-colors ${
                            state.selected
                              ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs'
                              : 'bg-card border-border hover:bg-muted/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs">
                              <input
                                type="checkbox"
                                checked={state.selected}
                                disabled={isTooLong}
                                onChange={(e) => {
                                  setSelectedParagraphs((prev) => ({
                                    ...prev,
                                    [para.id]: {
                                      ...state,
                                      selected: e.target.checked,
                                    },
                                  }));
                                }}
                                className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600"
                              />
                              <span className="text-emerald-800 font-mono">{para.id}</span>
                              <span className="text-muted-foreground font-normal text-[11px]">
                                ({para.text.length} ký tự)
                              </span>
                              {isTooLong && (
                                <Badge variant="destructive" className="text-[10px] h-5">
                                  Vượt quá 800 ký tự
                                </Badge>
                              )}
                            </label>

                            {/* Select Unit Type */}
                            <select
                              value={state.unitType}
                              disabled={!state.selected}
                              onChange={(e) => {
                                setSelectedParagraphs((prev) => ({
                                  ...prev,
                                  [para.id]: {
                                    ...state,
                                    unitType: e.target.value,
                                  },
                                }));
                              }}
                              className="px-2 py-1 text-[11px] bg-background border border-border rounded font-medium disabled:opacity-50"
                            >
                              <option value="SYMPTOMS">Triệu chứng (SYMPTOMS)</option>
                              <option value="CAUSE_CONDITIONS">Nguyên nhân (CAUSE_CONDITIONS)</option>
                              <option value="PREVENTION">Phòng ngừa (PREVENTION)</option>
                              <option value="TREATMENT">Điều trị (TREATMENT)</option>
                            </select>
                          </div>

                          <p className="text-xs text-foreground/90 font-serif italic pl-6 leading-relaxed">
                            "{para.text}"
                          </p>
                        </div>
                      );
                    })}
                  </CardContent>

                  <div className="p-4 border-t border-border bg-muted/20 space-y-3">
                    <Input
                      type="text"
                      placeholder="Ghi chú người duyệt (ví dụ: Đã đối chiếu thông tư Cục BVTV)"
                      value={commitNotes}
                      onChange={(e) => setCommitNotes(e.target.value)}
                      className="text-xs bg-background"
                    />

                    <Button
                      onClick={handleCommitParagraphs}
                      disabled={committing || countSelected === 0 || countSelected > 4}
                      className="w-full gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-11"
                    >
                      {committing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Đang ghi CSDL &amp; Kích hoạt Reindex...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Duyệt &amp; Lưu {countSelected} Đoạn Nguyên Văn (Kích hoạt Reindex)</span>
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ========================================================================================= */}
        {/* TAB 2: KIỂM DUYỆT TRI THỨC HITL (CURATION TABLE) */}
        {/* ========================================================================================= */}
        <TabsContent value="curation" className="space-y-4">
          {/* Toolbar lọc */}
          <div className="bg-card p-4 rounded-xl border border-border shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Tìm theo tiêu đề, cơ quan, tên bệnh..."
                  value={sourceSearch}
                  onChange={(e) => setSourceSearch(e.target.value)}
                  className="pl-8 text-xs h-9 bg-background"
                />
              </div>

              <select
                value={sourceFilterClass}
                onChange={(e) => setSourceFilterClass(e.target.value)}
                className="h-9 px-2.5 bg-background border border-border rounded-lg text-xs"
              >
                <option value="ALL">Tất cả lớp cây–bệnh</option>
                {diseases.map((d) => (
                  <option key={d.classCode} value={d.classCode}>
                    {d.plantName} – {d.commonNameVi}
                  </option>
                ))}
              </select>

              <select
                value={sourceApprovalFilter}
                onChange={(e) => setSourceApprovalFilter(e.target.value as any)}
                className="h-9 px-2.5 bg-background border border-border rounded-lg text-xs"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="APPROVED">Đã duyệt (IsManualApproved = true)</option>
                <option value="PENDING">Chưa duyệt (Pending)</option>
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
            </div>
          </div>

          {/* Table */}
          <Card className="border-border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
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
                    <th className="p-3">Cây – Bệnh</th>
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
                    filteredSources.map((s) => {
                      const isSelected = selectedSourceIds.includes(s.id);
                      return (
                        <tr
                          key={s.id}
                          className={`hover:bg-muted/30 transition-colors ${
                            isSelected ? 'bg-emerald-50/40' : ''
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
                            <a
                              href={s.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-emerald-700 hover:underline inline-flex items-center gap-0.5 mt-0.5"
                            >
                              <span>Xem bài gốc</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="font-semibold text-foreground block">{s.plantName}</span>
                            <span className="text-[11px] text-muted-foreground">{s.diseaseName}</span>
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
                            <p className="line-clamp-2 italic text-muted-foreground font-serif">
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
                              className={`h-7 px-2.5 text-xs ${
                                s.isManualApproved
                                  ? 'text-muted-foreground hover:text-destructive'
                                  : 'bg-emerald-700 hover:bg-emerald-800 text-white font-semibold'
                              }`}
                            >
                              {s.isManualApproved ? 'Bỏ duyệt' : 'Duyệt bài'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ========================================================================================= */}
        {/* TAB 3: QUẢN LÝ KHO THUỐC BVTV & PHI */}
        {/* ========================================================================================= */}
        <TabsContent value="inventory" className="space-y-4">
          <div className="bg-card p-4 rounded-xl border border-border shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between text-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Tìm theo tên thuốc hoặc hoạt chất..."
                value={medSearch}
                onChange={(e) => setMedSearch(e.target.value)}
                className="pl-8 text-xs h-9 bg-background"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchMedicines}
              disabled={loadingMedicines}
              className="h-9 bg-card border-border hover:bg-muted text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingMedicines ? 'animate-spin' : ''}`} />
              Làm mới kho
            </Button>
          </div>

          <Card className="border-border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-3">Mã #</th>
                    <th className="p-3">Tên thuốc &amp; Hoạt chất</th>
                    <th className="p-3">Phân loại</th>
                    <th className="p-3">Giá bán</th>
                    <th className="p-3">Cách ly (PHI)</th>
                    <th className="p-3">Tồn kho</th>
                    <th className="p-3 text-center">Trạng thái lưu hành</th>
                    <th className="p-3 text-right">Chỉnh sửa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loadingMedicines ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        Đang tải danh mục thuốc...
                      </td>
                    </tr>
                  ) : filteredMedicines.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        Không có sản phẩm nào.
                      </td>
                    </tr>
                  ) : (
                    filteredMedicines.map((med) => (
                      <tr key={med.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono text-muted-foreground">{med.id}</td>
                        <td className="p-3">
                          <div className="font-bold text-foreground">{med.name}</div>
                          <div className="text-[11px] text-muted-foreground">{med.active_ingredient}</div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={
                              med.medicine_type === 'Sinh học'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-blue-50 text-blue-800 border-blue-300'
                            }
                          >
                            {med.medicine_type}
                          </Badge>
                        </td>
                        <td className="p-3 font-semibold text-emerald-800 whitespace-nowrap">
                          {med.price.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {med.phi_days <= 3 ? (
                            <Badge className="bg-emerald-700 text-white text-[10px]">
                              {med.phi_days} ngày (Cận hái)
                            </Badge>
                          ) : (
                            <span className="font-medium text-foreground">{med.phi_days} ngày</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap font-medium">
                          {med.stock_quantity > 0 ? (
                            <span>{med.stock_quantity}</span>
                          ) : (
                            <span className="text-destructive font-bold">Hết hàng</span>
                          )}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <Button
                            size="sm"
                            variant={med.is_allowed ? 'default' : 'outline'}
                            onClick={() => handleToggleMedicineAllowed(med)}
                            className={`h-7 px-2.5 text-xs font-semibold ${
                              med.is_allowed
                                ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                : 'text-destructive border-destructive/30 hover:bg-destructive/10'
                            }`}
                          >
                            {med.is_allowed ? 'Đang lưu hành' : 'Bị cấm / Dừng bán'}
                          </Button>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingMed(med)}
                            className="h-7 text-xs text-primary"
                          >
                            Sửa thông số
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ========================================================================================= */}
        {/* TAB 4: THẨM ĐỊNH CA BỆNH KHÓ (EXPERT ESCALATIONS) */}
        {/* ========================================================================================= */}
        <TabsContent value="escalations" className="space-y-4">
          <div className="flex items-center justify-between pb-2">
            <div>
              <h3 className="text-base font-bold text-foreground">
                Ca bệnh có yêu cầu Bác sĩ Cây trồng thẩm định
              </h3>
              <p className="text-xs text-muted-foreground">
                Các ca chẩn đoán có độ bất định cao (IsUncertain = true) hoặc nông dân bấm nút "Nhờ chuyên gia".
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchEscalations}
              disabled={loadingEscalations}
              className="gap-2 bg-card border-border hover:bg-muted text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingEscalations ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </Button>
          </div>

          {loadingEscalations ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-36 rounded-xl bg-card border border-border p-4 animate-pulse" />
              ))}
            </div>
          ) : escalations.length === 0 ? (
            <div className="p-12 text-center bg-card border border-border rounded-xl">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600 mb-2" />
              <h4 className="text-base font-bold text-foreground">Không có ca bệnh nào tồn đọng</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Tất cả các ca khám lá của nông dân đều đã được AI nhận diện ổn định hoặc chuyên gia đã xử lý xong.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {escalations.map((item) => (
                <Card key={item.id} className="border-border bg-card shadow-xs flex flex-col justify-between">
                  <CardHeader className="p-4 pb-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-300 text-xs">
                        {item.plantName} – {item.diseaseName}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    <CardTitle className="text-sm font-bold text-foreground pt-1">
                      Nông dân: {item.userName} {item.userPhone ? `(${item.userPhone})` : ''}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="p-4 pt-1 space-y-3 text-xs">
                    {item.notes && (
                      <div className="bg-muted/30 p-2.5 rounded-lg border border-border/60">
                        <span className="font-semibold text-foreground block mb-0.5">Mô tả từ nông dân:</span>
                        <p className="text-muted-foreground italic">"{item.notes}"</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {item.originalImageUrl && (
                        <div className="w-20 h-20 rounded-md border border-border overflow-hidden shrink-0">
                          <img
                            src={item.originalImageUrl}
                            alt="Ảnh lá"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      {item.gradCamImageUrl && (
                        <div className="w-20 h-20 rounded-md border border-border overflow-hidden shrink-0">
                          <img
                            src={item.gradCamImageUrl}
                            alt="Grad-CAM"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 text-[11px] space-y-1">
                        <div>Độ tin cậy AI: <strong>{(item.confidence * 100).toFixed(1)}%</strong></div>
                        {item.expertNotes ? (
                          <div className="text-emerald-800 font-medium bg-emerald-50 p-1.5 rounded border border-emerald-200 line-clamp-2">
                            BS: {item.expertNotes}
                          </div>
                        ) : (
                          <div className="text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200">
                            Chờ bác sĩ phản hồi phác đồ...
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs mt-2"
                      onClick={() => {
                        setSelectedEscalation(item);
                        setExpertNoteInput(item.expertNotes || '');
                      }}
                    >
                      {item.expertNotes ? 'Cập nhật phác đồ điều trị' : 'Thẩm định & Viết phác đồ'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ========================================================================================= */}
      {/* DIALOG SỬA THÔNG SỐ THUỐC BVTV */}
      {/* ========================================================================================= */}
      <Dialog open={!!editingMed} onOpenChange={() => setEditingMed(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Chỉnh sửa thông số thuốc: {editingMed?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cập nhật giá bán, số ngày cách ly (PHI) và số lượng tồn kho.
            </DialogDescription>
          </DialogHeader>

          {editingMed && (
            <div className="space-y-3.5 py-2 text-xs">
              <div>
                <label className="font-semibold block mb-1">Giá bán (VNĐ) *</label>
                <Input
                  type="number"
                  value={editingMed.price}
                  onChange={(e) =>
                    setEditingMed({ ...editingMed, price: parseFloat(e.target.value) || 0 })
                  }
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Thời gian cách ly PHI (ngày) *</label>
                <Input
                  type="number"
                  value={editingMed.phi_days}
                  onChange={(e) =>
                    setEditingMed({ ...editingMed, phi_days: parseInt(e.target.value, 10) || 0 })
                  }
                  className="text-xs"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Lưu ý: Thuốc có PHI ≤ 3 ngày sẽ được ưu tiên hiển thị cho cây cận ngày thu hoạch.
                </p>
              </div>

              <div>
                <label className="font-semibold block mb-1">Số lượng tồn kho (chai/gói) *</label>
                <Input
                  type="number"
                  value={editingMed.stock_quantity}
                  onChange={(e) =>
                    setEditingMed({ ...editingMed, stock_quantity: parseInt(e.target.value, 10) || 0 })
                  }
                  className="text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setEditingMed(null)}>
              Hủy
            </Button>
            <Button
              size="sm"
              disabled={medSaving}
              onClick={handleSaveMedicineEdit}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
            >
              {medSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================================= */}
      {/* DIALOG THẨM ĐỊNH CA BỆNH KHÓ */}
      {/* ========================================================================================= */}
      <Dialog open={!!selectedEscalation} onOpenChange={() => setSelectedEscalation(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Thẩm định Chuyên môn &amp; Phác đồ điều trị
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ca bệnh: {selectedEscalation?.plantName} – {selectedEscalation?.diseaseName}
            </DialogDescription>
          </DialogHeader>

          {selectedEscalation && (
            <div className="space-y-3.5 py-2 text-xs">
              <div className="bg-muted/40 p-3 rounded-lg border border-border space-y-1">
                <div>Nông dân: <strong>{selectedEscalation.userName}</strong> ({selectedEscalation.userPhone || 'Không có SĐT'})</div>
                {selectedEscalation.notes && <div>Ghi chú vườn: <em>"{selectedEscalation.notes}"</em></div>}
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  Kết luận chẩn đoán &amp; Hướng dẫn điều trị của Bác sĩ Cây trồng *
                </label>
                <Textarea
                  rows={4}
                  placeholder="Ghi rõ phác đồ xử lý: cách ly, tỉa cành tiêu hủy, loại thuốc sinh học/hóa học nên dùng kèm liều lượng và thời gian phun..."
                  value={expertNoteInput}
                  onChange={(e) => setExpertNoteInput(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setSelectedEscalation(null)}>
              Đóng
            </Button>
            <Button
              size="sm"
              disabled={reviewSubmitting}
              onClick={handleSaveExpertReview}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
            >
              {reviewSubmitting ? 'Đang gửi...' : 'Gửi phản hồi chuyên gia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================================= */}
      {/* DIALOG KIỂM TRA TRẠNG THÁI REINDEX */}
      {/* ========================================================================================= */}
      <Dialog open={reindexStatusOpen} onOpenChange={setReindexStatusOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-700" />
              <span>Trạng thái Reindex của Agent Service</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 text-xs">
            {loadingReindexStatus ? (
              <div className="text-center py-6 text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-700" />
                Đang truy vấn Agent Service...
              </div>
            ) : reindexStatusData ? (
              <pre className="p-3 bg-muted rounded-lg font-mono text-[11px] overflow-x-auto border border-border">
                {JSON.stringify(reindexStatusData, null, 2)}
              </pre>
            ) : (
              <p className="text-muted-foreground">Không có dữ liệu phản hồi.</p>
            )}
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setReindexStatusOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
