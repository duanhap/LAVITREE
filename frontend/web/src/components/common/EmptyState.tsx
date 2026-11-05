import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import laviFullImg from '@/assets/brand/lavi-full-512.webp';

export interface EmptyStateProps {
  title?: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  actionHref?: string;
  icon?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Chưa có dữ liệu',
  description,
  actionText,
  onAction,
  actionHref,
  icon,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto my-6 rounded-xl border border-border bg-card/60 backdrop-blur-xs shadow-xs',
        className
      )}
    >
      <div className="relative mb-4 flex items-center justify-center">
        {icon ? (
          <div className="p-4 rounded-full bg-secondary text-primary">{icon}</div>
        ) : (
          <img
            src={laviFullImg}
            alt="Lavi - Trợ lý cây trồng Lavitree"
            className="w-32 h-32 object-contain drop-shadow-sm select-none"
            loading="lazy"
          />
        )}
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{description}</p>

      {actionText && (
        <div>
          {actionHref ? (
            <Button asChild>
              <a href={actionHref}>{actionText}</a>
            </Button>
          ) : (
            <Button onClick={onAction}>{actionText}</Button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
