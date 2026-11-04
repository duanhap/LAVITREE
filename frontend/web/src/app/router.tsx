import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './AppShell';
import { AdminShell } from './AdminShell';
import { RequireRole } from './RequireRole';
import { NotFoundPage } from './NotFoundPage';
import { ForbiddenPage } from './ForbiddenPage';

// Existing Prototype Pages (Giữ nguyên luồng nghiệp vụ)
import { DiagnosePage } from '@/pages/DiagnosePage';
import { HandbookPage } from '@/pages/HandbookPage';
import { KnowledgeCollectorPage } from '@/pages/KnowledgeCollectorPage';
import { AdminDashboard } from '@/pages/AdminDashboard';

// Styleguide (Chỉ nạp và hiển thị trong môi trường DEV)
import { StyleguidePage } from '@/dev/StyleguidePage';
import { EmptyState } from '@/components/common/EmptyState';

// Component giữ chỗ cho các màn hình Sprint 2 (A02, A03, A04)
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
      {/* ================= USER ROUTES (APPSHELL) ================= */}
      <Route element={<AppShell />}>
        {/* W-01: Khám lá (Trang chủ) */}
        <Route path="/" element={<DiagnosePage />} />

        {/* W-02: Sổ tay 38 bệnh */}
        <Route path="/handbook" element={<HandbookPage />} />

        {/* Luồng thu thập tri thức cũ - giữ đường dẫn không làm gãy công việc */}
        <Route path="/knowledge" element={<KnowledgeCollectorPage />} />

        {/* W-04: Trợ lý AI (Sprint 2 - TASK-A03) */}
        <Route
          path="/chat"
          element={
            <ComingSoonPage
              title="Trợ lý Cây trồng Lavi"
              description="Tính năng Trợ lý AI hỏi đáp trực tiếp (Streaming SSE & Reasoning Steps) đang được hoàn thiện trong Sprint 2."
            />
          }
        />

        {/* W-09: Cửa hàng vật tư */}
        <Route
          path="/store"
          element={
            <ComingSoonPage
              title="Cửa hàng Vật tư Nông nghiệp"
              description="Danh mục thuốc bảo vệ thực vật sinh học & phân bón hữu cơ có nguồn gốc rõ ràng đang được tích hợp."
            />
          }
        />

        {/* W-05 / Tài khoản / Lịch sử */}
        <Route
          path="/account"
          element={
            <ComingSoonPage
              title="Quản lý Tài khoản"
              description="Thông tin cá nhân, cài đặt thông báo và lịch sử khám bệnh của bạn."
            />
          }
        />
        <Route
          path="/history"
          element={
            <ComingSoonPage
              title="Lịch sử Khám bệnh"
              description="Danh sách các ca chẩn đoán lá cây trước đây của bạn kèm kết quả phân tích AI."
            />
          }
        />
        <Route
          path="/orders"
          element={
            <ComingSoonPage
              title="Đơn hàng của bạn"
              description="Theo dõi tình trạng đơn đặt hàng vật tư nông nghiệp."
            />
          }
        />
        <Route
          path="/login"
          element={
            <ComingSoonPage
              title="Đăng nhập Lavitree"
              description="Đăng nhập để lưu lịch sử khám bệnh và nhận tư vấn chuyên sâu từ chuyên gia bảo vệ thực vật."
            />
          }
        />

        {/* Route /dev/styleguide CHỈ ĐĂNG KÝ KHI import.meta.env.DEV === true */}
        {import.meta.env.DEV && (
          <Route path="/dev/styleguide" element={<StyleguidePage />} />
        )}
      </Route>

      {/* ================= ADMIN ROUTES (ADMINSHELL) ================= */}
      <Route element={<AdminShell />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/knowledge" element={<KnowledgeCollectorPage />} />
        <Route
          path="/admin/escalations"
          element={
            <ComingSoonPage
              title="Thẩm định Ca Chuyên gia"
              description="Khu vực dành cho chuyên gia BVTV thẩm định các ca bệnh khó hoặc độ tin cậy thấp."
              actionText="Về Tổng quan Admin"
              actionHref="/admin"
            />
          }
        />
        <Route
          path="/admin/inventory"
          element={
            <ComingSoonPage
              title="Kho Vật tư & Thuốc BVTV"
              description="Quản lý tồn kho thuốc, hoạt chất và thời gian cách ly (PHI)."
              actionText="Về Tổng quan Admin"
              actionHref="/admin"
            />
          }
        />
        <Route
          path="/admin/orders"
          element={
            <ComingSoonPage
              title="Quản lý Đơn hàng"
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
              description="Quản lý danh sách tài khoản Admin, Expert và Farmer."
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
