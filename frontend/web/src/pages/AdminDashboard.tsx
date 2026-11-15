import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient, { getErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  FileText, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw,
  ExternalLink, Search, Filter, Layers, Database, Package,
  UserCheck, AlertTriangle, Check, X, Clock, HelpCircle, Eye, Code2, Trash2,
  ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Sparkles, Image as ImageIcon,
  Plus, UploadCloud, Link as LinkIcon, ZoomIn, Scissors, BookOpen, ArrowRight, ArrowLeft, Edit3, Globe
} from 'lucide-react';
import { toast } from 'sonner';

interface DiseaseOption {
  classCode: string;
  plantName: string;
  commonNameVi: string;
}

interface ParagraphItem {
  id: string;
  text: string;
  suggested_unit_type: string | null;
  mentions?: Array<{ text: string; kind: string }>;
}

interface SuggestedMetadata {
  model_class?: string | null;
  source_title?: string | null;
  organization?: string | null;
  published_date?: string | null;
}

interface IngestionResponse {
  ingestion_id: string;
  expires_at: string;
  article_length?: number;
  paragraphs: ParagraphItem[];
  suggested_metadata?: SuggestedMetadata | null;
  ai_suggestion_available: boolean;
}

interface KnowledgeSourceItem {
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

interface MedicineItem {
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
}

interface ProductSuggestionItem {
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

interface EscalationItem {
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

interface AdminDashboardProps {
  defaultTab?: 'ingestion' | 'curation' | 'images' | 'inventory' | 'escalations';
}

const SECTION_COPY: Record<string, { title: string; description: string }> = {
  ingestion: {
    title: 'Nhập bài báo',
    description: 'Dán nguyên văn bài khuyến nông, chọn đoạn cần lưu và gắn nhãn trước khi đưa vào kho tri thức.',
  },
  curation: {
    title: 'Duyệt tri thức',
    description: 'Duyệt hoặc gỡ duyệt các đoạn trích. Chỉ đoạn đã duyệt mới được trợ lý Lavi dùng để trả lời.',
  },
  images: {
    title: 'Ảnh triệu chứng thực địa',
    description: 'Quản lý kho ảnh triệu chứng bệnh cây (lá, quả, thân, toàn cây) hiển thị trên Sổ tay bệnh học và đối chiếu chẩn đoán.',
  },
  inventory: {
    title: 'Kho vật tư & thuốc',
    description: 'Quản lý giá, tồn kho, thời gian cách ly (PHI) và trạng thái được phép lưu hành.',
  },
  escalations: {
    title: 'Ca chuyên gia',
    description: 'Các ca khám độ tin cậy thấp hoặc nông dân yêu cầu chuyên gia xem lại.',
  },
};

// Từ điển dịch thuật thuật ngữ nông nghiệp / hoạt chất sang tiếng Việt
const AGRI_TRANSLATIONS: Record<string, string> = {
  'fungicides': 'Thuốc trừ nấm bệnh',
  'fungicide': 'Thuốc trừ nấm bệnh',
  'copper': 'Gốc đồng (diệt nấm & vi khuẩn)',
  'chlorothalonil': 'Hoạt chất trừ nấm Chlorothalonil',
  'mancozeb': 'Hoạt chất trừ nấm Mancozeb',
  'azoxystrobin': 'Hoạt chất Azoxystrobin',
  'metalaxyl': 'Hoạt chất lưu dẫn Metalaxyl',
  'thinning of whole plants': 'Tỉa bớt toàn bộ cây / tỉa thưa',
  'thinning': 'Tỉa thưa mật độ',
  'removal of selected branches from individual plants': 'Tỉa bỏ cành bệnh / cành rậm rạp',
  'removal of selected branches': 'Cắt tỉa cành chọn lọc',
  'crop rotation': 'Luân canh cây trồng',
  'drip irrigation': 'Tưới nhỏ giọt (tránh ướt lá)',
  'pruning': 'Cắt tỉa cành',
  'mulching': 'Phủ gốc / phủ bạt giữ ẩm',
  'resistant varieties': 'Giống kháng bệnh',
  'sanitation': 'Vệ sinh đồng ruộng / tiêu hủy tàn dư',
  'biological control': 'Biện pháp sinh học',
  'neem oil': 'Dầu neem sinh học',
  'bacillus subtilis': 'Vi khuẩn đối kháng Bacillus subtilis',
  'trichoderma': 'Nấm đối kháng Trichoderma',
  'potassium phosphite': 'Lân Phosphite kích kháng',
  'bordeaux mixture': 'Booc-đô (Bordeaux) trị nấm',
  'insecticide': 'Thuốc trừ sâu',
  'insecticides': 'Thuốc trừ sâu',
  'potassium': 'Phân Kali',
  'calcium': 'Canxi chống nứt / thối'
};

const getAgriTranslation = (text: string): string | null => {
  if (!text) return null;
  const lower = text.trim().toLowerCase();
  if (AGRI_TRANSLATIONS[lower]) return AGRI_TRANSLATIONS[lower];
  for (const [key, val] of Object.entries(AGRI_TRANSLATIONS)) {
    if (lower.includes(key)) return val;
  }
  return null;
};

const buildCombinedOrg = (org: string, author: string) => {
  const o = org.trim();
  const a = author.trim();
  if (o && a) return `${o} (Tác giả: ${a})`;
  if (a) return `Tác giả: ${a}`;
  return o;
};

const parseCombinedOrg = (raw?: string | null): { org: string; author: string } => {
  const text = (raw || '').trim();
  if (!text) return { org: '', author: '' };
  // Hỗ trợ cả dạng "Cơ quan (Tác giả: ...)" và "Cơ quan / Tác giả: ..."
  const authorMatch = text.match(/^(.*?)\s*(?:\((?:Tác giả|Author):\s*(.*?)\)|\/\s*(?:Tác giả|Author):\s*(.+))$/i);
  if (authorMatch) {
    return { org: authorMatch[1].trim(), author: (authorMatch[2] ?? authorMatch[3] ?? '').trim() };
  }
  if (/^(?:Tác giả|Author):/i.test(text)) {
    return { org: '', author: text.replace(/^(?:Tác giả|Author):\s*/i, '').trim() };
  }
  return { org: text, author: '' };
};

const buildCombinedDate = (pubDate: string, upDate: string) => {
  const p = pubDate.trim();
  const u = upDate.trim();
  if (p && u) return `${p} (Cập nhật: ${u})`;
  if (u) return `Cập nhật: ${u}`;
  return p;
};

const parseCombinedDate = (raw?: string | null): { pubDate: string; upDate: string } => {
  const text = (raw || '').trim();
  if (!text || text === 'Không ghi ngày') return { pubDate: '', upDate: '' };
  const upPrefixRe = /^(?:Được\s+rà\s+soát(?:\s*\/\s*cập\s+nhật)?|Cập\s+nhật|Updated|Revised|Reviewed(?:\s*\/\s*Revised)?|Modified)\s*:?\s*/i;
  const dateMatch = text.match(/^(.*?)\s*\((.+)\)$/);
  if (dateMatch) {
    return {
      pubDate: dateMatch[1].trim(),
      upDate: dateMatch[2].trim().replace(upPrefixRe, '').trim(),
    };
  }
  if (upPrefixRe.test(text)) {
    return { pubDate: '', upDate: text.replace(upPrefixRe, '').trim() };
  }
  return { pubDate: text, upDate: '' };
};

// Suy luận nguồn bài báo ("Việt Nam" hoặc "Quốc tế") từ URL, cơ quan hoặc giá trị đã lưu trong CSDL
const inferSourceScope = (
  sourceUrl?: string | null,
  organization?: string | null,
  savedScope?: string | null
): 'Việt Nam' | 'Quốc tế' => {
  let host = '';
  if (sourceUrl) {
    try {
      host = new URL(sourceUrl.trim()).hostname.toLowerCase();
    } catch {
      host = '';
    }
  }
  const org = (organization || '').toLowerCase();

  if (host.endsWith('.vn')) return 'Việt Nam';
  if ((host.endsWith('.edu') || host.endsWith('.gov') || host.includes('.ac.')) && !host.endsWith('.vn')) {
    return 'Quốc tế';
  }
  if (
    host.includes('extension.') ||
    host.includes('cabi.org') ||
    host.includes('fao.org') ||
    host.includes('apsnet.org') ||
    host.includes('mdpi.com') ||
    host.includes('sciencedirect.com') ||
    /\b(extension|university|usda|cabi|fao)\b/i.test(org) ||
    org.includes('đại học tiểu bang')
  ) {
    return 'Quốc tế';
  }
  if (
    org.includes('việt nam') ||
    org.includes('khuyến nông') ||
    org.includes('cục bvtv') ||
    org.includes('nông nghiệp') ||
    org.includes('viện cây') ||
    org.includes('học viện nông nghiệp') ||
    org.includes('sở nn') ||
    org.includes('trung tâm sản phẩm sinh học')
  ) {
    return 'Việt Nam';
  }
  if (savedScope && /quốc tế|nước ngoài|international|foreign/i.test(savedScope)) {
    return 'Quốc tế';
  }
  return 'Việt Nam';
};

const MONTH_MAP: Record<string, string> = {
  january: '01', jan: '01',
  february: '02', feb: '02',
  march: '03', mar: '03',
  april: '04', apr: '04',
  may: '05',
  june: '06', jun: '06',
  july: '07', jul: '07',
  august: '08', aug: '08',
  september: '09', sept: '09', sep: '09',
  october: '10', oct: '10',
  november: '11', nov: '11',
  december: '12', dec: '12',
};

const normalizeDateDisplay = (raw: string): string => {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  const engMDY = cleaned.match(/\b([a-zA-Z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  if (engMDY) {
    const mm = MONTH_MAP[engMDY[1].toLowerCase()];
    if (mm) return `${engMDY[2].padStart(2, '0')}/${mm}/${engMDY[3]}`;
  }

  const engDMY = cleaned.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)\.?,?\s+(\d{4})\b/);
  if (engDMY) {
    const mm = MONTH_MAP[engDMY[2].toLowerCase()];
    if (mm) return `${engDMY[1].padStart(2, '0')}/${mm}/${engDMY[3]}`;
  }

  const viDate = cleaned.match(/(?:ngày\s*)?(\d{1,2})\s*tháng\s*(\d{1,2})[,\s]*(?:năm\s*)?(\d{4})/i);
  if (viDate) {
    return `${viDate[1].padStart(2, '0')}/${viDate[2].padStart(2, '0')}/${viDate[3]}`;
  }

  const iso = cleaned.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    return `${iso[3].padStart(2, '0')}/${iso[2].padStart(2, '0')}/${iso[1]}`;
  }

  const dmy = cleaned.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
  if (dmy) {
    const p1 = parseInt(dmy[1], 10);
    const p2 = parseInt(dmy[2], 10);
    if (p1 <= 12 && p2 > 12) {
      return `${dmy[2].padStart(2, '0')}/${dmy[1].padStart(2, '0')}/${dmy[3]}`;
    }
    return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;
  }

  const viMY = cleaned.match(/(?:tháng\s*)?(\d{1,2})(?:\s*năm\s*|\s*[\/\-]\s*)(\d{4})/i);
  if (viMY) {
    const mNum = parseInt(viMY[1], 10);
    if (mNum >= 1 && mNum <= 12) {
      return `${String(mNum).padStart(2, '0')}/${viMY[2]}`;
    }
  }

  const engMY = cleaned.match(/\b([a-zA-Z]+)\.?\s+(?:of\s+|,\s*)?(\d{4})\b/);
  if (engMY) {
    const mm = MONTH_MAP[engMY[1].toLowerCase()];
    if (mm) return `${mm}/${engMY[2]}`;
  }

  const yearOnly = cleaned.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearOnly && cleaned.length <= 20) return yearOnly[1];

  return cleaned.slice(0, 60);
};

// Trích xuất biểu thức ngày/tháng/năm đầu tiên ngay sau từ khóa (tránh bắt nhầm năm rải rác giữa đoạn văn)
const extractDateFromSegment = (segment: string): string => {
  const cleaned = segment
    .replace(/^[\s:\-–—,]+/, '')
    .replace(/^(?:on|in|date|ngày|lúc|gần\s*nhất|lần\s*cuối)\s+/i, '')
    .trim();
  if (!cleaned) return '';

  const patterns: RegExp[] = [
    /^([a-zA-Z]+\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+(?:19|20)\d{2})\b/,
    /^(\d{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]+\.?,?\s+(?:19|20)\d{2})\b/,
    /^((?:ngày\s*)?\d{1,2}\s*tháng\s*\d{1,2}[,\s]*(?:năm\s*)?(?:19|20)\d{2})\b/i,
    /^((?:19|20)\d{2}-\d{1,2}-\d{1,2})(?:[T\s]\S*)?\b/,
    /^(\d{1,2}[\/\-.]\d{1,2}[\/\-.](?:19|20)\d{2})\b/,
    /^((?:tháng\s*)?(?:0?[1-9]|1[0-2])(?:\s*năm\s*|\s*[\/\-]\s*)(?:19|20)\d{2})\b/i,
    /^([a-zA-Z]+\.?\s+(?:19|20)\d{2})\b/,
    /^((?:19|20)\d{2})\b/,
  ];

  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m) {
      const normalized = normalizeDateDisplay(m[1]);
      if (normalized) return normalized;
    }
  }
  return '';
};

const KNOWN_ORG_BY_HOST: Array<{ match: RegExp; name: string }> = [
  { match: /(?:^|\.)ces\.ncsu\.edu$/i, name: 'NC State Extension Publications' },
  { match: /(?:^|\.)extension\.cornell\.edu$|(?:^|\.)cornell\.edu$/i, name: 'Cornell University Cooperative Extension' },
  { match: /(?:^|\.)extension\.umn\.edu$|(?:^|\.)umn\.edu$/i, name: 'University of Minnesota Extension' },
  { match: /(?:^|\.)ifas\.ufl\.edu$|(?:^|\.)ufl\.edu$/i, name: 'UF/IFAS Extension, University of Florida' },
  { match: /(?:^|\.)extension\.wvu\.edu$|(?:^|\.)wvu\.edu$/i, name: 'West Virginia University Extension' },
  { match: /(?:^|\.)extension\.wisc\.edu$|(?:^|\.)wisc\.edu$/i, name: 'University of Wisconsin-Madison Extension' },
  { match: /(?:^|\.)extension\.uga\.edu$|(?:^|\.)uga\.edu$/i, name: 'UGA Cooperative Extension' },
  { match: /(?:^|\.)extension\.unh\.edu$|(?:^|\.)unh\.edu$/i, name: 'University of New Hampshire Extension' },
  { match: /(?:^|\.)extension\.usu\.edu$|(?:^|\.)usu\.edu$/i, name: 'Utah State University Extension' },
  { match: /(?:^|\.)udel\.edu$/i, name: 'University of Delaware Cooperative Extension' },
  { match: /(?:^|\.)umass\.edu$/i, name: 'UMass Extension' },
  { match: /(?:^|\.)ndsu\.edu$/i, name: 'NDSU Extension' },
  { match: /(?:^|\.)vegcropshotline\.org$|(?:^|\.)purdue\.edu$/i, name: 'Purdue University Extension' },
  { match: /(?:^|\.)ipm\.ucanr\.edu$|(?:^|\.)ucanr\.edu$/i, name: 'UC IPM (University of California)' },
  { match: /(?:^|\.)frontiersin\.org$/i, name: 'Frontiers in Plant Science' },
  { match: /(?:^|\.)ahdb\.org\.uk$/i, name: 'AHDB (Agriculture and Horticulture Development Board)' },
  { match: /(?:^|\.)khuyennongvn\.gov\.vn$/i, name: 'Trung tâm Khuyến nông Quốc gia' },
  { match: /(?:^|\.)vaas\.vn$/i, name: 'Viện Khoa học Nông nghiệp Việt Nam (VAAS)' },
  { match: /(?:^|\.)ppd\.gov\.vn$|(?:^|\.)bvtv\.gov\.vn$/i, name: 'Cục Bảo vệ thực vật' },
  { match: /(?:^|\.)iasvn\.org$/i, name: 'Viện Khoa học Kỹ thuật Nông nghiệp miền Nam (IAS)' },
];

const extractKeyMetadataFromText = (text: string, sourceUrl?: string) => {
  const result = {
    organization: '',
    author: '',
    publishedDate: '',
    updatedDate: '',
  };

  if (!text) return result;
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^(?:[#>*\-•+]+\s*)+/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean);

  // Regex không neo ^ để bắt được cả trường hợp <br> hoặc dấu chấm gộp "Publication date: ... Reviewed/Revised: ..." trên cùng 1 dòng
  const pubContextRe = /\b(?:original\s+publication\s+date|publication\s*date|date\s*published|originally\s+published(?:\s+in|\s+on)?|first\s+published(?:\s+in|\s+on)?|published(?:\s+date|\s+on|\s+in)?|posted\s*on|release\s*date|ngày\s*(?:đăng|xuất\s*bản|phát\s*hành)|đăng\s*ngày|xuất\s*bản(?:\s*ngày|\s*tháng|\s*năm)?)\s*(?:[:\-]|\s)\s*([^\n;|]+)/i;
  const updContextRe = /\b(?:reviewed\s*\/\s*revised|revised\s*\/\s*reviewed|date\s*revised|last\s*(?:updated|reviewed|modified|revised)|updated(?:\s+on|\s+in)?|revised(?:\s+on|\s+in)?|reviewed(?:\s+on|\s+in)?|modified(?:\s+on|\s+in)?|ngày\s*(?:cập\s*nhật|rà\s*soát|hiệu\s*đính)|cập\s*nhật(?:\s*lần\s*cuối|\s*gần\s*nhất|\s*ngày)?|(?:được\s*)?rà\s*soát\s*\/?\s*cập\s*nhật(?:\s*gần\s*nhất)?(?:\s*ngày)?|hiệu\s*đính(?:\s*ngày)?)\s*(?:[:\-]|\s)\s*([^\n;|]+)/i;
  const orgKeyRe = /^(?:cơ\s*quan|tổ\s*chức|đơn\s*vị(?:\s*phát\s*hành)?|organization|publisher|institution)\s*[:\-]\s*(.+)$/i;
  const authorKeyRe = /^(?:tác\s*giả|author|authors|written\s+by|prepared\s+by|biên\s*soạn|người\s*viết)\s*[:\-]\s*(.+)$/i;
  const cleanAuthorNames = (raw: string) =>
    raw
      .replace(/(\p{L})\d+(?=\s*(?:,|$|\band\b|\bvà\b))/gu, '$1')
      .replace(/\s+/g, ' ')
      .trim();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isEdgeLine = i < 15 || i >= lines.length - 15;

    let pubMatchedOnLine = false;
    if (!result.publishedDate) {
      const m = line.match(pubContextRe);
      if (m) {
        const hasColon = /\b(?:publication\s*date|date\s*published|published|posted\s*on|release\s*date|ngày\s*(?:đăng|xuất\s*bản|phát\s*hành)|đăng\s*ngày)\s*[:\-]/i.test(line);
        if (hasColon || isEdgeLine || line.length <= 180) {
          const rawVal = m[1].split(/\b(?:reviewed\s*\/\s*revised|revised\s*\/\s*reviewed|last\s*(?:updated|reviewed|modified)|updated|revised|reviewed|cập\s*nhật|rà\s*soát|hiệu\s*đính)\b/i)[0].trim();
          const parsed = extractDateFromSegment(rawVal);
          if (parsed) {
            result.publishedDate = parsed;
            pubMatchedOnLine = true;
          }
        }
      }
    }

    if (!result.updatedDate) {
      const m = line.match(updContextRe);
      if (m) {
        const hasColon = /\b(?:reviewed\s*\/\s*revised|revised\s*\/\s*reviewed|date\s*revised|last\s*(?:updated|reviewed|modified)|updated|revised|reviewed|cập\s*nhật|hiệu\s*đính)\s*[:\-]/i.test(line);
        if (hasColon || isEdgeLine || pubMatchedOnLine || line.length <= 160) {
          const parsed = extractDateFromSegment(m[1]);
          if (parsed) {
            result.updatedDate = parsed;
          }
        }
      }
    }

    if (!result.organization && i < 15) {
      const m = line.match(orgKeyRe);
      if (m && m[1].trim().length >= 3 && m[1].trim().length <= 120) {
        result.organization = m[1].trim();
      }
    }

    if (!result.author) {
      const m = line.match(authorKeyRe);
      if (m && m[1].trim().length >= 3 && m[1].trim().length <= 240) {
        const rolePhraseRe = /\b(?:wvu\s+extension|extension|specialist|professor|director|coordinator|fellow|educator|agent|research\s*(?:assistant|associate|technician|specialist)|assistant|associate|technician|scientist|pathology|entomology|horticulture|agronomy|agriculture|biology|natural\s+resources|resources|department|division|college|school|center|centre|faculty|university|institute)\b/i;
        const cleanedRaw = cleanAuthorNames(m[1]);
        const segments = cleanedRaw
          .split(/,\s*(?:and\s+|và\s+)?|\s+(?:and|và)\s+/i)
          .map((s) => s.trim())
          .filter(Boolean);
        const keptNames = segments.filter((seg) => !rolePhraseRe.test(seg));
        result.author = (keptNames.length > 0 ? keptNames.join(', ') : cleanedRaw).slice(0, 180);
      } else if (i < 12) {
        const byMatch = line.match(/^(?:by|written\s+by|prepared\s+by)\s+(.+)$/i);
        if (byMatch && byMatch[1].trim().length >= 4 && byMatch[1].trim().length <= 150 && !/\b(?:the|this|that|wind|rain|water|fungus)\b/i.test(byMatch[1])) {
          result.author = cleanAuthorNames(byMatch[1]);
        }
      }
    }
  }

  if (!result.author) {
    const roleRe = /\b(professor|specialist|director|researcher|research|extension|scientist|technician|associate|assistant|coordinator|fellow|educator|agent|temporary|interim|adjunct|emeritus|faculty|staff|student|entomology|plant\s+pathology|pathology|horticulture|agronomy|ornamental|vegetable|lecturer|ph\.?\s*d\.?|giáo\s*sư|phó\s*giáo\s*sư|tiến\s*sĩ|thạc\s*sĩ|kỹ\s*sư|chuyên\s*gia|nghiên\s*cứu\s*viên|giảng\s*viên)\b/i;
    const stopSectionRe = /^(keywords?|references?|find\s+more\s+information|publication\s*date|reviewed\s*\/\s*revised|từ\s*khóa|tài\s*liệu\s*tham\s*khảo)\b/i;
    const personNameRe = /^\p{Lu}[\p{L}.'-]+(?:\s+\p{Lu}\.?)?(?:\s+\p{Lu}[\p{L}.'-]+){1,4}$/u;
    const nonAuthorHeadings = /^(introduction|symptoms\s+and\s+signs|disease\s+cycle|management|pathogen|diagnostic\s+procedures|references|authors|keywords|leaf\s+scorch|strawberry)$/i;

    const extractedAuthors: string[] = [];
    const authorsHeadingIdx = lines.findIndex((l) => /^authors?:?$/i.test(l));

    if (authorsHeadingIdx !== -1) {
      const colonCandidates: string[] = [];
      const plainCandidates: string[] = [];
      for (let i = authorsHeadingIdx + 1; i < Math.min(lines.length, authorsHeadingIdx + 35); i++) {
        const rawLine = lines[i].trim();
        const hadColon = rawLine.endsWith(':');
        const cur = cleanAuthorNames(rawLine.replace(/:\s*$/, ''));
        if (stopSectionRe.test(cur)) break;
        if (roleRe.test(cur)) continue;
        if (personNameRe.test(cur) && !nonAuthorHeadings.test(cur)) {
          if (hadColon) {
            if (!colonCandidates.includes(cur)) colonCandidates.push(cur);
          } else if (!plainCandidates.includes(cur)) {
            plainCandidates.push(cur);
          }
        }
      }
      const chosen = colonCandidates.length >= 2 ? colonCandidates : [...colonCandidates, ...plainCandidates];
      chosen.forEach((name) => {
        if (!extractedAuthors.includes(name)) extractedAuthors.push(name);
      });
    } else {
      for (let i = 0; i < lines.length - 1; i++) {
        const cur = lines[i];
        if (!cur.endsWith(':')) continue;
        const candidate = cleanAuthorNames(cur.slice(0, -1));
        const nextLine = lines[i + 1];
        if (
          personNameRe.test(candidate) &&
          !nonAuthorHeadings.test(candidate) &&
          roleRe.test(nextLine) &&
          !extractedAuthors.includes(candidate)
        ) {
          extractedAuthors.push(candidate);
        }
      }
    }

    if (extractedAuthors.length === 0) {
      // Nhận diện dòng liệt kê nhiều tác giả ở đầu bài (vd: UF/IFAS "Keevan MacKenzie1, Jessica Chitwood-Brown2, ... and Gary Vallad4")
      const topByline = lines.slice(0, 10).find((l) => {
        if (l.length < 10 || l.length > 180 || /[?!:]/.test(l)) return false;
        const cleanedLine = cleanAuthorNames(l);
        const tokens = cleanedLine.split(/,\s*(?:and\s+|và\s+)?|\s+(?:and|và)\s+/i).map((t) => t.trim()).filter(Boolean);
        return (
          tokens.length >= 2 &&
          tokens.length <= 10 &&
          tokens.every((t) => personNameRe.test(t) && !nonAuthorHeadings.test(t))
        );
      });
      if (topByline) {
        result.author = cleanAuthorNames(topByline);
      }
    }

    if (!result.author && extractedAuthors.length > 0) {
      result.author = extractedAuthors.slice(0, 10).join(', ');
    }
  }

  if (!result.organization) {
    const topOrgLine = lines.slice(0, 8).find(
      (l) =>
        l.length >= 6 &&
        l.length <= 100 &&
        !l.endsWith(':') &&
        /\b(extension|university|institute|center|centre|trung\s*tâm|viện|cục|bộ\s*nông\s*nghiệp|sở\s*nông\s*nghiệp|khuyến\s*nông)\b/i.test(l)
    );
    if (topOrgLine) {
      result.organization = topOrgLine;
    } else if (sourceUrl) {
      try {
        const host = new URL(sourceUrl.trim()).hostname.toLowerCase();
        const matchedHost = KNOWN_ORG_BY_HOST.find((item) => item.match.test(host));
        if (matchedHost) result.organization = matchedHost.name;
      } catch {
        // ignore invalid URL
      }
    }
  }

  return result;
};

const isSafeHttpUrl = (url?: string | null): boolean => {
  if (!url) return false;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

interface DuplicatePair {
  idA: string;
  idB: string;
  indexA: number;
  indexB: number;
  textA: string;
  textB: string;
  similarity: number;
}

const findDuplicateChunks = (rows: KnowledgeSourceItem[]): DuplicatePair[] => {
  const clean = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  const pairs: DuplicatePair[] = [];

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const textA = clean(rows[i].evidenceText);
      const textB = clean(rows[j].evidenceText);
      if (!textA || !textB) continue;

      if (textA === textB) {
        pairs.push({
          idA: rows[i].id,
          idB: rows[j].id,
          indexA: i + 1,
          indexB: j + 1,
          textA: rows[i].evidenceText,
          textB: rows[j].evidenceText,
          similarity: 100,
        });
        continue;
      }

      const wordsA = new Set(textA.split(' '));
      const wordsB = new Set(textB.split(' '));
      let inter = 0;
      for (const w of wordsA) {
        if (wordsB.has(w)) inter++;
      }
      const union = new Set([...wordsA, ...wordsB]).size;
      const sim = union > 0 ? (inter / union) * 100 : 0;
      if (sim >= 75) {
        pairs.push({
          idA: rows[i].id,
          idB: rows[j].id,
          indexA: i + 1,
          indexB: j + 1,
          textA: rows[i].evidenceText,
          textB: rows[j].evidenceText,
          similarity: Math.round(sim),
        });
      }
    }
  }
  return pairs;
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ defaultTab = 'ingestion' }) => {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [diseases, setDiseases] = useState<DiseaseOption[]>([]);

  // ==================== TAB 1: NHẬP BÀI BÁO (HITL INGESTION) ====================
  // Phân loại cây/bệnh
  const [ingestClass, setIngestClass] = useState<string>('');
  // true khi cây/bệnh do AI đoán từ bài trước: bài mới phải đoán lại, không mang theo
  const [classFromAi, setClassFromAi] = useState<boolean>(false);
  const [selectedPlant, setSelectedPlant] = useState<string>('');
  const [ingestUrl, setIngestUrl] = useState<string>('');
  const [ingestTitle, setIngestTitle] = useState<string>('');
  // Tách biệt rõ ràng 4 trường: Cơ quan, Tác giả, Ngày đăng, Ngày cập nhật
  const [ingestOrg, setIngestOrg] = useState<string>('');
  const [ingestAuthor, setIngestAuthor] = useState<string>('');
  const [ingestPublishedDate, setIngestPublishedDate] = useState<string>('');
  const [ingestUpdatedDate, setIngestUpdatedDate] = useState<string>('');
  const [ingestDate, setIngestDate] = useState<string>(''); // fallback tương thích
  const [ingestSourceScope, setIngestSourceScope] = useState<'Việt Nam' | 'Quốc tế'>('Việt Nam');
  const [ingestText, setIngestText] = useState<string>('');
  const [articleEditorMode, setArticleEditorMode] = useState<'preview' | 'code'>('preview');
  const [ingesting, setIngesting] = useState<boolean>(false);
  const [crawlingUrl, setCrawlingUrl] = useState<boolean>(false);
  const [ingestionResult, setIngestionResult] = useState<IngestionResponse | null>(null);

  // Chọn đoạn để commit
  const [selectedParagraphs, setSelectedParagraphs] = useState<Record<string, { selected: boolean; unitType: string; diseaseClass?: string }>>({});
  const [commitNotes, setCommitNotes] = useState<string>('Đã đối chiếu với bài viết gốc');
  const [committing, setCommitting] = useState<boolean>(false);
  const [showNoiseParagraphs, setShowNoiseParagraphs] = useState<boolean>(false);

  // Chế độ sửa bài đã lưu (/admin/ingest?edit=<url>)
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editParam = searchParams.get('edit');
  const [editUrl, setEditUrl] = useState<string | null>(null);
  const [editRows, setEditRows] = useState<KnowledgeSourceItem[]>([]);
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editSaving, setEditSaving] = useState<boolean>(false);
  const [editOriginalMeta, setEditOriginalMeta] = useState({
    plantName: '',
    diseaseName: '',
    modelClass: '',
    title: '',
    org: '',
    author: '',
    pubDate: '',
    upDate: '',
    date: '',
    sourceScope: 'Việt Nam' as 'Việt Nam' | 'Quốc tế',
  });
  const [summaryDrafts, setSummaryDrafts] = useState<Record<string, string>>({});
  const [editSubTab, setEditSubTab] = useState<'approved' | 'reparse'>('approved');
  const [dismissMetaDiff, setDismissMetaDiff] = useState<boolean>(false);
  const [dismissedAiFields, setDismissedAiFields] = useState<Record<string, boolean>>({});
  const [activeAiPopoverField, setActiveAiPopoverField] = useState<string | null>(null);
  const [isMetaCardCollapsed, setIsMetaCardCollapsed] = useState<boolean>(false);
  const [showMetaEditPanel, setShowMetaEditPanel] = useState<boolean>(false);
  const [articleTopics, setArticleTopics] = useState<string[]>([]);
  const [selectedTopicToAdd, setSelectedTopicToAdd] = useState<string>('');

  // Highlight cụm từ trích xuất (mention tag)
  const [highlightedMention, setHighlightedMention] = useState<{ paraId: string; text: string } | null>(null);

  // Tách đoạn an toàn theo dấu câu (Điều 25 Luật SHTT - Không sửa đổi nguyên văn)
  const [splitModalOpen, setSplitModalOpen] = useState<boolean>(false);
  const [splitTargetPara, setSplitTargetPara] = useState<ParagraphItem | null>(null);
  const [splitPart1, setSplitPart1] = useState<string>('');
  const [splitPart2, setSplitPart2] = useState<string>('');
  const [selectedCutIndex, setSelectedCutIndex] = useState<number>(-1);
  const [selectedCutIndices, setSelectedCutIndices] = useState<number[]>([]);

  // Thêm / sửa thẻ vật tư (mentions)
  const [addingMentionParaId, setAddingMentionParaId] = useState<string | null>(null);
  const [newMentionText, setNewMentionText] = useState<string>('');
  const [newMentionKind, setNewMentionKind] = useState<string>('CHEMICAL');

  // ==================== TAB 2: KIỂM DUYỆT TRI THỨC (CURATION) ====================
  const [sources, setSources] = useState<KnowledgeSourceItem[]>([]);
  const [loadingSources, setLoadingSources] = useState<boolean>(false);
  const [sourceFilterPlant, setSourceFilterPlant] = useState<string>('ALL');
  const [sourceFilterClass, setSourceFilterClass] = useState<string>('ALL');
  const [sourceOriginFilter, setSourceOriginFilter] = useState<'ALL' | 'Việt Nam' | 'Quốc tế'>('ALL');
  const [sourceApprovalFilter, setSourceApprovalFilter] = useState<'ALL' | 'APPROVED' | 'PENDING'>('ALL');
  const [sourceSearch, setSourceSearch] = useState<string>('');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeSourceItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteArticleTarget, setDeleteArticleTarget] = useState<GroupedArticle | null>(null);
  const [deletingArticle, setDeletingArticle] = useState<boolean>(false);
  const [deleteBatchModalOpen, setDeleteBatchModalOpen] = useState<boolean>(false);
  const [deletingBatch, setDeletingBatch] = useState<boolean>(false);
  const [curationPage, setCurationPage] = useState<number>(1);
  const [curationPageSize, setCurationPageSize] = useState<number>(10);
  const [batchActionLoading, setBatchActionLoading] = useState<boolean>(false);

  // Reindex Status Dialog
  const [reindexStatusOpen, setReindexStatusOpen] = useState<boolean>(false);
  const [reindexStatusData, setReindexStatusData] = useState<any>(null);
  const [loadingReindexStatus, setLoadingReindexStatus] = useState<boolean>(false);
  const [showRawReindexJson, setShowRawReindexJson] = useState<boolean>(false);

  // ==================== TAB: ẢNH TRIỆU CHỨNG (TASK-15 PHASE 2) ====================
  const [knowledgeImages, setKnowledgeImages] = useState<KnowledgeImageItem[]>([]);
  const [loadingImages, setLoadingImages] = useState<boolean>(false);
  const [imageFilterPlant, setImageFilterPlant] = useState<string>('ALL');
  const [imageFilterClass, setImageFilterClass] = useState<string>('ALL');
  const [imageFilterPart, setImageFilterPart] = useState<string>('ALL');
  const [imageFilterApproval, setImageFilterApproval] = useState<'ALL' | 'APPROVED' | 'PENDING'>('ALL');
  const [imageSearch, setImageSearch] = useState<string>('');

  // Dialog Thêm ảnh mới
  const [addImageModalOpen, setAddImageModalOpen] = useState<boolean>(false);
  const [submittingImage, setSubmittingImage] = useState<boolean>(false);
  const [newImagePlant, setNewImagePlant] = useState<string>('Cà chua');
  const [newImageClass, setNewImageClass] = useState<string>('Tomato___Late_blight');
  const [newImageSourceUrl, setNewImageSourceUrl] = useState<string>('');
  const [newImageMode, setNewImageMode] = useState<'FILE' | 'URL'>('URL');
  const [newImageUrl, setNewImageUrl] = useState<string>('');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImageFilePreview, setNewImageFilePreview] = useState<string | null>(null);
  const [newImageCaption, setNewImageCaption] = useState<string>('');
  const [newImagePlantPart, setNewImagePlantPart] = useState<string>('LEAF');
  const [newImageCredit, setNewImageCredit] = useState<string>('');
  const [newImageLicenseNote, setNewImageLicenseNote] = useState<string>('Trích dẫn phục vụ học thuật và hướng dẫn nông vụ khuyến nông');
  const [newImageAutoApprove, setNewImageAutoApprove] = useState<boolean>(true);

  // Dialog Xem / Xóa ảnh
  const [deleteImageTarget, setDeleteImageTarget] = useState<KnowledgeImageItem | null>(null);
  const [deletingImage, setDeletingImage] = useState<boolean>(false);
  const [previewingImage, setPreviewingImage] = useState<KnowledgeImageItem | null>(null);

  // ==================== TAB 3: KHO THUỐC BVTV & GỢI Ý VẬT TƯ ====================
  const [inventorySubTab, setInventorySubTab] = useState<'medicines' | 'suggestions'>('medicines');
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [loadingMedicines, setLoadingMedicines] = useState<boolean>(false);
  const [medSearch, setMedSearch] = useState<string>('');
  const [editingMed, setEditingMed] = useState<MedicineItem | null>(null);
  const [medSaving, setMedSaving] = useState<boolean>(false);

  // Gợi ý vật tư từ bài báo (Task-15 Phase 3)
  const [suggestions, setSuggestions] = useState<ProductSuggestionItem[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);
  const [suggestionStatusFilter, setSuggestionStatusFilter] = useState<string>('ALL');
  const [suggestionKindFilter, setSuggestionKindFilter] = useState<string>('ALL');
  const [suggestionSearch, setSuggestionSearch] = useState<string>('');

  // Dialog liên kết gợi ý với sản phẩm có sẵn
  const [linkingSuggestion, setLinkingSuggestion] = useState<ProductSuggestionItem | null>(null);
  const [selectedLinkMedId, setSelectedLinkMedId] = useState<number | ''>('');
  const [linkingLoading, setLinkingLoading] = useState<boolean>(false);

  // Dialog thêm thuốc / vật tư mới (từ gợi ý hoặc thêm thủ công)
  const [createMedModalOpen, setCreateMedModalOpen] = useState<boolean>(false);
  const [fromSuggestion, setFromSuggestion] = useState<ProductSuggestionItem | null>(null);
  const [newMedName, setNewMedName] = useState<string>('');
  const [newMedType, setNewMedType] = useState<string>('Hóa học');
  const [newMedActiveIngredient, setNewMedActiveIngredient] = useState<string>('');
  const [newMedPrice, setNewMedPrice] = useState<number>(50000);
  const [newMedDosage, setNewMedDosage] = useState<string>('Pha theo hướng dẫn trên bao bì');
  const [newMedPhi, setNewMedPhi] = useState<number | ''>(7);
  const [newMedStock, setNewMedStock] = useState<number>(50);
  const [newMedAvailability, setNewMedAvailability] = useState<string>('IN_STOCK');
  const [newMedSourceUrl, setNewMedSourceUrl] = useState<string>('');
  const [newMedTargetDisease, setNewMedTargetDisease] = useState<string>('Tomato___Late_blight');
  const [newMedIsAllowed, setNewMedIsAllowed] = useState<boolean>(false);
  const [creatingMed, setCreatingMed] = useState<boolean>(false);

  // ==================== TAB 4: CA CHUYÊN GIA ====================
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [loadingEscalations, setLoadingEscalations] = useState<boolean>(false);
  const [selectedEscalation, setSelectedEscalation] = useState<EscalationItem | null>(null);
  const [expertNoteInput, setExpertNoteInput] = useState<string>('');
  const [reviewSubmitting, setReviewSubmitting] = useState<boolean>(false);

  // Load danh mục 38/40 lớp bệnh (sắp xếp theo thứ tự chữ cái tiếng Việt)
  useEffect(() => {
    const fetchDiseases = async () => {
      try {
        const res = await apiClient.get('/diseases');
        const list: DiseaseOption[] = res.data || [];
        const sortedList = [...list].sort((a, b) => {
          const plantCmp = a.plantName.localeCompare(b.plantName, 'vi');
          if (plantCmp !== 0) return plantCmp;
          return formatTopicLabel(a.commonNameVi, a.classCode).localeCompare(
            formatTopicLabel(b.commonNameVi, b.classCode),
            'vi'
          );
        });
        setDiseases(sortedList);
        // Không tự chọn bệnh đầu danh sách (trước đây luôn ra "Táo") để AI tự nhận diện
      } catch {
        // fallback
      }
    };
    fetchDiseases();
  }, []);

  // Lọc danh sách loài cây duy nhất và các bệnh thuộc loài cây đang chọn
  const uniquePlants = React.useMemo(() => {
    const set = new Set<string>();
    diseases.forEach((d) => {
      if (d.plantName) set.add(d.plantName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [diseases]);

  const filteredDiseasesByPlant = React.useMemo(() => {
    if (!selectedPlant) return diseases;
    return diseases.filter((d) => d.plantName === selectedPlant);
  }, [diseases, selectedPlant]);

  const handlePlantChange = (plant: string) => {
    setSelectedPlant(plant);
    setClassFromAi(false);
    const plantDiseases = diseases.filter((d) => d.plantName === plant);
    setArticleTopics((prev) => {
      const remaining = prev.filter((code) => plantDiseases.some((d) => d.classCode === code));
      if (remaining.length > 0) return remaining;
      return plantDiseases.length > 0 ? [plantDiseases[0].classCode] : [];
    });
    setSelectedTopicToAdd('');
    const current = diseases.find((d) => d.classCode === ingestClass);
    if (!current || current.plantName !== plant) {
      setIngestClass(plantDiseases.length > 0 ? plantDiseases[0].classCode : '');
    }
  };

  // Sync defaultTab prop when route changes
  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  // Load data for active tab
  useEffect(() => {
    if (activeTab === 'curation') {
      fetchSources();
    } else if (activeTab === 'images') {
      fetchKnowledgeImages();
    } else if (activeTab === 'inventory') {
      fetchMedicines();
      fetchSuggestions();
    } else if (activeTab === 'escalations') {
      fetchEscalations();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'images') {
      fetchKnowledgeImages();
    }
  }, [imageFilterClass, imageFilterPart, imageFilterApproval]);

  // Nhận diện đoạn/chủ đề thuộc nhóm Kỹ thuật canh tác & Phòng ngừa (không phải bệnh hại)
  const isHealthyTopic = (diseaseName?: string, modelClass?: string): boolean => {
    const name = (diseaseName || '').toLowerCase();
    const cls = (modelClass || '').toLowerCase();
    return name.includes('khỏe mạnh') || cls.endsWith('healthy');
  };

  // Chuẩn hóa tên chuyên mục hiển thị thống nhất trên bộ lọc, bảng duyệt tri thức và form nhập bài
  const formatTopicLabel = (diseaseName?: string, modelClass?: string): string =>
    isHealthyTopic(diseaseName, modelClass)
      ? '🌱 Kỹ thuật canh tác & Phòng ngừa'
      : (diseaseName || modelClass || 'Bệnh hại');

  // Danh sách các chủ đề / bệnh riêng biệt có trong bài viết đang xem
  const articleDistinctTopics = React.useMemo(() => {
    const list: Array<{ plantName: string; label: string; isHealthy: boolean; modelClass: string }> = [];
    editRows.forEach((r) => {
      const isH = isHealthyTopic(r.diseaseName, r.modelClass);
      const label = isH ? '🌱 Kỹ thuật canh tác & Phòng ngừa' : (r.diseaseName || 'Bệnh hại');
      if (!list.some((d) => d.modelClass === r.modelClass)) {
        list.push({ plantName: r.plantName, label, isHealthy: isH, modelClass: r.modelClass });
      }
    });
    return list;
  }, [editRows]);

  const handleApproveAllInEdit = async () => {
    if (editRows.length === 0) return;
    const allApproved = editRows.every((r) => r.isManualApproved);
    const targetStatus = !allApproved;
    const ids = editRows.map((r) => r.id);
    try {
      await apiClient.patch('/knowledge/sources/approve-batch', {
        source_ids: ids,
        is_approved: targetStatus,
        reviewer_notes: targetStatus ? 'Duyệt toàn bộ từ trang chi tiết bài viết' : 'Bỏ duyệt toàn bộ',
      });
      setEditRows((prev) => prev.map((r) => ({ ...r, isManualApproved: targetStatus })));
      toast.success(targetStatus ? `Đã duyệt toàn bộ ${ids.length} đoạn của bài viết.` : `Đã bỏ duyệt ${ids.length} đoạn.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Nhận diện dòng siêu dữ liệu đơn lẻ (Cơ quan, Tác giả, Ngày đăng, Ngày cập nhật...) để không gom/lưu thành đoạn kiến thức
  const isStandaloneMetadataLine = (text: string): boolean => {
    const trimmed = text
      .trim()
      .replace(/^(?:[#>*\-•+]+\s*)+/, '')
      .replace(/\*\*/g, '')
      .trim();
    if (!trimmed || trimmed.includes('\n') || trimmed.length > 240) return false;
    return (
      /^(?:original\s+publication\s+date|originally\s+published|first\s+published|publication\s*date|reviewed\s*\/\s*revised|revised\s*\/\s*reviewed|date\s*revised|last\s*(?:updated|reviewed|modified)|published(?:\s*(?:date|on|in))?|updated(?:\s*(?:on|in))?|revised(?:\s*(?:on|in))?|reviewed(?:\s*(?:on|in))?|ngày\s*(?:đăng|xuất\s*bản|cập\s*nhật)|cập\s*nhật|tác\s*giả|authors?|written\s+by|prepared\s+by|cơ\s*quan|organization|publisher)\s*:/i.test(
        trimmed
      ) ||
      /^(?:last\s*(?:updated|reviewed|modified)|reviewed\s*\/\s*revised|publication\s*date|originally\s+published)(?=\s|$).*\d{4}/i.test(
        trimmed
      )
    );
  };

  // Gom tiêu đề mục, câu dẫn kết thúc bằng dấu ':' hoặc '?' và các ý con ngắn cùng mục thành đoạn hoàn chỉnh chuẩn Markdown (tối đa ~1.300 ký tự)
  const coalesceArticleParagraphs = (rawText: string): string => {
    if (!rawText) return '';
    const MAX_GROUP_CHARS = 1300;
    const stripMd = (s: string): string =>
      s.replace(/^(?:#{1,6}|[•\-*+])\s+/, '').replace(/\*\*/g, '').trim();

    const isRoleLine = (b: string): boolean => {
      const plain = stripMd(b);
      return (
        !plain.includes('\n') &&
        plain.length <= 120 &&
        !/[.!?;]$/.test(plain) &&
        /\b(professor|specialist|director|researcher|research\s+(?:specialist|assistant|associate|technician)|extension\s+(?:specialist|agent|educator)|scientist|technician|entomology|plant\s+pathology|pathology|horticulture|agronomy|lecturer)\b/i.test(
          plain
        )
      );
    };

    const isTitleHeaderBlock = (b: string, idx: number): boolean => {
      const trimmed = b.trim();
      if (!trimmed || trimmed.includes('\n') || isStandaloneMetadataLine(trimmed)) return false;
      if (/^#\s+\S/.test(trimmed)) return true;
      return idx === 0 && !/^#{2,6}\s+/.test(trimmed) && trimmed.length < 140 && !/[.!?;]$/.test(trimmed);
    };

    const isSectionHeadingBlock = (b: string): boolean => {
      const trimmed = b.trim();
      if (!trimmed || trimmed.includes('\n') || isStandaloneMetadataLine(trimmed) || /^#\s+\S/.test(trimmed)) {
        return false;
      }
      if (/^#{2,6}\s+\S/.test(trimmed)) {
        return trimmed.length <= 120;
      }
      const plain = stripMd(trimmed);
      if (plain.length < 3 || plain.length > 90) return false;
      if (
        /^(đây là|đó là|biện pháp này|cách này|khi |nếu |dù |mặc dù |ngoài ra|tuy nhiên|do đó|vì vậy|trong bài|dưới đây là)(?=\s|$)/i.test(
          plain
        )
      ) {
        return false;
      }
      const endsWithColon = /:\s*$/.test(plain) && plain.replace(/:\s*$/, '').indexOf(':') === -1 && !/\.\s+\S/.test(plain);
      const numberedHeading = /^(\d+(\.\d+)*|[IVX]+|[a-zđ])[.)]\s+\S/i.test(plain) && !/\.\s*$/.test(plain);
      const commonHeading =
        /^(introduction|symptoms(\s+and\s+signs)?|signs(\s+and\s+symptoms)?|disease\s+cycle|causal\s+agent|pathogen|management|control|chemical\s+control|cultural\s+control|biological\s+control|diagnostic\s+procedures|prevention|treatment|summary|overview|giới\s+thiệu|triệu\s+chứng(\s+và\s+dấu\s+hiệu)?|dấu\s+hiệu\s+nhận\s+biết|nguyên\s+nhân(\s+và\s+điều\s+kiện\s+phát\s+sinh)?|đặc\s+điểm\s+phát\s+sinh|điều\s+kiện\s+phát\s+sinh|vòng\s+đời|tác\s+hại|biện\s+pháp\s+phòng\s+trừ|biện\s+pháp\s+phòng\s+ngừa|biện\s+pháp\s+quản\s+lý|cách\s+trị|phòng\s+ngừa|điều\s+trị)$/i.test(
          plain
        );
      return endsWithColon || numberedHeading || commonHeading;
    };

    const isSubItemBlock = (b: string): boolean => {
      const trimmed = b.trim();
      if (!trimmed || /^#{1,6}\s+/.test(trimmed)) return false;
      if (/^[•\-*+]\s+\S/.test(trimmed)) return true;
      if (
        trimmed.length <= 265 &&
        /^(?:[•\-*+]\s*)?(?:\*\*)?(?:\d+[.)]\s*)?[^:.\n!?*]{2,60}(?:\*\*)?:\s*(?:\*\*)?\s*\S/.test(trimmed)
      ) {
        return true;
      }
      return (
        trimmed.length <= 340 &&
        /^(?:[•\-*+]\s*)?(?:\*\*)?[^\n?*]{6,120}\?(?:\*\*)?\s*\n?\s*\S/.test(trimmed)
      );
    };

    const formatSubItemMarkdown = (b: string): string => {
      const trimmed = b.trim();
      if (trimmed.includes('\n') || /^#{1,6}\s+/.test(trimmed)) return trimmed;
      if (/^•\s+/.test(trimmed)) return trimmed.replace(/^•\s+/, '- ');
      if (/^[-*+]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) return trimmed;
      if (trimmed.length <= 265 && !trimmed.includes('**')) {
        const colonMatch = trimmed.match(/^([^:.\n!?*]{2,60}):\s+(\S[\s\S]*)$/);
        if (colonMatch) {
          return `- **${colonMatch[1].trim()}:** ${colonMatch[2].trim()}`;
        }
      }
      return trimmed;
    };

    const isIncompleteLeadIn = (text: string): boolean => {
      const plain = text.replace(/\*\*/g, '').trim();
      return (
        (/:\s*$/.test(plain) && plain.length <= 380) ||
        (!plain.includes('\n') && /\?\s*$/.test(plain) && plain.length <= 120)
      );
    };

    const isStrayCaptionOrPromo = (b: string, idx: number): boolean => {
      const plain = stripMd(b);
      return (
        /^[•\-*]?\s*(website|trang\s*chủ|fanpage|youtube|shopee|lazada|tiktok|hệ\s*thống\s*cửa\s*hàng)\s*:/i.test(
          plain
        ) ||
        (idx > 0 &&
          !b.includes('\n') &&
          plain.length < 90 &&
          !isStandaloneMetadataLine(b) &&
          !isSectionHeadingBlock(b) &&
          !isSubItemBlock(b) &&
          !isRoleLine(b) &&
          !/[.!?:;]/.test(plain))
      );
    };

    const rawBlocks = rawText
      .split(/\r?\n\s*\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const out: string[] = [];
    let pendingHeading = '';
    let currentGroup = '';
    let currentHasSubItems = false;

    const flush = () => {
      if (currentGroup) {
        out.push(currentGroup);
        currentGroup = '';
        currentHasSubItems = false;
      }
    };

    rawBlocks.forEach((rawBlock, idx) => {
      if (isStrayCaptionOrPromo(rawBlock, idx)) return;

      if (isStandaloneMetadataLine(rawBlock) || isTitleHeaderBlock(rawBlock, idx)) {
        pendingHeading = '';
        flush();
        out.push(rawBlock);
        return;
      }

      if (isSectionHeadingBlock(rawBlock)) {
        flush();
        const prefixMatch = rawBlock.trim().match(/^(#{2,6})\s+/);
        const prefix = prefixMatch ? prefixMatch[1] : '##';
        const headingBody = rawBlock.trim().replace(/^#{2,6}\s+/, '').replace(/\*\*/g, '').trim();
        if (pendingHeading) {
          const prevClean = pendingHeading.replace(/^#{2,6}\s+/, '').replace(/:\s*$/, '').trim();
          const curClean = headingBody.replace(/:\s*$/, '').trim();
          pendingHeading = `## ${prevClean} - ${curClean}:`;
        } else {
          pendingHeading = `${prefix} ${headingBody}`;
        }
        return;
      }

      const b = formatSubItemMarkdown(rawBlock);

      if (pendingHeading) {
        currentGroup = `${pendingHeading}\n${b}`;
        currentHasSubItems = isSubItemBlock(b);
        pendingHeading = '';
        return;
      }

      if (currentGroup) {
        const startsWithHeading = /^#{1,6}\s+/.test(b);
        const leadIn = isIncompleteLeadIn(currentGroup);
        const sub = isSubItemBlock(b);
        const shouldMerge =
          !startsWithHeading &&
          (leadIn ||
            (sub && (currentGroup.length <= 500 || currentHasSubItems)) ||
            (currentGroup.length < 200 && b.length < 200));
        if (shouldMerge && currentGroup.length + 1 + b.length <= MAX_GROUP_CHARS) {
          currentGroup = `${currentGroup}\n${b}`;
          if (sub) currentHasSubItems = true;
          return;
        }
        flush();
      }

      currentGroup = b;
      currentHasSubItems = isSubItemBlock(b);
    });
    flush();

    return out.join('\n\n');
  };

    // ==================== TAB 1 LOGIC (TASK-15 V2) ====================
  const cleanArticleTextFromHtml = (html: string): string => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const BLOCK_TAGS = new Set([
        'DIV', 'P', 'LI', 'TR', 'TD', 'TH', 'DT', 'DD',
        'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'SECTION', 'ARTICLE'
      ]);
      const extractTextWithSpacing = (el: Element): string => {
        const parts: string[] = [];
        const walk = (node: Node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent) parts.push(node.textContent);
            return;
          }
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          const element = node as Element;
          if (['SCRIPT', 'STYLE', 'SVG', 'NOSCRIPT'].includes(element.tagName)) return;
          if (element.tagName === 'BR') {
            parts.push('\n');
            return;
          }
          const isBlock = BLOCK_TAGS.has(element.tagName);
          if (isBlock) parts.push(' ');
          element.childNodes.forEach(walk);
          if (isBlock) parts.push(' ');
        };
        walk(el);
        return parts
          .join('')
          .replace(/[ \t\f\v]+/g, ' ')
          .replace(/ *\r?\n */g, '\n')
          .replace(/\n{2,}/g, '\n')
          .trim();
      };

      const extractInlineMarkdown = (el: Element): string => {
        const parts: string[] = [];
        const walk = (node: Node, insideStrong = false) => {
          if (node.nodeType === Node.TEXT_NODE) {
            if (node.textContent) parts.push(node.textContent);
            return;
          }
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          const element = node as Element;
          const tag = element.tagName;
          if (['SCRIPT', 'STYLE', 'SVG', 'NOSCRIPT', 'IMG'].includes(tag)) return;
          if (tag === 'BR') {
            parts.push('\n');
            return;
          }
          if (!insideStrong && (tag === 'STRONG' || tag === 'B')) {
            const strongRaw = extractTextWithSpacing(element);
            const core = strongRaw.trim();
            if (!core) return;
            if (/^[,.;:!?•\-–—]+$/.test(core)) {
              parts.push(` ${core} `);
              return;
            }
            const cleanCore = core.replace(/\*\*/g, '');
            const bulletPrefixMatch = cleanCore.match(/^([•\-*+])\s+(.+)$/);
            if (bulletPrefixMatch) {
              parts.push(` ${bulletPrefixMatch[1]} **${bulletPrefixMatch[2].trim()}** `);
            } else {
              parts.push(` **${cleanCore}** `);
            }
            return;
          }
          const isBlock = BLOCK_TAGS.has(tag);
          if (isBlock) parts.push(' ');
          element.childNodes.forEach((child) => walk(child, insideStrong));
          if (isBlock) parts.push(' ');
        };
        walk(el);

        let md = parts
          .join('')
          .replace(/[ \t\f\v]+/g, ' ')
          .replace(/ *\r?\n */g, '\n')
          .replace(/\n{2,}/g, '\n')
          .replace(/\*\*\s+\*\*/g, ' ')
          .replace(/\*\*([^*\n]+)\*\*\s*:/g, '**$1:**')
          .replace(/\s+([,.;:!?])/g, '$1')
          .trim();

        // Nếu cả đoạn dài (>140 ký tự) bị bọc trong một cặp **...** duy nhất, bỏ bớt ** bao ngoài để giữ Markdown sạch
        if (md.startsWith('**') && md.endsWith('**') && md.slice(2, -2).indexOf('**') === -1 && md.length > 140) {
          md = md.slice(2, -2).trim();
        }
        return md;
      };

      const isNoise = (text: string): boolean => {
        const trimmed = text.trim();
        if (!trimmed || trimmed.length < 3) return true;
        const lower = trimmed.toLowerCase();
        // Chỉ lọc tên nút mạng xã hội / điều hướng khi dòng ngắn (tránh xóa đoạn văn bắt đầu bằng "In ...")
        if (
          trimmed.length <= 35 &&
          /^(facebook|zalo|twitter|x|youtube|linkedin|pinterest|instagram|in|share|tweet|print|email|search|log\s*in|sign\s*in|menu|publications|related publications|where next\??)$/i.test(lower)
        ) {
          return true;
        }
        if (/^(skip to|nhảy tới|chuyển tới)\s+/i.test(lower)) return true;
        if (
          trimmed.length <= 80 &&
          /^(chia sẻ|bình luận|tin liên quan|xem thêm|bài viết liên quan|từ khóa|keywords?|tag|hotline|liên hệ|quảng cáo)\b/i.test(lower)
        ) {
          return true;
        }
        if (/^(điện thoại|sđt|hotline|email|fax):\s*[\d\s.\-]+$/i.test(lower)) return true;
        if (/^[•\-*]?\s*(website|trang\s*chủ|fanpage|youtube|shopee|lazada|tiktok|hệ\s*thống\s*cửa\s*hàng)\s*:/i.test(trimmed)) return true;
        // Hotline/quảng cáo: có số điện thoại đi kèm từ khóa liên hệ, hoặc dòng footer quen thuộc
        const hasPhone = /(\+84|\b0)\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3,4}\b/.test(trimmed);
        if (trimmed.length <= 300 && hasPhone && /hotline|zalo|liên hệ|tư vấn|đặt hàng|mua hàng|gọi/i.test(lower)) return true;
        if (/^bạn đang đọc bài viết|^đăng ký nhận bản tin/i.test(lower)) return true;
        if (/^receive email notifications for new publications$/i.test(trimmed)) return true;
        if (/^read our (commitment to nondiscrimination|privacy statement)\.?$/i.test(trimmed)) return true;
        if (/^recommendations for the use of agricultural chemicals are included in this publication as a convenience/i.test(trimmed)) return true;
        if (/^n\.c\.\s*cooperative extension prohibits discrimination and harassment/i.test(trimmed)) return true;
        if (/^n\.c\.\s*cooperative extension is based at north carolina/i.test(trimmed)) return true;
        if (/^find more information at the following .* websites:?$/i.test(trimmed)) return true;
        if (/^(college of agriculture & life sciences|cals news|extension at nc a&t|jobs|give now|county centers|contact us|ncce logo|nc state extension)$/i.test(trimmed)) return true;
        return false;
      };

      // Thay <br> bằng xuống dòng để các cặp metadata trong cùng <p> (Publication date / Reviewed/Revised) tách thành dòng riêng
      doc.querySelectorAll('br').forEach((br) => {
        br.replaceWith(doc.createTextNode('\n'));
      });

      // Trích xuất metadata (tiêu đề, cơ quan, tác giả, ngày đăng, ngày cập nhật) TRƯỚC khi xóa <header>
      const h1El = doc.querySelector('article h1, main h1, [role="main"] h1, h1');
      const titleText = (
        (h1El ? extractTextWithSpacing(h1El) : '') ||
        doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
        doc.title ||
        ''
      ).replace(/\s+/g, ' ').trim();

      const siteOrg = (doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || '')
        .replace(/\s+/g, ' ')
        .trim();

      const authorMeta = (doc.querySelector('meta[name="author"]')?.getAttribute('content') || '')
        .replace(/\s+/g, ' ')
        .trim();
      const authorEls = Array.from(doc.querySelectorAll('.author, .authors, [rel="author"], .byline'));
      const authorNames = authorEls
        .map((el) => extractTextWithSpacing(el).replace(/\n+/g, ', '))
        .filter((t) => t.length >= 3 && t.length <= 150 && !/^authors?:?$/i.test(t) && !isNoise(t));
      if (authorMeta && !authorNames.includes(authorMeta)) {
        authorNames.unshift(authorMeta);
      }

      const dateEl = doc.querySelector('time, .date, .post-date, .publish-date, .detail-time');
      const metaDate = doc.querySelector('meta[property="article:published_time"], meta[name="publish-date"], meta[name="date"], meta[name="dcterms.created"], meta[itemprop="datePublished"]')?.getAttribute('content') || '';
      const dateText = (dateEl?.getAttribute('datetime') || (dateEl ? extractTextWithSpacing(dateEl).replace(/\n+/g, ' ') : '') || metaDate || '')
        .replace(/\s+/g, ' ')
        .trim();

      const updatedEl = doc.querySelector('time.updated, .updated-date, .modified-date, .revised-date');
      const metaUpdatedDate =
        doc.querySelector('meta[property="article:modified_time"], meta[property="og:updated_time"], meta[name="last-modified"], meta[name="revised"], meta[name="dcterms.modified"], meta[itemprop="dateModified"]')?.getAttribute('content') || '';
      const updatedDateText = (
        updatedEl?.getAttribute('datetime') ||
        (updatedEl ? extractTextWithSpacing(updatedEl).replace(/\n+/g, ' ') : '') ||
        metaUpdatedDate ||
        ''
      )
        .replace(/\s+/g, ' ')
        .trim();

      // Loại bỏ thẻ rác, menu, header (trừ header chứa h1 bài), footer, quảng cáo
      const junkSelectors = [
        'script', 'style', 'nav', 'footer', 'aside', 'form', 'iframe', 'noscript', 'svg',
        '.menu', '.navbar', '.sidebar', '.ad', '.ads', '.advertisement',
        '.social-share', '.share-buttons', '.share', '.comment', '.comments',
        '.related', '.related-posts', '.related-publications', '.breadcrumb',
        '.hotline', '.contact-info', '.skip-link', '.visually-hidden', '.sr-only',
        '.newsletter', '.subscribe', '.cookie-banner', '.legal-disclaimer', '.disclaimer',
        'figcaption', '.wp-caption-text', '.image-caption', '.caption',
        '[aria-hidden="true"]', '[role="navigation"]', '[role="banner"]', '[role="complementary"]'
      ];
      junkSelectors.forEach((sel) => {
        doc.querySelectorAll(sel).forEach((el) => el.remove());
      });
      doc.querySelectorAll('header').forEach((el) => {
        if (!el.querySelector('h1')) el.remove();
      });

      const isHeading = (el: Element | null, text: string): boolean =>
        (!!el && /^H[1-6]$/.test(el.tagName)) ||
        /:\s*$/.test(text) ||
        /^(\d+|[IVX]+|[a-zđ])[.)]\s+\S/i.test(text);

      const isMetadataLine = (text: string): boolean =>
        /^(?:original\s+publication\s+date|publication\s*date|reviewed\s*\/\s*revised|date\s*revised|last\s*(?:updated|reviewed|modified)|published|updated|revised|reviewed|ngày\s*(?:đăng|xuất\s*bản|cập\s*nhật)|cập\s*nhật|tác\s*giả|author|authors|written\s+by|prepared\s+by|cơ\s*quan)\b/i.test(text) &&
        text.length >= 8 &&
        text.length <= 240;

      const keep = (el: Element | null, text: string): boolean =>
        !isNoise(text) &&
        (text.length >= 30 ||
          (text.length >= 3 && isHeading(el, text)) ||
          isMetadataLine(text));

      const candidates = [
        doc.querySelector('article'),
        doc.querySelector('[role="main"], main'),
        doc.querySelector('.detail-content'),
        doc.querySelector('.post-content'),
        doc.querySelector('.article-content'),
        doc.querySelector('.entry-content'),
        doc.querySelector('.content'),
      ];
      const mainEl =
        candidates.find((el) => el && extractTextWithSpacing(el).length >= 150) ||
        doc.body;

      if (!mainEl) return '';

      const lines: string[] = [];
      const seen = new Set<string>();
      const push = (t: string, allowMultiline = false) => {
        const norm = allowMultiline
          ? t.split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n')
          : t.replace(/\s+/g, ' ').trim();
        const dedupeKey = norm
          .replace(/^(?:#{1,6}|[•\-*+])\s+/gm, '')
          .replace(/\*\*/g, '')
          .replace(/:\s*$/, '')
          .toLowerCase()
          .trim();
        if (!norm || !dedupeKey || seen.has(dedupeKey)) return; // footer lặp 2 lần, li lồng p...
        seen.add(dedupeKey);
        lines.push(norm);
      };

      if (titleText && !isNoise(titleText)) push(`# ${titleText}`);
      if (siteOrg && siteOrg.length <= 120 && !isNoise(siteOrg)) push(`Cơ quan: ${siteOrg}`);
      if (authorNames.length > 0) {
        push(`Tác giả: ${Array.from(new Set(authorNames)).slice(0, 5).join(', ')}`);
      }
      if (dateText && dateText.length <= 100) push(`Ngày đăng: ${dateText}`);
      if (updatedDateText && updatedDateText.length <= 100 && updatedDateText !== dateText) {
        push(`Ngày cập nhật: ${updatedDateText}`);
      }

      // Gom các gạch đầu dòng Markdown (- ...) thành khối để không mất ý con khi lọc đoạn < 40 ký tự
      let pendingListLines: string[] = [];
      const flushListBuffer = () => {
        if (pendingListLines.length === 0) return;
        push(pendingListLines.join('\n'), true);
        pendingListLines = [];
      };

      const blocks = mainEl.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, table, dt, dd');
      if (blocks.length > 0) {
        blocks.forEach((b) => {
          // Bỏ qua các thẻ lồng bên trong <table> hoặc <li> để tránh lặp chữ
          if (b.tagName !== 'TABLE' && b.closest('table')) return;
          if (b.tagName !== 'LI' && b.closest('li')) return;

          if (b.tagName === 'H1') {
            flushListBuffer();
            return;
          }

          if (b.tagName === 'TABLE') {
            flushListBuffer();
            const rows = Array.from(b.querySelectorAll('tr'));
            if (rows.length === 0) return;
            const headers = Array.from(rows[0].querySelectorAll('th')).map((th) => extractTextWithSpacing(th));
            const dataRows = headers.length > 0 ? rows.slice(1) : rows;
            const formattedRows: string[] = [];

            dataRows.forEach((tr) => {
              const cells = Array.from(tr.querySelectorAll('th, td')).map((cell) => extractTextWithSpacing(cell));
              if (cells.every((c) => !c)) return;
              if (headers.length > 0 && cells.length === headers.length) {
                const pairs = cells
                  .map((val, idx) => (headers[idx] ? `${headers[idx]}: ${val || '-'}` : val))
                  .filter(Boolean);
                if (pairs.length > 0) formattedRows.push(`- ${pairs.join(' | ')}`);
              } else {
                const nonEmpty = cells.filter(Boolean);
                if (nonEmpty.length > 0) formattedRows.push(`- ${nonEmpty.join(' | ')}`);
              }
            });

            if (formattedRows.length > 0) {
              let chunk = '';
              formattedRows.forEach((rowStr) => {
                const candidate = chunk ? `${chunk}\n${rowStr}` : rowStr;
                if (candidate.length > 1200 && chunk) {
                  push(chunk, true);
                  chunk = rowStr;
                } else {
                  chunk = candidate;
                }
              });
              if (chunk) push(chunk, true);
            }
            return;
          }

          const t = extractTextWithSpacing(b);
          if (!t || isNoise(t)) return;

          // Bỏ qua <p> là chú thích ảnh (chỉ bọc <em>/<i> hoặc nằm ngay sau <img>/<figure>, ngắn < 95 ký tự và không có dấu câu)
          if (b.tagName === 'P') {
            const empText = Array.from(b.querySelectorAll('em, i'))
              .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
              .join(' ')
              .trim();
            const isEmphasisOnly = empText.length > 0 && empText.length >= t.length * 0.9;
            const prevSib = b.previousElementSibling;
            const followsImage =
              !!b.querySelector('img') ||
              (!!prevSib && (prevSib.tagName === 'IMG' || prevSib.tagName === 'FIGURE' || !!prevSib.querySelector('img')));
            if ((isEmphasisOnly || followsImage) && t.length < 95 && !/[.!?:;]$/.test(t) && !isHeading(b, t) && !isMetadataLine(t)) {
              return;
            }
          }

          if (b.tagName === 'LI') {
            if (b.closest('.related, .related-publications, .keywords, .tags, .toc, #toc')) return;
            const onlyLink =
              b.children.length === 1 &&
              b.firstElementChild?.tagName === 'A' &&
              t === extractTextWithSpacing(b.firstElementChild);
            if (onlyLink && t.length < 60 && !/[.!?]/.test(t)) return;
            if (t.length < 12) return;

            const mdBody = extractInlineMarkdown(b).replace(/^[•\-*+]\s+/, '').trim();
            const bulletLine = /^-?\s*\d+[.)]\s+/.test(mdBody)
              ? mdBody.replace(/^-\s+/, '')
              : `- ${mdBody.replace(/\n+/g, ' ')}`;

            if (bulletLine.length <= 360) {
              const projectedLen = pendingListLines.join('\n').length + bulletLine.length + 1;
              if (projectedLen > 1100) flushListBuffer();
              pendingListLines.push(bulletLine);
            } else {
              flushListBuffer();
              push(bulletLine, false);
            }
            return;
          }

          flushListBuffer();

          if (/^H[2-6]$/.test(b.tagName)) {
            const headingText = t.replace(/\n+/g, ' ').trim();
            if (/^(authors?|keywords?|references?|tác giả|từ khóa|tài liệu tham khảo):?$/i.test(headingText)) {
              return;
            }
            const mdPrefix = b.tagName === 'H2' ? '##' : '###';
            const formattedHeading = /[:.!?]$/.test(headingText) ? headingText : `${headingText}:`;
            push(`${mdPrefix} ${formattedHeading}`);
            return;
          }

          if (b.tagName === 'DT') {
            const dtText = t.replace(/\n+/g, ' ').trim();
            if (b.closest('p, li, blockquote')) return;
            push(`### ${/[:.!?]$/.test(dtText) ? dtText : `${dtText}:`}`);
            return;
          }

          if (b.tagName === 'DD') {
            if (b.closest('p, li, blockquote')) return;
            if (t.length >= 15 || isMetadataLine(t)) {
              push(isMetadataLine(t) ? t : extractInlineMarkdown(b), t.includes('\n'));
            }
            return;
          }

          if (b.tagName === 'P') {
            if (isMetadataLine(t)) {
              push(t, t.includes('\n'));
              return;
            }

            // Nhận diện <p> chứa tiêu đề in đậm hoàn toàn (ví dụ: <p><strong>1. Triệu chứng bệnh</strong></p>)
            const strongEls = Array.from(b.querySelectorAll('strong, b'));
            const strongPlain = strongEls.map((el) => extractTextWithSpacing(el)).join(' ').replace(/\s+/g, ' ').trim();
            const isFullBoldP = strongPlain.length >= 3 && strongPlain.length >= t.replace(/[:\-•*]/g, '').trim().length * 0.92;
            if (
              isFullBoldP &&
              t.length >= 3 &&
              t.length <= 95 &&
              !/[.!?]$/.test(t) &&
              !/^[•\-*+]\s+/.test(t) &&
              !(t.includes(':') && !/:\s*$/.test(t))
            ) {
              const headingClean = t.replace(/\n+/g, ' ').trim();
              if (/^(authors?|keywords?|references?|tác giả|từ khóa|tài liệu tham khảo):?$/i.test(headingClean)) {
                return;
              }
              push(`### ${/[:.!?]$/.test(headingClean) ? headingClean : `${headingClean}:`}`);
              return;
            }

            if (keep(b, t)) {
              let mdP = extractInlineMarkdown(b);
              if (/^[•*+]\s+/.test(mdP)) {
                mdP = mdP.replace(/^[•*+]\s+/, '- ');
              }
              if (
                !mdP.includes('\n') &&
                mdP.length <= 265 &&
                !mdP.startsWith('- ') &&
                /^\*\*[^*\n]{2,60}\*\*:?\s+\S/.test(mdP)
              ) {
                mdP = `- ${mdP}`;
              }
              push(mdP, mdP.includes('\n'));
            }
            return;
          }

          if (keep(b, t)) {
            const mdText = isMetadataLine(t) ? t : extractInlineMarkdown(b);
            push(mdText, mdText.includes('\n'));
          }
        });
        flushListBuffer();
      } else {
        (mainEl.textContent || '').split(/\r?\n/).forEach((r) => {
          const t = r.replace(/\s+/g, ' ').trim();
          if (keep(null, t)) push(t);
        });
      }

      return coalesceArticleParagraphs(lines.join('\n\n'));
    } catch {
      return '';
    }
  };

  const resetArticleState = () => {
    setIngestionResult(null);
    setSelectedParagraphs({});
    setDismissedAiFields({});
    setActiveAiPopoverField(null);
    setIsMetaCardCollapsed(false);
    // Đang sửa bài đã lưu: giữ thông tin bài, chỉ bỏ kết quả tách đoạn
    if (editUrl) return;
    setIngestTitle('');
    setIngestOrg('');
    setIngestAuthor('');
    setIngestPublishedDate('');
    setIngestUpdatedDate('');
    setIngestDate('');
    setIngestSourceScope('Việt Nam');
    if (classFromAi) {
      setIngestClass('');
      setSelectedPlant('');
      setClassFromAi(false);
    }
  };

  const handlePasteArticleText = (e: React.ClipboardEvent<HTMLElement>) => {
    const htmlData = e.clipboardData?.getData('text/html') || '';
    const plainData = e.clipboardData?.getData('text/plain') || '';
    const textareaTarget = e.currentTarget instanceof HTMLTextAreaElement ? e.currentTarget : null;
    const isFullReplace =
      !ingestText.trim() ||
      !textareaTarget ||
      (textareaTarget.selectionEnd - textareaTarget.selectionStart >= ingestText.length * 0.8);

    if (!isFullReplace) {
      resetArticleState();
      return;
    }

    resetArticleState();
    const hasHtmlStructure = /<(?:h[1-6]|p|li|ul|ol|table|article|section|strong|b|br)\b/i.test(htmlData);
    if (htmlData && hasHtmlStructure) {
      const cleaned = cleanArticleTextFromHtml(htmlData);
      if (cleaned && cleaned.length >= 60) {
        e.preventDefault();
        setIngestText(cleaned.slice(0, 50000));
        setArticleEditorMode('preview');
        toast.success('Đã tự động chuẩn hóa bài báo sang định dạng Markdown sạch!');
        return;
      }
    }

    if (plainData && plainData.trim().length >= 80) {
      e.preventDefault();
      const formattedPlain = coalesceArticleParagraphs(plainData.trim());
      setIngestText((formattedPlain || plainData.trim()).slice(0, 50000));
      setArticleEditorMode('preview');
      toast.success('Đã dán và tự động căn chỉnh đoạn bài báo!');
    }
  };

  const handleCrawlArticleFromUrl = async () => {
    const targetUrl = (editUrl || ingestUrl).trim();
    if (!targetUrl) {
      toast.error('Vui lòng nhập đường dẫn URL bài viết ở mục 1 trước khi bấm Crawl!');
      return;
    }
    if (!isSafeHttpUrl(targetUrl)) {
      toast.error('Đường dẫn bài viết phải là URL hợp lệ (http:// hoặc https://)');
      return;
    }

    try {
      setCrawlingUrl(true);
      resetArticleState();

      let html = '';
      let lastError: unknown = null;
      let coreRejected = false;

      // Tầng 1: Gọi Core API /knowledge/fetch-url (có kiểm tra chống SSRF)
      try {
        const res = await apiClient.post<{ url: string; html: string }>(
          '/knowledge/fetch-url',
          { url: targetUrl },
          { timeout: 15000 }
        );
        if (res.data?.html) {
          html = res.data.html;
        }
      } catch (err) {
        lastError = err;
        const status = (err as { response?: { status?: number } })?.response?.status;
        // Nếu Core API chủ động từ chối (400/401/403/422), không bỏ qua kiểm tra của Core
        if (status && [400, 401, 403, 422].includes(status)) {
          coreRejected = true;
        }
      }

      // Tầng 2: Chỉ fallback sang Vite Dev Middleware khi đang chạy dev và Core chưa sẵn sàng (404/lỗi mạng)
      if (!html && import.meta.env.DEV && !coreRejected) {
        try {
          const devRes = await fetch(`/__dev/fetch-url?url=${encodeURIComponent(targetUrl)}`, {
            signal: AbortSignal.timeout(15000),
          });
          const ct = devRes.headers.get('content-type') || '';
          if (devRes.ok && ct.includes('application/json')) {
            const devData = (await devRes.json()) as { html?: string };
            if (devData?.html) {
              html = devData.html;
            }
          } else if (!devRes.ok && ct.includes('application/json')) {
            const errBody = (await devRes.json()) as { detail?: string };
            if (errBody?.detail) {
              lastError = new Error(errBody.detail);
            }
          }
        } catch (err) {
          lastError = err;
        }
      }

      if (!html) {
        toast.error(
          lastError
            ? `Không crawl được từ URL (${getErrorMessage(lastError)}). Vui lòng mở trang gốc và nhấn Ctrl+A, Ctrl+C để copy thủ công.`
            : 'Trang web không cho phép tải tự động. Vui lòng mở trang gốc và nhấn Ctrl+A, Ctrl+C để copy thủ công.'
        );
        return;
      }

      let cleaned = cleanArticleTextFromHtml(html);
      if (!cleaned || cleaned.length < 80) {
        const fallbackDoc = new DOMParser().parseFromString(html, 'text/html');
        cleaned = (fallbackDoc.body?.textContent || '').replace(/[ \t]+/g, ' ').trim();
      }

      if (!cleaned || cleaned.length < 40) {
        toast.error('Không trích xuất được văn bản từ trang web này (trang có thể render bằng JS). Vui lòng mở trang gốc và nhấn Ctrl+A, Ctrl+C để copy thủ công.');
        return;
      }

      setIngestText(cleaned.slice(0, 50000));
      setArticleEditorMode('preview');
      if (!editUrl) {
        setIngestSourceScope(inferSourceScope(targetUrl, '', null));
      }
      toast.success('Đã crawl và chuẩn hóa định dạng Markdown từ URL! Hãy kiểm tra bản xem trước bên dưới.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCrawlingUrl(false);
    }
  };

  // ==================== SỬA BÀI ĐÃ LƯU ====================
  const loadArticleForEdit = async (url: string, keepForm = false) => {
    if (!isSafeHttpUrl(url)) {
      toast.error('Đường dẫn bài viết không hợp lệ (chỉ hỗ trợ http:// hoặc https://).');
      setEditUrl(null);
      setEditRows([]);
      return;
    }

    try {
      setEditLoading(true);
      const res = await apiClient.get<{ source_url: string; sources: KnowledgeSourceItem[] }>(
        '/knowledge/sources/by-url',
        { params: { url } }
      );
      const rows = res.data.sources || [];
      setEditRows(rows);
      setSummaryDrafts(Object.fromEntries(rows.filter((r) => !r.isVerbatim).map((r) => [r.id, r.evidenceText])));
      const canonicalUrl = isSafeHttpUrl(res.data.source_url) ? res.data.source_url.trim() : url.trim();
      setEditUrl(canonicalUrl);
      const first = rows[0];
      if (first) {
        const rawOrg = first.organization || '';
        const { org: parsedOrg, author: parsedAuthor } = parseCombinedOrg(rawOrg);

        const rawDate = first.publishedDate && first.publishedDate !== 'Không ghi ngày' ? first.publishedDate : '';
        const { pubDate: parsedPubDate, upDate: parsedUpDate } = parseCombinedDate(rawDate);
        const detectedScope = inferSourceScope(canonicalUrl, first.organization, first.sourceScope);

        setEditOriginalMeta({
          plantName: first.plantName || '',
          diseaseName: first.diseaseName || '',
          modelClass: first.modelClass,
          title: first.sourceTitle,
          org: parsedOrg,
          author: parsedAuthor,
          pubDate: parsedPubDate,
          upDate: parsedUpDate,
          date: rawDate,
          sourceScope: detectedScope,
        });

        const distinctClasses = Array.from(new Set(rows.map((r) => r.modelClass).filter(Boolean)));
        setArticleTopics(distinctClasses.length > 0 ? distinctClasses : [first.modelClass]);

        if (!keepForm) {
          setIngestUrl(canonicalUrl);
          setIngestClass(first.modelClass);
          setSelectedPlant(first.plantName);
          setClassFromAi(false);
          setIngestTitle(first.sourceTitle);
          setIngestOrg(parsedOrg);
          setIngestAuthor(parsedAuthor);
          setIngestPublishedDate(parsedPubDate);
          setIngestUpdatedDate(parsedUpDate);
          setIngestDate(rawDate);
          setIngestSourceScope(detectedScope);
          setIngestText('');
          setIngestionResult(null);
          setSelectedParagraphs({});
          setEditSubTab('approved');
        }
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
      setEditUrl(null);
      setEditRows([]);
    } finally {
      setEditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'ingestion') return;
    if (editParam) {
      loadArticleForEdit(editParam);
    } else if (editUrl) {
      exitEditMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editParam, activeTab]);

  const exitEditMode = (clearParam = true) => {
    setEditUrl(null);
    setEditRows([]);
    setSummaryDrafts({});
    setIngestUrl('');
    setIngestText('');
    setIngestTitle('');
    setIngestOrg('');
    setIngestAuthor('');
    setIngestPublishedDate('');
    setIngestUpdatedDate('');
    setIngestDate('');
    setIngestSourceScope('Việt Nam');
    setIngestClass('');
    setSelectedPlant('');
    setIngestionResult(null);
    setSelectedParagraphs({});
    setEditSubTab('approved');
    setShowMetaEditPanel(false);
    if (clearParam) navigate('/admin/ingest', { replace: true });
  };

  const editMetaDirty = !!editUrl && (
    ingestClass !== editOriginalMeta.modelClass ||
    ingestTitle.trim() !== editOriginalMeta.title ||
    ingestOrg.trim() !== editOriginalMeta.org ||
    ingestAuthor.trim() !== editOriginalMeta.author ||
    ingestPublishedDate.trim() !== editOriginalMeta.pubDate ||
    ingestUpdatedDate.trim() !== editOriginalMeta.upDate ||
    ingestSourceScope !== editOriginalMeta.sourceScope
  );

  const saveEditedArticleMeta = async (silent = false): Promise<boolean> => {
    if (!editUrl) return true;
    if (articleTopics.length === 0 && !ingestClass) {
      toast.error('Chọn ít nhất một Chuyên mục / Bệnh hại cho bài viết trước khi lưu.');
      return false;
    }
    try {
      setEditSaving(true);
      const combinedOrg = buildCombinedOrg(ingestOrg, ingestAuthor);
      const combinedDate = buildCombinedDate(ingestPublishedDate, ingestUpdatedDate);
      const res = await apiClient.patch('/knowledge/sources/by-url', {
        source_url: editUrl,
        // Nếu bài viết có nhiều chuyên đề, không truyền model_class để giữ nguyên mã lớp riêng biệt của từng đoạn
        model_class: articleTopics.length === 1 ? articleTopics[0] : undefined,
        source_title: ingestTitle.trim(),
        organization: combinedOrg,
        published_date: combinedDate,
        source_scope: ingestSourceScope,
      });
      if (!silent) {
        toast.success(`Đã lưu thông tin bài cho ${res.data.updated_count} đoạn. Các đoạn này chuyển về "Chờ duyệt", vào Duyệt tri thức để duyệt lại.`);
      }
      await loadArticleForEdit(editUrl, true);
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    } finally {
      setEditSaving(false);
    }
  };

  // Duyệt hoặc bỏ duyệt trực tiếp từng đoạn trích
  const handleToggleApproveSingleSource = async (sourceId: string, currentStatus: boolean) => {
    try {
      const nextStatus = !currentStatus;
      await apiClient.patch(`/knowledge/sources/${sourceId}/approve`, {
        is_approved: nextStatus,
        reviewer_notes: nextStatus ? 'Admin phê duyệt qua màn hình chi tiết bài viết' : 'Admin bỏ duyệt',
      });
      toast.success(nextStatus ? 'Đã duyệt đoạn trích này.' : 'Đã bỏ duyệt đoạn trích này.');
      setEditRows((prev) => prev.map((r) => (r.id === sourceId ? { ...r, isManualApproved: nextStatus } : r)));
      setSources((prev) => prev.map((r) => (r.id === sourceId ? { ...r, isManualApproved: nextStatus } : r)));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Xóa trực tiếp 1 đoạn trích trong bài đã lưu
  const handleDeleteSingleSource = async (sourceId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa đoạn trích này khỏi bài viết?')) return;
    try {
      await apiClient.delete(`/knowledge/sources/${sourceId}`);
      toast.success('Đã xóa đoạn trích.');
      setEditRows((prev) => prev.filter((r) => r.id !== sourceId));
      setSources((prev) => prev.filter((r) => r.id !== sourceId));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const updateSavedUnit = async (row: KnowledgeSourceItem, body: { unit_type?: string; evidence_text?: string; model_class?: string }) => {
    try {
      setEditSaving(true);
      const res = await apiClient.patch(`/knowledge/sources/${row.id}`, body);
      if (res.data.reindex_status !== 'skipped') {
        toast.success('Đã lưu thay đổi cho đoạn trích.');
      }
      if (editUrl) await loadArticleForEdit(editUrl, true);
      setShowMetaEditPanel(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setEditSaving(false);
    }
  };

  const collapseWs = (t: string) => t.replace(/\s+/g, ' ').trim();
  const savedVerbatimTexts = React.useMemo(
    () => new Set(editRows.filter((r) => r.isVerbatim).map((r) => collapseWs(r.evidenceText))),
    [editRows]
  );
  const existingVerbatimCount = editRows.filter((r) => r.isVerbatim).length;
  const existingVerbatimChars = editRows.filter((r) => r.isVerbatim).reduce((a, r) => a + r.evidenceText.length, 0);

  const handleParseArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestUrl.trim()) {
      toast.error('Vui lòng nhập đường dẫn URL bài báo.');
      return;
    }
    if (!ingestText.trim()) {
      toast.error('Vui lòng dán nội dung văn bản bài báo.');
      return;
    }

    try {
      setIngesting(true);
      const normalizedArticleText = coalesceArticleParagraphs(ingestText.trim());
      const res = await apiClient.post<IngestionResponse>('/knowledge/ingestions', {
        model_class: ingestClass || undefined,
        source_url: ingestUrl.trim(),
        // Tiêu đề/cơ quan/năm luôn để AI đọc lại từ bài đang dán; Admin sửa ở bước 2
        article_text: normalizedArticleText || ingestText.trim(),
      }, { timeout: 45000 });

      // Kết hợp bóc tách theo Key từ văn bản (Publication date, Reviewed/Revised, Authors, Cơ quan...) với gợi ý từ AI
      const keyMeta = extractKeyMetadataFromText(ingestText, editUrl || ingestUrl);
      const rawMeta = res.data.suggested_metadata;
      const aiOrg = parseCombinedOrg(rawMeta?.organization);
      const aiDate = parseCombinedDate(rawMeta?.published_date);

      const resolvedTitle = rawMeta?.source_title?.trim() || '';
      const resolvedOrg = keyMeta.organization || aiOrg.org;
      const resolvedAuthor = keyMeta.author || aiOrg.author;
      const resolvedPubDate = keyMeta.publishedDate || aiDate.pubDate;
      const resolvedUpDate = keyMeta.updatedDate || aiDate.upDate;

      const combinedSuggestedOrg = buildCombinedOrg(resolvedOrg, resolvedAuthor);
      const combinedSuggestedDate = buildCombinedDate(resolvedPubDate, resolvedUpDate);
      const aiSuggestedClass = rawMeta?.model_class || null;

      const mergedMeta: SuggestedMetadata | null =
        rawMeta || resolvedOrg || resolvedAuthor || resolvedPubDate || resolvedUpDate
          ? {
              model_class: aiSuggestedClass,
              source_title: resolvedTitle || null,
              organization: combinedSuggestedOrg || null,
              published_date: combinedSuggestedDate || null,
            }
          : null;

      // Ẩn dòng siêu dữ liệu đơn (< 40 ký tự, Cơ quan:, Ngày đăng:) và dòng tiêu đề mở đầu (# Title) khỏi danh sách thẻ trích dẫn
      const filteredParagraphs = res.data.paragraphs.filter((p, idx) => {
        const trimmed = p.text.trim();
        if (trimmed.length < 40) return false;
        if (isStandaloneMetadataLine(trimmed)) return false;
        if (/^#\s+\S/.test(trimmed) && !trimmed.includes('\n')) return false;
        if (idx === 0 && p.suggested_unit_type === null && trimmed.length < 120 && !/[.!?;]$/.test(trimmed)) {
          return false;
        }
        return true;
      });
      const finalParagraphs = filteredParagraphs.length > 0 ? filteredParagraphs : res.data.paragraphs;

      setIngestionResult({
        ...res.data,
        paragraphs: finalParagraphs,
        suggested_metadata: mergedMeta,
      });
      setDismissedAiFields({});
      setActiveAiPopoverField(null);
      setIsMetaCardCollapsed(false);

      if (aiSuggestedClass) {
        setArticleTopics((prev) => (prev.includes(aiSuggestedClass) ? prev : [...prev, aiSuggestedClass]));
      }

      // Đang sửa bài đã lưu thì giữ thông tin đã lưu (hiển thị diff cho Admin duyệt),
      // đồng thời tự điền nếu ô Tác giả hoặc Ngày cập nhật hiện đang để trống.
      if (editUrl) {
        setDismissMetaDiff(false);
        if (!ingestAuthor.trim() && resolvedAuthor) {
          setIngestAuthor(resolvedAuthor);
        }
        if (!ingestUpdatedDate.trim() && resolvedUpDate) {
          setIngestUpdatedDate(resolvedUpDate);
        }
      } else if (!mergedMeta) {
        setIngestTitle('');
        setIngestOrg('');
        setIngestAuthor('');
        setIngestPublishedDate('');
        setIngestUpdatedDate('');
        setIngestDate('');
        setIngestSourceScope(inferSourceScope(ingestUrl, '', null));
      } else {
        setIngestTitle(resolvedTitle);
        setIngestOrg(resolvedOrg);
        setIngestAuthor(resolvedAuthor);
        setIngestPublishedDate(resolvedPubDate);
        setIngestUpdatedDate(resolvedUpDate);
        setIngestSourceScope(inferSourceScope(ingestUrl, resolvedOrg, null));
        if (aiSuggestedClass) {
          if (aiSuggestedClass !== ingestClass) setClassFromAi(true);
          setIngestClass(aiSuggestedClass);
          const found = diseases.find((d) => d.classCode === aiSuggestedClass);
          if (found) {
            setSelectedPlant(found.plantName);
          }
        }
      }

      // Khởi tạo state chọn đoạn: MẶC ĐỊNH KHÔNG TICK ĐOẠN NÀO ĐỂ ADMIN ĐỌC VÀ CHỦ ĐỘNG DUYỆT (Mục 10)
      const defaultClassForNewParas = aiSuggestedClass || (articleTopics[0] || ingestClass);
      const initialMap: Record<string, { selected: boolean; unitType: string; diseaseClass?: string }> = {};

      finalParagraphs.forEach((p) => {
        initialMap[p.id] = {
          selected: false,
          unitType: p.suggested_unit_type || 'SYMPTOMS',
          diseaseClass: defaultClassForNewParas,
        };
      });

      setSelectedParagraphs(initialMap);
      toast.success(
        res.data.ai_suggestion_available
          ? `Tách thành công ${finalParagraphs.length} đoạn. AI đã gợi ý nhãn và thông tin bài.`
          : `Tách thành công ${finalParagraphs.length} đoạn, nhưng AI đang quá tải nên chưa gợi ý nhãn. Bạn tự chọn đoạn và nhãn, hoặc bấm Tách đoạn lại sau ít phút.`
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIngesting(false);
    }
  };

  // ==================== TÁCH ĐOẠN & QUẢN LÝ MENTIONS (HITL INGESTION) ====================
  const autoSplitText = (fullText: string): { part1: string; part2: string } => {
    const text = fullText.trim();
    const mid = Math.floor(text.length / 2);

    // 1. Tìm các điểm kết thúc câu gần điểm giữa nhất (. \n ? !)
    const sentenceRegex = /([.?!]\s+|\r?\n\s*)/g;
    let match: RegExpExecArray | null;
    let bestIndex = -1;
    let minDiff = Infinity;

    while ((match = sentenceRegex.exec(text)) !== null) {
      const cut = match.index + match[1].length;
      const len1 = cut;
      const len2 = text.length - cut;
      if (len1 >= 30 && len2 >= 30 && len1 <= 1500 && len2 <= 1500) {
        const diff = Math.abs(cut - mid);
        if (diff < minDiff) {
          minDiff = diff;
          bestIndex = cut;
        }
      }
    }

    // 2. Nếu không tìm được dấu ngắt câu thỏa mãn, tìm dấu phẩy, chấm phẩy hoặc khoảng trắng
    if (bestIndex === -1) {
      const clauseRegex = /([,;]\s+|\s+)/g;
      while ((match = clauseRegex.exec(text)) !== null) {
        const cut = match.index + match[1].length;
        const len1 = cut;
        const len2 = text.length - cut;
        if (len1 >= 30 && len2 >= 30 && len1 <= 1500 && len2 <= 1500) {
          const diff = Math.abs(cut - mid);
          if (diff < minDiff) {
            minDiff = diff;
            bestIndex = cut;
          }
        }
      }
    }

    if (bestIndex !== -1) {
      return {
        part1: text.substring(0, bestIndex).trim(),
        part2: text.substring(bestIndex).trim(),
      };
    }

    // 3. Fallback: ngắt tại điểm an toàn <= 1500
    const safeCut = Math.min(Math.max(mid, 30), 1500);
    return {
      part1: text.substring(0, safeCut).trim(),
      part2: text.substring(safeCut).trim(),
    };
  };

  const computeSplitParts = (text: string, cutIndices: number[]): string[] => {
    const regex = /[^.!?;\r\n]+(?:[.!?;\r\n]+|$)/g;
    const rawMatches = text.match(regex);
    const rawSents = rawMatches ? rawMatches.filter((s) => s.trim().length > 0) : [text];
    if (rawSents.length <= 1 || cutIndices.length === 0) {
      return [text];
    }
    const sortedCuts = [...new Set(cutIndices)]
      .filter((idx) => idx >= 0 && idx < rawSents.length - 1)
      .sort((a, b) => a - b);
    if (sortedCuts.length === 0) return [text];

    const parts: string[] = [];
    let currentPartSents: string[] = [];

    for (let i = 0; i < rawSents.length; i++) {
      currentPartSents.push(rawSents[i]);
      if (sortedCuts.includes(i) || i === rawSents.length - 1) {
        parts.push(currentPartSents.join('').trim());
        currentPartSents = [];
      }
    }
    return parts.filter(Boolean);
  };

  const handleOpenSplitModal = (para: ParagraphItem) => {
    setSplitTargetPara(para);
    const { part1, part2 } = autoSplitText(para.text);
    setSplitPart1(part1);
    setSplitPart2(part2);

    const regex = /[^.!?;\r\n]+(?:[.!?;\r\n]+|$)/g;
    const matches = para.text.match(regex);
    const sents = matches ? matches.map((s) => s.trim()).filter(Boolean) : [para.text];

    let bestIdx = 0;
    let accumulated = '';
    for (let i = 0; i < sents.length - 1; i++) {
      accumulated = (accumulated ? accumulated + ' ' : '') + sents[i];
      if (accumulated.trim().length <= part1.length) {
        bestIdx = i;
      }
    }
    setSelectedCutIndex(bestIdx);
    setSelectedCutIndices(sents.length > 1 ? [bestIdx] : []);
    setSplitModalOpen(true);
  };

  const handleConfirmSplit = () => {
    if (!splitTargetPara || !ingestionResult) return;
    const parts = computeSplitParts(splitTargetPara.text, selectedCutIndices);
    if (parts.length < 2) {
      toast.error('Vui lòng chọn ít nhất 1 mốc ngắt câu để chia đoạn.');
      return;
    }

    const hasInvalid = parts.some((p) => p.length < 30 || p.length > 1500);
    if (hasInvalid) {
      toast.error('Mỗi đoạn con sau khi chia phải có từ 30 đến 1.500 ký tự.');
      return;
    }

    const baseId = splitTargetPara.id;
    const newParas: ParagraphItem[] = parts.map((partText, idx) => {
      const partMentions = (splitTargetPara.mentions || []).filter((m) =>
        partText.toLowerCase().includes(m.text.toLowerCase())
      );
      return {
        id: `${baseId}_${idx + 1}`,
        text: partText,
        suggested_unit_type: splitTargetPara.suggested_unit_type,
        mentions: partMentions,
      };
    });

    const updatedParagraphs = ingestionResult.paragraphs.flatMap((p) =>
      p.id === baseId ? newParas : [p]
    );

    setIngestionResult({
      ...ingestionResult,
      paragraphs: updatedParagraphs,
    });

    setSelectedParagraphs((prev) => {
      const next = { ...prev };
      const currentClass = prev[baseId]?.diseaseClass || ingestClass;
      delete next[baseId];
      newParas.forEach((np) => {
        next[np.id] = {
          selected: false,
          unitType: splitTargetPara.suggested_unit_type || 'SYMPTOMS',
          diseaseClass: currentClass,
        };
      });
      return next;
    });

    setSplitModalOpen(false);
    setSplitTargetPara(null);
    setSelectedCutIndices([]);
    toast.success(`Đã chia đoạn ${baseId} thành ${newParas.length} đoạn hợp lệ (mỗi đoạn ≤ 1.500 ký tự).`);
  };

  const handleSelectAllAiSuggested = () => {
    if (!ingestionResult) return;

    let availableSlots = 20 - existingVerbatimCount;
    if (availableSlots <= 0) {
      toast.error(`Bài viết đã có ${existingVerbatimCount} đoạn lưu trữ, đã đạt giới hạn tối đa 20 đoạn.`);
      return;
    }

    let newlySelectedCount = 0;
    setSelectedParagraphs((prev) => {
      const next = { ...prev };
      for (const para of ingestionResult.paragraphs) {
        const isSaved = savedVerbatimTexts.has(collapseWs(para.text));
        const isTooLong = para.text.length > 1500;
        const isAiSuggested = !!para.suggested_unit_type;

        if (isAiSuggested && !isSaved && !isTooLong) {
          if (!next[para.id]?.selected) {
            if (newlySelectedCount < availableSlots) {
              next[para.id] = {
                ...(next[para.id] || {}),
                selected: true,
                unitType: para.suggested_unit_type || 'SYMPTOMS',
                diseaseClass: next[para.id]?.diseaseClass || ingestClass,
              };
              newlySelectedCount++;
            }
          }
        }
      }
      return next;
    });

    if (newlySelectedCount > 0) {
      toast.success(`Đã tự động tick chọn ${newlySelectedCount} đoạn theo gợi ý của AI.`);
    } else {
      toast.info('Không có thêm đoạn AI gợi ý hợp lệ nào để chọn.');
    }
  };

  const handleRemoveMention = (paraId: string, mentionIndex: number) => {
    if (!ingestionResult) return;
    setIngestionResult({
      ...ingestionResult,
      paragraphs: ingestionResult.paragraphs.map((p) => {
        if (p.id !== paraId) return p;
        const updatedMentions = (p.mentions || []).filter((_, idx) => idx !== mentionIndex);
        return { ...p, mentions: updatedMentions };
      }),
    });
  };

  const handleChangeMentionKind = (paraId: string, mentionIndex: number, newKind: string) => {
    if (!ingestionResult) return;
    setIngestionResult({
      ...ingestionResult,
      paragraphs: ingestionResult.paragraphs.map((p) => {
        if (p.id !== paraId) return p;
        const updatedMentions = (p.mentions || []).map((m, idx) =>
          idx === mentionIndex ? { ...m, kind: newKind } : m
        );
        return { ...p, mentions: updatedMentions };
      }),
    });
  };

  const handleAddMention = (paraId: string) => {
    if (!ingestionResult) return;
    const target = ingestionResult.paragraphs.find((p) => p.id === paraId);
    if (!target) return;

    const textToAdd = newMentionText.trim();
    if (textToAdd.length < 2) {
      toast.error('Cụm từ vật tư / hoạt chất phải có ít nhất 2 ký tự.');
      return;
    }
    if (!target.text.toLowerCase().includes(textToAdd.toLowerCase())) {
      toast.error('Cụm từ phải xuất hiện nguyên văn trong đoạn văn này (quy định Điều 25 Luật SHTT).');
      return;
    }

    if ((target.mentions || []).some((m) => m.text.toLowerCase() === textToAdd.toLowerCase())) {
      toast.error('Cụm từ này đã có trong danh sách thẻ.');
      return;
    }

    setIngestionResult({
      ...ingestionResult,
      paragraphs: ingestionResult.paragraphs.map((p) => {
        if (p.id !== paraId) return p;
        return {
          ...p,
          mentions: [...(p.mentions || []), { text: textToAdd, kind: newMentionKind }],
        };
      }),
    });

    setAddingMentionParaId(null);
    setNewMentionText('');
    setNewMentionKind('CHEMICAL');
    toast.success(`Đã thêm thẻ "${textToAdd}".`);
  };

  const handleCommitParagraphs = async () => {
    if (!ingestionResult) return;

    if (!ingestClass) {
      toast.error('Vui lòng chọn Cây trồng - Bệnh hại trước khi duyệt.');
      return;
    }

    const selections = Object.entries(selectedParagraphs)
      .filter(([_, val]) => val.selected)
      .map(([id, val]) => {
        const p = ingestionResult.paragraphs.find((x) => x.id === id);
        return {
          paragraph_id: id,
          unit_type: val.unitType,
          custom_text: p?.text,
          mentions: p?.mentions || [],
          model_class: val.diseaseClass || ingestClass,
        };
      });

    if (selections.length === 0) {
      toast.error('Vui lòng tick chọn ít nhất 1 đoạn nguyên văn để phê duyệt.');
      return;
    }

    if (selections.length + existingVerbatimCount > 20) {
      toast.error(existingVerbatimCount > 0
        ? `Bài này đã lưu ${existingVerbatimCount} đoạn nguyên văn; mỗi bài tối đa 20 đoạn (mở rộng phục vụ đồ án).`
        : 'Mỗi bài viết được trích dẫn tối đa 20 đoạn nguyên văn (mở rộng phục vụ đồ án).');
      return;
    }

    const currentSelectedChars = Object.entries(selectedParagraphs)
      .filter(([_, v]) => v.selected)
      .reduce((acc, [id]) => {
        const p = ingestionResult.paragraphs.find((x) => x.id === id);
        return acc + (p?.text.length || 0);
      }, 0);

    const articleLen = ingestionResult.article_length || ingestText.length || 1;
    const allowedQuota = Math.max(2500, Math.floor(articleLen * 0.60));

    if (currentSelectedChars + existingVerbatimChars > allowedQuota) {
      toast.error(`Tổng số ký tự các đoạn đã chọn (${currentSelectedChars.toLocaleString('vi-VN')}) vượt quá giới hạn trích dẫn hợp lý (${allowedQuota.toLocaleString('vi-VN')} ký tự, tối đa 60% bài theo cấu hình mở rộng đồ án).`);
      return;
    }

    // Đang sửa bài: lưu thông tin bài trước để đoạn cũ và đoạn mới cùng tiêu đề/bệnh
    if (editMetaDirty && !(await saveEditedArticleMeta(true))) return;

    try {
      setCommitting(true);
      const combinedOrg = buildCombinedOrg(ingestOrg, ingestAuthor) || 'Trung tâm Khuyến nông';
      const combinedDate = buildCombinedDate(ingestPublishedDate, ingestUpdatedDate) || 'Không ghi ngày';

      const res = await apiClient.post(`/knowledge/ingestions/${ingestionResult.ingestion_id}/commit`, {
        model_class: ingestClass,
        source_title: ingestTitle.trim() || 'Bài báo khuyến nông',
        organization: combinedOrg,
        published_date: combinedDate,
        source_scope: ingestSourceScope,
        selections,
        reviewer_notes: commitNotes.trim(),
      });

      const syncStatusText = res.data.reindex_status === 'accepted'
        ? 'Đang đồng bộ vào bộ nhớ AI Lavi'
        : (res.data.reindex_status === 'failed' ? 'Lỗi kết nối đồng bộ' : res.data.reindex_status);
      toast.success(
        `Đã lưu và duyệt ${res.data.created_source_ids?.length || selections.length} đoạn nguyên văn vào CSDL (${syncStatusText}).`
      );

      if (editUrl) {
        // Ở lại chế độ sửa, nạp lại danh sách đoạn đã lưu và chuyển sang Tab 1
        setIngestionResult(null);
        setSelectedParagraphs({});
        setIngestText('');
        setEditSubTab('approved');
        await loadArticleForEdit(editUrl, true);
        return;
      }

      // Reset form
      resetArticleState();
      setIngestText('');
      setIngestUrl('');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCommitting(false);
    }
  };

  const countSelected = Object.values(selectedParagraphs).filter((v) => v.selected).length;
  const totalSelectedChars = Object.entries(selectedParagraphs)
    .filter(([_, v]) => v.selected)
    .reduce((acc, [id]) => {
      const p = ingestionResult?.paragraphs.find((x) => x.id === id);
      return acc + (p?.text.length || 0);
    }, 0);
  const articleLength = ingestionResult?.article_length || ingestText.length || 1;
  const allowedCharsQuota = Math.max(2500, Math.floor(articleLength * 0.60));
  // Hạn mức 20 đoạn / 60% tính cộng dồn với các đoạn nguyên văn đã lưu của cùng URL (Core cũng kiểm tra)
  const countWithSaved = countSelected + existingVerbatimCount;
  const charsWithSaved = totalSelectedChars + existingVerbatimChars;

  // Highlight cụm từ trích xuất (mention tag) & định dạng bold Markdown inline (**...**)
  const applyMentionHighlight = (plainText: string, paraId: string | null) => {
    if (!paraId || !highlightedMention || highlightedMention.paraId !== paraId || !highlightedMention.text.trim()) {
      return plainText;
    }
    const term = highlightedMention.text.trim();
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = plainText.split(regex);
    if (parts.length === 1) return plainText;

    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === term.toLowerCase() ? (
            <mark
              key={i}
              className="bg-amber-300 text-stone-900 font-bold px-1 py-0.5 rounded shadow-xs"
              title={`Cụm từ trích xuất: "${term}"`}
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const renderInlineMarkdownWithHighlight = (line: string, paraId: string | null) => {
    const boldSegments = line.split(/(\*\*[^*\n]+\*\*)/g);
    return (
      <>
        {boldSegments.map((seg, idx) => {
          if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
            return (
              <strong key={idx} className="font-semibold text-foreground not-italic">
                {applyMentionHighlight(seg.slice(2, -2), paraId)}
              </strong>
            );
          }
          return <React.Fragment key={idx}>{applyMentionHighlight(seg, paraId)}</React.Fragment>;
        })}
      </>
    );
  };

  // Hiển thị đoạn văn chuẩn cấu trúc (tiêu đề mục, gạch đầu dòng, chữ in đậm) và hỗ trợ highlight cụm từ
  const renderParagraphWithHighlight = (paraId: string, text: string) => {
    const lines = text.split(/\r?\n/);
    return (
      <>
        {lines.map((rawLine, idx) => {
          const trimmed = rawLine.trim();
          if (!trimmed) return null;

          const h1Match = trimmed.match(/^#\s+(.+)$/);
          if (h1Match) {
            return (
              <span key={idx} className="block font-bold not-italic text-emerald-950 text-[13px] mb-1">
                {renderInlineMarkdownWithHighlight(h1Match[1], paraId)}
              </span>
            );
          }

          const headingMatch = trimmed.match(/^#{2,6}\s+(.+)$/);
          if (headingMatch) {
            return (
              <span key={idx} className="block font-bold not-italic text-emerald-900 mb-1">
                {renderInlineMarkdownWithHighlight(headingMatch[1], paraId)}
              </span>
            );
          }

          const bulletMatch = trimmed.match(/^(?:[-•*+])\s+(.+)$/);
          if (bulletMatch) {
            return (
              <span key={idx} className="block pl-2 my-0.5">
                <span className="text-emerald-700 font-bold not-italic mr-1.5">•</span>
                {renderInlineMarkdownWithHighlight(bulletMatch[1], paraId)}
              </span>
            );
          }

          return (
            <span key={idx} className="block my-0.5">
              {renderInlineMarkdownWithHighlight(rawLine, paraId)}
            </span>
          );
        })}
      </>
    );
  };

  // Hiển thị toàn bộ bài báo ở chế độ Xem định dạng (Markdown Preview)
  const renderFormattedArticlePreview = (rawMarkdown: string) => {
    const blocks = rawMarkdown
      .split(/\r?\n\s*\r?\n/)
      .map((b) => b.trim())
      .filter(Boolean);

    return blocks.map((block, bIdx) => {
      const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const isSingleMetaBlock = lines.length === 1 && isStandaloneMetadataLine(lines[0]);
      if (isSingleMetaBlock) {
        return (
          <div
            key={bIdx}
            className="inline-flex items-center text-[11px] bg-muted/60 text-muted-foreground px-2 py-0.5 rounded border border-border/70 mr-1.5 mb-1 font-medium"
          >
            {lines[0].replace(/^(?:[#>*\-•+]+\s*)+/, '').replace(/\*\*/g, '')}
          </div>
        );
      }

      return (
        <div key={bIdx} className="space-y-1">
          {lines.map((line, lIdx) => {
            if (isStandaloneMetadataLine(line)) {
              return (
                <div
                  key={lIdx}
                  className="text-[11px] bg-muted/60 text-muted-foreground px-2 py-0.5 rounded border border-border/70 inline-block mr-1.5 font-medium"
                >
                  {line.replace(/^(?:[#>*\-•+]+\s*)+/, '').replace(/\*\*/g, '')}
                </div>
              );
            }

            const h1 = line.match(/^#\s+(.+)$/);
            if (h1) {
              return (
                <h4 key={lIdx} className="text-sm font-bold text-emerald-950 border-b border-emerald-100 pb-1.5">
                  {renderInlineMarkdownWithHighlight(h1[1], null)}
                </h4>
              );
            }

            const h2 = line.match(/^##\s+(.+)$/);
            if (h2) {
              return (
                <h5 key={lIdx} className="text-[13px] font-bold text-emerald-800 pt-1">
                  {renderInlineMarkdownWithHighlight(h2[1], null)}
                </h5>
              );
            }

            const h3 = line.match(/^#{3,6}\s+(.+)$/);
            if (h3) {
              return (
                <h6 key={lIdx} className="text-xs font-bold text-emerald-700 pt-0.5">
                  {renderInlineMarkdownWithHighlight(h3[1], null)}
                </h6>
              );
            }

            const bullet = line.match(/^(?:[-•*+])\s+(.+)$/);
            if (bullet) {
              return (
                <div key={lIdx} className="flex items-start gap-1.5 pl-2 text-xs text-foreground/90 leading-relaxed">
                  <span className="text-emerald-700 font-bold shrink-0">•</span>
                  <span className="flex-1">{renderInlineMarkdownWithHighlight(bullet[1], null)}</span>
                </div>
              );
            }

            return (
              <p key={lIdx} className="text-xs text-foreground/90 leading-relaxed">
                {renderInlineMarkdownWithHighlight(line, null)}
              </p>
            );
          })}
        </div>
      );
    });
  };

  // Trình soạn thảo & xem trước Markdown chuẩn dùng chung cho Nhập bài mới & Nạp thêm dữ liệu
  const renderArticleEditorSection = ({ isReparseTab = false }: { isReparseTab?: boolean } = {}) => {
    const hasText = ingestText.trim().length > 0;
    const showingPreview = articleEditorMode === 'preview' && hasText;

    return (
      <div>
        <div className="flex flex-wrap justify-between items-center gap-1.5 mb-1.5">
          <label className="font-semibold text-foreground">
            2. Dán toàn văn bài báo *
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            <div
              className="inline-flex rounded border border-border bg-muted/40 p-0.5"
              role="group"
              aria-label="Chế độ hiển thị nội dung bài báo"
            >
              <button
                type="button"
                onClick={() => setArticleEditorMode('preview')}
                disabled={!hasText}
                className={`h-5 px-2 text-[11px] font-semibold rounded inline-flex items-center gap-1 transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
                  showingPreview
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title={hasText ? 'Xem trước bài báo đã chuẩn hóa định dạng' : 'Cần dán hoặc crawl nội dung trước khi xem định dạng'}
              >
                <Eye className="w-3 h-3" />
                <span>Xem định dạng</span>
              </button>
              <button
                type="button"
                onClick={() => setArticleEditorMode('code')}
                className={`h-5 px-2 text-[11px] font-semibold rounded inline-flex items-center gap-1 transition-colors ${
                  !showingPreview
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Hiển thị và chỉnh sửa trực tiếp mã Markdown thô"
              >
                <Code2 className="w-3 h-3" />
                <span>Code Markdown</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleCrawlArticleFromUrl}
              disabled={crawlingUrl || !(editUrl || ingestUrl).trim()}
              className="h-6 px-2 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Tải nhanh nội dung từ URL ở mục 1 (nếu trang chặn bot thì copy tay)"
            >
              {crawlingUrl ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Đang crawl...</span>
                </>
              ) : (
                <>
                  <Globe className="w-3 h-3" />
                  <span>Crawl từ URL</span>
                </>
              )}
            </button>

            <span className="text-[10px] text-muted-foreground">
              {ingestText.length.toLocaleString('vi-VN')} / 50.000 ký tự
            </span>
          </div>
        </div>

        <div className="p-2 mb-2 rounded bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-[11px] flex items-start gap-1.5">
          <Sparkles className="w-3.5 h-3.5 mt-0.5 text-emerald-700 shrink-0" />
          <span>
            <strong>{isReparseTab ? 'Mẹo copy bài gốc:' : 'Mẹo dán cả trang:'}</strong> Nhấn{' '}
            <kbd className="px-1 py-0.5 bg-white border border-emerald-300 rounded font-mono">Ctrl+A</kbd> rồi{' '}
            <kbd className="px-1 py-0.5 bg-white border border-emerald-300 rounded font-mono">Ctrl+C</kbd>{' '}
            {isReparseTab ? 'trên trang bài gốc rồi dán vào đây, hoặc bấm' : 'trên trang báo rồi dán vào ô dưới, hoặc bấm'}{' '}
            <strong>Crawl từ URL</strong>. Hệ thống tự lọc rác và chuyển sang <strong>Markdown sạch</strong> (mặc định mở Xem định dạng; bấm <strong>Code Markdown</strong> để sửa tay).
          </span>
        </div>

        {showingPreview ? (
          <div className="rounded-md border border-emerald-200 bg-background overflow-hidden shadow-2xs">
            <div className="px-3 py-1.5 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between gap-2 text-[11px]">
              <span className="text-emerald-800 font-medium inline-flex items-center gap-1">
                <Eye className="w-3 h-3" />
                <span>Bản xem trước định dạng (tiêu đề, chữ đậm, gạch đầu dòng)</span>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setArticleEditorMode('code')}
                  className="font-semibold text-emerald-700 hover:text-emerald-900 hover:underline inline-flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Sửa Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIngestText('');
                    setArticleEditorMode('code');
                    if (!isReparseTab && ingestionResult) resetArticleState();
                  }}
                  className="font-medium text-muted-foreground hover:text-destructive hover:underline"
                >
                  Xóa
                </button>
              </div>
            </div>
            <div
              tabIndex={0}
              onPaste={handlePasteArticleText}
              className="max-h-[340px] min-h-[220px] overflow-y-auto p-3.5 space-y-2.5 outline-none"
            >
              {renderFormattedArticlePreview(ingestText)}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Textarea
              rows={12}
              placeholder={
                isReparseTab
                  ? 'Dán văn bản bài báo vào đây để bóc tách đoạn mới hoặc tái trích xuất...'
                  : 'Dán toàn bộ nội dung bài báo vào đây. Hệ thống sẽ tự lọc thẻ rác HTML, chuẩn hóa Markdown, tách đoạn P1, P2... và gọi AI trích xuất thông tin.'
              }
              value={ingestText}
              onChange={(e) => {
                setIngestText(e.target.value);
                if (!isReparseTab && ingestionResult) resetArticleState();
              }}
              onPaste={handlePasteArticleText}
              required
              maxLength={50000}
              className="text-xs font-mono resize-y leading-relaxed"
            />
            {hasText && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-muted-foreground">
                <span>Cú pháp Markdown: <code className="bg-muted px-1 rounded">## Tiêu đề</code> • <code className="bg-muted px-1 rounded">### Mục con</code> • <code className="bg-muted px-1 rounded">- **Nhãn:** Nội dung</code></span>
                <button
                  type="button"
                  onClick={() => setArticleEditorMode('preview')}
                  className="text-emerald-700 hover:text-emerald-900 font-semibold hover:underline inline-flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  <span>Xem định dạng</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Quản lý danh sách các chuyên mục / bệnh hại trong bài viết (thay thế dropdown đơn)
  const renderArticleTopicsSelector = () => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="font-semibold text-foreground text-xs">
          Các chuyên mục / bệnh hại trong bài viết *
        </label>
        <span className="text-[11px] text-muted-foreground font-normal">
          {articleTopics.length} chuyên đề
        </span>
      </div>

      {/* Danh sách các tags/chips chuyên đề của bài */}
      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-muted/40 border border-border min-h-[36px]">
        {articleTopics.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">Chưa có chuyên mục nào. Hãy chọn bên dưới để thêm vào bài.</span>
        ) : (
          articleTopics.map((topicCode) => {
            const found = diseases.find((d) => d.classCode === topicCode);
            const isHealthy = isHealthyTopic(found?.commonNameVi || '', topicCode);
            const label = formatTopicLabel(found?.commonNameVi, topicCode);
            return (
              <span
                key={topicCode}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border shadow-2xs ${
                  isHealthy
                    ? 'bg-sky-50 text-sky-900 border-sky-300'
                    : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                }`}
              >
                <span>{label}</span>
                {articleTopics.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setArticleTopics((prev) => prev.filter((t) => t !== topicCode))}
                    className="opacity-60 hover:opacity-100 hover:text-destructive transition-opacity ml-0.5"
                    title="Bỏ chuyên đề này khỏi bài viết"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            );
          })
        )}
      </div>

      {/* Thanh chọn nhanh bệnh có sẵn của loài cây để thêm vào bài */}
      <div className="flex items-center gap-1.5">
        <select
          value={selectedTopicToAdd}
          onChange={(e) => setSelectedTopicToAdd(e.target.value)}
          className="flex-1 px-2.5 py-1.5 bg-background border border-border rounded text-xs font-medium"
        >
          <option value="">-- Chọn chuyên mục / bệnh hại có sẵn để thêm --</option>
          {filteredDiseasesByPlant
            .filter((d) => !articleTopics.includes(d.classCode))
            .map((d) => (
              <option key={d.classCode} value={d.classCode}>
                {formatTopicLabel(d.commonNameVi, d.classCode)}
              </option>
            ))}
        </select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!selectedTopicToAdd}
          onClick={() => {
            if (selectedTopicToAdd && !articleTopics.includes(selectedTopicToAdd)) {
              setArticleTopics((prev) => [...prev, selectedTopicToAdd]);
              setSelectedTopicToAdd('');
            }
          }}
          className="h-8 text-xs font-semibold gap-1 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-300 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm vào bài</span>
        </Button>
      </div>
    </div>
  );

  // Dropdown chọn nguồn bài báo (Việt Nam hay Nước ngoài), dùng chung ở 3 form thông tin bài
  const renderSourceScopeSelect = () => (
    <div>
      <label className="font-semibold text-foreground block mb-1">
        Nguồn bài báo *
      </label>
      <select
        aria-label="Nguồn bài báo"
        value={ingestSourceScope}
        onChange={(e) => setIngestSourceScope(e.target.value as 'Việt Nam' | 'Quốc tế')}
        className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs font-medium"
      >
        <option value="Việt Nam">🇻🇳 Bài báo Việt Nam (Trong nước)</option>
        <option value="Quốc tế">🌐 Bài báo Nước ngoài (Quốc tế)</option>
      </select>
    </div>
  );

  // Badge hiển thị xuất xứ bài báo (Việt Nam / Nước ngoài), tái sử dụng ở chi tiết bài & bảng kiểm duyệt
  const renderOriginPill = (scope: 'Việt Nam' | 'Quốc tế', compact = false) => (
    <span
      className={`inline-flex items-center rounded font-semibold border ${
        compact ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-[11px]'
      } ${
        scope === 'Quốc tế'
          ? 'bg-purple-50 text-purple-800 border-purple-200'
          : 'bg-sky-50 text-sky-800 border-sky-200'
      }`}
    >
      {scope === 'Quốc tế'
        ? (compact ? '🌐 Nước ngoài' : '🌐 Bài báo Nước ngoài')
        : (compact ? '🇻🇳 Việt Nam' : '🇻🇳 Bài báo Việt Nam')}
    </span>
  );

  // Thanh tóm tắt 1 dòng khi thu gọn Card Thông tin bài viết & Phân loại (dùng chung Nhập bài mới & Nạp thêm)
  const renderMetaCollapsedSummary = () => (
    <div className="p-3 bg-muted/15 flex flex-wrap items-center justify-between gap-2 text-xs border-b border-border/40">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-muted-foreground text-[11px]">
        <span>
          <strong className="text-foreground">Cây:</strong>{' '}
          <span className="text-emerald-800 font-semibold">{selectedPlant || 'Chưa chọn'}</span>
        </span>
        <span>•</span>
        <span>
          <strong className="text-foreground">Nguồn:</strong>{' '}
          <span className="font-semibold text-foreground">
            {ingestSourceScope === 'Quốc tế' ? '🌐 Nước ngoài' : '🇻🇳 Việt Nam'}
          </span>
        </span>
        <span>•</span>
        <span>
          <strong className="text-foreground">Chuyên đề:</strong>{' '}
          <span className="text-emerald-800 font-semibold">
            {articleTopics
              .map((code) => {
                const f = diseases.find((d) => d.classCode === code);
                return formatTopicLabel(f?.commonNameVi, code);
              })
              .join(', ') || 'Chưa chọn'}
          </span>
        </span>
        <span>•</span>
        <span className="max-w-[260px] truncate" title={ingestTitle}>
          <strong className="text-foreground">Tiêu đề:</strong>{' '}
          <span className="text-foreground font-medium">{ingestTitle || '(Chưa có)'}</span>
        </span>
      </div>

      <button
        type="button"
        onClick={() => setIsMetaCardCollapsed(false)}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
      >
        <Edit3 className="w-3 h-3" />
        <span>Mở ra chỉnh sửa</span>
      </button>
    </div>
  );

  // Ô nhập metadata có gợi ý AI độc lập từng trường (Tiêu đề / Cơ quan / Tác giả / Ngày đăng / Ngày cập nhật)
  const renderAiMetaFieldInput = ({
    fieldKey,
    label,
    value,
    onChange,
    placeholder,
    mutedPlaceholder = false,
    hasDiff,
    suggestedValue,
    applyToast,
    popoverAlign = 'left',
  }: {
    fieldKey: string;
    label: string;
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
    mutedPlaceholder?: boolean;
    hasDiff: boolean;
    suggestedValue: string;
    applyToast: string;
    popoverAlign?: 'left' | 'right';
  }) => (
    <div className="relative">
      <div className="flex items-center justify-between mb-1 gap-1.5">
        <label className="font-semibold text-foreground">{label}</label>
        {hasDiff && (
          <button
            type="button"
            onClick={() => setActiveAiPopoverField(activeAiPopoverField === fieldKey ? null : fieldKey)}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-full px-2 py-0.5 animate-pulse cursor-pointer shadow-2xs transition-colors shrink-0"
            title="Nhấp để xem gợi ý AI"
          >
            <Sparkles className="w-3 h-3 text-amber-600 animate-spin-slow" />
            <span>AI có gợi ý</span>
          </button>
        )}
      </div>
      <div className="relative">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={() => {
            if (hasDiff) setActiveAiPopoverField(fieldKey);
          }}
          placeholder={placeholder}
          className={`text-xs bg-background transition-all ${
            mutedPlaceholder ? 'placeholder:text-muted-foreground/35 placeholder:italic ' : ''
          }${hasDiff ? 'ring-2 ring-amber-400/80 border-amber-400 bg-amber-50/20 pr-8 shadow-xs' : ''}`}
        />
        {hasDiff && (
          <button
            type="button"
            onClick={() => setActiveAiPopoverField(activeAiPopoverField === fieldKey ? null : fieldKey)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-600 hover:text-amber-800 transition-transform active:scale-95"
            title="Nhấp để xem gợi ý AI"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          </button>
        )}

        {hasDiff && activeAiPopoverField === fieldKey && (
          <div
            className={`absolute z-30 top-full mt-1.5 p-3 bg-card border-2 border-amber-300 rounded-xl shadow-xl text-xs space-y-2 animate-in fade-in zoom-in-95 ${
              popoverAlign === 'right'
                ? 'left-0 right-0 sm:left-auto sm:min-w-[320px]'
                : 'left-0 right-0 sm:right-auto sm:min-w-[340px]'
            }`}
          >
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold text-amber-950 block">AI đọc được từ bài báo:</span>
                <p className="text-xs font-semibold text-foreground mt-0.5 bg-muted/40 p-1.5 rounded border border-border/60 break-words">
                  "{suggestedValue}"
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-border/60">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDismissedAiFields((prev) => ({ ...prev, [fieldKey]: true }));
                  setActiveAiPopoverField(null);
                }}
                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
              >
                Bỏ qua
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onChange(suggestedValue);
                  setDismissedAiFields((prev) => ({ ...prev, [fieldKey]: true }));
                  setActiveAiPopoverField(null);
                  toast.success(applyToast);
                }}
                className="h-6 px-2.5 text-[10px] bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                Áp dụng
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Thẻ vật tư / hoạt chất + form thêm cụm từ inline (dùng chung cho đoạn AI đề xuất & đoạn AI không chọn ở cả 2 luồng)
  const renderParagraphMentions = (para: ParagraphItem) => (
    <div className="pl-6 mt-2 pt-2 border-t border-border/40 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
          <span>Vật tư / Hoạt chất:</span>
          <span
            className="text-[9px] text-muted-foreground/80 cursor-help"
            title="Cụm từ trích xuất để AI Lavi gợi ý thuốc trong kho vật tư và đối soát kiến thức"
          >
            (?)
          </span>
        </span>
        {(para.mentions || []).map((m, mIdx) => {
          const translation = getAgriTranslation(m.text);
          const isHighlighted =
            highlightedMention?.paraId === para.id &&
            highlightedMention.text.toLowerCase() === m.text.toLowerCase();
          return (
            <span
              key={mIdx}
              onMouseEnter={() => setHighlightedMention({ paraId: para.id, text: m.text })}
              onMouseLeave={() => setHighlightedMention(null)}
              onClick={() =>
                setHighlightedMention((prev) =>
                  prev?.paraId === para.id && prev?.text.toLowerCase() === m.text.toLowerCase()
                    ? null
                    : { paraId: para.id, text: m.text }
                )
              }
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
                isHighlighted ? 'ring-2 ring-amber-400 shadow-xs ' : ''
              }${
                m.kind === 'CHEMICAL'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : m.kind === 'BIOLOGICAL'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : m.kind === 'SUPPLY'
                      ? 'bg-blue-100 text-blue-900 border border-blue-300'
                      : 'bg-purple-100 text-purple-900 border border-purple-300'
              }`}
              title={
                translation
                  ? `Thuật ngữ: "${m.text}"\nNghĩa tiếng Việt: ${translation}\n(Bấm để highlight từ này trong văn bản)`
                  : `Bấm để highlight "${m.text}" trong đoạn văn`
              }
            >
              <span>{m.text}</span>
              {translation && (
                <span className="text-[9px] opacity-80 font-normal italic">({translation})</span>
              )}
              <select
                value={m.kind}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => handleChangeMentionKind(para.id, mIdx, e.target.value)}
                className="bg-transparent border-none text-[9px] cursor-pointer font-semibold opacity-75 hover:opacity-100 focus:ring-0 p-0 ml-0.5"
                title="Đổi phân loại vật tư"
              >
                <option value="CHEMICAL">Hóa học</option>
                <option value="BIOLOGICAL">Sinh học</option>
                <option value="SUPPLY">Vật tư</option>
                <option value="PRACTICE">Canh tác</option>
              </select>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveMention(para.id, mIdx);
                }}
                className="opacity-50 hover:opacity-100 hover:text-destructive transition-opacity ml-0.5"
                title="Xóa thẻ này"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          );
        })}

        {addingMentionParaId !== para.id && (
          <button
            type="button"
            onClick={() => {
              setAddingMentionParaId(para.id);
              setNewMentionText('');
              setNewMentionKind('CHEMICAL');
            }}
            className="inline-flex items-center gap-1 text-[10px] text-emerald-700 hover:text-emerald-800 font-medium px-1.5 py-0.5 border border-dashed border-emerald-300 rounded hover:bg-emerald-50 transition-colors"
            title="Bấm để thêm cụm từ nguyên văn trong đoạn này"
          >
            <Plus className="w-2.5 h-2.5" />
            <span>Thêm cụm từ</span>
          </button>
        )}
      </div>

      {addingMentionParaId === para.id && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-muted/40 border border-border rounded-md text-xs">
          <Input
            type="text"
            value={newMentionText}
            onChange={(e) => setNewMentionText(e.target.value)}
            placeholder="Nhập cụm từ nguyên văn có trong đoạn..."
            className="h-7 text-[11px] bg-background w-56"
            autoFocus
          />
          <select
            value={newMentionKind}
            onChange={(e) => setNewMentionKind(e.target.value)}
            className="h-7 px-2 text-[11px] bg-background border border-border rounded font-medium"
          >
            <option value="CHEMICAL">Hóa học</option>
            <option value="BIOLOGICAL">Sinh học</option>
            <option value="SUPPLY">Vật tư canh tác</option>
            <option value="PRACTICE">Biện pháp canh tác</option>
          </select>
          <Button
            type="button"
            size="sm"
            onClick={() => handleAddMention(para.id)}
            className="h-7 text-[11px] px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
          >
            Thêm
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setAddingMentionParaId(null)}
            className="h-7 text-[11px] px-2 text-muted-foreground"
          >
            Hủy
          </Button>
        </div>
      )}
    </div>
  );

  // Thẻ duyệt từng đoạn trích (dùng chung cho Nhập bài báo mới & Tab Nạp thêm dữ liệu)
  const renderParagraphReviewCard = (para: ParagraphItem, options?: { isNoise?: boolean }) => {
    const state = selectedParagraphs[para.id] || { selected: false, unitType: 'SYMPTOMS' };
    const isTooLong = para.text.length > 1500;
    const isSaved = savedVerbatimTexts.has(collapseWs(para.text));
    const isHeaderLine = para.text.length < 40 && !para.id.includes('_');
    const isNoise = !!options?.isNoise;

    return (
      <div
        key={para.id}
        className={`rounded-lg border transition-colors ${isNoise ? 'p-3 border-dashed ' : 'p-3.5 '}${
          state.selected
            ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs opacity-100'
            : isNoise
              ? 'bg-muted/10 border-border/80 opacity-80 hover:opacity-100 hover:bg-muted/30'
              : 'bg-card border-border hover:bg-muted/40'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <label className="flex items-center gap-2 cursor-pointer font-bold text-xs">
            <input
              type="checkbox"
              checked={state.selected}
              disabled={isTooLong || isSaved || isHeaderLine || (!state.selected && countWithSaved >= 20)}
              onChange={(e) => {
                setSelectedParagraphs((prev) => ({
                  ...prev,
                  [para.id]: {
                    ...state,
                    selected: e.target.checked,
                  },
                }));
              }}
              className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-600"
            />
            <span className="text-emerald-800 font-mono">{para.id}</span>
            <span className="text-muted-foreground font-normal text-[11px]">({para.text.length} ký tự)</span>
            {isSaved && (
              <Badge variant="outline" className="text-[10px] h-5 border-emerald-300 text-emerald-800 bg-emerald-50">
                Đã lưu
              </Badge>
            )}
            {isTooLong && (
              <Badge variant="destructive" className="text-[10px] h-5">
                Vượt quá 1.500 ký tự
              </Badge>
            )}
          </label>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleOpenSplitModal(para)}
              className={`h-6 text-[10px] gap-1 px-2 border ${
                isTooLong
                  ? 'border-destructive/60 text-destructive hover:bg-destructive/10 font-semibold'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
              title={isTooLong ? 'Đoạn quá 1.500 ký tự - bấm để tách' : 'Tách đoạn này thành 2 đoạn nhỏ'}
            >
              <Scissors className="w-3 h-3" />
              <span>Tách đoạn</span>
            </Button>

            <select
              value={state.unitType}
              disabled={!state.selected}
              onChange={(e) => {
                setSelectedParagraphs((prev) => ({
                  ...prev,
                  [para.id]: {
                    ...state,
                    unitType: e.target.value,
                  },
                }));
              }}
              className="px-2 py-1 text-[11px] bg-background border border-border rounded font-medium disabled:opacity-50"
            >
              <option value="SYMPTOMS">Triệu chứng (SYMPTOMS)</option>
              <option value="CAUSE_CONDITIONS">Nguyên nhân (CAUSE_CONDITIONS)</option>
              <option value="PREVENTION">Phòng ngừa (PREVENTION)</option>
              <option value="TREATMENT">Điều trị (TREATMENT)</option>
            </select>

            <select
              value={state.diseaseClass || ingestClass}
              disabled={!state.selected}
              onChange={(e) => {
                setSelectedParagraphs((prev) => ({
                  ...prev,
                  [para.id]: {
                    ...state,
                    diseaseClass: e.target.value,
                  },
                }));
              }}
              className="px-2 py-1 text-[11px] bg-background border border-border rounded font-medium disabled:opacity-50 max-w-[160px] truncate"
              title="Chuyên đề / Bệnh hại cho đoạn trích này"
            >
              {filteredDiseasesByPlant.map((d) => (
                <option key={d.classCode} value={d.classCode}>
                  {formatTopicLabel(d.commonNameVi, d.classCode)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-foreground/90 pl-6 leading-relaxed space-y-0.5">
          {renderParagraphWithHighlight(para.id, para.text)}
        </div>

        {renderParagraphMentions(para)}
      </div>
    );
  };

  // Accordion thu gọn chứa các đoạn AI không chọn (rendered duy nhất 1 lần để tránh lặp)
  const renderUnselectedParagraphsAccordion = (noiseParagraphs: ParagraphItem[]) => {
    if (noiseParagraphs.length === 0) return null;
    return (
      <div className="pt-2 border-t border-border">
        <button
          type="button"
          onClick={() => setShowNoiseParagraphs(!showNoiseParagraphs)}
          className="w-full flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 border border-border text-xs text-muted-foreground font-medium"
        >
          <span className="flex items-center gap-1.5">
            {showNoiseParagraphs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>Đoạn AI không chọn: {noiseParagraphs.length} đoạn (vẫn tick để lưu được)</span>
          </span>
          <span className="text-[11px]">{showNoiseParagraphs ? 'Thu gọn' : 'Bấm để mở xem'}</span>
        </button>

        {showNoiseParagraphs && (
          <div className="mt-2 space-y-2 pl-2">
            {noiseParagraphs.map((para) => renderParagraphReviewCard(para, { isNoise: true }))}
          </div>
        )}
      </div>
    );
  };

  // ==================== TAB 2 LOGIC ====================
  const fetchSources = async () => {
    try {
      setLoadingSources(true);
      const res = await apiClient.get<KnowledgeSourceItem[]>('/knowledge/sources');
      setSources(res.data || []);
      setSelectedSourceIds([]);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingSources(false);
    }
  };

  const handleToggleApprove = async (id: string, currentApproved: boolean) => {
    try {
      const res = await apiClient.patch(`/knowledge/sources/${id}/approve`, {
        is_approved: !currentApproved,
        reviewer_notes: !currentApproved ? 'Đã duyệt qua Admin Dashboard' : 'Bỏ duyệt khỏi RAG',
      });

      setSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isManualApproved: !currentApproved } : s))
      );

      const syncStatus = res.data.reindex_status === 'accepted' ? 'Đang đồng bộ vào bộ nhớ AI Lavi' : res.data.reindex_status;
      toast.success(
        !currentApproved
          ? `Đã duyệt đoạn tri thức. (${syncStatus})`
          : `Đã bỏ duyệt đoạn tri thức. (${syncStatus})`
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Xóa mềm (IsDeleted) qua Core API; Core tự gọi Agent reindex nên Lavi không còn trích dẫn bài này.
  const handleDeleteSource = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await apiClient.delete(`/knowledge/sources/${deleteTarget.id}`);
      setSources((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setSelectedSourceIds((prev) => prev.filter((id) => id !== deleteTarget.id));
      toast.success('Đã xóa đoạn tri thức. Lavi sẽ không dùng đoạn này nữa.');
      setDeleteTarget(null);
      if (editUrl) await loadArticleForEdit(editUrl, true);
      setShowMetaEditPanel(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleBatchApprove = async (isApproved: boolean) => {
    if (selectedSourceIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một bài viết để duyệt hàng loạt.');
      return;
    }

    try {
      setBatchActionLoading(true);
      const res = await apiClient.patch('/knowledge/sources/approve-batch', {
        source_ids: selectedSourceIds,
        is_approved: isApproved,
        reviewer_notes: isApproved ? 'Duyệt hàng loạt qua Admin Portal' : 'Bỏ duyệt hàng loạt',
      });

      setSources((prev) =>
        prev.map((s) => (selectedSourceIds.includes(s.id) ? { ...s, isManualApproved: isApproved } : s))
      );
      setSelectedSourceIds([]);

      toast.success(
        `Đã ${isApproved ? 'duyệt' : 'bỏ duyệt'} ${res.data.approved_count} bài viết thành công. Reindex: ${res.data.reindex_status}`
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBatchActionLoading(false);
    }
  };

  const checkReindexStatus = async () => {
    try {
      setLoadingReindexStatus(true);
      setReindexStatusOpen(true);
      const res = await apiClient.get('/knowledge/reindex-status');
      setReindexStatusData(res.data);
    } catch (err) {
      setReindexStatusData({ error: getErrorMessage(err) });
    } finally {
      setLoadingReindexStatus(false);
    }
  };

  const filteredSources = sources.filter((s) => {
    if (sourceFilterPlant !== 'ALL' && s.plantName !== sourceFilterPlant) return false;
    if (sourceFilterClass !== 'ALL' && s.modelClass !== sourceFilterClass) return false;
    if (sourceOriginFilter !== 'ALL' && inferSourceScope(s.sourceUrl, s.organization, s.sourceScope) !== sourceOriginFilter) {
      return false;
    }
    if (sourceApprovalFilter === 'APPROVED' && !s.isManualApproved) return false;
    if (sourceApprovalFilter === 'PENDING' && s.isManualApproved) return false;

    if (sourceSearch.trim()) {
      const q = sourceSearch.toLowerCase();
      const matchTitle = s.sourceTitle.toLowerCase().includes(q);
      const matchOrg = s.organization.toLowerCase().includes(q);
      const matchPlant = (s.plantName || '').toLowerCase().includes(q);
      const matchDisease = s.diseaseName.toLowerCase().includes(q);
      const matchTopic = formatTopicLabel(s.diseaseName, s.modelClass).toLowerCase().includes(q);
      if (!matchTitle && !matchOrg && !matchPlant && !matchDisease && !matchTopic) return false;
    }

    return true;
  });

  // Chế độ xem: Gộp theo bài viết (mặc định bật) và Quản lý mở rộng chi tiết bài
  const [groupByArticle, setGroupByArticle] = useState<boolean>(true);
  const [expandedArticleKeys, setExpandedArticleKeys] = useState<Set<string>>(new Set());

  const toggleExpandArticle = (key: string) => {
    setExpandedArticleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const groupedArticles = React.useMemo<GroupedArticle[]>(() => {
    const map = new Map<string, GroupedArticle>();

    filteredSources.forEach((s) => {
      // Nhánh 3: Gom nhóm bài viết strictly theo URL bài báo (hoặc Title nếu không có URL)
      // 1 bài báo = 1 dòng duy nhất trên bảng, các bệnh khác nhau được tổng hợp vào diseasesList
      const normalizedUrl = (s.sourceUrl || '').trim().toLowerCase();
      const normalizedTitle = (s.sourceTitle || '').trim().toLowerCase();
      const key = normalizedUrl || normalizedTitle || `source_${s.id}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          sourceTitle: s.sourceTitle,
          sourceUrl: s.sourceUrl,
          organization: s.organization,
          sourceScope: inferSourceScope(s.sourceUrl, s.organization, s.sourceScope),
          primaryPlantName: s.plantName,
          primaryDiseaseName: s.diseaseName,
          primaryModelClass: s.modelClass,
          diseasesList: [{ plantName: s.plantName, diseaseName: s.diseaseName, modelClass: s.modelClass }],
          paragraphs: [],
          approvedCount: 0,
          totalCount: 0,
        });
      }
      const group = map.get(key)!;
      group.paragraphs.push(s);
      group.totalCount += 1;
      if (s.isManualApproved) {
        group.approvedCount += 1;
      }
      if (!group.diseasesList.some((d) => d.modelClass === s.modelClass)) {
        group.diseasesList.push({ plantName: s.plantName, diseaseName: s.diseaseName, modelClass: s.modelClass });
      }
    });

    return Array.from(map.values());
  }, [filteredSources]);

  // Phân trang cho Danh sách Tri thức (Curation)
  const curationTotalItems = groupByArticle ? groupedArticles.length : filteredSources.length;
  const curationTotalPages = Math.max(1, Math.ceil(curationTotalItems / curationPageSize));
  const safeCurationPage = Math.min(curationPage, curationTotalPages);

  const pagedArticles = React.useMemo(() => {
    const start = (safeCurationPage - 1) * curationPageSize;
    return groupedArticles.slice(start, start + curationPageSize);
  }, [groupedArticles, safeCurationPage, curationPageSize]);

  const pagedSources = React.useMemo(() => {
    const start = (safeCurationPage - 1) * curationPageSize;
    return filteredSources.slice(start, start + curationPageSize);
  }, [filteredSources, safeCurationPage, curationPageSize]);

  const handleToggleApproveArticle = async (article: GroupedArticle) => {
    const isAllApproved = article.approvedCount === article.totalCount;
    const targetApproved = !isAllApproved;
    const targetIds = article.paragraphs.map((p) => p.id);

    try {
      setBatchActionLoading(true);
      await apiClient.patch('/knowledge/sources/approve-batch', {
        source_ids: targetIds,
        is_approved: targetApproved,
        reviewer_notes: targetApproved ? 'Duyệt toàn bộ bài báo' : 'Bỏ duyệt toàn bộ bài báo',
      });

      setSources((prev) =>
        prev.map((s) => (targetIds.includes(s.id) ? { ...s, isManualApproved: targetApproved } : s))
      );

      toast.success(
        targetApproved
          ? `Đã duyệt toàn bộ ${targetIds.length} đoạn của bài viết "${article.sourceTitle}".`
          : `Đã bỏ duyệt ${targetIds.length} đoạn của bài viết "${article.sourceTitle}".`
      );
    } catch (err: any) {
      toast.error('Lỗi khi thao tác bài viết: ' + getErrorMessage(err));
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Xóa toàn bộ các đoạn của 1 bài báo (Nhánh 3)
  const handleDeleteArticle = async () => {
    if (!deleteArticleTarget) return;
    const targetIds = deleteArticleTarget.paragraphs.map((p) => p.id);
    try {
      setDeletingArticle(true);
      await apiClient.post('/knowledge/sources/batch-delete', targetIds);
      setSources((prev) => prev.filter((s) => !targetIds.includes(s.id)));
      setSelectedSourceIds((prev) => prev.filter((id) => !targetIds.includes(id)));
      toast.success(
        `Đã xóa toàn bộ ${targetIds.length} đoạn của bài viết "${deleteArticleTarget.sourceTitle}". Lavi sẽ không trích dẫn bài này nữa.`
      );
      setDeleteArticleTarget(null);
      if (editUrl) await loadArticleForEdit(editUrl, true);
      setShowMetaEditPanel(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingArticle(false);
    }
  };

  // Xóa hàng loạt các đoạn đã chọn qua checkbox (Nhánh 3)
  const handleBatchDelete = async () => {
    if (selectedSourceIds.length === 0) return;
    try {
      setDeletingBatch(true);
      await apiClient.post('/knowledge/sources/batch-delete', selectedSourceIds);
      setSources((prev) => prev.filter((s) => !selectedSourceIds.includes(s.id)));
      toast.success(`Đã xóa ${selectedSourceIds.length} đoạn tri thức đã chọn.`);
      setSelectedSourceIds([]);
      setDeleteBatchModalOpen(false);
      if (editUrl) await loadArticleForEdit(editUrl, true);
      setShowMetaEditPanel(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingBatch(false);
    }
  };

  // ==================== TAB 3 LOGIC ====================
  const fetchMedicines = async () => {
    try {
      setLoadingMedicines(true);
      const res = await apiClient.get('/medicines/search', {
        params: { allowedOnly: false },
      });
      setMedicines(res.data.items || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingMedicines(false);
    }
  };

  const handleToggleMedicineAllowed = async (med: MedicineItem) => {
    try {
      const res = await apiClient.patch(`/medicines/${med.id}`, {
        is_allowed: !med.is_allowed,
      });

      setMedicines((prev) =>
        prev.map((m) => (m.id === med.id ? { ...m, is_allowed: res.data.is_allowed } : m))
      );

      toast.success(
        res.data.is_allowed
          ? `Đã bật lưu hành thuốc '${med.name}'.`
          : `Đã dừng lưu hành thuốc '${med.name}'.`
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Bản sao BANNED_INGREDIENTS của backend/agent-service/app/agent/guardrails.py.
  // Chỉ để cảnh báo sớm trên form; Core kiểm tra lại. Sửa thì sửa cả 3 nơi (Pha 4 gộp về CSDL).
  const BANNED_INGREDIENTS = [
    'paraquat', 'pa-ra-quat', 'para-quat', 'gramoxone',
    '2,4-d', '2.4-d', '2,4d', '2.4d',
    'chlorpyrifos', 'carbofuran', 'glyphosate', 'monocrotophos', 'methamidophos', 'endosulfan'
  ];

  const isIngredientBanned = (text?: string | null): boolean => {
    if (!text) return false;
    const lower = text.toLowerCase();
    return BANNED_INGREDIENTS.some((b) => lower.includes(b));
  };

  const handleSaveMedicineEdit = async () => {
    if (!editingMed) return;

    if (!editingMed.name.trim()) {
      toast.error('Vui lòng nhập tên sản phẩm.');
      return;
    }

    const isSupply = editingMed.medicine_type === 'Vật tư canh tác';
    if (isIngredientBanned(editingMed.name) || (!isSupply && isIngredientBanned(editingMed.active_ingredient))) {
      toast.error('Tên hoặc hoạt chất thuộc danh mục thuốc BVTV cấm sử dụng tại Việt Nam.');
      return;
    }

    if (!isSupply && (editingMed.phi_days === null || editingMed.phi_days === undefined)) {
      toast.error('Thuốc hóa học/sinh học bắt buộc có thời gian cách ly (PHI).');
      return;
    }

    try {
      setMedSaving(true);
      const res = await apiClient.patch(`/medicines/${editingMed.id}`, {
        name: editingMed.name.trim(),
        active_ingredient: isSupply ? null : (editingMed.active_ingredient?.trim() || null),
        dosage_instruction: editingMed.dosage_instruction?.trim() || (isSupply ? 'Sử dụng theo hướng dẫn kỹ thuật' : 'Pha theo hướng dẫn trên bao bì'),
        phi_days: isSupply ? null : editingMed.phi_days,
        price: editingMed.availability === 'NOT_SOLD' ? 0 : (Number(editingMed.price) || 0),
        stock_quantity: editingMed.availability === 'NOT_SOLD' ? 0 : (Number(editingMed.stock_quantity) || 0),
        is_allowed: editingMed.is_allowed,
        availability: editingMed.availability,
        info_source_url: editingMed.info_source_url,
        medicine_type: editingMed.medicine_type,
      });

      setMedicines((prev) =>
        prev.map((m) => (m.id === editingMed.id ? { ...m, ...res.data } : m))
      );

      setEditingMed(null);
      toast.success(`Đã cập nhật thông tin sản phẩm '${res.data.name}'.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setMedSaving(false);
    }
  };

  const filteredMedicines = medicines.filter((m) => {
    if (!medSearch.trim()) return true;
    const q = medSearch.toLowerCase();
    return m.name.toLowerCase().includes(q) || (m.active_ingredient && m.active_ingredient.toLowerCase().includes(q));
  });

  // Gợi ý vật tư từ bài báo (Task-15 Phase 3)
  const fetchSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      const res = await apiClient.get<ProductSuggestionItem[]>('/knowledge/product-suggestions');
      setSuggestions(res.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleLinkSuggestion = async () => {
    if (!linkingSuggestion || !selectedLinkMedId) {
      toast.error('Vui lòng chọn một sản phẩm từ kho để liên kết.');
      return;
    }
    try {
      setLinkingLoading(true);
      await apiClient.post(`/knowledge/product-suggestions/${linkingSuggestion.id}/link`, {
        product_id: Number(selectedLinkMedId),
      });
      toast.success('Đã gắn sản phẩm với bệnh của gợi ý này.');
      await fetchSuggestions();
      setLinkingSuggestion(null);
      setSelectedLinkMedId('');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLinkingLoading(false);
    }
  };

  const handleDismissSuggestion = async (suggestionId: number) => {
    try {
      await apiClient.post(`/knowledge/product-suggestions/${suggestionId}/dismiss`);
      toast.success('Đã bỏ qua gợi ý vật tư này.');
      setSuggestions((prev) =>
        prev.map((s) => (s.id === suggestionId ? { ...s, status: 'DISMISSED', resolved_at: new Date().toISOString() } : s))
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleOpenCreateMedModal = (sug?: ProductSuggestionItem) => {
    if (sug) {
      setFromSuggestion(sug);
      setNewMedName(sug.mention_text);
      const mappedType =
        sug.kind === 'BIOLOGICAL'
          ? 'Sinh học'
          : sug.kind === 'SUPPLY' || sug.kind === 'PRACTICE'
            ? 'Vật tư canh tác'
            : 'Hóa học';
      setNewMedType(mappedType);
      setNewMedActiveIngredient(sug.kind === 'CHEMICAL' || sug.kind === 'BIOLOGICAL' ? sug.mention_text : '');
      // TASK-15 5.3: không điền sẵn PHI; Admin tự tra nhãn thuốc rồi nhập
      setNewMedPhi('');
      // Gợi ý từ bài báo thường là thứ cửa hàng chưa bán: mặc định "Không bán", tồn 0
      setNewMedAvailability('NOT_SOLD');
      // Link nguồn là nơi tra PHI/liều (nhãn, nhà sản xuất), không phải bài báo
      setNewMedSourceUrl('');
      setNewMedTargetDisease(sug.model_class || 'Tomato___Late_blight');
      setNewMedPrice(0);
      setNewMedStock(0);
      setNewMedDosage(
        mappedType === 'Vật tư canh tác'
          ? 'Sử dụng theo diện tích canh tác và hướng dẫn nhà sản xuất'
          : 'Pha theo hướng dẫn trên bao bì'
      );
      setNewMedIsAllowed(false);
    } else {
      setFromSuggestion(null);
      setNewMedName('');
      setNewMedType('Hóa học');
      setNewMedActiveIngredient('');
      setNewMedPhi('');
      setNewMedAvailability('IN_STOCK');
      setNewMedSourceUrl('');
      setNewMedTargetDisease('Tomato___Late_blight');
      setNewMedPrice(50000);
      setNewMedStock(50);
      setNewMedDosage('Pha theo hướng dẫn trên bao bì');
      setNewMedIsAllowed(false);
    }
    setCreateMedModalOpen(true);
  };

  const handleCreateMedicineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim()) {
      toast.error('Vui lòng nhập tên sản phẩm.');
      return;
    }
    const isSupply = newMedType === 'Vật tư canh tác';
    if (isIngredientBanned(newMedName) || (!isSupply && isIngredientBanned(newMedActiveIngredient))) {
      toast.error('Tên hoặc hoạt chất thuộc danh mục thuốc BVTV cấm sử dụng tại Việt Nam.');
      return;
    }
    if (!isSupply && newMedPhi === '') {
      toast.error('Thuốc hóa học/sinh học bắt buộc nhập thời gian cách ly (PHI) theo nhãn.');
      return;
    }
    if (!isSupply && !/^https?:\/\//i.test(newMedSourceUrl.trim())) {
      toast.error('Thuốc bắt buộc có link nguồn nơi bạn tra PHI và liều (nhãn, trang nhà sản xuất).');
      return;
    }

    try {
      setCreatingMed(true);
      const payload: any = {
        name: newMedName.trim(),
        medicine_type: newMedType,
        active_ingredient: isSupply ? null : newMedActiveIngredient.trim() || undefined,
        price: newMedAvailability === 'NOT_SOLD' ? 0 : (Number(newMedPrice) || 0),
        dosage_instruction: newMedDosage.trim() || (isSupply ? 'Sử dụng theo diện tích canh tác và hướng dẫn nhà sản xuất' : 'Pha theo hướng dẫn trên bao bì'),
        phi_days: isSupply ? null : (newMedPhi === '' ? null : Number(newMedPhi)),
        stock_quantity: newMedAvailability === 'NOT_SOLD' ? 0 : (Number(newMedStock) || 0),
        availability: newMedAvailability,
        info_source_url: newMedSourceUrl.trim() || undefined,
        target_disease_code: newMedTargetDisease || undefined,
        is_allowed: newMedIsAllowed,
        suggestion_id: fromSuggestion ? fromSuggestion.id : undefined,
      };

      const res = await apiClient.post('/medicines', payload);
      toast.success(`Đã thêm sản phẩm "${res.data.name}" vào danh mục thành công!`);
      setCreateMedModalOpen(false);
      fetchMedicines();
      if (fromSuggestion) {
        fetchSuggestions();
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreatingMed(false);
    }
  };

  const pendingSuggestionsCount = suggestions.filter((s) => s.status === 'PENDING').length;

  const filteredSuggestions = suggestions.filter((s) => {
    if (suggestionStatusFilter !== 'ALL' && s.status !== suggestionStatusFilter) return false;
    if (suggestionKindFilter !== 'ALL' && s.kind !== suggestionKindFilter) return false;
    if (suggestionSearch.trim()) {
      const q = suggestionSearch.toLowerCase();
      const matchMention = s.mention_text?.toLowerCase().includes(q);
      const matchDisease = s.disease_name?.toLowerCase().includes(q) || s.plant_name?.toLowerCase().includes(q);
      const matchEvidence = s.evidence_text?.toLowerCase().includes(q);
      const matchProd = s.product_name?.toLowerCase().includes(q);
      if (!matchMention && !matchDisease && !matchEvidence && !matchProd) return false;
    }
    return true;
  });

  // ==================== TAB 4 LOGIC ====================
  const fetchEscalations = async () => {
    try {
      setLoadingEscalations(true);
      const res = await apiClient.get<EscalationItem[]>('/diagnose/escalations');
      setEscalations(res.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingEscalations(false);
    }
  };

  const handleSaveExpertReview = async () => {
    if (!selectedEscalation || !expertNoteInput.trim()) {
      toast.error('Vui lòng nhập kết luận và hướng dẫn điều trị của chuyên gia.');
      return;
    }

    try {
      setReviewSubmitting(true);
      const res = await apiClient.patch(`/diagnose/${selectedEscalation.id}/expert-review`, {
        expert_notes: expertNoteInput.trim(),
      });

      setEscalations((prev) =>
        prev.map((e) =>
          e.id === selectedEscalation.id
            ? { ...e, expertNotes: res.data.expert_notes, expertReviewedAt: res.data.expert_reviewed_at }
            : e
        )
      );

      setSelectedEscalation(null);
      setExpertNoteInput('');
      toast.success('Đã gửi phản hồi phác đồ điều trị của chuyên gia tới nông dân.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setReviewSubmitting(false);
    }
  };

  // ==================== TAB: ẢNH TRIỆU CHỨNG LOGIC (TASK-15 PHASE 2) ====================
  const fetchKnowledgeImages = async () => {
    try {
      setLoadingImages(true);
      const params: Record<string, string | boolean> = {};
      if (imageFilterClass !== 'ALL') params.model_class = imageFilterClass;
      if (imageFilterPart !== 'ALL') params.plant_part = imageFilterPart;
      if (imageFilterApproval === 'APPROVED') params.is_approved = true;
      if (imageFilterApproval === 'PENDING') params.is_approved = false;
      if (imageSearch.trim()) params.search = imageSearch.trim();

      const res = await apiClient.get<KnowledgeImageItem[]>('/knowledge/images', { params });
      setKnowledgeImages(res.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingImages(false);
    }
  };

  const handleToggleApproveImage = async (img: KnowledgeImageItem) => {
    try {
      const nextApproved = !img.is_manual_approved;
      await apiClient.patch(`/knowledge/images/${img.id}/approve`, {
        is_approved: nextApproved,
      });
      setKnowledgeImages((prev) =>
        prev.map((item) => (item.id === img.id ? { ...item, is_manual_approved: nextApproved } : item))
      );
      toast.success(nextApproved ? 'Đã duyệt ảnh triệu chứng.' : 'Đã chuyển ảnh về trạng thái chờ duyệt.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDeleteImage = async () => {
    if (!deleteImageTarget) return;
    try {
      setDeletingImage(true);
      await apiClient.delete(`/knowledge/images/${deleteImageTarget.id}`);
      setKnowledgeImages((prev) => prev.filter((item) => item.id !== deleteImageTarget.id));
      toast.success('Đã gỡ ảnh triệu chứng thành công.');
      setDeleteImageTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingImage(false);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast.error('Chỉ hỗ trợ tệp ảnh JPG, PNG hoặc WEBP.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Dung lượng ảnh tối đa là 10MB.');
        return;
      }
      setNewImageFile(file);
      setNewImageFilePreview(URL.createObjectURL(file));
    }
  };

  const handleCreateKnowledgeImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImageClass) {
      toast.error('Vui lòng chọn bệnh hại mục tiêu.');
      return;
    }
    if (!newImageSourceUrl || !newImageSourceUrl.startsWith('http')) {
      toast.error('URL bài viết gốc phải bắt đầu bằng http:// hoặc https://');
      return;
    }
    if (newImageMode === 'URL') {
      if (!newImageUrl || !newImageUrl.startsWith('https://')) {
        toast.error('URL ảnh trực tiếp phải là link https:// an toàn.');
        return;
      }
    } else {
      if (!newImageFile) {
        toast.error('Vui lòng chọn tệp ảnh từ thiết bị để tải lên.');
        return;
      }
    }
    if (!newImageCaption.trim()) {
      toast.error('Vui lòng nhập mô tả / chú thích triệu chứng.');
      return;
    }
    if (!newImageCredit.trim()) {
      toast.error('Vui lòng nhập nguồn ảnh / tác giả sở hữu.');
      return;
    }

    setSubmittingImage(true);
    try {
      const formData = new FormData();
      formData.append('ModelClass', newImageClass);
      formData.append('SourceUrl', newImageSourceUrl.trim());
      formData.append('Caption', newImageCaption.trim());
      formData.append('PlantPart', newImagePlantPart);
      formData.append('Credit', newImageCredit.trim());
      if (newImageLicenseNote.trim()) {
        formData.append('LicenseNote', newImageLicenseNote.trim());
      }
      formData.append('IsManualApproved', newImageAutoApprove ? 'true' : 'false');

      if (newImageMode === 'URL') {
        formData.append('ImageUrl', newImageUrl.trim());
      } else if (newImageFile) {
        formData.append('File', newImageFile);
      }

      const res = await apiClient.post<KnowledgeImageItem>('/knowledge/images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Đã thêm ảnh triệu chứng thành công!');
      setKnowledgeImages((prev) => [res.data, ...prev]);
      setAddImageModalOpen(false);

      // Reset form
      setNewImageUrl('');
      setNewImageFile(null);
      setNewImageFilePreview(null);
      setNewImageCaption('');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmittingImage(false);
    }
  };

  const filteredKnowledgeImages = knowledgeImages.filter((img) => {
    if (imageFilterPlant !== 'ALL') {
      const matchDisease = diseases.find((d) => d.classCode === img.model_class);
      if (matchDisease && matchDisease.plantName !== imageFilterPlant) return false;
    }
    if (!imageSearch.trim()) return true;
    const q = imageSearch.toLowerCase();
    return (
      img.caption?.toLowerCase().includes(q) ||
      img.credit?.toLowerCase().includes(q) ||
      img.disease_name?.toLowerCase().includes(q) ||
      img.plant_name?.toLowerCase().includes(q) ||
      img.source_url?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {(editParam || editUrl) && activeTab === 'ingestion'
              ? 'Chi tiết bài viết tri thức'
              : (SECTION_COPY[activeTab]?.title ?? 'Quản trị')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {(editParam || editUrl) && activeTab === 'ingestion'
              ? 'Kiểm tra thông tin bài báo, các đoạn trích dẫn và duyệt nội dung đưa vào trợ lý AI Lavi.'
              : SECTION_COPY[activeTab]?.description}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={checkReindexStatus}
          className="gap-2 shrink-0 bg-card border-border hover:bg-muted"
          title="Kiểm tra trạng thái nạp dữ liệu tri thức vào bộ nhớ AI Lavi"
        >
          <Database className="w-4 h-4 text-emerald-700" />
          <span>Đồng bộ tri thức</span>
        </Button>
      </div>

      {/* Điều hướng giữa các mục nằm ở sidebar AdminShell; trang này chỉ hiển thị nội dung mục đang chọn */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">

        {/* ========================================================================================= */}
        {/* TAB 1: NHẬP BÀI BÁO NGUYÊN VĂN (HITL INGESTION) */}
        {/* ========================================================================================= */}
        <TabsContent value="ingestion" className="space-y-6">
          {(editParam || editUrl) ? (
            (editLoading && editRows.length === 0) ? (
              /* Loading Skeleton sạch sẽ khi click xem chi tiết bài viết, loại bỏ hoàn toàn hiện tượng giật trang */
              <div className="space-y-4 animate-pulse">
                <div className="p-4 bg-card border border-border rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-36 bg-muted rounded-full" />
                      <div className="h-6 w-24 bg-muted rounded-full" />
                    </div>
                    <div className="h-8 w-28 bg-muted rounded-md" />
                  </div>
                  <div className="h-6 w-3/4 bg-muted rounded" />
                  <div className="h-4 w-1/2 bg-muted rounded" />
                </div>
                <div className="p-10 bg-card border border-border rounded-xl flex flex-col items-center justify-center text-center space-y-3">
                  <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
                  <div className="text-sm font-semibold text-foreground">
                    Đang tải chi tiết bài viết từ kho tri thức...
                  </div>
                  <div className="text-xs text-muted-foreground max-w-md truncate">
                    {editParam || editUrl}
                  </div>
                </div>
              </div>
            ) : (
            /* ========================================================================= */
            /* CHẾ ĐỘ XEM & SỬA BÀI VIẾT ĐÃ LƯU: GIAO DIỆN 2 TAB ĐẶT NGAY TRÊN CÙNG */
            /* ========================================================================= */
            <div className="space-y-4">
              <Tabs value={editSubTab} onValueChange={(v) => setEditSubTab(v as 'approved' | 'reparse')} className="space-y-4">
                {/* 2 Tabs nằm ở trên cùng để tách biệt hoàn toàn 2 công việc: Xem/Sửa chi tiết vs Nạp thêm dữ liệu */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-border/70">
                  <TabsList className="grid grid-cols-2 max-w-md bg-muted/60 p-1">
                    <TabsTrigger value="approved" className="gap-2 text-xs py-1.5 font-semibold">
                      <BookOpen className="w-4 h-4 text-emerald-700" />
                      <span>1. Xem &amp; Sửa chi tiết ({editRows.length} đoạn)</span>
                    </TabsTrigger>
                    <TabsTrigger value="reparse" className="gap-2 text-xs py-1.5 font-semibold">
                      <Sparkles className="w-4 h-4 text-emerald-700" />
                      <span>2. Nạp thêm dữ liệu bài báo</span>
                    </TabsTrigger>
                  </TabsList>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      exitEditMode(true);
                      navigate('/admin/knowledge');
                    }}
                    className="h-8 text-xs gap-1.5 font-medium shrink-0 self-start sm:self-auto hover:bg-muted"
                    title="Quay lại bảng Kiểm duyệt tri thức"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Quay lại danh sách</span>
                  </Button>
                </div>

                {/* ========================================================================= */}
                {/* TAB 1: XEM & SỬA CHI TIẾT BÀI VIẾT + CÁC ĐOẠN ĐÃ DUYỆT */}
                {/* ========================================================================= */}
                <TabsContent value="approved" className="space-y-4">
              {/* Header bài viết: Gọn gàng, tối giản như báo cáo */}
              <div className="p-4 bg-card border border-border rounded-xl shadow-xs space-y-3">
                {/* Dòng tiêu đề bài viết kết hợp nút Sửa và nút Mở link bài gốc tối giản */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
                  <h2 className="text-base sm:text-lg font-bold text-foreground leading-snug line-clamp-2" title={editOriginalMeta.title || ingestTitle || editUrl || ''}>
                    {editOriginalMeta.title || ingestTitle || 'Bài viết chưa có tiêu đề'}
                  </h2>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant={showMetaEditPanel ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setShowMetaEditPanel(!showMetaEditPanel)}
                      className={`h-7 px-2.5 text-xs gap-1 font-medium ${showMetaEditPanel ? 'bg-emerald-700 text-white' : ''}`}
                      title="Chỉnh sửa tiêu đề, cơ quan hoặc ngày xuất bản của bài báo"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{showMetaEditPanel ? 'Đóng form sửa' : 'Sửa thông tin'}</span>
                    </Button>

                    {isSafeHttpUrl(editUrl || ingestUrl) && (
                      <a
                        href={(editUrl || ingestUrl)!.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs"
                        title="Mở trực tiếp trang web bài báo gốc trong tab mới"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Mở link bài gốc</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Dòng 3: Thông tin định dạng text sạch sẽ như báo cáo, tránh rườm rà khung hộp */}
                <div className="text-xs text-muted-foreground space-y-1.5 pt-0.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      <strong className="text-foreground">Loài cây:</strong>{' '}
                      <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {editOriginalMeta.plantName || selectedPlant || 'Chưa chọn'}
                      </span>
                    </span>

                    <span className="text-muted-foreground/40">•</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        editOriginalMeta.sourceScope === 'Quốc tế'
                          ? 'bg-purple-50 text-purple-800 border-purple-200'
                          : 'bg-sky-50 text-sky-800 border-sky-200'
                      }`}
                    >
                      {editOriginalMeta.sourceScope === 'Quốc tế'
                        ? '🌐 Bài báo Nước ngoài'
                        : '🇻🇳 Bài báo Việt Nam'}
                    </span>

                    {articleDistinctTopics.length > 0 && (
                      <>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <strong className="text-foreground">Chủ đề trong bài:</strong>
                          {articleDistinctTopics.map((t, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                                t.isHealthy
                                  ? 'bg-sky-50 text-sky-800 border-sky-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              {t.label}
                            </span>
                          ))}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                    {editOriginalMeta.org ? (
                      <span>
                        <strong className="text-foreground">Cơ quan:</strong> {editOriginalMeta.org}
                      </span>
                    ) : null}

                    {editOriginalMeta.author ? (
                      <>
                        <span className="text-muted-foreground/40">•</span>
                        <span>
                          <strong className="text-foreground">Tác giả:</strong> {editOriginalMeta.author}
                        </span>
                      </>
                    ) : null}

                    {editOriginalMeta.pubDate ? (
                      <>
                        <span className="text-muted-foreground/40">•</span>
                        <span>
                          <strong className="text-foreground">Ngày đăng:</strong> {editOriginalMeta.pubDate}
                        </span>
                      </>
                    ) : null}
                  </div>

                  {isSafeHttpUrl(editUrl || ingestUrl) && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80 pt-0.5">
                      <span className="font-medium text-foreground">URL:</span>
                      <a
                        href={(editUrl || ingestUrl)!.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-muted-foreground hover:text-emerald-700 hover:underline truncate max-w-xl"
                        title={(editUrl || ingestUrl)!.trim()}
                      >
                        {(editUrl || ingestUrl)!.trim()}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Bảng chỉnh sửa thông tin: Chỉ hiển thị khi Admin nhấn "Sửa thông tin" */}
                  {showMetaEditPanel && (
                    <Card className="border-emerald-300 bg-card shadow-sm animate-in fade-in duration-200">
                      <CardHeader className="py-2.5 px-4 border-b border-border bg-emerald-50/60">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xs font-bold flex items-center gap-2 text-emerald-950">
                            <Edit3 className="w-4 h-4 text-emerald-700" />
                            <span>Chỉnh sửa thông tin bài viết &amp; Nguồn gốc</span>
                          </CardTitle>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowMetaEditPanel(false)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                            title="Đóng form chỉnh sửa"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="font-semibold text-foreground block mb-1">
                              Loài cây trồng *
                            </label>
                            <select
                              value={selectedPlant}
                              onChange={(e) => handlePlantChange(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs font-medium"
                            >
                              <option value="">-- Chọn loài cây --</option>
                              {uniquePlants.map((plant) => (
                                <option key={plant} value={plant}>
                                  {plant}
                                </option>
                              ))}
                            </select>
                          </div>
                          {renderSourceScopeSelect()}
                          <div className="sm:col-span-2">
                            {renderArticleTopicsSelector()}
                          </div>
                        </div>

                        <div>
                          <label className="font-semibold text-foreground block mb-1">
                            Tiêu đề bài viết trích dẫn *
                          </label>
                          <Input
                            type="text"
                            value={ingestTitle}
                            onChange={(e) => setIngestTitle(e.target.value)}
                            placeholder="Tiêu đề bài viết..."
                            className="text-xs bg-background"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="font-semibold text-foreground block mb-1">
                              Cơ quan / Viện nghiên cứu / Tạp chí *
                            </label>
                            <Input
                              type="text"
                              value={ingestOrg}
                              onChange={(e) => setIngestOrg(e.target.value)}
                              placeholder="Trung tâm Khuyến nông Quốc gia, Viện BVTV..."
                              className="text-xs bg-background"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-foreground block mb-1">
                              Tác giả / Nhóm nghiên cứu
                            </label>
                            <Input
                              type="text"
                              value={ingestAuthor}
                              onChange={(e) => setIngestAuthor(e.target.value)}
                              placeholder="(Để trống nếu không rõ tác giả)"
                              className="text-xs bg-background"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="font-semibold text-foreground block mb-1">
                              Ngày đăng / xuất bản
                            </label>
                            <Input
                              type="text"
                              value={ingestPublishedDate}
                              onChange={(e) => setIngestPublishedDate(e.target.value)}
                              placeholder="03/01/2024 hoặc 2024"
                              className="text-xs bg-background"
                            />
                          </div>
                          <div>
                            <label className="font-semibold text-foreground block mb-1">
                              Ngày cập nhật (nếu có)
                            </label>
                            <Input
                              type="text"
                              value={ingestUpdatedDate}
                              onChange={(e) => setIngestUpdatedDate(e.target.value)}
                              placeholder="(Để trống nếu không có)"
                              className="text-xs bg-background"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
                          <span className="text-[11px] text-muted-foreground">
                            Lưu thông tin sẽ cập nhật đồng bộ tiêu đề, tác giả, ngày xuất bản cho {editRows.length} đoạn trích.
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowMetaEditPanel(false)}
                              className="h-8 text-xs"
                            >
                              Đóng
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={!editMetaDirty || editSaving || !ingestClass}
                              onClick={() => saveEditedArticleMeta()}
                              className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                            >
                              {editSaving ? 'Đang lưu...' : 'Lưu thay đổi thông tin bài'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}


                  {/* Cảnh báo kiểm tra trùng lặp đoạn trích */}
                  {(() => {
                    const duplicates = findDuplicateChunks(editRows);
                    if (duplicates.length === 0) return null;
                    return (
                      <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs space-y-1.5 shadow-xs">
                        <div className="font-bold flex items-center gap-2 text-amber-950">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Cảnh báo: Phát hiện {duplicates.length} cặp đoạn trích có nội dung trùng lặp / tương đồng cao!</span>
                        </div>
                        <div className="space-y-1 pl-6 text-[11px] text-amber-800">
                          {duplicates.map((d, dIdx) => (
                            <div key={dIdx}>
                              • <strong>Đoạn #{d.indexA}</strong> và <strong>Đoạn #{d.indexB}</strong> có độ tương đồng ~{d.similarity}%. Bạn có thể bấm nút <em>"Xóa đoạn"</em> ở đoạn trùng thừa để tối ưu bộ nhớ AI Lavi.
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Card chứa danh sách các đoạn trích & trạng thái duyệt toàn bộ */}
                  <Card className="border-border bg-card shadow-xs">
                    <CardHeader className="py-2.5 px-4 border-b border-border bg-muted/20">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Layers className="w-4 h-4 text-emerald-700" />
                          <span className="text-xs font-bold text-foreground">
                            Các đoạn trích đã lưu ({editRows.length})
                          </span>

                          {/* Trạng thái duyệt của các đoạn trích đặt ngay tại card đoạn trích */}
                          {editRows.length > 0 && (
                            editRows.every((r) => r.isManualApproved) ? (
                              <Badge className="bg-emerald-700 text-white text-[11px] gap-1 font-semibold py-0.5 px-2">
                                <Check className="w-3 h-3" />
                                Đã duyệt toàn bộ ({editRows.length}/{editRows.length})
                              </Badge>
                            ) : editRows.filter((r) => r.isManualApproved).length === 0 ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[11px] gap-1 font-semibold py-0.5 px-2">
                                <Clock className="w-3 h-3" />
                                Chờ duyệt (0/{editRows.length})
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-300 text-[11px] gap-1 font-semibold py-0.5 px-2">
                                Duyệt một phần ({editRows.filter((r) => r.isManualApproved).length}/{editRows.length})
                              </Badge>
                            )
                          )}

                          <span className="text-[11px] text-muted-foreground">
                            • Nguyên văn: {existingVerbatimCount}/20 đoạn ({existingVerbatimChars.toLocaleString('vi-VN')} ký tự)
                          </span>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          variant={editRows.every((r) => r.isManualApproved) ? 'outline' : 'default'}
                          onClick={handleApproveAllInEdit}
                          className={`h-7 px-3 text-xs font-semibold gap-1.5 ${
                            editRows.every((r) => r.isManualApproved)
                              ? 'text-muted-foreground hover:text-destructive'
                              : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                          }`}
                          title="Duyệt hoặc bỏ duyệt nhanh toàn bộ các đoạn trong bài viết"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>
                            {editRows.every((r) => r.isManualApproved)
                              ? 'Bỏ duyệt toàn bộ bài'
                              : `Duyệt toàn bộ (${editRows.length})`}
                          </span>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3 text-xs">
                      {editLoading && editRows.length === 0 ? (
                        <p className="text-muted-foreground text-center py-6">Đang tải danh sách đoạn đã lưu...</p>
                      ) : editRows.length === 0 ? (
                        <p className="text-muted-foreground text-center py-6">Bài viết chưa có đoạn trích nào. Hãy chuyển sang Tab 2 để nạp đoạn.</p>
                      ) : (
                        editRows.map((row, rIdx) => (
                          <div key={row.id} className="p-3.5 rounded-xl border border-border bg-background space-y-2.5 shadow-2xs hover:border-emerald-200 transition-colors">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-emerald-800 font-mono text-xs">Đoạn #{rIdx + 1}</span>
                                <Badge variant="outline" className={row.isVerbatim ? 'text-emerald-800 border-emerald-300 bg-emerald-50 text-[10px]' : 'text-slate-700 border-slate-300 bg-slate-50 text-[10px]'}>
                                  {row.isVerbatim ? 'Nguyên văn' : 'Tóm tắt'}
                                </Badge>
                                <select
                                  value={row.modelClass}
                                  onChange={(e) => updateSavedUnit(row, { model_class: e.target.value })}
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border bg-background cursor-pointer ${
                                    isHealthyTopic(row.diseaseName, row.modelClass)
                                      ? 'text-sky-900 border-sky-300 bg-sky-50/50'
                                      : 'text-emerald-900 border-emerald-300 bg-emerald-50/50'
                                  }`}
                                  title="Bấm để đổi chuyên đề / bệnh hại cho đoạn trích này"
                                >
                                  {filteredDiseasesByPlant.map((d) => (
                                    <option key={d.classCode} value={d.classCode}>
                                      {formatTopicLabel(d.commonNameVi, d.classCode)}
                                    </option>
                                  ))}
                                </select>
                                <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground border border-border">
                                  {row.unitType || 'SYMPTOMS'}
                                </span>
                                {row.isManualApproved ? (
                                  <Badge className="bg-emerald-700 text-white text-[10px] gap-1">
                                    <Check className="w-3 h-3" />
                                    <span>Đã duyệt</span>
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] gap-1">
                                    <Clock className="w-3 h-3" />
                                    <span>Chờ duyệt</span>
                                  </Badge>
                                )}
                                <span className="text-[11px] text-muted-foreground">{row.evidenceText.length} ký tự</span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={row.isManualApproved ? 'outline' : 'default'}
                                  onClick={() => handleToggleApproveSingleSource(row.id, row.isManualApproved)}
                                  className={`h-7 px-2.5 text-xs font-semibold ${row.isManualApproved ? 'text-muted-foreground hover:text-destructive' : 'bg-emerald-700 hover:bg-emerald-800 text-white'}`}
                                >
                                  {row.isManualApproved ? 'Bỏ duyệt' : 'Duyệt đoạn này'}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteSingleSource(row.id)}
                                  className="h-7 px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive gap-1"
                                  title="Xóa đoạn này khỏi bài viết"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Xóa</span>
                                </Button>
                              </div>
                            </div>

                            <div className="text-xs text-foreground/90 pl-3 border-l-2 border-emerald-500/60 leading-relaxed space-y-0.5">
                              {renderParagraphWithHighlight(row.id, row.evidenceText)}
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ========================================================================= */}
                {/* TAB 2: NẠP THÊM DỮ LIỆU BÀI BÁO (GIAO DIỆN CHUẨN NHẬP BÀI BÁO ĐẦY ĐỦ CHỨC NĂNG) */}
                {/* ========================================================================= */}
                <TabsContent value="reparse" className="space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Cột trái: Form nhập bài báo (URL + Tip Ctrl+A + Dán toàn văn + Nút Bóc tách) */}
                    <div className="lg:col-span-5 space-y-4">
                      <Card className="border-border bg-card shadow-xs">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-emerald-700" />
                            <span>Dán lại văn bản để bóc tách thêm</span>
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Hệ thống sẽ bóc tách các đoạn mới và tự động lọc bỏ những đoạn đã lưu ở Tab 1 để tránh trùng lặp.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <form onSubmit={handleParseArticle} className="space-y-4 text-xs">
                            <div>
                              <label className="font-semibold text-foreground block mb-1">
                                1. Đường dẫn URL bài viết gốc *
                              </label>
                              <div className="flex items-center gap-1.5">
                                <Input
                                  type="url"
                                  value={editUrl || ingestUrl}
                                  readOnly
                                  className="text-xs flex-1 bg-muted/40 cursor-default"
                                />
                                {isSafeHttpUrl(editUrl || ingestUrl) && (
                                  <a
                                    href={(editUrl || ingestUrl)!.trim()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center h-8 px-2.5 border border-border rounded-md bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-xs shrink-0 transition-colors"
                                    title="Mở link bài viết trong tab mới để copy văn bản"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
                                  </a>
                                )}
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-[11px] text-muted-foreground">
                                  Đang nạp thêm cho bài viết này
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewImagePlant(selectedPlant);
                                    setNewImageClass(ingestClass);
                                    setNewImageSourceUrl(editUrl || ingestUrl);
                                    setNewImageCredit(ingestOrg || 'Trung tâm Khuyến nông');
                                    setAddImageModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                  <span>Thêm ảnh triệu chứng từ bài này</span>
                                </button>
                              </div>
                            </div>

                            {renderArticleEditorSection({ isReparseTab: true })}

                            <Button
                              type="submit"
                              disabled={ingesting}
                              className="w-full gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-10"
                            >
                              {ingesting ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  <span>Đang bóc tách &amp; Phân tích văn bản...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4" />
                                  <span>Tách đoạn &amp; Phân tích dữ liệu mới</span>
                                </>
                              )}
                            </Button>
                          </form>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Cột phải: Thông tin bài viết & Danh sách đoạn trích mới (Bỏ hẳn banner so sánh rời rạc) */}
                    <div className="lg:col-span-7 space-y-4">
                      {!ingestionResult ? (
                        <div className="p-12 text-center bg-card border border-border rounded-xl h-full flex flex-col items-center justify-center space-y-3">
                          <FileText className="w-12 h-12 text-muted-foreground/30" />
                          <h3 className="text-base font-bold text-foreground">Chưa có văn bản bóc tách</h3>
                          <p className="text-xs text-muted-foreground max-w-sm">
                            Dán nội dung vào ô bên trái rồi bấm <strong>"Tách đoạn &amp; Phân tích dữ liệu mới"</strong> để AI bóc tách các đoạn mới và đề xuất thông tin bài viết.
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* Card 1: Thông tin bài viết & Phân loại: Lấp lánh từng ô, nhấp mở popover Áp dụng/Bỏ qua, hỗ trợ thu gọn */}
                          {(() => {
                            const meta = ingestionResult.suggested_metadata;
                            const suggestedTitle = meta?.source_title?.trim() || '';
                            const { org: suggestedOrg, author: suggestedAuthor } = parseCombinedOrg(meta?.organization);
                            const { pubDate: suggestedPubDate, upDate: suggestedUpDate } = parseCombinedDate(meta?.published_date);

                            const hasTitleDiff = !!suggestedTitle && suggestedTitle !== ingestTitle.trim() && !dismissedAiFields['title'];
                            const hasOrgDiff = !!suggestedOrg && suggestedOrg !== ingestOrg.trim() && !dismissedAiFields['org'];
                            const hasAuthorDiff = !!suggestedAuthor && suggestedAuthor !== ingestAuthor.trim() && !dismissedAiFields['author'];
                            const hasPubDateDiff = !!suggestedPubDate && suggestedPubDate !== ingestPublishedDate.trim() && !dismissedAiFields['pubDate'];
                            const hasUpDateDiff = !!suggestedUpDate && suggestedUpDate !== ingestUpdatedDate.trim() && !dismissedAiFields['upDate'];
                            const pendingDiffCount =
                              (hasTitleDiff ? 1 : 0) +
                              (hasOrgDiff ? 1 : 0) +
                              (hasAuthorDiff ? 1 : 0) +
                              (hasPubDateDiff ? 1 : 0) +
                              (hasUpDateDiff ? 1 : 0);

                            return (
                              <Card className="border-border bg-card shadow-xs transition-all">
                                <CardHeader className="py-2.5 px-4 border-b border-border bg-muted/20">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <FileText className="w-4 h-4 text-emerald-700" />
                                      <CardTitle className="text-xs font-bold text-foreground">
                                        Thông tin bài viết &amp; Phân loại
                                      </CardTitle>
                                      {pendingDiffCount > 0 && (
                                        <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] gap-1 animate-pulse">
                                          <Sparkles className="w-3 h-3 text-amber-600" />
                                          {pendingDiffCount} ô có AI đề xuất
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      {pendingDiffCount > 0 && (
                                        <>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                              setDismissedAiFields((prev) => ({
                                                ...prev,
                                                title: true,
                                                org: true,
                                                author: true,
                                                pubDate: true,
                                                upDate: true,
                                              }));
                                              setActiveAiPopoverField(null);
                                              toast.info('Đã bỏ qua các đề xuất của AI.');
                                            }}
                                            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                                            title="Bỏ qua tất cả các gợi ý của AI và giữ nguyên dữ liệu hiện tại"
                                          >
                                            Bỏ qua tất cả
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => {
                                              if (suggestedTitle) setIngestTitle(suggestedTitle);
                                              if (suggestedOrg) setIngestOrg(suggestedOrg);
                                              if (suggestedAuthor) setIngestAuthor(suggestedAuthor);
                                              if (suggestedPubDate) setIngestPublishedDate(suggestedPubDate);
                                              if (suggestedUpDate) setIngestUpdatedDate(suggestedUpDate);
                                              setDismissedAiFields((prev) => ({
                                                ...prev,
                                                title: true,
                                                org: true,
                                                author: true,
                                                pubDate: true,
                                                upDate: true,
                                              }));
                                              setActiveAiPopoverField(null);
                                              setIsMetaCardCollapsed(true);
                                              toast.success('Đã áp dụng toàn bộ đề xuất của AI và thu gọn form!');
                                            }}
                                            className="h-6 px-2 text-[10px] bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-1"
                                            title="Áp dụng toàn bộ gợi ý AI vào form và tự động thu gọn"
                                          >
                                            <Check className="w-3 h-3" />
                                            Áp dụng tất cả
                                          </Button>
                                        </>
                                      )}

                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setIsMetaCardCollapsed(!isMetaCardCollapsed)}
                                        className="h-6 px-2 text-[10px] gap-1 border-border text-muted-foreground hover:text-foreground"
                                        title={isMetaCardCollapsed ? 'Mở rộng form thông tin bài viết' : 'Thu gọn form để tập trung xem các đoạn trích'}
                                      >
                                        {isMetaCardCollapsed ? (
                                          <>
                                            <ChevronDown className="w-3 h-3" />
                                            <span>Mở rộng form</span>
                                          </>
                                        ) : (
                                          <>
                                            <ChevronUp className="w-3 h-3" />
                                            <span>Thu gọn</span>
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                </CardHeader>

                                {isMetaCardCollapsed ? (
                                  renderMetaCollapsedSummary()
                                ) : (
                                  /* Chế độ mở rộng: Các ô input sạch sẽ, ô có AI đề xuất sẽ có viền lấp lánh nhẹ và popover */
                                  <CardContent className="p-4 space-y-3 text-xs">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                      <div>
                                        <label className="font-semibold text-foreground block mb-1">
                                          Loài cây trồng *
                                        </label>
                                        <select
                                          value={selectedPlant}
                                          onChange={(e) => handlePlantChange(e.target.value)}
                                          className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs font-medium"
                                        >
                                          <option value="">-- Chọn loài cây --</option>
                                          {uniquePlants.map((plant) => (
                                            <option key={plant} value={plant}>
                                              {plant}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      {renderSourceScopeSelect()}
                                      <div className="sm:col-span-2">
                                        {renderArticleTopicsSelector()}
                                      </div>
                                    </div>

                                    {/* Tiêu đề bài viết trích dẫn */}
                                    {renderAiMetaFieldInput({
                                      fieldKey: 'title',
                                      label: 'Tiêu đề bài viết trích dẫn *',
                                      value: ingestTitle,
                                      onChange: setIngestTitle,
                                      placeholder: 'Tiêu đề bài viết...',
                                      hasDiff: hasTitleDiff,
                                      suggestedValue: suggestedTitle,
                                      applyToast: 'Đã áp dụng tiêu đề AI đề xuất!',
                                    })}

                                    {/* Cơ quan & Tác giả */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                      {renderAiMetaFieldInput({
                                        fieldKey: 'org',
                                        label: 'Cơ quan / Viện nghiên cứu *',
                                        value: ingestOrg,
                                        onChange: setIngestOrg,
                                        placeholder: 'Trung tâm Khuyến nông...',
                                        hasDiff: hasOrgDiff,
                                        suggestedValue: suggestedOrg,
                                        applyToast: 'Đã áp dụng cơ quan AI đề xuất!',
                                      })}

                                      {renderAiMetaFieldInput({
                                        fieldKey: 'author',
                                        label: 'Tác giả / Nhóm nghiên cứu',
                                        value: ingestAuthor,
                                        onChange: setIngestAuthor,
                                        placeholder: '(Để trống nếu không rõ tác giả)',
                                        mutedPlaceholder: true,
                                        hasDiff: hasAuthorDiff,
                                        suggestedValue: suggestedAuthor,
                                        applyToast: 'Đã áp dụng tác giả AI đề xuất!',
                                        popoverAlign: 'right',
                                      })}
                                    </div>

                                    {/* Ngày đăng & Ngày cập nhật */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                      {renderAiMetaFieldInput({
                                        fieldKey: 'pubDate',
                                        label: 'Ngày đăng / xuất bản',
                                        value: ingestPublishedDate,
                                        onChange: setIngestPublishedDate,
                                        placeholder: '03/01/2024',
                                        hasDiff: hasPubDateDiff,
                                        suggestedValue: suggestedPubDate,
                                        applyToast: 'Đã áp dụng ngày xuất bản AI đề xuất!',
                                      })}

                                      {renderAiMetaFieldInput({
                                        fieldKey: 'upDate',
                                        label: 'Ngày cập nhật (nếu có)',
                                        value: ingestUpdatedDate,
                                        onChange: setIngestUpdatedDate,
                                        placeholder: '(Để trống nếu không có)',
                                        mutedPlaceholder: true,
                                        hasDiff: hasUpDateDiff,
                                        suggestedValue: suggestedUpDate,
                                        applyToast: 'Đã áp dụng ngày cập nhật AI đề xuất!',
                                        popoverAlign: 'right',
                                      })}
                                    </div>
                                  </CardContent>
                                )}
                              </Card>
                            );
                          })()}

                          {/* Card 2: Danh sách các đoạn trích mới (Đã tự động loại bỏ các đoạn đã lưu ở Tab 1) */}
                          {(() => {
                            const newParagraphs = ingestionResult.paragraphs.filter(
                              (p) => !savedVerbatimTexts.has(collapseWs(p.text))
                            );
                            const suggestedNewParagraphs = ingestionResult.ai_suggestion_available
                              ? newParagraphs.filter((p) => p.suggested_unit_type !== null)
                              : newParagraphs;
                            const unselectedNewParagraphs = ingestionResult.ai_suggestion_available
                              ? newParagraphs.filter((p) => p.suggested_unit_type === null)
                              : [];

                            if (newParagraphs.length === 0) {
                              return (
                                <div className="p-6 text-center bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs space-y-2">
                                  <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto" />
                                  <div className="font-bold text-sm">Tất cả các đoạn trích đã được lưu trong CSDL!</div>
                                  <p className="text-[11px] text-emerald-700 max-w-sm mx-auto">
                                    Không tìm thấy đoạn trích mới nào so với các đoạn đã lưu ở Tab 1. Bạn có thể quay lại Tab 1 để xem và duyệt các đoạn này.
                                  </p>
                                </div>
                              );
                            }

                            return (
                              <Card className="border-border bg-card shadow-xs">
                                <CardHeader className="pb-3 border-b border-border">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <div>
                                      <CardTitle className="text-xs font-bold flex items-center gap-2">
                                        <span>Đoạn trích mới ({newParagraphs.length} đoạn chưa lưu)</span>
                                        {ingestionResult.ai_suggestion_available ? (
                                          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px]">
                                            AI đã gợi ý nhãn
                                          </Badge>
                                        ) : (
                                          <Badge variant="outline" className="text-amber-700 border-amber-300 text-[10px]">
                                            Tự gán nhãn
                                          </Badge>
                                        )}
                                      </CardTitle>
                                      <CardDescription className="text-xs mt-0.5">
                                        Tick chọn các đoạn cần nạp thêm vào bài viết này (tối đa 20 đoạn nguyên văn/bài).
                                      </CardDescription>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={handleSelectAllAiSuggested}
                                        className="h-6 text-[10px] gap-1 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-300 font-semibold"
                                        title="Tự động tick chọn tất cả các đoạn trích theo gợi ý của AI"
                                      >
                                        <Sparkles className="w-3 h-3 text-emerald-700" />
                                        <span>Chọn tất cả đoạn AI gợi ý</span>
                                      </Button>
                                      <Badge variant="secondary" className="bg-muted text-foreground text-[11px]">
                                        Đoạn: {countWithSaved} / 20
                                      </Badge>
                                      <Badge
                                        variant="secondary"
                                        className={charsWithSaved > allowedCharsQuota ? 'bg-destructive text-white' : 'bg-muted text-foreground text-[11px]'}
                                      >
                                        <span title="Giới hạn = 60% độ dài bài, tối thiểu 2.500 ký tự">
                                          Ký tự: {charsWithSaved.toLocaleString('vi-VN')} / {allowedCharsQuota.toLocaleString('vi-VN')} ({Math.min(100, Math.round((charsWithSaved / allowedCharsQuota) * 100))}%)
                                        </span>
                                      </Badge>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
                                  {suggestedNewParagraphs.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic text-center py-2">
                                      AI không đề xuất thêm đoạn nào trong phần chưa lưu; bạn có thể mở mục 'Đoạn AI không chọn' bên dưới để kiểm tra và tick thủ công.
                                    </p>
                                  ) : (
                                    suggestedNewParagraphs.map((para) => renderParagraphReviewCard(para))
                                  )}

                                  {renderUnselectedParagraphsAccordion(unselectedNewParagraphs)}

                                  <div className="pt-3 border-t border-border flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">
                                      Đã chọn <strong>{countSelected}</strong> đoạn mới cần lưu.
                                    </span>
                                    <Button
                                      type="button"
                                      onClick={handleCommitParagraphs}
                                      disabled={committing || countSelected === 0 || countWithSaved > 20}
                                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-9 text-xs px-4"
                                    >
                                      {committing ? 'Đang lưu...' : `Lưu & Duyệt ${countSelected} đoạn mới`}
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            )
          ) : (
            /* ========================================================================= */
            /* CHẾ ĐỘ NHẬP BÀI BÁO MỚI (HITL INGESTION) */
            /* ========================================================================= */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Cột trái: Form nhập bài */}
              <div className="lg:col-span-5 space-y-6">
                <Card className="border-border bg-card shadow-xs">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-700" />
                      <span>Dán văn bản bài báo khuyến nông</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Server không tự tải URL để chống SSRF. Admin copy văn bản từ bài báo/PDF dán vào đây (hỗ trợ Ctrl+A cả trang).
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <form onSubmit={handleParseArticle} className="space-y-4 text-xs">
                      <div>
                        <label className="font-semibold text-foreground block mb-1">
                          1. Đường dẫn URL bài viết gốc *
                        </label>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="url"
                            placeholder="https://khuyennongvn.gov.vn/..."
                            value={ingestUrl}
                            onChange={(e) => {
                              setIngestUrl(e.target.value);
                              if (ingestionResult) resetArticleState();
                            }}
                            required
                            className="text-xs flex-1"
                          />
                          {isSafeHttpUrl(ingestUrl) && (
                            <a
                              href={ingestUrl.trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center h-8 px-2.5 border border-border rounded-md bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-xs shrink-0 transition-colors"
                              title="Mở link bài viết trong tab mới"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[11px] text-muted-foreground">
                            {ingestUrl ? 'Đã liên kết nguồn' : 'Dán link trang báo khuyến nông'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setNewImagePlant(selectedPlant);
                              setNewImageClass(ingestClass);
                              setNewImageSourceUrl(ingestUrl);
                              setNewImageCredit(ingestOrg || 'Trung tâm Khuyến nông');
                              setAddImageModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Thêm ảnh triệu chứng từ bài này</span>
                          </button>
                        </div>
                      </div>

                      {renderArticleEditorSection()}

                      <Button
                        type="submit"
                        disabled={ingesting}
                        className="w-full gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-10"
                      >
                        {ingesting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Đang bóc tách &amp; Gọi AI phân tích...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Tách đoạn &amp; AI Tự Điền Thông Tin</span>
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Cột phải: Thông tin & Danh sách đoạn trích mới */}
              <div className="lg:col-span-7 space-y-4">
                {ingestionResult && (
                  <Card className="border-border bg-card shadow-xs transition-all">
                    <CardHeader className="py-3 px-4 border-b border-border bg-muted/20">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle className="text-xs font-bold flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-700" />
                          <span>Thông tin bài viết &amp; Phân loại</span>
                        </CardTitle>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-emerald-800 border-emerald-300 bg-emerald-50 text-[10px]">
                            AI đề xuất, vui lòng kiểm tra lại
                          </Badge>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setIsMetaCardCollapsed(!isMetaCardCollapsed)}
                            className="h-6 px-2 text-[10px] gap-1 border-border text-muted-foreground hover:text-foreground"
                            title={isMetaCardCollapsed ? 'Mở rộng form thông tin bài viết' : 'Thu gọn form để tập trung xem các đoạn trích'}
                          >
                            {isMetaCardCollapsed ? (
                              <>
                                <ChevronDown className="w-3 h-3" />
                                <span>Mở rộng form</span>
                              </>
                            ) : (
                              <>
                                <ChevronUp className="w-3 h-3" />
                                <span>Thu gọn</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {isMetaCardCollapsed ? (
                      renderMetaCollapsedSummary()
                    ) : (
                      <CardContent className="p-4 space-y-3 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="font-semibold text-foreground block mb-1">
                            Loài cây trồng *
                          </label>
                          <select
                            value={selectedPlant}
                            onChange={(e) => handlePlantChange(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs font-medium"
                          >
                            <option value="">-- Chọn loài cây --</option>
                            {uniquePlants.map((plant) => (
                              <option key={plant} value={plant}>
                                {plant}
                              </option>
                            ))}
                          </select>
                        </div>
                        {renderSourceScopeSelect()}
                        <div className="sm:col-span-2">
                          {renderArticleTopicsSelector()}
                        </div>
                      </div>

                      <div>
                        <label className="font-semibold text-foreground block mb-1">
                          Tiêu đề bài viết trích dẫn *
                        </label>
                        <Input
                          type="text"
                          value={ingestTitle}
                          onChange={(e) => setIngestTitle(e.target.value)}
                          placeholder="Tiêu đề bài viết..."
                          className="text-xs bg-background"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="font-semibold text-foreground block mb-1">
                            Cơ quan / Viện nghiên cứu *
                          </label>
                          <Input
                            type="text"
                            value={ingestOrg}
                            onChange={(e) => setIngestOrg(e.target.value)}
                            placeholder="Trung tâm Khuyến nông..."
                            className="text-xs bg-background"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-foreground block mb-1">
                            Tác giả / Nhóm nghiên cứu
                          </label>
                          <Input
                            type="text"
                            value={ingestAuthor}
                            onChange={(e) => setIngestAuthor(e.target.value)}
                            placeholder="(Để trống nếu không rõ tác giả)"
                            className="text-xs bg-background placeholder:text-muted-foreground/35 placeholder:italic"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="font-semibold text-foreground block mb-1">
                            Ngày đăng / xuất bản
                          </label>
                          <Input
                            type="text"
                            value={ingestPublishedDate}
                            onChange={(e) => setIngestPublishedDate(e.target.value)}
                            placeholder="03/01/2024"
                            className="text-xs bg-background"
                          />
                        </div>
                        <div>
                          <label className="font-semibold text-foreground block mb-1">
                            Ngày cập nhật (nếu có)
                          </label>
                          <Input
                            type="text"
                            value={ingestUpdatedDate}
                            onChange={(e) => setIngestUpdatedDate(e.target.value)}
                            placeholder="(Để trống nếu không có)"
                            className="text-xs bg-background placeholder:text-muted-foreground/35 placeholder:italic"
                          />
                        </div>
                      </div>
                      </CardContent>
                    )}
                  </Card>
                )}

                {!ingestionResult ? (
                  <div className="p-12 text-center bg-card border border-border rounded-xl h-full flex flex-col items-center justify-center space-y-3">
                    <FileText className="w-12 h-12 text-muted-foreground/30" />
                    <h3 className="text-base font-bold text-foreground">Chưa có dữ liệu bài báo</h3>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Dán URL và nội dung bài báo ở cột bên trái rồi bấm <strong>"Tách đoạn &amp; AI Tự Điền Thông Tin"</strong> để bắt đầu trích dẫn nguyên văn.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* BƯỚC 2B: DANH SÁCH ĐOẠN TRÍCH NGUYÊN VĂN */}
                    <Card className="border-border bg-card shadow-xs flex flex-col">
                      <CardHeader className="pb-3 border-b border-border">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                              <span>Đoạn văn bản trích dẫn ({ingestionResult.paragraphs.length} đoạn)</span>
                              {ingestionResult.ai_suggestion_available ? (
                                <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px]">
                                  AI đã gợi ý nhãn
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-amber-700 border-amber-300 text-[10px]">
                                  Tự gán nhãn
                                </Badge>
                              )}
                            </CardTitle>
                            <CardDescription className="text-xs mt-0.5">
                              Quy tắc trích dẫn hợp lý: <strong>Tối đa 20 đoạn nguyên văn</strong> (≤ 1.500 ký tự/đoạn, tổng ≤ 60% bài). Tick = Duyệt.
                            </CardDescription>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={handleSelectAllAiSuggested}
                              className="h-6 text-[10px] gap-1 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-300 font-semibold"
                              title="Tự động tick chọn tất cả các đoạn trích theo gợi ý của AI"
                            >
                              <Sparkles className="w-3 h-3 text-emerald-700" />
                              <span>Chọn tất cả đoạn AI gợi ý</span>
                            </Button>
                            <Badge
                              variant="secondary"
                              className={countWithSaved > 20 ? 'bg-destructive text-white' : 'bg-muted text-foreground text-[11px]'}
                            >
                              Đoạn: {countWithSaved} / 20
                            </Badge>
                            <Badge
                              variant="secondary"
                              className={charsWithSaved > allowedCharsQuota ? 'bg-destructive text-white' : 'bg-muted text-foreground text-[11px]'}
                            >
                              <span title="Giới hạn = 60% độ dài bài, tối thiểu 2.500 ký tự">
                                Ký tự: {charsWithSaved.toLocaleString('vi-VN')} / {allowedCharsQuota.toLocaleString('vi-VN')} ({((charsWithSaved / allowedCharsQuota) * 100).toFixed(0)}%)
                              </span>
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 flex-1 overflow-y-auto max-h-[500px] space-y-3">
                        {/* Danh sách các đoạn liên quan & nhóm đoạn AI không chọn */}
                        {(() => {
                          const suggestedList = ingestionResult.ai_suggestion_available
                            ? ingestionResult.paragraphs.filter((p) => p.suggested_unit_type !== null)
                            : ingestionResult.paragraphs;
                          const unselectedList = ingestionResult.ai_suggestion_available
                            ? ingestionResult.paragraphs.filter((p) => p.suggested_unit_type === null)
                            : [];

                          return (
                            <>
                              {suggestedList.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic text-center py-2">
                                  AI chưa chọn đoạn nổi bật nào; bạn có thể mở mục 'Đoạn AI không chọn' bên dưới để tự chọn.
                                </p>
                              ) : (
                                suggestedList.map((para) => renderParagraphReviewCard(para))
                              )}

                              {renderUnselectedParagraphsAccordion(unselectedList)}
                            </>
                          );
                        })()}
                      </CardContent>

                      <div className="p-4 border-t border-border bg-muted/20 space-y-3">
                        <Input
                          type="text"
                          placeholder="Ghi chú người duyệt (ví dụ: Đã đối chiếu thông tư Cục BVTV)"
                          value={commitNotes}
                          onChange={(e) => setCommitNotes(e.target.value)}
                          className="text-xs bg-background"
                        />

                        {charsWithSaved > allowedCharsQuota && (
                          <p className="text-xs text-destructive font-medium">
                            {existingVerbatimChars > 0 ? `Đã lưu ${existingVerbatimChars.toLocaleString('vi-VN')} + chọn thêm ` : 'Đã chọn '}{totalSelectedChars.toLocaleString('vi-VN')} ký tự, vượt giới hạn trích dẫn {allowedCharsQuota.toLocaleString('vi-VN')} ký tự
                            (60% bài, tối thiểu 2.500). Bỏ bớt đoạn để lưu được.
                          </p>
                        )}
                        {!ingestClass && (
                          <p className="text-xs text-destructive font-medium">Chọn Loài cây và Bệnh hại mục tiêu ở trên trước khi lưu.</p>
                        )}
                        <Button
                          onClick={handleCommitParagraphs}
                          disabled={committing || editSaving || countSelected === 0 || countWithSaved > 20 || charsWithSaved > allowedCharsQuota || !ingestClass}
                          className="w-full gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-11"
                        >
                          {committing ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Đang ghi CSDL &amp; Đồng bộ tri thức AI...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Duyệt &amp; Lưu {countSelected} Đoạn Nguyên Văn (Đồng bộ tri thức)</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ========================================================================================= */}
        {/* TAB 2: KIỂM DUYỆT TRI THỨC HITL (CURATION TABLE) */}
        {/* ========================================================================================= */}
        <TabsContent value="curation" className="space-y-4">
          {/* Toolbar lọc */}
          <div className="bg-card p-4 rounded-xl border border-border shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Tìm theo tiêu đề, cơ quan, cây, bệnh..."
                  value={sourceSearch}
                  onChange={(e) => {
                    setSourceSearch(e.target.value);
                    setCurationPage(1);
                  }}
                  className="pl-8 text-xs h-9 bg-background"
                />
              </div>

              <select
                value={sourceFilterPlant}
                onChange={(e) => {
                  setSourceFilterPlant(e.target.value);
                  setSourceFilterClass('ALL');
                  setCurationPage(1);
                }}
                className="h-9 px-2.5 bg-background border border-border rounded-lg text-xs"
              >
                <option value="ALL">Tất cả cây trồng ({uniquePlants.length})</option>
                {uniquePlants.map((plant) => (
                  <option key={plant} value={plant}>
                    {plant}
                  </option>
                ))}
              </select>

              <select
                value={sourceFilterClass}
                onChange={(e) => {
                  setSourceFilterClass(e.target.value);
                  setCurationPage(1);
                }}
                className="h-9 px-2.5 bg-background border border-border rounded-lg text-xs"
              >
                <option value="ALL">
                  {sourceFilterPlant === 'ALL'
                    ? 'Tất cả chuyên mục & bệnh hại'
                    : `Tất cả chuyên mục của ${sourceFilterPlant}`}
                </option>
                {diseases
                  .filter((d) => sourceFilterPlant === 'ALL' || d.plantName === sourceFilterPlant)
                  .map((d) => (
                    <option key={d.classCode} value={d.classCode}>
                      {sourceFilterPlant === 'ALL'
                        ? `${d.plantName} – ${formatTopicLabel(d.commonNameVi, d.classCode)}`
                        : formatTopicLabel(d.commonNameVi, d.classCode)}
                    </option>
                  ))}
              </select>

              <select
                value={sourceOriginFilter}
                onChange={(e) => {
                  setSourceOriginFilter(e.target.value as 'ALL' | 'Việt Nam' | 'Quốc tế');
                  setCurationPage(1);
                }}
                className="h-9 px-2.5 bg-background border border-border rounded-lg text-xs"
              >
                <option value="ALL">Tất cả nguồn (VN &amp; Nước ngoài)</option>
                <option value="Việt Nam">🇻🇳 Bài báo Việt Nam</option>
                <option value="Quốc tế">🌐 Bài báo Nước ngoài (Quốc tế)</option>
              </select>

              <select
                value={sourceApprovalFilter}
                onChange={(e) => {
                  setSourceApprovalFilter(e.target.value as any);
                  setCurationPage(1);
                }}
                className="h-9 px-2.5 bg-background border border-border rounded-lg text-xs"
              >
                <option value="ALL">Tất cả trạng thái duyệt</option>
                <option value="APPROVED">Đã duyệt (sẵn sàng cho Lavi)</option>
                <option value="PENDING">Chờ duyệt</option>
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {selectedSourceIds.length > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={batchActionLoading}
                    onClick={() => handleBatchApprove(true)}
                    className="h-9 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs"
                  >
                    Duyệt hàng loạt ({selectedSourceIds.length})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={batchActionLoading}
                    onClick={() => handleBatchApprove(false)}
                    className="h-9 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    Bỏ duyệt hàng loạt
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={batchActionLoading}
                    onClick={() => setDeleteBatchModalOpen(true)}
                    className="h-9 text-xs font-semibold gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa hàng loạt ({selectedSourceIds.length})</span>
                  </Button>
                </>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={fetchSources}
                disabled={loadingSources}
                className="h-9 bg-card border-border hover:bg-muted text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingSources ? 'animate-spin' : ''}`} />
                Làm mới
              </Button>

              {/* Nút chuyển đổi chế độ xem: Gộp theo bài viết hoặc xem từng dòng */}
              <Button
                variant={groupByArticle ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setGroupByArticle(!groupByArticle);
                  setCurationPage(1);
                }}
                className={`h-9 text-xs gap-1.5 ${groupByArticle
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white font-semibold'
                    : 'bg-card border-border hover:bg-muted text-foreground'
                  }`}
                title={
                  groupByArticle
                    ? 'Đang gộp theo bài viết. Bấm để xem danh sách phẳng từng dòng'
                    : 'Đang xem từng dòng. Bấm để gộp theo bài viết'
                }
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{groupByArticle ? 'Gộp bài viết' : 'Từng dòng'}</span>
              </Button>
            </div>
          </div>

          {/* Table */}
          <Card className="border-border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                {groupByArticle ? (
                  // ==================== BẢNG CHẾ ĐỘ GỘP THEO BÀI VIẾT ====================
                  <>
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                      <tr>
                        <th className="p-3 w-8">
                          <input
                            type="checkbox"
                            checked={
                              filteredSources.length > 0 &&
                              filteredSources.every((s) => selectedSourceIds.includes(s.id))
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSourceIds(filteredSources.map((s) => s.id));
                              } else {
                                setSelectedSourceIds([]);
                              }
                            }}
                            className="rounded"
                          />
                        </th>
                        <th className="p-3">Bài viết &amp; Cơ quan</th>
                        <th className="p-3">Cây &amp; Chuyên mục</th>
                        <th className="p-3 text-center">Các đoạn trích</th>
                        <th className="p-3 text-center">Trạng thái duyệt</th>
                        <th className="p-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {loadingSources ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground">
                            Đang tải danh sách nguồn tri thức...
                          </td>
                        </tr>
                      ) : groupedArticles.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground">
                            Không tìm thấy bài viết nào phù hợp.
                          </td>
                        </tr>
                      ) : (
                        pagedArticles.map((group) => {
                          const isExpanded = expandedArticleKeys.has(group.key);
                          const isGroupAllSelected = group.paragraphs.every((p) =>
                            selectedSourceIds.includes(p.id)
                          );
                          const isGroupSomeSelected =
                            !isGroupAllSelected &&
                            group.paragraphs.some((p) => selectedSourceIds.includes(p.id));
                          const isAllApproved = group.approvedCount === group.totalCount;

                          return (
                            <React.Fragment key={group.key}>
                              {/* Dòng bài viết tổng hợp */}
                              <tr
                                className={`hover:bg-muted/30 transition-colors ${isExpanded ? 'bg-muted/20 font-medium' : ''
                                  }`}
                              >
                                <td className="p-3">
                                  <input
                                    type="checkbox"
                                    checked={isGroupAllSelected}
                                    ref={(el) => {
                                      if (el) el.indeterminate = isGroupSomeSelected;
                                    }}
                                    onChange={(e) => {
                                      const groupIds = group.paragraphs.map((p) => p.id);
                                      if (e.target.checked) {
                                        setSelectedSourceIds((prev) => [
                                          ...prev,
                                          ...groupIds.filter((id) => !prev.includes(id)),
                                        ]);
                                      } else {
                                        setSelectedSourceIds((prev) =>
                                          prev.filter((id) => !groupIds.includes(id))
                                        );
                                      }
                                    }}
                                    className="rounded"
                                  />
                                </td>
                                <td className="p-3 max-w-[280px]">
                                  <div className="min-w-0">
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/admin/ingest?edit=${encodeURIComponent(group.sourceUrl)}`)}
                                      className="font-bold text-foreground text-left line-clamp-1 hover:text-emerald-700 hover:underline block cursor-pointer"
                                      title="Mở chi tiết bài viết"
                                    >
                                      {group.sourceTitle}
                                    </button>
                                    <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                      {group.organization}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                      {renderOriginPill(group.sourceScope, true)}
                                      <a
                                        href={group.sourceUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[10px] text-emerald-700 hover:underline inline-flex items-center gap-0.5"
                                      >
                                        <span>Xem bài gốc</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <span className="font-semibold text-foreground block">{group.primaryPlantName}</span>
                                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                    <span className="text-[11px] text-muted-foreground">
                                      {formatTopicLabel(group.primaryDiseaseName, group.primaryModelClass)}
                                    </span>
                                    {group.diseasesList.length > 1 && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-300 px-1 py-0"
                                        title={`Bài báo đề cập đến ${group.diseasesList.length} chuyên mục: ${group.diseasesList.map((d) => `${d.plantName} – ${formatTopicLabel(d.diseaseName, d.modelClass)}`).join(', ')}`}
                                      >
                                        +{group.diseasesList.length - 1} chuyên mục khác
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 text-center whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 text-foreground text-xs font-medium border border-border/60">
                                    <Layers className="w-3.5 h-3.5 text-emerald-700" />
                                    <span>{group.totalCount} đoạn</span>
                                  </span>
                                </td>
                                <td className="p-3 text-center whitespace-nowrap">
                                  {isAllApproved ? (
                                    <Badge className="bg-emerald-700 text-white text-[10px] gap-1">
                                      <Check className="w-3 h-3" />
                                      Đã duyệt ({group.approvedCount}/{group.totalCount})
                                    </Badge>
                                  ) : group.approvedCount === 0 ? (
                                    <Badge
                                      variant="outline"
                                      className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] gap-1"
                                    >
                                      <Clock className="w-3 h-3" />
                                      Chưa duyệt (0/{group.totalCount})
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="bg-blue-50 text-blue-800 border-blue-300 text-[10px] gap-1"
                                    >
                                      Duyệt một phần ({group.approvedCount}/{group.totalCount})
                                    </Badge>
                                  )}
                                </td>
                                <td className="p-3 text-right whitespace-nowrap space-x-1.5">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => navigate(`/admin/ingest?edit=${encodeURIComponent(group.sourceUrl)}`)}
                                    className="h-7 px-3 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-1.5"
                                    title="Mở bài viết để xem thông tin, duyệt từng đoạn, hoặc nạp thêm đoạn mới"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>Mở bài viết</span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setDeleteArticleTarget(group)}
                                    className="h-7 px-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
                                    title="Xóa toàn bộ các đoạn của bài viết này khỏi kho tri thức"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Xóa bài</span>
                                  </Button>
                                </td>
                              </tr>

                              {/* Dòng mở rộng đã được thay thế bằng màn hình chi tiết bài viết tập trung */}
                              {false && (
                                <tr className="bg-muted/20 border-b border-border/80">
                                  <td colSpan={6} className="p-3 sm:p-4 pl-6 sm:pl-12">
                                    <div className="space-y-2.5 rounded-xl border border-border/70 bg-card p-3 sm:p-3.5 shadow-2xs">
                                      <div className="text-xs font-semibold text-foreground flex items-center justify-between border-b border-border/60 pb-2">
                                        <span className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                                          <FileText className="w-3.5 h-3.5 text-emerald-700" />
                                          Chi tiết {group.paragraphs.length} đoạn trích của bài báo:
                                        </span>
                                        <span className="text-[11px] text-muted-foreground font-normal">
                                          Đã duyệt {group.approvedCount}/{group.totalCount} đoạn
                                        </span>
                                      </div>

                                      <div className="space-y-2">
                                        {group.paragraphs.map((p, pIdx) => {
                                          const isParagraphSelected = selectedSourceIds.includes(p.id);
                                          return (
                                            <div
                                              key={p.id}
                                              className={`p-2.5 sm:p-3 rounded-lg border text-xs transition-colors ${isParagraphSelected
                                                  ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20'
                                                  : 'border-border/70 bg-background hover:border-border'
                                                }`}
                                            >
                                              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                                                <div className="flex items-center gap-2">
                                                  <input
                                                    type="checkbox"
                                                    checked={isParagraphSelected}
                                                    onChange={(e) => {
                                                      if (e.target.checked) {
                                                        setSelectedSourceIds((prev) => [...prev, p.id]);
                                                      } else {
                                                        setSelectedSourceIds((prev) =>
                                                          prev.filter((id) => id !== p.id)
                                                        );
                                                      }
                                                    }}
                                                    className="rounded"
                                                  />
                                                  <span className="font-semibold text-foreground text-xs">
                                                    Đoạn #{pIdx + 1}
                                                  </span>
                                                  {p.isVerbatim ? (
                                                    <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px]">
                                                      Nguyên văn
                                                    </Badge>
                                                  ) : (
                                                    <Badge
                                                      variant="outline"
                                                      className="text-muted-foreground text-[10px]"
                                                    >
                                                      Tóm tắt
                                                    </Badge>
                                                  )}
                                                  <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground border border-border">
                                                    {p.unitType || 'SUMMARY'}
                                                  </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                  {p.isManualApproved ? (
                                                    <Badge className="bg-emerald-700 text-white text-[10px] gap-1">
                                                      <Check className="w-2.5 h-2.5" />
                                                      Đã duyệt
                                                    </Badge>
                                                  ) : (
                                                    <Badge
                                                      variant="outline"
                                                      className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] gap-1"
                                                    >
                                                      <Clock className="w-2.5 h-2.5" />
                                                      Chưa duyệt
                                                    </Badge>
                                                  )}

                                                  <Button
                                                    size="sm"
                                                    variant={p.isManualApproved ? 'outline' : 'default'}
                                                    onClick={() =>
                                                      handleToggleApprove(p.id, p.isManualApproved)
                                                    }
                                                    className={`h-6 px-2 text-[11px] ${p.isManualApproved
                                                        ? 'text-muted-foreground hover:text-destructive'
                                                        : 'bg-emerald-700 hover:bg-emerald-800 text-white font-semibold'
                                                      }`}
                                                  >
                                                    {p.isManualApproved ? 'Bỏ duyệt' : 'Duyệt'}
                                                  </Button>

                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => setDeleteTarget(p)}
                                                    className="h-6 w-6 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                                    title="Xóa đoạn này"
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              </div>

                                              <p className="text-muted-foreground italic leading-relaxed text-xs pl-6">
                                                "{p.evidenceText}"
                                              </p>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </>
                ) : (
                  // ==================== BẢNG CHẾ ĐỘ DANH SÁCH TỪNG DÒNG (FLAT LIST) ====================
                  <>
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                      <tr>
                        <th className="p-3 w-8">
                          <input
                            type="checkbox"
                            checked={
                              filteredSources.length > 0 &&
                              filteredSources.every((s) => selectedSourceIds.includes(s.id))
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSourceIds(filteredSources.map((s) => s.id));
                              } else {
                                setSelectedSourceIds([]);
                              }
                            }}
                            className="rounded"
                          />
                        </th>
                        <th className="p-3">Bài viết &amp; Cơ quan</th>
                        <th className="p-3">Cây &amp; Chuyên mục</th>
                        <th className="p-3">Dạng bài</th>
                        <th className="p-3">Nội dung trích đoạn</th>
                        <th className="p-3 text-center">Trạng thái</th>
                        <th className="p-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {loadingSources ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground">
                            Đang tải danh sách nguồn tri thức...
                          </td>
                        </tr>
                      ) : filteredSources.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground">
                            Không tìm thấy bài viết nào phù hợp.
                          </td>
                        </tr>
                      ) : (
                        pagedSources.map((s) => {
                          const isSelected = selectedSourceIds.includes(s.id);
                          return (
                            <tr
                              key={s.id}
                              className={`hover:bg-muted/30 transition-colors ${isSelected ? 'bg-emerald-50/40' : ''
                                }`}
                            >
                              <td className="p-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedSourceIds((prev) => [...prev, s.id]);
                                    } else {
                                      setSelectedSourceIds((prev) => prev.filter((id) => id !== s.id));
                                    }
                                  }}
                                  className="rounded"
                                />
                              </td>
                              <td className="p-3 max-w-[220px]">
                                <div className="font-bold text-foreground line-clamp-1">{s.sourceTitle}</div>
                                <div className="text-[11px] text-muted-foreground line-clamp-1">{s.organization}</div>
                                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                  {renderOriginPill(inferSourceScope(s.sourceUrl, s.organization, s.sourceScope), true)}
                                  <a
                                    href={s.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] text-emerald-700 hover:underline inline-flex items-center gap-0.5"
                                  >
                                    <span>Xem bài gốc</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </div>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <span className="font-semibold text-foreground block">{s.plantName}</span>
                                <span className="text-[11px] text-muted-foreground">
                                  {formatTopicLabel(s.diseaseName, s.modelClass)}
                                </span>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                {s.isVerbatim ? (
                                  <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px]">
                                    Nguyên văn
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                    Tóm tắt
                                  </Badge>
                                )}
                                <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                                  {s.unitType || 'SUMMARY'}
                                </div>
                              </td>
                              <td className="p-3 max-w-[280px]">
                                <p className="line-clamp-2 italic text-muted-foreground">
                                  "{s.evidenceText}"
                                </p>
                              </td>
                              <td className="p-3 text-center whitespace-nowrap">
                                {s.isManualApproved ? (
                                  <Badge className="bg-emerald-700 text-white text-[10px]">
                                    <Check className="w-3 h-3 mr-1" />
                                    Đã duyệt
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Chưa duyệt
                                  </Badge>
                                )}
                              </td>
                              <td className="p-3 text-right whitespace-nowrap">
                                <Button
                                  size="sm"
                                  variant={s.isManualApproved ? 'outline' : 'default'}
                                  onClick={() => handleToggleApprove(s.id, s.isManualApproved)}
                                  className={`h-7 px-2.5 text-xs ${s.isManualApproved
                                      ? 'text-muted-foreground hover:text-destructive'
                                      : 'bg-emerald-700 hover:bg-emerald-800 text-white font-semibold'
                                    }`}
                                >
                                  {s.isManualApproved ? 'Bỏ duyệt' : 'Duyệt bài'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDeleteTarget(s)}
                                  className="ml-1 h-7 w-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  aria-label="Xóa đoạn tri thức"
                                  title="Xóa đoạn tri thức"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </>
                )}
              </table>
            </div>

            {/* Pagination Bar (Phân trang tri thức - Nhánh 3) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t border-border bg-card/60 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>
                  Hiển thị {curationTotalItems === 0 ? 0 : (safeCurationPage - 1) * curationPageSize + 1}–
                  {Math.min(safeCurationPage * curationPageSize, curationTotalItems)} trong tổng số{' '}
                  <strong className="text-foreground">{curationTotalItems}</strong> {groupByArticle ? 'bài viết' : 'đoạn trích'}
                </span>
                <span className="text-border">|</span>
                <div className="flex items-center gap-1.5">
                  <span>Mỗi trang:</span>
                  <select
                    value={curationPageSize}
                    onChange={(e) => {
                      setCurationPageSize(Number(e.target.value));
                      setCurationPage(1);
                    }}
                    className="h-7 px-2 bg-background border border-border rounded text-xs"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurationPage <= 1}
                  onClick={() => setCurationPage((p) => Math.max(1, p - 1))}
                  className="h-7 px-2.5 text-xs gap-1"
                >
                  <ChevronLeft className="w-3 h-3" />
                  <span>Trước</span>
                </Button>
                <span className="px-2 text-xs font-medium text-foreground">
                  Trang {safeCurationPage} / {curationTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurationPage >= curationTotalPages}
                  onClick={() => setCurationPage((p) => Math.min(curationTotalPages, p + 1))}
                  className="h-7 px-2.5 text-xs gap-1"
                >
                  <span>Sau</span>
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ========================================================================================= */}
        {/* TAB 3: QUẢN LÝ ẢNH TRIỆU CHỨNG THỰC ĐỊA (TASK-15 PHASE 2) */}
        {/* ========================================================================================= */}
        <TabsContent value="images" className="space-y-4">
          {/* Toolbar lọc và nút thêm */}
          <div className="bg-card p-4 rounded-xl border border-border shadow-xs flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[200px] flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Tìm theo chú thích, tác giả, nguồn..."
                  value={imageSearch}
                  onChange={(e) => setImageSearch(e.target.value)}
                  className="pl-9 h-8 text-xs bg-background"
                />
              </div>

              {/* Lọc Cây trồng */}
              <select
                aria-label="Lọc theo loài cây trồng"
                value={imageFilterPlant}
                onChange={(e) => {
                  setImageFilterPlant(e.target.value);
                  setImageFilterClass('ALL');
                }}
                className="h-8 px-2.5 rounded-md border border-input bg-background text-foreground text-xs font-medium cursor-pointer"
              >
                <option value="ALL">Tất cả loài cây ({uniquePlants.length})</option>
                {uniquePlants.map((plant) => (
                  <option key={plant} value={plant}>
                    {plant}
                  </option>
                ))}
              </select>

              {/* Lọc Bệnh hại */}
              <select
                aria-label="Lọc theo bệnh hại"
                value={imageFilterClass}
                onChange={(e) => setImageFilterClass(e.target.value)}
                className="h-8 px-2.5 rounded-md border border-input bg-background text-foreground text-xs font-medium cursor-pointer max-w-[220px] truncate"
              >
                <option value="ALL">Tất cả bệnh hại</option>
                {diseases
                  .filter((d) => imageFilterPlant === 'ALL' || d.plantName === imageFilterPlant)
                  .map((d) => (
                    <option key={d.classCode} value={d.classCode}>
                      {d.plantName} — {formatTopicLabel(d.commonNameVi, d.classCode)}
                    </option>
                  ))}
              </select>

              {/* Lọc Bộ phận cây */}
              <select
                aria-label="Lọc theo bộ phận cây"
                value={imageFilterPart}
                onChange={(e) => setImageFilterPart(e.target.value)}
                className="h-8 px-2.5 rounded-md border border-input bg-background text-foreground text-xs font-medium cursor-pointer"
              >
                <option value="ALL">Tất cả bộ phận</option>
                <option value="LEAF">Lá cây</option>
                <option value="FRUIT">Quả / Hoa</option>
                <option value="STEM">Thân / Cành</option>
                <option value="WHOLE_PLANT">Toàn cây</option>
              </select>

              {/* Lọc Trạng thái duyệt */}
              <select
                aria-label="Lọc theo trạng thái duyệt ảnh"
                value={imageFilterApproval}
                onChange={(e) => setImageFilterApproval(e.target.value as any)}
                className="h-8 px-2.5 rounded-md border border-input bg-background text-foreground text-xs font-medium cursor-pointer"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="APPROVED">Đã duyệt</option>
                <option value="PENDING">Chờ duyệt</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchKnowledgeImages}
                disabled={loadingImages}
                className="gap-1.5 h-8 text-xs bg-background"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingImages ? 'animate-spin' : ''}`} />
                <span>Làm mới</span>
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setNewImagePlant(selectedPlant || (uniquePlants[0] ?? 'Cà chua'));
                  setNewImageClass(ingestClass || diseases[0]?.classCode || 'Tomato___Late_blight');
                  setNewImageSourceUrl('');
                  setNewImageCredit('');
                  setAddImageModalOpen(true);
                }}
                className="gap-1.5 h-8 text-xs bg-primary hover:bg-primary-hover text-white font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm ảnh triệu chứng</span>
              </Button>
            </div>
          </div>

          {/* Danh sách ảnh triệu chứng */}
          {loadingImages ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-64 rounded-2xl bg-card border border-border p-4 animate-pulse space-y-3" />
              ))}
            </div>
          ) : filteredKnowledgeImages.length === 0 ? (
            <Card className="border-dashed border-2 p-12 text-center bg-card">
              <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/60 mb-3" />
              <h4 className="text-base font-bold text-foreground">Chưa có ảnh triệu chứng nào</h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                Kho ảnh triệu chứng giúp nông dân đối chiếu thực tế khi xem sổ tay và trợ lý tư vấn. Bạn có thể thêm ảnh bằng cách tải tệp lên hoặc nhập link HTTPS.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setNewImagePlant(selectedPlant || (uniquePlants[0] ?? 'Cà chua'));
                  setNewImageClass(ingestClass || diseases[0]?.classCode || 'Tomato___Late_blight');
                  setNewImageSourceUrl('');
                  setNewImageCredit('');
                  setAddImageModalOpen(true);
                }}
                className="gap-1.5 text-xs bg-primary text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm ảnh đầu tiên</span>
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredKnowledgeImages.map((img) => (
                <Card
                  key={img.id}
                  className="overflow-hidden border-border bg-card flex flex-col justify-between hover:border-primary/50 transition-all shadow-2xs group"
                >
                  <div
                    className="relative aspect-4/3 w-full bg-muted cursor-pointer overflow-hidden"
                    onClick={() => setPreviewingImage(img)}
                  >
                    <img
                      src={img.image_url}
                      alt={img.caption}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="%23999"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12">Lỗi tải ảnh</text></svg>';
                      }}
                    />
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      <span className="inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold bg-black/60 text-white backdrop-blur-xs">
                        {img.plant_part === 'LEAF'
                          ? 'Lá'
                          : img.plant_part === 'FRUIT'
                            ? 'Quả/Hoa'
                            : img.plant_part === 'STEM'
                              ? 'Thân/Cành'
                              : 'Toàn cây'}
                      </span>
                    </div>
                    <div className="absolute top-2 right-2">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-semibold border ${img.is_manual_approved
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                          }`}
                      >
                        {img.is_manual_approved ? 'Đã duyệt' : 'Chờ duyệt'}
                      </Badge>
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="rounded-full bg-black/70 p-2 text-white shadow-md">
                        <ZoomIn className="h-4 w-4" />
                      </span>
                    </div>
                  </div>

                  <CardContent className="p-3.5 space-y-2 flex-1 flex flex-col justify-between text-xs">
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-primary truncate" title={`${img.plant_name} — ${img.disease_name}`}>
                        {img.plant_name} — {img.disease_name}
                      </div>
                      <p className="text-foreground text-xs font-medium line-clamp-2 leading-snug">
                        {img.caption}
                      </p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span className="truncate max-w-[150px]" title={img.credit}>
                          Nguồn: <strong>{img.credit}</strong>
                        </span>
                        {img.source_url && (
                          <a
                            href={img.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-primary hover:underline font-semibold"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span>Bài gốc</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleApproveImage(img)}
                          className={`h-7 px-2 text-[11px] font-semibold ${img.is_manual_approved
                              ? 'text-amber-700 hover:bg-amber-500/10 dark:text-amber-400'
                              : 'text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400'
                            }`}
                        >
                          {img.is_manual_approved ? 'Bỏ duyệt' : 'Duyệt ảnh'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteImageTarget(img)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Xóa ảnh triệu chứng"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ========================================================================================= */}
        {/* TAB 4: QUẢN LÝ KHO THUỐC BVTV & PHI */}
        {/* ========================================================================================= */}
        <TabsContent value="inventory" className="space-y-4">
          {/* Subtabs Điều hướng: Kho thuốc & vật tư vs Gợi ý từ bài báo */}
          <div className="flex border-b border-border gap-2 sm:gap-4 pb-1">
            <button
              type="button"
              onClick={() => setInventorySubTab('medicines')}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${inventorySubTab === 'medicines'
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Kho thuốc &amp; Vật tư ({medicines.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setInventorySubTab('suggestions');
                fetchSuggestions();
              }}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${inventorySubTab === 'suggestions'
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Gợi ý vật tư từ bài báo</span>
              {pendingSuggestionsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                  {pendingSuggestionsCount}
                </span>
              )}
            </button>
          </div>

          {inventorySubTab === 'medicines' ? (
            // ==================== SUBTAB 1: KHO THUỐC & VẬT TƯ ====================
            <div className="space-y-4">
              <div className="bg-card p-4 rounded-xl border border-border shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between text-xs">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Tìm theo tên thuốc hoặc hoạt chất..."
                    value={medSearch}
                    onChange={(e) => setMedSearch(e.target.value)}
                    className="pl-8 text-xs h-9 bg-background"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleOpenCreateMedModal()}
                    className="h-9 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm thuốc / Vật tư mới</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchMedicines}
                    disabled={loadingMedicines}
                    className="h-9 bg-card border-border hover:bg-muted text-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingMedicines ? 'animate-spin' : ''}`} />
                    Làm mới kho
                  </Button>
                </div>
              </div>

              <Card className="border-border bg-card shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                      <tr>
                        <th className="p-3">Mã #</th>
                        <th className="p-3">Tên thuốc &amp; Hoạt chất</th>
                        <th className="p-3">Phân loại</th>
                        <th className="p-3">Giá bán</th>
                        <th className="p-3">Cách ly (PHI)</th>
                        <th className="p-3">Tồn kho</th>
                        <th className="p-3 text-center">Tình trạng bán</th>
                        <th className="p-3 text-center">Trạng thái lưu hành</th>
                        <th className="p-3 text-right">Chỉnh sửa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {loadingMedicines ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-muted-foreground">
                            Đang tải danh mục thuốc...
                          </td>
                        </tr>
                      ) : filteredMedicines.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-muted-foreground">
                            Không có sản phẩm nào.
                          </td>
                        </tr>
                      ) : (
                        filteredMedicines.map((med) => (
                          <tr key={med.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-mono text-muted-foreground">{med.id}</td>
                            <td className="p-3">
                              <div className="font-bold text-foreground flex items-center gap-1.5">
                                <span>{med.name}</span>
                                {isIngredientBanned(med.active_ingredient) && (
                                  <Badge variant="destructive" className="text-[9px] h-4 px-1">
                                    Hoạt chất cấm
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {med.active_ingredient || (
                                  <span className="italic text-muted-foreground/70">Không có hoạt chất hóa học</span>
                                )}
                              </div>
                              {med.info_source_url && (
                                <a
                                  href={med.info_source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-0.5"
                                >
                                  <span>Nguồn kỹ thuật</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              <Badge
                                variant="outline"
                                className={
                                  med.medicine_type === 'Sinh học'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : med.medicine_type === 'Vật tư canh tác'
                                      ? 'bg-blue-50 text-blue-800 border-blue-300'
                                      : 'bg-amber-50 text-amber-800 border-amber-300'
                                }
                              >
                                {med.medicine_type}
                              </Badge>
                            </td>
                            <td className="p-3 font-semibold text-emerald-800 whitespace-nowrap">
                              {med.availability === 'NOT_SOLD' ? (
                                <span className="text-muted-foreground italic font-normal">Không bán</span>
                              ) : (
                                `${med.price.toLocaleString('vi-VN')} đ`
                              )}
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              {med.medicine_type === 'Vật tư canh tác' || med.phi_days === null || med.phi_days === undefined ? (
                                <span className="text-muted-foreground italic">Không áp dụng</span>
                              ) : med.phi_days <= 3 ? (
                                <Badge className="bg-emerald-700 text-white text-[10px]">
                                  {med.phi_days} ngày (Cận hái)
                                </Badge>
                              ) : (
                                <span className="font-medium text-foreground">{med.phi_days} ngày</span>
                              )}
                            </td>
                            <td className="p-3 whitespace-nowrap font-medium">
                              {med.availability === 'NOT_SOLD' ? (
                                <span className="text-muted-foreground text-[11px] italic">Không quản lý kho</span>
                              ) : med.stock_quantity > 0 ? (
                                <span>{med.stock_quantity}</span>
                              ) : (
                                <span className="text-destructive font-bold">Hết hàng</span>
                              )}
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              {med.availability === 'NOT_SOLD' ? (
                                <Badge variant="outline" className="bg-secondary text-muted-foreground border-border text-[10px]">
                                  Không kinh doanh
                                </Badge>
                              ) : med.stock_quantity <= 0 || med.availability === 'OUT_OF_STOCK' ? (
                                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">
                                  Tạm hết hàng
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                                  Đang bán
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              <Button
                                size="sm"
                                variant={med.is_allowed ? 'default' : 'outline'}
                                onClick={() => handleToggleMedicineAllowed(med)}
                                className={`h-7 px-2.5 text-xs font-semibold ${med.is_allowed
                                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                    : 'text-destructive border-destructive/30 hover:bg-destructive/10'
                                  }`}
                              >
                                {med.is_allowed ? 'Đang lưu hành' : 'Bị cấm / Dừng bán'}
                              </Button>
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingMed(med)}
                                className="h-7 text-xs text-primary"
                              >
                                Sửa thông số
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ) : (
            // ==================== SUBTAB 2: GỢI Ý VẬT TƯ TỪ BÀI BÁO (TASK-15 V5) ====================
            <div className="space-y-4">
              <div className="bg-card p-4 rounded-xl border border-border shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between text-xs">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative min-w-[220px]">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Tìm theo tên vật tư, hoạt chất, bệnh..."
                      value={suggestionSearch}
                      onChange={(e) => setSuggestionSearch(e.target.value)}
                      className="pl-8 text-xs h-9 bg-background"
                    />
                  </div>

                  <select
                    value={suggestionStatusFilter}
                    onChange={(e) => setSuggestionStatusFilter(e.target.value)}
                    className="h-9 px-2.5 bg-background border border-border rounded-lg text-xs"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="PENDING">Chờ xử lý</option>
                    <option value="LINKED">Đã gắn SP có sẵn</option>
                    <option value="ADDED">Đã tạo SP mới</option>
                    <option value="DISMISSED">Đã bỏ qua</option>
                  </select>

                  <select
                    value={suggestionKindFilter}
                    onChange={(e) => setSuggestionKindFilter(e.target.value)}
                    className="h-9 px-2.5 bg-background border border-border rounded-lg text-xs"
                  >
                    <option value="ALL">Tất cả loại vật tư</option>
                    <option value="CHEMICAL">Thuốc BVTV hóa học</option>
                    <option value="BIOLOGICAL">Chế phẩm sinh học BVTV</option>
                    <option value="SUPPLY">Vật tư canh tác</option>
                    <option value="PRACTICE">Biện pháp canh tác</option>
                  </select>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchSuggestions}
                  disabled={loadingSuggestions}
                  className="h-9 bg-card border-border hover:bg-muted text-xs shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingSuggestions ? 'animate-spin' : ''}`} />
                  Làm mới gợi ý
                </Button>
              </div>

              <Card className="border-border bg-card shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                      <tr>
                        <th className="p-3">Vật tư / Hoạt chất trích xuất</th>
                        <th className="p-3">Phân loại</th>
                        <th className="p-3">Cây – Bệnh mục tiêu</th>
                        <th className="p-3">Đoạn trích bằng chứng</th>
                        <th className="p-3 text-center">Trạng thái</th>
                        <th className="p-3 text-center">Sản phẩm liên kết</th>
                        <th className="p-3 text-right">Thao tác Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {loadingSuggestions ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground">
                            Đang tải danh sách gợi ý vật tư...
                          </td>
                        </tr>
                      ) : filteredSuggestions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground">
                            Không tìm thấy gợi ý vật tư nào.
                          </td>
                        </tr>
                      ) : (
                        filteredSuggestions.map((sug) => {
                          const isBanned = isIngredientBanned(sug.mention_text);
                          return (
                            <tr key={sug.id} className="hover:bg-muted/30 transition-colors">
                              <td className="p-3 font-medium">
                                <div className="font-bold text-foreground flex items-center gap-1.5">
                                  <span>{sug.mention_text}</span>
                                  {isBanned && (
                                    <Badge variant="destructive" className="text-[9px] h-4 px-1">
                                      Hoạt chất cấm (TT 75/2025)
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  Mã #{sug.id} • {new Date(sug.created_at).toLocaleDateString('vi-VN')}
                                </div>
                              </td>

                              <td className="p-3 whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className={
                                    sug.kind === 'CHEMICAL'
                                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                                      : sug.kind === 'BIOLOGICAL'
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                        : sug.kind === 'SUPPLY'
                                          ? 'bg-blue-50 text-blue-800 border-blue-300'
                                          : 'bg-purple-50 text-purple-800 border-purple-300'
                                  }
                                >
                                  {sug.kind === 'CHEMICAL'
                                    ? 'Hóa học'
                                    : sug.kind === 'BIOLOGICAL'
                                      ? 'Sinh học'
                                      : sug.kind === 'SUPPLY'
                                        ? 'Vật tư canh tác'
                                        : 'Biện pháp'}
                                </Badge>
                              </td>

                              <td className="p-3 whitespace-nowrap">
                                <span className="font-medium text-foreground">{sug.plant_name}</span>
                                <span className="text-muted-foreground"> – {sug.disease_name}</span>
                              </td>

                              <td className="p-3 min-w-[280px] max-w-lg">
                                <p className="text-[11px] text-muted-foreground italic line-clamp-3 leading-relaxed" title={sug.evidence_text}>
                                  "{sug.evidence_text}"
                                </p>
                                {sug.source_url && (
                                  <a
                                    href={sug.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-0.5"
                                  >
                                    <span>{sug.source_title || 'Xem bài viết gốc'}</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </td>

                                  <td className="p-3 text-center whitespace-nowrap">
                                    {sug.status === 'PENDING' ? (
                                      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px]">
                                        Chờ xử lý
                                      </Badge>
                                    ) : sug.status === 'LINKED' ? (
                                      <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px]">
                                        Đã gắn SP
                                      </Badge>
                                    ) : sug.status === 'ADDED' ? (
                                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                                        Đã tạo SP
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">
                                        Đã bỏ qua
                                      </Badge>
                                    )}
                                  </td>

                                  <td className="p-3 text-center whitespace-nowrap">
                                    {sug.product_name && sug.status === 'PENDING' ? (
                                      <span className="text-amber-700 dark:text-amber-400 text-[11px]" title="Cùng hoạt chất với sản phẩm trong kho. Bấm Gắn SP để xác nhận.">
                                        Khớp hoạt chất: <b>{sug.product_name}</b>
                                      </span>
                                    ) : sug.product_name ? (
                                      <span className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center justify-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>{sug.product_name}</span>
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground italic text-[11px]">—</span>
                                    )}
                                  </td>

                                  <td className="p-3 text-right whitespace-nowrap">
                                    {sug.status === 'PENDING' ? (
                                      <div className="flex items-center justify-end gap-1.5">
                                        {sug.kind !== 'PRACTICE' && (
                                          <Button
                                            size="sm"
                                            onClick={() => handleOpenCreateMedModal(sug)}
                                            className="h-7 px-2 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold gap-1"
                                            title="Tạo sản phẩm mới prefilled từ gợi ý"
                                          >
                                            <Plus className="w-3 h-3" />
                                            <span>Tạo SP</span>
                                          </Button>
                                        )}

                                        {sug.kind !== 'PRACTICE' && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              setLinkingSuggestion(sug);
                                              setSelectedLinkMedId(sug.product_id ?? '');
                                            }}
                                            className="h-7 px-2 border-border text-[11px] font-medium"
                                            title="Liên kết với sản phẩm đã có sẵn trong kho"
                                          >
                                            <LinkIcon className="w-3 h-3 mr-1" />
                                            <span>Gắn SP</span>
                                          </Button>
                                        )}

                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleDismissSuggestion(sug.id)}
                                          className="h-7 px-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-[11px]"
                                          title="Bỏ qua gợi ý này"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <span className="text-[11px] text-muted-foreground">Đã xử lý</span>
                                    )}
                                  </td>
                                </tr>
                                );
                        })
                      )}
                              </tbody>
                            </table>
                </div>
                  </Card>
                </div>
          )}
              </TabsContent>

              {/* ========================================================================================= */}
              {/* TAB 4: THẨM ĐỊNH CA BỆNH KHÓ (EXPERT ESCALATIONS) */}
              {/* ========================================================================================= */}
              <TabsContent value="escalations" className="space-y-4">
                <div className="flex items-center justify-between pb-2">
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      Ca bệnh có yêu cầu Bác sĩ Cây trồng thẩm định
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Các ca chẩn đoán có độ bất định cao (IsUncertain = true) hoặc nông dân bấm nút "Nhờ chuyên gia".
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchEscalations}
                    disabled={loadingEscalations}
                    className="gap-2 bg-card border-border hover:bg-muted text-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingEscalations ? 'animate-spin' : ''}`} />
                    <span>Làm mới</span>
                  </Button>
                </div>

                {loadingEscalations ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-36 rounded-xl bg-card border border-border p-4 animate-pulse" />
                    ))}
                  </div>
                ) : escalations.length === 0 ? (
                  <div className="p-12 text-center bg-card border border-border rounded-xl">
                    <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600 mb-2" />
                    <h4 className="text-base font-bold text-foreground">Không có ca bệnh nào tồn đọng</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tất cả các ca khám lá của nông dân đều đã được AI nhận diện ổn định hoặc chuyên gia đã xử lý xong.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {escalations.map((item) => (
                      <Card key={item.id} className="border-border bg-card shadow-xs flex flex-col justify-between">
                        <CardHeader className="p-4 pb-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-300 text-xs">
                              {item.plantName} – {item.diseaseName}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                            </span>
                          </div>

                          <CardTitle className="text-sm font-bold text-foreground pt-1">
                            Nông dân: {item.userName} {item.userPhone ? `(${item.userPhone})` : ''}
                          </CardTitle>
                        </CardHeader>

                        <CardContent className="p-4 pt-1 space-y-3 text-xs">
                          {item.notes && (
                            <div className="bg-muted/30 p-2.5 rounded-lg border border-border/60">
                              <span className="font-semibold text-foreground block mb-0.5">Mô tả từ nông dân:</span>
                              <p className="text-muted-foreground italic">"{item.notes}"</p>
                            </div>
                          )}

                          <div className="flex gap-2">
                            {item.originalImageUrl && (
                              <div className="w-20 h-20 rounded-md border border-border overflow-hidden shrink-0">
                                <img
                                  src={item.originalImageUrl}
                                  alt="Ảnh lá"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            {item.gradCamImageUrl && (
                              <div className="w-20 h-20 rounded-md border border-border overflow-hidden shrink-0">
                                <img
                                  src={item.gradCamImageUrl}
                                  alt="Grad-CAM"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className="flex-1 text-[11px] space-y-1">
                              <div>Độ tin cậy AI: <strong>{(item.confidence * 100).toFixed(1)}%</strong></div>
                              {item.expertNotes ? (
                                <div className="text-emerald-800 font-medium bg-emerald-50 p-1.5 rounded border border-emerald-200 line-clamp-2">
                                  BS: {item.expertNotes}
                                </div>
                              ) : (
                                <div className="text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200">
                                  Chờ bác sĩ phản hồi phác đồ...
                                </div>
                              )}
                            </div>
                          </div>

                          <Button
                            size="sm"
                            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs mt-2"
                            onClick={() => {
                              setSelectedEscalation(item);
                              setExpertNoteInput(item.expertNotes || '');
                            }}
                          >
                            {item.expertNotes ? 'Cập nhật phác đồ điều trị' : 'Thẩm định & Viết phác đồ'}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

      {/* ========================================================================================= */}
      {/* DIALOG SỬA THÔNG SỐ THUỐC BVTV & VẬT TƯ (BRANCH 2) */}
      {/* ========================================================================================= */}
      <Dialog open={!!editingMed} onOpenChange={() => setEditingMed(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Chỉnh sửa sản phẩm: {editingMed?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cập nhật thông tin chi tiết, giá bán, số ngày cách ly (PHI), tình trạng bán và hướng dẫn sử dụng.
            </DialogDescription>
          </DialogHeader>

          {editingMed && (
            <div className="space-y-3 py-2 text-xs">
              {isIngredientBanned(editingMed.active_ingredient || editingMed.name) && (
                <div className="p-2.5 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <strong>Cảnh báo chất cấm (TT 75/2025):</strong> Tên hoặc hoạt chất của sản phẩm nằm trong danh mục cấm sử dụng tại Việt Nam. Không thể kích hoạt trạng thái lưu hành.
                  </div>
                </div>
              )}

              <div>
                <label className="font-semibold block mb-1">Tên thuốc / Tên sản phẩm *</label>
                <Input
                  type="text"
                  value={editingMed.name}
                  onChange={(e) => setEditingMed({ ...editingMed, name: e.target.value })}
                  className="text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Phân loại sản phẩm *</label>
                  <select
                    value={editingMed.medicine_type || 'Hóa học'}
                    onChange={(e) => {
                      const t = e.target.value;
                      setEditingMed({
                        ...editingMed,
                        medicine_type: t,
                        phi_days: t === 'Vật tư canh tác' ? null : editingMed.phi_days,
                        active_ingredient: t === 'Vật tư canh tác' ? '' : editingMed.active_ingredient,
                        dosage_instruction:
                          t === 'Vật tư canh tác' && editingMed.dosage_instruction === 'Pha theo hướng dẫn trên bao bì'
                            ? 'Sử dụng theo diện tích canh tác và hướng dẫn nhà sản xuất'
                            : editingMed.dosage_instruction,
                      });
                    }}
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs"
                  >
                    <option value="Hóa học">Thuốc BVTV hóa học</option>
                    <option value="Sinh học">Chế phẩm sinh học BVTV</option>
                    <option value="Vật tư canh tác">Vật tư canh tác (lưới, bẫy, bạt phủ...)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Tình trạng kinh doanh *</label>
                  <select
                    value={editingMed.availability || 'IN_STOCK'}
                    onChange={(e) =>
                      setEditingMed({ ...editingMed, availability: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs"
                  >
                    <option value="IN_STOCK">Đang bán (cho phép đặt mua)</option>
                    <option value="OUT_OF_STOCK">Tạm hết hàng (tạm ẩn nút mua)</option>
                    <option value="NOT_SOLD">Cửa hàng không bán (chỉ tư vấn kỹ thuật)</option>
                  </select>
                </div>
              </div>

              {editingMed.medicine_type !== 'Vật tư canh tác' ? (
                <div>
                  <label className="font-semibold block mb-1">Hoạt chất chính (Active Ingredient)</label>
                  <Input
                    type="text"
                    value={editingMed.active_ingredient || ''}
                    onChange={(e) =>
                      setEditingMed({ ...editingMed, active_ingredient: e.target.value })
                    }
                    placeholder="Ví dụ: Metalaxyl-M, Mancozeb..."
                    className="text-xs"
                  />
                </div>
              ) : (
                <div>
                  <label className="font-semibold block mb-1 text-muted-foreground">Hoạt chất chính</label>
                  <div className="h-8 px-2.5 py-1.5 bg-muted/40 border border-border rounded text-xs text-muted-foreground flex items-center">
                    Không áp dụng cho vật tư canh tác
                  </div>
                </div>
              )}

              {editingMed.availability !== 'NOT_SOLD' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold block mb-1">Giá bán (VNĐ) *</label>
                    <Input
                      type="number"
                      value={editingMed.price}
                      onChange={(e) =>
                        setEditingMed({ ...editingMed, price: parseFloat(e.target.value) || 0 })
                      }
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">Số lượng tồn kho *</label>
                    <Input
                      type="number"
                      value={editingMed.stock_quantity}
                      onChange={(e) =>
                        setEditingMed({ ...editingMed, stock_quantity: parseInt(e.target.value, 10) || 0 })
                      }
                      className="text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-muted/40 border border-border rounded-lg text-muted-foreground text-xs">
                  Sản phẩm ở chế độ "Cửa hàng không bán": Giá bán và Tồn kho được mặc định là 0. Sản phẩm chỉ hiển thị để tư vấn kỹ thuật nông vụ.
                </div>
              )}

              <div>
                <label className="font-semibold block mb-1">
                  Thời gian cách ly PHI (ngày)
                  {editingMed.medicine_type === 'Vật tư canh tác' ? (
                    <span className="font-normal text-muted-foreground ml-1">(Không áp dụng cho vật tư canh tác)</span>
                  ) : (
                    <span className="text-destructive ml-0.5">*</span>
                  )}
                </label>
                <Input
                  type="number"
                  disabled={editingMed.medicine_type === 'Vật tư canh tác'}
                  placeholder={editingMed.medicine_type === 'Vật tư canh tác' ? 'Không áp dụng' : 'Ví dụ: 7'}
                  value={editingMed.phi_days ?? ''}
                  onChange={(e) =>
                    setEditingMed({
                      ...editingMed,
                      phi_days: e.target.value === '' ? null : parseInt(e.target.value, 10),
                    })
                  }
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Hướng dẫn sử dụng / Liều lượng</label>
                <Input
                  type="text"
                  value={editingMed.dosage_instruction || ''}
                  onChange={(e) =>
                    setEditingMed({ ...editingMed, dosage_instruction: e.target.value })
                  }
                  placeholder={
                    editingMed.medicine_type === 'Vật tư canh tác'
                      ? 'Sử dụng theo diện tích canh tác và hướng dẫn nhà sản xuất'
                      : 'Pha theo hướng dẫn trên bao bì'
                  }
                  className="text-xs"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  URL nguồn tra cứu PHI/liều (nhãn, trang nhà sản xuất)
                  {editingMed.medicine_type === 'Vật tư canh tác' ? ' (tùy chọn)' : ' *'}
                </label>
                <Input
                  type="url"
                  placeholder="https://khuyennongvn.gov.vn/..."
                  value={editingMed.info_source_url || ''}
                  onChange={(e) =>
                    setEditingMed({ ...editingMed, info_source_url: e.target.value })
                  }
                  className="text-xs"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  disabled={isIngredientBanned(editingMed.active_ingredient) || isIngredientBanned(editingMed.name)}
                  checked={editingMed.is_allowed && !isIngredientBanned(editingMed.active_ingredient) && !isIngredientBanned(editingMed.name)}
                  onChange={(e) => setEditingMed({ ...editingMed, is_allowed: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-700"
                />
                <span className="font-semibold text-xs">
                  {editingMed.medicine_type === 'Vật tư canh tác'
                    ? 'Cho phép sử dụng trong tư vấn canh tác (Lavi được gợi ý cho nông dân)'
                    : 'Đã đối chiếu Danh mục thuốc BVTV được phép sử dụng tại Việt Nam (bật lưu hành, Lavi mới được gợi ý)'}
                </span>
              </label>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditingMed(null)}>
                  Hủy
                </Button>
                <Button
                  size="sm"
                  disabled={medSaving}
                  onClick={handleSaveMedicineEdit}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                >
                  {medSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

              {/* ========================================================================================= */}
              {/* DIALOG GẮN GỢI Ý VẬT TƯ VÀO SẢN PHẨM CÓ SẴN (TASK-15 PHASE 3) */}
              {/* ========================================================================================= */}
              <Dialog open={!!linkingSuggestion} onOpenChange={() => setLinkingSuggestion(null)}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-base font-bold flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-emerald-700" />
                      <span>Gắn gợi ý vào sản phẩm trong kho</span>
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      Liên kết cụm từ trích xuất "{linkingSuggestion?.mention_text}" với sản phẩm đang có trong danh mục để trợ lý Lavi tự động gợi ý sản phẩm này khi gặp triệu chứng tương ứng.
                    </DialogDescription>
                  </DialogHeader>

                  {linkingSuggestion && (
                    <div className="space-y-3 py-2 text-xs">
                      <div className="p-2.5 bg-muted/40 rounded-lg border border-border space-y-1">
                        <div>Cây – Bệnh: <strong>{linkingSuggestion.plant_name} – {linkingSuggestion.disease_name}</strong></div>
                        <div>Từ khóa bài báo: <span className="font-bold text-primary">{linkingSuggestion.mention_text}</span></div>
                        <div className="line-clamp-2 text-muted-foreground italic">"{linkingSuggestion.evidence_text}"</div>
                      </div>

                      <div>
                        <label className="font-semibold block mb-1">Chọn sản phẩm trong kho để liên kết *</label>
                        <select
                          value={selectedLinkMedId}
                          onChange={(e) => setSelectedLinkMedId(e.target.value ? Number(e.target.value) : '')}
                          className="w-full px-2.5 py-2 bg-background border border-border rounded-lg text-xs"
                        >
                          <option value="">-- Chọn sản phẩm phù hợp --</option>
                          {medicines
                            .filter((m) => !isIngredientBanned(m.name) && !isIngredientBanned(m.active_ingredient || ''))
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                #{m.id} - {m.name} ({m.medicine_type}{m.active_ingredient ? ` - ${m.active_ingredient}` : ''})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" size="sm" onClick={() => setLinkingSuggestion(null)} disabled={linkingLoading}>
                      Hủy
                    </Button>
                    <Button
                      size="sm"
                      disabled={linkingLoading || !selectedLinkMedId}
                      onClick={handleLinkSuggestion}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                    >
                      {linkingLoading ? 'Đang liên kết...' : 'Xác nhận liên kết'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* ========================================================================================= */}
              {/* DIALOG THÊM THUỐC / VẬT TƯ MỚI (TASK-15 PHASE 3) */}
              {/* ========================================================================================= */}
              <Dialog open={createMedModalOpen} onOpenChange={setCreateMedModalOpen}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-base font-bold flex items-center gap-2">
                      <Plus className="w-4 h-4 text-emerald-700" />
                      <span>
                        {fromSuggestion ? `Thêm sản phẩm từ gợi ý: "${fromSuggestion.mention_text}"` : 'Thêm thuốc / Vật tư mới'}
                      </span>
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      {fromSuggestion
                        ? 'Chỉ tên và hoạt chất lấy từ bài báo. PHI, giá, tồn kho và link nguồn bạn tự tra trên nhãn thuốc rồi nhập. Sau khi lưu, gợi ý được đánh dấu đã thêm.'
                        : 'Thêm sản phẩm thuốc bảo vệ thực vật hoặc vật tư canh tác vào danh mục.'}
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleCreateMedicineSubmit} className="space-y-3 py-2 text-xs">
                    {isIngredientBanned(newMedActiveIngredient || newMedName) && (
                      <div className="p-2.5 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div>
                          <strong>Cảnh báo chất cấm (TT 75/2025):</strong> Tên hoặc hoạt chất "{newMedActiveIngredient || newMedName}" nằm trong danh mục cấm sử dụng tại Việt Nam. Không thể bật lưu hành sản phẩm này.
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="font-semibold block mb-1">Tên thuốc / Tên sản phẩm *</label>
                      <Input
                        type="text"
                        placeholder="Ví dụ: Bẫy dính màu vàng Pheromone, Ridomil Gold 68WG..."
                        value={newMedName}
                        onChange={(e) => setNewMedName(e.target.value)}
                        required
                        className="text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold block mb-1">Phân loại sản phẩm *</label>
                        <select
                          value={newMedType}
                          onChange={(e) => {
                            const t = e.target.value;
                            setNewMedType(t);
                            if (t === 'Vật tư canh tác') {
                              setNewMedPhi('');
                              setNewMedActiveIngredient('');
                              if (newMedDosage === 'Pha theo hướng dẫn trên bao bì') {
                                setNewMedDosage('Sử dụng theo diện tích canh tác và hướng dẫn nhà sản xuất');
                              }
                            } else if (newMedDosage === 'Sử dụng theo diện tích canh tác và hướng dẫn nhà sản xuất') {
                              setNewMedDosage('Pha theo hướng dẫn trên bao bì');
                            }
                          }}
                          className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs"
                        >
                          <option value="Hóa học">Thuốc BVTV hóa học</option>
                          <option value="Sinh học">Chế phẩm sinh học BVTV</option>
                          <option value="Vật tư canh tác">Vật tư canh tác (lưới, bẫy, bạt phủ...)</option>
                        </select>
                      </div>

                      <div>
                        <label className="font-semibold block mb-1">Tình trạng kinh doanh *</label>
                        <select
                          value={newMedAvailability}
                          onChange={(e) => setNewMedAvailability(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs"
                        >
                          <option value="IN_STOCK">Đang bán (cho phép đặt mua)</option>
                          <option value="OUT_OF_STOCK">Tạm hết hàng (tạm ẩn nút mua)</option>
                          <option value="NOT_SOLD">Cửa hàng không bán (chỉ tư vấn kỹ thuật)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-semibold block mb-1">Bệnh hại mục tiêu</label>
                        <select
                          value={newMedTargetDisease}
                          onChange={(e) => setNewMedTargetDisease(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs"
                        >
                          <option value="">-- Không chỉ định --</option>
                          {diseases.map((d) => (
                            <option key={d.classCode} value={d.classCode}>
                              {d.plantName} – {d.commonNameVi}
                            </option>
                          ))}
                        </select>
                      </div>

                      {newMedType !== 'Vật tư canh tác' ? (
                        <div>
                          <label className="font-semibold block mb-1">Hoạt chất chính (Active Ingredient)</label>
                          <Input
                            type="text"
                            placeholder="Ví dụ: Metalaxyl-M, Mancozeb..."
                            value={newMedActiveIngredient}
                            onChange={(e) => setNewMedActiveIngredient(e.target.value)}
                            className="text-xs"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="font-semibold block mb-1 text-muted-foreground">Hoạt chất chính</label>
                          <div className="h-8 px-2.5 py-1.5 bg-muted/40 border border-border rounded text-xs text-muted-foreground flex items-center">
                            Không áp dụng cho vật tư canh tác
                          </div>
                        </div>
                      )}
                    </div>

                    {newMedAvailability !== 'NOT_SOLD' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-semibold block mb-1">Giá bán (VNĐ) *</label>
                          <Input
                            type="number"
                            value={newMedPrice}
                            onChange={(e) => setNewMedPrice(parseFloat(e.target.value) || 0)}
                            required
                            className="text-xs"
                          />
                        </div>

                        <div>
                          <label className="font-semibold block mb-1">Số lượng tồn kho *</label>
                          <Input
                            type="number"
                            value={newMedStock}
                            onChange={(e) => setNewMedStock(parseInt(e.target.value, 10) || 0)}
                            required
                            className="text-xs"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-muted/40 border border-border rounded-lg text-muted-foreground text-xs">
                        Sản phẩm ở chế độ "Cửa hàng không bán": Giá bán và Tồn kho được mặc định là 0. Sản phẩm chỉ hiển thị để tư vấn kỹ thuật nông vụ.
                      </div>
                    )}

                    <div>
                      <label className="font-semibold block mb-1">
                        Thời gian cách ly PHI (ngày)
                        {newMedType === 'Vật tư canh tác' ? (
                          <span className="font-normal text-muted-foreground ml-1">(Không áp dụng cho vật tư canh tác)</span>
                        ) : (
                          <span className="text-destructive ml-0.5">*</span>
                        )}
                      </label>
                      <Input
                        type="number"
                        disabled={newMedType === 'Vật tư canh tác'}
                        placeholder={newMedType === 'Vật tư canh tác' ? 'Không áp dụng' : 'Xem trên nhãn thuốc (ví dụ: 7)'}
                        value={newMedPhi}
                        onChange={(e) => setNewMedPhi(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                        className="text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-semibold block mb-1">Hướng dẫn sử dụng / Liều lượng</label>
                      <Input
                        type="text"
                        value={newMedDosage}
                        onChange={(e) => setNewMedDosage(e.target.value)}
                        placeholder={
                          newMedType === 'Vật tư canh tác'
                            ? 'Sử dụng theo diện tích canh tác và hướng dẫn nhà sản xuất'
                            : 'Pha theo hướng dẫn trên bao bì'
                        }
                        className="text-xs"
                      />
                    </div>

                    <div>
                      <label className="font-semibold block mb-1">
                        Link nguồn tra PHI/liều (nhãn, trang nhà sản xuất)
                        {newMedType === 'Vật tư canh tác' ? ' (tùy chọn)' : ' *'}
                      </label>
                      <Input
                        type="url"
                        placeholder="https://khuyennongvn.gov.vn/..."
                        value={newMedSourceUrl}
                        onChange={(e) => setNewMedSourceUrl(e.target.value)}
                        className="text-xs"
                      />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        disabled={isIngredientBanned(newMedActiveIngredient) || isIngredientBanned(newMedName)}
                        checked={newMedIsAllowed && !isIngredientBanned(newMedActiveIngredient) && !isIngredientBanned(newMedName)}
                        onChange={(e) => setNewMedIsAllowed(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-700"
                      />
                      <span className="font-semibold text-xs">
                        {newMedType === 'Vật tư canh tác'
                          ? 'Cho phép sử dụng trong tư vấn canh tác (Lavi được gợi ý cho nông dân)'
                          : 'Đã đối chiếu Danh mục thuốc BVTV được phép sử dụng tại Việt Nam (bật lưu hành, Lavi mới được gợi ý)'}
                      </span>
                    </label>

                    <DialogFooter className="pt-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setCreateMedModalOpen(false)} disabled={creatingMed}>
                        Hủy
                      </Button>
                      <Button type="submit" size="sm" disabled={creatingMed} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold">
                        {creatingMed ? 'Đang tạo sản phẩm...' : 'Tạo sản phẩm'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

                  {/* ========================================================================================= */}
                  {/* DIALOG THẨM ĐỊNH CA BỆNH KHÓ */}
                  {/* ========================================================================================= */}
                  <Dialog open={!!selectedEscalation} onOpenChange={() => setSelectedEscalation(null)}>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="text-lg font-bold">
                          Thẩm định Chuyên môn &amp; Phác đồ điều trị
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                          Ca bệnh: {selectedEscalation?.plantName} – {selectedEscalation?.diseaseName}
                        </DialogDescription>
                      </DialogHeader>

                      {selectedEscalation && (
                        <div className="space-y-3.5 py-2 text-xs">
                          <div className="bg-muted/40 p-3 rounded-lg border border-border space-y-1">
                            <div>Nông dân: <strong>{selectedEscalation.userName}</strong> ({selectedEscalation.userPhone || 'Không có SĐT'})</div>
                            {selectedEscalation.notes && <div>Ghi chú vườn: <em>"{selectedEscalation.notes}"</em></div>}
                          </div>

                          <div>
                            <label className="font-semibold block mb-1">
                              Kết luận chẩn đoán &amp; Hướng dẫn điều trị của Bác sĩ Cây trồng *
                            </label>
                            <Textarea
                              rows={4}
                              placeholder="Ghi rõ phác đồ xử lý: cách ly, tỉa cành tiêu hủy, loại thuốc sinh học/hóa học nên dùng kèm liều lượng và thời gian phun..."
                              value={expertNoteInput}
                              onChange={(e) => setExpertNoteInput(e.target.value)}
                              className="text-xs"
                            />
                          </div>
                        </div>
                      )}

                      <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" size="sm" onClick={() => setSelectedEscalation(null)}>
                          Đóng
                        </Button>
                        <Button
                          size="sm"
                          disabled={reviewSubmitting}
                          onClick={handleSaveExpertReview}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                        >
                          {reviewSubmitting ? 'Đang gửi...' : 'Gửi phản hồi chuyên gia'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* ========================================================================================= */}
                  {/* DIALOG KIỂM TRA TRẠNG THÁI REINDEX */}
                  {/* ========================================================================================= */}
                  <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Xóa đoạn tri thức này?</DialogTitle>
                        <DialogDescription>
                          Lavi sẽ không còn dùng đoạn này để trả lời. Muốn tạm ẩn thì dùng "Bỏ duyệt" thay vì xóa.
                        </DialogDescription>
                      </DialogHeader>
                      {deleteTarget && (
                        <div className="space-y-1 rounded-md border bg-muted/40 p-3 text-xs">
                          <p className="line-clamp-3 italic text-muted-foreground">"{deleteTarget.evidenceText}"</p>
                          <p className="truncate text-muted-foreground">{deleteTarget.sourceUrl}</p>
                        </div>
                      )}
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                          Hủy
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteSource} disabled={deleting}>
                          {deleting ? 'Đang xóa...' : 'Xóa'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* ========================================================================================= */}
                  {/* DIALOG XÁC NHẬN XÓA CẢ BÀI BÁO (NHÁNH 3) */}
                  {/* ========================================================================================= */}
                  <Dialog
                    open={deleteArticleTarget !== null}
                    onOpenChange={(open) => {
                      if (!open && !deletingArticle) setDeleteArticleTarget(null);
                    }}
                  >
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
                          <Trash2 className="w-4 h-4 text-destructive" />
                          <span>Xóa toàn bộ bài viết này?</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                          Thao tác này sẽ xóa mềm toàn bộ <strong>{deleteArticleTarget?.totalCount || 0} đoạn trích</strong> thuộc bài viết này. Trợ lý Lavi sẽ lập tức reindex và ngừng trích dẫn toàn bộ nội dung của bài.
                        </DialogDescription>
                      </DialogHeader>
                      {deleteArticleTarget && (
                        <div className="space-y-2 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs">
                          <p className="font-bold text-foreground">{deleteArticleTarget.sourceTitle}</p>
                          <p className="text-[11px] text-muted-foreground">{deleteArticleTarget.organization}</p>
                          <p className="truncate text-[10px] text-muted-foreground font-mono">{deleteArticleTarget.sourceUrl}</p>
                          <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                            Số bệnh liên quan:{' '}
                            <span className="font-semibold">
                              {deleteArticleTarget.diseasesList.map((d) => d.diseaseName).join(', ')}
                            </span>
                          </div>
                        </div>
                      )}
                      <DialogFooter>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteArticleTarget(null)}
                          disabled={deletingArticle}
                        >
                          Hủy
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleDeleteArticle}
                          disabled={deletingArticle}
                          className="font-semibold"
                        >
                          {deletingArticle ? 'Đang xóa cả bài...' : 'Xác nhận xóa cả bài'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* ========================================================================================= */}
                  {/* DIALOG XÁC NHẬN XÓA HÀNG LOẠT (NHÁNH 3) */}
                  {/* ========================================================================================= */}
                  <Dialog
                    open={deleteBatchModalOpen}
                    onOpenChange={(open) => {
                      if (!open && !deletingBatch) setDeleteBatchModalOpen(false);
                    }}
                  >
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
                          <Trash2 className="w-4 h-4 text-destructive" />
                          <span>Xóa hàng loạt {selectedSourceIds.length} đoạn tri thức?</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                          Bạn đã chọn <strong>{selectedSourceIds.length} đoạn trích</strong> từ các bài báo khác nhau. Tất cả đoạn này sẽ bị gỡ bỏ khỏi kho tri thức của Lavi.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs text-muted-foreground">
                        Hệ thống sẽ đồng bộ hóa lại vector embeddings trong một lần thao tác duy nhất.
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteBatchModalOpen(false)}
                          disabled={deletingBatch}
                        >
                          Hủy
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleBatchDelete}
                          disabled={deletingBatch}
                          className="font-semibold"
                        >
                          {deletingBatch ? 'Đang xóa...' : `Xóa ${selectedSourceIds.length} đoạn`}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* ========================================================================================= */}
                  {/* DIALOG TÁCH ĐOẠN TRÍCH DẪN (AN TOÀN NGUYÊN VĂN THEO LUẬT SHTT) */}
                  {/* ========================================================================================= */}
                  <Dialog open={splitModalOpen} onOpenChange={setSplitModalOpen}>
                    <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                          <Scissors className="w-4 h-4 text-emerald-700" />
                          <span>Chia đoạn trích dẫn {splitTargetPara ? `(${splitTargetPara.id})` : ''}</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                          Mỗi đoạn tối đa 1.500 ký tự. Bạn có thể nhấp chuột vào biểu tượng ✂️ sau bất kỳ câu nào để đặt một hoặc nhiều mốc cắt, chia thành nhiều đoạn nhỏ tùy ý.
                        </DialogDescription>
                      </DialogHeader>

                      {splitTargetPara && (() => {
                        const regex = /[^.!?;\r\n]+(?:[.!?;\r\n]+|$)/g;
                        const matches = splitTargetPara.text.match(regex);
                        const sents = matches ? matches.map((s) => s.trim()).filter(Boolean) : [splitTargetPara.text];
                        const parts = computeSplitParts(splitTargetPara.text, selectedCutIndices);
                        const hasInvalidPart = parts.some(p => p.length < 30 || p.length > 1500);

                        return (
                          <div className="space-y-4 py-2 text-xs">
                            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-blue-900 text-[11px] flex items-start gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                              <span>
                                <strong>Bảo vệ bản quyền nguyên văn:</strong> Nhấp vào nút <strong>[✂️ Đặt mốc cắt]</strong> sau câu mong muốn để chia đoạn. Nhấp lại để hủy mốc. Các đoạn con sẽ giữ 100% câu chữ nguyên gốc.
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-muted/40 p-2.5 rounded-lg border border-border">
                              <div>
                                <span>Đoạn gốc: <strong className="font-mono text-foreground">{splitTargetPara.text.length}</strong> ký tự ({sents.length} câu)</span>
                                <span className="mx-2 text-muted-foreground/40">•</span>
                                <span className="font-semibold text-emerald-800">
                                  Đang chọn chia thành {parts.length} đoạn ({selectedCutIndices.length} mốc cắt)
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setSelectedCutIndices([])}
                                  disabled={selectedCutIndices.length === 0}
                                  className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                                >
                                  Xóa các mốc
                                </Button>
                              </div>
                            </div>

                            {/* Danh sách câu với các nút mốc cắt tương tác */}
                            {sents.length > 1 && (
                              <div className="p-3 bg-muted/20 rounded-lg border border-border space-y-2">
                                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                                  <span>Văn bản và các điểm ngắt câu:</span>
                                  <span className="text-[11px] text-muted-foreground font-normal">Nhấp vào mốc để bật/tắt điểm chia</span>
                                </div>
                                <div className="space-y-2 max-h-56 overflow-y-auto p-3 bg-background rounded border border-border/70 text-xs leading-relaxed font-sans">
                                  {sents.map((sent, idx) => {
                                    const isCutAfterThis = selectedCutIndices.includes(idx);
                                    const cutOrder = selectedCutIndices.indexOf(idx) + 1;
                                    const isLast = idx === sents.length - 1;

                                    return (
                                      <React.Fragment key={idx}>
                                        <span className={isCutAfterThis ? 'text-emerald-950 font-medium bg-emerald-50/60 px-1 py-0.5 rounded' : 'text-foreground'}>
                                          {sent}{' '}
                                        </span>
                                        {!isLast && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedCutIndices(prev => {
                                                if (prev.includes(idx)) {
                                                  return prev.filter(x => x !== idx).sort((a, b) => a - b);
                                                } else {
                                                  return [...prev, idx].sort((a, b) => a - b);
                                                }
                                              });
                                            }}
                                            className={`inline-flex items-center gap-1 mx-1 my-0.5 px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                              isCutAfterThis
                                                ? 'bg-emerald-700 text-white shadow-xs scale-105'
                                                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300'
                                            }`}
                                            title={isCutAfterThis ? 'Bấm để hủy mốc cắt này' : 'Bấm để ngắt câu tại đây'}
                                          >
                                            <Scissors className="w-2.5 h-2.5" />
                                            <span>{isCutAfterThis ? `Mốc #${cutOrder}` : 'Cắt tại đây'}</span>
                                          </button>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Danh sách các đoạn con sẽ được tạo ra (Preview) */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-foreground">
                                <span>Xem trước {parts.length} đoạn con sau khi chia:</span>
                                {hasInvalidPart && (
                                  <span className="text-destructive text-[11px] font-normal">
                                    Có đoạn con vượt quá 1.500 ký tự hoặc quá ngắn (&lt; 30 ký tự)
                                  </span>
                                )}
                              </div>
                              <div className="space-y-2 max-h-60 overflow-y-auto">
                                {parts.map((partText, pIdx) => {
                                  const len = partText.length;
                                  const isTooLong = len > 1500;
                                  const isTooShort = len < 30;

                                  return (
                                    <div key={pIdx} className="p-2.5 bg-background rounded-lg border border-border space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-emerald-800 text-xs">
                                          Đoạn #{pIdx + 1} ({splitTargetPara.id}_{pIdx + 1})
                                        </span>
                                        <span className={`text-[11px] font-mono font-medium ${
                                          isTooLong || isTooShort ? 'text-destructive font-bold' : 'text-emerald-700'
                                        }`}>
                                          {len} / 1.500 ký tự {isTooLong ? '(Quá dài > 1500)' : isTooShort ? '(Quá ngắn < 30)' : '(Hợp lệ)'}
                                        </span>
                                      </div>
                                      <p className="text-xs text-foreground/80 italic leading-relaxed line-clamp-3 select-all bg-muted/30 p-2 rounded">
                                        "{partText}"
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      <DialogFooter className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSplitModalOpen(false)}>
                          Hủy
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleConfirmSplit}
                          disabled={
                            !splitTargetPara ||
                            selectedCutIndices.length === 0 ||
                            computeSplitParts(splitTargetPara.text, selectedCutIndices).some(p => p.length < 30 || p.length > 1500)
                          }
                          className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                        >
                          Xác nhận chia thành {selectedCutIndices.length + 1} đoạn
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* ========================================================================================= */}
                  {/* DIALOG TRẠNG THÁI ĐỒNG BỘ TRI THỨC VÀO TRỢ LÝ AI LAVI */}
                  {/* ========================================================================================= */}
                  <Dialog open={reindexStatusOpen} onOpenChange={setReindexStatusOpen}>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                          <Database className="w-4 h-4 text-emerald-700" />
                          <span>Đồng bộ tri thức vào Trợ lý AI Lavi</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                          Bộ nhớ của trợ lý AI Lavi được lập chỉ mục vector (Semantic Search) và từ khóa (BM25) từ các đoạn bài báo khuyến nông đã duyệt. Bấm "Làm mới trạng thái" để kiểm tra xem dữ liệu mới nhất đã được nạp đầy đủ vào bộ nhớ AI hay chưa.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="py-2 text-xs space-y-3">
                        {loadingReindexStatus ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-700" />
                            Đang truy vấn trạng thái từ Agent Service...
                          </div>
                        ) : reindexStatusData ? (
                          <>
                            {/* Trạng thái hoạt động chính */}
                            {reindexStatusData.running ? (
                              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2.5 text-blue-900">
                                <RefreshCw className="w-4 h-4 animate-spin text-blue-700 shrink-0" />
                                <div>
                                  <div className="font-semibold text-xs">Đang đồng bộ dữ liệu vector trong nền</div>
                                  <div className="text-[11px] text-blue-700">Agent Service đang tính toán embedding cho các bài viết mới.</div>
                                </div>
                              </div>
                            ) : reindexStatusData.last_error ? (
                              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2.5 text-destructive">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <div>
                                  <div className="font-semibold text-xs">Lần đồng bộ gần nhất gặp sự cố</div>
                                  <div className="text-[11px] opacity-90">{reindexStatusData.last_error}</div>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-emerald-900">
                                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                                <div>
                                  <div className="font-semibold text-xs">Hệ thống đồng bộ hoạt động bình thường</div>
                                  <div className="text-[11px] text-emerald-700">Kho tri thức đã được lập chỉ mục và sẵn sàng cho Trợ lý Lavi.</div>
                                </div>
                              </div>
                            )}

                            {/* 3 Metric cards */}
                            <div className="grid grid-cols-3 gap-2">
                              <div className="p-2.5 bg-muted/40 border border-border rounded-lg text-center">
                                <div className="text-[10px] text-muted-foreground uppercase font-medium">Đoạn đã lập chỉ mục</div>
                                <div className="text-base font-bold text-foreground mt-0.5 font-mono">
                                  {reindexStatusData.indexed_documents?.toLocaleString('vi-VN') ?? 0}
                                </div>
                              </div>

                              <div className="p-2.5 bg-muted/40 border border-border rounded-lg text-center">
                                <div className="text-[10px] text-muted-foreground uppercase font-medium">Lần thành công gần nhất</div>
                                <div className="text-[11px] font-semibold text-foreground mt-1">
                                  {reindexStatusData.last_success_at
                                    ? new Date(reindexStatusData.last_success_at).toLocaleString('vi-VN', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                    : 'Chưa có'}
                                </div>
                              </div>

                              <div className="p-2.5 bg-muted/40 border border-border rounded-lg text-center">
                                <div className="text-[10px] text-muted-foreground uppercase font-medium">Hàng đợi nền</div>
                                <div className="text-[11px] font-semibold mt-1">
                                  {reindexStatusData.pending ? (
                                    <span className="text-amber-700">Có yêu cầu chờ</span>
                                  ) : (
                                    <span className="text-emerald-700">Đã đồng bộ hết</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Collapsible raw JSON */}
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => setShowRawReindexJson(!showRawReindexJson)}
                                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium"
                              >
                                {showRawReindexJson ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                <span>{showRawReindexJson ? 'Ẩn phản hồi JSON' : 'Xem phản hồi JSON kỹ thuật'}</span>
                              </button>
                              {showRawReindexJson && (
                                <pre className="mt-2 p-3 bg-muted rounded-lg font-mono text-[10px] overflow-x-auto border border-border max-h-40">
                                  {JSON.stringify(reindexStatusData, null, 2)}
                                </pre>
                              )}
                            </div>
                          </>
                        ) : (
                          <p className="text-muted-foreground py-4 text-center">Không có dữ liệu phản hồi.</p>
                        )}
                      </div>

                      <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loadingReindexStatus}
                          onClick={checkReindexStatus}
                          className="gap-1.5 text-xs"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${loadingReindexStatus ? 'animate-spin' : ''}`} />
                          Làm mới trạng thái
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setReindexStatusOpen(false)}>
                          Đóng
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* ========================================================================================= */}
                  {/* DIALOG THÊM ẢNH TRIỆU CHỨNG MỚI (TASK-15 PHASE 2) */}
                  {/* ========================================================================================= */}
                  <Dialog open={addImageModalOpen} onOpenChange={setAddImageModalOpen}>
                    <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-base font-bold flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-primary" />
                          <span>Thêm ảnh triệu chứng thực địa</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                          Ảnh triệu chứng theo bộ phận (lá, quả, thân, toàn cây) hiển thị trên Sổ tay bệnh học và đối chiếu chẩn đoán.
                        </DialogDescription>
                      </DialogHeader>

                      <form onSubmit={handleCreateKnowledgeImage} className="space-y-4 py-2 text-xs">
                        {/* Lớp bệnh mục tiêu (2 dropdown: Cây & Bệnh) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="font-semibold block mb-1">1. Loài cây trồng *</label>
                            <select
                              aria-label="Chọn loài cây trồng"
                              value={newImagePlant}
                              onChange={(e) => {
                                const p = e.target.value;
                                setNewImagePlant(p);
                                const match = diseases.find((d) => d.plantName === p);
                                if (match) setNewImageClass(match.classCode);
                              }}
                              className="h-9 w-full px-2.5 rounded-md border border-input bg-background text-xs cursor-pointer"
                            >
                              {uniquePlants.map((plant) => (
                                <option key={plant} value={plant}>
                                  {plant}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="font-semibold block mb-1">2. Bệnh hại mục tiêu *</label>
                            <select
                              aria-label="Chọn bệnh hại mục tiêu"
                              value={newImageClass}
                              onChange={(e) => setNewImageClass(e.target.value)}
                              className="h-9 w-full px-2.5 rounded-md border border-input bg-background text-xs cursor-pointer truncate"
                            >
                              {diseases
                                .filter((d) => d.plantName === newImagePlant)
                                .map((d) => (
                                  <option key={d.classCode} value={d.classCode}>
                                    {formatTopicLabel(d.commonNameVi, d.classCode)}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>

                        {/* Bộ phận cây */}
                        <div>
                          <label className="font-semibold block mb-1">3. Bộ phận cây nhiễm bệnh *</label>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { id: 'LEAF', label: 'Lá cây' },
                              { id: 'FRUIT', label: 'Hoa / Quả' },
                              { id: 'STEM', label: 'Thân / Cành' },
                              { id: 'WHOLE_PLANT', label: 'Toàn cây' },
                            ].map((part) => (
                              <button
                                key={part.id}
                                type="button"
                                onClick={() => setNewImagePlantPart(part.id)}
                                className={`rounded-lg py-1.5 px-2 text-xs font-semibold border transition-all ${newImagePlantPart === part.id
                                    ? 'bg-primary text-white border-primary shadow-2xs'
                                    : 'bg-secondary text-foreground border-border hover:bg-secondary/80'
                                  }`}
                              >
                                {part.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Chọn phương thức tải ảnh: HTTPS URL vs Upload File */}
                        <div className="space-y-2 rounded-xl border border-border p-3 bg-secondary/20">
                          <label className="font-semibold block">4. Nguồn cung cấp ảnh *</label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setNewImageMode('URL')}
                              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${newImageMode === 'URL'
                                  ? 'bg-primary text-white border-primary shadow-2xs'
                                  : 'bg-background text-foreground border-border hover:bg-muted'
                                }`}
                            >
                              <LinkIcon className="w-3.5 h-3.5" /> Dán HTTPS URL ảnh
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewImageMode('FILE')}
                              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${newImageMode === 'FILE'
                                  ? 'bg-primary text-white border-primary shadow-2xs'
                                  : 'bg-background text-foreground border-border hover:bg-muted'
                                }`}
                            >
                              <UploadCloud className="w-3.5 h-3.5" /> Tải ảnh lên MinIO
                            </button>
                          </div>

                          {newImageMode === 'URL' ? (
                            <div className="space-y-1.5 pt-1">
                              <Input
                                type="url"
                                placeholder="https://example.com/images/late-blight-symptom.jpg"
                                value={newImageUrl}
                                onChange={(e) => setNewImageUrl(e.target.value)}
                                className="text-xs bg-background"
                              />
                              <p className="text-[10px] text-muted-foreground">
                                URL ảnh trực tiếp phải là link https:// an toàn từ trang nông nghiệp uy tín.
                              </p>
                              {newImageUrl.trim() && (newImageUrl.startsWith('http://') || newImageUrl.startsWith('https://')) && (
                                <div className="mt-2 p-2 rounded-lg border border-border bg-muted/20">
                                  <div className="text-[11px] font-semibold text-muted-foreground mb-1">Xem trước ảnh từ URL:</div>
                                  <div className="relative aspect-4/3 max-w-[220px] rounded-lg overflow-hidden border border-border bg-background flex items-center justify-center">
                                    <img
                                      src={newImageUrl}
                                      alt="Xem trước ảnh"
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                        const fallback = (e.target as HTMLElement).nextElementSibling;
                                        if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                      }}
                                    />
                                    <div className="hidden h-full w-full flex-col items-center justify-center p-2 text-center text-[10px] text-destructive">
                                      <span>Không tải được ảnh từ URL này. Vui lòng kiểm tra link trực tiếp.</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2 pt-1">
                              <Input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleImageFileChange}
                                className="text-xs bg-background"
                              />
                              <p className="text-[11px] text-muted-foreground font-medium">
                                Định dạng hỗ trợ: JPG, PNG, WebP (tối đa 5MB). Ưu tiên ảnh chụp rõ triệu chứng thực địa trên đồng ruộng.
                              </p>
                              <p className="text-[10px] text-muted-foreground italic">
                                * Hệ thống tự động xóa EXIF / GPS để bảo vệ quyền riêng tư và lưu trữ an toàn trên MinIO bucket lavitree-images.
                              </p>
                              {newImageFilePreview && (
                                <div className="relative aspect-4/3 max-w-[200px] rounded-lg overflow-hidden border border-border">
                                  <img src={newImageFilePreview} alt="Xem trước" className="h-full w-full object-cover" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Mô tả / chú thích triệu chứng */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="font-semibold">5. Chú thích / Mô tả triệu chứng *</label>
                            <span className="text-[10px] text-muted-foreground">{newImageCaption.length}/300 ký tự</span>
                          </div>
                          <Textarea
                            placeholder="Ví dụ: Vết đốm sương mai màu nâu đen xuất hiện ở rìa lá, mặt dưới có lớp nấm trắng mịn trong điều kiện ẩm ướt."
                            value={newImageCaption}
                            onChange={(e) => setNewImageCaption(e.target.value)}
                            maxLength={300}
                            rows={2}
                            required
                            className="text-xs"
                          />
                        </div>

                        {/* Nguồn / Bản quyền & Bài viết gốc */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="font-semibold block mb-1">6. Nguồn / Tác giả sở hữu ảnh *</label>
                            <Input
                              type="text"
                              placeholder="Ví dụ: Cổng TTĐT Khuyến nông Quốc gia"
                              value={newImageCredit}
                              onChange={(e) => setNewImageCredit(e.target.value)}
                              maxLength={200}
                              required
                              className="text-xs"
                            />
                          </div>

                          <div>
                            <label className="font-semibold block mb-1">7. URL bài viết gốc *</label>
                            <Input
                              type="url"
                              placeholder="https://khuyennongvn.gov.vn/..."
                              value={newImageSourceUrl}
                              onChange={(e) => setNewImageSourceUrl(e.target.value)}
                              required
                              className="text-xs"
                            />
                          </div>
                        </div>

                        {/* Ghi chú giấy phép */}
                        <div>
                          <label className="font-semibold block mb-1">8. Ghi chú giấy phép / bản quyền (tùy chọn)</label>
                          <Input
                            type="text"
                            placeholder="Ví dụ: Trích dẫn phi thương mại phục vụ hướng dẫn nông nghiệp"
                            value={newImageLicenseNote}
                            onChange={(e) => setNewImageLicenseNote(e.target.value)}
                            maxLength={200}
                            className="text-xs"
                          />
                        </div>

                        {/* Tự động duyệt ngay */}
                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={newImageAutoApprove}
                            onChange={(e) => setNewImageAutoApprove(e.target.checked)}
                            className="h-4 w-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
                          >
                          </input>
                          <span className="font-semibold text-foreground">
                            Duyệt và cho phép hiển thị ngay trên Sổ tay bệnh học
                          </span>
                        </label>

                        <DialogFooter className="pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAddImageModalOpen(false)}
                            disabled={submittingImage}
                          >
                            Hủy
                          </Button>
                          <Button
                            type="submit"
                            size="sm"
                            disabled={submittingImage}
                            className="bg-primary hover:bg-primary-hover text-white font-semibold"
                          >
                            {submittingImage ? 'Đang lưu ảnh...' : 'Lưu ảnh triệu chứng'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>

                  {/* DIALOG XÓA ẢNH TRIỆU CHỨNG */}
                  <Dialog open={deleteImageTarget !== null} onOpenChange={(open) => { if (!open && !deletingImage) setDeleteImageTarget(null); }}>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Gỡ ảnh triệu chứng này?</DialogTitle>
                        <DialogDescription className="text-xs">
                          Ảnh sẽ được đánh dấu xóa và không còn hiển thị trên Sổ tay bệnh học. Nếu muốn tạm ẩn, bạn có thể chọn "Bỏ duyệt" thay vì xóa.
                        </DialogDescription>
                      </DialogHeader>

                      {deleteImageTarget && (
                        <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3 text-xs">
                          <div className="relative aspect-4/3 w-full rounded-lg overflow-hidden bg-muted max-w-[200px] mx-auto">
                            <img src={deleteImageTarget.image_url} alt={deleteImageTarget.caption} className="h-full w-full object-cover" />
                          </div>
                          <p className="font-semibold text-foreground text-center">{deleteImageTarget.plant_name} — {deleteImageTarget.disease_name}</p>
                          <p className="italic text-muted-foreground text-center">"{deleteImageTarget.caption}"</p>
                        </div>
                      )}

                      <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setDeleteImageTarget(null)} disabled={deletingImage}>
                          Hủy
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleDeleteImage} disabled={deletingImage}>
                          {deletingImage ? 'Đang gỡ...' : 'Xóa ảnh'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* DIALOG PHÓNG TO ẢNH TRONG ADMIN */}
                  <Dialog open={previewingImage !== null} onOpenChange={(open) => !open && setPreviewingImage(null)}>
                    <DialogContent className="sm:max-w-3xl">
                      {previewingImage && (
                        <div className="space-y-4">
                          <DialogHeader className="space-y-1 text-left">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs font-semibold">
                                {previewingImage.plant_part === 'LEAF'
                                  ? 'Lá'
                                  : previewingImage.plant_part === 'FRUIT'
                                    ? 'Quả/Hoa'
                                    : previewingImage.plant_part === 'STEM'
                                      ? 'Thân/Cành'
                                      : 'Toàn cây'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-xs font-semibold text-primary">
                                {previewingImage.plant_name} — {previewingImage.disease_name}
                              </span>
                            </div>
                            <DialogTitle className="text-base font-bold text-foreground">
                              {previewingImage.caption}
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                              Chi tiết ảnh triệu chứng
                            </DialogDescription>
                          </DialogHeader>

                          <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl bg-black/5 border border-border">
                            <img
                              src={previewingImage.image_url}
                              alt={previewingImage.caption}
                              className="h-full w-full object-contain"
                            />
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
                            <div>
                              Nguồn/Bản quyền: <strong className="text-foreground">{previewingImage.credit}</strong>
                              {previewingImage.license_note && (
                                <span className="italic block text-[11px] mt-0.5">{previewingImage.license_note}</span>
                              )}
                            </div>
                            {previewingImage.source_url && (
                              <a
                                href={previewingImage.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                              >
                                <span>Xem bài báo nguồn</span>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
                );
};

                export default AdminDashboard;
