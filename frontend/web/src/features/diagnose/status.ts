export type ResultStatusType = 'ood' | 'uncertain' | 'confusion' | 'reference';

/**
 * Suy ra trạng thái chẩn đoán duy nhất theo thứ tự ưu tiên:
 * 1. is_ood = true -> 'ood'
 * 2. is_uncertain = true -> 'uncertain'
 * 3. có confusion_group -> 'confusion'
 * 4. còn lại -> 'reference'
 *
 * Tham chiếu SSOT: docs/spec/classes.md mục 3-4 và docs/architecture/ui-ux.md mục 4
 */
export function getResultStatus(
  isOod?: boolean | null,
  isUncertain?: boolean | null,
  confusionGroup?: string | null
): ResultStatusType {
  if (isOod) {
    return 'ood';
  }
  if (isUncertain) {
    return 'uncertain';
  }
  if (confusionGroup && confusionGroup.trim().length > 0) {
    return 'confusion';
  }
  return 'reference';
}
