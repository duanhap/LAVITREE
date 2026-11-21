import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import laviConfusedImg from '@/assets/brand/lavi-confused-retake.webp';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl scale-75" />
        <img
          src={laviConfusedImg}
          alt="Lavi 404 - Không tìm thấy trang"
          className="relative w-44 h-44 object-contain drop-shadow-md select-none"
        />
        <span className="absolute -bottom-2 right-2 px-3 py-1 bg-secondary text-primary font-black text-sm rounded-full border border-border shadow-xs">
          404
        </span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2">
        Trang không tồn tại
      </h1>
      <p className="text-muted-foreground max-w-md mb-6 leading-relaxed text-sm">
        Đường dẫn bạn đang tìm kiếm có thể đã bị di chuyển, đổi tên hoặc không còn tồn tại trên hệ thống Lavitree.
      </p>

      <Button asChild className="gap-2 bg-primary hover:bg-primary-hover text-white">
        <Link to="/">
          <Home className="w-4 h-4" />
          <span>Về trang chủ Khám lá</span>
        </Link>
      </Button>
    </div>
  );
};

export default NotFoundPage;
