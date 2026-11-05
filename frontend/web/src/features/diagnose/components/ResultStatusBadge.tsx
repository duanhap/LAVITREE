import React from 'react';
import { cn } from '@/lib/utils';
import { getResultStatus, type ResultStatusType } from '../status';
import { RESULT_STATUS_CONFIG } from '../constants';

export interface ResultStatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: ResultStatusType;
  isOod?: boolean | null;
  isUncertain?: boolean | null;
  confusionGroup?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export const ResultStatusBadge: React.FC<ResultStatusBadgeProps> = ({
  status,
  isOod,
  isUncertain,
  confusionGroup,
  size = 'md',
  className,
  ...props
}) => {
  const resolvedStatus: ResultStatusType =
    status ?? getResultStatus(isOod, isUncertain, confusionGroup);
  const config = RESULT_STATUS_CONFIG[resolvedStatus];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1 gap-1.5',
    md: 'text-sm px-3.5 py-1.5 gap-2',
    lg: 'text-base px-4 py-2 gap-2.5 font-medium',
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 20,
  };

  return (
    <div
      role="status"
      aria-label={config.label}
      className={cn(
        'inline-flex items-center font-medium rounded-full border shadow-sm transition-colors',
        config.bgClass,
        config.colorClass,
        config.borderClass,
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <Icon size={iconSizes[size]} className="shrink-0" aria-hidden="true" />
      <span>{config.label}</span>
    </div>
  );
};

export default ResultStatusBadge;
