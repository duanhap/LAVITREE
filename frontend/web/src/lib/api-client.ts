import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

/**
 * Key lưu JWT Token trong localStorage
 */
export const TOKEN_STORAGE_KEY = 'lavitree_token';

/**
 * Tạo instance Axios dùng chung toàn bộ ứng dụng Lavitree
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

/**
 * Request Interceptor: Tự động gắn Bearer Token nếu có trong localStorage
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Bỏ qua lỗi truy cập localStorage (ví dụ trong môi trường bị chặn cookie/storage)
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Ánh xạ mã lỗi HTTP sang thông điệp tiếng Việt thân thiện theo SSOT docs/architecture/ui-ux.md mục 7
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string; detail?: string; error?: string }>;
    const status = axiosError.response?.status;
    const responseData = axiosError.response?.data;

    // Ưu tiên thông báo chi tiết từ backend nếu có dạng chuỗi dễ hiểu
    const serverMessage = responseData?.detail || responseData?.message || responseData?.error;

    if (status === 400) {
      return serverMessage || 'Ảnh vượt 10MB hoặc không đúng định dạng (jpg, png, webp).';
    }
    if (status === 401) {
      return 'Phiên đăng nhập đã hết hạn.';
    }
    if (status === 403) {
      return 'Bạn không có quyền truy cập trang này.';
    }
    if (status === 404) {
      return serverMessage || 'Không tìm thấy dữ liệu yêu cầu.';
    }
    if (status === 422) {
      return serverMessage || 'Ảnh bị lỗi, không đọc được. Vui lòng chụp lại.';
    }
    if (status === 429) {
      return 'Bạn thao tác quá nhanh / đã hết lượt hỏi hôm nay. Thử lại sau ít phút.';
    }
    if (status && status >= 500) {
      return 'Hệ thống đang bận hoặc mất kết nối. Vui lòng thử lại sau.';
    }
    if (!axiosError.response) {
      return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra đường truyền.';
    }
    return serverMessage || 'Đã có lỗi xảy ra. Vui lòng thử lại.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Hệ thống đang bận hoặc mất kết nối.';
}

/**
 * Response Interceptor: Ghi nhận lỗi và chuyển tiếp
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Không hiện alert trực tiếp tại đây, để caller xử lý bằng toast/ErrorState
    return Promise.reject(error);
  }
);

export default apiClient;
