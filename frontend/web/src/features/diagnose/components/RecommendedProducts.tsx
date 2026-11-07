import React, { useState } from 'react';
import type { ProductItem } from '../types';
import { Package, ChevronDown, ChevronUp, AlertCircle, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatVND } from '@/lib/format';

interface RecommendedProductsProps {
  products: ProductItem[];
  isUncertain: boolean;
}

export const RecommendedProducts: React.FC<RecommendedProductsProps> = ({
  products,
  isUncertain,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(!isUncertain);

  // Nếu danh sách rỗng (ví dụ cây khỏe mạnh ___healthy), ẩn hoàn toàn khối theo screens.md mục 4
  if (!products || products.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Package className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">
          Vật tư & Thuốc BVTV Đặc trị Gợi ý
        </h3>
        <span className="ml-auto text-xs text-muted-foreground font-medium">
          {products.length} sản phẩm hợp quy
        </span>
      </div>

      {/* Trường hợp Chưa chắc chắn (isUncertain = true): Thu gọn sau dòng cảnh báo */}
      {isUncertain && !isExpanded ? (
        <div className="rounded-xl border border-status-uncertain/30 bg-status-uncertain-bg/40 p-4 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-status-uncertain text-sm font-medium">
            <AlertCircle className="h-4 w-4" />
            <span>Chỉ tham khảo sau khi chuyên gia xác nhận bệnh</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Độ tin cậy của mô hình chưa đạt ngưỡng tối ưu. Để tránh lạm dụng thuốc BVTV, bạn nên tham khảo kỹ trước khi áp dụng.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(true)}
            className="text-xs font-medium border-border"
          >
            <span>Xem danh mục vật tư ({products.length})</span>
            <ChevronDown className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {isUncertain && (
            <div className="flex items-center justify-between rounded-lg bg-status-uncertain-bg/40 px-3 py-2 text-xs text-status-uncertain border border-status-uncertain/20">
              <span className="flex items-center gap-1.5 font-medium">
                <AlertCircle className="h-3.5 w-3.5" />
                Lưu ý: Chỉ sử dụng thuốc khi chuyên gia BVTV đã xác nhận chẩn đoán.
              </span>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="text-xs font-medium underline hover:text-foreground"
              >
                Thu gọn
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products.map((p) => (
              <div
                key={p.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-card p-3.5 shadow-xs hover:border-primary/40 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm text-foreground line-clamp-1">
                      {p.name}
                    </h4>
                    <span className="shrink-0 text-xs font-bold text-primary tabular-nums">
                      {formatVND(p.price)}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2">
                    <span className="font-medium text-foreground">Hoạt chất: </span>
                    {p.active_ingredient}
                  </p>

                  {p.dosage_instruction && (
                    <div className="rounded-md bg-secondary/50 p-2 text-xs text-muted-foreground line-clamp-2">
                      <span className="font-medium text-foreground">Liều dùng: </span>
                      {p.dosage_instruction}
                    </div>
                  )}
                </div>

                <div className="pt-3 mt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Quy cách: {p.unit || 'Gói/Chai'}</span>
                  <span className="inline-flex items-center gap-1 text-primary font-medium text-xs">
                    <ShoppingCart className="h-3 w-3" /> Gợi ý mua
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendedProducts;
