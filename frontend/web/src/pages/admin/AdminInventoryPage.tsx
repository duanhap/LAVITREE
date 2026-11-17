import React, { useState, useEffect, useMemo } from 'react';
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
  Pencil,
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
import apiClient, { getErrorMessage } from '@/lib/api-client';
import type { MedicineItem, ProductSuggestionItem } from '@/features/admin/types';
import {
  isSafeHttpUrl,
  isIngredientBanned,
  excerptAroundMention,
  buildGoogleQueries,
  buildProductResearchPrompt,
  dedupeContainedTexts,
  emptyUsageProfile,
  normalizeUsageProfile,
  formatUsageText,
  usageProfileForApi,
  type UsageProfile,
  type SourceQuote,
  mergeEvidencesByArticle,
  MAX_PROMPT_EVIDENCES,
  parseProductResearchJson,
  kindFromMedicineType,
  KIND_LABEL,
  type ResearchEvidence,
} from '@/features/admin/lib';
import { HighlightedText } from '@/features/admin/components/HighlightedText';
import { UsageProfileEditor } from '@/features/admin/components/UsageProfileEditor';
import { QuoteCheckPanel } from '@/features/admin/components/QuoteCheckPanel';

// Mô tả lưu gộp vào dosage_instruction (cột text, không giới hạn); prompt Gemini yêu cầu 250–450 từ ≈ 1.500–3.000 ký tự
const DESCRIPTION_MAX = 3500;
import { useDiseaseOptions } from '@/features/admin/hooks';

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

export const AdminInventoryPage: React.FC = () => {
  const { diseases } = useDiseaseOptions();

  // Subtab điều hướng: 'medicines' (Kho thuốc & vật tư) vs 'suggestions' (Gợi ý từ bài báo)
  const [inventorySubTab, setInventorySubTab] = useState<'medicines' | 'suggestions'>('medicines');
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [loadingMedicines, setLoadingMedicines] = useState<boolean>(false);
  const [medSearch, setMedSearch] = useState<string>('');
  // Sửa sản phẩm dùng chung modal Tạo sản phẩm: editingMedId != null = đang sửa sản phẩm có id này
  const [editingMedId, setEditingMedId] = useState<number | null>(null);

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
  const [aiImageCandidates, setAiImageCandidates] = useState<string[]>([]);
  // TASK-18-R4: câu trích nguyên văn trong "Nguồn đã dùng" để kiểm tra với trang thật
  const [aiSourceQuotes, setAiSourceQuotes] = useState<SourceQuote[]>([]);
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
  }, []);

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

  // Mô tả sản phẩm được lưu gộp vào dosage_instruction dạng "Mô tả: <mô tả>\n<liều dùng>" (xem submit) → tách lại khi sửa
  const splitDescriptionFromDosage = (text: string): { description: string; dosage: string } => {
    const t = (text || '').replace(/\r\n/g, '\n');
    if (!t.startsWith('Mô tả:')) return { description: '', dosage: t.trim() };
    const body = t.slice('Mô tả:'.length).trim();
    const lastNl = body.lastIndexOf('\n');
    if (lastNl === -1) return { description: body, dosage: '' };
    return { description: body.slice(0, lastNl).trim(), dosage: body.slice(lastNl + 1).trim() };
  };

  const handleOpenEditMedModal = (med: MedicineItem) => {
    const { description, dosage } = splitDescriptionFromDosage(med.dosage_instruction);
    setShowDevMode(false);
    setDevGeminiInput('');
    setDescPreviewMode(false);
    setFromSuggestion(null);
    setEditingMedId(med.id);
    setNewMedName(med.name || '');
    setNewMedType(med.medicine_type || 'Hóa học');
    setNewMedActiveIngredient(med.active_ingredient || '');
    setNewMedPhi(med.phi_days ?? '');
    setNewMedAvailability(med.availability || 'IN_STOCK');
    setNewMedSourceUrl(med.info_source_url || '');
    setNewMedImageUrl(med.image_url || '');
    setMedImageFailed(false);
    setNewMedDescription(description);
    setNewMedTargetDiseases(med.target_diseases || []);
    setNewMedPrice(Number(med.price) || 0);
    setNewMedStock(Number(med.stock_quantity) || 0);
    setNewMedDosage(dosage);
    setNewMedIsAllowed(!!med.is_allowed);
    setResearchItems(suggestions.filter((sg) => sg.product_id === med.id && sg.evidence_text));
    setAiSourceLinks([]);
    setAiSourceQuotes([]);
    setAiNotes([]);
    setAiImageCandidates([]);
    setNewMedUsage(med.usage_profile ? normalizeUsageProfile(med.usage_profile) : emptyUsageProfile());
    setCreateMedModalOpen(true);
  };

  const filteredMedicines = medicines.filter((m) => {
    if (!medSearch.trim()) return true;
    const q = medSearch.toLowerCase();
    return m.name.toLowerCase().includes(q) || (m.active_ingredient && m.active_ingredient.toLowerCase().includes(q));
  });

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
      const med = medicines.find((m) => m.id === selectedLinkMedId);
      toast.success(`Đã gắn gợi ý "${linkingSuggestion.mention_text}" với sản phẩm "${med?.name || ''}"!`);
      const norm = linkingSuggestion.mention_text.trim().toLowerCase();
      setSuggestions((prev) =>
        prev.map((s) =>
          s.mention_text.trim().toLowerCase() === norm
            ? { ...s, status: 'LINKED', product_id: Number(selectedLinkMedId), product_name: med?.name, resolved_at: new Date().toISOString() }
            : s
        )
      );
      setLinkingSuggestion(null);
      setSelectedLinkMedId('');
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
        const norm = target.mention_text.trim().toLowerCase();
        setSuggestions((prev) =>
          prev.map((s) => (s.mention_text.trim().toLowerCase() === norm ? { ...s, status: 'DISMISSED', resolved_at: new Date().toISOString() } : s))
        );
      } else {
        await fetchSuggestions();
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // groupItems: các đoạn trích của nhóm gợi ý (cùng tên vật tư) làm ngữ cảnh prompt AI và nguồn bệnh hại điền sẵn
  const handleOpenCreateMedModal = (sug?: ProductSuggestionItem, groupItems?: ProductSuggestionItem[]) => {
    setEditingMedId(null);
    setResearchItems(groupItems && groupItems.length ? groupItems : sug ? [sug] : []);
    setAiSourceLinks([]);
    setAiSourceQuotes([]);
    setAiNotes([]);
    setAiImageCandidates([]);
    setNewMedUsage(emptyUsageProfile());
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
    });
    setShowDevMode(true);
    const n = countArticleBlocks(researchItems);
    copyText(
      prompt,
      `Đã sao chép prompt${n ? ` kèm ${n} bài trích` : ''}. Dán vào Gemini bản web, rồi dán cả câu trả lời (JSON + danh sách nguồn) vào ô bên dưới.`
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
    setAiSourceQuotes(parsed.sourceQuotes.filter((q) => isSafeHttpUrl(q.url)));
    if (validLinks.length && !newMedSourceUrl.trim()) setNewMedSourceUrl(validLinks[0]);

    // Một toast ngắn; chi tiết (lưu ý số liệu, loại vật tư...) hiện trong khung "Lưu ý từ Gemini" của form
    const identified = str(data.identified_as).toUpperCase();
    const note = str(data.identification_note);
    const aiNoteList: { title: string; text: string }[] = [];
    if (str(data.scope_note)) aiNoteList.push({ title: 'Số liệu', text: str(data.scope_note) });
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
    if (!isSupply && (newMedPhi === '' || Number.isNaN(Number(newMedPhi)))) {
      toast.error('Thuốc hóa học/sinh học bắt buộc nhập thời gian cách ly (PHI) theo nhãn thuốc hoặc nguồn tra cứu.');
      return;
    }
    if (!isSupply && (Number(newMedPhi) < 0 || Number(newMedPhi) > 365)) {
      toast.error('Thời gian cách ly (PHI) phải từ 0 đến 365 ngày.');
      return;
    }
    if (newMedSourceUrl.trim() && !/^https?:\/\//i.test(newMedSourceUrl.trim())) {
      toast.error('Link nguồn phải bắt đầu bằng http:// hoặc https://.');
      return;
    }

    try {
      setCreatingMed(true);
      const combinedDosage = [
        newMedDescription.trim() ? `Mô tả: ${newMedDescription.trim()}` : '',
        newMedDosage.trim() || (isSupply ? 'Sử dụng theo diện tích canh tác và hướng dẫn nhà sản xuất' : 'Pha theo hướng dẫn trên bao bì'),
      ]
        .filter(Boolean)
        .join('\n');

      if (editingMedId !== null) {
        const res = await apiClient.patch(`/medicines/${editingMedId}`, {
          name: newMedName.trim(),
          medicine_type: newMedType,
          active_ingredient: isSupply ? '' : newMedActiveIngredient.trim(),
          price: newMedAvailability === 'NOT_SOLD' ? 0 : (Number(newMedPrice) || 0),
          dosage_instruction: combinedDosage || (isSupply ? 'Sử dụng theo diện tích canh tác và hướng dẫn nhà sản xuất' : 'Pha theo hướng dẫn trên bao bì'),
          phi_days: isSupply ? null : Number(newMedPhi),
          stock_quantity: newMedAvailability === 'NOT_SOLD' ? 0 : (Number(newMedStock) || 0),
          availability: newMedAvailability,
          info_source_url: newMedSourceUrl.trim(),
          image_url: newMedImageUrl.trim(),
          target_diseases: newMedTargetDiseases,
          is_allowed: newMedIsAllowed,
          // phiếu rỗng gửi {} để server xóa phiếu (null = giữ nguyên)
          usage_profile: usageProfileForApi(newMedUsage) ?? {},
        });
        await fetchMedicines();
        toast.success(`Đã cập nhật sản phẩm "${res.data.name}".`);
        setCreateMedModalOpen(false);
        setEditingMedId(null);
        return;
      }

      const payload: any = {
        name: newMedName.trim(),
        medicine_type: newMedType,
        active_ingredient: isSupply ? null : newMedActiveIngredient.trim() || undefined,
        price: newMedAvailability === 'NOT_SOLD' ? 0 : (Number(newMedPrice) || 0),
        dosage_instruction: combinedDosage || (isSupply ? 'Sử dụng theo diện tích canh tác và hướng dẫn nhà sản xuất' : 'Pha theo hướng dẫn trên bao bì'),
        phi_days: isSupply ? null : Number(newMedPhi),
        stock_quantity: newMedAvailability === 'NOT_SOLD' ? 0 : (Number(newMedStock) || 0),
        availability: newMedAvailability,
        info_source_url: newMedSourceUrl.trim() || undefined,
        image_url: newMedImageUrl.trim() || undefined,
        target_diseases: newMedTargetDiseases,
        is_allowed: newMedIsAllowed,
        usage_profile: usageProfileForApi(newMedUsage),
        suggestion_id: fromSuggestion ? fromSuggestion.id : undefined,
      };

      const res = await apiClient.post('/medicines', payload);
      toast.success(`Đã thêm sản phẩm "${res.data.name}" vào danh mục thành công!`);
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
      const key = `${(s.mention_text || '').trim().toLowerCase()}__${s.kind}`;
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
          plantName: s.plant_name,
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
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              inventorySubTab === 'medicines'
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
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              inventorySubTab === 'suggestions'
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
                            <div className="font-bold text-foreground">
                              <span>{med.name}</span>
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
                              onClick={() => handleOpenEditMedModal(med)}
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
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                      suggestionsViewMode === 'grouped'
                        ? 'bg-primary text-white shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Gộp theo tên ({groupedSuggestions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuggestionsViewMode('all')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                      suggestionsViewMode === 'all'
                        ? 'bg-primary text-white shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Tất cả đoạn ({filteredSuggestions.length})
                  </button>
                </div>
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
                      <th className="p-3 w-[150px] min-w-[130px]">Vật tư / Hoạt chất</th>
                      <th className="p-3 w-[90px] whitespace-nowrap">Phân loại</th>
                      <th className="p-3 w-[150px] min-w-[130px] max-w-[170px]">Cây – Bệnh mục tiêu</th>
                      <th className="p-3 w-[240px] min-w-[190px] max-w-[260px]">Đoạn trích bằng chứng</th>
                      <th className="p-3 w-[90px] text-center whitespace-nowrap">Trạng thái</th>
                      <th className="p-3 w-[120px] text-center">Sản phẩm liên kết</th>
                      <th className="p-3 w-[160px] text-right whitespace-nowrap sticky right-0 bg-muted/95 backdrop-blur-xs z-10">Thao tác Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {loadingSuggestions ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          Đang tải danh sách gợi ý vật tư...
                        </td>
                      </tr>
                    ) : (suggestionsViewMode === 'grouped' ? groupedSuggestions.length === 0 : filteredSuggestions.length === 0) ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          Không tìm thấy gợi ý vật tư nào.
                        </td>
                      </tr>
                    ) : suggestionsViewMode === 'grouped' ? (
                      groupedSuggestions.map((group) => {
                        const isBanned = isIngredientBanned(group.mentionText);
                        const primary = group.primaryItem;
                        // Thao tác (Tạo / Gắn / Bỏ qua) phải dùng gợi ý còn PENDING: gợi ý đầu nhóm có thể đã ADDED (TASK-17-R2)
                        const actionItem = group.items.find((it) => it.status === 'PENDING') || primary;
                        const cleanPreview = excerptAroundMention(primary.evidence_text || '', group.mentionText, 170);

                        return (
                          <tr key={group.groupKey} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-medium w-[150px] min-w-[130px] align-top">
                              <div className="font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                                <span>{group.mentionText}</span>
                                {isBanned && (
                                  <Badge variant="destructive" className="text-[9px] h-4 px-1">
                                    Cấm (TT 75)
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">
                                  Xuất hiện ở {group.count} đoạn trích
                                </Badge>
                              </div>
                            </td>

                            <td className="p-3 w-[90px] whitespace-nowrap align-top">
                              <Badge
                                variant="outline"
                                className={
                                  group.kind === 'CHEMICAL'
                                    ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300'
                                    : group.kind === 'BIOLOGICAL'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300'
                                      : group.kind === 'SUPPLY'
                                        ? 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300'
                                        : 'bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/30 dark:text-purple-300'
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
                            </td>

                            <td className="p-3 w-[150px] min-w-[130px] max-w-[170px] align-top">
                              <div className="space-y-0.5">
                                <div className="font-bold text-foreground text-xs flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                                  <span className="truncate">{group.plantName}</span>
                                </div>
                                <div className="text-[11px] text-muted-foreground leading-snug line-clamp-2" title={group.diseaseName}>
                                  {group.diseaseName}
                                </div>
                              </div>
                            </td>

                            <td className="p-3 w-[240px] min-w-[190px] max-w-[260px] align-top">
                              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                "<HighlightedText text={cleanPreview} mention={group.mentionText} />"
                              </p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                                  title="Nhấn để xem toàn bộ 2-4 đoạn trích và thông tin bài báo"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Xem chi tiết đoạn trích ({group.count})</span>
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

                            <td className="p-3 w-[90px] text-center whitespace-nowrap align-top">
                              {group.status === 'PENDING' ? (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px]">
                                  Chờ xử lý ({group.count})
                                </Badge>
                              ) : group.status === 'LINKED' ? (
                                <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px]">
                                  Đã gắn SP
                                </Badge>
                              ) : group.status === 'ADDED' ? (
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                                  Đã tạo SP
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">
                                  Đã bỏ qua
                                </Badge>
                              )}
                            </td>

                            <td className="p-3 w-[120px] text-center align-top">
                              {group.productName && group.status === 'PENDING' ? (
                                <span className="text-amber-700 dark:text-amber-400 text-[11px]" title="Cùng hoạt chất với sản phẩm trong kho. Bấm Gắn SP để xác nhận.">
                                  Khớp hoạt chất: <b>{group.productName}</b>
                                </span>
                              ) : group.productName ? (
                                <span className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center justify-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="truncate">{group.productName}</span>
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic text-[11px]">—</span>
                              )}
                            </td>

                            <td className="p-3 w-[160px] text-right whitespace-nowrap align-top sticky right-0 bg-background/95 backdrop-blur-xs shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.06)] z-10">
                              {group.status === 'PENDING' ? (
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  <Button
                                    size="sm"
                                    onClick={() => openEvidenceModal(group.items)}
                                    className="h-7 px-2 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold gap-1"
                                    title={group.kind === 'PRACTICE' ? 'Tạo vật tư phục vụ biện pháp canh tác này' : 'Tạo sản phẩm mới prefilled từ gợi ý'}
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>{group.kind === 'PRACTICE' ? 'Tạo vật tư' : 'Tạo SP'}</span>
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setLinkingSuggestion(actionItem);
                                      setSelectedLinkMedId(actionItem.product_id ?? group.productId ?? '');
                                    }}
                                    className="h-7 px-2 border-border text-[11px] font-medium"
                                    title="Liên kết với sản phẩm đã có sẵn trong kho"
                                  >
                                    <LinkIcon className="w-3 h-3 mr-1" />
                                    <span>Gắn SP</span>
                                  </Button>

                                  {group.kind === 'PRACTICE' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDismissSuggestion(actionItem.id, true)}
                                      className="h-7 px-2 border-purple-200 text-purple-700 dark:text-purple-300 hover:bg-purple-50 text-[11px]"
                                      title="Đã lưu biện pháp vào sổ tay kỹ thuật nông vụ"
                                    >
                                      <Check className="w-3 h-3 mr-1" />
                                      <span>Ghi nhận</span>
                                    </Button>
                                  )}

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDismissSuggestion(actionItem.id)}
                                    className="h-7 px-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-[11px]"
                                    title={`Bỏ qua cả ${group.count} gợi ý này`}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">Đã xử lý ({group.count})</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      filteredSuggestions.map((sug) => {
                        const isBanned = isIngredientBanned(sug.mention_text);
                        const cleanPreview = excerptAroundMention(sug.evidence_text || '', sug.mention_text, 170);

                        return (
                          <tr key={sug.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-medium w-[150px] min-w-[130px] align-top">
                              <div className="font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                                <span>{sug.mention_text}</span>
                                {isBanned && (
                                  <Badge variant="destructive" className="text-[9px] h-4 px-1">
                                    Cấm (TT 75)
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                Mã #{sug.id} • {new Date(sug.created_at).toLocaleDateString('vi-VN')}
                              </div>
                            </td>

                            <td className="p-3 w-[90px] whitespace-nowrap align-top">
                              <Badge
                                variant="outline"
                                className={
                                  sug.kind === 'CHEMICAL'
                                    ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300'
                                    : sug.kind === 'BIOLOGICAL'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300'
                                      : sug.kind === 'SUPPLY'
                                        ? 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300'
                                        : 'bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/30 dark:text-purple-300'
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

                            <td className="p-3 w-[150px] min-w-[130px] max-w-[170px] align-top">
                              <div className="space-y-0.5">
                                <div className="font-bold text-foreground text-xs flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                                  <span className="truncate">{sug.plant_name}</span>
                                </div>
                                <div className="text-[11px] text-muted-foreground leading-snug line-clamp-2" title={sug.disease_name}>
                                  {sug.disease_name}
                                </div>
                              </div>
                            </td>

                            <td className="p-3 w-[240px] min-w-[190px] max-w-[260px] align-top">
                              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                "<HighlightedText text={cleanPreview} mention={sug.mention_text} />"
                              </p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
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

                            <td className="p-3 w-[90px] text-center whitespace-nowrap align-top">
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

                            <td className="p-3 w-[120px] text-center align-top">
                              {sug.product_name && sug.status === 'PENDING' ? (
                                <span className="text-amber-700 dark:text-amber-400 text-[11px]" title="Cùng hoạt chất với sản phẩm trong kho. Bấm Gắn SP để xác nhận.">
                                  Khớp hoạt chất: <b>{sug.product_name}</b>
                                </span>
                              ) : sug.product_name ? (
                                <span className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center justify-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="truncate">{sug.product_name}</span>
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic text-[11px]">—</span>
                              )}
                            </td>

                            <td className="p-3 w-[160px] text-right whitespace-nowrap align-top sticky right-0 bg-background/95 backdrop-blur-xs shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.06)] z-10">
                              {sug.status === 'PENDING' ? (
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  <Button
                                    size="sm"
                                    onClick={() => openEvidenceModal([sug])}
                                    className="h-7 px-2 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold gap-1"
                                    title={sug.kind === 'PRACTICE' ? 'Tạo vật tư phục vụ biện pháp canh tác này' : 'Tạo sản phẩm mới prefilled từ gợi ý'}
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>{sug.kind === 'PRACTICE' ? 'Tạo vật tư' : 'Tạo SP'}</span>
                                  </Button>

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

                                  {sug.kind === 'PRACTICE' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDismissSuggestion(sug.id, true)}
                                      className="h-7 px-2 border-purple-200 text-purple-700 dark:text-purple-300 hover:bg-purple-50 text-[11px]"
                                      title="Đã lưu biện pháp vào sổ tay kỹ thuật nông vụ"
                                    >
                                      <Check className="w-3 h-3 mr-1" />
                                      <span>Ghi nhận</span>
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
      </div>

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
      {/* DIALOG XEM TOÀN VĂN ĐOẠN TRÍCH BẰNG CHỨNG (MULTI-TABS & THAO TÁC TRÊN ĐẦU) */}
      {/* ========================================================================================= */}
      <Dialog open={!!viewingEvidenceGroup} onOpenChange={() => setViewingEvidenceGroup(null)}>
        <DialogContent className="sm:max-w-2xl lg:max-w-3xl w-[92vw] max-h-[88vh] overflow-y-auto p-5 sm:p-6">
          <DialogHeader className="pb-2 border-b border-border">
            <div className="flex items-center justify-between gap-2 pr-8">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-700" />
                <span>Đoạn trích bằng chứng: "{viewingEvidenceGroup?.mentionText}"</span>
              </DialogTitle>
              <Badge variant="outline" className="text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300">
                {shownEvidenceCount || 1} đoạn trích · {evidenceTabs.length} bài
              </Badge>
            </div>
            <DialogDescription className="text-xs mt-1">
              Chi tiết ngữ cảnh đoạn văn trong bài báo được AI trích xuất để làm căn cứ gợi ý vật tư và phòng trừ bệnh hại.
            </DialogDescription>
          </DialogHeader>

          {viewingEvidenceGroup && (
            <div className="space-y-3 py-2 text-xs">
              {/* 1. TẠO SẢN PHẨM / GẮN SP CHO CẢ NHÓM (TASK-17-R2: chỉ còn 1 luồng, prompt AI nằm trong form) */}
              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  <div className="font-bold text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Thao tác cho gợi ý: <strong>{viewingEvidenceGroup.mentionText}</strong></span>
                  </div>
                  <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                    Tạo SP dùng {evidenceTabs.length - excludedEvidenceTabs.length}/{evidenceTabs.length} bài làm ngữ cảnh và bệnh hại điền sẵn
                    {excludedEvidenceTabs.length > 0 ? ' (bài đã bỏ không được dùng)' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    disabled={usableEvidenceItems.length === 0}
                    onClick={() => {
                      const groupItems = usableEvidenceItems;
                      const itm = groupItems.find((it) => it.status === 'PENDING') || groupItems[0];
                      setViewingEvidenceGroup(null);
                      handleOpenCreateMedModal(itm, groupItems);
                    }}
                    className="h-7 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1 shadow-2xs"
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
                    className="h-7 px-2.5 text-xs font-semibold bg-background border-emerald-300 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/50"
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

              {/* 2. TABS: MỖI TAB = 1 BÀI + 1 BỆNH (các đoạn cùng bài, cùng bệnh gộp chung) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-1">
                  <span className="text-xs font-semibold text-foreground">
                    {shownEvidenceCount} đoạn trích trong {evidenceTabs.length} bài:
                  </span>
                  {evidenceTabs.length > 1 && (
                    <span className="text-[10px] text-muted-foreground">Bấm từng tab để đọc; bài không liên quan thì bỏ tick</span>
                  )}
                </div>

                {evidenceTabs.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {evidenceTabs.map((tab, idx) => {
                      const first = tab.items[0];
                      const excluded = excludedEvidenceTabs.includes(tab.key);
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setActiveEvidenceTabIdx(idx)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                            activeEvidenceTabIdx === idx
                              ? 'bg-emerald-700 text-white shadow-xs'
                              : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                          } ${excluded ? 'opacity-50 line-through' : ''}`}
                        >
                          <span>Bài #{idx + 1}</span>
                          <span className="text-[10px] opacity-80 max-w-[150px] truncate">
                            ({first.plant_name} - {first.disease_name}{tab.items.length > 1 ? `, ${tab.items.length} đoạn` : ''})
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
                            <div className="text-xs leading-relaxed text-foreground whitespace-pre-line p-3 bg-background rounded-lg border border-border">
                              <HighlightedText
                                text={excerptAroundMention(item.evidence_text || '', viewingEvidenceGroup.mentionText, 100000)}
                                mention={viewingEvidenceGroup.mentionText}
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
          if (!open) setEditingMedId(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl lg:max-w-4xl w-[94vw] max-w-4xl max-h-[92vh] overflow-y-auto p-5 sm:p-6">
          <DialogHeader className="shrink-0 pb-2 border-b border-border">
            <div className="flex items-center justify-between gap-2 pr-8">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                {editingMedId !== null ? (
                  <Pencil className="w-4 h-4 text-emerald-700" />
                ) : (
                  <Plus className="w-4 h-4 text-emerald-700" />
                )}
                <span>
                  {editingMedId !== null
                    ? `Chỉnh sửa sản phẩm: ${newMedName || ''}`
                    : fromSuggestion
                      ? `Thêm sản phẩm từ gợi ý: "${fromSuggestion.mention_text}"`
                      : 'Thêm thuốc / Vật tư mới'}
                </span>
              </DialogTitle>

              {/* NÚT CHẾ ĐỘ DEV </> TINH GỌN */}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowDevMode((v) => !v)}
                className={`h-7 w-7 p-0 font-mono font-bold transition-colors flex items-center justify-center shrink-0 ${
                  showDevMode
                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-400 shadow-xs'
                    : 'bg-background hover:bg-blue-50 text-blue-700 dark:text-blue-400 border-border'
                }`}
                title="Chế độ Dev: Prompt Gemini & Nạp JSON"
              >
                <Code2 className="w-4 h-4" />
              </Button>
            </div>

            <DialogDescription className="text-xs mt-1">
              {editingMedId !== null
                ? 'Cập nhật đầy đủ thông tin sản phẩm: link nguồn, ảnh, mô tả, bệnh hại, giá, tồn kho, PHI và trạng thái lưu hành.'
                : fromSuggestion
                ? 'Tên và thông tin trích xuất từ bài báo. Có thể cập nhật ảnh, mô tả hoặc tra cứu nhanh để điền thông số.'
                : 'Thêm sản phẩm thuốc bảo vệ thực vật hoặc vật tư canh tác vào danh mục.'}
            </DialogDescription>
          </DialogHeader>

          {/* NẾU MỞ CHẾ ĐỘ DEV: HIỂN THỊ KHUNG SAO CHÉP PROMPT VÀ DÁN JSON TỪ GEMINI */}
          {showDevMode && (
            <div className="p-3 my-2 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Chế độ Dev: Gemini bản web tổng hợp thông tin (prompt &amp; nạp JSON)</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopyGeminiPrompt}
                  className="h-7 px-2 text-[11px] bg-background font-semibold text-blue-700 dark:text-blue-300 border-blue-300 hover:bg-blue-100/50 gap-1"
                  title="Sao chép prompt (kèm đoạn trích bài báo) để dán vào Gemini bản web"
                >
                  <Copy className="w-3 h-3" />
                  <span>📋 Sao chép prompt cho Gemini{(() => { const n = countArticleBlocks(researchItems); return n ? ` (${n} bài trích)` : ''; })()}</span>
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                1. Bấm <strong>Sao chép prompt cho Gemini</strong>: prompt kèm đoạn trích bài báo (gộp theo bài), tên, link (nếu có), danh sách mã bệnh; yêu cầu Gemini tổng hợp nguồn tại Việt Nam, mô tả chi tiết và phiếu cách dùng (liều, buổi, số lần, cách nhau, tối đa lần/vụ, cách ly).<br />
                2. Copy <strong>cả câu trả lời</strong> (khối JSON + danh sách nguồn / ảnh), dán vào ô bên dưới → bấm <strong>Điền form từ Gemini</strong>. Bệnh hại được <em>gộp thêm</em>; link và ảnh hiện để bạn chọn. Chế độ Dev để tìm nhanh, vẫn phải đối chiếu nguồn trước khi lưu.
              </p>
              <div className="space-y-1.5">
                <Textarea
                  value={devGeminiInput}
                  onChange={(e) => setDevGeminiInput(e.target.value)}
                  placeholder="Dán cả câu trả lời của Gemini vào đây (khối ```json ... ``` và danh sách nguồn bên dưới)"
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
                    <span>⚡ Điền form từ Gemini</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <form onSubmit={handleCreateMedicineSubmit} className="space-y-3 text-xs">
              {isIngredientBanned(newMedActiveIngredient || newMedName) && (
                <div className="p-2.5 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <strong>Cảnh báo chất cấm (TT 75/2025):</strong> Tên hoặc hoạt chất "{newMedActiveIngredient || newMedName}" nằm trong danh mục cấm sử dụng tại Việt Nam. Không thể bật lưu hành sản phẩm này.
                  </div>
                </div>
              )}

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
                  <div className="p-2 rounded-lg border border-amber-300/70 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 text-[11px] space-y-1">
                    <div className="font-semibold text-amber-800 dark:text-amber-300">Lưu ý từ Gemini</div>
                    {aiNotes.map((n, i) => (
                      <div key={i} className="text-amber-900 dark:text-amber-200">
                        <span className="font-semibold">{n.title}:</span> {n.text}
                      </div>
                    ))}
                  </div>
                )}
                {(aiSourceLinks.length > 0 || aiSourceQuotes.length > 0) && (
                  <QuoteCheckPanel links={aiSourceLinks} quotes={aiSourceQuotes} />
                )}
                <p className="text-[10px] text-muted-foreground">
                  Không bắt buộc. Chưa có link thì dùng các gợi ý Tra Google, hoặc mở chế độ Dev (nút <code>&lt;/&gt;</code>) để Gemini tổng hợp và đề xuất link.
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
                  className="text-xs"
                />
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
                      Ảnh Gemini đề xuất (bấm để dùng; ảnh không tải được sẽ tự ẩn):
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
                          className={`relative w-16 h-16 rounded-md border overflow-hidden bg-background ${
                            newMedImageUrl === u ? 'border-emerald-600 ring-2 ring-emerald-500/40' : 'border-border hover:border-violet-400'
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
                        className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                          !descPreviewMode
                            ? 'bg-background text-foreground shadow-2xs font-semibold'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        ✏️ Soạn thảo
                      </button>
                      <button
                        type="button"
                        onClick={() => setDescPreviewMode(true)}
                        className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                          descPreviewMode
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
                  <div className="p-3 bg-secondary/30 rounded-lg border border-border text-xs leading-relaxed min-h-[110px] space-y-1.5">
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
                      className="text-xs"
                    />
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

              {/* PHIẾU CÁCH DÙNG (TASK-18) */}
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
                <label className="font-semibold block mb-1">Hướng dẫn sử dụng / Liều lượng</label>
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
                  Trợ lý Lavi đọc nguyên văn ô này; con số liều lượng phải có ở đây thì Lavi mới được nói.
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
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
                <Button type="button" variant="outline" size="sm" onClick={() => { setCreateMedModalOpen(false); setEditingMedId(null); }} disabled={creatingMed}>
                  Hủy
                </Button>
                <Button type="submit" size="sm" disabled={creatingMed} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold">
                  {editingMedId !== null
                    ? (creatingMed ? 'Đang lưu...' : 'Lưu thay đổi')
                    : (creatingMed ? 'Đang tạo sản phẩm...' : 'Tạo sản phẩm')}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInventoryPage;
