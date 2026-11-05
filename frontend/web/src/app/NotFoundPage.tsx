import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import laviFullImg from '@/assets/brand/lavi-full-512.webp';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="relative mb-6">
        <img
          src={laviFullImg}
          alt="Lavi 404 - Không tìm thấy trang"
          className="w-40 h-40 object-contain drop-shadow-md select-none"
        />
        <span className="absolute -bottom-2 right-0 px-3 py-1 bg-secondary text-primary font-bold text-sm rounded-full border border-border shadow-xs">
          404
        </span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
        Trang không tồn tại
      </h1>
      <p className="text-muted-foreground max-w-md mb-6 leading-relaxed">
        Đường dẫn bạn đang tìm kiếm có thể đã bị di chuyển, xóa hoặc không còn hoạt động trên hệ thống Lavitree.
      </p>

      <Button asChild className="gap-2">
        <Link to="/">
          <Home className="w-4 h-4" />
          <span>Về trang chủ</span>
        </Link>
      </Button>
    </div>
  );
};

export default NotFoundPage;
