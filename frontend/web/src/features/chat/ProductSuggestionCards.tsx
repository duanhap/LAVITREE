import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ExternalLink, ShieldAlert, CloudRain, Clock, ChevronRight } from 'lucide-react';
import { SuggestedProduct } from './types';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';

interface ProductSuggestionCardsProps {
  products: SuggestedProduct[];
}

interface MedicineDetails {
  id: number;
  price?: number;
  image_url?: string;
  name?: string;
  is_allowed?: boolean;
}

export const ProductSuggestionCards: React.FC<ProductSuggestionCardsProps> = ({ products }) => {
  const navigate = useNavigate();
  const [medicinesMap, setMedicinesMap] = useState<Record<number, MedicineDetails>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!products || products.length === 0) return;

    let isMounted = true;
    setLoading(true);

    apiClient
      .get<{ items: MedicineDetails[] }>('/medicines/search', { params: { allowedOnly: true } })
      .then((res) => {
        if (!isMounted) return;
        const map: Record<number, MedicineDetails> = {};
        (res.data?.items || []).forEach((m) => {
          map[m.id] = m;
        });
        setMedicinesMap(map);
      })
      .catch((err) => {
        console.warn('Could not load prices for suggested products:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [products]);

  if (!products || products.length === 0) return null;

  return (
    <div className="mt-3.5 pt-3 border-t border-border/80 space-y-2.5">
      <div className="flex items-center justify-between text-xs font-semibold text-emerald-900 dark:text-emerald-300">
        <div className="flex items-center gap-1.5">
          <Package className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          <span>Sản phẩm điều trị gợi ý từ Cửa hàng (Đã kiểm tra an toàn):</span>
        </div>
        <span className="text-[11px] text-muted-foreground font-normal">
          Bấm để xem chi tiết & hướng dẫn dùng
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {products.map((p) => {
          const detail = medicinesMap[p.product_id];
          const price = detail?.price;
          const displayImage = p.image_url || detail?.image_url;
          const isOutOfStock = p.availability === 'OUT_OF_STOCK';

          return (
            <div
              key={p.product_id}
              role="link"
              tabIndex={0}
              aria-label={`Xem chi tiết ${p.product_name}`}
              onClick={() => navigate(`/store/${p.product_id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/store/${p.product_id}`);
                }
              }}
              className="group flex flex-col justify-between p-3 rounded-xl bg-card border border-border hover:border-emerald-500/60 hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
              title="Bấm để mở trang chi tiết sản phẩm"
            >
              <div className="flex gap-3 items-start">
                {/* Ảnh sản phẩm */}
                <div className="w-14 h-14 rounded-lg bg-muted/60 border border-border shrink-0 overflow-hidden flex items-center justify-center">
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt={p.product_name}
                      className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-muted-foreground/60" />
                  )}
                </div>

                {/* Thông tin chính */}
                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="text-xs font-bold text-foreground line-clamp-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                    {p.product_name}
                  </h4>
                  {p.active_ingredient && (
                    <p className="text-[11px] text-muted-foreground truncate" title={p.active_ingredient}>
                      Hoạt chất: <span className="font-medium text-foreground/80">{p.active_ingredient}</span>
                    </p>
                  )}

                  {/* Giá sản phẩm lấy từ Core */}
                  <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {price !== undefined ? formatCurrency(price) : loading ? 'Đang cập nhật giá...' : 'Xem giá trong Cửa hàng'}
                  </div>
                </div>
              </div>

              {/* Badges an toàn & cách ly */}
              <div className="mt-2.5 pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-1 text-[10px]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {p.phi_days !== undefined && p.phi_days !== null ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      <Clock className="w-2.5 h-2.5" />
                      <span>Cách ly: {p.phi_days} ngày</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                      Chưa rõ cách ly
                    </span>
                  )}

                  {p.rain_resistant && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                      <CloudRain className="w-2.5 h-2.5" />
                      <span>Chống mưa</span>
                    </span>
                  )}

                  {isOutOfStock && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-200">
                      Tạm hết hàng
                    </span>
                  )}
                </div>

                <span className="inline-flex items-center text-primary group-hover:translate-x-0.5 transition-transform font-medium">
                  Chi tiết <ChevronRight className="w-3 h-3 ml-0.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
