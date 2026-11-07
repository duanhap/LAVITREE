import React, { useState, useRef, useCallback } from 'react';
import { Sparkles, SlidersHorizontal, Image as ImageIcon } from 'lucide-react';

interface ImageCompareProps {
  originalUrl: string;
  gradcamUrl?: string | null;
  altText?: string;
}

export const ImageCompare: React.FC<ImageCompareProps> = ({
  originalUrl,
  gradcamUrl,
  altText = 'Ảnh lá cây chẩn đoán',
}) => {
  const [sliderPosition, setSliderPosition] = useState<number>(50); // 0 to 100%
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isDragging && e.touches[0]) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      handleMove(e.clientX);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      setSliderPosition((prev) => Math.max(0, prev - 5));
    } else if (e.key === 'ArrowRight') {
      setSliderPosition((prev) => Math.min(100, prev + 5));
    }
  };

  // Nếu không có ảnh Grad-CAM (ví dụ ca healthy hoặc không bật heatmap), chỉ hiển thị ảnh gốc
  if (!gradcamUrl) {
    return (
      <div className="space-y-2">
        <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl border border-border bg-muted">
          <img
            src={originalUrl}
            alt={altText}
            className="h-full w-full object-cover"
          />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Ảnh lá gốc được gửi lên hệ thống
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Container so sánh ảnh */}
      <div
        ref={containerRef}
        role="slider"
        aria-label="Thanh trượt so sánh ảnh gốc và bản đồ nhiệt Grad-CAM"
        aria-valuenow={Math.round(sliderPosition)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onMouseMove={handleMouseMove}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={() => setIsDragging(false)}
        onTouchMove={handleTouchMove}
        className="relative aspect-4/3 w-full select-none overflow-hidden rounded-xl border border-border bg-muted cursor-ew-resize focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        {/* Layer 1: Ảnh Grad-CAM Heatmap (Dưới cùng) */}
        <img
          src={gradcamUrl}
          alt={`Bản đồ nhiệt Grad-CAM: ${altText}`}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Nhãn chú thích Grad-CAM góc phải */}
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
          <Sparkles className="h-3 w-3 text-brand-glow" />
          <span>Grad-CAM</span>
        </div>

        {/* Layer 2: Ảnh gốc (Được cắt theo vị trí slider) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPosition}%` }}
        >
          <img
            src={originalUrl}
            alt={`Ảnh gốc: ${altText}`}
            className="absolute inset-0 h-full w-full object-cover max-w-none"
            style={{
              width: containerRef.current ? `${containerRef.current.clientWidth}px` : '100%',
            }}
          />
        </div>

        {/* Nhãn chú thích Ảnh gốc góc trái */}
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
          <ImageIcon className="h-3 w-3 text-white" />
          <span>Ảnh gốc</span>
        </div>

        {/* Đường chia slider & Tay nắm */}
        <div
          className="absolute top-0 bottom-0 z-20 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)]"
          style={{ left: `${sliderPosition}%` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-primary shadow-lg border border-border">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Chú giải bắt buộc theo SSOT screens.md mục 4 */}
      <div className="rounded-lg bg-secondary/60 p-2.5 text-center text-xs text-muted-foreground border border-border/50">
        <span className="font-semibold text-foreground">💡 Chú thích: </span>
        Vùng màu đỏ là nơi mô hình AI chú ý nhiều nhất, không phải ranh giới chính xác của vết bệnh. Dùng chuột/ngón tay kéo thanh trượt để so sánh.
      </div>
    </div>
  );
};

export default ImageCompare;
