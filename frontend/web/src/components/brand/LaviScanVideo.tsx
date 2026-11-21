import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import scanWhiteMp4 from '@/assets/brand/lavi-kinh-lup-white.mp4';
import scanWhiteWebm from '@/assets/brand/lavi-kinh-lup-white.webm';
import scanWhitePoster from '@/assets/brand/lavi-kinh-lup-poster.webp';

export interface LaviScanVideoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES = {
  sm: 'w-16 h-14',
  md: 'w-28 h-24 sm:w-36 sm:h-30',
  lg: 'w-40 h-34 sm:w-48 sm:h-40',
};

/**
 * Hiển thị video Lavi soi kính lúp (phiên bản nền trắng chuẩn mới từ CapCut).
 * Kích thước nhỏ gọn, tự động hòa trộn nền tự nhiên (mix-blend-multiply) không lộ viền.
 */
export const LaviScanVideo: React.FC<LaviScanVideoProps> = ({
  className,
  size = 'md',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Tránh lỗi trình duyệt nếu có chính sách chặn autoplay
      });
    }
  }, []);

  return (
    <div
      className={cn(
        'relative group flex items-center justify-center select-none',
        className
      )}
    >
      {/* Vầng sáng hữu cơ nhẹ dịu phía sau */}
      <div className="absolute inset-2 rounded-full bg-primary/10 blur-xl group-hover:bg-primary/20 transition-all duration-300 pointer-events-none" />

      {/* Video Lavi soi kính lúp hòa trộn nền không viền đen */}
      <div className={cn('relative flex items-center justify-center', SIZE_CLASSES[size])}>
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={scanWhitePoster}
          className="h-full w-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105 pointer-events-none select-none drop-shadow-xs"
        >
          <source src={scanWhiteWebm} type="video/webm" />
          <source src={scanWhiteMp4} type="video/mp4" />
        </video>
      </div>
    </div>
  );
};

export default LaviScanVideo;
