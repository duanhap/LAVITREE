import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShoppingCart,
  ShieldCheck,
  Clock,
  CloudRain,
  Leaf,
  FlaskConical,
  Package,
  Sparkles,
  BookOpen,
  ZoomIn,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Plus,
  Minus,
  Info,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  Microscope,
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { safeHref, cn } from '@/lib/utils';
import { FormattedSnippet } from '@/components/common/FormattedSnippet';
import { isUsageEmpty, type UsageProfile } from '@/features/admin/lib/usage-profile';
import type {
  ProductDetailResponse,
  ProductEvidenceItem,
  ProductDiseaseInfo,
} from '@/features/products/types';

// Phân tích văn bản mô tả / hướng dẫn pha chế thành các khối thông tin kỹ thuật rõ ràng
const parseDosageSections = (rawText: string) => {
  if (!rawText) return [];
  const clean = rawText.replace(/^Mô tả\s*:\s*/i, '').trim();

  const rawParts = clean.includes('•')
    ? clean.split(/•\s*/).filter((p) => p.trim().length > 0)
    : clean.split(/\n\s*-\s*|\n{2,}/).filter((p) => p.trim().length > 0);

  if (rawParts.length <= 1 && !clean.includes(':')) {
    return [{ title: 'Hướng dẫn sử dụng chung', content: clean }];
  }

  return rawParts.map((part) => {
    const colonIndex = part.indexOf(':');
    if (colonIndex > 0 && colonIndex < 60) {
      const title = part.substring(0, colonIndex).trim();
      const content = part.substring(colonIndex + 1).trim();
      return { title, content };
    }
    return { title: 'Thông tin kỹ thuật', content: part.trim() };
  });
};

// Trích xuất phần hướng dẫn sử dụng thực tế (bỏ qua các đoạn bài văn mô tả kỹ thuật chung)
const extractPracticalUsageText = (rawText: string) => {
  if (!rawText) return '';
  const sections = parseDosageSections(rawText);
  if (!sections.length) return rawText.trim();
  const usageSec = sections.find((s) =>
    /hướng dẫn|cách dùng|cách pha|liều lượng/i.test(s.title)
  );
  if (usageSec && usageSec.content) {
    return usageSec.content;
  }
  if (sections.length > 1) {
    return sections[sections.length - 1].content;
  }
  return sections[0].content;
};

// Trích xuất các từ khóa tên thuốc/hoạt chất để bôi vàng nổi bật trong đoạn trích khoa học
const getEvidenceHighlightKeywords = (
  item: ProductEvidenceItem,
  prod?: ProductDetailResponse | null
): string[] => {
  const keywords: string[] = [];
  if (item.mention_text?.trim()) {
    keywords.push(item.mention_text.trim());
  }
  if (prod?.active_ingredient?.trim()) {
    keywords.push(prod.active_ingredient.trim());
    prod.active_ingredient.split(/[+;,]/).forEach((p) => {
      const clean = p.trim().replace(/\s*\([^)]*\)/g, '').replace(/\s*(spp\.?|sp\.?)$/i, '');
      if (clean.length >= 3) keywords.push(clean);
    });
  }
  if (prod?.name?.trim()) {
    const cleanName = prod.name
      .replace(/^(Chế phẩm sinh học|Thuốc trừ bệnh|Thuốc trừ sâu|Thuốc BVTV|Phân bón lá)\s+/i, '')
      .trim();
    if (cleanName.length >= 3) {
      keywords.push(cleanName);
      const firstWord = cleanName.split(/\s+/)[0];
      if (firstWord && firstWord.length >= 3) {
        keywords.push(firstWord);
      }
    }
  }
  return Array.from(new Set(keywords));
};

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [product, setProduct] = useState<ProductDetailResponse | null>(null);
  const [evidenceList, setEvidenceList] = useState<ProductEvidenceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [quantity, setQuantity] = useState<number>(1);
  const [isZoomOpen, setIsZoomOpen] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);

  // Popup cho bệnh khi người dùng bấm vào thẻ trong lưới (Tab 2)
  const [selectedPopupDisease, setSelectedPopupDisease] = useState<ProductDiseaseInfo | null>(null);

  // Tab đang hoạt động trong trang chi tiết
  const [activeTab, setActiveTab] = useState<string>('instructions');

  // Lọc theo Cây trồng cho Tab 2 (Cây trồng & Bệnh đặc trị) - TASK-28
  const [selectedCropPlant, setSelectedCropPlant] = useState<string>('');

  // Lọc theo Cây trồng và Bệnh cho Tab 3 (Căn cứ khoa học) - TASK-28
  const [selectedEvidencePlant, setSelectedEvidencePlant] = useState<string>('');
  const [selectedEvidenceDisease, setSelectedEvidenceDisease] = useState<string>('');

  // Chuyển thẳng từ nút bệnh ở Tab 2 sang xem Căn cứ khoa học của đúng bệnh đó ở Tab 3
  const handleSelectDiseaseForEvidence = (plantName: string, diseaseName: string) => {
    setSelectedEvidencePlant(plantName);
    setSelectedEvidenceDisease(diseaseName);
    setActiveTab('evidence');
    const el = document.getElementById('product-detail-tabs');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const cartStorageKey = user?.id ? `lavitree_cart_${user.id}` : 'lavitree_cart_guest';

  useEffect(() => {
    if (!id || isNaN(Number(id))) {
      setError('Mã sản phẩm không hợp lệ.');
      setLoading(false);
      return;
    }

    const fetchProductData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [prodRes, evRes] = await Promise.allSettled([
          apiClient.get<ProductDetailResponse>(`/medicines/${id}`),
          apiClient.get<ProductEvidenceItem[]>(`/medicines/${id}/evidence`),
        ]);

        if (prodRes.status === 'fulfilled') {
          setProduct(prodRes.value.data);
        } else {
          setError(getErrorMessage(prodRes.reason) || 'Không tìm thấy sản phẩm.');
        }

        if (evRes.status === 'fulfilled' && Array.isArray(evRes.value.data)) {
          setEvidenceList(evRes.value.data);
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchProductData();
  }, [id]);

  const handleAddToCart = () => {
    if (!product) return;

    if (product.availability === 'NOT_SOLD') {
      toast.error('Sản phẩm này hiện chỉ mang tính tham khảo kỹ thuật, cửa hàng không phân phối trực tiếp.');
      return;
    }

    if (product.stock_quantity <= 0) {
      toast.error('Sản phẩm hiện đang tạm hết hàng trong kho.');
      return;
    }

    try {
      let currentCart: any[] = [];
      try {
        const saved = localStorage.getItem(cartStorageKey);
        currentCart = saved ? JSON.parse(saved) : [];
      } catch {
        currentCart = [];
      }

      const existingIndex = currentCart.findIndex((item: any) => item.product?.id === product.id);
      const maxStock = product.stock_quantity;

      if (existingIndex >= 0) {
        const nextQty = Math.min(currentCart[existingIndex].quantity + quantity, maxStock);
        currentCart[existingIndex].quantity = nextQty;
      } else {
        currentCart.push({
          product,
          quantity: Math.min(quantity, maxStock),
        });
      }

      localStorage.setItem(cartStorageKey, JSON.stringify(currentCart));
      window.dispatchEvent(new Event('storage'));
      toast.success(`Đã thêm "${product.name}" (SL: ${quantity}) vào giỏ hàng!`);
    } catch (err: any) {
      toast.error('Không thể thêm sản phẩm vào giỏ hàng: ' + (err.message || 'Lỗi kết nối'));
    }
  };

  const dosageSections = useMemo(() => {
    return parseDosageSections(product?.dosage_instruction || '');
  }, [product?.dosage_instruction]);

  // Phân nhóm các khối hướng dẫn kỹ thuật thành các nhóm tiêu đề có thể thu gọn
  const technicalGroups = useMemo(() => {
    const g1: Array<{ title: string; content: string }> = [];
    const g2: Array<{ title: string; content: string }> = [];
    const g3: Array<{ title: string; content: string }> = [];

    dosageSections.forEach((sec) => {
      const t = sec.title.toLowerCase();
      if (
        t.includes('pha') ||
        t.includes('liều lượng') ||
        t.includes('cách dùng') ||
        t.includes('bắt đầu') ||
        t.includes('hướng dẫn')
      ) {
        g2.push(sec);
      } else if (
        t.includes('lưu ý') ||
        t.includes('bảo quản') ||
        t.includes('cách ly') ||
        t.includes('phi') ||
        t.includes('an toàn') ||
        t.includes('không dùng')
      ) {
        g3.push(sec);
      } else {
        g1.push(sec);
      }
    });

    const groups = [];
    if (g1.length > 0) {
      groups.push({
        id: 'g1',
        title: 'Đặc tính, Cơ chế tác động & Đối tượng phòng trừ',
        icon: Sparkles,
        items: g1,
      });
    }
    if (g2.length > 0) {
      groups.push({
        id: 'g2',
        title: 'Hướng dẫn pha chế & Liều lượng sử dụng',
        icon: FlaskConical,
        items: g2,
      });
    }
    if (g3.length > 0) {
      groups.push({
        id: 'g3',
        title: 'Quy chuẩn an toàn, Cách ly (PHI) & Bảo quản',
        icon: ShieldCheck,
        items: g3,
      });
    }

    if (groups.length === 0 && dosageSections.length > 0) {
      groups.push({
        id: 'g_all',
        title: 'Hướng dẫn kỹ thuật & Sử dụng chi tiết',
        icon: Sparkles,
        items: dosageSections,
      });
    }

    return groups;
  }, [dosageSections]);

  // Trạng thái mở/đóng từng nhóm: tiêu đề đầu tiên mặc định mở rộng trước (true), các tiêu đề sau thu gọn (false)
  const [openGroupMap, setOpenGroupMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (technicalGroups.length > 0) {
      const initialMap: Record<string, boolean> = {};
      technicalGroups.forEach((g, index) => {
        initialMap[g.id] = index === 0;
      });
      setOpenGroupMap(initialMap);
    }
  }, [technicalGroups]);

  const toggleGroup = (groupId: string) => {
    setOpenGroupMap((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // TASK-28: Helper lấy biểu tượng sinh động cho từng loại cây / loại quả
  const getPlantEmoji = (plantName?: string | null): string => {
    if (!plantName) return '🌱';
    const p = plantName.toLowerCase();
    if (p.includes('cà chua') || p.includes('tomato')) return '🍅';
    if (p.includes('ngô') || p.includes('bắp') || p.includes('corn') || p.includes('maize')) return '🌽';
    if (p.includes('nho') || p.includes('grape')) return '🍇';
    if (p.includes('khoai tây') || p.includes('potato')) return '🥔';
    if (p.includes('lúa') || p.includes('gạo') || p.includes('rice')) return '🌾';
    if (p.includes('táo') || p.includes('apple')) return '🍎';
    if (p.includes('ớt') || p.includes('pepper')) return '🌶️';
    if (p.includes('cam') || p.includes('quýt') || p.includes('bưởi') || p.includes('citrus')) return '🍊';
    if (p.includes('dưa hấu') || p.includes('watermelon')) return '🍉';
    if (p.includes('dưa chuột') || p.includes('cucumber')) return '🥒';
    if (p.includes('dâu tây') || p.includes('strawberry')) return '🍓';
    return '🌿';
  };

  // TASK-28: Gom nhóm Căn cứ khoa học theo Cây trồng / Loại quả
  const groupedEvidenceByPlant = useMemo(() => {
    const map = new Map<
      string,
      {
        plant_name: string;
        items: ProductEvidenceItem[];
        diseaseCounts: Map<string, number>;
      }
    >();

    for (const item of evidenceList) {
      const rawPlant = (item.plant_name || '').trim();
      const plant = rawPlant || 'Cây trồng';
      const key = plant.toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          plant_name: plant,
          items: [],
          diseaseCounts: new Map<string, number>(),
        });
      }

      const group = map.get(key)!;
      group.items.push(item);
      const dName = item.disease_name?.trim() || 'Bệnh cây trồng';
      group.diseaseCounts.set(dName, (group.diseaseCounts.get(dName) || 0) + 1);
    }

    return Array.from(map.values()).map((g) => ({
      plant_name: g.plant_name,
      items: g.items,
      diseases: Array.from(g.diseaseCounts.entries()).map(([name, count]) => ({ name, count })),
    }));
  }, [evidenceList]);

  // Danh sách các nhóm Cây trồng hiển thị theo bộ lọc Tab con
  const visibleEvidencePlantGroups = useMemo(() => {
    if (selectedEvidencePlant === 'ALL') {
      return groupedEvidenceByPlant;
    }
    return groupedEvidenceByPlant.filter(
      (g) => g.plant_name.toLowerCase() === selectedEvidencePlant.toLowerCase()
    );
  }, [groupedEvidenceByPlant, selectedEvidencePlant]);

  // TASK-28: Gom nhóm Bệnh đặc trị theo Cây trồng cho Tab 2
  const groupedDiseasesByPlant = useMemo(() => {
    if (!product?.diseases || product.diseases.length === 0) return [];
    const map = new Map<
      string,
      {
        plant_name: string;
        cropDosageText?: string;
        cropProfile?: UsageProfile | null;
        diseases: Array<{
          class_code: string;
          disease_name: string;
          plant_name: string;
          hasSpecificRule: boolean;
          dosage_instruction?: string;
        }>;
      }
    >();

    for (const d of product.diseases) {
      const rawPlant = (d.plant_name || '').trim();
      const plant = rawPlant || 'Cây trồng';
      const key = plant.toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          plant_name: plant,
          diseases: [],
        });
      }

      const specificRule =
        product.usage_profile?.disease_rules?.[d.class_code] ||
        Object.entries(product.usage_profile?.disease_rules || {}).find(
          ([k]) => k.toLowerCase() === (d.class_code || '').toLowerCase()
        )?.[1];

      // TASK-29: scope "plant" = bệnh đang dùng liều chung của cây, không phải liều riêng
      const isOwnRule = Boolean(specificRule && specificRule.scope !== 'plant');
      const hasSpecific = Boolean(
        specificRule && isOwnRule &&
        (specificRule.dosage_instruction?.trim() ||
          (specificRule.usage_profile && !isUsageEmpty(specificRule.usage_profile)))
      );

      const entry = map.get(key)!;
      entry.diseases.push({
        ...d,
        hasSpecificRule: hasSpecific,
        dosage_instruction: specificRule?.dosage_instruction,
      });

      const plantRule =
        product.usage_profile?.plant_rules?.[plant] ||
        product.usage_profile?.plant_rules?.[d.plant_name] ||
        product.usage_profile?.plant_rules?.[`Cây ${plant}`] ||
        product.usage_profile?.plant_rules?.[plant.replace(/^Cây\s+/i, '')] ||
        Object.entries(product.usage_profile?.plant_rules || {}).find(
          ([k]) =>
            k.toLowerCase() === plant.toLowerCase() ||
            k.toLowerCase() === `cây ${plant}`.toLowerCase() ||
            k.toLowerCase().replace(/^cây\s+/i, '') === plant.toLowerCase().replace(/^cây\s+/i, '')
        )?.[1];

      // 1. Ưu tiên liều của Cây trồng từ plant_rules
      if (plantRule?.dosage_instruction?.trim()) {
        entry.cropDosageText = plantRule.dosage_instruction.trim();
      } else if (!isOwnRule) {
        // 2. Dữ liệu cũ chưa có scope: lấy đoạn của bệnh. Liều riêng của một bệnh (scope "disease")
        //    không được hiện thành liều của cả cây.
        const disText = specificRule?.dosage_instruction?.trim();
        if (disText) {
          // Ưu tiên đoạn hướng dẫn chi tiết đầy đủ của bệnh
          if (!entry.cropDosageText || disText.length > entry.cropDosageText.length) {
            entry.cropDosageText = disText;
          }
        } else if (!entry.cropDosageText && specificRule?.usage_profile?.dose_text?.trim()) {
          entry.cropDosageText = specificRule.usage_profile.dose_text.trim();
        }
      }

      // Kế thừa hồ sơ thông số kỹ thuật (các ô kỹ thuật: liều pha, lượng nước, chu kỳ...) cho cây
      if (plantRule?.usage_profile && !isUsageEmpty(plantRule.usage_profile)) {
        entry.cropProfile = plantRule.usage_profile;
      } else if (!entry.cropProfile || isUsageEmpty(entry.cropProfile)) {
        if (hasSpecific && specificRule?.usage_profile && !isUsageEmpty(specificRule.usage_profile)) {
          entry.cropProfile = specificRule.usage_profile;
        } else if (product.usage_profile && !isUsageEmpty(product.usage_profile)) {
          entry.cropProfile = product.usage_profile;
        }
      }
    }

    // Đảm bảo nhóm cây có văn bản liều nếu có thông số dose_text trong profile
    for (const entry of map.values()) {
      if (!entry.cropDosageText && entry.cropProfile?.dose_text?.trim()) {
        entry.cropDosageText = entry.cropProfile.dose_text.trim();
      }
    }

    return Array.from(map.values());
  }, [product?.diseases, product?.usage_profile]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-6xl space-y-8 animate-pulse">
        <div className="h-6 w-48 bg-muted rounded-md" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 h-96 bg-muted rounded-2xl" />
          <div className="lg:col-span-7 space-y-4">
            <div className="h-8 w-3/4 bg-muted rounded-md" />
            <div className="h-5 w-1/3 bg-muted rounded-md" />
            <div className="h-10 w-1/2 bg-muted rounded-md mt-6" />
            <div className="h-24 bg-muted rounded-xl mt-6" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-xl text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Không tìm thấy thông tin sản phẩm</h2>
        <p className="text-sm text-muted-foreground">{error || 'Sản phẩm không khả dụng hoặc đã bị dừng kinh doanh.'}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/store">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại Cửa hàng
          </Link>
        </Button>
      </div>
    );
  }

  const isBio = product.medicine_type === 'Sinh học';
  const isFarmingSupply = product.medicine_type === 'Vật tư canh tác';
  const isNotSold = product.availability === 'NOT_SOLD';
  const isOutOfStock = product.stock_quantity <= 0;
  const imgSrc = safeHref(product.image_url);
  const TypeIcon = isFarmingSupply ? Package : isBio ? Leaf : FlaskConical;

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl space-y-8">
      {/* 1. BREADCRUMBS & NÚT QUAY LẠI */}
      <div className="flex items-center justify-between gap-4 text-xs">
        <nav className="flex items-center gap-1.5 text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Trang chủ</Link>
          <span>/</span>
          <Link to="/store" className="hover:text-foreground">Cửa hàng vật tư</Link>
          <span>/</span>
          <span className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs">
            {product.name}
          </span>
        </nav>

        <Button asChild variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground">
          <Link to="/store">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Về Cửa hàng
          </Link>
        </Button>
      </div>

      {/* 2. MAIN HERO SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* CỘT TRÁI: ẢNH SẢN PHẨM & BADGES */}
        <div className="lg:col-span-5 space-y-4">
          <div className="relative rounded-2xl border border-border bg-card overflow-hidden shadow-xs group">
            <div
              className="w-full h-80 sm:h-96 flex items-center justify-center p-6 bg-white dark:bg-muted/10 cursor-pointer"
              onClick={() => imgSrc && !imageError && setIsZoomOpen(true)}
              title={imgSrc && !imageError ? 'Bấm để phóng to ảnh' : undefined}
            >
              {imgSrc && !imageError ? (
                <>
                  <img
                    src={imgSrc}
                    alt={product.name}
                    className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                    onError={() => setImageError(true)}
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold backdrop-blur-[1px]">
                    <ZoomIn className="w-4 h-4" />
                    <span>Xem ảnh lớn</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
                  <TypeIcon className="w-20 h-20 stroke-[1.5]" />
                  <span className="text-xs">Chưa có ảnh thực tế</span>
                </div>
              )}
            </div>

            {/* Badges góc trên */}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              <Badge
                variant="outline"
                className={`text-xs font-semibold shadow-xs ${isFarmingSupply
                  ? 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300'
                  : isBio
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300'
                    : 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/70 dark:text-blue-300'
                  }`}
              >
                <TypeIcon className="w-3.5 h-3.5 mr-1" />
                {product.medicine_type}
              </Badge>
            </div>
          </div>

          {/* Dải đặc tính an toàn */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl border border-border bg-card flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Thời gian cách ly (PHI)</p>
                <p className="font-semibold text-foreground">
                  {isFarmingSupply ? 'Không cần PHI' : product.phi_days != null ? `${product.phi_days} ngày` : 'Theo nhãn bao bì'}
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border border-border bg-card flex items-center gap-2">
              <CloudRain className={`w-4 h-4 shrink-0 ${product.rain_resistant ? 'text-cyan-600' : 'text-zinc-400'}`} />
              <div>
                <p className="text-[10px] text-muted-foreground">Kháng mưa rửa trôi</p>
                <p className="font-semibold text-foreground">
                  {product.rain_resistant ? 'Kháng mưa ẩm' : 'Phun trời khô ráo'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: THÔNG TIN MUA HÀNG & THAO TÁC */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight leading-snug">
              {product.name}
            </h1>

            {product.active_ingredient ? (
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <span className="text-muted-foreground">Hoạt chất chính:</span>
                <span className="font-semibold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                  {product.active_ingredient}
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Vật tư & Chế phẩm nông nghiệp</p>
            )}
          </div>

          {/* Giá & Tồn kho */}
          <div className="p-4 rounded-2xl bg-secondary/30 border border-border/80 space-y-2">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <div>
                <span className="text-xs text-muted-foreground block">Giá niêm yết chính hãng:</span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-800 dark:text-emerald-400">
                  {product.price > 0 ? `${product.price.toLocaleString('vi-VN')} đ` : 'Giá tham khảo'}
                </span>
              </div>

              <div>
                {isNotSold ? (
                  <Badge variant="secondary" className="bg-muted text-muted-foreground">
                    Cửa hàng không bán trực tiếp
                  </Badge>
                ) : isOutOfStock ? (
                  <Badge variant="destructive">Tạm hết hàng</Badge>
                ) : (
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Còn {product.stock_quantity} sản phẩm
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Chọn số lượng & Đặt mua */}
          {!isNotSold && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center border border-border rounded-xl bg-card overflow-hidden shadow-2xs">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1 || isOutOfStock}
                    className="h-10 w-10 rounded-none text-muted-foreground hover:text-foreground"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-12 text-center text-sm font-bold text-foreground">
                    {quantity}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuantity((q) => Math.min(product.stock_quantity, q + 1))}
                    disabled={quantity >= product.stock_quantity || isOutOfStock}
                    className="h-10 w-10 rounded-none text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <Button
                  type="button"
                  size="lg"
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  className="flex-1 min-w-[200px] h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs gap-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>{isOutOfStock ? 'Tạm hết hàng' : 'Thêm vào giỏ hàng'}</span>
                </Button>
              </div>

              <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs rounded-lg text-emerald-700 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                >
                  <Link to="/store?openCart=true">
                    <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
                    Xem giỏ hàng & Đặt mua
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg"
                >
                  <Link to={`/chat?message=${encodeURIComponent(`Thuốc "${product.name}" dùng cho cây gì, liều lượng và thời gian cách ly như thế nào?`)}`}>
                    <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    Hỏi Lavi về thuốc này
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* Ghi chú pháp lý & kiểm duyệt */}
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Sản phẩm nằm trong danh mục thuốc bảo vệ thực vật chính ngạch được phép lưu hành tại Việt Nam (Thông tư 75/2025/TT-BNNMT). Không chứa hoạt chất cấm.
            </p>
          </div>
        </div>
      </div>

      {/* 3. KHU VỰC CHI TIẾT DƯỚI DẠNG TABS THEO YÊU CẦU NGƯỜI DÙNG */}
      <Tabs
        id="product-detail-tabs"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full space-y-6 pt-6 border-t border-border/80"
      >
        <TabsList className="w-full justify-start border-b border-border rounded-none h-auto p-0 bg-transparent gap-2 sm:gap-6 flex-wrap">
          <TabsTrigger
            value="instructions"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-3 py-2.5 font-bold text-xs sm:text-sm bg-transparent shadow-none"
          >
            <FlaskConical className="w-4 h-4 mr-1.5" />
            Mô tả & Hướng dẫn kỹ thuật
          </TabsTrigger>
          <TabsTrigger
            value="diseases"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-3 py-2.5 font-bold text-xs sm:text-sm bg-transparent shadow-none"
          >
            <Leaf className="w-4 h-4 mr-1.5" />
            Cây trồng & Bệnh đặc trị ({product.diseases?.length || 0})
          </TabsTrigger>
          {evidenceList.length > 0 && (
            <TabsTrigger
              value="evidence"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-3 py-2.5 font-bold text-xs sm:text-sm bg-transparent shadow-none"
            >
              <BookOpen className="w-4 h-4 mr-1.5" />
              Căn cứ khoa học ({evidenceList.length})
            </TabsTrigger>
          )}
          <TabsTrigger
            value="safety"
            className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-3 py-2.5 font-bold text-xs sm:text-sm bg-transparent shadow-none"
          >
            <ShieldCheck className="w-4 h-4 mr-1.5" />
            Quy chuẩn an toàn & PHI
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: MÔ TẢ & HƯỚNG DẪN KỸ THUẬT (CHIA THÀNH CÁC NHÓM TIÊU ĐỀ CÓ NÚT THU GỌN) */}
        <TabsContent value="instructions" className="space-y-4 pt-1">
          {technicalGroups.map((group) => {
            const isOpen = !!openGroupMap[group.id];
            const GroupIcon = group.icon;

            return (
              <div
                key={group.id}
                className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs transition-all"
              >
                {/* Thanh Tiêu đề có nút thu gọn (Tiêu đề đầu tiên mặc định mở rộng trước) */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between p-4 sm:p-4.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left select-none cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                      <GroupIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                        {group.title}
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        {group.items.length} mục thông tin kỹ thuật
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline text-xs font-semibold text-muted-foreground group-hover:text-foreground">
                      {isOpen ? 'Thu gọn' : 'Mở rộng'}
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-secondary/80 flex items-center justify-center text-muted-foreground group-hover:text-foreground">
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>
                </button>

                {/* Nội dung bên trong khi mở rộng */}
                {isOpen && (
                  <div className="p-4 sm:p-5 border-t border-border/60 bg-muted/5 animate-in fade-in-50 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {group.items.map((sec, idx) => {
                        const isHighlight =
                          sec.title.toLowerCase().includes('cách pha') ||
                          sec.title.toLowerCase().includes('liều lượng');

                        return (
                          <Card
                            key={idx}
                            className={`rounded-2xl border transition-all shadow-2xs ${isHighlight
                                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 md:col-span-2'
                                : 'border-border bg-card'
                              }`}
                          >
                            <CardHeader className="pb-2 pt-4 px-4 sm:px-5">
                              <CardTitle
                                className={`text-sm sm:text-base font-bold flex items-center gap-2 ${isHighlight
                                    ? 'text-emerald-800 dark:text-emerald-300'
                                    : 'text-foreground'
                                  }`}
                              >
                                <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                                <span>{sec.title}</span>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 sm:px-5 pb-4 text-xs sm:text-sm text-foreground/90 leading-relaxed">
                              <p className="whitespace-pre-line">{sec.content}</p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Lưu ý thực tế */}
          <Card className="rounded-2xl border-border bg-card shadow-2xs">
            <CardHeader className="pb-2 pt-4 px-4 sm:px-5">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Khuyến cáo kỹ thuật từ Kỹ sư nông nghiệp BVTV</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-5 pb-4 text-xs text-muted-foreground leading-relaxed space-y-2">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Phun ướt đều tán lá vào sáng sớm hoặc chiều mát, tuyệt đối tránh thời điểm nắng gắt hoặc sắp có mưa lớn.</li>
                <li>Tuân thủ nguyên tắc 4 đúng: Đúng thuốc, Đúng lúc, Đúng liều lượng và Đúng cách.</li>
                <li>
                  {product.rain_resistant
                    ? 'Sản phẩm có tính năng chống rửa trôi, nên phun trước cơn mưa ít nhất 1-2 giờ để hoạt chất bám dính tốt nhất.'
                    : 'Nếu trời mưa to ngay sau khi phun (dưới 2 giờ), cần theo dõi kỹ tình trạng vườn và tham khảo ý kiến kỹ sư trước khi quyết định phun nhắc lại.'}
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: CÂY TRỒNG & BỆNH ĐẶC TRỊ (GOM NHÓM THEO CÂY TRỒNG / LOẠI QUẢ - TASK-28) */}
        <TabsContent value="diseases" className="space-y-4 pt-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Phân cấp liều lượng và danh mục bệnh đặc trị theo từng loại cây trồng. Bấm vào từng bệnh để xem trực tiếp căn cứ khoa học:
            </p>
          </div>

          {groupedDiseasesByPlant.length > 0 ? (
            <div className="space-y-4">
              {/* TẦNG 1: TAB CÂY TRỒNG (MỖI CÂY 1 TAB, KHÔNG ĐỂ ALL ĐẦU - TASK-28) */}
              {groupedDiseasesByPlant.length > 1 && (
                <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto scrollbar-none">
                  {groupedDiseasesByPlant.map((crop) => {
                    const activeCropName =
                      selectedCropPlant || groupedDiseasesByPlant[0]?.plant_name;
                    const isCropActive =
                      activeCropName.toLowerCase() === crop.plant_name.toLowerCase();

                    return (
                      <button
                        key={crop.plant_name}
                        type="button"
                        onClick={() => setSelectedCropPlant(crop.plant_name)}
                        className={cn(
                          'px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shrink-0 transition-all cursor-pointer flex items-center gap-2 border',
                          isCropActive
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                            : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/50'
                        )}
                      >
                        <span className="text-base leading-none">{getPlantEmoji(crop.plant_name)}</span>
                        <span>{crop.plant_name.startsWith('Cây') ? crop.plant_name : `Cây ${crop.plant_name}`}</span>
                        <span
                          className={cn(
                            'px-1.5 py-0.2 rounded-full text-[10px]',
                            isCropActive
                              ? 'bg-primary-foreground/25 text-primary-foreground font-bold'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {crop.diseases.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* NỘI DUNG DUY NHẤT CỦA CÂY ĐANG CHỌN (KHÔNG ĐỂ TẤT CẢ DỌC) */}
              {(() => {
                const activeCropName =
                  selectedCropPlant || groupedDiseasesByPlant[0]?.plant_name;
                const crop =
                  groupedDiseasesByPlant.find(
                    (c) => c.plant_name.toLowerCase() === activeCropName.toLowerCase()
                  ) || groupedDiseasesByPlant[0];

                if (!crop) return null;

                const cropDosage =
                  crop.cropDosageText ||
                  crop.cropProfile?.dose_text ||
                  'Tuân thủ theo liều khuyến cáo chung và hướng dẫn kỹ thuật trên nhãn bao bì.';

                return (
                  <div
                    key={crop.plant_name}
                    className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-2xs hover:border-primary/40 transition-all"
                  >
                    {/* Header Cây trồng */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl p-2 rounded-xl bg-primary/10 shrink-0 leading-none">
                          {getPlantEmoji(crop.plant_name)}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-base sm:text-lg text-foreground">
                              {crop.plant_name.startsWith('Cây') ? crop.plant_name : `Cây ${crop.plant_name}`}
                            </h3>
                            <Badge className="bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold">
                              {crop.diseases.length} bệnh đặc trị
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Áp dụng phác đồ phòng trị và liều lượng chuyên biệt cho cây trồng này
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 1. ĐẦU TIÊN: DANH MỤC CÁC BỆNH ĐẶC TRỊ TRÊN CÂY TRỒNG NÀY (BẤM VÀO ĐỂ XEM CĂN CỨ KHOA HỌC) */}
                    <div className="space-y-2 pt-1">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                        Danh mục bệnh hại phòng trị (Bấm vào để xem căn cứ khoa học):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {crop.diseases.map((d, dIdx) => (
                          <button
                            key={dIdx}
                            type="button"
                            onClick={() => handleSelectDiseaseForEvidence(crop.plant_name, d.disease_name)}
                            className="px-3 py-2 rounded-xl border border-border bg-background hover:border-primary hover:bg-primary/5 hover:text-primary transition-all text-xs font-semibold flex items-center gap-2 shadow-2xs cursor-pointer group"
                            title={`Bấm để xem căn cứ khoa học chứng minh hiệu quả trị ${d.disease_name}`}
                          >
                            <span className="text-sm">🦠</span>
                            <span>{d.disease_name}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 2. CHO XUỐNG DƯỚI: KHỐI LIỀU LƯỢNG ÁP DỤNG CHO CÂY TRỒNG NÀY */}
                    <div className="p-3.5 rounded-xl bg-muted/30 border border-border/80 space-y-2.5 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-foreground">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Liều lượng khuyến cáo cho {crop.plant_name}:</span>
                      </div>
                      <p className="text-foreground/90 leading-relaxed font-medium whitespace-pre-line">
                        {cropDosage}
                      </p>

                      {/* CÁC Ô THÔNG SỐ KỸ THUẬT ÁP DỤNG CHO CÂY TRỒNG NÀY */}
                      {crop.cropProfile && !isUsageEmpty(crop.cropProfile) && (
                        <div className="pt-2 border-t border-border/50 space-y-1.5">
                          <span className="font-semibold text-foreground text-[11px] block">
                            Thông số kỹ thuật áp dụng:
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                            {crop.cropProfile.dose_amount && (
                              <div className="p-2 rounded-lg bg-background border border-border/60 shadow-2xs">
                                <span className="text-muted-foreground block text-[10px]">Liều pha:</span>
                                <strong className="text-foreground">{crop.cropProfile.dose_amount} {crop.cropProfile.dose_unit || ''}</strong>
                              </div>
                            )}
                            {crop.cropProfile.water_liters && (
                              <div className="p-2 rounded-lg bg-background border border-border/60 shadow-2xs">
                                <span className="text-muted-foreground block text-[10px]">Lượng nước:</span>
                                <strong className="text-foreground">{crop.cropProfile.water_liters} lít / bình</strong>
                              </div>
                            )}
                            {crop.cropProfile.dose_per_area && (
                              <div className="p-2 rounded-lg bg-background border border-border/60 shadow-2xs col-span-2 sm:col-span-1">
                                <span className="text-muted-foreground block text-[10px]">Liều theo diện tích:</span>
                                <strong className="text-foreground">
                                  {crop.cropProfile.dose_per_area.min && crop.cropProfile.dose_per_area.max && crop.cropProfile.dose_per_area.min !== crop.cropProfile.dose_per_area.max
                                    ? `${crop.cropProfile.dose_per_area.min}–${crop.cropProfile.dose_per_area.max}`
                                    : crop.cropProfile.dose_per_area.min || crop.cropProfile.dose_per_area.max}{' '}
                                  {crop.cropProfile.dose_per_area.unit || ''}
                                </strong>
                              </div>
                            )}
                            {crop.cropProfile.method && (
                              <div className="p-2 rounded-lg bg-background border border-border/60 shadow-2xs col-span-2">
                                <span className="text-muted-foreground block text-[10px]">Cách dùng:</span>
                                <strong className="text-foreground">{crop.cropProfile.method}</strong>
                              </div>
                            )}
                            {crop.cropProfile.interval_days && (
                              <div className="p-2 rounded-lg bg-background border border-border/60 shadow-2xs">
                                <span className="text-muted-foreground block text-[10px]">Cách nhau:</span>
                                <strong className="text-foreground">
                                  {typeof crop.cropProfile.interval_days === 'object'
                                    ? `${crop.cropProfile.interval_days.min || ''}–${crop.cropProfile.interval_days.max || ''} ngày`
                                    : `${crop.cropProfile.interval_days} ngày`}
                                </strong>
                              </div>
                            )}
                            {crop.cropProfile.time_of_day && crop.cropProfile.time_of_day.length > 0 && (
                              <div className="p-2 rounded-lg bg-background border border-border/60 shadow-2xs">
                                <span className="text-muted-foreground block text-[10px]">Thời điểm:</span>
                                <strong className="text-foreground">{crop.cropProfile.time_of_day.join(', ')}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : product.target_diseases && product.target_diseases.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {product.target_diseases.map((code, idx) => (
                <div
                  key={idx}
                  onClick={() =>
                    setSelectedPopupDisease({
                      class_code: code,
                      disease_name: code.replace(/___/g, ' - ').replace(/_/g, ' '),
                      plant_name: 'Cây trồng',
                    })
                  }
                  className="p-4 rounded-xl border border-border bg-card hover:border-primary transition-all cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-mono font-semibold text-foreground">{code}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-2xl bg-card">
              Thuốc đa năng dùng cho nhiều loại cây trồng và phòng trừ các tác nhân nấm/vi khuẩn phổ biến. Đọc kỹ nhãn bao bì.
            </div>
          )}
        </TabsContent>

        {/* TAB 3: CĂN CỨ KHOA HỌC & TRÍCH DẪN KHUYẾN NÔNG (2 TẦNG: CÂY TRỒNG & BỆNH MỤC TIÊU - CHỐNG DÀI DÒNG) */}
        {evidenceList.length > 0 && (
          <TabsContent value="evidence" className="space-y-5 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Sản phẩm được trích dẫn trực tiếp từ các phác đồ điều trị và tài liệu khuyến nông đã qua kiểm duyệt:
              </p>
              <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium shrink-0 flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-200 border border-amber-400 dark:bg-amber-400" />
                <span>Tên thuốc &amp; hoạt chất được bôi vàng trong văn bản</span>
              </span>
            </div>

            {groupedEvidenceByPlant.length > 0 && (
              <div className="space-y-4">
                {/* TẦNG 1: TAB CÂY TRỒNG (MỖI CÂY 1 TAB) */}
                {groupedEvidenceByPlant.length > 1 && (
                  <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto scrollbar-none">
                    {groupedEvidenceByPlant.map((group) => {
                      const isPlantActive =
                        selectedEvidencePlant.toLowerCase() === group.plant_name.toLowerCase() ||
                        (selectedEvidencePlant === 'ALL' &&
                          groupedEvidenceByPlant[0]?.plant_name === group.plant_name);

                      return (
                        <button
                          key={group.plant_name}
                          type="button"
                          onClick={() => {
                            setSelectedEvidencePlant(group.plant_name);
                            setSelectedEvidenceDisease(group.diseases[0]?.name || '');
                          }}
                          className={cn(
                            'px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shrink-0 transition-all cursor-pointer flex items-center gap-2 border',
                            isPlantActive
                              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                              : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/50'
                          )}
                        >
                          <span className="text-base leading-none">{getPlantEmoji(group.plant_name)}</span>
                          <span>{group.plant_name.startsWith('Cây') ? group.plant_name : `Cây ${group.plant_name}`}</span>
                          <span
                            className={cn(
                              'px-1.5 py-0.2 rounded-full text-[10px]',
                              isPlantActive
                                ? 'bg-primary-foreground/25 text-primary-foreground font-bold'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {group.items.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* NỘI DUNG CỦA CÂY ĐANG CHỌN (GỌN GÀNG, KHÔNG LÊ THÊ) */}
                {(() => {
                  const currentPlantGroup =
                    groupedEvidenceByPlant.find(
                      (g) => g.plant_name.toLowerCase() === selectedEvidencePlant.toLowerCase()
                    ) || groupedEvidenceByPlant[0];

                  if (!currentPlantGroup) return null;

                  const activeDisease =
                    selectedEvidenceDisease && selectedEvidenceDisease !== 'ALL'
                      ? selectedEvidenceDisease
                      : currentPlantGroup.diseases[0]?.name || '';

                  const filteredItems = currentPlantGroup.items.filter(
                    (item) => (item.disease_name || '').toLowerCase() === activeDisease.toLowerCase()
                  );

                  return (
                    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-2xs">
                      {/* Tiêu đề nhóm Cây trồng */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl p-2 rounded-xl bg-primary/10 shrink-0 leading-none">
                            {getPlantEmoji(currentPlantGroup.plant_name)}
                          </span>
                          <div>
                            <h3 className="font-extrabold text-base text-foreground">
                              Căn cứ khoa học trên {currentPlantGroup.plant_name.startsWith('Cây') ? currentPlantGroup.plant_name : `Cây ${currentPlantGroup.plant_name}`}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Chọn từng bệnh bên dưới để xem đúng bài báo chứng minh hiệu quả điều trị
                            </p>
                          </div>
                        </div>

                        <Badge variant="secondary" className="text-xs font-semibold self-start sm:self-auto">
                          {filteredItems.length} tài liệu
                        </Badge>
                      </div>

                      {/* TẦNG 2: SUB-TABS CHỌN TỪNG BỆNH CỦA CÂY ĐÓ (KHÔNG ĐỂ ALL ĐẦU - TASK-28) */}
                      {currentPlantGroup.diseases.length > 0 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1">
                          {currentPlantGroup.diseases.map((d) => {
                            const isDiseaseActive = activeDisease.toLowerCase() === d.name.toLowerCase();
                            return (
                              <button
                                key={d.name}
                                type="button"
                                onClick={() => setSelectedEvidenceDisease(d.name)}
                                className={cn(
                                  'px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1.5',
                                  isDiseaseActive
                                    ? 'bg-primary text-primary-foreground shadow-xs'
                                    : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                                )}
                              >
                                <span>🎯 {d.name}</span>
                                <span
                                  className={cn(
                                    'px-1.5 py-0.2 rounded-full text-[10px]',
                                    isDiseaseActive
                                      ? 'bg-primary-foreground/25 text-primary-foreground font-bold'
                                      : 'bg-background/80 text-muted-foreground'
                                  )}
                                >
                                  {d.count}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* DANH SÁCH BÀI BÁO GỌN GÀNG ĐÚNG BỆNH ĐANG CHỌN */}
                      <div className="space-y-3.5 pt-1">
                        {filteredItems.length > 0 ? (
                          filteredItems.map((item, idx) => {
                            const highlightKeywords = getEvidenceHighlightKeywords(item, product);

                            return (
                              <div
                                key={idx}
                                className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-2.5 text-xs shadow-2xs hover:border-primary/40 transition-colors"
                              >
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div className="space-y-1 min-w-0 flex-1">
                                    <span className="font-bold text-foreground text-sm block leading-snug">
                                      {item.source_title || 'Tài liệu hướng dẫn kỹ thuật BVTV'}
                                    </span>
                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] font-medium bg-background text-primary border-primary/30"
                                      >
                                        🎯 Trị bệnh: {item.disease_name || 'Bệnh hại'}
                                      </Badge>
                                      <span>{item.organization || 'Khuyến nông'}</span>
                                      {item.published_date && (
                                        <>
                                          <span>·</span>
                                          <span>{item.published_date}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  <Badge variant="outline" className="text-[10px] font-medium bg-background shrink-0">
                                    {item.is_verbatim ? 'Trích nguyên văn' : 'Tóm tắt phác đồ'}
                                  </Badge>
                                </div>

                                {/* Đoạn trích dẫn có bôi vàng tên thuốc & hoạt chất */}
                                <div className="bg-background/90 p-3.5 rounded-xl border border-border/60 text-xs">
                                  <FormattedSnippet
                                    text={item.evidence_text}
                                    mention={highlightKeywords}
                                    variant="full"
                                  />
                                </div>

                                {item.source_url && (
                                  <div className="text-right pt-0.5">
                                    <a
                                      href={item.source_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold"
                                    >
                                      <span>Xem tài liệu gốc</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl bg-card">
                            Chưa có bài báo khoa học nào cho bệnh này trên cây {currentPlantGroup.plant_name}.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </TabsContent>
        )}

        {/* TAB 4: QUY CHUẨN AN TOÀN & PHI */}
        <TabsContent value="safety" className="space-y-4 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
            <Card className="rounded-2xl border-border bg-card p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                <Clock className="w-4 h-4" />
                <span>Thời gian cách ly (PHI - Pre-Harvest Interval)</span>
              </div>
              <p className="text-muted-foreground">
                Thời gian cách ly của sản phẩm là{' '}
                <strong className="text-foreground">
                  {isFarmingSupply ? 'Không cần thời gian cách ly' : `${product.phi_days ?? '—'} ngày`}
                </strong>
                . Đây là khoảng thời gian tối thiểu kể từ lần phun thuốc cuối cùng cho tới khi thu hoạch nông sản. Tuân thủ đúng PHI giúp nông sản không còn dư lượng độc hại, bảo vệ an toàn cho người tiêu dùng.
              </p>
            </Card>

            <Card className="rounded-2xl border-border bg-card p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Trang bị bảo hộ lao động khi phun</span>
              </div>
              <p className="text-muted-foreground">
                Bắt buộc mang khẩu trang, kính chắn giọt bắn, găng tay cao su và ủng bảo hộ khi pha chế và phun thuốc. Không ăn uống, hút thuốc trong quá trình thao tác. Tắm rửa sạch sẽ bằng xà phòng ngay sau khi hoàn thành.
              </p>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* POPUP CHI TIẾT BỆNH KHI BẤM VÀO THẺ TRONG TAB 2 */}
      <Dialog
        open={!!selectedPopupDisease}
        onOpenChange={(open) => !open && setSelectedPopupDisease(null)}
      >
        <DialogContent className="sm:max-w-lg md:max-w-xl p-0 bg-background border border-border rounded-2xl overflow-hidden flex flex-col max-h-[88vh]">
          {selectedPopupDisease && (() => {
            const rule = product?.usage_profile?.disease_rules?.[selectedPopupDisease.class_code];
            const hasRule = Boolean(
              rule &&
              (rule.dosage_instruction?.trim() ||
                (rule.usage_profile && !isUsageEmpty(rule.usage_profile)))
            );
            const prof = rule?.usage_profile;
            const fallbackUsage = extractPracticalUsageText(product?.dosage_instruction || '');

            return (
              <>
                <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 bg-muted/10 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
                    <Badge variant="outline" className="text-xs font-bold text-primary uppercase">
                      {selectedPopupDisease.plant_name}
                    </Badge>
                    {hasRule ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-0 text-[11px] font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Đã có liều lượng riêng</span>
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300/80 text-[11px] font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Chưa thiết lập liều riêng</span>
                      </Badge>
                    )}
                  </div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                    {selectedPopupDisease.disease_name}
                  </DialogTitle>
                </DialogHeader>

                <div className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs flex-1">
                  {hasRule ? (
                    /* TRƯỜNG HỢP A: ĐÃ CÓ LIỀU LƯỢNG RIÊNG ĐƯỢC THIẾT LẬP */
                    <div className="space-y-3.5">
                      {/* Khối hướng dẫn sử dụng riêng */}
                      <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/60 space-y-1.5">
                        <span className="font-semibold text-xs text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>Hướng dẫn sử dụng cho bệnh này:</span>
                        </span>
                        <p className="text-xs text-foreground leading-relaxed whitespace-pre-line font-medium">
                          {rule?.dosage_instruction || 'Xem các thông số kỹ thuật bên dưới.'}
                        </p>
                      </div>

                      {/* Bảng thông số kỹ thuật (nếu có profile chi tiết) */}
                      {prof && !isUsageEmpty(prof) && (
                        <div className="space-y-1.5">
                          <span className="font-semibold text-foreground text-[11px] block">
                            Thông số kỹ thuật áp dụng:
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                            {prof.dose_amount && (
                              <div className="p-2 rounded-lg bg-muted/40 border border-border/60">
                                <span className="text-muted-foreground block text-[10px]">Liều pha:</span>
                                <strong className="text-foreground">{prof.dose_amount} {prof.dose_unit || ''}</strong>
                              </div>
                            )}
                            {prof.water_liters && (
                              <div className="p-2 rounded-lg bg-muted/40 border border-border/60">
                                <span className="text-muted-foreground block text-[10px]">Lượng nước:</span>
                                <strong className="text-foreground">{prof.water_liters} lít / bình</strong>
                              </div>
                            )}
                            {prof.dose_per_area && (
                              <div className="p-2 rounded-lg bg-muted/40 border border-border/60 col-span-2 sm:col-span-1">
                                <span className="text-muted-foreground block text-[10px]">Liều theo diện tích:</span>
                                <strong className="text-foreground">
                                  {prof.dose_per_area.min && prof.dose_per_area.max && prof.dose_per_area.min !== prof.dose_per_area.max
                                    ? `${prof.dose_per_area.min}–${prof.dose_per_area.max}`
                                    : prof.dose_per_area.min || prof.dose_per_area.max}{' '}
                                  {prof.dose_per_area.unit || ''}
                                </strong>
                              </div>
                            )}
                            {prof.method && (
                              <div className="p-2 rounded-lg bg-muted/40 border border-border/60 col-span-2">
                                <span className="text-muted-foreground block text-[10px]">Cách dùng:</span>
                                <strong className="text-foreground">{prof.method}</strong>
                              </div>
                            )}
                            {prof.interval_days && (
                              <div className="p-2 rounded-lg bg-muted/40 border border-border/60">
                                <span className="text-muted-foreground block text-[10px]">Cách nhau:</span>
                                <strong className="text-foreground">
                                  {typeof prof.interval_days === 'object'
                                    ? `${prof.interval_days.min || ''}–${prof.interval_days.max || ''} ngày`
                                    : `${prof.interval_days} ngày`}
                                </strong>
                              </div>
                            )}
                            {prof.time_of_day && prof.time_of_day.length > 0 && (
                              <div className="p-2 rounded-lg bg-muted/40 border border-border/60">
                                <span className="text-muted-foreground block text-[10px]">Thời điểm:</span>
                                <strong className="text-foreground">{prof.time_of_day.join(', ')}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Lưu ý an toàn nếu có */}
                      {prof?.safety_note && (
                        <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 text-[11px] text-muted-foreground leading-relaxed">
                          <strong className="text-foreground font-semibold">Lưu ý an toàn: </strong>
                          {prof.safety_note}
                        </div>
                      )}

                      {/* Link nguồn tài liệu */}
                      {rule?.source_url && (
                        <div className="pt-1 text-[11px] text-muted-foreground flex items-center gap-1">
                          <span>Nguồn tài liệu:</span>
                          <a
                            href={safeHref(rule.source_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5 truncate max-w-[280px]"
                          >
                            <span>{rule.source_url}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* TRƯỜNG HỢP B: CHƯA CÓ LIỀU LƯỢNG RIÊNG */
                    <div className="space-y-3.5">
                      {/* Cảnh báo an toàn, khách quan */}
                      <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/60 space-y-1.5">
                        <div className="font-semibold text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Chưa có quy tắc liều riêng cho bệnh này</span>
                        </div>
                        <p className="text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                          Sản phẩm thuộc nhóm phòng ngừa / điều trị theo danh mục của nhà sản xuất, nhưng <strong>chưa được thiết lập phác đồ liều lượng riêng</strong> cho bệnh {selectedPopupDisease.disease_name}.
                        </p>
                        <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 font-medium pt-0.5">
                          👉 Nông dân vui lòng đọc kỹ hướng dẫn sử dụng trên nhãn bao bì hoặc tham khảo ý kiến kỹ sư BVTV trước khi áp dụng.
                        </p>
                      </div>

                      {/* Hướng dẫn sử dụng chung của bao bì (trích xuất ngắn gọn, không nhồi nhét mô tả) */}
                      {fallbackUsage && (
                        <div className="space-y-1.5">
                          <span className="font-semibold text-foreground text-xs block">
                            Hướng dẫn sử dụng chung từ nhãn bao bì (Tham khảo):
                          </span>
                          <div className="p-3 bg-muted/30 rounded-xl border border-border/60 text-xs text-foreground leading-relaxed whitespace-pre-line font-medium">
                            {fallbackUsage}
                          </div>
                        </div>
                      )}

                      {/* Nếu là Admin: cung cấp lối tắt cấu hình ngay */}
                      {user?.role === 'ADMIN' && (
                        <div className="pt-1">
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="w-full text-xs border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100/50 gap-1.5 justify-center"
                          >
                            <Link to="/admin/inventory">
                              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                              <span>⚙️ Quản trị viên: Gắn gợi ý &amp; thiết lập liều riêng tại Kho</span>
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <DialogFooter className="p-4 border-t border-border/60 bg-muted/10 flex items-center justify-between sm:justify-between gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPopupDisease(null)}
                    className="text-xs"
                  >
                    Đóng
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 font-semibold"
                  >
                    <Link to={`/handbook/${encodeURIComponent(selectedPopupDisease.class_code)}`}>
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Xem phác đồ trong Sổ tay</span>
                    </Link>
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* DIALOG XEM ẢNH PHÓNG TO */}
      <Dialog open={isZoomOpen} onOpenChange={setIsZoomOpen}>
        <DialogContent className="max-w-2xl p-4 bg-background border border-border">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-sm font-semibold">{product.name}</DialogTitle>
          </DialogHeader>
          <div className="w-full max-h-[70vh] flex items-center justify-center overflow-hidden bg-white dark:bg-muted/10 rounded-xl p-2">
            {imgSrc && (
              <img
                src={imgSrc}
                alt={product.name}
                className="max-h-[65vh] max-w-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductDetailPage;
