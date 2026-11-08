/**
 * Types cho phân hệ Khám lá (Diagnose) - Khớp 100% với api-contracts.md mục 3.1
 */

export interface Top3Item {
  class_code: string;
  disease_name: string;
  confidence: number;
}

export interface DiagnoseResultData {
  plant_name: string;
  disease_name: string;
  class_code: string;
  confidence: number;
  severity_level: string;
  is_uncertain: boolean;
  confusion_group?: string | null;
  warning?: string | null;
  top3: Top3Item[];
}

export interface VisualEvidence {
  original_image_url: string;
  gradcam_image_url?: string | null;
}

export interface TreatmentStep {
  step_order: number;
  action_title: string;
  instructions: string;
  isolation_days?: string | null;
}

export interface ProductItem {
  id: number;
  name: string;
  active_ingredient: string;
  price: number;
  unit: string;
  image_url?: string | null;
  dosage_instruction?: string | null;
}

export interface VerifiedSource {
  organization: string;
  title: string;
  url: string;
}

export interface DiagnoseResponse {
  success: boolean;
  diagnosis_id?: string | null;
  is_ood: boolean;
  is_uncertain: boolean;
  warning?: string | null;
  notes?: string | null;
  requires_expert?: boolean;
  expert_notes?: string | null;
  expert_reviewed_at?: string | null;
  result?: DiagnoseResultData | null;
  visual_evidence?: VisualEvidence | null;
  treatment_guidelines: TreatmentStep[];
  recommended_products: ProductItem[];
  verified_sources: VerifiedSource[];
}
