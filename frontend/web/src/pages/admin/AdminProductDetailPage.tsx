import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Package,
  Sparkles,
  Save,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  Code2,
  Copy,
  Pencil,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Tag,
  Clock,
  Archive,
  FileText,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { EmptyState } from '@/components/common/EmptyState';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { ProductFormFields, type ProductFormData } from '@/features/admin/components/ProductFormFields';
import { setBannedTerms, isIngredientBanned } from '@/features/admin/lib/guardrails';
import { DiseaseEvidenceList } from '@/features/products/components/DiseaseEvidenceList';
import type { SaveDiseaseRulePayload } from '@/features/products/components/DiseaseUsageRule';
import {
  getProduct,
  getProductEvidence,
  unlinkProductSuggestion,
  updateProduct,
  getUsageRules,
  createUsageRule,
  updateUsageRule,
  verifyUsageRule,
  deleteUsageRule,
} from '@/features/products/api';
import { groupProductEvidence } from '@/features/products/groupEvidence';
import type {
  ProductDetailResponse,
  ProductEvidenceItem,
  GroupedDiseaseRow,
  ProductUsageRuleItem,
} from '@/features/products/types';
import {
  splitDescriptionDosage,
  combineDescriptionDosage,
  formatUsageText,
  formatUsageProfileSummary,
  emptyUsageProfile,
  isUsageEmpty,
  validateUsageProfile,
  USAGE_PROFILE_VERSION,
  type UsageProfile,
} from '@/features/admin/lib/usage-profile';
import { UsageProfileEditor } from '@/features/admin/components/UsageProfileEditor';
import {
  buildGoogleQueries,
  buildProductResearchPrompt,
  kindFromMedicineType,
  parseProductResearchJson,
  type ResearchEvidence,
  type ResearchDisease,
} from '@/features/admin/lib/product-research';
import { useDiseaseOptions } from '@/features/admin/hooks';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { formatVND } from '@/lib/format';
import { safeHref } from '@/lib/utils';
import { toast } from 'sonner';

export const AdminProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { diseases } = useDiseaseOptions();

  const productId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [id]);

  const activeTab = searchParams.get('tab') === 'diseases' ? 'diseases' : 'info';

  const [product, setProduct] = useState<ProductDetailResponse | null>(null);
  const [evidences, setEvidences] = useState<ProductEvidenceItem[]>([]);
  const [usageRules, setUsageRules] = useState<ProductUsageRuleItem[]>([]);
  const [availableDiseases, setAvailableDiseases] = useState<
    Array<{ classCode: string; diseaseName: string; plantName: string }>
  >([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Tab 1 state: View mode vs Edit mode
  const [isEditingInfo, setIsEditingInfo] = useState<boolean>(false);

  // Form state cho Tab 1 khi ở Edit mode
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    medicine_type: 'Hóa học',
    active_ingredient: '',
    price: 0,
    stock_quantity: 0,
    phi_days: '',
    availability: 'IN_STOCK',
    description: '',
    image_url: '',
    info_source_url: '',
    is_allowed: false,
  });

  // Bản sao dữ liệu gốc để kiểm tra Dirty & Hoàn tác
  const [initialFormData, setInitialFormData] = useState<ProductFormData | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);

  // Modal cảnh báo khi rời trang / đổi tab lúc form còn thay đổi
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState<boolean>(false);
  const [pendingNavigationAction, setPendingNavigationAction] = useState<(() => void) | null>(null);

  // Modal Dev AI Prompt & Nạp JSON
  const [showDevModal, setShowDevModal] = useState<boolean>(false);
  const [devAiInput, setDevAiInput] = useState<string>('');
  const [aiImageCandidates, setAiImageCandidates] = useState<string[]>([]);
  const [aiSourceLinks, setAiSourceLinks] = useState<string[]>([]);
  const [aiNotes, setAiNotes] = useState<Array<{ title: string; text: string }>>([]);

  // TASK-30: phiếu liều chung của sản phẩm (Tầng 3) để sửa ở tab Thông tin; bỏ bản xem plant_rules / disease_rules (chỉ đọc)
  const toPackageUsage = (u?: UsageProfile | null): UsageProfile => {
    if (!u) return emptyUsageProfile();
    const { plant_rules: _p, disease_rules: _d, ...flat } = u;
    return { ...emptyUsageProfile(), ...flat, plant_rules: null, disease_rules: null };
  };

  // Tách mô tả và liều lượng từ dosage_instruction của product
  const { description: productDescription, dosage: productDosage } = useMemo(() => {
    return splitDescriptionDosage(product?.dosage_instruction || '');
  }, [product?.dosage_instruction]);

  // Tải dữ liệu ban đầu
  const loadProductData = useCallback(async () => {
    if (!productId) {
      setIsNotFound(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsNotFound(false);
    setLoadError(null);

    try {
      const [prodRes, evRes, disRes, bannedRes, rulesRes] = await Promise.allSettled([
        getProduct(productId),
        getProductEvidence(productId),
        apiClient.get<any[]>('/diseases'),
        apiClient.get<{ terms?: Array<{ text: string; substance: string }> }>('/banned-substances'),
        getUsageRules(productId),
      ]);

      if (prodRes.status === 'rejected') {
        const err: any = prodRes.reason;
        if (err?.response?.status === 404) {
          setIsNotFound(true);
        } else {
          setLoadError(getErrorMessage(err));
        }
        return;
      }

      const p = prodRes.value;
      setProduct(p);

      if (evRes.status === 'fulfilled') {
        setEvidences(evRes.value);
      }

      if (rulesRes.status === 'fulfilled') {
        setUsageRules(rulesRes.value);
      }

      if (bannedRes.status === 'fulfilled' && bannedRes.value.data?.terms) {
        setBannedTerms(bannedRes.value.data.terms);
      }

      if (disRes.status === 'fulfilled' && Array.isArray(disRes.value.data)) {
        setAvailableDiseases(
          disRes.value.data.map((d: any) => ({
            classCode: d.classCode || d.class_code,
            diseaseName: d.commonNameVi || d.common_name_vi || d.classCode,
            plantName: d.plantName || d.plant_name || 'Cây trồng',
          }))
        );
      }

      const { description, dosage } = splitDescriptionDosage(p.dosage_instruction || '');

      const initialData: ProductFormData = {
        dosage_instruction: dosage,
        usage_profile: toPackageUsage(p.usage_profile),
        name: p.name || '',
        medicine_type: p.medicine_type || 'Hóa học',
        active_ingredient: p.active_ingredient || '',
        price: p.price ?? 0,
        stock_quantity: p.stock_quantity ?? 0,
        phi_days: p.phi_days === null || p.phi_days === undefined ? '' : p.phi_days,
        availability: p.availability || 'IN_STOCK',
        description,
        image_url: p.image_url || '',
        info_source_url: p.info_source_url || '',
        is_allowed: p.is_allowed ?? false,
      };

      setFormData(initialData);
      setInitialFormData(initialData);
    } catch (err: unknown) {
      setLoadError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadProductData();
  }, [loadProductData]);

  // So sánh xem Tab 1 có thay đổi chưa lưu không
  const isDirty = useMemo(() => {
    if (!initialFormData || !isEditingInfo) return false;
    return (
      formData.name !== initialFormData.name ||
      formData.medicine_type !== initialFormData.medicine_type ||
      formData.active_ingredient !== initialFormData.active_ingredient ||
      formData.price !== initialFormData.price ||
      formData.stock_quantity !== initialFormData.stock_quantity ||
      formData.phi_days !== initialFormData.phi_days ||
      formData.availability !== initialFormData.availability ||
      formData.description !== initialFormData.description ||
      formData.image_url !== initialFormData.image_url ||
      formData.info_source_url !== initialFormData.info_source_url ||
      formData.is_allowed !== initialFormData.is_allowed ||
      (formData.dosage_instruction ?? '') !== (initialFormData.dosage_instruction ?? '') ||
      JSON.stringify(formData.usage_profile ?? null) !== JSON.stringify(initialFormData.usage_profile ?? null)
    );
  }, [formData, initialFormData, isEditingInfo]);

  // Chặn rời trang hoặc F5 khi còn thay đổi chưa lưu
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Chuyển tab an toàn
  const handleSelectTab = (targetTab: 'info' | 'diseases') => {
    if (targetTab === activeTab) return;
    if (isDirty && activeTab === 'info') {
      setPendingNavigationAction(() => () => {
        setSearchParams({ tab: targetTab });
        if (initialFormData) setFormData(initialFormData);
        setIsEditingInfo(false);
      });
      setConfirmDiscardOpen(true);
      return;
    }
    setSearchParams({ tab: targetTab });
  };

  // Nút quay lại danh sách kho
  const handleBackToInventory = () => {
    if (isDirty) {
      setPendingNavigationAction(() => () => navigate('/admin/inventory'));
      setConfirmDiscardOpen(true);
      return;
    }
    navigate('/admin/inventory');
  };

  // Lưu Tab 1 (PATCH /medicines/{id})
  const handleSaveTab1 = async () => {
    if (!productId || !product) return;

    if (!formData.name.trim()) {
      toast.error('Tên sản phẩm không được để trống.');
      return;
    }

    if (formData.medicine_type !== 'Vật tư canh tác' && formData.phi_days === '') {
      toast.error('Thuốc hóa học/sinh học bắt buộc có thời gian cách ly (PHI).');
      return;
    }

    setIsSaving(true);
    try {
      // TASK-30: "Hướng dẫn sử dụng" + phiếu liều chung của sản phẩm sửa được ở tab này
      const usageError = validateUsageProfile(formData.usage_profile);
      if (usageError) {
        toast.error(`Phiếu liều chung: ${usageError}`);
        setIsSaving(false);
        return;
      }
      const combinedDosage = combineDescriptionDosage(
        formData.description,
        formData.dosage_instruction ?? productDosage
      );
      // Phiếu trống gửi {} để xóa phiếu (PATCH: null = giữ nguyên)
      const flatUsage = toPackageUsage(formData.usage_profile);
      const usagePayload = isUsageEmpty(flatUsage)
        ? {}
        : { ...flatUsage, plant_rules: undefined, disease_rules: undefined, version: USAGE_PROFILE_VERSION };

      const isBanned =
        isIngredientBanned(formData.name) ||
        (formData.medicine_type !== 'Vật tư canh tác' && isIngredientBanned(formData.active_ingredient));

      const payload: Record<string, any> = {
        name: formData.name.trim(),
        medicine_type: formData.medicine_type,
        active_ingredient:
          formData.medicine_type === 'Vật tư canh tác' ? '' : formData.active_ingredient.trim(),
        price: formData.price,
        stock_quantity: formData.stock_quantity,
        phi_days: formData.medicine_type === 'Vật tư canh tác' ? null : Number(formData.phi_days),
        availability: formData.availability,
        dosage_instruction: combinedDosage,
        usage_profile: usagePayload,
        image_url: formData.image_url.trim(),
        info_source_url: formData.info_source_url.trim(),
        is_allowed: isBanned ? false : formData.is_allowed,
      };

      const updated = await updateProduct(productId, payload);

      setProduct((prev) => (prev ? { ...prev, ...updated } : updated));
      setInitialFormData(formData);
      setIsEditingInfo(false);
      toast.success('Đã lưu thông tin sản phẩm thành công!');
    } catch (err: unknown) {
      toast.error('Lỗi khi lưu sản phẩm: ' + getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  // Hủy chỉnh sửa Tab 1
  const handleCancelEditTab1 = () => {
    if (isDirty) {
      if (confirm('Bạn có thay đổi chưa lưu. Bạn có chắc muốn hủy chỉnh sửa?')) {
        if (initialFormData) setFormData(initialFormData);
        setIsEditingInfo(false);
      }
    } else {
      setIsEditingInfo(false);
    }
  };

  // Gom nhóm căn cứ cho Tab 2
  const diseaseRows: GroupedDiseaseRow[] = useMemo(() => {
    if (!product) return [];
    return groupProductEvidence(product.diseases || [], evidences, { mode: 'admin' });
  }, [product, evidences]);

  // Lưu liều riêng cho một bệnh (1 dòng ProductUsageRules scope "disease" - TASK-22/29)
  const handleSaveDiseaseRule = async (modelClass: string, payload: SaveDiseaseRulePayload) => {
    if (!productId || !product) return;

    const existingRule = payload.ruleId
      ? usageRules.find((r) => r.id === payload.ruleId)
      : usageRules.find((r) => r.class_code?.toLowerCase() === modelClass.toLowerCase());

    try {
      if (existingRule) {
        const updated = await updateUsageRule(productId, existingRule.id, {
          dosage_instruction: payload.dosageInstruction ?? '',
          profile: payload.profile,
          action_group: payload.actionGroup,
          source_url: payload.sourceUrl,
        });
        setUsageRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const created = await createUsageRule(productId, {
          class_code: modelClass,
          dosage_instruction: payload.dosageInstruction,
          profile: payload.profile,
          action_group: payload.actionGroup,
          source_url: payload.sourceUrl,
        });
        setUsageRules((prev) => [...prev, created]);
      }

      // Tải lại sản phẩm để lấy bản xem liều theo cây / bệnh mới
      const refreshed = await getProduct(productId);
      setProduct(refreshed);
    } catch (err: unknown) {
      toast.error('Lỗi khi lưu liều lượng theo bệnh: ' + getErrorMessage(err));
      throw err;
    }
  };

  // TASK-29: liều chung của cây = 1 dòng ProductUsageRules (scope "plant"). Mọi bệnh của cây tự dùng liều này,
  // trừ bệnh có liều riêng. Chỉ tạo / sửa đúng dòng đó, không chép đè lên liều của bệnh nào.
  const handleSaveCropRule = async (plantName: string, payload: SaveDiseaseRulePayload) => {
    if (!productId || !product) return;
    const norm = (v?: string | null) => (v || '').trim().toLowerCase().replace(/^cây\s+/i, '');
    const existing = usageRules.find((r) => r.scope === 'plant' && norm(r.plant_name) === norm(plantName));
    try {
      if (existing) {
        const updated = await updateUsageRule(productId, existing.id, {
          dosage_instruction: payload.dosageInstruction ?? '',
          profile: payload.profile,
          source_url: payload.sourceUrl,
        });
        setUsageRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const created = await createUsageRule(productId, {
          plant_name: plantName,
          dosage_instruction: payload.dosageInstruction,
          profile: payload.profile,
          source_url: payload.sourceUrl,
        });
        setUsageRules((prev) => [...prev, created]);
      }
      const refreshed = await getProduct(productId);
      setProduct(refreshed);
      toast.success(`Đã lưu liều chung cho Cây ${plantName}.`);
    } catch (err: unknown) {
      toast.error('Lỗi khi lưu liều dùng theo cây: ' + getErrorMessage(err));
      throw err;
    }
  };

  // Xác nhận đối chiếu với nhãn thuốc cho quy tắc bệnh (TASK-22)
  const handleVerifyDiseaseRule = async (ruleId: number, verified: boolean) => {
    if (!productId) return;
    try {
      const updated = await verifyUsageRule(productId, ruleId, verified);
      setUsageRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success(
        verified
          ? 'Đã xác nhận đối chiếu phiếu cách dùng với nhãn thuốc/nguồn.'
          : 'Đã hủy xác nhận đối chiếu.'
      );
    } catch (err: unknown) {
      toast.error('Lỗi khi cập nhật đối chiếu: ' + getErrorMessage(err));
      throw err;
    }
  };

  // Khôi phục liều mặc định cho bệnh (xóa rule khỏi ProductUsageRules và DiseaseRules)
  const handleResetDiseaseRule = async (modelClass: string, ruleId?: number) => {
    if (!productId || !product) return;

    const targetRule = ruleId
      ? usageRules.find((r) => r.id === ruleId)
      : usageRules.find((r) => r.class_code?.toLowerCase() === modelClass.toLowerCase());

    try {
      if (!targetRule) {
        toast.info('Bệnh này không có liều riêng, đang dùng liều chung của cây.');
        return;
      }
      await deleteUsageRule(productId, targetRule.id);
      setUsageRules((prev) => prev.filter((r) => r.id !== targetRule.id));

      const refreshed = await getProduct(productId);
      setProduct(refreshed);
    } catch (err: unknown) {
      toast.error('Lỗi khi khôi phục liều mặc định: ' + getErrorMessage(err));
      throw err;
    }
  };

  // Thêm bệnh vào danh sách điều trị của thuốc
  const handleAddDisease = async (modelClass: string) => {
    if (!productId || !product) return;
    const currentCodes = (product.target_diseases || []).map((c) => c.toLowerCase());
    if (currentCodes.includes(modelClass.toLowerCase())) return;

    const nextCodes = [...(product.target_diseases || []), modelClass];
    try {
      await updateProduct(productId, { target_diseases: nextCodes });

      const matchMeta = availableDiseases.find(
        (d) => d.classCode.toLowerCase() === modelClass.toLowerCase()
      );
      const newDiseases = [...(product.diseases || [])];
      newDiseases.push({
        class_code: modelClass,
        disease_name: matchMeta?.diseaseName || modelClass,
        plant_name: matchMeta?.plantName || 'Cây trồng',
      });

      setProduct((prev) =>
        prev
          ? {
              ...prev,
              target_diseases: nextCodes,
              diseases: newDiseases,
            }
          : null
      );
      toast.success(`Đã thêm bệnh ${matchMeta?.diseaseName || modelClass} vào danh mục điều trị.`);
    } catch (err: unknown) {
      toast.error('Lỗi khi thêm bệnh: ' + getErrorMessage(err));
    }
  };

  // Gỡ bệnh khỏi danh sách điều trị của thuốc
  const handleRemoveDisease = async (modelClass: string) => {
    if (!productId || !product) return;

    const nextCodes = (product.target_diseases || []).filter(
      (c) => c.toLowerCase() !== modelClass.toLowerCase()
    );

    try {
      await updateProduct(productId, { target_diseases: nextCodes });

      const newDiseases = (product.diseases || []).filter(
        (d) => d.class_code.toLowerCase() !== modelClass.toLowerCase()
      );

      // Đồng thời dọn dẹp quy tắc ProductUsageRules nếu có
      const targetRule = usageRules.find(
        (r) => r.class_code?.toLowerCase() === modelClass.toLowerCase()
      );
      if (targetRule) {
        await deleteUsageRule(productId, targetRule.id);
        setUsageRules((prev) => prev.filter((r) => r.id !== targetRule.id));
      }

      // Tải lại để bản xem liều (usage_profile.disease_rules) bỏ bệnh vừa gỡ
      const refreshedAfterRemove = await getProduct(productId);
      setProduct({ ...refreshedAfterRemove, target_diseases: nextCodes, diseases: newDiseases });
      toast.success(`Đã bỏ bệnh ${modelClass} khỏi danh sách điều trị của thuốc.`);
    } catch (err: unknown) {
      toast.error('Lỗi khi gỡ bệnh: ' + getErrorMessage(err));
    }
  };

  // Gỡ liên kết gợi ý khỏi sản phẩm
  const handleUnlinkSnippet = async (suggestionId: number) => {
    setUnlinkingId(suggestionId);
    try {
      const res = await unlinkProductSuggestion(suggestionId);
      toast.success(res.message);

      if (productId) {
        const refreshedEv = await getProductEvidence(productId);
        setEvidences(refreshedEv);
      }
    } catch (err: unknown) {
      toast.error('Lỗi khi gỡ liên kết: ' + getErrorMessage(err));
    } finally {
      setUnlinkingId(null);
    }
  };

  // Dev AI Helpers
  const googleQueries = useMemo(() => {
    return buildGoogleQueries({
      name: formData.name,
      activeIngredient: formData.active_ingredient,
      kind: kindFromMedicineType(formData.medicine_type),
    });
  }, [formData.name, formData.active_ingredient, formData.medicine_type]);

  const handleCopyAiPrompt = () => {
    const researchEvidences: ResearchEvidence[] = evidences.map((ev) => ({
      text: ev.evidence_text,
      plantName: ev.plant_name,
      diseaseName: ev.disease_name,
      diseaseCode: ev.model_class,
      sourceTitle: ev.source_title,
      sourceUrl: ev.source_url,
    }));

    const researchDiseases: ResearchDisease[] = (diseases || []).map((d) => ({
      classCode: d.classCode,
      plantName: d.plantName,
      commonNameVi: d.commonNameVi,
    }));

    const promptText = buildProductResearchPrompt({
      mention: formData.name,
      // Hàm cần mã loại (CHEMICAL / BIOLOGICAL / SUPPLY), không phải nhãn tiếng Việt "Hóa học"...
      kind: kindFromMedicineType(formData.medicine_type),
      evidences: researchEvidences,
      diseases: researchDiseases,
      currentName: formData.name,
      activeIngredient: formData.active_ingredient,
      sourceUrl: formData.info_source_url,
    });

    navigator.clipboard?.writeText(promptText);
    toast.success('Đã sao chép prompt AI vào bộ nhớ tạm.');
  };

  const handleApplyAiJson = () => {
    if (!devAiInput.trim()) return;
    try {
      const researchDiseases: ResearchDisease[] = (diseases || []).map((d) => ({
        classCode: d.classCode,
        plantName: d.plantName,
        commonNameVi: d.commonNameVi,
      }));

      const parsed = parseProductResearchJson(devAiInput, researchDiseases);
      if (!parsed) {
        toast.error('Không tìm thấy JSON hợp lệ trong câu trả lời của AI.');
        return;
      }
      const data = parsed.data as Record<string, any>;
      const next = { ...formData };

      if (data.name && String(data.name).trim().length > 2) next.name = String(data.name).trim();
      if (data.active_ingredient) next.active_ingredient = String(data.active_ingredient).trim();
      if (data.price !== undefined && Number(data.price) > 0) next.price = Number(data.price);
      if (data.phi_days !== undefined && data.phi_days !== null) {
        const phi = Number(data.phi_days);
        if (!isNaN(phi)) next.phi_days = phi;
      }
      if (data.image_url) next.image_url = String(data.image_url).trim();
      if (data.info_source_url || data.source_url)
        next.info_source_url = String(data.info_source_url || data.source_url).trim();
      if (data.description) next.description = String(data.description).trim();
      // TASK-30: phiếu cách dùng AI trả về → phiếu liều chung của sản phẩm (Admin xem / sửa trước khi lưu)
      if (parsed.usage && !isUsageEmpty(parsed.usage)) {
        next.usage_profile = { ...toPackageUsage(parsed.usage) };
        const isSupply = next.medicine_type === 'Vật tư canh tác';
        const composed = formatUsageText(parsed.usage, isSupply || next.phi_days === '' ? null : Number(next.phi_days), isSupply);
        if (composed) next.dosage_instruction = composed;
      } else if (data.dosage_instruction) {
        next.dosage_instruction = String(data.dosage_instruction).trim();
      }

      if (parsed.imageCandidates && parsed.imageCandidates.length > 0) {
        setAiImageCandidates(parsed.imageCandidates);
        if (!next.image_url) next.image_url = parsed.imageCandidates[0];
      }
      if (parsed.sourceUrls && parsed.sourceUrls.length > 0) {
        setAiSourceLinks(parsed.sourceUrls);
        if (!next.info_source_url) next.info_source_url = parsed.sourceUrls[0];
      }

      setFormData(next);
      setShowDevModal(false);
      setDevAiInput('');
      setIsEditingInfo(true);
      toast.success('Đã nạp thông số từ AI vào form.');
    } catch (err: unknown) {
      toast.error('Lỗi khi nạp dữ liệu AI: ' + getErrorMessage(err));
    }
  };

  // Hàm hiển thị mô tả sản phẩm dạng từng khối rõ ràng, có khoảng cách
  const renderFormattedDescription = (rawText: string) => {
    const text = (rawText || '').trim();
    if (!text) {
      return (
        <div className="p-4 rounded-xl border border-dashed border-border bg-muted/20 text-center text-xs text-muted-foreground italic">
          Chưa có mô tả chi tiết cho sản phẩm này. Bấm "Chỉnh sửa thông tin" để cập nhật.
        </div>
      );
    }

    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    return (
      <div className="space-y-3">
        {lines.map((line, idx) => {
          const isBullet = /^[•\-*]|\d+\./.test(line);
          const cleanContent = isBullet ? line.replace(/^([•\-*]|\d+\.)\s*/, '') : line;
          const colonIdx = cleanContent.indexOf(':');
          const hasTitle = colonIdx > 0 && colonIdx < 60;

          const title = hasTitle ? cleanContent.slice(0, colonIdx).trim() : null;
          const body = hasTitle ? cleanContent.slice(colonIdx + 1).trim() : cleanContent;

          return (
            <div
              key={idx}
              className="flex items-start gap-3 p-3.5 rounded-xl bg-card border border-border/70 shadow-2xs hover:border-border transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400 mt-1.5 shrink-0" />
              <div className="flex-1 text-xs sm:text-sm leading-relaxed text-foreground">
                {hasTitle ? (
                  <>
                    <strong className="font-bold text-foreground mr-1.5">
                      {title}:
                    </strong>
                    <span className="text-foreground/90">{body}</span>
                  </>
                ) : (
                  <span className="text-foreground/90">{cleanContent}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Trạng thái đang tải / lỗi
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl space-y-6">
        <PageSkeleton variant="detail" />
      </div>
    );
  }

  if (isNotFound || !product) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <EmptyState
          title="Không tìm thấy sản phẩm"
          description="Sản phẩm bạn đang tìm kiếm không tồn tại, đã bị xóa hoặc đã dừng kinh doanh."
          actionText="Về kho vật tư & thuốc"
          actionHref="/admin/inventory"
        />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
        <h2 className="text-lg font-bold text-foreground">Không thể tải thông tin sản phẩm</h2>
        <p className="text-xs text-muted-foreground">{loadError}</p>
        <Button onClick={loadProductData} size="sm" className="text-xs">
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl space-y-6">
      {/* 1. THANH ĐẦU TRANG */}
      <div>
        <button
          type="button"
          onClick={handleBackToInventory}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kho vật tư &amp; thuốc</span>
        </button>
      </div>

      {/* 2. THANH TAB CHUYỂN ĐỔI */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSelectTab('info')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeTab === 'info'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Thông tin sản phẩm</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('diseases')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'diseases'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Bệnh điều trị &amp; Liều lượng ({diseaseRows.length})</span>
          </button>
        </div>
      </div>

      {/* 3. NỘI DUNG TAB */}
      <div className="pb-16">
        {activeTab === 'info' ? (
          <div className="space-y-6">
            {/* VIEW MODE: XEM CHI TIẾT SẠCH SẼ ĐẸP MẮT */}
            {!isEditingInfo ? (
              <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-6 shadow-xs">
                {/* Header View Mode có thông tin sản phẩm và nút Edit & Trợ lý AI */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
                  <div className="space-y-1">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                      {product.name}
                    </h1>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                      <span>{product.medicine_type}</span>
                      <span>•</span>
                      <span>{product.active_ingredient || 'Không có hoạt chất'}</span>
                      <span>•</span>
                      <Badge
                        variant={product.is_allowed ? 'default' : 'secondary'}
                        className={`text-[10px] font-semibold py-0 ${
                          product.is_allowed
                            ? 'bg-status-ok-bg text-status-ok border border-status-ok/30'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {product.is_allowed ? '● Đang lưu hành' : '● Dừng lưu hành'}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        const { description, dosage } = splitDescriptionDosage(product.dosage_instruction || '');
                        setFormData({
                          dosage_instruction: dosage,
                          usage_profile: toPackageUsage(product.usage_profile),
                          name: product.name || '',
                          medicine_type: product.medicine_type || 'Hóa học',
                          active_ingredient: product.active_ingredient || '',
                          price: product.price ?? 0,
                          stock_quantity: product.stock_quantity ?? 0,
                          phi_days: product.phi_days === null || product.phi_days === undefined ? '' : product.phi_days,
                          availability: product.availability || 'IN_STOCK',
                          description,
                          image_url: product.image_url || '',
                          info_source_url: product.info_source_url || '',
                          is_allowed: product.is_allowed ?? false,
                        });
                        setIsEditingInfo(true);
                      }}
                      className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Chỉnh sửa thông tin</span>
                    </Button>
                  </div>
                </div>

                {/* Bố cục 2 cột gọn gàng */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Cột trái: Ảnh sản phẩm & Thông số bán lẻ */}
                  <div className="lg:col-span-4 space-y-4">
                    <div className="rounded-xl border border-border bg-muted/20 p-4 flex flex-col items-center justify-center min-h-[220px]">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="max-h-[200px] w-full object-contain rounded-lg"
                        />
                      ) : (
                        <div className="text-center space-y-2 text-muted-foreground">
                          <Package className="w-12 h-12 mx-auto opacity-40" />
                          <span className="text-xs">Chưa có ảnh sản phẩm</span>
                        </div>
                      )}
                    </div>

                    {/* Lưới thông số nhỏ */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-3 bg-muted/20 rounded-xl border border-border/60 space-y-1">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                          <Tag className="w-3 h-3 text-primary" />
                          <span>Giá bán lẻ:</span>
                        </span>
                        <div className="font-bold text-foreground text-sm">
                          {formatVND(product.price)}
                        </div>
                      </div>

                      <div className="p-3 bg-muted/20 rounded-xl border border-border/60 space-y-1">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                          <Archive className="w-3 h-3 text-primary" />
                          <span>Tồn kho:</span>
                        </span>
                        <div className="font-bold text-foreground text-sm">
                          {product.stock_quantity} gói/chai
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cột phải: Chi tiết sản phẩm & Mô tả định dạng đẹp */}
                  <div className="lg:col-span-8 space-y-5">
                    {/* Bảng thuộc tính sản phẩm */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl border border-border/70 bg-card space-y-1">
                        <span className="text-[11px] text-muted-foreground">Phân loại sản phẩm</span>
                        <div className="font-semibold text-foreground">{product.medicine_type}</div>
                      </div>

                      <div className="p-3 rounded-xl border border-border/70 bg-card space-y-1">
                        <span className="text-[11px] text-muted-foreground">Hoạt chất chính</span>
                        <div className="font-semibold text-foreground">
                          {product.active_ingredient || (
                            <span className="text-muted-foreground italic">Không có hoạt chất</span>
                          )}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl border border-border/70 bg-card space-y-1">
                        <span className="text-[11px] text-muted-foreground">Thời gian cách ly (PHI)</span>
                        <div className="font-semibold text-foreground">
                          {product.medicine_type === 'Vật tư canh tác'
                            ? 'Không áp dụng'
                            : product.phi_days !== null
                            ? `${product.phi_days} ngày`
                            : 'Chưa rõ'}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl border border-border/70 bg-card space-y-1">
                        <span className="text-[11px] text-muted-foreground">Tình trạng phân phối</span>
                        <div className="font-semibold text-foreground">
                          {product.availability === 'IN_STOCK'
                            ? 'Đang có sẵn trong kho'
                            : product.availability === 'OUT_OF_STOCK'
                            ? 'Tạm hết hàng'
                            : 'Không kinh doanh'}
                        </div>
                      </div>
                    </div>

                    {/* Nguồn thông tin sản phẩm */}
                    {product.info_source_url && (
                      <div className="p-3 rounded-xl border border-border/70 bg-card text-xs flex items-center justify-between gap-2">
                        <div className="text-muted-foreground truncate">
                          <span className="font-semibold text-foreground">Trang thông tin nguồn: </span>
                          <span className="font-mono text-[11px]">{product.info_source_url}</span>
                        </div>
                        <a
                          href={safeHref(product.info_source_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-semibold flex items-center gap-1 shrink-0 text-xs"
                        >
                          <span>Xem gốc</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* KHỐI RIÊNG BIỆT BÊN DƯỚI: MÔ TẢ CÔNG DỤNG & ĐẶC TÍNH SẢN PHẨM */}
                <div className="rounded-2xl border border-border bg-muted/10 p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <h4 className="font-bold text-foreground text-sm sm:text-base">
                        Mô tả công dụng &amp; đặc tính sản phẩm
                      </h4>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Tổng quan kỹ thuật
                    </span>
                  </div>

                  {renderFormattedDescription(productDescription)}
                </div>

                {/* TASK-30: liều chung của sản phẩm (Tầng 3) */}
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-1.5">
                  <h4 className="font-bold text-foreground text-sm">Liều chung của sản phẩm (theo nhãn / bao bì)</h4>
                  <p className="text-xs text-foreground/90 whitespace-pre-line">
                    {productDosage?.trim() || 'Chưa có.'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {product.usage_profile && !isUsageEmpty(product.usage_profile)
                      ? `Phiếu: ${formatUsageProfileSummary(product.usage_profile)}`
                      : 'Chưa có phiếu liều chung.'}{' '}
                    Liều theo từng cây ở tab Bệnh điều trị &amp; Liều lượng.
                  </p>
                </div>
              </div>
            ) : (
              /* EDIT MODE: HIỆN FORM CHỈNH SỬA VỚI NÚT LƯU & HỦY */
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-muted/20 border border-border rounded-xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Pencil className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-bold text-xs sm:text-sm text-foreground">
                      Chế độ chỉnh sửa thông tin sản phẩm
                    </span>
                    {isDirty && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Chưa lưu
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* NÚT CHẾ ĐỘ DEV </> TINH GỌN NHƯ LÚC THÊM MỚI */}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowDevModal(true)}
                      className="h-8 w-8 p-0 font-mono font-bold transition-colors flex items-center justify-center shrink-0 bg-background hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-border"
                      title="Chế độ Dev: Prompt AI & Nạp JSON"
                    >
                      <Code2 className="w-4 h-4" />
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEditTab1}
                      className="h-8 text-xs"
                    >
                      Hủy bỏ
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isSaving}
                      onClick={handleSaveTab1}
                      className="h-8 text-xs font-bold gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
                    </Button>
                  </div>
                </div>

                <ProductFormFields
                  data={formData}
                  onChange={setFormData}
                  showTargetDiseases={false}
                  aiImageCandidates={aiImageCandidates}
                  aiSourceLinks={aiSourceLinks}
                  aiNotes={aiNotes}
                  googleQueries={googleQueries}
                />

                {/* TASK-30: LIỀU CHUNG CỦA SẢN PHẨM (Tầng 3 - theo nhãn / bao bì) */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">Liều chung của sản phẩm (theo nhãn / bao bì)</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Dùng khi cây chưa có liều riêng. Liều theo từng cây đặt ở tab <strong>Bệnh điều trị &amp; Liều lượng</strong>. Để trống nếu chưa có nguồn.
                    </p>
                  </div>
                  <UsageProfileEditor
                    value={formData.usage_profile ?? emptyUsageProfile()}
                    onChange={(next) => setFormData({ ...formData, usage_profile: next })}
                    isSupply={formData.medicine_type === 'Vật tư canh tác'}
                    onCompose={() => {
                      const isSupply = formData.medicine_type === 'Vật tư canh tác';
                      const text = formatUsageText(
                        formData.usage_profile ?? emptyUsageProfile(),
                        isSupply || formData.phi_days === '' ? null : Number(formData.phi_days),
                        isSupply
                      );
                      if (text) {
                        setFormData({ ...formData, dosage_instruction: text });
                        toast.success('Đã ghép phiếu vào ô Hướng dẫn sử dụng.');
                      }
                    }}
                  />
                  <div>
                    <label className="font-semibold block mb-1 text-xs">Hướng dẫn sử dụng / Liều lượng</label>
                    <Textarea
                      value={formData.dosage_instruction ?? ''}
                      onChange={(e) => setFormData({ ...formData, dosage_instruction: e.target.value })}
                      rows={Math.min(9, Math.max(2, (formData.dosage_instruction ?? '').split('\n').length + 1))}
                      className="text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Trợ lý Lavi đọc nguyên văn ô này; con số liều lượng phải có ở đây thì Lavi mới được nói.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* TAB 2: BỆNH ĐIỀU TRỊ & LIỀU LƯỢNG */
          <DiseaseEvidenceList
            rows={diseaseRows}
            mode="admin"
            productName={product.name}
            defaultProfile={product.usage_profile}
            defaultDosage={productDosage}
            diseaseRules={product.usage_profile?.disease_rules}
            plantRules={product.usage_profile?.plant_rules}
            usageRules={usageRules}
            isSupply={product.medicine_type === 'Vật tư canh tác'}
            phiDays={product.phi_days}
            onSaveDiseaseRule={handleSaveDiseaseRule}
            onSaveCropRule={handleSaveCropRule}
            onVerifyDiseaseRule={handleVerifyDiseaseRule}
            onResetDiseaseRule={handleResetDiseaseRule}
            onRemoveDisease={handleRemoveDisease}
            onAddDisease={handleAddDisease}
            onUnlinkSnippet={handleUnlinkSnippet}
            unlinkingId={unlinkingId}
            availableClasses={availableDiseases}
          />
        )}
      </div>

      {/* MODAL DEV AI: TRỢ LÝ AI NGHIÊN CỨU & NẠP JSON */}
      <Dialog open={showDevModal} onOpenChange={setShowDevModal}>
        <DialogContent className="max-w-2xl p-5 rounded-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Trợ lý AI nghiên cứu thuốc &amp; Nạp JSON</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Sao chép prompt được cấu hình sẵn để hỏi Gemini/ChatGPT, sau đó dán kết quả JSON vào đây để tự động điền form.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
              <div className="space-y-0.5">
                <div className="font-bold text-xs text-foreground">1. Sao chép Prompt cho AI</div>
                <div className="text-[11px] text-muted-foreground">
                  Bao gồm tên thuốc, danh sách bệnh và các đoạn trích liên quan.
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyAiPrompt}
                className="h-8 text-xs gap-1.5 font-semibold text-primary"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Sao chép Prompt</span>
              </Button>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-xs text-foreground block">
                2. Dán kết quả JSON từ AI vào đây:
              </label>
              <Textarea
                placeholder="Dán toàn bộ câu trả lời chứa khối ```json ... ``` của AI vào đây..."
                value={devAiInput}
                onChange={(e) => setDevAiInput(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDevModal(false)}
              className="text-xs"
            >
              Đóng
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!devAiInput.trim()}
              onClick={handleApplyAiJson}
              className="text-xs font-bold gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Nạp thông số vào form</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG XÁC NHẬN RỜI TRANG KHI FORM DIRTY */}
      <Dialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <DialogContent className="max-w-md p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Bỏ các thay đổi chưa lưu?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Bạn đang có thông tin sản phẩm đã chỉnh sửa nhưng chưa lưu. Nếu rời đi bây giờ, các thay đổi sẽ bị mất.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setConfirmDiscardOpen(false);
                setPendingNavigationAction(null);
              }}
              className="text-xs"
            >
              Ở lại trang
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setConfirmDiscardOpen(false);
                if (pendingNavigationAction) {
                  pendingNavigationAction();
                  setPendingNavigationAction(null);
                }
              }}
              className="text-xs font-bold"
            >
              Bỏ thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProductDetailPage;

