import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './AppShell';
import { AdminShell } from './AdminShell';
import { AuthLayout } from './AuthLayout';
import { RequireRole } from './RequireRole';
import { NotFoundPage } from './NotFoundPage';
import { ForbiddenPage } from './ForbiddenPage';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { EmptyState } from '@/components/common/EmptyState';

// Core Eager Pages (Khám lá, Sổ tay, Auth để phản hồi tức thì)
import { DiagnosePage } from '@/pages/DiagnosePage';
import { HandbookPage } from '@/pages/HandbookPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';

// Lazy Loaded Pages (BUG-27: Tối ưu bundle size cho mạng đồng ruộng & Admin portal)
const HistoryPage = React.lazy(() => import('@/pages/HistoryPage'));
const AdminDashboard = React.lazy(() => import('@/pages/AdminDashboard'));
const AdminOverviewPage = React.lazy(() => import('@/pages/AdminOverviewPage'));
const KnowledgeCollectorPage = React.lazy(() => import('@/pages/KnowledgeCollectorPage'));
const StorePage = React.lazy(() => import('@/pages/StorePage'));
const OrdersPage = React.lazy(() => import('@/pages/OrdersPage'));
const ChatPage = React.lazy(() => import('@/pages/ChatPage'));

// Styleguide (Chỉ nạp và hiển thị trong môi trường DEV)
import { StyleguidePage } from '@/dev/StyleguidePage';

// Component giữ chỗ cho các màn hình Sprint 2 (A03, A04) & Sprint 3
const ComingSoonPage: React.FC<{ title: string; description: string; actionText?: string; actionHref?: string }> = ({
  title,
  description,
  actionText = 'Về trang Khám lá',
  actionHref = '/',
}) => (
  <div className="py-12">
    <EmptyState
      title={title}
      description={description}
      actionText={actionText}
      actionHref={actionHref}
    />
  </div>
);

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* ================= AUTH (W-05, W-06): nền video toàn màn hình ================= */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* ================= USER ROUTES (APPSHELL) ================= */}
      <Route element={<AppShell />}>
        {/* W-01: Khám lá (Trang chủ & alias /diagnose) */}
        <Route path="/" element={<DiagnosePage />} />
        <Route path="/diagnose" element={<Navigate to="/" replace />} />

        {/* W-02 & W-03: Sổ tay bệnh học & Chi tiết bệnh */}
        <Route path="/handbook" element={<HandbookPage />} />
        <Route path="/handbook/:classCode" element={<HandbookPage />} />

        {/* W-07 & W-08: Lịch sử khám bệnh cá nhân & Chi tiết */}
        <Route
          path="/history"
          element={
            <RequireRole allowedRoles={['FARMER', 'ADMIN']}>
              <Suspense fallback={<PageSkeleton variant="cards" />}>
                <HistoryPage />
              </Suspense>
            </RequireRole>
          }
        />
        <Route
          path="/history/:id"
          element={
            <RequireRole allowedRoles={['FARMER', 'ADMIN']}>
              <Suspense fallback={<PageSkeleton variant="detail" />}>
                <HistoryPage />
              </Suspense>
            </RequireRole>
          }
        />
        <Route path="/account" element={<Navigate to="/history" replace />} />

        {/* W-04: Trợ lý AI Lavi (Sprint 2 - TASK-A04) */}
        <Route
          path="/chat"
          element={
            <Suspense fallback={<PageSkeleton variant="cards" />}>
              <ChatPage />
            </Suspense>
          }
        />

        {/* W-09: Cửa hàng vật tư (Sprint 2 - TASK-A03) */}
        <Route
          path="/store"
          element={
            <Suspense fallback={<PageSkeleton variant="cards" />}>
              <StorePage />
            </Suspense>
          }
        />

        {/* W-11: Đơn hàng của tôi (Sprint 2 - TASK-A03) */}
        <Route
          path="/orders"
          element={
            <RequireRole allowedRoles={['FARMER', 'ADMIN']}>
              <Suspense fallback={<PageSkeleton variant="list" />}>
                <OrdersPage />
              </Suspense>
            </RequireRole>
          }
        />

        {/* Điều hướng đường dẫn cũ về Admin */}
        <Route path="/knowledge" element={<Navigate to="/admin/knowledge" replace />} />

        {/* Route /dev/styleguide CHỈ ĐĂNG KÝ KHI import.meta.env.DEV === true */}
        {import.meta.env.DEV && (
          <Route path="/dev/styleguide" element={<StyleguidePage />} />
        )}
      </Route>

      {/* ================= ADMIN ROUTES (ADMINSHELL) ================= */}
      <Route
        element={
          <RequireRole allowedRoles={['ADMIN']}>
            <AdminShell />
          </RequireRole>
        }
      >
        <Route
          path="/admin"
          element={
            <Suspense fallback={<PageSkeleton variant="dashboard" />}>
              <AdminOverviewPage />
            </Suspense>
          }
        />
        <Route
          path="/admin/ingest"
          element={
            <Suspense fallback={<PageSkeleton variant="list" />}>
              <AdminDashboard defaultTab="ingestion" />
            </Suspense>
          }
        />
        <Route
          path="/admin/knowledge"
          element={
            <Suspense fallback={<PageSkeleton variant="list" />}>
              <AdminDashboard defaultTab="curation" />
            </Suspense>
          }
        />
        <Route
          path="/admin/knowledge-collector"
          element={
            <Suspense fallback={<PageSkeleton variant="list" />}>
              <KnowledgeCollectorPage />
            </Suspense>
          }
        />
        <Route
          path="/admin/escalations"
          element={
            <Suspense fallback={<PageSkeleton variant="list" />}>
              <AdminDashboard defaultTab="escalations" />
            </Suspense>
          }
        />
        <Route
          path="/admin/inventory"
          element={
            <Suspense fallback={<PageSkeleton variant="list" />}>
              <AdminDashboard defaultTab="inventory" />
            </Suspense>
          }
        />
        <Route
          path="/admin/orders"
          element={
            <ComingSoonPage
              title="Quản lý Đơn hàng Toàn sàn"
              description="Xem và duyệt đơn hàng đặt mua vật tư từ bà con nông dân."
              actionText="Về Tổng quan Admin"
              actionHref="/admin"
            />
          }
        />
        <Route
          path="/admin/traces"
          element={
            <ComingSoonPage
              title="Giám sát Agent Traces"
              description="Lịch sử thực thi các bước suy luận Tool Calling và Guardrail của AI Agent."
              actionText="Về Tổng quan Admin"
              actionHref="/admin"
            />
          }
        />
        <Route
          path="/admin/users"
          element={
            <ComingSoonPage
              title="Quản lý Người dùng & Phân quyền"
              description="Quản lý danh sách tài khoản Admin và Farmer."
              actionText="Về Tổng quan Admin"
              actionHref="/admin"
            />
          }
        />
      </Route>

      {/* ================= SYSTEM ERROR ROUTES ================= */}
      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default AppRouter;
