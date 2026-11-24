import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cleanRawMarkdown, cleanSymptomText } from '@/lib/snippet-format';
import {
  BookOpen,
  Search,
  Filter,
  Sprout,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

export interface DiseaseListItem {
  id: number;
  classCode: string;
  plantName: string;
  commonNameVi: string;
  pathogenType: string;
  pathogenName?: string | null;
  approvedKnowledgeCount?: number;
  severityLevel: number;
  symptoms?: string;
  prevention?: string;
}

export const HandbookPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const plantQuery = searchParams.get('plant');

  const [diseases, setDiseases] = useState<DiseaseListItem[]>([]);
  const [imageMap, setImageMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPlant, setSelectedPlant] = useState<string>(plantQuery || 'Tất cả');
  const [selectedPathogen, setSelectedPathogen] = useState<string>('Tất cả');

  // Tải danh sách bệnh và ảnh triệu chứng từ API
  const fetchDiseases = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [diseasesRes, imagesRes] = await Promise.allSettled([
        apiClient.get<DiseaseListItem[]>('/diseases'),
        apiClient.get<Array<{ model_class: string; image_url: string; plant_part?: string }>>('/knowledge/images'),
      ]);

      if (diseasesRes.status === 'fulfilled') {
        // Tạm thời ẩn các mục "Cây khỏe mạnh" theo yêu cầu người dùng (Sổ tay chỉ dùng cho bệnh hại)
        const onlyDiseases = diseasesRes.value.data.filter(
          (d) => !d.classCode.endsWith('___healthy') && !d.commonNameVi.toLowerCase().includes('khỏe mạnh')
        );
        setDiseases(onlyDiseases);
      } else {
        const message = getErrorMessage(diseasesRes.reason);
        setLoadError(message);
        toast.error(message);
      }

      if (imagesRes.status === 'fulfilled' && Array.isArray(imagesRes.value.data)) {
        const map: Record<string, string> = {};
        for (const item of imagesRes.value.data) {
          if (item.model_class && item.image_url) {
            // Ưu tiên ảnh bộ phận Lá (LEAF) hoặc ảnh đầu tiên
            if (!map[item.model_class] || item.plant_part === 'LEAF') {
              map[item.model_class] = item.image_url;
            }
          }
        }
        setImageMap(map);
      }
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

  // Trích xuất danh sách loài cây độc nhất
  const plantOptions = useMemo(() => {
    const plants = Array.from(new Set(diseases.map((d) => d.plantName))).filter(Boolean);
    return ['Tất cả', ...plants.sort()];
  }, [diseases]);

  // Đồng bộ URL parameter (?plant=...) vào state selectedPlant
  useEffect(() => {
    if (plantQuery && plantOptions.length > 0) {
      const cleanQuery = plantQuery.trim().toLowerCase();
      // 1. Khớp chính xác
      const exact = plantOptions.find((p) => p.toLowerCase() === cleanQuery);
      if (exact) {
        setSelectedPlant(exact);
        return;
      }
      // 2. Khớp một phần / tương đối (ví dụ: "Cam / Có múi" khớp "Cam / Cây có múi", "Bí đỏ (Bí ngô)" khớp "Bí đỏ / Bí ngô", "Đậu nành" khớp "Đậu nành (Đậu tương)")
      const partial = plantOptions.find((p) => {
        const lp = p.toLowerCase();
        const baseQuery = cleanQuery.split(/[\/\(]/)[0].trim();
        const baseP = lp.split(/[\/\(]/)[0].trim();
        return (
          lp.includes(cleanQuery) ||
          cleanQuery.includes(baseP) ||
          lp.includes(baseQuery)
        );
      });
      if (partial) {
        setSelectedPlant(partial);
      } else {
        setSelectedPlant(plantQuery);
      }
    } else if (!plantQuery) {
      setSelectedPlant('Tất cả');
    }
  }, [plantQuery, plantOptions]);

  const handleSelectPlant = (plant: string) => {
    setSelectedPlant(plant);
    if (plant === 'Tất cả') {
      searchParams.delete('plant');
    } else {
      searchParams.set('plant', plant);
    }
    setSearchParams(searchParams, { replace: true });
  };

  // Bộ lọc dữ liệu theo Tìm kiếm, Loài cây và Tác nhân
  const filteredDiseases = useMemo(() => {
    return diseases.filter((d) => {
      const matchSearch =
        d.commonNameVi.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.plantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.classCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.pathogenName && d.pathogenName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchPlant = (() => {
        if (selectedPlant === 'Tất cả') return true;
        const sp = selectedPlant.toLowerCase();
        const dp = d.plantName.toLowerCase();
        const baseSp = sp.split(/[\/\(]/)[0].trim();
        const baseDp = dp.split(/[\/\(]/)[0].trim();
        return (
          dp === sp ||
          dp.includes(sp) ||
          sp.includes(dp) ||
          dp.includes(baseSp) ||
          sp.includes(baseDp)
        );
      })();

      const matchPathogen =
        selectedPathogen === 'Tất cả' ||
        (d.pathogenType && d.pathogenType.toLowerCase().includes(selectedPathogen.toLowerCase()));

      return matchSearch && matchPlant && matchPathogen;
    });
  }, [diseases, searchTerm, selectedPlant, selectedPathogen]);

  return (
    <div className="container mx-auto px-4 py-4 md:py-6 max-w-6xl space-y-4">
      {/* Header tinh gọn & súc tích */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 pb-1">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Sổ Tay Bệnh Học & Cây Trồng</span>
            </h1>
            <Badge variant="outline" className="hidden sm:inline-flex bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300 text-[10px] font-semibold py-0">
              Chuẩn Khuyến nông
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tra cứu triệu chứng, tác nhân và phác đồ điều trị IPM trên {plantOptions.length > 1 ? plantOptions.length - 1 : 14} loài cây trồng
          </p>
        </div>
      </div>

      {/* THANH TÌM KIẾM & BỘ LỌC TINH GỌN */}
      <div className="space-y-2.5 rounded-xl border border-border bg-card p-3 md:p-3.5 shadow-2xs">
        {/* Hàng 1: Ô tìm kiếm + Bộ lọc tác nhân nhanh */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm theo tên bệnh, loài cây hoặc tác nhân (sương mai, thán thư, cà chua...)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs bg-background border-border"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-[11px]"
              >
                Xóa
              </button>
            )}
          </div>

          {/* Bộ lọc Tác nhân gây bệnh (nằm ngang hàng ô search trên desktop) */}
          <div className="flex items-center gap-1 shrink-0 overflow-x-auto pb-0.5 sm:pb-0">
            <span className="text-[11px] font-semibold text-muted-foreground mr-1 shrink-0 hidden md:inline">Tác nhân:</span>
            {['Tất cả', 'Nấm', 'Vi khuẩn', 'Virus', 'Nhện hại'].map((pathogen) => (
              <button
                key={pathogen}
                type="button"
                onClick={() => setSelectedPathogen(pathogen)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-all shrink-0 ${selectedPathogen === pathogen
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-border/40'
                  }`}
              >
                {pathogen}
              </button>
            ))}
          </div>
        </div>

        {/* Hàng 2: Bộ lọc loài cây (Category Pills dạng cuộn ngang mượt mà / flex gọn) */}
        <div className="pt-2 border-t border-border/50 flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[11px] font-semibold text-muted-foreground shrink-0 flex items-center gap-1">
            <Filter className="h-3 w-3 text-emerald-600" />
            <span>Cây trồng:</span>
          </span>
          <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
            {plantOptions.map((plant) => (
              <button
                key={plant}
                type="button"
                onClick={() => handleSelectPlant(plant)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all shrink-0 ${selectedPlant === plant
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-secondary text-foreground hover:bg-secondary/80 border border-border/50'
                  }`}
              >
                {plant}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* DANH SÁCH THẺ BỆNH */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-card border border-border p-4 animate-pulse space-y-3">
              <div className="flex justify-between">
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-4 w-16 bg-muted rounded-full" />
              </div>
              <div className="h-5 w-40 bg-muted rounded" />
              <div className="h-3 w-32 bg-muted rounded" />
              <div className="pt-4 border-t border-border/50 flex justify-between">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-4 w-16 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-3">
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
          <p className="text-sm font-semibold text-foreground">{loadError}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchDiseases}
            className="text-xs"
          >
            Thử lại
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
              searchParams.delete('plant');
              setSearchParams(searchParams, { replace: true });
            }}
            className="text-xs border-border"
          >
            Đặt lại bộ lọc
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDiseases.map((d) => {
            const hasKnowledge = (d.approvedKnowledgeCount ?? 0) > 0;
            const diseaseImg = imageMap[d.classCode];

            return (
              <Link
                key={d.id}
                to={`/handbook/${encodeURIComponent(d.classCode)}`}
                aria-label={`Xem chi tiết ${d.commonNameVi}`}
                className="group flex flex-col justify-between border border-border bg-card hover:border-primary/50 transition-all hover:shadow-md rounded-2xl overflow-hidden focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
              >
                {/* Ảnh triệu chứng thực tế giúp nông dân nhận diện nhanh trực quan */}
                {diseaseImg && (
                  <div className="relative h-44 w-full overflow-hidden bg-muted/40 border-b border-border/50">
                    <img
                      src={diseaseImg}
                      alt={d.commonNameVi}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute top-2.5 left-2.5">
                      <span className="text-[11px] font-bold text-white bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs">
                        {d.plantName}
                      </span>
                    </div>
                    <div className="absolute top-2.5 right-2.5">
                      <Badge
                        variant="secondary"
                        title={d.pathogenName || undefined}
                        className={`text-[11px] font-medium border shadow-xs ${d.pathogenType?.includes('Nấm')
                          ? 'bg-amber-500/90 text-white border-amber-600'
                          : d.pathogenType?.includes('Vi khuẩn')
                            ? 'bg-blue-500/90 text-white border-blue-600'
                            : d.pathogenType?.includes('Virus')
                              ? 'bg-purple-500/90 text-white border-purple-600'
                              : 'bg-zinc-800/90 text-white border-zinc-700'
                          }`}
                      >
                        {d.pathogenType || 'Chưa phân loại'}
                      </Badge>
                    </div>
                  </div>
                )}

                <CardHeader className="p-4 pb-2 space-y-2">
                  {!diseaseImg && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">
                        {d.plantName}
                      </span>
                      <Badge
                        variant="secondary"
                        title={d.pathogenName || undefined}
                        className={`text-[11px] font-medium border ${d.pathogenType?.includes('Nấm')
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                          : d.pathogenType?.includes('Vi khuẩn')
                            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                            : d.pathogenType?.includes('Virus')
                              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20'
                              : 'bg-secondary text-foreground'
                          }`}
                      >
                        {d.pathogenType || 'Chưa phân loại'}
                      </Badge>
                    </div>
                  )}

                  <div>
                    <CardTitle className="text-base font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                      {d.commonNameVi}
                    </CardTitle>
                    {d.pathogenName && (
                      <p className="text-xs italic text-muted-foreground mt-0.5 font-normal">
                        {d.pathogenName}
                      </p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    {hasKnowledge ? (
                      <p
                        className="text-xs text-muted-foreground line-clamp-2 leading-relaxed"
                        title={cleanSymptomText(d.symptoms, d.commonNameVi, d.plantName)}
                      >
                        {cleanSymptomText(d.symptoms, d.commonNameVi, d.plantName)}
                      </p>
                    ) : (
                      <p className="text-xs italic text-muted-foreground/60">
                        Chưa có nội dung
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border/50 flex items-center justify-end">
                    <span className="inline-flex items-center text-xs font-semibold text-primary group-hover:text-primary-hover">
                      <span>Xem phác đồ & nguồn</span>
                      <ChevronRight className="h-3.5 w-3.5 ml-0.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </CardContent>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HandbookPage;
