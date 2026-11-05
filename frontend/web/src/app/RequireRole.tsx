import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export type UserRole = 'ADMIN' | 'FARMER' | 'Admin' | 'Farmer';

export interface CurrentUser {
  id: string;
  email: string;
  fullName?: string;
  role: 'ADMIN' | 'FARMER';
}

/**
 * Hook lấy thông tin người dùng hiện tại từ localStorage hoặc token payload.
 * Trả về null (Guest) khi chưa có thông tin đăng nhập hợp lệ hoặc token đã hết hạn.
 */
export function useCurrentUser(): { user: CurrentUser | null; isAuthenticated: boolean } {
  try {
    const rawUser = localStorage.getItem('lavitree_user');
    const token = localStorage.getItem('lavitree_token');

    if (token) {
      // Decode JWT payload (không cần thư viện jwt-decode bên ngoài)
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(payloadJson);

        // Kiểm tra thời hạn hiệu lực của Token (claim 'exp')
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          // Token đã hết hạn: tự động dọn dẹp storage
          localStorage.removeItem('lavitree_token');
          localStorage.removeItem('lavitree_user');
          return { user: null, isAuthenticated: false };
        }

        const rawRole: string =
          payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
          payload.role ||
          'FARMER';
        const normalizedRole: 'ADMIN' | 'FARMER' =
          rawRole.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'FARMER';

        const email =
          payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
          payload.email ||
          '';
        const sub =
          payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ||
          payload.sub ||
          '';

        let fullName = payload.name;
        if (rawUser) {
          try {
            const parsed = JSON.parse(rawUser);
            if (parsed.fullName) fullName = parsed.fullName;
          } catch {
            // bỏ qua lỗi parse rawUser
          }
        }

        return {
          user: {
            id: sub,
            email,
            fullName,
            role: normalizedRole,
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
