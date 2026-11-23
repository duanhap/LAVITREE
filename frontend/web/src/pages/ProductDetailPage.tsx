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
import { safeHref } from '@/lib/utils';
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
      <Tabs defaultValue="instructions" className="w-full space-y-6 pt-6 border-t border-border/80">
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
                            className={`rounded-2xl border transition-all shadow-2xs ${
                              isHighlight
                                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 md:col-span-2'
                                : 'border-border bg-card'
                            }`}
                          >
                            <CardHeader className="pb-2 pt-4 px-4 sm:px-5">
                              <CardTitle
                                className={`text-sm sm:text-base font-bold flex items-center gap-2 ${
                                  isHighlight
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

        {/* TAB 2: CÂY TRỒNG & BỆNH ĐẶC TRỊ (DẠNG GRID + POPUP MODAL THEO YÊU CẦU) */}
        <TabsContent value="diseases" className="space-y-4 pt-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Bấm vào từng thẻ bệnh để xem tóm tắt triệu chứng và hướng dẫn điều trị chi tiết:
            </p>
          </div>

          {product.diseases && product.diseases.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {product.diseases.map((d, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedPopupDisease(d)}
                  className="p-4 sm:p-5 rounded-2xl border border-border bg-card hover:border-primary hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] font-bold text-primary uppercase">
                        {d.plant_name}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 group-hover:text-primary transition-colors">
                        <Info className="w-3.5 h-3.5" />
                        <span>Xem chi tiết</span>
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-foreground group-hover:text-primary transition-colors pt-1">
                      {d.disease_name}
                    </h4>

                    <p className="text-xs text-muted-foreground line-clamp-2">
                      Được kiểm chứng hiệu quả cao khi điều trị bằng {product.name}. Bấm để mở tóm tắt triệu chứng.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-primary">
                    <span>Mở phác đồ & Sổ tay</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              ))}
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

        {/* TAB 3: CĂN CỨ KHOA HỌC & TRÍCH DẪN KHUYẾN NÔNG */}
        {evidenceList.length > 0 && (
          <TabsContent value="evidence" className="space-y-4 pt-1">
            <p className="text-xs text-muted-foreground">
              Sản phẩm được trích dẫn trực tiếp từ các phác đồ điều trị và tài liệu khuyến nông đã qua kiểm duyệt:
            </p>
            <div className="space-y-3">
              {evidenceList.map((item, idx) => (
                <div key={idx} className="p-4 rounded-2xl border border-border bg-card space-y-2 text-xs shadow-2xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-semibold text-foreground text-sm">
                      {item.source_title || 'Tài liệu hướng dẫn kỹ thuật BVTV'}
                    </span>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      {item.organization || 'Khuyến nông'}
                    </Badge>
                  </div>

                  <p className="text-muted-foreground leading-relaxed italic bg-secondary/30 p-3 rounded-xl border border-border/40">
                    "{item.evidence_text}"
                  </p>

                  {item.source_url && (
                    <div className="text-right pt-1">
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
                      >
                        <span>Xem tài liệu gốc</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
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
        <DialogContent className="max-w-md p-6 bg-background border border-border rounded-2xl">
          <DialogHeader className="space-y-1.5 pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-bold text-primary uppercase">
                {selectedPopupDisease?.plant_name}
              </Badge>
            </div>
            <DialogTitle className="text-lg font-bold text-foreground pt-1">
              {selectedPopupDisease?.disease_name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3 text-sm">
            <div className="p-3.5 bg-secondary/30 rounded-xl border border-border space-y-1.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Hiệu quả điều trị với {product.name}:
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sản phẩm {product.name} ({product.medicine_type}) được kiểm chứng hiệu lực cao trong việc khống chế và tiêu diệt tác nhân gây {selectedPopupDisease?.disease_name?.toLowerCase()} trên cây {selectedPopupDisease?.plant_name?.toLowerCase()}.
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <span className="font-semibold text-foreground">Liều lượng khuyến cáo cho bệnh này:</span>
              <div className="p-2.5 bg-muted/40 rounded-lg border border-border/50 text-muted-foreground leading-relaxed">
                {product.dosage_instruction || 'Pha theo tỷ lệ khuyến cáo của nhà sản xuất, phun ướt đều tán lá khi vết bệnh chớm xuất hiện.'}
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedPopupDisease(null)}
              className="text-xs"
            >
              Đóng
            </Button>
            {selectedPopupDisease && (
              <Button
                asChild
                size="sm"
                className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5"
              >
                <Link to={`/handbook/${encodeURIComponent(selectedPopupDisease.class_code)}`}>
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Xem đầy đủ trong Sổ tay</span>
                </Link>
              </Button>
            )}
          </DialogFooter>
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
