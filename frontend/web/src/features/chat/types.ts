/**
 * Types cho phân hệ Chat Trợ lý AI Cây trồng Lavi (Streaming SSE & ReAct Loop)
 * Khớp 100% với api-contracts.md Mục 4.1
 */

export interface Citation {
  source_title: string;
  organization: string;
  source_url: string;
  excerpt: string;
  is_verbatim: boolean;
}

export interface TraceStep {
  step: number;
  type: 'thought' | 'action' | 'observation';
  thought?: string;
  tool?: string;
  params?: Record<string, any>;
  observation?: any;
}

export interface DraftOrderItem {
  product_id: number;
  product_name?: string;
  quantity: number;
}

export interface DraftOrder {
  items: DraftOrderItem[];
  reason?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  trace_id?: string;
  conversation_id?: string;
  traceSteps?: TraceStep[];
  citations?: Citation[];
  draft_order?: DraftOrder | null;
  guardrail_triggered?: string | null; // Mã chốt chặn, ví dụ HARVEST_BEFORE_PHI_VIOLATION
  is_offline_fallback?: boolean;
  total_latency_ms?: number;
  timestamp: string;
  isStreaming?: boolean;
}

export interface ChatContextParams {
  location: string;
  harvest_days_left: number | null;
  current_disease_code: string | null;
}

export interface ChatSession {
  id: string; // conversation_id
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  contextParams: ChatContextParams;
}
