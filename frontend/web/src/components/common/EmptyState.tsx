import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import laviConfusedImg from '@/assets/brand/lavi-confused-retake.webp';
import laviWavingImg from '@/assets/brand/lavi-waving-3d.webp';
import laviHealthyImg from '@/assets/brand/lavi-healthy-thumbsup.webp';
import laviDoctorTreatmentImg from '@/assets/brand/lavi-doctor-treatment.webp';
import laviDoctorScanImg from '@/assets/brand/lavi-doctor-scan.webp';

export type MascotVariant = 'waving' | 'confused' | 'healthy' | 'treatment' | 'scan' | 'none';

const MASCOT_MAP: Record<Exclude<MascotVariant, 'none'>, string> = {
  confused: laviConfusedImg,
  waving: laviWavingImg,
  healthy: laviHealthyImg,
  treatment: laviDoctorTreatmentImg,
  scan: laviDoctorScanImg,
};

export interface EmptyStateProps {
  title?: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  actionHref?: string;
  icon?: React.ReactNode;
  mascotVariant?: MascotVariant;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Chưa có dữ liệu',
  description,
  actionText,
  onAction,
  actionHref,
  icon,
  mascotVariant = 'confused',
  className,
}) => {
  const mascotSrc = mascotVariant !== 'none' ? MASCOT_MAP[mascotVariant] : null;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto my-6 rounded-2xl border border-border bg-card/70 backdrop-blur-xs shadow-xs',
        className
      )}
    >
      <div className="relative mb-4 flex items-center justify-center">
        {icon ? (
          <div className="p-4 rounded-full bg-secondary text-primary">{icon}</div>
        ) : mascotSrc ? (
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl scale-75" />
            <img
              src={mascotSrc}
              alt="Lavi - Trợ lý cây trồng Lavitree"
              className="relative w-32 h-32 object-contain drop-shadow-sm select-none"
              loading="lazy"
            />
          </div>
        ) : null}
      </div>

      <h3 className="text-lg font-bold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed max-w-sm">{description}</p>

      {actionText && (
        <div>
          {actionHref ? (
            <Button asChild className="bg-primary hover:bg-primary-hover text-white">
              <a href={actionHref}>{actionText}</a>
            </Button>
          ) : (
            <Button onClick={onAction} className="bg-primary hover:bg-primary-hover text-white">
              {actionText}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
