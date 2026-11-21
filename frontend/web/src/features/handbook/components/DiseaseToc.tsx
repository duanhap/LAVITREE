import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Camera, Lightbulb, List } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface TocItem {
  id: string;
  label: string;
}

interface DiseaseTocProps {
  items: TocItem[];
  classCode: string;
  captureTip?: string | null;
}

export const DiseaseToc: React.FC<DiseaseTocProps> = ({
  items,
  classCode,
  captureTip,
}) => {
  const [activeId, setActiveId] = useState<string>(items[0]?.id || '');

  useEffect(() => {
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0.1,
      }
    );

    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items]);

  const scrollToSection = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setActiveId(id);
    }
  };

  return (
    <div className="space-y-5">
      {/* ================= DESKTOP TOC (STICKY) ================= */}
      <div className="hidden lg:block space-y-4">
        {/* Hộp mục lục */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider pb-2 border-b border-border/50">
            <List className="h-4 w-4 text-primary" />
            <span>Mục lục nội dung</span>
          </div>

          <nav aria-label="Mục lục bài viết" className="space-y-1">
            {items.map((item) => {
              const isActive = activeId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={(e) => scrollToSection(e, item.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                    isActive
                      ? 'bg-primary/10 text-primary font-bold shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Nút thao tác nhanh */}
        <div className="space-y-2">
          <Button asChild className="w-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold h-10 shadow-xs">
            <Link to={`/chat?class_code=${encodeURIComponent(classCode)}`}>
              <MessageSquare className="h-4 w-4 mr-1.5" />
              Hỏi Trợ lý Lavi về bệnh này
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full text-xs font-semibold h-10 border-border">
            <Link to="/">
              <Camera className="h-4 w-4 mr-1.5 text-primary" />
              Khám lá bằng AI Vision ngay
            </Link>
          </Button>
        </div>

        {/* Thẻ mẹo chụp ảnh (nếu có captureTip) */}
        {captureTip && captureTip.trim().length > 0 && (
          <div className="rounded-2xl border border-primary/20 bg-linear-to-b from-brand-mint-soft/50 to-card p-4 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-primary">
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
              <span>Mẹo chụp ảnh chẩn đoán</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {captureTip}
            </p>
          </div>
        )}
      </div>

      {/* ================= MOBILE STICKY CHIP BAR ================= */}
      <div className="lg:hidden sticky top-16 z-30 -mx-4 px-4 py-2 bg-card/95 backdrop-blur-md border-b border-border shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {items.map((item) => {
            const isActive = activeId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={(e) => scrollToSection(e, item.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-2xs'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
