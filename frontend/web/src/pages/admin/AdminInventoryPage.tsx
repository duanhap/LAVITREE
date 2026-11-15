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
import { isSafeHttpUrl, isIngredientBanned, cleanEvidencePreview } from '@/features/admin/lib';
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
  const [newMedImageUrl, setNewMedImageUrl] = useState<string>('');
  const [newMedDescription, setNewMedDescription] = useState<string>('');
  const [newMedTargetDisease, setNewMedTargetDisease] = useState<string>('Tomato___Late_blight');
  const [newMedIsAllowed, setNewMedIsAllowed] = useState<boolean>(false);
  const [creatingMed, setCreatingMed] = useState<boolean>(false);
  const [showDevMode, setShowDevMode] = useState<boolean>(false);
  const [devGeminiInput, setDevGeminiInput] = useState<string>('');
  const [medImageFailed, setMedImageFailed] = useState<boolean>(false);

  // Chế độ hiển thị Gợi ý vật tư: 'grouped' (Gộp theo tên vật tư chống trùng lặp) vs 'all' (Từng dòng)
  const [suggestionsViewMode, setSuggestionsViewMode] = useState<'grouped' | 'all'>('grouped');
  const [viewingEvidenceGroup, setViewingEvidenceGroup] = useState<EvidenceModalGroup | null>(null);
  const [activeEvidenceTabIdx, setActiveEvidenceTabIdx] = useState<number>(0);
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

  const handleSaveMedicineEdit = async () => {
    if (!editingMed) return;

    if (!editingMed.name.trim()) {
      toast.error('Vui lòng nhập tên sản phẩm.');
      return;
    }

    const isSupply = editingMed.medicine_type === 'Vật tư canh tác';
    if (isIngredientBanned(editingMed.name) || (!isSupply && isIngredientBanned(editingMed.active_ingredient))) {
      toast.error('Tên hoặc hoạt chất thuộc danh mục thuốc BVTV cấm sử dụng tại Việt Nam.');
      return;
    }

    if (!isSupply && (editingMed.phi_days === null || editingMed.phi_days === undefined)) {
      toast.error('Thuốc hóa học/sinh học bắt buộc có thời gian cách ly (PHI).');
      return;
    }

    try {
      setMedSaving(true);
      const res = await apiClient.patch(`/medicines/${editingMed.id}`, {
        name: editingMed.name.trim(),
        active_ingredient: isSupply ? null : (editingMed.active_ingredient?.trim() || null),
        dosage_instruction: editingMed.dosage_instruction?.trim() || (isSupply ? 'Sử dụng theo hướng dẫn kỹ thuật' : 'Pha theo hướng dẫn trên bao bì'),
        phi_days: isSupply ? null : editingMed.phi_days,
        price: editingMed.availability === 'NOT_SOLD' ? 0 : (Number(editingMed.price) || 0),
        stock_quantity: editingMed.availability === 'NOT_SOLD' ? 0 : (Number(editingMed.stock_quantity) || 0),
        is_allowed: editingMed.is_allowed,
        availability: editingMed.availability,
        info_source_url: editingMed.info_source_url,
        medicine_type: editingMed.medicine_type,
      });

      setMedicines((prev) =>
        prev.map((m) => (m.id === editingMed.id ? { ...m, ...res.data } : m))
      );

      setEditingMed(null);
      toast.success(`Đã cập nhật thông tin sản phẩm '${res.data.name}'.`);
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

  const handleOpenCreateMedModal = (sug?: ProductSuggestionItem) => {
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
      setNewMedPhi(mappedType === 'Hóa học' ? 7 : 0);
      setNewMedAvailability('NOT_SOLD');
      setNewMedSourceUrl('');
      setNewMedImageUrl('');
      setMedImageFailed(false);
      setNewMedDescription('');
      setNewMedTargetDisease(isSupplyOrPractice ? '' : (sug.model_class || ''));
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
      setNewMedPhi(7);
      setNewMedAvailability('IN_STOCK');
      setNewMedSourceUrl('');
      setNewMedImageUrl('');
      setMedImageFailed(false);
      setNewMedDescription('');
      setNewMedTargetDisease('');
      setNewMedPrice(50000);
      setNewMedStock(50);
      setNewMedDosage('Pha theo hướng dẫn trên bao bì');
      setNewMedIsAllowed(false);
    }
    setCreateMedModalOpen(true);
  };

  const handleCopyGeminiPrompt = () => {
    const url = newMedSourceUrl.trim();
    if (!url) {
      toast.error('Vui lòng dán Link trang sản phẩm / nhãn thuốc (URL) trước khi sao chép prompt!');
      return;
    }

    const prompt = `Bạn là chuyên gia phân loại vật tư nông nghiệp & thuốc bảo vệ thực vật của dự án LAVITREE.
Hãy đọc thông tin về sản phẩm/vật tư từ liên kết sau:
URL: ${url}
${newMedName ? `Tên gợi ý ban đầu: ${newMedName}` : ''}

Hãy trích xuất và phân tích thật đầy đủ, chuyên sâu và trả về ĐÚNG cấu trúc JSON sau (chỉ trả về duy nhất khối markdown json, không kèm văn bản dẫn dắt ngoài):
\`\`\`json
{
  "name": "Tên sản phẩm chuẩn, ngắn gọn (ví dụ: Vôi bột nông nghiệp, Ridomil Gold 68WG; loại bỏ các câu hỏi blog 'là gì', 'tác dụng')",
  "medicine_type": "Vật tư canh tác" | "Sinh học" | "Hóa học",
  "active_ingredient": "Hoạt chất chính hoặc công thức hóa học (VD: CaO (Canxi oxit), Mancozeb... Nếu là dụng cụ vật tư thông thường thì để rỗng '')",
  "description": "Mô tả chuẩn hóa nông nghiệp, bố cục 4 phần mạch lạc rõ đẹp (khoảng 150 - 300 từ):\\n• Bản chất & Phân loại: (Sản phẩm là gì, nguồn gốc, công thức hoặc dạng tồn tại...)\\n• Công dụng nông nghiệp: (Hạ phèn, nâng pH đất, khử trùng tiêu diệt mầm bệnh nấm khuẩn trong đất, kích rễ, giải độc hữu cơ...)\\n• Phạm vi & Cây trồng: (Dùng cho đất trồng rau màu, cây ăn quả, xử lý hố trồng, chuồng trại...)\\n• Hướng dẫn & Lưu ý khi dùng: (Bón lúc làm đất/đầu vụ, tuyệt đối không trộn chung với phân đạm để tránh thất thoát đạm, mang găng tay và đồ bảo hộ)",
  "image_url": "URL ảnh chụp sản phẩm thực tế từ bài viết (link https://..., nếu không có link ảnh trực tiếp thì để rỗng '')",
  "dosage_instruction": "Liều lượng sử dụng và cách bón/pha thực tế (ví dụ: Bón 20 - 50kg/sào tùy độ chua của đất)",
  "phi_days": 0,
  "price": 0,
  "target_disease_code": "NONE"
}
\`\`\`
Lưu ý quan trọng:
- Trường description: BẮT BUỘC dùng dấu chấm đầu dòng • rõ ràng cho từng mục, mỗi mục xuống dòng cách biệt, tuyệt đối không viết thành một đoạn văn xuôi dài dính chùm.
- Với trường target_disease_code: Nếu là vật tư cải tạo đất chung (như vôi bột, phân bón, bạt phủ, bẫy dính...) hoặc phòng trừ diện rộng, BẮT BUỘC để là "NONE" (Không chỉ định). Chỉ điền mã bệnh khi là thuốc đặc trị riêng cho 1 bệnh cụ thể.
- Trường phi_days: Nếu là Vật tư canh tác hoặc Chế phẩm sinh học thì để 0 ngày.`;

    navigator.clipboard.writeText(prompt);
    toast.success('Đã sao chép Prompt cho Gemini! Hãy dán vào Gemini Web rồi copy kết quả JSON dán vào ô bên dưới.');
  };

  const handleApplyGeminiJson = () => {
    if (!devGeminiInput.trim()) {
      toast.error('Vui lòng dán đoạn JSON từ Gemini vào ô trước khi bấm áp dụng!');
      return;
    }
    try {
      let cleanJson = devGeminiInput.trim();
      const match = cleanJson.match(/\{[\s\S]*\}/);
      if (match) {
        cleanJson = match[0];
      }
      const data = JSON.parse(cleanJson);
      if (data.name) setNewMedName(String(data.name).trim());
      if (data.medicine_type) {
        const t = String(data.medicine_type).trim();
        if (t === 'Sinh học' || t === 'Vật tư canh tác' || t === 'Hóa học') {
          setNewMedType(t);
        }
      }
      if (data.active_ingredient !== undefined) {
        setNewMedActiveIngredient(String(data.active_ingredient || '').trim());
      }
      if (data.description) setNewMedDescription(String(data.description).trim());
      if (data.image_url) {
        let rawImg = String(data.image_url).trim();
        const urlMatch = rawImg.match(/https?:\/\/[^\s"')]+/);
        if (urlMatch) {
          rawImg = urlMatch[0];
        }
        if (isSafeHttpUrl(rawImg) || /^https?:\/\//i.test(rawImg)) {
          setNewMedImageUrl(rawImg);
          setMedImageFailed(false);
        }
      }
      if (data.dosage_instruction) setNewMedDosage(String(data.dosage_instruction).trim());
      if (data.phi_days !== undefined) {
        const p = parseInt(String(data.phi_days), 10);
        setNewMedPhi(isNaN(p) ? '' : p);
      }
      if (data.price !== undefined) {
        const pr = parseFloat(String(data.price));
        if (!isNaN(pr) && pr >= 0) {
          setNewMedPrice(pr);
          if (pr > 0) {
            setNewMedAvailability('IN_STOCK');
            setNewMedStock(100);
          }
        }
      }
      if (data.target_disease_code !== undefined) {
        const rawCode = String(data.target_disease_code || '').trim();
        if (!rawCode || rawCode.toUpperCase() === 'NONE' || rawCode.toLowerCase().includes('không chỉ định')) {
          setNewMedTargetDisease('');
        } else {
          const matched = diseases.find((d) => d.classCode.toLowerCase() === rawCode.toLowerCase());
          setNewMedTargetDisease(matched ? matched.classCode : '');
        }
      }
      toast.success('Đã áp dụng toàn bộ thông số từ Gemini thành công!');
      setDevGeminiInput('');
    } catch {
      toast.error('Không thể đọc dữ liệu JSON. Vui lòng kiểm tra lại cấu trúc JSON được dán.');
    }
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
    if (newMedType === 'Hóa học' && newMedPhi === '') {
      toast.error('Thuốc hóa học bắt buộc nhập thời gian cách ly (PHI) theo nhãn (hoặc mặc định 7 ngày).');
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

      const payload: any = {
        name: newMedName.trim(),
        medicine_type: newMedType,
        active_ingredient: isSupply ? null : newMedActiveIngredient.trim() || undefined,
        price: newMedAvailability === 'NOT_SOLD' ? 0 : (Number(newMedPrice) || 0),
        dosage_instruction: combinedDosage || (isSupply ? 'Sử dụng theo diện tích canh tác và hướng dẫn nhà sản xuất' : 'Pha theo hướng dẫn trên bao bì'),
        phi_days: isSupply ? null : (newMedPhi === '' ? (newMedType === 'Hóa học' ? 7 : 0) : Number(newMedPhi)),
        stock_quantity: newMedAvailability === 'NOT_SOLD' ? 0 : (Number(newMedStock) || 0),
        availability: newMedAvailability,
        info_source_url: newMedSourceUrl.trim() || undefined,
        image_url: newMedImageUrl.trim() || undefined,
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
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300'
                                  : med.medicine_type === 'Vật tư canh tác'
                                    ? 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300'
                                    : 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300'
                              }
                            >
                              {med.medicine_type}
                            </Badge>
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
                        const cleanPreview = cleanEvidencePreview(primary.evidence_text);

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
                                "{cleanPreview}"
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
                                    onClick={() => handleOpenCreateMedModal(primary)}
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
                                      setLinkingSuggestion(primary);
                                      setSelectedLinkMedId(primary.product_id ?? '');
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
                                      onClick={() => handleDismissSuggestion(primary.id, true)}
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
                                    onClick={() => handleDismissSuggestion(primary.id)}
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
                        const cleanPreview = cleanEvidencePreview(sug.evidence_text);

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
                                "{cleanPreview}"
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
                                    onClick={() => handleOpenCreateMedModal(sug)}
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
      {/* DIALOG SỬA THÔNG SỐ THUỐC BVTV & VẬT TƯ */}
      {/* ========================================================================================= */}
      <Dialog open={!!editingMed} onOpenChange={() => setEditingMed(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Chỉnh sửa sản phẩm: {editingMed?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cập nhật thông tin chi tiết, giá bán, số ngày cách ly (PHI), tình trạng bán và hướng dẫn sử dụng.
            </DialogDescription>
          </DialogHeader>

          {editingMed && (
            <div className="space-y-3 py-2 text-xs">
              {isIngredientBanned(editingMed.active_ingredient || editingMed.name) && (
                <div className="p-2.5 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <strong>Cảnh báo chất cấm (TT 75/2025):</strong> Tên hoặc hoạt chất của sản phẩm nằm trong danh mục cấm sử dụng tại Việt Nam. Không thể kích hoạt trạng thái lưu hành.
                  </div>
                </div>
              )}

              <div>
                <label className="font-semibold block mb-1">Tên thuốc / Tên sản phẩm *</label>
                <Input
                  type="text"
                  value={editingMed.name}
                  onChange={(e) => setEditingMed({ ...editingMed, name: e.target.value })}
                  className="text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Phân loại sản phẩm *</label>
                  <select
                    value={editingMed.medicine_type || 'Hóa học'}
                    onChange={(e) => {
                      const t = e.target.value;
                      setEditingMed({
                        ...editingMed,
                        medicine_type: t,
                        phi_days: t === 'Vật tư canh tác' ? null : editingMed.phi_days,
                        active_ingredient: t === 'Vật tư canh tác' ? '' : editingMed.active_ingredient,
                        dosage_instruction:
                          t === 'Vật tư canh tác' && editingMed.dosage_instruction === 'Pha theo hướng dẫn trên bao bì'
                            ? 'Sử dụng theo diện tích canh tác và hướng dẫn nhà sản xuất'
                            : editingMed.dosage_instruction,
                      });
                    }}
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs"
                  >
                    <option value="Hóa học">Thuốc BVTV hóa học</option>
                    <option value="Sinh học">Chế phẩm sinh học BVTV</option>
                    <option value="Vật tư canh tác">Vật tư canh tác (lưới, bẫy, bạt phủ...)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Tình trạng kinh doanh *</label>
                  <select
                    value={editingMed.availability || 'IN_STOCK'}
                    onChange={(e) =>
                      setEditingMed({ ...editingMed, availability: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs"
                  >
                    <option value="IN_STOCK">Đang bán (cho phép đặt mua)</option>
                    <option value="OUT_OF_STOCK">Tạm hết hàng (tạm ẩn nút mua)</option>
                    <option value="NOT_SOLD">Cửa hàng không bán (chỉ tư vấn kỹ thuật)</option>
                  </select>
                </div>
              </div>

              {editingMed.medicine_type !== 'Vật tư canh tác' ? (
                <div>
                  <label className="font-semibold block mb-1">Hoạt chất chính (Active Ingredient)</label>
                  <Input
                    type="text"
                    value={editingMed.active_ingredient || ''}
                    onChange={(e) =>
                      setEditingMed({ ...editingMed, active_ingredient: e.target.value })
                    }
                    placeholder="Ví dụ: Metalaxyl-M, Mancozeb..."
                    className="text-xs"
                  />
                </div>
              ) : (
                <div>
                  <label className="font-semibold block mb-1 text-muted-foreground">Hoạt chất chính</label>
                  <div className="h-8 px-2.5 py-1.5 bg-muted/40 border border-border rounded text-xs text-muted-foreground flex items-center">
                    Không áp dụng cho vật tư canh tác
                  </div>
                </div>
              )}

              {editingMed.availability !== 'NOT_SOLD' ? (
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
              ) : (
                <div className="p-2.5 bg-muted/40 border border-border rounded-lg text-muted-foreground text-xs">
                  Sản phẩm ở chế độ "Cửa hàng không bán": Giá bán và Tồn kho được mặc định là 0. Sản phẩm chỉ hiển thị để tư vấn kỹ thuật nông vụ.
                </div>
              )}

              <div>
                <label className="font-semibold block mb-1">
                  Thời gian cách ly PHI (ngày)
                  {editingMed.medicine_type === 'Vật tư canh tác' ? (
                    <span className="font-normal text-muted-foreground ml-1">(Không áp dụng cho vật tư canh tác)</span>
                  ) : (
                    <span className="text-destructive ml-0.5">*</span>
                  )}
                </label>
                <Input
                  type="number"
                  disabled={editingMed.medicine_type === 'Vật tư canh tác'}
                  placeholder={editingMed.medicine_type === 'Vật tư canh tác' ? 'Không áp dụng' : 'Ví dụ: 7'}
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
                <label className="font-semibold block mb-1">Hướng dẫn sử dụng / Liều lượng</label>
                <Input
                  type="text"
                  value={editingMed.dosage_instruction || ''}
                  onChange={(e) =>
                    setEditingMed({ ...editingMed, dosage_instruction: e.target.value })
                  }
                  placeholder={
                    editingMed.medicine_type === 'Vật tư canh tác'
                      ? 'Sử dụng theo diện tích canh tác và hướng dẫn nhà sản xuất'
                      : 'Pha theo hướng dẫn trên bao bì'
                  }
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  URL nguồn tra cứu PHI/liều (nhãn, trang nhà sản xuất)
                  {editingMed.medicine_type === 'Vật tư canh tác' ? ' (tùy chọn)' : ' *'}
                </label>
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

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  disabled={isIngredientBanned(editingMed.active_ingredient) || isIngredientBanned(editingMed.name)}
                  checked={editingMed.is_allowed && !isIngredientBanned(editingMed.active_ingredient) && !isIngredientBanned(editingMed.name)}
                  onChange={(e) => setEditingMed({ ...editingMed, is_allowed: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-700"
                />
                <span className="font-semibold text-xs">
                  {editingMed.medicine_type === 'Vật tư canh tác'
                    ? 'Cho phép sử dụng trong tư vấn canh tác (Lavi được gợi ý cho nông dân)'
                    : 'Đã đối chiếu Danh mục thuốc BVTV được phép sử dụng tại Việt Nam (bật lưu hành, Lavi mới được gợi ý)'}
                </span>
              </label>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
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
            </div>
          )}
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
                {viewingEvidenceGroup?.count || 1} đoạn trích
              </Badge>
            </div>
            <DialogDescription className="text-xs mt-1">
              Chi tiết ngữ cảnh đoạn văn trong bài báo được AI trích xuất để làm căn cứ gợi ý vật tư và phòng trừ bệnh hại.
            </DialogDescription>
          </DialogHeader>

          {viewingEvidenceGroup && (
            <div className="space-y-3 py-2 text-xs">
              {/* 1. KHỐI TẠO SẢN PHẨM HOẶC GẮN SP CHUNG Ở NGAY TRÊN ĐẦU */}
              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  <div className="font-bold text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Thao tác nhanh cho gợi ý: <strong>{viewingEvidenceGroup.mentionText}</strong></span>
                  </div>
                  <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                    Áp dụng tạo hoặc gắn cho toàn bộ {viewingEvidenceGroup.count} đoạn trích bằng chứng
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const itm = viewingEvidenceGroup.items[activeEvidenceTabIdx] || viewingEvidenceGroup.items[0];
                      setViewingEvidenceGroup(null);
                      handleOpenCreateMedModal(itm);
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
                      const itm = viewingEvidenceGroup.items[activeEvidenceTabIdx] || viewingEvidenceGroup.items[0];
                      setViewingEvidenceGroup(null);
                      setLinkingSuggestion(itm);
                      setSelectedLinkMedId(itm.product_id ?? '');
                    }}
                    className="h-7 px-2.5 text-xs font-semibold bg-background border-emerald-300 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/50"
                  >
                    <LinkIcon className="w-3 h-3 mr-1" />
                    <span>Gắn vào SP có sẵn</span>
                  </Button>
                </div>
              </div>

              {/* 2. HÀNG TABS CHUYỂN ĐỔI 2-4 ĐOẠN TRÍCH */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-1">
                  <span className="text-xs font-semibold text-foreground">
                    Danh sách các đoạn văn xuất hiện ({viewingEvidenceGroup.count} đoạn):
                  </span>
                  {viewingEvidenceGroup.items.length > 1 && (
                    <span className="text-[10px] text-muted-foreground">
                      Bấm từng tab để đọc ngữ cảnh &amp; bệnh mục tiêu riêng
                    </span>
                  )}
                </div>

                {viewingEvidenceGroup.items.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {viewingEvidenceGroup.items.map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveEvidenceTabIdx(idx)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                          activeEvidenceTabIdx === idx
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <span>Đoạn #{idx + 1}</span>
                        <span className="text-[10px] opacity-80 max-w-[130px] truncate">
                          ({item.plant_name} - {item.disease_name})
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* 3. CHI TIẾT ĐOẠN TRÍCH ĐANG CHỌN */}
                {(() => {
                  const currentItem = viewingEvidenceGroup.items[activeEvidenceTabIdx] || viewingEvidenceGroup.items[0];
                  if (!currentItem) return null;
                  return (
                    <div className="space-y-2.5 pt-1">
                      {/* THÔNG TIN NGỮ CẢNH CỦA RIÊNG ĐOẠN NÀY */}
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-secondary/30 border border-border text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs font-medium bg-background">
                            {currentItem.plant_name} – {currentItem.disease_name}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              viewingEvidenceGroup.kind === 'CHEMICAL'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : viewingEvidenceGroup.kind === 'BIOLOGICAL'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : viewingEvidenceGroup.kind === 'SUPPLY'
                                    ? 'bg-blue-50 text-blue-800 border-blue-300'
                                    : 'bg-purple-50 text-purple-800 border-purple-300'
                            }
                          >
                            {viewingEvidenceGroup.kind === 'CHEMICAL'
                              ? 'Thuốc BVTV hóa học'
                              : viewingEvidenceGroup.kind === 'BIOLOGICAL'
                                ? 'Chế phẩm sinh học'
                                : viewingEvidenceGroup.kind === 'SUPPLY'
                                  ? 'Vật tư canh tác'
                                  : 'Biện pháp canh tác'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setViewingEvidenceGroup(null);
                              handleOpenCreateMedModal(currentItem);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold hover:underline"
                            title="Tạo sản phẩm lấy mã bệnh của riêng đoạn này"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Tạo SP từ đoạn này</span>
                          </button>
                          <span className="text-muted-foreground">•</span>
                          <button
                            type="button"
                            onClick={() => {
                              setViewingEvidenceGroup(null);
                              setLinkingSuggestion(currentItem);
                              setSelectedLinkMedId(currentItem.product_id ?? '');
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                            title="Gắn sản phẩm cho riêng đoạn này"
                          >
                            <LinkIcon className="w-3 h-3" />
                            <span>Gắn SP đoạn này</span>
                          </button>
                        </div>
                      </div>

                      {/* VĂN BẢN ĐOẠN TRÍCH NGUYÊN VĂN */}
                      <div className="p-3.5 bg-muted/30 rounded-xl border border-border space-y-1.5">
                        <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                          <span>Nội dung đoạn văn trích xuất (Đoạn #{activeEvidenceTabIdx + 1}/{viewingEvidenceGroup.count}):</span>
                          <span className="font-mono text-[10px]">{currentItem.evidence_text.length} ký tự</span>
                        </div>
                        <div className="text-xs leading-relaxed text-foreground whitespace-pre-line p-3 bg-background rounded-lg border border-border">
                          {cleanEvidencePreview(currentItem.evidence_text)}
                        </div>
                      </div>

                      {/* NGUỒN BÀI BÁO KHOA HỌC */}
                      {currentItem.source_url && (
                        <div className="p-2.5 bg-secondary/30 rounded-lg border border-border text-[11px] flex items-center justify-between">
                          <span className="text-muted-foreground truncate">
                            Nguồn: <strong>{currentItem.source_title || 'Bài viết gốc'}</strong>
                          </span>
                          <a
                            href={currentItem.source_url}
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
      <Dialog open={createMedModalOpen} onOpenChange={setCreateMedModalOpen}>
        <DialogContent className="sm:max-w-3xl lg:max-w-4xl w-[94vw] max-w-4xl max-h-[92vh] overflow-y-auto p-5 sm:p-6">
          <DialogHeader className="shrink-0 pb-2 border-b border-border">
            <div className="flex items-center justify-between gap-2 pr-8">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-700" />
                <span>
                  {fromSuggestion ? `Thêm sản phẩm từ gợi ý: "${fromSuggestion.mention_text}"` : 'Thêm thuốc / Vật tư mới'}
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
              {fromSuggestion
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
                  <span>Chế độ Dev: Tận dụng Gemini Web xịn (Prompt mẫu &amp; Nạp JSON)</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopyGeminiPrompt}
                  className="h-7 px-2 text-[11px] bg-background font-semibold text-blue-700 dark:text-blue-300 border-blue-300 hover:bg-blue-100/50 gap-1"
                  title="Sao chép toàn bộ prompt mẫu vào bộ nhớ tạm để dán vào Gemini Web"
                >
                  <Copy className="w-3 h-3" />
                  <span>📋 Sao chép Prompt cho Gemini</span>
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                1. Dán Link sản phẩm bên dưới $\rightarrow$ Bấm <strong>Sao chép Prompt</strong> rồi dán vào Gemini Web (Gemini Advanced).<br />
                2. Copy đoạn JSON kết quả Gemini trả về rồi dán vào ô bên dưới $\rightarrow$ Bấm <strong>Điền form từ Gemini</strong>.
              </p>
              <div className="space-y-1.5">
                <Textarea
                  value={devGeminiInput}
                  onChange={(e) => setDevGeminiInput(e.target.value)}
                  placeholder='Dán đoạn JSON hoặc kết quả từ Gemini vào đây... Ví dụ: {"name": "Vôi bột nông nghiệp", "medicine_type": "Vật tư canh tác", ...}'
                  rows={3}
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
                  {newMedName.trim() && (
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(
                        `${newMedName} ${newMedActiveIngredient || ''} nông nghiệp liều dùng`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      title="Mở Google tìm kiếm trang web bán hoặc nhãn sản phẩm"
                    >
                      <Search className="w-3 h-3" />
                      <span>Tra Google tìm link</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
                <Input
                  type="url"
                  placeholder="Dán link sản phẩm (Vietchem, Shopee, VTNN, nhãn thuốc)..."
                  value={newMedSourceUrl}
                  onChange={(e) => setNewMedSourceUrl(e.target.value)}
                  className="text-xs bg-background w-full"
                />
                <p className="text-[10px] text-muted-foreground">
                  Dán link bài viết hoặc trang sản phẩm để hỗ trợ đối chiếu thông tin và lấy link ảnh sản phẩm.
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
                    <span>{newMedDescription.length}/1000</span>
                  </div>
                </div>

                {!descPreviewMode ? (
                  <Textarea
                    placeholder="• Bản chất & Phân loại: ...&#10;• Công dụng nông nghiệp: ...&#10;• Phạm vi & Cây trồng: ...&#10;• Hướng dẫn & Lưu ý khi dùng: ..."
                    value={newMedDescription}
                    onChange={(e) => setNewMedDescription(e.target.value)}
                    rows={5}
                    maxLength={1000}
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
                  <select
                    value={newMedTargetDisease}
                    onChange={(e) => setNewMedTargetDisease(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs"
                  >
                    <option value="">-- Không chỉ định (áp dụng chung) --</option>
                    {diseases.map((d) => (
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
                    <div className="h-8 px-2.5 py-1.5 bg-muted/40 border border-border rounded text-xs text-muted-foreground flex items-center">
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
                  ) : newMedType === 'Sinh học' ? (
                    <span className="font-normal text-muted-foreground ml-1">(Mặc định 0 ngày)</span>
                  ) : (
                    <span className="font-normal text-muted-foreground ml-1">(Mặc định 7 ngày nếu để trống)</span>
                  )}
                </label>
                <Input
                  type="number"
                  disabled={newMedType === 'Vật tư canh tác'}
                  placeholder={
                    newMedType === 'Vật tư canh tác'
                      ? 'Không áp dụng'
                      : newMedType === 'Sinh học'
                        ? '0 (An toàn, sinh học)'
                        : '7 (Xem trên nhãn thuốc)'
                  }
                  value={newMedPhi}
                  onChange={(e) => setNewMedPhi(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Hướng dẫn sử dụng / Liều lượng</label>
                <Input
                  type="text"
                  value={newMedDosage}
                  onChange={(e) => setNewMedDosage(e.target.value)}
                  placeholder={
                    newMedType === 'Vật tư canh tác'
                      ? 'Sử dụng theo diện tích canh tác và hướng dẫn nhà sản xuất'
                      : 'Pha theo hướng dẫn trên bao bì'
                  }
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
                <span className="font-semibold text-xs">
                  {newMedType === 'Vật tư canh tác'
                    ? 'Cho phép sử dụng trong tư vấn canh tác (Lavi được gợi ý cho nông dân)'
                    : 'Đã đối chiếu Danh mục thuốc BVTV được phép sử dụng tại Việt Nam (bật lưu hành, Lavi mới được gợi ý)'}
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInventoryPage;
