import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getOrderStatusMeta } from '../status';

interface OrderStatusBadgeProps {
  status: string | null | undefined;
  className?: string;
}

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status, className }) => {
  const meta = getOrderStatusMeta(status);
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn('gap-1 font-semibold', meta.badgeClass, className)}>
      <Icon className="w-3 h-3" aria-hidden="true" />
      {meta.label}
    </Badge>
  );
};

export default OrderStatusBadge;
