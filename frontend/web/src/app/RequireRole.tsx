import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export type UserRole = 'Admin' | 'Expert' | 'Farmer';

export interface CurrentUser {
  id: string;
  email: string;
  fullName?: string;
  role: UserRole;
}

/**
 * Hook lấy thông tin người dùng hiện tại từ localStorage hoặc token payload.
 * Trả về null (Guest) khi chưa có thông tin đăng nhập hợp lệ.
 */
export function useCurrentUser(): { user: CurrentUser | null; isAuthenticated: boolean } {
  try {
    const rawUser = localStorage.getItem('lavitree_user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser) as CurrentUser;
      return { user: parsed, isAuthenticated: true };
    }

    const token = localStorage.getItem('lavitree_token');
    if (token) {
      // Decode JWT payload (không cần thư viện jwt-decode)
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(payloadJson);
        const role =
          payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
          payload.role ||
          'Farmer';
        const email =
          payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
          payload.email ||
          '';
        const sub =
          payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ||
          payload.sub ||
          '';

        return {
          user: {
            id: sub,
            email,
            role: role as UserRole,
          },
          isAuthenticated: true,
        };
      }
    }
  } catch {
    // Trường hợp token hỏng hoặc localStorage bị lỗi
  }

  return { user: null, isAuthenticated: false };
}

export interface RequireRoleProps {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
}

/**
 * Guard kiểm tra quyền truy cập theo vai trò người dùng (docs/spec/screens.md mục 1)
 */
export const RequireRole: React.FC<RequireRoleProps> = ({ allowedRoles, children }) => {
  const { user, isAuthenticated } = useCurrentUser();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
};

export default RequireRole;
