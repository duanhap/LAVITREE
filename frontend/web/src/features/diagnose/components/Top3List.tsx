import React, { useState } from 'react';
import type { Top3Item } from '../types';
import { formatPercent } from '@/lib/format';
import { ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Top3ListProps {
  top3: Top3Item[];
  defaultOpen?: boolean;
}

export const Top3List: React.FC<Top3ListProps> = ({ top3, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);

  if (!top3 || top3.length <= 1) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            Các khả năng bệnh khác (Top 3)
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <span>{isOpen ? 'Thu gọn' : 'Xem chi tiết'}</span>
          {isOpen ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
        </Button>
      </div>

      {isOpen && (
        <div className="space-y-2.5 pt-2 border-t border-border/50">
          {top3.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">
                  {idx + 1}. {item.disease_name}
                </span>
                <span className="font-semibold text-muted-foreground tabular-nums">
                  {formatPercent(item.confidence)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    idx === 0 ? 'bg-primary' : 'bg-muted-foreground/60'
                  }`}
                  style={{ width: `${Math.max(2, Math.min(100, item.confidence * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Top3List;
