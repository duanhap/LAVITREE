const PROBE_ORIGIN = 'https://lavitree.invalid';

// Ký tự điều khiển, khoảng trắng, dấu "\\" và dạng đã mã hóa của chúng đều có thể bị trình duyệt
// diễn giải lại thành URL ngoài, nên từ chối thay vì làm sạch rồi dùng tiếp.
const UNSAFE_CHARS = /[\u0000-\u0020\u007f-\u009f\\]/;
const UNSAFE_ENCODED = /%(?:[01][0-9a-f]|20|5c|7f)/i;

/**
 * Chỉ trả về đường dẫn cùng origin (BUG-16), nếu không thì trả fallback.
 * `path` lấy từ URLSearchParams nên đã được giải mã một lần; không decode thêm để tránh giải mã hai lớp.
 */
export function sanitizeInternalRedirect(path: string | null | undefined, fallback = '/'): string {
  if (!path || !path.startsWith('/')) return fallback;
  // Query được phép chứa %20; chỉ phần path mới có thể bị diễn giải thành host khác.
  const pathOnly = path.split(/[?#]/, 1)[0];
  if (UNSAFE_CHARS.test(path) || UNSAFE_ENCODED.test(pathOnly)) return fallback;

  try {
    const url = new URL(path, PROBE_ORIGIN);
    // Đường dẫn như "/.//evil.com" chỉ lộ thành "//evil.com" sau khi chuẩn hóa.
    if (url.origin !== PROBE_ORIGIN || url.pathname.startsWith('//')) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
