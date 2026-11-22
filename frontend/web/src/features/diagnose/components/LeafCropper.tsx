import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Crop, ImagePlus, Maximize, Square, RectangleHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Bước cắt ảnh trước khi khám (W-01).
 * Cho phép kéo tự do chiều ngang, chiều dọc hoặc các góc theo hình dáng chiếc lá,
 * loại bỏ đất, tay và lá khác để mô hình nhận diện chính xác nhất.
 */

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e';

const OUTPUT_MAX_EDGE = 1600;
const KEY_STEP_RATIO = 0.02;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function defaultCrop(w: number, h: number): CropRect {
  const width = Math.round(w * 0.85);
  const height = Math.round(h * 0.85);
  return {
    x: Math.round((w - width) / 2),
    y: Math.round((h - height) / 2),
    width,
    height,
  };
}

async function cropToFile(file: File, crop: CropRect): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const maxDim = Math.max(crop.width, crop.height);
    const scaleFactor = Math.min(1, OUTPUT_MAX_EDGE / maxDim);
    const outW = Math.max(64, Math.round(crop.width * scaleFactor));
    const outH = Math.max(64, Math.round(crop.height * scaleFactor));

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(
      bitmap,
      Math.max(0, Math.round(crop.x)),
      Math.max(0, Math.round(crop.y)),
      Math.max(1, Math.round(crop.width)),
      Math.max(1, Math.round(crop.height)),
      0,
      0,
      outW,
      outH
    );
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

  const applyDrag = (mode: DragMode, start: CropRect, dx: number, dy: number): CropRect => {
    if (!natural) return start;
    const { w, h } = natural;
    const minDim = Math.max(48, Math.round(Math.min(w, h) * 0.08));

    if (mode === 'move') {
      return {
        width: start.width,
        height: start.height,
        x: clamp(start.x + dx, 0, w - start.width),
        y: clamp(start.y + dy, 0, h - start.height),
      };
    }

    let { x, y, width, height } = start;

    // Kéo ngang (Trái hoặc Phải)
    if (mode.includes('w')) {
      const right = start.x + start.width;
      const newX = clamp(start.x + dx, 0, right - minDim);
      x = newX;
      width = right - newX;
    } else if (mode.includes('e')) {
      width = clamp(start.width + dx, minDim, w - start.x);
    }

    // Kéo dọc (Trên hoặc Dưới)
    if (mode.includes('n')) {
      const bottom = start.y + start.height;
      const newY = clamp(start.y + dy, 0, bottom - minDim);
      y = newY;
      height = bottom - newY;
    } else if (mode.includes('s')) {
      height = clamp(start.height + dy, minDim, h - start.y);
    }

    return { x, y, width, height };
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

  const setSquareCrop = () => {
    if (!crop || !natural) return;
    const { w, h } = natural;
    const size = Math.round(Math.min(crop.width, crop.height));
    const centerX = crop.x + crop.width / 2;
    const centerY = crop.y + crop.height / 2;
    const x = clamp(Math.round(centerX - size / 2), 0, w - size);
    const y = clamp(Math.round(centerY - size / 2), 0, h - size);
    setCrop({ x, y, width: size, height: size });
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
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setCrop(applyDrag('se', crop, step, step));
    } else if (e.key === '-') {
      e.preventDefault();
      setCrop(applyDrag('se', crop, -step, -step));
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
    ? {
        left: crop.x * scale,
        top: crop.y * scale,
        width: crop.width * scale,
        height: crop.height * scale,
      }
    : null;

  return (
    <div className="space-y-3">
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
              className="block max-h-[52vh] max-w-full"
            />
          )}

          {box && (
            <div
              role="group"
              aria-label="Khung cắt ảnh. Kéo cạnh hoặc góc để thay đổi kích thước ngang dọc"
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

              {/* 4 Cạnh kéo dãn (Edges) */}
              <span
                onPointerDown={onPointerDown('n')}
                aria-hidden="true"
                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-12 flex items-center justify-center cursor-ns-resize"
                title="Kéo co giãn chiều dọc"
              >
                <span className="h-1.5 w-7 rounded-full bg-white border border-primary shadow-xs" />
              </span>
              <span
                onPointerDown={onPointerDown('s')}
                aria-hidden="true"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 h-6 w-12 flex items-center justify-center cursor-ns-resize"
                title="Kéo co giãn chiều dọc"
              >
                <span className="h-1.5 w-7 rounded-full bg-white border border-primary shadow-xs" />
              </span>
              <span
                onPointerDown={onPointerDown('w')}
                aria-hidden="true"
                className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-6 flex items-center justify-center cursor-ew-resize"
                title="Kéo co giãn chiều ngang"
              >
                <span className="h-7 w-1.5 rounded-full bg-white border border-primary shadow-xs" />
              </span>
              <span
                onPointerDown={onPointerDown('e')}
                aria-hidden="true"
                className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 h-12 w-6 flex items-center justify-center cursor-ew-resize"
                title="Kéo co giãn chiều ngang"
              >
                <span className="h-7 w-1.5 rounded-full bg-white border border-primary shadow-xs" />
              </span>

              {/* 4 Góc kéo (Corners) */}
              {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
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
                  <span className="h-4 w-4 rounded-full border-2 border-primary bg-white shadow-sm" />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={onChooseAnother} disabled={isSaving} className="h-10 text-xs">
          <ImagePlus className="mr-1.5 h-3.5 w-3.5" /> Chọn ảnh khác
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => natural && setCrop(defaultCrop(natural.w, natural.h))}
          disabled={!natural || isSaving}
          className="h-10 text-xs"
        >
          <Maximize className="mr-1.5 h-3.5 w-3.5" /> Toàn lá (Tự do)
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={setSquareCrop}
          disabled={!crop || isSaving}
          className="h-10 text-xs"
        >
          <Square className="mr-1.5 h-3.5 w-3.5" /> Khung vuông 1:1
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!crop || isSaving}
          className="h-10 flex-1 min-w-[10rem] bg-primary hover:bg-primary-hover text-white font-semibold text-xs"
        >
          <Crop className="mr-1.5 h-3.5 w-3.5" /> {isSaving ? 'Đang cắt...' : 'Dùng khung ảnh này'}
        </Button>
      </div>
    </div>
  );
};

export default LeafCropper;
