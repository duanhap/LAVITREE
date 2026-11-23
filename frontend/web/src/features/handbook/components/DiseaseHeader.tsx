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
    <div className="space-y-1.5 pb-2.5 border-b border-border/70">
      {/* Hàng 1: Breadcrumb & Badges tinh gọn trên cùng một hàng */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <nav aria-label="Đường dẫn trang" className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/handbook')}
            className="h-6 px-1.5 -ml-1 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
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

        {/* Badges đưa lên gọn gàng góc phải của thanh điều hướng */}
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="border-primary/40 text-primary font-semibold text-[11px] h-5.5 px-2">
            {plantName}
          </Badge>
          <Badge
            variant="secondary"
            className={`text-[11px] font-medium border h-5.5 px-2 ${pathogenBadgeColor}`}
            title={pathogenName || undefined}
          >
            {pathogenType}
          </Badge>
        </div>
      </div>

      {/* Hàng 2: Tiêu đề chính h1 */}
      <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight leading-tight pt-0.5">
        {commonNameVi}
      </h1>

      {/* Hàng 3: Dòng meta thông tin gọn gàng kết hợp Tác nhân + Kiểm duyệt */}
      <div className="flex items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground flex-wrap">
        {!isHealthy && (
          <div className="flex items-center gap-1 text-foreground">
            <span className="text-muted-foreground">Tác nhân:</span>
            <span className="font-semibold">{pathogenType}</span>
            {pathogenName && (
              <span className="font-serif italic text-muted-foreground">({pathogenName})</span>
            )}
          </div>
        )}

        {!isHealthy && totalApprovedParagraphs > 0 && (
          <span className="text-border hidden sm:inline">·</span>
        )}

        {totalApprovedParagraphs > 0 ? (
          <div className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>
              Nội dung trích xuất từ <strong>{totalApprovedParagraphs}</strong> đoạn của{' '}
              <strong>{totalUniqueSources}</strong> nguồn tài liệu đã được kiểm duyệt.
            </span>
            {formattedDate && (
              <span>· Cập nhật: <strong>{formattedDate}</strong></span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-status-confusion">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            <span>Chưa có đoạn tài liệu khuyến nông nào được phê duyệt cho chuyên đề này.</span>
          </div>
        )}
      </div>
    </div>
  );
};
