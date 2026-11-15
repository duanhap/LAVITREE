export interface DiseaseOption {
  classCode: string;
  plantName: string;
  commonNameVi: string;
}

export interface ParagraphItem {
  id: string;
  text: string;
  suggested_unit_type: string | null;
  mentions?: Array<{ text: string; kind: string }>;
}

export interface SuggestedMetadata {
  model_class?: string | null;
  source_title?: string | null;
  organization?: string | null;
  published_date?: string | null;
}

export interface IngestionResponse {
  ingestion_id: string;
  expires_at: string;
  article_length?: number;
  paragraphs: ParagraphItem[];
  suggested_metadata?: SuggestedMetadata | null;
  ai_suggestion_available: boolean;
}

export interface KnowledgeSourceItem {
  id: string;
  modelClass: string;
  plantName: string;
  diseaseName: string;
  sourceUrl: string;
  sourceTitle: string;
  organization: string;
  publishedDate?: string;
  sourceScope?: string;
  evidenceText: string;
  contentType: string;
  unitType?: string;
  isVerbatim: boolean;
  isManualApproved: boolean;
  reviewerNotes?: string;
  createdAt: string;
}

export interface MedicineItem {
  id: number;
  name: string;
  active_ingredient?: string;
  medicine_type: string;
  price: number;
  dosage_instruction: string;
  phi_days?: number | null;
  is_allowed: boolean;
  rain_resistant: boolean;
  stock_quantity: number;
  availability?: string; // IN_STOCK | OUT_OF_STOCK | NOT_SOLD
  info_source_url?: string;
  image_url?: string;
  target_diseases?: string[]; // ClassCode các bệnh hại gắn với sản phẩm
}

export interface ProductSuggestionItem {
  id: number;
  knowledge_source_id: string;
  model_class: string;
  plant_name: string;
  disease_name: string;
  mention_text: string;
  kind: string; // CHEMICAL | BIOLOGICAL | SUPPLY | PRACTICE
  status: string; // PENDING | ADDED | LINKED | DISMISSED
  product_id?: number | null;
  product_name?: string | null;
  evidence_text?: string;
  source_url?: string;
  source_title?: string;
  created_at: string;
  resolved_at?: string | null;
}

export interface EscalationItem {
  id: string;
  userId?: string;
  userName: string;
  userPhone?: string;
  diseaseName: string;
  plantName: string;
  classCode: string;
  confidence: number;
  originalImageUrl?: string;
  gradCamImageUrl?: string;
  notes?: string;
  expertNotes?: string;
  expertReviewedAt?: string;
  createdAt: string;
}

export interface KnowledgeImageItem {
  id: number;
  model_class: string;
  plant_name: string;
  disease_name: string;
  source_url: string;
  image_url: string;
  storage_key?: string | null;
  caption: string;
  plant_part: string; // LEAF | FRUIT | STEM | WHOLE_PLANT
  credit: string;
  license_note?: string | null;
  is_manual_approved: boolean;
  created_at: string;
}

export interface GroupedArticle {
  key: string;
  sourceTitle: string;
  sourceUrl: string;
  organization: string;
  sourceScope: 'Việt Nam' | 'Quốc tế';
  primaryPlantName: string;
  primaryDiseaseName: string;
  primaryModelClass: string;
  diseasesList: Array<{ plantName: string; diseaseName: string; modelClass: string }>;
  paragraphs: KnowledgeSourceItem[];
  approvedCount: number;
  totalCount: number;
}

export interface DuplicatePair {
  idA: string;
  idB: string;
  indexA: number;
  indexB: number;
  textA: string;
  textB: string;
  similarity: number;
}

export type AdminTabKey = 'ingestion' | 'curation' | 'images' | 'inventory' | 'escalations';

export interface AdminDashboardProps {
  defaultTab?: AdminTabKey;
}

