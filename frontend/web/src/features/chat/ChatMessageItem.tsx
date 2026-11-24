import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  Bot,
  User,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Clock,
  BookOpen,
  BrainCircuit,
  Wrench,
  Search,
  CloudRain,
  ShieldCheck,
  ShieldAlert,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { toast } from 'sonner';
import { ChatMessage, Citation } from './types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import laviAvatarImg from '@/assets/brand/lavi-avatar-96.webp';
import { ReferenceImageGallery } from './ReferenceImageGallery';
import { ProductSuggestionCards } from './ProductSuggestionCards';
import { ResultStatusBadge } from '@/features/diagnose/components/ResultStatusBadge';

interface ChatMessageItemProps {
  message: ChatMessage;
  diseaseCode?: string | null;
}

// Bộ nhớ đệm âm thanh MP3 Neural TTS đã tạo (tránh gọi lại API khi nghe lại)
const ttsAudioCache = new Map<string, string>();
let globalPlayingAudio: HTMLAudioElement | null = null;

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message, diseaseCode }) => {
  const isUser = message.role === 'user';
  const [isStepsOpen, setIsStepsOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<'vi-VN-HoaiMyNeural' | 'vi-VN-NamMinhNeural'>('vi-VN-HoaiMyNeural');

  const effectiveDiseaseCode =
    diseaseCode ||
    (typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('class_code')
      : null);

  // Đọc câu trả lời bằng giọng nói AI Neural chất lượng cao (Microsoft Edge Neural TTS: Hoài My / Nam Minh)
  const handleToggleSpeak = async () => {
    // 1. Nếu đang phát -> Dừng phát ngay lập tức
    if (isSpeaking) {
      if (globalPlayingAudio) {
        globalPlayingAudio.pause();
        globalPlayingAudio.currentTime = 0;
        globalPlayingAudio = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      return;
    }

    // Dừng bất kỳ âm thanh nào đang phát trước đó
    if (globalPlayingAudio) {
      globalPlayingAudio.pause();
      globalPlayingAudio.currentTime = 0;
      globalPlayingAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // 2. Làm sạch Markdown để giọng đọc mạch lạc, không đọc ký tự thô
    const cleanSpeech = displayContent
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/[#*`_~>|\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanSpeech) return;

    // Hàm dự phòng (Fallback): Dùng Web Speech Synthesis của trình duyệt nếu API backend offline
    const fallbackSpeak = () => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        toast.error('Trình duyệt không hỗ trợ phát âm thanh.');
        setIsSpeaking(false);
        setIsLoadingAudio(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(cleanSpeech);
      utterance.lang = 'vi-VN';
      utterance.rate = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find(
        (v) =>
          v.name.includes('HoaiMy') ||
          v.name.includes('Natural') ||
          v.lang.startsWith('vi') ||
          v.lang.includes('VIE')
      );
      if (viVoice) utterance.voice = viVoice;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
      setIsLoadingAudio(false);
    };

    // 3. Ưu tiên gọi Microsoft Edge Neural TTS qua Backend API (giọng đọc truyền cảm, có ngữ điệu nhấn nhá, phát âm song ngữ Anh-Việt chuẩn)
    const cacheKey = `${selectedVoice}:${cleanSpeech.slice(0, 160)}:${cleanSpeech.length}`;
    const cachedUrl = ttsAudioCache.get(cacheKey);

    if (cachedUrl) {
      const audio = new Audio(cachedUrl);
      globalPlayingAudio = audio;
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        globalPlayingAudio = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        globalPlayingAudio = null;
        fallbackSpeak();
      };
      try {
        await audio.play();
        return;
      } catch (err) {
        console.warn('Cached audio playback failed, falling back:', err);
      }
    }

    setIsLoadingAudio(true);
    try {
      const res = await fetch('/api/v1/agent/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanSpeech,
          voice: selectedVoice,
        }),
      });

      if (!res.ok) {
        throw new Error(`TTS API status ${res.status}: ${res.statusText}`);
      }

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      ttsAudioCache.set(cacheKey, audioUrl);

      const audio = new Audio(audioUrl);
      globalPlayingAudio = audio;
      audio.onplay = () => {
        setIsSpeaking(true);
        setIsLoadingAudio(false);
      };
      audio.onended = () => {
        setIsSpeaking(false);
        globalPlayingAudio = null;
      };
      audio.onerror = (e) => {
        console.error('Neural Audio playback error:', e);
        setIsSpeaking(false);
        setIsLoadingAudio(false);
        globalPlayingAudio = null;
        toast.warning('Không phát được âm thanh AI Neural, đang dùng giọng tạm của máy.');
        fallbackSpeak();
      };
      await audio.play();
    } catch (err: any) {
      console.warn('Neural TTS failed, using fallback speech synthesis:', err);
      toast.warning('Máy chủ giọng đọc AI chưa phản hồi (Port 8001). Đang dùng giọng tạm của máy tính.', {
        duration: 4000,
      });
      fallbackSpeak();
    } finally {
      setIsLoadingAudio(false);
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 mb-6">
        <div className="max-w-[85%] sm:max-w-[75%] bg-emerald-700 text-white rounded-2xl rounded-tr-none px-4 py-3 shadow-sm">
          {message.image_url && (
            <div className="mb-2.5 rounded-xl overflow-hidden max-w-xs border border-white/20 bg-black/20">
              <img
                src={message.image_url}
                alt="Ảnh đính kèm từ người dùng"
                className="w-full h-auto max-h-56 object-cover cursor-pointer hover:opacity-95 transition-opacity"
                onClick={() => window.open(message.image_url, '_blank')}
              />
            </div>
          )}
          {!message.image_url && message.image_status === 'not_stored' && (
            <p className="mb-1.5 text-[11px] italic text-emerald-100">
              📷 Đã gửi 1 ảnh (ảnh không được lưu vì không nhận diện được lá cây)
            </p>
          )}
          <p className="whitespace-pre-wrap leading-relaxed text-sm sm:text-base font-normal">
            {message.content}
          </p>
          <div className="text-[10px] text-emerald-200 mt-1 text-right">
            {new Date(message.timestamp).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0 text-emerald-800">
          <User className="w-4 h-4" />
        </div>
      </div>
    );
  }

  // Assistant Message
  const hasTraceSteps = message.traceSteps && message.traceSteps.length > 0;
  const isDraft =
    Boolean(message.guardrail_triggered) ||
    message.content.includes('[DRAFT_RECOMMENDATION]') ||
    message.content.toLowerCase().includes('bản nháp');
  // Token kỹ thuật được thay bằng nhãn "Bản nháp" phía trên;
  // Loại bỏ câu khuyến cáo lặp lại ở cuối vì đã chuyển thành thanh ghi chú cố định bên dưới khung chat
  const displayContent = message.content
    .replace(/\[DRAFT_RECOMMENDATION\]\s*/g, '')
    .replace(/(?:\r?\n)*\s*Đây là gợi ý tham khảo, không thay thế tư vấn của chuyên gia\.?/gi, '')
    .trim();

  return (
    <div className="flex gap-3 mb-8 items-start">
      <img
        src={laviAvatarImg}
        alt="Lavi"
        className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 object-contain p-0.5 shrink-0 shadow-sm mt-1 dark:bg-emerald-950/40 dark:border-emerald-800"
      />

      <div className="flex-1 max-w-[92%] sm:max-w-[85%] bg-card text-card-foreground border border-border rounded-2xl rounded-tl-none p-4 sm:p-5 shadow-xs space-y-4">
        {/* Header tin nhắn AI */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
              Lavi
            </span>
            {message.is_offline_fallback && (
              <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]">
                Đang dùng hướng dẫn lưu sẵn
              </Badge>
            )}
            {message.isStreaming && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 animate-pulse font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                Đang phản hồi...
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            {/* Bộ điều khiển đọc AI Neural (Microsoft Edge Voice) */}
            {!message.isStreaming && displayContent && (
              <div className="inline-flex items-center gap-1 bg-muted/60 hover:bg-muted/90 rounded-lg p-0.5 border border-border/50">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleSpeak}
                  disabled={isLoadingAudio}
                  className={cn(
                    "h-6 px-2 text-xs gap-1 rounded-md text-muted-foreground hover:text-foreground transition-colors",
                    isSpeaking && "text-emerald-600 bg-emerald-100/70 dark:bg-emerald-950/50 font-medium",
                    isLoadingAudio && "cursor-wait opacity-80"
                  )}
                  title={isSpeaking ? "Dừng đọc" : `Nghe đọc câu trả lời bằng giọng AI (${selectedVoice === 'vi-VN-HoaiMyNeural' ? 'Nữ - Hoài My' : 'Nam - Nam Minh'})`}
                >
                  {isLoadingAudio ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                      <span className="hidden sm:inline text-[11px]">Đang tải...</span>
                    </>
                  ) : isSpeaking ? (
                    <>
                      <VolumeX className="w-3 h-3 text-emerald-600 animate-pulse" />
                      <span className="hidden sm:inline text-[11px] text-emerald-600">Dừng</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3 h-3 text-emerald-600" />
                      <span className="hidden sm:inline text-[11px]">Đọc AI</span>
                    </>
                  )}
                </Button>

                {/* Chuyển đổi giọng Nữ / Nam */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSpeaking) {
                      handleToggleSpeak();
                    }
                    setSelectedVoice((prev) =>
                      prev === 'vi-VN-HoaiMyNeural' ? 'vi-VN-NamMinhNeural' : 'vi-VN-HoaiMyNeural'
                    );
                  }}
                  className="px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-400 rounded transition-colors"
                  title={`Đổi giọng: Hiện tại là ${selectedVoice === 'vi-VN-HoaiMyNeural' ? 'Nữ (Hoài My)' : 'Nam (Nam Minh)'}`}
                >
                  {selectedVoice === 'vi-VN-HoaiMyNeural' ? 'Nữ' : 'Nam'}
                </button>
              </div>
            )}

            {typeof message.total_latency_ms === 'number' && message.total_latency_ms > 0 && (
              <span className="flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {(message.total_latency_ms / 1000).toFixed(1)}s
              </span>
            )}
            <span>
              {new Date(message.timestamp).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        {/* Kết quả nhận diện ảnh AI Vision */}
        {message.image_diagnosis && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-emerald-900 dark:text-emerald-300">
                  Kết quả nhận diện ảnh lá (Lavitree AI Vision):
                </span>
              </div>
              <ResultStatusBadge status={message.image_diagnosis.status} size="sm" />
            </div>

            <div className="flex items-center gap-2 text-foreground font-medium">
              <span>{message.image_diagnosis.disease_name}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{message.image_diagnosis.plant_name}</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold ml-auto">
                {Math.round(message.image_diagnosis.confidence * 100)}% độ tin cậy
              </span>
            </div>

            {message.image_diagnosis.warning && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md p-1.5">
                {message.image_diagnosis.warning}
              </p>
            )}

            {message.image_diagnosis.diagnosis_id && (
              <div className="pt-1 text-[11px]">
                <Link
                  to={`/history/${encodeURIComponent(message.image_diagnosis.diagnosis_id)}`}
                  className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
                >
                  <span>Xem hồ sơ ca chẩn đoán trong Lịch sử khám bệnh</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Khối các bước suy luận ReAct (XAI Observability) */}
        {hasTraceSteps && (
          <div className="rounded-xl border border-border bg-muted/40 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setIsStepsOpen(!isStepsOpen)}
              className="w-full flex items-center justify-between px-3.5 py-2 text-foreground/80 hover:bg-muted/70 transition-colors"
            >
              <div className="flex items-center gap-2 font-medium">
                <BrainCircuit className="w-4 h-4 text-emerald-600" />
                <span>Tiến trình suy luận & Tra cứu dữ liệu ({message.traceSteps?.length} bước)</span>
              </div>
              {isStepsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isStepsOpen && (
              <div className="p-3 border-t border-border space-y-2.5 max-h-64 overflow-y-auto">
                {message.traceSteps?.map((step, idx) => (
                  <div key={idx} className="flex gap-2 items-start text-muted-foreground">
                    <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-foreground mt-0.5 border border-border">
                      #{step.step}
                    </span>
                    <div className="flex-1">
                      {step.type === 'thought' && (
                        <div className="text-foreground">
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">Suy nghĩ: </span>
                          {step.thought}
                        </div>
                      )}
                      {step.type === 'action' && (
                        <div className="text-purple-700 dark:text-purple-400 font-mono text-[11px] bg-purple-50 dark:bg-purple-950/30 p-1.5 rounded border border-purple-200 dark:border-purple-900">
                          <div className="flex items-center gap-1 font-semibold">
                            <Wrench className="w-3 h-3" />
                            Gọi công cụ: {step.tool}
                          </div>
                          {step.params && (
                            <div className="mt-1 text-[10px] text-muted-foreground overflow-x-auto">
                              Tham số: {JSON.stringify(step.params)}
                            </div>
                          )}
                        </div>
                      )}
                      {step.type === 'observation' && (
                        <div className="text-muted-foreground italic text-[11px] bg-muted/50 p-1.5 rounded border border-border">
                          <span>Kết quả: </span>
                          {typeof step.observation === 'string'
                            ? step.observation
                            : JSON.stringify(step.observation)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cảnh báo an toàn cách ly PHI & Chốt chặn Guardrail (BUG-84) */}
        {message.guardrail_triggered && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3.5 flex gap-2.5 items-start text-xs text-red-900 dark:text-red-200">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-red-800 dark:text-red-300">
                Chốt chặn An toàn Thuốc Bảo vệ Thực vật & PHI:
              </div>
              <p className="mt-0.5 leading-relaxed">
                Đã kích hoạt chốt chặn an toàn thời gian cách ly (PHI). Nông sản gần ngày thu hoạch bắt buộc phải ngưng sử dụng hóa chất hoặc chuyển sang chế phẩm sinh học đối kháng.
              </p>
            </div>
          </div>
        )}

        {/* Cảnh báo Bản nháp chuyên gia (BUG-84) */}
        {isDraft && (
          <div className="flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-3 py-1.5 rounded-lg font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Phác đồ dự kiến — Cần Bác sĩ Cây trồng hoặc Cán bộ Khuyến nông xác nhận trước khi phun.</span>
          </div>
        )}

        {/* Nội dung câu trả lời chính (Markdown Rendering an toàn) */}
        {/* Dự án không dùng plugin typography: tự định dạng danh sách, tiêu đề, đoạn cho markdown */}
        <div className="text-sm sm:text-[15px] text-foreground leading-relaxed break-words [&_p]:my-2 [&_p:first-child]:mt-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_strong]:font-semibold [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:font-semibold [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_hr]:my-3 [&_hr]:border-border">
          <ReactMarkdown
            components={{
              // Chặn các thẻ HTML nguy hiểm, style chuẩn Be Vietnam Pro
              a: ({ href, children }) => {
                const isSafe = href?.startsWith('http://') || href?.startsWith('https://');
                return (
                  <a
                    href={isSafe ? href : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 dark:text-emerald-400 underline font-medium hover:text-emerald-800"
                  >
                    {children}
                  </a>
                );
              },
              table: ({ children }) => (
                <div className="overflow-x-auto my-3 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                  <table className="w-full text-xs text-left border-collapse">{children}</table>
                </div>
              ),
              th: ({ children }) => (
                <th className="bg-zinc-100 dark:bg-zinc-800 p-2 font-semibold border-b border-zinc-200 dark:border-zinc-700">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="p-2 border-b border-zinc-100 dark:border-zinc-800">{children}</td>
              ),
              img: ({ src, alt }) => {
                if (!src) return null;
                // Siết chặt: chỉ vẽ <img> nếu src nằm trong danh sách ảnh reference_images đã duyệt
                const isApproved = message.reference_images?.some((r) => r.image_url === src);
                if (!isApproved) {
                  return (
                    <a
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline text-xs inline-flex items-center gap-1 my-1"
                    >
                      <span>[Ảnh minh họa: {alt || 'Liên kết ngoài'}]</span>
                    </a>
                  );
                }
                return (
                  <span className="block my-3">
                    <img
                      src={src}
                      alt={alt || 'Ảnh minh họa triệu chứng'}
                      className="max-h-72 max-w-full rounded-xl object-contain border border-border shadow-xs hover:shadow-md transition-all cursor-pointer bg-muted/20 hover:opacity-95"
                      loading="lazy"
                      onClick={() => window.open(src, '_blank')}
                    />
                    {alt && (
                      <span className="block text-xs text-muted-foreground mt-1.5 italic">
                        📷 {alt} (Bấm vào ảnh để xem kích thước lớn)
                      </span>
                    )}
                  </span>
                );
              },
            }}
          >
            {displayContent}
          </ReactMarkdown>
        </div>

        {/* Ảnh mẫu triệu chứng bệnh đã kiểm duyệt từ Kho tri thức */}
        {message.reference_images && message.reference_images.length > 0 && (
          <ReferenceImageGallery images={message.reference_images} diseaseCode={effectiveDiseaseCode} />
        )}

        {/* Thẻ gợi ý sản phẩm điều trị (Chuyển sang /store/:id) */}
        {message.suggested_products && message.suggested_products.length > 0 && (
          <ProductSuggestionCards products={message.suggested_products} />
        )}

        {/* Khối Danh mục Nguồn tài liệu tham khảo (BẮT BUỘC Điều 25 Luật SHTT) */}
        <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs">
          {message.citations && message.citations.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-zinc-700 dark:text-zinc-300">
                <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nguồn tài liệu tham khảo chính thức:</span>
              </div>

              <div className="space-y-1.5">
                {message.citations.map((c: Citation, cIdx: number) => {
                  const isSafeUrl = c.source_url?.startsWith('http://') || c.source_url?.startsWith('https://');
                  return (
                    <div
                      key={cIdx}
                      className="bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-[11px] space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {c.source_title || 'Tài liệu khuyến nông'}
                        </span>
                        {c.is_verbatim ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px] px-1.5 py-0">
                            Trích nguyên văn
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-zinc-500">
                            Tóm tắt
                          </Badge>
                        )}
                      </div>

                      <div className="text-zinc-500 flex items-center justify-between">
                        {/* Không tự điền tên cơ quan: thiếu thì ghi rõ là chưa rõ, tránh gán sai nguồn */}
                        <span>Cơ quan: {c.organization || 'Chưa rõ cơ quan'}</span>
                        {isSafeUrl && (
                          <a
                            href={c.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                          >
                            Mở bài gốc <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>

                      {c.excerpt && (
                        <p className="text-zinc-600 dark:text-zinc-400 italic bg-white dark:bg-zinc-900 p-1.5 rounded border border-zinc-100 dark:border-zinc-800">
                          {c.is_verbatim ? `"${c.excerpt}"` : c.excerpt}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-zinc-400 italic text-[11px]">
              Không có tài liệu tham khảo bổ sung cho câu trả lời này.
            </div>
          )}
        </div>

        {/* Nút Xem bệnh này trong Sổ tay (TASK-20) */}
        {!isUser && !message.isStreaming && message.receivedFinal && effectiveDiseaseCode && (
          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-end">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-7 text-xs border-primary text-primary hover:bg-primary/10 transition-colors"
            >
              <Link to={`/handbook/${encodeURIComponent(effectiveDiseaseCode)}`}>
                <BookOpen className="w-3.5 h-3.5 mr-1" />
                Xem bệnh này trong Sổ tay
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
