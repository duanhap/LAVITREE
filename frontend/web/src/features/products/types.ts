import type { UsageProfile } from '@/features/admin/lib/usage-profile';

export interface ProductDiseaseInfo {
  class_code: string;
  disease_name: string;
  plant_name: string;
}

export interface ProductDetailResponse {
  id: number;
  name: string;
  active_ingredient: string | null;
  medicine_type: string;
  price: number;
  dosage_instruction: string;
  phi_days: number | null;
  is_allowed: boolean;
  rain_resistant: boolean;
  stock_quantity: number;
  availability: string;
  info_source_url: string | null;
  image_url: string;
  usage_profile: UsageProfile | null;
  target_diseases: string[];
  diseases: ProductDiseaseInfo[];
}

export interface ProductEvidenceItem {
  suggestion_id: number;
  knowledge_source_id: string;
  model_class: string;
  disease_name: string;
  plant_name: string;
  mention_text: string;
  unit_type: string;
  evidence_text: string;
  is_verbatim: boolean;
  source_url: string;
  source_title: string;
  organization: string;
  published_date: string | null;
  is_approved: boolean;
  status: string;
}

export interface EvidenceSnippet {
  suggestionId: number;
  mentionText: string;
  evidenceText: string;
  isVerbatim: boolean;
  unitType: string;
  isApproved: boolean;
  sentenceHighlight: {
    before: string;
    match: string;
    after: string;
  };
}

export interface GroupedArticleEvidence {
  sourceUrl: string;
  sourceTitle: string;
  organization: string;
  publishedDate: string | null;
  isApproved: boolean;
  snippets: EvidenceSnippet[];
}

export type DiseaseRecommendationStatus =
  | 'SUPPORTED' // ✅ Khuyên dùng, có căn cứ (DiseaseProduct + >= 1 bài)
  | 'MANUAL_ONLY' // ⚠ Khuyên dùng, chưa có căn cứ (DiseaseProduct + 0 bài)
  | 'UNRECOMMENDED_EVIDENCE'; // ○ Có bài nhắc, chưa khuyên dùng (No DiseaseProduct + >= 1 bài)

export interface GroupedDiseaseRow {
  modelClass: string;
  diseaseName: string;
  plantName: string;
  status: DiseaseRecommendationStatus;
  isRecommended: boolean;
  articles: GroupedArticleEvidence[];
  totalEvidenceCount: number;
}

/** Một liều trong bảng ProductUsageRules (TASK-29): scope "plant" = liều chung của cây, "disease" = liều riêng của bệnh. */
export interface ProductUsageRuleItem {
  id: number;
  product_id: number;
  scope: 'plant' | 'disease';
  plant_id: number;
  disease_id: number | null;
  class_code: string | null;
  disease_name: string | null;
  plant_name: string | null;
  dosage_instruction: string | null;
  profile: UsageProfile;
  action_group: string | null;
  source_url: string | null;
  is_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  updated_at: string | null;
}

/** Có class_code = liều riêng cho bệnh; không có = liều chung cho cây (cần plant_name hoặc plant_id). */
export interface CreateUsageRulePayload {
  class_code?: string;
  plant_id?: number;
  plant_name?: string;
  dosage_instruction?: string;
  profile?: UsageProfile;
  action_group?: string;
  source_url?: string;
}

export interface UpdateUsageRulePayload {
  /** undefined = giữ nguyên; chuỗi rỗng = xóa đoạn chữ. */
  dosage_instruction?: string;
  profile?: UsageProfile;
  action_group?: string;
  source_url?: string;
}
