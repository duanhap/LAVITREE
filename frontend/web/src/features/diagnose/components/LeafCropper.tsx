import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Crop, ImagePlus, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Bước cắt ảnh trước khi khám (W-01).
 * Mô hình chỉ học trên ảnh lá tách nền và resize thẳng về 224x224, nên:
 * - nền (đất, tay, lá khác) làm kết quả sai → người dùng khoanh đúng chiếc lá;
 * - khung cắt khóa tỉ lệ 1:1 để ảnh không bị bóp méo khi resize.
 */

interface CropRect {
  x: number;
  y: number;
  size: number; // đơn vị: pixel của ảnh gốc
}

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se';

const CORNER_SIGNS: Record<Exclude<DragMode, 'move'>, [number, number]> = {
  nw: [-1, -1],
  ne: [1, -1],
  sw: [-1, 1],
  se: [1, 1],
};

const OUTPUT_MAX_EDGE = 1600;
const KEY_STEP_RATIO = 0.02;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function defaultCrop(w: number, h: number): CropRect {
  const size = Math.round(Math.min(w, h) * 0.9);
  return { x: Math.round((w - size) / 2), y: Math.round((h - size) / 2), size };
}

async function cropToFile(file: File, crop: CropRect): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const out = Math.min(crop.size, OUTPUT_MAX_EDGE);
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(bitmap, crop.x, crop.y, crop.size, crop.size, 0, 0, out, out);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) throw new Error('toBlob');
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'leaf';
    return new File([blob], `${baseName}-crop.jpg`, { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}

interface LeafCropperProps {
  file: File;
  onConfirm: (cropped: File) => void;
  onChooseAnother: () => void;
}

export const LeafCropper: React.FC<LeafCropperProps> = ({ file, onConfirm, onChooseAnother }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1); // pixel hiển thị / pixel ảnh gốc
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ mode: DragMode; px: number; py: number; start: CropRect } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    setNatural(null);
    setCrop(null);
    setError(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const measure = useCallback(() => {
    const img = imgRef.current;
    if (img && img.naturalWidth) setScale(img.clientWidth / img.naturalWidth);
  }, []);

  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const observer = new ResizeObserver(measure);
    observer.observe(img);
    return () => observer.disconnect();
  }, [measure, src]);

  const handleLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNatural({ w, h });
    setCrop(defaultCrop(w, h));
    measure();
  };

  const minSize = natural ? Math.max(64, Math.round(Math.min(natural.w, natural.h) * 0.1)) : 64;

  const applyDrag = (mode: DragMode, start: CropRect, dx: number, dy: number): CropRect => {
    if (!natural) return start;
    const { w, h } = natural;
    if (mode === 'move') {
      return {
        size: start.size,
        x: clamp(start.x + dx, 0, w - start.size),
        y: clamp(start.y + dy, 0, h - start.size),
      };
    }
    const [sx, sy] = CORNER_SIGNS[mode];
    // Góc đối diện đứng yên; khung lớn/nhỏ theo hướng kéo trội hơn để giữ hình vuông
    const ax = sx > 0 ? start.x : start.x + start.size;
    const ay = sy > 0 ? start.y : start.y + start.size;
    const grow = Math.abs(dx) > Math.abs(dy) ? sx * dx : sy * dy;
    const maxSize = Math.min(sx > 0 ? w - ax : ax, sy > 0 ? h - ay : ay);
    const size = clamp(start.size + grow, Math.min(minSize, maxSize), maxSize);
    return { size, x: sx > 0 ? ax : ax - size, y: sy > 0 ? ay : ay - size };
  };

  const onPointerDown = (mode: DragMode) => (e: React.PointerEvent) => {
    if (!crop) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { mode, px: e.clientX, py: e.clientY, start: crop };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !scale) return;
    const dx = (e.clientX - drag.px) / scale;
    const dy = (e.clientY - drag.py) / scale;
    setCrop(applyDrag(drag.mode, drag.start, dx, dy));
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!crop || !natural) return;
    const step = Math.max(4, Math.round(Math.min(natural.w, natural.h) * KEY_STEP_RATIO));
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      setCrop(applyDrag('move', crop, ...moves[e.key]));
    } else if (e.key === '+' || e.key === '=' || e.key === '-') {
      e.preventDefault();
      const delta = e.key === '-' ? -step : step;
      // Đổi kích thước quanh tâm khung
      const grown = applyDrag('se', crop, delta / 2, delta / 2);
      setCrop(applyDrag('move', grown, -(grown.size - crop.size) / 2, -(grown.size - crop.size) / 2));
    }
  };

  const handleConfirm = async () => {
    if (!crop) return;
    setIsSaving(true);
    setError(null);
    try {
      onConfirm(await cropToFile(file, crop));
    } catch {
      setError('Trình duyệt không cắt được ảnh này. Hãy thử chọn ảnh khác (JPG/PNG).');
    } finally {
      setIsSaving(false);
    }
  };

  const box = crop
    ? { left: crop.x * scale, top: crop.y * scale, width: crop.size * scale, height: crop.size * scale }
    : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-brand-mint-soft/50 px-4 py-3 text-sm text-foreground">
        <p className="font-semibold text-primary flex items-center gap-1.5">
          <Crop className="h-4 w-4" /> Khoanh đúng một chiếc lá bị bệnh
        </p>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          Kéo khung để di chuyển, kéo các góc để phóng to hoặc thu nhỏ. Cắt bớt đất, tay và lá khác giúp Lavi nhận diện chính xác hơn.
        </p>
      </div>

      <div className="flex justify-center rounded-xl border border-border bg-neutral-900 p-2">
        <div
          className="relative inline-block select-none touch-none overflow-hidden"
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {src && (
            <img
              ref={imgRef}
              src={src}
              alt="Ảnh lá cần cắt"
              onLoad={handleLoad}
              onError={() => setError('Không đọc được ảnh này. Hãy chọn ảnh khác.')}
              draggable={false}
              className="block max-h-[60vh] max-w-full"
            />
          )}

          {box && (
            <div
              role="group"
              aria-label="Khung cắt ảnh. Dùng phím mũi tên để di chuyển, phím cộng trừ để đổi kích thước"
              tabIndex={0}
              onKeyDown={onKeyDown}
              onPointerDown={onPointerDown('move')}
              className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-mint"
              style={box}
            >
              {/* Lưới 1/3 giúp căn chiếc lá vào giữa */}
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-white/25" />
                ))}
              </div>
              {(Object.keys(CORNER_SIGNS) as Array<keyof typeof CORNER_SIGNS>).map((corner) => (
                <span
                  key={corner}
                  onPointerDown={onPointerDown(corner)}
                  aria-hidden="true"
                  className={[
                    'absolute h-8 w-8 -m-4 flex items-center justify-center',
                    corner.includes('n') ? 'top-0' : 'bottom-0',
                    corner.includes('w') ? 'left-0' : 'right-0',
                    corner === 'nw' || corner === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize',
                  ].join(' ')}
                >
                  <span className="h-4 w-4 rounded-full border-2 border-primary bg-white shadow" />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onChooseAnother} disabled={isSaving} className="h-11">
          <ImagePlus className="mr-1.5 h-4 w-4" /> Chọn ảnh khác
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => natural && setCrop(defaultCrop(natural.w, natural.h))}
          disabled={!natural || isSaving}
          className="h-11"
        >
          <Maximize className="mr-1.5 h-4 w-4" /> Đặt lại khung
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!crop || isSaving}
          className="h-11 flex-1 min-w-[10rem] bg-primary hover:bg-primary-hover text-white font-semibold"
        >
          <Crop className="mr-1.5 h-4 w-4" /> {isSaving ? 'Đang cắt...' : 'Cắt và dùng ảnh này'}
        </Button>
      </div>
    </div>
  );
};

export default LeafCropper;
