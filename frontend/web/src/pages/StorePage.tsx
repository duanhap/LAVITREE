import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  ShoppingBag, Search, Filter, ShieldCheck, CheckCircle2,
  AlertTriangle, Plus, Minus, Trash2, ArrowRight, Truck,
  Clock, Package, Leaf, FlaskConical, X, ShoppingCart
} from 'lucide-react';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ProductItem {
  id: number;
  name: string;
  active_ingredient: string;
  medicine_type: string;
  price: number;
  dosage_instruction: string;
  phi_days: number;
  is_allowed: boolean;
  rain_resistant: boolean;
  stock_quantity: number;
  image_url: string;
  target_diseases: string[];
}

interface CartItem {
  product: ProductItem;
  quantity: number;
}

// Validation schema theo chuẩn BUG-55
const checkoutSchema = z.object({
  receiver_name: z.string().min(2, 'Họ và tên người nhận tối thiểu 2 ký tự.'),
  phone_number: z.string().regex(/^0\d{9}$/, 'Số điện thoại gồm 10 chữ số bắt đầu bằng số 0.'),
  shipping_address: z.string().min(5, 'Địa chỉ giao hàng tối thiểu 5 ký tự (Thôn/Xã, Huyện, Tỉnh).'),
  notes: z.string().max(300, 'Ghi chú tối đa 300 ký tự.').optional(),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

export const StorePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialDisease = searchParams.get('disease') || '';

  // State danh mục
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bộ lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Sinh học' | 'Hóa học'>('ALL');
  const [phiFilter, setPhiFilter] = useState(false); // PHI <= 3 ngày (An toàn cận thu hoạch)
  const [rainFilter, setRainFilter] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState(initialDisease);

  // Giỏ hàng (Cart)
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('lavitree_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
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

  // Lưu giỏ hàng vào localStorage
  useEffect(() => {
    try {
      localStorage.setItem('lavitree_cart', JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

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

    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      const matchName = p.name.toLowerCase().includes(query);
      const matchIngredient = p.active_ingredient.toLowerCase().includes(query);
      if (!matchName && !matchIngredient) return false;
    }

    if (typeFilter !== 'ALL' && p.medicine_type !== typeFilter) {
      return false;
    }

    if (phiFilter && p.phi_days > 3) {
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
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setOrderSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl animate-fade-in">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold text-xs px-2.5 py-0.5">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              100% Cấp phép lưu hành &amp; Chuẩn PHI
            </Badge>
            <span className="text-xs text-muted-foreground">Theo Thông tư 75/2025/TT-BNNMT</span>
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight sm:text-4xl">
            Cửa hàng Vật tư Nông nghiệp Lavitree
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Cung cấp thuốc BVTV sinh học, chế phẩm đối kháng vi sinh và phân bón hữu cơ an toàn. Hỗ trợ giao hàng tận nơi thanh toán COD.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="relative gap-2 bg-card border-border hover:bg-muted"
            onClick={() => setIsCartOpen(true)}
          >
            <ShoppingCart className="w-4 h-4 text-primary" />
            <span>Giỏ hàng</span>
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-emerald-700 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </Button>

          <Button variant="default" asChild className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white">
            <Link to="/orders">
              <Package className="w-4 h-4" />
              <span>Đơn hàng của tôi</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-card rounded-xl border border-border p-4 mb-8 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm theo tên thuốc hoặc hoạt chất (ví dụ: Ridomil, Mancozeb, Trichoderma)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-background"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
              >
                Xóa
              </button>
            )}
          </div>

          {/* Nhóm nút lọc loại thuốc */}
          <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border shrink-0">
            <Button
              type="button"
              variant={typeFilter === 'ALL' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter('ALL')}
              className={typeFilter === 'ALL' ? 'bg-emerald-700 text-white shadow-2xs' : 'text-xs text-muted-foreground'}
            >
              Tất cả
            </Button>
            <Button
              type="button"
              variant={typeFilter === 'Sinh học' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter('Sinh học')}
              className={typeFilter === 'Sinh học' ? 'bg-emerald-700 text-white shadow-2xs' : 'text-xs text-muted-foreground'}
            >
              <Leaf className="w-3.5 h-3.5 mr-1" />
              Sinh học
            </Button>
            <Button
              type="button"
              variant={typeFilter === 'Hóa học' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTypeFilter('Hóa học')}
              className={typeFilter === 'Hóa học' ? 'bg-emerald-700 text-white shadow-2xs' : 'text-xs text-muted-foreground'}
            >
              <FlaskConical className="w-3.5 h-3.5 mr-1" />
              Hóa học
            </Button>
          </div>
        </div>

        {/* Bộ lọc đặc thù: Cận thu hoạch (PHI <= 3) & Chống mưa */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60 text-xs">
          <span className="text-muted-foreground font-medium flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Lọc an toàn:
          </span>

          <Button
            type="button"
            size="sm"
            variant={phiFilter ? 'default' : 'outline'}
            onClick={() => setPhiFilter(!phiFilter)}
            className={`h-7 px-2.5 text-xs rounded-full ${
              phiFilter
                ? 'bg-emerald-700 text-white hover:bg-emerald-800 border-emerald-700'
                : 'border-dashed border-border bg-background hover:bg-muted text-foreground'
            }`}
          >
            <Clock className="w-3 h-3 mr-1" />
            PHI ≤ 3 ngày (An toàn cận thu hoạch)
          </Button>

          <Button
            type="button"
            size="sm"
            variant={rainFilter ? 'default' : 'outline'}
            onClick={() => setRainFilter(!rainFilter)}
            className={`h-7 px-2.5 text-xs rounded-full ${
              rainFilter
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
            const isSafePhi = p.phi_days <= 3;

            return (
              <Card key={p.id} className="flex flex-col overflow-hidden hover:shadow-md transition-shadow border-border bg-card">
                <CardHeader className="p-4 pb-2 space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <Badge
                      variant="outline"
                      className={
                        isBio
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-blue-50 text-blue-800 border-blue-300'
                      }
                    >
                      {isBio ? <Leaf className="w-3 h-3 mr-1" /> : <FlaskConical className="w-3 h-3 mr-1" />}
                      {p.medicine_type}
                    </Badge>

                    {isSafePhi ? (
                      <Badge className="bg-emerald-700 text-white hover:bg-emerald-700 text-[11px] font-semibold">
                        PHI {p.phi_days} ngày (Cận hái)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground border-border">
                        PHI {p.phi_days} ngày
                      </Badge>
                    )}
                  </div>

                  <CardTitle className="text-base font-bold text-foreground line-clamp-1">
                    {p.name}
                  </CardTitle>

                  <p className="text-xs text-muted-foreground font-medium line-clamp-1">
                    Hoạt chất: <span className="text-foreground">{p.active_ingredient}</span>
                  </p>
                </CardHeader>

                <CardContent className="p-4 pt-1 flex-1 flex flex-col justify-between space-y-3">
                  <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/30 p-2 rounded-md border border-border/50">
                    {p.dosage_instruction}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-border/60">
                    <div>
                      <div className="text-lg font-extrabold text-emerald-800">
                        {p.price.toLocaleString('vi-VN')} đ
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {p.stock_quantity > 0 ? (
                          <span className="text-emerald-700 font-medium">Còn {p.stock_quantity} chai/gói</span>
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
                  <Button
                    className="w-full gap-2 bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-50"
                    disabled={p.stock_quantity <= 0}
                    onClick={() => addToCart(p)}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm vào giỏ</span>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Cart Drawer (Sheet) */}
      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="p-5 border-b border-border">
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
              <div className="text-center py-16 text-muted-foreground space-y-3">
                <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground/40" />
                <p className="text-sm">Giỏ hàng của bạn đang trống.</p>
                <Button variant="outline" size="sm" onClick={() => setIsCartOpen(false)}>
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
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-card text-foreground"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-card text-foreground"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-muted-foreground hover:text-destructive p-1 rounded"
                    title="Xóa khỏi giỏ"
                  >
                    <Trash2 className="w-4 h-4" />
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
