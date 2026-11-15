import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Eye, Code2, Globe, RefreshCw, Sparkles, Edit3, ChevronUp } from 'lucide-react';
import { isStandaloneMetadataLine } from '../lib';

export interface ArticleEditorProps {
  ingestText: string;
  setIngestText: (text: string) => void;
  articleEditorMode: 'preview' | 'code';
  setArticleEditorMode: (mode: 'preview' | 'code') => void;
  showPasteTip: boolean;
  setShowPasteTip: React.Dispatch<React.SetStateAction<boolean>>;
  onCrawl: () => void;
  crawlingUrl: boolean;
  crawlDisabled: boolean;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement | HTMLDivElement>) => void;
  onClear: () => void;
  isReparseTab?: boolean;
}

const renderInlineMarkdown = (line: string) => {
  const boldSegments = line.split(/(\*\*[^*\n]+\*\*)/g);
  return (
    <>
      {boldSegments.map((seg, idx) => {
        if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
          return (
            <strong key={idx} className="font-semibold text-foreground not-italic">
              {seg.slice(2, -2)}
            </strong>
          );
        }
        return <React.Fragment key={idx}>{seg}</React.Fragment>;
      })}
    </>
  );
};

export const renderFormattedArticlePreview = (rawMarkdown: string) => {
  const blocks = rawMarkdown
    .split(/\r?\n\s*\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.map((block, bIdx) => {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const isSingleMetaBlock = lines.length === 1 && isStandaloneMetadataLine(lines[0]);
    if (isSingleMetaBlock) {
      return (
        <div
          key={bIdx}
          className="inline-flex items-center text-[11px] bg-muted/60 text-muted-foreground px-2 py-0.5 rounded border border-border/70 mr-1.5 mb-1 font-medium"
        >
          {lines[0].replace(/^(?:[#>*\-•+]+\s*)+/, '').replace(/\*\*/g, '')}
        </div>
      );
    }

    return (
      <div key={bIdx} className="space-y-1">
        {lines.map((line, lIdx) => {
          if (isStandaloneMetadataLine(line)) {
            return (
              <div
                key={lIdx}
                className="text-[11px] bg-muted/60 text-muted-foreground px-2 py-0.5 rounded border border-border/70 inline-block mr-1.5 font-medium"
              >
                {line.replace(/^(?:[#>*\-•+]+\s*)+/, '').replace(/\*\*/g, '')}
              </div>
            );
          }

          const h1 = line.match(/^#\s+(.+)$/);
          if (h1) {
            return (
              <h4 key={lIdx} className="text-sm font-bold text-emerald-950 border-b border-emerald-100 pb-1.5">
                {renderInlineMarkdown(h1[1])}
              </h4>
            );
          }

          const h2 = line.match(/^##\s+(.+)$/);
          if (h2) {
            return (
              <h5 key={lIdx} className="text-[13px] font-bold text-emerald-800 pt-1">
                {renderInlineMarkdown(h2[1])}
              </h5>
            );
          }

          const h3 = line.match(/^#{3,6}\s+(.+)$/);
          if (h3) {
            return (
              <h6 key={lIdx} className="text-xs font-bold text-emerald-700 pt-0.5">
                {renderInlineMarkdown(h3[1])}
              </h6>
            );
          }

          const bullet = line.match(/^(?:[-•*+])\s+(.+)$/);
          if (bullet) {
            return (
              <div key={lIdx} className="flex items-start gap-1.5 pl-2 text-xs text-foreground/90 leading-relaxed">
                <span className="text-emerald-700 font-bold shrink-0">•</span>
                <span className="flex-1">{renderInlineMarkdown(bullet[1])}</span>
              </div>
            );
          }

          return (
            <p key={lIdx} className="text-xs text-foreground/90 leading-relaxed">
              {renderInlineMarkdown(line)}
            </p>
          );
        })}
      </div>
    );
  });
};

export const ArticleEditor: React.FC<ArticleEditorProps> = ({
  ingestText,
  setIngestText,
  articleEditorMode,
  setArticleEditorMode,
  showPasteTip,
  setShowPasteTip,
  onCrawl,
  crawlingUrl,
  crawlDisabled,
  onPaste,
  onClear,
  isReparseTab = false,
}) => {
  const hasText = ingestText.trim().length > 0;
  const showingPreview = articleEditorMode === 'preview' && hasText;

  const pasteTipToggle = (
    <button
      type="button"
      onClick={() => setShowPasteTip((v) => !v)}
      aria-expanded={showPasteTip}
      title={showPasteTip ? 'Ẩn mẹo dán bài' : 'Xem mẹo dán bài'}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold transition-colors ${
        showPasteTip
          ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
          : 'bg-white/90 border-emerald-200 text-emerald-700 hover:bg-emerald-50'
      }`}
    >
      <Sparkles className="w-3 h-3" />
      <span>Mẹo</span>
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-1.5 mb-1.5">
        <label className="font-semibold text-foreground">
          2. Dán toàn văn bài báo *
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          <div
            className="inline-flex rounded border border-border bg-muted/40 p-0.5"
            role="group"
            aria-label="Chế độ hiển thị nội dung bài báo"
          >
            <button
              type="button"
              onClick={() => setArticleEditorMode('preview')}
              disabled={!hasText}
              className={`h-5 px-2 text-[11px] font-semibold rounded inline-flex items-center gap-1 transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
                showingPreview
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title={hasText ? 'Xem trước bài báo đã chuẩn hóa định dạng' : 'Cần dán hoặc crawl nội dung trước khi xem định dạng'}
            >
              <Eye className="w-3 h-3" />
              <span>Xem định dạng</span>
            </button>
            <button
              type="button"
              onClick={() => setArticleEditorMode('code')}
              className={`h-5 px-2 text-[11px] font-semibold rounded inline-flex items-center gap-1 transition-colors ${
                !showingPreview
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Hiển thị và chỉnh sửa trực tiếp mã Markdown thô"
            >
              <Code2 className="w-3 h-3" />
              <span>Code Markdown</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onCrawl}
            disabled={crawlingUrl || crawlDisabled}
            className="h-6 px-2 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Tải nhanh nội dung từ URL ở mục 1 (nếu trang chặn bot thì copy tay)"
          >
            {crawlingUrl ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Đang crawl...</span>
              </>
            ) : (
              <>
                <Globe className="w-3 h-3" />
                <span>Crawl từ URL</span>
              </>
            )}
          </button>

          <span className="text-[10px] text-muted-foreground">
            {ingestText.length.toLocaleString('vi-VN')} / 50.000 ký tự
          </span>
        </div>
      </div>

      {showPasteTip && (
        <div className="p-2 mb-2 rounded bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-[11px] flex items-start gap-1.5">
          <Sparkles className="w-3.5 h-3.5 mt-0.5 text-emerald-700 shrink-0" />
          <span className="flex-1">
            <strong>{isReparseTab ? 'Mẹo copy bài gốc:' : 'Mẹo dán cả trang:'}</strong> Nhấn{' '}
            <kbd className="px-1 py-0.5 bg-white border border-emerald-300 rounded font-mono">Ctrl+A</kbd> rồi{' '}
            <kbd className="px-1 py-0.5 bg-white border border-emerald-300 rounded font-mono">Ctrl+C</kbd>{' '}
            {isReparseTab ? 'trên trang bài gốc rồi dán vào đây, hoặc bấm' : 'trên trang báo rồi dán vào ô dưới, hoặc bấm'}{' '}
            <strong>Crawl từ URL</strong>. Hệ thống tự lọc rác và chuyển sang <strong>Markdown sạch</strong> (mặc định mở Xem định dạng; bấm <strong>Code Markdown</strong> để sửa tay).
          </span>
          <button
            type="button"
            onClick={() => setShowPasteTip(false)}
            className="shrink-0 text-emerald-700 hover:text-emerald-900"
            aria-label="Thu gọn mẹo"
            title="Thu gọn mẹo"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {showingPreview ? (
        <div className="rounded-md border border-emerald-200 bg-background overflow-hidden shadow-2xs">
          <div className="px-3 py-1.5 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-emerald-800 font-medium inline-flex items-center gap-1">
              <Eye className="w-3 h-3" />
              <span>Bản xem trước định dạng (tiêu đề, chữ đậm, gạch đầu dòng)</span>
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {pasteTipToggle}
              <button
                type="button"
                onClick={() => setArticleEditorMode('code')}
                className="font-semibold text-emerald-700 hover:text-emerald-900 hover:underline inline-flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" />
                <span>Sửa Code</span>
              </button>
              <button
                type="button"
                onClick={onClear}
                className="font-medium text-muted-foreground hover:text-destructive hover:underline"
              >
                Xóa
              </button>
            </div>
          </div>
          <div
            tabIndex={0}
            onPaste={onPaste}
            className="max-h-[340px] min-h-[220px] overflow-y-auto p-3.5 space-y-2.5 outline-none"
          >
            {renderFormattedArticlePreview(ingestText)}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 relative">
          <div className="absolute top-1.5 right-4 z-10">{pasteTipToggle}</div>
          <Textarea
            rows={12}
            placeholder={
              isReparseTab
                ? 'Dán văn bản bài báo vào đây để bóc tách đoạn mới hoặc tái trích xuất...'
                : 'Dán toàn bộ nội dung bài báo vào đây. Hệ thống sẽ tự lọc thẻ rác HTML, chuẩn hóa Markdown, tách đoạn P1, P2... và gọi AI trích xuất thông tin.'
            }
            value={ingestText}
            onChange={(e) => setIngestText(e.target.value)}
            onPaste={onPaste}
            required
            maxLength={50000}
            className="text-xs font-mono resize-y leading-relaxed pr-16"
          />
          {hasText && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-muted-foreground">
              <span>Cú pháp Markdown: <code className="bg-muted px-1 rounded">## Tiêu đề</code> • <code className="bg-muted px-1 rounded">### Mục con</code> • <code className="bg-muted px-1 rounded">- **Nhãn:** Nội dung</code></span>
              <button
                type="button"
                onClick={() => setArticleEditorMode('preview')}
                className="text-emerald-700 hover:text-emerald-900 font-semibold hover:underline inline-flex items-center gap-1"
              >
                <Eye className="w-3 h-3" />
                <span>Xem định dạng</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ArticleEditor;
