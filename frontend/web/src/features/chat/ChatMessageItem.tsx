import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Bot,
  User,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShoppingCart,
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
} from 'lucide-react';
import { toast } from 'sonner';
import { ChatMessage, Citation } from './types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import laviAvatarImg from '@/assets/brand/lavi-avatar-96.webp';

interface ChatMessageItemProps {
  message: ChatMessage;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const [isStepsOpen, setIsStepsOpen] = useState(false);
  const [addingToCartId, setAddingToCartId] = useState<number | null>(null);

  // Thêm thuốc được gợi ý vào giỏ hàng cá nhân (khớp StorePage SSOT)
  const handleAddToCart = async (productId: number, quantity: number = 1) => {
    try {
      setAddingToCartId(productId);
      // BUG-83: Gọi lại Core API lấy thông tin thuốc mới nhất từ CSDL, không tin tưởng giá từ câu trả lời LLM
      // allowedOnly=false chỉ dành cho Admin (nông dân nhận 403); danh sách công khai chỉ có thuốc đang được bán
      const res = await apiClient.get<{ items: any[] }>('/medicines/search', { params: { allowedOnly: true } });
      const items = res.data?.items || [];
      const prod = items.find((p: any) => p.id === productId);

      if (!prod) {
        toast.error('Sản phẩm này hiện không được bán trên Cửa hàng (không có trong danh mục đang lưu hành).');
        return;
      }

      if (!prod.is_allowed) {
        toast.error(
          `Sản phẩm "${prod.name}" hiện chưa được cấp phép lưu hành hoặc đã bị dừng bán theo quy định!`
        );
        return;
      }

      // Xác định key giỏ hàng của tài khoản đang đăng nhập
      const storedUser = localStorage.getItem('lavitree_user');
      let userId: string | null = null;
      if (storedUser) {
        try {
          userId = JSON.parse(storedUser)?.id;
        } catch {
          // ignore
        }
      }
      const cartKey = userId ? `lavitree_cart_${userId}` : 'lavitree_cart_guest';

      let currentCart: any[] = [];
      try {
        const saved = localStorage.getItem(cartKey);
        currentCart = saved ? JSON.parse(saved) : [];
      } catch {
        currentCart = [];
      }

      const existingIndex = currentCart.findIndex((item: any) => item.product?.id === prod.id);
      if (existingIndex >= 0) {
        currentCart[existingIndex].quantity += quantity;
      } else {
        currentCart.push({ product: prod, quantity });
      }

      localStorage.setItem(cartKey, JSON.stringify(currentCart));
      window.dispatchEvent(new Event('storage'));
      toast.success(`Đã thêm "${prod.name}" (SL: ${quantity}) vào giỏ hàng!`);
    } catch (err: any) {
      toast.error('Không thể thêm sản phẩm vào giỏ hàng: ' + (err.message || 'Lỗi kết nối'));
    } finally {
      setAddingToCartId(null);
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 mb-6">
        <div className="max-w-[85%] sm:max-w-[75%] bg-emerald-700 text-white rounded-2xl rounded-tr-none px-4 py-3 shadow-sm">
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
  // Token kỹ thuật được thay bằng nhãn "Bản nháp" phía trên, không in thô vào nội dung
  const displayContent = message.content.replace(/\[DRAFT_RECOMMENDATION\]\s*/g, '');

  return (
    <div className="flex gap-3 mb-8 items-start">
      <img
        src={laviAvatarImg}
        alt="Lavi"
        className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 object-contain p-0.5 shrink-0 shadow-sm mt-1 dark:bg-emerald-950/40 dark:border-emerald-800"
      />

      <div className="flex-1 max-w-[92%] sm:max-w-[85%] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl rounded-tl-none p-4 sm:p-5 shadow-sm space-y-4">
        {/* Header tin nhắn AI */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
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

        {/* Khối các bước suy luận ReAct (XAI Observability) */}
        {hasTraceSteps && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setIsStepsOpen(!isStepsOpen)}
              className="w-full flex items-center justify-between px-3.5 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 transition-colors"
            >
              <div className="flex items-center gap-2 font-medium">
                <BrainCircuit className="w-4 h-4 text-emerald-600" />
                <span>Tiến trình suy luận & Tra cứu dữ liệu ({message.traceSteps?.length} bước)</span>
              </div>
              {isStepsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isStepsOpen && (
              <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5 max-h-64 overflow-y-auto">
                {message.traceSteps?.map((step, idx) => (
                  <div key={idx} className="flex gap-2 items-start text-zinc-600 dark:text-zinc-400">
                    <span className="font-mono text-[10px] bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-700 dark:text-zinc-300 mt-0.5">
                      #{step.step}
                    </span>
                    <div className="flex-1">
                      {step.type === 'thought' && (
                        <div className="text-zinc-800 dark:text-zinc-200">
                          <span className="font-medium text-blue-700 dark:text-blue-400">Suy nghĩ: </span>
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
                            <div className="mt-1 text-[10px] text-zinc-600 dark:text-zinc-400 overflow-x-auto">
                              Tham số: {JSON.stringify(step.params)}
                            </div>
                          )}
                        </div>
                      )}
                      {step.type === 'observation' && (
                        <div className="text-zinc-600 dark:text-zinc-400 italic text-[11px] bg-zinc-100/70 dark:bg-zinc-800/40 p-1.5 rounded border border-zinc-200 dark:border-zinc-800">
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
        <div className="prose prose-sm dark:prose-invert max-w-none text-zinc-800 dark:text-zinc-200 leading-relaxed break-words">
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
              // Không tải ảnh từ địa chỉ ngoài nằm trong câu trả lời (chống theo dõi / nội dung lạ từ bài báo)
              img: ({ alt }) => <span className="text-zinc-500 italic">[Ảnh: {alt || 'không hiển thị'}]</span>,
            }}
          >
            {displayContent}
          </ReactMarkdown>
        </div>

        {/* Đề xuất đơn thuốc từ Draft Order (BUG-83) */}
        {message.draft_order && message.draft_order.items && message.draft_order.items.length > 0 && (
          <div className="mt-4 p-3.5 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900 dark:text-emerald-300">
              <ShoppingCart className="w-4 h-4 text-emerald-700" />
              <span>Gợi ý Đơn thuốc điều trị (Theo dõi tồn kho thật):</span>
            </div>

            <div className="space-y-2">
              {message.draft_order.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs"
                >
                  <div>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {item.product_name || `Thuốc mã #${item.product_id}`}
                    </span>
                    <span className="text-zinc-500 ml-2">Số lượng: {item.quantity}</span>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    disabled={addingToCartId === item.product_id}
                    onClick={() => handleAddToCart(item.product_id, item.quantity)}
                  >
                    {addingToCartId === item.product_id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                    )}
                    Thêm vào giỏ
                  </Button>
                </div>
              ))}
            </div>
          </div>
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
      </div>
    </div>
  );
};
