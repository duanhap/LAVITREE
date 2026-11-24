import React, { useState } from 'react';
import { ExternalLink, Image as ImageIcon, BookOpen, X, ZoomIn } from 'lucide-react';
import { ReferenceImage } from './types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';

interface ReferenceImageGalleryProps {
  images: ReferenceImage[];
  diseaseCode?: string | null;
}

export const ReferenceImageGallery: React.FC<ReferenceImageGalleryProps> = ({ images, diseaseCode }) => {
  const [activeImage, setActiveImage] = useState<ReferenceImage | null>(null);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

  const validImages = images.filter((img) => img.image_url && !failedUrls.has(img.image_url));

  if (validImages.length === 0) return null;

  const handleImageError = (url: string) => {
    setFailedUrls((prev) => new Set(prev).add(url));
  };

  return (
    <div className="mt-3.5 pt-3 border-t border-border/80 space-y-2.5">
      <div className="flex items-center justify-between text-xs font-semibold text-foreground/90">
        <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-400">
          <ImageIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Ảnh mẫu triệu chứng đối chứng (Kho tri thức Lavitree):</span>
        </div>
        {diseaseCode && (
          <Link
            to={`/handbook/${encodeURIComponent(diseaseCode)}`}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            <BookOpen className="w-3 h-3" />
            <span>Mở trong Sổ tay</span>
          </Link>
        )}
      </div>

      <div
        className={`grid gap-2.5 ${
          validImages.length === 1
            ? 'grid-cols-1 max-w-sm'
            : validImages.length === 2
            ? 'grid-cols-2 max-w-lg'
            : 'grid-cols-2 sm:grid-cols-3'
        }`}
      >
        {validImages.map((img, idx) => (
          <div
            key={idx}
            className="group relative flex flex-col bg-muted/40 rounded-xl border border-border overflow-hidden hover:border-emerald-500/50 hover:shadow-xs transition-all"
          >
            <div
              className="relative aspect-4/3 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 cursor-pointer"
              onClick={() => setActiveImage(img)}
            >
              <img
                src={img.image_url}
                alt={img.caption || 'Ảnh mẫu bệnh hại'}
                loading="lazy"
                onError={() => handleImageError(img.image_url)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="p-1.5 rounded-full bg-black/60 text-white backdrop-blur-xs">
                  <ZoomIn className="w-4 h-4" />
                </span>
              </div>
            </div>

            <div className="p-2 flex flex-col justify-between flex-1 space-y-1 text-xs">
              <p className="font-medium text-foreground line-clamp-2 text-[11px] leading-snug" title={img.caption}>
                {img.caption || 'Triệu chứng trên cây trồng'}
              </p>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5 border-t border-border/50">
                <span className="truncate max-w-[120px]" title={img.credit || 'Lavitree Knowledge'}>
                  {img.credit ? `Nguồn: ${img.credit}` : 'Lavitree'}
                  {img.license_note ? ` · ${img.license_note}` : ''}
                </span>
                {img.source_url && (
                  <a
                    href={img.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-primary hover:underline font-medium shrink-0 ml-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>Bài gốc</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal phóng to ảnh */}
      <Dialog open={!!activeImage} onOpenChange={(open) => !open && setActiveImage(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-card border-border shadow-2xl">
          <DialogHeader className="p-4 pb-2 border-b border-border">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-emerald-600" />
              <span>{activeImage?.caption || 'Ảnh mẫu triệu chứng bệnh'}</span>
            </DialogTitle>
          </DialogHeader>

          {activeImage && (
            <div className="p-4 space-y-3">
              <div className="relative max-h-[60vh] flex items-center justify-center bg-black/5 dark:bg-black/40 rounded-lg overflow-hidden">
                <img
                  src={activeImage.image_url}
                  alt={activeImage.caption}
                  className="max-h-[60vh] w-auto max-w-full object-contain"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <div>
                  {activeImage.credit && <span className="font-medium text-foreground">Bản quyền: {activeImage.credit}</span>}
                  {activeImage.license_note && <span className="ml-1.5">({activeImage.license_note})</span>}
                </div>
                {activeImage.source_url && (
                  <a
                    href={activeImage.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                  >
                    <span>Xem bài báo nguồn</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
