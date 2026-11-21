import React, { useState, useEffect, useMemo } from 'react';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Filter,
  Edit3,
  RefreshCw,
  Microscope,
  BookOpen,
  Info,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

export interface AdminDiseaseItem {
  id: number;
  classCode: string;
  plantName: string;
  commonNameVi: string;
  pathogenType: string;
  pathogenName: string | null;
  approvedKnowledgeCount: number;
  severityLevel: number;
}

interface CauseEvidence {
  id: string;
  evidence_text: string;
  source_title: string;
  organization: string;
  unit_type?: string;
}

const PATHOGEN_TYPES = ['Nấm', 'Vi khuẩn', 'Virus', 'Nhện hại', 'Khỏe mạnh'];

export const AdminDiseasesPage: React.FC = () => {
  const [diseases, setDiseases] = useState<AdminDiseaseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPlant, setSelectedPlant] = useState<string>('ALL');
  const [onlyMissingPathogenName, setOnlyMissingPathogenName] = useState<boolean>(false);

  // Edit dialog state
  const [editingDisease, setEditingDisease] = useState<AdminDiseaseItem | null>(null);
  const [editPathogenType, setEditPathogenType] = useState<string>('Nấm');
  const [editPathogenName, setEditPathogenName] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // CAUSE_CONDITIONS knowledge preview
  const [evidences, setEvidences] = useState<CauseEvidence[]>([]);
  const [loadingEvidences, setLoadingEvidences] = useState<boolean>(false);

  const fetchDiseases = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<AdminDiseaseItem[]>('/diseases');
      setDiseases(res.data);
    } catch (err: unknown) {
      toast.error('Không thể tải danh mục bệnh: ' + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiseases();
  }, []);

  const uniquePlants = useMemo(() => {
    const set = new Set<string>();
    diseases.forEach((d) => {
      if (d.plantName) set.add(d.plantName);
    });
    return Array.from(set).sort();
  }, [diseases]);

  const filteredDiseases = useMemo(() => {
    return diseases.filter((d) => {
      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        d.commonNameVi.toLowerCase().includes(q) ||
        d.classCode.toLowerCase().includes(q) ||
        d.plantName.toLowerCase().includes(q) ||
        (d.pathogenName && d.pathogenName.toLowerCase().includes(q));

      const matchPlant = selectedPlant === 'ALL' || d.plantName === selectedPlant;
      const isHealthy = d.classCode.endsWith('___healthy');
      const matchMissing = onlyMissingPathogenName
        ? !isHealthy && (!d.pathogenName || d.pathogenName.trim() === '')
        : true;

      return matchSearch && matchPlant && matchMissing;
    });
  }, [diseases, searchTerm, selectedPlant, onlyMissingPathogenName]);

  const handleOpenEdit = async (disease: AdminDiseaseItem) => {
    setEditingDisease(disease);
    setEditPathogenType(disease.pathogenType || 'Nấm');
    setEditPathogenName(disease.pathogenName || '');
    setEvidences([]);
    setLoadingEvidences(true);

    try {
      const res = await apiClient.get<{ items?: any[] } | any[]>('/knowledge/sources', {
        params: {
          modelClass: disease.classCode,
          page: 1,
          pageSize: 20,
        },
      });
      const rawList = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.items)
        ? res.data.items
        : [];
      const causeList: CauseEvidence[] = rawList
        .filter((item: any) => item.unit_type === 'CAUSE_CONDITIONS' || item.unitType === 'CAUSE_CONDITIONS')
        .slice(0, 3)
        .map((item: any) => ({
          id: String(item.id),
          evidence_text: item.evidence_text || item.evidenceText || '',
          source_title: item.source_title || item.sourceTitle || '',
          organization: item.organization || '',
          unit_type: item.unit_type || item.unitType,
        }));
      setEvidences(causeList);
    } catch {
      setEvidences([]);
    } finally {
      setLoadingEvidences(false);
    }
  };

  const handleSave = async () => {
    if (!editingDisease) return;

    if (!editPathogenType) {
      toast.error('Vui lòng chọn loại tác nhân');
      return;
    }

    const cleanName = editPathogenName.trim();
    if (cleanName.length > 200) {
      toast.error('Tên khoa học tối đa 200 ký tự');
      return;
    }
    if (cleanName.includes('<') || cleanName.includes('>')) {
      toast.error('Tên khoa học không được chứa ký tự < hoặc >');
      return;
    }

    setSaving(true);
    try {
      await apiClient.patch(`/diseases/${editingDisease.id}`, {
        pathogen_type: editPathogenType,
        pathogen_name: cleanName || null,
      });

      setDiseases((prev) =>
        prev.map((d) =>
          d.id === editingDisease.id
            ? {
                ...d,
                pathogenType: editPathogenType,
                pathogenName: cleanName || null,
              }
            : d
        )
      );

      toast.success(`Đã cập nhật tác nhân cho "${editingDisease.commonNameVi}"`);
      setEditingDisease(null);
    } catch (err: unknown) {
      toast.error('Lỗi cập nhật tác nhân: ' + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-6xl space-y-6">
      {/* Tiêu đề & Thống kê nhanh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-secondary text-primary text-xs font-semibold mb-1">
            <Microscope className="w-3.5 h-3.5" />
            <span>Quản trị Phân loại Dịch hại</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Danh mục Bệnh hại & Tác nhân
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Cập nhật phân loại tác nhân và tên khoa học chuẩn quốc tế (*Latin*) cho 40 lớp bệnh học.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchDiseases}
          disabled={loading}
          className="self-start sm:self-auto h-9 text-xs gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </Button>
      </div>

      {/* Bộ lọc và Tìm kiếm */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 rounded-xl border border-border bg-card">
        <div className="sm:col-span-5 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên bệnh, mã lớp, tên khoa học..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="sm:col-span-4 flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <select
            value={selectedPlant}
            onChange={(e) => setSelectedPlant(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="ALL">Tất cả cây trồng ({diseases.length} bệnh)</option>
            {uniquePlants.map((plant) => (
              <option key={plant} value={plant}>
                {plant}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3 flex items-center">
          <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyMissingPathogenName}
              onChange={(e) => setOnlyMissingPathogenName(e.target.checked)}
              className="rounded border-input text-primary focus:ring-primary w-4 h-4"
            />
            <span>Chưa có tên khoa học</span>
          </label>
        </div>
      </div>

      {/* Bảng Danh sách */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border">
              <tr>
                <th className="py-3 px-4">Cây trồng</th>
                <th className="py-3 px-4">Tên bệnh & Mã lớp</th>
                <th className="py-3 px-4">Loại tác nhân</th>
                <th className="py-3 px-4">Tên khoa học (*Latin*)</th>
                <th className="py-3 px-4 text-center">Tri thức đã duyệt</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    <span>Đang nạp danh mục bệnh...</span>
                  </td>
                </tr>
              ) : filteredDiseases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    Không tìm thấy bệnh hại phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredDiseases.map((d) => {
                  const isHealthy = d.classCode.endsWith('___healthy');
                  return (
                    <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-primary">
                        {d.plantName}
                      </td>
                      <td className="py-3 px-4 space-y-0.5">
                        <div className="font-semibold text-foreground text-sm">
                          {d.commonNameVi}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {d.classCode}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="secondary"
                          className={`text-[11px] font-medium border ${
                            isHealthy
                              ? 'bg-status-ok-bg text-status-ok border-status-ok/30'
                              : d.pathogenType?.includes('Nấm')
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
                      </td>
                      <td className="py-3 px-4">
                        {d.pathogenName ? (
                          <span className="italic font-medium text-foreground">
                            {d.pathogenName}
                          </span>
                        ) : isHealthy ? (
                          <span className="text-muted-foreground/60">—</span>
                        ) : (
                          <span className="text-status-ood font-medium text-[11px]">
                            Chưa có tên khoa học
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {d.approvedKnowledgeCount > 0 ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-primary bg-secondary px-2 py-0.5 rounded-full text-[11px]">
                            <BookOpen className="w-3 h-3" />
                            {d.approvedKnowledgeCount} đoạn
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 text-[11px]">0 đoạn</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(d)}
                          className="h-8 text-xs gap-1 border-border hover:border-primary/50"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Sửa</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog Sửa Tác Nhân */}
      <Dialog open={!!editingDisease} onOpenChange={(open) => !open && setEditingDisease(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
          <DialogHeader className="border-b border-border pb-3">
            <div className="flex items-center gap-2 text-xs text-primary font-bold uppercase tracking-wider">
              <span>{editingDisease?.plantName}</span>
              <span>•</span>
              <span className="font-mono normal-case text-muted-foreground">
                {editingDisease?.classCode}
              </span>
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Sửa tác nhân: {editingDisease?.commonNameVi}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Cập nhật loại tác nhân và tên khoa học theo các tài liệu khuyến nông đã được kiểm duyệt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Loại tác nhân */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">
                Loại tác nhân <span className="text-destructive">*</span>
              </label>
              <select
                value={editPathogenType}
                onChange={(e) => setEditPathogenType(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
              >
                {PATHOGEN_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Tên khoa học */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">
                Tên khoa học tác nhân (*Latin*)
              </label>
              <Input
                placeholder="Ví dụ: Phytophthora infestans"
                value={editPathogenName}
                maxLength={200}
                onChange={(e) => setEditPathogenName(e.target.value)}
                className="h-9 text-xs italic"
              />
              <p className="text-[11px] text-muted-foreground">
                Lấy theo nguồn đã duyệt (mục Nguyên nhân & tác nhân). Tối đa 200 ký tự.
              </p>
            </div>

            {/* Đoạn trích CAUSE_CONDITIONS để đối chiếu */}
            <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3.5">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Info className="w-3.5 h-3.5 text-primary" />
                <span>Đoạn tri thức "Nguyên nhân & điều kiện phát sinh" đã duyệt để đối chiếu:</span>
              </div>

              {loadingEvidences ? (
                <div className="py-3 text-center text-muted-foreground text-[11px]">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mx-auto mb-1" />
                  Đang tải đoạn trích đối chiếu...
                </div>
              ) : evidences.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">
                  Chưa có đoạn tri thức nào thuộc mục "Nguyên nhân" được duyệt cho bệnh này.
                </p>
              ) : (
                <div className="space-y-2">
                  {evidences.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2.5 rounded-lg border border-border/70 bg-card text-[11px] space-y-1"
                    >
                      <p className="text-foreground whitespace-pre-line leading-relaxed">
                        {ev.evidence_text}
                      </p>
                      <div className="text-muted-foreground text-[10px] flex items-center justify-between">
                        <span>Nguồn: {ev.organization || ev.source_title}</span>
                        <button
                          type="button"
                          onClick={() => {
                            // Copy selected text or prompt
                            navigator.clipboard?.writeText(ev.evidence_text);
                            toast.info('Đã sao chép đoạn trích vào bộ nhớ tạm');
                          }}
                          className="text-primary hover:underline"
                        >
                          Sao chép đoạn
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingDisease(null)}
              disabled={saving}
              className="text-xs"
            >
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="text-xs gap-1.5"
            >
              {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Lưu thay đổi</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDiseasesPage;
