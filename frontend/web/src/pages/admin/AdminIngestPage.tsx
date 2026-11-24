import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  UserCheck, AlertTriangle, Check, X, Clock, HelpCircle, Eye, Code2, Trash2,
  ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Sparkles, Image as ImageIcon, ImageOff,
  Plus, UploadCloud, Link as LinkIcon, ZoomIn, Scissors, BookOpen, ArrowRight, ArrowLeft, Edit3, Globe, Copy,
  LayoutGrid, List, Camera
} from 'lucide-react';
import { toast } from 'sonner';
import { ArticleEditor } from '@/features/admin/components/ArticleEditor';

import type {
  DiseaseOption,
  ParagraphItem,
  SuggestedMetadata,
  IngestionResponse,
  KnowledgeSourceItem,
  MedicineItem,
  ProductSuggestionItem,
  EscalationItem,
  KnowledgeImageItem,
  GroupedArticle,
  DuplicatePair,
} from '@/features/admin/types';
export type { KnowledgeImageItem, GroupedArticle };
import {
  getAgriTranslation,
  buildCombinedOrg,
  parseCombinedOrg,
  buildCombinedDate,
  parseCombinedDate,
  inferSourceScope,
  normalizeDateDisplay,
  extractDateFromSegment,
  extractKeyMetadataFromText,
  isSafeHttpUrl,
  findDuplicateChunks,
  formatTopicLabel,
  isHealthyTopic,
} from '@/features/admin/lib';

const getPlantPartLabel = (part: string) => {
  switch (part) {
    case 'LEAF': return 'Lá';
    case 'FRUIT': return 'Quả';
    case 'STEM': return 'Thân / Cành';
    case 'WHOLE_PLANT': return 'Toàn cây';
    default: return part || 'Lá';
  }
};

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

// Hạn mức tối đa cho 1 đoạn trích nguyên văn (đã mở rộng lên 5.000 ký tự cho giai đoạn xây dựng dữ liệu)
const MAX_SNIPPET_CHARS = 5000;

export const AdminIngestPage: React.FC = () => {
  const [diseases, setDiseases] = useState<DiseaseOption[]>([]);

  // ==================== TAB 1: NHẬP BÀI BÁO (HITL INGESTION) ====================
  // Phân loại cây/bệnh
  const [ingestClass, setIngestClass] = useState<string>('');
  // true khi cây/bệnh do AI đoán từ bài trước: bài mới phải đoán lại, không mang theo
  const [classFromAi, setClassFromAi] = useState<boolean>(false);
  const [selectedPlant, setSelectedPlant] = useState<string>('');
  const [ingestUrl, setIngestUrl] = useState<string>('');
  const [ingestTitle, setIngestTitle] = useState<string>('');
  // Tách biệt rõ ràng 4 trường: Cơ quan, Tác giả, Ngày đăng, Ngày cập nhật
  const [ingestOrg, setIngestOrg] = useState<string>('');
  const [ingestAuthor, setIngestAuthor] = useState<string>('');
  const [ingestPublishedDate, setIngestPublishedDate] = useState<string>('');
  const [ingestUpdatedDate, setIngestUpdatedDate] = useState<string>('');
  const [ingestDate, setIngestDate] = useState<string>(''); // fallback tương thích
  const [ingestSourceScope, setIngestSourceScope] = useState<'Việt Nam' | 'Quốc tế'>('Việt Nam');
  const [ingestText, setIngestText] = useState<string>('');
  const [articleEditorMode, setArticleEditorMode] = useState<'preview' | 'code'>('preview');
  // Mẹo dán bài: thu gọn mặc định, bấm nút "Mẹo" trong khung soạn thảo để mở/đóng.
  const [showPasteTip, setShowPasteTip] = useState(false);
  const [ingesting, setIngesting] = useState<boolean>(false);
  const [crawlingUrl, setCrawlingUrl] = useState<boolean>(false);
  const [ingestionResult, setIngestionResult] = useState<IngestionResponse | null>(null);

  // Chọn đoạn để commit
  const [selectedParagraphs, setSelectedParagraphs] = useState<Record<string, { selected: boolean; unitType: string; diseaseClass?: string }>>({});
  const [commitNotes, setCommitNotes] = useState<string>('Đã đối chiếu với bài viết gốc');
  const [committing, setCommitting] = useState<boolean>(false);
  const [showNoiseParagraphs, setShowNoiseParagraphs] = useState<boolean>(false);

  // Chế độ sửa bài đã lưu (/admin/ingest?edit=<url>)
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editParam = searchParams.get('edit');
  const [editUrl, setEditUrl] = useState<string | null>(null);
  const [editRows, setEditRows] = useState<KnowledgeSourceItem[]>([]);
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editSaving, setEditSaving] = useState<boolean>(false);
  const [deletingAllEditRows, setDeletingAllEditRows] = useState<boolean>(false);
  const [selectedEditRowIds, setSelectedEditRowIds] = useState<string[]>([]);
  const [editViewMode, setEditViewMode] = useState<'grid' | 'list'>('grid');
  const [editOriginalMeta, setEditOriginalMeta] = useState({
    plantName: '',
    diseaseName: '',
    modelClass: '',
    title: '',
    org: '',
    author: '',
    pubDate: '',
    upDate: '',
    date: '',
    sourceScope: 'Việt Nam' as 'Việt Nam' | 'Quốc tế',
  });
  const [summaryDrafts, setSummaryDrafts] = useState<Record<string, string>>({});
  const [editSubTab, setEditSubTab] = useState<'approved' | 'reparse'>('approved');
  const [dismissMetaDiff, setDismissMetaDiff] = useState<boolean>(false);
  const [dismissedAiFields, setDismissedAiFields] = useState<Record<string, boolean>>({});
  const [activeAiPopoverField, setActiveAiPopoverField] = useState<string | null>(null);
  const [isMetaCardCollapsed, setIsMetaCardCollapsed] = useState<boolean>(false);
  const [showMetaEditPanel, setShowMetaEditPanel] = useState<boolean>(false);
  const [articleTopics, setArticleTopics] = useState<string[]>([]);
  const [selectedTopicToAdd, setSelectedTopicToAdd] = useState<string>('');

  // Quản lý ảnh triệu chứng đính kèm bài viết (Tab 1)
  const [articleImages, setArticleImages] = useState<KnowledgeImageItem[]>([]);
  const [loadingArticleImages, setLoadingArticleImages] = useState<boolean>(false);
  const [addImageModalOpen, setAddImageModalOpen] = useState<boolean>(false);
  const [previewingImage, setPreviewingImage] = useState<KnowledgeImageItem | null>(null);
  const [deleteImageTarget, setDeleteImageTarget] = useState<KnowledgeImageItem | null>(null);
  const [deletingImage, setDeletingImage] = useState<boolean>(false);
  const [submittingImage, setSubmittingImage] = useState<boolean>(false);

  // Form thêm ảnh mới
  const [newImageMode, setNewImageMode] = useState<'FILE' | 'URL'>('FILE');
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImageFilePreviews, setNewImageFilePreviews] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState<string>('');
  const parsedImageUrls = React.useMemo(() => {
    if (!newImageUrl.trim()) return [];
    return newImageUrl
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter((u) => isSafeHttpUrl(u));
  }, [newImageUrl]);
  const [newImageClass, setNewImageClass] = useState<string>('');
  const [newImagePlantPart, setNewImagePlantPart] = useState<string>('LEAF');
  const [newImageCaption, setNewImageCaption] = useState<string>('');
  const [newImageCredit, setNewImageCredit] = useState<string>('');

  // Highlight cụm từ trích xuất (mention tag)
  const [highlightedMention, setHighlightedMention] = useState<{ paraId: string; text: string } | null>(null);

  // Tách đoạn an toàn theo dấu câu (Điều 25 Luật SHTT - Không sửa đổi nguyên văn)
  const [splitModalOpen, setSplitModalOpen] = useState<boolean>(false);
  const [splitTargetPara, setSplitTargetPara] = useState<ParagraphItem | null>(null);
  const [splitTargetSavedRow, setSplitTargetSavedRow] = useState<KnowledgeSourceItem | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [splitPart1, setSplitPart1] = useState<string>('');
  const [splitPart2, setSplitPart2] = useState<string>('');
  const [selectedCutIndex, setSelectedCutIndex] = useState<number>(-1);
  const [selectedCutIndices, setSelectedCutIndices] = useState<number[]>([]);

  // Thêm / sửa thẻ vật tư (mentions)
  const [addingMentionParaId, setAddingMentionParaId] = useState<string | null>(null);
  const [newMentionText, setNewMentionText] = useState<string>('');
  const [newMentionKind, setNewMentionKind] = useState<string>('CHEMICAL');

  // ==================== TAB 2: KIỂM DUYỆT TRI THỨC (CURATION) ====================

  // Load danh mục 38/40 lớp bệnh (sắp xếp theo thứ tự chữ cái tiếng Việt)
  useEffect(() => {
    const fetchDiseases = async () => {
      try {
        const res = await apiClient.get('/diseases');
        const list: DiseaseOption[] = res.data || [];
        const sortedList = [...list].sort((a, b) => {
          const plantCmp = a.plantName.localeCompare(b.plantName, 'vi');
          if (plantCmp !== 0) return plantCmp;
          return formatTopicLabel(a.commonNameVi, a.classCode).localeCompare(
            formatTopicLabel(b.commonNameVi, b.classCode),
            'vi'
          );
        });
        setDiseases(sortedList);
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
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [diseases]);

  const filteredDiseasesByPlant = React.useMemo(() => {
    if (!selectedPlant) return diseases;
    return diseases.filter((d) => d.plantName === selectedPlant);
  }, [diseases, selectedPlant]);

  const handlePlantChange = (plant: string) => {
    setSelectedPlant(plant);
    setClassFromAi(false);
    const plantDiseases = diseases.filter((d) => d.plantName === plant);
    setArticleTopics((prev) => {
      const remaining = prev.filter((code) => plantDiseases.some((d) => d.classCode === code));
      if (remaining.length > 0) return remaining;
      return plantDiseases.length > 0 ? [plantDiseases[0].classCode] : [];
    });
    setSelectedTopicToAdd('');
    const current = diseases.find((d) => d.classCode === ingestClass);
    if (!current || current.plantName !== plant) {
      setIngestClass(plantDiseases.length > 0 ? plantDiseases[0].classCode : '');
    }
  };

  // Danh sách các chủ đề / bệnh riêng biệt có trong bài viết đang xem
  const articleDistinctTopics = React.useMemo(() => {
    const list: Array<{ plantName: string; label: string; isHealthy: boolean; modelClass: string }> = [];
    editRows.forEach((r) => {
      const isH = isHealthyTopic(r.diseaseName, r.modelClass);
      const label = isH ? '🌱 Kỹ thuật canh tác & Phòng ngừa' : (r.diseaseName || 'Bệnh hại');
      if (!list.some((d) => d.modelClass === r.modelClass)) {
        list.push({ plantName: r.plantName, label, isHealthy: isH, modelClass: r.modelClass });
      }
    });
    return list;
  }, [editRows]);

  const handleApproveAllInEdit = async () => {
    if (editRows.length === 0) return;
    const allApproved = editRows.every((r) => r.isManualApproved);
    const targetStatus = !allApproved;
    const ids = editRows.map((r) => r.id);
    try {
      await apiClient.patch('/knowledge/sources/approve-batch', {
        source_ids: ids,
        is_approved: targetStatus,
        reviewer_notes: targetStatus ? 'Duyệt toàn bộ từ trang chi tiết bài viết' : 'Bỏ duyệt toàn bộ',
      });
      setEditRows((prev) => prev.map((r) => ({ ...r, isManualApproved: targetStatus })));
      toast.success(targetStatus ? `Đã duyệt toàn bộ ${ids.length} đoạn của bài viết.` : `Đã bỏ duyệt ${ids.length} đoạn.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Nhận diện dòng siêu dữ liệu đơn lẻ (Cơ quan, Tác giả, Ngày đăng, Ngày cập nhật...) để không gom/lưu thành đoạn kiến thức
  const isStandaloneMetadataLine = (text: string): boolean => {
    const trimmed = text
      .trim()
      .replace(/^(?:[#>*\-•+]+\s*)+/, '')
      .replace(/\*\*/g, '')
      .trim();
    if (!trimmed || trimmed.includes('\n') || trimmed.length > 240) return false;
    return (
      /^(?:original\s+publication\s+date|originally\s+published|first\s+published|publication\s*date|reviewed\s*\/\s*revised|revised\s*\/\s*reviewed|date\s*revised|last\s*(?:updated|reviewed|modified)|published(?:\s*(?:date|on|in))?|updated(?:\s*(?:on|in))?|revised(?:\s*(?:on|in))?|reviewed(?:\s*(?:on|in))?|ngày\s*(?:đăng|xuất\s*bản|cập\s*nhật)|cập\s*nhật|tác\s*giả|người\s*viết|authors?|written\s+by|prepared\s+by|cơ\s*quan|organization|publisher)\s*:/i.test(
        trimmed
      ) ||
      /^(?:last\s*(?:updated|reviewed|modified)|reviewed\s*\/\s*revised|publication\s*date|originally\s+published)(?=\s|$).*\d{4}/i.test(
        trimmed
      )
    );
  };

  // Nhận diện dòng chỉ chứa số thứ tự đơn lẻ, bullet đơn độc hoặc marker ('1.', '2.', '4.', '1.1', '• 4.', '**4.**', 'IV.')
  const isPureNumberMarker = (text: string): boolean => {
    if (!text) return false;
    const stripped = text
      .trim()
      .replace(/^[•\-*+–—\s\u00A0\u200B]+/, '')
      .replace(/[\s\u00A0\u200B*_#]/g, '');
    return /^(?:\d+(?:\.\d+)*|[a-zđ]|[IVX]+)[.)/:]?$/i.test(stripped);
  };

  // Gom tiêu đề mục, câu dẫn kết thúc bằng dấu ':' hoặc '?' và các ý con ngắn cùng mục thành đoạn hoàn chỉnh chuẩn Markdown (tối đa ~1.600 ký tự)
  const coalesceArticleParagraphs = (rawText: string): string => {
    if (!rawText) return '';
    const MAX_GROUP_CHARS = 5000;
    const stripMd = (s: string): string =>
      s.replace(/^(?:#{1,6}|[•\-*+])\s+/, '').replace(/\*\*/g, '').trim();

    const isRoleLine = (b: string): boolean => {
      const plain = stripMd(b);
      return (
        !plain.includes('\n') &&
        plain.length <= 120 &&
        !/[.!?;]$/.test(plain) &&
        /\b(professor|specialist|director|researcher|research\s+(?:specialist|assistant|associate|technician)|extension\s+(?:specialist|agent|educator)|scientist|technician|entomology|plant\s+pathology|pathology|horticulture|agronomy|lecturer)\b/i.test(
          plain
        )
      );
    };

    const isTitleHeaderBlock = (b: string, idx: number): boolean => {
      const trimmed = b.trim();
      if (!trimmed || trimmed.includes('\n') || isStandaloneMetadataLine(trimmed)) return false;
      if (/^#\s+\S/.test(trimmed)) return true;
      return idx === 0 && !/^#{2,6}\s+/.test(trimmed) && trimmed.length < 140 && !/[.!?;]$/.test(trimmed);
    };

    const isQuestionOrFaqBlock = (b: string): boolean => {
      const trimmed = b.trim();
      if (trimmed.includes('\n')) return false;
      const plain = stripMd(trimmed);
      return (
        plain.length <= 250 &&
        /\?\s*$/.test(plain) &&
        (/^(?:(?:\d+(?:\.\d+)*[.)/]?|[a-zđ][.)])\s*)?(?:\*\*)?[^\n*]{4,150}\?/i.test(plain) ||
          /\b(khi nào|ở đâu|tại sao|như thế nào|bao nhiêu|là gì|có được không|có nên|có thể)\b/i.test(plain))
      );
    };

    const isNumberedSubHeading = (b: string): boolean => {
      const trimmed = b.trim();
      if (trimmed.includes('\n')) return false;
      const plain = stripMd(trimmed);
      // 1.1, 4.1., 3.2, 4.1 hoặc a), b)
      return /^(?:\d+\.\d+\.?|[a-zđ][.)])\s+\S/i.test(plain) && plain.length <= 140;
    };

    // Nhận diện các tiểu mục biện pháp (Biện pháp canh tác:, Biện pháp sinh học:, Biện pháp hóa học...)
    // để gom chung vào khối "Biện pháp phòng trừ / điều trị", tránh bị cắt vụn thành từng đoạn lẻ
    const isSubMeasureHeading = (b: string): boolean => {
      const trimmed = b.trim();
      if (trimmed.includes('\n')) return false;
      const plain = stripMd(trimmed);
      return (
        /^(?:###\s*)?(?:[-•*+–—]\s*)?(?:(?:\d+(?:\.\d+)*|[a-zđ])[.)/]\s*)?(?:biện pháp|kỹ thuật|phương pháp)\s+(?:canh tác|sinh học|hóa học|vật lý|cơ giới|thủ công|chăm sóc|bảo vệ|sử dụng|giống|xử lý)\b/i.test(plain) ||
        /^(?:###\s*)?(?:[-•*+–—]\s*)?(?:lưu ý|hướng dẫn|nguyên tắc)\s+(?:khi\s+phun|khi\s+dùng|sử dụng|canh tác)\b/i.test(plain)
      );
    };

    const isSectionHeadingBlock = (b: string): boolean => {
      const trimmed = b.trim();
      if (!trimmed || trimmed.includes('\n') || isStandaloneMetadataLine(trimmed) || /^#\s+\S/.test(trimmed)) {
        return false;
      }

      // Câu hỏi FAQ kết thúc bằng '?' không phải là Major Section Heading
      if (isQuestionOrFaqBlock(trimmed)) return false;

      // Các tiểu mục như "Biện pháp sinh học:", "Biện pháp canh tác:" không được coi là Section Break độc lập
      if (isSubMeasureHeading(trimmed)) return false;

      const plain = stripMd(trimmed);
      if (plain.length < 3 || plain.length > 140) return false;
      if (
        /^(đây là|đó là|biện pháp này|cách này|khi |nếu |dù |mặc dù |ngoài ra|tuy nhiên|do đó|vì vậy|trong bài|dưới đây là)(?=\s|$)/i.test(
          plain
        )
      ) {
        return false;
      }

      // Mọi đề mục Markdown H2..H6 đều là Section Heading
      if (/^#{2,6}\s+\S/.test(trimmed)) {
        return true;
      }

      const endsWithColon = /:\s*$/.test(plain) && plain.replace(/:\s*$/, '').indexOf(':') === -1 && !/\.\s+\S/.test(plain);
      // Đề mục có số: "1.", "1.1", "2/", "I.", "II.", "a)"
      const numberedHeading = /^(\d+(\.\d+)*|[IVX]+|[a-zđ])[.)/]\s+[A-ZÀ-Ỹ\d]/i.test(plain) && !/\.\s*$/.test(plain);
      const commonHeading =
        /^(introduction|symptoms(\s+and\s+signs)?|signs(\s+and\s+symptoms)?|disease\s+cycle|causal\s+agent|pathogen|management|control|chemical\s+control|cultural\s+control|biological\s+control|diagnostic\s+procedures|prevention|treatment|summary|overview|giới\s+thiệu|triệu\s+chứng(\s+và\s+dấu\s+hiệu)?|dấu\s+hiệu\s+nhận\s+biết|nguyên\s+nhân(\s+và\s+điều\s+kiện\s+phát\s+sinh)?|đặc\s+điểm\s+phát\s+sinh|điều\s+kiện\s+phát\s+sinh|vòng\s+đời|tác\s+hại|biện\s+pháp\s+phòng\s+trừ|biện\s+pháp\s+phòng\s+ngừa|biện\s+pháp\s+quản\s+lý|cách\s+trị|phòng\s+ngừa|điều\s+trị|câu\s+hỏi\s+thường\s+gặp)$/i.test(
          plain.replace(/:\s*$/, '')
        );
      return endsWithColon || numberedHeading || commonHeading;
    };

    const isSubItemBlock = (b: string): boolean => {
      const trimmed = b.trim();
      if (!trimmed) return false;
      // Dấu gạch đầu dòng, bullet, mũi tên trả lời: -, *, +, •, -->, ->, =>
      if (/^(?:[•\-*+]|--?>|==?>)\s*\S/.test(trimmed)) return true;
      if (isQuestionOrFaqBlock(trimmed)) return true;
      if (isSubMeasureHeading(trimmed)) return true;
      // Tiêu đề mục (như 1.1, 1.2 hoặc ### ...) KHÔNG phải là sub-item để tránh bị gom vào đuôi đoạn trước!
      if (isSectionHeadingBlock(trimmed)) return false;
      // Tiêu đề con kết thúc bằng dấu hai chấm (vd: "- 3.1 Triệu chứng:", "Biện pháp canh tác:")
      if (
        trimmed.length <= 400 &&
        /^(?:[•\-*+]|--?>|==?>\s*)?(?:\*\*)?(?:\d+(\.\d+)*[.)/]?\s*)?[^:.\n!?*]{2,80}(?:\*\*)?:\s*(?:\*\*)?\s*\S?/.test(trimmed)
      ) {
        return true;
      }
      return false;
    };

    const formatSubItemMarkdown = (b: string): string => {
      const trimmed = b.trim();
      if (trimmed.includes('\n')) return trimmed;
      if (/^•\s+/.test(trimmed)) return trimmed.replace(/^•\s+/, '- ');
      if (/^[-*+]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed) || /^--?>\s+/.test(trimmed)) return trimmed;
      if (isSubMeasureHeading(trimmed)) {
        const cleanMeasure = trimmed.replace(/^#{1,6}\s+/, '').replace(/^[-•*+–—]\s*/, '').replace(/\*\*/g, '').trim();
        return `### ${cleanMeasure.endsWith(':') ? cleanMeasure : `${cleanMeasure}:`}`;
      }
      if (trimmed.length <= 265 && !trimmed.includes('**') && !/^#{1,6}\s+/.test(trimmed)) {
        const colonMatch = trimmed.match(/^([^:.\n!?*]{2,60}):\s+(\S[\s\S]*)$/);
        if (colonMatch) {
          return `- **${colonMatch[1].trim()}:** ${colonMatch[2].trim()}`;
        }
      }
      return trimmed;
    };

    const isIncompleteLeadIn = (text: string): boolean => {
      const plain = text.replace(/\*\*/g, '').trim();
      return (
        (/:\s*$/.test(plain) && plain.length <= 380) ||
        (!plain.includes('\n') && /\?\s*$/.test(plain) && plain.length <= 160)
      );
    };

    const isStrayCaptionOrPromo = (b: string, idx: number): boolean => {
      const plain = stripMd(b);
      return (
        /^[•\-*]?\s*(website|trang\s*chủ|fanpage|youtube|shopee|lazada|tiktok|hệ\s*thống\s*cửa\s*hàng)\s*:/i.test(
          plain
        ) ||
        (idx > 0 &&
          !b.includes('\n') &&
          plain.length < 90 &&
          !isStandaloneMetadataLine(b) &&
          !isSectionHeadingBlock(b) &&
          !isSubItemBlock(b) &&
          !isRoleLine(b) &&
          !/[.!?:;]/.test(plain))
      );
    };

    const rawBlocks = rawText
      .split(/\r?\n\s*\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const out: string[] = [];
    let pendingHeading = '';
    let currentGroup = '';
    let currentHasSubItems = false;

    const flush = () => {
      if (currentGroup) {
        out.push(currentGroup);
        currentGroup = '';
        currentHasSubItems = false;
      }
    };

    rawBlocks.forEach((rawBlock, idx) => {
      const trimmedBlock = rawBlock.trim();
      if (!trimmedBlock || isPureNumberMarker(trimmedBlock)) return;
      if (isStrayCaptionOrPromo(rawBlock, idx)) return;

      if (isStandaloneMetadataLine(rawBlock) || isTitleHeaderBlock(rawBlock, idx)) {
        pendingHeading = '';
        flush();
        out.push(rawBlock);
        return;
      }

      if (isSectionHeadingBlock(rawBlock)) {
        const prefixMatch = rawBlock.trim().match(/^(#{2,6})\s+/);
        const prefix = prefixMatch ? prefixMatch[1] : '##';
        const headingBody = rawBlock.trim().replace(/^#{2,6}\s+/, '').replace(/\*\*/g, '').trim();
        const newHeading = `${prefix} ${headingBody}`;

        // Nếu đã có pendingHeading (ví dụ H2 đứng trước H3, hoặc 2 heading liên tiếp):
        // Giữ cả 2 heading theo dòng riêng trong cùng snippet thay vì cắt pendingHeading thành đoạn rỗng!
        if (pendingHeading) {
          pendingHeading = `${pendingHeading}\n${newHeading}`;
          return;
        }

        flush();
        pendingHeading = newHeading;
        return;
      }

      const b = formatSubItemMarkdown(rawBlock);

      if (pendingHeading) {
        currentGroup = `${pendingHeading}\n${b}`;
        currentHasSubItems = isSubItemBlock(b);
        pendingHeading = '';
        return;
      }

      if (currentGroup) {
        const startsWithHeading = /^#{1,6}\s+/.test(b) && !isNumberedSubHeading(b) && !isQuestionOrFaqBlock(b);
        const leadIn = isIncompleteLeadIn(currentGroup);
        const sub = isSubItemBlock(b);
        const isShortFaqPair = isQuestionOrFaqBlock(currentGroup) || /^--?>\s+/.test(b);
        const shouldMerge =
          !startsWithHeading &&
          (leadIn ||
            isShortFaqPair ||
            (sub && (currentGroup.length <= 1800 || currentHasSubItems)) ||
            (currentGroup.length < 450 && b.length < 450));
        if (shouldMerge && currentGroup.length + 1 + b.length <= MAX_GROUP_CHARS) {
          currentGroup = `${currentGroup}\n${b}`;
          if (sub) currentHasSubItems = true;
          return;
        }
        flush();
      }

      currentGroup = b;
      currentHasSubItems = isSubItemBlock(b);
    });
    flush();
    if (pendingHeading) {
      out.push(pendingHeading);
      pendingHeading = '';
    }

    return out.join('\n\n');
  };

  // ==================== TAB 1 LOGIC (TASK-15 V2) ====================
  const cleanArticleTextFromHtml = (html: string): string => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const BLOCK_TAGS = new Set([
        'DIV', 'P', 'LI', 'TR', 'TD', 'TH', 'DT', 'DD',
        'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'SECTION', 'ARTICLE'
      ]);
      const extractTextWithSpacing = (el: Element): string => {
        const parts: string[] = [];
        const walk = (node: Node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent) parts.push(node.textContent);
            return;
          }
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          const element = node as Element;
          if (['SCRIPT', 'STYLE', 'SVG', 'NOSCRIPT'].includes(element.tagName)) return;
          if (element.tagName === 'BR') {
            parts.push('\n');
            return;
          }
          const isBlock = BLOCK_TAGS.has(element.tagName);
          if (isBlock) parts.push(' ');
          element.childNodes.forEach(walk);
          if (isBlock) parts.push(' ');
        };
        walk(el);
        return parts
          .join('')
          .replace(/[ \t\f\v]+/g, ' ')
          .replace(/ *\r?\n */g, '\n')
          .replace(/\n{2,}/g, '\n')
          .trim();
      };

      const extractInlineMarkdown = (el: Element): string => {
        const parts: string[] = [];
        const walk = (node: Node, insideStrong = false) => {
          if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent) parts.push(node.textContent);
            return;
          }
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          const element = node as Element;
          const tag = element.tagName;
          if (['SCRIPT', 'STYLE', 'SVG', 'NOSCRIPT', 'IMG'].includes(tag)) return;
          if (tag === 'BR') {
            parts.push('\n');
            return;
          }
          if (!insideStrong && (tag === 'STRONG' || tag === 'B')) {
            const strongRaw = extractTextWithSpacing(element);
            const core = strongRaw.trim();
            if (!core) return;
            if (/^[,.;:!?•\-–—]+$/.test(core)) {
              parts.push(` ${core} `);
              return;
            }
            const cleanCore = core.replace(/\*\*/g, '');
            const bulletPrefixMatch = cleanCore.match(/^([•\-*+])\s+(.+)$/);
            if (bulletPrefixMatch) {
              parts.push(` ${bulletPrefixMatch[1]} **${bulletPrefixMatch[2].trim()}** `);
            } else {
              parts.push(` **${cleanCore}** `);
            }
            return;
          }
          const isBlock = BLOCK_TAGS.has(tag);
          if (isBlock) parts.push(' ');
          element.childNodes.forEach((child) => walk(child, insideStrong));
          if (isBlock) parts.push(' ');
        };
        walk(el);

        let md = parts
          .join('')
          .replace(/[ \t\f\v]+/g, ' ')
          .replace(/ *\r?\n */g, '\n')
          .replace(/\n{2,}/g, '\n')
          .replace(/\*\*\s+\*\*/g, ' ')
          .replace(/\*\*([^*\n]+)\*\*\s*:/g, '**$1:**')
          .replace(/\s+([,.;:!?])/g, '$1')
          .trim();

        // Nếu cả đoạn dài (>140 ký tự) bị bọc trong một cặp **...** duy nhất, bỏ bớt ** bao ngoài để giữ Markdown sạch
        if (md.startsWith('**') && md.endsWith('**') && md.slice(2, -2).indexOf('**') === -1 && md.length > 140) {
          md = md.slice(2, -2).trim();
        }
        return md;
      };

      const isNoise = (text: string): boolean => {
        const trimmed = text.trim();
        if (!trimmed || trimmed.length < 3) return true;
        const lower = trimmed.toLowerCase();
        // Chỉ lọc tên nút mạng xã hội / điều hướng khi dòng ngắn (tránh xóa đoạn văn bắt đầu bằng "In ...")
        if (
          trimmed.length <= 35 &&
          /^(facebook|zalo|twitter|x|youtube|linkedin|pinterest|instagram|in|share|tweet|print|email|search|log\s*in|sign\s*in|menu|publications|related publications|where next\??)$/i.test(lower)
        ) {
          return true;
        }
        if (/^(skip to|nhảy tới|chuyển tới)\s+/i.test(lower)) return true;
        if (
          trimmed.length <= 80 &&
          /^(chia sẻ|bình luận|tin liên quan|xem thêm|bài viết liên quan|từ khóa|keywords?|tag|hotline|liên hệ|quảng cáo)\b/i.test(lower)
        ) {
          return true;
        }
        if (/^(điện thoại|sđt|hotline|email|fax):\s*[\d\s.\-]+$/i.test(lower)) return true;
        if (/^[•\-*]?\s*(website|trang\s*chủ|fanpage|youtube|shopee|lazada|tiktok|hệ\s*thống\s*cửa\s*hàng)\s*:/i.test(trimmed)) return true;
        // Hotline/quảng cáo: có số điện thoại đi kèm từ khóa liên hệ, hoặc dòng footer quen thuộc
        const hasPhone = /(\+84|\b0)\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3,4}\b/.test(trimmed);
        if (trimmed.length <= 300 && hasPhone && /hotline|zalo|liên hệ|tư vấn|đặt hàng|mua hàng|gọi/i.test(lower)) return true;
        if (/^bạn đang đọc bài viết|^đăng ký nhận bản tin/i.test(lower)) return true;
        if (/^receive email notifications for new publications$/i.test(trimmed)) return true;
        if (/^read our (commitment to nondiscrimination|privacy statement)\.?$/i.test(trimmed)) return true;
        if (/^recommendations for the use of agricultural chemicals are included in this publication as a convenience/i.test(trimmed)) return true;
        if (/^n\.c\.\s*cooperative extension prohibits discrimination and harassment/i.test(trimmed)) return true;
        if (/^n\.c\.\s*cooperative extension is based at north carolina/i.test(trimmed)) return true;
        if (/^find more information at the following .* websites:?$/i.test(trimmed)) return true;
        if (/^(college of agriculture & life sciences|cals news|extension at nc a&t|jobs|give now|county centers|contact us|ncce logo|nc state extension)$/i.test(trimmed)) return true;
        return false;
      };

      // Thay <br> bằng xuống dòng để các cặp metadata trong cùng <p> (Publication date / Reviewed/Revised) tách thành dòng riêng
      doc.querySelectorAll('br').forEach((br) => {
        br.replaceWith(doc.createTextNode('\n'));
      });

      // Trích xuất metadata (tiêu đề, cơ quan, tác giả, ngày đăng, ngày cập nhật) TRƯỚC khi xóa <header>
      const h1El = doc.querySelector('article h1, main h1, [role="main"] h1, h1');
      const titleText = (
        (h1El ? extractTextWithSpacing(h1El) : '') ||
        doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
        doc.title ||
        ''
      ).replace(/\s+/g, ' ').trim();

      const siteOrg = (doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || '')
        .replace(/\s+/g, ' ')
        .trim();

      const authorMeta = (
        doc.querySelector(
          'meta[itemprop="author"], meta[name="author"], meta[property="article:author"], meta[name="creator"], meta[name="byl"]'
        )?.getAttribute('content') || ''
      )
        .replace(/\s+/g, ' ')
        .trim();

      const authorEls = Array.from(
        doc.querySelectorAll(
          '.author, .authors, [rel="author"], .byline, [itemprop="author"], [itemprop="creator"], .article-author, .post-author, .blog-author, .author-name, .user-author, .entry-author, .article-details .media .media-body .mt-0, .article-details .media .media-body div:first-child, .time-post-article, .post-meta .author, .post-info .author'
        )
      ).filter((el) => !el.closest('aside, .sidebar, .related, .related-posts, .related-articles, footer'));
      const authorNames = authorEls
        .map((el) => {
          const raw = extractTextWithSpacing(el).replace(/\n+/g, ', ');
          return raw.replace(/^(?:người\s*viết|tác\s*giả|author|written\s*by|posted\s*by)\s*[:\-]\s*/i, '').trim();
        })
        .filter((t) => {
          if (t.length < 2 || t.length > 50 || /^authors?:?$/i.test(t) || isNoise(t)) return false;
          if (/[:|;]/.test(t)) return false;
          if (/\b(?:cách\s*làm|ý\s*nghĩa|khai\s*trương|hướng\s*dẫn|tại\s*nhà|cây\s*cảnh|phong\s*thủy)\b/i.test(t)) return false;
          return true;
        });

      if (authorMeta && !authorNames.includes(authorMeta)) {
        authorNames.unshift(authorMeta);
      }

      const metaDate = (
        doc.querySelector(
          'meta[property="article:published_time"], meta[property="og:published_time"], meta[name="publish-date"], meta[name="date"], meta[name="dcterms.created"], meta[itemprop="datePublished"]'
        )?.getAttribute('content') || ''
      ).trim();

      let dateText = metaDate ? extractDateFromSegment(metaDate) : '';

      if (!dateText) {
        const dateCandidates = Array.from(
          doc.querySelectorAll(
            'time:not(.updated):not(.modified-date), [itemprop="datePublished"], .date, .post-date, .publish-date, .detail-time, .article-date, .entry-date, .article-details small, .media small, .media-body small, .post-meta small, small.text-muted, .time-post-article, .lbPublishedDate'
          )
        );
        for (const el of dateCandidates) {
          const dtAttr = (el.getAttribute('datetime') || el.getAttribute('content') || '').trim();
          if (dtAttr) {
            const parsed = extractDateFromSegment(dtAttr);
            if (parsed) {
              dateText = parsed;
              break;
            }
          }
          const text = extractTextWithSpacing(el);
          if (text) {
            const parsed = extractDateFromSegment(text);
            if (parsed) {
              dateText = parsed;
              break;
            }
          }
        }
      }

      const metaUpdatedDate = (
        doc.querySelector(
          'meta[property="article:modified_time"], meta[property="og:updated_time"], meta[name="last-modified"], meta[name="revised"], meta[name="dcterms.modified"], meta[itemprop="dateModified"]'
        )?.getAttribute('content') || ''
      ).trim();

      let updatedDateText = metaUpdatedDate ? extractDateFromSegment(metaUpdatedDate) : '';

      if (!updatedDateText) {
        const updatedEl = doc.querySelector('time.updated, .updated-date, .modified-date, .revised-date');
        if (updatedEl) {
          const dtAttr = (updatedEl.getAttribute('datetime') || updatedEl.getAttribute('content') || '').trim();
          const val = dtAttr || extractTextWithSpacing(updatedEl);
          if (val) updatedDateText = extractDateFromSegment(val);
        }
      }

      // Unwrap các form bọc nội dung (như DotNetNuke / ASP.NET dùng form#Form bọc toàn bộ body)
      // Chỉ loại bỏ các form rác (tìm kiếm, đăng ký nhận tin) nếu không chứa nội dung chính bài viết
      doc.querySelectorAll('form').forEach((f) => {
        if (
          f.id === 'Form' ||
          f.id.toLowerCase().includes('form') ||
          f.querySelector('article, h1, h2, h3, .post-content, .detail-post, .detail-content, p')
        ) {
          f.replaceWith(...Array.from(f.childNodes));
        } else {
          f.remove();
        }
      });

      // Loại bỏ thẻ rác, menu, header (trừ header chứa h1 bài), footer, quảng cáo, bộ đọc audio
      const junkSelectors = [
        'script', 'style', 'nav', 'footer', 'aside', 'iframe', 'noscript', 'svg', 'audio',
        '.menu', '.navbar', '.sidebar', '.ad', '.ads', '.advertisement',
        '.social-share', '.share-buttons', '.share', '.comment', '.comments',
        '.related', '.related-posts', '.related-publications', '.breadcrumb',
        '.hotline', '.contact-info', '.skip-link', '.visually-hidden', '.sr-only',
        '.newsletter', '.subscribe', '.cookie-banner', '.legal-disclaimer', '.disclaimer',
        'figcaption', '.wp-caption-text', '.image-caption', '.caption',
        '[id*="ReadVoice"]', '[id*="Voice"]', '.audio-player', '.voice-player',
        '[aria-hidden="true"]', '[role="navigation"]', '[role="banner"]', '[role="complementary"]'
      ];
      junkSelectors.forEach((sel) => {
        doc.querySelectorAll(sel).forEach((el) => el.remove());
      });
      doc.querySelectorAll('header').forEach((el) => {
        if (!el.querySelector('h1')) el.remove();
      });

      const isHeading = (el: Element | null, text: string): boolean =>
        (!!el && /^H[1-6]$/.test(el.tagName)) ||
        /:\s*$/.test(text) ||
        /^(\d+|[IVX]+|[a-zđ])[.)]\s+\S/i.test(text);

      const isMetadataLine = (text: string): boolean =>
        /^(?:original\s+publication\s+date|publication\s*date|reviewed\s*\/\s*revised|date\s*revised|last\s*(?:updated|reviewed|modified)|published|updated|revised|reviewed|ngày\s*(?:đăng|xuất\s*bản|cập\s*nhật)|cập\s*nhật|tác\s*giả|author|authors|written\s+by|prepared\s+by|cơ\s*quan)\b/i.test(text) &&
        text.length >= 8 &&
        text.length <= 240;

      const keep = (el: Element | null, text: string): boolean =>
        !isNoise(text) &&
        (text.length >= 30 ||
          (text.length >= 3 && isHeading(el, text)) ||
          isMetadataLine(text));

      const candidates = [
        doc.querySelector('article'),
        doc.querySelector('[role="main"], main'),
        doc.querySelector('.detail-post'),
        doc.querySelector('.detail-content'),
        doc.querySelector('.post-content'),
        doc.querySelector('.post-detail'),
        doc.querySelector('.article-content'),
        doc.querySelector('.entry-content'),
        doc.querySelector('.content'),
      ];
      const mainEl =
        candidates.find((el) => el && extractTextWithSpacing(el).length >= 150) ||
        doc.body;

      if (!mainEl) return '';

      const lines: string[] = [];
      const seen = new Set<string>();
      const push = (t: string, allowMultiline = false) => {
        const norm = allowMultiline
          ? t.split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n')
          : t.replace(/\s+/g, ' ').trim();
        const dedupeKey = norm
          .replace(/^(?:#{1,6}|[•\-*+])\s+/gm, '')
          .replace(/\*\*/g, '')
          .replace(/:\s*$/, '')
          .toLowerCase()
          .trim();
        if (!norm || !dedupeKey || seen.has(dedupeKey)) return; // footer lặp 2 lần, li lồng p...
        seen.add(dedupeKey);
        lines.push(norm);
      };

      if (titleText && !isNoise(titleText)) push(`# ${titleText}`);
      if (siteOrg && siteOrg.length <= 120 && !isNoise(siteOrg)) push(`Cơ quan: ${siteOrg}`);
      if (authorNames.length > 0) {
        push(`Tác giả: ${Array.from(new Set(authorNames)).slice(0, 5).join(', ')}`);
      }
      if (dateText && dateText.length <= 100) push(`Ngày đăng: ${dateText}`);
      if (updatedDateText && updatedDateText.length <= 100 && updatedDateText !== dateText) {
        push(`Ngày cập nhật: ${updatedDateText}`);
      }

      // Gom các gạch đầu dòng Markdown (- ...) thành khối để không mất ý con khi lọc đoạn < 40 ký tự
      let pendingListLines: string[] = [];
      const flushListBuffer = () => {
        if (pendingListLines.length === 0) return;
        push(pendingListLines.join('\n'), true);
        pendingListLines = [];
      };

      const blocks = mainEl.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, table, dt, dd');
      if (blocks.length > 0) {
        blocks.forEach((b) => {
          // Bỏ qua các thẻ lồng bên trong <table> hoặc <li> để tránh lặp chữ
          if (b.tagName !== 'TABLE' && b.closest('table')) return;
          if (b.tagName !== 'LI' && b.closest('li')) return;

          if (b.tagName === 'H1') {
            flushListBuffer();
            return;
          }

          if (b.tagName === 'TABLE') {
            flushListBuffer();
            const rows = Array.from(b.querySelectorAll('tr'));
            if (rows.length === 0) return;
            const headers = Array.from(rows[0].querySelectorAll('th')).map((th) => extractTextWithSpacing(th));
            const dataRows = headers.length > 0 ? rows.slice(1) : rows;
            const formattedRows: string[] = [];

            dataRows.forEach((tr) => {
              const cells = Array.from(tr.querySelectorAll('th, td')).map((cell) => extractTextWithSpacing(cell));
              if (cells.every((c) => !c)) return;
              if (headers.length > 0 && cells.length === headers.length) {
                const pairs = cells
                  .map((val, idx) => (headers[idx] ? `${headers[idx]}: ${val || '-'}` : val))
                  .filter(Boolean);
                if (pairs.length > 0) formattedRows.push(`- ${pairs.join(' | ')}`);
              } else {
                const nonEmpty = cells.filter(Boolean);
                if (nonEmpty.length > 0) formattedRows.push(`- ${nonEmpty.join(' | ')}`);
              }
            });

            if (formattedRows.length > 0) {
              let chunk = '';
              formattedRows.forEach((rowStr) => {
                const candidate = chunk ? `${chunk}\n${rowStr}` : rowStr;
                if (candidate.length > 1200 && chunk) {
                  push(chunk, true);
                  chunk = rowStr;
                } else {
                  chunk = candidate;
                }
              });
              if (chunk) push(chunk, true);
            }
            return;
          }

          const t = extractTextWithSpacing(b);
          if (!t || isNoise(t)) return;

          // Bỏ qua các thẻ chỉ chứa duy nhất số thứ tự đơn lẻ: "1.", "2.", "4.", "1.1", "1/"
          if (isPureNumberMarker(t)) return;

          // Bỏ qua <p> là chú thích ảnh (chỉ bọc <em>/<i> hoặc nằm ngay sau <img>/<figure>, ngắn < 95 ký tự và không có dấu câu)
          if (b.tagName === 'P') {
            const empText = Array.from(b.querySelectorAll('em, i'))
              .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
              .join(' ')
              .trim();
            const isEmphasisOnly = empText.length > 0 && empText.length >= t.length * 0.9;
            const prevSib = b.previousElementSibling;
            const followsImage =
              !!b.querySelector('img') ||
              (!!prevSib && (prevSib.tagName === 'IMG' || prevSib.tagName === 'FIGURE' || !!prevSib.querySelector('img')));
            if ((isEmphasisOnly || followsImage) && t.length < 95 && !/[.!?:;]$/.test(t) && !isHeading(b, t) && !isMetadataLine(t)) {
              return;
            }
          }

          if (b.tagName === 'LI') {
            if (b.closest('.related, .related-publications, .keywords, .tags, .toc, #toc')) return;
            const onlyLink =
              b.children.length === 1 &&
              b.firstElementChild?.tagName === 'A' &&
              t === extractTextWithSpacing(b.firstElementChild);
            if (onlyLink && t.length < 60 && !/[.!?]/.test(t)) return;
            if (t.length < 12) return;

            const mdBody = extractInlineMarkdown(b).replace(/^(?:[-•*+–—]\s*)+/, '').trim();
            if (!mdBody || isPureNumberMarker(mdBody)) return;
            const bulletLine = /^\d+[.)]\s+/.test(mdBody)
              ? mdBody
              : `- ${mdBody.replace(/\n+/g, ' ')}`;

            if (bulletLine.length <= 360) {
              const projectedLen = pendingListLines.join('\n').length + bulletLine.length + 1;
              if (projectedLen > 650) flushListBuffer();
              pendingListLines.push(bulletLine);
            } else {
              flushListBuffer();
              push(bulletLine, false);
            }
            return;
          }

          flushListBuffer();

          if (/^H[2-6]$/.test(b.tagName)) {
            const headingText = t.replace(/\n+/g, ' ').trim();
            if (/^(authors?|keywords?|references?|tác giả|từ khóa|tài liệu tham khảo):?$/i.test(headingText)) {
              return;
            }
            const mdPrefix = b.tagName === 'H2' ? '##' : '###';
            const formattedHeading = /[:.!?]$/.test(headingText) ? headingText : `${headingText}:`;
            push(`${mdPrefix} ${formattedHeading}`);
            return;
          }

          if (b.tagName === 'DT') {
            const dtText = t.replace(/\n+/g, ' ').trim();
            if (b.closest('p, li, blockquote')) return;
            push(`### ${/[:.!?]$/.test(dtText) ? dtText : `${dtText}:`}`);
            return;
          }

          if (b.tagName === 'DD') {
            if (b.closest('p, li, blockquote')) return;
            if (t.length >= 15 || isMetadataLine(t)) {
              push(isMetadataLine(t) ? t : extractInlineMarkdown(b), t.includes('\n'));
            }
            return;
          }

          if (b.tagName === 'P') {
            if (isMetadataLine(t)) {
              push(t, t.includes('\n'));
              return;
            }

            // Nhận diện <p> chứa tiêu đề in đậm hoàn toàn (ví dụ: <p><strong>1. Triệu chứng bệnh</strong></p>)
            const strongEls = Array.from(b.querySelectorAll('strong, b'));
            const strongPlain = strongEls.map((el) => extractTextWithSpacing(el)).join(' ').replace(/\s+/g, ' ').trim();
            const isFullBoldP = strongPlain.length >= 3 && strongPlain.length >= t.replace(/[:\-•*]/g, '').trim().length * 0.92;
            if (
              isFullBoldP &&
              t.length >= 3 &&
              t.length <= 95 &&
              !/[.!?]$/.test(t) &&
              !/^[•\-*+]\s+/.test(t) &&
              !(t.includes(':') && !/:\s*$/.test(t))
            ) {
              const headingClean = t.replace(/\n+/g, ' ').trim();
              if (/^(authors?|keywords?|references?|tác giả|từ khóa|tài liệu tham khảo):?$/i.test(headingClean)) {
                return;
              }
              push(`### ${/[:.!?]$/.test(headingClean) ? headingClean : `${headingClean}:`}`);
              return;
            }

            if (keep(b, t)) {
              let mdP = extractInlineMarkdown(b);
              if (/^[•*+]\s+/.test(mdP)) {
                mdP = mdP.replace(/^[•*+]\s+/, '- ');
              }
              if (
                !mdP.includes('\n') &&
                mdP.length <= 265 &&
                !mdP.startsWith('- ') &&
                /^\*\*[^*\n]{2,60}\*\*:?\s+\S/.test(mdP)
              ) {
                mdP = `- ${mdP}`;
              }
              push(mdP, mdP.includes('\n'));
            }
            return;
          }

          if (keep(b, t)) {
            const mdText = isMetadataLine(t) ? t : extractInlineMarkdown(b);
            push(mdText, mdText.includes('\n'));
          }
        });
        flushListBuffer();
      } else {
        (mainEl.textContent || '').split(/\r?\n/).forEach((r) => {
          const t = r.replace(/\s+/g, ' ').trim();
          if (keep(null, t)) push(t);
        });
      }

      return coalesceArticleParagraphs(lines.join('\n\n'));
    } catch {
      return '';
    }
  };

  const resetArticleState = () => {
    setIngestionResult(null);
    setArticleImages([]);
    setSelectedParagraphs({});
    setDismissedAiFields({});
    setActiveAiPopoverField(null);
    setIsMetaCardCollapsed(false);
    // Đang sửa bài đã lưu: giữ thông tin bài, chỉ bỏ kết quả tách đoạn
    if (editUrl) return;
    setIngestTitle('');
    setIngestOrg('');
    setIngestAuthor('');
    setIngestPublishedDate('');
    setIngestUpdatedDate('');
    setIngestDate('');
    setIngestSourceScope('Việt Nam');
    if (classFromAi) {
      setIngestClass('');
      setSelectedPlant('');
      setClassFromAi(false);
    }
  };

  const handlePasteArticleText = (e: React.ClipboardEvent<HTMLElement>) => {
    const htmlData = e.clipboardData?.getData('text/html') || '';
    const plainData = e.clipboardData?.getData('text/plain') || '';
    const textareaTarget = e.currentTarget instanceof HTMLTextAreaElement ? e.currentTarget : null;
    const isFullReplace =
      !ingestText.trim() ||
      !textareaTarget ||
      (textareaTarget.selectionEnd - textareaTarget.selectionStart >= ingestText.length * 0.8);

    if (!isFullReplace) {
      resetArticleState();
      return;
    }

    resetArticleState();
    const hasHtmlStructure = /<(?:h[1-6]|p|li|ul|ol|table|article|section|strong|b|br)\b/i.test(htmlData);
    if (htmlData && hasHtmlStructure) {
      const cleaned = cleanArticleTextFromHtml(htmlData);
      if (cleaned && cleaned.length >= 60) {
        e.preventDefault();
        setIngestText(cleaned.slice(0, 50000));
        setArticleEditorMode('preview');
        toast.success('Đã tự động chuẩn hóa bài báo sang định dạng Markdown sạch!');
        return;
      }
    }

    if (plainData && plainData.trim().length >= 80) {
      e.preventDefault();
      const formattedPlain = coalesceArticleParagraphs(plainData.trim());
      setIngestText((formattedPlain || plainData.trim()).slice(0, 50000));
      setArticleEditorMode('preview');
      toast.success('Đã dán và tự động căn chỉnh đoạn bài báo!');
    }
  };

  const handleCrawlArticleFromUrl = async () => {
    const targetUrl = (editUrl || ingestUrl).trim();
    if (!targetUrl) {
      toast.error('Vui lòng nhập đường dẫn URL bài viết ở mục 1 trước khi bấm Crawl!');
      return;
    }
    if (!isSafeHttpUrl(targetUrl)) {
      toast.error('Đường dẫn bài viết phải là URL hợp lệ (http:// hoặc https://)');
      return;
    }

    try {
      setCrawlingUrl(true);
      resetArticleState();

      let html = '';
      let lastError: unknown = null;
      let coreRejected = false;

      // Tầng 1: Gọi Core API /knowledge/fetch-url (có kiểm tra chống SSRF)
      try {
        const res = await apiClient.post<{ url: string; html: string }>(
          '/knowledge/fetch-url',
          { url: targetUrl },
          { timeout: 45000 }
        );
        if (res.data?.html) {
          html = res.data.html;
        }
      } catch (err) {
        lastError = err;
        const status = (err as { response?: { status?: number } })?.response?.status;
        // Nếu Core API chủ động từ chối (400/401/403/422), không bỏ qua kiểm tra của Core
        if (status && [400, 401, 403, 422].includes(status)) {
          coreRejected = true;
        }
      }

      // Tầng 2: Chỉ fallback sang Vite Dev Middleware khi đang chạy dev và Core chưa sẵn sàng (404/lỗi mạng)
      if (!html && import.meta.env.DEV && !coreRejected) {
        try {
          const devRes = await fetch(`/__dev/fetch-url?url=${encodeURIComponent(targetUrl)}`, {
            signal: AbortSignal.timeout(45000),
          });
          const ct = devRes.headers.get('content-type') || '';
          if (devRes.ok && ct.includes('application/json')) {
            const devData = (await devRes.json()) as { html?: string };
            if (devData?.html) {
              html = devData.html;
            }
          } else if (!devRes.ok && ct.includes('application/json')) {
            const errBody = (await devRes.json()) as { detail?: string };
            if (errBody?.detail) {
              lastError = new Error(errBody.detail);
            }
          }
        } catch (err) {
          lastError = err;
        }
      }

      if (!html) {
        toast.error(
          lastError
            ? `Không crawl được từ URL (${getErrorMessage(lastError)}). Vui lòng mở trang gốc và nhấn Ctrl+A, Ctrl+C để copy thủ công.`
            : 'Trang web không cho phép tải tự động. Vui lòng mở trang gốc và nhấn Ctrl+A, Ctrl+C để copy thủ công.'
        );
        return;
      }

      let cleaned = cleanArticleTextFromHtml(html);
      if (!cleaned || cleaned.length < 80) {
        const fallbackDoc = new DOMParser().parseFromString(html, 'text/html');
        cleaned = (fallbackDoc.body?.textContent || '').replace(/[ \t]+/g, ' ').trim();
      }

      if (!cleaned || cleaned.length < 40) {
        toast.error('Không trích xuất được văn bản từ trang web này (trang có thể render bằng JS). Vui lòng mở trang gốc và nhấn Ctrl+A, Ctrl+C để copy thủ công.');
        return;
      }

      setIngestText(cleaned.slice(0, 50000));
      setArticleEditorMode('preview');
      if (!editUrl) {
        setIngestSourceScope(inferSourceScope(targetUrl, '', null));
      }
      toast.success('Đã crawl và chuẩn hóa định dạng Markdown từ URL! Hãy kiểm tra bản xem trước bên dưới.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCrawlingUrl(false);
    }
  };

  // ==================== QUẢN LÝ ẢNH TRIỆU CHỨNG BỆNH CỦA BÀI VIẾT ====================
  const fetchArticleImages = async (url: string) => {
    if (!url || !isSafeHttpUrl(url)) return;
    try {
      setLoadingArticleImages(true);
      const res = await apiClient.get<KnowledgeImageItem[]>('/knowledge/images', {
        params: { source_url: url.trim() },
      });
      // Lọc phòng thủ phía client: Chỉ nhận đúng ảnh có source_url trùng với bài viết hiện tại
      const targetClean = url.trim().replace(/\/+$/, '');
      const list = (res.data || []).filter((img) => {
        const imgUrlClean = (img.source_url || '').trim().replace(/\/+$/, '');
        return imgUrlClean === targetClean;
      });
      setArticleImages(list);
    } catch {
      // ignore
    } finally {
      setLoadingArticleImages(false);
    }
  };

  const openAddImageModal = () => {
    const targetUrl = (editUrl || ingestUrl || '').trim();
    const targetClass = ingestClass || editOriginalMeta.modelClass || (articleTopics.length > 0 ? articleTopics[0] : '');
    const targetCredit = ingestOrg || editOriginalMeta.org || '';

    setNewImageClass(targetClass);
    setNewImageCredit(targetCredit);
    setNewImageCaption('');
    setNewImagePlantPart('LEAF');
    setNewImageMode('FILE');
    setNewImageFiles([]);
    setNewImageFilePreviews([]);
    setNewImageUrl('');
    setAddImageModalOpen(true);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setNewImageFiles(files);
      const previews = files.map((f) => URL.createObjectURL(f));
      setNewImageFilePreviews(previews);
    }
  };

  const handleCreateArticleImage = async () => {
    const currentUrl = (editUrl || ingestUrl || '').trim();
    if (!currentUrl) {
      toast.error('Bài viết chưa có URL nguồn. Vui lòng kiểm tra lại URL bài viết.');
      return;
    }
    if (!newImageClass) {
      toast.error('Vui lòng chọn chuyên đề / mã bệnh cho ảnh.');
      return;
    }

    try {
      setSubmittingImage(true);
      let successCount = 0;
      const createdImages: KnowledgeImageItem[] = [];

      if (newImageMode === 'URL') {
        const urlsToProcess = newImageUrl
          .split(/[\n,]+/)
          .map((u) => u.trim())
          .filter((u) => u.length > 0);

        if (urlsToProcess.length === 0) {
          toast.error('Vui lòng nhập ít nhất 1 URL hình ảnh hợp lệ.');
          setSubmittingImage(false);
          return;
        }

        for (const url of urlsToProcess) {
          try {
            const formData = new FormData();
            formData.append('ModelClass', newImageClass);
            formData.append('SourceUrl', currentUrl);
            formData.append('Caption', newImageCaption.trim());
            formData.append('PlantPart', newImagePlantPart);
            formData.append('Credit', newImageCredit.trim());
            formData.append('IsManualApproved', 'true');
            formData.append('ImageUrl', url);

            const res = await apiClient.post<KnowledgeImageItem>('/knowledge/images', formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            createdImages.push(res.data);
            successCount++;
          } catch (err) {
            console.error('Lỗi lưu ảnh URL:', url, err);
          }
        }
      } else {
        if (newImageFiles.length === 0) {
          toast.error('Vui lòng chọn ít nhất 1 tệp ảnh từ thiết bị để tải lên.');
          setSubmittingImage(false);
          return;
        }

        for (const f of newImageFiles) {
          try {
            const formData = new FormData();
            formData.append('ModelClass', newImageClass);
            formData.append('SourceUrl', currentUrl);
            formData.append('Caption', newImageCaption.trim());
            formData.append('PlantPart', newImagePlantPart);
            formData.append('Credit', newImageCredit.trim());
            formData.append('IsManualApproved', 'true');
            formData.append('File', f);

            const res = await apiClient.post<KnowledgeImageItem>('/knowledge/images', formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            createdImages.push(res.data);
            successCount++;
          } catch (err) {
            console.error('Lỗi tải tệp ảnh:', f.name, err);
          }
        }
      }

      if (successCount > 0) {
        toast.success(`Đã thêm thành công ${successCount} ảnh triệu chứng cho bài viết!`);
        setArticleImages((prev) => [...createdImages, ...prev]);
        setAddImageModalOpen(false);
        setNewImageUrl('');
        setNewImageFiles([]);
        setNewImageFilePreviews([]);
        setNewImageCaption('');
      } else {
        toast.error('Không thể lưu ảnh nào. Vui lòng kiểm tra lại URL hoặc định dạng tệp ảnh.');
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmittingImage(false);
    }
  };

  const handleDeleteArticleImage = async () => {
    if (!deleteImageTarget) return;
    try {
      setDeletingImage(true);
      await apiClient.delete(`/knowledge/images/${deleteImageTarget.id}`);
      setArticleImages((prev) => prev.filter((img) => img.id !== deleteImageTarget.id));
      toast.success('Đã gỡ ảnh triệu chứng khỏi bài viết.');
      setDeleteImageTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingImage(false);
    }
  };

  // ==================== SỬA BÀI ĐÃ LƯU ====================
  const loadArticleForEdit = async (url: string, keepForm = false) => {
    if (!isSafeHttpUrl(url)) {
      toast.error('Đường dẫn bài viết không hợp lệ (chỉ hỗ trợ http:// hoặc https://).');
      setEditUrl(null);
      setEditRows([]);
      return;
    }

    try {
      setEditLoading(true);
      const res = await apiClient.get<{ source_url: string; sources: KnowledgeSourceItem[] }>(
        '/knowledge/sources/by-url',
        { params: { url } }
      );
      const rows = res.data.sources || [];
      setEditRows(rows);
      setSelectedEditRowIds([]);
      setSummaryDrafts(Object.fromEntries(rows.filter((r) => !r.isVerbatim).map((r) => [r.id, r.evidenceText])));
      const canonicalUrl = isSafeHttpUrl(res.data.source_url) ? res.data.source_url.trim() : url.trim();
      setEditUrl(canonicalUrl);
      fetchArticleImages(canonicalUrl);
      const first = rows[0];
      if (first) {
        const rawOrg = first.organization || '';
        const { org: parsedOrg, author: parsedAuthor } = parseCombinedOrg(rawOrg);

        const rawDate = first.publishedDate && first.publishedDate !== 'Không ghi ngày' ? first.publishedDate : '';
        const { pubDate: parsedPubDate, upDate: parsedUpDate } = parseCombinedDate(rawDate);
        const detectedScope = inferSourceScope(canonicalUrl, first.organization, first.sourceScope);

        setEditOriginalMeta({
          plantName: first.plantName || '',
          diseaseName: first.diseaseName || '',
          modelClass: first.modelClass,
          title: first.sourceTitle,
          org: parsedOrg,
          author: parsedAuthor,
          pubDate: parsedPubDate,
          upDate: parsedUpDate,
          date: rawDate,
          sourceScope: detectedScope,
        });

        const distinctClasses = Array.from(new Set(rows.map((r) => r.modelClass).filter(Boolean)));
        setArticleTopics(distinctClasses.length > 0 ? distinctClasses : [first.modelClass]);

        if (!keepForm) {
          setIngestUrl(canonicalUrl);
          setIngestClass(first.modelClass);
          setSelectedPlant(first.plantName);
          setClassFromAi(false);
          setIngestTitle(first.sourceTitle);
          setIngestOrg(parsedOrg);
          setIngestAuthor(parsedAuthor);
          setIngestPublishedDate(parsedPubDate);
          setIngestUpdatedDate(parsedUpDate);
          setIngestDate(rawDate);
          setIngestSourceScope(detectedScope);
          setIngestText('');
          setIngestionResult(null);
          setSelectedParagraphs({});
          setEditSubTab('approved');
        }
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
      setEditUrl(null);
      setEditRows([]);
    } finally {
      setEditLoading(false);
    }
  };

  useEffect(() => {

    if (editParam) {
      loadArticleForEdit(editParam);
    } else if (editUrl) {
      exitEditMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editParam]);

  const exitEditMode = (clearParam = true) => {
    setEditUrl(null);
    setEditRows([]);
    setSummaryDrafts({});
    setIngestUrl('');
    setIngestText('');
    setIngestTitle('');
    setIngestOrg('');
    setIngestAuthor('');
    setIngestPublishedDate('');
    setIngestUpdatedDate('');
    setIngestDate('');
    setIngestSourceScope('Việt Nam');
    setIngestClass('');
    setSelectedPlant('');
    setIngestionResult(null);
    setArticleImages([]);
    setSelectedParagraphs({});
    setEditSubTab('approved');
    setShowMetaEditPanel(false);
    if (clearParam) navigate('/admin/ingest', { replace: true });
  };

  const editMetaDirty = !!editUrl && (
    ingestClass !== editOriginalMeta.modelClass ||
    ingestTitle.trim() !== editOriginalMeta.title ||
    ingestOrg.trim() !== editOriginalMeta.org ||
    ingestAuthor.trim() !== editOriginalMeta.author ||
    ingestPublishedDate.trim() !== editOriginalMeta.pubDate ||
    ingestUpdatedDate.trim() !== editOriginalMeta.upDate ||
    ingestSourceScope !== editOriginalMeta.sourceScope
  );

  const saveEditedArticleMeta = async (silent = false): Promise<boolean> => {
    if (!editUrl) return true;
    if (articleTopics.length === 0 && !ingestClass) {
      toast.error('Chọn ít nhất một Chuyên mục / Bệnh hại cho bài viết trước khi lưu.');
      return false;
    }
    try {
      setEditSaving(true);
      const combinedOrg = buildCombinedOrg(ingestOrg, ingestAuthor);
      const combinedDate = buildCombinedDate(ingestPublishedDate, ingestUpdatedDate);
      const res = await apiClient.patch('/knowledge/sources/by-url', {
        source_url: editUrl,
        // Nếu bài viết có nhiều chuyên đề, không truyền model_class để giữ nguyên mã lớp riêng biệt của từng đoạn
        model_class: articleTopics.length === 1 ? articleTopics[0] : undefined,
        source_title: ingestTitle.trim(),
        organization: combinedOrg,
        published_date: combinedDate,
        source_scope: ingestSourceScope,
      });
      if (!silent) {
        toast.success(`Đã lưu thông tin bài cho ${res.data.updated_count} đoạn. Các đoạn này chuyển về "Chờ duyệt", vào Duyệt tri thức để duyệt lại.`);
      }
      await loadArticleForEdit(editUrl, true);
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    } finally {
      setEditSaving(false);
    }
  };

  // Duyệt hoặc bỏ duyệt trực tiếp từng đoạn trích
  const handleToggleApproveSingleSource = async (sourceId: string, currentStatus: boolean) => {
    try {
      const nextStatus = !currentStatus;
      await apiClient.patch(`/knowledge/sources/${sourceId}/approve`, {
        is_approved: nextStatus,
        reviewer_notes: nextStatus ? 'Admin phê duyệt qua màn hình chi tiết bài viết' : 'Admin bỏ duyệt',
      });
      toast.success(nextStatus ? 'Đã duyệt đoạn trích này.' : 'Đã bỏ duyệt đoạn trích này.');
      setEditRows((prev) => prev.map((r) => (r.id === sourceId ? { ...r, isManualApproved: nextStatus } : r)));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Xóa trực tiếp 1 đoạn trích trong bài đã lưu
  const handleDeleteSingleSource = async (sourceId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa đoạn trích này khỏi bài viết?')) return;
    try {
      await apiClient.delete(`/knowledge/sources/${sourceId}`);
      toast.success('Đã xóa đoạn trích.');
      setEditRows((prev) => prev.filter((r) => r.id !== sourceId));
      setSelectedEditRowIds((prev) => prev.filter((id) => id !== sourceId));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Xóa các đoạn trích đã chọn trong Tab 1
  const handleDeleteSelectedEditRows = async () => {
    if (selectedEditRowIds.length === 0) return;
    const count = selectedEditRowIds.length;
    const approvedCount = editRows.filter((r) => selectedEditRowIds.includes(r.id) && r.isManualApproved).length;
    const confirmMsg = approvedCount > 0
      ? `Bạn có chắc chắn muốn xóa ${count} đoạn trích đã chọn khỏi bài viết này?\n\n⚠️ Lưu ý: Trong đó có ${approvedCount} đoạn ĐÃ ĐƯỢC DUYỆT cũng sẽ bị xóa.\n\nThao tác này không thể hoàn tác.`
      : `Bạn có chắc chắn muốn xóa ${count} đoạn trích đã chọn khỏi bài viết này? Thao tác này không thể hoàn tác.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setDeletingAllEditRows(true);
      const targetIds = [...selectedEditRowIds];
      await apiClient.post('/knowledge/sources/batch-delete', targetIds);
      setEditRows((prev) => prev.filter((r) => !targetIds.includes(r.id)));
      setSelectedEditRowIds([]);
      toast.success(`Đã xóa ${count} đoạn trích đã chọn.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingAllEditRows(false);
    }
  };

  // Xóa toàn bộ các đoạn trích chưa duyệt trong Tab 1 (giữ nguyên các đoạn đã duyệt)
  const handleDeletePendingEditRows = async () => {
    const pendingIds = editRows.filter((r) => !r.isManualApproved).map((r) => r.id);
    if (pendingIds.length === 0) {
      toast.info('Tất cả các đoạn trích trong bài đều đã được duyệt.');
      return;
    }
    if (pendingIds.length === editRows.length) {
      // Mọi đoạn đều chờ duyệt (vd ngay sau "Lưu thông tin bài") → thao tác này sẽ xóa cả bài; không làm ngầm.
      toast.error('Tất cả các đoạn đều đang chờ duyệt — xóa sẽ mất cả bài. Hãy duyệt các đoạn muốn giữ trước; muốn bỏ cả bài thì dùng nút "Xóa bài" ở trang Duyệt tri thức.');
      return;
    }
    const count = pendingIds.length;
    const confirmMsg = `Bạn có chắc chắn muốn xóa toàn bộ ${count} đoạn trích CHƯA DUYỆT khỏi bài viết này?\n\nCác đoạn đã duyệt sẽ được giữ nguyên an toàn. Thao tác này không thể hoàn tác.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setDeletingAllEditRows(true);
      await apiClient.post('/knowledge/sources/batch-delete', pendingIds);
      setEditRows((prev) => prev.filter((r) => !pendingIds.includes(r.id)));
      setSelectedEditRowIds((prev) => prev.filter((id) => !pendingIds.includes(id)));
      toast.success(`Đã xóa ${count} đoạn trích chưa duyệt. Các đoạn đã duyệt vẫn được giữ nguyên an toàn.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingAllEditRows(false);
    }
  };

  // Duyệt hoặc bỏ duyệt các đoạn trích đã chọn trong Tab 1
  const handleApproveSelectedEditRows = async (targetApprovedStatus: boolean) => {
    if (selectedEditRowIds.length === 0) return;
    try {
      await apiClient.patch('/knowledge/sources/approve-batch', {
        source_ids: selectedEditRowIds,
        is_approved: targetApprovedStatus,
        reviewer_notes: targetApprovedStatus ? 'Duyệt các đoạn đã chọn từ trang chi tiết bài viết' : 'Bỏ duyệt các đoạn đã chọn',
      });
      setEditRows((prev) =>
        prev.map((r) => (selectedEditRowIds.includes(r.id) ? { ...r, isManualApproved: targetApprovedStatus } : r))
      );
      toast.success(targetApprovedStatus ? `Đã duyệt ${selectedEditRowIds.length} đoạn đã chọn.` : `Đã bỏ duyệt ${selectedEditRowIds.length} đoạn đã chọn.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };



  const updateSavedUnit = async (row: KnowledgeSourceItem, body: { unit_type?: string; evidence_text?: string; model_class?: string }) => {
    try {
      setEditSaving(true);
      const res = await apiClient.patch(`/knowledge/sources/${row.id}`, body);
      if (res.data.reindex_status !== 'skipped') {
        toast.success('Đã lưu thay đổi cho đoạn trích.');
      }
      if (editUrl) await loadArticleForEdit(editUrl, true);
      setShowMetaEditPanel(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setEditSaving(false);
    }
  };

  const collapseWs = (t: string) => t.replace(/\s+/g, ' ').trim();
  const savedVerbatimTexts = React.useMemo(
    () => new Set(editRows.filter((r) => r.isVerbatim).map((r) => collapseWs(r.evidenceText))),
    [editRows]
  );
  const existingVerbatimCount = editRows.filter((r) => r.isVerbatim).length;
  const existingVerbatimChars = editRows.filter((r) => r.isVerbatim).reduce((a, r) => a + r.evidenceText.length, 0);

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
      const normalizedArticleText = coalesceArticleParagraphs(ingestText.trim());
      const res = await apiClient.post<IngestionResponse>('/knowledge/ingestions', {
        model_class: ingestClass || undefined,
        source_url: ingestUrl.trim(),
        // Tiêu đề/cơ quan/năm luôn để AI đọc lại từ bài đang dán; Admin sửa ở bước 2
        article_text: normalizedArticleText || ingestText.trim(),
      }, { timeout: 45000 });

      // Kết hợp bóc tách theo Key từ văn bản (Publication date, Reviewed/Revised, Authors, Cơ quan...) với gợi ý từ AI
      const keyMeta = extractKeyMetadataFromText(ingestText, editUrl || ingestUrl);
      const rawMeta = res.data.suggested_metadata;
      const aiOrg = parseCombinedOrg(rawMeta?.organization);
      const aiDate = parseCombinedDate(rawMeta?.published_date);

      const resolvedTitle = rawMeta?.source_title?.trim() || '';
      const resolvedOrg = keyMeta.organization || aiOrg.org;
      const resolvedAuthor = keyMeta.author || aiOrg.author;
      const resolvedPubDate = keyMeta.publishedDate || aiDate.pubDate;
      const resolvedUpDate = keyMeta.updatedDate || aiDate.upDate;

      const combinedSuggestedOrg = buildCombinedOrg(resolvedOrg, resolvedAuthor);
      const combinedSuggestedDate = buildCombinedDate(resolvedPubDate, resolvedUpDate);
      const aiSuggestedClass = rawMeta?.model_class || null;

      const mergedMeta: SuggestedMetadata | null =
        rawMeta || resolvedOrg || resolvedAuthor || resolvedPubDate || resolvedUpDate
          ? {
            model_class: aiSuggestedClass,
            source_title: resolvedTitle || null,
            organization: combinedSuggestedOrg || null,
            published_date: combinedSuggestedDate || null,
          }
          : null;

      // Ẩn dòng siêu dữ liệu đơn (< 40 ký tự, Cơ quan:, Ngày đăng:) và dòng tiêu đề mở đầu (# Title) khỏi danh sách thẻ trích dẫn
      const filteredParagraphs = res.data.paragraphs.filter((p, idx) => {
        const trimmed = p.text.trim();
        if (trimmed.length < 40) return false;
        if (isStandaloneMetadataLine(trimmed)) return false;
        if (/^#\s+\S/.test(trimmed) && !trimmed.includes('\n')) return false;
        if (idx === 0 && p.suggested_unit_type === null && trimmed.length < 120 && !/[.!?;]$/.test(trimmed)) {
          return false;
        }
        return true;
      });
      const finalParagraphs = filteredParagraphs.length > 0 ? filteredParagraphs : res.data.paragraphs;

      setIngestionResult({
        ...res.data,
        paragraphs: finalParagraphs,
        suggested_metadata: mergedMeta,
      });
      setDismissedAiFields({});
      setActiveAiPopoverField(null);
      setIsMetaCardCollapsed(false);

      if (aiSuggestedClass) {
        setArticleTopics((prev) => (prev.includes(aiSuggestedClass) ? prev : [...prev, aiSuggestedClass]));
      }

      // Đang sửa bài đã lưu thì giữ thông tin đã lưu (hiển thị diff cho Admin duyệt),
      // đồng thời tự điền nếu ô Tác giả hoặc Ngày cập nhật hiện đang để trống.
      if (editUrl) {
        setDismissMetaDiff(false);
        if (!ingestAuthor.trim() && resolvedAuthor) {
          setIngestAuthor(resolvedAuthor);
        }
        if (!ingestUpdatedDate.trim() && resolvedUpDate) {
          setIngestUpdatedDate(resolvedUpDate);
        }
      } else if (!mergedMeta) {
        setIngestTitle('');
        setIngestOrg('');
        setIngestAuthor('');
        setIngestPublishedDate('');
        setIngestUpdatedDate('');
        setIngestDate('');
        setIngestSourceScope(inferSourceScope(ingestUrl, '', null));
      } else {
        setIngestTitle(resolvedTitle);
        setIngestOrg(resolvedOrg);
        setIngestAuthor(resolvedAuthor);
        setIngestPublishedDate(resolvedPubDate);
        setIngestUpdatedDate(resolvedUpDate);
        setIngestSourceScope(inferSourceScope(ingestUrl, resolvedOrg, null));
        if (aiSuggestedClass) {
          if (aiSuggestedClass !== ingestClass) setClassFromAi(true);
          setIngestClass(aiSuggestedClass);
          const found = diseases.find((d) => d.classCode === aiSuggestedClass);
          if (found) {
            setSelectedPlant(found.plantName);
          }
        }
      }

      // Khởi tạo state chọn đoạn: MẶC ĐỊNH KHÔNG TICK ĐOẠN NÀO ĐỂ ADMIN ĐỌC VÀ CHỦ ĐỘNG DUYỆT (Mục 10)
      const defaultClassForNewParas = aiSuggestedClass || (articleTopics[0] || ingestClass);
      const initialMap: Record<string, { selected: boolean; unitType: string; diseaseClass?: string }> = {};

      finalParagraphs.forEach((p) => {
        const isFaqOrSummary =
          /^(câu\s*hỏi|thắc\s*mắc|faq|tóm\s*lại|tổng\s*kết|lời\s*kết)\b/i.test(p.text.trim()) ||
          /(câu\s*hỏi\s*thường\s*gặp|hỏi\s*đáp)/i.test(p.text) ||
          (/\?[\s\S]*\?/.test(p.text) && /(bệnh|cây|trị|phòng|thuốc)/i.test(p.text));

        initialMap[p.id] = {
          selected: false,
          unitType: p.suggested_unit_type || (isFaqOrSummary ? 'SUMMARY' : 'SYMPTOMS'),
          diseaseClass: defaultClassForNewParas,
        };
      });

      setSelectedParagraphs(initialMap);
      toast.success(
        res.data.ai_suggestion_available
          ? `Tách thành công ${finalParagraphs.length} đoạn. AI đã gợi ý nhãn và thông tin bài.`
          : `Tách thành công ${finalParagraphs.length} đoạn, nhưng AI đang quá tải nên chưa gợi ý nhãn. Bạn tự chọn đoạn và nhãn, hoặc bấm Tách đoạn lại sau ít phút.`
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIngesting(false);
    }
  };

  // ==================== TÁCH ĐOẠN & QUẢN LÝ MENTIONS (HITL INGESTION) ====================
  const autoSplitText = (fullText: string): { part1: string; part2: string } => {
    const text = fullText.trim();
    const mid = Math.floor(text.length / 2);

    // 1. Tìm các điểm kết thúc câu gần điểm giữa nhất (. \n ? !)
    const sentenceRegex = /([.?!]\s+|\r?\n\s*)/g;
    let match: RegExpExecArray | null;
    let bestIndex = -1;
    let minDiff = Infinity;

    while ((match = sentenceRegex.exec(text)) !== null) {
      const cut = match.index + match[1].length;
      const len1 = cut;
      const len2 = text.length - cut;
      if (len1 >= 30 && len2 >= 30 && len1 <= MAX_SNIPPET_CHARS && len2 <= MAX_SNIPPET_CHARS) {
        const diff = Math.abs(cut - mid);
        if (diff < minDiff) {
          minDiff = diff;
          bestIndex = cut;
        }
      }
    }

    // 2. Nếu không tìm được dấu ngắt câu thỏa mãn, tìm dấu phẩy, chấm phẩy hoặc khoảng trắng
    if (bestIndex === -1) {
      const clauseRegex = /([,;]\s+|\s+)/g;
      while ((match = clauseRegex.exec(text)) !== null) {
        const cut = match.index + match[1].length;
        const len1 = cut;
        const len2 = text.length - cut;
        if (len1 >= 30 && len2 >= 30 && len1 <= MAX_SNIPPET_CHARS && len2 <= MAX_SNIPPET_CHARS) {
          const diff = Math.abs(cut - mid);
          if (diff < minDiff) {
            minDiff = diff;
            bestIndex = cut;
          }
        }
      }
    }

    if (bestIndex !== -1) {
      return {
        part1: text.substring(0, bestIndex).trim(),
        part2: text.substring(bestIndex).trim(),
      };
    }

    // 3. Fallback: ngắt tại điểm an toàn <= MAX_SNIPPET_CHARS
    const safeCut = Math.min(Math.max(mid, 30), MAX_SNIPPET_CHARS);
    return {
      part1: text.substring(0, safeCut).trim(),
      part2: text.substring(safeCut).trim(),
    };
  };

  const computeSplitParts = (text: string, cutIndices: number[]): string[] => {
    const regex = /[^.!?;\r\n]+(?:[.!?;\r\n]+|$)/g;
    const rawMatches = text.match(regex);
    const rawSents = rawMatches ? rawMatches.filter((s) => s.trim().length > 0) : [text];
    if (rawSents.length <= 1 || cutIndices.length === 0) {
      return [text];
    }
    const sortedCuts = [...new Set(cutIndices)]
      .filter((idx) => idx >= 0 && idx < rawSents.length - 1)
      .sort((a, b) => a - b);
    if (sortedCuts.length === 0) return [text];

    const parts: string[] = [];
    let currentPartSents: string[] = [];

    for (let i = 0; i < rawSents.length; i++) {
      currentPartSents.push(rawSents[i]);
      if (sortedCuts.includes(i) || i === rawSents.length - 1) {
        parts.push(currentPartSents.join('').trim());
        currentPartSents = [];
      }
    }
    return parts.filter(Boolean);
  };

  const handleOpenSplitModal = (para: ParagraphItem) => {
    setSplitTargetSavedRow(null);
    setSplitTargetPara(para);
    const { part1, part2 } = autoSplitText(para.text);
    setSplitPart1(part1);
    setSplitPart2(part2);

    const regex = /[^.!?;\r\n]+(?:[.!?;\r\n]+|$)/g;
    const matches = para.text.match(regex);
    const sents = matches ? matches.map((s) => s.trim()).filter(Boolean) : [para.text];

    let bestIdx = 0;
    let accumulated = '';
    for (let i = 0; i < sents.length - 1; i++) {
      accumulated = (accumulated ? accumulated + ' ' : '') + sents[i];
      if (accumulated.trim().length <= part1.length) {
        bestIdx = i;
      }
    }
    setSelectedCutIndex(bestIdx);
    setSelectedCutIndices(sents.length > 1 ? [bestIdx] : []);
    setSplitModalOpen(true);
  };

  const handleOpenSplitModalForSaved = (row: KnowledgeSourceItem) => {
    setSplitTargetPara(null);
    setSplitTargetSavedRow(row);
    const { part1, part2 } = autoSplitText(row.evidenceText);
    setSplitPart1(part1);
    setSplitPart2(part2);

    const regex = /[^.!?;\r\n]+(?:[.!?;\r\n]+|$)/g;
    const matches = row.evidenceText.match(regex);
    const sents = matches ? matches.map((s) => s.trim()).filter(Boolean) : [row.evidenceText];

    let bestIdx = 0;
    let accumulated = '';
    for (let i = 0; i < sents.length - 1; i++) {
      accumulated = (accumulated ? accumulated + ' ' : '') + sents[i];
      if (accumulated.trim().length <= part1.length) {
        bestIdx = i;
      }
    }
    setSelectedCutIndex(bestIdx);
    setSelectedCutIndices(sents.length > 1 ? [bestIdx] : []);
    setSplitModalOpen(true);
  };

  const handleConfirmSplit = async () => {
    // Trường hợp 1: Tách đoạn đã lưu trong CSDL (Tab 1)
    if (splitTargetSavedRow) {
      const parts = computeSplitParts(splitTargetSavedRow.evidenceText, selectedCutIndices);
      if (parts.length < 2) {
        toast.error('Vui lòng chọn ít nhất 1 mốc ngắt câu để chia đoạn.');
        return;
      }
      const hasInvalid = parts.some((p) => p.length < 20 || p.length > MAX_SNIPPET_CHARS);
      if (hasInvalid) {
        toast.error(`Mỗi đoạn con sau khi chia phải có từ 20 đến ${MAX_SNIPPET_CHARS.toLocaleString('vi-VN')} ký tự.`);
        return;
      }
      try {
        setEditSaving(true);
        try {
          await apiClient.post(`/knowledge/sources/${splitTargetSavedRow.id}/split`, { parts });
        } catch (apiErr: any) {
          // Fallback tự động nếu backend server chưa deploy endpoint /split (trả về 404)
          if (apiErr?.response?.status === 404) {
            // 1. Tạo các đoạn con mới từ part 1..k
            for (let i = 1; i < parts.length; i++) {
              await apiClient.post('/knowledge/sources', {
                modelClass: splitTargetSavedRow.modelClass,
                sourceUrl: splitTargetSavedRow.sourceUrl,
                sourceTitle: splitTargetSavedRow.sourceTitle,
                organization: splitTargetSavedRow.organization,
                publishedDate: splitTargetSavedRow.publishedDate,
                sourceScope: splitTargetSavedRow.sourceScope,
                evidenceText: parts[i],
                contentType: splitTargetSavedRow.contentType,
                isManualApproved: false,
                reviewerNotes: 'Tách từ đoạn gốc',
              });
            }

            // 2. Thử cập nhật Part 0 cho đoạn gốc, nếu server cũ chặn sửa nguyên văn thì tạo Part 0 mới và xóa đoạn gốc
            let part0Updated = false;
            try {
              await apiClient.patch(`/knowledge/sources/${splitTargetSavedRow.id}`, {
                evidence_text: parts[0],
              });
              part0Updated = true;
            } catch {
              await apiClient.post('/knowledge/sources', {
                modelClass: splitTargetSavedRow.modelClass,
                sourceUrl: splitTargetSavedRow.sourceUrl,
                sourceTitle: splitTargetSavedRow.sourceTitle,
                organization: splitTargetSavedRow.organization,
                publishedDate: splitTargetSavedRow.publishedDate,
                sourceScope: splitTargetSavedRow.sourceScope,
                evidenceText: parts[0],
                contentType: splitTargetSavedRow.contentType,
                isManualApproved: false,
                reviewerNotes: 'Tách từ đoạn gốc (phần 1)',
              });
              await apiClient.delete(`/knowledge/sources/${splitTargetSavedRow.id}`);
              part0Updated = true;
            }
          } else {
            throw apiErr;
          }
        }
        toast.success(`Đã tách thành công thành ${parts.length} đoạn!`);
        setSplitModalOpen(false);
        setSplitTargetSavedRow(null);
        if (editUrl) await loadArticleForEdit(editUrl, true);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setEditSaving(false);
      }
      return;
    }

    // Trường hợp 2: Tách đoạn xem trước khi nhập bài mới (Tab 2 / Ingestion Preview)
    if (!splitTargetPara || !ingestionResult) return;
    const parts = computeSplitParts(splitTargetPara.text, selectedCutIndices);
    if (parts.length < 2) {
      toast.error('Vui lòng chọn ít nhất 1 mốc ngắt câu để chia đoạn.');
      return;
    }

    const hasInvalid = parts.some((p) => p.length < 30 || p.length > MAX_SNIPPET_CHARS);
    if (hasInvalid) {
      toast.error(`Mỗi đoạn con sau khi chia phải có từ 30 đến ${MAX_SNIPPET_CHARS.toLocaleString('vi-VN')} ký tự.`);
      return;
    }

    const baseId = splitTargetPara.id;
    const newParas: ParagraphItem[] = parts.map((partText, idx) => {
      const partMentions = (splitTargetPara.mentions || []).filter((m) =>
        partText.toLowerCase().includes(m.text.toLowerCase())
      );
      return {
        id: `${baseId}_${idx + 1}`,
        text: partText,
        suggested_unit_type: splitTargetPara.suggested_unit_type,
        mentions: partMentions,
      };
    });

    const updatedParagraphs = ingestionResult.paragraphs.flatMap((p) =>
      p.id === baseId ? newParas : [p]
    );

    setIngestionResult({
      ...ingestionResult,
      paragraphs: updatedParagraphs,
    });

    setSelectedParagraphs((prev) => {
      const next = { ...prev };
      const currentClass = prev[baseId]?.diseaseClass || ingestClass;
      delete next[baseId];
      newParas.forEach((np) => {
        const isFaqOrSummary =
          /^(câu\s*hỏi|thắc\s*mắc|faq|tóm\s*lại|tổng\s*kết|lời\s*kết)\b/i.test(np.text.trim()) ||
          /(câu\s*hỏi\s*thường\s*gặp|hỏi\s*đáp)/i.test(np.text) ||
          (/\?[\s\S]*\?/.test(np.text) && /(bệnh|cây|trị|phòng|thuốc)/i.test(np.text));

        next[np.id] = {
          selected: false,
          unitType: splitTargetPara.suggested_unit_type || (isFaqOrSummary ? 'SUMMARY' : 'SYMPTOMS'),
          diseaseClass: currentClass,
        };
      });
      return next;
    });

    setSplitModalOpen(false);
    setSplitTargetPara(null);
    setSelectedCutIndices([]);
    toast.success(`Đã chia đoạn ${baseId} thành ${newParas.length} đoạn hợp lệ (mỗi đoạn ≤ ${MAX_SNIPPET_CHARS.toLocaleString('vi-VN')} ký tự).`);
  };

  const handleSelectAllAiSuggested = () => {
    if (!ingestionResult) return;

    let availableSlots = 30 - existingVerbatimCount;
    if (availableSlots <= 0) {
      toast.error(`Bài viết đã có ${existingVerbatimCount} đoạn lưu trữ, đã đạt giới hạn tối đa 30 đoạn.`);
      return;
    }

    let newlySelectedCount = 0;
    setSelectedParagraphs((prev) => {
      const next = { ...prev };
      for (const para of ingestionResult.paragraphs) {
        const isSaved = savedVerbatimTexts.has(collapseWs(para.text));
        const isTooLong = para.text.length > MAX_SNIPPET_CHARS;
        const isAiSuggested = !!para.suggested_unit_type;

        if (isAiSuggested && !isSaved && !isTooLong) {
          if (!next[para.id]?.selected) {
            if (newlySelectedCount < availableSlots) {
              next[para.id] = {
                ...(next[para.id] || {}),
                selected: true,
                unitType: para.suggested_unit_type || 'SYMPTOMS',
                diseaseClass: next[para.id]?.diseaseClass || ingestClass,
              };
              newlySelectedCount++;
            }
          }
        }
      }
      return next;
    });

    if (newlySelectedCount > 0) {
      toast.success(`Đã tự động tick chọn ${newlySelectedCount} đoạn theo gợi ý của AI.`);
    } else {
      toast.info('Không có thêm đoạn AI gợi ý hợp lệ nào để chọn.');
    }
  };

  const handleRemoveMention = (paraId: string, mentionIndex: number) => {
    if (!ingestionResult) return;
    setIngestionResult({
      ...ingestionResult,
      paragraphs: ingestionResult.paragraphs.map((p) => {
        if (p.id !== paraId) return p;
        const updatedMentions = (p.mentions || []).filter((_, idx) => idx !== mentionIndex);
        return { ...p, mentions: updatedMentions };
      }),
    });
  };

  const handleChangeMentionKind = (paraId: string, mentionIndex: number, newKind: string) => {
    if (!ingestionResult) return;
    setIngestionResult({
      ...ingestionResult,
      paragraphs: ingestionResult.paragraphs.map((p) => {
        if (p.id !== paraId) return p;
        const updatedMentions = (p.mentions || []).map((m, idx) =>
          idx === mentionIndex ? { ...m, kind: newKind } : m
        );
        return { ...p, mentions: updatedMentions };
      }),
    });
  };

  const handleAddMention = (paraId: string) => {
    if (!ingestionResult) return;
    const target = ingestionResult.paragraphs.find((p) => p.id === paraId);
    if (!target) return;

    const textToAdd = newMentionText.trim();
    if (textToAdd.length < 2) {
      toast.error('Cụm từ vật tư / hoạt chất phải có ít nhất 2 ký tự.');
      return;
    }
    if (!target.text.toLowerCase().includes(textToAdd.toLowerCase())) {
      toast.error('Cụm từ phải xuất hiện nguyên văn trong đoạn văn này (quy định Điều 25 Luật SHTT).');
      return;
    }

    if ((target.mentions || []).some((m) => m.text.toLowerCase() === textToAdd.toLowerCase())) {
      toast.error('Cụm từ này đã có trong danh sách thẻ.');
      return;
    }

    setIngestionResult({
      ...ingestionResult,
      paragraphs: ingestionResult.paragraphs.map((p) => {
        if (p.id !== paraId) return p;
        return {
          ...p,
          mentions: [...(p.mentions || []), { text: textToAdd, kind: newMentionKind }],
        };
      }),
    });

    setAddingMentionParaId(null);
    setNewMentionText('');
    setNewMentionKind('CHEMICAL');
    toast.success(`Đã thêm thẻ "${textToAdd}".`);
  };

  const handleCommitParagraphs = async () => {
    if (!ingestionResult) return;

    if (!ingestClass) {
      toast.error('Vui lòng chọn Cây trồng - Bệnh hại trước khi duyệt.');
      return;
    }

    const selections = Object.entries(selectedParagraphs)
      .filter(([_, val]) => val.selected)
      .map(([id, val]) => {
        const p = ingestionResult.paragraphs.find((x) => x.id === id);
        return {
          paragraph_id: id,
          unit_type: val.unitType,
          custom_text: p?.text,
          mentions: p?.mentions || [],
          model_class: val.diseaseClass || ingestClass,
        };
      });

    if (selections.length === 0) {
      toast.error('Vui lòng tick chọn ít nhất 1 đoạn nguyên văn để phê duyệt.');
      return;
    }

    if (selections.length + existingVerbatimCount > 30) {
      toast.error(existingVerbatimCount > 0
        ? `Bài này đã lưu ${existingVerbatimCount} đoạn nguyên văn; mỗi bài tối đa 30 đoạn (mở rộng phục vụ đồ án).`
        : 'Mỗi bài viết được trích dẫn tối đa 30 đoạn nguyên văn (mở rộng phục vụ đồ án).');
      return;
    }

    const currentSelectedChars = Object.entries(selectedParagraphs)
      .filter(([_, v]) => v.selected)
      .reduce((acc, [id]) => {
        const p = ingestionResult.paragraphs.find((x) => x.id === id);
        return acc + (p?.text.length || 0);
      }, 0);

    const articleLen = ingestionResult.article_length || ingestText.length || 1;
    const allowedQuota = Math.max(20000, Math.floor(articleLen * 0.90));

    if (currentSelectedChars + existingVerbatimChars > allowedQuota) {
      toast.error(`Tổng số ký tự các đoạn đã chọn (${currentSelectedChars.toLocaleString('vi-VN')}) vượt quá giới hạn trích dẫn (${allowedQuota.toLocaleString('vi-VN')} ký tự, tối đa 90% bài hoặc tối thiểu 20.000 ký tự theo cấu hình mở rộng đồ án).`);
      return;
    }

    // Đang sửa bài: lưu thông tin bài trước để đoạn cũ và đoạn mới cùng tiêu đề/bệnh
    if (editMetaDirty && !(await saveEditedArticleMeta(true))) return;

    try {
      setCommitting(true);
      const combinedOrg = buildCombinedOrg(ingestOrg, ingestAuthor) || 'Trung tâm Khuyến nông';
      const combinedDate = buildCombinedDate(ingestPublishedDate, ingestUpdatedDate) || 'Không ghi ngày';

      const res = await apiClient.post(`/knowledge/ingestions/${ingestionResult.ingestion_id}/commit`, {
        model_class: ingestClass,
        source_title: ingestTitle.trim() || 'Bài báo khuyến nông',
        organization: combinedOrg,
        published_date: combinedDate,
        source_scope: ingestSourceScope,
        selections,
        reviewer_notes: commitNotes.trim(),
      });

      const syncStatusText = res.data.reindex_status === 'accepted'
        ? 'Đang đồng bộ vào bộ nhớ AI Lavi'
        : (res.data.reindex_status === 'failed' ? 'Lỗi kết nối đồng bộ' : res.data.reindex_status);
      toast.success(
        `Đã lưu và duyệt ${res.data.created_source_ids?.length || selections.length} đoạn nguyên văn vào CSDL (${syncStatusText}).`
      );

      if (editUrl) {
        // Ở lại chế độ sửa, nạp lại danh sách đoạn đã lưu và chuyển sang Tab 1
        setIngestionResult(null);
        setArticleImages([]);
    setSelectedParagraphs({});
        setIngestText('');
        setEditSubTab('approved');
        await loadArticleForEdit(editUrl, true);
        return;
      }

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
  const allowedCharsQuota = Math.max(20000, Math.floor(articleLength * 0.90));
  // Hạn mức 30 đoạn / 20.000 ký tự tính cộng dồn với các đoạn nguyên văn đã lưu của cùng URL (Core cũng kiểm tra)
  const countWithSaved = countSelected + existingVerbatimCount;
  const charsWithSaved = totalSelectedChars + existingVerbatimChars;

  // Highlight cụm từ trích xuất (mention tag) & định dạng bold Markdown inline (**...**)
  const applyMentionHighlight = (plainText: string, paraId: string | null) => {
    if (!paraId || !highlightedMention || highlightedMention.paraId !== paraId || !highlightedMention.text.trim()) {
      return plainText;
    }
    const term = highlightedMention.text.trim();
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = plainText.split(regex);
    if (parts.length === 1) return plainText;

    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === term.toLowerCase() ? (
            <mark
              key={i}
              className="bg-amber-300 text-stone-900 font-bold px-1 py-0.5 rounded shadow-xs"
              title={`Cụm từ trích xuất: "${term}"`}
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const renderInlineMarkdownWithHighlight = (line: string, paraId: string | null) => {
    // Xóa triệt để mọi dấu thăng Markdown thừa (ví dụ "### " hay "## ") lọt vào nội dung chữ
    const cleanedLine = line.replace(/(?:^|\s)#{1,6}\s+/g, ' ');
    const boldSegments = cleanedLine.split(/(\*\*[^*\n]+\*\*)/g);
    return (
      <>
        {boldSegments.map((seg, idx) => {
          if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
            return (
              <strong key={idx} className="font-semibold text-foreground not-italic">
                {applyMentionHighlight(seg.slice(2, -2), paraId)}
              </strong>
            );
          }
          // Dọn sạch mọi ký tự ** mồ côi nếu có trong phân đoạn chữ thường
          const plainText = seg.replace(/\*\*/g, '');
          if (!plainText) return null;
          return <React.Fragment key={idx}>{applyMentionHighlight(plainText, paraId)}</React.Fragment>;
        })}
      </>
    );
  };

  // Hàm tách đoạn văn thành các dòng hiển thị thông minh, tự động nhận diện gạch đầu dòng, câu hỏi FAQ và tiêu đề dính liền
  const splitTextIntoDisplayLines = (text: string): string[] => {
    if (!text) return [];
    let normalized = text;
    // 0. Tách khi gặp ký hiệu heading Markdown (###, ##, #) bị dính sau dấu câu hoặc khoảng trắng
    // Ví dụ: "...cà chua: ### Biện pháp sinh học:..." hoặc "...hóa học: ## Khi bệnh phát triển..."
    normalized = normalized.replace(/([.:?!;]|\s)\s*(#{1,6}\s+)/g, '$1\n$2');
    normalized = normalized.replace(/(#{1,6}\s+[^:\n]{3,80}:)\s*([A-ZÀ-Ỹ])/g, '$1\n$2');

    // 0a. Chuẩn hóa double bullets "- - ", "• - ", "- • " thành 1 bullet duy nhất "- "
    normalized = normalized.replace(/(^|[\n\r])\s*(?:[-•*+]\s+)+([-•*+]\s+)/g, '$1$2');

    // 0b. Tách tiêu đề mục kết thúc bằng dấu hai chấm khi dính liền với câu hỏi in đậm (**Câu hỏi?**)
    normalized = normalized.replace(/(^|[\n\r])([^:\n\-•*+]{5,90}:)\s*(\*{1,2}[A-ZÀ-Ỹ0-9])/g, '$1$2\n$3');

    // 1. Sau bất kỳ dấu hỏi chấm (?) nào kèm đóng ngoặc kép/sao (**, *, ") -> Ngắt dòng ngay
    // Đảm bảo không bao giờ cắt lìa dấu đóng in đậm ** hoặc làm câu trả lời bị dính chung một dòng với câu hỏi
    normalized = normalized.replace(/\?(\*{1,2}|_{1,2}|["'”’])?\s*/g, '?$1\n');

    // 2. Trước bất kỳ câu hỏi nào kết thúc bằng (?) -> Tách dòng khỏi câu dẫn hoặc câu trả lời phía trước
    normalized = normalized.replace(/([.:!;])\s*(?=(?:\*{1,2}|_{1,2})?[^?\n]{3,150}\?)/g, '$1\n');

    // 3. Tách các gạch đầu dòng / bullet / số thứ tự bị dính liền vào cùng dòng
    // Ví dụ: "...hằng ngày. - Chọn giống..." hoặc "...hằng ngày. • Làm đất..." hoặc "...đầu. + Luân canh..."
    normalized = normalized.replace(/([.:?!;])\s*([-•*+]\s+)/g, '$1\n$2');
    normalized = normalized.replace(/([.:?!;])\s*(\d+[.)/]\s+)/g, '$1\n$2');

    // 4. Tách mũi tên / gạch trả lời FAQ: "--> Thường phát triển..." hoặc "-> Chủ yếu..."
    normalized = normalized.replace(/([.:?!;?])\s*(-->|->|=>)\s*/g, '$1\n$2 ');

    // 5. Tách tiêu đề mục kết thúc bằng dấu hai chấm (chỉ khi không phải gạch đầu dòng)
    normalized = normalized.replace(/(^|[\n\r])([^:\n\-•*+]{5,90}:)\s*([A-ZÀ-Ỹ0-9])/g, '$1$2\n$3');

    // 6. Tách đoạn kết bài / chuyển ý / lời khuyên kết luận
    normalized = normalized.replace(/([.:?!])\s+(Qua bài viết|Tổng kết|Tóm lại|Lời kết|Như vậy|Để lựa chọn|Bệnh [^.:\n]{3,50} là một trong những|Nơi cung cấp)\b/gi, '$1\n$2');

    // Kiểm tra xem đoạn văn có dãy số thứ tự nối tiếp nhau hay không (ví dụ có 1. và 2., hoặc 2. và 3.)
    const findNumbers = (str: string): number[] => {
      const matches = str.match(/(?:^|[\n\r]|\s)(\d+)[.)/]\s+[A-ZÀ-Ỹ]/g) || [];
      return matches.map((m) => parseInt(m.replace(/\D/g, ''), 10)).filter((n) => !isNaN(n));
    };
    const seqNums = findNumbers(normalized);
    const hasSequentialNumbers = seqNums.some((num, i) => i > 0 && num === seqNums[i - 1] + 1);

    return normalized
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => {
        if (!l || /^(\*{1,3}|_{1,3})$/.test(l)) return false;
        // Bỏ hoàn toàn các dòng chỉ chứa số thứ tự đơn lẻ: '1.', '2.', '3.', '4.', '1.1', '1/', 'a.', '• 4.', '**4.**'
        if (isPureNumberMarker(l)) return false;
        return true;
      })
      .map((l) => {
        let cleaned = l;
        // Chuẩn hóa gạch đầu dòng kép lặp lại: "• - " hoặc "- - " hoặc "- – " -> "- "
        cleaned = cleaned.replace(/^(?:[-•*+–—]\s+)+([-•*+–—]\s+)/, '$1');
        cleaned = cleaned.replace(/^[-•*+–—]\s+[-•*+–—]\s+/, '- ');

        // Bỏ số thứ tự trước câu hỏi FAQ (ví dụ: "1. Bệnh thường xuất hiện khi nào?" -> "Bệnh thường xuất hiện khi nào?")
        if (cleaned.endsWith('?') || /\?\s*$/.test(cleaned)) {
          cleaned = cleaned.replace(/^(?:\*{1,2})?(?:(?:\d+(?:\.\d+)*|[a-zđ])[.)/]\s*|(?:câu|hỏi)\s*\d+[:.]\s*)(?:\*{1,2})?/i, '');
        } else if (!hasSequentialNumbers) {
          // Nếu cả đoạn trích không có danh sách số thứ tự liên tiếp (như 1. rồi 2.):
          // Loại bỏ tiền tố số mồ côi (1., 4., 1.1) ở đầu đề mục để đoạn trích tự nhiên, ví dụ: "4. Biện pháp phòng trừ..." -> "Biện pháp phòng trừ..."
          cleaned = cleaned.replace(/^((?:[-•*+–—]\s+)?)(?:\*{1,2})?(?:\d+(?:\.\d+)*|[a-zđ])[.)/]\s+(?:\*{1,2})?([A-ZÀ-Ỹ])/i, '$1$2');
        }
        return cleaned.trim();
      })
      .filter((l) => Boolean(l) && !isPureNumberMarker(l));
  };

  // Huy hiệu hiển thị loại nội dung đoạn trích thân thiện và trực quan
  const renderUnitTypeBadge = (unitType?: string) => {
    const norm = (unitType || 'SYMPTOMS').toUpperCase();
    switch (norm) {
      case 'PREVENTION':
        return (
          <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            Phòng ngừa
          </span>
        );
      case 'CAUSE_CONDITIONS':
        return (
          <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            Nguyên nhân & ĐK
          </span>
        );
      case 'SYMPTOMS':
        return (
          <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            Triệu chứng
          </span>
        );
      case 'TREATMENT':
        return (
          <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Điều trị / Trị bệnh
          </span>
        );
      case 'SUMMARY':
        return (
          <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            Tổng quan / FAQ
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border font-mono">
            {norm}
          </span>
        );
    }
  };

  // Hiển thị đoạn văn chuẩn cấu trúc (tiêu đề mục, gạch đầu dòng, chữ in đậm) và hỗ trợ highlight cụm từ
  const renderParagraphWithHighlight = (paraId: string, text: string) => {
    const lines = splitTextIntoDisplayLines(text);
    return (
      <div className="space-y-1">
        {lines.map((rawLine, idx) => {
          const trimmed = rawLine.trim();
          if (!trimmed || /^(\*{1,3}|_{1,3})$/.test(trimmed)) return null;
          if (isPureNumberMarker(trimmed)) return null;

          // 1. Heading cấp 1 (# Tiêu đề)
          const h1Match = trimmed.match(/^#\s+(.+)$/);
          if (h1Match) {
            const h1Text = h1Match[1].replace(/^(?:(?:\d+|[IVX]+|[a-zđ])[.)/]\s*)+/i, '').trim();
            return (
              <h4 key={idx} className="font-bold text-emerald-950 text-sm mb-1 pb-1 border-b border-emerald-100">
                {renderInlineMarkdownWithHighlight(h1Text, paraId)}
              </h4>
            );
          }

          // 2. Heading cấp 2-6 (## Tiêu đề con)
          const headingMatch = trimmed.match(/^#{2,6}\s+(.+)$/);
          if (headingMatch) {
            const hText = headingMatch[1].replace(/^(?:(?:\d+|[IVX]+|[a-zđ])[.)/]\s*)+/i, '').trim();
            return (
              <h5 key={idx} className="font-bold text-emerald-900 text-xs sm:text-[13px] mt-2 mb-1">
                {renderInlineMarkdownWithHighlight(hText, paraId)}
              </h5>
            );
          }

          // 3. Thẻ danh mục trong ngoặc vuông: "[Kỹ thuật canh tác & chăm sóc]: Hướng dẫn..."
          const tagMatch = trimmed.match(/^(\[[^\]\n]+\]:?)\s*(.*)$/);
          if (tagMatch) {
            return (
              <div key={idx} className="my-1 text-xs text-foreground/90 leading-relaxed">
                <span className="inline-block font-semibold text-emerald-800 bg-emerald-100/70 border border-emerald-300/60 rounded px-1.5 py-0.5 mr-1.5 text-[11px]">
                  {tagMatch[1].replace(/:$/, '')}
                </span>
                <span>{renderInlineMarkdownWithHighlight(tagMatch[2], paraId)}</span>
              </div>
            );
          }

          // 4. Tiêu đề mục kết thúc bằng dấu hai chấm (kể cả khi có tiền tố gạch đầu dòng do parse HTML):
          const cleanHeadingText = trimmed.replace(/^[-•*+–—]\s+/, '').replace(/^(?:(?:\d+|[IVX]+|[a-zđ])[.)/]\s*)+/i, '').trim();
          const isSectionHeader = (
            /^[A-ZÀ-Ỹ][^.!?\n]{3,90}:$/.test(cleanHeadingText) ||
            /^(?:Biện pháp|Phòng trừ|Phòng ngừa|Điều trị|Cách trị|Triệu chứng|Dấu hiệu|Nguyên nhân|Đặc điểm|Tác hại|Điều kiện|Quy trình|Kỹ thuật|Lưu ý|Câu hỏi|Hướng dẫn)\b.*:$/i.test(cleanHeadingText)
          );
          if (isSectionHeader) {
            return (
              <div key={idx} className="font-bold text-emerald-900 text-xs sm:text-[13px] mt-2 mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                <span className="flex-1">{renderInlineMarkdownWithHighlight(cleanHeadingText, paraId)}</span>
              </div>
            );
          }

          // 4b. Câu hỏi FAQ kết thúc bằng dấu hỏi (?): "Bệnh có gây chết cây không?" hoặc "1. Bệnh thường xuất hiện khi nào?"
          const plainForCheck = trimmed.replace(/[*_#]/g, '').trim();
          const isQuestion = plainForCheck.endsWith('?') || /^(?:(?:\d+|[IVX]+|[a-zđ])[.)/]\s*)?[A-ZÀ-Ỹ][^.:\n]{3,120}\?$/.test(plainForCheck);
          if (isQuestion) {
            // Tách sạch các ký tự in đậm ** và số thứ tự 1., 2., Câu 1... bao bọc câu hỏi
            const displayQuestionText = trimmed
              .replace(/^\*{1,2}\s*/, '')
              .replace(/\s*\*{1,2}$/, '')
              .replace(/^(?:(?:\d+(?:\.\d+)*|[a-zđ])[.)/]\s*|(?:câu|hỏi)\s*\d+[:.]\s*)/i, '')
              .trim();
            return (
              <div key={idx} className="font-semibold text-emerald-950 text-xs sm:text-[13px] mt-2.5 mb-1 flex items-start gap-1.5 bg-emerald-50/80 dark:bg-emerald-950/20 px-2.5 py-1.5 rounded-md border border-emerald-200/80 shadow-2xs">
                <span className="font-bold text-emerald-800 text-[10px] bg-emerald-200/70 px-1.5 py-0.5 rounded shrink-0 mt-0.5">Hỏi</span>
                <span className="flex-1 text-emerald-900 font-medium">{renderInlineMarkdownWithHighlight(displayQuestionText, paraId)}</span>
              </div>
            );
          }

          // 5. Gạch đầu dòng / bullet / số thứ tự / mũi tên trả lời:
          const bulletMatch = trimmed.match(/^(?:[-•*+–—]|\d+[.)]|-->|->)\s+(.+)$/);
          if (bulletMatch) {
            let content = bulletMatch[1].trim();
            // Khử triệt để mọi dấu gạch đầu dòng, dấu trừ, en-dash, em-dash, bullet thừa còn sót lại ở đầu:
            content = content.replace(/^(?:[-•*+–—]\s*)+/, '').trim();
            if (!content || isPureNumberMarker(content)) return null;
            // Tách nhãn in đậm ở đầu gạch đầu dòng (ví dụ: "Chọn giống kháng bệnh: Ưu tiên...")
            const subLabelMatch = content.match(/^([A-ZÀ-Ỹa-zà-ỹ0-9\s/&,–-]+?:\s*)(.*)$/);
            if (subLabelMatch && !content.startsWith('**')) {
              return (
                <div key={idx} className="flex items-start gap-1.5 pl-2 my-1 text-xs text-foreground/90 leading-relaxed">
                  <span className="text-emerald-700 font-bold shrink-0 mt-0.5">•</span>
                  <span className="flex-1">
                    <strong className="font-semibold text-emerald-950">{subLabelMatch[1]}</strong>
                    {renderInlineMarkdownWithHighlight(subLabelMatch[2], paraId)}
                  </span>
                </div>
              );
            }
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-2 my-1 text-xs text-foreground/90 leading-relaxed">
                <span className="text-emerald-700 font-bold shrink-0 mt-0.5">•</span>
                <span className="flex-1">
                  {renderInlineMarkdownWithHighlight(content, paraId)}
                </span>
              </div>
            );
          }

          // 6. Dòng văn bản bình thường
          return (
            <p key={idx} className="my-1 text-xs text-foreground/90 leading-relaxed">
              {renderInlineMarkdownWithHighlight(trimmed, paraId)}
            </p>
          );
        })}
      </div>
    );
  };

  // Hiển thị toàn bộ bài báo ở chế độ Xem định dạng (Markdown Preview)
  const renderFormattedArticlePreview = (rawMarkdown: string) => {
    const blocks = rawMarkdown
      .split(/\r?\n\s*\r?\n/)
      .map((b) => b.trim())
      .filter(Boolean);

    return blocks.map((block, bIdx) => {
      const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const isSingleMetaBlock = lines.length === 1 && isStandaloneMetadataLine(lines[0]);
      if (isSingleMetaBlock) {
        return (
          <div
            key={bIdx}
            className="inline-flex items-center text-[11px] bg-muted/60 text-muted-foreground px-2 py-0.5 rounded border border-border/70 mr-1.5 mb-1 font-medium"
          >
            {lines[0].replace(/^(?:[#>*\-•+]+\s*)+/, '').replace(/\*\*/g, '')}
          </div>
        );
      }

      return (
        <div key={bIdx} className="space-y-1">
          {lines.map((line, lIdx) => {
            if (isStandaloneMetadataLine(line)) {
              return (
                <div
                  key={lIdx}
                  className="text-[11px] bg-muted/60 text-muted-foreground px-2 py-0.5 rounded border border-border/70 inline-block mr-1.5 font-medium"
                >
                  {line.replace(/^(?:[#>*\-•+]+\s*)+/, '').replace(/\*\*/g, '')}
                </div>
              );
            }

            const h1 = line.match(/^#\s+(.+)$/);
            if (h1) {
              return (
                <h4 key={lIdx} className="text-sm font-bold text-emerald-950 border-b border-emerald-100 pb-1.5">
                  {renderInlineMarkdownWithHighlight(h1[1], null)}
                </h4>
              );
            }

            const h2 = line.match(/^##\s+(.+)$/);
            if (h2) {
              return (
                <h5 key={lIdx} className="text-[13px] font-bold text-emerald-800 pt-1">
                  {renderInlineMarkdownWithHighlight(h2[1], null)}
                </h5>
              );
            }

            const h3 = line.match(/^#{3,6}\s+(.+)$/);
            if (h3) {
              return (
                <h6 key={lIdx} className="text-xs font-bold text-emerald-700 pt-0.5">
                  {renderInlineMarkdownWithHighlight(h3[1], null)}
                </h6>
              );
            }

            const bullet = line.match(/^(?:[-•*+])\s+(.+)$/);
            if (bullet) {
              return (
                <div key={lIdx} className="flex items-start gap-1.5 pl-2 text-xs text-foreground/90 leading-relaxed">
                  <span className="text-emerald-700 font-bold shrink-0">•</span>
                  <span className="flex-1">{renderInlineMarkdownWithHighlight(bullet[1], null)}</span>
                </div>
              );
            }

            return (
              <p key={lIdx} className="text-xs text-foreground/90 leading-relaxed">
                {renderInlineMarkdownWithHighlight(line, null)}
              </p>
            );
          })}
        </div>
      );
    });
  };

  // Trình soạn thảo & xem trước Markdown chuẩn dùng chung cho Nhập bài mới & Nạp thêm dữ liệu
  const renderArticleEditorSection = ({ isReparseTab = false }: { isReparseTab?: boolean } = {}) => (
    <ArticleEditor
      ingestText={ingestText}
      setIngestText={(val) => {
        setIngestText(val);
        if (!isReparseTab && ingestionResult) resetArticleState();
      }}
      articleEditorMode={articleEditorMode}
      setArticleEditorMode={setArticleEditorMode}
      showPasteTip={showPasteTip}
      setShowPasteTip={setShowPasteTip}
      onCrawl={handleCrawlArticleFromUrl}
      crawlingUrl={crawlingUrl}
      crawlDisabled={!(editUrl || ingestUrl).trim()}
      onPaste={handlePasteArticleText}
      onClear={() => {
        setIngestText('');
        setArticleEditorMode('code');
        if (!isReparseTab && ingestionResult) resetArticleState();
      }}
      isReparseTab={isReparseTab}
    />
  );

  // Quản lý danh sách các chuyên mục / bệnh hại trong bài viết (thay thế dropdown đơn)
  const renderArticleTopicsSelector = () => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="font-semibold text-foreground text-xs">
          Các chuyên mục / bệnh hại trong bài viết *
        </label>
        <span className="text-[11px] text-muted-foreground font-normal">
          {articleTopics.length} chuyên đề
        </span>
      </div>

      {/* Danh sách các tags/chips chuyên đề của bài */}
      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-muted/40 border border-border min-h-[36px]">
        {articleTopics.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">Chưa có chuyên mục nào. Hãy chọn bên dưới để thêm vào bài.</span>
        ) : (
          articleTopics.map((topicCode) => {
            const found = diseases.find((d) => d.classCode === topicCode);
            const isHealthy = isHealthyTopic(found?.commonNameVi || '', topicCode);
            const label = formatTopicLabel(found?.commonNameVi, topicCode);
            return (
              <span
                key={topicCode}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border shadow-2xs ${isHealthy
                    ? 'bg-sky-50 text-sky-900 border-sky-300'
                    : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  }`}
              >
                <span>{label}</span>
                {articleTopics.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setArticleTopics((prev) => prev.filter((t) => t !== topicCode))}
                    className="opacity-60 hover:opacity-100 hover:text-destructive transition-opacity ml-0.5"
                    title="Bỏ chuyên đề này khỏi bài viết"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            );
          })
        )}
      </div>

      {/* Thanh chọn nhanh bệnh có sẵn của loài cây để thêm vào bài */}
      <div className="flex items-center gap-1.5">
        <select
          value={selectedTopicToAdd}
          onChange={(e) => setSelectedTopicToAdd(e.target.value)}
          className="flex-1 px-2.5 py-1.5 bg-background border border-border rounded text-xs font-medium"
        >
          <option value="">-- Chọn chuyên mục / bệnh hại có sẵn để thêm --</option>
          {filteredDiseasesByPlant
            .filter((d) => !articleTopics.includes(d.classCode))
            .map((d) => (
              <option key={d.classCode} value={d.classCode}>
                {formatTopicLabel(d.commonNameVi, d.classCode)}
              </option>
            ))}
        </select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!selectedTopicToAdd}
          onClick={() => {
            if (selectedTopicToAdd && !articleTopics.includes(selectedTopicToAdd)) {
              setArticleTopics((prev) => [...prev, selectedTopicToAdd]);
              setSelectedTopicToAdd('');
            }
          }}
          className="h-8 text-xs font-semibold gap-1 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-300 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm vào bài</span>
        </Button>
      </div>
    </div>
  );

  // Dropdown chọn nguồn bài báo (Việt Nam hay Nước ngoài), dùng chung ở 3 form thông tin bài
  const renderSourceScopeSelect = () => (
    <div>
      <label className="font-semibold text-foreground block mb-1">
        Nguồn bài báo *
      </label>
      <select
        aria-label="Nguồn bài báo"
        value={ingestSourceScope}
        onChange={(e) => setIngestSourceScope(e.target.value as 'Việt Nam' | 'Quốc tế')}
        className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs font-medium"
      >
        <option value="Việt Nam">🇻🇳 Bài báo Việt Nam (Trong nước)</option>
        <option value="Quốc tế">🌐 Bài báo Nước ngoài (Quốc tế)</option>
      </select>
    </div>
  );

  // Badge hiển thị xuất xứ bài báo (Việt Nam / Nước ngoài), tái sử dụng ở chi tiết bài & bảng kiểm duyệt
  const renderOriginPill = (scope: 'Việt Nam' | 'Quốc tế', compact = false) => (
    <span
      className={`inline-flex items-center rounded font-semibold border ${compact ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-[11px]'
        } ${scope === 'Quốc tế'
          ? 'bg-purple-50 text-purple-800 border-purple-200'
          : 'bg-sky-50 text-sky-800 border-sky-200'
        }`}
    >
      {scope === 'Quốc tế'
        ? (compact ? '🌐 Nước ngoài' : '🌐 Bài báo Nước ngoài')
        : (compact ? '🇻🇳 Việt Nam' : '🇻🇳 Bài báo Việt Nam')}
    </span>
  );

  // Thanh tóm tắt 1 dòng khi thu gọn Card Thông tin bài viết & Phân loại (dùng chung Nhập bài mới & Nạp thêm)
  const renderMetaCollapsedSummary = () => (
    <div className="p-3 bg-muted/15 flex flex-wrap items-center justify-between gap-2 text-xs border-b border-border/40">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-muted-foreground text-[11px]">
        <span>
          <strong className="text-foreground">Cây:</strong>{' '}
          <span className="text-emerald-800 font-semibold">{selectedPlant || 'Chưa chọn'}</span>
        </span>
        <span>•</span>
        <span>
          <strong className="text-foreground">Nguồn:</strong>{' '}
          <span className="font-semibold text-foreground">
            {ingestSourceScope === 'Quốc tế' ? '🌐 Nước ngoài' : '🇻🇳 Việt Nam'}
          </span>
        </span>
        <span>•</span>
        <span>
          <strong className="text-foreground">Chuyên đề:</strong>{' '}
          <span className="text-emerald-800 font-semibold">
            {articleTopics
              .map((code) => {
                const f = diseases.find((d) => d.classCode === code);
                return formatTopicLabel(f?.commonNameVi, code);
              })
              .join(', ') || 'Chưa chọn'}
          </span>
        </span>
        <span>•</span>
        <span className="max-w-[260px] truncate" title={ingestTitle}>
          <strong className="text-foreground">Tiêu đề:</strong>{' '}
          <span className="text-foreground font-medium">{ingestTitle || '(Chưa có)'}</span>
        </span>
      </div>

      <button
        type="button"
        onClick={() => setIsMetaCardCollapsed(false)}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
      >
        <Edit3 className="w-3 h-3" />
        <span>Mở ra chỉnh sửa</span>
      </button>
    </div>
  );

  // Ô nhập metadata có gợi ý AI độc lập từng trường (Tiêu đề / Cơ quan / Tác giả / Ngày đăng / Ngày cập nhật)
  const renderAiMetaFieldInput = ({
    fieldKey,
    label,
    value,
    onChange,
    placeholder,
    mutedPlaceholder = false,
    hasDiff,
    suggestedValue,
    applyToast,
    popoverAlign = 'left',
  }: {
    fieldKey: string;
    label: string;
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
    mutedPlaceholder?: boolean;
    hasDiff: boolean;
    suggestedValue: string;
    applyToast: string;
    popoverAlign?: 'left' | 'right';
  }) => (
    <div className="relative">
      <div className="flex items-center justify-between mb-1 gap-1.5">
        <label className="font-semibold text-foreground">{label}</label>
        {hasDiff && (
          <button
            type="button"
            onClick={() => setActiveAiPopoverField(activeAiPopoverField === fieldKey ? null : fieldKey)}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-full px-2 py-0.5 animate-pulse cursor-pointer shadow-2xs transition-colors shrink-0"
            title="Nhấp để xem gợi ý AI"
          >
            <Sparkles className="w-3 h-3 text-amber-600 animate-spin-slow" />
            <span>AI có gợi ý</span>
          </button>
        )}
      </div>
      <div className="relative">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={() => {
            if (hasDiff) setActiveAiPopoverField(fieldKey);
          }}
          placeholder={placeholder}
          className={`text-xs bg-background transition-all ${mutedPlaceholder ? 'placeholder:text-muted-foreground/35 placeholder:italic ' : ''
            }${hasDiff ? 'ring-2 ring-amber-400/80 border-amber-400 bg-amber-50/20 pr-8 shadow-xs' : ''}`}
        />
        {hasDiff && (
          <button
            type="button"
            onClick={() => setActiveAiPopoverField(activeAiPopoverField === fieldKey ? null : fieldKey)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-600 hover:text-amber-800 transition-transform active:scale-95"
            title="Nhấp để xem gợi ý AI"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          </button>
        )}

        {hasDiff && activeAiPopoverField === fieldKey && (
          <div
            className={`absolute z-30 top-full mt-1.5 p-3 bg-card border-2 border-amber-300 rounded-xl shadow-xl text-xs space-y-2 animate-in fade-in zoom-in-95 ${popoverAlign === 'right'
                ? 'left-0 right-0 sm:left-auto sm:min-w-[320px]'
                : 'left-0 right-0 sm:right-auto sm:min-w-[340px]'
              }`}
          >
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold text-amber-950 block">AI đọc được từ bài báo:</span>
                <p className="text-xs font-semibold text-foreground mt-0.5 bg-muted/40 p-1.5 rounded border border-border/60 break-words">
                  "{suggestedValue}"
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-border/60">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDismissedAiFields((prev) => ({ ...prev, [fieldKey]: true }));
                  setActiveAiPopoverField(null);
                }}
                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
              >
                Bỏ qua
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onChange(suggestedValue);
                  setDismissedAiFields((prev) => ({ ...prev, [fieldKey]: true }));
                  setActiveAiPopoverField(null);
                  toast.success(applyToast);
                }}
                className="h-6 px-2.5 text-[10px] bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                Áp dụng
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Thẻ vật tư / hoạt chất + form thêm cụm từ inline (dùng chung cho đoạn AI đề xuất & đoạn AI không chọn ở cả 2 luồng)
  const renderParagraphMentions = (para: ParagraphItem) => (
    <div className="pl-6 mt-2 pt-2 border-t border-border/40 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
          <span>Vật tư / Hoạt chất:</span>
          <span
            className="text-[9px] text-muted-foreground/80 cursor-help"
            title="Cụm từ trích xuất để AI Lavi gợi ý thuốc trong kho vật tư và đối soát kiến thức"
          >
            (?)
          </span>
        </span>
        {(para.mentions || []).map((m, mIdx) => {
          const translation = getAgriTranslation(m.text);
          const isHighlighted =
            highlightedMention?.paraId === para.id &&
            highlightedMention.text.toLowerCase() === m.text.toLowerCase();
          return (
            <span
              key={mIdx}
              onMouseEnter={() => setHighlightedMention({ paraId: para.id, text: m.text })}
              onMouseLeave={() => setHighlightedMention(null)}
              onClick={() =>
                setHighlightedMention((prev) =>
                  prev?.paraId === para.id && prev?.text.toLowerCase() === m.text.toLowerCase()
                    ? null
                    : { paraId: para.id, text: m.text }
                )
              }
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${isHighlighted ? 'ring-2 ring-amber-400 shadow-xs ' : ''
                }${m.kind === 'CHEMICAL'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : m.kind === 'BIOLOGICAL'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : m.kind === 'SUPPLY'
                      ? 'bg-blue-100 text-blue-900 border border-blue-300'
                      : 'bg-purple-100 text-purple-900 border border-purple-300'
                }`}
              title={
                translation
                  ? `Thuật ngữ: "${m.text}"\nNghĩa tiếng Việt: ${translation}\n(Bấm để highlight từ này trong văn bản)`
                  : `Bấm để highlight "${m.text}" trong đoạn văn`
              }
            >
              <span>{m.text}</span>
              {translation && (
                <span className="text-[9px] opacity-80 font-normal italic">({translation})</span>
              )}
              <select
                value={m.kind}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => handleChangeMentionKind(para.id, mIdx, e.target.value)}
                className="bg-transparent border-none text-[9px] cursor-pointer font-semibold opacity-75 hover:opacity-100 focus:ring-0 p-0 ml-0.5"
                title="Đổi phân loại vật tư"
              >
                <option value="CHEMICAL">Hóa học</option>
                <option value="BIOLOGICAL">Sinh học</option>
                <option value="SUPPLY">Vật tư</option>
                <option value="PRACTICE">Canh tác</option>
              </select>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveMention(para.id, mIdx);
                }}
                className="opacity-50 hover:opacity-100 hover:text-destructive transition-opacity ml-0.5"
                title="Xóa thẻ này"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          );
        })}

        {addingMentionParaId !== para.id && (
          <button
            type="button"
            onClick={() => {
              setAddingMentionParaId(para.id);
              setNewMentionText('');
              setNewMentionKind('CHEMICAL');
            }}
            className="inline-flex items-center gap-1 text-[10px] text-emerald-700 hover:text-emerald-800 font-medium px-1.5 py-0.5 border border-dashed border-emerald-300 rounded hover:bg-emerald-50 transition-colors"
            title="Bấm để thêm cụm từ nguyên văn trong đoạn này"
          >
            <Plus className="w-2.5 h-2.5" />
            <span>Thêm cụm từ</span>
          </button>
        )}
      </div>

      {addingMentionParaId === para.id && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-muted/40 border border-border rounded-md text-xs">
          <Input
            type="text"
            value={newMentionText}
            onChange={(e) => setNewMentionText(e.target.value)}
            placeholder="Nhập cụm từ nguyên văn có trong đoạn..."
            className="h-7 text-[11px] bg-background w-56"
            autoFocus
          />
          <select
            value={newMentionKind}
            onChange={(e) => setNewMentionKind(e.target.value)}
            className="h-7 px-2 text-[11px] bg-background border border-border rounded font-medium"
          >
            <option value="CHEMICAL">Hóa học</option>
            <option value="BIOLOGICAL">Sinh học</option>
            <option value="SUPPLY">Vật tư canh tác</option>
            <option value="PRACTICE">Biện pháp canh tác</option>
          </select>
          <Button
            type="button"
            size="sm"
            onClick={() => handleAddMention(para.id)}
            className="h-7 text-[11px] px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
          >
            Thêm
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setAddingMentionParaId(null)}
            className="h-7 text-[11px] px-2 text-muted-foreground"
          >
            Hủy
          </Button>
        </div>
      )}
    </div>
  );

  // Thẻ duyệt từng đoạn trích (dùng chung cho Nhập bài báo mới & Tab Nạp thêm dữ liệu)
  const renderParagraphReviewCard = (para: ParagraphItem, options?: { isNoise?: boolean }) => {
    const state = selectedParagraphs[para.id] || { selected: false, unitType: 'SYMPTOMS' };
    const isTooLong = para.text.length > MAX_SNIPPET_CHARS;
    const isSaved = savedVerbatimTexts.has(collapseWs(para.text));
    const isHeaderLine = para.text.length < 40 && !para.id.includes('_');
    const isNoise = !!options?.isNoise;

    return (
      <div
        key={para.id}
        className={`rounded-lg border transition-colors ${isNoise ? 'p-3 border-dashed ' : 'p-3.5 '}${state.selected
            ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs opacity-100'
            : isNoise
              ? 'bg-muted/10 border-border/80 opacity-80 hover:opacity-100 hover:bg-muted/30'
              : 'bg-card border-border hover:bg-muted/40'
          }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <label className="flex items-center gap-2 cursor-pointer font-bold text-xs">
            <input
              type="checkbox"
              checked={state.selected}
              disabled={isTooLong || isSaved || isHeaderLine || (!state.selected && countWithSaved >= 30)}
              title={
                isSaved
                  ? 'Đoạn này đã được lưu trong cơ sở dữ liệu (Tab 1)'
                  : isTooLong
                    ? `Đoạn quá dài (> ${MAX_SNIPPET_CHARS.toLocaleString('vi-VN')} ký tự), vui lòng chia nhỏ đoạn trước khi chọn`
                    : isHeaderLine
                      ? 'Dòng tiêu đề hoặc siêu dữ liệu không dùng làm đoạn trích dẫn'
                      : (!state.selected && countWithSaved >= 30)
                        ? `Đã đạt giới hạn tối đa 30 đoạn nguyên văn của bài viết (Tab 1 đã lưu ${existingVerbatimCount} đoạn)`
                        : undefined
              }
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
            <span className="text-muted-foreground font-normal text-[11px]">({para.text.length} ký tự)</span>
            {isSaved && (
              <Badge variant="outline" className="text-[10px] h-5 border-emerald-300 text-emerald-800 bg-emerald-50">
                Đã lưu
              </Badge>
            )}
            {isTooLong && (
              <Badge variant="destructive" className="text-[10px] h-5">
                Vượt quá {MAX_SNIPPET_CHARS.toLocaleString('vi-VN')} ký tự
              </Badge>
            )}
          </label>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleOpenSplitModal(para)}
              className={`h-6 text-[10px] gap-1 px-2 border ${isTooLong
                  ? 'border-destructive/60 text-destructive hover:bg-destructive/10 font-semibold'
                  : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              title={isTooLong ? `Đoạn quá ${MAX_SNIPPET_CHARS.toLocaleString('vi-VN')} ký tự - bấm để tách` : 'Tách đoạn này thành 2 đoạn nhỏ'}
            >
              <Scissors className="w-3 h-3" />
              <span>Tách đoạn</span>
            </Button>

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
              <option value="SUMMARY">Tổng quan / FAQ (SUMMARY)</option>
            </select>

            <select
              value={state.diseaseClass || ingestClass}
              disabled={!state.selected}
              onChange={(e) => {
                setSelectedParagraphs((prev) => ({
                  ...prev,
                  [para.id]: {
                    ...state,
                    diseaseClass: e.target.value,
                  },
                }));
              }}
              className="px-2 py-1 text-[11px] bg-background border border-border rounded font-medium disabled:opacity-50 max-w-[160px] truncate"
              title="Chuyên đề / Bệnh hại cho đoạn trích này"
            >
              {filteredDiseasesByPlant.map((d) => (
                <option key={d.classCode} value={d.classCode}>
                  {formatTopicLabel(d.commonNameVi, d.classCode)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-foreground/90 pl-6 leading-relaxed space-y-0.5">
          {renderParagraphWithHighlight(para.id, para.text)}
        </div>

        {renderParagraphMentions(para)}
      </div>
    );
  };

  // Accordion thu gọn chứa các đoạn AI không chọn (rendered duy nhất 1 lần để tránh lặp)
  const renderUnselectedParagraphsAccordion = (noiseParagraphs: ParagraphItem[]) => {
    if (noiseParagraphs.length === 0) return null;
    return (
      <div className="pt-2 border-t border-border">
        <button
          type="button"
          onClick={() => setShowNoiseParagraphs(!showNoiseParagraphs)}
          className="w-full flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 border border-border text-xs text-muted-foreground font-medium"
        >
          <span className="flex items-center gap-1.5">
            {showNoiseParagraphs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>Đoạn AI không chọn: {noiseParagraphs.length} đoạn (vẫn tick để lưu được)</span>
          </span>
          <span className="text-[11px]">{showNoiseParagraphs ? 'Thu gọn' : 'Bấm để mở xem'}</span>
        </button>

        {showNoiseParagraphs && (
          <div className="mt-2 space-y-2 pl-2">
            {noiseParagraphs.map((para) => renderParagraphReviewCard(para, { isNoise: true }))}
          </div>
        )}
      </div>
    );
  };


  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {(editParam || editUrl)
              ? 'Chi tiết bài viết tri thức'
              : 'Nhập bài báo nguyên văn'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {(editParam || editUrl)
              ? 'Kiểm tra thông tin bài báo, các đoạn trích dẫn và duyệt nội dung đưa vào trợ lý AI Lavi.'
              : 'Nhập văn bản bài báo khuyến nông, hệ thống tự động bóc tách các đoạn theo chuẩn sở hữu trí tuệ.'}
          </p>
        </div>
      </div>

      {/* ========================================================================================= */}
      {/* NHẬP BÀI BÁO NGUYÊN VĂN & CHI TIẾT BÀI VIẾT */}
      {/* ========================================================================================= */}
      <div className="space-y-6">
        {(editParam || editUrl) ? (
          (editLoading && editRows.length === 0) ? (
            /* Loading Skeleton sạch sẽ khi click xem chi tiết bài viết, loại bỏ hoàn toàn hiện tượng giật trang */
            <div className="space-y-4 animate-pulse">
              <div className="p-4 bg-card border border-border rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-36 bg-muted rounded-full" />
                    <div className="h-6 w-24 bg-muted rounded-full" />
                  </div>
                  <div className="h-8 w-28 bg-muted rounded-md" />
                </div>
                <div className="h-6 w-3/4 bg-muted rounded" />
                <div className="h-4 w-1/2 bg-muted rounded" />
              </div>
              <div className="p-10 bg-card border border-border rounded-xl flex flex-col items-center justify-center text-center space-y-3">
                <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
                <div className="text-sm font-semibold text-foreground">
                  Đang tải chi tiết bài viết từ kho tri thức...
                </div>
                <div className="text-xs text-muted-foreground max-w-md truncate">
                  {editParam || editUrl}
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* CHẾ ĐỘ XEM & SỬA BÀI VIẾT ĐÃ LƯU: GIAO DIỆN 2 TAB ĐẶT NGAY TRÊN CÙNG */
            /* ========================================================================= */
            <div className="space-y-4">
              <Tabs value={editSubTab} onValueChange={(v) => setEditSubTab(v as 'approved' | 'reparse')} className="space-y-4">
                {/* 2 Tabs nằm ở trên cùng để tách biệt hoàn toàn 2 công việc: Xem/Sửa chi tiết vs Nạp thêm dữ liệu */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-border/70">
                  <TabsList className="grid grid-cols-2 max-w-md bg-muted/60 p-1">
                    <TabsTrigger value="approved" className="gap-2 text-xs py-1.5 font-semibold">
                      <BookOpen className="w-4 h-4 text-emerald-700" />
                      <span>1. Xem &amp; Sửa chi tiết ({editRows.length} đoạn{articleImages.length > 0 ? ` · ${articleImages.length} ảnh` : ''})</span>
                    </TabsTrigger>
                    <TabsTrigger value="reparse" className="gap-2 text-xs py-1.5 font-semibold">
                      <Sparkles className="w-4 h-4 text-emerald-700" />
                      <span>2. Nạp thêm dữ liệu bài báo</span>
                    </TabsTrigger>
                  </TabsList>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      exitEditMode(true);
                      if (window.history.length > 1) {
                        navigate(-1);
                      } else {
                        navigate('/admin/knowledge');
                      }
                    }}
                    className="h-8 text-xs gap-1.5 font-medium shrink-0 self-start sm:self-auto hover:bg-muted"
                    title="Quay lại bảng Kiểm duyệt tri thức"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Quay lại danh sách</span>
                  </Button>
                </div>

                {/* ========================================================================= */}
                {/* TAB 1: XEM & SỬA CHI TIẾT BÀI VIẾT + CÁC ĐOẠN ĐÃ DUYỆT */}
                {/* ========================================================================= */}
                <TabsContent value="approved" className="space-y-4">
                  {/* Header bài viết: Gọn gàng, tối giản như báo cáo */}
                  <div className="p-4 bg-card border border-border rounded-xl shadow-xs space-y-3">
                    {/* Dòng tiêu đề bài viết kết hợp nút Sửa và nút Mở link bài gốc tối giản */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
                      <h2 className="text-base sm:text-lg font-bold text-foreground leading-snug line-clamp-2" title={editOriginalMeta.title || ingestTitle || editUrl || ''}>
                        {editOriginalMeta.title || ingestTitle || 'Bài viết chưa có tiêu đề'}
                      </h2>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          variant={showMetaEditPanel ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setShowMetaEditPanel(!showMetaEditPanel)}
                          className={`h-7 px-2.5 text-xs gap-1 font-medium ${showMetaEditPanel ? 'bg-emerald-700 text-white' : ''}`}
                          title="Chỉnh sửa tiêu đề, cơ quan hoặc ngày xuất bản của bài báo"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{showMetaEditPanel ? 'Đóng form sửa' : 'Sửa thông tin'}</span>
                        </Button>

                        {isSafeHttpUrl(editUrl || ingestUrl) && (
                          <a
                            href={(editUrl || ingestUrl)!.trim()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs"
                            title="Mở trực tiếp trang web bài báo gốc trong tab mới"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Mở link bài gốc</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Dòng 3: Thông tin định dạng text sạch sẽ như báo cáo, tránh rườm rà khung hộp */}
                    <div className="text-xs text-muted-foreground space-y-1.5 pt-0.5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>
                          <strong className="text-foreground">Loài cây:</strong>{' '}
                          <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {editOriginalMeta.plantName || selectedPlant || 'Chưa chọn'}
                          </span>
                        </span>

                        <span className="text-muted-foreground/40">•</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${editOriginalMeta.sourceScope === 'Quốc tế'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : 'bg-sky-50 text-sky-800 border-sky-200'
                            }`}
                        >
                          {editOriginalMeta.sourceScope === 'Quốc tế'
                            ? '🌐 Bài báo Nước ngoài'
                            : '🇻🇳 Bài báo Việt Nam'}
                        </span>

                        {articleDistinctTopics.length > 0 && (
                          <>
                            <span className="text-muted-foreground/40">•</span>
                            <span className="inline-flex flex-wrap items-center gap-1.5">
                              <strong className="text-foreground">Chủ đề trong bài:</strong>
                              {articleDistinctTopics.map((t, idx) => (
                                <span
                                  key={idx}
                                  className={`px-2 py-0.5 rounded text-[11px] font-medium border ${t.isHealthy
                                      ? 'bg-sky-50 text-sky-800 border-sky-200'
                                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    }`}
                                >
                                  {t.label}
                                </span>
                              ))}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                        {editOriginalMeta.org ? (
                          <span>
                            <strong className="text-foreground">Cơ quan:</strong> {editOriginalMeta.org}
                          </span>
                        ) : null}

                        {editOriginalMeta.author ? (
                          <>
                            <span className="text-muted-foreground/40">•</span>
                            <span>
                              <strong className="text-foreground">Tác giả:</strong> {editOriginalMeta.author}
                            </span>
                          </>
                        ) : null}

                        {editOriginalMeta.pubDate ? (
                          <>
                            <span className="text-muted-foreground/40">•</span>
                            <span>
                              <strong className="text-foreground">Ngày đăng:</strong> {editOriginalMeta.pubDate}
                            </span>
                          </>
                        ) : null}
                      </div>

                      {isSafeHttpUrl(editUrl || ingestUrl) && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80 pt-0.5">
                          <span className="font-medium text-foreground">URL:</span>
                          <a
                            href={(editUrl || ingestUrl)!.trim()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-muted-foreground hover:text-emerald-700 hover:underline truncate max-w-xl"
                            title={(editUrl || ingestUrl)!.trim()}
                          >
                            {(editUrl || ingestUrl)!.trim()}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bảng chỉnh sửa thông tin: Chỉ hiển thị khi Admin nhấn "Sửa thông tin" */}
                  {showMetaEditPanel && (
                    <Card className="border-emerald-300 bg-card shadow-sm animate-in fade-in duration-200">
                      <CardHeader className="py-2.5 px-4 border-b border-border bg-emerald-50/60">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xs font-bold flex items-center gap-2 text-emerald-950">
                            <Edit3 className="w-4 h-4 text-emerald-700" />
                            <span>Chỉnh sửa thông tin bài viết &amp; Nguồn gốc</span>
                          </CardTitle>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowMetaEditPanel(false)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                            title="Đóng form chỉnh sửa"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
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
                              <option value="">-- Chọn loài cây --</option>
                              {uniquePlants.map((plant) => (
                                <option key={plant} value={plant}>
                                  {plant}
                                </option>
                              ))}
                            </select>
                          </div>
                          {renderSourceScopeSelect()}
                          <div className="sm:col-span-2">
                            {renderArticleTopicsSelector()}
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="font-semibold text-foreground block mb-1">
                              Cơ quan / Viện nghiên cứu / Tạp chí *
                            </label>
                            <Input
                              type="text"
                              value={ingestOrg}
                              onChange={(e) => setIngestOrg(e.target.value)}
                              placeholder="Trung tâm Khuyến nông Quốc gia, Viện BVTV..."
                              className="text-xs bg-background"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-foreground block mb-1">
                              Tác giả / Nhóm nghiên cứu
                            </label>
                            <Input
                              type="text"
                              value={ingestAuthor}
                              onChange={(e) => setIngestAuthor(e.target.value)}
                              placeholder="(Để trống nếu không rõ tác giả)"
                              className="text-xs bg-background"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="font-semibold text-foreground block mb-1">
                              Ngày đăng / xuất bản
                            </label>
                            <Input
                              type="text"
                              value={ingestPublishedDate}
                              onChange={(e) => setIngestPublishedDate(e.target.value)}
                              placeholder="03/01/2024 hoặc 2024"
                              className="text-xs bg-background"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-foreground block mb-1">
                              Ngày cập nhật (nếu có)
                            </label>
                            <Input
                              type="text"
                              value={ingestUpdatedDate}
                              onChange={(e) => setIngestUpdatedDate(e.target.value)}
                              placeholder="(Để trống nếu không có)"
                              className="text-xs bg-background"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
                          <span className="text-[11px] text-muted-foreground">
                            Lưu thông tin sẽ cập nhật đồng bộ tiêu đề, tác giả, ngày xuất bản cho {editRows.length} đoạn trích.
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowMetaEditPanel(false)}
                              className="h-8 text-xs"
                            >
                              Đóng
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={!editMetaDirty || editSaving || !ingestClass}
                              onClick={() => saveEditedArticleMeta()}
                              className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                            >
                              {editSaving ? 'Đang lưu...' : 'Lưu thay đổi thông tin bài'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}


                  {/* Cảnh báo kiểm tra trùng lặp đoạn trích */}
                  {(() => {
                    const duplicates = findDuplicateChunks(editRows);
                    if (duplicates.length === 0) return null;
                    return (
                      <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs space-y-1.5 shadow-xs">
                        <div className="font-bold flex items-center gap-2 text-amber-950">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Cảnh báo: Phát hiện {duplicates.length} cặp đoạn trích có nội dung trùng lặp / tương đồng cao!</span>
                        </div>
                        <div className="space-y-1 pl-6 text-[11px] text-amber-800">
                          {duplicates.map((d, dIdx) => (
                            <div key={dIdx}>
                              • <strong>Đoạn #{d.indexA}</strong> và <strong>Đoạn #{d.indexB}</strong> có độ tương đồng ~{d.similarity}%. Bạn có thể bấm nút <em>"Xóa đoạn"</em> ở đoạn trùng thừa để tối ưu bộ nhớ AI Lavi.
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ========================================================================= */}
                  {/* KHỐI ẢNH TRIỆU CHỨNG BỆNH ĐÍNH KÈM BÀI VIẾT (Tab 1 nổi bật, trực quan) */}
                  {/* ========================================================================= */}
                  <div className="bg-card border border-border rounded-xl shadow-xs p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-border/60">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 flex items-center justify-center shrink-0">
                          <Camera className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-foreground">
                              Ảnh triệu chứng bệnh
                            </h3>
                            <Badge
                              variant={articleImages.length > 0 ? 'secondary' : 'outline'}
                              className={
                                articleImages.length > 0
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px] font-bold px-2 py-0.5'
                                  : 'bg-amber-50 text-amber-800 border-amber-300 text-[11px] font-semibold px-2 py-0.5'
                              }
                            >
                              {articleImages.length > 0 ? `${articleImages.length} ảnh đã nạp` : 'Chưa có ảnh'}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Ảnh minh họa triệu chứng bệnh thực tế từ bài báo, dùng để đối chứng và hiển thị trực quan cho nông dân.
                          </p>
                        </div>
                      </div>

                      {articleImages.length > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={openAddImageModal}
                          className="h-8 px-3 text-xs gap-1.5 font-bold bg-emerald-700 hover:bg-emerald-800 text-white shrink-0 shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Thêm ảnh triệu chứng</span>
                        </Button>
                      )}
                    </div>

                    {/* Danh sách ảnh hoặc trạng thái cảnh báo trống */}
                    {loadingArticleImages ? (
                      <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                        <span>Đang tải danh sách ảnh triệu chứng...</span>
                      </div>
                    ) : articleImages.length === 0 ? (
                      <div className="border-2 border-dashed border-amber-300 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-950/10 rounded-xl p-4 sm:p-5 text-center flex flex-col items-center justify-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 flex items-center justify-center">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-200">
                            Bài viết này chưa nạp ảnh triệu chứng bệnh!
                          </div>
                          <p className="text-[11px] text-amber-800 dark:text-amber-300/90 max-w-md">
                            Hãy nạp từ 1–3 ảnh chụp lá, quả hoặc thân cây bị bệnh từ bài báo để làm phong phú kho tri thức và hỗ trợ bà con nhận diện bệnh trực quan.
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={openAddImageModal}
                          className="mt-1 h-8 px-4 text-xs gap-1.5 font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Thêm ảnh triệu chứng ngay</span>
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pt-1">
                        {articleImages.map((img) => (
                          <div
                            key={img.id}
                            className="group relative flex flex-col bg-muted/20 border border-border/80 hover:border-emerald-500 rounded-lg overflow-hidden transition-all duration-200 shadow-2xs hover:shadow-xs"
                          >
                            <div
                              className="relative aspect-4/3 w-full bg-muted/50 overflow-hidden cursor-pointer"
                              onClick={() => setPreviewingImage(img)}
                            >
                              <img
                                src={img.image_url}
                                alt={img.caption || 'Ảnh triệu chứng'}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                loading="lazy"
                              />
                              <div className="absolute top-1.5 left-1.5">
                                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-black/70 text-white backdrop-blur-xs">
                                  {getPlantPartLabel(img.plant_part)}
                                </span>
                              </div>

                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewingImage(img);
                                  }}
                                  className="w-7 h-7 rounded-full bg-white/90 text-foreground hover:bg-white flex items-center justify-center shadow"
                                  title="Xem ảnh phóng to"
                                >
                                  <ZoomIn className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteImageTarget(img);
                                  }}
                                  className="w-7 h-7 rounded-full bg-rose-600 text-white hover:bg-rose-700 flex items-center justify-center shadow"
                                  title="Gỡ ảnh này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="p-2 flex flex-col justify-between flex-1 space-y-1">
                              <p className="text-[11px] font-medium text-foreground line-clamp-1 leading-snug" title={img.caption || 'Không có chú thích'}>
                                {img.caption || <span className="text-muted-foreground italic">Chưa có chú thích</span>}
                              </p>
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5 border-t border-border/40">
                                <span className="truncate max-w-[70%]" title={img.credit || ''}>
                                  {img.credit || 'Khuyết nguồn'}
                                </span>
                                <span className="text-emerald-700 font-semibold shrink-0">
                                  #{img.id}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={openAddImageModal}
                          className="flex flex-col items-center justify-center min-h-[120px] aspect-4/3 rounded-lg border-2 border-dashed border-border hover:border-emerald-600 hover:bg-emerald-50/30 text-muted-foreground hover:text-emerald-700 transition-colors p-3 gap-1.5 text-center group"
                        >
                          <div className="w-7 h-7 rounded-full bg-muted group-hover:bg-emerald-100 flex items-center justify-center">
                            <Plus className="w-4 h-4" />
                          </div>
                          <span className="text-[11px] font-semibold">Thêm ảnh khác</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Card chứa danh sách các đoạn trích & trạng thái duyệt toàn bộ */}
                  <Card className="border-border bg-card shadow-xs">
                    <CardHeader className="py-2.5 px-4 border-b border-border bg-muted/20">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Layers className="w-4 h-4 text-emerald-700" />
                          <span className="text-xs font-bold text-foreground">
                            Các đoạn trích đã lưu ({editRows.length})
                          </span>

                          {/* Trạng thái duyệt của các đoạn trích đặt ngay tại card đoạn trích */}
                          {editRows.length > 0 && (
                            editRows.every((r) => r.isManualApproved) ? (
                              <Badge className="bg-emerald-700 text-white text-[11px] gap-1 font-semibold py-0.5 px-2">
                                <Check className="w-3 h-3" />
                                Đã duyệt toàn bộ ({editRows.length}/{editRows.length})
                              </Badge>
                            ) : editRows.filter((r) => r.isManualApproved).length === 0 ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[11px] gap-1 font-semibold py-0.5 px-2">
                                <Clock className="w-3 h-3" />
                                Chờ duyệt (0/{editRows.length})
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-300 text-[11px] gap-1 font-semibold py-0.5 px-2">
                                Duyệt một phần ({editRows.filter((r) => r.isManualApproved).length}/{editRows.length})
                              </Badge>
                            )
                          )}

                          <span className="text-[11px] text-muted-foreground">
                            • Nguyên văn: {existingVerbatimCount}/30 đoạn ({existingVerbatimChars.toLocaleString('vi-VN')} ký tự)
                          </span>
                        </div>

                        {/* Nhóm nút thao tác hàng loạt */}
                        <div className="flex flex-wrap items-center gap-2">
                          {selectedEditRowIds.length > 0 ? (
                            <>
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-semibold py-0.5 px-2">
                                Đã chọn {selectedEditRowIds.length}/{editRows.length} đoạn
                              </Badge>

                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleApproveSelectedEditRows(true)}
                                className="h-7 px-2.5 text-xs font-semibold gap-1 bg-emerald-700 hover:bg-emerald-800 text-white"
                                title="Duyệt các đoạn trích đã chọn"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Duyệt ({selectedEditRowIds.length})</span>
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleApproveSelectedEditRows(false)}
                                className="h-7 px-2.5 text-xs font-semibold gap-1 text-muted-foreground hover:text-amber-800 border-amber-300 hover:bg-amber-50"
                                title="Bỏ duyệt các đoạn trích đã chọn"
                              >
                                <span>Bỏ duyệt ({selectedEditRowIds.length})</span>
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={deletingAllEditRows}
                                onClick={handleDeleteSelectedEditRows}
                                className="h-7 px-2.5 text-xs font-semibold gap-1.5 bg-red-600 hover:bg-red-700 text-white"
                                title="Xóa các đoạn trích đã chọn khỏi bài viết"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{deletingAllEditRows ? 'Đang xóa...' : `Xóa ${selectedEditRowIds.length} đoạn đã chọn`}</span>
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedEditRowIds([])}
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                              >
                                Bỏ chọn
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant={editRows.every((r) => r.isManualApproved) ? 'outline' : 'default'}
                                onClick={handleApproveAllInEdit}
                                className={`h-7 px-3 text-xs font-semibold gap-1.5 ${editRows.every((r) => r.isManualApproved)
                                    ? 'text-muted-foreground hover:text-destructive'
                                    : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                  }`}
                                title="Duyệt hoặc bỏ duyệt nhanh toàn bộ các đoạn trong bài viết"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>
                                  {editRows.every((r) => r.isManualApproved)
                                    ? 'Bỏ duyệt toàn bộ bài'
                                    : `Duyệt toàn bộ (${editRows.length})`}
                                </span>
                              </Button>

                              {/* Chỉ hiện khi bài còn ít nhất 1 đoạn đã duyệt: sau "Lưu thông tin bài" mọi đoạn về chờ duyệt,
                                  lúc đó nút này = xóa cả bài (việc đó đã có nút "Xóa bài" ở trang Duyệt tri thức, có hộp xác nhận riêng). */}
                              {editRows.some((r) => !r.isManualApproved) && editRows.some((r) => r.isManualApproved) && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={deletingAllEditRows}
                                  onClick={handleDeletePendingEditRows}
                                  className="h-7 px-2.5 text-xs font-semibold gap-1.5 border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
                                  title="Xóa toàn bộ các đoạn chưa duyệt để giải phóng hạn mức, giữ nguyên các đoạn đã duyệt"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-amber-700" />
                                  <span>{deletingAllEditRows ? 'Đang xóa...' : `Xóa ${editRows.filter((r) => !r.isManualApproved).length} đoạn chưa duyệt`}</span>
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {/* Thanh chọn nhanh checkbox khi có đoạn trích */}
                    {editRows.length > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-border/70 bg-muted/15 text-xs">
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer font-medium text-foreground select-none">
                            <input
                              type="checkbox"
                              checked={editRows.length > 0 && selectedEditRowIds.length === editRows.length}
                              ref={(el) => {
                                if (el) {
                                  el.indeterminate = selectedEditRowIds.length > 0 && selectedEditRowIds.length < editRows.length;
                                }
                              }}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedEditRowIds(editRows.map((r) => r.id));
                                } else {
                                  setSelectedEditRowIds([]);
                                }
                              }}
                              className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 cursor-pointer"
                            />
                            <span>Chọn tất cả ({editRows.length})</span>
                          </label>

                          {editRows.filter((r) => !r.isManualApproved).length > 0 &&
                            editRows.filter((r) => !r.isManualApproved).length < editRows.length && (
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedEditRowIds(editRows.filter((r) => !r.isManualApproved).map((r) => r.id))
                                }
                                className="text-[11px] text-amber-800 hover:text-amber-950 font-semibold underline cursor-pointer"
                              >
                                Chỉ chọn {editRows.filter((r) => !r.isManualApproved).length} đoạn chưa duyệt
                              </button>
                            )}

                          {editRows.filter((r) => r.isManualApproved).length > 0 &&
                            editRows.filter((r) => r.isManualApproved).length < editRows.length && (
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedEditRowIds(editRows.filter((r) => r.isManualApproved).map((r) => r.id))
                                }
                                className="text-[11px] text-emerald-800 hover:text-emerald-950 font-semibold underline cursor-pointer"
                              >
                                Chỉ chọn {editRows.filter((r) => r.isManualApproved).length} đoạn đã duyệt
                              </button>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-muted-foreground italic">
                            {selectedEditRowIds.length > 0
                              ? `Đang chọn ${selectedEditRowIds.length} đoạn trích`
                              : 'Tick chọn ô vuông trên từng đoạn để xóa hoặc duyệt có chọn lọc'}
                          </span>
                          <div className="flex items-center border border-border rounded-lg p-0.5 bg-background shrink-0">
                            <button
                              type="button"
                              onClick={() => setEditViewMode('grid')}
                              className={`p-1 rounded text-xs transition-colors cursor-pointer ${editViewMode === 'grid'
                                  ? 'bg-emerald-700 text-white font-medium'
                                  : 'text-muted-foreground hover:text-foreground'
                                }`}
                              title="Xem dạng lưới (2 cột)"
                            >
                              <LayoutGrid className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditViewMode('list')}
                              className={`p-1 rounded text-xs transition-colors cursor-pointer ${editViewMode === 'list'
                                  ? 'bg-emerald-700 text-white font-medium'
                                  : 'text-muted-foreground hover:text-foreground'
                                }`}
                              title="Xem dạng danh sách (1 cột)"
                            >
                              <List className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <CardContent className="p-4 text-xs">
                      {editLoading && editRows.length === 0 ? (
                        <p className="text-muted-foreground text-center py-6">Đang tải danh sách đoạn đã lưu...</p>
                      ) : editRows.length === 0 ? (
                        <p className="text-muted-foreground text-center py-6">Bài viết chưa có đoạn trích nào. Hãy chuyển sang Tab 2 để nạp đoạn.</p>
                      ) : (
                        <div className={editViewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3.5'}>
                          {editRows.map((row, rIdx) => {
                            const isRowSelected = selectedEditRowIds.includes(row.id);
                            return (
                              <div
                                key={row.id}
                                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 shadow-xs transition-all duration-150 ${isRowSelected
                                    ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20'
                                    : 'border-border bg-card hover:border-emerald-300 hover:shadow-sm'
                                  }`}
                              >
                                <div className="space-y-2.5">
                                  {/* Hàng 1: Checkbox, Thứ tự đoạn, Loại trích dẫn, Loại nội dung, Trạng thái & Thao tác nhanh */}
                                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
                                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={isRowSelected}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedEditRowIds((prev) => [...prev, row.id]);
                                          } else {
                                            setSelectedEditRowIds((prev) => prev.filter((id) => id !== row.id));
                                          }
                                        }}
                                        className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600 cursor-pointer shrink-0"
                                        title="Tick chọn để duyệt hoặc xóa đoạn này"
                                      />
                                      <span className="font-bold text-emerald-900 font-mono text-xs bg-emerald-100/70 text-emerald-800 px-2 py-0.5 rounded-md shrink-0">
                                        Đoạn #{rIdx + 1}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] px-1.5 py-0 font-medium ${row.isVerbatim
                                            ? 'text-emerald-700 border-emerald-300 bg-emerald-50/60'
                                            : 'text-amber-800 border-amber-300 bg-amber-50/70'
                                          }`}
                                      >
                                        {row.isVerbatim ? 'Nguyên văn' : 'Tóm tắt tổng hợp'}
                                      </Badge>
                                      {row.isVerbatim ? (
                                        <select
                                          value={(row.unitType || 'SYMPTOMS').toUpperCase()}
                                          onChange={(e) => updateSavedUnit(row, { unit_type: e.target.value })}
                                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-background cursor-pointer hover:border-emerald-500 transition-colors shadow-2xs"
                                          title="Bấm để đổi phân loại nội dung cho đoạn trích này"
                                        >
                                          <option value="SYMPTOMS">Triệu chứng</option>
                                          <option value="CAUSE_CONDITIONS">Nguyên nhân & ĐK</option>
                                          <option value="PREVENTION">Phòng ngừa</option>
                                          <option value="TREATMENT">Điều trị</option>
                                          <option value="SUMMARY">Tổng quan / FAQ</option>
                                        </select>
                                      ) : (
                                        row.unitType && row.unitType.toUpperCase() !== 'SUMMARY' ? (
                                          renderUnitTypeBadge(row.unitType)
                                        ) : null
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {/* Trạng thái duyệt */}
                                      {row.isManualApproved ? (
                                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold gap-1 px-2 py-0.5 shadow-2xs">
                                          <Check className="w-3 h-3" />
                                          <span>Đã duyệt</span>
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-semibold gap-1 px-2 py-0.5">
                                          <Clock className="w-3 h-3" />
                                          <span>Chờ duyệt</span>
                                        </Badge>
                                      )}

                                      {/* Nút Duyệt / Bỏ duyệt */}
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={row.isManualApproved ? 'outline' : 'default'}
                                        onClick={() => handleToggleApproveSingleSource(row.id, row.isManualApproved)}
                                        className={`h-6 px-2 text-[11px] font-medium transition-colors ${row.isManualApproved
                                            ? 'text-muted-foreground hover:text-amber-700 hover:border-amber-300'
                                            : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                          }`}
                                      >
                                        {row.isManualApproved ? 'Bỏ duyệt' : 'Duyệt'}
                                      </Button>

                                      {/* Vạch ngăn cách nhẹ nhàng */}
                                      <div className="h-3.5 w-px bg-border/80 mx-0.5" />

                                      {/* Nút Tách đoạn: Button vuông vức đẹp mắt, hover hiện title Tách đoạn */}
                                      <button
                                        type="button"
                                        onClick={() => handleOpenSplitModalForSaved(row)}
                                        className="h-6 w-6 rounded-md flex items-center justify-center text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 hover:text-emerald-950 border border-emerald-300 dark:border-emerald-700 transition-colors shadow-2xs cursor-pointer"
                                        title="Tách đoạn trích này thành các đoạn nhỏ"
                                      >
                                        <Scissors className="w-3 h-3" />
                                        <span className="sr-only">Tách đoạn</span>
                                      </button>

                                      {/* Nút Sửa chữ: Chỉ hiện cho Tóm tắt / FAQ */}
                                      {!row.isVerbatim && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (editingRowId === row.id) {
                                              setEditingRowId(null);
                                            } else {
                                              setEditingRowId(row.id);
                                              setEditingText(row.evidenceText);
                                            }
                                          }}
                                          className={`h-6 w-6 rounded-md flex items-center justify-center transition-colors shadow-2xs border cursor-pointer ${editingRowId === row.id
                                              ? 'bg-amber-100 text-amber-900 border-amber-400 font-bold'
                                              : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted border-border'
                                            }`}
                                          title={editingRowId === row.id ? 'Đang sửa tóm tắt' : 'Sửa nội dung tóm tắt'}
                                        >
                                          <Edit3 className="w-3 h-3" />
                                          <span className="sr-only">Sửa tóm tắt</span>
                                        </button>
                                      )}

                                      {/* Nút Xóa */}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSingleSource(row.id)}
                                        className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 border border-transparent transition-colors cursor-pointer"
                                        title="Xóa đoạn này khỏi bài viết"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                        <span className="sr-only">Xóa đoạn</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Hàng 2: Chọn chuyên đề bệnh hại & Độ dài ký tự */}
                                  <div className="flex items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <span className="text-muted-foreground font-medium text-[11px] shrink-0">Chuyên đề:</span>
                                      <select
                                        value={row.modelClass}
                                        onChange={(e) => updateSavedUnit(row, { model_class: e.target.value })}
                                        className={`px-2 py-1 rounded-md text-xs font-semibold border bg-background cursor-pointer max-w-[280px] truncate transition-colors focus:ring-1 focus:ring-emerald-500 ${isHealthyTopic(row.diseaseName, row.modelClass)
                                            ? 'text-sky-900 border-sky-300 bg-sky-50/50 hover:bg-sky-50'
                                            : 'text-emerald-950 border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50'
                                          }`}
                                        title="Bấm để đổi chuyên đề / bệnh hại cho đoạn trích này"
                                      >
                                        {filteredDiseasesByPlant.map((d) => (
                                          <option key={d.classCode} value={d.classCode}>
                                            {formatTopicLabel(d.commonNameVi, d.classCode)}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                                      {row.evidenceText.length.toLocaleString('vi-VN')} ký tự
                                    </span>
                                  </div>

                                  {/* Hàng 3: Hộp nội dung văn bản hoặc Khung chỉnh sửa trực tiếp (Chỉ cho phép sửa với Tóm tắt / FAQ) */}
                                  {!row.isVerbatim && editingRowId === row.id ? (
                                    <div className="space-y-2 rounded-lg bg-background border border-amber-400 p-2.5 shadow-sm animate-in fade-in-50">
                                      <div className="flex items-center justify-between text-[11px] text-amber-900 font-medium">
                                        <span className="flex items-center gap-1 font-semibold">
                                          <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                                          Chế độ chỉnh sửa trực tiếp Đoạn #{rIdx + 1}:
                                        </span>
                                        <span className={`font-mono text-xs ${editingText.length > MAX_SNIPPET_CHARS ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                          {editingText.length.toLocaleString('vi-VN')} / {MAX_SNIPPET_CHARS.toLocaleString('vi-VN')} ký tự
                                        </span>
                                      </div>
                                      <textarea
                                        value={editingText}
                                        onChange={(e) => setEditingText(e.target.value)}
                                        rows={6}
                                        className="w-full text-xs font-sans p-2.5 rounded border border-border bg-card focus:outline-none focus:ring-1 focus:ring-emerald-600 leading-relaxed resize-y"
                                        placeholder="Nhập nội dung đoạn trích..."
                                      />
                                      <div className="flex items-center justify-between text-[11px] pt-1">
                                        <span className="text-muted-foreground text-[10px]">
                                          {row.isVerbatim ? '⚠️ Lưu ý: Sau khi lưu câu chữ mới, đoạn sẽ tự động chuyển sang Chờ duyệt.' : 'Đoạn tóm tắt tổng hợp'}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setEditingRowId(null)}
                                            disabled={editSaving}
                                            className="h-7 text-xs px-2.5"
                                          >
                                            Hủy
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            onClick={async () => {
                                              if (editingText.trim().length < 20) {
                                                toast.error('Đoạn trích phải có ít nhất 20 ký tự.');
                                                return;
                                              }
                                              await updateSavedUnit(row, { evidence_text: editingText.trim() });
                                              setEditingRowId(null);
                                            }}
                                            disabled={editSaving || editingText.trim() === row.evidenceText.trim()}
                                            className="h-7 text-xs px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-1"
                                          >
                                            <span>💾 Lưu nội dung</span>
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="rounded-lg bg-muted/20 dark:bg-muted/10 border border-border/60 p-3 pl-3.5 border-l-4 border-l-emerald-600 shadow-2xs max-h-72 overflow-y-auto space-y-1">
                                      {renderParagraphWithHighlight(row.id, row.evidenceText)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ========================================================================= */}
                {/* TAB 2: NẠP THÊM DỮ LIỆU BÀI BÁO (GIAO DIỆN CHUẨN NHẬP BÀI BÁO ĐẦY ĐỦ CHỨC NĂNG) */}
                {/* ========================================================================= */}
                <TabsContent value="reparse" className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Cột trái: Form nhập bài báo (URL + Tip Ctrl+A + Dán toàn văn + Nút Bóc tách) */}
                    <div className="lg:col-span-5 space-y-4">
                      <Card className="border-border bg-card shadow-xs">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-emerald-700" />
                            <span>Dán lại văn bản để bóc tách thêm</span>
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Hệ thống sẽ bóc tách các đoạn mới và tự động lọc bỏ những đoạn đã lưu ở Tab 1 để tránh trùng lặp.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <form onSubmit={handleParseArticle} className="space-y-4 text-xs">
                            <div>
                              <label className="font-semibold text-foreground block mb-1">
                                1. Đường dẫn URL bài viết gốc *
                              </label>
                              <div className="flex items-center gap-1.5">
                                <Input
                                  type="url"
                                  value={editUrl || ingestUrl}
                                  readOnly
                                  className="text-xs flex-1 bg-muted/40 cursor-default"
                                />
                                {isSafeHttpUrl(editUrl || ingestUrl) && (
                                  <a
                                    href={(editUrl || ingestUrl)!.trim()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center h-8 px-2.5 border border-border rounded-md bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-xs shrink-0 transition-colors"
                                    title="Mở link bài viết trong tab mới để copy văn bản"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
                                  </a>
                                )}
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-[11px] text-muted-foreground">
                                  Đang nạp thêm cho bài viết này
                                </span>
                                <button
                                  type="button"
                                  onClick={openAddImageModal}
                                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 transition-colors"
                                >
                                  <Camera className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>Thêm ảnh triệu chứng bài này</span>
                                  {articleImages.length > 0 && (
                                    <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded-full text-[10px] font-bold">
                                      {articleImages.length}
                                    </span>
                                  )}
                                </button>
                              </div>
                            </div>

                            {renderArticleEditorSection({ isReparseTab: true })}

                            <Button
                              type="submit"
                              disabled={ingesting}
                              className="w-full gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-10"
                            >
                              {ingesting ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  <span>Đang bóc tách &amp; Phân tích văn bản...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4" />
                                  <span>Tách đoạn &amp; Phân tích dữ liệu mới</span>
                                </>
                              )}
                            </Button>
                          </form>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Cột phải: Thông tin bài viết & Danh sách đoạn trích mới (Bỏ hẳn banner so sánh rời rạc) */}
                    <div className="lg:col-span-7 space-y-4">
                      {!ingestionResult ? (
                        <div className="p-12 text-center bg-card border border-border rounded-xl h-full flex flex-col items-center justify-center space-y-3">
                          <FileText className="w-12 h-12 text-muted-foreground/30" />
                          <h3 className="text-base font-bold text-foreground">Chưa có văn bản bóc tách</h3>
                          <p className="text-xs text-muted-foreground max-w-sm">
                            Dán nội dung vào ô bên trái rồi bấm <strong>"Tách đoạn &amp; Phân tích dữ liệu mới"</strong> để AI bóc tách các đoạn mới và đề xuất thông tin bài viết.
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Card 1: Thông tin bài viết & Phân loại: Lấp lánh từng ô, nhấp mở popover Áp dụng/Bỏ qua, hỗ trợ thu gọn */}
                          {(() => {
                            const meta = ingestionResult.suggested_metadata;
                            const suggestedTitle = meta?.source_title?.trim() || '';
                            const { org: suggestedOrg, author: suggestedAuthor } = parseCombinedOrg(meta?.organization);
                            const { pubDate: suggestedPubDate, upDate: suggestedUpDate } = parseCombinedDate(meta?.published_date);

                            const hasTitleDiff = !!suggestedTitle && suggestedTitle !== ingestTitle.trim() && !dismissedAiFields['title'];
                            const hasOrgDiff = !!suggestedOrg && suggestedOrg !== ingestOrg.trim() && !dismissedAiFields['org'];
                            const hasAuthorDiff = !!suggestedAuthor && suggestedAuthor !== ingestAuthor.trim() && !dismissedAiFields['author'];
                            const hasPubDateDiff = !!suggestedPubDate && suggestedPubDate !== ingestPublishedDate.trim() && !dismissedAiFields['pubDate'];
                            const hasUpDateDiff = !!suggestedUpDate && suggestedUpDate !== ingestUpdatedDate.trim() && !dismissedAiFields['upDate'];
                            const pendingDiffCount =
                              (hasTitleDiff ? 1 : 0) +
                              (hasOrgDiff ? 1 : 0) +
                              (hasAuthorDiff ? 1 : 0) +
                              (hasPubDateDiff ? 1 : 0) +
                              (hasUpDateDiff ? 1 : 0);

                            return (
                              <Card className="border-border bg-card shadow-xs transition-all">
                                <CardHeader className="py-2.5 px-4 border-b border-border bg-muted/20">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <FileText className="w-4 h-4 text-emerald-700" />
                                      <CardTitle className="text-xs font-bold text-foreground">
                                        Thông tin bài viết &amp; Phân loại
                                      </CardTitle>
                                      {pendingDiffCount > 0 && (
                                        <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] gap-1 animate-pulse">
                                          <Sparkles className="w-3 h-3 text-amber-600" />
                                          {pendingDiffCount} ô có AI đề xuất
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      {pendingDiffCount > 0 && (
                                        <>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                              setDismissedAiFields((prev) => ({
                                                ...prev,
                                                title: true,
                                                org: true,
                                                author: true,
                                                pubDate: true,
                                                upDate: true,
                                              }));
                                              setActiveAiPopoverField(null);
                                              toast.info('Đã bỏ qua các đề xuất của AI.');
                                            }}
                                            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                                            title="Bỏ qua tất cả các gợi ý của AI và giữ nguyên dữ liệu hiện tại"
                                          >
                                            Bỏ qua tất cả
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => {
                                              if (suggestedTitle) setIngestTitle(suggestedTitle);
                                              if (suggestedOrg) setIngestOrg(suggestedOrg);
                                              if (suggestedAuthor) setIngestAuthor(suggestedAuthor);
                                              if (suggestedPubDate) setIngestPublishedDate(suggestedPubDate);
                                              if (suggestedUpDate) setIngestUpdatedDate(suggestedUpDate);
                                              setDismissedAiFields((prev) => ({
                                                ...prev,
                                                title: true,
                                                org: true,
                                                author: true,
                                                pubDate: true,
                                                upDate: true,
                                              }));
                                              setActiveAiPopoverField(null);
                                              setIsMetaCardCollapsed(true);
                                              toast.success('Đã áp dụng toàn bộ đề xuất của AI và thu gọn form!');
                                            }}
                                            className="h-6 px-2 text-[10px] bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-1"
                                            title="Áp dụng toàn bộ gợi ý AI vào form và tự động thu gọn"
                                          >
                                            <Check className="w-3 h-3" />
                                            Áp dụng tất cả
                                          </Button>
                                        </>
                                      )}

                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setIsMetaCardCollapsed(!isMetaCardCollapsed)}
                                        className="h-6 px-2 text-[10px] gap-1 border-border text-muted-foreground hover:text-foreground"
                                        title={isMetaCardCollapsed ? 'Mở rộng form thông tin bài viết' : 'Thu gọn form để tập trung xem các đoạn trích'}
                                      >
                                        {isMetaCardCollapsed ? (
                                          <>
                                            <ChevronDown className="w-3 h-3" />
                                            <span>Mở rộng form</span>
                                          </>
                                        ) : (
                                          <>
                                            <ChevronUp className="w-3 h-3" />
                                            <span>Thu gọn</span>
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                </CardHeader>

                                {isMetaCardCollapsed ? (
                                  renderMetaCollapsedSummary()
                                ) : (
                                  /* Chế độ mở rộng: Các ô input sạch sẽ, ô có AI đề xuất sẽ có viền lấp lánh nhẹ và popover */
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
                                          <option value="">-- Chọn loài cây --</option>
                                          {uniquePlants.map((plant) => (
                                            <option key={plant} value={plant}>
                                              {plant}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      {renderSourceScopeSelect()}
                                      <div className="sm:col-span-2">
                                        {renderArticleTopicsSelector()}
                                      </div>
                                    </div>

                                    {/* Tiêu đề bài viết trích dẫn */}
                                    {renderAiMetaFieldInput({
                                      fieldKey: 'title',
                                      label: 'Tiêu đề bài viết trích dẫn *',
                                      value: ingestTitle,
                                      onChange: setIngestTitle,
                                      placeholder: 'Tiêu đề bài viết...',
                                      hasDiff: hasTitleDiff,
                                      suggestedValue: suggestedTitle,
                                      applyToast: 'Đã áp dụng tiêu đề AI đề xuất!',
                                    })}

                                    {/* Cơ quan & Tác giả */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                      {renderAiMetaFieldInput({
                                        fieldKey: 'org',
                                        label: 'Cơ quan / Viện nghiên cứu *',
                                        value: ingestOrg,
                                        onChange: setIngestOrg,
                                        placeholder: 'Trung tâm Khuyến nông...',
                                        hasDiff: hasOrgDiff,
                                        suggestedValue: suggestedOrg,
                                        applyToast: 'Đã áp dụng cơ quan AI đề xuất!',
                                      })}

                                      {renderAiMetaFieldInput({
                                        fieldKey: 'author',
                                        label: 'Tác giả / Nhóm nghiên cứu',
                                        value: ingestAuthor,
                                        onChange: setIngestAuthor,
                                        placeholder: '(Để trống nếu không rõ tác giả)',
                                        mutedPlaceholder: true,
                                        hasDiff: hasAuthorDiff,
                                        suggestedValue: suggestedAuthor,
                                        applyToast: 'Đã áp dụng tác giả AI đề xuất!',
                                        popoverAlign: 'right',
                                      })}
                                    </div>

                                    {/* Ngày đăng & Ngày cập nhật */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                      {renderAiMetaFieldInput({
                                        fieldKey: 'pubDate',
                                        label: 'Ngày đăng / xuất bản',
                                        value: ingestPublishedDate,
                                        onChange: setIngestPublishedDate,
                                        placeholder: '03/01/2024',
                                        hasDiff: hasPubDateDiff,
                                        suggestedValue: suggestedPubDate,
                                        applyToast: 'Đã áp dụng ngày xuất bản AI đề xuất!',
                                      })}

                                      {renderAiMetaFieldInput({
                                        fieldKey: 'upDate',
                                        label: 'Ngày cập nhật (nếu có)',
                                        value: ingestUpdatedDate,
                                        onChange: setIngestUpdatedDate,
                                        placeholder: '(Để trống nếu không có)',
                                        mutedPlaceholder: true,
                                        hasDiff: hasUpDateDiff,
                                        suggestedValue: suggestedUpDate,
                                        applyToast: 'Đã áp dụng ngày cập nhật AI đề xuất!',
                                        popoverAlign: 'right',
                                      })}
                                    </div>
                                  </CardContent>
                                )}
                              </Card>
                            );
                          })()}

                          {/* Card 2: Danh sách các đoạn trích mới (Đã tự động loại bỏ các đoạn đã lưu ở Tab 1) */}
                          {(() => {
                            const newParagraphs = ingestionResult.paragraphs.filter(
                              (p) => !savedVerbatimTexts.has(collapseWs(p.text))
                            );
                            const suggestedNewParagraphs = ingestionResult.ai_suggestion_available
                              ? newParagraphs.filter((p) => p.suggested_unit_type !== null)
                              : newParagraphs;
                            const unselectedNewParagraphs = ingestionResult.ai_suggestion_available
                              ? newParagraphs.filter((p) => p.suggested_unit_type === null)
                              : [];

                            if (newParagraphs.length === 0) {
                              return (
                                <div className="p-6 text-center bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs space-y-2">
                                  <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto" />
                                  <div className="font-bold text-sm">Tất cả các đoạn trích đã được lưu trong CSDL!</div>
                                  <p className="text-[11px] text-emerald-700 max-w-sm mx-auto">
                                    Không tìm thấy đoạn trích mới nào so với các đoạn đã lưu ở Tab 1. Bạn có thể quay lại Tab 1 để xem và duyệt các đoạn này.
                                  </p>
                                </div>
                              );
                            }

                            return (
                              <Card className="border-border bg-card shadow-xs">
                                <CardHeader className="pb-3 border-b border-border">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <div>
                                      <CardTitle className="text-xs font-bold flex items-center gap-2">
                                        <span>Đoạn trích mới ({newParagraphs.length} đoạn chưa lưu)</span>
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
                                        Tick chọn các đoạn cần nạp thêm vào bài viết này (tối đa 30 đoạn nguyên văn/bài).
                                      </CardDescription>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={handleSelectAllAiSuggested}
                                        className="h-6 text-[10px] gap-1 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-300 font-semibold"
                                        title="Tự động tick chọn tất cả các đoạn trích theo gợi ý của AI"
                                      >
                                        <Sparkles className="w-3 h-3 text-emerald-700" />
                                        <span>Chọn tất cả đoạn AI gợi ý</span>
                                      </Button>
                                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px]">
                                        Mới chọn: {countSelected}
                                      </Badge>
                                      <Badge
                                        variant="secondary"
                                        className={
                                          countWithSaved >= 30
                                            ? 'bg-amber-100 text-amber-900 border border-amber-300 text-[11px]'
                                            : 'bg-muted text-foreground text-[11px]'
                                        }
                                      >
                                        Tổng nguyên văn: {countWithSaved} / 30 đoạn (Tab 1 đã lưu {existingVerbatimCount})
                                      </Badge>
                                      <Badge
                                        variant="secondary"
                                        className={charsWithSaved > allowedCharsQuota ? 'bg-destructive text-white' : 'bg-muted text-foreground text-[11px]'}
                                      >
                                        <span title="Giới hạn = 60% độ dài bài, tối thiểu 2.500 ký tự">
                                          Ký tự: {charsWithSaved.toLocaleString('vi-VN')} / {allowedCharsQuota.toLocaleString('vi-VN')} ({Math.min(100, Math.round((charsWithSaved / allowedCharsQuota) * 100))}%)
                                        </span>
                                      </Badge>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
                                  {countWithSaved >= 30 && (
                                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-2.5 shadow-2xs">
                                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                                      <div className="space-y-1">
                                        <p className="font-semibold text-amber-900">
                                          Bài viết đã đạt giới hạn tối đa 30 đoạn nguyên văn (Tab 1 đã lưu {existingVerbatimCount} đoạn).
                                        </p>
                                        <p className="text-[11px] text-amber-800 leading-relaxed">
                                          Các ô chọn đoạn mới đang được khóa để bảo đảm tính hợp lý khi trích dẫn. Bạn hãy chuyển sang <strong>Tab 1 (Các đoạn trích đã lưu)</strong> để xóa bớt đoạn cũ hoặc bấm <strong>"Xóa toàn bộ đoạn cũ"</strong> để nạp lại từ đầu.
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  {suggestedNewParagraphs.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic text-center py-2">
                                      AI không đề xuất thêm đoạn nào trong phần chưa lưu; bạn có thể mở mục 'Đoạn AI không chọn' bên dưới để kiểm tra và tick thủ công.
                                    </p>
                                  ) : (
                                    suggestedNewParagraphs.map((para) => renderParagraphReviewCard(para))
                                  )}

                                  {renderUnselectedParagraphsAccordion(unselectedNewParagraphs)}

                                  <div className="pt-3 border-t border-border flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">
                                      Đã chọn <strong>{countSelected}</strong> đoạn mới cần lưu.
                                    </span>
                                    <Button
                                      type="button"
                                      onClick={handleCommitParagraphs}
                                      disabled={committing || countSelected === 0 || countWithSaved > 30}
                                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-9 text-xs px-4"
                                    >
                                      {committing ? 'Đang lưu...' : `Lưu & Duyệt ${countSelected} đoạn mới`}
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )
        ) : (
          /* ========================================================================= */
          /* CHẾ ĐỘ NHẬP BÀI BÁO MỚI (HITL INGESTION) */
          /* ========================================================================= */
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
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="url"
                          placeholder="https://khuyennongvn.gov.vn/..."
                          value={ingestUrl}
                          onChange={(e) => {
                            setIngestUrl(e.target.value);
                            if (ingestionResult) resetArticleState();
                          }}
                          required
                          className="text-xs flex-1"
                        />
                        {isSafeHttpUrl(ingestUrl) && (
                          <a
                            href={ingestUrl.trim()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-8 px-2.5 border border-border rounded-md bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-xs shrink-0 transition-colors"
                            title="Mở link bài viết trong tab mới"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] text-muted-foreground">
                          {ingestUrl ? 'Đã liên kết nguồn' : 'Dán link trang báo khuyến nông'}
                        </span>
                        <button
                          type="button"
                          onClick={openAddImageModal}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 transition-colors"
                        >
                          <Camera className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Thêm ảnh triệu chứng từ bài này</span>
                          {articleImages.length > 0 && (
                            <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded-full text-[10px] font-bold">
                              {articleImages.length}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>

                    {renderArticleEditorSection()}

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

            {/* Cột phải: Thông tin & Danh sách đoạn trích mới */}
            <div className="lg:col-span-7 space-y-4">
              {ingestionResult && (
                <Card className="border-border bg-card shadow-xs transition-all">
                  <CardHeader className="py-3 px-4 border-b border-border bg-muted/20">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-xs font-bold flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-700" />
                        <span>Thông tin bài viết &amp; Phân loại</span>
                      </CardTitle>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-emerald-800 border-emerald-300 bg-emerald-50 text-[10px]">
                          AI đề xuất, vui lòng kiểm tra lại
                        </Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setIsMetaCardCollapsed(!isMetaCardCollapsed)}
                          className="h-6 px-2 text-[10px] gap-1 border-border text-muted-foreground hover:text-foreground"
                          title={isMetaCardCollapsed ? 'Mở rộng form thông tin bài viết' : 'Thu gọn form để tập trung xem các đoạn trích'}
                        >
                          {isMetaCardCollapsed ? (
                            <>
                              <ChevronDown className="w-3 h-3" />
                              <span>Mở rộng form</span>
                            </>
                          ) : (
                            <>
                              <ChevronUp className="w-3 h-3" />
                              <span>Thu gọn</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {isMetaCardCollapsed ? (
                    renderMetaCollapsedSummary()
                  ) : (
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
                            <option value="">-- Chọn loài cây --</option>
                            {uniquePlants.map((plant) => (
                              <option key={plant} value={plant}>
                                {plant}
                              </option>
                            ))}
                          </select>
                        </div>
                        {renderSourceScopeSelect()}
                        <div className="sm:col-span-2">
                          {renderArticleTopicsSelector()}
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="font-semibold text-foreground block mb-1">
                            Cơ quan / Viện nghiên cứu *
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
                            Tác giả / Nhóm nghiên cứu
                          </label>
                          <Input
                            type="text"
                            value={ingestAuthor}
                            onChange={(e) => setIngestAuthor(e.target.value)}
                            placeholder="(Để trống nếu không rõ tác giả)"
                            className="text-xs bg-background placeholder:text-muted-foreground/35 placeholder:italic"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="font-semibold text-foreground block mb-1">
                            Ngày đăng / xuất bản
                          </label>
                          <Input
                            type="text"
                            value={ingestPublishedDate}
                            onChange={(e) => setIngestPublishedDate(e.target.value)}
                            placeholder="03/01/2024"
                            className="text-xs bg-background"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-foreground block mb-1">
                            Ngày cập nhật (nếu có)
                          </label>
                          <Input
                            type="text"
                            value={ingestUpdatedDate}
                            onChange={(e) => setIngestUpdatedDate(e.target.value)}
                            placeholder="(Để trống nếu không có)"
                            className="text-xs bg-background placeholder:text-muted-foreground/35 placeholder:italic"
                          />
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}

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
                            Quy tắc trích dẫn hợp lý: <strong>Tối đa 30 đoạn nguyên văn</strong> (≤ {MAX_SNIPPET_CHARS.toLocaleString('vi-VN')} ký tự/đoạn, tổng ≤ 60% bài). Tick = Duyệt.
                          </CardDescription>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleSelectAllAiSuggested}
                            className="h-6 text-[10px] gap-1 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-300 font-semibold"
                            title="Tự động tick chọn tất cả các đoạn trích theo gợi ý của AI"
                          >
                            <Sparkles className="w-3 h-3 text-emerald-700" />
                            <span>Chọn tất cả đoạn AI gợi ý</span>
                          </Button>
                          <Badge
                            variant="secondary"
                            className={countWithSaved > 30 ? 'bg-destructive text-white' : 'bg-muted text-foreground text-[11px]'}
                          >
                            Đoạn: {countWithSaved} / 30
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={charsWithSaved > allowedCharsQuota ? 'bg-destructive text-white' : 'bg-muted text-foreground text-[11px]'}
                          >
                            <span title="Giới hạn = 60% độ dài bài, tối thiểu 2.500 ký tự">
                              Ký tự: {charsWithSaved.toLocaleString('vi-VN')} / {allowedCharsQuota.toLocaleString('vi-VN')} ({((charsWithSaved / allowedCharsQuota) * 100).toFixed(0)}%)
                            </span>
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 flex-1 overflow-y-auto max-h-[500px] space-y-3">
                      {/* Danh sách các đoạn liên quan & nhóm đoạn AI không chọn */}
                      {(() => {
                        const suggestedList = ingestionResult.ai_suggestion_available
                          ? ingestionResult.paragraphs.filter((p) => p.suggested_unit_type !== null)
                          : ingestionResult.paragraphs;
                        const unselectedList = ingestionResult.ai_suggestion_available
                          ? ingestionResult.paragraphs.filter((p) => p.suggested_unit_type === null)
                          : [];

                        return (
                          <>
                            {suggestedList.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic text-center py-2">
                                AI chưa chọn đoạn nổi bật nào; bạn có thể mở mục 'Đoạn AI không chọn' bên dưới để tự chọn.
                              </p>
                            ) : (
                              suggestedList.map((para) => renderParagraphReviewCard(para))
                            )}

                            {renderUnselectedParagraphsAccordion(unselectedList)}
                          </>
                        );
                      })()}
                    </CardContent>

                    <div className="p-4 border-t border-border bg-muted/20 space-y-3">
                      <Input
                        type="text"
                        placeholder="Ghi chú người duyệt (ví dụ: Đã đối chiếu thông tư Cục BVTV)"
                        value={commitNotes}
                        onChange={(e) => setCommitNotes(e.target.value)}
                        className="text-xs bg-background"
                      />

                      {charsWithSaved > allowedCharsQuota && (
                        <p className="text-xs text-destructive font-medium">
                          {existingVerbatimChars > 0 ? `Đã lưu ${existingVerbatimChars.toLocaleString('vi-VN')} + chọn thêm ` : 'Đã chọn '}{totalSelectedChars.toLocaleString('vi-VN')} ký tự, vượt giới hạn trích dẫn {allowedCharsQuota.toLocaleString('vi-VN')} ký tự
                          (60% bài, tối thiểu 2.500). Bỏ bớt đoạn để lưu được.
                        </p>
                      )}
                      {!ingestClass && (
                        <p className="text-xs text-destructive font-medium">Chọn Loài cây và Bệnh hại mục tiêu ở trên trước khi lưu.</p>
                      )}
                      <Button
                        onClick={handleCommitParagraphs}
                        disabled={committing || editSaving || countSelected === 0 || countWithSaved > 30 || charsWithSaved > allowedCharsQuota || !ingestClass}
                        className="w-full gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-11"
                      >
                        {committing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Đang ghi CSDL &amp; Đồng bộ tri thức AI...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Duyệt &amp; Lưu {countSelected} Đoạn Nguyên Văn (Đồng bộ tri thức)</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================================= */}
      {/* DIALOG KIỂM TRA TRẠNG THÁI REINDEX */}
      {/* ========================================================================================= */}

      {/* ========================================================================================= */}
      {/* DIALOG TÁCH ĐOẠN TRÍCH DẪN (AN TOÀN NGUYÊN VĂN THEO LUẬT SHTT) */}
      {/* ========================================================================================= */}
      <Dialog open={splitModalOpen} onOpenChange={(open) => {
        setSplitModalOpen(open);
        if (!open) {
          setSplitTargetSavedRow(null);
          setSplitTargetPara(null);
        }
      }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Scissors className="w-4 h-4 text-emerald-700" />
              <span>
                Chia đoạn trích dẫn {splitTargetSavedRow ? `(Đoạn #${editRows.findIndex((r) => r.id === splitTargetSavedRow.id) + 1})` : splitTargetPara ? `(${splitTargetPara.id})` : ''}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Mỗi đoạn tối đa {MAX_SNIPPET_CHARS.toLocaleString('vi-VN')} ký tự. Bạn có thể nhấp chuột vào biểu tượng ✂️ sau bất kỳ câu nào để đặt một hoặc nhiều mốc cắt, chia thành nhiều đoạn nhỏ tùy ý.
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const activeText = splitTargetSavedRow ? splitTargetSavedRow.evidenceText : splitTargetPara ? splitTargetPara.text : '';
            if (!activeText) return null;

            const targetTitle = splitTargetSavedRow
              ? `Đoạn #${editRows.findIndex((r) => r.id === splitTargetSavedRow.id) + 1}`
              : splitTargetPara?.id || '';
            const minCharLen = splitTargetSavedRow ? 20 : 30;

            const regex = /[^.!?;\r\n]+(?:[.!?;\r\n]+|$)/g;
            const matches = activeText.match(regex);
            const sents = matches ? matches.map((s) => s.trim()).filter(Boolean) : [activeText];
            const parts = computeSplitParts(activeText, selectedCutIndices);
            const hasInvalidPart = parts.some((p) => p.length < minCharLen || p.length > MAX_SNIPPET_CHARS);

            return (
              <div className="space-y-4 py-2 text-xs">
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-blue-900 text-[11px] flex items-start gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Bảo vệ bản quyền nguyên văn:</strong> Nhấp vào nút <strong>[✂️ Đặt mốc cắt]</strong> sau câu mong muốn để chia đoạn. Nhấp lại để hủy mốc. Các đoạn con sẽ giữ 100% câu chữ nguyên gốc.
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-muted/40 p-2.5 rounded-lg border border-border">
                  <div>
                    <span>Đoạn gốc: <strong className="font-mono text-foreground">{activeText.length}</strong> ký tự ({sents.length} câu)</span>
                    <span className="mx-2 text-muted-foreground/40">•</span>
                    <span className="font-semibold text-emerald-800">
                      Đang chọn chia thành {parts.length} đoạn ({selectedCutIndices.length} mốc cắt)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedCutIndices([])}
                      disabled={selectedCutIndices.length === 0}
                      className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      Xóa các mốc
                    </Button>
                  </div>
                </div>

                {/* Danh sách câu với các nút mốc cắt tương tác */}
                {sents.length > 1 && (
                  <div className="p-3 bg-muted/20 rounded-lg border border-border space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span>Văn bản và các điểm ngắt câu:</span>
                      <span className="text-[11px] text-muted-foreground font-normal">Nhấp vào mốc để bật/tắt điểm chia</span>
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto p-3 bg-background rounded border border-border/70 text-xs leading-relaxed font-sans">
                      {sents.map((sent, idx) => {
                        const isCutAfterThis = selectedCutIndices.includes(idx);
                        const cutOrder = selectedCutIndices.indexOf(idx) + 1;
                        const isLast = idx === sents.length - 1;

                        return (
                          <React.Fragment key={idx}>
                            <span className={isCutAfterThis ? 'text-emerald-950 font-medium bg-emerald-50/60 px-1 py-0.5 rounded' : 'text-foreground'}>
                              {sent}{' '}
                            </span>
                            {!isLast && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCutIndices((prev) => {
                                    if (prev.includes(idx)) {
                                      return prev.filter((x) => x !== idx).sort((a, b) => a - b);
                                    } else {
                                      return [...prev, idx].sort((a, b) => a - b);
                                    }
                                  });
                                }}
                                className={`inline-flex items-center gap-1 mx-1 my-0.5 px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                  isCutAfterThis
                                    ? 'bg-emerald-700 text-white shadow-xs scale-105'
                                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300'
                                }`}
                                title={isCutAfterThis ? 'Bấm để hủy mốc cắt này' : 'Bấm để ngắt câu tại đây'}
                              >
                                <Scissors className="w-2.5 h-2.5" />
                                <span>{isCutAfterThis ? `Mốc #${cutOrder}` : 'Cắt tại đây'}</span>
                              </button>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Danh sách các đoạn con sẽ được tạo ra (Preview) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-foreground">
                    <span>Xem trước {parts.length} đoạn con sau khi chia:</span>
                    {hasInvalidPart && (
                      <span className="text-destructive text-[11px] font-normal">
                        Có đoạn con vượt quá {MAX_SNIPPET_CHARS.toLocaleString('vi-VN')} ký tự hoặc quá ngắn (&lt; {minCharLen} ký tự)
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {parts.map((partText, pIdx) => {
                      const len = partText.length;
                      const isTooLong = len > MAX_SNIPPET_CHARS;
                      const isTooShort = len < minCharLen;

                      return (
                        <div key={pIdx} className="p-2.5 bg-background rounded-lg border border-border space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-emerald-800 text-xs">
                              Đoạn #{pIdx + 1} ({targetTitle}_{pIdx + 1})
                            </span>
                            <span
                              className={`text-[11px] font-mono font-medium ${
                                isTooLong || isTooShort ? 'text-destructive font-bold' : 'text-emerald-700'
                              }`}
                            >
                              {len} / {MAX_SNIPPET_CHARS.toLocaleString('vi-VN')} ký tự{' '}
                              {isTooLong ? `(Quá dài > ${MAX_SNIPPET_CHARS.toLocaleString('vi-VN')})` : isTooShort ? `(Quá ngắn < ${minCharLen})` : '(Hợp lệ)'}
                            </span>
                          </div>
                          <p className="text-xs text-foreground/80 italic leading-relaxed line-clamp-3 select-all bg-muted/30 p-2 rounded">
                            "{partText}"
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          <DialogFooter className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSplitModalOpen(false);
                setSplitTargetSavedRow(null);
                setSplitTargetPara(null);
              }}
            >
              Hủy
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmSplit}
              disabled={(() => {
                const activeText = splitTargetSavedRow ? splitTargetSavedRow.evidenceText : splitTargetPara ? splitTargetPara.text : '';
                if (!activeText || selectedCutIndices.length === 0) return true;
                const minCharLen = splitTargetSavedRow ? 20 : 30;
                const parts = computeSplitParts(activeText, selectedCutIndices);
                return parts.length < 2 || parts.some((p) => p.length < minCharLen || p.length > MAX_SNIPPET_CHARS);
              })()}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
            >
              Xác nhận chia thành {selectedCutIndices.length + 1} đoạn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================================= */}
      {/* DIALOG THÊM ẢNH TRIỆU CHỨNG BỆNH CHO BÀI VIẾT (TẠI CHỖ, KHÔNG CHUYỂN TRANG) */}
      {/* ========================================================================================= */}
      <Dialog open={addImageModalOpen} onOpenChange={setAddImageModalOpen}>
        <DialogContent className="sm:max-w-xl w-[95vw] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-xl border border-border bg-card">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 pr-12 relative shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-emerald-950 dark:text-emerald-300">
              <Camera className="w-5 h-5 text-emerald-700" />
              <span>Thêm ảnh triệu chứng cho bài viết</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Tải ảnh lên từ máy tính hoặc dán URL hình ảnh từ bài viết để đính kèm vào kho tri thức của bài này.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 space-y-4 text-xs">
            {/* URL nguồn bài viết liên kết */}
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border/80 flex items-center justify-between gap-2">
              <div className="truncate">
                <span className="font-semibold text-foreground">Bài viết liên kết: </span>
                <span className="text-muted-foreground font-mono text-[11px]" title={editUrl || ingestUrl || ''}>
                  {editUrl || ingestUrl || 'Chưa có URL'}
                </span>
              </div>
              {isSafeHttpUrl(editUrl || ingestUrl) && (
                <a
                  href={(editUrl || ingestUrl)!.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 hover:text-emerald-800 shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Mở bài</span>
                </a>
              )}
            </div>

            {/* Chọn bộ phận cây bằng 4 nút thân thiện (như AdminImagesPage) */}
            <div>
              <label className="font-semibold text-foreground block mb-1.5">
                1. Bộ phận cây nhiễm bệnh *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                    className={`rounded-lg py-2 px-2 text-xs font-semibold border transition-all text-center ${
                      newImagePlantPart === part.id
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                        : 'bg-muted/40 text-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {part.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chuyên đề / Bệnh liên kết */}
            <div>
              <label className="font-semibold text-foreground block mb-1">
                2. Chuyên đề / Bệnh liên kết *
              </label>
              <select
                value={newImageClass}
                onChange={(e) => setNewImageClass(e.target.value)}
                className="w-full px-2.5 py-2 bg-background border border-border rounded-lg text-xs font-medium"
              >
                <option value="">-- Chọn bệnh / chuyên đề --</option>
                {diseases.map((d) => (
                  <option key={d.classCode} value={d.classCode}>
                    {d.plantName} - {formatTopicLabel(d.commonNameVi, d.classCode)}
                  </option>
                ))}
              </select>
            </div>

            {/* Nguồn cung cấp ảnh: Tab Dán URL & Tải file */}
            <div className="space-y-2 rounded-xl border border-border p-3.5 bg-muted/20">
              <label className="font-semibold text-foreground block">
                3. Nguồn cung cấp ảnh *
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewImageMode('URL')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                    newImageMode === 'URL'
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                      : 'bg-background text-foreground border-border hover:bg-muted'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Dán link HTTPS ảnh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewImageMode('FILE')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                    newImageMode === 'FILE'
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                      : 'bg-background text-foreground border-border hover:bg-muted'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Tải ảnh từ máy tính</span>
                </button>
              </div>

              {newImageMode === 'URL' ? (
                <div className="space-y-2 pt-1">
                  <Textarea
                    placeholder="Dán 1 hoặc nhiều link HTTPS ảnh (mỗi link 1 dòng)...&#10;https://example.com/anh1.jpg&#10;https://example.com/anh2.jpg"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    rows={3}
                    className="text-xs bg-background font-mono"
                  />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Hỗ trợ dán nhiều URL cùng lúc, mỗi dòng một URL.</span>
                    {parsedImageUrls.length > 0 && (
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        Đã nhận diện {parsedImageUrls.length} ảnh
                      </span>
                    )}
                  </div>

                  {/* LIVE PREVIEW ẢNH KHI DÁN URL */}
                  {parsedImageUrls.length > 0 && (
                    <div className="p-2.5 rounded-lg border border-border bg-background/80 space-y-1.5">
                      <div className="text-[11px] font-semibold text-muted-foreground">
                        Xem trước ({parsedImageUrls.length} ảnh từ link):
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                        {parsedImageUrls.map((url, idx) => (
                          <div
                            key={idx}
                            className="relative aspect-4/3 rounded-lg overflow-hidden border border-border bg-muted/30 shadow-2xs"
                          >
                            <img
                              src={url}
                              alt={`Ảnh URL ${idx + 1}`}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                const el = e.target as HTMLImageElement;
                                el.style.opacity = '0.3';
                              }}
                            />
                            <div className="absolute top-1 left-1 bg-black/70 text-white text-[9px] px-1.5 py-0.2 rounded font-bold">
                              #{idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleImageFileChange}
                    className="text-xs bg-background cursor-pointer"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Định dạng hỗ trợ: JPG, PNG, WebP. Có thể chọn nhiều tệp cùng lúc.
                  </p>

                  {/* PREVIEW TỆP ẢNH TẢI LÊN */}
                  {newImageFilePreviews.length > 0 && (
                    <div className="p-2.5 rounded-lg border border-border bg-background/80 space-y-1.5">
                      <div className="text-[11px] font-semibold text-muted-foreground">
                        Xem trước ({newImageFilePreviews.length} tệp đã chọn):
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                        {newImageFilePreviews.map((src, idx) => (
                          <div
                            key={idx}
                            className="relative aspect-4/3 rounded-lg overflow-hidden border border-border bg-muted/30 shadow-2xs"
                          >
                            <img src={src} alt={`Preview ${idx + 1}`} className="h-full w-full object-cover" />
                            <div className="absolute top-1 left-1 bg-black/70 text-white text-[9px] px-1.5 py-0.2 rounded font-bold">
                              #{idx + 1}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setNewImageFiles((prev) => prev.filter((_, i) => i !== idx));
                                setNewImageFilePreviews((prev) => prev.filter((_, i) => i !== idx));
                              }}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow"
                              title="Bỏ tệp này"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mô tả / chú thích triệu chứng: Dạng Textarea có thể xuống dòng */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold text-foreground">
                  4. Chú thích / Mô tả triệu chứng *
                </label>
                <span className="text-[10px] text-muted-foreground">
                  {newImageCaption.length}/300 ký tự
                </span>
              </div>
              <Textarea
                placeholder="Ví dụ: Vết đốm sương mai màu nâu đen xuất hiện ở rìa lá, mặt dưới có lớp nấm trắng mịn trong điều kiện ẩm ướt."
                value={newImageCaption}
                onChange={(e) => setNewImageCaption(e.target.value)}
                maxLength={300}
                rows={2}
                className="text-xs resize-y"
              />
            </div>

            {/* Nguồn / Bản quyền */}
            <div>
              <label className="font-semibold text-foreground block mb-1">
                5. Nguồn / Tác giả sở hữu ảnh *
              </label>
              <Input
                type="text"
                value={newImageCredit}
                onChange={(e) => setNewImageCredit(e.target.value)}
                placeholder="Cơ quan / Viện BVTV / Nguồn bài viết"
                className="text-xs bg-background"
              />
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2 shrink-0">
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
              type="button"
              size="sm"
              disabled={submittingImage || !newImageClass || (newImageMode === 'FILE' ? newImageFiles.length === 0 : parsedImageUrls.length === 0)}
              onClick={handleCreateArticleImage}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-1.5"
            >
              {submittingImage ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang tải lên...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tải lên &amp; Lưu vào bài viết</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================================= */}
      {/* DIALOG XEM PHÓNG TO ẢNH TRIỆU CHỨNG */}
      {/* ========================================================================================= */}
      <Dialog open={!!previewingImage} onOpenChange={(open) => !open && setPreviewingImage(null)}>
        <DialogContent className="sm:max-w-xl w-[95vw] flex flex-col p-0 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 pr-12 relative shrink-0">
            <DialogTitle className="text-sm sm:text-base font-bold text-foreground">
              {previewingImage?.caption || 'Xem ảnh triệu chứng bệnh'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
              <span>Mã ảnh #{previewingImage?.id}</span>
              <span>•</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {previewingImage?.plant_name} — {previewingImage?.disease_name}
              </span>
            </DialogDescription>
          </DialogHeader>

          {previewingImage && (
            <div className="p-4 sm:p-5 space-y-3">
              <div className="relative max-h-[360px] overflow-hidden rounded-xl bg-muted/40 flex items-center justify-center border border-border p-2">
                <img
                  src={previewingImage.image_url}
                  alt={previewingImage.caption || 'Ảnh triệu chứng'}
                  className="max-h-[340px] w-auto max-w-full object-contain mx-auto rounded-lg shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs p-3 bg-muted/30 rounded-xl border border-border/60">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Bộ phận:</span>
                  <span className="font-semibold text-foreground">{getPlantPartLabel(previewingImage.plant_part)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Nguồn trích dẫn:</span>
                  <span className="font-semibold text-foreground truncate block" title={previewingImage.credit}>
                    {previewingImage.credit || 'Khuyết'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Trạng thái:</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">Đã duyệt</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Ảnh gốc:</span>
                  <a
                    href={previewingImage.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <span>Mở tab mới</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between sm:justify-between shrink-0">
            {previewingImage && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  const target = previewingImage;
                  setPreviewingImage(null);
                  setDeleteImageTarget(target);
                }}
                className="gap-1.5 text-xs h-9 px-3.5 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Gỡ ảnh này</span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPreviewingImage(null)}
              className="text-xs h-9 px-4 font-medium"
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================================= */}
      {/* DIALOG XÁC NHẬN GỠ ẢNH TRIỆU CHỨNG */}
      {/* ========================================================================================= */}
      <Dialog open={!!deleteImageTarget} onOpenChange={(open) => !open && !deletingImage && setDeleteImageTarget(null)}>
        <DialogContent className="sm:max-w-md w-[95vw] flex flex-col p-0 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 pr-12 relative shrink-0">
            <DialogTitle className="flex items-center gap-2 text-rose-600 text-base font-bold">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>Xác nhận gỡ ảnh triệu chứng</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Bạn có chắc chắn muốn gỡ ảnh #{deleteImageTarget?.id} ({deleteImageTarget ? `bộ phận ${getPlantPartLabel(deleteImageTarget.plant_part)}` : ''}) khỏi bài viết này?
            </DialogDescription>
          </DialogHeader>

          {deleteImageTarget && (
            <div className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl border border-border">
                <img
                  src={deleteImageTarget.image_url}
                  alt="Thumbnail"
                  className="w-16 h-16 object-cover rounded-lg border border-border shrink-0 shadow-2xs"
                />
                <div className="text-xs space-y-1 min-w-0 flex-1">
                  <p className="font-semibold text-foreground line-clamp-2 leading-snug">
                    {deleteImageTarget.caption || 'Ảnh không có chú thích'}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Nguồn: {deleteImageTarget.credit || 'Khuyết nguồn'}
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-2.5 text-[11px] text-rose-800 dark:text-rose-300">
                ⚠️ <strong>Lưu ý:</strong> Hành động này sẽ xóa ảnh khỏi kho tri thức và không thể khôi phục lại.
              </div>
            </div>
          )}

          <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={deletingImage}
              onClick={() => setDeleteImageTarget(null)}
              className="text-xs h-9 px-4 font-medium"
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deletingImage}
              onClick={handleDeleteArticleImage}
              className="gap-1.5 text-xs h-9 px-4 font-semibold shadow-xs"
            >
              {deletingImage ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang gỡ...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xác nhận gỡ ảnh</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================================= */}
      {/* DIALOG TRẠNG THÁI ĐỒNG BỘ TRI THỨC VÀO TRỢ LÝ AI LAVI */}
      {/* ========================================================================================= */}

    </div>
  );
};

export default AdminIngestPage;
