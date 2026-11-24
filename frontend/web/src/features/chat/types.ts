/**
 * Types cho phân hệ Chat Trợ lý AI Cây trồng Lavi (Streaming SSE & ReAct Loop)
 * Khớp 100% với api-contracts.md Mục 4.1
 */

import { ResultStatusType } from '../diagnose/status';

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

export interface ReferenceImage {
  image_url: string;
  caption: string;
  plant_part?: string;
  credit?: string;
  license_note?: string;
  source_url?: string;
}

export interface SuggestedProduct {
  product_id: number;
  product_name: string;
  active_ingredient?: string;
  image_url?: string;
  phi_days?: number | null;
  rain_resistant?: boolean;
  availability?: string;
}

export interface ImageDiagnosisInfo {
  status: ResultStatusType;
  disease_name: string;
  plant_name: string;
  class_code: string;
  confidence: number;
  warning?: string | null;
  diagnosis_id?: string | null;
}

export interface ImageContextTop {
  class_code: string;
  disease_name: string;
  confidence: number;
}

export interface ImageContext {
  class_code: string;
  disease_name: string;
  plant_name: string;
  confidence: number;
  is_uncertain: boolean;
  confusion_group?: string | null;
  top3: ImageContextTop[];
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
  reference_images?: ReferenceImage[];
  suggested_products?: SuggestedProduct[];
  image_status?: 'uploading' | 'done' | 'not_stored' | 'error';
  image_diagnosis?: ImageDiagnosisInfo;
  guardrail_triggered?: string | null; // Mã chốt chặn, ví dụ HARVEST_BEFORE_PHI_VIOLATION
  is_offline_fallback?: boolean;
  total_latency_ms?: number;
  timestamp: string;
  isStreaming?: boolean;
  image_url?: string;
  /** true khi đã nhận sự kiện final_answer (câu trả lời hoàn tất, không phải tin báo lỗi) */
  receivedFinal?: boolean;
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
