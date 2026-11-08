import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import heroMp4 from '@/assets/brand/lavitree-hero-720.mp4';
import heroWebm from '@/assets/brand/lavitree-hero-720.webm';
import heroPoster from '@/assets/brand/lavitree-hero-poster.webp';

/**
 * Nền video lá cây (10 giây, lặp liền mạch) cho trang đăng nhập và khối giới thiệu.
 * - Người dùng bật "giảm chuyển động" hoặc chế độ tiết kiệm dữ liệu chỉ thấy ảnh tĩnh.
 * - Video không có tiếng, không nhận focus, trình đọc màn hình bỏ qua.
 */
function shouldShowStaticOnly(): boolean {
  if (typeof window === 'undefined') return true;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  return Boolean(reducedMotion || saveData);
}

interface HeroVideoBackgroundProps {
  className?: string;
  /** Lớp phủ để chữ phía trên đủ tương phản */
  overlayClassName?: string;
}

export const HeroVideoBackground: React.FC<HeroVideoBackgroundProps> = ({ className, overlayClassName }) => {
  const [staticOnly, setStaticOnly] = useState<boolean>(true);

  useEffect(() => {
    setStaticOnly(shouldShowStaticOnly());
  }, []);

  return (
    <div aria-hidden="true" className={cn('absolute inset-0 overflow-hidden', className)}>
      {staticOnly ? (
        <img src={heroPoster} alt="" className="h-full w-full object-cover" />
      ) : (
        <video
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={heroPoster}
          tabIndex={-1}
        >
          <source src={heroWebm} type="video/webm" />
          <source src={heroMp4} type="video/mp4" />
        </video>
      )}
      <div className={cn('absolute inset-0 bg-gradient-to-br from-black/55 via-black/30 to-emerald-950/60', overlayClassName)} />
    </div>
  );
};

export default HeroVideoBackground;
