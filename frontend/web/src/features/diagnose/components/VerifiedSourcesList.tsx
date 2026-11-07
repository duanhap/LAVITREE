import React from 'react';
import type { VerifiedSource } from '../types';
import { BookOpen, ExternalLink } from 'lucide-react';

interface VerifiedSourcesListProps {
  sources: VerifiedSource[];
}

export const VerifiedSourcesList: React.FC<VerifiedSourcesListProps> = ({ sources }) => {
  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">
          Tài liệu Khuyến nông & Nguồn Đối chứng
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {sources.map((source, idx) => (
          <a
            key={idx}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start justify-between rounded-xl border border-border bg-card p-3 text-sm hover:border-primary/50 hover:bg-secondary/20 transition-all shadow-xs"
          >
            <div className="space-y-1 pr-2">
              <span className="text-xs font-semibold text-primary block">
                {source.organization || 'Khuyến nông Việt Nam'}
              </span>
              <p className="font-medium text-foreground text-xs line-clamp-2 group-hover:text-primary transition-colors">
                {source.title}
              </p>
            </div>
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors mt-0.5" />
          </a>
        ))}
      </div>
    </div>
  );
};

export default VerifiedSourcesList;
