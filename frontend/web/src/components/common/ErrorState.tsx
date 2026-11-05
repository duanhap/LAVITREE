import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/api-client';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  error?: unknown;
  onRetry?: () => void;
  retryText?: string;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Đã có lỗi xảy ra',
  message,
  error,
  onRetry,
  retryText = 'Thử lại',
  className,
}) => {
  const resolvedMessage = message || (error ? getErrorMessage(error) : 'Hệ thống đang bận hoặc mất kết nối.');

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto my-6 rounded-xl border border-destructive/20 bg-status-uncertain-bg/40 shadow-xs',
        className
      )}
    >
      <div className="p-3.5 rounded-full bg-status-uncertain-bg text-destructive mb-3 shadow-xs">
        <AlertCircle className="w-8 h-8" aria-hidden="true" />
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{resolvedMessage}</p>

      {onRetry && (
        <Button
          variant="outline"
          onClick={onRetry}
          className="gap-2 border-border bg-card hover:bg-muted"
        >
          <RefreshCw className="w-4 h-4" />
          <span>{retryText}</span>
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
