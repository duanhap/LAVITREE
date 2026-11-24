import { getProduct } from '@/features/products/api';
import type { OrderItemDto } from './types';

/**
 * "Mua lại": thêm các sản phẩm của một đơn cũ vào giỏ hàng.
 * Luôn lấy lại thông tin sản phẩm mới nhất từ Core (giá, cấp phép, tồn kho), không dùng giá cũ trong đơn.
 * Định dạng giỏ giữ nguyên như StorePage / ProductDetailPage: [{ product, quantity }] tại khóa lavitree_cart_{userId}.
 */
export interface ReorderResult {
  added: { name: string; quantity: number; reduced: boolean }[];
  skipped: { name: string; reason: string }[];
}

export function getCartStorageKey(userId?: string | null): string {
  return userId ? `lavitree_cart_${userId}` : 'lavitree_cart_guest';
}

export async function reorderItems(items: OrderItemDto[], cartStorageKey: string): Promise<ReorderResult> {
  const result: ReorderResult = { added: [], skipped: [] };

  const fetched = await Promise.allSettled(items.map(i => getProduct(i.product_id)));

  let cart: any[] = [];
  try {
    const saved = localStorage.getItem(cartStorageKey);
    cart = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(cart)) cart = [];
  } catch {
    cart = [];
  }

  items.forEach((item, idx) => {
    const res = fetched[idx];
    if (res.status !== 'fulfilled') {
      result.skipped.push({ name: item.product_name, reason: 'không còn bán' });
      return;
    }
    const product = res.value;
    if (!product.is_allowed || product.availability === 'NOT_SOLD') {
      result.skipped.push({ name: item.product_name, reason: 'không còn bán' });
      return;
    }
    const stock = Number(product.stock_quantity) || 0;
    const existingIndex = cart.findIndex((c: any) => c.product?.id === product.id);
    const inCart = existingIndex >= 0 ? Number(cart[existingIndex].quantity) || 0 : 0;
    const room = stock - inCart;
    if (room <= 0) {
      result.skipped.push({ name: product.name, reason: stock <= 0 ? 'tạm hết hàng' : 'giỏ đã đủ số lượng tồn kho' });
      return;
    }
    const qty = Math.min(item.quantity, room);
    if (existingIndex >= 0) {
      cart[existingIndex] = { ...cart[existingIndex], product, quantity: inCart + qty };
    } else {
      cart.push({ product, quantity: qty });
    }
    result.added.push({ name: product.name, quantity: qty, reduced: qty < item.quantity });
  });

  if (result.added.length > 0) {
    localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    window.dispatchEvent(new Event('storage'));
  }
  return result;
}
