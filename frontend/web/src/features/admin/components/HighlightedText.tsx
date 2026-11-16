import React from 'react';
import { splitByMention } from '../lib/product-research';

/** Tô đậm mọi lần xuất hiện của `mention` trong `text` (không phân biệt hoa thường / dấu). */
export const HighlightedText: React.FC<{ text: string; mention: string; className?: string }> = ({ text, mention, className }) => (
  <>
    {splitByMention(text, mention).map((seg, i) =>
      seg.match ? (
        <mark
          key={i}
          className={
            className ||
            'bg-amber-100 dark:bg-amber-900/50 text-foreground font-bold rounded px-0.5 not-italic'
          }
        >
          {seg.text}
        </mark>
      ) : (
        <React.Fragment key={i}>{seg.text}</React.Fragment>
      )
    )}
  </>
);
