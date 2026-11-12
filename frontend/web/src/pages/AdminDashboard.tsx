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
  UserCheck, AlertTriangle, Check, X, Clock, HelpCircle, Eye, Trash2,
  ChevronDown, ChevronUp, ChevronRight, Sparkles, Image as ImageIcon,
  Plus, UploadCloud, Link as LinkIcon, ZoomIn
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
  mentions?: Array<{ text: string; kind: string }>;
}

interface SuggestedMetadata {
  model_class?: string | null;
  source_title?: string | null;
  organization?: string | null;
  published_date?: string | null;
}

interface IngestionResponse {
  ingestion_id: string;
  expires_at: string;
  article_length?: number;
  paragraphs: ParagraphItem[];
  suggested_metadata?: SuggestedMetadata | null;
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
  active_ingredient?: string;
  medicine_type: string;
  price: number;
  dosage_instruction: string;
  phi_days?: number | null;
  is_allowed: boolean;
  rain_resistant: boolean;
  stock_quantity: number;
  availability?: string; // IN_STOCK | OUT_OF_STOCK | NOT_SOLD
  info_source_url?: string;
}

interface ProductSuggestionItem {
  id: number;
  knowledge_source_id: string;
  model_class: string;
  plant_name: string;
  disease_name: string;
  mention_text: string;
  kind: string; // CHEMICAL | BIOLOGICAL | SUPPLY | PRACTICE
  status: string; // PENDING | ADDED | LINKED | DISMISSED
  product_id?: number | null;
  product_name?: string | null;
  evidence_text?: string;
  source_url?: string;
  source_title?: string;
  created_at: string;
  resolved_at?: string | null;
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

export interface KnowledgeImageItem {
  id: number;
  model_class: string;
  plant_name: string;
  disease_name: string;
  source_url: string;
  image_url: string;
  storage_key?: string | null;
  caption: string;
  plant_part: string; // LEAF | FRUIT | STEM | WHOLE_PLANT
  credit: string;
  license_note?: string | null;
  is_manual_approved: boolean;
  created_at: string;
}

interface AdminDashboardProps {
  defaultTab?: 'ingestion' | 'curation' | 'images' | 'inventory' | 'escalations';
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
  images: {
    title: 'Ảnh triệu chứng thực địa',
    description: 'Quản lý kho ảnh triệu chứng bệnh cây (lá, quả, thân, toàn cây) hiển thị trên Sổ tay bệnh học và đối chiếu chẩn đoán.',
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
  // Mục 3 là "Tùy chọn - để AI tự đoán": không chọn sẵn cây/bệnh
  const [ingestClass, setIngestClass] = useState<string>('');
  // true khi cây/bệnh do AI đoán từ bài trước: bài mới phải đoán lại, không mang theo
  const [classFromAi, setClassFromAi] = useState<boolean>(false);
  const [selectedPlant, setSelectedPlant] = useState<string>('');
  const [ingestUrl, setIngestUrl] = useState<string>('');
  const [ingestTitle, setIngestTitle] = useState<string>('');
  const [ingestOrg, setIngestOrg] = useState<string>('');
  const [ingestDate, setIngestDate] = useState<string>('');
  const [ingestText, setIngestText] = useState<string>('');
  const [ingesting, setIngesting] = useState<boolean>(false);
  const [ingestionResult, setIngestionResult] = useState<IngestionResponse | null>(null);

  // Chọn đoạn để commit
  const [selectedParagraphs, setSelectedParagraphs] = useState<Record<string, { selected: boolean; unitType: string }>>({});
  const [commitNotes, setCommitNotes] = useState<string>('Đã đối chiếu với bài viết gốc');
  const [committing, setCommitting] = useState<boolean>(false);
  const [showNoiseParagraphs, setShowNoiseParagraphs] = useState<boolean>(false);

  // ==================== TAB 2: KIỂM DUYỆT TRI THỨC (CURATION) ====================
  const [sources, setSources] = useState<KnowledgeSourceItem[]>([]);
  const [loadingSources, setLoadingSources] = useState<boolean>(false);
  const [sourceFilterClass, setSourceFilterClass] = useState<string>('ALL');
  const [sourceApprovalFilter, setSourceApprovalFilter] = useState<'ALL' | 'APPROVED' | 'PENDING'>('ALL');
  const [sourceSearch, setSourceSearch] = useState<string>('');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeSourceItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [batchActionLoading, setBatchActionLoading] = useState<boolean>(false);

  // Reindex Status Dialog
  const [reindexStatusOpen, setReindexStatusOpen] = useState<boolean>(false);
  const [reindexStatusData, setReindexStatusData] = useState<any>(null);
  const [loadingReindexStatus, setLoadingReindexStatus] = useState<boolean>(false);

  // ==================== TAB: ẢNH TRIỆU CHỨNG (TASK-15 PHASE 2) ====================
  const [knowledgeImages, setKnowledgeImages] = useState<KnowledgeImageItem[]>([]);
  const [loadingImages, setLoadingImages] = useState<boolean>(false);
  const [imageFilterPlant, setImageFilterPlant] = useState<string>('ALL');
  const [imageFilterClass, setImageFilterClass] = useState<string>('ALL');
  const [imageFilterPart, setImageFilterPart] = useState<string>('ALL');
  const [imageFilterApproval, setImageFilterApproval] = useState<'ALL' | 'APPROVED' | 'PENDING'>('ALL');
  const [imageSearch, setImageSearch] = useState<string>('');

  // Dialog Thêm ảnh mới
  const [addImageModalOpen, setAddImageModalOpen] = useState<boolean>(false);
  const [submittingImage, setSubmittingImage] = useState<boolean>(false);
  const [newImagePlant, setNewImagePlant] = useState<string>('Cà chua');
  const [newImageClass, setNewImageClass] = useState<string>('Tomato___Late_blight');
  const [newImageSourceUrl, setNewImageSourceUrl] = useState<string>('');
  const [newImageMode, setNewImageMode] = useState<'FILE' | 'URL'>('URL');
  const [newImageUrl, setNewImageUrl] = useState<string>('');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImageFilePreview, setNewImageFilePreview] = useState<string | null>(null);
  const [newImageCaption, setNewImageCaption] = useState<string>('');
  const [newImagePlantPart, setNewImagePlantPart] = useState<string>('LEAF');
  const [newImageCredit, setNewImageCredit] = useState<string>('');
  const [newImageLicenseNote, setNewImageLicenseNote] = useState<string>('Trích dẫn phục vụ học thuật và hướng dẫn nông vụ khuyến nông');
  const [newImageAutoApprove, setNewImageAutoApprove] = useState<boolean>(true);

  // Dialog Xem / Xóa ảnh
  const [deleteImageTarget, setDeleteImageTarget] = useState<KnowledgeImageItem | null>(null);
  const [deletingImage, setDeletingImage] = useState<boolean>(false);
  const [previewingImage, setPreviewingImage] = useState<KnowledgeImageItem | null>(null);

  // ==================== TAB 3: KHO THUỐC BVTV & GỢI Ý VẬT TƯ ====================
  const [inventorySubTab, setInventorySubTab] = useState<'medicines' | 'suggestions'>('medicines');
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [loadingMedicines, setLoadingMedicines] = useState<boolean>(false);
  const [medSearch, setMedSearch] = useState<string>('');
  const [editingMed, setEditingMed] = useState<MedicineItem | null>(null);
  const [medSaving, setMedSaving] = useState<boolean>(false);

  // Gợi ý vật tư từ bài báo (Task-15 Phase 3)
  const [suggestions, setSuggestions] = useState<ProductSuggestionItem[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);
  const [suggestionStatusFilter, setSuggestionStatusFilter] = useState<string>('ALL');
  const [suggestionKindFilter, setSuggestionKindFilter] = useState<string>('ALL');
  const [suggestionSearch, setSuggestionSearch] = useState<string>('');

  // Dialog liên kết gợi ý với sản phẩm có sẵn
  const [linkingSuggestion, setLinkingSuggestion] = useState<ProductSuggestionItem | null>(null);
  const [selectedLinkMedId, setSelectedLinkMedId] = useState<number | ''>('');
  const [linkingLoading, setLinkingLoading] = useState<boolean>(false);

  // Dialog thêm thuốc / vật tư mới (từ gợi ý hoặc thêm thủ công)
  const [createMedModalOpen, setCreateMedModalOpen] = useState<boolean>(false);
  const [fromSuggestion, setFromSuggestion] = useState<ProductSuggestionItem | null>(null);
  const [newMedName, setNewMedName] = useState<string>('');
  const [newMedType, setNewMedType] = useState<string>('Hóa học');
  const [newMedActiveIngredient, setNewMedActiveIngredient] = useState<string>('');
  const [newMedPrice, setNewMedPrice] = useState<number>(50000);
  const [newMedDosage, setNewMedDosage] = useState<string>('Pha theo hướng dẫn trên bao bì');
  const [newMedPhi, setNewMedPhi] = useState<number | ''>(7);
  const [newMedStock, setNewMedStock] = useState<number>(50);
  const [newMedAvailability, setNewMedAvailability] = useState<string>('IN_STOCK');
  const [newMedSourceUrl, setNewMedSourceUrl] = useState<string>('');
  const [newMedTargetDisease, setNewMedTargetDisease] = useState<string>('Tomato___Late_blight');
  const [newMedIsAllowed, setNewMedIsAllowed] = useState<boolean>(false);
  const [creatingMed, setCreatingMed] = useState<boolean>(false);

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
        const list: DiseaseOption[] = res.data || [];
        setDiseases(list);
        // Không tự chọn bệnh đầu danh sách (trước đây luôn ra "Táo") để AI tự nhận diện
      } catch {
        // fallback
      }
    };
    fetchDiseases();
  }, []);

  // Lọc danh sách loài cây duy nhất và các bệnh thuộc loài cây đang chọn
  const uniquePlants = React.useMemo(() => {
    const set = new Set<string>();
    diseases.forEach((d) => {
      if (d.plantName) set.add(d.plantName);
    });
    return Array.from(set);
  }, [diseases]);

  const filteredDiseasesByPlant = React.useMemo(() => {
    if (!selectedPlant) return diseases;
    return diseases.filter((d) => d.plantName === selectedPlant);
  }, [diseases, selectedPlant]);

  const handlePlantChange = (plant: string) => {
    setSelectedPlant(plant);
    setClassFromAi(false);
    // Đổi cây thì bỏ bệnh không thuộc cây đó; không tự đoán bệnh đầu danh sách
    const current = diseases.find((d) => d.classCode === ingestClass);
    if (!current || current.plantName !== plant) {
      setIngestClass('');
    }
  };

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
    } else if (activeTab === 'images') {
      fetchKnowledgeImages();
    } else if (activeTab === 'inventory') {
      fetchMedicines();
      fetchSuggestions();
    } else if (activeTab === 'escalations') {
      fetchEscalations();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'images') {
      fetchKnowledgeImages();
    }
  }, [imageFilterClass, imageFilterPart, imageFilterApproval]);

  // ==================== TAB 1 LOGIC (TASK-15 V2) ====================
  const cleanArticleTextFromHtml = (html: string): string => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Loại bỏ thẻ rác, menu, header, footer, quảng cáo
      const junkSelectors = [
        'script', 'style', 'nav', 'header', 'footer', 'aside', 'form', 'iframe', 'noscript', 'svg',
        '.menu', '.navbar', '.sidebar', '.ad', '.ads', '.advertisement',
        '.social-share', '.share-buttons', '.share', '.comment', '.comments',
        '.related', '.related-posts', '.breadcrumb', '.hotline', '.contact-info',
        '[role="navigation"]', '[role="banner"]', '[role="complementary"]'
      ];
      junkSelectors.forEach((sel) => {
        doc.querySelectorAll(sel).forEach((el) => el.remove());
      });

      const isNoise = (text: string): boolean => {
        if (!text || text.length < 5) return true;
        const lower = text.toLowerCase();
        if (/^(chia sẻ|bình luận|tin liên quan|xem thêm|bài viết liên quan|từ khóa|tag|hotline|liên hệ|quảng cáo)\b/i.test(text)) return true;
        if (/^(điện thoại|sđt|hotline|email|fax):\s*[\d\s.\-]+$/i.test(text)) return true;
        if (/^(facebook|zalo|twitter|youtube|in)\b/i.test(lower)) return true;
        // Hotline/quảng cáo: có số điện thoại đi kèm từ khóa liên hệ, hoặc dòng footer quen thuộc
        const hasPhone = /(\+84|\b0)\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3,4}\b/.test(text);
        if (text.length <= 300 && hasPhone && /hotline|zalo|liên hệ|tư vấn|đặt hàng|mua hàng|gọi/i.test(text)) return true;
        if (/^bạn đang đọc bài viết|^đăng ký nhận bản tin/i.test(text)) return true;
        return false;
      };

      // Dòng ngắn chỉ giữ khi là tiêu đề mục ("Biện pháp hóa học:", "4. Biện pháp quản lý");
      // Core sẽ ghép tiêu đề mục vào đoạn ngay sau để không mất ngữ cảnh
      const isHeading = (el: Element | null, text: string): boolean =>
        (!!el && /^H[1-6]$/.test(el.tagName)) ||
        /:\s*$/.test(text) ||
        /^(\d+|[IVX]+|[a-zđ])[.)]\s+\S/i.test(text);
      const keep = (el: Element | null, text: string): boolean =>
        !isNoise(text) && (text.length >= 30 || (text.length >= 3 && isHeading(el, text)));

      const mainEl = doc.querySelector('article') ||
                     doc.querySelector('[role="main"]') ||
                     doc.querySelector('.detail-content') ||
                     doc.querySelector('.post-content') ||
                     doc.querySelector('.article-content') ||
                     doc.querySelector('.entry-content') ||
                     doc.querySelector('.content') ||
                     doc.body;

      if (!mainEl) return '';

      const lines: string[] = [];
      const seen = new Set<string>();
      const push = (t: string) => {
        const norm = t.replace(/\s+/g, ' ').trim();
        if (!norm || seen.has(norm)) return; // footer lặp 2 lần, li lồng p...
        seen.add(norm);
        lines.push(norm);
      };

      // Tiêu đề bài và ngày đăng thường nằm ngoài <article>: giữ lại để AI điền metadata
      const titleText = (doc.querySelector('h1')?.textContent || '').trim();
      if (titleText && !isNoise(titleText)) push(titleText);
      const dateEl = doc.querySelector('time, .date, .post-date, .publish-date, .detail-time');
      const dateText = (dateEl?.getAttribute('datetime') || dateEl?.textContent || '').trim();
      if (dateText && dateText.length <= 80) push(`Ngày đăng: ${dateText}`);

      const blocks = mainEl.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
      if (blocks.length > 0) {
        blocks.forEach((b) => {
          const t = (b.textContent || '').trim();
          if (keep(b, t)) push(t);
        });
      } else {
        (mainEl.textContent || '').split(/\r?\n/).forEach((r) => {
          const t = r.trim();
          if (keep(null, t)) push(t);
        });
      }

      return lines.join('\n\n');
    } catch {
      return '';
    }
  };

  const resetArticleState = () => {
    setIngestionResult(null);
    setSelectedParagraphs({});
    setIngestTitle('');
    setIngestOrg('');
    setIngestDate('');
    if (classFromAi) {
      setIngestClass('');
      setSelectedPlant('');
      setClassFromAi(false);
    }
  };

  const handlePasteArticleText = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    resetArticleState();
    const htmlData = e.clipboardData.getData('text/html');
    if (htmlData && htmlData.length > 100) {
      const cleaned = cleanArticleTextFromHtml(htmlData);
      if (cleaned && cleaned.length >= 80) {
        e.preventDefault();
        setIngestText(cleaned);
        toast.success('Đã tự động bóc tách thân bài báo và loại bỏ menu/quảng cáo rác!');
      }
    }
  };

  const handleParseArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestUrl.trim()) {
      toast.error('Vui lòng nhập đường dẫn URL bài báo.');
      return;
    }
    if (!ingestText.trim()) {
      toast.error('Vui lòng dán nội dung văn bản bài báo.');
      return;
    }

    try {
      setIngesting(true);
      const res = await apiClient.post<IngestionResponse>('/knowledge/ingestions', {
        model_class: ingestClass || undefined,
        source_url: ingestUrl.trim(),
        // Tiêu đề/cơ quan/năm luôn để AI đọc lại từ bài đang dán; Admin sửa ở bước 2
        article_text: ingestText.trim(),
      }, { timeout: 45000 });

      setIngestionResult(res.data);

      // Điền metadata do AI gợi ý nếu có (không có thì để trống cho Admin nhập)
      if (!res.data.suggested_metadata) {
        setIngestTitle('');
        setIngestOrg('');
        setIngestDate('');
      } else {
        const meta = res.data.suggested_metadata;
        setIngestTitle(meta.source_title || '');
        setIngestOrg(meta.organization || '');
        setIngestDate(meta.published_date || '');
        if (meta.model_class) {
          if (meta.model_class !== ingestClass) setClassFromAi(true);
          setIngestClass(meta.model_class);
          const found = diseases.find((d) => d.classCode === meta.model_class);
          if (found) {
            setSelectedPlant(found.plantName);
          }
        }
      }

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
          ? `Tách thành công ${res.data.paragraphs.length} đoạn. AI đã gợi ý nhãn và thông tin bài.`
          : `Tách thành công ${res.data.paragraphs.length} đoạn, nhưng AI đang quá tải nên chưa gợi ý nhãn. Bạn tự chọn đoạn và nhãn, hoặc bấm Tách đoạn lại sau ít phút.`
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIngesting(false);
    }
  };

  const handleCommitParagraphs = async () => {
    if (!ingestionResult) return;

    if (!ingestClass) {
      toast.error('Vui lòng chọn Cây trồng - Bệnh hại trước khi duyệt.');
      return;
    }

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

    if (selections.length > 8) {
      toast.error('Mỗi bài viết chỉ được trích dẫn tối đa 8 đoạn nguyên văn (TASK-15).');
      return;
    }

    const currentSelectedChars = Object.entries(selectedParagraphs)
      .filter(([_, v]) => v.selected)
      .reduce((acc, [id]) => {
        const p = ingestionResult.paragraphs.find((x) => x.id === id);
        return acc + (p?.text.length || 0);
      }, 0);

    const articleLen = ingestionResult.article_length || ingestText.length || 1;
    const allowedQuota = Math.max(1200, Math.floor(articleLen * 0.3));

    if (currentSelectedChars > allowedQuota) {
      toast.error(`Tổng số ký tự các đoạn đã chọn (${currentSelectedChars.toLocaleString('vi-VN')}) vượt quá giới hạn trích dẫn hợp lý (${allowedQuota.toLocaleString('vi-VN')} ký tự, tối đa 30% bài theo TASK-15).`);
      return;
    }

    try {
      setCommitting(true);
      const res = await apiClient.post(`/knowledge/ingestions/${ingestionResult.ingestion_id}/commit`, {
        model_class: ingestClass,
        source_title: ingestTitle.trim() || 'Bài báo khuyến nông',
        organization: ingestOrg.trim() || 'Trung tâm Khuyến nông',
        published_date: ingestDate.trim() || 'Không ghi ngày',
        selections,
        reviewer_notes: commitNotes.trim(),
      });

      const reindexText = res.data.reindex_status === 'accepted' ? 'Đang đồng bộ vector nền' : (res.data.reindex_status === 'failed' ? 'Lỗi kết nối đồng bộ' : res.data.reindex_status);
      toast.success(
        `Đã lưu và duyệt ${res.data.created_source_ids?.length || selections.length} đoạn nguyên văn vào CSDL (${reindexText}).`
      );

      // Reset form
      resetArticleState();
      setIngestText('');
      setIngestUrl('');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCommitting(false);
    }
  };

  const countSelected = Object.values(selectedParagraphs).filter((v) => v.selected).length;
  const totalSelectedChars = Object.entries(selectedParagraphs)
    .filter(([_, v]) => v.selected)
    .reduce((acc, [id]) => {
      const p = ingestionResult?.paragraphs.find((x) => x.id === id);
      return acc + (p?.text.length || 0);
    }, 0);
  const articleLength = ingestionResult?.article_length || ingestText.length || 1;
  const allowedCharsQuota = Math.max(1200, Math.floor(articleLength * 0.3));

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

  interface GroupedArticle {
    key: string;
    sourceTitle: string;
    sourceUrl: string;
    organization: string;
    plantName: string;
    diseaseName: string;
    modelClass: string;
    paragraphs: KnowledgeSourceItem[];
    approvedCount: number;
    totalCount: number;
  }

  const groupedArticles = React.useMemo<GroupedArticle[]>(() => {
    const map = new Map<string, GroupedArticle>();

    filteredSources.forEach((s) => {
      const key = `${s.sourceUrl || ''}:::${s.sourceTitle || ''}:::${s.modelClass || ''}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          sourceTitle: s.sourceTitle,
          sourceUrl: s.sourceUrl,
          organization: s.organization,
          plantName: s.plantName,
          diseaseName: s.diseaseName,
          modelClass: s.modelClass,
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
    });

    return Array.from(map.values());
  }, [filteredSources]);

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

  // Bản sao BANNED_INGREDIENTS của backend/agent-service/app/agent/guardrails.py.
  // Chỉ để cảnh báo sớm trên form; Core kiểm tra lại. Sửa thì sửa cả 3 nơi (Pha 4 gộp về CSDL).
  const BANNED_INGREDIENTS = [
    'paraquat', 'pa-ra-quat', 'para-quat', 'gramoxone',
    '2,4-d', '2.4-d', '2,4d', '2.4d',
    'chlorpyrifos', 'carbofuran', 'glyphosate', 'monocrotophos', 'methamidophos', 'endosulfan'
  ];

  const isIngredientBanned = (text?: string | null): boolean => {
    if (!text) return false;
    const lower = text.toLowerCase();
    return BANNED_INGREDIENTS.some((b) => lower.includes(b));
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
        availability: editingMed.availability,
        info_source_url: editingMed.info_source_url,
        medicine_type: editingMed.medicine_type,
      });

      setMedicines((prev) =>
        prev.map((m) => (m.id === editingMed.id ? { ...m, ...res.data } : m))
      );

      setEditingMed(null);
      toast.success(`Đã cập nhật thông tin thuốc/vật tư '${res.data.name}'.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setMedSaving(false);
    }
  };

  const filteredMedicines = medicines.filter((m) => {
    if (!medSearch.trim()) return true;
    const q = medSearch.toLowerCase();
    return m.name.toLowerCase().includes(q) || (m.active_ingredient && m.active_ingredient.toLowerCase().includes(q));
  });

  // Gợi ý vật tư từ bài báo (Task-15 Phase 3)
  const fetchSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      const res = await apiClient.get<ProductSuggestionItem[]>('/knowledge/product-suggestions');
      setSuggestions(res.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleLinkSuggestion = async () => {
    if (!linkingSuggestion || !selectedLinkMedId) {
      toast.error('Vui lòng chọn một sản phẩm từ kho để liên kết.');
      return;
    }
    try {
      setLinkingLoading(true);
      await apiClient.post(`/knowledge/product-suggestions/${linkingSuggestion.id}/link`, {
        product_id: Number(selectedLinkMedId),
      });
      toast.success('Đã gắn sản phẩm với bệnh của gợi ý này.');
      await fetchSuggestions();
      setLinkingSuggestion(null);
      setSelectedLinkMedId('');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLinkingLoading(false);
    }
  };

  const handleDismissSuggestion = async (suggestionId: number) => {
    try {
      await apiClient.post(`/knowledge/product-suggestions/${suggestionId}/dismiss`);
      toast.success('Đã bỏ qua gợi ý vật tư này.');
      setSuggestions((prev) =>
        prev.map((s) => (s.id === suggestionId ? { ...s, status: 'DISMISSED', resolved_at: new Date().toISOString() } : s))
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleOpenCreateMedModal = (sug?: ProductSuggestionItem) => {
    if (sug) {
      setFromSuggestion(sug);
      setNewMedName(sug.mention_text);
      const mappedType =
        sug.kind === 'BIOLOGICAL'
          ? 'Sinh học'
          : sug.kind === 'SUPPLY' || sug.kind === 'PRACTICE'
          ? 'Vật tư canh tác'
          : 'Hóa học';
      setNewMedType(mappedType);
      setNewMedActiveIngredient(sug.kind === 'CHEMICAL' || sug.kind === 'BIOLOGICAL' ? sug.mention_text : '');
      // TASK-15 5.3: không điền sẵn PHI; Admin tự tra nhãn thuốc rồi nhập
      setNewMedPhi('');
      // Gợi ý từ bài báo thường là thứ cửa hàng chưa bán: mặc định "Không bán", tồn 0
      setNewMedAvailability('NOT_SOLD');
      // Link nguồn là nơi tra PHI/liều (nhãn, nhà sản xuất), không phải bài báo
      setNewMedSourceUrl('');
      setNewMedTargetDisease(sug.model_class || 'Tomato___Late_blight');
      setNewMedPrice(0);
      setNewMedStock(0);
      setNewMedDosage(
        mappedType === 'Vật tư canh tác'
          ? 'Sử dụng theo diện tích canh tác và hướng dẫn nhà sản xuất'
          : 'Pha theo hướng dẫn trên bao bì'
      );
      setNewMedIsAllowed(false);
    } else {
      setFromSuggestion(null);
      setNewMedName('');
      setNewMedType('Hóa học');
      setNewMedActiveIngredient('');
      setNewMedPhi('');
      setNewMedAvailability('IN_STOCK');
      setNewMedSourceUrl('');
      setNewMedTargetDisease('Tomato___Late_blight');
      setNewMedPrice(50000);
      setNewMedStock(50);
      setNewMedDosage('Pha theo hướng dẫn trên bao bì');
      setNewMedIsAllowed(false);
    }
    setCreateMedModalOpen(true);
  };

  const handleCreateMedicineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim()) {
      toast.error('Vui lòng nhập tên sản phẩm.');
      return;
    }
    const isSupply = newMedType === 'Vật tư canh tác';
    if (isIngredientBanned(newMedName) || (!isSupply && isIngredientBanned(newMedActiveIngredient))) {
      toast.error('Tên hoặc hoạt chất thuộc danh mục thuốc BVTV cấm sử dụng tại Việt Nam.');
      return;
    }
    if (!isSupply && newMedPhi === '') {
      toast.error('Thuốc hóa học/sinh học bắt buộc nhập thời gian cách ly (PHI) theo nhãn.');
      return;
    }
    if (!isSupply && !/^https?:\/\//i.test(newMedSourceUrl.trim())) {
      toast.error('Thuốc bắt buộc có link nguồn nơi bạn tra PHI và liều (nhãn, trang nhà sản xuất).');
      return;
    }

    try {
      setCreatingMed(true);
      const payload: any = {
        name: newMedName.trim(),
        medicine_type: newMedType,
        active_ingredient: isSupply ? null : newMedActiveIngredient.trim() || undefined,
        price: Number(newMedPrice) || 0,
        dosage_instruction: newMedDosage.trim() || 'Sử dụng theo hướng dẫn kỹ thuật',
        phi_days: isSupply ? null : (newMedPhi === '' ? null : Number(newMedPhi)),
        stock_quantity: Number(newMedStock) || 0,
        availability: newMedAvailability,
        info_source_url: newMedSourceUrl.trim() || undefined,
        target_disease_code: newMedTargetDisease || undefined,
        is_allowed: newMedIsAllowed,
        suggestion_id: fromSuggestion ? fromSuggestion.id : undefined,
      };

      const res = await apiClient.post('/medicines', payload);
      toast.success(`Đã thêm sản phẩm "${res.data.name}" vào danh mục thành công!`);
      setCreateMedModalOpen(false);
      fetchMedicines();
      if (fromSuggestion) {
        fetchSuggestions();
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreatingMed(false);
    }
  };

  const pendingSuggestionsCount = suggestions.filter((s) => s.status === 'PENDING').length;

  const filteredSuggestions = suggestions.filter((s) => {
    if (suggestionStatusFilter !== 'ALL' && s.status !== suggestionStatusFilter) return false;
    if (suggestionKindFilter !== 'ALL' && s.kind !== suggestionKindFilter) return false;
    if (suggestionSearch.trim()) {
      const q = suggestionSearch.toLowerCase();
      const matchMention = s.mention_text?.toLowerCase().includes(q);
      const matchDisease = s.disease_name?.toLowerCase().includes(q) || s.plant_name?.toLowerCase().includes(q);
      const matchEvidence = s.evidence_text?.toLowerCase().includes(q);
      const matchProd = s.product_name?.toLowerCase().includes(q);
      if (!matchMention && !matchDisease && !matchEvidence && !matchProd) return false;
    }
    return true;
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

  // ==================== TAB: ẢNH TRIỆU CHỨNG LOGIC (TASK-15 PHASE 2) ====================
  const fetchKnowledgeImages = async () => {
    try {
      setLoadingImages(true);
      const params: Record<string, string | boolean> = {};
      if (imageFilterClass !== 'ALL') params.model_class = imageFilterClass;
      if (imageFilterPart !== 'ALL') params.plant_part = imageFilterPart;
      if (imageFilterApproval === 'APPROVED') params.is_approved = true;
      if (imageFilterApproval === 'PENDING') params.is_approved = false;
      if (imageSearch.trim()) params.search = imageSearch.trim();

      const res = await apiClient.get<KnowledgeImageItem[]>('/knowledge/images', { params });
      setKnowledgeImages(res.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingImages(false);
    }
  };

  const handleToggleApproveImage = async (img: KnowledgeImageItem) => {
    try {
      const nextApproved = !img.is_manual_approved;
      await apiClient.patch(`/knowledge/images/${img.id}/approve`, {
        is_approved: nextApproved,
      });
      setKnowledgeImages((prev) =>
        prev.map((item) => (item.id === img.id ? { ...item, is_manual_approved: nextApproved } : item))
      );
      toast.success(nextApproved ? 'Đã duyệt ảnh triệu chứng.' : 'Đã chuyển ảnh về trạng thái chờ duyệt.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDeleteImage = async () => {
    if (!deleteImageTarget) return;
    try {
      setDeletingImage(true);
      await apiClient.delete(`/knowledge/images/${deleteImageTarget.id}`);
      setKnowledgeImages((prev) => prev.filter((item) => item.id !== deleteImageTarget.id));
      toast.success('Đã gỡ ảnh triệu chứng thành công.');
      setDeleteImageTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingImage(false);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast.error('Chỉ hỗ trợ tệp ảnh JPG, PNG hoặc WEBP.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Dung lượng ảnh tối đa là 10MB.');
        return;
      }
      setNewImageFile(file);
      setNewImageFilePreview(URL.createObjectURL(file));
    }
  };

  const handleCreateKnowledgeImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImageClass) {
      toast.error('Vui lòng chọn bệnh hại mục tiêu.');
      return;
    }
    if (!newImageSourceUrl || !newImageSourceUrl.startsWith('http')) {
      toast.error('URL bài viết gốc phải bắt đầu bằng http:// hoặc https://');
      return;
    }
    if (newImageMode === 'URL') {
      if (!newImageUrl || !newImageUrl.startsWith('https://')) {
        toast.error('URL ảnh trực tiếp phải là link https:// an toàn.');
        return;
      }
    } else {
      if (!newImageFile) {
        toast.error('Vui lòng chọn tệp ảnh từ thiết bị để tải lên.');
        return;
      }
    }
    if (!newImageCaption.trim()) {
      toast.error('Vui lòng nhập mô tả / chú thích triệu chứng.');
      return;
    }
    if (!newImageCredit.trim()) {
      toast.error('Vui lòng nhập nguồn ảnh / tác giả sở hữu.');
      return;
    }

    setSubmittingImage(true);
    try {
      const formData = new FormData();
      formData.append('ModelClass', newImageClass);
      formData.append('SourceUrl', newImageSourceUrl.trim());
      formData.append('Caption', newImageCaption.trim());
      formData.append('PlantPart', newImagePlantPart);
      formData.append('Credit', newImageCredit.trim());
      if (newImageLicenseNote.trim()) {
        formData.append('LicenseNote', newImageLicenseNote.trim());
      }
      formData.append('IsManualApproved', newImageAutoApprove ? 'true' : 'false');

      if (newImageMode === 'URL') {
        formData.append('ImageUrl', newImageUrl.trim());
      } else if (newImageFile) {
        formData.append('File', newImageFile);
      }

      const res = await apiClient.post<KnowledgeImageItem>('/knowledge/images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Đã thêm ảnh triệu chứng thành công!');
      setKnowledgeImages((prev) => [res.data, ...prev]);
      setAddImageModalOpen(false);

      // Reset form
      setNewImageUrl('');
      setNewImageFile(null);
      setNewImageFilePreview(null);
      setNewImageCaption('');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmittingImage(false);
    }
  };

  const filteredKnowledgeImages = knowledgeImages.filter((img) => {
    if (imageFilterPlant !== 'ALL') {
      const matchDisease = diseases.find((d) => d.classCode === img.model_class);
      if (matchDisease && matchDisease.plantName !== imageFilterPlant) return false;
    }
    if (!imageSearch.trim()) return true;
    const q = imageSearch.toLowerCase();
    return (
      img.caption?.toLowerCase().includes(q) ||
      img.credit?.toLowerCase().includes(q) ||
      img.disease_name?.toLowerCase().includes(q) ||
      img.plant_name?.toLowerCase().includes(q) ||
      img.source_url?.toLowerCase().includes(q)
    );
  });

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
                    Server không tự tải URL để chống SSRF. Admin copy văn bản từ bài báo/PDF dán vào đây (hỗ trợ Ctrl+A cả trang).
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <form onSubmit={handleParseArticle} className="space-y-4 text-xs">
                    <div>
                      <label className="font-semibold text-foreground block mb-1">
                        1. Đường dẫn URL bài viết gốc *
                      </label>
                      <Input
                        type="url"
                        placeholder="https://khuyennongvn.gov.vn/..."
                        value={ingestUrl}
                        onChange={(e) => {
                          setIngestUrl(e.target.value);
                          if (ingestionResult) resetArticleState();
                        }}
                        required
                        className="text-xs"
                      />
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] text-muted-foreground">
                          {ingestUrl ? 'Đã liên kết nguồn' : 'Dán link trang báo khuyến nông'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewImagePlant(selectedPlant);
                            setNewImageClass(ingestClass);
                            setNewImageSourceUrl(ingestUrl);
                            setNewImageCredit(ingestOrg || 'Trung tâm Khuyến nông');
                            setAddImageModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Thêm ảnh triệu chứng từ bài này</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-semibold text-foreground">
                          2. Dán toàn văn bài báo *
                        </label>
                        <span className="text-[10px] text-muted-foreground">
                          {ingestText.length.toLocaleString('vi-VN')} / 50.000 ký tự
                        </span>
                      </div>
                      <div className="p-2 mb-2 rounded bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-[11px] flex items-start gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 mt-0.5 text-emerald-700 shrink-0" />
                        <span>
                          <strong>Mẹo dán cả trang:</strong> Nhấn <kbd className="px-1 py-0.5 bg-white border border-emerald-300 rounded font-mono">Ctrl+A</kbd> rồi <kbd className="px-1 py-0.5 bg-white border border-emerald-300 rounded font-mono">Ctrl+C</kbd> trên trang báo rồi dán vào ô dưới. Hệ thống sẽ tự lọc bỏ menu, quảng cáo và hotline rác!
                        </span>
                      </div>
                      <Textarea
                        rows={11}
                        placeholder="Dán toàn bộ nội dung bài báo vào đây. Hệ thống sẽ tự lọc thẻ rác HTML, tách thành các đoạn P1, P2... và gọi AI trích xuất tiêu đề, phân loại bệnh."
                        value={ingestText}
                        onChange={(e) => {
                          setIngestText(e.target.value);
                          if (ingestionResult) resetArticleState();
                        }}
                        onPaste={handlePasteArticleText}
                        required
                        maxLength={50000}
                        className="text-xs font-mono resize-y"
                      />
                    </div>

                    {/* Cây trồng & Bệnh hại mục tiêu (Tùy chọn) */}
                    <div className="p-3 bg-muted/30 rounded-lg border border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-foreground block">
                          3. Đối tượng Cây trồng &amp; Bệnh hại (Tùy chọn)
                        </label>
                        <span className="text-[10px] text-muted-foreground italic">
                          Có thể để trống để AI tự đoán
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] text-muted-foreground block mb-1">
                            Loài cây:
                          </label>
                          <select
                            value={selectedPlant}
                            onChange={(e) => handlePlantChange(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs focus:ring-1 focus:ring-ring"
                          >
                            <option value="">-- Để AI tự nhận diện --</option>
                            {uniquePlants.map((plant) => (
                              <option key={plant} value={plant}>
                                {plant}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] text-muted-foreground block mb-1">
                            Tên bệnh mục tiêu:
                          </label>
                          <select
                            value={ingestClass}
                            onChange={(e) => { setIngestClass(e.target.value); setClassFromAi(false); }}
                            className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs focus:ring-1 focus:ring-ring"
                          >
                            <option value="">-- Để AI tự nhận diện --</option>
                            {filteredDiseasesByPlant.map((d) => (
                              <option key={d.classCode} value={d.classCode}>
                                {d.commonNameVi}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={ingesting}
                      className="w-full gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-10"
                    >
                      {ingesting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Đang bóc tách &amp; Gọi AI phân tích...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Tách đoạn &amp; AI Tự Điền Thông Tin</span>
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
                    Dán URL và nội dung bài báo ở cột bên trái rồi bấm <strong>"Tách đoạn &amp; AI Tự Điền Thông Tin"</strong> để bắt đầu trích dẫn nguyên văn.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* BƯỚC 2A: THÔNG TIN BÀI BÁO (AI ĐỀ XUẤT - ADMIN XÁC NHẬN) */}
                  <Card className="border-border bg-card shadow-xs">
                    <CardHeader className="py-3 px-4 border-b border-border bg-muted/20">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-xs font-bold flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-700" />
                          <span>Thông tin bài viết &amp; Phân loại</span>
                        </CardTitle>
                        <Badge variant="outline" className="text-emerald-800 border-emerald-300 bg-emerald-50 text-[10px]">
                          AI đề xuất, vui lòng kiểm tra lại
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="font-semibold text-foreground block mb-1">
                            Loài cây trồng *
                          </label>
                          <select
                            value={selectedPlant}
                            onChange={(e) => handlePlantChange(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs font-medium"
                          >
                            {uniquePlants.map((plant) => (
                              <option key={plant} value={plant}>
                                {plant}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="font-semibold text-foreground block mb-1">
                            Bệnh hại mục tiêu *
                          </label>
                          <select
                            value={ingestClass}
                            onChange={(e) => { setIngestClass(e.target.value); setClassFromAi(false); }}
                            className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs font-medium"
                          >
                            {filteredDiseasesByPlant.map((d) => (
                              <option key={d.classCode} value={d.classCode}>
                                {d.commonNameVi}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="font-semibold text-foreground block mb-1">
                          Tiêu đề bài viết trích dẫn *
                        </label>
                        <Input
                          type="text"
                          value={ingestTitle}
                          onChange={(e) => setIngestTitle(e.target.value)}
                          placeholder="Tiêu đề bài viết..."
                          className="text-xs bg-background"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="font-semibold text-foreground block mb-1">
                            Cơ quan / Tác giả *
                          </label>
                          <Input
                            type="text"
                            value={ingestOrg}
                            onChange={(e) => setIngestOrg(e.target.value)}
                            placeholder="Trung tâm Khuyến nông..."
                            className="text-xs bg-background"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-foreground block mb-1">
                            Năm xuất bản
                          </label>
                          <Input
                            type="text"
                            value={ingestDate}
                            onChange={(e) => setIngestDate(e.target.value)}
                            placeholder="2024"
                            className="text-xs bg-background"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* BƯỚC 2B: DANH SÁCH ĐOẠN TRÍCH NGUYÊN VĂN */}
                  <Card className="border-border bg-card shadow-xs flex flex-col">
                    <CardHeader className="pb-3 border-b border-border">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <CardTitle className="text-base font-bold flex items-center gap-2">
                            <span>Đoạn văn bản trích dẫn ({ingestionResult.paragraphs.length} đoạn)</span>
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
                            Quy tắc trích dẫn hợp lý: <strong>Tối đa 8 đoạn nguyên văn</strong> (≤ 800 ký tự/đoạn, tổng ≤ 30% bài). Tick = Duyệt.
                          </CardDescription>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={countSelected > 8 ? 'bg-destructive text-white' : 'bg-muted text-foreground text-[11px]'}
                          >
                            Đoạn: {countSelected} / 8
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={totalSelectedChars > allowedCharsQuota ? 'bg-destructive text-white' : 'bg-muted text-foreground text-[11px]'}
                          >
                            <span title="Giới hạn = 30% độ dài bài, tối thiểu 1.200 ký tự">
                              Ký tự: {totalSelectedChars.toLocaleString('vi-VN')} / {allowedCharsQuota.toLocaleString('vi-VN')} ({((totalSelectedChars / allowedCharsQuota) * 100).toFixed(0)}%)
                            </span>
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 flex-1 overflow-y-auto max-h-[500px] space-y-3">
                      {/* Danh sách các đoạn liên quan */}
                      {ingestionResult.paragraphs
                        .filter((p) => !ingestionResult.ai_suggestion_available || p.suggested_unit_type !== null)
                        .map((para) => {
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
                                    disabled={isTooLong || (!state.selected && countSelected >= 8)}
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

                              <p className="text-xs text-foreground/90 italic pl-6 leading-relaxed">
                                "{para.text}"
                              </p>

                              {/* Gợi ý vật tư/hoạt chất trích xuất từ đoạn (Task-15 Phase 3) */}
                              {para.mentions && para.mentions.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pl-6 mt-2 pt-2 border-t border-border/40">
                                  <span className="text-[10px] text-muted-foreground font-medium">Vật tư / Hoạt chất trích xuất:</span>
                                  {para.mentions.map((m, mIdx) => (
                                    <span
                                      key={mIdx}
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                        m.kind === 'CHEMICAL'
                                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                          : m.kind === 'BIOLOGICAL'
                                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                          : m.kind === 'SUPPLY'
                                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                          : 'bg-purple-100 text-purple-800 border border-purple-300'
                                      }`}
                                    >
                                      {m.text}
                                      <span className="ml-1 opacity-65 text-[9px]">
                                        ({m.kind === 'CHEMICAL' ? 'Hóa học' : m.kind === 'BIOLOGICAL' ? 'Sinh học' : m.kind === 'SUPPLY' ? 'Vật tư' : 'Canh tác'})
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}

                      {/* Nhóm đoạn AI gắn nhãn null (Đoạn không liên quan/rác) - Mặc định thu gọn theo Section 3.1 */}
                      {ingestionResult.ai_suggestion_available && ingestionResult.paragraphs.some((p) => p.suggested_unit_type === null) && (
                        <div className="pt-2 border-t border-border">
                          <button
                            type="button"
                            onClick={() => setShowNoiseParagraphs(!showNoiseParagraphs)}
                            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 border border-border text-xs text-muted-foreground font-medium"
                          >
                            <span className="flex items-center gap-1.5">
                              {showNoiseParagraphs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              <span>Đoạn AI không chọn: {ingestionResult.paragraphs.filter((p) => p.suggested_unit_type === null).length} đoạn (vẫn tick để lưu được)</span>
                            </span>
                            <span className="text-[11px]">{showNoiseParagraphs ? 'Thu gọn' : 'Bấm để mở xem'}</span>
                          </button>

                          {showNoiseParagraphs && (
                            <div className="mt-2 space-y-2 pl-2">
                              {ingestionResult.paragraphs
                                .filter((p) => p.suggested_unit_type === null)
                                .map((para) => {
                                  const state = selectedParagraphs[para.id] || { selected: false, unitType: 'SYMPTOMS' };
                                  const isTooLong = para.text.length > 800;

                                  return (
                                    <div
                                      key={para.id}
                                      className={`p-3 rounded-lg border transition-colors opacity-80 hover:opacity-100 ${
                                        state.selected
                                          ? 'bg-emerald-50/70 border-emerald-300'
                                          : 'bg-card border-border'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2 mb-1.5">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold text-xs">
                                          <input
                                            type="checkbox"
                                            checked={state.selected}
                                            disabled={isTooLong || (!state.selected && countSelected >= 8)}
                                            onChange={(e) => {
                                              setSelectedParagraphs((prev) => ({
                                                ...prev,
                                                [para.id]: {
                                                  ...state,
                                                  selected: e.target.checked,
                                                },
                                              }));
                                            }}
                                            className="w-4 h-4 rounded text-emerald-700"
                                          />
                                          <span className="text-muted-foreground font-mono">{para.id}</span>
                                          <span className="text-muted-foreground font-normal text-[10px]">
                                            ({para.text.length} ký tự)
                                          </span>
                                        </label>

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

                                      <p className="text-xs text-muted-foreground italic pl-6 leading-relaxed">
                                        "{para.text}"
                                      </p>

                                      {para.mentions && para.mentions.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-1.5 pl-6 mt-2 pt-2 border-t border-border/40">
                                          <span className="text-[10px] text-muted-foreground font-medium">Vật tư / Hoạt chất trích xuất:</span>
                                          {para.mentions.map((m, mIdx) => (
                                            <span
                                              key={mIdx}
                                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border"
                                            >
                                              {m.text}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>

                    <div className="p-4 border-t border-border bg-muted/20 space-y-3">
                      <Input
                        type="text"
                        placeholder="Ghi chú người duyệt (ví dụ: Đã đối chiếu thông tư Cục BVTV)"
                        value={commitNotes}
                        onChange={(e) => setCommitNotes(e.target.value)}
                        className="text-xs bg-background"
                      />

                      {totalSelectedChars > allowedCharsQuota && (
                        <p className="text-xs text-destructive font-medium">
                          Đã chọn {totalSelectedChars.toLocaleString('vi-VN')} ký tự, vượt giới hạn trích dẫn {allowedCharsQuota.toLocaleString('vi-VN')} ký tự
                          (30% bài, tối thiểu 1.200). Bỏ bớt đoạn để lưu được.
                        </p>
                      )}
                      {!ingestClass && (
                        <p className="text-xs text-destructive font-medium">Chọn Loài cây và Bệnh hại mục tiêu ở trên trước khi lưu.</p>
                      )}
                      <Button
                        onClick={handleCommitParagraphs}
                        disabled={committing || countSelected === 0 || countSelected > 8 || totalSelectedChars > allowedCharsQuota || !ingestClass}
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
                </div>
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

              {/* Nút chuyển đổi chế độ xem: Gộp theo bài viết hoặc xem từng dòng */}
              <Button
                variant={groupByArticle ? 'default' : 'outline'}
                size="sm"
                onClick={() => setGroupByArticle(!groupByArticle)}
                className={`h-9 text-xs gap-1.5 ${
                  groupByArticle
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
                        <th className="p-3">Cây – Bệnh</th>
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
                        groupedArticles.map((group) => {
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
                                className={`hover:bg-muted/30 transition-colors ${
                                  isExpanded ? 'bg-muted/20 font-medium' : ''
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
                                  <div className="flex items-start gap-2">
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandArticle(group.key)}
                                      className="text-muted-foreground hover:text-emerald-700 mt-0.5 p-0.5 rounded hover:bg-muted transition-colors shrink-0 cursor-pointer"
                                      title={isExpanded ? 'Thu gọn' : 'Bấm xem chi tiết các đoạn'}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-emerald-700" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4" />
                                      )}
                                    </button>
                                    <div className="min-w-0">
                                      <button
                                        type="button"
                                        onClick={() => toggleExpandArticle(group.key)}
                                        className="font-bold text-foreground text-left line-clamp-1 hover:text-emerald-700 hover:underline block cursor-pointer"
                                      >
                                        {group.sourceTitle}
                                      </button>
                                      <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                        {group.organization}
                                      </div>
                                      <a
                                        href={group.sourceUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[10px] text-emerald-700 hover:underline inline-flex items-center gap-0.5 mt-0.5"
                                      >
                                        <span>Xem bài gốc</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <span className="font-semibold text-foreground block">{group.plantName}</span>
                                  <span className="text-[11px] text-muted-foreground">{group.diseaseName}</span>
                                </td>
                                <td className="p-3 text-center whitespace-nowrap">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => toggleExpandArticle(group.key)}
                                    className="h-7 px-2.5 text-xs gap-1.5 border-border bg-card hover:bg-muted text-foreground"
                                  >
                                    <Layers className="w-3.5 h-3.5 text-emerald-700" />
                                    <span>{group.totalCount} đoạn trích</span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-3 h-3 text-muted-foreground" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                    )}
                                  </Button>
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
                                <td className="p-3 text-right whitespace-nowrap">
                                  <Button
                                    size="sm"
                                    variant={isAllApproved ? 'outline' : 'default'}
                                    disabled={batchActionLoading}
                                    onClick={() => handleToggleApproveArticle(group)}
                                    className={`h-7 px-2.5 text-xs ${
                                      isAllApproved
                                        ? 'text-muted-foreground hover:text-destructive'
                                        : 'bg-emerald-700 hover:bg-emerald-800 text-white font-semibold'
                                    }`}
                                  >
                                    {isAllApproved ? 'Bỏ duyệt cả bài' : 'Duyệt cả bài'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => toggleExpandArticle(group.key)}
                                    className="ml-1 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                  >
                                    {isExpanded ? 'Thu gọn' : 'Xem chi tiết'}
                                  </Button>
                                </td>
                              </tr>

                              {/* Dòng mở rộng chi tiết các đoạn */}
                              {isExpanded && (
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
                                              className={`p-2.5 sm:p-3 rounded-lg border text-xs transition-colors ${
                                                isParagraphSelected
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
                                                    className={`h-6 px-2 text-[11px] ${
                                                      p.isManualApproved
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
                                  className={`h-7 px-2.5 text-xs ${
                                    s.isManualApproved
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
          </Card>
        </TabsContent>

        {/* ========================================================================================= */}
        {/* TAB 3: QUẢN LÝ ẢNH TRIỆU CHỨNG THỰC ĐỊA (TASK-15 PHASE 2) */}
        {/* ========================================================================================= */}
        <TabsContent value="images" className="space-y-4">
          {/* Toolbar lọc và nút thêm */}
          <div className="bg-card p-4 rounded-xl border border-border shadow-xs flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[200px] flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Tìm theo chú thích, tác giả, nguồn..."
                  value={imageSearch}
                  onChange={(e) => setImageSearch(e.target.value)}
                  className="pl-9 h-8 text-xs bg-background"
                />
              </div>

              {/* Lọc Cây trồng */}
              <select
                aria-label="Lọc theo loài cây trồng"
                value={imageFilterPlant}
                onChange={(e) => {
                  setImageFilterPlant(e.target.value);
                  setImageFilterClass('ALL');
                }}
                className="h-8 px-2.5 rounded-md border border-input bg-background text-foreground text-xs font-medium cursor-pointer"
              >
                <option value="ALL">Tất cả loài cây ({uniquePlants.length})</option>
                {uniquePlants.map((plant) => (
                  <option key={plant} value={plant}>
                    {plant}
                  </option>
                ))}
              </select>

              {/* Lọc Bệnh hại */}
              <select
                aria-label="Lọc theo bệnh hại"
                value={imageFilterClass}
                onChange={(e) => setImageFilterClass(e.target.value)}
                className="h-8 px-2.5 rounded-md border border-input bg-background text-foreground text-xs font-medium cursor-pointer max-w-[220px] truncate"
              >
                <option value="ALL">Tất cả bệnh hại</option>
                {diseases
                  .filter((d) => imageFilterPlant === 'ALL' || d.plantName === imageFilterPlant)
                  .map((d) => (
                    <option key={d.classCode} value={d.classCode}>
                      {d.plantName} — {d.commonNameVi}
                    </option>
                  ))}
              </select>

              {/* Lọc Bộ phận cây */}
              <select
                aria-label="Lọc theo bộ phận cây"
                value={imageFilterPart}
                onChange={(e) => setImageFilterPart(e.target.value)}
                className="h-8 px-2.5 rounded-md border border-input bg-background text-foreground text-xs font-medium cursor-pointer"
              >
                <option value="ALL">Tất cả bộ phận</option>
                <option value="LEAF">Lá (LEAF)</option>
                <option value="FRUIT">Quả / Hoa (FRUIT)</option>
                <option value="STEM">Thân / Cành (STEM)</option>
                <option value="WHOLE_PLANT">Toàn cây (WHOLE_PLANT)</option>
              </select>

              {/* Lọc Trạng thái duyệt */}
              <select
                aria-label="Lọc theo trạng thái duyệt ảnh"
                value={imageFilterApproval}
                onChange={(e) => setImageFilterApproval(e.target.value as any)}
                className="h-8 px-2.5 rounded-md border border-input bg-background text-foreground text-xs font-medium cursor-pointer"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="APPROVED">Đã duyệt</option>
                <option value="PENDING">Chờ duyệt</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchKnowledgeImages}
                disabled={loadingImages}
                className="gap-1.5 h-8 text-xs bg-background"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingImages ? 'animate-spin' : ''}`} />
                <span>Làm mới</span>
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setNewImagePlant(selectedPlant || (uniquePlants[0] ?? 'Cà chua'));
                  setNewImageClass(ingestClass || diseases[0]?.classCode || 'Tomato___Late_blight');
                  setNewImageSourceUrl('');
                  setNewImageCredit('');
                  setAddImageModalOpen(true);
                }}
                className="gap-1.5 h-8 text-xs bg-primary hover:bg-primary-hover text-white font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm ảnh triệu chứng</span>
              </Button>
            </div>
          </div>

          {/* Danh sách ảnh triệu chứng */}
          {loadingImages ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-64 rounded-2xl bg-card border border-border p-4 animate-pulse space-y-3" />
              ))}
            </div>
          ) : filteredKnowledgeImages.length === 0 ? (
            <Card className="border-dashed border-2 p-12 text-center bg-card">
              <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/60 mb-3" />
              <h4 className="text-base font-bold text-foreground">Chưa có ảnh triệu chứng nào</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                Kho ảnh triệu chứng giúp nông dân đối chiếu thực tế khi xem sổ tay và trợ lý tư vấn. Bạn có thể thêm ảnh bằng cách tải tệp lên hoặc nhập link HTTPS.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setNewImagePlant(selectedPlant || (uniquePlants[0] ?? 'Cà chua'));
                  setNewImageClass(ingestClass || diseases[0]?.classCode || 'Tomato___Late_blight');
                  setNewImageSourceUrl('');
                  setNewImageCredit('');
                  setAddImageModalOpen(true);
                }}
                className="gap-1.5 text-xs bg-primary text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm ảnh đầu tiên</span>
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredKnowledgeImages.map((img) => (
                <Card
                  key={img.id}
                  className="overflow-hidden border-border bg-card flex flex-col justify-between hover:border-primary/50 transition-all shadow-2xs group"
                >
                  <div
                    className="relative aspect-4/3 w-full bg-muted cursor-pointer overflow-hidden"
                    onClick={() => setPreviewingImage(img)}
                  >
                    <img
                      src={img.image_url}
                      alt={img.caption}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="%23999"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12">Lỗi tải ảnh</text></svg>';
                      }}
                    />
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      <span className="inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold bg-black/60 text-white backdrop-blur-xs">
                        {img.plant_part === 'LEAF'
                          ? 'Lá'
                          : img.plant_part === 'FRUIT'
                          ? 'Quả/Hoa'
                          : img.plant_part === 'STEM'
                          ? 'Thân/Cành'
                          : 'Toàn cây'}
                      </span>
                    </div>
                    <div className="absolute top-2 right-2">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-semibold border ${
                          img.is_manual_approved
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {img.is_manual_approved ? 'Đã duyệt' : 'Chờ duyệt'}
                      </Badge>
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="rounded-full bg-black/70 p-2 text-white shadow-md">
                        <ZoomIn className="h-4 w-4" />
                      </span>
                    </div>
                  </div>

                  <CardContent className="p-3.5 space-y-2 flex-1 flex flex-col justify-between text-xs">
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-primary truncate" title={`${img.plant_name} — ${img.disease_name}`}>
                        {img.plant_name} — {img.disease_name}
                      </div>
                      <p className="text-foreground text-xs font-medium line-clamp-2 leading-snug">
                        {img.caption}
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span className="truncate max-w-[150px]" title={img.credit}>
                          Nguồn: <strong>{img.credit}</strong>
                        </span>
                        {img.source_url && (
                          <a
                            href={img.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-primary hover:underline font-semibold"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span>Bài gốc</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleApproveImage(img)}
                          className={`h-7 px-2 text-[11px] font-semibold ${
                            img.is_manual_approved
                              ? 'text-amber-700 hover:bg-amber-500/10 dark:text-amber-400'
                              : 'text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400'
                          }`}
                        >
                          {img.is_manual_approved ? 'Bỏ duyệt' : 'Duyệt ảnh'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteImageTarget(img)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Xóa ảnh triệu chứng"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ========================================================================================= */}
        {/* TAB 4: QUẢN LÝ KHO THUỐC BVTV & PHI */}
        {/* ========================================================================================= */}
        <TabsContent value="inventory" className="space-y-4">
          {/* Subtabs Điều hướng: Kho thuốc & vật tư vs Gợi ý từ bài báo */}
          <div className="flex border-b border-border gap-2 sm:gap-4 pb-1">
            <button
              type="button"
              onClick={() => setInventorySubTab('medicines')}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                inventorySubTab === 'medicines'
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Kho thuốc &amp; Vật tư ({medicines.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setInventorySubTab('suggestions');
                fetchSuggestions();
              }}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                inventorySubTab === 'suggestions'
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Gợi ý vật tư từ bài báo</span>
              {pendingSuggestionsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                  {pendingSuggestionsCount}
                </span>
              )}
            </button>
          </div>

          {inventorySubTab === 'medicines' ? (
            // ==================== SUBTAB 1: KHO THUỐC & VẬT TƯ ====================
            <div className="space-y-4">
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

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleOpenCreateMedModal()}
                    className="h-9 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm thuốc / Vật tư mới</span>
                  </Button>

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
                        <th className="p-3 text-center">Tình trạng bán</th>
                        <th className="p-3 text-center">Trạng thái lưu hành</th>
                        <th className="p-3 text-right">Chỉnh sửa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {loadingMedicines ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-muted-foreground">
                            Đang tải danh mục thuốc...
                          </td>
                        </tr>
                      ) : filteredMedicines.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-muted-foreground">
                            Không có sản phẩm nào.
                          </td>
                        </tr>
                      ) : (
                        filteredMedicines.map((med) => (
                          <tr key={med.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-mono text-muted-foreground">{med.id}</td>
                            <td className="p-3">
                              <div className="font-bold text-foreground flex items-center gap-1.5">
                                <span>{med.name}</span>
                                {isIngredientBanned(med.active_ingredient) && (
                                  <Badge variant="destructive" className="text-[9px] h-4 px-1">
                                    Hoạt chất cấm
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {med.active_ingredient || (
                                  <span className="italic text-muted-foreground/70">Không có hoạt chất hóa học</span>
                                )}
                              </div>
                              {med.info_source_url && (
                                <a
                                  href={med.info_source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-0.5"
                                >
                                  <span>Nguồn kỹ thuật</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              <Badge
                                variant="outline"
                                className={
                                  med.medicine_type === 'Sinh học'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : med.medicine_type === 'Vật tư canh tác'
                                    ? 'bg-blue-50 text-blue-800 border-blue-300'
                                    : 'bg-amber-50 text-amber-800 border-amber-300'
                                }
                              >
                                {med.medicine_type}
                              </Badge>
                            </td>
                            <td className="p-3 font-semibold text-emerald-800 whitespace-nowrap">
                              {med.availability === 'NOT_SOLD' ? (
                                <span className="text-muted-foreground italic font-normal">Không bán</span>
                              ) : (
                                `${med.price.toLocaleString('vi-VN')} đ`
                              )}
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              {med.medicine_type === 'Vật tư canh tác' || med.phi_days === null || med.phi_days === undefined ? (
                                <span className="text-muted-foreground italic">Không áp dụng</span>
                              ) : med.phi_days <= 3 ? (
                                <Badge className="bg-emerald-700 text-white text-[10px]">
                                  {med.phi_days} ngày (Cận hái)
                                </Badge>
                              ) : (
                                <span className="font-medium text-foreground">{med.phi_days} ngày</span>
                              )}
                            </td>
                            <td className="p-3 whitespace-nowrap font-medium">
                              {med.availability === 'NOT_SOLD' ? (
                                <span className="text-muted-foreground text-[11px] italic">Không quản lý kho</span>
                              ) : med.stock_quantity > 0 ? (
                                <span>{med.stock_quantity}</span>
                              ) : (
                                <span className="text-destructive font-bold">Hết hàng</span>
                              )}
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              {med.availability === 'NOT_SOLD' ? (
                                <Badge variant="outline" className="bg-secondary text-muted-foreground border-border text-[10px]">
                                  Không kinh doanh
                                </Badge>
                              ) : med.stock_quantity <= 0 || med.availability === 'OUT_OF_STOCK' ? (
                                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">
                                  Tạm hết hàng
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                                  Đang bán
                                </Badge>
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
            </div>
          ) : (
            // ==================== SUBTAB 2: GỢI Ý VẬT TƯ TỪ BÀI BÁO (TASK-15 V5) ====================
            <div className="space-y-4">
              <div className="bg-card p-4 rounded-xl border border-border shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between text-xs">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative min-w-[220px]">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Tìm theo tên vật tư, hoạt chất, bệnh..."
                      value={suggestionSearch}
                      onChange={(e) => setSuggestionSearch(e.target.value)}
                      className="pl-8 text-xs h-9 bg-background"
                    />
                  </div>

                  <select
                    value={suggestionStatusFilter}
                    onChange={(e) => setSuggestionStatusFilter(e.target.value)}
                    className="h-9 px-2.5 bg-background border border-border rounded-lg text-xs"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="PENDING">Chờ xử lý (Pending)</option>
                    <option value="LINKED">Đã gắn SP có sẵn (Linked)</option>
                    <option value="ADDED">Đã tạo SP mới (Added)</option>
                    <option value="DISMISSED">Đã bỏ qua (Dismissed)</option>
                  </select>

                  <select
                    value={suggestionKindFilter}
                    onChange={(e) => setSuggestionKindFilter(e.target.value)}
                    className="h-9 px-2.5 bg-background border border-border rounded-lg text-xs"
                  >
                    <option value="ALL">Tất cả loại vật tư</option>
                    <option value="CHEMICAL">Thuốc hóa học (CHEMICAL)</option>
                    <option value="BIOLOGICAL">Chế phẩm sinh học (BIOLOGICAL)</option>
                    <option value="SUPPLY">Vật tư canh tác (SUPPLY)</option>
                    <option value="PRACTICE">Biện pháp canh tác (PRACTICE)</option>
                  </select>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchSuggestions}
                  disabled={loadingSuggestions}
                  className="h-9 bg-card border-border hover:bg-muted text-xs shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingSuggestions ? 'animate-spin' : ''}`} />
                  Làm mới gợi ý
                </Button>
              </div>

              <Card className="border-border bg-card shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                      <tr>
                        <th className="p-3">Vật tư / Hoạt chất trích xuất</th>
                        <th className="p-3">Phân loại</th>
                        <th className="p-3">Cây – Bệnh mục tiêu</th>
                        <th className="p-3">Đoạn trích bằng chứng</th>
                        <th className="p-3 text-center">Trạng thái</th>
                        <th className="p-3 text-center">Sản phẩm liên kết</th>
                        <th className="p-3 text-right">Thao tác Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {loadingSuggestions ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground">
                            Đang tải danh sách gợi ý vật tư...
                          </td>
                        </tr>
                      ) : filteredSuggestions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground">
                            Không tìm thấy gợi ý vật tư nào.
                          </td>
                        </tr>
                      ) : (
                        filteredSuggestions.map((sug) => {
                          const isBanned = isIngredientBanned(sug.mention_text);
                          return (
                            <tr key={sug.id} className="hover:bg-muted/30 transition-colors">
                              <td className="p-3 font-medium">
                                <div className="font-bold text-foreground flex items-center gap-1.5">
                                  <span>{sug.mention_text}</span>
                                  {isBanned && (
                                    <Badge variant="destructive" className="text-[9px] h-4 px-1">
                                      Hoạt chất cấm (TT 75/2025)
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  Mã #{sug.id} • {new Date(sug.created_at).toLocaleDateString('vi-VN')}
                                </div>
                              </td>

                              <td className="p-3 whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className={
                                    sug.kind === 'CHEMICAL'
                                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                                      : sug.kind === 'BIOLOGICAL'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                      : sug.kind === 'SUPPLY'
                                      ? 'bg-blue-50 text-blue-800 border-blue-300'
                                      : 'bg-purple-50 text-purple-800 border-purple-300'
                                  }
                                >
                                  {sug.kind === 'CHEMICAL'
                                    ? 'Hóa học'
                                    : sug.kind === 'BIOLOGICAL'
                                    ? 'Sinh học'
                                    : sug.kind === 'SUPPLY'
                                    ? 'Vật tư canh tác'
                                    : 'Biện pháp'}
                                </Badge>
                              </td>

                              <td className="p-3 whitespace-nowrap">
                                <span className="font-medium text-foreground">{sug.plant_name}</span>
                                <span className="text-muted-foreground"> – {sug.disease_name}</span>
                              </td>

                              <td className="p-3 max-w-xs">
                                <p className="text-[11px] text-muted-foreground italic line-clamp-2 leading-relaxed" title={sug.evidence_text}>
                                  "{sug.evidence_text}"
                                </p>
                                {sug.source_url && (
                                  <a
                                    href={sug.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-0.5"
                                  >
                                    <span>{sug.source_title || 'Xem bài viết gốc'}</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </td>

                              <td className="p-3 text-center whitespace-nowrap">
                                {sug.status === 'PENDING' ? (
                                  <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px]">
                                    Chờ xử lý
                                  </Badge>
                                ) : sug.status === 'LINKED' ? (
                                  <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px]">
                                    Đã gắn SP
                                  </Badge>
                                ) : sug.status === 'ADDED' ? (
                                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                                    Đã tạo SP
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">
                                    Đã bỏ qua
                                  </Badge>
                                )}
                              </td>

                              <td className="p-3 text-center whitespace-nowrap">
                                {sug.product_name && sug.status === 'PENDING' ? (
                                  <span className="text-amber-700 dark:text-amber-400 text-[11px]" title="Cùng hoạt chất với sản phẩm trong kho. Bấm Gắn SP để xác nhận.">
                                    Khớp hoạt chất: <b>{sug.product_name}</b>
                                  </span>
                                ) : sug.product_name ? (
                                  <span className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center justify-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>{sug.product_name}</span>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground italic text-[11px]">—</span>
                                )}
                              </td>

                              <td className="p-3 text-right whitespace-nowrap">
                                {sug.status === 'PENDING' ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    {sug.kind !== 'PRACTICE' && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleOpenCreateMedModal(sug)}
                                      className="h-7 px-2 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold gap-1"
                                      title="Tạo sản phẩm mới prefilled từ gợi ý"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>Tạo SP</span>
                                    </Button>
                                    )}

                                    {sug.kind !== 'PRACTICE' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setLinkingSuggestion(sug);
                                        setSelectedLinkMedId(sug.product_id ?? '');
                                      }}
                                      className="h-7 px-2 border-border text-[11px] font-medium"
                                      title="Liên kết với sản phẩm đã có sẵn trong kho"
                                    >
                                      <LinkIcon className="w-3 h-3 mr-1" />
                                      <span>Gắn SP</span>
                                    </Button>
                                    )}

                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDismissSuggestion(sug.id)}
                                      className="h-7 px-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-[11px]"
                                      title="Bỏ qua gợi ý này"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">Đã xử lý</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
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
      {/* DIALOG SỬA THÔNG SỐ THUỐC BVTV & VẬT TƯ */}
      {/* ========================================================================================= */}
      <Dialog open={!!editingMed} onOpenChange={() => setEditingMed(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Chỉnh sửa thông số: {editingMed?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cập nhật giá bán, số ngày cách ly (PHI), tình trạng bán và nguồn thông tin sản phẩm.
            </DialogDescription>
          </DialogHeader>

          {editingMed && (
            <div className="space-y-3 py-2 text-xs">
              {isIngredientBanned(editingMed.active_ingredient) && (
                <div className="p-2.5 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <strong>Cảnh báo chất cấm (TT 75/2025):</strong> Sản phẩm chứa hoạt chất "{editingMed.active_ingredient}" bị cấm lưu hành tại Việt Nam. Không thể kích hoạt trạng thái bán công khai.
                  </div>
                </div>
              )}

              <div>
                <label className="font-semibold block mb-1">Phân loại sản phẩm *</label>
                <select
                  value={editingMed.medicine_type || 'Hóa học'}
                  onChange={(e) =>
                    setEditingMed({ ...editingMed, medicine_type: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs"
                >
                  <option value="Hóa học">Thuốc bảo vệ thực vật hóa học</option>
                  <option value="Sinh học">Chế phẩm sinh học BVTV</option>
                  <option value="Vật tư canh tác">Vật tư canh tác (lưới, bẫy, bao trái...)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Tình trạng kinh doanh (Availability) *</label>
                <select
                  value={editingMed.availability || 'IN_STOCK'}
                  onChange={(e) =>
                    setEditingMed({ ...editingMed, availability: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs"
                >
                  <option value="IN_STOCK">Đang bán (IN_STOCK - Cho phép đặt mua)</option>
                  <option value="OUT_OF_STOCK">Tạm hết hàng (OUT_OF_STOCK - Tạm ẩn nút mua)</option>
                  <option value="NOT_SOLD">Cửa hàng không bán (NOT_SOLD - Chỉ tư vấn kỹ thuật/IPM)</option>
                </select>
              </div>

              {editingMed.availability !== 'NOT_SOLD' && (
                <div className="grid grid-cols-2 gap-3">
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
                    <label className="font-semibold block mb-1">Số lượng tồn kho *</label>
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

              <div>
                <label className="font-semibold block mb-1">
                  Thời gian cách ly PHI (ngày)
                  {editingMed.medicine_type === 'Vật tư canh tác' && (
                    <span className="font-normal text-muted-foreground ml-1">(Không áp dụng cho vật tư canh tác)</span>
                  )}
                </label>
                <Input
                  type="number"
                  disabled={editingMed.medicine_type === 'Vật tư canh tác'}
                  placeholder={editingMed.medicine_type === 'Vật tư canh tác' ? 'Không áp dụng' : '7'}
                  value={editingMed.phi_days ?? ''}
                  onChange={(e) =>
                    setEditingMed({
                      ...editingMed,
                      phi_days: e.target.value === '' ? null : parseInt(e.target.value, 10),
                    })
                  }
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">URL nguồn tài liệu / bài báo khuyến nông (tùy chọn)</label>
                <Input
                  type="url"
                  placeholder="https://khuyennongvn.gov.vn/..."
                  value={editingMed.info_source_url || ''}
                  onChange={(e) =>
                    setEditingMed({ ...editingMed, info_source_url: e.target.value })
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
      {/* DIALOG GẮN GỢI Ý VẬT TƯ VÀO SẢN PHẨM CÓ SẴN (TASK-15 PHASE 3) */}
      {/* ========================================================================================= */}
      <Dialog open={!!linkingSuggestion} onOpenChange={() => setLinkingSuggestion(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-emerald-700" />
              <span>Gắn gợi ý vào sản phẩm trong kho</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Liên kết cụm từ trích xuất "{linkingSuggestion?.mention_text}" với sản phẩm đang có trong danh mục để trợ lý Lavi tự động gợi ý sản phẩm này khi gặp triệu chứng tương ứng.
            </DialogDescription>
          </DialogHeader>

          {linkingSuggestion && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-2.5 bg-muted/40 rounded-lg border border-border space-y-1">
                <div>Cây – Bệnh: <strong>{linkingSuggestion.plant_name} – {linkingSuggestion.disease_name}</strong></div>
                <div>Từ khóa bài báo: <span className="font-bold text-primary">{linkingSuggestion.mention_text}</span></div>
                <div className="line-clamp-2 text-muted-foreground italic">"{linkingSuggestion.evidence_text}"</div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Chọn sản phẩm trong kho để liên kết *</label>
                <select
                  value={selectedLinkMedId}
                  onChange={(e) => setSelectedLinkMedId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-2.5 py-2 bg-background border border-border rounded-lg text-xs"
                >
                  <option value="">-- Chọn sản phẩm phù hợp --</option>
                  {medicines
                    .filter((m) => !isIngredientBanned(m.name) && !isIngredientBanned(m.active_ingredient || ''))
                    .map((m) => (
                    <option key={m.id} value={m.id}>
                      #{m.id} - {m.name} ({m.medicine_type}{m.active_ingredient ? ` - ${m.active_ingredient}` : ''})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setLinkingSuggestion(null)} disabled={linkingLoading}>
              Hủy
            </Button>
            <Button
              size="sm"
              disabled={linkingLoading || !selectedLinkMedId}
              onClick={handleLinkSuggestion}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
            >
              {linkingLoading ? 'Đang liên kết...' : 'Xác nhận liên kết'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================================= */}
      {/* DIALOG THÊM THUỐC / VẬT TƯ MỚI (TASK-15 PHASE 3) */}
      {/* ========================================================================================= */}
      <Dialog open={createMedModalOpen} onOpenChange={setCreateMedModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-700" />
              <span>
                {fromSuggestion ? `Thêm sản phẩm từ gợi ý: "${fromSuggestion.mention_text}"` : 'Thêm thuốc / Vật tư mới'}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {fromSuggestion
                ? 'Chỉ tên và hoạt chất lấy từ bài báo. PHI, giá, tồn kho và link nguồn bạn tự tra trên nhãn thuốc rồi nhập. Sau khi lưu, gợi ý được đánh dấu đã thêm.'
                : 'Thêm sản phẩm thuốc bảo vệ thực vật hoặc vật tư canh tác vào danh mục.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateMedicineSubmit} className="space-y-3 py-2 text-xs">
            {isIngredientBanned(newMedActiveIngredient) && (
              <div className="p-2.5 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <strong>Cảnh báo chất cấm (TT 75/2025):</strong> Hoạt chất "{newMedActiveIngredient}" nằm trong danh mục cấm sử dụng tại Việt Nam. Không thể bật lưu hành sản phẩm này.
                </div>
              </div>
            )}

            <div>
              <label className="font-semibold block mb-1">Tên thuốc / Tên sản phẩm *</label>
              <Input
                type="text"
                placeholder="Ví dụ: Bẫy dính màu vàng Pheromone, Ridomil Gold 68WG..."
                value={newMedName}
                onChange={(e) => setNewMedName(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Phân loại sản phẩm *</label>
                <select
                  value={newMedType}
                  onChange={(e) => {
                    const t = e.target.value;
                    setNewMedType(t);
                    if (t === 'Vật tư canh tác') {
                      setNewMedPhi('');
                      setNewMedActiveIngredient('');
                    }
                  }}
                  className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs"
                >
                  <option value="Hóa học">Thuốc hóa học</option>
                  <option value="Sinh học">Chế phẩm sinh học</option>
                  <option value="Vật tư canh tác">Vật tư canh tác</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Bệnh hại mục tiêu</label>
                <select
                  value={newMedTargetDisease}
                  onChange={(e) => setNewMedTargetDisease(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs"
                >
                  <option value="">-- Không chỉ định --</option>
                  {diseases.map((d) => (
                    <option key={d.classCode} value={d.classCode}>
                      {d.plantName} – {d.commonNameVi}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {newMedType !== 'Vật tư canh tác' && (
              <div>
                <label className="font-semibold block mb-1">Hoạt chất chính (Active Ingredient)</label>
                <Input
                  type="text"
                  placeholder="Ví dụ: Metalaxyl-M 40g/kg + Mancozeb 640g/kg..."
                  value={newMedActiveIngredient}
                  onChange={(e) => setNewMedActiveIngredient(e.target.value)}
                  className="text-xs"
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-semibold block mb-1">Giá bán (VNĐ) *</label>
                <Input
                  type="number"
                  value={newMedPrice}
                  onChange={(e) => setNewMedPrice(parseFloat(e.target.value) || 0)}
                  required
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Số lượng tồn kho *</label>
                <Input
                  type="number"
                  value={newMedStock}
                  onChange={(e) => setNewMedStock(parseInt(e.target.value, 10) || 0)}
                  required
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  Cách ly PHI (ngày)
                  {newMedType === 'Vật tư canh tác' && <span className="font-normal text-muted-foreground ml-1">(N/A)</span>}
                </label>
                <Input
                  type="number"
                  disabled={newMedType === 'Vật tư canh tác'}
                  placeholder={newMedType === 'Vật tư canh tác' ? 'N/A' : 'Xem trên nhãn thuốc'}
                  value={newMedPhi}
                  onChange={(e) => setNewMedPhi(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className="text-xs"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold block mb-1">Tình trạng kinh doanh (Availability) *</label>
              <select
                value={newMedAvailability}
                onChange={(e) => setNewMedAvailability(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs"
              >
                <option value="IN_STOCK">Đang bán (IN_STOCK - Cho phép khách đặt mua)</option>
                <option value="OUT_OF_STOCK">Tạm hết hàng (OUT_OF_STOCK)</option>
                <option value="NOT_SOLD">Cửa hàng không bán (NOT_SOLD - Chỉ tư vấn kỹ thuật)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-1">Hướng dẫn sử dụng / Liều lượng</label>
              <Input
                type="text"
                value={newMedDosage}
                onChange={(e) => setNewMedDosage(e.target.value)}
                className="text-xs"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1">
                Link nguồn tra PHI/liều (nhãn, trang nhà sản xuất)
                {newMedType === 'Vật tư canh tác' ? ' (tùy chọn)' : ' *'}
              </label>
              <Input
                type="url"
                placeholder="https://khuyennongvn.gov.vn/..."
                value={newMedSourceUrl}
                onChange={(e) => setNewMedSourceUrl(e.target.value)}
                className="text-xs"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                disabled={isIngredientBanned(newMedActiveIngredient) || isIngredientBanned(newMedName)}
                checked={newMedIsAllowed && !isIngredientBanned(newMedActiveIngredient) && !isIngredientBanned(newMedName)}
                onChange={(e) => setNewMedIsAllowed(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-700"
              />
              <span className="font-semibold">
                Đã đối chiếu Danh mục thuốc BVTV được phép sử dụng tại Việt Nam (bật lưu hành, Lavi mới được gợi ý)
              </span>
            </label>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateMedModalOpen(false)} disabled={creatingMed}>
                Hủy
              </Button>
              <Button type="submit" size="sm" disabled={creatingMed} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold">
                {creatingMed ? 'Đang tạo sản phẩm...' : 'Tạo sản phẩm'}
              </Button>
            </DialogFooter>
          </form>
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

      {/* ========================================================================================= */}
      {/* DIALOG THÊM ẢNH TRIỆU CHỨNG MỚI (TASK-15 PHASE 2) */}
      {/* ========================================================================================= */}
      <Dialog open={addImageModalOpen} onOpenChange={setAddImageModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" />
              <span>Thêm ảnh triệu chứng thực địa</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ảnh triệu chứng theo bộ phận (lá, quả, thân, toàn cây) hiển thị trên Sổ tay bệnh học và đối chiếu chẩn đoán.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateKnowledgeImage} className="space-y-4 py-2 text-xs">
            {/* Lớp bệnh mục tiêu (2 dropdown: Cây & Bệnh) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">1. Loài cây trồng *</label>
                <select
                  aria-label="Chọn loài cây trồng"
                  value={newImagePlant}
                  onChange={(e) => {
                    const p = e.target.value;
                    setNewImagePlant(p);
                    const match = diseases.find((d) => d.plantName === p);
                    if (match) setNewImageClass(match.classCode);
                  }}
                  className="h-9 w-full px-2.5 rounded-md border border-input bg-background text-xs cursor-pointer"
                >
                  {uniquePlants.map((plant) => (
                    <option key={plant} value={plant}>
                      {plant}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">2. Bệnh hại mục tiêu *</label>
                <select
                  aria-label="Chọn bệnh hại mục tiêu"
                  value={newImageClass}
                  onChange={(e) => setNewImageClass(e.target.value)}
                  className="h-9 w-full px-2.5 rounded-md border border-input bg-background text-xs cursor-pointer truncate"
                >
                  {diseases
                    .filter((d) => d.plantName === newImagePlant)
                    .map((d) => (
                      <option key={d.classCode} value={d.classCode}>
                        {d.commonNameVi}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Bộ phận cây */}
            <div>
              <label className="font-semibold block mb-1">3. Bộ phận cây nhiễm bệnh *</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'LEAF', label: 'Lá cây' },
                  { id: 'FRUIT', label: 'Hoa / Quả' },
                  { id: 'STEM', label: 'Thân / Cành' },
                  { id: 'WHOLE_PLANT', label: 'Toàn cây' },
                ].map((part) => (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => setNewImagePlantPart(part.id)}
                    className={`rounded-lg py-1.5 px-2 text-xs font-semibold border transition-all ${
                      newImagePlantPart === part.id
                        ? 'bg-primary text-white border-primary shadow-2xs'
                        : 'bg-secondary text-foreground border-border hover:bg-secondary/80'
                    }`}
                  >
                    {part.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chọn phương thức tải ảnh: HTTPS URL vs Upload File */}
            <div className="space-y-2 rounded-xl border border-border p-3 bg-secondary/20">
              <label className="font-semibold block">4. Nguồn cung cấp ảnh *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewImageMode('URL')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                    newImageMode === 'URL'
                      ? 'bg-primary text-white border-primary shadow-2xs'
                      : 'bg-background text-foreground border-border hover:bg-muted'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" /> Dán HTTPS URL ảnh
                </button>
                <button
                  type="button"
                  onClick={() => setNewImageMode('FILE')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                    newImageMode === 'FILE'
                      ? 'bg-primary text-white border-primary shadow-2xs'
                      : 'bg-background text-foreground border-border hover:bg-muted'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" /> Tải ảnh lên MinIO
                </button>
              </div>

              {newImageMode === 'URL' ? (
                <div className="space-y-1 pt-1">
                  <Input
                    type="url"
                    placeholder="https://example.com/images/late-blight-symptom.jpg"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    className="text-xs bg-background"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    URL ảnh trực tiếp phải là link https:// an toàn từ trang nông nghiệp uy tín.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageFileChange}
                    className="text-xs bg-background"
                  />
                  <p className="text-[10px] text-muted-foreground italic">
                    * Hệ thống tự động xóa EXIF / GPS để bảo vệ quyền riêng tư và lưu trữ an toàn trên MinIO bucket lavitree-images.
                  </p>
                  {newImageFilePreview && (
                    <div className="relative aspect-4/3 max-w-[200px] rounded-lg overflow-hidden border border-border">
                      <img src={newImageFilePreview} alt="Xem trước" className="h-full w-full object-cover" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mô tả / chú thích triệu chứng */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold">5. Chú thích / Mô tả triệu chứng *</label>
                <span className="text-[10px] text-muted-foreground">{newImageCaption.length}/300 ký tự</span>
              </div>
              <Textarea
                placeholder="Ví dụ: Vết đốm sương mai màu nâu đen xuất hiện ở rìa lá, mặt dưới có lớp nấm trắng mịn trong điều kiện ẩm ướt."
                value={newImageCaption}
                onChange={(e) => setNewImageCaption(e.target.value)}
                maxLength={300}
                rows={2}
                required
                className="text-xs"
              />
            </div>

            {/* Nguồn / Bản quyền & Bài viết gốc */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">6. Nguồn / Tác giả sở hữu ảnh *</label>
                <Input
                  type="text"
                  placeholder="Ví dụ: Cổng TTĐT Khuyến nông Quốc gia"
                  value={newImageCredit}
                  onChange={(e) => setNewImageCredit(e.target.value)}
                  maxLength={200}
                  required
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">7. URL bài viết gốc *</label>
                <Input
                  type="url"
                  placeholder="https://khuyennongvn.gov.vn/..."
                  value={newImageSourceUrl}
                  onChange={(e) => setNewImageSourceUrl(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>
            </div>

            {/* Ghi chú giấy phép */}
            <div>
              <label className="font-semibold block mb-1">8. Ghi chú giấy phép / bản quyền (tùy chọn)</label>
              <Input
                type="text"
                placeholder="Ví dụ: Trích dẫn phi thương mại phục vụ hướng dẫn nông nghiệp"
                value={newImageLicenseNote}
                onChange={(e) => setNewImageLicenseNote(e.target.value)}
                maxLength={200}
                className="text-xs"
              />
            </div>

            {/* Tự động duyệt ngay */}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={newImageAutoApprove}
                onChange={(e) => setNewImageAutoApprove(e.target.checked)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
              >
              </input>
              <span className="font-semibold text-foreground">
                Duyệt và cho phép hiển thị ngay trên Sổ tay bệnh học
              </span>
            </label>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddImageModalOpen(false)}
                disabled={submittingImage}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submittingImage}
                className="bg-primary hover:bg-primary-hover text-white font-semibold"
              >
                {submittingImage ? 'Đang lưu ảnh...' : 'Lưu ảnh triệu chứng'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG XÓA ẢNH TRIỆU CHỨNG */}
      <Dialog open={deleteImageTarget !== null} onOpenChange={(open) => { if (!open && !deletingImage) setDeleteImageTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gỡ ảnh triệu chứng này?</DialogTitle>
            <DialogDescription className="text-xs">
              Ảnh sẽ được đánh dấu xóa và không còn hiển thị trên Sổ tay bệnh học. Nếu muốn tạm ẩn, bạn có thể chọn "Bỏ duyệt" thay vì xóa.
            </DialogDescription>
          </DialogHeader>

          {deleteImageTarget && (
            <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3 text-xs">
              <div className="relative aspect-4/3 w-full rounded-lg overflow-hidden bg-muted max-w-[200px] mx-auto">
                <img src={deleteImageTarget.image_url} alt={deleteImageTarget.caption} className="h-full w-full object-cover" />
              </div>
              <p className="font-semibold text-foreground text-center">{deleteImageTarget.plant_name} — {deleteImageTarget.disease_name}</p>
              <p className="italic text-muted-foreground text-center">"{deleteImageTarget.caption}"</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteImageTarget(null)} disabled={deletingImage}>
              Hủy
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteImage} disabled={deletingImage}>
              {deletingImage ? 'Đang gỡ...' : 'Xóa ảnh'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG PHÓNG TO ẢNH TRONG ADMIN */}
      <Dialog open={previewingImage !== null} onOpenChange={(open) => !open && setPreviewingImage(null)}>
        <DialogContent className="sm:max-w-3xl">
          {previewingImage && (
            <div className="space-y-4">
              <DialogHeader className="space-y-1 text-left">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-semibold">
                    {previewingImage.plant_part === 'LEAF'
                      ? 'Lá'
                      : previewingImage.plant_part === 'FRUIT'
                      ? 'Quả/Hoa'
                      : previewingImage.plant_part === 'STEM'
                      ? 'Thân/Cành'
                      : 'Toàn cây'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs font-semibold text-primary">
                    {previewingImage.plant_name} — {previewingImage.disease_name}
                  </span>
                </div>
                <DialogTitle className="text-base font-bold text-foreground">
                  {previewingImage.caption}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Chi tiết ảnh triệu chứng
                </DialogDescription>
              </DialogHeader>

              <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl bg-black/5 border border-border">
                <img
                  src={previewingImage.image_url}
                  alt={previewingImage.caption}
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
                <div>
                  Nguồn/Bản quyền: <strong className="text-foreground">{previewingImage.credit}</strong>
                  {previewingImage.license_note && (
                    <span className="italic block text-[11px] mt-0.5">{previewingImage.license_note}</span>
                  )}
                </div>
                {previewingImage.source_url && (
                  <a
                    href={previewingImage.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                  >
                    <span>Xem bài báo nguồn</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
