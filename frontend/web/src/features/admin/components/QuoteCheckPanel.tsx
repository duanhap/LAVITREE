import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Loader2, ShieldCheck, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import type { SourceQuote } from '../lib/product-research';

// TASK-18-R4: kiểm tra câu "trích nguyên văn" Gemini đưa ra có thật trong trang nguồn không (server tải trang, chống SSRF).

export interface VerifyResult {
  url: string;
  quote?: string | null;
  status: 'FOUND' | 'PARTIAL' | 'NOT_FOUND' | 'NO_QUOTE' | 'FETCH_FAILED' | 'INVALID_URL';
  score: number;
  page_snippet?: string | null;
  missing_numbers: string[];
  detail?: string | null;
}

type Tone = 'ok' | 'warn' | 'bad' | 'muted';
const TONE: Record<Tone, { cls: string; Icon: React.FC<{ className?: string }> }> = {
  ok: { cls: 'text-emerald-700 dark:text-emerald-400', Icon: CheckCircle2 },
  warn: { cls: 'text-amber-700 dark:text-amber-400', Icon: AlertTriangle },
  bad: { cls: 'text-destructive', Icon: XCircle },
  muted: { cls: 'text-muted-foreground', Icon: Ban },
};

/**
 * Nhãn ngắn, ưu tiên CON SỐ (TASK-18-R5): Gemini hay viết lại câu, nên câu không nguyên văn
 * nhưng mọi con số đều có ở đoạn trang gần đó vẫn coi là dùng được.
 */
export const describeResult = (r: VerifyResult): { tone: Tone; label: string } => {
  const hasNumber = /\d/.test(r.quote || '');
  switch (r.status) {
    case 'FOUND':
      return { tone: 'ok', label: 'Đúng nguyên văn' };
    case 'PARTIAL':
    case 'NOT_FOUND':
      if (r.missing_numbers.length) return { tone: 'bad', label: `Trang không ghi số ${r.missing_numbers.join(', ')}` };
      if (hasNumber && r.score >= 0.5) return { tone: 'ok', label: 'Số liệu có trong trang (câu được viết lại)' };
      if (r.status === 'PARTIAL') return { tone: 'warn', label: 'Gần đúng (câu được viết lại)' };
      return { tone: 'warn', label: 'Không thấy câu này trong trang' };
    case 'NO_QUOTE':
      return { tone: 'muted', label: 'Trang mở được' };
    case 'FETCH_FAILED':
      return { tone: 'warn', label: 'Không tải được trang, hãy tự mở link' };
    case 'INVALID_URL':
      return { tone: 'bad', label: 'Link bị chặn / không hợp lệ' };
  }
};

const MAX_ITEMS = 8;
const MAX_URLS = 5;

interface Props {
  /** Link nguồn AI đề xuất (theo thứ tự). */
  links: string[];
  /** Câu trích theo link, đọc từ phần "Nguồn đã dùng". */
  quotes: SourceQuote[];
}

export const QuoteCheckPanel: React.FC<Props> = ({ links, quotes }) => {
  const [results, setResults] = React.useState<VerifyResult[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setResults(null);
    setError(null);
  }, [links, quotes]);

  // Mỗi câu trích là 1 mục; link không có câu trích vẫn kiểm tra xem trang có mở được không
  const items = React.useMemo(() => {
    const urls = Array.from(new Set([...quotes.map((q) => q.url), ...links])).slice(0, MAX_URLS);
    const list: { url: string; quote: string | null }[] = [];
    for (const url of urls) {
      const qs = quotes.filter((q) => q.url === url);
      if (qs.length) qs.forEach((q) => list.push({ url, quote: q.quote }));
      else list.push({ url, quote: null });
    }
    return list.slice(0, MAX_ITEMS);
  }, [links, quotes]);

  if (!items.length) return null;

  const run = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.post<{ results: VerifyResult[] }>('/knowledge/verify-quotes', { items });
      setResults(res.data.results);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 404 || status === 405
        ? 'Server đang chạy chưa có chức năng này (cần Core API bản mới).'
        : getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const described = results?.map(describeResult) ?? [];
  const bad = described.filter((d) => d.tone === 'bad').length;
  const okCount = described.filter((d) => d.tone === 'ok').length;
  // Chỉ đếm mục có câu trích; mục chỉ có link ("Trang mở được") không tính là khớp hay lệch
  const quotedCount = results ? items.filter((it, i) => it.quote && results[i]).length : 0;
  const summaryCls = bad
    ? 'text-destructive'
    : okCount === quotedCount
      ? 'text-emerald-700 dark:text-emerald-400'
      : 'text-amber-700 dark:text-amber-400';

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-violet-800 dark:text-violet-300">
          {quotes.length ? `${quotes.length} câu trích nguyên văn Gemini đưa ra` : 'Gemini không đưa câu trích nguyên văn'}
        </span>
        <Button type="button" size="sm" variant="outline" onClick={run} disabled={loading}
          className="h-7 px-2 text-[11px] gap-1 bg-background"
          title="Server tải từng trang nguồn và tìm câu trích trong trang (không gửi gì ra ngoài ngoài việc tải trang)">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
          <span>{loading ? 'Đang tải trang nguồn...' : 'Kiểm tra trích dẫn'}</span>
        </Button>
      </div>

      {error && <div className="text-[11px] text-destructive">{error}</div>}
      {results && (
        <div className={`text-[11px] font-semibold ${summaryCls}`}>
          {quotedCount === 0
            ? 'Gemini không đưa câu trích, hãy tự mở link xem số liệu'
            : `${okCount}/${quotedCount} câu trích khớp trang nguồn${bad ? ` · ${bad} sai số liệu, đừng dùng số đó` : ''}`}
        </div>
      )}

      <div className="space-y-1.5">
        {items.map((it, idx) => {
          const r = results?.[idx];
          const d = r ? describeResult(r) : null;
          const tone = d ? TONE[d.tone] : null;
          return (
            <div key={`${it.url}-${idx}`} className="p-2 rounded-lg border border-border bg-background text-[11px] space-y-0.5">
              <div className="truncate text-muted-foreground" title={it.url}>{it.url}</div>
              {it.quote && <div className="italic text-foreground">“{it.quote}”</div>}
              {d && tone && (
                <div className={`flex items-start gap-1 font-semibold ${tone.cls}`}>
                  <tone.Icon className="w-3.5 h-3.5 shrink-0 mt-px" />
                  <span>{d.label}</span>
                </div>
              )}
              {r?.page_snippet && r.status !== 'FOUND' && d?.tone !== 'ok' && (
                <div className="text-muted-foreground line-clamp-2" title={r.page_snippet}>Trang ghi: “{r.page_snippet}”</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
