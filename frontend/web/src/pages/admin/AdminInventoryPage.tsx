import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Package,
  Sparkles,
  Search,
  Plus,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Link as LinkIcon,
  Eye,
  CheckCircle2,
  Check,
  X,
  FileText,
  Code2,
  Copy,
  ImageOff,
  Ban,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Pencil,
  CalendarClock,
  RotateCcw,
  Info,
  ChevronDown,
  ChevronUp,
  Wand2,
  Layers,
  Calendar,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import type { MedicineItem, ProductSuggestionItem } from '@/features/admin/types';
import {
  isSafeHttpUrl,
  isIngredientBanned,
  setBannedTerms,
  excerptAroundMention,
  buildGoogleQueries,
  buildProductResearchPrompt,
  dedupeContainedTexts,
  emptyUsageProfile,
  isUsageEmpty,
  normalizeUsageProfile,
  formatUsageText,
  combineDescriptionDosage,
  splitDescriptionDosage,
  validateUsageProfile,
  formatUsageProfileSummary,
  usageProfileForApi,
  type UsageProfile,
  mergeEvidencesByArticle,
  keyMentionSentences,
  buildCropDosagePrompt,
  parseCropDosageJson,
  MAX_PROMPT_EVIDENCES,
  parseProductResearchJson,
  kindFromMedicineType,
  KIND_LABEL,
  type ResearchEvidence,
} from '@/features/admin/lib';
import { HighlightedText } from '@/features/admin/components/HighlightedText';
import { FormattedSnippet } from '@/components/common/FormattedSnippet';
import { UsageProfileEditor } from '@/features/admin/components/UsageProfileEditor';
import { BannedSubstancesTab } from '@/features/admin/components/BannedSubstancesTab';

// Mô tả lưu gộp vào dosage_instruction (cột text, không giới hạn); prompt Gemini yêu cầu 250–450 từ ≈ 1.500–3.000 ký tự
const DESCRIPTION_MAX = 3500;
import { useDiseaseOptions } from '@/features/admin/hooks';
import { safeHref } from '@/lib/utils';

interface EvidenceModalGroup {
  mentionText: string;
  kind: string;
  count: number;
  items: ProductSuggestionItem[];
  status: string;
  plantName: string;
  diseaseName: string;
  productName?: string | null;
}

interface GroupedSuggestion {
  groupKey: string;
  mentionText: string;
  kind: string;
  plantName: string;
  diseaseName: string;
  modelClass: string;
  items: ProductSuggestionItem[];
  primaryItem: ProductSuggestionItem;
  count: number;
  status: 'PENDING' | 'LINKED' | 'ADDED' | 'DISMISSED';
  productName?: string;
  productId?: number;
}

/** TASK-31: khóa cây của gợi ý = phần trước "___" của mã bệnh (khớp KnowledgeController.SuggestionPlantKey). */
const suggestionPlantKey = (modelClass?: string | null) =>
  ((modelClass || '').trim().split('___')[0] || '').toLowerCase();

/** Cùng tên vật tư + cùng cây → cùng nhóm gợi ý (TASK-31). */
const sameSuggestionGroup = (
  a: { mention_text: string; model_class?: string | null },
  b: { mention_text: string; model_class?: string | null }
) =>
  a.mention_text.trim().toLowerCase() === b.mention_text.trim().toLowerCase() &&
  suggestionPlantKey(a.model_class) === suggestionPlantKey(b.model_class);

export const AdminInventoryPage: React.FC = () => {
  const { diseases } = useDiseaseOptions();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlTab = searchParams.get('tab');
  const initialSubTab: 'medicines' | 'suggestions' | 'banned' =
    urlTab === 'suggestions' ? 'suggestions' : urlTab === 'banned' ? 'banned' : 'medicines';
  const urlSearch = searchParams.get('search') || '';

  // Subtab điều hướng: 'medicines' (Kho thuốc & vật tư) vs 'suggestions' (Gợi ý từ bài báo) vs 'banned' (Chất cấm)
  const [inventorySubTab, setInventorySubTab] = useState<'medicines' | 'suggestions' | 'banned'>(initialSubTab);
  // Danh mục chất cấm từ server (TASK-19): đổi danh sách thì vẽ lại huy hiệu "(Cấm)"
  const [, setBannedVersion] = useState(0);
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [loadingMedicines, setLoadingMedicines] = useState<boolean>(false);
  const [medSearch, setMedSearch] = useState<string>('');
  // Phân trang Kho thuốc & vật tư
  const [medPage, setMedPage] = useState<number>(1);
  const [medPageSize, setMedPageSize] = useState<number>(10);

  // Gợi ý vật tư từ bài báo (Task-15 Phase 3)
  const [suggestions, setSuggestions] = useState<ProductSuggestionItem[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);
  const [suggestionStatusFilter, setSuggestionStatusFilter] = useState<string>('ALL');
  const [suggestionKindFilter, setSuggestionKindFilter] = useState<string>('ALL');
  const [suggestionSearch, setSuggestionSearch] = useState<string>(urlSearch);
  // Phân trang Gợi ý vật tư
  const [suggestionPage, setSuggestionPage] = useState<number>(1);
  const [suggestionPageSize, setSuggestionPageSize] = useState<number>(10);

  // Dialog liên kết gợi ý với sản phẩm có sẵn
  const [linkingSuggestion, setLinkingSuggestion] = useState<ProductSuggestionItem | null>(null);
  const [selectedLinkMedId, setSelectedLinkMedId] = useState<number | ''>('');
  const [linkProductSearch, setLinkProductSearch] = useState<string>('');
  const [linkingLoading, setLinkingLoading] = useState<boolean>(false);
  const [linkCustomDosageOpen, setLinkCustomDosageOpen] = useState<boolean>(true);
  const [linkUsageProfile, setLinkUsageProfile] = useState<UsageProfile>(emptyUsageProfile());
  const [linkDosageText, setLinkDosageText] = useState<string>('');
  const [linkSourceUrl, setLinkSourceUrl] = useState<string>('');
  const [showLinkDevMode, setShowLinkDevMode] = useState<boolean>(false);
  const [linkDevAiInput, setLinkDevAiInput] = useState<string>('');
  const [isEditingExistingRule, setIsEditingExistingRule] = useState<boolean>(false);
  const [dosageChoice, setDosageChoice] = useState<'custom' | 'default' | 'crop_inherited'>('custom');
  const [showLinkSnippetDialog, setShowLinkSnippetDialog] = useState<boolean>(false);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);

  // Dialog thêm thuốc / vật tư mới (từ gợi ý hoặc thêm thủ công)
  const [createMedModalOpen, setCreateMedModalOpen] = useState<boolean>(false);
  const [fromSuggestion, setFromSuggestion] = useState<ProductSuggestionItem | null>(null);
  const [newMedName, setNewMedName] = useState<string>('');
  const [newMedType, setNewMedType] = useState<string>('Hóa học');
  const [newMedActiveIngredient, setNewMedActiveIngredient] = useState<string>('');
  const [newMedPrice, setNewMedPrice] = useState<number>(50000);
  const [newMedDosage, setNewMedDosage] = useState<string>('Pha theo hướng dẫn trên bao bì');
  // PHI để trống mặc định: Admin phải tra nhãn/nguồn rồi nhập, hệ thống không tự điền (TASK-15-R37)
  const [newMedPhi, setNewMedPhi] = useState<number | ''>('');
  const [newMedStock, setNewMedStock] = useState<number>(50);
  const [newMedAvailability, setNewMedAvailability] = useState<string>('IN_STOCK');
  const [newMedSourceUrl, setNewMedSourceUrl] = useState<string>('');
  const [newMedImageUrl, setNewMedImageUrl] = useState<string>('');
  const [newMedDescription, setNewMedDescription] = useState<string>('');
  const [newMedTargetDiseases, setNewMedTargetDiseases] = useState<string[]>([]);
  const [newMedIsAllowed, setNewMedIsAllowed] = useState<boolean>(false);
  const [creatingMed, setCreatingMed] = useState<boolean>(false);
  const [showDevMode, setShowDevMode] = useState<boolean>(false);
  const [devGeminiInput, setDevGeminiInput] = useState<string>('');
  const [medImageFailed, setMedImageFailed] = useState<boolean>(false);
  // TASK-17: các đoạn trích làm ngữ cảnh cho prompt AI / gợi ý Google của form, và link nguồn AI đề xuất
  const [researchItems, setResearchItems] = useState<ProductSuggestionItem[]>([]);
  const [aiSourceLinks, setAiSourceLinks] = useState<string[]>([]);
  // TASK-18: phiếu cách dùng + ảnh Gemini đề xuất
  const [newMedUsage, setNewMedUsage] = useState<UsageProfile>(emptyUsageProfile());
  // TASK-31: khung 2 của "Tạo SP" từ gợi ý = liều cho cây của bài (lưu thành liều chung cây, không phải liều bao bì)
  const [newCropUsage, setNewCropUsage] = useState<UsageProfile>(emptyUsageProfile());
  const [newCropDosage, setNewCropDosage] = useState<string>('');
  const [newCropSourceUrl, setNewCropSourceUrl] = useState<string>('');
  const [devCropInput, setDevCropInput] = useState<string>('');
  // TASK-31: "Tạo SP" từ gợi ý chia 2 bước: 1 = thông tin sản phẩm + liều bao bì, 2 = liều cho cây của bài
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [aiImageCandidates, setAiImageCandidates] = useState<string[]>([]);
  // TASK-18-R4: câu trích nguyên văn trong "Nguồn đã dùng" để kiểm tra với trang thật
  // Lưu ý của Gemini (scope_note, loại vật tư...) hiện ngay trong form thay cho toast dài (TASK-18-R5)
  const [aiNotes, setAiNotes] = useState<{ title: string; text: string }[]>([]);

  // Chế độ hiển thị Gợi ý vật tư: 'grouped' (Gộp theo tên vật tư chống trùng lặp) vs 'all' (Từng dòng)
  const [suggestionsViewMode, setSuggestionsViewMode] = useState<'grouped' | 'all'>('grouped');
  const [viewingEvidenceGroup, setViewingEvidenceGroup] = useState<EvidenceModalGroup | null>(null);
  const [activeEvidenceTabIdx, setActiveEvidenceTabIdx] = useState<number>(0);
  // Tab trong modal = 1 bài + 1 bệnh (các đoạn trích cùng bài, cùng bệnh gộp chung). Bài bị bỏ không dùng cho Tạo SP / prompt.
  const [excludedEvidenceTabs, setExcludedEvidenceTabs] = useState<string[]>([]);
  useEffect(() => setExcludedEvidenceTabs([]), [viewingEvidenceGroup]);
  const evidenceTabs = useMemo(() => {
    if (!viewingEvidenceGroup) return [];
    // items = đoạn hiển thị (đã bỏ đoạn trùng / nằm trọn trong đoạn khác); allItems = mọi gợi ý của bài + bệnh đó
    const tabs: { key: string; items: ProductSuggestionItem[]; allItems: ProductSuggestionItem[] }[] = [];
    viewingEvidenceGroup.items.forEach((it) => {
      // mỗi đoạn trích là 1 KnowledgeSource riêng → "cùng bài" so theo link / tiêu đề bài
      const article = (it.source_url || '').trim() || (it.source_title || '').trim() || it.knowledge_source_id || String(it.id);
      const key = `${article}##${it.model_class || `${it.plant_name}|${it.disease_name}`}`;
      const tab = tabs.find((t) => t.key === key);
      if (tab) tab.allItems.push(it);
      else tabs.push({ key, items: [], allItems: [it] });
    });
    tabs.forEach((t) => {
      t.items = dedupeContainedTexts(t.allItems.map((it) => it.evidence_text || '')).map((i) => t.allItems[i]);
      if (!t.items.length) t.items = [t.allItems[0]];
    });
    return tabs;
  }, [viewingEvidenceGroup]);
  const usableEvidenceItems = evidenceTabs.filter((t) => !excludedEvidenceTabs.includes(t.key)).flatMap((t) => t.allItems);
  const shownEvidenceCount = evidenceTabs.reduce((n, t) => n + t.items.length, 0);
  const [descPreviewMode, setDescPreviewMode] = useState<boolean>(false);

  // Load kho thuốc & gợi ý khi vào trang
  useEffect(() => {
    fetchMedicines();
    fetchSuggestions();
    fetchBannedTerms();
  }, []);

  const fetchBannedTerms = async () => {
    try {
      const res = await apiClient.get<{ terms: { text: string; substance: string }[] }>('/banned-substances');
      setBannedTerms(res.data.terms);
      setBannedVersion((v) => v + 1);
    } catch {
      // Giữ danh sách dự phòng trong guardrails.ts; Core vẫn chặn khi lưu
    }
  };

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

  const filteredMedicines = medicines.filter((m) => {
    if (!medSearch.trim()) return true;
    const q = medSearch.toLowerCase();
    return m.name.toLowerCase().includes(q) || (m.active_ingredient && m.active_ingredient.toLowerCase().includes(q));
  });

  useEffect(() => {
    setMedPage(1);
  }, [medSearch]);

  const medTotalItems = filteredMedicines.length;
  const medTotalPages = Math.max(1, Math.ceil(medTotalItems / medPageSize));
  const safeMedPage = Math.min(medPage, medTotalPages);
  const pagedMedicines = useMemo(() => {
    const start = (safeMedPage - 1) * medPageSize;
    return filteredMedicines.slice(start, start + medPageSize);
  }, [filteredMedicines, safeMedPage, medPageSize]);

  // Thuật toán đề xuất & xếp hạng sản phẩm gần giống từ khóa bài báo lên đầu (TASK-15 Gán sản phẩm)
  const rankedLinkMedicines = useMemo(() => {
    if (!linkingSuggestion) return [];

    const mentionRaw = (linkingSuggestion.mention_text || '').trim().toLowerCase();
    const diseaseRaw = (linkingSuggestion.disease_name || '').trim().toLowerCase();
    const plantRaw = (linkingSuggestion.plant_name || '').trim().toLowerCase();
    const searchRaw = linkProductSearch.trim().toLowerCase();

    // Lọc bỏ hoạt chất bị cấm
    const allowed = medicines.filter(
      (m) => !isIngredientBanned(m.name) && !isIngredientBanned(m.active_ingredient || '')
    );

    const scored = allowed.map((m) => {
      const name = (m.name || '').toLowerCase();
      const ingredient = (m.active_ingredient || '').toLowerCase();
      const dosage = (m.dosage_instruction || '').toLowerCase();
      const type = (m.medicine_type || '').toLowerCase();

      let score = 0;
      let isKeywordMatch = false;

      if (mentionRaw) {
        if (ingredient.includes(mentionRaw)) {
          score += 100;
          isKeywordMatch = true;
        } else if (name.includes(mentionRaw)) {
          score += 80;
          isKeywordMatch = true;
        } else {
          const words = mentionRaw.split(/[\s,+/]+/).filter((w) => w.length >= 3);
          for (const w of words) {
            if (ingredient.includes(w)) {
              score += 35;
              isKeywordMatch = true;
            } else if (name.includes(w)) {
              score += 25;
              isKeywordMatch = true;
            }
          }
        }
      }

      if (diseaseRaw && (dosage.includes(diseaseRaw) || (m.target_diseases && m.target_diseases.some((d) => d.toLowerCase().includes(diseaseRaw))))) {
        score += 20;
      }
      if (plantRaw && dosage.includes(plantRaw)) {
        score += 10;
      }

      let matchesSearch = true;
      if (searchRaw) {
        matchesSearch =
          name.includes(searchRaw) ||
          ingredient.includes(searchRaw) ||
          type.includes(searchRaw) ||
          dosage.includes(searchRaw) ||
          String(m.id).includes(searchRaw);
      }

      return {
        medicine: m,
        score,
        isKeywordMatch,
        matchesSearch,
      };
    });

    return scored
      .filter((item) => item.matchesSearch)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.medicine.name.localeCompare(b.medicine.name, 'vi');
      });
  }, [linkingSuggestion, medicines, linkProductSearch]);

  useEffect(() => {
    if (linkingSuggestion && !selectedLinkMedId) {
      const topMatch = rankedLinkMedicines.find((item) => item.score >= 70);
      if (topMatch) {
        setSelectedLinkMedId(topMatch.medicine.id);
      }
    }
  }, [linkingSuggestion, rankedLinkMedicines, selectedLinkMedId]);

  const selectedLinkMed = useMemo(() => {
    if (!selectedLinkMedId) return null;
    return medicines.find((m) => m.id === selectedLinkMedId) || null;
  }, [selectedLinkMedId, medicines]);

  const currentPlantName = useMemo(() => {
    if (!linkingSuggestion) return 'Cây trồng';
    if (linkingSuggestion.plant_name && linkingSuggestion.plant_name.trim()) {
      return linkingSuggestion.plant_name.trim();
    }
    const prefix = (linkingSuggestion.model_class || '').split('___')[0]?.toLowerCase();
    const PLANT_MAP: Record<string, string> = {
      tomato: 'Cà chua',
      corn: 'Ngô (Bắp)',
      maize: 'Ngô (Bắp)',
      grape: 'Nho',
      apple: 'Táo',
      potato: 'Khoai tây',
      rice: 'Lúa',
      pepper: 'Ớt / Tiêu',
      citrus: 'Cam / Bưởi',
      strawberry: 'Dâu tây',
      cucumber: 'Dưa chuột',
      watermelon: 'Dưa hấu',
    };
    return PLANT_MAP[prefix] || prefix || 'Cây trồng';
  }, [linkingSuggestion]);

  // Liều RIÊNG của bệnh này (TASK-29: bệnh đang dùng liều chung của cây có scope "plant", không tính là liều riêng)
  const existingDiseaseRule = useMemo(() => {
    if (!selectedLinkMed || !linkingSuggestion?.model_class) return null;
    const rule = selectedLinkMed.usage_profile?.disease_rules?.[linkingSuggestion.model_class] || null;
    return rule && rule.scope !== 'plant' ? rule : null;
  }, [selectedLinkMed, linkingSuggestion]);

  const hasDosageForDisease = useMemo(() => {
    if (!existingDiseaseRule) return false;
    return Boolean(
      existingDiseaseRule.dosage_instruction?.trim() ||
      (existingDiseaseRule.usage_profile && !isUsageEmpty(existingDiseaseRule.usage_profile))
    );
  }, [existingDiseaseRule]);

  // TASK-28: Kiểm tra sản phẩm đã có quy tắc liều lượng cho cùng Cây trồng chưa
  const existingCropRuleEntry = useMemo(() => {
    if (!selectedLinkMed || !linkingSuggestion) return null;

    // TASK-29: ưu tiên liều chung của cây lưu trong bảng (usage_profile.plant_rules, key = tên cây trong DB)
    const normPlant = (v?: string | null) => (v || '').trim().toLowerCase().replace(/^cây\s+/i, '');
    const wantedPlants = [linkingSuggestion.plant_name, currentPlantName].map(normPlant).filter(Boolean);
    const plantRules = selectedLinkMed.usage_profile?.plant_rules;
    if (plantRules) {
      for (const [key, rule] of Object.entries(plantRules)) {
        if (!rule || !wantedPlants.includes(normPlant(key))) continue;
        if (rule.dosage_instruction?.trim() || (rule.usage_profile && !isUsageEmpty(rule.usage_profile))) {
          return { key, rule };
        }
      }
    }

    const rules = selectedLinkMed.usage_profile?.disease_rules;
    if (!rules) return null;

    const currentCropPrefix = (linkingSuggestion.model_class || '').split('___')[0]?.toLowerCase();
    const currentPlant = (currentPlantName || '').toLowerCase();

    for (const [key, rule] of Object.entries(rules)) {
      if (!rule) continue;
      const hasContent = Boolean(
        rule.dosage_instruction?.trim() ||
        (rule.usage_profile && !isUsageEmpty(rule.usage_profile))
      );
      if (!hasContent) continue;

      if (key.toLowerCase() === (linkingSuggestion.model_class || '').toLowerCase()) continue;

      const ruleCropPrefix = (key.split('___')[0] || '').toLowerCase();
      const isSameCrop =
        (currentCropPrefix && ruleCropPrefix && currentCropPrefix === ruleCropPrefix) ||
        (currentPlant && (key.toLowerCase().includes(currentPlant) || rule.plant_name?.toLowerCase().includes(currentPlant)));

      if (isSameCrop) {
        return { key, rule };
      }
    }
    return null;
  }, [selectedLinkMed, linkingSuggestion, currentPlantName]);

  const hasDiseaseAlready = useMemo(() => {
    if (!selectedLinkMed || !linkingSuggestion?.model_class) return false;
    return (selectedLinkMed.target_diseases || []).includes(linkingSuggestion.model_class);
  }, [selectedLinkMed, linkingSuggestion]);

  // Đồng bộ liều lượng khi chọn sản phẩm trong modal Gắn gợi ý (Ưu tiên kế thừa liều cây trồng - TASK-28)
  useEffect(() => {
    if (!linkingSuggestion || !selectedLinkMed) {
      setLinkUsageProfile(emptyUsageProfile());
      setLinkDosageText('');
      setLinkSourceUrl('');
      setLinkCustomDosageOpen(true);
      setIsEditingExistingRule(false);
      setDosageChoice('custom');
      setShowLinkDevMode(false);
      setLinkDevAiInput('');
      return;
    }

    const rule = existingDiseaseRule;
    const hasCustom = Boolean(
      rule && (rule.dosage_instruction?.trim() || (rule.usage_profile && !isUsageEmpty(rule.usage_profile)))
    );

    if (hasCustom && rule) {
      if (rule.usage_profile && !isUsageEmpty(rule.usage_profile)) {
        setLinkUsageProfile({ ...rule.usage_profile });
      } else {
        setLinkUsageProfile(emptyUsageProfile());
      }
      setLinkDosageText(rule.dosage_instruction || '');
      setLinkSourceUrl(rule.source_url || linkingSuggestion.source_url || '');
      setDosageChoice('custom');
    } else if (existingCropRuleEntry) {
      // Tự động nạp liều dùng đã có của Cây trồng này
      const cropRule = existingCropRuleEntry.rule;
      if (cropRule.usage_profile && !isUsageEmpty(cropRule.usage_profile)) {
        setLinkUsageProfile({ ...cropRule.usage_profile });
      } else {
        setLinkUsageProfile(emptyUsageProfile());
      }
      setLinkDosageText(cropRule.dosage_instruction || '');
      setLinkSourceUrl(cropRule.source_url || linkingSuggestion.source_url || '');
      setDosageChoice('crop_inherited');
    } else if (selectedLinkMed.usage_profile && !isUsageEmpty(selectedLinkMed.usage_profile)) {
      setLinkUsageProfile({ ...selectedLinkMed.usage_profile });
      setLinkDosageText(selectedLinkMed.dosage_instruction || '');
      setLinkSourceUrl(linkingSuggestion.source_url || '');
      setDosageChoice('custom');
    } else {
      setLinkUsageProfile(emptyUsageProfile());
      setLinkDosageText(selectedLinkMed.dosage_instruction || '');
      setLinkSourceUrl(linkingSuggestion.source_url || '');
      setDosageChoice('custom');
    }

    setIsEditingExistingRule(false);
    setLinkCustomDosageOpen(true);
    setShowLinkDevMode(false);
    setLinkDevAiInput('');
  }, [selectedLinkMedId, linkingSuggestion, existingCropRuleEntry, existingDiseaseRule]);

  const handleCopyLinkAiPrompt = () => {
    if (!linkingSuggestion || !selectedLinkMed) return;
    const plant = currentPlantName;
    // Câu trong đoạn trích có nhắc tên vật tư (gợi ý cùng tên, cùng cây), để AI tìm đúng loại như bài mô tả
    const group = suggestions.filter((s) => sameSuggestionGroup(s, linkingSuggestion));
    const prompt = buildCropDosagePrompt({
      name: selectedLinkMed.name,
      activeIngredient: selectedLinkMed.active_ingredient || '',
      medicineType: selectedLinkMed.medicine_type,
      plant,
      diseaseName: linkingSuggestion.disease_name,
      productId: selectedLinkMed.id,
      articleUrl: linkingSuggestion.source_url,
      keySentences: keyMentionSentences(
        toResearchEvidences(group.length ? group : [linkingSuggestion]),
        linkingSuggestion.mention_text
      ),
    });
    navigator.clipboard.writeText(prompt);
    toast.success(`Đã sao chép Prompt AI tra cứu liều dùng cho Cây ${plant} vào Clipboard!`);
  };

  const handleApplyLinkAiJson = () => {
    if (!linkDevAiInput.trim()) {
      toast.error('Vui lòng dán đoạn JSON từ Gemini/AI vào ô.');
      return;
    }
    try {
      const raw = linkDevAiInput.trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Không tìm thấy JSON hợp lệ');
      const parsed = JSON.parse(jsonMatch[0]);

      // Nguồn URL: nhận source_url (string) hoặc source_urls (array)
      let srcUrl =
        (typeof parsed.source_url === 'string' && parsed.source_url.trim()) ||
        (Array.isArray(parsed.source_urls) && typeof parsed.source_urls[0] === 'string' && parsed.source_urls[0].trim()) ||
        '';
      if (!srcUrl) {
        // Fallback: tìm link trong phần văn bản bên ngoài khối JSON (ví dụ mục ## Nguồn tham khảo)
        const urlMatches = raw.match(/https?:\/\/[^\s)\]"]+/g);
        if (urlMatches && urlMatches.length > 0) {
          srcUrl = urlMatches[0];
        }
      }
      if (srcUrl) {
        setLinkSourceUrl(srcUrl);
      }

      // Phiếu cách dùng: nhận usage_profile hoặc usage
      const usageObj = parsed.usage_profile || parsed.usage;
      if (usageObj && typeof usageObj === 'object') {
        const normalized = normalizeUsageProfile(usageObj);
        setLinkUsageProfile(normalized);

        // Nếu dosage_instruction chưa có hoặc trống, tự động ghép từ phiếu
        if (!parsed.dosage_instruction || !parsed.dosage_instruction.trim()) {
          const isSupply = selectedLinkMed?.medicine_type === 'Vật tư canh tác';
          const composed = formatUsageText(
            normalized,
            isSupply || selectedLinkMed?.phi_days === null ? null : Number(selectedLinkMed?.phi_days),
            isSupply
          );
          if (composed) setLinkDosageText(composed);
        }
      }

      if (parsed.dosage_instruction && typeof parsed.dosage_instruction === 'string' && parsed.dosage_instruction.trim()) {
        setLinkDosageText(parsed.dosage_instruction.trim());
      }

      setLinkCustomDosageOpen(true);
      toast.success('Đã áp dụng thông số liều lượng và link nguồn từ AI thành công!');
    } catch (err: any) {
      toast.error(`JSON không hợp lệ: ${err.message || 'Lỗi cú pháp'}`);
    }
  };

  const closeLinkDialog = () => {
    setLinkingSuggestion(null);
    setSelectedLinkMedId('');
    setLinkProductSearch('');
    setLinkCustomDosageOpen(true);
    setIsEditingExistingRule(false);
    setDosageChoice('custom');
    setLinkUsageProfile(emptyUsageProfile());
    setLinkDosageText('');
    setLinkSourceUrl('');
    setShowLinkDevMode(false);
    setLinkDevAiInput('');
    setShowLinkSnippetDialog(false);
  };

  const handleUnlinkSuggestion = async (suggestionId: number, mentionText?: string) => {
    try {
      setUnlinkingId(suggestionId);
      const res = await apiClient.post(`/knowledge/product-suggestions/${suggestionId}/unlink`);
      toast.success(res.data?.message || `Đã hủy gán gợi ý "${mentionText || ''}", đưa về trạng thái chờ xử lý!`);
      // Server đặt lại các gợi ý cùng bài + cùng sản phẩm → tải lại danh sách cho khớp (TASK-31)
      await fetchSuggestions();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUnlinkingId(null);
    }
  };

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
      const payload: any = {
        product_id: Number(selectedLinkMedId),
      };

      let currentDosageText = linkDosageText.trim();
      let currentUsageProfile = linkUsageProfile;
      let currentSourceUrl = linkSourceUrl.trim();

      // Nếu người dùng đã dán JSON vào Dev Mode nhưng quên bấm "Điền liều từ AI", tự động parse luôn
      if (showLinkDevMode && linkDevAiInput.trim() && !currentDosageText && isUsageEmpty(currentUsageProfile)) {
        try {
          const raw = linkDevAiInput.trim();
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const srcUrl =
              (typeof parsed.source_url === 'string' && parsed.source_url.trim()) ||
              (Array.isArray(parsed.source_urls) && typeof parsed.source_urls[0] === 'string' && parsed.source_urls[0].trim()) ||
              '';
            if (srcUrl) currentSourceUrl = srcUrl;

            const usageObj = parsed.usage_profile || parsed.usage;
            if (usageObj && typeof usageObj === 'object') {
              currentUsageProfile = normalizeUsageProfile(usageObj);
            }
            if (parsed.dosage_instruction && typeof parsed.dosage_instruction === 'string' && parsed.dosage_instruction.trim()) {
              currentDosageText = parsed.dosage_instruction.trim();
            } else if (!isUsageEmpty(currentUsageProfile)) {
              const isSupply = selectedLinkMed?.medicine_type === 'Vật tư canh tác';
              currentDosageText = formatUsageText(
                currentUsageProfile,
                isSupply || selectedLinkMed?.phi_days === null ? null : Number(selectedLinkMed?.phi_days),
                isSupply
              ) || '';
            }
          }
        } catch {
          // ignore parse error if any
        }
      }

      if (hasDosageForDisease && !isEditingExistingRule) {
        if (existingDiseaseRule?.dosage_instruction) payload.dosage_instruction = existingDiseaseRule.dosage_instruction;
        if (existingDiseaseRule?.usage_profile) payload.usage_profile = existingDiseaseRule.usage_profile;
        if (existingDiseaseRule?.source_url) payload.source_url = existingDiseaseRule.source_url;
      } else if (!hasDosageForDisease && dosageChoice === 'default') {
        // Dùng liều chung của sản phẩm: không truyền payload riêng
      } else {
        // Tạo liều riêng mới hoặc chỉnh sửa liều có sẵn
        if (currentDosageText) payload.dosage_instruction = currentDosageText;
        if (!isUsageEmpty(currentUsageProfile)) payload.usage_profile = currentUsageProfile;
        if (currentSourceUrl) payload.source_url = currentSourceUrl;
      }

      await apiClient.post(`/knowledge/product-suggestions/${linkingSuggestion.id}/link`, payload);
      const med = medicines.find((m) => m.id === selectedLinkMedId);
      toast.success(`Đã gắn gợi ý "${linkingSuggestion.mention_text}" với sản phẩm "${med?.name || ''}"!`);

      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === linkingSuggestion.id || (s.status === 'PENDING' && sameSuggestionGroup(s, linkingSuggestion))
            ? { ...s, status: 'LINKED', product_id: Number(selectedLinkMedId), product_name: med?.name, resolved_at: new Date().toISOString() }
            : s
        )
      );

      // Cập nhật local state medicines
      setMedicines((prev) =>
        prev.map((m) => {
          if (m.id !== selectedLinkMedId) return m;
          const currentTargets = m.target_diseases || [];
          const nextTargets = linkingSuggestion.model_class && !currentTargets.includes(linkingSuggestion.model_class)
            ? [...currentTargets, linkingSuggestion.model_class]
            : currentTargets;

          let nextProfile = m.usage_profile ? { ...m.usage_profile } : emptyUsageProfile();
          if (payload.dosage_instruction || payload.usage_profile || payload.source_url) {
            const nextDiseaseRules = { ...(nextProfile.disease_rules || {}) };
            if (linkingSuggestion.model_class) {
              nextDiseaseRules[linkingSuggestion.model_class] = {
                dosage_instruction: payload.dosage_instruction,
                usage_profile: payload.usage_profile,
                source_url: payload.source_url || linkingSuggestion.source_url,
                is_verified: true,
              };
            }
            nextProfile.disease_rules = nextDiseaseRules;
          }

          return {
            ...m,
            target_diseases: nextTargets,
            usage_profile: nextProfile,
          };
        })
      );

      closeLinkDialog();
      // Lấy lại bản xem liều theo cây / bệnh do backend tính (TASK-29), thay cho bản cập nhật tạm ở trên
      fetchMedicines();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLinkingLoading(false);
    }
  };

  const handleDismissSuggestion = async (suggestionId: number, isPractice = false) => {
    try {
      const target = suggestions.find((s) => s.id === suggestionId);
      await apiClient.post(`/knowledge/product-suggestions/${suggestionId}/dismiss`);
      if (isPractice) {
        toast.success(target ? `Đã ghi nhận biện pháp kỹ thuật "${target.mention_text}" vào sổ tay.` : 'Đã ghi nhận biện pháp canh tác.');
      } else {
        toast.success(target ? `Đã bỏ qua gợi ý "${target.mention_text}".` : 'Đã bỏ qua gợi ý vật tư này.');
      }
      if (target) {
        setSuggestions((prev) =>
          prev.map((s) =>
            s.id === target.id || (s.status === 'PENDING' && sameSuggestionGroup(s, target))
              ? { ...s, status: 'DISMISSED', resolved_at: new Date().toISOString() }
              : s
          )
        );
      } else {
        await fetchSuggestions();
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDeleteSuggestion = async (suggestionId: number, mentionText: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn gợi ý "${mentionText}" khỏi danh sách?`)) {
      return;
    }
    try {
      await apiClient.delete(`/knowledge/product-suggestions/${suggestionId}`);
      toast.success(`Đã xóa gợi ý "${mentionText}".`);
      const target = suggestions.find((s) => s.id === suggestionId);
      setSuggestions((prev) =>
        prev.filter(
          (s) =>
            !(
              s.id === suggestionId ||
              (target && s.status !== 'LINKED' && s.status !== 'ADDED' && sameSuggestionGroup(s, target))
            )
        )
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleCleanDismissedSuggestions = async () => {
    const dismissedCount = suggestions.filter((s) => s.status === 'DISMISSED').length;
    if (dismissedCount === 0) {
      toast.info('Không có gợi ý đã bỏ qua nào cần dọn dẹp.');
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn dọn sạch ${dismissedCount} gợi ý đang ở trạng thái "Đã bỏ qua"?`)) {
      return;
    }
    try {
      const res = await apiClient.delete<{ message: string; deleted_count: number }>('/knowledge/product-suggestions/dismissed');
      toast.success(res.data?.message || `Đã dọn sạch ${dismissedCount} gợi ý.`);
      setSuggestions((prev) => prev.filter((s) => s.status !== 'DISMISSED'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // groupItems: các đoạn trích của nhóm gợi ý (cùng tên vật tư) làm ngữ cảnh prompt AI và nguồn bệnh hại điền sẵn
  const handleOpenCreateMedModal = (sug?: ProductSuggestionItem, groupItems?: ProductSuggestionItem[]) => {
    setResearchItems(groupItems && groupItems.length ? groupItems : sug ? [sug] : []);
    setAiSourceLinks([]);
    setAiNotes([]);
    setAiImageCandidates([]);
    setNewMedUsage(emptyUsageProfile());
    setNewCropUsage(emptyUsageProfile());
    setNewCropDosage('');
    setNewCropSourceUrl('');
    setDevCropInput('');
    setCreateStep(1);
    setShowDevMode(false);
    setDevGeminiInput('');

    if (sug) {
      setFromSuggestion(sug);
      setNewMedName(sug.mention_text);
      const isSupplyOrPractice = sug.kind === 'SUPPLY' || sug.kind === 'PRACTICE' || /vôi|bẫy|lưới|bạt|phân/i.test(sug.mention_text);
      const mappedType =
        sug.kind === 'BIOLOGICAL'
          ? 'Sinh học'
          : isSupplyOrPractice
            ? 'Vật tư canh tác'
            : 'Hóa học';
      setNewMedType(mappedType);
      setNewMedActiveIngredient(sug.kind === 'CHEMICAL' || sug.kind === 'BIOLOGICAL' ? sug.mention_text : '');
      setNewMedPhi('');
      setNewMedAvailability('NOT_SOLD');
      setNewMedSourceUrl('');
      setNewMedImageUrl('');
      setMedImageFailed(false);
      setNewMedDescription('');
      // Bệnh hại điền sẵn = bệnh của mọi đoạn trích đang chờ trong nhóm (kể cả vật tư): bài nói về bệnh nào thì gắn bệnh đó.
      // Gợi ý cho cây / bệnh khác xuất hiện sau sẽ Gắn SP sau (server giữ PENDING những gợi ý có bệnh chưa gắn).
      const sourceItems = (groupItems && groupItems.length ? groupItems : [sug]).filter((it) => it.status === 'PENDING' || it.id === sug.id);
      const knownCodes = new Set(diseases.map((d) => d.classCode));
      setNewMedTargetDiseases(
        Array.from(
          new Set(
            sourceItems
              .map((it) => (it.model_class || '').trim())
              .filter((c) => c && !/healthy/i.test(c) && (!knownCodes.size || knownCodes.has(c)))
          )
        )
      );
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
      setNewMedImageUrl('');
      setMedImageFailed(false);
      setNewMedDescription('');
      setNewMedTargetDiseases([]);
      setNewMedPrice(50000);
      setNewMedStock(50);
      setNewMedDosage('Pha theo hướng dẫn trên bao bì');
      setNewMedIsAllowed(false);
    }
    setCreateMedModalOpen(true);
  };

  // TASK-18: nút "Tạo SP" ở cuối hàng mở modal trích dẫn trước (xem / bỏ bài không liên quan rồi mới tạo)
  const openEvidenceModal = (items: ProductSuggestionItem[]) => {
    if (!items.length) return;
    const first = items.find((it) => it.status === 'PENDING') || items[0];
    setViewingEvidenceGroup({
      mentionText: first.mention_text,
      kind: first.kind,
      count: items.length,
      items,
      status: items.some((it) => it.status === 'PENDING') ? 'PENDING' : first.status,
      plantName: first.plant_name,
      diseaseName: first.disease_name,
      productName: items.find((it) => it.product_name)?.product_name,
    });
    setActiveEvidenceTabIdx(0);
  };

  const toResearchEvidences = (items: ProductSuggestionItem[]): ResearchEvidence[] =>
    items
      .filter((it) => it.evidence_text)
      .map((it) => ({
        text: it.evidence_text || '',
        plantName: it.plant_name,
        diseaseName: it.disease_name,
        diseaseCode: it.model_class,
        sourceId: it.knowledge_source_id,
        sourceTitle: it.source_title,
        sourceUrl: it.source_url,
      }));

  // Số khối "bài + bệnh" (các đoạn cùng bài, cùng bệnh tính là 1)
  const countArticleBlocks = (items: ProductSuggestionItem[]) =>
    Math.min(mergeEvidencesByArticle(toResearchEvidences(items)).length, MAX_PROMPT_EVIDENCES);

  const copyText = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(okMsg);
    } catch {
      toast.error('Trình duyệt chặn sao chép. Hãy cho phép quyền clipboard rồi thử lại.');
    }
  };

  // Nút AI duy nhất (chế độ Dev, TASK-18): prompt Gemini tổng hợp, link là tùy chọn, ngữ cảnh lấy từ researchItems
  const handleCopyGeminiPrompt = () => {
    const name = newMedName.trim();
    const mention = fromSuggestion?.mention_text || researchItems[0]?.mention_text || name;
    if (!mention && !newMedSourceUrl.trim()) {
      toast.error('Nhập tên sản phẩm hoặc link trước khi tạo prompt.');
      return;
    }
    const kind = fromSuggestion?.kind || researchItems[0]?.kind || kindFromMedicineType(newMedType);
    const prompt = buildProductResearchPrompt({
      mention,
      kind,
      evidences: toResearchEvidences(researchItems),
      diseases,
      currentName: name,
      activeIngredient: newMedType === 'Vật tư canh tác' ? '' : newMedActiveIngredient.trim(),
      sourceUrl: newMedSourceUrl.trim(),
      // TASK-31: tạo từ gợi ý thì prompt 1 chỉ tìm thông số bao bì; liều theo cây dùng prompt 2 (khung 2)
      usageMode: fromSuggestion ? 'package' : 'auto',
    });
    setShowDevMode(true);
    const n = countArticleBlocks(researchItems);
    copyText(
      prompt,
      `Đã sao chép prompt${n ? ` kèm ${n} bài trích` : ''}. Dán vào trợ lý AI (Gemini, ChatGPT...), rồi dán cả câu trả lời (JSON + danh sách nguồn) vào ô bên dưới.`
    );
  };

  const handleApplyGeminiJson = () => {
    if (!devGeminiInput.trim()) {
      toast.error('Vui lòng dán đoạn JSON từ AI vào ô trước khi bấm áp dụng!');
      return;
    }
    const contextPlants = Array.from(new Set(researchItems.map((it) => it.plant_name).filter(Boolean)));
    const parsed = parseProductResearchJson(devGeminiInput, diseases, contextPlants);
    if (!parsed) {
      toast.error('Không đọc được JSON. Hãy copy đúng khối ```json mà AI trả về.');
      return;
    }
    const data = parsed.data as Record<string, any>;
    const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

    if (str(data.name)) setNewMedName(str(data.name));
    const t = str(data.medicine_type);
    if (t === 'Sinh học' || t === 'Vật tư canh tác' || t === 'Hóa học') setNewMedType(t);
    if (data.active_ingredient !== undefined) setNewMedActiveIngredient(t === 'Vật tư canh tác' ? '' : str(data.active_ingredient));
    if (str(data.description)) setNewMedDescription(str(data.description));
    // Ảnh: hiện danh sách để Admin chọn; ô ảnh đang trống thì điền ảnh đầu tiên (form tự báo nếu ảnh không tải được)
    const images = parsed.imageCandidates.filter((u) => isSafeHttpUrl(u));
    setAiImageCandidates(images);
    if (images.length && !newMedImageUrl.trim()) {
      setNewMedImageUrl(images[0]);
      setMedImageFailed(false);
    }
    const isSupplyType = (t || newMedType) === 'Vật tư canh tác';
    let phiForText: number | null = newMedPhi === '' ? null : Number(newMedPhi);
    if (data.phi_days !== undefined) {
      const p = parseInt(str(data.phi_days), 10);
      phiForText = isNaN(p) || isSupplyType ? null : p;
      setNewMedPhi(phiForText === null ? '' : phiForText);
    }
    // Phiếu cách dùng (TASK-18) → khối Cách dùng + "Hướng dẫn sử dụng" ghép theo nhãn cố định
    if (parsed.usage) {
      setNewMedUsage(parsed.usage);
      const composed = formatUsageText(parsed.usage, phiForText, isSupplyType);
      if (composed) setNewMedDosage(composed);
      else if (str(data.dosage_instruction)) setNewMedDosage(str(data.dosage_instruction));
    } else if (str(data.dosage_instruction)) {
      setNewMedDosage(str(data.dosage_instruction));
    }
    if (data.price !== undefined) {
      const pr = parseFloat(str(data.price));
      if (!isNaN(pr) && pr > 0) {
        setNewMedPrice(pr);
        setNewMedAvailability('IN_STOCK');
        setNewMedStock(100);
      }
    }

    // Bệnh hại: gộp thêm vào lựa chọn hiện có, KHÔNG xóa bệnh Admin đã chọn
    if (parsed.matchedDiseases.length) {
      setNewMedTargetDiseases((prev) => Array.from(new Set([...prev, ...parsed.matchedDiseases])));
    }

    // Link nguồn AI đề xuất: điền ô link nếu đang trống, còn lại hiện để Admin chọn
    const validLinks = parsed.sourceUrls.filter((u) => isSafeHttpUrl(u));
    setAiSourceLinks(validLinks);
    if (validLinks.length && !newMedSourceUrl.trim()) setNewMedSourceUrl(validLinks[0]);

    // Một toast ngắn; chi tiết (lưu ý số liệu, loại vật tư...) hiện trong khung "Lưu ý từ AI" của form
    const identified = str(data.identified_as).toUpperCase();
    const note = str(data.identification_note);
    const aiNoteList: { title: string; text: string }[] = [];
    const scopeNote = str(data.scope_note);
    if (/KH[ÔO]NG T[ÌI]M [ĐD][ƯU][ỢO]C WEB/i.test(scopeNote)) {
      // Gemini bản web có lúc hết lượt / không bật Google Search → mọi con số để trống
      aiNoteList.push({
        title: 'AI không tìm được web',
        text: 'Chưa có nguồn nên liều lượng để trống. Mở cuộc trò chuyện mới (hoặc đổi chế độ / đổi AI) rồi dán lại prompt, hoặc dùng các nút Tra Google ở trên.',
      });
    } else if (scopeNote) {
      aiNoteList.push({ title: 'Số liệu', text: scopeNote });
    }
    if (identified === 'HOMEMADE') aiNoteList.push({ title: 'Chế phẩm tự pha', text: note });
    else if (identified === 'PRACTICE') aiNoteList.push({ title: 'Là biện pháp, không phải vật tư', text: note || 'Cân nhắc "Ghi nhận biện pháp" thay vì tạo sản phẩm.' });
    else if (identified === 'SEED') aiNoteList.push({ title: 'Giống cây / hạt giống', text: note });
    if (data.mentions_differ === true) aiNoteList.push({ title: 'Các đoạn trích nói về thứ khác nhau', text: str(data.differ_note) });
    if (parsed.unmatchedDiseases.length) aiNoteList.push({ title: 'Bệnh chưa khớp mã, chọn tay', text: parsed.unmatchedDiseases.join(', ') });
    setAiNotes(aiNoteList);

    const parts = ['Đã điền form'];
    if (parsed.matchedDiseases.length) parts.push(`+${parsed.matchedDiseases.length} bệnh`);
    if (validLinks.length) parts.push(`${validLinks.length} link`);
    if (images.length) parts.push(`${images.length} ảnh`);
    if (!parsed.usage) parts.push('chưa có cách dùng');
    if (aiNoteList.length) {
      toast.warning(`${parts.join(' · ')} · ${aiNoteList.length} lưu ý, xem dưới ô link`);
    } else {
      toast.success(parts.join(' · '));
    }
    setDevGeminiInput('');
  };

  // TASK-31: prompt 2 = liều cho cây của bài (dùng chung hàm với "Gắn SP")
  const cropPlantName = fromSuggestion?.plant_name?.trim() || '';
  const handleCopyCropPrompt = () => {
    if (!fromSuggestion) return;
    const plant = cropPlantName || 'cây trồng';
    const prompt = buildCropDosagePrompt({
      name: newMedName.trim() || fromSuggestion.mention_text,
      activeIngredient: newMedType === 'Vật tư canh tác' ? '' : newMedActiveIngredient.trim(),
      medicineType: newMedType,
      plant,
      diseaseName: fromSuggestion.disease_name,
      articleUrl: fromSuggestion.source_url,
      keySentences: keyMentionSentences(
        toResearchEvidences(researchItems.length ? researchItems : [fromSuggestion]),
        fromSuggestion.mention_text
      ),
    });
    copyText(prompt, `Đã sao chép prompt tìm liều cho Cây ${plant}. Dán câu trả lời của AI vào ô bên dưới.`);
  };

  const handleApplyCropJson = () => {
    const parsed = parseCropDosageJson(devCropInput);
    if (!parsed) {
      toast.error('Không đọc được JSON. Hãy copy đúng khối ```json mà AI trả về.');
      return;
    }
    const isSupply = newMedType === 'Vật tư canh tác';
    if (parsed.usage) setNewCropUsage(parsed.usage);
    const text =
      parsed.dosageInstruction ||
      (parsed.usage ? formatUsageText(parsed.usage, isSupply || newMedPhi === '' ? null : Number(newMedPhi), isSupply) : '');
    if (text) setNewCropDosage(text);
    if (parsed.sourceUrl && isSafeHttpUrl(parsed.sourceUrl)) setNewCropSourceUrl(parsed.sourceUrl);
    setDevCropInput('');
    toast.success(`Đã điền liều cho Cây ${cropPlantName || 'trồng'}.`);
  };

  /** Kiểm tra phần thông tin sản phẩm + liều bao bì (bước 1). Trả false và báo lỗi nếu chưa hợp lệ. */
  const validateCreateStep1 = (): boolean => {
    if (!newMedName.trim()) {
      toast.error('Vui lòng nhập tên sản phẩm.');
      return false;
    }
    const isSupply = newMedType === 'Vật tư canh tác';
    const isBanned = isIngredientBanned(newMedName) || (!isSupply && isIngredientBanned(newMedActiveIngredient));
    if (isBanned && newMedIsAllowed) {
      toast.error('Sản phẩm chứa hoạt chất cấm theo Thông tư 75/2025. Không thể bật lưu hành sản phẩm này.');
      return false;
    }
    if (!isSupply && (newMedPhi === '' || Number.isNaN(Number(newMedPhi)))) {
      toast.error('Thuốc hóa học/sinh học bắt buộc nhập thời gian cách ly (PHI) theo nhãn thuốc hoặc nguồn tra cứu.');
      return false;
    }
    if (!isSupply && (Number(newMedPhi) < 0 || Number(newMedPhi) > 365)) {
      toast.error('Thời gian cách ly (PHI) phải từ 0 đến 365 ngày.');
      return false;
    }
    if (newMedSourceUrl.trim() && !/^https?:\/\//i.test(newMedSourceUrl.trim())) {
      toast.error('Link nguồn phải bắt đầu bằng http:// hoặc https://.');
      return false;
    }
    // TASK-30: cả 2 luồng đều hiện phiếu cách dùng nên đều kiểm tra (trước đây luồng "Thêm sản phẩm" lưu ngầm phiếu do AI điền)
    const usageError = validateUsageProfile(newMedUsage);
    if (usageError) {
      toast.error(`Phiếu liều bao bì: ${usageError}`);
      return false;
    }
    return true;
  };

  const goToCropStep = () => {
    if (!validateCreateStep1()) return;
    setShowDevMode(false);
    setCreateStep(2);
  };

  const handleCreateMedicineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Enter ở bước 1 → sang bước 2, không tạo sản phẩm khi chưa xem phần liều cây
    if (fromSuggestion && createStep === 1) {
      goToCropStep();
      return;
    }
    if (!validateCreateStep1()) {
      setCreateStep(1);
      return;
    }
    const isSupply = newMedType === 'Vật tư canh tác';
    const isBanned = isIngredientBanned(newMedName) || (!isSupply && isIngredientBanned(newMedActiveIngredient));
    if (fromSuggestion) {
      const cropError = validateUsageProfile(newCropUsage);
      if (cropError) {
        toast.error(`Liều cho cây: ${cropError}`);
        return;
      }
      if (newCropSourceUrl.trim() && !/^https?:\/\//i.test(newCropSourceUrl.trim())) {
        toast.error('Link nguồn liều cây phải bắt đầu bằng http:// hoặc https://.');
        return;
      }
    }

    try {
      setCreatingMed(true);
      const defaultDosage = isSupply
        ? 'Sử dụng theo diện tích canh tác và hướng dẫn nhà sản xuất'
        : 'Pha theo hướng dẫn trên bao bì';
      // Ô còn câu mặc định (của loại cũ) → dùng câu mặc định đúng loại hiện tại
      const isDefaultText = ['Pha theo hướng dẫn trên bao bì', 'Sử dụng theo diện tích canh tác và hướng dẫn nhà sản xuất'].includes(newMedDosage.trim());
      const packageText = newMedDosage.trim() && !isDefaultText ? newMedDosage.trim() : '';
      const cropText = fromSuggestion ? newCropDosage.trim() : '';
      // TASK-31: Lavi đọc ô này. Có liều bao bì → liều bao bì; chỉ có liều cây → ghi rõ "Trên cây X: …" để không nói nhầm cho cây khác
      const dosageToUse =
        packageText || (cropText ? `Trên cây ${cropPlantName || 'trồng của bài'}: ${cropText}` : defaultDosage);
      const combinedDosage = newMedDescription.trim()
        ? combineDescriptionDosage(newMedDescription, dosageToUse)
        : dosageToUse;

      const payload: any = {
        name: newMedName.trim(),
        medicine_type: newMedType,
        active_ingredient: isSupply ? null : newMedActiveIngredient.trim() || undefined,
        price: newMedAvailability === 'NOT_SOLD' ? 0 : (Number(newMedPrice) || 0),
        dosage_instruction: combinedDosage,
        phi_days: isSupply ? null : Number(newMedPhi),
        stock_quantity: newMedAvailability === 'NOT_SOLD' ? 0 : (Number(newMedStock) || 0),
        availability: newMedAvailability,
        info_source_url: newMedSourceUrl.trim() || undefined,
        image_url: newMedImageUrl.trim() || undefined,
        target_diseases: newMedTargetDiseases,
        is_allowed: isBanned ? false : newMedIsAllowed,
        usage_profile: usageProfileForApi(newMedUsage),
        suggestion_id: fromSuggestion ? fromSuggestion.id : undefined,
        // TASK-29: liều trên cây của bài → server lưu thêm thành liều chung của cây (khi các bệnh thuộc 1 cây)
        // TASK-31: khung 2 → liều chung của cây của gợi ý (server lấy cây theo class_code)
        plant_usage: fromSuggestion
          ? {
              class_code: fromSuggestion.model_class || undefined,
              dosage_instruction: cropText || undefined,
              usage_profile: usageProfileForApi(newCropUsage),
              source_url: newCropSourceUrl.trim() || undefined,
            }
          : undefined,
      };

      const res = await apiClient.post('/medicines', payload);
      toast.success(`Đã thêm sản phẩm "${res.data.name}" thành công!`);
      const keptPending = Number(res.data?.suggestions_kept_pending) || 0;
      if (keptPending > 0) {
        toast.info(
          `Còn ${keptPending} gợi ý "${fromSuggestion?.mention_text}" cho bệnh chưa gắn vẫn ở trạng thái Chờ. Khi cần, bấm "Gắn SP" để gắn thêm bệnh đó.`,
          { duration: 9000 }
        );
      }
      setCreateMedModalOpen(false);
      fetchMedicines();
      if (fromSuggestion) {
        fetchSuggestions();
      }
      if (res.data?.id) {
        navigate(`/admin/inventory/products/${res.data.id}`);
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

  const groupedSuggestions = useMemo(() => {
    const map = new Map<string, GroupedSuggestion>();
    filteredSuggestions.forEach((s) => {
      const key = `${(s.mention_text || '').trim().toLowerCase()}__${s.kind}__${suggestionPlantKey(s.model_class)}`;
      const existing = map.get(key);
      if (existing) {
        existing.items.push(s);
        existing.count += 1;
        if (s.status === 'PENDING') existing.status = 'PENDING';
        if (!existing.productName && s.product_name) {
          existing.productName = s.product_name;
          existing.productId = s.product_id;
        }
      } else {
        map.set(key, {
          groupKey: key,
          mentionText: s.mention_text,
          kind: s.kind,
          plantName: s.plant_name || 'Chưa rõ cây',
          diseaseName: s.disease_name,
          modelClass: s.model_class,
          items: [s],
          primaryItem: s,
          count: 1,
          status: s.status as any,
          productName: s.product_name,
          productId: s.product_id,
        });
      }
    });
    return Array.from(map.values());
  }, [filteredSuggestions]);

  useEffect(() => {
    setSuggestionPage(1);
  }, [suggestionSearch, suggestionStatusFilter, suggestionKindFilter, suggestionsViewMode]);

  const currentSuggestionTotal = suggestionsViewMode === 'grouped' ? groupedSuggestions.length : filteredSuggestions.length;
  const suggestionTotalPages = Math.max(1, Math.ceil(currentSuggestionTotal / suggestionPageSize));
  const safeSuggestionPage = Math.min(suggestionPage, suggestionTotalPages);

  const pagedGroupedSuggestions = useMemo(() => {
    const start = (safeSuggestionPage - 1) * suggestionPageSize;
    return groupedSuggestions.slice(start, start + suggestionPageSize);
  }, [groupedSuggestions, safeSuggestionPage, suggestionPageSize]);

  const pagedFilteredSuggestions = useMemo(() => {
    const start = (safeSuggestionPage - 1) * suggestionPageSize;
    return filteredSuggestions.slice(start, start + suggestionPageSize);
  }, [filteredSuggestions, safeSuggestionPage, suggestionPageSize]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Kho vật tư &amp; thuốc
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý giá, tồn kho, thời gian cách ly (PHI) và trạng thái được phép lưu hành.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Subtabs Điều hướng: Kho thuốc & vật tư vs Gợi ý từ bài báo */}
        <div className="flex border-b border-border gap-2 sm:gap-4 pb-1">
          <button
            type="button"
            onClick={() => setInventorySubTab('medicines')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${inventorySubTab === 'medicines'
              ? 'border-emerald-700 text-emerald-800 dark:text-emerald-300'
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
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${inventorySubTab === 'suggestions'
              ? 'border-emerald-700 text-emerald-800 dark:text-emerald-300'
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
          <button
            type="button"
            onClick={() => setInventorySubTab('banned')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${inventorySubTab === 'banned'
              ? 'border-red-700 text-red-800 dark:text-red-300'
              : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            <Ban className="w-3.5 h-3.5 text-red-600" />
            <span>Chất cấm</span>
          </button>
        </div>

        {inventorySubTab === 'banned' ? (
          <BannedSubstancesTab onChanged={() => { fetchBannedTerms(); fetchMedicines(); }} />
        ) : inventorySubTab === 'medicines' ? (
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
                      <th className="p-3">Tên thuốc &amp; Nguồn</th>
                      <th className="p-3">Phân loại</th>
                      <th className="p-3">Căn cứ</th>
                      <th className="p-3">Giá bán</th>
                      <th className="p-3">Cách ly (PHI)</th>
                      <th className="p-3">Tồn kho</th>
                      <th className="p-3 text-center">Tình trạng bán</th>
                      <th className="p-3 text-center">Trạng thái lưu hành</th>
                      <th className="p-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {loadingMedicines ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-muted-foreground">
                          Đang tải danh mục thuốc...
                        </td>
                      </tr>
                    ) : filteredMedicines.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-muted-foreground">
                          Không có sản phẩm nào.
                        </td>
                      </tr>
                    ) : (
                      pagedMedicines.map((med) => (
                        <tr
                          key={med.id}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('button, a, input, select')) return;
                            navigate(`/admin/inventory/products/${med.id}`);
                          }}
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                        >
                          <td className="p-3 font-mono text-muted-foreground">{med.id}</td>
                          <td className="p-3">
                            <div className="font-bold text-foreground">
                              <Link
                                to={`/admin/inventory/products/${med.id}`}
                                className="hover:text-primary transition-colors hover:underline"
                              >
                                {med.name}
                              </Link>
                            </div>
                            {med.info_source_url && (
                              <a
                                href={safeHref(med.info_source_url)}
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
                            {med.medicine_type === 'Hóa chất cấm' || isIngredientBanned(med.active_ingredient) || isIngredientBanned(med.name) ? (
                              <Badge
                                variant="outline"
                                className="bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 font-semibold"
                              >
                                {med.medicine_type === 'Hóa chất cấm' ? med.medicine_type : `${med.medicine_type} (Cấm)`}
                              </Badge>
                            ) : med.medicine_type === 'Sinh học' ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300"
                              >
                                {med.medicine_type}
                              </Badge>
                            ) : med.medicine_type === 'Vật tư canh tác' ? (
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300"
                              >
                                {med.medicine_type}
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300"
                              >
                                {med.medicine_type}
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {(() => {
                              const evidenceCount = suggestions.filter(
                                (s) => s.product_id === med.id && (s.status === 'LINKED' || s.status === 'ADDED')
                              ).length;
                              const diseaseCount = med.target_diseases ? med.target_diseases.length : 0;
                              if (diseaseCount > 0 && evidenceCount === 0) {
                                return (
                                  <span
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20"
                                    title="Thuốc đã chỉ định cho bệnh hại nhưng chưa liên kết với bài báo nào trong cơ sở tri thức"
                                  >
                                    <AlertTriangle className="w-3 h-3" /> Chưa gắn bài báo
                                  </span>
                                );
                              }
                              return (
                                <span className="text-muted-foreground text-xs font-medium">
                                  {diseaseCount} bệnh · {evidenceCount} bài
                                </span>
                              );
                            })()}
                          </td>
                          <td className="p-3 font-semibold text-emerald-800 dark:text-emerald-400 whitespace-nowrap">
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
                              className={`h-7 px-2.5 text-xs font-semibold ${med.is_allowed
                                ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                : 'text-destructive border-destructive/30 hover:bg-destructive/10'
                                }`}
                            >
                              {med.is_allowed ? 'Đang lưu hành' : 'Bị cấm / Dừng bán'}
                            </Button>
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <Button
                              asChild
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-primary font-semibold hover:text-primary"
                            >
                              <Link to={`/admin/inventory/products/${med.id}`}>
                                <span>Chi tiết</span>
                                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar (Kho thuốc & vật tư) */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t border-border bg-card/60 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>
                    Hiển thị {medTotalItems === 0 ? 0 : (safeMedPage - 1) * medPageSize + 1}–
                    {Math.min(safeMedPage * medPageSize, medTotalItems)} trong tổng số{' '}
                    <strong className="text-foreground">{medTotalItems}</strong> sản phẩm
                  </span>
                  <span className="text-border">|</span>
                  <div className="flex items-center gap-1.5">
                    <span>Mỗi trang:</span>
                    <select
                      value={medPageSize}
                      onChange={(e) => {
                        setMedPageSize(Number(e.target.value));
                        setMedPage(1);
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
                    disabled={safeMedPage <= 1}
                    onClick={() => setMedPage((p) => Math.max(1, p - 1))}
                    className="h-7 px-2.5 text-xs gap-1"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    <span>Trước</span>
                  </Button>
                  <span className="px-2 text-xs font-medium text-foreground">
                    Trang {safeMedPage} / {medTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safeMedPage >= medTotalPages}
                    onClick={() => setMedPage((p) => Math.min(medTotalPages, p + 1))}
                    className="h-7 px-2.5 text-xs gap-1"
                  >
                    <span>Sau</span>
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
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
                  <option value="PENDING">Chờ xử lý</option>
                  <option value="LINKED">Đã gắn SP có sẵn</option>
                  <option value="ADDED">Đã tạo SP mới</option>
                  <option value="DISMISSED">Đã bỏ qua</option>
                </select>

                <select
                  value={suggestionKindFilter}
                  onChange={(e) => setSuggestionKindFilter(e.target.value)}
                  className="h-9 px-2.5 bg-background border border-border rounded-lg text-xs"
                >
                  <option value="ALL">Tất cả loại vật tư</option>
                  <option value="CHEMICAL">Thuốc BVTV hóa học</option>
                  <option value="BIOLOGICAL">Chế phẩm sinh học BVTV</option>
                  <option value="SUPPLY">Vật tư canh tác</option>
                  <option value="PRACTICE">Biện pháp canh tác</option>
                </select>

                <div className="inline-flex rounded-lg border border-border p-0.5 bg-background shrink-0">
                  <button
                    type="button"
                    onClick={() => setSuggestionsViewMode('grouped')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${suggestionsViewMode === 'grouped'
                      ? 'bg-primary text-white shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Gộp theo tên ({groupedSuggestions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuggestionsViewMode('all')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${suggestionsViewMode === 'all'
                      ? 'bg-primary text-white shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Tất cả đoạn ({filteredSuggestions.length})
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {suggestions.some((s) => s.status === 'DISMISSED') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCleanDismissedSuggestions}
                    className="h-9 bg-card border-border hover:bg-destructive/10 hover:text-destructive text-xs shrink-0"
                    title="Xóa vĩnh viễn tất cả các gợi ý đã được đánh dấu Bỏ qua"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1 text-destructive" />
                    Dọn gợi ý đã bỏ qua ({suggestions.filter((s) => s.status === 'DISMISSED').length})
                  </Button>
                )}
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
            </div>

            <Card className="border-border bg-card shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-3 w-[220px] min-w-[180px]">Vật tư &amp; Phân loại</th>
                      <th className="p-3 w-[170px] min-w-[140px]">Cây – Bệnh mục tiêu</th>
                      <th className="p-3 min-w-[220px]">Đoạn trích bằng chứng</th>
                      <th className="p-3 w-[180px] min-w-[150px]">Trạng thái &amp; Liên kết kho</th>
                      <th className="p-3 w-[90px] text-right whitespace-nowrap sticky right-0 bg-muted/95 backdrop-blur-xs z-10">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {loadingSuggestions ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          Đang tải danh sách gợi ý vật tư...
                        </td>
                      </tr>
                    ) : (suggestionsViewMode === 'grouped' ? groupedSuggestions.length === 0 : filteredSuggestions.length === 0) ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          Không tìm thấy gợi ý vật tư nào.
                        </td>
                      </tr>
                    ) : suggestionsViewMode === 'grouped' ? (
                      pagedGroupedSuggestions.map((group) => {
                        const isBanned = isIngredientBanned(group.mentionText);
                        const primary = group.primaryItem;
                        // Thao tác (Tạo / Gắn / Bỏ qua) phải dùng gợi ý còn PENDING: gợi ý đầu nhóm có thể đã ADDED (TASK-17-R2)
                        const actionItem = group.items.find((it) => it.status === 'PENDING') || primary;
                        const cleanPreview = excerptAroundMention(primary.evidence_text || '', group.mentionText, 170);

                        return (
                          <tr key={group.groupKey} className="hover:bg-muted/30 transition-colors">
                            {/* Cột 1: Vật tư & Phân loại (Gộp dòng 1: tên + badge; dòng 2: số đoạn trích) */}
                            <td className="p-3 font-medium align-top">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-foreground text-xs">{group.mentionText}</span>
                                <Badge
                                  variant="outline"
                                  className={
                                    group.kind === 'CHEMICAL'
                                      ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300 text-[10px] py-0 px-1.5'
                                      : group.kind === 'BIOLOGICAL'
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300 text-[10px] py-0 px-1.5'
                                        : group.kind === 'SUPPLY'
                                          ? 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300 text-[10px] py-0 px-1.5'
                                          : 'bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/30 dark:text-purple-300 text-[10px] py-0 px-1.5'
                                  }
                                >
                                  {group.kind === 'CHEMICAL'
                                    ? 'Hóa học'
                                    : group.kind === 'BIOLOGICAL'
                                      ? 'Sinh học'
                                      : group.kind === 'SUPPLY'
                                        ? 'Vật tư canh tác'
                                        : 'Biện pháp'}
                                </Badge>
                                {isBanned && (
                                  <Badge variant="destructive" className="text-[9px] h-4 px-1">
                                    Cấm (TT 75)
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-1">
                                Xuất hiện ở <span className="font-semibold text-foreground">{group.count}</span> đoạn trích
                              </div>
                            </td>

                            {/* Cột 2: Cây – Bệnh mục tiêu (Line 1: Tên cây; Line 2: Tên bệnh) */}
                            <td className="p-3 align-top">
                              <div className="space-y-0.5">
                                <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                                  <span className="truncate">{group.plantName}</span>
                                </div>
                                <div className="text-[11px] text-muted-foreground leading-snug line-clamp-2" title={group.diseaseName}>
                                  {group.diseaseName}
                                </div>
                              </div>
                            </td>

                            {/* Cột 3: Đoạn trích bằng chứng (Line 1: Trích dẫn; Line 2: Xem chi tiết & nguồn) */}
                            <td className="p-3 align-top">
                              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                "<HighlightedText text={cleanPreview} mention={group.mentionText} />"
                              </p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewingEvidenceGroup({
                                      mentionText: group.mentionText,
                                      kind: group.kind,
                                      count: group.count,
                                      items: group.items,
                                      status: group.status,
                                      plantName: group.plantName,
                                      diseaseName: group.diseaseName,
                                      productName: group.productName,
                                    });
                                    setActiveEvidenceTabIdx(0);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                                  title="Nhấn để xem toàn bộ đoạn trích và thông tin bài báo"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Xem chi tiết ({group.count})</span>
                                </button>
                                {primary.source_url && (
                                  <a
                                    href={primary.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary hover:underline max-w-[180px] truncate"
                                    title={primary.source_title || 'Bài viết gốc'}
                                  >
                                    <span className="truncate">{primary.source_title || 'Bài viết gốc'}</span>
                                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                  </a>
                                )}
                              </div>
                            </td>

                            {/* Cột 4: Trạng thái & Sản phẩm liên kết (Line 1: Badge; Line 2: SP liên kết) */}
                            <td className="p-3 align-top">
                              <div className="space-y-1">
                                <div>
                                  {group.status === 'PENDING' ? (
                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-medium">
                                      Chờ xử lý ({group.count})
                                    </Badge>
                                  ) : group.status === 'LINKED' ? (
                                    <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px] font-medium">
                                      Đã gắn SP
                                    </Badge>
                                  ) : group.status === 'ADDED' ? (
                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-medium">
                                      Đã tạo SP
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">
                                      Đã bỏ qua
                                    </Badge>
                                  )}
                                </div>

                                <div className="text-[11px] leading-snug">
                                  {group.productName && group.status === 'PENDING' ? (
                                    <span className="text-amber-700 dark:text-amber-400 text-[10px] block" title="Cùng hoạt chất với sản phẩm trong kho. Nhấn 'Thao tác' -> 'Gắn SP' để xác nhận.">
                                      Khớp: <b>{group.productName}</b>
                                    </span>
                                  ) : group.productName ? (
                                    group.productId ? (
                                      <Link
                                        to={`/admin/inventory/products/${group.productId}`}
                                        className="font-bold text-emerald-800 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 max-w-[170px] truncate"
                                        title={`Xem sản phẩm "${group.productName}"`}
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span className="truncate">{group.productName}</span>
                                      </Link>
                                    ) : (
                                      <span className="font-bold text-emerald-800 dark:text-emerald-400 inline-flex items-center gap-1 max-w-[170px] truncate">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span className="truncate">{group.productName}</span>
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-muted-foreground/60 text-[10px] italic">Chưa liên kết</span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Cột 5: Menu Thao tác gọn gàng (Gom toàn bộ nút vào Dropdown Menu) */}
                            <td className="p-3 text-right whitespace-nowrap align-top sticky right-0 bg-background/95 backdrop-blur-xs shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.06)] z-10">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={`h-7 px-2.5 text-xs font-semibold gap-1.5 transition-colors ${
                                      group.status === 'PENDING'
                                        ? 'border-emerald-600/40 text-emerald-800 dark:text-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/60 dark:bg-emerald-950/30'
                                        : 'border-border text-foreground hover:bg-muted'
                                    }`}
                                  >
                                    <span>Thao tác</span>
                                    <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52 text-xs p-1">
                                  {group.status === 'PENDING' ? (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() => openEvidenceModal(group.items)}
                                        className="cursor-pointer gap-2 py-2 font-medium text-emerald-700 dark:text-emerald-400 focus:text-emerald-800 focus:bg-emerald-50 dark:focus:bg-emerald-950/40"
                                      >
                                        <Plus className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>{group.kind === 'PRACTICE' ? 'Tạo vật tư canh tác' : 'Tạo sản phẩm mới'}</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setLinkingSuggestion(actionItem);
                                          setSelectedLinkMedId(actionItem.product_id ?? group.productId ?? '');
                                        }}
                                        className="cursor-pointer gap-2 py-2"
                                      >
                                        <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Gắn vào SP trong kho</span>
                                      </DropdownMenuItem>
                                      {group.kind === 'PRACTICE' && (
                                        <DropdownMenuItem
                                          onClick={() => handleDismissSuggestion(actionItem.id, true)}
                                          className="cursor-pointer gap-2 py-2 text-purple-700 dark:text-purple-300"
                                        >
                                          <Check className="w-3.5 h-3.5 text-purple-600" />
                                          <span>Ghi nhận vào sổ tay</span>
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuSeparator className="my-1" />
                                      <DropdownMenuItem
                                        onClick={() => handleDismissSuggestion(actionItem.id)}
                                        className="cursor-pointer gap-2 py-2 text-amber-700 dark:text-amber-400"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        <span>Bỏ qua ({group.count} gợi ý)</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteSuggestion(actionItem.id, group.mentionText)}
                                        className="cursor-pointer gap-2 py-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Xóa vĩnh viễn</span>
                                      </DropdownMenuItem>
                                    </>
                                  ) : (
                                    <>
                                      {group.status === 'LINKED' && (
                                        <DropdownMenuItem
                                          onClick={() => handleUnlinkSuggestion(actionItem.id, group.mentionText)}
                                          disabled={unlinkingId === actionItem.id}
                                          className="cursor-pointer gap-2 py-2 text-amber-700 dark:text-amber-400 font-medium"
                                        >
                                          {unlinkingId === actionItem.id ? (
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                          ) : (
                                            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                                          )}
                                          <span>Hủy gán liên kết</span>
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setLinkingSuggestion(actionItem);
                                          setSelectedLinkMedId(actionItem.product_id ?? group.productId ?? '');
                                        }}
                                        className="cursor-pointer gap-2 py-2"
                                      >
                                        <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Gắn lại sản phẩm khác</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => openEvidenceModal(group.items)}
                                        className="cursor-pointer gap-2 py-2"
                                      >
                                        <Plus className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Tạo thêm SP từ gợi ý này</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator className="my-1" />
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteSuggestion(actionItem.id, group.mentionText)}
                                        className="cursor-pointer gap-2 py-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Xóa gợi ý</span>
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      pagedFilteredSuggestions.map((sug) => {
                        const isBanned = isIngredientBanned(sug.mention_text);
                        const cleanPreview = excerptAroundMention(sug.evidence_text || '', sug.mention_text, 170);

                        return (
                          <tr key={sug.id} className="hover:bg-muted/30 transition-colors">
                            {/* Cột 1: Vật tư & Phân loại (Line 1: Tên + Badge; Line 2: ID + Ngày) */}
                            <td className="p-3 font-medium align-top">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-foreground text-xs">{sug.mention_text}</span>
                                <Badge
                                  variant="outline"
                                  className={
                                    sug.kind === 'CHEMICAL'
                                      ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300 text-[10px] py-0 px-1.5'
                                      : sug.kind === 'BIOLOGICAL'
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300 text-[10px] py-0 px-1.5'
                                        : sug.kind === 'SUPPLY'
                                          ? 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300 text-[10px] py-0 px-1.5'
                                          : 'bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/30 dark:text-purple-300 text-[10px] py-0 px-1.5'
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
                                {isBanned && (
                                  <Badge variant="destructive" className="text-[9px] h-4 px-1">
                                    Cấm (TT 75)
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-1">
                                Mã #{sug.id} • {new Date(sug.created_at).toLocaleDateString('vi-VN')}
                              </div>
                            </td>

                            {/* Cột 2: Cây – Bệnh mục tiêu (Line 1: Tên cây; Line 2: Tên bệnh) */}
                            <td className="p-3 align-top">
                              <div className="space-y-0.5">
                                <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                                  <span className="truncate">{sug.plant_name}</span>
                                </div>
                                <div className="text-[11px] text-muted-foreground leading-snug line-clamp-2" title={sug.disease_name}>
                                  {sug.disease_name}
                                </div>
                              </div>
                            </td>

                            {/* Cột 3: Đoạn trích bằng chứng (Line 1: Trích dẫn; Line 2: Xem toàn văn & nguồn) */}
                            <td className="p-3 align-top">
                              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                "<HighlightedText text={cleanPreview} mention={sug.mention_text} />"
                              </p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewingEvidenceGroup({
                                      mentionText: sug.mention_text,
                                      kind: sug.kind,
                                      count: 1,
                                      items: [sug],
                                      status: sug.status,
                                      plantName: sug.plant_name,
                                      diseaseName: sug.disease_name,
                                      productName: sug.product_name,
                                    });
                                    setActiveEvidenceTabIdx(0);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                                  title="Nhấn để xem toàn bộ nội dung đoạn trích và thông tin bài báo"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Xem toàn văn</span>
                                </button>
                                {sug.source_url && (
                                  <a
                                    href={sug.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary hover:underline max-w-[180px] truncate"
                                    title={sug.source_title || 'Xem bài viết gốc'}
                                  >
                                    <span className="truncate">{sug.source_title || 'Xem bài viết gốc'}</span>
                                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                  </a>
                                )}
                              </div>
                            </td>

                            {/* Cột 4: Trạng thái & Sản phẩm liên kết (Line 1: Badge; Line 2: SP liên kết) */}
                            <td className="p-3 align-top">
                              <div className="space-y-1">
                                <div>
                                  {sug.status === 'PENDING' ? (
                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-medium">
                                      Chờ xử lý
                                    </Badge>
                                  ) : sug.status === 'LINKED' ? (
                                    <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px] font-medium">
                                      Đã gắn SP
                                    </Badge>
                                  ) : sug.status === 'ADDED' ? (
                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-medium">
                                      Đã tạo SP
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">
                                      Đã bỏ qua
                                    </Badge>
                                  )}
                                </div>

                                <div className="text-[11px] leading-snug">
                                  {sug.product_name && sug.status === 'PENDING' ? (
                                    <span className="text-amber-700 dark:text-amber-400 text-[10px] block" title="Cùng hoạt chất với sản phẩm trong kho. Nhấn 'Thao tác' -> 'Gắn SP' để xác nhận.">
                                      Khớp: <b>{sug.product_name}</b>
                                    </span>
                                  ) : sug.product_name ? (
                                    sug.product_id ? (
                                      <Link
                                        to={`/admin/inventory/products/${sug.product_id}`}
                                        className="font-bold text-emerald-800 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 max-w-[170px] truncate"
                                        title={`Xem sản phẩm "${sug.product_name}"`}
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span className="truncate">{sug.product_name}</span>
                                      </Link>
                                    ) : (
                                      <span className="font-bold text-emerald-800 dark:text-emerald-400 inline-flex items-center gap-1 max-w-[170px] truncate">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span className="truncate">{sug.product_name}</span>
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-muted-foreground/60 text-[10px] italic">Chưa liên kết</span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Cột 5: Menu Thao tác gọn gàng (Gom toàn bộ nút vào Dropdown Menu) */}
                            <td className="p-3 text-right whitespace-nowrap align-top sticky right-0 bg-background/95 backdrop-blur-xs shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.06)] z-10">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className={`h-7 px-2.5 text-xs font-semibold gap-1.5 transition-colors ${
                                      sug.status === 'PENDING'
                                        ? 'border-emerald-600/40 text-emerald-800 dark:text-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/60 dark:bg-emerald-950/30'
                                        : 'border-border text-foreground hover:bg-muted'
                                    }`}
                                  >
                                    <span>Thao tác</span>
                                    <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52 text-xs p-1">
                                  {sug.status === 'PENDING' ? (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() => openEvidenceModal([sug])}
                                        className="cursor-pointer gap-2 py-2 font-medium text-emerald-700 dark:text-emerald-400 focus:text-emerald-800 focus:bg-emerald-50 dark:focus:bg-emerald-950/40"
                                      >
                                        <Plus className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>{sug.kind === 'PRACTICE' ? 'Tạo vật tư canh tác' : 'Tạo sản phẩm mới'}</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setLinkingSuggestion(sug);
                                          setSelectedLinkMedId(sug.product_id ?? '');
                                        }}
                                        className="cursor-pointer gap-2 py-2"
                                      >
                                        <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Gắn vào SP trong kho</span>
                                      </DropdownMenuItem>
                                      {sug.kind === 'PRACTICE' && (
                                        <DropdownMenuItem
                                          onClick={() => handleDismissSuggestion(sug.id, true)}
                                          className="cursor-pointer gap-2 py-2 text-purple-700 dark:text-purple-300"
                                        >
                                          <Check className="w-3.5 h-3.5 text-purple-600" />
                                          <span>Ghi nhận vào sổ tay</span>
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuSeparator className="my-1" />
                                      <DropdownMenuItem
                                        onClick={() => handleDismissSuggestion(sug.id)}
                                        className="cursor-pointer gap-2 py-2 text-amber-700 dark:text-amber-400"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        <span>Bỏ qua gợi ý</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteSuggestion(sug.id, sug.mention_text)}
                                        className="cursor-pointer gap-2 py-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Xóa vĩnh viễn</span>
                                      </DropdownMenuItem>
                                    </>
                                  ) : (
                                    <>
                                      {sug.status === 'LINKED' && (
                                        <DropdownMenuItem
                                          onClick={() => handleUnlinkSuggestion(sug.id, sug.mention_text)}
                                          disabled={unlinkingId === sug.id}
                                          className="cursor-pointer gap-2 py-2 text-amber-700 dark:text-amber-400 font-medium"
                                        >
                                          {unlinkingId === sug.id ? (
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                          ) : (
                                            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                                          )}
                                          <span>Hủy gán liên kết</span>
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setLinkingSuggestion(sug);
                                          setSelectedLinkMedId(sug.product_id ?? '');
                                        }}
                                        className="cursor-pointer gap-2 py-2"
                                      >
                                        <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Gắn lại sản phẩm khác</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => openEvidenceModal([sug])}
                                        className="cursor-pointer gap-2 py-2"
                                      >
                                        <Plus className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Tạo thêm SP từ gợi ý này</span>
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator className="my-1" />
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteSuggestion(sug.id, sug.mention_text)}
                                        className="cursor-pointer gap-2 py-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Xóa gợi ý</span>
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar (Gợi ý vật tư) */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t border-border bg-card/60 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>
                    Hiển thị {currentSuggestionTotal === 0 ? 0 : (safeSuggestionPage - 1) * suggestionPageSize + 1}–
                    {Math.min(safeSuggestionPage * suggestionPageSize, currentSuggestionTotal)} trong tổng số{' '}
                    <strong className="text-foreground">{currentSuggestionTotal}</strong>{' '}
                    {suggestionsViewMode === 'grouped' ? 'gợi ý (gộp)' : 'đoạn trích'}
                  </span>
                  <span className="text-border">|</span>
                  <div className="flex items-center gap-1.5">
                    <span>Mỗi trang:</span>
                    <select
                      value={suggestionPageSize}
                      onChange={(e) => {
                        setSuggestionPageSize(Number(e.target.value));
                        setSuggestionPage(1);
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
                    disabled={safeSuggestionPage <= 1}
                    onClick={() => setSuggestionPage((p) => Math.max(1, p - 1))}
                    className="h-7 px-2.5 text-xs gap-1"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    <span>Trước</span>
                  </Button>
                  <span className="px-2 text-xs font-medium text-foreground">
                    Trang {safeSuggestionPage} / {suggestionTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safeSuggestionPage >= suggestionTotalPages}
                    onClick={() => setSuggestionPage((p) => Math.min(suggestionTotalPages, p + 1))}
                    className="h-7 px-2.5 text-xs gap-1"
                  >
                    <span>Sau</span>
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DIALOG GẮN GỢI Ý VẬT TƯ VÀO SẢN PHẨM CÓ SẴN (2 CỘT TÁCH BIỆT: CHỌN SẢN PHẨM & LIỀU DÙNG) */}
      {/* ========================================================================= */}
      <Dialog open={!!linkingSuggestion} onOpenChange={closeLinkDialog}>
        <DialogContent className="sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl w-[96vw] h-[92vh] max-h-[94vh] flex flex-col p-0 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          {/* HEADER GỘP THÔNG MINH: TIÊU ĐỀ + BỆNH MỤC TIÊU + TỪ KHÓA + NÚT XEM ĐOẠN TRÍCH */}
          <DialogHeader className="px-4 py-3 sm:px-5 sm:py-3 border-b border-border/70 pr-12 relative shrink-0 bg-muted/20">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              {/* Bên trái: Icon + Tiêu đề + Bệnh mục tiêu & Từ khóa */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 flex items-center justify-center shrink-0">
                  <LinkIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <DialogTitle className="text-sm sm:text-base font-bold text-foreground">
                      Gắn gợi ý vào sản phẩm trong kho
                    </DialogTitle>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300 text-[11px] font-bold py-0 h-5">
                      Từ khóa: {linkingSuggestion?.mention_text}
                    </Badge>
                  </div>
                  <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5 truncate">
                    <span>Mục tiêu:</span>
                    <strong className="text-foreground font-semibold">
                      {linkingSuggestion?.plant_name} – {linkingSuggestion?.disease_name}
                    </strong>
                  </DialogDescription>
                </div>
              </div>

              {/* Bên phải: Nút xem đoạn trích gốc (Gộp vào tiêu đề cực kỳ gọn gàng) */}
              {linkingSuggestion?.evidence_text && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLinkSnippetDialog(true)}
                    className="h-8 px-3 text-xs font-semibold gap-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-300/80 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors shadow-2xs"
                    title="Mở toàn văn đoạn trích tài liệu khuyến nông gốc"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Xem đoạn trích gốc</span>
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {linkingSuggestion && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden text-xs">
              {/* KHÔNG GIAN 2 CỘT TÁCH BIỆT (CHỌN PRODUCT & LIỀU DÙNG THEO BỆNH) */}
              <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 overflow-hidden">

                {/* CỘT TRÁI (md:col-span-5): CHỌN SẢN PHẨM TRONG KHO */}
                <div className="md:col-span-5 flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-border/70 bg-muted/10">
                  <div className="p-3 border-b border-border/60 bg-muted/20 shrink-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                        <Package className="w-3.5 h-3.5 text-emerald-700" />
                        <span>1. Chọn sản phẩm trong kho</span>
                      </label>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {rankedLinkMedicines.length} sản phẩm
                      </span>
                    </div>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Tìm theo tên, hoạt chất..."
                        value={linkProductSearch}
                        onChange={(e) => setLinkProductSearch(e.target.value)}
                        className="h-8 pl-8 text-xs bg-background"
                      />
                    </div>
                  </div>

                  {/* Danh sách cuộn sản phẩm */}
                  <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                    {rankedLinkMedicines.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground">
                        <AlertTriangle className="w-6 h-6 mx-auto mb-1 text-amber-500 opacity-60" />
                        <p>Không tìm thấy sản phẩm phù hợp.</p>
                      </div>
                    ) : (
                      rankedLinkMedicines.map(({ medicine: m, score }) => {
                        const isSelected = selectedLinkMedId === m.id;
                        const treatsDisease = (m.target_diseases || []).includes(linkingSuggestion.model_class || '');
                        const linkedRule = m.usage_profile?.disease_rules?.[linkingSuggestion.model_class || ''];
                        const hasCustomRule = treatsDisease && linkedRule && linkedRule.scope !== 'plant';
                        return (
                          <div
                            key={m.id}
                            onClick={() => setSelectedLinkMedId(m.id)}
                            className={`group relative p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${isSelected
                                ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs ring-1 ring-emerald-500/40'
                                : 'border-border/70 hover:border-border hover:bg-muted/40 bg-background'
                              }`}
                          >
                            {/* Radio indicator */}
                            <div className="mt-0.5 shrink-0">
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${isSelected
                                    ? 'border-emerald-600 bg-emerald-600 text-white'
                                    : 'border-muted-foreground/40 group-hover:border-muted-foreground'
                                  }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                            </div>

                            {/* Ảnh thu nhỏ */}
                            <div className="w-10 h-10 rounded-lg border border-border/80 bg-muted/30 overflow-hidden shrink-0 flex items-center justify-center">
                              {m.image_url ? (
                                <img src={m.image_url} alt={m.name} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-4 h-4 text-muted-foreground/40" />
                              )}
                            </div>

                            {/* Thông tin sản phẩm */}
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-start justify-between gap-1">
                                <h4 className={`text-xs font-bold leading-tight truncate ${isSelected ? 'text-emerald-900 dark:text-emerald-300' : 'text-foreground'}`}>
                                  {m.name}
                                </h4>
                                {score >= 70 && (
                                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[9px] py-0 px-1 border-0 shrink-0">
                                    Khớp {score}%
                                  </Badge>
                                )}
                              </div>

                              <div className="text-[10px] text-muted-foreground truncate">
                                {m.active_ingredient ? (
                                  <span>Hoạt chất: <strong className="text-foreground">{m.active_ingredient}</strong></span>
                                ) : (
                                  <span>{m.medicine_type}</span>
                                )}
                              </div>

                              {/* Huy hiệu tình trạng liều theo bệnh */}
                              <div className="pt-0.5 flex flex-wrap gap-1">
                                {hasCustomRule ? (
                                  <Badge variant="outline" className="text-[9px] py-0 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-300 font-medium">
                                    Đã có liều riêng cho bệnh này
                                  </Badge>
                                ) : treatsDisease ? (
                                  <Badge variant="outline" className="text-[9px] py-0 px-1.5 bg-blue-50 text-blue-700 border-blue-300 font-medium">
                                    Đã có bệnh này (dùng liều chung)
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[9px] py-0 px-1.5 bg-muted/60 text-muted-foreground border-border">
                                    + Sẽ thêm bệnh này vào sản phẩm
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* CỘT PHẢI (md:col-span-7): LIỀU LƯỢNG & QUY TẮC CÁCH DÙNG CHO BỆNH */}
                <div className="md:col-span-7 flex flex-col min-h-0 bg-background">
                  <div className="p-3 border-b border-border/60 bg-muted/10 shrink-0 flex items-center justify-between">
                    <div>
                      <label className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                        <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                        <span>2. Liều lượng &amp; Quy tắc dùng cho bệnh</span>
                      </label>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Áp dụng riêng cho bệnh: <strong className="text-foreground">{linkingSuggestion.disease_name}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Nội dung cột phải */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                    {!selectedLinkMed ? (
                      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                        <ArrowRight className="w-8 h-8 text-muted-foreground/30 mb-2 rotate-180 md:rotate-0" />
                        <p className="font-medium text-xs">Vui lòng chọn một sản phẩm ở cột bên trái</p>
                        <p className="text-[11px] text-muted-foreground/70 mt-1">
                          Hệ thống sẽ hiển thị liều dùng có sẵn hoặc gợi ý tạo liều mới cho bệnh này.
                        </p>
                      </div>
                    ) : hasDosageForDisease && !isEditingExistingRule ? (
                      /* TH A: ĐÃ CÓ LIỀU LƯỢNG RIÊNG CHO BỆNH NÀY */
                      <div className="space-y-3">
                        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/60 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-900 dark:text-emerald-300">
                              <Check className="w-4 h-4 text-emerald-700" />
                              <span>Sản phẩm đã có quy tắc liều riêng cho bệnh này</span>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setIsEditingExistingRule(true);
                                setLinkCustomDosageOpen(true);
                              }}
                              className="h-7 px-2.5 text-xs font-semibold border-emerald-300 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/60"
                            >
                              ✏️ Chỉnh sửa liều này
                            </Button>
                          </div>

                          {existingDiseaseRule?.dosage_instruction ? (
                            <div className="p-2.5 bg-background rounded-lg border border-border text-xs leading-relaxed text-foreground whitespace-pre-line">
                              {existingDiseaseRule.dosage_instruction}
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-foreground italic">
                              Chưa có văn bản hướng dẫn chi tiết, chỉ có thông số kỹ thuật.
                            </p>
                          )}

                          {existingDiseaseRule?.usage_profile && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                              {existingDiseaseRule.usage_profile.dose_amount && (
                                <div className="p-1.5 bg-background/80 rounded border border-border/60">
                                  <span className="text-muted-foreground">Liều:</span>{' '}
                                  <strong>{existingDiseaseRule.usage_profile.dose_amount} {existingDiseaseRule.usage_profile.dose_unit || ''}</strong>
                                </div>
                              )}
                              {existingDiseaseRule.usage_profile.water_liters && (
                                <div className="p-1.5 bg-background/80 rounded border border-border/60">
                                  <span className="text-muted-foreground">Nước:</span>{' '}
                                  <strong>{existingDiseaseRule.usage_profile.water_liters} L</strong>
                                </div>
                              )}
                              {existingDiseaseRule.usage_profile.time_of_day && (
                                <div className="p-1.5 bg-background/80 rounded border border-border/60">
                                  <span className="text-muted-foreground">Buổi:</span>{' '}
                                  <strong>{existingDiseaseRule.usage_profile.time_of_day}</strong>
                                </div>
                              )}
                              {existingDiseaseRule.usage_profile.interval_days && (
                                <div className="p-1.5 bg-background/80 rounded border border-border/60">
                                  <span className="text-muted-foreground">Cách nhau:</span>{' '}
                                  <strong>
                                    {typeof existingDiseaseRule.usage_profile.interval_days === 'object'
                                      ? `${existingDiseaseRule.usage_profile.interval_days.min || ''}–${existingDiseaseRule.usage_profile.interval_days.max || ''} ngày`
                                      : `${existingDiseaseRule.usage_profile.interval_days} ngày`}
                                  </strong>
                                </div>
                              )}
                            </div>
                          )}

                          {existingDiseaseRule?.source_url && (
                            <div className="pt-1 text-[11px] flex items-center gap-1 text-muted-foreground">
                              <span>Nguồn:</span>
                              <a
                                href={existingDiseaseRule.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline inline-flex items-center gap-0.5 truncate max-w-[280px]"
                              >
                                {existingDiseaseRule.source_url}
                                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                              </a>
                            </div>
                          )}
                        </div>

                        <p className="text-[11px] text-muted-foreground text-center">
                          Bấm <strong>Xác nhận liên kết</strong> để liên kết từ khóa với sản phẩm này và giữ nguyên liều dùng trên.
                        </p>
                      </div>
                    ) : (
                      /* TH B: CHƯA CÓ LIỀU HOẶC ĐANG CHỈNH SỬA LIỀU CÓ SẴN */
                      <div className="space-y-3">
                        {/* Nếu đang chỉnh sửa liều có sẵn -> Hiện thanh quay lại */}
                        {hasDosageForDisease && isEditingExistingRule && (
                          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 text-xs flex items-center justify-between">
                            <span className="text-amber-900 dark:text-amber-200 font-medium">
                              ✏️ Bạn đang chỉnh sửa liều riêng cho bệnh này.
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setIsEditingExistingRule(false)}
                              className="h-6 px-2 text-[11px] text-amber-900 dark:text-amber-200 hover:bg-amber-100"
                            >
                              ↩️ Giữ nguyên liều có sẵn
                            </Button>
                          </div>
                        )}

                        {/* LỰA CHỌN LIỀU DÙNG (KHI CHƯA CÓ LIỀU RIÊNG CHO BỆNH NÀY) */}
                        {!hasDosageForDisease && (
                          <div className={`grid ${existingCropRuleEntry ? 'grid-cols-3' : 'grid-cols-2'} p-1 bg-muted/60 rounded-xl border border-border gap-1`}>
                            {existingCropRuleEntry && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDosageChoice('crop_inherited');
                                  const cropRule = existingCropRuleEntry.rule;
                                  if (cropRule.usage_profile && !isUsageEmpty(cropRule.usage_profile)) {
                                    setLinkUsageProfile({ ...cropRule.usage_profile });
                                  }
                                  setLinkDosageText(cropRule.dosage_instruction || '');
                                  setLinkSourceUrl(cropRule.source_url || linkingSuggestion.source_url || '');
                                }}
                                className={`py-2 px-2 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-all ${
                                  dosageChoice === 'crop_inherited'
                                    ? 'bg-background text-emerald-800 dark:text-emerald-300 shadow-xs border border-emerald-500/30'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="truncate">Kế thừa liều Cây {currentPlantName} (Khuyên dùng)</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDosageChoice('custom')}
                              className={`py-2 px-2 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-all ${
                                dosageChoice === 'custom'
                                  ? 'bg-background text-emerald-800 dark:text-emerald-300 shadow-xs border border-emerald-500/30'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                              <span className="truncate">Tạo liều riêng cho bệnh này</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDosageChoice('default')}
                              className={`py-2 px-2 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-all ${
                                dosageChoice === 'default'
                                  ? 'bg-background text-foreground shadow-xs border border-border'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <Layers className="w-3.5 h-3.5 text-blue-600" />
                              <span className="truncate">Dùng liều chung của kho</span>
                            </button>
                          </div>
                        )}

                        {/* NẾU CHỌN KẾ THỪA LIỀU CÂY TRỒNG */}
                        {!hasDosageForDisease && dosageChoice === 'crop_inherited' && existingCropRuleEntry ? (
                          <div className="space-y-3">
                            <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 dark:border-emerald-800 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-900 dark:text-emerald-300">
                                  <Check className="w-4 h-4 text-emerald-700" />
                                  <span>Đã có liều chuẩn cho Cây {currentPlantName}</span>
                                </div>
                                <Badge className="bg-emerald-600 text-white text-[10px] font-semibold">
                                  Tự động kế thừa
                                </Badge>
                              </div>

                              {existingCropRuleEntry.rule.dosage_instruction ? (
                                <div className="p-2.5 bg-background rounded-lg border border-border text-xs leading-relaxed text-foreground whitespace-pre-line">
                                  {existingCropRuleEntry.rule.dosage_instruction}
                                </div>
                              ) : (
                                <p className="text-[11px] text-muted-foreground italic">
                                  Đã có thông số kỹ thuật pha chế cho Cây {currentPlantName}.
                                </p>
                              )}

                              {existingCropRuleEntry.rule.usage_profile && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                                  {existingCropRuleEntry.rule.usage_profile.dose_amount && (
                                    <div className="p-1.5 bg-background/80 rounded border border-border/60">
                                      <span className="text-muted-foreground">Liều:</span>{' '}
                                      <strong>
                                        {existingCropRuleEntry.rule.usage_profile.dose_amount}{' '}
                                        {existingCropRuleEntry.rule.usage_profile.dose_unit || ''}
                                      </strong>
                                    </div>
                                  )}
                                  {existingCropRuleEntry.rule.usage_profile.water_liters && (
                                    <div className="p-1.5 bg-background/80 rounded border border-border/60">
                                      <span className="text-muted-foreground">Nước:</span>{' '}
                                      <strong>{existingCropRuleEntry.rule.usage_profile.water_liters} L</strong>
                                    </div>
                                  )}
                                  {existingCropRuleEntry.rule.usage_profile.interval_days && (
                                    <div className="p-1.5 bg-background/80 rounded border border-border/60">
                                      <span className="text-muted-foreground">Cách nhau:</span>{' '}
                                      <strong>
                                        {typeof existingCropRuleEntry.rule.usage_profile.interval_days === 'object'
                                          ? `${existingCropRuleEntry.rule.usage_profile.interval_days.min || ''}–${existingCropRuleEntry.rule.usage_profile.interval_days.max || ''} ngày`
                                          : `${existingCropRuleEntry.rule.usage_profile.interval_days} ngày`}
                                      </strong>
                                    </div>
                                  )}
                                </div>
                              )}

                              <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                                💡 Sản phẩm này đã có liều dùng chuẩn cho Cây {currentPlantName}. Bệnh "{linkingSuggestion.disease_name}" sẽ tự động áp dụng liều trên khi bấm <strong>Xác nhận liên kết</strong>.
                              </p>
                            </div>

                            <p className="text-[11px] text-muted-foreground text-center">
                              Bấm <strong>Xác nhận liên kết</strong> bên dưới để hoàn tất ngay không cần nhập lại.
                            </p>
                          </div>
                        ) : !hasDosageForDisease && dosageChoice === 'default' ? (
                          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 text-xs">
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              <Layers className="w-4 h-4 text-blue-600" />
                              <span>Áp dụng liều lượng chung của kho</span>
                            </div>
                            <p className="text-muted-foreground leading-relaxed">
                              Khi nông dân hỏi trị bệnh <strong>{linkingSuggestion.disease_name}</strong>, trợ lý Lavi sẽ đề xuất sản phẩm <strong>"{selectedLinkMed.name}"</strong> kèm hướng dẫn sử dụng mặc định của sản phẩm này.
                            </p>
                            <p className="text-[11px] text-muted-foreground/80">
                              💡 Bạn có thể bổ sung liều lượng riêng và thời gian cách ly cho từng bệnh bất cứ lúc nào trong trang Chi tiết sản phẩm.
                            </p>
                          </div>
                        ) : (
                          /* NẾU CHỌN TẠO LIỀU RIÊNG HOẶC ĐANG EDIT */
                          <div className="space-y-3">
                            {/* Thanh công cụ tra cứu Google & Chế độ Dev */}
                            <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 bg-muted/30 rounded-lg border border-border/60">
                              {(() => {
                                const q = encodeURIComponent(`${selectedLinkMed.name} liều lượng cách dùng trên cây ${currentPlantName}`);
                                return (
                                  <a
                                    href={`https://www.google.com/search?q=${q}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 font-medium text-[11px]"
                                  >
                                    <Search className="w-3 h-3" />
                                    <span>Tra Google nhãn thuốc &amp; liều dùng Cây {currentPlantName}</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                );
                              })()}

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setShowLinkDevMode((v) => !v)}
                                className={`h-7 px-2 text-[11px] gap-1 font-mono font-bold ${showLinkDevMode
                                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-400'
                                    : 'bg-background hover:bg-blue-50 text-blue-700 border-border'
                                  }`}
                                title="Chế độ Dev: Prompt AI & Nạp JSON liều dùng"
                              >
                                <Code2 className="w-3.5 h-3.5" />
                                <span>{showLinkDevMode ? 'Đóng Dev Mode' : 'AI Dev Mode </>'}</span>
                              </Button>
                            </div>

                            {/* Khung Chế độ Dev AI */}
                            {showLinkDevMode && (
                              <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Trợ lý AI bóc tách liều lượng từ nhãn thuốc</span>
                                  </span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCopyLinkAiPrompt}
                                    className="h-6 px-2 text-[11px] bg-background font-semibold text-blue-700 border-blue-300 hover:bg-blue-100/50 gap-1"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>📋 Sao chép Prompt cho AI</span>
                                  </Button>
                                </div>
                                <Textarea
                                  value={linkDevAiInput}
                                  onChange={(e) => setLinkDevAiInput(e.target.value)}
                                  placeholder="Dán câu trả lời JSON từ Gemini / ChatGPT vào đây..."
                                  rows={3}
                                  className="text-xs font-mono bg-background"
                                />
                                <div className="flex justify-end">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={handleApplyLinkAiJson}
                                    disabled={!linkDevAiInput.trim()}
                                    className="h-6 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] gap-1"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    <span>⚡ Điền liều từ AI</span>
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Form Phiếu cách dùng */}
                            <div className="border border-border/80 rounded-xl p-3 bg-muted/20 space-y-3">
                              <UsageProfileEditor
                                value={linkUsageProfile}
                                onChange={setLinkUsageProfile}
                                isSupply={selectedLinkMed.medicine_type === 'Vật tư canh tác'}
                                onCompose={() => {
                                  const isSupply = selectedLinkMed.medicine_type === 'Vật tư canh tác';
                                  const text = formatUsageText(
                                    linkUsageProfile,
                                    isSupply || selectedLinkMed.phi_days === null ? null : Number(selectedLinkMed.phi_days),
                                    isSupply
                                  );
                                  if (text) setLinkDosageText(text);
                                }}
                              />

                              {/* Văn bản hướng dẫn sử dụng */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="font-semibold text-xs text-foreground">
                                    Văn bản hướng dẫn sử dụng cho bệnh này
                                  </label>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const isSupply = selectedLinkMed.medicine_type === 'Vật tư canh tác';
                                      const text = formatUsageText(
                                        linkUsageProfile,
                                        isSupply || selectedLinkMed.phi_days === null ? null : Number(selectedLinkMed.phi_days),
                                        isSupply
                                      );
                                      if (text) setLinkDosageText(text);
                                    }}
                                    className="h-6 px-2 text-[10px] text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 gap-1 font-medium"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    <span>Ghép từ phiếu trên</span>
                                  </Button>
                                </div>
                                <Textarea
                                  rows={3}
                                  placeholder="Ví dụ: Pha 25g cho bình 16 lít nước, phun ướt đều tán lá khi bệnh mới xuất hiện..."
                                  value={linkDosageText}
                                  onChange={(e) => setLinkDosageText(e.target.value)}
                                  className="text-xs bg-background"
                                />
                              </div>

                              {/* Link nguồn tài liệu */}
                              <div>
                                <label className="font-semibold text-xs text-foreground block mb-1">
                                  Link nguồn tham khảo / nhãn thuốc (URL)
                                </label>
                                <Input
                                  type="url"
                                  placeholder="https://bvtv.gov.vn/..."
                                  value={linkSourceUrl}
                                  onChange={(e) => setLinkSourceUrl(e.target.value)}
                                  className="text-xs bg-background"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-between sm:justify-between shrink-0">
            <div className="text-[11px] text-muted-foreground truncate max-w-[55%]">
              {selectedLinkMed ? (
                <span className="flex items-center gap-1.5">
                  <span>Đã chọn:</span>
                  <strong className="text-emerald-700 dark:text-emerald-400 font-semibold truncate max-w-[200px]">{selectedLinkMed.name}</strong>
                  {hasDosageForDisease && !isEditingExistingRule ? (
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[9px] py-0 px-1 border-0">
                      Giữ liều có sẵn
                    </Badge>
                  ) : dosageChoice === 'default' && !hasDosageForDisease ? (
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[9px] py-0 px-1 border-0">
                      Dùng liều chung
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[9px] py-0 px-1 border-0">
                      Tạo liều riêng
                    </Badge>
                  )}
                </span>
              ) : (
                <span>Chưa chọn sản phẩm</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={closeLinkDialog}>
                Hủy
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={linkingLoading || !selectedLinkMedId}
                onClick={handleLinkSuggestion}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
              >
                {linkingLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                    <span>Đang liên kết...</span>
                  </>
                ) : (
                  'Xác nhận liên kết'
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG XEM TOÀN VĂN ĐOẠN TRÍCH TÀI LIỆU KHUYẾN NÔNG GỐC */}
      {/* ========================================================================= */}
      <Dialog open={showLinkSnippetDialog} onOpenChange={setShowLinkSnippetDialog}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-5 rounded-2xl">
          <DialogHeader className="border-b border-border/60 pb-3">
            <DialogTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-foreground">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <span>Đoạn trích tài liệu khuyến nông gốc</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Từ khóa trích xuất: <strong className="text-emerald-700 dark:text-emerald-400">"{linkingSuggestion?.mention_text}"</strong> trong bài viết cho <strong>{linkingSuggestion?.plant_name} – {linkingSuggestion?.disease_name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-3 space-y-3">
            <div className="p-3.5 bg-muted/20 rounded-xl border border-border/60 text-xs">
              {linkingSuggestion?.evidence_text && (
                <FormattedSnippet
                  text={linkingSuggestion.evidence_text}
                  mention={linkingSuggestion.mention_text}
                  variant="full"
                />
              )}
            </div>

            {linkingSuggestion?.source_title && (
              <div className="p-2.5 bg-secondary/30 rounded-lg border border-border text-[11px] flex items-center justify-between">
                <span className="text-muted-foreground truncate">
                  Nguồn: <strong>{linkingSuggestion.source_title}</strong>
                </span>
                {linkingSuggestion.source_url && (
                  <a
                    href={linkingSuggestion.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-medium shrink-0 ml-2"
                  >
                    <span>Mở bài viết</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-border/50">
            <Button variant="outline" size="sm" onClick={() => setShowLinkSnippetDialog(false)} className="text-xs">
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================================= */}
      {/* DIALOG XEM TOÀN VĂN ĐOẠN TRÍCH BẰNG CHỨNG (MULTI-TABS & THAO TÁC TRÊN ĐẦU) */}
      {/* ========================================================================================= */}
      <Dialog open={!!viewingEvidenceGroup} onOpenChange={() => setViewingEvidenceGroup(null)}>
        <DialogContent className="sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto p-5 sm:p-7">
          <DialogHeader className="pb-2 border-b border-border">
            <div className="flex items-center justify-between gap-2 pr-8">
              <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700" />
                <span>Đoạn trích bằng chứng: "{viewingEvidenceGroup?.mentionText}"</span>
              </DialogTitle>
              <Badge variant="outline" className="text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 shrink-0">
                {shownEvidenceCount || 1} đoạn trích · {evidenceTabs.length} bài
              </Badge>
            </div>
            <DialogDescription className="text-xs mt-1">
              Chi tiết ngữ cảnh đoạn văn trong bài báo được AI trích xuất để làm căn cứ gợi ý vật tư và phòng trừ bệnh hại.
            </DialogDescription>
          </DialogHeader>

          {viewingEvidenceGroup && (
            <div className="space-y-4 py-2 text-xs">
              {/* 1. TẠO SẢN PHẨM / GẮN SP CHO CẢ NHÓM (TASK-17-R2: chỉ còn 1 luồng, prompt AI nằm trong form) */}
              <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5 flex-wrap">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Thao tác cho gợi ý: <strong>{viewingEvidenceGroup.mentionText}</strong></span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-1">
                    Tạo SP dùng {evidenceTabs.length - excludedEvidenceTabs.length}/{evidenceTabs.length} bài làm ngữ cảnh và bệnh hại điền sẵn
                    {excludedEvidenceTabs.length > 0 ? ' (bài đã bỏ không được dùng)' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <Button
                    size="sm"
                    disabled={usableEvidenceItems.length === 0}
                    onClick={() => {
                      const groupItems = usableEvidenceItems;
                      const itm = groupItems.find((it) => it.status === 'PENDING') || groupItems[0];
                      setViewingEvidenceGroup(null);
                      handleOpenCreateMedModal(itm, groupItems);
                    }}
                    className="h-8 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{viewingEvidenceGroup.kind === 'PRACTICE' ? 'Tạo vật tư canh tác' : 'Tạo sản phẩm'}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const itm =
                        usableEvidenceItems.find((it) => it.status === 'PENDING') ||
                        viewingEvidenceGroup.items.find((it) => it.status === 'PENDING') ||
                        viewingEvidenceGroup.items[0];
                      setViewingEvidenceGroup(null);
                      setLinkingSuggestion(itm);
                      setSelectedLinkMedId(itm.product_id ?? '');
                    }}
                    className="h-8 px-3 text-xs font-semibold bg-background border-emerald-300 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/50 cursor-pointer"
                    title="Gắn vào sản phẩm có sẵn; bệnh của các gợi ý đang chờ được gắn thêm cho sản phẩm"
                  >
                    <LinkIcon className="w-3 h-3 mr-1" />
                    <span>Gắn vào SP có sẵn</span>
                  </Button>
                </div>
              </div>

              {/* 1b. GỢI Ý TRA GOOGLE THEO LOẠI VẬT TƯ & NGỮ CẢNH (TASK-17) */}
              {(() => {
                const queries = buildGoogleQueries({
                  name: viewingEvidenceGroup.mentionText,
                  kind: viewingEvidenceGroup.kind,
                  evidences: toResearchEvidences(usableEvidenceItems),
                });
                if (!queries.length) return null;
                return (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground inline-flex items-center gap-1 font-medium">
                      <Search className="w-3.5 h-3.5" />
                      Tra Google:
                    </span>
                    {queries.map((q) => (
                      <a
                        key={q.url}
                        href={q.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={q.query}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100/70 font-medium text-[11px]"
                      >
                        <span>{q.label}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ))}
                  </div>
                );
              })()}

              {/* 2. TABS: MỖI TAB = 1 BÀI + 1 BỆNH (các đoạn cùng bài, cùng bệnh gộp chung) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-1.5">
                  <span className="text-xs sm:text-sm font-bold text-foreground">
                    {shownEvidenceCount} đoạn trích trong {evidenceTabs.length} bài báo:
                  </span>
                  {evidenceTabs.length > 1 && (
                    <span className="text-xs text-muted-foreground">Bấm từng tab để đọc; bài không liên quan thì bỏ tick</span>
                  )}
                </div>

                {evidenceTabs.length > 1 && (
                  <div className="flex flex-wrap items-center gap-2 pb-1">
                    {evidenceTabs.map((tab, idx) => {
                      const first = tab.items[0];
                      const excluded = excludedEvidenceTabs.includes(tab.key);
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setActiveEvidenceTabIdx(idx)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${activeEvidenceTabIdx === idx
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                            } ${excluded ? 'opacity-50 line-through' : ''}`}
                        >
                          <span className="font-bold">Bài #{idx + 1}</span>
                          <span className="text-[11px] opacity-90">
                            ({first.plant_name} – {first.disease_name}{tab.items.length > 1 ? `, ${tab.items.length} đoạn` : ''})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 3. CHI TIẾT BÀI ĐANG CHỌN */}
                {(() => {
                  const tab = evidenceTabs[activeEvidenceTabIdx] || evidenceTabs[0];
                  if (!tab) return null;
                  const first = tab.items[0];
                  const excluded = excludedEvidenceTabs.includes(tab.key);
                  return (
                    <div className="space-y-2.5 pt-1">
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-secondary/30 border border-border text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs font-medium bg-background">
                            {first.plant_name} – {first.disease_name}
                          </Badge>
                          <Badge variant="outline" className="text-xs font-medium bg-background">
                            {KIND_LABEL[viewingEvidenceGroup.kind] || viewingEvidenceGroup.kind}
                          </Badge>
                        </div>
                        {evidenceTabs.length > 1 && (
                          <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={!excluded}
                              onChange={(e) =>
                                setExcludedEvidenceTabs((prev) =>
                                  e.target.checked ? prev.filter((k) => k !== tab.key) : [...prev, tab.key]
                                )
                              }
                            />
                            <span>{excluded ? 'Không dùng bài này' : 'Dùng bài này'}</span>
                          </label>
                        )}
                      </div>

                      <div className={`p-3.5 bg-muted/30 rounded-xl border border-border space-y-2 ${excluded ? 'opacity-50' : ''}`}>
                        {tab.items.map((item, i) => (
                          <div key={item.id} className="space-y-1">
                            {tab.items.length > 1 && (
                              <div className="text-[11px] font-semibold text-muted-foreground">
                                Đoạn {i + 1}/{tab.items.length}
                              </div>
                            )}
                            <div className="text-xs leading-relaxed text-foreground p-3.5 bg-background rounded-lg border border-border">
                              <FormattedSnippet
                                text={item.evidence_text || ''}
                                mention={viewingEvidenceGroup.mentionText}
                                variant="full"
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {first.source_url && (
                        <div className="p-2.5 bg-secondary/30 rounded-lg border border-border text-[11px] flex items-center justify-between">
                          <span className="text-muted-foreground truncate">
                            Nguồn: <strong>{first.source_title || 'Bài viết gốc'}</strong>
                          </span>
                          <a
                            href={first.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline shrink-0 ml-2 font-medium"
                          >
                            <span>Mở bài viết</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" size="sm" onClick={() => setViewingEvidenceGroup(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================================= */}
      {/* DIALOG THÊM THUỐC / VẬT TƯ MỚI (TASK-15 PHASE 3 - GIAO DIỆN TINH GỌN & CHẾ ĐỘ DEV </>) */}
      {/* ========================================================================================= */}
      <Dialog
        open={createMedModalOpen}
        onOpenChange={(open) => {
          setCreateMedModalOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl w-[96vw] max-h-[92vh] overflow-y-auto overflow-x-hidden p-5 sm:p-7">
          <DialogHeader className="shrink-0 pb-2 border-b border-border">
            <div className="flex items-center justify-between gap-2 pr-8">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-700" />
                <span>
                  {fromSuggestion
                    ? createStep === 1
                      ? `Bước 1/2 · Thông tin sản phẩm "${newMedName.trim() || fromSuggestion.mention_text}"`
                      : `Bước 2/2 · Liều cho Cây ${cropPlantName || '(chưa rõ cây)'} · ${newMedName.trim() || fromSuggestion.mention_text}`
                    : 'Thêm thuốc / Vật tư mới'}
                </span>
              </DialogTitle>

              {/* NÚT CHẾ ĐỘ DEV </> TINH GỌN */}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowDevMode((v) => !v)}
                disabled={!!fromSuggestion && createStep === 2}
                className={`h-7 w-7 p-0 font-mono font-bold transition-colors flex items-center justify-center shrink-0 ${showDevMode
                  ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-400 shadow-xs'
                  : 'bg-background hover:bg-blue-50 text-blue-700 dark:text-blue-400 border-border'
                  }`}
                title="Chế độ Dev: Prompt AI & Nạp JSON"
              >
                <Code2 className="w-4 h-4" />
              </Button>
            </div>

            <DialogDescription className="text-xs mt-1">
              {fromSuggestion
                ? createStep === 1
                  ? 'Thông tin chung của sản phẩm và liều in trên bao bì (nếu có). Liều cho cây của bài báo nhập ở bước 2.'
                  : `Liều áp dụng cho mọi bệnh của Cây ${cropPlantName || 'này'}${fromSuggestion.source_title ? ` theo bài "${fromSuggestion.source_title}"` : ''}. Lưu thành liều chung của cây, không phải liều bao bì.`
                : 'Thêm sản phẩm thuốc bảo vệ thực vật hoặc vật tư canh tác vào danh mục.'}
            </DialogDescription>
          </DialogHeader>

          {/* NẾU MỞ CHẾ ĐỘ DEV: HIỂN THỊ KHUNG SAO CHÉP PROMPT VÀ DÁN JSON TỪ GEMINI */}
          {showDevMode && !(fromSuggestion && createStep === 2) && (
            <div className="p-3 my-2 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Chế độ Dev: trợ lý AI tổng hợp thông tin (prompt &amp; nạp JSON)</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopyGeminiPrompt}
                  className="h-7 px-2 text-[11px] bg-background font-semibold text-blue-700 dark:text-blue-300 border-blue-300 hover:bg-blue-100/50 gap-1"
                  title="Sao chép prompt (kèm đoạn trích bài báo) để dán vào trợ lý AI (Gemini, ChatGPT...)"
                >
                  <Copy className="w-3 h-3" />
                  <span>{fromSuggestion ? '📋 Prompt 1 – thông tin sản phẩm & bao bì' : '📋 Sao chép prompt cho AI'}{(() => { const n = countArticleBlocks(researchItems); return n ? ` (${n} bài trích)` : ''; })()}</span>
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                1. Bấm <strong>Sao chép prompt cho AI</strong>: prompt kèm đoạn trích bài báo (gộp theo bài), tên, link (nếu có), danh sách mã bệnh; yêu cầu AI tổng hợp nguồn tại Việt Nam, mô tả chi tiết và phiếu cách dùng (liều, buổi, số lần, cách nhau, tối đa lần/vụ, cách ly).<br />
                2. Copy <strong>cả câu trả lời</strong> (khối JSON + danh sách nguồn / ảnh), dán vào ô bên dưới → bấm <strong>Điền form từ AI</strong>. Bệnh hại được <em>gộp thêm</em>; link và ảnh hiện để bạn chọn. Chế độ Dev để tìm nhanh, vẫn phải đối chiếu nguồn trước khi lưu.
              </p>
              <div className="space-y-1.5">
                <Textarea
                  value={devGeminiInput}
                  onChange={(e) => setDevGeminiInput(e.target.value)}
                  placeholder="Dán cả câu trả lời của AI vào đây (khối ```json ... ``` và danh sách nguồn bên dưới)"
                  rows={4}
                  className="text-xs font-mono bg-background"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyGeminiJson}
                    disabled={!devGeminiInput.trim()}
                    className="h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>⚡ Điền form từ AI</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <form onSubmit={handleCreateMedicineSubmit} className="space-y-3 text-xs">
              {fromSuggestion && (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { n: 1 as const, label: 'Thông tin sản phẩm & liều bao bì' },
                    { n: 2 as const, label: `Liều cho Cây ${cropPlantName || '…'}` },
                  ].map((st) => (
                    <button
                      key={st.n}
                      type="button"
                      onClick={() => (st.n === 2 ? goToCropStep() : setCreateStep(1))}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                        createStep === st.n
                          ? st.n === 1
                            ? 'border-blue-400 bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200'
                            : 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                          createStep === st.n ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {st.n}
                      </span>
                      <span className="truncate">{st.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* BƯỚC 1 (ẩn khi đang ở bước 2, giữ nguyên dữ liệu đã nhập) */}
              <div className={fromSuggestion && createStep === 2 ? 'hidden' : 'space-y-3'}>
              {/* 1. KHỐI LINK TRANG SẢN PHẨM / NHÃN THUỐC (URL) */}
              <div className="p-3 bg-secondary/30 rounded-xl border border-border space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <label className="font-semibold block text-xs">
                    Link trang sản phẩm / nhãn thuốc (URL)
                  </label>
                </div>
                {(() => {
                  const queries = buildGoogleQueries({
                    name: newMedName.trim() || fromSuggestion?.mention_text || '',
                    activeIngredient: newMedType === 'Vật tư canh tác' ? '' : newMedActiveIngredient,
                    kind: fromSuggestion?.kind || researchItems[0]?.kind || kindFromMedicineType(newMedType),
                    evidences: toResearchEvidences(researchItems),
                  });
                  if (!queries.length) return null;
                  return (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="text-muted-foreground inline-flex items-center gap-1">
                        <Search className="w-3 h-3" />
                        Tra Google:
                      </span>
                      {queries.map((q) => (
                        <a
                          key={q.url}
                          href={q.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={q.query}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100/70 font-medium"
                        >
                          <span>{q.label}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ))}
                    </div>
                  );
                })()}
                <Input
                  type="url"
                  placeholder="Dán link sản phẩm (Vietchem, Shopee, VTNN, nhãn thuốc)..."
                  value={newMedSourceUrl}
                  onChange={(e) => setNewMedSourceUrl(e.target.value)}
                  className="text-xs bg-background w-full"
                />
                {aiSourceLinks.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold text-violet-800 dark:text-violet-300">Link nguồn AI đề xuất (hãy mở kiểm tra):</div>
                    {aiSourceLinks.map((u) => (
                      <div key={u} className="flex items-center gap-2 text-[11px]">
                        <a href={u} target="_blank" rel="noopener noreferrer" className="truncate text-blue-600 dark:text-blue-400 hover:underline flex-1 min-w-0" title={u}>
                          {u}
                        </a>
                        {newMedSourceUrl.trim() === u ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold shrink-0">Đang dùng</span>
                        ) : (
                          <button type="button" onClick={() => setNewMedSourceUrl(u)} className="text-violet-700 dark:text-violet-300 font-semibold hover:underline shrink-0">
                            Dùng link này
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {aiNotes.length > 0 && (
                  <div className="p-2 rounded-lg border border-amber-300/70 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 text-[11px] space-y-1 [overflow-wrap:anywhere]">
                    <div className="font-semibold text-amber-800 dark:text-amber-300">Lưu ý từ AI</div>
                    {aiNotes.map((n, i) => (
                      <div key={i} className="text-amber-900 dark:text-amber-200">
                        <span className="font-semibold">{n.title}:</span> {n.text}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Không bắt buộc. Chưa có link thì dùng các gợi ý Tra Google, hoặc mở chế độ Dev (nút <code>&lt;/&gt;</code>) để AI tổng hợp và đề xuất link.
                </p>
              </div>

              {/* 2. CÁC TRƯỜNG THÔNG TIN SẢN PHẨM */}
              <div>
                <label className="font-semibold block mb-1">Tên thuốc / Tên sản phẩm *</label>
                <Input
                  type="text"
                  placeholder="Ví dụ: Vôi bột nông nghiệp, Ridomil Gold 68WG..."
                  value={newMedName}
                  onChange={(e) => setNewMedName(e.target.value)}
                  required
                  className={`text-xs ${isIngredientBanned(newMedName) ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                />
                {isIngredientBanned(newMedName) && (
                  <div className="mt-1.5 p-2 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-[11px] flex items-start gap-1.5 leading-tight">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <div>
                      <strong>Cảnh báo chất cấm (TT 75/2025):</strong> Tên sản phẩm "{newMedName}" chứa hoạt chất cấm. Không thể bật lưu hành sản phẩm này.
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="font-semibold block mb-1">Ảnh sản phẩm (URL tùy chọn)</label>
                <Input
                  type="url"
                  placeholder="https://example.com/san-pham-thuoc.jpg"
                  value={newMedImageUrl}
                  onChange={(e) => {
                    setNewMedImageUrl(e.target.value.trim());
                    setMedImageFailed(false);
                  }}
                  className="text-xs"
                />

                {/* XEM TRƯỚC ẢNH SẢN PHẨM ĐÃ CHỌN */}
                {newMedImageUrl.trim() && (newMedImageUrl.startsWith('http://') || newMedImageUrl.startsWith('https://')) && (
                  <div className="mt-2 flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border bg-muted/20">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {medImageFailed ? (
                        <div className="w-14 h-14 rounded-md border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 flex flex-col items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                          <ImageOff className="w-5 h-5" />
                          <span className="text-[9px] mt-0.5 font-medium">Lỗi tải ảnh</span>
                        </div>
                      ) : (
                        <img
                          src={newMedImageUrl}
                          alt="Ảnh sản phẩm đã chọn"
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 object-cover rounded-md border border-border bg-background shrink-0 shadow-xs"
                          onError={() => setMedImageFailed(true)}
                          onLoad={() => setMedImageFailed(false)}
                        />
                      )}
                      <div className="text-[11px] min-w-0 flex-1">
                        <div className="font-semibold text-foreground flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Ảnh sản phẩm (sẽ lưu vào CSDL)</span>
                        </div>
                        <p className="truncate text-muted-foreground text-[10px] max-w-md" title={newMedImageUrl}>
                          {newMedImageUrl}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <a
                            href={newMedImageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <span>Mở xem ảnh gốc</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                          {medImageFailed && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400">
                              (Trang nguồn chặn nhúng ngoài, link vẫn được lưu)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setNewMedImageUrl('');
                        setMedImageFailed(false);
                      }}
                      className="h-7 px-2 text-muted-foreground hover:text-destructive text-xs shrink-0"
                      title="Gỡ ảnh"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}

                {/* ẢNH GEMINI ĐỀ XUẤT (TASK-18): chọn 1 ảnh, ảnh không tải được tự ẩn */}
                {aiImageCandidates.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-[10px] font-semibold text-violet-800 dark:text-violet-300">
                      Ảnh AI đề xuất (bấm để dùng; ảnh không tải được sẽ tự ẩn):
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {aiImageCandidates.map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => {
                            setNewMedImageUrl(u);
                            setMedImageFailed(false);
                          }}
                          title={u}
                          className={`relative w-16 h-16 rounded-md border overflow-hidden bg-background ${newMedImageUrl === u ? 'border-emerald-600 ring-2 ring-emerald-500/40' : 'border-border hover:border-violet-400'
                            }`}
                        >
                          <img
                            src={u}
                            alt="Ảnh đề xuất"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                            onError={() => setAiImageCandidates((prev) => prev.filter((x) => x !== u))}
                          />
                          {newMedImageUrl === u && (
                            <span className="absolute bottom-0 inset-x-0 bg-emerald-700/90 text-white text-[9px] font-semibold">Đang dùng</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5 flex-wrap gap-1">
                  <div className="flex items-center gap-2">
                    <label className="font-semibold">Mô tả sản phẩm / Đặc tính kỹ thuật (tùy chọn)</label>
                    <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/40">
                      <button
                        type="button"
                        onClick={() => setDescPreviewMode(false)}
                        className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${!descPreviewMode
                          ? 'bg-background text-foreground shadow-2xs font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        ✏️ Soạn thảo
                      </button>
                      <button
                        type="button"
                        onClick={() => setDescPreviewMode(true)}
                        className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${descPreviewMode
                          ? 'bg-background text-foreground shadow-2xs font-semibold'
                          : 'text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        👁️ Định dạng đẹp
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {!descPreviewMode && (
                      <button
                        type="button"
                        onClick={() => {
                          const bullet = '• ';
                          setNewMedDescription((prev) => (prev ? `${prev.trimEnd()}\n${bullet}` : bullet));
                        }}
                        className="text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
                      >
                        + Thêm mục •
                      </button>
                    )}
                    <span>{newMedDescription.length}/{DESCRIPTION_MAX}</span>
                  </div>
                </div>

                {!descPreviewMode ? (
                  <Textarea
                    placeholder="• Bản chất & Phân loại: ...&#10;• Công dụng nông nghiệp: ...&#10;• Phạm vi & Cây trồng: ...&#10;• Hướng dẫn & Lưu ý khi dùng: ..."
                    value={newMedDescription}
                    onChange={(e) => setNewMedDescription(e.target.value)}
                    rows={5}
                    maxLength={DESCRIPTION_MAX}
                    className="text-xs leading-relaxed font-sans"
                  />
                ) : (
                  <div className="p-3 bg-secondary/30 rounded-xl border border-border text-xs leading-relaxed min-h-[110px] space-y-2.5">
                    {newMedDescription.trim() ? (
                      newMedDescription.split('\n').map((line, idx) => {
                        const trim = line.trim();
                        if (!trim) return null;
                        if (trim.startsWith('•') || trim.startsWith('-') || trim.startsWith('*') || /^\d+\./.test(trim)) {
                          const content = trim.replace(/^([•\-*]|\d+\.)\s*/, '');
                          const colonIdx = content.indexOf(':');
                          return (
                            <div key={idx} className="flex items-start gap-2 text-foreground">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 mt-1.5 shrink-0" />
                              <div className="flex-1">
                                {colonIdx > -1 ? (
                                  <>
                                    <strong className="text-emerald-800 dark:text-emerald-300">
                                      {content.slice(0, colonIdx + 1)}
                                    </strong>{' '}
                                    <span>{content.slice(colonIdx + 1).trim()}</span>
                                  </>
                                ) : (
                                  <span>{content}</span>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return (
                          <p key={idx} className="text-foreground">
                            {trim}
                          </p>
                        );
                      })
                    ) : (
                      <span className="text-muted-foreground italic text-xs">
                        Chưa có mô tả sản phẩm. Bấm "Soạn thảo" để nhập hoặc dùng Chế độ Dev &lt;/&gt; để AI tự điền.
                      </span>
                    )}
                  </div>
                )}
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
                        if (newMedDosage === 'Pha theo hướng dẫn trên bao bì') {
                          setNewMedDosage('Bón 20 - 50kg/sào (hoặc theo hướng dẫn canh tác)');
                        }
                      } else if (newMedDosage.includes('Bón 20 - 50kg')) {
                        setNewMedDosage('Pha theo hướng dẫn trên bao bì');
                      }
                    }}
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs"
                  >
                    <option value="Hóa học">Thuốc BVTV hóa học</option>
                    <option value="Sinh học">Chế phẩm sinh học BVTV</option>
                    <option value="Vật tư canh tác">Vật tư canh tác (vôi, bẫy, lưới, bạt...)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Tình trạng kinh doanh *</label>
                  <select
                    value={newMedAvailability}
                    onChange={(e) => setNewMedAvailability(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs"
                  >
                    <option value="IN_STOCK">Đang bán (cho phép đặt mua)</option>
                    <option value="OUT_OF_STOCK">Tạm hết hàng (tạm ẩn nút mua)</option>
                    <option value="NOT_SOLD">Cửa hàng không bán (chỉ tư vấn kỹ thuật)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Bệnh hại mục tiêu</label>
                  {newMedTargetDiseases.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {newMedTargetDiseases.map((code) => {
                        const d = diseases.find((x) => x.classCode === code);
                        return (
                          <span
                            key={code}
                            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-200"
                          >
                            <span>{d ? `${d.plantName} – ${d.commonNameVi}` : code}</span>
                            <button
                              type="button"
                              onClick={() => setNewMedTargetDiseases((prev) => prev.filter((c) => c !== code))}
                              className="rounded-full p-0.5 hover:bg-emerald-200/60 dark:hover:bg-emerald-800/60"
                              aria-label="Bỏ bệnh hại này"
                              title="Bỏ bệnh hại này"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <select
                    value=""
                    onChange={(e) => {
                      const code = e.target.value;
                      if (code) setNewMedTargetDiseases((prev) => (prev.includes(code) ? prev : [...prev, code]));
                    }}
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs"
                  >
                    <option value="">
                      {newMedTargetDiseases.length === 0 ? '-- Không chỉ định (áp dụng chung) --' : '+ Thêm bệnh hại khác...'}
                    </option>
                    {diseases
                      .filter((d) => !newMedTargetDiseases.includes(d.classCode))
                      .map((d) => (
                        <option key={d.classCode} value={d.classCode}>
                          {d.plantName} – {d.commonNameVi}
                        </option>
                      ))}
                  </select>
                </div>

                {newMedType !== 'Vật tư canh tác' ? (
                  <div>
                    <label className="font-semibold block mb-1">Hoạt chất chính (Active Ingredient)</label>
                    <Input
                      type="text"
                      placeholder="Ví dụ: Metalaxyl-M, Mancozeb..."
                      value={newMedActiveIngredient}
                      onChange={(e) => setNewMedActiveIngredient(e.target.value)}
                      className={`text-xs ${isIngredientBanned(newMedActiveIngredient) ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    />
                    {isIngredientBanned(newMedActiveIngredient) && (
                      <div className="mt-1.5 p-2 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-[11px] flex items-start gap-1.5 leading-tight">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <div>
                          <strong>Cảnh báo chất cấm (TT 75/2025):</strong> Hoạt chất "{newMedActiveIngredient}" nằm trong danh mục cấm sử dụng tại Việt Nam. Không thể bật lưu hành sản phẩm này.
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="font-semibold block mb-1 text-muted-foreground">Hoạt chất chính</label>
                    <div className="h-8 px-2.5 py-1.5 bg-muted/40 border border-border rounded text-xs text-muted-foreground/60 flex items-center italic">
                      Không áp dụng cho vật tư canh tác
                    </div>
                  </div>
                )}
              </div>

              {newMedAvailability !== 'NOT_SOLD' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold block mb-1">Giá bán (VNĐ)</label>
                    <Input
                      type="number"
                      value={newMedPrice}
                      onChange={(e) => setNewMedPrice(parseFloat(e.target.value) || 0)}
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">Số lượng tồn kho</label>
                    <Input
                      type="number"
                      value={newMedStock}
                      onChange={(e) => setNewMedStock(parseInt(e.target.value, 10) || 0)}
                      className="text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-muted/40 border border-border rounded-lg text-muted-foreground text-xs">
                  Sản phẩm ở chế độ "Cửa hàng không bán": Giá bán và Tồn kho được mặc định là 0. Sản phẩm chỉ hiển thị để tư vấn kỹ thuật nông vụ.
                </div>
              )}

              <div>
                <label className="font-semibold block mb-1">
                  Thời gian cách ly PHI (ngày)
                  {newMedType === 'Vật tư canh tác' ? (
                    <span className="font-normal text-muted-foreground ml-1">(Không áp dụng)</span>
                  ) : (
                    <span className="font-normal text-destructive ml-1">* bắt buộc, lấy theo nhãn thuốc / nguồn</span>
                  )}
                </label>
                <Input
                  type="number"
                  disabled={newMedType === 'Vật tư canh tác'}
                  placeholder={
                    newMedType === 'Vật tư canh tác'
                      ? 'Không áp dụng'
                      : 'Số ngày ghi trên nhãn (VD: 7, 14)'
                  }
                  value={newMedPhi}
                  onChange={(e) => setNewMedPhi(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className="text-xs"
                />
              </div>

              {/* PHIẾU CÁCH DÙNG: hiện cho cả "Tạo SP" từ gợi ý và "Thêm sản phẩm" (TASK-30: không lưu ngầm số liệu AI) */}
              {/* TASK-31: tạo từ gợi ý → khung 1 = liều bao bì (tùy chọn), khung 2 = liều cho cây của bài */}
              <div
                className={
                  fromSuggestion
                    ? 'p-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 space-y-2.5'
                    : 'space-y-2.5'
                }
              >
                {fromSuggestion ? (
                  <div>
                    <h4 className="font-bold text-xs text-blue-900 dark:text-blue-300">Liều bao bì của sản phẩm (tùy chọn)</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Chỉ điền khi biết thông số in trên nhãn / bao bì của nhà sản xuất; chưa có thì để trống. Điền nhanh bằng <strong>Prompt 1</strong> ở chế độ Dev (nút <code>&lt;/&gt;</code> trên cùng). Liều cho cây của bài báo nhập ở bước 2.
                    </p>
                  </div>
                ) : (
                  <div className="p-2.5 bg-muted/40 border border-border rounded-lg text-muted-foreground text-[11px] leading-relaxed flex items-start gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      Đây là <strong>liều chung của sản phẩm</strong> (theo nhãn / bao bì), dùng khi cây chưa có liều riêng. Để trống nếu chưa có nguồn.
                      Liều theo từng cây thiết lập ở trang <strong>Chi tiết sản phẩm</strong> sau khi tạo.
                    </span>
                  </div>
                )}
                <UsageProfileEditor
                  value={newMedUsage}
                  onChange={setNewMedUsage}
                  isSupply={newMedType === 'Vật tư canh tác'}
                  onCompose={() => {
                    const isSupply = newMedType === 'Vật tư canh tác';
                    const text = formatUsageText(newMedUsage, isSupply || newMedPhi === '' ? null : Number(newMedPhi), isSupply);
                    if (text) {
                      setNewMedDosage(text);
                      toast.success('Đã ghép phiếu cách dùng vào ô Hướng dẫn sử dụng.');
                    }
                  }}
                />

                <div>
                  <label className="font-semibold block mb-1">
                    {fromSuggestion ? 'Hướng dẫn sử dụng chung (bao bì)' : 'Hướng dẫn sử dụng / Liều lượng'}
                  </label>
                  <Textarea
                    value={newMedDosage}
                    onChange={(e) => setNewMedDosage(e.target.value)}
                    placeholder={
                      newMedType === 'Vật tư canh tác'
                        ? 'Sử dụng theo diện tích canh tác và hướng dẫn nhà sản xuất'
                        : 'Pha theo hướng dẫn trên bao bì'
                    }
                    rows={Math.min(9, Math.max(2, newMedDosage.split('\n').length + 1))}
                    className="text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {fromSuggestion
                      ? 'Lavi đọc ô này. Để trống (hoặc giữ câu mặc định) thì Lavi đọc liều cây ở bước 2, kèm chữ "Trên cây …".'
                      : 'Trợ lý Lavi đọc nguyên văn ô này; con số liều lượng phải có ở đây thì Lavi mới được nói.'}
                  </p>
                </div>
              </div>

              </div>
              {/* HẾT BƯỚC 1 */}

              {fromSuggestion && createStep === 2 && (
                <div className="p-3 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-xs text-emerald-900 dark:text-emerald-300">
                        Liều cho Cây {cropPlantName || '(chưa rõ cây)'}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Áp dụng cho mọi bệnh của cây này
                        {fromSuggestion.source_title ? <> theo bài: <em>{fromSuggestion.source_title}</em></> : null}. Lưu thành liều chung của cây, không thành liều bao bì.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleCopyCropPrompt}
                      disabled={!cropPlantName}
                      className="h-7 px-2 text-[11px] bg-background font-semibold text-emerald-800 dark:text-emerald-300 border-emerald-300 gap-1"
                      title="Prompt 2: tra tài liệu khuyến nông về liều trên đúng cây này"
                    >
                      <Copy className="w-3 h-3" />
                      <span>📋 Prompt 2 – tìm liều cho Cây {cropPlantName || '…'}</span>
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Textarea
                      value={devCropInput}
                      onChange={(e) => setDevCropInput(e.target.value)}
                      placeholder="Dán câu trả lời của AI cho Prompt 2 (khối ```json ... ```) vào đây"
                      rows={2}
                      className="text-xs font-mono bg-background"
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleApplyCropJson}
                        disabled={!devCropInput.trim()}
                        className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>⚡ Điền liều cây từ AI</span>
                      </Button>
                    </div>
                  </div>
                  <UsageProfileEditor
                    value={newCropUsage}
                    onChange={setNewCropUsage}
                    isSupply={newMedType === 'Vật tư canh tác'}
                    onCompose={() => {
                      const isSupply = newMedType === 'Vật tư canh tác';
                      const text = formatUsageText(newCropUsage, isSupply || newMedPhi === '' ? null : Number(newMedPhi), isSupply);
                      if (text) {
                        setNewCropDosage(text);
                        toast.success('Đã ghép phiếu vào ô Hướng dẫn sử dụng cho cây.');
                      }
                    }}
                  />
                  <div>
                    <label className="font-semibold block mb-1">Hướng dẫn sử dụng cho Cây {cropPlantName || '…'}</label>
                    <Textarea
                      value={newCropDosage}
                      onChange={(e) => setNewCropDosage(e.target.value)}
                      placeholder={`Liều và cách dùng trên cây ${cropPlantName || 'này'} (không nêu tên một bệnh cụ thể)`}
                      rows={Math.min(9, Math.max(2, newCropDosage.split('\n').length + 1))}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Link nguồn liều cây (tùy chọn)</label>
                    <Input
                      value={newCropSourceUrl}
                      onChange={(e) => setNewCropSourceUrl(e.target.value)}
                      placeholder="https://..."
                      className="text-xs"
                    />
                  </div>
                </div>
              )}

              <label className={`flex items-center gap-2 cursor-pointer pt-1 ${fromSuggestion && createStep === 2 ? 'hidden' : ''}`}>
                <input
                  type="checkbox"
                  disabled={isIngredientBanned(newMedActiveIngredient) || isIngredientBanned(newMedName)}
                  checked={newMedIsAllowed && !isIngredientBanned(newMedActiveIngredient) && !isIngredientBanned(newMedName)}
                  onChange={(e) => setNewMedIsAllowed(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-700"
                />
                <span className="font-semibold text-xs">
                  {newMedType === 'Vật tư canh tác'
                    ? 'Cho phép sử dụng trong tư vấn canh tác (Lavi được gợi ý cho nông dân)'
                    : 'Đã đối chiếu Danh mục thuốc BVTV được phép sử dụng tại Việt Nam (bật lưu hành, Lavi mới được gợi ý)'}
                </span>
              </label>

              <DialogFooter className="pt-2">
                {/* key riêng cho từng nút: nếu React dùng lại cùng 1 <button> và đổi type="button" → "submit" ngay trong lúc bấm,
                    trình duyệt sẽ gửi form luôn (bấm "Tiếp tục" mà sản phẩm đã bị tạo) */}
                {fromSuggestion && createStep === 2 ? (
                  <Button key="back" type="button" variant="outline" size="sm" onClick={() => setCreateStep(1)} disabled={creatingMed}>
                    ← Quay lại bước 1
                  </Button>
                ) : (
                  <Button key="cancel" type="button" variant="outline" size="sm" onClick={() => setCreateMedModalOpen(false)} disabled={creatingMed}>
                    Hủy
                  </Button>
                )}
                {fromSuggestion && createStep === 1 ? (
                  <Button key="next" type="button" size="sm" onClick={goToCropStep} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold">
                    Tiếp tục: Liều cho Cây {cropPlantName || '…'} →
                  </Button>
                ) : (
                  <Button key="submit" type="submit" size="sm" disabled={creatingMed} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold">
                    {creatingMed ? 'Đang tạo sản phẩm...' : 'Tạo sản phẩm'}
                  </Button>
                )}
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInventoryPage;
