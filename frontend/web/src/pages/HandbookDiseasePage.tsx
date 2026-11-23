import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { safeHref } from '@/lib/utils';
import {
  FileSearch,
  AlertTriangle,
  RotateCcw,
  ShoppingBag,
  Image as ImageIcon,
  ZoomIn,
  ExternalLink,
  MessageSquare,
  Camera,
  X,
  Sprout,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { toast } from 'sonner';

import type {
  DiseaseDetailResponse,
  PublicKnowledgeSource,
  KnowledgeImageItem,
} from '@/features/handbook/types';
import { buildDiseaseArticle } from '@/features/handbook/buildDiseaseArticle';
import { DiseaseHeader } from '@/features/handbook/components/DiseaseHeader';
import { KnowledgeSection } from '@/features/handbook/components/KnowledgeSection';
import { TreatmentSection } from '@/features/handbook/components/TreatmentSection';
import { FaqSection } from '@/features/handbook/components/FaqSection';
import { ReferenceList } from '@/features/handbook/components/ReferenceList';
import { DiseaseToc, type TocItem } from '@/features/handbook/components/DiseaseToc';

const PLANT_PART_LABELS: Record<string, { label: string; badgeColor: string }> = {
  LEAF: { label: 'Lá cây', badgeColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' },
  FRUIT: { label: 'Hoa / Quả', badgeColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' },
  STEM: { label: 'Thân / Cành', badgeColor: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20' },
  WHOLE_PLANT: { label: 'Toàn cây', badgeColor: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20' },
};

// Chuẩn hóa mã lớp AI sang tên tiếng Anh khoa học thân thiện với người nông dân (bỏ ___ và dấu gạch dưới)
const formatEnglishDiseaseName = (code: string): string => {
  if (!code) return '';
  const parts = code.split('___');
  const diseasePart = parts.length > 1 ? parts[1] : parts[0];
  return diseasePart.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
};

export const HandbookDiseasePage: React.FC = () => {
  const { classCode } = useParams<{ classCode: string }>();
  const navigate = useNavigate();

  const [disease, setDisease] = useState<DiseaseDetailResponse | null>(null);
  const [sources, setSources] = useState<PublicKnowledgeSource[]>([]);
  const [images, setImages] = useState<KnowledgeImageItem[]>([]);
  const [allDiseases, setAllDiseases] = useState<Array<{ id: number; classCode: string; plantName: string; commonNameVi: string; pathogenType: string }>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Lỗi riêng khi tải tri thức: không được hiển thị nhầm thành "chưa có tài liệu" (spec 5.4)
  const [knowledgeError, setKnowledgeError] = useState<unknown>(null);
  const [isRetryingKnowledge, setIsRetryingKnowledge] = useState<boolean>(false);

  // Trạng thái lọc ảnh triệu chứng và ảnh phóng to
  const [selectedImagePart, setSelectedImagePart] = useState<string>('ALL');
  const [zoomedImage, setZoomedImage] = useState<KnowledgeImageItem | null>(null);
  const [activeRefIndex, setActiveRefIndex] = useState<number | null>(null);

  const decodedClassCode = useMemo(() => {
    return classCode ? decodeURIComponent(classCode) : '';
  }, [classCode]);

  const isHealthy = useMemo(() => {
    return (
      decodedClassCode.toLowerCase().includes('healthy') ||
      disease?.pathogenType?.toLowerCase().includes('khỏe') === true
    );
  }, [decodedClassCode, disease]);

  const loadData = async () => {
    if (!decodedClassCode) return;
    setIsLoading(true);
    setIsNotFound(false);
    setErrorMessage(null);
    setKnowledgeError(null);

    try {
      const [diseaseRes, sourcesRes, imagesRes, allDiseasesRes] = await Promise.allSettled([
        apiClient.get<DiseaseDetailResponse>(`/diseases/by-class/${encodeURIComponent(decodedClassCode)}`),
        apiClient.get<PublicKnowledgeSource[]>(`/knowledge/sources`, {
          // isApproved=true: Admin đăng nhập cũng chỉ thấy bài đã duyệt, giống nông dân
          params: { modelClass: decodedClassCode, isApproved: true, page: 1, pageSize: 200 },
        }),
        apiClient.get<KnowledgeImageItem[]>(`/knowledge/images`, {
          params: { model_class: decodedClassCode, modelClass: decodedClassCode },
        }),
        apiClient.get<Array<{ id: number; classCode: string; plantName: string; commonNameVi: string; pathogenType: string }>>('/diseases'),
      ]);

      if (diseaseRes.status === 'rejected') {
        const err: any = diseaseRes.reason;
        if (err?.response?.status === 404) {
          setIsNotFound(true);
        } else {
          setErrorMessage(getErrorMessage(err));
        }
        return;
      }

      setDisease(diseaseRes.value.data);

      if (sourcesRes.status === 'fulfilled') {
        const raw = sourcesRes.value.data;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as any)?.items)
            ? (raw as any).items
            : [];
        setSources(list);
      } else {
        // Lỗi riêng phần tri thức không làm đổ vỡ cả trang bệnh, nhưng phải báo lỗi + cho thử lại
        setSources([]);
        setKnowledgeError(sourcesRes.reason);
      }

      if (imagesRes.status === 'fulfilled') {
        const raw = imagesRes.value.data;
        const rawList: KnowledgeImageItem[] = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as any)?.items)
            ? (raw as any).items
            : [];
        // Lọc chính xác chỉ lấy ảnh triệu chứng thuộc đúng mã lớp bệnh (model_class) của bài viết này
        const list = rawList.filter(
          (img) => (img.model_class || (img as any).modelClass) === decodedClassCode
        );
        setImages(list);
      }

      if (allDiseasesRes.status === 'fulfilled' && Array.isArray(allDiseasesRes.value.data)) {
        setAllDiseases(allDiseasesRes.value.data);
      }
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Chỉ tải lại phần tri thức (nút "Thử lại" khi API tri thức lỗi)
  const reloadKnowledge = async () => {
    if (!decodedClassCode || isRetryingKnowledge) return;
    setIsRetryingKnowledge(true);
    try {
      const res = await apiClient.get<PublicKnowledgeSource[]>(`/knowledge/sources`, {
        // isApproved=true: Admin đăng nhập cũng chỉ thấy bài đã duyệt, giống nông dân
        params: { modelClass: decodedClassCode, isApproved: true, page: 1, pageSize: 200 },
      });
      const raw = res.data;
      setSources(Array.isArray(raw) ? raw : Array.isArray((raw as any)?.items) ? (raw as any).items : []);
      setKnowledgeError(null);
    } catch (err) {
      setKnowledgeError(err);
    } finally {
      setIsRetryingKnowledge(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [decodedClassCode]);

  // Cập nhật Document Title
  useEffect(() => {
    if (disease?.commonNameVi) {
      document.title = `${disease.commonNameVi} — Sổ tay Bệnh học LAVITREE`;
    }
    return () => {
      document.title = 'LAVITREE — Bác sĩ Cây trồng Thông minh';
    };
  }, [disease?.commonNameVi]);

  // Ghép bài viết từ các đoạn tri thức đã duyệt
  const article = useMemo(() => {
    return buildDiseaseArticle(sources, { isHealthy });
  }, [sources, isHealthy]);

  // Tách riêng mục TREATMENT (Xử lý) để kết hợp cùng TreatmentPlans
  const treatmentSection = useMemo(() => {
    return article.sections.find((s) => s.unitType === 'TREATMENT');
  }, [article.sections]);

  // Các mục tri thức thông thường (ngoài TREATMENT)
  const regularSections = useMemo(() => {
    return article.sections.filter((s) => s.unitType !== 'TREATMENT');
  }, [article.sections]);

  // Danh sách các bệnh hại khác cùng cây trồng để tham khảo ở cuối bài
  const relatedDiseases = useMemo(() => {
    if (!disease?.plantName || !allDiseases.length) return [];
    return allDiseases.filter(
      (d) =>
        d.plantName.toLowerCase() === disease.plantName.toLowerCase() &&
        d.classCode !== disease.classCode &&
        !d.classCode.endsWith('___healthy') &&
        !d.commonNameVi.toLowerCase().includes('khỏe mạnh')
    ).slice(0, 8);
  }, [allDiseases, disease]);

  // Ảnh lá đại diện dùng cho bố cục kiểu tạp chí/truyện tranh ở mục Tổng quan (nếu có)
  const leafImage = useMemo(() => {
    return images.find((img) => img.plant_part === 'LEAF') || images[0] || null;
  }, [images]);

  // Kiểm tra xem tài liệu đã duyệt có chứa câu hỏi FAQ hay không
  const hasFaq = useMemo(() => {
    return sources.some((s) => {
      const text = s.evidenceText || '';
      return (text.includes('?') || /câu hỏi/i.test(text)) && /(?:^|\n)[^?:\n]{5,140}\?/m.test(text.replace(/[*_#]/g, ''));
    });
  }, [sources]);

  // Xây dựng danh sách mục lục (TOC)
  const tocItems = useMemo<TocItem[]>(() => {
    const list: TocItem[] = [];

    regularSections.forEach((s) => {
      list.push({ id: s.id, label: s.title });
    });

    const hasTreatment = Boolean(treatmentSection && treatmentSection.paragraphs.length > 0);

    if (hasTreatment) {
      list.push({
        id: 'xu-ly',
        label: isHealthy ? 'Quy trình chăm sóc' : 'Biện pháp xử lý & Can thiệp',
      });
    }

    if (hasFaq) {
      list.push({ id: 'faq', label: 'Câu hỏi thường gặp (FAQ)' });
    }

    if (disease?.products && disease.products.length > 0) {
      list.push({ id: 'thuoc-tham-khao', label: 'Thuốc BVTV & Chế phẩm tham khảo' });
    }

    if (relatedDiseases.length > 0) {
      list.push({ id: 'benh-tham-khao', label: 'Bệnh tham khảo khác' });
    }

    if (article.references.length > 0) {
      list.push({ id: 'nguon-tham-khao', label: 'Nguồn tài liệu tham khảo' });
    }

    return list;
  }, [regularSections, treatmentSection, disease, relatedDiseases.length, article.references.length, isHealthy]);

  // Nhảy tới mục nguồn [n] và nháy sáng
  const handleRefClick = (refIndex: number) => {
    const el = document.getElementById(`nguon-${refIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setActiveRefIndex(refIndex);
      setTimeout(() => {
        setActiveRefIndex(null);
      }, 2000);
    }
  };

  // ================= 1. TRẠNG THÁI LOADING =================
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8 animate-pulse">
        <div className="space-y-3">
          <Skeleton className="h-5 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-10 w-3/4 max-w-md" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
          <div className="space-y-6">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-36 w-full rounded-2xl" />
          </div>
          <div className="hidden lg:block space-y-4">
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // ================= 2. TRẠNG THÁI 404 KHÔNG TÌM THẤY =================
  if (isNotFound) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-xl text-center">
        <EmptyState
          icon={<FileSearch className="w-12 h-12 text-muted-foreground" />}
          title="Không tìm thấy thông tin bệnh"
          description={`Mã lớp bệnh "${decodedClassCode}" không tồn tại hoặc đã được chuyển sang danh mục khác.`}
          actionText="Quay lại danh mục Sổ tay"
          onAction={() => navigate('/handbook')}
        />
      </div>
    );
  }

  // ================= 3. TRẠNG THÁI LỖI MẠNG =================
  if (errorMessage || !disease) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-xl text-center space-y-4">
        <div className="p-4 rounded-2xl border border-destructive/30 bg-destructive/5 text-destructive space-y-2">
          <AlertTriangle className="h-6 w-6 mx-auto" />
          <h2 className="font-bold text-base">Không thể tải dữ liệu bệnh học</h2>
          <p className="text-xs text-muted-foreground">{errorMessage || 'Lỗi không xác định.'}</p>
        </div>
        <Button onClick={loadData} variant="outline" className="text-xs gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Thử tải lại</span>
        </Button>
      </div>
    );
  }

  const hasApprovedKnowledge = article.totalApprovedParagraphs > 0;
  const filteredImages = images.filter(
    (img) => selectedImagePart === 'ALL' || img.plant_part === selectedImagePart
  );

  return (
    <div className="container mx-auto px-4 py-3 md:py-4 max-w-6xl space-y-4">
      {/* Tiêu đề trang, breadcrumb & thông tin tác nhân */}
      <DiseaseHeader
        commonNameVi={disease.commonNameVi}
        plantName={disease.plantName}
        classCode={disease.classCode}
        pathogenType={disease.pathogenType}
        pathogenName={disease.pathogenName}
        severityLevel={disease.severityLevel}
        totalApprovedParagraphs={article.totalApprovedParagraphs}
        totalUniqueSources={article.totalUniqueSources}
        latestUpdatedAt={article.latestUpdatedAt}
        isHealthy={isHealthy}
      />

      {/* Thanh mục lục cho thiết bị di động */}
      {/* Chỉ dùng trên mobile/tablet; desktop đã có cột phụ bên phải (tránh hiện 2 mục lục).
          `contents` giữ thanh chip sticky theo trang thay vì theo khung bọc. */}
      {tocItems.length > 0 && (
        <div className="contents lg:hidden">
          <DiseaseToc
            items={tocItems}
            classCode={disease.classCode}
            captureTip={disease.captureTip}
          />
        </div>
      )}

      {/* Bố cục 2 cột (Desktop): Nội dung chính (trái) + Cột phụ dính (phải) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-6 items-start">
        {/* ================= CỘT NỘI DUNG CHÍNH ================= */}
        <div className="space-y-6 min-w-0">
          {/* TRƯỜNG HỢP 0 ĐOẠN ĐÃ DUYỆT: Hiển thị EmptyState trung thực */}
          {knowledgeError ? (
            <ErrorState
              title="Không tải được tài liệu của bệnh này"
              error={knowledgeError}
              onRetry={reloadKnowledge}
              retryText={isRetryingKnowledge ? 'Đang tải lại…' : 'Thử lại'}
              className="my-0 max-w-none"
            />
          ) : !hasApprovedKnowledge ? (
            <div className="rounded-2xl border border-border bg-card p-6 md:p-8 text-center space-y-4 shadow-2xs">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary">
                <FileSearch className="h-6 w-6" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-base font-bold text-foreground">
                  Chưa có tài liệu đã kiểm duyệt cho bệnh này
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Đội ngũ chuyên gia Lavitree đang thu thập và biên tập tài liệu từ các cơ quan khuyến nông. Bạn vẫn có thể hỏi trực tiếp Trợ lý Lavi hoặc tải ảnh để khám lá ngay.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button asChild size="sm" className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold h-9 shadow-xs">
                  <Link to={`/chat?class_code=${encodeURIComponent(disease.classCode)}`}>
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                    Hỏi Trợ lý Lavi
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="text-xs font-semibold h-9 border-border">
                  <Link to="/">
                    <Camera className="h-3.5 w-3.5 mr-1.5 text-primary" />
                    Khám lá bằng AI
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            /* TRƯỜNG HỢP CÓ BÀI ĐÃ DUYỆT: Render các mục Tổng quan, Triệu chứng, Nguyên nhân, Phòng ngừa */
            <div className="space-y-6">
              {regularSections.map((sec) => (
                <KnowledgeSection
                  key={sec.id}
                  section={sec}
                  onRefClick={handleRefClick}
                  symptomImages={sec.id === 'trieu-chung' ? images : undefined}
                  featuredImage={sec.id === 'tong-quan' ? leafImage : undefined}
                  onImageClick={(img) => setZoomedImage(img)}
                />
              ))}
            </div>
          )}

          {/* MỤC XỬ LÝ (TREATMENT KIỂM DUYỆT) */}
          <TreatmentSection
            section={treatmentSection}
            onRefClick={handleRefClick}
            isHealthy={isHealthy}
          />

          {/* MỤC CÂU HỎI THƯỜNG GẶP & GIẢI ĐÁP KỸ THUẬT (FAQ) */}
          <FaqSection
            plantName={disease.plantName}
            diseaseName={disease.commonNameVi}
            pathogenType={disease.pathogenType}
            sources={sources}
            isHealthy={isHealthy}
          />

          {/* MỤC BỆNH HẠI THAM KHẢO KHÁC TRÊN CÙNG CÂY TRỒNG */}
          {relatedDiseases.length > 0 && (
            <section id="benh-tham-khao" className="space-y-4 scroll-mt-24">
              <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Sprout className="h-4 w-4" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground">
                  Các bệnh hại tham khảo khác trên cây {disease.plantName} ({relatedDiseases.length})
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {relatedDiseases.map((rel) => (
                  <Link
                    key={rel.id}
                    to={`/handbook/${encodeURIComponent(rel.classCode)}`}
                    className="group block p-3.5 rounded-xl border border-border bg-card shadow-2xs hover:border-primary/50 hover:shadow-xs transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                        {rel.pathogenType || 'Bệnh hại'}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {rel.commonNameVi}
                    </h3>
                    {formatEnglishDiseaseName(rel.classCode) && (
                      <p className="text-[11px] text-muted-foreground italic mt-0.5 truncate">
                        Tên tiếng Anh: {formatEnglishDiseaseName(rel.classCode)}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* MỤC THUỐC THAM KHẢO */}
          {disease.products && disease.products.length > 0 && (
            <section id="thuoc-tham-khao" className="space-y-4 scroll-mt-24">
              <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground">
                  Thuốc bảo vệ thực vật & Chế phẩm sinh học tham khảo ({disease.products.length})
                </h2>
              </div>

              {/* Dòng ghi chú đối chiếu BUG-51 */}
              <p className="text-xs text-muted-foreground">
                Danh mục đang được đối chiếu với văn bản hiện hành (Thông tư 75/2025/TT-BNNMT). Chỉ mang tính chất tham khảo kỹ thuật.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {disease.products.map((prod) => (
                  <Card key={prod.id} className="border-border bg-card shadow-2xs hover:border-primary/40 transition-colors flex flex-col justify-between">
                    <CardHeader className="p-4 pb-2 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm font-bold text-foreground line-clamp-1">
                          {prod.name}
                        </CardTitle>
                        <span className="text-xs font-bold text-primary shrink-0 tabular-nums">
                          {prod.price > 0 ? `${prod.price.toLocaleString('vi-VN')} đ` : 'Tư vấn kỹ thuật'}
                        </span>
                      </div>
                      {prod.activeIngredient && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1">
                          Hoạt chất: <span className="font-medium text-foreground">{prod.activeIngredient}</span>
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="p-4 pt-1 space-y-3">
                      {prod.dosageInstruction && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {prod.dosageInstruction}
                        </p>
                      )}
                      <div className="pt-2 border-t border-border/50">
                        <Button asChild variant="outline" size="sm" className="w-full text-xs font-semibold h-10 lg:h-8 border-border hover:bg-primary/10 hover:text-primary">
                          <Link to="/store">
                            <ShoppingBag className="h-3 w-3 mr-1.5" />
                            Xem trong cửa hàng
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* MỤC NGUỒN TÀI LIỆU THAM KHẢO ĐÁNH SỐ */}
          <ReferenceList
            references={article.references}
            activeRefIndex={activeRefIndex}
          />
        </div>

        {/* ================= CỘT PHỤ (DESKTOP STICKY) ================= */}
        <aside className="hidden lg:block sticky top-20">
          <DiseaseToc
            items={tocItems}
            classCode={disease.classCode}
            captureTip={disease.captureTip}
          />
        </aside>
      </div>

      {/* ================= MODAL PHÓNG TO ẢNH TRIỆU CHỨNG (GỌN GÀNG, KHÔNG TRÀN TOÀN MÀN HÌNH) ================= */}
      {zoomedImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="relative max-w-md sm:max-w-lg w-full max-h-[85vh] bg-card rounded-2xl overflow-hidden shadow-2xl border border-border flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Khung ảnh thu gọn gọn gàng, giới hạn chiều cao tránh choán màn hình */}
            <div className="relative w-full h-64 sm:h-72 bg-zinc-950/95 flex items-center justify-center p-2 overflow-hidden shrink-0">
              <img
                src={zoomedImage.image_url}
                alt={zoomedImage.caption}
                className="max-h-full max-w-full object-contain rounded-md"
              />
              <button
                type="button"
                onClick={() => setZoomedImage(null)}
                aria-label="Đóng ảnh"
                className="absolute top-2.5 right-2.5 rounded-full bg-black/60 hover:bg-black/90 p-1.5 text-white transition-colors cursor-pointer shadow-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Thông tin chú thích & nguồn ảnh */}
            <div className="p-3.5 sm:p-4 space-y-2 text-xs overflow-y-auto">
              <p className="font-semibold text-xs sm:text-sm text-foreground leading-snug">
                {zoomedImage.caption}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground pt-1.5 border-t border-border/50 text-[11px]">
                <span>Bộ phận: <strong>{PLANT_PART_LABELS[zoomedImage.plant_part]?.label || zoomedImage.plant_part}</strong></span>
                <span>Nguồn: <strong>{zoomedImage.credit}</strong></span>
                {safeHref(zoomedImage.source_url) && (
                  <a
                    href={safeHref(zoomedImage.source_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                  >
                    <span>Xem link gốc</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HandbookDiseasePage;
