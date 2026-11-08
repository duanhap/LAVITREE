import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Database,
  FileText,
  Package,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { formatDate, formatPercent } from '@/lib/format';
import { useCurrentUser } from '@/app/RequireRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Ngưỡng cảnh báo tồn kho thấp trên trang tổng quan */
const LOW_STOCK_THRESHOLD = 10;

interface SourceLite {
  id: string;
  isManualApproved: boolean;
}

interface MedicineLite {
  id: number;
  name: string;
  is_allowed: boolean;
  stock_quantity: number;
}

interface EscalationLite {
  id: string;
  plantName: string;
  diseaseName: string;
  confidence: number;
  expertReviewedAt?: string | null;
  createdAt: string;
}

interface ReindexStatus {
  running?: boolean;
  pending?: boolean;
  indexed_documents?: number | null;
  last_success_at?: string | null;
  last_error?: string | null;
}

interface OverviewData {
  sources: SourceLite[] | null;
  medicines: MedicineLite[] | null;
  escalations: EscalationLite[] | null;
  reindex: ReindexStatus | null;
}

const EMPTY: OverviewData = { sources: null, medicines: null, escalations: null, reindex: null };

function settled<T>(r: PromiseSettledResult<{ data: T }>): T | null {
  return r.status === 'fulfilled' ? r.value.data : null;
}

export const AdminOverviewPage: React.FC = () => {
  const { user } = useCurrentUser();
  const [data, setData] = useState<OverviewData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // Mỗi khối tải độc lập: một API lỗi không làm trống cả trang
    const [sources, medicines, escalations, reindex] = await Promise.allSettled([
      apiClient.get<SourceLite[]>('/knowledge/sources'),
      apiClient.get<{ items: MedicineLite[] }>('/medicines/search', { params: { allowedOnly: false } }),
      apiClient.get<EscalationLite[]>('/diagnose/escalations'),
      apiClient.get<ReindexStatus>('/knowledge/reindex-status'),
    ]);
    setData({
      sources: settled(sources),
      medicines: settled(medicines)?.items ?? null,
      escalations: settled(escalations),
      reindex: settled(reindex),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sourcesTotal = data.sources?.length ?? null;
  const sourcesPending = data.sources ? data.sources.filter((s) => !s.isManualApproved).length : null;
  const pendingEscalations = data.escalations ? data.escalations.filter((e) => !e.expertReviewedAt) : null;
  const lowStock = data.medicines
    ? data.medicines.filter((m) => m.is_allowed && m.stock_quantity < LOW_STOCK_THRESHOLD)
    : null;
  const bannedCount = data.medicines ? data.medicines.filter((m) => !m.is_allowed).length : null;

  const reindexLabel = (() => {
    const r = data.reindex;
    if (!r) return { text: 'Không kết nối được', tone: 'warn' as const };
    if (r.running || r.pending) return { text: 'Đang cập nhật chỉ mục', tone: 'info' as const };
    if (r.last_error) return { text: 'Lần cập nhật gần nhất bị lỗi', tone: 'warn' as const };
    return { text: 'Sẵn sàng', tone: 'ok' as const };
  })();

  const firstName = user?.fullName?.trim().split(' ').pop();

  return (
    <div className="space-y-8">
      {/* Tiêu đề */}
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Xin chào{firstName ? `, ${firstName}` : ''}</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Tổng quan hệ thống</h1>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2 self-start sm:self-auto">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Làm mới
        </Button>
      </div>

      {/* Chỉ số chính */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          loading={loading}
          icon={UserCheck}
          label="Ca chờ chuyên gia"
          value={pendingEscalations?.length}
          hint="Cần xem lại kết quả khám"
          to="/admin/escalations"
          highlight={(pendingEscalations?.length ?? 0) > 0}
        />
        <StatCard
          loading={loading}
          icon={ShieldCheck}
          label="Đoạn tri thức chờ duyệt"
          value={sourcesPending}
          hint={sourcesTotal !== null ? `Trên tổng ${sourcesTotal} đoạn` : undefined}
          to="/admin/knowledge"
          highlight={(sourcesPending ?? 0) > 0}
        />
        <StatCard
          loading={loading}
          icon={Package}
          label="Thuốc sắp hết hàng"
          value={lowStock?.length}
          hint={`Tồn kho dưới ${LOW_STOCK_THRESHOLD}${bannedCount ? ` · ${bannedCount} thuốc đang khoá` : ''}`}
          to="/admin/inventory"
          highlight={(lowStock?.length ?? 0) > 0}
        />
        <Card className="border-border">
          <CardContent className="flex h-full flex-col justify-between gap-3 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Chỉ mục tri thức của Lavi</span>
              <Database className="h-4 w-4 text-muted-foreground" />
            </div>
            {loading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-2.5 w-2.5 rounded-full',
                    reindexLabel.tone === 'ok' && 'bg-status-ok',
                    reindexLabel.tone === 'info' && 'bg-sky-500 animate-pulse',
                    reindexLabel.tone === 'warn' && 'bg-amber-500'
                  )}
                />
                <span className="text-lg font-semibold text-foreground">{reindexLabel.text}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {data.reindex?.indexed_documents != null
                ? `${data.reindex.indexed_documents} đoạn đang được dùng để trả lời`
                : 'Chưa có số liệu'}
              {data.reindex?.last_success_at ? ` · cập nhật ${formatDate(data.reindex.last_success_at)}` : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Ca chuyên gia mới nhất */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold">Ca chờ chuyên gia gần đây</CardTitle>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
              <Link to="/admin/escalations">
                Xem tất cả <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : pendingEscalations === null ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Không tải được danh sách ca.</p>
            ) : pendingEscalations.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Không có ca nào đang chờ. Mọi thứ ổn!</p>
            ) : (
              <ul className="divide-y divide-border">
                {pendingEscalations.slice(0, 5).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {e.plantName} · {e.diseaseName}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(e.createdAt)}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium tabular-nums text-foreground">
                      {formatPercent(e.confidence)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Lối tắt + cảnh báo kho */}
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Thao tác nhanh</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 pt-0">
              <QuickLink to="/admin/ingest" icon={FileText} label="Nhập bài báo khuyến nông mới" />
              <QuickLink to="/admin/knowledge" icon={ShieldCheck} label="Duyệt đoạn tri thức" />
              <QuickLink to="/admin/inventory" icon={Package} label="Cập nhật kho thuốc" />
            </CardContent>
          </Card>

          {!loading && lowStock && lowStock.length > 0 && (
            <Card className="border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4" /> Sắp hết hàng
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-1.5 text-sm">
                  {lowStock.slice(0, 5).map((m) => (
                    <li key={m.id} className="flex justify-between gap-3">
                      <span className="truncate text-foreground">{m.name}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-amber-800 dark:text-amber-300">
                        còn {m.stock_quantity}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  loading: boolean;
  icon: React.ElementType;
  label: string;
  value: number | null | undefined;
  hint?: string;
  to: string;
  highlight?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ loading, icon: Icon, label, value, hint, to, highlight }) => (
  <Link
    to={to}
    className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <Card className={cn('h-full border-border transition-colors group-hover:border-primary/40', highlight && 'border-primary/30')}>
      <CardContent className="flex h-full flex-col justify-between gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <span className={cn('text-3xl font-bold tabular-nums', highlight ? 'text-primary' : 'text-foreground')}>
            {value ?? '—'}
          </span>
        )}
        <p className="text-xs text-muted-foreground">{value == null && !loading ? 'Không tải được dữ liệu' : hint}</p>
      </CardContent>
    </Card>
  </Link>
);

const QuickLink: React.FC<{ to: string; icon: React.ElementType; label: string }> = ({ to, icon: Icon, label }) => (
  <Link
    to={to}
    className="flex items-center justify-between rounded-lg border border-border px-3.5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <span className="flex items-center gap-2.5">
      <Icon className="h-4 w-4 text-primary" />
      {label}
    </span>
    <ArrowRight className="h-4 w-4 text-muted-foreground" />
  </Link>
);

export default AdminOverviewPage;
