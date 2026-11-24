import React, { useState } from 'react';
import { ExternalLink, Unlink, ChevronDown, ChevronUp, AlertCircle, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { safeHref } from '@/lib/utils';
import { FormattedSnippet } from '@/components/common/FormattedSnippet';
import type { GroupedArticleEvidence, EvidenceSnippet } from '../types';

interface Props {
  article: GroupedArticleEvidence;
  mode?: 'admin' | 'public';
  onUnlinkSnippet?: (suggestionId: number) => Promise<void>;
  unlinkingId?: number | null;
}

const UNIT_TYPE_LABELS: Record<string, string> = {
  TREATMENT: 'Xử lý',
  PREVENTION: 'Phòng ngừa',
  SYMPTOMS: 'Triệu chứng',
  CAUSE_CONDITIONS: 'Nguyên nhân',
  SUMMARY: 'Tổng quan',
};

function extractDomain(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export const EvidenceCard: React.FC<Props> = ({
  article,
  mode = 'admin',
  onUnlinkSnippet,
  unlinkingId,
}) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  const [confirmUnlinkSnippet, setConfirmUnlinkSnippet] = useState<EvidenceSnippet | null>(null);

  const domain = extractDomain(article.sourceUrl);
  const safeUrl = safeHref(article.sourceUrl);

  const metaParts: string[] = [];
  if (article.organization) metaParts.push(article.organization);
  if (article.publishedDate) metaParts.push(article.publishedDate);
  if (domain) metaParts.push(domain);

  const primarySnippet = article.snippets[0];
  const otherSnippets = article.snippets.slice(1);

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 space-y-3 shadow-2xs hover:border-border/80 transition-all text-xs">
      {/* Hàng 1: Tiêu đề bài báo & Nhãn phân loại */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 border-b border-border/40 pb-2.5">
        <div className="space-y-1 min-w-0 flex-1">
          <h4 className="font-bold text-foreground text-sm line-clamp-2 leading-snug">
            {article.sourceTitle}
          </h4>
          {metaParts.length > 0 && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
              {metaParts.join(' · ')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {primarySnippet && (
            <>
              <Badge variant="outline" className="text-[10px] font-medium border-border/60">
                {primarySnippet.isVerbatim ? 'Nguyên văn' : 'Tóm tắt'}
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-medium bg-secondary text-foreground">
                {UNIT_TYPE_LABELS[primarySnippet.unitType] || primarySnippet.unitType}
              </Badge>
            </>
          )}

          {mode === 'admin' && !article.isApproved && (
            <a
              href="/admin/knowledge"
              title="Đoạn này chưa được duyệt nên Lavi và Sổ tay chưa dùng"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
            >
              <AlertCircle className="w-3 h-3" />
              <span>Chưa duyệt</span>
            </a>
          )}
        </div>
      </div>

      {/* Nội dung câu trích hoặc toàn văn */}
      <div className="space-y-3">
        {article.snippets.map((snippet, sIdx) => {
          if (!expanded && sIdx > 0) return null;

          const { before, match, after } = snippet.sentenceHighlight;

          return (
            <div key={snippet.suggestionId} className={sIdx > 0 ? 'pt-3 border-t border-border/50' : ''}>
              {sIdx > 0 && (
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold mb-1.5">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3 text-primary" />
                    <span>Đoạn bổ sung #{sIdx + 1}</span>
                  </span>
                  <Badge variant="outline" className="text-[10px] h-5">
                    {UNIT_TYPE_LABELS[snippet.unitType] || snippet.unitType}
                  </Badge>
                </div>
              )}

              {expanded ? (
                <div className="bg-muted/30 p-3 rounded-lg border border-border/60 text-foreground leading-relaxed text-xs font-normal">
                  <FormattedSnippet text={snippet.evidenceText} mention={snippet.mentionText} variant="full" />
                </div>
              ) : (
                <div className="bg-muted/20 p-2.5 rounded-lg border border-border/50 text-foreground leading-relaxed text-xs italic">
                  <span>“</span>
                  <span>{before.replace(/^[#\s*•–—\-]+/, '')}</span>
                  {match && (
                    <mark className="bg-primary/20 text-primary font-bold px-1 py-0.2 rounded not-italic">
                      {match}
                    </mark>
                  )}
                  <span>{after}</span>
                  <span>”</span>
                </div>
              )}

              {mode === 'admin' && onUnlinkSnippet && (
                <div className="mt-2 flex items-center justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmUnlinkSnippet(snippet)}
                    disabled={unlinkingId === snippet.suggestionId}
                    className="h-7 px-2 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 font-medium"
                  >
                    <Unlink className="w-3 h-3" />
                    <span>Gỡ khỏi sản phẩm</span>
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {!expanded && otherSnippets.length > 0 && (
          <p className="text-[11px] text-muted-foreground font-medium italic">
            +{otherSnippets.length} đoạn khác trong cùng bài báo này
          </p>
        )}
      </div>

      {/* Hàng nút thao tác cuối thẻ */}
      <div className="flex items-center justify-between pt-1 border-t border-border/40 gap-2 flex-wrap">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-1.5"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Thu gọn</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Xem cả đoạn</span>
            </>
          )}
        </Button>

        {safeUrl && (
          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover hover:underline h-7 px-2"
          >
            <span>Mở bài gốc</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Dialog xác nhận gỡ liên kết gợi ý */}
      <Dialog open={!!confirmUnlinkSnippet} onOpenChange={(open) => !open && setConfirmUnlinkSnippet(null)}>
        <DialogContent className="max-w-md p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Gỡ bài này khỏi sản phẩm?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Gợi ý sẽ trở về trạng thái <strong>"Chờ xử lý" (PENDING)</strong> ở tab Gợi ý từ bài báo. Bệnh áp dụng của sản phẩm sẽ được giữ nguyên (bạn có thể tắt khuyên dùng nếu muốn).
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmUnlinkSnippet(null)}
              className="text-xs"
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (!confirmUnlinkSnippet || !onUnlinkSnippet) return;
                const sid = confirmUnlinkSnippet.suggestionId;
                setConfirmUnlinkSnippet(null);
                await onUnlinkSnippet(sid);
              }}
              className="text-xs gap-1.5"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Xác nhận gỡ</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
