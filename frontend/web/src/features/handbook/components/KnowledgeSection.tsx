import React, { useState } from 'react';
import {
  BookOpen,
  Activity,
  Microscope,
  ShieldCheck,
  Stethoscope,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  ZoomIn,
} from 'lucide-react';
import type { HandbookSection, HandbookParagraph, KnowledgeImageItem } from '../types';
import { FormattedEvidence } from './FormattedEvidence';

interface KnowledgeSectionProps {
  section: HandbookSection;
  onRefClick: (refIndex: number) => void;
  symptomImages?: KnowledgeImageItem[];
  featuredImage?: KnowledgeImageItem | null;
  onImageClick?: (img: KnowledgeImageItem) => void;
}

const ICON_MAP = {
  BookOpen,
  Activity,
  Microscope,
  ShieldCheck,
  Stethoscope,
};

export const KnowledgeSection: React.FC<KnowledgeSectionProps> = ({
  section,
  onRefClick,
  symptomImages = [],
  featuredImage,
  onImageClick,
}) => {
  const Icon = ICON_MAP[section.iconName] || BookOpen;
  // Mục Tổng quan luôn mở; các mục khác có thể thu gọn theo tiêu đề
  const isTongQuan = section.id === 'tong-quan';
  const [isOpen, setIsOpen] = useState(true);

  const isSymptomsSection = section.id === 'trieu-chung';

  // Trong mục Tổng quan: nếu có 1-2 đoạn thì đưa cả vào khung cạnh ảnh để không bị khoảng trắng
  const heroParagraphCount = section.paragraphs.length <= 2 ? section.paragraphs.length : 2;
  const heroParagraphs = section.paragraphs.slice(0, heroParagraphCount);
  const remainingParagraphs = section.paragraphs.slice(heroParagraphCount);

  return (
    <section id={section.id} className="space-y-3.5 scroll-mt-24">
      {/* Tiêu đề mục h2 - Bấm để thu gọn/mở rộng nếu không phải tổng quan */}
      <div
        className={`flex items-center justify-between pb-2 border-b border-border/60 ${
          !isTongQuan ? 'cursor-pointer select-none group' : ''
        }`}
        onClick={() => {
          if (!isTongQuan) setIsOpen(!isOpen);
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors">
            {section.title}
          </h2>
          <span className="text-xs text-muted-foreground font-normal">
            ({section.paragraphs.length} đoạn)
          </span>
        </div>

        {!isTongQuan && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground font-medium py-1 px-2 rounded-md hover:bg-secondary transition-colors"
          >
            <span>{isOpen ? 'Thu gọn' : 'Xem chi tiết'}</span>
            {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {isOpen && (
        <div className="space-y-3.5">
          {/* TRƯỜNG HỢP MỤC TỔNG QUAN CÓ ẢNH LÁ ĐẠI DIỆN: BỐ CỤC KIỂU TRUYỆN / TẠP CHÍ */}
          {isTongQuan && featuredImage && section.paragraphs.length > 0 ? (
            <div className="space-y-3.5">
              {/* Phần trên: Đoạn tóm tắt + Ảnh lá mô tả bên cạnh (lấp đầy không gian, không bị trắng trơn) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
                {/* Khung nội dung tổng quan (chiếm 7 cột) */}
                <div className="md:col-span-7 flex flex-col justify-between rounded-xl border border-border/60 bg-muted/20 dark:bg-muted/10 p-4 sm:p-5 border-l-4 border-l-emerald-600 shadow-2xs space-y-3">
                  <div className="space-y-3">
                    {heroParagraphs.map((hp, hIdx) => (
                      <div key={hp.id} className={hIdx > 0 ? 'pt-2.5 border-t border-border/40' : ''}>
                        <FormattedEvidence text={hp.evidenceText} />
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="font-semibold text-emerald-800 dark:text-emerald-400">
                      Tổng quan bệnh học
                    </span>
                    <span className="italic">Lavitree Handbook</span>
                  </div>
                </div>

                {/* Ảnh lá mô tả bên cạnh (chiếm 5 cột) */}
                <div
                  onClick={() => onImageClick?.(featuredImage)}
                  className="md:col-span-5 group relative rounded-xl overflow-hidden border border-border bg-zinc-950 cursor-pointer hover:border-primary transition-all shadow-2xs min-h-[220px] max-h-[340px] flex flex-col justify-between"
                >
                  <div className="relative w-full h-full min-h-[200px] overflow-hidden flex items-center justify-center">
                    <img
                      src={featuredImage.image_url}
                      alt={featuredImage.caption || 'Hình thái lá cây'}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute top-2.5 left-2.5">
                      <span className="inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold bg-emerald-600/90 text-white shadow-xs backdrop-blur-xs">
                        {featuredImage.plant_part === 'LEAF' ? 'Hình thái lá bệnh' : 'Ảnh triệu chứng'}
                      </span>
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="rounded-full bg-black/60 p-2 text-white shadow-md">
                        <ZoomIn className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                  {featuredImage.caption && (
                    <div className="p-2 bg-card border-t border-border/50 text-xs">
                      <p className="font-medium text-foreground line-clamp-1 text-[11px]">
                        {featuredImage.caption}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Các đoạn tổng quan còn lại (nếu có hơn 2 đoạn) trải dài ngang */}
              {remainingParagraphs.map((p) => (
                <ParagraphCard
                  key={p.id}
                  paragraph={p}
                  onRefClick={onRefClick}
                  hideCitation={true}
                />
              ))}
            </div>
          ) : (
            /* TRƯỜNG HỢP KHÔNG CÓ ẢNH HOẶC CÁC MỤC THÔNG THƯỜNG: GIỮ NGUYÊN BỐ CỤC */
            <>
              {/* Nếu là mục Triệu chứng và có ảnh triệu chứng, đưa ngay lên đầu để nông dân quan sát trực quan */}
              {isSymptomsSection && symptomImages.length > 0 && (
                <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/70 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-primary" />
                      Hình ảnh triệu chứng thực tế ({symptomImages.length})
                    </span>
                    <span className="text-[11px] text-muted-foreground">Bấm vào ảnh để phóng to</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {symptomImages.map((img) => (
                      <div
                        key={img.id}
                        onClick={() => onImageClick?.(img)}
                        className="group relative aspect-4/3 rounded-lg overflow-hidden border border-border bg-muted cursor-pointer hover:border-primary transition-all shadow-2xs"
                      >
                        <img
                          src={img.image_url}
                          alt={img.caption || 'Ảnh triệu chứng'}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <ZoomIn className="w-4 h-4 text-white" />
                        </div>
                        {img.caption && (
                          <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-xs p-1 text-[10px] text-white truncate">
                            {img.caption}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Danh sách các đoạn văn bản - Render định dạng chuẩn Admin đẹp mắt với viền xanh trái */}
              {section.paragraphs.map((p) => (
                <ParagraphCard
                  key={p.id}
                  paragraph={p}
                  onRefClick={onRefClick}
                  hideCitation={isTongQuan}
                />
              ))}
            </>
          )}
        </div>
      )}
    </section>
  );
};

interface ParagraphCardProps {
  paragraph: HandbookParagraph;
  onRefClick: (refIndex: number) => void;
  hideCitation?: boolean;
}

const ParagraphCard: React.FC<ParagraphCardProps> = ({ paragraph, onRefClick, hideCitation }) => {
  const handleRefClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onRefClick(paragraph.refIndex);
  };

  return (
    <div className="relative rounded-xl border border-border/60 bg-muted/20 dark:bg-muted/10 p-3.5 pl-4 sm:p-4 sm:pl-4.5 border-l-4 border-l-emerald-600 transition-all hover:border-primary/40 shadow-2xs space-y-2">
      {/* Nội dung đoạn văn được render định dạng chuẩn Admin (chấm tròn xanh, in đậm tiêu đề con, gạch đầu dòng rõ ràng) */}
      <FormattedEvidence text={paragraph.evidenceText} />

      {/* Nguồn trích dẫn tinh gọn (chỉ hiển thị cho các mục chuyên sâu, không hiển thị ở mục Tổng quan) */}
      {!hideCitation && paragraph.refIndex > 0 && (
        <div className="flex items-center justify-end pt-1.5 border-t border-border/30">
          <button
            type="button"
            onClick={handleRefClick}
            aria-label={`Xem tài liệu nguồn số ${paragraph.refIndex}`}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-600 hover:text-white transition-colors cursor-pointer"
          >
            <span>Nguồn trích dẫn [{paragraph.refIndex}]</span>
          </button>
        </div>
      )}
    </div>
  );
};
