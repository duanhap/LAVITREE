import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface PageSkeletonProps {
  variant?: 'cards' | 'list' | 'detail' | 'dashboard';
  className?: string;
}

export const PageSkeleton: React.FC<PageSkeletonProps> = ({
  variant = 'cards',
  className,
}) => {
  if (variant === 'list') {
    return (
      <div className={cn('space-y-4 max-w-4xl mx-auto py-6', className)} aria-label="Đang tải dữ liệu">
        <Skeleton className="h-8 w-48 mb-6" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4 border border-border rounded-xl bg-card">
            <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className={cn('max-w-4xl mx-auto py-6 space-y-6', className)} aria-label="Đang tải dữ liệu">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div className={cn('space-y-6 py-6', className)} aria-label="Đang tải dữ liệu">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-5 border border-border rounded-xl bg-card space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  // Mặc định: cards
  return (
    <div className={cn('space-y-6 max-w-6xl mx-auto py-6', className)} aria-label="Đang tải dữ liệu">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border border-border rounded-xl p-5 bg-card space-y-4">
            <Skeleton className="aspect-video w-full rounded-lg" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex justify-between items-center pt-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PageSkeleton;
