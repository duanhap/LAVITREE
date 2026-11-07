import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient, { TOKEN_STORAGE_KEY } from '@/lib/api-client';

export type UserRole = 'ADMIN' | 'FARMER';

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: UserRole;
  createdAt?: string;
}

interface AuthResponseData {
  token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    full_name: string;
    phone?: string | null;
    role: string;
    created_at?: string;
  };
}

interface AuthContextType {
  user: CurrentUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<CurrentUser>;
  register: (payload: { email: string; password: string; fullName: string; phone?: string }) => Promise<CurrentUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'lavitree_user';

/**
 * Giải mã base64url sang chuỗi UTF-8 chuẩn xác, hỗ trợ đầy đủ ký tự tiếng Việt có dấu (BUG-14)
 */
export function decodeBase64UrlUtf8(base64Url: string): string {
  try {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const binStr = atob(base64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch (err) {
    console.error('Lỗi giải mã base64url UTF-8:', err);
    return '';
  }
}

/**
 * Phân tích JWT payload và trả về thông tin User nếu hợp lệ & còn hạn
 */
export function parseJwtPayload(token: string): CurrentUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payloadJson = decodeBase64UrlUtf8(parts[1]);
    if (!payloadJson) return null;

    const payload = JSON.parse(payloadJson);

    // Kiểm tra thời hạn hết hạn token
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }

    const rawRole: string =
      payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
      payload.role ||
      'FARMER';
    const role: UserRole = rawRole.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'FARMER';

    const email: string =
      payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
      payload.email ||
      '';

    const id: string =
      payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ||
      payload.sub ||
      '';

    const fullName: string =
      payload.full_name ||
      payload.name ||
      payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
      payload.unique_name ||
      email.split('@')[0];

    return {
      id,
      email,
      fullName,
      role,
    };
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<CurrentUser | null>(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      const storedUser = localStorage.getItem(USER_STORAGE_KEY);
      if (storedToken) {
        const parsed = parseJwtPayload(storedToken);
        if (parsed) {
          if (storedUser) {
            try {
              const u = JSON.parse(storedUser);
              return { ...parsed, ...u };
            } catch {
              // ignore
            }
          }
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      // ignore
    }
    setToken(null);
    setUser(null);
  }, []);

  // Lắng nghe sự kiện 401 Unauthorized từ api-client
  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [logout]);

  // Kiểm tra token khi khởi tạo
  useEffect(() => {
    if (token) {
      const parsed = parseJwtPayload(token);
      if (!parsed) {
        logout();
      } else {
        setUser(parsed);
      }
    } else {
      setUser(null);
    }
    setIsLoading(false);
  }, [token, logout]);

  const login = async (email: string, password: string): Promise<CurrentUser> => {
    const res = await apiClient.post<AuthResponseData>('/auth/login', { email, password });
    const authData = res.data;
    const newToken = authData.token;
    const role: UserRole = authData.user.role.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'FARMER';

    const currentUser: CurrentUser = {
      id: authData.user.id,
      email: authData.user.email,
      fullName: authData.user.full_name,
      phone: authData.user.phone,
      role,
      createdAt: authData.user.created_at,
    };

    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
    } catch {
      // ignore
    }

    setToken(newToken);
    setUser(currentUser);
    return currentUser;
  };

  const register = async (payload: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }): Promise<CurrentUser> => {
    const res = await apiClient.post<AuthResponseData>('/auth/register', {
      email: payload.email,
      password: payload.password,
      full_name: payload.fullName,
      phone: payload.phone || null,
    });
    const authData = res.data;
    const newToken = authData.token;
    const role: UserRole = authData.user.role.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'FARMER';

    const currentUser: CurrentUser = {
      id: authData.user.id,
      email: authData.user.email,
      fullName: authData.user.full_name,
      phone: authData.user.phone,
      role,
      createdAt: authData.user.created_at,
    };

    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser));
    } catch {
      // ignore
    }

    setToken(newToken);
    setUser(currentUser);
    return currentUser;
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider');
  }
  return context;
};
