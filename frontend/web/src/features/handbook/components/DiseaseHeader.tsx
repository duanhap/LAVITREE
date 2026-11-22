import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Info, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface DiseaseHeaderProps {
  commonNameVi: string;
  plantName: string;
  classCode: string;
  pathogenType: string;
  pathogenName?: string | null;
  severityLevel: number;
  totalApprovedParagraphs: number;
  totalUniqueSources: number;
  latestUpdatedAt?: string | null;
  isHealthy?: boolean;
}

export const DiseaseHeader: React.FC<DiseaseHeaderProps> = ({
  commonNameVi,
  plantName,
  classCode,
  pathogenType,
  pathogenName,
  severityLevel,
  totalApprovedParagraphs,
  totalUniqueSources,
  latestUpdatedAt,
  isHealthy,
}) => {
  const navigate = useNavigate();

  const formattedDate = latestUpdatedAt
    ? new Date(latestUpdatedAt).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null;

  const severityBadge = (() => {
    if (isHealthy) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-status-ok-bg text-status-ok border border-status-ok/30">
          ● Cây khỏe mạnh
        </span>
      );
    }
    if (severityLevel === 1) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-status-ok-bg text-status-ok border border-status-ok/30">
          ● Mức độ: Nhẹ
        </span>
      );
    }
    if (severityLevel === 3) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-status-uncertain-bg text-status-uncertain border border-status-uncertain/30">
          ● Mức độ: Khẩn cấp / Nghiêm trọng
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-status-confusion-bg text-status-confusion border border-status-confusion/30">
        ● Mức độ: Vừa phải
      </span>
    );
  })();

  const pathogenBadgeColor = (() => {
    if (isHealthy) return 'bg-status-ok-bg text-status-ok border-status-ok/30';
    if (pathogenType.includes('Vi khuẩn')) return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20';
    if (pathogenType.includes('Virus')) return 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20';
    if (pathogenType.includes('Nhện')) return 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20';
    return 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20';
  })();

  return (
    <div className="space-y-3 pb-6 border-b border-border/80">
      {/* Breadcrumb & Nút quay lại */}
      <nav aria-label="Đường dẫn trang" className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/handbook')}
          className="h-10 lg:h-7 px-2 -ml-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Về Sổ tay</span>
        </Button>
        <span className="text-border">/</span>
        <Link to="/handbook" className="hover:text-primary transition-colors">
          Sổ tay bệnh học
        </Link>
        <span className="text-border">/</span>
        <Link
          to={`/handbook?plant=${encodeURIComponent(plantName)}`}
          className="hover:text-primary transition-colors font-medium text-foreground"
        >
          {plantName}
        </Link>
        <span className="text-border">/</span>
        <span className="text-foreground font-semibold truncate max-w-[200px] sm:max-w-none">
          {commonNameVi}
        </span>
      </nav>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Badge variant="outline" className="border-primary/40 text-primary font-semibold text-xs">
          {plantName}
        </Badge>
        <Badge
          variant="secondary"
          className={`text-xs font-medium border ${pathogenBadgeColor}`}
          title={pathogenName || undefined}
        >
          {pathogenType}
        </Badge>
        {severityBadge}
        {/* Không hiện mã lớp mô hình cho người dùng (quy ước TASK-09) */}
      </div>

      {/* Tiêu đề chính h1 */}
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
        {commonNameVi}
      </h1>

      {/* Dòng Tác nhân sinh học */}
      {!isHealthy && (
        <div className="text-sm text-foreground flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-muted-foreground">Tác nhân gây bệnh:</span>
          <span>{pathogenType}</span>
          {pathogenName && (
            <span className="font-serif italic font-normal text-muted-foreground">
              ({pathogenName})
            </span>
          )}
        </div>
      )}

      {/* Dòng thông tin kiểm duyệt nguồn */}
      {totalApprovedParagraphs > 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 flex-wrap">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <span>
            Nội dung trích xuất từ <strong>{totalApprovedParagraphs}</strong> đoạn của{' '}
            <strong>{totalUniqueSources}</strong> nguồn tài liệu đã được kiểm duyệt.
          </span>
          {formattedDate && (
            <span>· Cập nhật: <strong>{formattedDate}</strong></span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-status-confusion pt-1">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>Chưa có đoạn tài liệu khuyến nông nào được phê duyệt cho chuyên đề này.</span>
        </div>
      )}
    </div>
  );
};
