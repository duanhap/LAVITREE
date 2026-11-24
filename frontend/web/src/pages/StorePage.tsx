import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  ShoppingBag, Search, Filter, CheckCircle2,
  AlertTriangle, Plus, Minus, Trash2, ArrowRight, Truck,
  Clock, Package, Leaf, FlaskConical, X, ShoppingCart, ZoomIn
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

// BUG-41: CSP chặn eval, nên tắt bước zod tự thử `new Function("")` (nếu không sẽ sinh cảnh báo CSP).
// Kết quả kiểm tra form không đổi, zod chỉ bỏ phần tối ưu tốc độ.
z.config({ jitless: true });
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn, safeHref } from '@/lib/utils';
import laviConfusedImg from '@/assets/brand/lavi-confused-retake.webp';
import { Textarea } from '@/components/ui/textarea';

interface ProductItem {
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
  image_url: string;
  target_diseases: string[];
  availability?: string; // IN_STOCK | OUT_OF_STOCK | NOT_SOLD
  info_source_url?: string;
}

interface CartItem {
  product: ProductItem;
  quantity: number;
}

// Validation schema theo chuẩn BUG-55
const checkoutSchema = z.object({
  receiver_name: z.string().min(2, 'Họ và tên người nhận tối thiểu 2 ký tự.'),
  // Khớp RegularExpression của CreateOrderDto (OrderDtos.cs): di động Việt Nam 03/05/07/08/09
  phone_number: z.string().regex(/^0[35789]\d{8}$/, 'Số di động Việt Nam gồm 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.'),
  shipping_address: z.string().min(5, 'Địa chỉ giao hàng tối thiểu 5 ký tự (Thôn/Xã, Huyện, Tỉnh).'),
  notes: z.string().max(300, 'Ghi chú tối đa 300 ký tự.').optional(),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

// BUG-37: ảnh sản phẩm. Không có ảnh, đường dẫn không phải http(s) hoặc tải lỗi (file không tồn tại)
// thì hiện icon theo loại thuốc, giữ nguyên chiều cao để các thẻ thẳng hàng.
const ProductThumb: React.FC<{
  product: ProductItem;
  isBio: boolean;
  isFarmingSupply: boolean;
  onPreview?: (src: string, name: string) => void;
}> = ({ product, isBio, isFarmingSupply, onPreview }) => {
  const src = safeHref(product.image_url);
  const [failed, setFailed] = useState(false);
  const Icon = isFarmingSupply ? Package : isBio ? Leaf : FlaskConical;
  const canPreview = !!src && !failed && !!onPreview;

  return (
    <div className="h-48 sm:h-52 w-full bg-white dark:bg-muted/20 border-b border-border flex items-center justify-center overflow-hidden relative group select-none">
      <Link
        to={`/store/${product.id}`}
        className="absolute inset-0 flex items-center justify-center p-2 z-0"
        title="Bấm để xem chi tiết sản phẩm"
      >
        {src && !failed ? (
          <img
            src={src}
            alt={product.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
            onError={() => setFailed(true)}
          />
        ) : (
          <Icon className="w-12 h-12 text-muted-foreground/40" aria-label="Chưa có ảnh sản phẩm" />
        )}
      </Link>

      {canPreview && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPreview(src!, product.name);
          }}
          className="absolute bottom-2 right-2 z-10 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
          title="Phóng to ảnh"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export const StorePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialDisease = searchParams.get('disease') || '';
  const { user } = useAuth();
  const cartStorageKey = user?.id ? `lavitree_cart_${user.id}` : 'lavitree_cart_guest';

  // State preview ảnh phóng to
  const [previewImage, setPreviewImage] = useState<{ src: string; name: string } | null>(null);

  // State danh mục
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bộ lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Sinh học' | 'Hóa học' | 'Vật tư canh tác'>('ALL');
  const [phiFilter, setPhiFilter] = useState(false); // PHI <= 3 ngày (An toàn cận thu hoạch)
  const [rainFilter, setRainFilter] = useState(false);
  const [onlySellingFilter, setOnlySellingFilter] = useState(false); // Chỉ hàng đang bán
  const [selectedDisease, setSelectedDisease] = useState(initialDisease);

  // Giỏ hàng (Cart) theo người dùng
  const loadCart = (key: string): CartItem[] => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  };
  const [cart, setCart] = useState<CartItem[]>(() => loadCart(cartStorageKey));
  // Khóa giỏ đang hiển thị; khi đăng nhập/đăng xuất thì nạp giỏ của tài khoản mới thay vì ghi đè giỏ cũ sang
  const loadedCartKeyRef = useRef(cartStorageKey);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Đặt hàng (Checkout)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<{ order_id: string; total_amount: number } | null>(null);

  // Form đặt hàng
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      receiver_name: '',
      phone_number: '',
      shipping_address: '',
      notes: '',
    },
  });

  // Lưu giỏ hàng vào localStorage theo người dùng
  useEffect(() => {
    if (loadedCartKeyRef.current !== cartStorageKey) {
      loadedCartKeyRef.current = cartStorageKey;
      setCart(loadCart(cartStorageKey));
      return;
    }
    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart, cartStorageKey]);

  // Mở giỏ hàng tự động nếu URL có ?openCart=true
  useEffect(() => {
    if (searchParams.get('openCart') === 'true') {
      setIsCartOpen(true);
    }
  }, [searchParams]);

  // Tải danh mục thuốc
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient.get('/medicines/search', {
          params: {
            allowedOnly: true,
            diseaseCode: selectedDisease || undefined,
          },
        });
        setProducts(res.data.items || []);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [selectedDisease]);

  // Thao tác giỏ hàng
  const addToCart = (product: ProductItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock_quantity) }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: Math.min(newQty, item.product.stock_quantity) } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  // Lọc sản phẩm hiển thị trên client
  const filteredProducts = products.filter((p) => {
    if (!p.is_allowed) return false;

    if (onlySellingFilter && (p.availability?.toUpperCase() === 'NOT_SOLD' || p.price <= 0 || p.stock_quantity <= 0)) {
      return false;
    }

    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      const matchName = p.name.toLowerCase().includes(query);
      const matchIngredient = p.active_ingredient?.toLowerCase().includes(query) ?? false;
      if (!matchName && !matchIngredient) return false;
    }

    if (typeFilter !== 'ALL' && p.medicine_type !== typeFilter) {
      return false;
    }

    if (phiFilter && (p.phi_days == null || p.phi_days > 3)) {
      return false;
    }

    if (rainFilter && !p.rain_resistant) {
      return false;
    }

    return true;
  });

  // Xử lý gửi đơn hàng COD
  const onCheckoutSubmit = async (data: CheckoutFormData) => {
    if (cart.length === 0) return;

    try {
      setOrderSubmitting(true);
      const payload = {
        receiver_name: data.receiver_name,
        phone_number: data.phone_number,
        shipping_address: data.shipping_address,
        payment_method: 'COD',
        notes: data.notes,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
      };

      const res = await apiClient.post('/orders', payload);
      setCreatedOrder({
        order_id: res.data.order_id,
        total_amount: res.data.total_amount,
      });
      setCart([]);
      reset();
      setIsCheckoutOpen(false);
      toast.success('Đặt hàng thành công! Đơn hàng đang được chuẩn bị đóng gói.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setOrderSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-4 md:py-5 max-w-7xl animate-fade-in space-y-3.5">
      {/* Hero Header tinh gọn */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/70">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Cửa Hàng Vật Tư Nông Nghiệp</span>
            </h1>
            <Badge variant="outline" className="bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300/80 text-[10px] font-semibold py-0 hidden sm:inline-flex">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Đối chiếu TT 75/2025
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
            Thuốc BVTV sinh học, chế phẩm vi sinh & phân bón an toàn · Hỗ trợ thanh toán COD
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8.5 text-xs relative gap-1.5 bg-card border-border hover:bg-muted shadow-2xs"
            onClick={() => setIsCartOpen(true)}
          >
            <ShoppingCart className="w-3.5 h-3.5 text-primary" />
            <span>Giỏ hàng</span>
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-emerald-700 text-white text-[10px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </Button>

          <Button variant="default" size="sm" asChild className="h-8.5 text-xs gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs">
            <Link to="/orders">
              <Package className="w-3.5 h-3.5" />
              <span>Đơn hàng của tôi</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter Toolbar tinh gọn */}
      <div className="bg-card rounded-xl border border-border p-3 mb-4 shadow-2xs space-y-2.5">
        <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm theo tên thuốc hoặc hoạt chất (ví dụ: Ridomil, Mancozeb, Trichoderma)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8.5 h-9 text-xs bg-background"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-[11px]"
              >
                Xóa
              </button>
            )}
          </div>

          {/* Nhóm nút lọc loại thuốc */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border shrink-0 overflow-x-auto">
            <Button
              type="button"
              variant={typeFilter === 'ALL' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter('ALL')}
              className={`h-7 px-2.5 text-xs ${typeFilter === 'ALL' ? 'bg-emerald-700 text-white shadow-2xs' : 'text-muted-foreground'}`}
            >
              Tất cả
            </Button>
            <Button
              type="button"
              variant={typeFilter === 'Sinh học' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter('Sinh học')}
              className={`h-7 px-2.5 text-xs ${typeFilter === 'Sinh học' ? 'bg-emerald-700 text-white shadow-2xs' : 'text-muted-foreground'}`}
            >
              <Leaf className="w-3 h-3 mr-1" />
              Sinh học
            </Button>
            <Button
              type="button"
              variant={typeFilter === 'Hóa học' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter('Hóa học')}
              className={`h-7 px-2.5 text-xs ${typeFilter === 'Hóa học' ? 'bg-emerald-700 text-white shadow-2xs' : 'text-muted-foreground'}`}
            >
              <FlaskConical className="w-3 h-3 mr-1" />
              Hóa học
            </Button>
            <Button
              type="button"
              variant={typeFilter === 'Vật tư canh tác' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter('Vật tư canh tác')}
              className={`h-7 px-2.5 text-xs ${typeFilter === 'Vật tư canh tác' ? 'bg-emerald-700 text-white shadow-2xs' : 'text-muted-foreground'}`}
            >
              <Package className="w-3 h-3 mr-1" />
              Vật tư canh tác
            </Button>
          </div>
        </div>

        {/* Bộ lọc đặc thù: Cận thu hoạch (PHI <= 3) & Chống mưa & Chỉ hàng đang bán */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/50 text-[11px]">
          <span className="text-muted-foreground font-semibold flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-emerald-600" />
            Lọc an toàn:
          </span>

          <Button
            type="button"
            size="sm"
            variant={onlySellingFilter ? 'default' : 'outline'}
            onClick={() => setOnlySellingFilter(!onlySellingFilter)}
            className={`h-6.5 px-2.5 text-[11px] rounded-full ${onlySellingFilter
              ? 'bg-emerald-700 text-white hover:bg-emerald-800 border-emerald-700'
              : 'border-dashed border-border bg-background hover:bg-muted text-foreground'
              }`}
          >
            Chỉ hàng đang bán
          </Button>

          <Button
            type="button"
            size="sm"
            variant={phiFilter ? 'default' : 'outline'}
            onClick={() => setPhiFilter(!phiFilter)}
            className={`h-6.5 px-2.5 text-[11px] rounded-full ${phiFilter
              ? 'bg-emerald-700 text-white hover:bg-emerald-800 border-emerald-700'
              : 'border-dashed border-border bg-background hover:bg-muted text-foreground'
              }`}
          >
            <Clock className="w-2.5 h-2.5 mr-1" />
            PHI ≤ 3 ngày (An toàn cận thu hoạch)
          </Button>

          <Button
            type="button"
            size="sm"
            variant={rainFilter ? 'default' : 'outline'}
            onClick={() => setRainFilter(!rainFilter)}
            className={`h-6.5 px-2.5 text-[11px] rounded-full ${rainFilter
              ? 'bg-cyan-700 text-white hover:bg-cyan-800 border-cyan-700'
              : 'border-dashed border-border bg-background hover:bg-muted text-foreground'
              }`}
          >
            Chống rửa trôi khi mưa ẩm
          </Button>

          {selectedDisease && (
            <Badge
              variant="secondary"
              className="h-7 px-2.5 bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1 cursor-pointer"
              onClick={() => setSelectedDisease('')}
            >
              <span>Trị bệnh: {selectedDisease}</span>
              <X className="w-3 h-3 hover:text-destructive" />
            </Badge>
          )}

          {(searchTerm || typeFilter !== 'ALL' || phiFilter || rainFilter || selectedDisease) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setTypeFilter('ALL');
                setPhiFilter(false);
                setRainFilter(false);
                setSelectedDisease('');
              }}
              className="h-7 text-xs text-muted-foreground hover:text-destructive ml-auto"
            >
              Đặt lại bộ lọc
            </Button>
          )}
        </div>
      </div>

      {/* Grid danh sách sản phẩm */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-80 rounded-xl bg-card border border-border p-4 animate-pulse flex flex-col justify-between">
              <div className="h-36 bg-muted rounded-lg mb-3" />
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
              <div className="h-9 bg-muted rounded mt-4" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <p className="font-semibold">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Thử lại
          </Button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-12 text-center bg-card border border-border rounded-xl">
          <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground/60 mb-3" />
          <h3 className="text-lg font-bold text-foreground">Không tìm thấy sản phẩm phù hợp</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Không có thuốc BVTV nào khớp với bộ lọc hiện tại. Thử bỏ chọn bộ lọc PHI hoặc tìm kiếm với từ khóa khác.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setSearchTerm('');
              setTypeFilter('ALL');
              setPhiFilter(false);
              setRainFilter(false);
              setSelectedDisease('');
            }}
          >
            Xem tất cả sản phẩm
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((p) => {
            const isBio = p.medicine_type === 'Sinh học';
            const isFarmingSupply = p.medicine_type === 'Vật tư canh tác';
            const isNotSold = p.availability === 'NOT_SOLD';
            const isSafePhi = p.phi_days != null && p.phi_days <= 3;

            return (
              <Card key={p.id} className="flex flex-col overflow-hidden hover:shadow-md transition-shadow border-border bg-card">
                <ProductThumb
                  product={p}
                  isBio={isBio}
                  isFarmingSupply={isFarmingSupply}
                  onPreview={(src, name) => setPreviewImage({ src, name })}
                />
                <CardHeader className="p-4 pb-2 space-y-2">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <Badge
                      variant="outline"
                      className={
                        isFarmingSupply
                          ? 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300'
                          : isBio
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-blue-50 text-blue-800 border-blue-300'
                      }
                    >
                      {isFarmingSupply ? (
                        <Package className="w-3 h-3 mr-1" />
                      ) : isBio ? (
                        <Leaf className="w-3 h-3 mr-1" />
                      ) : (
                        <FlaskConical className="w-3 h-3 mr-1" />
                      )}
                      {p.medicine_type}
                    </Badge>

                    {isNotSold ? (
                      <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] font-semibold border-border">
                        Chỉ tham khảo
                      </Badge>
                    ) : isFarmingSupply ? (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
                        Không cần PHI
                      </Badge>
                    ) : isSafePhi ? (
                      <Badge className="bg-emerald-700 text-white hover:bg-emerald-700 text-[11px] font-semibold">
                        PHI {p.phi_days} ngày (Cận hái)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground border-border">
                        PHI {p.phi_days ?? '—'} ngày
                      </Badge>
                    )}
                  </div>

                  <Link to={`/store/${p.id}`} className="block group/link">
                    <CardTitle className="text-base font-bold text-foreground line-clamp-1 group-hover/link:text-emerald-700 transition-colors">
                      {p.name}
                    </CardTitle>
                  </Link>

                  {p.active_ingredient ? (
                    <p className="text-xs text-muted-foreground font-medium line-clamp-1">
                      Hoạt chất: <span className="text-foreground">{p.active_ingredient}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Quy cách: Vật tư bảo vệ thực vật
                    </p>
                  )}
                </CardHeader>

                <CardContent className="p-4 pt-1 flex-1 flex flex-col justify-end space-y-3">
                  <div className="flex items-center justify-between pt-2 border-t border-border/60">
                    <div>
                      <div className="text-lg font-extrabold text-emerald-800">
                        {p.price > 0 ? `${p.price.toLocaleString('vi-VN')} đ` : 'Giá tham khảo'}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {isNotSold ? (
                          <span className="text-muted-foreground italic">Cửa hàng không bán</span>
                        ) : p.stock_quantity > 0 ? (
                          <span className="text-emerald-700 font-medium">Còn {p.stock_quantity} sản phẩm</span>
                        ) : (
                          <span className="text-destructive font-medium">Tạm hết hàng</span>
                        )}
                      </div>
                    </div>

                    {p.rain_resistant && (
                      <Badge variant="outline" className="bg-cyan-50 text-cyan-800 border-cyan-200 text-[10px]">
                        Kháng mưa
                      </Badge>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="p-4 pt-0">
                  {isNotSold ? (
                    <div className="w-full space-y-1.5">
                      <Button
                        asChild
                        variant="outline"
                        className="w-full h-9 text-xs font-semibold border-border hover:bg-muted"
                      >
                        <Link to={`/store/${p.id}`}>Xem thông tin kỹ thuật</Link>
                      </Button>
                      <p className="text-[10px] text-muted-foreground italic leading-tight text-center">
                        Cửa hàng không bán trực tiếp. Bấm xem chi tiết để tra cứu liều lượng.
                      </p>
                    </div>
                  ) : (
                    <div className="w-full flex items-center gap-2">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-9 px-3 text-xs border-border hover:bg-muted font-medium shrink-0"
                      >
                        <Link to={`/store/${p.id}`}>Chi tiết</Link>
                      </Button>
                      <Button
                        className="flex-1 h-9 gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs disabled:opacity-50"
                        disabled={p.stock_quantity <= 0}
                        onClick={() => addToCart(p)}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm giỏ</span>
                      </Button>
                    </div>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Lightbox xem ảnh sản phẩm đầy đủ */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-xl sm:max-w-2xl p-4 sm:p-6 bg-card border-border">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground line-clamp-2">
              {previewImage?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ảnh bao bì và nhãn thuốc bảo vệ thực vật chính hãng
            </DialogDescription>
          </DialogHeader>

          <div className="w-full flex items-center justify-center bg-white dark:bg-muted/30 rounded-xl p-3 sm:p-6 border border-border/60 overflow-hidden min-h-[300px] max-h-[70vh]">
            {previewImage && (
              <img
                src={previewImage.src}
                alt={previewImage.name}
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg drop-shadow-sm select-none"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cart Drawer (Sheet) */}
      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="p-5 pr-16 border-b border-border">
            <SheetTitle className="text-lg font-bold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-700" />
              <span>Giỏ hàng Vật tư</span>
              <Badge variant="secondary" className="ml-auto">
                {totalItems} món
              </Badge>
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Vật tư nông nghiệp chính hãng, đóng gói an toàn và giao tận vườn.
            </SheetDescription>
          </SheetHeader>

          {/* Danh sách món trong giỏ */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground space-y-4">
                <div className="relative mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl scale-75" />
                  <img
                    src={laviConfusedImg}
                    alt="Giỏ hàng trống"
                    className="relative w-28 h-28 object-contain mx-auto drop-shadow-xs select-none"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Giỏ hàng của bạn đang trống</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Chưa có chế phẩm hay thuốc BVTV nào được chọn.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsCartOpen(false)} className="border-border text-xs">
                  Xem sản phẩm ngay
                </Button>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card shadow-2xs gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-foreground truncate">{item.product.name}</h4>
                    <p className="text-[11px] text-muted-foreground truncate">{item.product.active_ingredient}</p>
                    <div className="text-xs font-semibold text-emerald-800 mt-1">
                      {item.product.price.toLocaleString('vi-VN')} đ
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 bg-muted/60 p-1 rounded-md border border-border">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      aria-label="Giảm số lượng"
                      className="w-9 h-9 flex items-center justify-center rounded hover:bg-card text-foreground"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-7 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      aria-label="Tăng số lượng"
                      className="w-9 h-9 flex items-center justify-center rounded hover:bg-card text-foreground"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="w-10 h-10 flex items-center justify-center shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                    title="Xóa khỏi giỏ"
                    aria-label={`Xóa ${item.product.name} khỏi giỏ`}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Chân giỏ hàng & Thanh toán */}
          {cart.length > 0 && (
            <div className="p-4 border-t border-border bg-card space-y-3">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Tạm tính ({totalItems} món):</span>
                  <span>{totalAmount.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Phí giao hàng:</span>
                  <span className="text-emerald-700 font-semibold">Miễn phí (COD nông nghiệp)</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-foreground pt-2 border-t border-border">
                  <span>Tổng thanh toán:</span>
                  <span className="text-emerald-800">{totalAmount.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>

              <Button
                className="w-full gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-11"
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckoutOpen(true);
                }}
              >
                <span>Tiến hành đặt hàng COD</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Checkout Modal (Dialog) */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Truck className="w-5 h-5 text-emerald-700" />
              <span>Xác nhận Đặt hàng COD</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Thanh toán tiền mặt khi nhận hàng (COD). Bác vui lòng điền đúng địa chỉ vườn để bưu tá giao tận nơi.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onCheckoutSubmit)} className="space-y-4 py-2">
            <div>
              <Label htmlFor="receiver_name" className="text-xs font-semibold">
                Họ và tên người nhận *
              </Label>
              <Input
                id="receiver_name"
                placeholder="Ví dụ: Nguyễn Văn An"
                {...register('receiver_name')}
                className="mt-1"
              />
              {errors.receiver_name && (
                <p className="text-xs text-destructive mt-1">{errors.receiver_name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="phone_number" className="text-xs font-semibold">
                Số điện thoại người nhận *
              </Label>
              <Input
                id="phone_number"
                placeholder="Ví dụ: 0912345678"
                {...register('phone_number')}
                className="mt-1"
              />
              {errors.phone_number && (
                <p className="text-xs text-destructive mt-1">{errors.phone_number.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="shipping_address" className="text-xs font-semibold">
                Địa chỉ giao hàng (Thôn/Xóm, Xã, Huyện, Tỉnh) *
              </Label>
              <Input
                id="shipping_address"
                placeholder="Ví dụ: Thôn 2, Xã Nghĩa Bình, Huyện Nghĩa Hưng, Nam Định"
                {...register('shipping_address')}
                className="mt-1"
              />
              {errors.shipping_address && (
                <p className="text-xs text-destructive mt-1">{errors.shipping_address.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="notes" className="text-xs font-semibold">
                Ghi chú giao hàng (Tùy chọn)
              </Label>
              <Textarea
                id="notes"
                placeholder="Ví dụ: Giao vào buổi sáng, gọi trước khi đến 15 phút..."
                rows={2}
                {...register('notes')}
                className="mt-1"
              />
            </div>

            {/* Tóm tắt thanh toán */}
            <div className="bg-muted/40 p-3 rounded-lg border border-border space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hình thức thanh toán:</span>
                <span className="font-semibold text-emerald-800">COD (Thu tiền mặt khi nhận)</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-border/60">
                <span>Tổng tiền thanh toán:</span>
                <span className="text-emerald-800">{totalAmount.toLocaleString('vi-VN')} đ</span>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setIsCheckoutOpen(false)}>
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                disabled={orderSubmitting}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
              >
                {orderSubmitting ? 'Đang gửi đơn...' : 'Xác nhận Đặt hàng'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Order Confirmation Success Dialog */}
      <Dialog open={!!createdOrder} onOpenChange={() => setCreatedOrder(null)}>
        <DialogContent className="sm:max-w-md text-center py-6">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-700">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">
            Đặt hàng thành công!
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Mã đơn hàng của bạn là: <span className="font-mono font-bold text-foreground">{createdOrder?.order_id}</span>
          </DialogDescription>

          <div className="bg-muted/40 p-4 rounded-xl border border-border text-xs text-left space-y-2 my-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tổng tiền thu COD:</span>
              <span className="font-bold text-emerald-800 text-sm">
                {createdOrder?.total_amount.toLocaleString('vi-VN')} đ
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Thời gian giao dự kiến:</span>
              <span className="font-medium text-foreground">2 – 3 ngày làm việc</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trạng thái:</span>
              <Badge className="bg-amber-100 text-amber-900 border-amber-300">
                Chờ xác nhận đóng gói
              </Badge>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
            <Button variant="outline" className="w-full" onClick={() => setCreatedOrder(null)}>
              Tiếp tục mua hàng
            </Button>
            <Button
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              asChild
            >
              <Link to="/orders">Xem lịch sử đơn hàng</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StorePage;
