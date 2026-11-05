import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import laviFullImg from '@/assets/brand/lavi-full-512.webp';

export const ForbiddenPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="relative mb-6">
        <img
          src={laviFullImg}
          alt="Lavi 403 - Giới hạn quyền truy cập"
          className="w-40 h-40 object-contain drop-shadow-md select-none grayscale-[30%]"
        />
        <span className="absolute -bottom-2 right-0 p-2 bg-status-uncertain-bg text-destructive rounded-full border border-destructive/20 shadow-xs">
          <ShieldAlert className="w-5 h-5" />
        </span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
        Bạn không có quyền truy cập
      </h1>
      <p className="text-muted-foreground max-w-md mb-6 leading-relaxed">
        Trang này chỉ dành cho tài khoản có vai trò phù hợp (Chuyên gia hoặc Quản trị viên). Vui lòng đăng nhập bằng tài khoản có thẩm quyền.
      </p>

      <div className="flex flex-wrap gap-3 justify-center">
        <Button asChild variant="outline" className="gap-2">
          <Link to="/">
            <Home className="w-4 h-4" />
            <span>Về trang chủ</span>
          </Link>
        </Button>
        <Button asChild className="gap-2">
          <Link to="/login">Đăng nhập tài khoản khác</Link>
        </Button>
      </div>
    </div>
  );
};

export default ForbiddenPage;
