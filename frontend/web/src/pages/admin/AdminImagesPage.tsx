import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search,
  RefreshCw,
  Plus,
  Image as ImageIcon,
  ZoomIn,
  ExternalLink,
  Trash2,
  Link as LinkIcon,
  UploadCloud,
} from 'lucide-react';
import { toast } from 'sonner';
import type { KnowledgeImageItem } from '@/features/admin/types';
import { formatTopicLabel } from '@/features/admin/lib';
import { useDiseaseOptions } from '@/features/admin/hooks';

export const AdminImagesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { diseases, uniquePlants } = useDiseaseOptions();

  // Danh sách ảnh & lọc
  const [knowledgeImages, setKnowledgeImages] = useState<KnowledgeImageItem[]>([]);
  const [loadingImages, setLoadingImages] = useState<boolean>(false);
  const [imageFilterPlant, setImageFilterPlant] = useState<string>('ALL');
  const [imageFilterClass, setImageFilterClass] = useState<string>('ALL');
  const [imageFilterPart, setImageFilterPart] = useState<string>('ALL');
  const [imageFilterApproval, setImageFilterApproval] = useState<'ALL' | 'APPROVED' | 'PENDING'>('ALL');
  const [imageSearch, setImageSearch] = useState<string>('');

  // Dialog Thêm ảnh mới
  const [addImageModalOpen, setAddImageModalOpen] = useState<boolean>(false);
  const [submittingImage, setSubmittingImage] = useState<boolean>(false);
  const [newImagePlant, setNewImagePlant] = useState<string>('Cà chua');
  const [newImageClass, setNewImageClass] = useState<string>('Tomato___Late_blight');
  const [newImageSourceUrl, setNewImageSourceUrl] = useState<string>('');
  const [newImageMode, setNewImageMode] = useState<'FILE' | 'URL'>('URL');
  const [newImageUrl, setNewImageUrl] = useState<string>('');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImageFilePreview, setNewImageFilePreview] = useState<string | null>(null);
  const [newImageFilePreviews, setNewImageFilePreviews] = useState<string[]>([]);
  const [newImageCaption, setNewImageCaption] = useState<string>('');
  const [newImagePlantPart, setNewImagePlantPart] = useState<string>('LEAF');
  const [newImageCredit, setNewImageCredit] = useState<string>('');
  const [newImageLicenseNote, setNewImageLicenseNote] = useState<string>(
    'Trích dẫn phục vụ học thuật và hướng dẫn nông vụ khuyến nông'
  );
  const [newImageAutoApprove, setNewImageAutoApprove] = useState<boolean>(true);

  // Dialog Xem / Xóa ảnh
  const [deleteImageTarget, setDeleteImageTarget] = useState<KnowledgeImageItem | null>(null);
  const [deletingImage, setDeletingImage] = useState<boolean>(false);
  const [previewingImage, setPreviewingImage] = useState<KnowledgeImageItem | null>(null);

  // Xử lý query params khi mở trang (ví dụ từ nút "Thêm ảnh triệu chứng từ bài này")
  useEffect(() => {
    const add = searchParams.get('add');
    const plant = searchParams.get('plant');
    const classCode = searchParams.get('classCode');
    const sourceUrl = searchParams.get('sourceUrl');
    const credit = searchParams.get('credit');

    if (plant) setNewImagePlant(plant);
    if (classCode) setNewImageClass(classCode);
    if (sourceUrl) setNewImageSourceUrl(sourceUrl);
    if (credit) setNewImageCredit(credit);
    if (add === 'true') {
      setAddImageModalOpen(true);
    }
  }, [searchParams]);

  // Đồng bộ default plant & class khi danh mục tải xong
  useEffect(() => {
    if (uniquePlants.length > 0 && !searchParams.get('plant')) {
      const defaultPlant = uniquePlants.includes('Cà chua') ? 'Cà chua' : uniquePlants[0];
      setNewImagePlant(defaultPlant);
      const match = diseases.find((d) => d.plantName === defaultPlant);
      if (match && !searchParams.get('classCode')) {
        setNewImageClass(match.classCode);
      }
    }
  }, [uniquePlants, diseases, searchParams]);

  const fetchKnowledgeImages = async () => {
    try {
      setLoadingImages(true);
      const params: Record<string, string | boolean> = {};
      if (imageFilterClass !== 'ALL') params.model_class = imageFilterClass;
      if (imageFilterPart !== 'ALL') params.plant_part = imageFilterPart;
      if (imageFilterApproval === 'APPROVED') params.is_approved = true;
      if (imageFilterApproval === 'PENDING') params.is_approved = false;
      if (imageSearch.trim()) params.search = imageSearch.trim();

      const res = await apiClient.get<KnowledgeImageItem[]>('/knowledge/images', { params });
      setKnowledgeImages(res.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingImages(false);
    }
  };

  useEffect(() => {
    fetchKnowledgeImages();
  }, [imageFilterClass, imageFilterPart, imageFilterApproval]);

  const handleToggleApproveImage = async (img: KnowledgeImageItem) => {
    try {
      const nextApproved = !img.is_manual_approved;
      await apiClient.patch(`/knowledge/images/${img.id}/approve`, {
        is_approved: nextApproved,
      });
      setKnowledgeImages((prev) =>
        prev.map((item) => (item.id === img.id ? { ...item, is_manual_approved: nextApproved } : item))
      );
      toast.success(nextApproved ? 'Đã duyệt ảnh triệu chứng.' : 'Đã chuyển ảnh về trạng thái chờ duyệt.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDeleteImage = async () => {
    if (!deleteImageTarget) return;
    try {
      setDeletingImage(true);
      await apiClient.delete(`/knowledge/images/${deleteImageTarget.id}`);
      setKnowledgeImages((prev) => prev.filter((item) => item.id !== deleteImageTarget.id));
      toast.success('Đã gỡ ảnh triệu chứng thành công.');
      setDeleteImageTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingImage(false);
    }
  };

  const parsedImageUrls = useMemo(() => {
    if (!newImageUrl.trim()) return [];
    return newImageUrl
      .split(/[\n,;]+/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u));
  }, [newImageUrl]);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const validFiles = files.filter((file) => validTypes.includes(file.type) && file.size <= 10 * 1024 * 1024);
    if (validFiles.length < files.length) {
      toast.warning('Một số tệp không phải JPG, PNG, WEBP hoặc dung lượng > 10MB đã bị bỏ qua.');
    }
    if (validFiles.length === 0) {
      toast.error('Không có tệp ảnh hợp lệ nào được chọn.');
      return;
    }
    setNewImageFiles(validFiles);
    setNewImageFile(validFiles[0]);
    const previews = validFiles.map((f) => URL.createObjectURL(f));
    setNewImageFilePreviews(previews);
    setNewImageFilePreview(previews[0]);
  };

  const handleCreateKnowledgeImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImageClass) {
      toast.error('Vui lòng chọn bệnh hại mục tiêu.');
      return;
    }
    if (!newImageSourceUrl || !newImageSourceUrl.startsWith('http')) {
      toast.error('URL bài viết gốc phải bắt đầu bằng http:// hoặc https://');
      return;
    }
    if (!newImageCaption.trim()) {
      toast.error('Vui lòng nhập mô tả / chú thích triệu chứng.');
      return;
    }
    if (!newImageCredit.trim()) {
      toast.error('Vui lòng nhập nguồn ảnh / tác giả sở hữu.');
      return;
    }

    setSubmittingImage(true);
    try {
      const createdImages: KnowledgeImageItem[] = [];
      let successCount = 0;

      if (newImageMode === 'URL') {
        const urlsToProcess =
          parsedImageUrls.length > 0 ? parsedImageUrls : newImageUrl.trim() ? [newImageUrl.trim()] : [];
        if (urlsToProcess.length === 0) {
          toast.error('Vui lòng nhập ít nhất 1 URL ảnh trực tiếp https://.');
          setSubmittingImage(false);
          return;
        }

        for (const url of urlsToProcess) {
          try {
            const formData = new FormData();
            formData.append('ModelClass', newImageClass);
            formData.append('SourceUrl', newImageSourceUrl.trim());
            formData.append('Caption', newImageCaption.trim());
            formData.append('PlantPart', newImagePlantPart);
            formData.append('Credit', newImageCredit.trim());
            if (newImageLicenseNote.trim()) formData.append('LicenseNote', newImageLicenseNote.trim());
            formData.append('IsManualApproved', newImageAutoApprove ? 'true' : 'false');
            formData.append('ImageUrl', url);

            const res = await apiClient.post<KnowledgeImageItem>('/knowledge/images', formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            createdImages.push(res.data);
            successCount++;
          } catch (err) {
            console.error('Lỗi lưu ảnh URL:', url, err);
          }
        }
      } else {
        const filesToProcess =
          newImageFiles.length > 0 ? newImageFiles : newImageFile ? [newImageFile] : [];
        if (filesToProcess.length === 0) {
          toast.error('Vui lòng chọn ít nhất 1 tệp ảnh từ thiết bị để tải lên.');
          setSubmittingImage(false);
          return;
        }

        for (const f of filesToProcess) {
          try {
            const formData = new FormData();
            formData.append('ModelClass', newImageClass);
            formData.append('SourceUrl', newImageSourceUrl.trim());
            formData.append('Caption', newImageCaption.trim());
            formData.append('PlantPart', newImagePlantPart);
            formData.append('Credit', newImageCredit.trim());
            if (newImageLicenseNote.trim()) formData.append('LicenseNote', newImageLicenseNote.trim());
            formData.append('IsManualApproved', newImageAutoApprove ? 'true' : 'false');
            formData.append('File', f);

            const res = await apiClient.post<KnowledgeImageItem>('/knowledge/images', formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            createdImages.push(res.data);
            successCount++;
          } catch (err) {
            console.error('Lỗi tải tệp ảnh:', f.name, err);
          }
        }
      }

      if (successCount > 0) {
        toast.success(`Đã thêm thành công ${successCount} ảnh triệu chứng!`);
        setKnowledgeImages((prev) => [...createdImages, ...prev]);
        setAddImageModalOpen(false);

        // Reset form
        setNewImageUrl('');
        setNewImageFile(null);
        setNewImageFiles([]);
        setNewImageFilePreview(null);
        setNewImageFilePreviews([]);
        setNewImageCaption('');
      } else {
        toast.error('Không thể lưu ảnh nào. Vui lòng kiểm tra lại URL hoặc tệp ảnh.');
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmittingImage(false);
    }
  };

  const filteredKnowledgeImages = useMemo(() => {
    return knowledgeImages.filter((img) => {
      if (imageFilterPlant !== 'ALL') {
        const matchDisease = diseases.find((d) => d.classCode === img.model_class);
        if (matchDisease && matchDisease.plantName !== imageFilterPlant) return false;
      }
      if (!imageSearch.trim()) return true;
      const q = imageSearch.toLowerCase();
      return (
        img.caption?.toLowerCase().includes(q) ||
        img.credit?.toLowerCase().includes(q) ||
        img.disease_name?.toLowerCase().includes(q) ||
        img.plant_name?.toLowerCase().includes(q) ||
        img.source_url?.toLowerCase().includes(q)
      );
    });
  }, [knowledgeImages, imageFilterPlant, diseases, imageSearch]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Ảnh triệu chứng thực địa
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý kho ảnh triệu chứng bệnh cây (lá, quả, thân, toàn cây) hiển thị trên Sổ tay bệnh học và đối chiếu chẩn đoán.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Toolbar lọc và nút thêm */}
        <div className="bg-card p-4 rounded-xl border border-border shadow-xs flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between text-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative min-w-[200px] flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Tìm theo chú thích, tác giả, nguồn..."
                value={imageSearch}
                onChange={(e) => setImageSearch(e.target.value)}
                className="pl-9 h-8 text-xs bg-background"
              />
            </div>

            {/* Lọc Cây trồng */}
            <select
              aria-label="Lọc theo loài cây trồng"
              value={imageFilterPlant}
              onChange={(e) => {
                setImageFilterPlant(e.target.value);
                setImageFilterClass('ALL');
              }}
              className="h-8 px-2.5 rounded-md border border-input bg-background text-foreground text-xs font-medium cursor-pointer"
            >
              <option value="ALL">Tất cả loài cây ({uniquePlants.length})</option>
              {uniquePlants.map((plant) => (
                <option key={plant} value={plant}>
                  {plant}
                </option>
              ))}
            </select>

            {/* Lọc Bệnh hại */}
            <select
              aria-label="Lọc theo bệnh hại"
              value={imageFilterClass}
              onChange={(e) => setImageFilterClass(e.target.value)}
              className="h-8 px-2.5 rounded-md border border-input bg-background text-foreground text-xs font-medium cursor-pointer max-w-[220px] truncate"
            >
              <option value="ALL">Tất cả bệnh hại</option>
              {diseases
                .filter((d) => imageFilterPlant === 'ALL' || d.plantName === imageFilterPlant)
                .map((d) => (
                  <option key={d.classCode} value={d.classCode}>
                    {d.plantName} — {formatTopicLabel(d.commonNameVi, d.classCode)}
                  </option>
                ))}
            </select>

            {/* Lọc Bộ phận cây */}
            <select
              aria-label="Lọc theo bộ phận cây"
              value={imageFilterPart}
              onChange={(e) => setImageFilterPart(e.target.value)}
              className="h-8 px-2.5 rounded-md border border-input bg-background text-foreground text-xs font-medium cursor-pointer"
            >
              <option value="ALL">Tất cả bộ phận</option>
              <option value="LEAF">Lá cây</option>
              <option value="FRUIT">Quả / Hoa</option>
              <option value="STEM">Thân / Cành</option>
              <option value="WHOLE_PLANT">Toàn cây</option>
            </select>

            {/* Lọc Trạng thái duyệt */}
            <select
              aria-label="Lọc theo trạng thái duyệt ảnh"
              value={imageFilterApproval}
              onChange={(e) => setImageFilterApproval(e.target.value as any)}
              className="h-8 px-2.5 rounded-md border border-input bg-background text-foreground text-xs font-medium cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="PENDING">Chờ duyệt</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchKnowledgeImages}
              disabled={loadingImages}
              className="gap-1.5 h-8 text-xs bg-background"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingImages ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setNewImagePlant(imageFilterPlant !== 'ALL' ? imageFilterPlant : uniquePlants[0] ?? 'Cà chua');
                setNewImageClass(
                  imageFilterClass !== 'ALL' ? imageFilterClass : diseases[0]?.classCode || 'Tomato___Late_blight'
                );
                setNewImageSourceUrl('');
                setNewImageCredit('');
                setAddImageModalOpen(true);
              }}
              className="gap-1.5 h-8 text-xs bg-primary hover:bg-primary-hover text-white font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm ảnh triệu chứng</span>
            </Button>
          </div>
        </div>

        {/* Danh sách ảnh triệu chứng */}
        {loadingImages ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-card border border-border p-4 animate-pulse space-y-3" />
            ))}
          </div>
        ) : filteredKnowledgeImages.length === 0 ? (
          <Card className="border-dashed border-2 p-12 text-center bg-card">
            <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/60 mb-3" />
            <h4 className="text-base font-bold text-foreground">Chưa có ảnh triệu chứng nào</h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">
              Kho ảnh triệu chứng giúp nông dân đối chiếu thực tế khi xem sổ tay và trợ lý tư vấn. Bạn có thể thêm ảnh bằng cách tải tệp lên hoặc nhập link HTTPS.
            </p>
            <Button
              size="sm"
              onClick={() => {
                setNewImagePlant(imageFilterPlant !== 'ALL' ? imageFilterPlant : uniquePlants[0] ?? 'Cà chua');
                setNewImageClass(
                  imageFilterClass !== 'ALL' ? imageFilterClass : diseases[0]?.classCode || 'Tomato___Late_blight'
                );
                setNewImageSourceUrl('');
                setNewImageCredit('');
                setAddImageModalOpen(true);
              }}
              className="gap-1.5 text-xs bg-primary text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm ảnh đầu tiên</span>
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredKnowledgeImages.map((img) => (
              <Card
                key={img.id}
                className="overflow-hidden border-border bg-card flex flex-col justify-between hover:border-primary/50 transition-all shadow-2xs group"
              >
                <div
                  className="relative aspect-4/3 w-full bg-muted cursor-pointer overflow-hidden"
                  onClick={() => setPreviewingImage(img)}
                >
                  <img
                    src={img.image_url}
                    alt={img.caption}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="%23999"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12">Lỗi tải ảnh</text></svg>';
                    }}
                  />
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    <span className="inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold bg-black/60 text-white backdrop-blur-xs">
                      {img.plant_part === 'LEAF'
                        ? 'Lá'
                        : img.plant_part === 'FRUIT'
                          ? 'Quả/Hoa'
                          : img.plant_part === 'STEM'
                            ? 'Thân/Cành'
                            : 'Toàn cây'}
                    </span>
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] font-semibold border ${
                        img.is_manual_approved
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {img.is_manual_approved ? 'Đã duyệt' : 'Chờ duyệt'}
                    </Badge>
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="rounded-full bg-black/70 p-2 text-white shadow-md">
                      <ZoomIn className="h-4 w-4" />
                    </span>
                  </div>
                </div>

                <CardContent className="p-3.5 space-y-2 flex-1 flex flex-col justify-between text-xs">
                  <div className="space-y-1">
                    <div
                      className="text-[11px] font-bold text-primary truncate"
                      title={`${img.plant_name} — ${img.disease_name}`}
                    >
                      {img.plant_name} — {img.disease_name}
                    </div>
                    <p className="text-foreground text-xs font-medium line-clamp-2 leading-snug">
                      {img.caption}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span className="truncate max-w-[150px]" title={img.credit}>
                        Nguồn: <strong>{img.credit}</strong>
                      </span>
                      {img.source_url && (
                        <a
                          href={img.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-primary hover:underline font-semibold"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span>Bài gốc</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleApproveImage(img)}
                        className={`h-7 px-2 text-[11px] font-semibold ${
                          img.is_manual_approved
                            ? 'text-amber-700 hover:bg-amber-500/10 dark:text-amber-400'
                            : 'text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400'
                        }`}
                      >
                        {img.is_manual_approved ? 'Bỏ duyệt' : 'Duyệt ảnh'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteImageTarget(img)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Xóa ảnh triệu chứng"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================================= */}
      {/* DIALOG THÊM ẢNH TRIỆU CHỨNG MỚI */}
      {/* ========================================================================================= */}
      <Dialog open={addImageModalOpen} onOpenChange={setAddImageModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" />
              <span>Thêm ảnh triệu chứng thực địa</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ảnh triệu chứng theo bộ phận (lá, quả, thân, toàn cây) hiển thị trên Sổ tay bệnh học và đối chiếu chẩn đoán.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateKnowledgeImage} className="space-y-4 py-2 text-xs">
            {/* Lớp bệnh mục tiêu (2 dropdown: Cây & Bệnh) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">1. Loài cây trồng *</label>
                <select
                  aria-label="Chọn loài cây trồng"
                  value={newImagePlant}
                  onChange={(e) => {
                    const p = e.target.value;
                    setNewImagePlant(p);
                    const match = diseases.find((d) => d.plantName === p);
                    if (match) setNewImageClass(match.classCode);
                  }}
                  className="h-9 w-full px-2.5 rounded-md border border-input bg-background text-xs cursor-pointer"
                >
                  {uniquePlants.map((plant) => (
                    <option key={plant} value={plant}>
                      {plant}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">2. Bệnh hại mục tiêu *</label>
                <select
                  aria-label="Chọn bệnh hại mục tiêu"
                  value={newImageClass}
                  onChange={(e) => setNewImageClass(e.target.value)}
                  className="h-9 w-full px-2.5 rounded-md border border-input bg-background text-xs cursor-pointer truncate"
                >
                  {diseases
                    .filter((d) => d.plantName === newImagePlant)
                    .map((d) => (
                      <option key={d.classCode} value={d.classCode}>
                        {formatTopicLabel(d.commonNameVi, d.classCode)}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Bộ phận cây */}
            <div>
              <label className="font-semibold block mb-1">3. Bộ phận cây nhiễm bệnh *</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'LEAF', label: 'Lá cây' },
                  { id: 'FRUIT', label: 'Hoa / Quả' },
                  { id: 'STEM', label: 'Thân / Cành' },
                  { id: 'WHOLE_PLANT', label: 'Toàn cây' },
                ].map((part) => (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => setNewImagePlantPart(part.id)}
                    className={`rounded-lg py-1.5 px-2 text-xs font-semibold border transition-all ${
                      newImagePlantPart === part.id
                        ? 'bg-primary text-white border-primary shadow-2xs'
                        : 'bg-secondary text-foreground border-border hover:bg-secondary/80'
                    }`}
                  >
                    {part.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chọn phương thức tải ảnh: HTTPS URL vs Upload File */}
            <div className="space-y-2 rounded-xl border border-border p-3 bg-secondary/20">
              <label className="font-semibold block">4. Nguồn cung cấp ảnh *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewImageMode('URL')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                    newImageMode === 'URL'
                      ? 'bg-primary text-white border-primary shadow-2xs'
                      : 'bg-background text-foreground border-border hover:bg-muted'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" /> Dán HTTPS URL ảnh
                </button>
                <button
                  type="button"
                  onClick={() => setNewImageMode('FILE')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                    newImageMode === 'FILE'
                      ? 'bg-primary text-white border-primary shadow-2xs'
                      : 'bg-background text-foreground border-border hover:bg-muted'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" /> Tải ảnh lên MinIO
                </button>
              </div>

              {newImageMode === 'URL' ? (
                <div className="space-y-1.5 pt-1">
                  <Textarea
                    placeholder="Dán 1 hoặc nhiều link HTTPS ảnh (mỗi link 1 dòng)...&#10;https://example.com/anh1.jpg&#10;https://example.com/anh2.jpg"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    rows={3}
                    className="text-xs bg-background font-mono"
                  />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>URL ảnh trực tiếp (link https:// an toàn). Hỗ trợ dán nhiều link cùng lúc.</span>
                    {parsedImageUrls.length > 0 && (
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        Đã nhận diện {parsedImageUrls.length} ảnh
                      </span>
                    )}
                  </div>
                  {parsedImageUrls.length > 0 && (
                    <div className="mt-2 p-2 rounded-lg border border-border bg-muted/20">
                      <div className="text-[11px] font-semibold text-muted-foreground mb-1">
                        Xem trước ({parsedImageUrls.length} ảnh từ URL):
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                        {parsedImageUrls.map((url, idx) => (
                          <div
                            key={idx}
                            className="relative aspect-4/3 rounded-lg overflow-hidden border border-border bg-background"
                          >
                            <img
                              src={url}
                              alt={`Ảnh ${idx + 1}`}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1 rounded">
                              #{idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleImageFileChange}
                    className="text-xs bg-background"
                  />
                  <p className="text-[11px] text-muted-foreground font-medium">
                    Định dạng hỗ trợ: JPG, PNG, WebP (tối đa 5MB/ảnh). Có thể chọn nhiều tệp cùng lúc.
                  </p>
                  <p className="text-[10px] text-muted-foreground italic">
                    * Hệ thống tự động xóa EXIF / GPS để bảo vệ quyền riêng tư và lưu trữ an toàn trên MinIO bucket lavitree-images.
                  </p>
                  {newImageFilePreviews.length > 0 && (
                    <div className="mt-2 p-2 rounded-lg border border-border bg-muted/20">
                      <div className="text-[11px] font-semibold text-muted-foreground mb-1">
                        Xem trước tệp tải lên ({newImageFilePreviews.length} ảnh):
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                        {newImageFilePreviews.map((preview, idx) => (
                          <div
                            key={idx}
                            className="relative aspect-4/3 rounded-lg overflow-hidden border border-border bg-background"
                          >
                            <img src={preview} alt={`Tệp ${idx + 1}`} className="h-full w-full object-cover" />
                            <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1 rounded">
                              #{idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mô tả / chú thích triệu chứng */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold">5. Chú thích / Mô tả triệu chứng *</label>
                <span className="text-[10px] text-muted-foreground">{newImageCaption.length}/300 ký tự</span>
              </div>
              <Textarea
                placeholder="Ví dụ: Vết đốm sương mai màu nâu đen xuất hiện ở rìa lá, mặt dưới có lớp nấm trắng mịn trong điều kiện ẩm ướt."
                value={newImageCaption}
                onChange={(e) => setNewImageCaption(e.target.value)}
                maxLength={300}
                rows={2}
                required
                className="text-xs"
              />
            </div>

            {/* Nguồn / Bản quyền & Bài viết gốc */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">6. Nguồn / Tác giả sở hữu ảnh *</label>
                <Input
                  type="text"
                  placeholder="Ví dụ: Cổng TTĐT Khuyến nông Quốc gia"
                  value={newImageCredit}
                  onChange={(e) => setNewImageCredit(e.target.value)}
                  maxLength={200}
                  required
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">7. URL bài viết gốc *</label>
                <Input
                  type="url"
                  placeholder="https://khuyennongvn.gov.vn/..."
                  value={newImageSourceUrl}
                  onChange={(e) => setNewImageSourceUrl(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>
            </div>

            {/* Ghi chú giấy phép */}
            <div>
              <label className="font-semibold block mb-1">8. Ghi chú giấy phép / bản quyền (tùy chọn)</label>
              <Input
                type="text"
                placeholder="Ví dụ: Trích dẫn phi thương mại phục vụ hướng dẫn nông nghiệp"
                value={newImageLicenseNote}
                onChange={(e) => setNewImageLicenseNote(e.target.value)}
                maxLength={200}
                className="text-xs"
              />
            </div>

            {/* Tự động duyệt ngay */}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={newImageAutoApprove}
                onChange={(e) => setNewImageAutoApprove(e.target.checked)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
              />
              <span className="font-semibold text-foreground">
                Duyệt và cho phép hiển thị ngay trên Sổ tay bệnh học
              </span>
            </label>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddImageModalOpen(false)}
                disabled={submittingImage}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submittingImage}
                className="bg-primary hover:bg-primary-hover text-white font-semibold"
              >
                {submittingImage ? 'Đang lưu ảnh...' : 'Lưu ảnh triệu chứng'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG XÓA ẢNH TRIỆU CHỨNG */}
      <Dialog
        open={deleteImageTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deletingImage) setDeleteImageTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md w-[95vw] flex flex-col p-0 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 pr-12 relative shrink-0">
            <DialogTitle className="flex items-center gap-2 text-rose-600 text-base font-bold">
              <Trash2 className="w-5 h-5 text-rose-600 shrink-0" />
              <span>Gỡ ảnh triệu chứng này?</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Ảnh sẽ được đánh dấu xóa và không còn hiển thị trên Sổ tay bệnh học. Nếu muốn tạm ẩn, bạn có thể chọn "Bỏ duyệt" thay vì xóa.
            </DialogDescription>
          </DialogHeader>

          {deleteImageTarget && (
            <div className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl border border-border">
                <img
                  src={deleteImageTarget.image_url}
                  alt={deleteImageTarget.caption}
                  className="w-16 h-16 object-cover rounded-lg border border-border shrink-0 shadow-2xs"
                />
                <div className="text-xs space-y-1 min-w-0 flex-1">
                  <p className="font-semibold text-primary truncate">
                    {deleteImageTarget.plant_name} — {deleteImageTarget.disease_name}
                  </p>
                  <p className="italic text-muted-foreground line-clamp-2 leading-snug">
                    "{deleteImageTarget.caption}"
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteImageTarget(null)}
              disabled={deletingImage}
              className="text-xs h-9 px-4 font-medium"
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteImage}
              disabled={deletingImage}
              className="gap-1.5 text-xs h-9 px-4 font-semibold shadow-xs"
            >
              {deletingImage ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang gỡ...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xác nhận xóa ảnh</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG PHÓNG TO ẢNH TRONG ADMIN */}
      <Dialog open={previewingImage !== null} onOpenChange={(open) => !open && setPreviewingImage(null)}>
        <DialogContent className="sm:max-w-xl w-[95vw] flex flex-col p-0 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          {previewingImage && (
            <>
              <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 pr-12 relative text-left shrink-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs font-semibold">
                    {previewingImage.plant_part === 'LEAF'
                      ? 'Lá'
                      : previewingImage.plant_part === 'FRUIT'
                        ? 'Quả/Hoa'
                        : previewingImage.plant_part === 'STEM'
                          ? 'Thân/Cành'
                          : 'Toàn cây'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs font-semibold text-primary">
                    {previewingImage.plant_name} — {previewingImage.disease_name}
                  </span>
                </div>
                <DialogTitle className="text-sm sm:text-base font-bold text-foreground leading-snug">
                  {previewingImage.caption}
                </DialogTitle>
                <DialogDescription className="sr-only">Chi tiết ảnh triệu chứng</DialogDescription>
              </DialogHeader>

              <div className="p-4 sm:p-5 space-y-3">
                <div className="relative max-h-[360px] w-full overflow-hidden rounded-xl bg-muted/40 border border-border flex items-center justify-center p-2">
                  <img
                    src={previewingImage.image_url}
                    alt={previewingImage.caption}
                    className="max-h-[340px] w-auto max-w-full object-contain mx-auto rounded-lg shadow-2xs"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-1 border-t border-border/60">
                  <div>
                    Nguồn/Bản quyền: <strong className="text-foreground">{previewingImage.credit}</strong>
                    {previewingImage.license_note && (
                      <span className="italic block text-[11px] mt-0.5">{previewingImage.license_note}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={previewingImage.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium"
                    >
                      <span>Xem ảnh gốc</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {previewingImage.source_url && (
                      <a
                        href={previewingImage.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                      >
                        <span>Xem bài báo nguồn</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter className="p-3 sm:p-4 border-t border-border/60 bg-muted/20 flex items-center justify-end shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewingImage(null)}
                  className="text-xs h-9 px-4 font-medium"
                >
                  Đóng
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminImagesPage;
