import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/format';

interface CancelOrderDialogProps {
  open: boolean;
  orderId: string;
  totalAmount: number;
  itemCount: number;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export const CancelOrderDialog: React.FC<CancelOrderDialogProps> = ({
  open,
  orderId,
  totalAmount,
  itemCount,
  submitting,
  onOpenChange,
  onConfirm,
}) => (
  <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <div className="mx-auto sm:mx-0 mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/50">
          <AlertTriangle className="h-5 w-5 text-rose-600" aria-hidden="true" />
        </div>
        <DialogTitle>Hủy đơn hàng {orderId}?</DialogTitle>
        <DialogDescription>
          Đơn gồm {itemCount} sản phẩm, tổng {formatCurrency(totalAmount)}. Sau khi hủy, đơn không thể khôi phục;
          nếu cần, bạn có thể đặt lại bằng nút "Đặt lại đơn này".
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
          Giữ đơn
        </Button>
        <Button variant="destructive" onClick={onConfirm} disabled={submitting} className="gap-2">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {submitting ? 'Đang hủy...' : 'Xác nhận hủy đơn'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default CancelOrderDialog;
