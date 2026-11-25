import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { safeHref } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  FileText,
  HelpCircle,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  Table as TableIcon,
  Quote,
  Eye,
  RefreshCw,
  Send,
  Save,
  Check,
  Sparkles,
  ClipboardPaste,
} from 'lucide-react';
import { toast } from 'sonner';

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ApprovedKnowledgeSnippet {
  id: string;
  sourceTitle: string;
  sourceUrl: string;
  unitType: string;
  contentType: string;
  evidenceText: string;
  organization: string;
  createdAt: string;
}

export interface HandbookArticleData {
  id?: number;
  disease_id?: number;
  class_code: string;
  title: string;
  summary?: string | null;
  content_markdown: string;
  author_name: string;
  faq_json?: string;
  status: string; // DRAFT | PUBLISHED | NEEDS_REVIEW
  review_reason?: string | null;
  published_at?: string | null;
  last_reviewed_at?: string | null;
  updated_at?: string | null;
}

interface AdminHandbookEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  classCode: string;
  diseaseName: string;
  plantName: string;
  onSaved?: () => void;
}

export const AdminHandbookEditorModal: React.FC<AdminHandbookEditorModalProps> = ({
  isOpen,
  onClose,
  classCode,
  diseaseName,
  plantName,
  onSaved,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [acking, setAcking] = useState<boolean>(false);

  // Form states
  const [title, setTitle] = useState<string>('');
  const [authorName, setAuthorName] = useState<string>('Ban Chuyên môn BVTV Lavitree');
  const [summary, setSummary] = useState<string>('');
  const [contentMarkdown, setContentMarkdown] = useState<string>('');
  const [faqList, setFaqList] = useState<FaqItem[]>([]);
  const [status, setStatus] = useState<string>('DRAFT');
  const [reviewReason, setReviewReason] = useState<string | null>(null);

  // Reference sources
  const [approvedSources, setApprovedSources] = useState<ApprovedKnowledgeSnippet[]>([]);
  const [activeTab, setActiveTab] = useState<'preview' | 'sources'>('preview');

  // AI Prompt & Import states
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [aiInputText, setAiInputText] = useState<string>('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load article and sources when modal opens
  useEffect(() => {
    if (!isOpen || !classCode) return;

    const loadArticleData = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get<{
          disease_info: any;
          article: HandbookArticleData | null;
          approved_knowledge_sources: ApprovedKnowledgeSnippet[];
        }>(`/handbook/admin/articles/${encodeURIComponent(classCode)}`);

        setApprovedSources(res.data.approved_knowledge_sources || []);

        if (res.data.article) {
          const art = res.data.article;
          setTitle(art.title || `Cẩm nang phòng trừ ${diseaseName} trên cây ${plantName}`);
          setAuthorName(art.author_name || 'Ban Chuyên môn BVTV Lavitree');
          setSummary(art.summary || '');
          setContentMarkdown(art.content_markdown || '');
          setStatus(art.status || 'DRAFT');
          setReviewReason(art.review_reason || null);

          try {
            const faqs = art.faq_json ? JSON.parse(art.faq_json) : [];
            setFaqList(Array.isArray(faqs) ? faqs : []);
          } catch {
            setFaqList([]);
          }
        } else {
          // Initialize template for new article
          setTitle(`Cẩm nang nhận biết và phòng trị ${diseaseName} trên cây ${plantName}`);
          setAuthorName('Ban Chuyên môn BVTV Lavitree');
          setSummary(`Hướng dẫn toàn diện về tác nhân, triệu chứng đặc trưng và phác đồ điều trị hiệu quả bệnh ${diseaseName} cho bà con nông dân trồng ${plantName}.`);
          setStatus('DRAFT');
          setReviewReason(null);
          setFaqList([
            {
              question: `Bệnh ${diseaseName} trên cây ${plantName} phát sinh mạnh nhất vào thời điểm nào?`,
              answer: 'Bệnh thường phát triển mạnh trong điều kiện ẩm độ cao, mưa kéo dài hoặc chênh lệch nhiệt độ lớn giữa ngày và đêm.',
            },
          ]);

          // Suggest initial markdown structure
          setContentMarkdown(
            `## 1. Giới thiệu chung và Tác nhân gây bệnh
Bệnh **${diseaseName}** là một trong những đối tượng dịch hại nguy hiểm thường gặp trên cây **${plantName}**, gây ảnh hưởng trực tiếp đến sinh trưởng và năng suất thu hoạch.

## 2. Triệu chứng nhận biết trên đồng ruộng
- **Giai đoạn đầu:** Xuất hiện các vết chấm nhỏ hoặc biến đổi màu sắc trên bề mặt lá/thân.
- **Giai đoạn phát triển:** Vết bệnh lan rộng nhanh, mô lá bị hoại tử, có thể xuất hiện lớp nấm mốc hoặc dịch vi khuẩn khi thời tiết ẩm ướt.
- **Hậu quả:** Cây còi cọc, lá rụng sớm, hoa và quả non bị thối hỏng.

## 3. Điều kiện phát sinh và lây lan
Nguồn bệnh lưu tồn chủ yếu trong tàn dư thực vật vụ trước hoặc trong đất. Bào tử nấm/khuẩn phát tán mạnh nhờ gió, nước mưa và dụng cụ tỉa cành.

## 4. Biện pháp quản lý và phòng trừ tổng hợp (IPM)
### 4.1. Canh tác nông nghiệp
- Vệ sinh đồng ruộng, thu gom và tiêu hủy tàn dư cây bệnh.
- Mật độ trồng thông thoáng, luân canh hợp lý.
- Cân đối dinh dưỡng N-P-K, hạn chế thừa đạm.

### 4.2. Canh tác sinh học & Hóa học
- Ưu tiên sử dụng các chế phẩm sinh học đối kháng (Trichoderma, Bacillus) vào giai đoạn đầu.
- Khi bệnh chớm xuất hiện, luân phiên sử dụng các hoạt chất đặc trị có trong danh mục được phép, tuân thủ đúng nồng độ và thời gian cách ly (PHI).`
          );
        }
      } catch (err: unknown) {
        toast.error('Lỗi khi tải dữ liệu bài cẩm nang: ' + getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    loadArticleData();
  }, [isOpen, classCode, diseaseName, plantName]);

  // Insert markdown helper into textarea
  const insertText = (prefix: string, suffix: string = '', placeholder: string = '') => {
    const el = textareaRef.current;
    if (!el) {
      setContentMarkdown((prev) => prev + prefix + placeholder + suffix);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = el.value.substring(start, end) || placeholder;
    const replacement = prefix + selected + suffix;
    const nextVal = el.value.substring(0, start) + replacement + el.value.substring(end);
    setContentMarkdown(nextVal);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 10);
  };

  const handleAddFaq = () => {
    setFaqList((prev) => [...prev, { question: '', answer: '' }]);
  };

  const handleUpdateFaq = (index: number, field: 'question' | 'answer', val: string) => {
    setFaqList((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleRemoveFaq = (index: number) => {
    setFaqList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCopySnippetText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Đã sao chép đoạn trích vào bộ nhớ tạm.');
  };

  const handleCopyAiPrompt = () => {
    const cleanDisease = diseaseName.trim().replace(/^bệnh\s+/i, '');
    const formattedDiseaseTitle = `Bệnh ${cleanDisease}`;

    // Phân nhóm đoạn trích theo loại kiến thức
    const symptomSnippets = approvedSources.filter((s) => s.unitType === 'SYMPTOMS');
    const causeSnippets = approvedSources.filter((s) => s.unitType === 'CAUSE_CONDITIONS');
    const treatmentSnippets = approvedSources.filter(
      (s) => s.unitType === 'TREATMENT' || s.unitType === 'PREVENTION'
    );
    const otherSnippets = approvedSources.filter(
      (s) => !['SYMPTOMS', 'CAUSE_CONDITIONS', 'TREATMENT', 'PREVENTION'].includes(s.unitType)
    );

    const formatSnippetList = (list: ApprovedKnowledgeSnippet[]) => {
      if (list.length === 0) return '  (Chưa có đoạn trích cụ thể cho mục này trong kho tri thức)';
      return list
        .map(
          (s, idx) =>
            `  [Đoạn ${idx + 1}] Nguồn: "${s.sourceTitle}" (${s.organization || 'Chuyên gia Nông nghiệp'}):\n  "${s.evidenceText}"`
        )
        .join('\n\n');
    };

    const prompt = `Bạn là một Kỹ sư Bảo vệ Thực vật và Chuyên gia Cây trồng hàng đầu.
Nhiệm vụ của bạn là tổng hợp và biên soạn một bài CẨM NANG BỆNH HỌC CHUYÊN SÂU bằng định dạng Markdown cho bà con nông dân và cán bộ kỹ thuật nông nghiệp.

THÔNG TIN ĐỐI TƯỢNG:
- Cây trồng: ${plantName}
- Tên bệnh tiếng Việt: ${formattedDiseaseTitle}
- Mã định danh khoa học: ${classCode}

DỮ LIỆU CĂN CỨ KHOA HỌC ĐÃ ĐƯỢC PHÊ DUYỆT TRONG HỆ THỐNG:
---
[1. TRIỆU CHỨNG NHẬN BIẾT - SYMPTOMS]:
${formatSnippetList(symptomSnippets)}

[2. NGUYÊN NHÂN & ĐIỀU KIỆN PHÁT SINH - CAUSE & CONDITIONS]:
${formatSnippetList(causeSnippets)}

[3. BIỆN PHÁP PHÒNG TRỪ & THUỐC BVTV - TREATMENT & PREVENTION]:
${formatSnippetList(treatmentSnippets)}
${otherSnippets.length > 0 ? `\n[4. TƯ LIỆU THAM KHẢO KHÁC]:\n${formatSnippetList(otherSnippets)}` : ''}
---

YÊU CẦU BIÊN TẬP:
1. Văn phong chuẩn mực khoa học nông nghiệp nhưng mộc mạc, mạch lạc, dễ nhớ, thiết thực cho bà con nông dân.
2. KHÔNG chép thô nguyên khối các đoạn trích. Hãy đúc kết, liên kết các số liệu (nhiệt độ, ẩm độ, mật độ, liều lượng) thành các câu văn gãy gọn, có danh sách gạch đầu dòng rõ ràng.
3. Nội dung Markdown BẮT BUỘC theo cấu trúc 5 phần sau:
   - ## 1. Giới thiệu chung và Tác nhân gây bệnh
   - ## 2. Triệu chứng nhận biết trên đồng ruộng (phân kỳ: chớm bệnh, phát triển mạnh, hậu quả thất thu)
   - ## 3. Điều kiện phát sinh và lây lan (thời tiết, ẩm độ, mùa vụ, cơ chế lây truyền)
   - ## 4. Biện pháp quản lý và phòng trừ tổng hợp (IPM):
     - ### 4.1. Canh tác nông nghiệp & Vệ sinh đồng ruộng
     - ### 4.2. Biện pháp sinh học (các chế phẩm đối kháng như Trichoderma, Bacillus...)
     - ### 4.3. Biện pháp hóa học (các hoạt chất đặc trị được phép, nguyên tắc luân phiên thuốc chống kháng)
   - ## 5. Bảng tóm tắt hoạt chất và lưu ý an toàn (bảng Markdown: Cột 1: Hoạt chất / Nhóm thuốc | Cột 2: Cơ chế tác động | Cột 3: Lưu ý cách ly PHI)

4. Kèm theo danh sách 3–5 câu hỏi thường gặp (FAQ) sát với thực tế đồng ruộng kèm câu giải đáp súc tích, dễ hiểu.

ĐỊNH DẠNG ĐẦU RA BẮT BUỘC:
Chỉ trả về DUY NHẤT một khối JSON hợp lệ theo schema sau (không thêm văn bản giải thích ngoài JSON):
\`\`\`json
{
  "title": "Cẩm nang nhận biết và phòng trị ${formattedDiseaseTitle} trên cây ${plantName}",
  "summary": "Tóm tắt ngắn súc tích 1-2 câu về triệu chứng chính và phác đồ điều trị hiệu quả.",
  "content_markdown": "Nội dung bài viết đầy đủ theo khung Markdown 5 mục ở trên...",
  "faq": [
    {
      "question": "Câu hỏi thực tế 1 mà nông dân hay hỏi?",
      "answer": "Câu trả lời giải thích chi tiết..."
    },
    {
      "question": "Câu hỏi 2...",
      "answer": "Câu trả lời 2..."
    }
  ]
}
\`\`\`
`;

    navigator.clipboard.writeText(prompt);
    toast.success('Đã sao chép Prompt AI Cẩm nang vào bộ nhớ tạm! Bạn hãy dán sang Gemini/Claude để tạo bài viết.');
  };

  const handleApplyAiResult = (rawText: string) => {
    if (!rawText.trim()) {
      toast.error('Vui lòng dán kết quả từ AI.');
      return;
    }

    try {
      let jsonString = rawText.trim();
      const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (codeBlockMatch) {
        jsonString = codeBlockMatch[1].trim();
      } else {
        const firstBrace = jsonString.indexOf('{');
        const lastBrace = jsonString.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonString = jsonString.substring(firstBrace, lastBrace + 1);
        }
      }

      // Check if it's valid JSON
      if (jsonString.startsWith('{') && jsonString.endsWith('}')) {
        const parsed = JSON.parse(jsonString);

        if (parsed.title && typeof parsed.title === 'string') {
          setTitle(parsed.title.trim());
        }
        if (parsed.summary && typeof parsed.summary === 'string') {
          setSummary(parsed.summary.trim());
        }
        if (parsed.content_markdown && typeof parsed.content_markdown === 'string') {
          setContentMarkdown(parsed.content_markdown.trim());
        }
        if (Array.isArray(parsed.faq) && parsed.faq.length > 0) {
          const validFaqs: FaqItem[] = parsed.faq
            .map((item: any) => ({
              question: String(item.question || item.q || item.cau_hoi || '').trim(),
              answer: String(item.answer || item.a || item.cau_tra_loi || '').trim(),
            }))
            .filter((f: FaqItem) => f.question || f.answer);

          if (validFaqs.length > 0) {
            setFaqList(validFaqs);
          }
        }

        toast.success('Đã nạp thành công bài viết và FAQ từ kết quả AI!');
        setIsAiModalOpen(false);
        setAiInputText('');
        return;
      }

      // Fallback: Nếu AI trả về Markdown thuần
      if (rawText.includes('#') || rawText.includes('##')) {
        setContentMarkdown(rawText.trim());
        toast.success('Đã nạp nội dung Markdown vào bài viết!');
        setIsAiModalOpen(false);
        setAiInputText('');
        return;
      }

      toast.error('Không tìm thấy định dạng JSON hợp lệ trong nội dung dán vào.');
    } catch (err: unknown) {
      toast.error('Lỗi khi phân tích dữ liệu JSON: ' + getErrorMessage(err));
    }
  };

  const handleSave = async (targetStatus: 'DRAFT' | 'PUBLISHED') => {
    if (!title.trim()) {
      toast.error('Vui lòng nhập tiêu đề bài cẩm nang.');
      return;
    }
    if (targetStatus === 'PUBLISHED' && !contentMarkdown.trim()) {
      toast.error('Không thể xuất bản bài cẩm nang khi nội dung đang để trống.');
      return;
    }

    setSaving(true);
    try {
      const validFaqs = faqList.filter((f) => f.question.trim() || f.answer.trim());
      const body = {
        title: title.trim(),
        summary: summary.trim() || null,
        content_markdown: contentMarkdown.trim(),
        author_name: authorName.trim() || 'Ban Chuyên môn BVTV Lavitree',
        faq_json: JSON.stringify(validFaqs),
        status: targetStatus,
      };

      const res = await apiClient.put<{ message: string; article: HandbookArticleData }>(
        `/handbook/admin/articles/${encodeURIComponent(classCode)}`,
        body
      );

      setStatus(res.data.article.status);
      setReviewReason(res.data.article.review_reason || null);
      toast.success(res.data.message || (targetStatus === 'PUBLISHED' ? 'Đã xuất bản bài viết!' : 'Đã lưu bản nháp.'));
      onSaved?.();
      if (targetStatus === 'PUBLISHED') {
        onClose();
      }
    } catch (err: unknown) {
      toast.error('Lỗi khi lưu cẩm nang: ' + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleReviewAck = async () => {
    setAcking(true);
    try {
      await apiClient.post(`/handbook/admin/articles/${encodeURIComponent(classCode)}/review-ack`);
      setStatus('PUBLISHED');
      setReviewReason(null);
      toast.success('Đã xác nhận rà soát thành công! Bài cẩm nang đã trở lại trạng thái Đã xuất bản.');
      onSaved?.();
    } catch (err: unknown) {
      toast.error('Lỗi khi xác nhận rà soát: ' + getErrorMessage(err));
    } finally {
      setAcking(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[92vh] max-h-[92vh] flex flex-col p-0 overflow-hidden bg-card border-border">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                Biên tập Cẩm nang Bệnh học
              </DialogTitle>
              {status === 'PUBLISHED' ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 text-xs">
                  <CheckCircle2 className="w-3 h-3" /> Đã xuất bản
                </Badge>
              ) : status === 'NEEDS_REVIEW' ? (
                <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/40 gap-1 text-xs">
                  <AlertTriangle className="w-3 h-3" /> Cần rà soát
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 text-xs">
                  Bản nháp (Draft)
                </Badge>
              )}
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Cây trồng: <strong className="text-foreground">{plantName}</strong> • Bệnh: <strong className="text-foreground">{diseaseName}</strong> ({classCode})
            </DialogDescription>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-auto">
            {/* Cụm công cụ AI tinh gọn (Icon buttons) */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyAiPrompt}
              className="h-8 w-8 p-0 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg shrink-0 cursor-pointer"
              title="Tạo & sao chép Prompt AI Cẩm nang (gồm dữ liệu bệnh & các đoạn trích nguồn)"
              aria-label="Tạo Prompt AI"
            >
              <Sparkles className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAiModalOpen(true)}
              className="h-8 w-8 p-0 border-primary/40 text-primary hover:bg-primary/10 rounded-lg shrink-0 cursor-pointer"
              title="Dán kết quả JSON từ AI (tự động điền bài viết & FAQ)"
              aria-label="Dán kết quả AI"
            >
              <ClipboardPaste className="w-4 h-4" />
            </Button>

            <div className="w-[1px] h-5 bg-border mx-0.5" />

            {status === 'NEEDS_REVIEW' && (
              <Button
                variant="outline"
                size="sm"
                disabled={acking}
                onClick={handleReviewAck}
                className="h-8 text-xs gap-1 border-orange-500/40 text-orange-700 dark:text-orange-400 hover:bg-orange-500/10"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{acking ? 'Đang xác nhận...' : 'Xác nhận đã rà soát'}</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => handleSave('DRAFT')}
              className="h-8 text-xs gap-1 border-border"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Đang lưu...' : 'Lưu nháp'}</span>
            </Button>
            <Button
              size="sm"
              disabled={saving}
              onClick={() => handleSave('PUBLISHED')}
              className="h-8 text-xs gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{saving ? 'Đang xử lý...' : 'Xuất bản ngay'}</span>
            </Button>
          </div>
        </div>

        {/* Warning Banner if NEEDS_REVIEW */}
        {status === 'NEEDS_REVIEW' && reviewReason && (
          <div className="bg-orange-500/15 border-b border-orange-500/30 px-5 py-2.5 flex items-center justify-between text-xs text-orange-800 dark:text-orange-300 shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
              <span>
                <strong>Cảnh báo căn cứ lỗi thời:</strong> {reviewReason}
              </span>
            </div>
          </div>
        )}

        {/* Modal Main Content: 2-Column Split View */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12 text-muted-foreground text-sm gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-primary" />
            <span>Đang tải thông tin cẩm nang và căn cứ khoa học...</span>
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border">
            {/* Left Column: Markdown & FAQ Editor (7 cols) */}
            <div className="lg:col-span-7 flex flex-col min-h-0 h-full overflow-y-auto p-4 sm:p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Tiêu đề bài cẩm nang <span className="text-destructive">*</span>
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Cẩm nang phòng trừ Bệnh mốc sương trên cây Cà chua"
                  className="h-9 text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Tác giả / Ban biên tập</label>
                  <Input
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Ban Chuyên môn BVTV Lavitree"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Tóm tắt ngắn (1-2 câu)</label>
                  <Input
                    value={summary || ''}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Mô tả súc tích cho bài viết"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {/* Markdown Toolbar */}
              <div className="space-y-1.5 flex-1 flex flex-col min-h-[320px]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    <span>Nội dung bài viết (Markdown)</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    Hỗ trợ tiêu đề, bảng biểu, danh sách, trích dẫn
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1 p-1.5 bg-muted/50 border border-border rounded-t-md text-xs">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="In đậm"
                    onClick={() => insertText('**', '**', 'văn bản')}
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="In nghiêng"
                    onClick={() => insertText('*', '*', 'văn bản')}
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </Button>
                  <div className="w-[1px] h-4 bg-border mx-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    title="Tiêu đề mục lớn (H2)"
                    onClick={() => insertText('\n## ', '\n', 'Tiêu đề mục')}
                  >
                    <Heading2 className="w-3.5 h-3.5 mr-0.5" />
                    <span>H2</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    title="Mục con (H3)"
                    onClick={() => insertText('\n### ', '\n', 'Mục con')}
                  >
                    <Heading3 className="w-3.5 h-3.5 mr-0.5" />
                    <span>H3</span>
                  </Button>
                  <div className="w-[1px] h-4 bg-border mx-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Danh sách gạch đầu dòng"
                    onClick={() => insertText('\n- ', '\n', 'Ý chính')}
                  >
                    <List className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Chèn bảng so sánh"
                    onClick={() =>
                      insertText(
                        '\n| Tiêu chí | Khuyến cáo phòng ngừa |\n|---|---|\n| Thời điểm | Khi thời tiết ẩm ướt |\n| Hoạt chất | Luân phiên sinh học / hóa học |\n'
                      )
                    }
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Khung trích dẫn / Lưu ý"
                    onClick={() => insertText('\n> **Lưu ý chuyên gia:** ', '\n', 'Nội dung lưu ý')}
                  >
                    <Quote className="w-3.5 h-3.5" />
                  </Button>
                  <div className="w-[1px] h-4 bg-border mx-1 ml-auto" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                    title="Tạo & sao chép Prompt AI Cẩm nang"
                    onClick={handleCopyAiPrompt}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-primary hover:bg-primary/10"
                    title="Dán kết quả JSON từ AI"
                    onClick={() => setIsAiModalOpen(true)}
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <Textarea
                  ref={textareaRef}
                  value={contentMarkdown}
                  onChange={(e) => setContentMarkdown(e.target.value)}
                  placeholder="Nhập nội dung bài cẩm nang bằng Markdown..."
                  className="flex-1 min-h-[300px] font-mono text-xs p-3 rounded-t-none border-t-0 focus-visible:ring-0 leading-relaxed resize-y"
                />
              </div>

              {/* FAQ Section Builder */}
              <div className="pt-2 border-t border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-primary" />
                    <label className="text-xs font-semibold text-foreground">
                      Câu hỏi thường gặp FAQ ({faqList.length})
                    </label>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddFaq}
                    className="h-7 text-xs gap-1 border-border"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Thêm câu hỏi</span>
                  </Button>
                </div>

                {faqList.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic bg-muted/30 p-2.5 rounded-md">
                    Chưa có câu hỏi thường gặp nào. Bấm "Thêm câu hỏi" để bổ sung các thắc mắc bà con nông dân hay hỏi.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {faqList.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-muted/30 border border-border rounded-lg space-y-2 relative group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-primary">
                            Câu hỏi #{idx + 1}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFaq(idx)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            title="Xóa câu hỏi này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <Input
                          value={item.question}
                          onChange={(e) => handleUpdateFaq(idx, 'question', e.target.value)}
                          placeholder="Ví dụ: Bệnh này có lây sang cây trồng khác không?"
                          className="h-8 text-xs font-medium"
                        />
                        <Textarea
                          value={item.answer}
                          onChange={(e) => handleUpdateFaq(idx, 'answer', e.target.value)}
                          placeholder="Câu trả lời giải thích chi tiết cho nông dân..."
                          className="min-h-[50px] text-xs resize-y"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Live Preview & Approved Sources (5 cols) */}
            <div className="lg:col-span-5 flex flex-col min-h-0 h-full overflow-hidden bg-muted/20">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as any)}
                className="flex flex-col h-full"
              >
                <div className="px-4 py-2 border-b border-border bg-card flex items-center justify-between shrink-0">
                  <TabsList className="h-8 p-0.5 bg-muted">
                    <TabsTrigger value="preview" className="text-xs h-7 px-3 gap-1.5">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Xem trước (Live)</span>
                    </TabsTrigger>
                    <TabsTrigger value="sources" className="text-xs h-7 px-3 gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Căn cứ nguồn ({approvedSources.length})</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Tab 1: Live Preview */}
                <TabsContent
                  value="preview"
                  className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 m-0 focus-visible:outline-hidden space-y-4"
                >
                  <div className="space-y-2 border-b border-border pb-4">
                    <h1 className="text-lg font-bold text-foreground leading-snug">
                      {title || 'Tiêu đề bài cẩm nang'}
                    </h1>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Biên soạn bởi: <strong className="text-foreground">{authorName}</strong></span>
                      <span>•</span>
                      <span>Cây: <strong className="text-foreground">{plantName}</strong></span>
                    </div>
                    {summary && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-foreground italic leading-relaxed">
                        {summary}
                      </div>
                    )}
                  </div>

                  {/* Rendered Markdown Preview */}
                  <div className="prose prose-xs sm:prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed">
                    <ReactMarkdown
                      components={{
                        h2: ({ children }) => (
                          <h2 className="text-sm font-bold text-foreground mt-4 mb-2 pb-1 border-b border-border">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-xs font-bold text-foreground mt-3 mb-1.5">
                            {children}
                          </h3>
                        ),
                        p: ({ children }) => (
                          <p className="text-xs text-foreground/90 my-2 leading-relaxed">
                            {children}
                          </p>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc pl-4 text-xs space-y-1 my-2 text-foreground/90">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal pl-4 text-xs space-y-1 my-2 text-foreground/90">
                            {children}
                          </ol>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-primary pl-3 py-1 my-2 bg-muted/40 rounded-r-md text-xs italic text-foreground/80">
                            {children}
                          </blockquote>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-3 rounded-md border border-border">
                            <table className="w-full text-xs text-left border-collapse">
                              {children}
                            </table>
                          </div>
                        ),
                        th: ({ children }) => (
                          <th className="bg-muted px-2.5 py-1.5 font-semibold text-foreground border-b border-border">
                            {children}
                          </th>
                        ),
                        td: ({ children }) => (
                          <td className="px-2.5 py-1.5 border-b border-border/50 text-foreground">
                            {children}
                          </td>
                        ),
                        a: ({ href, children }) => (
                          <a
                            href={safeHref(href)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline hover:text-primary/80"
                          >
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {contentMarkdown || '*Chưa có nội dung bài viết.*'}
                    </ReactMarkdown>
                  </div>

                  {/* FAQ Preview */}
                  {faqList.some((f) => f.question.trim()) && (
                    <div className="pt-4 border-t border-border space-y-2.5">
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-primary" />
                        <span>Câu hỏi thường gặp (FAQ)</span>
                      </h4>
                      <div className="space-y-2">
                        {faqList
                          .filter((f) => f.question.trim())
                          .map((f, i) => (
                            <div
                              key={i}
                              className="rounded-lg border border-border bg-card p-3 space-y-1"
                            >
                              <div className="text-xs font-semibold text-foreground">
                                Q: {f.question}
                              </div>
                              <div className="text-xs text-muted-foreground leading-relaxed">
                                {f.answer || '(Chưa có câu trả lời)'}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Tab 2: Approved Knowledge Snippets */}
                <TabsContent
                  value="sources"
                  className="flex-1 min-h-0 overflow-y-auto p-4 m-0 focus-visible:outline-hidden space-y-3"
                >
                  <div className="text-xs text-muted-foreground flex items-center justify-between gap-2 pb-1 border-b border-border/50">
                    <span>Căn cứ khoa học đã duyệt ({approvedSources.length}):</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyAiPrompt}
                      className="h-6 w-6 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 rounded-md shrink-0 cursor-pointer"
                      title="Tạo & sao chép Prompt AI Cẩm nang (gồm dữ liệu bệnh & các đoạn trích này)"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {approvedSources.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground bg-muted/30 rounded-lg p-4">
                      Chưa có đoạn trích tri thức nào được duyệt cho bệnh này.
                    </div>
                  ) : (
                    approvedSources.map((item) => (
                      <Card key={item.id} className="border-border bg-card text-xs">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold text-foreground line-clamp-1" title={item.sourceTitle}>
                                {item.sourceTitle}
                              </div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                <span>{item.organization || 'Chuyên gia Nông nghiệp'}</span>
                                {item.unitType && (
                                  <>
                                    <span>•</span>
                                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                                      {item.unitType}
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {item.sourceUrl && safeHref(item.sourceUrl) && (
                                <a
                                  href={safeHref(item.sourceUrl)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                  title="Mở bài báo gốc"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopySnippetText(item.evidenceText)}
                                className="h-7 w-7 p-0 border-border/70 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md cursor-pointer"
                                title="Sao chép đoạn trích này vào bộ nhớ tạm"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>

                          <div className="p-2 rounded bg-muted/50 border border-border/60 text-muted-foreground text-[11px] leading-relaxed line-clamp-4">
                            "{item.evidenceText}"
                          </div>

                          {item.sourceUrl && safeHref(item.sourceUrl) && (
                            <a
                              href={safeHref(item.sourceUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Xem link bài báo gốc</span>
                            </a>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}

        {/* Modal Nhập kết quả AI (JSON) */}
        <Dialog open={isAiModalOpen} onOpenChange={setIsAiModalOpen}>
          <DialogContent className="max-w-lg w-[92vw] bg-card border-border p-5 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <ClipboardPaste className="w-4 h-4 text-primary" />
                <span>Dán kết quả từ AI (Gemini / Claude)</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                Dán toàn bộ phản hồi từ AI (khối JSON hoặc nội dung có chứa JSON) vào ô bên dưới. Hệ thống sẽ tự động điền Tiêu đề, Tóm tắt, Markdown 5 mục và danh sách FAQ.
              </DialogDescription>
            </DialogHeader>

            <Textarea
              value={aiInputText}
              onChange={(e) => setAiInputText(e.target.value)}
              placeholder='Dán phản hồi JSON từ AI vào đây... Ví dụ: {"title": "...", "content_markdown": "...", "faq": [...]}'
              rows={10}
              className="font-mono text-xs p-3 leading-relaxed bg-background"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAiModalOpen(false);
                  setAiInputText('');
                }}
                className="h-8 text-xs"
              >
                Hủy
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleApplyAiResult(aiInputText)}
                className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Áp dụng vào bài viết</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};
