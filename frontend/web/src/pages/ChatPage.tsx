import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Bot,
  Send,
  Square,
  Sparkles,
  MapPin,
  Calendar,
  RotateCcw,
  Sprout,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useAgentChat } from '@/features/chat/useAgentChat';
import { ChatMessageItem } from '@/features/chat/ChatMessageItem';
import { apiClient } from '@/lib/api-client';

export const ChatPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Mã lớp AI có dạng Tomato___Late_blight, Pepper,_bell___Bacterial_spot... (≤ 100 ký tự theo giới hạn của Agent).
  // Giá trị lạ trên URL bị bỏ qua, không ghép thẳng vào đường dẫn API.
  const rawClassCode = searchParams.get('class_code');
  const classCodeParam =
    rawClassCode && /^[A-Za-z0-9_(),. -]{1,100}$/.test(rawClassCode) ? rawClassCode : null;
  const [diseaseNameVi, setDiseaseNameVi] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const {
    messages,
    isStreaming,
    error,
    contextParams,
    setContextParams,
    sendMessage,
    stopGeneration,
    clearMessages,
  } = useAgentChat({
    initialDiseaseCode: classCodeParam,
    initialLocation: 'Hà Nam',
  });

  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Tra cứu tên bệnh tiếng Việt khi có class_code từ URL (BUG-81)
  useEffect(() => {
    if (classCodeParam) {
      apiClient
        .get(`/diseases/by-class/${encodeURIComponent(classCodeParam)}`)
        .then(res => {
          if (res.data?.common_name_vi) {
            setDiseaseNameVi(res.data.common_name_vi);
          } else {
            setDiseaseNameVi(classCodeParam.replace(/___/g, ' - ').replace(/_/g, ' '));
          }
        })
        .catch(err => {
          // Mã không có trong Sổ tay (404): không gửi ngữ cảnh bệnh sai cho Agent
          if (err?.response?.status === 404) {
            setContextParams(prev => ({ ...prev, current_disease_code: null }));
            setDiseaseNameVi(null);
            return;
          }
          // Lỗi mạng: vẫn giữ mã đã hợp lệ về định dạng, hiển thị tên thô
          setDiseaseNameVi(classCodeParam.replace(/___/g, ' - ').replace(/_/g, ' '));
        });
    } else {
      setDiseaseNameVi(null);
    }
  }, [classCodeParam, setContextParams]);

  // Tự động cuộn xuống đáy khi có tin nhắn mới hoặc streaming token
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Xóa ngữ cảnh bệnh khi bấm nút X
  const handleClearDiseaseContext = () => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('class_code');
      return next;
    });
    setContextParams(prev => ({ ...prev, current_disease_code: null }));
    setDiseaseNameVi(null);
  };

  const handleSend = () => {
    if (!inputMessage.trim() || isStreaming) return;
    sendMessage(inputMessage);
    setInputMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickQuestion = (question: string) => {
    if (isStreaming) return;
    sendMessage(question);
  };

  const quickQuestions = diseaseNameVi
    ? [
        `Cây đang bị ${diseaseNameVi}, nguyên nhân do nấm hay vi khuẩn?`,
        `Thời tiết hôm nay tại ${contextParams.location} có mưa không, tôi có thể phun thuốc được không?`,
        `Nếu vườn chỉ còn 3 ngày nữa thu hoạch thì xử lý ${diseaseNameVi} như thế nào an toàn?`,
        `Có chế phẩm sinh học đối kháng nào trị được bệnh này không?`,
      ]
    : [
        `Thời tiết hôm nay tại ${contextParams.location} có nguy cơ mưa rửa trôi thuốc BVTV không?`,
        `Cách phân biệt bệnh mốc sương và đốm lá thán thư trên cây cà chua?`,
        `Thuốc Ridomil Gold có thời gian cách ly (PHI) bao nhiêu ngày?`,
        `Cần lưu ý gì khi phun thuốc bảo vệ thực vật để không kháng thuốc?`,
      ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6 flex flex-col h-[calc(100vh-5rem)]">
      {/* Thanh Tiêu đề & Ngữ cảnh */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs mb-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                Trợ lý Cây trồng Lavi
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-none text-[10px] px-2 py-0.5">
                  AI Khuyến nông
                </Badge>
              </h1>
              <p className="text-xs text-zinc-500">
                Tác tử ReAct Loop • Tra cứu RAG Khuyến nông • Cảnh báo mưa & An toàn PHI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="text-xs h-8 gap-1.5 border-zinc-200 dark:border-zinc-700"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Ngữ cảnh vườn</span>
              {showSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>

            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMessages}
                className="text-xs h-8 text-zinc-500 hover:text-red-600 gap-1"
                title="Xóa hội thoại"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Làm mới</span>
              </Button>
            )}
          </div>
        </div>

        {/* Ngữ cảnh bệnh đang chọn từ chẩn đoán (BUG-81) */}
        {diseaseNameVi && (
          <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs bg-emerald-50/70 dark:bg-emerald-950/20 px-3 py-2 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60">
            <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
              <Sprout className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Ngữ cảnh bệnh đang hỏi:{' '}
                <strong className="font-semibold">{diseaseNameVi}</strong>{' '}
                <span className="text-[11px] font-mono text-zinc-500">({classCodeParam})</span>
              </span>
            </div>
            <button
              onClick={handleClearDiseaseContext}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
              title="Xóa ngữ cảnh bệnh"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Bảng tùy chỉnh ngữ cảnh canh tác */}
        {showSettings && (
          <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div>
              <Label className="text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center gap-1 mb-1.5 font-medium">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                Địa phương trồng (để kiểm tra dự báo mưa):
              </Label>
              <Input
                value={contextParams.location}
                maxLength={120}
                onChange={e => setContextParams(prev => ({ ...prev, location: e.target.value.slice(0, 120) }))}
                placeholder="VD: Hà Nam, Lâm Đồng, Sơn La..."
                className="h-8 text-xs bg-white dark:bg-zinc-900"
              />
            </div>

            <div>
              <Label className="text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center gap-1 mb-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                Số ngày dự kiến đến kỳ thu hoạch:
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  max="3650"
                  value={contextParams.harvest_days_left === null ? '' : contextParams.harvest_days_left}
                  onChange={e => {
                    const parsed = e.target.value === '' ? NaN : parseInt(e.target.value, 10);
                    // Agent nhận 0–3650 (vượt thì 422); để trống = chưa rõ, Agent áp dụng mức an toàn nhất
                    const val = Number.isNaN(parsed) ? null : Math.min(3650, Math.max(0, parsed));
                    setContextParams(prev => ({ ...prev, harvest_days_left: val }));
                  }}
                  placeholder="Chưa xác định (an toàn nhất)"
                  className="h-8 text-xs bg-white dark:bg-zinc-900"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setContextParams(prev => ({ ...prev, harvest_days_left: 3 }))}
                  className="h-8 text-xs shrink-0"
                >
                  Gần thu hoạch (3 ngày)
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Khu vực Tin nhắn (Scrollable Container) */}
      <div className="flex-1 overflow-y-auto px-1 py-2 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shadow-sm">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="max-w-md space-y-2">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Chào bà con! Tôi là Trợ lý Cây trồng Lavi
              </h2>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Tôi được trang bị dữ liệu tri thức Khuyến nông đối chứng, công cụ dự báo thời tiết cục bộ và chốt chặn an toàn cách ly thuốc bảo vệ thực vật.
              </p>
            </div>

            {/* Gợi ý câu hỏi nhanh */}
            <div className="w-full max-w-xl space-y-2 text-left">
              <div className="text-xs font-semibold text-zinc-500 flex items-center gap-1.5 px-1">
                <HelpCircle className="w-3.5 h-3.5" />
                Câu hỏi gợi ý bà con có thể hỏi ngay:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {quickQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickQuestion(q)}
                    className="p-3 text-left rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 text-xs text-zinc-700 dark:text-zinc-300 transition-all shadow-2xs leading-relaxed"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map(msg => <ChatMessageItem key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Thanh Nhập liệu phía dưới */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 shadow-md mt-2 shrink-0 space-y-2">
        <div className="relative">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputMessage}
            onChange={e => {
              setInputMessage(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? 'Trợ lý đang suy nghĩ và phản hồi...'
                : 'Nhập câu hỏi về tình trạng bệnh, thời tiết hoặc liều lượng thuốc (Enter để gửi)...'
            }
            disabled={isStreaming}
            maxLength={2000}
            className="w-full resize-none bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden pr-24 pl-2 py-1.5 max-h-32"
          />

          <div className="absolute right-1 bottom-1 flex items-center gap-1.5">
            {isStreaming ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={stopGeneration}
                className="h-8 px-2.5 text-xs gap-1 shadow-xs"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Dừng</span>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleSend}
                disabled={!inputMessage.trim()}
                className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-xs"
              >
                <span>Gửi</span>
                <Send className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Bảo vệ cách ly PHI & thuốc cấm tự động
          </span>
          <span>{inputMessage.length}/2000 ký tự</span>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
