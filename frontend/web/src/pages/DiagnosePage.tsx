import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';
import { DIAGNOSIS_DISCLAIMER } from '@/features/diagnose/constants';
import { getResultStatus } from '@/features/diagnose/status';
import { prepareImageForUpload } from '@/features/diagnose/prepare-image';
import type { DiagnoseResponse } from '@/features/diagnose/types';
import ResultStatusBadge from '@/features/diagnose/components/ResultStatusBadge';
import ImageCompare from '@/features/diagnose/components/ImageCompare';
import TreatmentSteps from '@/features/diagnose/components/TreatmentSteps';
import RecommendedProducts from '@/features/diagnose/components/RecommendedProducts';
import VerifiedSourcesList from '@/features/diagnose/components/VerifiedSourcesList';
import Top3List from '@/features/diagnose/components/Top3List';
import { formatPercent } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  UploadCloud,
  Camera,
  RotateCcw,
  MessageSquare,
  AlertTriangle,
  LogIn,
  CheckCircle2,
  Sparkles,
  Info,
  HelpCircle,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Upload và suy luận AI trên mạng yếu cần lâu hơn timeout chung của API
const DIAGNOSE_TIMEOUT_MS = 90_000;

export const DiagnosePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [diagnoseData, setDiagnoseData] = useState<DiagnoseResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectFile = (file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Kích thước tệp vượt quá 10MB. Vui lòng chọn ảnh nhẹ hơn.');
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setDiagnoseData(null);
    setErrorMessage(null);
  };

  // Thu hồi object URL cũ khi đổi ảnh hoặc rời trang để không giữ ảnh trong bộ nhớ
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) selectFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) selectFile(file);
  };

  const handleExpertReview = () => {
    const chatPath = `/chat?class_code=${encodeURIComponent(diagnoseData?.result?.class_code || '')}`;
    navigate(isAuthenticated ? chatPath : `/login?next=${encodeURIComponent(chatPath)}`);
  };

  const handleDiagnose = async () => {
    if (!selectedFile) {
      toast.error('Vui lòng chọn hoặc chụp ảnh lá cây trước.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const formData = new FormData();
    // Khớp 100% với api-contracts.md Mục 3.1: trường 'image'
    formData.append('image', await prepareImageForUpload(selectedFile));
    if (notes.trim()) {
      formData.append('notes', notes.trim());
    }

    try {
      const res = await apiClient.post<DiagnoseResponse>('/diagnose', formData, {
        timeout: DIAGNOSE_TIMEOUT_MS,
      });
      setDiagnoseData(res.data);
      if (res.data.is_ood) {
        toast.warning('Ảnh nằm ngoài 38 lớp sâu bệnh được hỗ trợ (OOD).');
      } else {
        toast.success('Chẩn đoán thành công!');
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setNotes('');
    setDiagnoseData(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Xác định trạng thái nghiệp vụ cho kết quả
  const status = diagnoseData
    ? getResultStatus(
        diagnoseData.is_ood,
        diagnoseData.is_uncertain,
        diagnoseData.result?.confusion_group
      )
    : 'reference';

  // Original image URL: Ưu tiên MinIO URL nếu có, nếu là Guest hoặc chưa có URL thì dùng previewUrl cục bộ (BUG-13)
  const displayOriginalImage =
    diagnoseData?.visual_evidence?.original_image_url || previewUrl || '';
  const displayGradcamImage =
    diagnoseData?.visual_evidence?.gradcam_image_url || null;

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 max-w-5xl space-y-8">
      {/* Tiêu đề & Giới thiệu */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-primary text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Trí tuệ Nhân tạo ResNet-18 & Grad-CAM Heatmap</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
          Khám Bệnh Lá Cây Trồng Toàn Trình
        </h1>
        <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
          Chụp hoặc tải ảnh lá cây để nhận diện 38 lớp lá khỏe và bệnh hại trên 14 loài cây trồng. Hệ thống cung cấp bản đồ nhiệt nghi vấn và phác đồ xử lý IPM chuẩn khuyến nông.
        </p>
      </div>

      {/* KHỐI 1: KHUNG TẢI ẢNH NẾU CHƯA CÓ KẾT QUẢ HOẶC ĐANG CHỌN ẢNH MỚI */}
      {!diagnoseData && (
        <Card className="border border-border bg-card shadow-sm max-w-2xl mx-auto">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg font-bold text-foreground">
              Tải ảnh lá cây để bắt đầu khám
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Định dạng hỗ trợ: JPG, PNG, WEBP (Tối đa 10MB). Đảm bảo lá chiếm ≥ 70% khung hình và chụp trong khoảng 15–20cm.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
              id="leaf-upload-input"
            />

            {!previewUrl ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-secondary/30 p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-secondary/50 transition-all duration-200"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card shadow-xs text-primary mb-3">
                  <UploadCloud className="h-7 w-7" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">
                  Nhấn để chọn ảnh hoặc kéo thả ảnh vào đây
                </p>
                <p className="text-xs text-muted-foreground">
                  Hỗ trợ chụp trực tiếp từ camera hoặc tải ảnh từ thư viện
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl border border-border bg-muted">
                  <img
                    src={previewUrl}
                    alt="Xem trước ảnh lá"
                    className="h-full w-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-3 right-3 bg-card/90 backdrop-blur-sm text-xs shadow-md border border-border"
                  >
                    <Camera className="h-3.5 w-3.5 mr-1" /> Đổi ảnh khác
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="notes" className="text-xs font-medium text-foreground">
                    Ghi chú thêm về vườn/cây (tùy chọn)
                  </label>
                  <textarea
                    id="notes"
                    rows={2}
                    maxLength={1000}
                    placeholder="Ví dụ: Vườn cà chua 3 sào tại Nam Định, xuất hiện đốm đen 2 ngày nay sau đợt mưa..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  />
                  <div className="text-right text-[11px] text-muted-foreground">
                    {notes.length}/1000 ký tự
                  </div>
                </div>

                {errorMessage && (
                  <Alert variant="destructive" className="py-2.5">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReset}
                    disabled={isLoading}
                    className="w-1/3 text-xs border-border"
                  >
                    Hủy bỏ
                  </Button>
                  <Button
                    type="button"
                    onClick={handleDiagnose}
                    disabled={isLoading}
                    className="w-2/3 bg-primary hover:bg-primary-hover text-white text-xs font-semibold h-10"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Đang phân tích tế bào lá...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4" />
                        <span>Tiến hành Chẩn đoán ngay</span>
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* KHỐI 2: HIỂN THỊ KẾT QUẢ CHẨN ĐOÁN (Tuân thủ thứ tự screens.md mục 4) */}
      {diagnoseData && (
        <div className="space-y-6">
          {/* 1. CÂU MIỄN TRỪ CỐ ĐỊNH THEO SSOT */}
          <div className="flex items-center gap-2 rounded-xl bg-secondary/80 px-4 py-2.5 text-xs text-muted-foreground border border-border">
            <Info className="h-4 w-4 shrink-0 text-primary" />
            <p className="font-medium">{DIAGNOSIS_DISCLAIMER}</p>
          </div>

          {/* 2. NHÃN TRẠNG THÁI + WARNING MESSAGE */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card shadow-xs">
            <div className="flex items-center gap-3">
              <ResultStatusBadge
                isOod={diagnoseData.is_ood}
                isUncertain={diagnoseData.is_uncertain}
                confusionGroup={diagnoseData.result?.confusion_group}
                size="md"
              />
              {diagnoseData.warning && (
                <span className="text-xs text-muted-foreground font-medium">
                  {diagnoseData.warning}
                </span>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="text-xs border-border h-8"
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Khám ảnh khác
            </Button>
          </div>

          {/* TRƯỜNG HỢP ẢNH NGOẠI LAI (is_ood = true): CHỈ cảnh báo + nút chụp lại */}
          {diagnoseData.is_ood ? (
            <Card className="border-border bg-card shadow-sm p-6 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-status-ood-bg text-status-ood">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">
                  Không nhận diện được lá cây trồng
                </h3>
                <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                  {diagnoseData.warning ||
                    'Ảnh nằm ngoài phạm vi 38 lớp cây trồng được hỗ trợ (OOD). Vui lòng không chụp vật thể lạ hoặc ảnh mờ mất nét.'}
                </p>
              </div>

              <div className="pt-2">
                <Button
                  type="button"
                  onClick={handleReset}
                  className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-6"
                >
                  <Camera className="h-4 w-4 mr-2" /> Chụp lại trong khung ngắm 15–20cm
                </Button>
              </div>
            </Card>
          ) : (
            /* TRƯỜNG HỢP IN-DISTRIBUTION (Ảnh nhận diện hợp lệ) */
            <div className="space-y-6">
              {/* 3. TÊN BỆNH TOP-1, CÂY TRỒNG, SEVERITY & ĐỘ TIN CẬY */}
              {diagnoseData.result && (
                <Card className="border-border bg-card shadow-xs overflow-hidden">
                  <div className="p-5 md:p-6 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border pb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-primary">
                            {diagnoseData.result.plant_name}
                          </span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs font-medium text-muted-foreground">
                            {diagnoseData.result.severity_level}
                          </span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight">
                          {diagnoseData.result.disease_name}
                        </h2>
                        <p className="text-xs text-muted-foreground font-mono">
                          Mã khoa học: {diagnoseData.result.class_code}
                        </p>
                      </div>

                      {/* Độ tin cậy của mô hình (Dạng %, cấm dùng 'Độ tin cậy cao') */}
                      <div className="flex flex-col items-start md:items-end justify-center rounded-xl bg-secondary px-4 py-2.5 border border-border/50">
                        <span className="text-xs text-muted-foreground font-medium">
                          Độ tin cậy của mô hình
                        </span>
                        <span className="text-xl font-black text-primary tabular-nums">
                          {formatPercent(diagnoseData.result.confidence)}
                        </span>
                      </div>
                    </div>

                    {/* Bố cục 2 cột: Cột trái (Ảnh gốc & Heatmap) - Cột phải (Top-3 & Thông tin thêm) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* 4. ẢNH GỐC ↔ GRAD-CAM HEATMAP (Chiếm 7 cột trên màn lớn) */}
                      <div className="lg:col-span-7">
                        <ImageCompare
                          originalUrl={displayOriginalImage}
                          gradcamUrl={displayGradcamImage}
                          altText={diagnoseData.result.disease_name}
                        />
                      </div>

                      {/* Cột phụ: Top 3 & Hướng dẫn (Chiếm 5 cột trên màn lớn) */}
                      <div className="lg:col-span-5 space-y-4">
                        <Top3List
                          top3={diagnoseData.result.top3}
                          defaultOpen={status === 'confusion' || status === 'uncertain'}
                        />

                        {/* Mẹo chụp ảnh nếu có */}
                        {diagnoseData.result.warning && (
                          <div className="rounded-xl border border-status-confusion/30 bg-status-confusion-bg/30 p-3.5 text-xs text-foreground space-y-1">
                            <span className="font-semibold text-status-confusion flex items-center gap-1">
                              <HelpCircle className="h-3.5 w-3.5" /> Khuyến nghị góc máy:
                            </span>
                            <p className="text-muted-foreground leading-relaxed">
                              {diagnoseData.result.warning}
                            </p>
                          </div>
                        )}

                        {/* Gợi ý cho Guest */}
                        {!isAuthenticated && (
                          <div className="rounded-xl border border-primary/20 bg-brand-mint-soft/50 p-4 text-xs space-y-2">
                            <span className="font-semibold text-primary block">
                              📌 Bạn đang khám dưới quyền Khách vãng lai
                            </span>
                            <p className="text-muted-foreground leading-relaxed">
                              Kết quả này chỉ lưu trong phiên duyệt hiện tại. Đăng nhập để tự động lưu lịch sử khám và theo dõi tiến trình hồi phục của cây.
                            </p>
                            <Link
                              to={`/login?next=${encodeURIComponent('/')}`}
                              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline pt-1"
                            >
                              <LogIn className="h-3.5 w-3.5" /> Đăng nhập ngay
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* 5. PHÁC ĐỒ XỬ LÝ CHUẨN IPM */}
              <Card className="border-border bg-card shadow-xs p-5 md:p-6">
                <TreatmentSteps steps={diagnoseData.treatment_guidelines} />
              </Card>

              {/* 6. VẬT TƯ & THUỐC BVTV GỢI Ý */}
              <Card className="border-border bg-card shadow-xs p-5 md:p-6">
                <RecommendedProducts
                  products={diagnoseData.recommended_products}
                  isUncertain={diagnoseData.is_uncertain}
                />
              </Card>

              {/* 7. NGUỒN KIỂM CHỨNG ĐỐI CHỨNG */}
              {diagnoseData.verified_sources && diagnoseData.verified_sources.length > 0 && (
                <Card className="border-border bg-card shadow-xs p-5 md:p-6">
                  <VerifiedSourcesList sources={diagnoseData.verified_sources} />
                </Card>
              )}

              {/* 8. HÀNH ĐỘNG TIẾP THEO (HỎI TRỢ LÝ / KHÁM ẢNH KHÁC / THẨM ĐỊNH) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  className="border-border text-xs h-10 px-4"
                >
                  {diagnoseData.is_uncertain ? (
                    <>
                      <Camera className="h-3.5 w-3.5 mr-1.5" /> Chụp lại
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Khám ảnh khác
                    </>
                  )}
                </Button>

                <div className="flex flex-wrap items-center gap-2">
                  {diagnoseData.is_uncertain && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleExpertReview}
                      className="border-primary/40 text-primary hover:bg-primary/5 text-xs font-semibold h-10 px-4"
                    >
                      <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                      Nhờ chuyên gia thẩm định
                    </Button>
                  )}

                  <Button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/chat?class_code=${encodeURIComponent(
                          diagnoseData.result?.class_code || ''
                        )}`
                      )
                    }
                    className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold h-10 px-5 shadow-xs"
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                    Hỏi Trợ lý Lavi về ca bệnh này
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DiagnosePage;
