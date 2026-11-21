import React from 'react';
import { toast } from 'sonner';
import { AlertCircle, Ban, FileUp, History, Loader2, Pencil, Plus, RefreshCw, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { setBannedTerms } from '../lib/guardrails';

// TASK-19: Danh mục chất cấm. Trạng thái tính từ lịch sử quyết định theo văn bản (cấm / bỏ cấm, có ngày hiệu lực).

export type BannedAction = 'BAN' | 'UNBAN';

export interface BannedDecision {
  id: number;
  action: BannedAction;
  legal_document: string;
  effective_date: string | null;
  source_url: string | null;
  note: string | null;
  created_at: string;
  created_by: string | null;
}

export interface BannedSubstance {
  id: number;
  common_name: string;
  aliases: string[];
  category: string;
  note: string | null;
  is_banned: boolean;
  current_legal_document: string | null;
  current_effective_date: string | null;
  upcoming_action: BannedAction | null;
  upcoming_effective_date: string | null;
  decisions: BannedDecision[];
}

interface BannedList {
  today: string;
  items: BannedSubstance[];
  terms: { text: string; substance: string }[];
  loaded_from_database: boolean;
}

interface ImportRow {
  common_name: string;
  aliases: string[];
  category: string;
  note?: string | null;
  checked: boolean;
}

interface ImportResult {
  common_name: string;
  status: 'NEW' | 'ADD_DECISION' | 'NO_CHANGE' | 'DUPLICATE' | 'INVALID';
  message: string | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  INSECTICIDE: 'Trừ sâu',
  FUNGICIDE: 'Trừ bệnh',
  HERBICIDE: 'Trừ cỏ',
  RODENTICIDE: 'Trừ chuột',
  OTHER: 'Khác',
};

const fmtDate = (d: string | null) => (d ? d.split('-').reverse().join('/') : '');
const splitAliases = (s: string) => s.split(/[;,\n]/).map((x) => x.trim()).filter(Boolean);
// "2,4-D" có dấu phẩy: tên khác nhập mỗi dòng một tên hoặc ngăn bằng dấu chấm phẩy
const splitAliasInput = (s: string) => (s.includes('\n') || s.includes(';') ? s.split(/[;\n]/).map((x) => x.trim()).filter(Boolean) : splitAliases(s));

interface DecisionForm {
  action: BannedAction;
  legal_document: string;
  effective_date: string;
  source_url: string;
  note: string;
}
const emptyDecision = (action: BannedAction = 'BAN'): DecisionForm => ({ action, legal_document: '', effective_date: '', source_url: '', note: '' });
const decisionPayload = (d: DecisionForm) => ({
  action: d.action,
  legal_document: d.legal_document.trim(),
  effective_date: d.effective_date || null,
  source_url: d.source_url.trim() || null,
  note: d.note.trim() || null,
});

const field = 'h-8 text-xs bg-background';
const lbl = 'block text-[11px] font-semibold text-muted-foreground mb-0.5';

const StatusBadge: React.FC<{ s: BannedSubstance }> = ({ s }) => (
  <div className="space-y-0.5">
    {s.is_banned ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300">
        <Ban className="w-3 h-3" /> Đang cấm
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
        <ShieldCheck className="w-3 h-3" /> Không cấm
      </span>
    )}
    {s.upcoming_action && (
      <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
        {s.upcoming_action === 'BAN' ? 'Sẽ cấm' : 'Sẽ bỏ cấm'} từ {fmtDate(s.upcoming_effective_date)}
      </div>
    )}
  </div>
);

const DecisionFields: React.FC<{ value: DecisionForm; onChange: (v: DecisionForm) => void; allowAction?: boolean }> = ({ value, onChange, allowAction = true }) => {
  const set = <K extends keyof DecisionForm>(k: K, v: DecisionForm[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
      {allowAction && (
        <div>
          <label className={lbl}>Quyết định</label>
          <select value={value.action} onChange={(e) => set('action', e.target.value as BannedAction)}
            className="w-full h-8 px-2 bg-background border border-border rounded text-xs">
            <option value="BAN">Cấm</option>
            <option value="UNBAN">Bỏ cấm</option>
          </select>
        </div>
      )}
      <div className={allowAction ? 'sm:col-span-2' : 'sm:col-span-3'}>
        <label className={lbl}>Số hiệu văn bản *</label>
        <Input className={field} placeholder="VD: Thông tư 75/2025/TT-BNNMT, Phụ lục II" value={value.legal_document}
          onChange={(e) => set('legal_document', e.target.value)} />
      </div>
      <div>
        <label className={lbl}>Ngày hiệu lực</label>
        <Input className={field} type="date" value={value.effective_date} onChange={(e) => set('effective_date', e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className={lbl}>Link văn bản</label>
        <Input className={field} placeholder="https://..." value={value.source_url} onChange={(e) => set('source_url', e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className={lbl}>Ghi chú</label>
        <Input className={field} placeholder="VD: chuyển tiếp 2 năm" value={value.note} onChange={(e) => set('note', e.target.value)} />
      </div>
    </div>
  );
};

export const BannedSubstancesTab: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const [data, setData] = React.useState<BannedList | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'banned' | 'unbanned'>('all');
  const [expanded, setExpanded] = React.useState<number | null>(null);
  const [panel, setPanel] = React.useState<null | 'create'>(null);
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [uploadedFileName, setUploadedFileName] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  // thêm chất
  const [cName, setCName] = React.useState('');
  const [cAliases, setCAliases] = React.useState('');
  const [cCategory, setCCategory] = React.useState('INSECTICIDE');
  const [cNote, setCNote] = React.useState('');
  const [cDecision, setCDecision] = React.useState<DecisionForm>(emptyDecision());

  // sửa chất / thêm quyết định
  const [editId, setEditId] = React.useState<number | null>(null);
  const [eAliases, setEAliases] = React.useState('');
  const [eCategory, setECategory] = React.useState('OTHER');
  const [eNote, setENote] = React.useState('');
  const [decisionFor, setDecisionFor] = React.useState<number | null>(null);
  const [newDecision, setNewDecision] = React.useState<DecisionForm>(emptyDecision('UNBAN'));

  // nạp từ PDF
  const [pdfRows, setPdfRows] = React.useState<ImportRow[]>([]);
  const [pdfWarnings, setPdfWarnings] = React.useState<string[]>([]);
  const [pdfParseError, setPdfParseError] = React.useState<string | null>(null);
  const [importDecision, setImportDecision] = React.useState<DecisionForm>(emptyDecision());
  const [preview, setPreview] = React.useState<ImportResult[] | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<BannedList>('/banned-substances');
      setData(res.data);
      setBannedTerms(res.data.terms);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const afterChange = async (msg: string) => {
    toast.success(msg);
    await load();
    onChanged?.();
  };

  const run = async (fn: () => Promise<void>) => {
    try {
      setBusy(true);
      await fn();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const items = (data?.items ?? []).filter((s) => {
    if (statusFilter === 'banned' && !s.is_banned) return false;
    if (statusFilter === 'unbanned' && s.is_banned) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [s.common_name, ...s.aliases, s.current_legal_document || ''].some((x) => x.toLowerCase().includes(q));
  });
  const bannedCount = data?.items.filter((s) => s.is_banned).length ?? 0;

  const submitCreate = () => run(async () => {
    if (!cName.trim() || !cDecision.legal_document.trim()) {
      toast.error('Cần tên hoạt chất và số hiệu văn bản.');
      return;
    }
    await apiClient.post('/banned-substances', {
      common_name: cName.trim(), aliases: splitAliasInput(cAliases), category: cCategory, note: cNote.trim() || null,
      decision: decisionPayload(cDecision),
    });
    setCName(''); setCAliases(''); setCNote(''); setCDecision(emptyDecision());
    setPanel(null);
    await afterChange('Đã thêm chất vào danh mục.');
  });

  const startEdit = (s: BannedSubstance) => {
    setEditId(s.id);
    setEAliases(s.aliases.join('; '));
    setECategory(s.category);
    setENote(s.note || '');
  };

  const submitEdit = (s: BannedSubstance) => run(async () => {
    await apiClient.patch(`/banned-substances/${s.id}`, { aliases: splitAliasInput(eAliases), category: eCategory, note: eNote.trim() });
    setEditId(null);
    await afterChange(`Đã cập nhật ${s.common_name}.`);
  });

  const submitDecision = (s: BannedSubstance) => run(async () => {
    if (!newDecision.legal_document.trim()) {
      toast.error('Cần số hiệu văn bản.');
      return;
    }
    await apiClient.post(`/banned-substances/${s.id}/decisions`, decisionPayload(newDecision));
    setDecisionFor(null);
    await afterChange(`Đã ghi quyết định ${newDecision.action === 'BAN' ? 'cấm' : 'bỏ cấm'} cho ${s.common_name}.`);
  });

  const removeDecision = (s: BannedSubstance, d: BannedDecision) => run(async () => {
    await apiClient.delete(`/banned-substances/${s.id}/decisions/${d.id}`);
    await afterChange('Đã gỡ quyết định nhập nhầm.');
  });

  const onPdf = async (file: File) => {
    setUploadedFileName(file.name);
    setPdfParseError(null);
    setIsImportModalOpen(true);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiClient.post<{
        legal_document: string | null;
        signed_date: string | null;
        effective_date: string | null;
        warnings: string[];
        items: Omit<ImportRow, 'checked'>[];
      }>('/banned-substances/parse-pdf', fd);
      setPdfRows(res.data.items.map((i) => ({ ...i, aliases: i.aliases ?? [], checked: true })));
      setPdfWarnings(res.data.warnings);
      setImportDecision((d) => ({
        ...d,
        legal_document: res.data.legal_document || d.legal_document,
        effective_date: res.data.effective_date || d.effective_date,
      }));
      setPreview(null);
      if (!res.data.items.length) toast.warning('Không đọc được dòng nào từ PDF.');
    } catch (err) {
      const msg = getErrorMessage(err);
      setPdfParseError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const importBody = (dryRun: boolean) => ({
    ...decisionPayload(importDecision),
    dry_run: dryRun,
    items: pdfRows.filter((r) => r.checked).map(({ checked: _c, ...r }) => r),
  });

  const runPreview = () => run(async () => {
    if (!importDecision.legal_document.trim()) {
      toast.error('Cần số hiệu văn bản.');
      return;
    }
    const res = await apiClient.post<{ results: ImportResult[] }>('/banned-substances/import', importBody(true));
    setPreview(res.data.results);
  });

  const runImport = () => run(async () => {
    const res = await apiClient.post<{ results: ImportResult[] }>('/banned-substances/import', importBody(false));
    const changed = res.data.results.filter((r) => r.status === 'NEW' || r.status === 'ADD_DECISION').length;
    setPdfRows([]); setPreview(null); setPdfWarnings([]); setUploadedFileName('');
    setIsImportModalOpen(false);
    await afterChange(`Đã lưu ${changed} thay đổi từ văn bản.`);
  });

  const setRow = (i: number, patch: Partial<ImportRow>) => {
    setPdfRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setPreview(null);
  };

  const previewCounts = preview?.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
  const PREVIEW_TONE: Record<string, string> = {
    NEW: 'text-red-700 dark:text-red-400',
    ADD_DECISION: 'text-amber-700 dark:text-amber-400',
    NO_CHANGE: 'text-muted-foreground',
    DUPLICATE: 'text-muted-foreground',
    INVALID: 'text-destructive',
  };
  const PREVIEW_LABEL: Record<string, string> = {
    NEW: 'Thêm mới', ADD_DECISION: 'Ghi thêm quyết định', NO_CHANGE: 'Không đổi', DUPLICATE: 'Trùng dòng', INVALID: 'Lỗi',
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div className="flex flex-1 gap-2 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Tìm hoạt chất, tên thương phẩm, văn bản..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs h-9 bg-background" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="h-9 px-2 bg-background border border-border rounded text-xs">
              <option value="all">Tất cả ({data?.items.length ?? 0})</option>
              <option value="banned">Đang cấm ({bannedCount})</option>
              <option value="unbanned">Không cấm ({(data?.items.length ?? 0) - bannedCount})</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-9 text-xs gap-1.5"
              onClick={() => {
                setIsImportModalOpen(true);
                if (!pdfRows.length) {
                  fileRef.current?.click();
                }
              }}
            >
              <FileUp className="w-3.5 h-3.5" /> Nạp từ PDF thông tư
            </Button>
            <Button size="sm" className="h-9 text-xs gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white"
              onClick={() => setPanel(panel === 'create' ? null : 'create')}>
              <Plus className="w-3.5 h-3.5" /> Thêm chất
            </Button>
            <Button size="sm" variant="outline" className="h-9 text-xs" onClick={load} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Danh mục dùng để chặn sản phẩm khi lưu, loại thuốc khỏi gợi ý của Lavi và nhắc nông dân khi họ hỏi về chất cấm,
          kể cả chất không có trong kho. Thông tư mới bỏ cấm một chất: bấm <strong>Thêm quyết định</strong> → <strong>Bỏ cấm</strong>,
          không xóa chất (giữ lịch sử).
          {data && !data.loaded_from_database && ' ⚠️ Server đang dùng danh sách dự phòng (chưa đọc được CSDL).'}
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPdf(f);
          e.target.value = '';
        }}
      />

      {panel === 'create' && (
        <div className="bg-card p-4 rounded-xl border border-border space-y-3">
          <div className="font-semibold text-sm">Thêm chất cấm</div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <label className={lbl}>Tên hoạt chất (common name) *</label>
              <Input className={field} placeholder="VD: Carbosulfan" value={cName} onChange={(e) => setCName(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Tên thương phẩm / cách viết khác (ngăn bằng ; hoặc xuống dòng)</label>
              <Input className={field} placeholder="VD: Marshal; Sulfur" value={cAliases} onChange={(e) => setCAliases(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Nhóm</label>
              <select value={cCategory} onChange={(e) => setCCategory(e.target.value)} className="w-full h-8 px-2 bg-background border border-border rounded text-xs">
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <DecisionFields value={cDecision} onChange={setCDecision} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setPanel(null)}>Hủy</Button>
            <Button size="sm" className="h-8 text-xs" onClick={submitCreate} disabled={busy}>Lưu</Button>
          </div>
        </div>
      )}

      {/* MODAL POPUP NẠP TỪ PDF THÔNG TƯ */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="pb-2 border-b border-border">
            <DialogTitle className="text-base flex items-center gap-2">
              <FileUp className="w-4 h-4 text-emerald-700" />
              <span>Nạp danh mục chất cấm từ PDF thông tư</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Chọn file phụ lục danh mục thuốc cấm (PDF có chữ, không phải bản scan). Hệ thống đọc thành bảng nháp để bạn kiểm tra, sửa rồi mới lưu.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
            {pdfParseError && !pdfRows.length && (
              <div className="p-3 rounded-lg border border-red-300/80 bg-red-50 dark:bg-red-950/30 dark:border-red-800 text-red-900 dark:text-red-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold">Đọc file PDF thất bại {uploadedFileName ? `(${uploadedFileName})` : ''}</div>
                  <div className="text-[11px] text-red-800 dark:text-red-300">{pdfParseError}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Gợi ý: Đảm bảo dịch vụ backend (Core API) đang chạy và file PDF có chứa chữ (text), không phải file scan ảnh.
                  </div>
                </div>
              </div>
            )}

            {!pdfRows.length ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f && f.name.toLowerCase().endsWith('.pdf')) {
                    onPdf(f);
                  } else if (f) {
                    toast.error('Vui lòng chọn file định dạng PDF.');
                  }
                }}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-2.5 my-4 ${isDragging
                    ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-border hover:border-emerald-600/60 hover:bg-muted/40'
                  }`}
              >
                {busy ? (
                  <>
                    <Loader2 className="w-8 h-8 text-emerald-700 animate-spin" />
                    <div className="font-semibold text-sm">Đang đọc và trích xuất dữ liệu từ PDF...</div>
                    <div className="text-[11px] text-muted-foreground">Vui lòng đợi trong giây lát</div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-700 dark:text-emerald-300">
                      <FileUp className="w-6 h-6" />
                    </div>
                    <div className="font-semibold text-sm">Nhấn để chọn file PDF hoặc kéo thả file vào đây</div>
                    <div className="text-[11px] text-muted-foreground max-w-sm">
                      Hệ thống tự động bóc tách tên hoạt chất, tên thương phẩm và nhóm hoạt chất từ phụ lục thông tư
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileUp className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span className="font-semibold text-xs text-foreground truncate max-w-sm">{uploadedFileName || 'Tệp PDF thông tư'}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">({pdfRows.length} hoạt chất trích xuất)</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => fileRef.current?.click()}
                    disabled={busy}
                  >
                    Đổi file khác
                  </Button>
                </div>

                {pdfWarnings.length > 0 && (
                  <div className="p-2 rounded-lg border border-amber-300/70 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-0.5 text-xs">
                    {pdfWarnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
                  </div>
                )}

                <DecisionFields value={importDecision} onChange={(v) => { setImportDecision(v); setPreview(null); }} />

                <div className="max-h-[360px] overflow-auto border border-border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60 sticky top-0 z-10">
                      <tr className="text-left">
                        <th className="p-2 w-8">
                          <input type="checkbox" checked={pdfRows.every((r) => r.checked)}
                            onChange={(e) => { setPdfRows((rows) => rows.map((r) => ({ ...r, checked: e.target.checked }))); setPreview(null); }} />
                        </th>
                        <th className="p-2">Hoạt chất</th>
                        <th className="p-2">Tên khác (ngăn bằng ;)</th>
                        <th className="p-2 w-28">Nhóm</th>
                        {preview && <th className="p-2">Kết quả xem trước</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {pdfRows.map((r, i) => {
                        const checkedIdx = pdfRows.slice(0, i + 1).filter((x) => x.checked).length - 1;
                        const pr = r.checked && preview ? preview[checkedIdx] : null;
                        return (
                          <tr key={i} className={`border-t border-border ${r.checked ? '' : 'opacity-50'}`}>
                            <td className="p-2"><input type="checkbox" checked={r.checked} onChange={(e) => setRow(i, { checked: e.target.checked })} /></td>
                            <td className="p-1"><Input className={field} value={r.common_name} onChange={(e) => setRow(i, { common_name: e.target.value })} /></td>
                            <td className="p-1"><Input className={field} value={r.aliases.join('; ')} onChange={(e) => setRow(i, { aliases: splitAliasInput(e.target.value) })} /></td>
                            <td className="p-1">
                              <select value={r.category} onChange={(e) => setRow(i, { category: e.target.value })} className="w-full h-8 px-1 bg-background border border-border rounded text-xs">
                                {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                              </select>
                            </td>
                            {preview && (
                              <td className={`p-2 font-semibold ${pr ? PREVIEW_TONE[pr.status] : ''}`}>
                                {pr ? `${PREVIEW_LABEL[pr.status]}${pr.message ? `: ${pr.message}` : ''}` : ''}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="text-[11px] text-muted-foreground">
                  {pdfRows.filter((r) => r.checked).length}/{pdfRows.length} dòng được chọn
                  {previewCounts && ` · Thêm mới ${previewCounts.NEW || 0} · Ghi thêm quyết định ${previewCounts.ADD_DECISION || 0} · Không đổi ${previewCounts.NO_CHANGE || 0}${previewCounts.INVALID ? ` · Lỗi ${previewCounts.INVALID}` : ''}`}
                </div>

                {preview && !preview.some((r) => r.status === 'NEW' || r.status === 'ADD_DECISION') && (
                  <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/70 dark:bg-blue-950/30 dark:border-blue-900 text-blue-800 dark:text-blue-300 text-xs flex items-center gap-2">
                    <span className="text-base shrink-0">ℹ️</span>
                    <span>
                      Toàn bộ {pdfRows.filter((r) => r.checked).length} hoạt chất đã có sẵn trong danh mục theo văn bản này (0 thay đổi mới). Nút <strong>Lưu vào danh mục</strong> chỉ kích hoạt khi có chất mới hoặc có bổ sung tên khác / nhóm.
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-border flex justify-between items-center sm:justify-between w-full">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsImportModalOpen(false)} disabled={busy}>
              Đóng
            </Button>
            {pdfRows.length > 0 && (
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={runPreview} disabled={busy || !pdfRows.some((r) => r.checked)}>
                  {busy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Xem trước
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold disabled:opacity-50"
                  onClick={runImport}
                  disabled={busy || !preview || !preview.some((r) => r.status === 'NEW' || r.status === 'ADD_DECISION')}
                  title={
                    !preview
                      ? 'Bấm "Xem trước" để kiểm tra trước khi lưu'
                      : !preview.some((r) => r.status === 'NEW' || r.status === 'ADD_DECISION')
                        ? 'Toàn bộ chất đã có trong danh mục theo đúng văn bản này, không có thay đổi mới cần lưu.'
                        : undefined
                  }
                >
                  {busy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Lưu vào danh mục
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/60">
            <tr className="text-left">
              <th className="p-3">Hoạt chất</th>
              <th className="p-3">Tên khác</th>
              <th className="p-3 w-24">Nhóm</th>
              <th className="p-3 w-32">Trạng thái</th>
              <th className="p-3">Căn cứ hiện tại</th>
              <th className="p-3 w-40 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <React.Fragment key={s.id}>
                <tr className="border-t border-border align-top">
                  <td className="p-3 font-semibold">{s.common_name}</td>
                  <td className="p-3 text-muted-foreground">{s.aliases.join(', ')}</td>
                  <td className="p-3">{CATEGORY_LABEL[s.category] || s.category}</td>
                  <td className="p-3"><StatusBadge s={s} /></td>
                  <td className="p-3">
                    <div>{s.current_legal_document}</div>
                    {s.current_effective_date && <div className="text-[10px] text-muted-foreground">Hiệu lực {fmtDate(s.current_effective_date)}</div>}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" title="Lịch sử quyết định"
                        onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                        <History className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" title="Sửa tên khác / nhóm" onClick={() => startEdit(s)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]"
                        onClick={() => { setDecisionFor(s.id); setNewDecision(emptyDecision(s.is_banned ? 'UNBAN' : 'BAN')); }}>
                        Thêm quyết định
                      </Button>
                    </div>
                  </td>
                </tr>
                {editId === s.id && (
                  <tr className="bg-muted/30">
                    <td colSpan={6} className="p-3 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <div className="sm:col-span-2">
                          <label className={lbl}>Tên khác (ngăn bằng ; hoặc xuống dòng)</label>
                          <Input className={field} value={eAliases} onChange={(e) => setEAliases(e.target.value)} />
                        </div>
                        <div>
                          <label className={lbl}>Nhóm</label>
                          <select value={eCategory} onChange={(e) => setECategory(e.target.value)} className="w-full h-8 px-2 bg-background border border-border rounded text-xs">
                            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={lbl}>Ghi chú</label>
                          <Input className={field} value={eNote} onChange={(e) => setENote(e.target.value)} />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setEditId(null)}><X className="w-3 h-3" /></Button>
                        <Button size="sm" className="h-7 text-[11px]" onClick={() => submitEdit(s)} disabled={busy}>Lưu</Button>
                      </div>
                    </td>
                  </tr>
                )}
                {decisionFor === s.id && (
                  <tr className="bg-muted/30">
                    <td colSpan={6} className="p-3 space-y-2">
                      <div className="font-semibold">Quyết định mới cho {s.common_name}</div>
                      <DecisionFields value={newDecision} onChange={setNewDecision} />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setDecisionFor(null)}>Hủy</Button>
                        <Button size="sm" className="h-7 text-[11px]" onClick={() => submitDecision(s)} disabled={busy}>Lưu quyết định</Button>
                      </div>
                    </td>
                  </tr>
                )}
                {expanded === s.id && (
                  <tr className="bg-muted/20">
                    <td colSpan={6} className="p-3">
                      <div className="font-semibold mb-1">Lịch sử quyết định (mới nhất trước)</div>
                      <div className="space-y-1">
                        {s.decisions.map((d) => (
                          <div key={d.id} className="flex flex-wrap items-center gap-2 p-2 rounded border border-border bg-background">
                            <span className={`font-bold ${d.action === 'BAN' ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                              {d.action === 'BAN' ? 'Cấm' : 'Bỏ cấm'}
                            </span>
                            <span>{d.legal_document}</span>
                            <span className="text-muted-foreground">{d.effective_date ? `hiệu lực ${fmtDate(d.effective_date)}` : 'chưa ghi ngày hiệu lực'}</span>
                            {d.source_url && <a href={d.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">văn bản</a>}
                            {d.note && <span className="text-muted-foreground italic">{d.note}</span>}
                            <span className="text-[10px] text-muted-foreground ml-auto">{d.created_by || ''} · {new Date(d.created_at).toLocaleDateString('vi-VN')}</span>
                            {s.decisions.length > 1 && (
                              <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-destructive" disabled={busy}
                                title="Gỡ quyết định nhập nhầm" onClick={() => removeDecision(s, d)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {!items.length && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{loading ? 'Đang tải...' : 'Không có chất nào khớp.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
