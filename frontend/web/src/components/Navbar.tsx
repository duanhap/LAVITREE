import React from 'react';
import { Link } from 'react-router-dom';
import { Leaf, Camera, BookOpen, ShieldCheck, LayoutDashboard } from 'lucide-react';

export const Navbar: React.FC = () => {
  return (
    <nav style={{
      background: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '70px'
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: '#1b5e20',
            color: '#fff',
            borderRadius: '10px',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Leaf size={24} />
          </div>
          <div>
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#1b5e20', letterSpacing: '-0.5px' }}>LAVITREE</span>
            <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Agri-Guard PTIT</span>
          </div>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#1b5e20' }}>
            <Camera size={18} /> Chẩn Đoán AI
          </Link>
          <Link to="/handbook" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500, color: '#475569' }}>
            <BookOpen size={18} /> Sổ Tay 38 Bệnh
          </Link>
          <Link to="/admin/knowledge" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#0369a1', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '6px 12px', borderRadius: '8px' }}>
            <ShieldCheck size={18} /> Thu Thập Tri Thức (KB)
          </Link>
          <Link to="/admin" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500, color: '#475569' }}>
            <LayoutDashboard size={18} /> Admin Quản Trị
          </Link>
        </div>
      </div>
    </nav>
  );
};
