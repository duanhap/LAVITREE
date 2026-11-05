import { CircleCheck, TriangleAlert, CircleAlert, ImageOff } from 'lucide-react';
import type { ElementType } from 'react';
import type { ResultStatusType } from './status';

export interface StatusConfig {
  key: ResultStatusType;
  label: string;
  icon: ElementType;
  token: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

/**
 * Câu miễn trừ trách nhiệm pháp lý & y khoa cây trồng hiển thị cố định trên mọi kết quả.
 * Khớp nguyên văn: docs/spec/classes.md mục 3
 */
export const DIAGNOSIS_DISCLAIMER =
  'Mọi kết quả đều là gợi ý tham khảo (Decision Support), không thay thế chẩn đoán của chuyên gia.';

/**
 * Cấu hình 4 trạng thái chẩn đoán theo SSOT docs/architecture/ui-ux.md mục 4
 */
export const RESULT_STATUS_CONFIG: Record<ResultStatusType, StatusConfig> = {
  reference: {
    key: 'reference',
    label: 'Kết quả tham khảo',
    icon: CircleCheck,
    token: 'status-ok',
    colorClass: 'text-status-ok',
    bgClass: 'bg-status-ok-bg',
    borderClass: 'border-status-ok/30',
  },
  confusion: {
    key: 'confusion',
    label: 'Dễ nhầm – xem thêm khả năng khác',
    icon: TriangleAlert,
    token: 'status-confusion',
    colorClass: 'text-status-confusion',
    bgClass: 'bg-status-confusion-bg',
    borderClass: 'border-status-confusion/30',
  },
  uncertain: {
    key: 'uncertain',
    label: 'Chưa chắc chắn – nên chụp lại',
    icon: CircleAlert,
    token: 'status-uncertain',
    colorClass: 'text-status-uncertain',
    bgClass: 'bg-status-uncertain-bg',
    borderClass: 'border-status-uncertain/30',
  },
  ood: {
    key: 'ood',
    label: 'Không nhận diện được lá cây',
    icon: ImageOff,
    token: 'status-ood',
    colorClass: 'text-status-ood',
    bgClass: 'bg-status-ood-bg',
    borderClass: 'border-status-ood/30',
  },
};
