import React from 'react';
import { Database, FileText, ShoppingBag, BarChart3, Users, AlertCircle } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  return (
    <div className="container" style={{ padding: '40px 20px' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#1b5e20', marginBottom: '8px' }}>
          Cổng Quản Trị Hệ Thống Lavitree (Admin Portal)
        </h1>
        <p style={{ color: '#64748b' }}>
          Quản lý cơ sở tri thức 38 lớp bệnh cây, phác đồ điều trị, sản phẩm thuốc BVTV và giám sát dịch bệnh.
        </p>
      </header>

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Database size={24} color="#1b5e20" />
            <span style={{ fontSize: '13px', color: '#64748b' }}>Lớp bệnh mô hình</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#1b5e20' }}>38 / 38</div>
          <span style={{ fontSize: '12px', color: '#16a34a' }}>Đã nạp 100% phác đồ</span>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <BarChart3 size={24} color="#2563eb" />
            <span style={{ fontSize: '13px', color: '#64748b' }}>Tổng lượt khám bệnh</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#1e293b' }}>1,248</div>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Độ chính xác TB: 94.2%</span>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <ShoppingBag size={24} color="#d97706" />
            <span style={{ fontSize: '13px', color: '#64748b' }}>Danh mục thuốc BVTV</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#1e293b' }}>42</div>
          <span style={{ fontSize: '12px', color: '#16a34a' }}>Tuân thủ chuẩn PHI</span>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <AlertCircle size={24} color="#dc2626" />
            <span style={{ fontSize: '13px', color: '#64748b' }}>Ca bất định cần duyệt</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#dc2626' }}>5 ca</div>
          <span style={{ fontSize: '12px', color: '#dc2626' }}>Human-in-the-loop</span>
        </div>
      </div>

      {/* Admin Modules */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        <div className="card">
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: '#1b5e20' }}>
            1. Quản lý Cơ sở Tri thức &amp; Nguồn Khuyến nông
          </h3>
          <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
            Biên tập nội dung cẩm nang bệnh, nạp link tài liệu khuyến nông .gov/.edu và cập nhật các bước xử lý bệnh học.
          </p>
          <button className="btn btn-primary" style={{ fontSize: '13px' }}>
            Mở Cẩm Nang Biên Tập
          </button>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px', color: '#1b5e20' }}>
            2. Quản lý Kho Thuốc BVTV &amp; Đơn Hàng Mini Store
          </h3>
          <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
            Cập nhật tên hoạt chất, giá thành, đơn vị đóng gói và duyệt các đơn đặt mua thuốc điều trị theo mã bệnh.
          </p>
          <button className="btn btn-outline" style={{ fontSize: '13px' }}>
            Quản Lý Sản Phẩm
          </button>
        </div>
      </div>
    </div>
  );
};
