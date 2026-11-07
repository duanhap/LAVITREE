import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

/**
 * Key lưu JWT Token trong localStorage
 */
export const TOKEN_STORAGE_KEY = 'lavitree_token';

/**
 * Tạo instance Axios dùng chung toàn bộ ứng dụng Lavitree
 * LƯU Ý: Không gán cứng 'Content-Type': 'application/json' ở default headers
 * để Axios tự động xử lý chuẩn multipart/form-data khi gửi FormData (upload ảnh).
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
});

/**
 * Request Interceptor:
 * 1. Tự động gắn Bearer Token nếu có trong localStorage.
 * 2. Nếu payload là FormData, để trình duyệt tự sinh boundary multipart.
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Khi gửi FormData (upload file ảnh chẩn đoán), xóa Content-Type để Axios/trình duyệt tự gắn multipart boundary
      if (config.data instanceof FormData && config.headers) {
        delete config.headers['Content-Type'];
      }
    } catch {
      // Bỏ qua lỗi truy cập localStorage (ví dụ trong môi trường bị chặn cookie/storage)
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response Interceptor: Tự động dọn dẹp storage khi token hết hạn (401)
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Nếu không phải đang ở trang login và không phải là request đăng nhập
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      const isRegisterRequest = error.config?.url?.includes('/auth/register');
      if (!isLoginRequest && !isRegisterRequest) {
        try {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          localStorage.removeItem('lavitree_user');
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        } catch {
          // ignore
        }
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Trích xuất lỗi validation chi tiết theo từng trường từ response 400 của ASP.NET Core
 */
export function getValidationErrors(error: unknown): Record<string, string[]> {
  if (axios.isAxiosError(error) && error.response?.status === 400) {
    const data = error.response.data as { errors?: Record<string, string[]> };
    if (data?.errors && typeof data.errors === 'object') {
      return data.errors;
    }
  }
  return {};
}

/**
 * Ánh xạ mã lỗi HTTP sang thông điệp tiếng Việt thân thiện theo ngữ cảnh
 * Ưu tiên hiển thị thông điệp chi tiết trả về từ máy chủ (serverMessage).
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string; detail?: string; error?: string }>;
    const status = axiosError.response?.status;
    const responseData = axiosError.response?.data;

    // Ưu tiên thông báo chi tiết từ backend nếu có dạng chuỗi dễ hiểu
    const serverMessage = responseData?.detail || responseData?.message || responseData?.error;

    if (status === 400) {
      return serverMessage || 'Dữ liệu gửi lên không hợp lệ hoặc vượt dung lượng cho phép (10MB).';
    }
    if (status === 401) {
      return serverMessage || 'Phiên đăng nhập đã hết hạn hoặc thông tin đăng nhập không chính xác.';
    }
    if (status === 403) {
      return serverMessage || 'Bạn không có quyền thực hiện thao tác hoặc truy cập trang này.';
    }
    if (status === 404) {
      return serverMessage || 'Không tìm thấy dữ liệu hoặc trang yêu cầu.';
    }
    if (status === 422) {
      return serverMessage || 'Ảnh bị lỗi hoặc không thể đọc được. Vui lòng chụp lại.';
    }
    if (status === 429) {
      return 'Bạn thao tác quá nhanh hoặc đã hết lượt yêu cầu. Vui lòng thử lại sau ít phút.';
    }
    if (status && status >= 500) {
      return serverMessage || 'Hệ thống máy chủ đang bận hoặc gặp sự cố. Vui lòng thử lại sau.';
    }
    if (!axiosError.response) {
      return 'Không thể kết nối đến máy chủ Core API. Vui lòng kiểm tra lại đường truyền mạng.';
    }
    return serverMessage || 'Đã có lỗi xảy ra. Vui lòng thử lại.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Hệ thống đang bận hoặc mất kết nối.';
}

export default apiClient;
