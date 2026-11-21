import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Link lấy từ CSDL (nguồn bài, ảnh) chỉ được mở nếu là http/https.
 * Chặn `javascript:`, `data:`... để bấm link không chạy mã lạ (BUG-32).
 */
export function safeHref(url?: string | null): string | undefined {
  const value = url?.trim();
  return value && /^https?:\/\//i.test(value) ? value : undefined;
}
