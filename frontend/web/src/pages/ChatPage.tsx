import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Send,
  Square,
  Plus,
  MessageSquare,
  Trash2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  MapPin,
  Calendar,
  Sprout,
  X,
  PanelLeftClose,
  PanelLeft,
  HelpCircle,
  ShieldCheck,
  RotateCcw,
  Mic,
  MicOff,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAgentChat } from '@/features/chat/useAgentChat';
import { ChatMessageItem } from '@/features/chat/ChatMessageItem';
import { ChatSession, ChatMessage } from '@/features/chat/types';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import laviAvatarImg from '@/assets/brand/lavi-avatar-192.webp';
import lavi3dImg from '@/assets/brand/lavi-3d-happy-720.webp';

const SESSIONS_STORAGE_KEY = 'lavitree_chat_sessions_v2';
const LOCATION_STORAGE_KEY = 'lavitree_garden_location';

function readSavedLocation(): string {
  try {
    return localStorage.getItem(LOCATION_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export const ChatPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Ngữ cảnh bệnh từ URL query (?class_code=...)
  const rawClassCode = searchParams.get('class_code');
  const classCodeParam =
    rawClassCode && /^[A-Za-z0-9_(),. -]{1,100}$/.test(rawClassCode) ? rawClassCode : null;
  const [diseaseNameVi, setDiseaseNameVi] = useState<string | null>(null);

  // Giao diện: Thu gọn / mở rộng sidebar lịch sử & bảng cài đặt vườn
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showGardenSettings, setShowGardenSettings] = useState(false);

  // Quản lý danh sách các phiên trò chuyện (Chat Sessions History)
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem(SESSIONS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const {
    messages,
    setMessages,
    isStreaming,
    error,
    conversationId,
    setConversationId,
    contextParams,
    setContextParams,
    sendMessage,
    stopGeneration,
    clearMessages,
    loadSession,
  } = useAgentChat({
    initialDiseaseCode: classCodeParam,
    initialLocation: readSavedLocation(),
  });

  const [inputMessage, setInputMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Chỉ tự cuộn theo câu trả lời khi người dùng đang ở cuối khung; kéo lên đọc lại thì không bị giật xuống
  const stickToBottomRef = useRef(true);

  // Tự động lưu sessions vào localStorage khi có thay đổi
  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.warn('Failed to save chat sessions to localStorage:', e);
    }
  }, [sessions]);

  // Cập nhật session hiện tại khi messages hoặc conversationId thay đổi
  useEffect(() => {
    if (messages.length === 0) return;

    const firstUserMsg = messages.find(m => m.role === 'user');
    const title = firstUserMsg ? firstUserMsg.content.slice(0, 48) : 'Cuộc trò chuyện mới';
    const now = new Date().toISOString();

    setSessions(prevSessions => {
      // Nếu đã có activeSessionId, cập nhật session đó
      const existingIdx = prevSessions.findIndex(
        s => s.id === activeSessionId || (conversationId && s.id === conversationId)
      );

      if (existingIdx >= 0) {
        const updated = [...prevSessions];
        updated[existingIdx] = {
          ...updated[existingIdx],
          messages,
          contextParams,
          updatedAt: now,
          title: updated[existingIdx].title || title,
        };
        return updated;
      }

      // Chưa có session: tạo session mới
      const newId = conversationId || `conv-${Date.now()}`;
      if (!activeSessionId) {
        setActiveSessionId(newId);
      }

      const newSession: ChatSession = {
        id: newId,
        title,
        createdAt: now,
        updatedAt: now,
        messages,
        contextParams,
      };

      return [newSession, ...prevSessions];
    });
  }, [messages, conversationId, activeSessionId, contextParams]);

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
          if (err?.response?.status === 404) {
            setContextParams(prev => ({ ...prev, current_disease_code: null }));
            setDiseaseNameVi(null);
            return;
          }
          setDiseaseNameVi(classCodeParam.replace(/___/g, ' - ').replace(/_/g, ' '));
        });
    } else {
      setDiseaseNameVi(null);
    }
  }, [classCodeParam, setContextParams]);

  // Nhớ địa phương người dùng đã nhập cho lần sau
  useEffect(() => {
    try {
      localStorage.setItem(LOCATION_STORAGE_KEY, contextParams.location || '');
    } catch {
      // ignore
    }
  }, [contextParams.location]);

  // Cuộn riêng khung tin nhắn (scrollIntoView sẽ cuộn cả trang, làm trôi thanh điều hướng)
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (el && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleScroll = () => {
    const el = scrollAreaRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const focusInput = () => {
    // Đợi React vẽ xong rồi mới đặt lại con trỏ vào ô nhập
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  // Hành động: Bắt đầu một đoạn chat mới (New Chat - ChatGPT / Messenger style)
  const handleNewChat = useCallback(() => {
    clearMessages();
    setActiveSessionId(null);
    setInputMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [clearMessages]);

  // Hành động: Chọn xem một cuộc trò chuyện cũ trong Lịch sử
  const handleSelectSession = useCallback(
    (session: ChatSession) => {
      if (session.id === activeSessionId) return;
      setActiveSessionId(session.id);
      loadSession(session);
    },
    [activeSessionId, loadSession]
  );

  // Hành động: Xóa một phiên trò chuyện
  const handleDeleteSession = useCallback(
    (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        handleNewChat();
      }
    },
    [activeSessionId, handleNewChat]
  );

  // Hành động: Xóa toàn bộ lịch sử trò chuyện
  const handleClearAllSessions = useCallback(() => {
    if (window.confirm('Bạn có chắc muốn xóa toàn bộ lịch sử các cuộc trò chuyện?')) {
      setSessions([]);
      handleNewChat();
    }
  }, [handleNewChat]);

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

  // Nhận diện giọng nói (Speech-to-Text qua Web Speech API & getUserMedia Permission)
  const [isListening, setIsListening] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Đính kèm ảnh lá cây / cây trồng
  const [attachedImage, setAttachedImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const handleToggleListening = async () => {
    // 1. Nếu đang nghe -> Bấm lại để dừng nghe
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    // 2. Kiểm tra hỗ trợ Web Speech Recognition của trình duyệt
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error('Trình duyệt của bạn chưa hỗ trợ nhận diện giọng nói (vui lòng dùng Google Chrome hoặc Microsoft Edge).');
      return;
    }

    // 3. Kích hoạt quyền Microphone
    try {
      setIsRequestingPermission(true);
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (err: any) {
      console.warn('Microphone permission not granted or blocked:', err);
      setIsRequestingPermission(false);
      setIsListening(false);
      toast.error('Micro đang bị chặn: Bạn bấm vào biểu tượng ⚙️ hoặc 🔒 ở đầu thanh URL (trước chữ localhost) rồi gạt BẬT Micro nhé!', {
        duration: 7000,
      });
      return;
    } finally {
      setIsRequestingPermission(false);
    }

    // 4. Khởi chạy nhận diện giọng nói
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        toast.info('Lavi đang lắng nghe bạn nói...');
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setInputMessage(transcript);
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          toast.error('Micro đang bị chặn: Bạn bấm vào biểu tượng ⚙️ hoặc 🔒 ở đầu thanh URL (trước chữ localhost) rồi gạt BẬT Micro nhé!', {
            duration: 7000,
          });
        } else if (event.error !== 'no-speech') {
          toast.error('Lỗi nhận diện giọng nói: ' + event.error);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      toast.error('Không thể kích hoạt microphone: ' + (err.message || ''));
      setIsListening(false);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn tệp định dạng hình ảnh (JPG, PNG, WEBP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Dung lượng ảnh tối đa là 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImage({
        file,
        previewUrl: reader.result as string,
      });
      focusInput();
    };
    reader.readAsDataURL(file);

    e.target.value = '';
  };

  const handleRemoveImage = () => {
    setAttachedImage(null);
  };

  const handleSend = () => {
    if ((!inputMessage.trim() && !attachedImage) || isStreaming) return;
    stickToBottomRef.current = true;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const textToSend = inputMessage.trim() || 'Lavi xem giúp mình ảnh lá cây này bị bệnh gì và cách xử lý với nhé!';
    const imgUrl = attachedImage?.previewUrl;

    sendMessage(textToSend, undefined, imgUrl);
    setInputMessage('');
    setAttachedImage(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    focusInput();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickQuestion = (question: string) => {
    if (isStreaming) return;
    stickToBottomRef.current = true;
    sendMessage(question);
    focusInput();
  };

  // Câu hỏi gợi ý không gắn địa danh hay tên thuốc cụ thể; câu thời tiết chỉ hiện khi người dùng đã nhập địa phương
  const location = (contextParams.location || '').trim();
  const weatherQuestion = location
    ? `Hôm nay ở ${location} có mưa không, tôi phun thuốc được không?`
    : 'Làm sao để thuốc không bị mưa rửa trôi sau khi phun?';
  const quickQuestions = diseaseNameVi
    ? [
      `Bệnh ${diseaseNameVi} do nấm hay vi khuẩn gây ra, lây lan thế nào?`,
      `Xử lý ${diseaseNameVi} thế nào khi còn ít ngày nữa là thu hoạch?`,
      `Có chế phẩm sinh học nào dùng được cho bệnh ${diseaseNameVi} không?`,
      weatherQuestion,
    ]
    : [
      'Lá cà chua có đốm nâu, viền vàng là bị bệnh gì?',
      'Phân biệt bệnh sương mai và bệnh đốm vòng trên cà chua thế nào?',
      'Trước khi thu hoạch bao lâu thì phải ngưng phun thuốc?',
      weatherQuestion,
    ];

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* ========================================================================= */}
      {/* 1. SIDEBAR TRÁI: LỊCH SỬ CHAT & NÚT TẠO ĐOẠN CHAT MỚI (CHATGPT STYLE) */}
      {/* ========================================================================= */}
      <aside
        className={cn(
          'h-full border-r border-border bg-card/60 backdrop-blur-xs flex flex-col shrink-0 transition-all duration-300 z-30',
          isSidebarOpen ? 'w-72 sm:w-80' : 'w-0 -translate-x-full border-r-0 overflow-hidden'
        )}
      >
        {/* Header Sidebar: Nút New Chat + Ẩn Sidebar */}
        <div className="p-3 border-b border-border/70 flex items-center gap-2">
          <Button
            onClick={handleNewChat}
            className="flex-1 justify-start gap-2 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold truncate">Đoạn chat mới</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(false)}
            className="h-10 w-10 text-muted-foreground hover:text-foreground shrink-0 rounded-xl"
            title="Đóng thanh lịch sử"
          >
            <PanelLeftClose className="w-4 h-4" />
          </Button>
        </div>

        {/* Danh sách các phiên trò chuyện */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Lịch sử trò chuyện</span>
            {sessions.length > 0 && (
              <span className="text-[10px] lowercase text-muted-foreground/80">
                {sessions.length} hội thoại
              </span>
            )}
          </div>

          {sessions.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto opacity-30 text-emerald-600" />
              <p>Chưa có cuộc trò chuyện nào.</p>
              <p className="text-[11px] text-muted-foreground/80">
                Gửi câu hỏi để bắt đầu phiên tư vấn cùng Lavi nhé!
              </p>
            </div>
          ) : (
            sessions.map(s => {
              const isActive = s.id === activeSessionId;
              const dateObj = new Date(s.updatedAt);
              const timeFormatted = dateObj.toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const dateFormatted = dateObj.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
              });

              return (
                <div
                  key={s.id}
                  onClick={() => handleSelectSession(s)}
                  className={cn(
                    'group relative flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl cursor-pointer text-xs transition-all border',
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 font-medium border-emerald-300/80 dark:border-emerald-800 shadow-2xs'
                      : 'hover:bg-muted/70 text-foreground/80 border-transparent'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <MessageSquare
                      className={cn(
                        'w-4 h-4 shrink-0',
                        isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate leading-tight text-xs">{s.title || 'Cuộc trò chuyện'}</p>
                      <span className="text-[10px] text-muted-foreground/70 mt-0.5 block">
                        {dateFormatted} lúc {timeFormatted} · {s.messages.length} tin
                      </span>
                    </div>
                  </div>

                  {/* Nút xóa session */}
                  <button
                    type="button"
                    onClick={e => handleDeleteSession(e, s.id)}
                    className="opacity-0 group-hover:opacity-100 hover:text-destructive p-1 rounded-md transition-opacity text-muted-foreground"
                    title="Xóa đoạn chat này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Sidebar: Xóa tất cả */}
        {sessions.length > 0 && (
          <div className="p-2.5 border-t border-border/70">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAllSessions}
              className="w-full justify-center text-xs text-muted-foreground hover:text-destructive h-8 gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa toàn bộ lịch sử</span>
            </Button>
          </div>
        )}
      </aside>

      {/* ========================================================================= */}
      {/* 2. KHU VỰC CHAT CHÍNH (FULL SCREEN CONTAINER) */}
      {/* ========================================================================= */}
      <section className="flex-1 flex flex-col h-full min-w-0 bg-background relative">
        {/* Thanh Tiêu đề Trên cùng của Khung Chat */}
        <header className="border-b border-border bg-card/80 backdrop-blur-md px-4 py-2.5 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            {/* Nút bật/tắt Sidebar lịch sử */}
            {!isSidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen(true)}
                className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0 rounded-xl"
                title="Mở lịch sử trò chuyện"
              >
                <PanelLeft className="w-5 h-5 text-emerald-700" />
              </Button>
            )}

            <div className="relative shrink-0">
              <img
                src={laviAvatarImg}
                alt="Lavi"
                className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 dark:border-emerald-800 object-contain p-0.5 shadow-2xs"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-card rounded-full" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm sm:text-base font-bold text-foreground truncate">
                  Trợ lý Cây trồng Lavi
                </h1>
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-none text-[10px] px-1.5 py-0">
                  AI Khuyến nông
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
                Tư vấn chuẩn tri thức khuyến nông · Cảnh báo mưa & An toàn PHI thuốc BVTV
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Nút bật cài đặt Vườn */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGardenSettings(!showGardenSettings)}
              className="text-xs h-8 gap-1.5 border-border bg-card hover:bg-muted text-foreground"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Ngữ cảnh vườn</span>
              {showGardenSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>

            {/* Nút tạo chat mới tiện lợi trên Header */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewChat}
              className="text-xs h-8 gap-1 border-border bg-card hover:bg-muted text-foreground"
              title="Tạo cuộc trò chuyện mới"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden md:inline">Chat mới</span>
            </Button>
          </div>
        </header>

        {/* Thanh Ngữ cảnh bệnh đang chọn từ chẩn đoán (nếu có) */}
        {diseaseNameVi && (
          <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border-b border-emerald-200/70 dark:border-emerald-800/60 px-4 py-2 flex items-center justify-between text-xs text-emerald-950 dark:text-emerald-200 shrink-0">
            <div className="flex items-center gap-2 truncate">
              <Sprout className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">
                Ngữ cảnh bệnh đang hỏi: <strong className="font-semibold">{diseaseNameVi}</strong>
              </span>
            </div>
            <button
              onClick={handleClearDiseaseContext}
              className="text-muted-foreground hover:text-foreground p-1 shrink-0 ml-2"
              title="Xóa ngữ cảnh bệnh"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Bảng tùy chỉnh Ngữ cảnh canh tác (Đóng/Mở linh hoạt) */}
        {showGardenSettings && (
          <div className="border-b border-border bg-card p-4 text-xs shrink-0 shadow-xs animate-in slide-in-from-top-2 duration-200">
            <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-1.5 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  Địa phương canh tác (để kiểm tra dự báo mưa rửa trôi thuốc):
                </Label>
                <Input
                  value={contextParams.location}
                  maxLength={120}
                  onChange={e =>
                    setContextParams(prev => ({ ...prev, location: e.target.value.slice(0, 120) }))
                  }
                  placeholder="VD: Đức Trọng, Lâm Đồng"
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div>
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-1.5 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  Số ngày dự kiến đến kỳ thu hoạch (để kiểm tra PHI):
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="3650"
                    value={
                      contextParams.harvest_days_left === null
                        ? ''
                        : contextParams.harvest_days_left
                    }
                    onChange={e => {
                      const parsed = e.target.value === '' ? NaN : parseInt(e.target.value, 10);
                      const val = Number.isNaN(parsed) ? null : Math.min(3650, Math.max(0, parsed));
                      setContextParams(prev => ({ ...prev, harvest_days_left: val }));
                    }}
                    placeholder="Chưa rõ (áp dụng an toàn nhất)"
                    className="h-8 text-xs bg-background"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setContextParams(prev => ({ ...prev, harvest_days_left: 3 }))}
                    className="h-8 text-xs shrink-0 bg-background"
                  >
                    Gần hái (3 ngày)
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Khu vực Tin nhắn (Cuộn tự do, căn giữa tối ưu tầm nhìn như ChatGPT / Messenger) */}
        <div
          ref={scrollAreaRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6"
        >
          <div className="max-w-3xl sm:max-w-4xl mx-auto w-full space-y-6">
            {messages.length === 0 ? (
              <div className="py-2 sm:py-6 flex flex-col items-center justify-center text-center space-y-4">
                <img
                  src={lavi3dImg}
                  alt=""
                  className="w-24 sm:w-28 drop-shadow-md motion-safe:animate-[lavi-float_5s_ease-in-out_infinite]"
                />

                <div className="max-w-md space-y-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                    Chào bạn, mình là Lavi!
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    Hỏi mình về bệnh cây, cách phòng trừ, liều lượng thuốc hoặc kiểm tra thời tiết xem có nên phun thuốc hôm nay không nhé.
                  </p>
                </div>

                {/* 4 Câu hỏi gợi ý nhanh — màu sắc Card sáng rõ, không bị khối đen cụt lủn */}
                <div className="w-full max-w-2xl space-y-2.5 text-left">
                  <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 px-1">
                    <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Câu hỏi gợi ý bà con có thể hỏi ngay:</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {quickQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleQuickQuestion(q)}
                        className="p-3.5 text-left rounded-2xl border border-border bg-card hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30 hover:border-emerald-300 dark:hover:border-emerald-700 text-xs sm:text-sm text-card-foreground transition-all shadow-2xs hover:shadow-xs leading-relaxed group flex items-start gap-2.5"
                      >
                        <span className="text-emerald-600 font-bold text-xs shrink-0 mt-0.5">
                          #{idx + 1}
                        </span>
                        <span className="flex-1">{q}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <ChatMessageItem
                  key={msg.id}
                  message={msg}
                  diseaseCode={contextParams.current_disease_code || classCodeParam}
                />
              ))
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. KHU VỰC NHẬP TIN NHẮN PHÍA DƯỚI (PINNED INPUT BAR) */}
        {/* ========================================================================= */}
        <div className="shrink-0 p-3 sm:p-4 bg-background border-t border-border/80">
          <div className="max-w-3xl sm:max-w-4xl mx-auto w-full">
            {/* Ảnh đính kèm xem trước nếu người dùng vừa chọn ảnh */}
            {attachedImage && (
              <div className="mb-2 flex items-center gap-2.5 p-2 bg-card border border-emerald-300 dark:border-emerald-800 rounded-xl shadow-xs w-fit max-w-full animate-in fade-in zoom-in-95">
                <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-border shrink-0 bg-muted">
                  <img
                    src={attachedImage.previewUrl}
                    alt="Xem trước ảnh đính kèm"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-xs truncate max-w-[180px] sm:max-w-xs">
                  <p className="font-medium text-foreground truncate">{attachedImage.file.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {(attachedImage.file.size / 1024).toFixed(0)} KB • Đã sẵn sàng gửi
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleRemoveImage}
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive"
                  title="Gỡ ảnh"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            <div className="bg-card border border-border rounded-2xl p-2 sm:p-2.5 shadow-sm focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all space-y-1.5">
              <div className="relative flex items-end gap-1.5 sm:gap-2">
                {/* Nút đính kèm ảnh lá cây */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8.5 w-8.5 rounded-xl shrink-0 text-muted-foreground hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  title="Gửi kèm ảnh lá cây / sâu bệnh"
                >
                  <ImageIcon className="w-4 h-4" />
                </Button>

                {/* Nút Microphone nhập bằng giọng nói */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isRequestingPermission}
                  onClick={handleToggleListening}
                  className={cn(
                    "h-8.5 w-8.5 rounded-xl shrink-0 transition-all",
                    isListening
                      ? "text-red-600 bg-red-100 hover:bg-red-200 dark:bg-red-950/60 dark:text-red-400 animate-pulse ring-2 ring-red-400"
                      : "text-muted-foreground hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40",
                    isRequestingPermission && "opacity-80 cursor-wait text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                  )}
                  title={
                    isRequestingPermission
                      ? "Vui lòng bấm 'Cho phép' trên thông báo của trình duyệt..."
                      : isListening
                      ? "Đang lắng nghe... Bấm để dừng"
                      : "Nói câu hỏi (Microphone tiếng Việt)"
                  }
                >
                  {isRequestingPermission ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  ) : isListening ? (
                    <MicOff className="w-4 h-4 text-red-600 animate-bounce" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </Button>

                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputMessage}
                  onChange={e => {
                    setInputMessage(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isStreaming
                      ? 'Lavi đang trả lời… bạn cứ gõ câu tiếp theo'
                      : isListening
                      ? 'Lavi đang nghe bạn nói... hãy nói câu hỏi...'
                      : 'Hỏi Lavi về bệnh cây, thời tiết hoặc thuốc (Enter để gửi, Shift+Enter xuống dòng)'
                  }
                  maxLength={2000}
                  aria-label="Câu hỏi cho Lavi"
                  className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden px-1.5 py-1.5 max-h-36 leading-relaxed"
                />

                <div className="shrink-0 mb-0.5 mr-0.5">
                  {isStreaming ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={stopGeneration}
                      className="h-8 px-3 text-xs gap-1 rounded-xl shadow-xs"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Dừng</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSend}
                      disabled={!inputMessage.trim() && !attachedImage}
                      className="h-8.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs gap-1.5 rounded-xl shadow-xs transition-colors"
                    >
                      <span>Gửi</span>
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-2 pt-0.5 border-t border-border/40">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Bảo vệ cách ly PHI & thuốc cấm tự động
                </span>
                <span>{inputMessage.length}/2000 ký tự</span>
              </div>
            </div>

            {/* Disclaimer cố định ở giữa dưới giống ChatGPT / Claude */}
            <p className="text-center text-[11px] text-muted-foreground mt-2 pb-0.5">
              Lavi có thể mắc sai lầm. Hãy kiểm tra lại thông tin quan trọng hoặc tham khảo ý kiến chuyên gia bảo vệ thực vật.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ChatPage;