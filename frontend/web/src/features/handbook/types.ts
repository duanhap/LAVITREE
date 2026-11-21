export interface PublicKnowledgeSource {
  id: string;
  modelClass: string;
  plantName: string;
  diseaseName: string;
  sourceUrl: string;
  sourceTitle: string;
  organization: string;
  publishedDate?: string | null;
  matchLevel?: string;
  sourceScope?: string;
  evidenceText: string;
  contentType?: string;
  unitType?: string;
  isVerbatim?: boolean;
  sourceQuality?: string;
  createdAt: string;
}

export interface DiseaseDetailResponse {
  id: number;
  classCode: string;
  plantName: string;
  commonNameVi: string;
  pathogenType: string;
  pathogenName?: string | null;
  severityLevel: number;
  symptoms?: string;
  captureTip?: string;
  prevention?: string;
  treatmentPlans?: Array<{
    stepOrder: number;
    actionTitle: string;
    instructions: string;
    isolationDays?: string;
  }>;
  products?: Array<{
    id: number;
    name: string;
    activeIngredient: string;
    price: number;
    imageUrl?: string;
    dosageInstruction?: string;
  }>;
}

export interface HandbookReference {
  index: number;
  key: string;
  organization: string;
  sourceTitle: string;
  sourceUrl: string;
  year?: string | null;
  sourceScope?: string;
}

export interface HandbookParagraph {
  id: string;
  evidenceText: string;
  isVerbatim: boolean;
  refIndex: number;
  sourceUrl?: string;
}

export type SectionUnitType = 'SUMMARY' | 'SYMPTOMS' | 'CAUSE_CONDITIONS' | 'PREVENTION' | 'TREATMENT';

export interface HandbookSection {
  id: string; // e.g. 'tong-quan', 'trieu-chung'
  unitType: SectionUnitType;
  title: string;
  iconName: 'BookOpen' | 'Activity' | 'Microscope' | 'ShieldCheck' | 'Stethoscope';
  paragraphs: HandbookParagraph[];
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
  plant_part: 'LEAF' | 'FRUIT' | 'STEM' | 'WHOLE_PLANT' | string;
  credit: string;
  license_note?: string;
  is_manual_approved: boolean;
  created_at: string;
}

export interface DiseaseArticle {
  sections: HandbookSection[];
  references: HandbookReference[];
  totalApprovedParagraphs: number;
  totalUniqueSources: number;
  latestUpdatedAt: string | null;
}
