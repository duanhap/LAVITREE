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
