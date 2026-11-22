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
import LeafCropper from '@/features/diagnose/components/LeafCropper';
import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  UploadCloud,
  Camera,
  RotateCcw,
  RotateCw,
  MessageSquare,
  AlertTriangle,
  LogIn,
  CheckCircle2,
  Sparkles,
  Info,
  HelpCircle,
  UserCheck,
  Crop,
  Zap,
  Sprout,
  Leaf,
  Lightbulb,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { HeroVideoBackground } from '@/components/brand/HeroVideoBackground';
import { LaviScanVideo } from '@/components/brand/LaviScanVideo';
import laviHelloImg from '@/assets/brand/lavi-3d-hello-820.webp';
import laviDoctorScanImg from '@/assets/brand/lavi-doctor-scan.webp';
import laviHealthyImg from '@/assets/brand/lavi-healthy-thumbsup.webp';
import laviConfusedImg from '@/assets/brand/lavi-confused-retake.webp';
import laviDoctorTreatmentImg from '@/assets/brand/lavi-doctor-treatment.webp';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Upload và suy luận AI trên mạng yếu cần lâu hơn timeout chung của API
const DIAGNOSE_TIMEOUT_MS = 90_000;

interface SupportedCropItem {
  name: string;
  en: string;
  desc: string;
  icon: string;
  color: string;
}

const SUPPORTED_CROPS: SupportedCropItem[] = [
  { name: 'Cà chua', en: 'Tomato', desc: '10 bệnh học', icon: '🍅', color: 'bg-red-50 text-red-600 border border-red-200/60' },
  { name: 'Khoai tây', en: 'Potato', desc: '3 bệnh học', icon: '🥔', color: 'bg-amber-50 text-amber-700 border border-amber-200/60' },
  { name: 'Ngô (Bắp)', en: 'Corn', desc: '4 bệnh học', icon: '🌽', color: 'bg-yellow-50 text-yellow-700 border border-yellow-200/60' },
  { name: 'Cam / Có múi', en: 'Orange', desc: 'Vàng lá Greening', icon: '🍊', color: 'bg-orange-50 text-orange-600 border border-orange-200/60' },
  { name: 'Dâu tây', en: 'Strawberry', desc: '3 bệnh học', icon: '🍓', color: 'bg-rose-50 text-rose-600 border border-rose-200/60' },
  { name: 'Ớt chuông', en: 'Pepper bell', desc: '2 bệnh học', icon: '🫑', color: 'bg-emerald-50 text-emerald-600 border border-emerald-200/60' },
  { name: 'Nho', en: 'Grape', desc: '4 bệnh học', icon: '🍇', color: 'bg-purple-50 text-purple-600 border border-purple-200/60' },
  { name: 'Táo', en: 'Apple', desc: '4 bệnh học', icon: '🍎', color: 'bg-red-50 text-red-600 border border-red-200/60' },
  { name: 'Đào', en: 'Peach', desc: '2 bệnh học', icon: '🍑', color: 'bg-orange-50 text-orange-600 border border-orange-200/60' },
  { name: 'Bí đỏ (Bí ngô)', en: 'Squash', desc: 'Phấn trắng', icon: '🎃', color: 'bg-amber-50 text-amber-600 border border-amber-200/60' },
  { name: 'Đậu nành', en: 'Soybean', desc: 'Đốm vi khuẩn', icon: '🫘', color: 'bg-stone-50 text-stone-700 border border-stone-200/60' },
  { name: 'Anh đào (Cherry)', en: 'Cherry', desc: '2 bệnh học', icon: '🍒', color: 'bg-rose-50 text-rose-700 border border-rose-200/60' },
  { name: 'Mâm xôi', en: 'Raspberry', desc: 'Cây khỏe mạnh', icon: '🫐', color: 'bg-indigo-50 text-indigo-600 border border-indigo-200/60' },
  { name: 'Việt quất', en: 'Blueberry', desc: 'Cây khỏe mạnh', icon: '🫐', color: 'bg-blue-50 text-blue-600 border border-blue-200/60' },
];

async function rotateFileDirectly(file: File, degrees = 90): Promise<{ file: File; url: string }> {
  const norm = ((degrees % 360) + 360) % 360;
  if (norm === 0) return { file, url: URL.createObjectURL(file) };
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const is90or270 = norm === 90 || norm === 270;
  canvas.width = is90or270 ? bitmap.height : bitmap.width;
  canvas.height = is90or270 ? bitmap.width : bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { file, url: URL.createObjectURL(file) };
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((norm * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.95)
  );
  if (!blob) return { file, url: URL.createObjectURL(file) };
  const rotated = new File([blob], file.name, { type: 'image/jpeg' });
  return { file: rotated, url: URL.createObjectURL(blob) };
}

export const DiagnosePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  // Ảnh gốc người dùng chọn (giữ lại để cắt lại) và ảnh đã cắt sẽ gửi đi khám
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [diagnoseData, setDiagnoseData] = useState<DiagnoseResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGradcamInfoOpen, setIsGradcamInfoOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSectionRef = useRef<HTMLDivElement>(null);

  const scrollToUploadSection = () => {
    setTimeout(() => {
      uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  };

  const selectFile = (file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Kích thước tệp vượt quá 10MB. Vui lòng chọn ảnh nhẹ hơn.');
      return;
    }
    // Bắt buộc qua bước cắt: nền ảnh làm mô hình nhận diện sai
    setOriginalFile(file);
    setIsCropping(true);
    setSelectedFile(null);
    setPreviewUrl(null);
    setDiagnoseData(null);
    setErrorMessage(null);
    scrollToUploadSection();
  };

  const handleCropConfirm = async (cropped: File) => {
    try {
      const bitmap = await createImageBitmap(cropped);
      // Nếu chiều cao lớn hơn chiều rộng (lá chụp dọc), tự động xoay ngang 90 độ để khớp trọn khung ngang
      if (bitmap.height > bitmap.width) {
        const { file: rotatedFile, url: rotatedUrl } = await rotateFileDirectly(cropped, 90);
        setSelectedFile(rotatedFile);
        setPreviewUrl(rotatedUrl);
      } else {
        setSelectedFile(cropped);
        setPreviewUrl(URL.createObjectURL(cropped));
      }
    } catch {
      setSelectedFile(cropped);
      setPreviewUrl(URL.createObjectURL(cropped));
    }
    setIsCropping(false);
    scrollToUploadSection();
  };

  const handleRotate = async () => {
    if (!selectedFile) return;
    try {
      const { file: rotatedFile, url: rotatedUrl } = await rotateFileDirectly(selectedFile, 90);
      setSelectedFile(rotatedFile);
      setPreviewUrl(rotatedUrl);
    } catch {
      toast.error('Không thể xoay ảnh này.');
    }
  };

  // Thu hồi object URL cũ khi đổi ảnh hoặc rời trang để không giữ ảnh trong bộ nhớ
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) selectFile(file);
    // Cho phép chọn lại đúng tệp vừa chọn
    e.target.value = '';
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
    setOriginalFile(null);
    setIsCropping(false);
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

  const isHealthy = Boolean(
    diagnoseData?.result?.class_code?.toLowerCase().endsWith('___healthy') ||
    diagnoseData?.result?.disease_name?.toLowerCase().includes('khỏe mạnh')
  );

  return (
    <div className="container mx-auto px-4 py-4 sm:py-6 max-w-5xl space-y-8">
      {/* Khối giới thiệu: nền video lá cây + Lavi 3D */}
      <section className="relative isolate rounded-3xl bg-emerald-950 text-white shadow-lg md:mt-1">
        {/* Nền video nằm trong khung bo góc; riêng Lavi được phép tràn lên trên khung */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl">
          <HeroVideoBackground />
        </div>
        <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-10 md:pr-[22rem] xl:pr-[28rem]">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Miễn phí · Có kết quả sau vài giây
            </span>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Lá cây có vấn đề?
              <br />
              Chụp một tấm, Lavi xem giúp bạn.
            </h1>
            <p className="max-w-xl text-sm text-white/85 sm:text-base">
              Nhận diện bệnh trên 14 loại cây trồng phổ biến, chỉ rõ vùng lá nghi bệnh và gợi ý cách xử lý theo khuyến cáo khuyến nông.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  scrollToUploadSection();
                  fileInputRef.current?.click();
                }}
                className="h-11 bg-white text-emerald-900 hover:bg-emerald-50 font-semibold cursor-pointer"
              >
                <Camera className="mr-2 h-4 w-4" /> Chụp hoặc tải ảnh lá
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 border-white/50 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
              >
                <Link to="/chat">Hỏi trợ lý Lavi</Link>
              </Button>
            </div>
          </div>
        </div>

        {/*
            Lavi nhoài người ra khỏi khung video để vẫy chào:
            - clip-path chỉ cắt mép DƯỚI (thân dưới khuất sau khung), ba phía còn lại để tràn,
              nên lá trên đầu vượt qua mép trên của khung.
            - Lớp ngoài chạy hiệu ứng trồi lên một lần, lớp trong lắc nhẹ liên tục (chỉ khi cho phép chuyển động).
          */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 hidden md:block [clip-path:inset(-60%_-20%_0_-20%)]"
        >
          <div className="absolute bottom-0 -right-2 w-[22rem] translate-y-[14%] xl:-right-8 xl:w-[30rem] xl:translate-y-[15%] motion-safe:animate-[lavi-peek-in_900ms_cubic-bezier(0.22,1,0.36,1)_both]">
            <img
              src={laviHelloImg}
              alt=""
              width={820}
              height={788}
              className="w-full origin-bottom drop-shadow-[0_24px_36px_rgba(0,0,0,0.45)] motion-safe:animate-[lavi-wave_4.5s_ease-in-out_0.9s_infinite]"
            />
          </div>
        </div>
      </section>

      {/* KHỐI 1: BỐ CỤC 2 CỘT (CỘT TRÁI: VÍ DỤ GRAD-CAM SLIDER - CỘT PHẢI: KHUNG TẢI ẢNH LÁ CÂY) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* CỘT TRÁI: VÍ DỤ TƯƠNG TÁC GRAD-CAM HEATMAP (Chiếm 6 cột trên màn lớn) */}
        <div className="lg:col-span-6 flex flex-col">
          <Card className="border border-border/80 bg-card shadow-sm overflow-hidden flex flex-col h-full">
            <div className="h-1.5 w-full bg-tech-stripes border-b border-primary/20" />
            <CardHeader className="pb-2 pt-4 px-4 sm:px-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  {/* Icon bóng đèn ở góc trái trên mở popup giải thích chi tiết */}
                  <button
                    type="button"
                    onClick={() => setIsGradcamInfoOpen(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 border border-amber-500/30 transition-all hover:scale-105 shadow-2xs cursor-pointer shrink-0"
                    title="Bấm để xem giải thích công nghệ Grad-CAM"
                    aria-label="Xem giải thích bản đồ nhiệt Grad-CAM"
                  >
                    <Lightbulb className="h-4.5 w-4.5 fill-amber-500/20" />
                  </button>
                  <div>
                    <CardTitle className="text-base sm:text-lg font-bold text-foreground leading-snug">
                      Bản đồ nhiệt Grad-CAM
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground line-clamp-1">
                      Kéo thanh trượt để so sánh ảnh gốc & vùng AI khoanh bệnh
                    </CardDescription>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 text-right">
                  <span className="text-[11px] font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-secondary border border-border/60">
                    Mẫu: Cà chua
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-primary mt-0.5">
                    Bệnh mốc sương
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-1 flex-1 flex flex-col justify-center">
              <ImageCompare
                originalUrl="/samples/leaf_original.jpg"
                gradcamUrl="/samples/leaf_gradcam.jpg"
                altText="Mẫu lá cà chua bị bệnh mốc sương và bản đồ nhiệt Grad-CAM"
                showDescription={false}
              />
            </CardContent>
          </Card>
        </div>

        {/* CỘT PHẢI: KHUNG TẢI ẢNH LÁ CÂY ĐỂ BẮT ĐẦU KHÁM (Chiếm 6 cột trên màn lớn) */}
        <div ref={uploadSectionRef} className="lg:col-span-6 flex flex-col scroll-mt-20">
          <Card className="relative overflow-hidden border border-border/80 bg-card shadow-sm h-full flex flex-col">
            {/* Dải vạch chéo công nghệ xanh ở đỉnh thẻ */}
            <div className="h-1.5 w-full bg-tech-stripes border-b border-primary/20" />
            <CardHeader className="text-center pb-2 pt-4 px-4 sm:px-5">
              <CardTitle className="text-base sm:text-lg font-bold text-foreground">
                Tải ảnh lá cây để bắt đầu khám
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground line-clamp-1">
                Hỗ trợ JPG, PNG, WEBP. Lá chiếm ≥ 70% khung hình, cự ly 15–20cm
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 pt-1 flex-1 flex flex-col justify-center">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
                id="leaf-upload-input"
              />

              {!previewUrl ? (
                /* TRẠNG THÁI 1: CHƯA CÓ ẢNH - KHUNG KÉO THẢ TẢI ẢNH (aspect-4/3 w-full) */
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative aspect-4/3 w-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/35 bg-linear-to-b from-primary/5 via-secondary/20 to-primary/5 p-4 sm:p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/10 transition-all duration-300 shadow-2xs select-none"
                >
                  {/* 4 Góc nhắm mục tiêu quét quang học AI */}
                  <span className="absolute top-2.5 left-2.5 text-primary/40 font-mono text-xs select-none pointer-events-none">+</span>
                  <span className="absolute top-2.5 right-2.5 text-primary/40 font-mono text-xs select-none pointer-events-none">+</span>
                  <span className="absolute bottom-2.5 left-2.5 text-primary/40 font-mono text-xs select-none pointer-events-none">+</span>
                  <span className="absolute bottom-2.5 right-2.5 text-primary/40 font-mono text-xs select-none pointer-events-none">+</span>

                  <div className="relative mb-2 flex items-center justify-center">
                    <LaviScanVideo size="md" />
                  </div>
                  <p className="text-sm sm:text-base font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                    Nhấn để chọn ảnh hoặc kéo thả ảnh lá vào đây
                  </p>
                  <p className="text-xs text-muted-foreground max-w-xs mb-3 line-clamp-2">
                    Lavi đang sẵn sàng soi kính hiển vi & khoanh vùng tế bào lá nghi bệnh
                  </p>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-card/90 border border-border text-[11px] font-medium text-foreground shadow-2xs">
                    <Camera className="h-3 w-3 text-primary" />
                    <span>Hỗ trợ chụp camera hoặc tải ảnh JPG, PNG, WEBP</span>
                  </div>
                </div>
              ) : (
                /* TRẠNG THÁI 2: ĐÃ CÓ ẢNH ĐÃ CẮT - FULL KHUNG aspect-4/3 VỚI CÁC THÀNH PHẦN NỔI */
                <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl border border-border bg-neutral-950 flex items-center justify-center group shadow-2xs">
                  {/* Ảnh lá đã cắt: hiển thị full 100% bằng object-contain */}
                  <img
                    src={previewUrl}
                    alt="Ảnh lá đã cắt, sẽ gửi đi khám"
                    className="h-full w-full object-contain select-none"
                  />

                  {/* Nút hành động nhanh góc trên phải: Xoay 90°, Cắt lại, Đổi ảnh, Hủy */}
                  <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleRotate}
                      disabled={isLoading}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/75 hover:bg-black text-white text-[11px] font-medium backdrop-blur-sm transition-all shadow-xs cursor-pointer border border-white/10"
                      title="Xoay ảnh 90 độ"
                    >
                      <RotateCw className="h-3 w-3 text-emerald-400" />
                      <span>Xoay 90°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCropping(true)}
                      disabled={isLoading}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/75 hover:bg-black text-white text-[11px] font-medium backdrop-blur-sm transition-all shadow-xs cursor-pointer border border-white/10"
                      title="Cắt lại ảnh lá"
                    >
                      <Crop className="h-3 w-3 text-emerald-300" />
                      <span>Cắt lại</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/75 hover:bg-black text-white text-[11px] font-medium backdrop-blur-sm transition-all shadow-xs cursor-pointer border border-white/10"
                      title="Chọn ảnh khác"
                    >
                      <Camera className="h-3 w-3 text-emerald-300" />
                      <span>Đổi ảnh</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={isLoading}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-black/75 hover:bg-red-600/90 text-white transition-all shadow-xs cursor-pointer border border-white/10"
                      title="Hủy bỏ ảnh này"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Nhãn báo ảnh đã sẵn sàng góc trái */}
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded-full bg-black/75 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm border border-white/10">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Lá đã cắt sẵn sàng</span>
                  </div>

                  {/* Hiệu ứng phân tích của Lavi (Overlay khi đang khám) */}
                  {isLoading && (
                    <div className="absolute inset-0 z-30 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center animate-in fade-in-0 duration-200">
                      <div className="relative flex items-center justify-center mb-3">
                        <div className="absolute h-22 w-22 rounded-full bg-primary/30 blur-md animate-pulse" />
                        <div className="relative h-18 w-18 rounded-full bg-white dark:bg-card border-3 border-primary shadow-2xl flex items-center justify-center overflow-hidden p-1.5 ring-4 ring-primary/20">
                          <LaviScanVideo size="sm" />
                        </div>
                      </div>
                      <div className="bg-card/95 text-foreground border border-border px-4 py-2.5 rounded-2xl shadow-xl max-w-xs space-y-1">
                        <div className="flex items-center justify-center gap-2">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                          </span>
                          <p className="text-sm font-bold text-foreground">
                            Lavi đang soi kính hiển vi...
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground font-medium">
                          Đang khoanh vùng vết bệnh & chuẩn bị phác đồ điều trị
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Cảnh báo lỗi nếu có */}
                  {errorMessage && (
                    <div className="absolute top-11 inset-x-2.5 z-20">
                      <Alert variant="destructive" className="py-2 text-xs bg-destructive/95 text-white border-none shadow-lg">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {/* CỤM ĐIỀU KHIỂN DƯỚI: MASCOT LAVI NHẮC NHỞ + THANH NHẬP MÔ TẢ */}
                  <div className="absolute bottom-2.5 inset-x-2 sm:inset-x-2.5 z-20 flex flex-col gap-1.5 pointer-events-auto">
                    {/* Bong bóng lời thoại truyện tranh của Mascot Lavi */}
                    <div className="flex items-end gap-2 drop-shadow-md">
                      <div className="relative shrink-0">
                        <img
                          src={laviConfusedImg}
                          alt="Lavi suy nghĩ"
                          className="w-10 h-10 sm:w-11 sm:h-11 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] select-none"
                        />
                      </div>
                      <div className="relative rounded-2xl rounded-bl-2xs bg-white dark:bg-neutral-900 text-foreground px-3 py-1.5 shadow-xl border border-primary/40 max-w-[280px] sm:max-w-[340px]">
                        <span className="text-[10px] font-bold text-primary block leading-tight">💬 Lavi mách nhỏ:</span>
                        <span className="text-[11px] font-medium text-foreground leading-snug block">Bạn có thể mô tả thêm để Lavi tự tin hơn nhé!</span>
                      </div>
                    </div>

                    {/* Thanh nhập mô tả rõ ràng + Nút Chẩn đoán ngay */}
                    <div className="p-1.5 sm:p-2 rounded-xl bg-neutral-900/90 dark:bg-black/90 backdrop-blur-md border border-white/20 shadow-xl flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={500}
                        placeholder="Nhập thêm mô tả (vd: cà chua bị đốm đen 2 ngày)..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={isLoading}
                        className="flex-1 bg-white/10 hover:bg-white/15 focus:bg-white focus:text-neutral-900 text-white placeholder:text-white/70 text-xs px-3 py-1.5 rounded-lg border border-white/20 focus:outline-none transition-colors font-medium"
                      />

                      <Button
                        type="button"
                        onClick={handleDiagnose}
                        disabled={isLoading}
                        className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-3.5 sm:px-4 h-8 shrink-0 shadow-sm cursor-pointer"
                      >
                        {isLoading ? (
                          <div className="flex items-center gap-1.5">
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>Đang khám...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4" />
                            <span>Chẩn đoán ngay</span>
                          </div>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CÁC KHỐI THÔNG TIN BỔ TRỢ */}
      <div className="space-y-10 pt-2">
        {/* 1. QUY TRÌNH KHÁM LÁ 3 BƯỚC */}
        <section className="space-y-4">
          <div className="text-center space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Quy trình đơn giản & chuẩn xác
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              3 bước khám bệnh cây trồng thông minh
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
              Chỉ mất vài giây để nhận diện chính xác bệnh hại và tiếp cận ngay phác đồ điều trị chuẩn
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-linear-to-b from-card via-card to-emerald-500/5 p-5 shadow-2xs hover:shadow-md hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center justify-between mb-3.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-emerald-600 to-emerald-700 text-white font-bold text-xs shadow-xs">
                  01
                </span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 transition-transform group-hover:scale-110">
                  <Camera className="h-5 w-5" />
                </div>
              </div>
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                  Chụp hoặc tải ảnh lá cây
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Chụp cận cảnh mặt lá có biểu hiện bệnh ở khoảng cách 15–20cm, đủ ánh sáng và lá chiếm ≥ 70% khung hình.
                </p>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-teal-500/20 bg-linear-to-b from-card via-card to-teal-500/5 p-5 shadow-2xs hover:shadow-md hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center justify-between mb-3.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-teal-600 to-teal-700 text-white font-bold text-xs shadow-xs">
                  02
                </span>
                <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 transition-transform group-hover:scale-110">
                  <Zap className="h-5 w-5" />
                </div>
              </div>
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-foreground group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">
                  AI Vision khoanh vùng tổn thương
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Mạng nơ-ron ResNet-18 đối chiếu với 38 lớp bệnh, bản đồ nhiệt Grad-CAM chỉ rõ vùng lá nghi bệnh sau ≤ 1.5 giây.
                </p>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-linear-to-b from-card via-card to-brand-mint-soft/30 p-5 shadow-2xs hover:shadow-md hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center justify-between mb-3.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-primary to-emerald-800 text-white font-bold text-xs shadow-xs">
                  03
                </span>
                <div className="p-2 rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <Sprout className="h-5 w-5" />
                </div>
              </div>
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                  Nhận phác đồ & Hỗ trợ kỹ thuật
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Xem biện pháp canh tác IPM, thuốc BVTV sinh học/hóa học tuân thủ Thông tư 75, và hỏi thêm Trợ lý Lavi mọi lúc.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 2. 14 LOÀI CÂY TRỒNG ĐƯỢC HỖ TRỢ */}
        <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-linear-to-b from-card via-brand-mint-soft/20 to-card p-6 sm:p-7 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20 mb-2">
                <Leaf className="h-3.5 w-3.5" /> Thư viện nông sản Việt Nam
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-foreground">
                14 Loài cây trồng phổ biến được hỗ trợ
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Hệ thống được huấn luyện chuyên sâu trên 54.000+ mẫu lá bệnh thực nghiệm và tài liệu khuyến nông Việt Nam
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="h-9 px-4 text-xs font-semibold shrink-0 self-start sm:self-auto border-primary/30 hover:bg-primary/10 hover:text-primary transition-all">
              <Link to="/handbook">
                Xem sổ tay bệnh học <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {SUPPORTED_CROPS.map((crop) => (
              <Link
                key={crop.name}
                to={`/handbook?plant=${encodeURIComponent(crop.name)}`}
                className="group relative flex flex-col items-center justify-center p-3.5 rounded-2xl border border-border/80 bg-card hover:bg-linear-to-b hover:from-card hover:to-primary/5 hover:border-primary/50 hover:shadow-md hover:-translate-y-1 transition-all duration-300 text-center"
              >
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl shadow-2xs mb-2 text-2xl transition-transform duration-300 group-hover:scale-115 group-hover:rotate-3", crop.color)}>
                  {crop.icon}
                </div>
                <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors line-clamp-1">
                  {crop.name}
                </span>
                <span className="text-[10px] text-muted-foreground mt-1 px-2 py-0.5 rounded-full bg-secondary/80 font-medium group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  {crop.desc}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* 3. MẸO CHỤP ẢNH & CAM KẾT AN TOÀN NÔNG NGHIỆP */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-linear-to-br from-amber-500/5 via-card to-amber-500/10 p-6 shadow-xs hover:shadow-md transition-shadow">
            <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-amber-400 via-amber-500 to-amber-300" />
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 shadow-2xs">
                <Lightbulb className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground">
                Mẹo chụp ảnh chẩn đoán chuẩn xác
              </h3>
            </div>
            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Chụp khoảng cách <strong className="font-semibold text-foreground bg-amber-500/10 px-1 py-0.5 rounded text-amber-800 dark:text-amber-300">15–20cm</strong>, giữ diện tích lá chiếm từ <strong className="font-semibold text-foreground bg-amber-500/10 px-1 py-0.5 rounded text-amber-800 dark:text-amber-300">≥ 70%</strong> khung hình.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Ưu tiên chọn mặt lá có biểu hiện <strong className="font-semibold text-foreground">đốm bệnh, vết thán thư hoặc vết cháy</strong> rõ nét nhất dưới ánh sáng tự nhiên.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Sử dụng tính năng <strong className="font-semibold text-foreground bg-amber-500/10 px-1 py-0.5 rounded text-amber-800 dark:text-amber-300">Cắt lá (Crop)</strong> tích hợp sẵn để loại bỏ nền đất, bóng râm và vật thể gây nhiễu.
                </span>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-linear-to-br from-primary/5 via-card to-brand-mint-soft/40 p-6 shadow-xs hover:shadow-md transition-shadow">
            <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-emerald-500 via-teal-500 to-brand-mint" />
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-primary/15 text-primary shadow-2xs">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground">
                Cam kết An toàn Nông nghiệp Lavitree
              </h3>
            </div>
            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-status-ok shrink-0 mt-0.5" />
                <span>
                  <strong className="font-semibold text-foreground">100% Thuốc BVTV an toàn</strong>: Tuân thủ nghiêm ngặt danh mục <span className="inline-block bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded text-[11px]">Thông tư 75/2025/TT-BNNMT</span>.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-status-ok shrink-0 mt-0.5" />
                <span>
                  <strong className="font-semibold text-foreground">Thời gian cách ly (PHI)</strong> minh bạch, bắt buộc cho mọi thuốc sinh học & hóa học để bảo đảm vệ sinh an toàn thực phẩm.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-status-ok shrink-0 mt-0.5" />
                <span>
                  <strong className="font-semibold text-foreground">Trợ lý AI Lavi</strong> đồng hành 24/7 giải đáp thắc mắc và hướng dẫn chi tiết quy trình bón phân/phun thuốc.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* POPUP GIẢI THÍCH GRAD-CAM TỪ ICON BÓNG ĐÈN */}
      <Dialog open={isGradcamInfoOpen} onOpenChange={setIsGradcamInfoOpen}>
        <DialogContent className="max-w-md p-5 sm:p-6 bg-card border-border shadow-xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 border border-amber-500/30 shrink-0">
                <Lightbulb className="h-5 w-5 fill-amber-500/20" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-base font-bold text-foreground">
                  Cách Lavi phát hiện bệnh trên lá
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Ý nghĩa các vùng màu sắc giúp bà con dễ dàng nhận biết vết bệnh
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs text-muted-foreground leading-relaxed">
            <div className="rounded-xl bg-muted/60 p-3.5 border border-border/70 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-1 shadow-xs" />
                <p>
                  <strong className="text-foreground">Vùng màu đỏ / vàng cam:</strong> Vị trí lá có đốm nấm, vết cháy hoặc vết bệnh mà Lavi đang chú ý và khoanh vùng cho bà con.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 mt-1 shadow-xs" />
                <p>
                  <strong className="text-foreground">Vùng màu xanh lá / tối:</strong> Phần mặt lá còn xanh tốt, khỏe mạnh hoặc phông nền xung quanh (không có dấu hiệu bệnh).
                </p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground text-center font-medium">
              👉 Bà con dùng ngón tay hoặc chuột kéo thanh trượt giữa ảnh qua lại để so sánh lá thật và vùng khoanh bệnh nhé!
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* POPUP CẮT & CĂN CHỈNH ẢNH LÁ (LeafCropper Modal) */}
      <Dialog
        open={isCropping && !!originalFile}
        onOpenChange={(open) => {
          if (!open) {
            setIsCropping(false);
            if (!previewUrl) {
              setOriginalFile(null);
            }
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-4 sm:p-6 bg-card border-border shadow-2xl overflow-hidden">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-foreground">
              <Crop className="h-4.5 w-4.5 text-primary" />
              Cắt & Căn chỉnh khung hình lá cây
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Kéo các cạnh hoặc góc để thu phóng vừa vặn vết bệnh trên lá. Có thể chọn cắt tự do hoặc vuông 1:1.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-1">
            {originalFile && (
              <LeafCropper
                file={originalFile}
                onConfirm={handleCropConfirm}
                onChooseAnother={() => fileInputRef.current?.click()}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* KHỐI 2: POPUP KẾT QUẢ CHẨN ĐOÁN (Modal Dialog kèm nút quay lại) */}
      <Dialog
        open={!!diagnoseData}
        onOpenChange={(open) => {
          if (!open) handleReset();
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card border-border shadow-2xl">
          {/* Header popup cố định */}
          <DialogHeader className="px-5 py-3.5 border-b border-border bg-muted/40 shrink-0 flex flex-row items-center justify-between gap-3">
            <div className="space-y-0.5 text-left">
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-primary shrink-0" />
                <span>Kết quả chẩn đoán bệnh lá cây</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Hệ thống AI Vision & Bác sĩ cây trồng Lavitree
              </DialogDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-1.5 h-8.5 text-xs font-semibold bg-card border-border hover:bg-muted shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5 text-primary" />
              <span>Quay lại để tải ảnh khác</span>
            </Button>
          </DialogHeader>

          {/* Vùng nội dung cuộn */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {diagnoseData && (
              <>
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
                  <Card className="border-border bg-card shadow-sm p-8 text-center space-y-5">
                    <div className="relative mx-auto flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full bg-status-ood-bg/50 blur-xl scale-75" />
                      <img
                        src={laviConfusedImg}
                        alt="Lavi bối rối chưa nhận diện được lá"
                        className="relative w-36 h-36 object-contain mx-auto drop-shadow-md select-none"
                      />
                    </div>
                    <div className="space-y-2 max-w-lg mx-auto">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-status-ood-bg text-status-ood text-xs font-bold">
                        <AlertTriangle className="h-3.5 w-3.5" /> Không nhận diện được lá cây trồng
                      </div>
                      <h3 className="text-xl font-bold text-foreground">
                        Lavi chưa nhìn rõ lá cây trên ảnh này rồi!
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {diagnoseData.warning ||
                          'Ảnh có thể bị mờ, góc chụp quá xa hoặc chụp nhầm vật thể lạ. Bà con đưa camera cách mặt lá khoảng 15–20cm, lấy nét rõ vào vết bệnh và chụp lại giúp Lavi nhé!'}
                      </p>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="button"
                        onClick={handleReset}
                        className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold px-6 h-10 shadow-sm"
                      >
                        <Camera className="h-4 w-4 mr-2" /> Chụp lại trong khung ngắm 15–20cm
                      </Button>
                    </div>
                  </Card>
                ) : (
                  /* TRƯỜNG HỢP IN-DISTRIBUTION (Ảnh nhận diện hợp lệ) */
                  <div className="space-y-6">
                    {/* BANNER CHÚC MỪNG NẾU CÂY KHỎE MẠNH */}
                    {isHealthy && (
                      <Card className="border-status-ok/40 bg-status-ok-bg/30 shadow-xs overflow-hidden">
                        <div className="p-6 md:p-8 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                          <div className="relative shrink-0">
                            <div className="absolute inset-0 rounded-full bg-status-ok/20 blur-xl scale-90" />
                            <img
                              src={laviHealthyImg}
                              alt="Lavi chúc mừng cây khỏe mạnh"
                              className="relative w-32 h-32 object-contain drop-shadow-md select-none"
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-status-ok/20 text-status-ok text-xs font-bold">
                              <CheckCircle2 className="h-4 w-4" /> Cây trồng hoàn toàn khỏe mạnh
                            </div>
                            <h3 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                              Tuyệt vời! Không phát hiện dấu hiệu bệnh hại trên phiến lá
                            </h3>
                            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl">
                              Hệ thống phân tích cho thấy phiến lá xanh tươi, sắc tố tế bào đồng nhất và không có triệu chứng nấm, vi khuẩn hay virus. Bà con hãy tiếp tục duy trì chế độ chăm sóc và tưới tiêu hợp lý nhé!
                            </p>
                          </div>
                        </div>
                      </Card>
                    )}

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

                    {/* 5. PHÁC ĐỒ XỬ LÝ CHUẨN IPM CÙNG BÁC SĨ LAVI */}
                    {diagnoseData.treatment_guidelines && diagnoseData.treatment_guidelines.length > 0 && (
                      <Card className="border-border bg-card shadow-xs overflow-hidden">
                        <div className="bg-linear-to-r from-primary/10 via-brand-mint-soft/50 to-transparent p-5 md:p-6 border-b border-border/60 flex flex-col sm:flex-row items-center sm:items-start gap-4">
                          <img
                            src={laviDoctorTreatmentImg}
                            alt="Bác sĩ cây trồng Lavi"
                            className="w-20 h-20 sm:w-24 sm:h-24 object-contain shrink-0 drop-shadow-sm select-none"
                          />
                          <div className="space-y-1 text-center sm:text-left">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-bold">
                              <Sparkles className="h-3.5 w-3.5" /> Bác sĩ Lavi chỉ định phác đồ
                            </div>
                            <h3 className="text-base sm:text-lg font-bold text-foreground">
                              Phác đồ can thiệp IPM {diagnoseData.result ? `cho ${diagnoseData.result.plant_name} bị ${diagnoseData.result.disease_name}` : ''}
                            </h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Ưu tiên các biện pháp canh tác và chế phẩm sinh học trước khi dùng thuốc hóa học. Luôn đảm bảo thời gian cách ly (PHI) an toàn.
                            </p>
                          </div>
                        </div>
                        <div className="p-5 md:p-6">
                          <TreatmentSteps steps={diagnoseData.treatment_guidelines} />
                        </div>
                      </Card>
                    )}

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
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DiagnosePage;
