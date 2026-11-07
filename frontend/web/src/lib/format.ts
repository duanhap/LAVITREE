/**
 * Các hàm tiện ích định dạng dữ liệu theo chuẩn Việt Nam (vi-VN)
 * SSOT: docs/architecture/ui-ux.md mục 3
 */

/**
 * Định dạng tiền tệ VND: ví dụ 65000 -> "65.000 ₫"
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

export const formatVND = formatCurrency;

/**
 * Định dạng ngày giờ: ví dụ "31/10/2026 14:30"
 */
export function formatDate(
  dateInput: string | number | Date | null | undefined,
  includeTime = true
): string {
  if (!dateInput) return '—';
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '—';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  if (!includeTime) {
    return `${day}/${month}/${year}`;
  }

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Định dạng phần trăm: ví dụ 0.946 -> "94,6%" hoặc 94.6 -> "94,6%"
 * Nếu value <= 1 thì coi như tỉ lệ thập phân (nhân 100), ngược lại coi như đã là %
 */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null || isNaN(value)) return '0%';
  const normalized = value <= 1 && value > 0 ? value * 100 : value;
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(normalized) + '%';
}
