import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatVND } from '@/lib/format';
import {
  BookOpen,
  Search,
  Filter,
  ShieldAlert,
  Sprout,
  Activity,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Package,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

export interface DiseaseListItem {
  id: number;
  classCode: string;
  plantName: string;
  commonNameVi: string;
  pathogenType: string;
  severityLevel: number;
  symptoms: string;
  prevention: string;
}

export interface DiseaseDetailData {
  id: number;
  classCode: string;
  plantName: string;
  commonNameVi: string;
  pathogenType: string;
  severityLevel: number;
  symptoms: string;
  prevention: string;
  treatmentPlans: Array<{
    stepOrder: number;
    actionTitle: string;
    instructions: string;
    isolationDays?: string;
  }>;
  products: Array<{
    id: number;
    name: string;
    activeIngredient: string;
    price: number;
    imageUrl?: string;
    dosageInstruction?: string;
  }>;
}

export const HandbookPage: React.FC = () => {
  const { classCode } = useParams<{ classCode?: string }>();
  const navigate = useNavigate();

  const [diseases, setDiseases] = useState<DiseaseListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPlant, setSelectedPlant] = useState<string>('Tất cả');
  const [selectedPathogen, setSelectedPathogen] = useState<string>('Tất cả');

  // Modal xem chi tiết một bệnh
  const [detailData, setDetailData] = useState<DiseaseDetailData | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  // Tải danh sách bệnh từ API
  const fetchDiseases = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await apiClient.get<DiseaseListItem[]>('/diseases');
      setDiseases(res.data);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiseases();
  }, []);

  // Mở chi tiết theo param trên URL nếu có
  useEffect(() => {
    if (classCode) {
      openDetailByCode(classCode);
    }
  }, [classCode]);

  const openDetailByCode = async (code: string) => {
    setIsDetailLoading(true);
    setIsDetailOpen(true);
    try {
      const res = await apiClient.get<DiseaseDetailData>(`/diseases/by-class/${encodeURIComponent(code)}`);
      setDetailData(res.data);
    } catch (err: unknown) {
      toast.error('Không tìm thấy chi tiết bệnh hại yêu cầu.');
      setIsDetailOpen(false);
      if (classCode) navigate('/handbook', { replace: true });
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setDetailData(null);
    if (classCode) {
      navigate('/handbook');
    }
  };

  // Trích xuất danh sách loài cây độc nhất
  const plantOptions = useMemo(() => {
    const plants = Array.from(new Set(diseases.map((d) => d.plantName))).filter(Boolean);
    return ['Tất cả', ...plants.sort()];
  }, [diseases]);

  // Bộ lọc dữ liệu theo Tìm kiếm, Loài cây và Tác nhân
  const filteredDiseases = useMemo(() => {
    return diseases.filter((d) => {
      const matchSearch =
        d.commonNameVi.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.plantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.classCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.symptoms && d.symptoms.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.prevention && d.prevention.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchPlant = selectedPlant === 'Tất cả' || d.plantName === selectedPlant;
      const matchPathogen =
        selectedPathogen === 'Tất cả' ||
        (d.pathogenType && d.pathogenType.toLowerCase().includes(selectedPathogen.toLowerCase()));

      return matchSearch && matchPlant && matchPathogen;
    });
  }, [diseases, searchTerm, selectedPlant, selectedPathogen]);

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 max-w-6xl space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-primary text-xs font-semibold">
          <BookOpen className="h-3.5 w-3.5" />
          <span>Cẩm nang Khoa học Nông nghiệp Chuẩn Khuyến nông</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
          Sổ Tay Bệnh Học & Cây Trồng
        </h1>
        <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
          Tra cứu triệu chứng, tác nhân gây bệnh, biện pháp canh tác phòng ngừa và phác đồ điều trị IPM trên 14 loài cây trồng.
        </p>
      </div>

      {/* THANH TÌM KIẾM & BỘ LỌC */}
      <div className="space-y-4 rounded-2xl border border-border bg-card p-4 md:p-6 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Tìm theo tên bệnh (sương mai, thán thư...), triệu chứng hoặc loài cây..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 text-sm bg-background border-border"
          />
        </div>

        {/* Bộ lọc loài cây (Category Pills) */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Chọn loài cây trồng:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {plantOptions.map((plant) => (
              <button
                key={plant}
                type="button"
                onClick={() => setSelectedPlant(plant)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  selectedPlant === plant
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-secondary text-foreground hover:bg-secondary/80 border border-border/50'
                }`}
              >
                {plant}
              </button>
            ))}
          </div>
        </div>

        {/* Bộ lọc tác nhân gây bệnh */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40 text-xs">
          <span className="font-semibold text-muted-foreground">Tác nhân gây bệnh:</span>
          {['Tất cả', 'Nấm', 'Vi khuẩn', 'Virus'].map((pat) => (
            <button
              key={pat}
              type="button"
              onClick={() => setSelectedPathogen(pat)}
              className={`rounded-md px-2.5 py-0.5 font-medium transition-colors ${
                selectedPathogen === pat
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {pat}
            </button>
          ))}
          <span className="ml-auto text-muted-foreground font-medium">
            Hiển thị: <strong>{filteredDiseases.length}</strong> bệnh
          </span>
        </div>
      </div>

      {/* DANH SÁCH BỆNH HỌC */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 rounded-2xl border border-border bg-card p-5 animate-pulse space-y-3">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-6 w-3/4 bg-muted rounded" />
              <div className="h-16 w-full bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-3 max-w-lg mx-auto">
          <p className="text-base font-semibold text-foreground">Không thể tải sổ tay bệnh học</p>
          <p className="text-xs text-muted-foreground">{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={fetchDiseases} className="text-xs border-border">
            Thử tải lại
          </Button>
        </div>
      ) : filteredDiseases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-3">
          <Sprout className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="text-base font-semibold text-foreground">Không tìm thấy bệnh hại phù hợp</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Hãy thử tìm kiếm bằng từ khóa khác hoặc chuyển loài cây sang "Tất cả".
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchTerm('');
              setSelectedPlant('Tất cả');
              setSelectedPathogen('Tất cả');
            }}
            className="text-xs border-border"
          >
            Đặt lại bộ lọc
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDiseases.map((d) => {
            const isHealthy = d.classCode.endsWith('___healthy');
            return (
              <Card
                key={d.id}
                className="flex flex-col justify-between border-border bg-card hover:border-primary/50 transition-all hover:shadow-xs rounded-2xl overflow-hidden"
              >
                <CardHeader className="p-4 pb-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">
                      {d.plantName}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`text-[11px] font-medium border ${
                        isHealthy
                          ? 'bg-status-ok-bg text-status-ok border-status-ok/30'
                          : d.pathogenType?.includes('Nấm')
                          ? 'bg-status-confusion-bg text-status-confusion border-status-confusion/30'
                          : 'bg-secondary text-foreground'
                      }`}
                    >
                      {d.pathogenType || 'Chưa phân loại'}
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-bold text-foreground leading-snug line-clamp-1">
                    {d.commonNameVi}
                  </CardTitle>
                  <p className="text-[11px] font-mono text-muted-foreground line-clamp-1">
                    {d.classCode}
                  </p>
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2 text-xs">
                    {d.symptoms && (
                      <p className="text-muted-foreground line-clamp-2">
                        <span className="font-semibold text-foreground">Triệu chứng: </span>
                        {d.symptoms}
                      </p>
                    )}
                    {d.prevention && (
                      <p className="text-muted-foreground line-clamp-2">
                        <span className="font-semibold text-foreground">Phòng ngừa: </span>
                        {d.prevention}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      Mức độ: {d.severityLevel === 1 ? '🟢 Nhẹ' : d.severityLevel === 3 ? '🔴 Khẩn cấp' : '🟡 Nghiêm trọng'}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openDetailByCode(d.classCode)}
                      className="text-xs font-semibold text-primary hover:text-primary-hover p-0 h-auto"
                    >
                      <span>Xem phác đồ</span>
                      <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* DIALOG XEM CHI TIẾT BỆNH HỌC (W-03) */}
      <Dialog open={isDetailOpen} onOpenChange={(open) => !open && handleCloseDetail()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-5 md:p-6 rounded-2xl">
          {isDetailLoading || !detailData ? (
            <div className="flex min-h-[250px] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-6">
              <DialogHeader className="space-y-1.5 text-left border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-bold text-primary border-primary/30">
                    {detailData.plantName}
                  </Badge>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground font-medium">
                    Tác nhân: {detailData.pathogenType || 'Chưa phân loại'}
                  </span>
                </div>
                <DialogTitle className="text-xl font-extrabold text-foreground tracking-tight">
                  {detailData.commonNameVi}
                </DialogTitle>
                <DialogDescription className="text-xs font-mono text-muted-foreground">
                  Mã khoa học: {detailData.classCode}
                </DialogDescription>
              </DialogHeader>

              {/* Triệu chứng & Phòng ngừa */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-border bg-card p-3.5 space-y-1">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-primary" /> Triệu chứng nhận biết:
                  </span>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                    {detailData.symptoms || 'Đang cập nhật triệu chứng lâm sàng.'}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-card p-3.5 space-y-1">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-primary" /> Biện pháp phòng ngừa:
                  </span>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                    {detailData.prevention || 'Áp dụng biện pháp canh tác thông thoáng và luân canh cây trồng.'}
                  </p>
                </div>
              </div>

              {/* Phác đồ xử lý IPM */}
              {detailData.treatmentPlans && detailData.treatmentPlans.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    Phác đồ xử lý dịch hại chuẩn IPM ({detailData.treatmentPlans.length} bước)
                  </h4>
                  <div className="space-y-2.5">
                    {detailData.treatmentPlans.map((step, idx) => (
                      <div key={idx} className="rounded-xl border border-border bg-secondary/30 p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-foreground">
                            {step.stepOrder || idx + 1}. {step.actionTitle}
                          </span>
                          {step.isolationDays && !step.isolationDays.toLowerCase().includes('không') && (
                            <span className="rounded-full bg-status-confusion-bg px-2 py-0.5 text-[11px] font-medium text-status-confusion">
                              Cách ly: {step.isolationDays}
                            </span>
                          )}
                        </div>
                        <p className="text-muted-foreground leading-relaxed">{step.instructions}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Danh mục thuốc BVTV đặc trị */}
              {detailData.products && detailData.products.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    Thuốc BVTV Đặc trị Khuyến nghị ({detailData.products.length} sản phẩm)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {detailData.products.map((p) => (
                      <div key={p.id} className="rounded-xl border border-border bg-card p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-foreground line-clamp-1">{p.name}</span>
                          <span className="font-bold text-primary tabular-nums">{formatVND(p.price)}</span>
                        </div>
                        <p className="text-muted-foreground text-[11px] line-clamp-1">
                          Hoạt chất: {p.activeIngredient}
                        </p>
                        {p.dosageInstruction && (
                          <p className="text-muted-foreground text-[11px] line-clamp-1 italic">
                            {p.dosageInstruction}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Các nút hành động */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCloseDetail}
                  className="text-xs border-border"
                >
                  Đóng sổ tay
                </Button>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      handleCloseDetail();
                      navigate(`/chat?class_code=${encodeURIComponent(detailData.classCode)}`);
                    }}
                    className="text-xs"
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1" /> Hỏi Trợ lý
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      handleCloseDetail();
                      navigate('/');
                    }}
                    className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" /> Khám bệnh ngay
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HandbookPage;
