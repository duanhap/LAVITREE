import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatPercent } from '@/lib/format';
import type { DiagnoseResponse } from '@/features/diagnose/types';
import ImageCompare from '@/features/diagnose/components/ImageCompare';
import TreatmentSteps from '@/features/diagnose/components/TreatmentSteps';
import RecommendedProducts from '@/features/diagnose/components/RecommendedProducts';
import VerifiedSourcesList from '@/features/diagnose/components/VerifiedSourcesList';
import ResultStatusBadge from '@/features/diagnose/components/ResultStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  History,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Sprout,
  Activity,
  Layers,
  MessageSquare,
  AlertCircle,
  FileText,
  Clock,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';

export interface HistoryItem {
  id: string;
  created_at: string;
  plant_name: string;
  disease_name: string;
  class_code: string;
  confidence: number;
  is_uncertain: boolean;
  confusion_group?: string | null;
  requires_expert?: boolean;
  expert_notes?: string | null;
  expert_reviewed_at?: string | null;
  recovery_status: string;
  notes?: string | null;
  original_image_url: string;
  gradcam_image_url?: string | null;
}

interface HistoryResponse {
  total_records: number;
  page: number;
  page_size: number;
  items: HistoryItem[];
}

export const HistoryPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [items, setItems] = useState<HistoryItem[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(9);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal xem chi tiết một ca khám cũ (W-08)
  const [detailData, setDetailData] = useState<DiagnoseResponse | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  // Modal gửi ca cho Bác sĩ Cây trồng
  const [isExpertModalOpen, setIsExpertModalOpen] = useState<boolean>(false);
  const [farmerNotesInput, setFarmerNotesInput] = useState<string>('');
  const [sendingExpert, setSendingExpert] = useState<boolean>(false);

  const fetchHistory = async (targetPage: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<HistoryResponse>(
        `/diagnose/history?page=${targetPage}&pageSize=${pageSize}`
      );
      setItems(res.data.items);
      setTotalRecords(res.data.total_records);
      setPage(res.data.page);
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(page);
  }, [page]);

  // Nếu URL có id (Route W-08), tự động mở modal chi tiết
  useEffect(() => {
    if (id) {
      openDetailById(id);
    }
  }, [id]);

  const openDetailById = async (recordId: string) => {
    setIsDetailLoading(true);
    setIsDetailOpen(true);
    try {
      const res = await apiClient.get<DiagnoseResponse>(`/diagnose/history/${recordId}`);
      setDetailData(res.data);
    } catch (err: unknown) {
      toast.error('Không tìm thấy chi tiết ca khám bệnh hoặc bạn không có quyền truy cập.');
      setIsDetailOpen(false);
      if (id) navigate('/history', { replace: true });
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setDetailData(null);
    if (id) {
      navigate('/history');
    }
  };

  const handleSendToExpert = async () => {
    if (!detailData?.diagnosis_id) return;
    try {
      setSendingExpert(true);
      const res = await apiClient.post<{ farmer_notes?: string | null }>(
        `/diagnose/${detailData.diagnosis_id}/request-expert`,
        { farmer_notes: farmerNotesInput.trim() || undefined }
      );
      // Server nối mô tả mới vào sau ghi chú lúc khám; hiển thị đúng bản đã lưu
      const savedNotes = res.data?.farmer_notes ?? null;
      toast.success('Đã gửi thông tin ca bệnh tới Bác sĩ Cây trồng thành công!');
      setIsExpertModalOpen(false);
      setFarmerNotesInput('');
      setDetailData((prev) =>
        prev
          ? {
              ...prev,
              requires_expert: true,
              notes: savedNotes ?? prev.notes,
            }
          : null
      );
      setItems((prev) =>
        prev.map((item) =>
          item.id === detailData.diagnosis_id
            ? { ...item, requires_expert: true, notes: savedNotes ?? item.notes }
            : item
        )
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSendingExpert(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 max-w-6xl space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-primary text-xs font-semibold">
          <History className="h-3.5 w-3.5" />
          <span>Hồ Sơ Nhật Ký Bệnh Vườn</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
          Lịch Sử Khám Bệnh Cây Trồng
        </h1>
        <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
          Theo dõi các ca chẩn đoán của bạn ({user?.fullName}), đối chiếu ảnh gốc với bản đồ nhiệt Grad-CAM và theo dõi tiến trình hồi phục của cây.
        </p>
      </div>

      {/* DANH SÁCH BẢN GHI LỊCH SỬ */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-80 rounded-2xl border border-border bg-card p-4 animate-pulse space-y-3">
              <div className="h-44 w-full bg-muted rounded-xl" />
              <div className="h-4 w-1/3 bg-muted rounded" />
              <div className="h-6 w-3/4 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-4 max-w-lg mx-auto">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">Không thể tải lịch sử ca khám</h3>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => fetchHistory(page)}
            className="border-border text-xs h-9 px-4"
          >
            Thử tải lại
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-4 max-w-lg mx-auto">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
            <Sprout className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-foreground">Chưa có hồ sơ khám bệnh nào</h3>
            <p className="text-xs text-muted-foreground">
              Bạn chưa thực hiện ca chẩn đoán nào trên tài khoản này. Hãy bắt đầu khám bệnh cho cây trồng trong vườn ngay!
            </p>
          </div>
          <Button
            type="button"
            onClick={() => navigate('/')}
            className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-6"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Khám lá cây ngay
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Tổng số: <strong>{totalRecords}</strong> ca khám</span>
            <span>Trang {page} / {totalPages}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => {
              const isHealthy = item.class_code.endsWith('___healthy');
              return (
                <Card
                  key={item.id}
                  className="flex flex-col justify-between border-border bg-card hover:border-primary/50 transition-all hover:shadow-xs rounded-2xl overflow-hidden"
                >
                  <div className="relative aspect-4/3 w-full overflow-hidden bg-muted">
                    {item.original_image_url || item.gradcam_image_url ? (
                      <img
                        src={item.original_image_url || item.gradcam_image_url || undefined}
                        alt={item.disease_name}
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Sprout className="h-10 w-10" />
                      </div>
                    )}
                    <div className="absolute top-2.5 left-2.5">
                      <Badge
                        variant="secondary"
                        className="bg-black/60 text-white backdrop-blur-sm text-[11px] font-medium border-0"
                      >
                        {item.plant_name}
                      </Badge>
                    </div>
                    <div className="absolute top-2.5 right-2.5">
                      <Badge
                        className={`text-[11px] font-semibold ${
                          isHealthy
                            ? 'bg-status-ok-bg text-status-ok border-status-ok/30'
                            : 'bg-primary text-white border-0'
                        }`}
                      >
                        {formatPercent(item.confidence)}
                      </Badge>
                    </div>
                  </div>

                  <CardHeader className="p-4 pb-2 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                    <CardTitle className="text-base font-bold text-foreground line-clamp-1">
                      {item.disease_name}
                    </CardTitle>
                    {item.confusion_group && (
                      <p className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded w-fit border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
                        Nhóm nghi vấn: {item.confusion_group}
                      </p>
                    )}
                  </CardHeader>

                  <CardContent className="p-4 pt-1 space-y-3 flex-1 flex flex-col justify-between">
                    {item.notes ? (
                      <p className="text-xs text-muted-foreground line-clamp-2 bg-secondary/40 p-2 rounded-lg">
                        "{item.notes}"
                      </p>
                    ) : (
                      <div className="h-2" />
                    )}

                    <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className="text-[11px] font-medium border-border text-muted-foreground"
                        >
                          {item.recovery_status || 'Đang theo dõi'}
                        </Badge>
                        {item.expert_notes ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold dark:bg-emerald-950 dark:text-emerald-200">
                            Bác sĩ đã kết luận
                          </Badge>
                        ) : item.requires_expert ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold dark:bg-amber-950 dark:text-amber-200">
                            Chờ Bác sĩ
                          </Badge>
                        ) : null}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openDetailById(item.id)}
                        className="text-xs font-semibold text-primary hover:text-primary-hover p-0 h-auto"
                      >
                        <span>Chi tiết hồ sơ</span>
                        <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Phân trang (Pagination) */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="text-xs border-border h-9 px-3"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Trang trước
              </Button>

              <span className="text-xs font-medium text-foreground px-3">
                {page} / {totalPages}
              </span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="text-xs border-border h-9 px-3"
              >
                Trang sau <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* DIALOG XEM CHI TIẾT CA KHÁM BỆNH CŨ (W-08) */}
      <Dialog open={isDetailOpen} onOpenChange={(open) => !open && handleCloseDetail()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-5 md:p-7 rounded-2xl">
          {isDetailLoading || !detailData ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-6">
              <DialogHeader className="space-y-1.5 text-left border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-bold text-primary border-primary/30">
                    {detailData.result?.plant_name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground font-medium">
                    {detailData.result?.severity_level}
                  </span>
                </div>
                <DialogTitle className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight">
                  {detailData.result?.disease_name}
                </DialogTitle>
                <DialogDescription className="text-xs font-mono text-muted-foreground">
                  Mã ca chẩn đoán: {detailData.diagnosis_id}
                </DialogDescription>
              </DialogHeader>

              {/* Status Badge & Độ tin cậy */}
              <div className="flex items-center justify-between rounded-xl bg-secondary/50 p-3.5 border border-border">
                <ResultStatusBadge
                  isOod={detailData.is_ood}
                  isUncertain={detailData.is_uncertain}
                  confusionGroup={detailData.result?.confusion_group}
                  size="md"
                />
                <div className="text-right">
                  <span className="text-[11px] text-muted-foreground block">Độ tin cậy của mô hình</span>
                  <span className="text-base font-black text-primary tabular-nums">
                    {formatPercent(detailData.result?.confidence)}
                  </span>
                </div>
              </div>

              {detailData.warning && (
                <p className="rounded-xl border border-status-confusion/30 bg-status-confusion-bg/30 p-3 text-xs text-foreground">
                  {detailData.warning}
                </p>
              )}

              {detailData.notes && (
                <p className="rounded-xl bg-secondary/40 p-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Ghi chú của bạn: </span>
                  {detailData.notes}
                </p>
              )}

              {/* Phản hồi kết luận từ Bác sĩ Cây trồng */}
              {detailData.expert_notes && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 space-y-2 dark:bg-emerald-950/40 dark:border-emerald-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      Phác đồ thẩm định từ Bác sĩ Cây trồng
                    </span>
                    {detailData.expert_reviewed_at && (
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(detailData.expert_reviewed_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-emerald-950 dark:text-emerald-100 whitespace-pre-wrap leading-relaxed">
                    {detailData.expert_notes}
                  </p>
                </div>
              )}

              {/* Đang chờ Bác sĩ phản hồi */}
              {detailData.requires_expert && !detailData.expert_notes && (
                <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3 flex items-center gap-2 dark:bg-amber-950/30 dark:border-amber-800">
                  <Clock className="w-4 h-4 text-amber-600 animate-spin" />
                  <span className="text-xs font-medium text-amber-900 dark:text-amber-200">
                    Ca bệnh đã được chuyển tới Bác sĩ Cây trồng. Đang chờ chuyên gia thẩm định và phản hồi...
                  </span>
                </div>
              )}

              {/* So sánh ảnh gốc & Grad-CAM */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Bằng chứng trực quan hóa vùng nghi vấn:
                </h4>
                <ImageCompare
                  originalUrl={detailData.visual_evidence?.original_image_url || ''}
                  gradcamUrl={detailData.visual_evidence?.gradcam_image_url}
                  altText={detailData.result?.disease_name}
                />
              </div>

              {/* Phác đồ IPM */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <TreatmentSteps steps={detailData.treatment_guidelines} />
              </div>

              {/* Danh mục thuốc BVTV */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <RecommendedProducts
                  products={detailData.recommended_products}
                  isUncertain={detailData.is_uncertain}
                />
              </div>

              {/* Nguồn kiểm chứng */}
              {detailData.verified_sources && detailData.verified_sources.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <VerifiedSourcesList sources={detailData.verified_sources} />
                </div>
              )}

              {/* Nút hành động */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCloseDetail}
                  className="text-xs border-border"
                >
                  Đóng hồ sơ
                </Button>

                <div className="flex items-center gap-2">
                  {!detailData.requires_expert && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsExpertModalOpen(true)}
                      className="border-amber-300 text-amber-900 hover:bg-amber-50 text-xs font-semibold dark:border-amber-700 dark:text-amber-200"
                    >
                      <UserCheck className="h-3.5 w-3.5 mr-1.5 text-amber-600" />
                      Nhờ Bác sĩ thẩm định
                    </Button>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      handleCloseDetail();
                      navigate(`/chat?class_code=${encodeURIComponent(detailData.result?.class_code || '')}`);
                    }}
                    className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold"
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> Hỏi Trợ lý về ca bệnh này
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal gửi ca bệnh cho Bác sĩ Cây trồng */}
      <Dialog open={isExpertModalOpen} onOpenChange={setIsExpertModalOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <UserCheck className="w-5 h-5 text-amber-600" />
              Nhờ Bác sĩ Cây trồng thẩm định ca bệnh
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Thông tin ca bệnh và hình ảnh sẽ được chuyển tới Bác sĩ Cây trồng phụ trách để tư vấn phác đồ xử lý chuyên sâu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="text-xs font-semibold text-foreground">
              Mô tả thêm tình trạng vườn cây (triệu chứng, thời gian phát bệnh, diện tích):
            </label>
            <Textarea
              rows={4}
              maxLength={2000}
              placeholder="Ví dụ: Vườn cà chua 500m2 bị đốm lá khoảng 3 ngày nay sau đợt mưa rào. Đã thử tỉa cành nhưng lá non vẫn bị héo..."
              value={farmerNotesInput}
              onChange={(e) => setFarmerNotesInput(e.target.value)}
              className="text-xs resize-none"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Tối đa 2.000 ký tự</span>
              <span>{farmerNotesInput.length}/2000</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsExpertModalOpen(false)}
              disabled={sendingExpert}
            >
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSendToExpert}
              disabled={sendingExpert}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              {sendingExpert ? 'Đang gửi...' : 'Gửi yêu cầu thẩm định'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HistoryPage;
