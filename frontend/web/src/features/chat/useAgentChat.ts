import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { ChatMessage, ChatContextParams, TraceStep } from './types';

export interface UseAgentChatOptions {
  initialDiseaseCode?: string | null;
  initialLocation?: string;
}

export function useAgentChat(options: UseAgentChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Lưu trữ ngữ cảnh canh tác nông nghiệp
  const [contextParams, setContextParams] = useState<ChatContextParams>({
    location: options.initialLocation || 'Hà Nam',
    harvest_days_left: null,
    current_disease_code: options.initialDiseaseCode || null,
  });

  // Đồng bộ khi prop đổi từ router
  useEffect(() => {
    if (options.initialDiseaseCode !== undefined) {
      setContextParams(prev => ({
        ...prev,
        current_disease_code: options.initialDiseaseCode || null,
      }));
    }
  }, [options.initialDiseaseCode]);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Rời trang Chat khi đang stream: hủy kết nối để không giữ luồng và không cập nhật state đã unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setMessages(prev => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.role === 'assistant' && last.isStreaming) {
          return [
            ...prev.slice(0, -1),
            { ...last, isStreaming: false, content: last.content + ' *(Đã dừng phản hồi)*' },
          ];
        }
        return prev;
      });
      toast.info('Đã dừng nhận phản hồi từ Trợ lý.');
    }
  }, []);

  const sendMessage = useCallback(
    async (userInput: string, overrideParams?: Partial<ChatContextParams>) => {
      const trimmed = userInput.trim();
      if (!trimmed || isStreaming) return;

      if (trimmed.length > 2000) {
        toast.error('Câu hỏi vượt quá giới hạn 2000 ký tự cho phép.');
        return;
      }

      setError(null);

      const userMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const userMessage: ChatMessage = {
        id: userMessageId,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      const assistantMessageId = `msg-ai-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const placeholderAssistant: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        traceSteps: [],
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };

      setMessages(prev => [...prev, userMessage, placeholderAssistant]);
      setIsStreaming(true);

      const mergedParams: ChatContextParams = {
        ...contextParams,
        ...overrideParams,
      };

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const token = localStorage.getItem('lavitree_token');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const payload = {
          message: trimmed,
          conversation_id: conversationId || undefined,
          location: mergedParams.location || 'Hà Nam',
          harvest_days_left: mergedParams.harvest_days_left ?? null,
          current_disease_code: mergedParams.current_disease_code || null,
        };

        const response = await fetch('/api/v1/agent/chat', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        // Xử lý các mã lỗi nghiệp vụ & bảo mật SSOT
        if (!response.ok) {
          let errDetail = 'Không thể kết nối tới Trợ lý AI.';
          try {
            const errJson = await response.json();
            const detail = errJson.detail ?? errJson.message;
            if (typeof detail === 'string') {
              errDetail = detail;
            } else if (Array.isArray(detail)) {
              // FastAPI 422 trả mảng lỗi Pydantic: lấy thông điệp đầu tiên thay vì in "[object Object]"
              errDetail = detail.map((d: { msg?: string }) => d?.msg).filter(Boolean).join('; ') || errDetail;
            }
          } catch {
            // Không parse được json
          }

          if (response.status === 401) {
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
          }

          if (response.status === 429) {
            throw new Error(
              'Đã vượt hạn mức câu hỏi cho phép (5 lượt/ngày đối với khách vãng lai hoặc 10 lượt/phút). Vui lòng thử lại sau.'
            );
          }

          if (response.status === 422) {
            throw new Error(errDetail || 'Dữ liệu câu hỏi không hợp lệ (vượt 2000 ký tự).');
          }

          throw new Error(`[HTTP ${response.status}] ${errDetail}`);
        }

        if (!response.body) {
          throw new Error('Máy chủ không hỗ trợ luồng phản hồi streaming.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        let accumulatedContent = '';
        let currentTraceSteps: TraceStep[] = [];
        let finalCitations = undefined;
        let finalGuardrail: string | null = null;
        let finalOfflineFallback = false;
        let finalDraftOrder = null;
        let finalLatency = undefined;
        let receivedFinal = false;

        let streamDone = false;
        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) {
            streamDone = true;
            // Xả phần còn lại của decoder và xử lý khối cuối dù server không gửi "\n\n" kết thúc
            buffer += decoder.decode();
          } else {
            buffer += decoder.decode(value, { stream: true });
          }

          // Chuẩn SSE cho phép xuống dòng CRLF, LF hoặc CR
          buffer = buffer.replace(/\r\n?/g, '\n');

          // Phân tách từng khối sự kiện SSE (ngăn cách bởi dòng trống)
          const parts = buffer.split('\n\n');
          buffer = streamDone ? '' : parts.pop() || ''; // Phần cuối chưa hoàn chỉnh giữ lại buffer

          for (const part of parts) {
            if (!part.trim()) continue;

            const lines = part.split('\n');
            let eventName = 'message';
            const dataLines: string[] = [];

            for (const line of lines) {
              if (line.startsWith(':')) continue; // Dòng chú thích / keep-alive
              if (line.startsWith('event:')) {
                eventName = line.substring(6).trim();
              } else if (line.startsWith('data:')) {
                // Nhiều dòng data: trong cùng một sự kiện được nối bằng "\n" theo chuẩn SSE
                dataLines.push(line.substring(5).replace(/^ /, ''));
              }
            }

            const dataStr = dataLines.join('\n');
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);

              switch (eventName) {
                case 'trace_start':
                  if (data.conversation_id) {
                    setConversationId(data.conversation_id);
                  }
                  break;

                case 'thought':
                  currentTraceSteps = [
                    ...currentTraceSteps,
                    {
                      step: data.step || currentTraceSteps.length + 1,
                      type: 'thought',
                      thought: data.thought,
                    },
                  ];
                  break;

                case 'action':
                  currentTraceSteps = [
                    ...currentTraceSteps,
                    {
                      step: data.step || currentTraceSteps.length + 1,
                      type: 'action',
                      tool: data.tool,
                      params: data.params,
                    },
                  ];
                  break;

                case 'observation':
                  currentTraceSteps = [
                    ...currentTraceSteps,
                    {
                      step: data.step || currentTraceSteps.length + 1,
                      type: 'observation',
                      // api-contracts.md Mục 4.1 và agent-service gửi kết quả công cụ ở khóa "result"
                      observation: data.result ?? data.observation,
                    },
                  ];
                  break;

                case 'delta':
                  if (data.token) {
                    accumulatedContent += data.token;
                  }
                  break;

                case 'final_answer':
                  if (data.answer) {
                    accumulatedContent = data.answer;
                  }
                  receivedFinal = true;
                  finalCitations = data.citations;
                  // Agent trả mã chốt chặn (ví dụ HARVEST_BEFORE_PHI_VIOLATION) hoặc null
                  finalGuardrail = data.guardrail_triggered ? String(data.guardrail_triggered) : null;
                  finalOfflineFallback = Boolean(data.is_offline_fallback);
                  finalDraftOrder = data.draft_order || null;
                  finalLatency = data.total_latency_ms;
                  break;

                default:
                  break;
              }

              // Cập nhật state tin nhắn assistant đang stream
              setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (lastIdx >= 0 && updated[lastIdx].id === assistantMessageId) {
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    content: accumulatedContent,
                    traceSteps: currentTraceSteps,
                    citations: finalCitations,
                    guardrail_triggered: finalGuardrail,
                    is_offline_fallback: finalOfflineFallback,
                    draft_order: finalDraftOrder,
                    total_latency_ms: finalLatency,
                    isStreaming: eventName !== 'final_answer',
                  };
                }
                return updated;
              });
            } catch (jsonErr) {
              console.warn('[useAgentChat] Failed to parse SSE data JSON:', dataStr, jsonErr);
            }
          }
        }

        // Stream đóng mà chưa có final_answer = mất kết nối giữa chừng: giữ phần đã nhận và báo rõ
        if (!receivedFinal) {
          const msg = 'Kết nối tới Trợ lý bị ngắt trước khi có câu trả lời hoàn chỉnh.';
          setError(msg);
          toast.error(msg);
        }
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].id === assistantMessageId) {
            const current = updated[lastIdx];
            updated[lastIdx] = {
              ...current,
              content: receivedFinal
                ? current.content
                : accumulatedContentOr(current.content) ||
                  '⚠️ *Không nhận được câu trả lời hoàn chỉnh. Vui lòng thử lại.*',
              isStreaming: false,
            };
          }
          return updated;
        });
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return;
        }
        const errorMsg = err.message || 'Mất kết nối với máy chủ AI Agent.';
        setError(errorMsg);
        toast.error(errorMsg);

        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].id === assistantMessageId) {
            updated[lastIdx] = {
              ...updated[lastIdx],
              content:
                accumulatedContentOr(updated[lastIdx].content) ||
                '⚠️ *Không thể nhận câu trả lời do sự cố kết nối. Vui lòng kiểm tra mạng và thử lại.*',
              isStreaming: false,
            };
          }
          return updated;
        });
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [contextParams, conversationId, isStreaming]
  );

  const clearMessages = useCallback(() => {
    stopGeneration();
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, [stopGeneration]);

  const loadSession = useCallback((session: import('./types').ChatSession) => {
    stopGeneration();
    setMessages(session.messages || []);
    setConversationId(session.id || null);
    if (session.contextParams) {
      setContextParams(session.contextParams);
    }
    setError(null);
  }, [stopGeneration]);

  return {
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
  };
}

function accumulatedContentOr(existing: string) {
  return existing ? existing + '\n\n*(Đường truyền gián đoạn giữa chừng)*' : '';
}
