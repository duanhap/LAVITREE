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
import { DiseaseEvidenceList } from '@/features/products/components/DiseaseEvidenceList';
import {
  getProduct,
  getProductEvidence,
  unlinkProductSuggestion,
  updateProduct,
} from '@/features/products/api';
import { groupProductEvidence } from '@/features/products/groupEvidence';
import type {
  ProductDetailResponse,
  ProductEvidenceItem,
  GroupedDiseaseRow,
} from '@/features/products/types';
import {
  emptyUsageProfile,
  splitDescriptionDosage,
  combineDescriptionDosage,
  formatUsageText,
  type UsageProfile,
} from '@/features/admin/lib/usage-profile';
import {
  buildGoogleQueries,
  buildProductResearchPrompt,
  parseProductResearchJson,
  type ResearchEvidence,
  type ResearchDisease,
} from '@/features/admin/lib/product-research';
import { useDiseaseOptions } from '@/features/admin/hooks';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { formatVND } from '@/lib/format';
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
  const [availableDiseases, setAvailableDiseases] = useState<
    Array<{ classCode: string; diseaseName: string; plantName: string }>
  >([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form state cho Tab 1
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
    dosage_instruction: '',
    usage_profile: emptyUsageProfile(),
  });

  // Bản sao dữ liệu gốc để kiểm tra Dirty & Hoàn tác
  const [initialFormData, setInitialFormData] = useState<ProductFormData | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);
  const [isTogglingDisease, setIsTogglingDisease] = useState<boolean>(false);

  // Modal cảnh báo khi rời trang / đổi tab lúc form còn thay đổi
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState<boolean>(false);
  const [pendingNavigationAction, setPendingNavigationAction] = useState<(() => void) | null>(null);

  // Modal Dev AI Prompt & Nạp JSON
  const [showDevModal, setShowDevModal] = useState<boolean>(false);
  const [devAiInput, setDevAiInput] = useState<string>('');
  const [aiImageCandidates, setAiImageCandidates] = useState<string[]>([]);
  const [aiSourceLinks, setAiSourceLinks] = useState<string[]>([]);
  const [aiNotes, setAiNotes] = useState<Array<{ title: string; text: string }>>([]);

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
      const [prodRes, evRes, disRes] = await Promise.allSettled([
        getProduct(productId),
        getProductEvidence(productId),
        apiClient.get<any[]>('/diseases'),
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

      if (disRes.status === 'fulfilled' && Array.isArray(disRes.value.data)) {
        setAvailableDiseases(
          disRes.value.data.map((d: any) => ({
            classCode: d.classCode || d.class_code,
            diseaseName: d.commonNameVi || d.common_name_vi || d.classCode,
            plantName: d.plantName || d.plant_name || 'Cây trồng',
          }))
        );
      }

      // Tách mô tả và liều lượng từ dosage_instruction
      const { description, dosage } = splitDescriptionDosage(p.dosage_instruction || '');

      const initialData: ProductFormData = {
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
        dosage_instruction: dosage,
        usage_profile: p.usage_profile ? { ...p.usage_profile } : emptyUsageProfile(),
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
    if (!initialFormData) return false;
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
      formData.dosage_instruction !== initialFormData.dosage_instruction ||
      JSON.stringify(formData.usage_profile) !== JSON.stringify(initialFormData.usage_profile)
    );
  }, [formData, initialFormData]);

  // Số trường đã thay đổi
  const dirtyCount = useMemo(() => {
    if (!initialFormData) return 0;
    let count = 0;
    if (formData.name !== initialFormData.name) count++;
    if (formData.medicine_type !== initialFormData.medicine_type) count++;
    if (formData.active_ingredient !== initialFormData.active_ingredient) count++;
    if (formData.price !== initialFormData.price) count++;
    if (formData.stock_quantity !== initialFormData.stock_quantity) count++;
    if (formData.phi_days !== initialFormData.phi_days) count++;
    if (formData.availability !== initialFormData.availability) count++;
    if (formData.description !== initialFormData.description) count++;
    if (formData.image_url !== initialFormData.image_url) count++;
    if (formData.info_source_url !== initialFormData.info_source_url) count++;
    if (formData.is_allowed !== initialFormData.is_allowed) count++;
    if (formData.dosage_instruction !== initialFormData.dosage_instruction) count++;
    if (JSON.stringify(formData.usage_profile) !== JSON.stringify(initialFormData.usage_profile))
      count++;
    return count;
  }, [formData, initialFormData]);

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

  // Chuyển tab an toàn (hỏi xác nhận nếu Tab 1 chưa lưu)
  const handleSelectTab = (targetTab: 'info' | 'diseases') => {
    if (targetTab === activeTab) return;
    if (isDirty && activeTab === 'info') {
      setPendingNavigationAction(() => () => {
        setSearchParams({ tab: targetTab });
        if (initialFormData) setFormData(initialFormData);
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
      const combinedDosage = combineDescriptionDosage(
        formData.description,
        formData.dosage_instruction
      );

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
        image_url: formData.image_url.trim(),
        info_source_url: formData.info_source_url.trim(),
        is_allowed: formData.is_allowed,
        usage_profile: formData.usage_profile,
      };

      const updated = await updateProduct(productId, payload);

      setProduct((prev) => (prev ? { ...prev, ...updated } : updated));
      setInitialFormData(formData);
      toast.success('Đã lưu thay đổi thông tin sản phẩm.');
    } catch (err: unknown) {
      toast.error('Lỗi khi lưu sản phẩm: ' + getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  // Gom nhóm căn cứ cho Tab 2
  const diseaseRows: GroupedDiseaseRow[] = useMemo(() => {
    if (!product) return [];
    return groupProductEvidence(product.diseases || [], evidences, { mode: 'admin' });
  }, [product, evidences]);

  const warningCount = useMemo(() => {
    return diseaseRows.filter((r) => r.status === 'MANUAL_ONLY').length;
  }, [diseaseRows]);

  // Bật / tắt khuyên dùng ở Tab 2 (Cập nhật target_diseases)
  const handleToggleRecommendation = async (modelClass: string, targetState: boolean) => {
    if (!productId || !product) return;

    const currentCodes = (product.target_diseases || []).map((c) => c.toLowerCase());
    let nextCodes: string[];

    if (targetState) {
      if (!currentCodes.includes(modelClass.toLowerCase())) {
        nextCodes = [...(product.target_diseases || []), modelClass];
      } else {
        nextCodes = product.target_diseases || [];
      }
    } else {
      nextCodes = (product.target_diseases || []).filter(
        (c) => c.toLowerCase() !== modelClass.toLowerCase()
      );
    }

    setIsTogglingDisease(true);
    try {
      await updateProduct(productId, { target_diseases: nextCodes });

      // Cập nhật lại product.diseases và product.target_diseases
      setProduct((prev) => {
        if (!prev) return null;
        let newDiseases = [...prev.diseases];
        if (targetState) {
          const matchMeta = availableDiseases.find(
            (d) => d.classCode.toLowerCase() === modelClass.toLowerCase()
          );
          if (!newDiseases.some((d) => d.class_code.toLowerCase() === modelClass.toLowerCase())) {
            newDiseases.push({
              class_code: modelClass,
              disease_name: matchMeta?.diseaseName || modelClass,
              plant_name: matchMeta?.plantName || 'Cây trồng',
            });
          }
        } else {
          newDiseases = newDiseases.filter(
            (d) => d.class_code.toLowerCase() !== modelClass.toLowerCase()
          );
        }

        return {
          ...prev,
          target_diseases: nextCodes,
          diseases: newDiseases,
        };
      });

      toast.success(
        targetState
          ? `Đã bật khuyên dùng cho bệnh ${modelClass}.`
          : `Đã tắt khuyên dùng cho bệnh ${modelClass}.`
      );
    } catch (err: unknown) {
      toast.error('Không thể cập nhật bệnh khuyên dùng: ' + getErrorMessage(err));
      throw err;
    } finally {
      setIsTogglingDisease(false);
    }
  };

  // Thêm bệnh mới vào danh sách khuyên dùng
  const handleAddDisease = async (modelClass: string) => {
    await handleToggleRecommendation(modelClass, true);
  };

  // Gỡ liên kết gợi ý khỏi sản phẩm
  const handleUnlinkSnippet = async (suggestionId: number) => {
    setUnlinkingId(suggestionId);
    try {
      const res = await unlinkProductSuggestion(suggestionId);
      toast.success(res.message);

      // Tải lại danh sách bằng chứng
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
      kind: formData.medicine_type,
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
      kind: formData.medicine_type,
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
      if (data.info_source_url || data.source_url) next.info_source_url = String(data.info_source_url || data.source_url).trim();
      if (data.description) next.description = String(data.description).trim();
      if (parsed.usage) {
        next.usage_profile = parsed.usage;
        const isSupply = next.medicine_type === 'Vật tư canh tác';
        const phiForText = next.phi_days === '' ? null : Number(next.phi_days);
        const composed = formatUsageText(parsed.usage, phiForText, isSupply);
        if (composed) next.dosage_instruction = composed;
      }

      if (parsed.imageCandidates && parsed.imageCandidates.length > 0) {
        setAiImageCandidates(parsed.imageCandidates);
        if (!next.image_url) next.image_url = parsed.imageCandidates[0];
      }
      if (parsed.sourceUrls && parsed.sourceUrls.length > 0) {
        setAiSourceLinks(parsed.sourceUrls);
        if (!next.info_source_url) next.info_source_url = parsed.sourceUrls[0];
      }
      const scopeNote = typeof data.scope_note === 'string' ? data.scope_note : '';
      if (scopeNote) {
        setAiNotes([{ title: 'Lưu ý từ AI', text: scopeNote }]);
      }

      setFormData(next);
      setShowDevModal(false);
      setDevAiInput('');
      toast.success('Đã nạp thông số từ AI vào form.');
    } catch (err: unknown) {
      toast.error('Lỗi khi nạp dữ liệu AI: ' + getErrorMessage(err));
    }
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
      {/* 1. THANH ĐẦU TRANG & THÔNG TIN TÓM TẮT CHỈ ĐỌC */}
      <div className="space-y-4">
        {/* Nút quay lại */}
        <div>
          <button
            type="button"
            onClick={handleBackToInventory}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kho vật tư & thuốc</span>
          </button>
        </div>

        {/* Khối Header sản phẩm */}
        <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Ảnh đại diện 64px (48px trên mobile) */}
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl border border-border bg-muted/20 overflow-hidden shrink-0 flex items-center justify-center">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <Package className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground/50" />
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-extrabold text-foreground truncate tracking-tight">
                {product.name}
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                {product.medicine_type} • {product.active_ingredient || 'Không có hoạt chất'}
              </p>

              {/* Các Badges tóm tắt trạng thái đã lưu */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <Badge
                  variant={product.is_allowed ? 'default' : 'secondary'}
                  className={`text-[10px] font-semibold ${
                    product.is_allowed
                      ? 'bg-status-ok-bg text-status-ok border border-status-ok/30'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {product.is_allowed ? '● Đang lưu hành' : '● Dừng lưu hành'}
                </Badge>

                <Badge variant="outline" className="text-[10px]">
                  {product.availability === 'IN_STOCK'
                    ? `Còn hàng (${product.stock_quantity})`
                    : product.availability === 'OUT_OF_STOCK'
                    ? 'Tạm hết hàng'
                    : 'Không bán'}
                </Badge>

                {product.medicine_type !== 'Vật tư canh tác' && (
                  <Badge variant="outline" className="text-[10px]">
                    PHI: {product.phi_days !== null ? `${product.phi_days} ngày` : 'Chưa rõ'}
                  </Badge>
                )}

                <Badge variant="secondary" className="text-[10px] font-bold text-primary">
                  {formatVND(product.price)}
                </Badge>
              </div>
            </div>
          </div>

          {/* Nút Trợ lý AI (Chế độ Dev) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab !== 'info') {
                setSearchParams({ tab: 'info' });
              }
              setShowDevModal(true);
            }}
            className="h-8 text-xs gap-1.5 shrink-0 border-primary/30 text-primary hover:bg-primary/10 self-start sm:self-auto"
            title="Mở chế độ Dev: Trợ lý AI nghiên cứu thuốc & nạp JSON"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Trợ lý AI</span>
          </Button>
        </div>
      </div>

      {/* 2. THANH TAB DÍNH ĐẦU TRANG */}
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
            <span>Bệnh áp dụng & căn cứ ({diseaseRows.length})</span>
            {warningCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                ⚠{warningCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 3. NỘI DUNG TAB */}
      <div className="pb-16">
        {activeTab === 'info' ? (
          <div className="space-y-6">
            <ProductFormFields
              data={formData}
              onChange={setFormData}
              showTargetDiseases={false}
              aiImageCandidates={aiImageCandidates}
              aiSourceLinks={aiSourceLinks}
              aiNotes={aiNotes}
              googleQueries={googleQueries}
            />

            {/* THANH LƯU DÍNH ĐÁY KHI CÓ THAY ĐỔI */}
            {isDirty && (
              <div className="sticky bottom-0 inset-x-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/95 backdrop-blur-md border-t border-border shadow-lg flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Có {dirtyCount} thay đổi chưa lưu</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => initialFormData && setFormData(initialFormData)}
                    disabled={isSaving}
                    className="text-xs h-8"
                  >
                    Hủy
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveTab1}
                    disabled={isSaving}
                    className="text-xs h-8 gap-1.5 bg-primary text-white hover:bg-primary/90 font-bold"
                  >
                    {isSaving ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Lưu thay đổi</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <DiseaseEvidenceList
            rows={diseaseRows}
            mode="admin"
            productName={product.name}
            defaultProfile={product.usage_profile}
            onToggleRecommendation={handleToggleRecommendation}
            onAddDisease={handleAddDisease}
            onUnlinkSnippet={handleUnlinkSnippet}
            unlinkingId={unlinkingId}
            onSwitchToGeneralTab={() => setSearchParams({ tab: 'info' })}
            availableClasses={availableDiseases}
            isToggling={isTogglingDisease}
          />
        )}
      </div>

      {/* MODAL DEV AI PROMPT VÀ NẠP JSON */}
      <Dialog open={showDevModal} onOpenChange={setShowDevModal}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Chế độ Dev: Trợ lý AI nghiên cứu & tổng hợp thông tin</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Sao chép prompt (đã đính kèm ngữ cảnh các bài báo của sản phẩm) và dán câu trả lời JSON
              vào đây để điền nhanh các thông số.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-secondary/30 border border-border">
              <span className="text-[11px] text-muted-foreground">
                Prompt nghiên cứu đã tích hợp {evidences.length} đoạn trích bằng chứng sẵn có:
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyAiPrompt}
                className="h-7 text-[11px] gap-1 font-semibold"
              >
                <Copy className="w-3 h-3" />
                <span>Sao chép prompt</span>
              </Button>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold block text-foreground">
                Dán câu trả lời của AI (khối ```json ... ``` hoặc toàn văn):
              </label>
              <Textarea
                placeholder="Dán câu trả lời từ Gemini hoặc ChatGPT vào đây..."
                value={devAiInput}
                onChange={(e) => setDevAiInput(e.target.value)}
                rows={7}
                className="text-xs font-mono bg-background"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
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
              onClick={handleApplyAiJson}
              disabled={!devAiInput.trim()}
              className="text-xs gap-1.5 bg-primary text-white"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Điền vào form</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL CẢNH BÁO BỎ THAY ĐỔI CHƯA LƯU */}
      <Dialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <DialogContent className="max-w-md p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Bỏ thay đổi chưa lưu?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Bạn có một số thay đổi trong form Thông tin sản phẩm chưa được lưu. Nếu tiếp tục chuyển
              trang, các thay đổi này sẽ bị hủy bỏ.
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
              Ở lại
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
              className="text-xs"
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
