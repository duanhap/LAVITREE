import React, { useState, useEffect } from 'react';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { EscalationItem } from '@/features/admin/types';

export const AdminEscalationsPage: React.FC = () => {
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [loadingEscalations, setLoadingEscalations] = useState<boolean>(false);
  const [selectedEscalation, setSelectedEscalation] = useState<EscalationItem | null>(null);
  const [expertNoteInput, setExpertNoteInput] = useState<string>('');
  const [reviewSubmitting, setReviewSubmitting] = useState<boolean>(false);

  const fetchEscalations = async () => {
    try {
      setLoadingEscalations(true);
      const res = await apiClient.get<EscalationItem[]>('/diagnose/escalations');
      setEscalations(res.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingEscalations(false);
    }
  };

  useEffect(() => {
    fetchEscalations();
  }, []);

  const handleSaveExpertReview = async () => {
    if (!selectedEscalation || !expertNoteInput.trim()) {
      toast.error('Vui lòng nhập kết luận và hướng dẫn điều trị của chuyên gia.');
      return;
    }

    try {
      setReviewSubmitting(true);
      const res = await apiClient.patch(`/diagnose/${selectedEscalation.id}/expert-review`, {
        expert_notes: expertNoteInput.trim(),
      });

      setEscalations((prev) =>
        prev.map((e) =>
          e.id === selectedEscalation.id
            ? { ...e, expertNotes: res.data.expert_notes, expertReviewedAt: res.data.expert_reviewed_at }
            : e
        )
      );

      setSelectedEscalation(null);
      setExpertNoteInput('');
      toast.success('Đã gửi phản hồi phác đồ điều trị của chuyên gia tới nông dân.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Ca chuyên gia
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Các ca khám độ tin cậy thấp hoặc nông dân yêu cầu chuyên gia xem lại.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchEscalations}
          disabled={loadingEscalations}
          className="gap-2 bg-card border-border hover:bg-muted text-xs shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingEscalations ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </Button>
      </div>

      {/* Main Content */}
      <div className="space-y-4">
        <div className="pb-2">
          <h3 className="text-base font-bold text-foreground">
            Ca bệnh có yêu cầu Bác sĩ Cây trồng thẩm định
          </h3>
          <p className="text-xs text-muted-foreground">
            Các ca chẩn đoán có độ bất định cao (IsUncertain = true) hoặc nông dân bấm nút "Nhờ chuyên gia".
          </p>
        </div>

        {loadingEscalations ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-36 rounded-xl bg-card border border-border p-4 animate-pulse" />
            ))}
          </div>
        ) : escalations.length === 0 ? (
          <div className="p-12 text-center bg-card border border-border rounded-xl">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600 mb-2" />
            <h4 className="text-base font-bold text-foreground">Không có ca bệnh nào tồn đọng</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Tất cả các ca khám lá của nông dân đều đã được AI nhận diện ổn định hoặc chuyên gia đã xử lý xong.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {escalations.map((item) => (
              <Card key={item.id} className="border-border bg-card shadow-xs flex flex-col justify-between">
                <CardHeader className="p-4 pb-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-300 text-xs">
                      {item.plantName} – {item.diseaseName}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  <CardTitle className="text-sm font-bold text-foreground pt-1">
                    Nông dân: {item.userName} {item.userPhone ? `(${item.userPhone})` : ''}
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-3 text-xs">
                  {item.notes && (
                    <div className="bg-muted/30 p-2.5 rounded-lg border border-border/60">
                      <span className="font-semibold text-foreground block mb-0.5">Mô tả từ nông dân:</span>
                      <p className="text-muted-foreground italic">"{item.notes}"</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {item.originalImageUrl && (
                      <div className="w-20 h-20 rounded-md border border-border overflow-hidden shrink-0">
                        <img
                          src={item.originalImageUrl}
                          alt="Ảnh lá"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    {item.gradCamImageUrl && (
                      <div className="w-20 h-20 rounded-md border border-border overflow-hidden shrink-0">
                        <img
                          src={item.gradCamImageUrl}
                          alt="Grad-CAM"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 text-[11px] space-y-1">
                      <div>Độ tin cậy AI: <strong>{(item.confidence * 100).toFixed(1)}%</strong></div>
                      {item.expertNotes ? (
                        <div className="text-emerald-800 font-medium bg-emerald-50 p-1.5 rounded border border-emerald-200 line-clamp-2">
                          BS: {item.expertNotes}
                        </div>
                      ) : (
                        <div className="text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200">
                          Chờ bác sĩ phản hồi phác đồ...
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs mt-2"
                    onClick={() => {
                      setSelectedEscalation(item);
                      setExpertNoteInput(item.expertNotes || '');
                    }}
                  >
                    {item.expertNotes ? 'Cập nhật phác đồ điều trị' : 'Thẩm định & Viết phác đồ'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* DIALOG THẨM ĐỊNH CA BỆNH KHÓ */}
      <Dialog open={!!selectedEscalation} onOpenChange={() => setSelectedEscalation(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Thẩm định Chuyên môn &amp; Phác đồ điều trị
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ca bệnh: {selectedEscalation?.plantName} – {selectedEscalation?.diseaseName}
            </DialogDescription>
          </DialogHeader>

          {selectedEscalation && (
            <div className="space-y-3.5 py-2 text-xs">
              <div className="bg-muted/40 p-3 rounded-lg border border-border space-y-1">
                <div>Nông dân: <strong>{selectedEscalation.userName}</strong> ({selectedEscalation.userPhone || 'Không có SĐT'})</div>
                {selectedEscalation.notes && <div>Ghi chú vườn: <em>"{selectedEscalation.notes}"</em></div>}
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  Kết luận chẩn đoán &amp; Hướng dẫn điều trị của Bác sĩ Cây trồng *
                </label>
                <Textarea
                  rows={4}
                  placeholder="Ghi rõ phác đồ xử lý: cách ly, tỉa cành tiêu hủy, loại thuốc sinh học/hóa học nên dùng kèm liều lượng và thời gian phun..."
                  value={expertNoteInput}
                  onChange={(e) => setExpertNoteInput(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setSelectedEscalation(null)}>
              Đóng
            </Button>
            <Button
              size="sm"
              disabled={reviewSubmitting}
              onClick={handleSaveExpertReview}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
            >
              {reviewSubmitting ? 'Đang gửi...' : 'Gửi phản hồi chuyên gia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEscalationsPage;
