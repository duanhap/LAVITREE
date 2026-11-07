import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type UserRole, type CurrentUser } from '@/context/AuthContext';

export type { UserRole, CurrentUser };

/**
 * Hook tương thích ngược lấy thông tin người dùng từ AuthContext
 */
export function useCurrentUser(): { user: CurrentUser | null; isAuthenticated: boolean } {
  const { user, isAuthenticated } = useAuth();
  return { user, isAuthenticated };
}

/**
 * Kiểm tra và chuẩn hóa đường dẫn nội bộ để ngăn ngừa Open Redirect Attack (BUG-16)
 * Chỉ chấp nhận đường dẫn bắt đầu bằng một dấu '/', không có '//' hay '\'
 */
export function sanitizeInternalRedirect(path: string | null | undefined, fallback: string = '/'): string {
  if (!path) return fallback;
  const decoded = decodeURIComponent(path).trim();
  if (decoded.startsWith('/') && !decoded.startsWith('//') && !decoded.includes('\\')) {
    return decoded;
  }
  return fallback;
}

export interface RequireRoleProps {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
}

/**
 * Guard kiểm tra quyền truy cập theo vai trò người dùng (docs/spec/screens.md mục 1)
 */
export const RequireRole: React.FC<RequireRoleProps> = ({ allowedRoles, children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    const fullPath = location.pathname + location.search;
    return <Navigate to={`/login?next=${encodeURIComponent(fullPath)}`} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = allowedRoles.some(
      (r) => r.toUpperCase() === user.role.toUpperCase()
    );
    if (!hasRole) {
      return <Navigate to="/403" replace />;
    }
  }

  return <>{children}</>;
};

export default RequireRole;
