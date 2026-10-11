import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BookOpen, Search, Copy, ExternalLink, CheckCircle2, AlertCircle,
  Download, Trash2, Info, ShieldCheck, Layers, Sparkles,
  FileText, Check, AlertTriangle, RefreshCw, Bot, Wand2, Calendar, Target, Globe,
  ChevronDown, ChevronUp
} from 'lucide-react';

interface ClassItem {
  modelClass: string;
  plantName: string;
  diseaseName: string;
  phase: number;
  phaseName: string;
  isHealthy: boolean;
  suggestedKeywords: string;
  suggestedKeywordsVn?: string;
  guidanceNotes: string;
  sourcesCount: number;
  status: string;
}

interface StatsData {
  totalClasses: number;
  completedClasses: number;
  inProgressClasses: number;
  unstartedClasses: number;
  totalSources: number;
  completionPercentage: number;
  phase1: { total: number; completed: number; percent: number };
  phase2: { total: number; completed: number; percent: number };
  phase3: { total: number; completed: number; percent: number };
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
  matchLevel?: string;
  sourceScope?: string;
  evidenceText: string;
  contentType: string;
  hasCultivationTechnique?: boolean;
  sourceQuality: string;
  isManualApproved: boolean;
  reviewerNotes?: string;
  createdAt: string;
}

export const KnowledgeCollectorPage: React.FC = () => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [sources, setSources] = useState<KnowledgeSourceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filter states
  const [selectedPhase, setSelectedPhase] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected class for adding source
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  // Form states
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [sourceTitle, setSourceTitle] = useState<string>('');
  const [organization, setOrganization] = useState<string>('');
  const [publishedDate, setPublishedDate] = useState<string>('');
  const [matchLevel, setMatchLevel] = useState<string>('Khớp trực tiếp');
  const [sourceScope, setSourceScope] = useState<string>('Việt Nam');
  const [evidenceText, setEvidenceText] = useState<string>('');
  const [contentType, setContentType] = useState<string>('Triệu chứng & Biện pháp');
  const [hasCultivation, setHasCultivation] = useState<boolean>(false);
  const [isManualApproved, setIsManualApproved] = useState<boolean>(false);
  const [reviewerNotes, setReviewerNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  // AI Assistant states
  const [aiRawText, setAiRawText] = useState<string>('');
  const [showAiBox, setShowAiBox] = useState<boolean>(true);
  const [copiedKeywordIntl, setCopiedKeywordIntl] = useState<boolean>(false);
  const [copiedKeywordVn, setCopiedKeywordVn] = useState<boolean>(false);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [showPromptPreview, setShowPromptPreview] = useState<boolean>(false);
  const [additionalClassCodes, setAdditionalClassCodes] = useState<string[]>([]);
  const [additionalClassConfigs, setAdditionalClassConfigs] = useState<Record<string, {
    contentType: string;
    matchLevel: string;
    customEvidence?: string;
    hasCultivation?: boolean;
  }>>({});

  // UX & Layout states (Anti-fatigue & Compact mode)
  const [activeTab, setActiveTab] = useState<'entry' | 'sources'>('entry');
  const [showDashboardDetails, setShowDashboardDetails] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  // Notification / Alert
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // API Base URL (uses Vite proxy or direct)
  const API_BASE = '/api/v1/knowledge';

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [classesRes, statsRes, sourcesRes] = await Promise.all([
        axios.get<ClassItem[]>(`${API_BASE}/classes`),
        axios.get<StatsData>(`${API_BASE}/stats`),
        axios.get<KnowledgeSourceItem[]>(`${API_BASE}/sources`)
      ]);

      setClasses(classesRes.data);
      setStats(statsRes.data);
      setSources(sourcesRes.data);

      // Auto-select first class if none selected
      if (!selectedClass && classesRes.data.length > 0) {
        setSelectedClass(classesRes.data[0]);
      } else if (selectedClass) {
        const updated = classesRes.data.find(c => c.modelClass === selectedClass.modelClass);
        if (updated) setSelectedClass(updated);
      }
    } catch (err: any) {
      console.error('Error fetching knowledge data:', err);
      setNotification({
        type: 'error',
        message: 'Không thể kết nối đến máy chủ Core API. Vui lòng kiểm tra lại backend.'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-dismiss notifications after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Classes of the same plant (for Multi-Class tagging and AI prompt)
  const samePlantClasses = selectedClass
    ? classes.filter(c => c.plantName === selectedClass.plantName && c.modelClass !== selectedClass.modelClass)
    : [];

  // Helper normalize URL (trims whitespace, trailing slashes, and lowercase)
  const normalizeUrl = (u: string) => (u || '').trim().toLowerCase().replace(/\/+$/, '');

  // Live duplicate URL detection
  const normalizedCurrentUrl = normalizeUrl(sourceUrl);
  const isDuplicateForSelectedClass = Boolean(
    selectedClass &&
    normalizedCurrentUrl &&
    sources.some(s => s.modelClass === selectedClass.modelClass && normalizeUrl(s.sourceUrl) === normalizedCurrentUrl)
  );

  const existingOtherSourcesWithUrl = sources.filter(
    s => normalizedCurrentUrl &&
         (!selectedClass || s.modelClass !== selectedClass.modelClass) &&
         normalizeUrl(s.sourceUrl) === normalizedCurrentUrl
  );

  // Helper to get Vietnamese keywords
  const getVnKeywords = (item: ClassItem): string => {
    if (item.suggestedKeywordsVn && item.suggestedKeywordsVn.trim()) {
      return item.suggestedKeywordsVn;
    }
    if (item.isHealthy) {
      return `kỹ thuật trồng chăm sóc ${item.plantName.toLowerCase()} đạt năng suất cao phòng bệnh khuyennong`;
    }
    return `bệnh ${item.diseaseName.toLowerCase()} trên cây ${item.plantName.toLowerCase()} triệu chứng phòng trị thuốc BVTV nongnghiep`;
  };

  // Comprehensive Knowledge Coverage Evaluator
  const getClassCoverage = (cls: ClassItem) => {
    const classSources = sources.filter(s => s.modelClass === cls.modelClass);
    const count = classSources.length;

    // 1. Nguồn Việt Nam
    const hasVn = classSources.some(s => 
      s.sourceScope === 'Việt Nam' || 
      (s.organization && s.organization.toLowerCase().includes('việt nam')) || 
      s.sourceUrl.includes('.vn')
    );

    // 2. Nguồn Quốc Tế
    const hasIntl = classSources.some(s => 
      s.sourceScope === 'Quốc tế' || 
      s.sourceUrl.includes('.edu') || 
      s.sourceUrl.includes('.org') || 
      s.sourceUrl.includes('.gov') || 
      (!s.sourceUrl.includes('.vn') && s.sourceScope !== 'Việt Nam')
    );

    // 3. Triệu chứng nhận diện (từ bất kỳ nguồn nào)
    const hasSymptoms = classSources.some(s => 
      s.contentType === 'Triệu chứng & Biện pháp' || 
      s.contentType === 'Chỉ triệu chứng bệnh' ||
      (s.contentType.toLowerCase().includes('triệu chứng') && !s.contentType.toLowerCase().includes('không'))
    );

    // 4. Biện pháp & Thuốc BVTV tại Việt Nam (Bắt buộc nguồn VN vì danh mục cấp phép của Bộ NN&PTNT)
    const hasTreatmentVn = classSources.some(s => 
      (s.sourceScope === 'Việt Nam' || s.sourceUrl.includes('.vn')) &&
      (s.contentType === 'Triệu chứng & Biện pháp' || 
       s.contentType === 'Chỉ biện pháp điều trị / thuốc' || 
       s.contentType.toLowerCase().includes('thuốc')) &&
      !s.contentType.toLowerCase().includes('không')
    );

    // 5. Kỹ thuật canh tác & chăm sóc (Hỗ trợ cả trường HasCultivationTechnique và ContentType)
    const hasCultivation = classSources.some(s => 
      s.hasCultivationTechnique === true ||
      s.contentType === 'Kỹ thuật canh tác & phòng ngừa' ||
      s.contentType.toLowerCase().includes('canh tác') ||
      s.contentType.toLowerCase().includes('chăm sóc')
    );

    // Tổng kết tình trạng
    let isPerfect = false;
    let statusLabel = '';
    let statusType: 'success' | 'warning' | 'info' | 'neutral' = 'neutral';
    let advice = '';

    if (cls.isHealthy) {
      // Đợt 3: Cây khỏe mạnh
      if (count >= 2 && hasVn && hasIntl && hasCultivation) {
        isPerfect = true;
        statusLabel = '🌟 Hoàn Hảo (Đủ QT + VN + Canh tác)';
        statusType = 'success';
        advice = '🎉 Đã có đủ quy trình canh tác khuyến nông tại Việt Nam và đối chiếu học thuật quốc tế!';
      } else if (count >= 2 && !hasVn) {
        statusLabel = '⚠️ Thiếu Nguồn Khuyến Nông Việt Nam';
        statusType = 'warning';
        advice = '💡 Cần bổ sung tài liệu kỹ thuật canh tác thích nghi với khí hậu & thổ nhưỡng Việt Nam (Báo Nông nghiệp, TTKN, Viện Cây ăn quả).';
      } else if (count >= 2 && !hasCultivation) {
        statusLabel = '⚠️ Thiếu Nội Dung Kỹ Thuật Canh Tác';
        statusType = 'warning';
        advice = '💡 Các tài liệu hiện tại chưa có phần hướng dẫn quy trình tưới tiêu, bón phân và chăm sóc cây khỏe.';
      } else if (count === 1) {
        statusLabel = '⏳ Đang thu thập (1/2 nguồn)';
        statusType = 'info';
        advice = hasVn 
          ? '💡 Đã có nguồn Việt Nam. Bạn hãy tìm thêm 1 nguồn Quốc tế (.edu / FAO) để đối chiếu học thuật.'
          : '💡 Đã có nguồn Quốc tế. Bạn cần tìm thêm 1 nguồn Khuyến nông Việt Nam!';
      } else {
        statusLabel = '⚪ Chưa có nguồn nào (0/2)';
        statusType = 'neutral';
        advice = '💡 Hãy bấm "Sao chép từ khóa VN" hoặc "Tìm trên Google VN" bên dưới để tìm tài liệu đầu tiên.';
      }
    } else {
      // Đợt 1 & 2: Bệnh cây trồng
      if (count >= 2 && hasVn && hasIntl && hasSymptoms && hasTreatmentVn) {
        isPerfect = true;
        statusType = 'success';
        if (hasCultivation) {
          statusLabel = '🌟 Hoàn Hảo (Đủ Triệu chứng + Thuốc VN + 🌾 Canh tác)';
          advice = '🎉 Chuẩn dữ liệu vàng: Có triệu chứng nhận diện, thuốc BVTV tại VN và kèm kỹ thuật canh tác (Bonus)!';
        } else {
          statusLabel = '🌟 Hoàn Hảo (Đủ QT + VN + Triệu chứng + Thuốc VN)';
          advice = '🎉 Chuẩn dữ liệu vàng: Có triệu chứng nhận diện và phác đồ thuốc BVTV được cấp phép lưu hành tại Việt Nam!';
        }
      } else if (count >= 2 && !hasTreatmentVn) {
        statusLabel = '⚠️ Thiếu Thuốc BVTV Lưu Hành Tại VN';
        statusType = 'warning';
        advice = '💡 Ưu tiên Việt Nam: Nước ngoài dùng danh mục hoạt chất khác. Nông dân VN cần thuốc BVTV được Cục BVTV cấp phép lưu hành. Hãy bấm "Tìm Google VN" để lấy thêm bài viết trên nongnghiep.vn!';
      } else if (count >= 2 && !hasSymptoms) {
        statusLabel = '⚠️ Thiếu Triệu Chứng Nhận Diện Vết Bệnh';
        statusType = 'warning';
        advice = '💡 Chưa có tài liệu nào mô tả chi tiết vết bệnh và cách nhận diện. Hãy bổ sung bài viết có phần triệu chứng.';
      } else if (count >= 2 && !hasIntl) {
        statusLabel = '⚠️ Thiếu Nguồn Quốc Tế (.edu / FAO)';
        statusType = 'warning';
        advice = '💡 Cần thêm 1 nguồn học thuật đại học quốc tế (Cornell, Penn State, UC Davis...) để chuẩn hóa tên khoa học mầm bệnh.';
      } else if (count >= 2 && !hasVn) {
        statusLabel = '⚠️ Thiếu Nguồn Việt Nam';
        statusType = 'warning';
        advice = '💡 Bắt buộc cần nguồn Việt Nam để có phác đồ phòng trị và tên thương phẩm thuốc BVTV thực tế tại VN.';
      } else if (count === 1) {
        statusLabel = '⏳ Đang thu thập (1/2 nguồn)';
        statusType = 'info';
        if (!hasVn) {
          advice = '💡 Đã có 1 nguồn Quốc tế. Bạn cần tìm thêm 1 bài viết Việt Nam có tên thuốc BVTV lưu hành tại VN!';
        } else {
          advice = '💡 Đã có 1 nguồn Việt Nam. Bạn hãy tìm thêm 1 bài viết Quốc tế (.edu / FAO) để đối chiếu bệnh học!';
        }
      } else {
        statusLabel = '⚪ Chưa có nguồn nào (0/2)';
        statusType = 'neutral';
        advice = '💡 Hãy bấm "Sao chép từ khóa VN" hoặc "Tìm trên Google VN" bên dưới để tìm tài liệu đầu tiên.';
      }
    }

    const hasBoth = hasVn && hasIntl && count >= 2;

    return {
      count,
      hasVn,
      hasIntl,
      hasBoth,
      hasSymptoms,
      hasTreatmentVn,
      hasCultivation,
      isPerfect,
      statusLabel,
      statusType,
      advice
    };
  };

  // Handle select a class
  const handleSelectClass = (cls: ClassItem) => {
    setSelectedClass(cls);
    setCopiedKeywordIntl(false);
    setCopiedKeywordVn(false);
    setCopiedPrompt(false);
    setAdditionalClassCodes([]);
    setAdditionalClassConfigs({});
    if (cls.isHealthy) {
      setContentType('Kỹ thuật canh tác & phòng ngừa');
      setHasCultivation(true);
      setMatchLevel('Khớp trực tiếp');
    } else {
      setContentType('Triệu chứng & Biện pháp');
      setHasCultivation(false);
      setMatchLevel('Khớp trực tiếp');
    }
    setSourceScope('Việt Nam');
    setActiveTab('entry');
    if (window.innerWidth < 768) {
      document.getElementById('source-entry-form')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Universal clipboard function with fallback for HTTP contexts (remote IP)
  const copyToClipboard = async (text: string): Promise<boolean> => {
    // 1. Try modern navigator.clipboard API if available and in secure context
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn('navigator.clipboard failed, attempting fallback...', err);
      }
    }

    // 2. Fallback using document.execCommand for HTTP environments
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.style.opacity = '0';
      textArea.style.zIndex = '-999';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, 99999);
      
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    } catch (err) {
      console.error('Fallback clipboard copy failed:', err);
      return false;
    }
  };

  // Copy Vietnamese keywords
  const handleCopyKeywordsVn = async (keywords: string) => {
    const success = await copyToClipboard(keywords);
    if (success) {
      setCopiedKeywordVn(true);
      setTimeout(() => setCopiedKeywordVn(false), 2500);
    } else {
      setNotification({ type: 'error', message: 'Không thể tự động sao chép. Vui lòng bôi đen từ khóa để sao chép.' });
    }
  };

  // Copy International keywords
  const handleCopyKeywordsIntl = async (keywords: string) => {
    const success = await copyToClipboard(keywords);
    if (success) {
      setCopiedKeywordIntl(true);
      setTimeout(() => setCopiedKeywordIntl(false), 2500);
    } else {
      setNotification({ type: 'error', message: 'Không thể tự động sao chép. Vui lòng bôi đen từ khóa để sao chép.' });
    }
  };

  // Open Google search
  const handleOpenGoogle = (keywords: string, isVn: boolean = false) => {
    const url = isVn
      ? `https://www.google.com/search?q=${encodeURIComponent(keywords)}&lr=lang_vi`
      : `https://www.google.com/search?q=${encodeURIComponent(keywords)}`;
    window.open(url, '_blank');
  };

  // Generate tailored prompt for Browser AI (Gemini / Copilot)
  const generateAiPrompt = (item: ClassItem) => {
    if (item.isHealthy) {
      return `Hãy đọc nội dung trang web hiện tại và trích xuất thông tin kỹ thuật canh tác, chăm sóc cây trồng phục vụ cẩm nang nông nghiệp cho đồ án:
👉 Cây trồng: ${item.plantName}
👉 Chuyên mục: Kỹ thuật canh tác & Chăm sóc cây khỏe mạnh (Mã: ${item.modelClass})

LƯU Ý QUAN TRỌNG:
- Đây là tài liệu cẩm nang cây khỏe mạnh, KHÔNG TÌM THUỐC BVTV HÓA HỌC HAY TRIỆU CHỨNG BỆNH.
- Tập trung vào quy trình nông học: thời vụ gieo trồng, chuẩn bị làm đất, mật độ khoảng cách, kỹ thuật tưới tiêu, bón phân hữu cơ/NPK theo từng giai đoạn, cắt tỉa cành tạo tán và phòng trừ tổng hợp IPM.

YÊU CẦU TRÍCH XUẤT:
1. [URL]: Hãy lấy chính xác đường dẫn URL đầy đủ (bắt đầu bằng https:// hoặc http://) của trang web hiện tại bạn đang đọc trên trình duyệt.
2. Trả lời 100% bằng TIẾNG VIỆT, ngắn gọn, khoa học và trung thực (nếu trang web không có thông tin mục nào thì ghi "Không đề cập").
3. Xuất kết quả ĐÚNG THEO MẪU ĐỊNH DẠNG dưới đây:

[URL]: https://... (Điền chính xác đường dẫn URL đầy đủ của trang web hiện tại)
[TIÊU ĐỀ]: <Tiêu đề bài viết hoặc bản dịch tiếng Việt sát nghĩa>
[CƠ QUAN]: <Tên Trường Đại học, Viện nghiên cứu, Cơ quan Khuyến nông hoặc Tác giả>
[NGÀY CẬP NHẬT]: <Năm hoặc Ngày xuất bản/cập nhật trên trang, nếu không có thì ghi "Không ghi ngày">
[PHẠM VI NGUỒN]: <Chọn 1 trong 2: "Việt Nam" HOẶC "Quốc tế">
[MỨC ĐỘ KHỚP]: Khớp trực tiếp
[LOẠI NỘI DUNG]: Kỹ thuật canh tác & chăm sóc
[TRÍCH DẪN CỐT LÕI]: <2–4 câu tiếng Việt tóm tắt quy trình nông học: làm đất, thời vụ, tưới tiêu, bón phân, tỉa cành giúp cây phát triển khỏe mạnh đạt năng suất cao>`;
    }

    const otherDiseases = classes.filter(
      c => c.plantName === item.plantName && c.modelClass !== item.modelClass && !c.isHealthy
    );
    const healthyClass = classes.find(
      c => c.plantName === item.plantName && c.isHealthy
    );
    const otherClassesBullet = otherDiseases.length > 0
      ? otherDiseases.map(c => `- ${c.diseaseName} (Mã chuẩn: ${c.modelClass})`).join('\n')
      : 'Không có';

    return `Hãy đọc nội dung trang web hiện tại và trích xuất thông tin khuyến nông phục vụ nghiên cứu thẩm định bệnh cây trồng cho đồ án:
👉 Cây trồng: ${item.plantName}
👉 Lớp bệnh chính đang tra cứu: ${item.diseaseName} (Mã: ${item.modelClass})

Danh sách các bệnh khác trên cùng cây ${item.plantName} trong đồ án (để tự động phát hiện nếu bài viết tổng hợp nhiều bệnh):
${otherClassesBullet}

YÊU CẦU TRÍCH XUẤT:
1. [URL]: Hãy lấy chính xác đường dẫn URL đầy đủ (bắt đầu bằng https:// hoặc http://) của trang web hiện tại bạn đang đọc trên trình duyệt. Đây là trường BẮT BUỘC để hệ thống tự động điền form.
2. Trả lời 100% bằng TIẾNG VIỆT, ngắn gọn, khoa học và trung thực (nếu trang web không có thông tin mục nào thì ghi "Không đề cập").
3. Xuất kết quả ĐÚNG THEO MẪU ĐỊNH DẠNG dưới đây:

[URL]: https://... (Điền chính xác đường dẫn URL đầy đủ của trang web hiện tại)
[TIÊU ĐỀ]: <Tiêu đề bài viết hoặc bản dịch tiếng Việt sát nghĩa>
[CƠ QUAN]: <Tên Trường Đại học, Viện nghiên cứu, Cơ quan Khuyến nông hoặc Tác giả>
[NGÀY CẬP NHẬT]: <Năm hoặc Ngày xuất bản/cập nhật trên trang, nếu không có thì ghi "Không ghi ngày">
[PHẠM VI NGUỒN]: <Chọn 1 trong 2: "Việt Nam" (nếu là bài viết tiếng Việt / cơ quan / khuyến nông / thuốc BVTV tại Việt Nam) HOẶC "Quốc tế" (nếu là tài liệu tiếng Anh / trường ĐH quốc tế như Cornell, Penn State, UC Davis, FAO...)>
[MỨC ĐỘ KHỚP]: <Chọn 1 trong 3: "Khớp trực tiếp" HOẶC "Gần nghĩa cần kiểm tra" HOẶC "Tham khảo chung">
[LOẠI NỘI DUNG]: <Chọn 1 trong 4: "Triệu chứng & Biện pháp" HOẶC "Chỉ triệu chứng bệnh" HOẶC "Chỉ biện pháp điều trị" HOẶC "Chỉ tham khảo / Không có chi tiết">
[CÓ KỸ THUẬT CANH TÁC]: <Chọn "Có" (nếu bài viết có hướng dẫn thêm về kỹ thuật canh tác, bón phân, tưới nước, tỉa cành, làm đất...) HOẶC "Không">
[TRÍCH DẪN CỐT LÕI]: <1–3 câu tiếng Việt tóm tắt triệu chứng nhận diện đặc trưng và biện pháp điều trị / hoạt chất khuyến cáo của bệnh chính>
[CÁC BỆNH CÙNG CÂY CÓ TRONG BÀI]: <Nếu bài viết CŨNG CÓ ĐỀ CẬP đến các bệnh khác trên cùng cây ${item.plantName} (trong danh sách trên), hãy liệt kê rõ theo từng dòng định dạng:
- Mã_Chuẩn | Mức_Độ: <"Đủ triệu chứng và thuốc" HOẶC "Chỉ triệu chứng" HOẶC "Chỉ thuốc BVTV" HOẶC "Chỉ tham khảo/nhắc tên"> | Tóm_Tắt: <1 câu ngắn tóm tắt triệu chứng/thuốc riêng của bệnh này nếu có>
${healthyClass ? `Nếu bài viết có kèm hướng dẫn kỹ thuật canh tác, tưới tiêu, bón phân chung cho cây ${item.plantName}, hãy thêm dòng:
- ${healthyClass.modelClass} | Canh_Tác: Có | Tóm_Tắt: <1 câu ngắn tóm tắt kỹ thuật canh tác chung>` : ''}
Nếu bài viết chỉ nói riêng bệnh chính thì ghi "Không có">`;
  };

  // Copy AI Prompt
  const handleCopyAiPrompt = async () => {
    if (!selectedClass) return;
    const prompt = generateAiPrompt(selectedClass);
    const success = await copyToClipboard(prompt);
    if (success) {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } else {
      setShowPromptPreview(true);
      setNotification({ type: 'error', message: 'Trình duyệt chặn quyền Clipboard trên HTTP. Bạn có thể sao chép trực tiếp từ ô xem trước bên dưới!' });
    }
  };

  // Smart Parser: Auto-fill form from AI raw response & Auto-select Multi-Classes
  const handleParseAiText = () => {
    if (!aiRawText.trim()) {
      setNotification({ type: 'error', message: 'Vui lòng dán câu trả lời của AI vào ô trước khi phân tích.' });
      return;
    }

    let parsedCount = 0;

    // Extract URL (Robust matching for multiple patterns including markdown links, angle brackets, and trailing characters)
    const urlMatch = aiRawText.match(/\[URL\]:\s*<?([^\s>\n\r]+)>?/i) || 
                     aiRawText.match(/(?:URL|Đường dẫn|Link):\s*<?([^\s>\n\r]+)>?/i) ||
                     aiRawText.match(/\[.*?\]\((https?:\/\/[^\s\)]+)\)/i) ||
                     aiRawText.match(/(https?:\/\/[^\s>]+)/i);
    if (urlMatch && urlMatch[1].trim()) {
      const cleanUrl = urlMatch[1].trim().replace(/[.,;>)]+$/, '');
      if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
        setSourceUrl(cleanUrl);
        parsedCount++;
      }
    }

    // Extract Title
    const titleMatch = aiRawText.match(/\[TIÊU ĐỀ\]:\s*(.*)/i) || aiRawText.match(/Tiêu đề:\s*(.*)/i);
    if (titleMatch && titleMatch[1].trim()) {
      setSourceTitle(titleMatch[1].trim());
      parsedCount++;
    }

    // Extract Organization
    const orgMatch = aiRawText.match(/\[CƠ QUAN\]:\s*(.*)/i) || aiRawText.match(/Cơ quan:\s*(.*)/i) || aiRawText.match(/Tác giả:\s*(.*)/i);
    if (orgMatch && orgMatch[1].trim()) {
      setOrganization(orgMatch[1].trim());
      parsedCount++;
    }

    // Extract Published Date
    const dateMatch = aiRawText.match(/\[NGÀY CẬP NHẬT\]:\s*(.*)/i) || aiRawText.match(/Ngày cập nhật:\s*(.*)/i) || aiRawText.match(/Thời gian:\s*(.*)/i);
    if (dateMatch && dateMatch[1].trim()) {
      setPublishedDate(dateMatch[1].trim());
      parsedCount++;
    }

    // Extract Source Scope (Việt Nam vs Quốc tế)
    const scopeMatch = aiRawText.match(/\[PHẠM VI NGUỒN\]:\s*(.*)/i) || 
                       aiRawText.match(/Phạm vi nguồn:\s*(.*)/i);
    if (scopeMatch && scopeMatch[1].trim()) {
      const s = scopeMatch[1].trim().toLowerCase();
      if (s.includes('quốc tế') || s.includes('international') || s.includes('nước ngoài')) {
        setSourceScope('Quốc tế');
      } else {
        setSourceScope('Việt Nam');
      }
      parsedCount++;
    }

    // Extract Match Level
    const matchLevelMatch = aiRawText.match(/\[MỨC ĐỘ KHỚP\]:\s*(.*)/i) || aiRawText.match(/Mức độ khớp:\s*(.*)/i);
    if (matchLevelMatch && matchLevelMatch[1].trim()) {
      const m = matchLevelMatch[1].trim();
      if (m.includes('Khớp trực tiếp')) setMatchLevel('Khớp trực tiếp');
      else if (m.includes('Gần nghĩa') || m.includes('kiểm tra')) setMatchLevel('Gần nghĩa cần kiểm tra');
      else if (m.includes('Tham khảo')) setMatchLevel('Tham khảo chung');
      parsedCount++;
    }

    // Extract Content Type
    if (selectedClass?.isHealthy) {
      setContentType('Kỹ thuật canh tác & phòng ngừa');
      setHasCultivation(true);
    } else {
      const contentTypeMatch = aiRawText.match(/\[LOẠI NỘI DUNG\]:\s*(.*)/i) || aiRawText.match(/Loại nội dung:\s*(.*)/i);
      if (contentTypeMatch && contentTypeMatch[1].trim()) {
        const c = contentTypeMatch[1].trim();
        if (c.includes('Triệu chứng & Biện pháp')) setContentType('Triệu chứng & Biện pháp');
        else if (c.includes('Chỉ triệu chứng')) setContentType('Chỉ triệu chứng bệnh');
        else if (c.includes('điều trị') || c.includes('thuốc')) setContentType('Chỉ biện pháp điều trị / thuốc');
        else if (c.includes('tham khảo') || c.includes('nhắc tên') || c.includes('không có')) setContentType('Chỉ tham khảo / Không có chi tiết');
        parsedCount++;
      }
    }

    // Extract Cultivation Detection
    const cultMatch = aiRawText.match(/\[CÓ KỸ THUẬT CANH TÁC\]:\s*(.*)/i) || 
                      aiRawText.match(/Có kỹ thuật canh tác:\s*(.*)/i);
    let hasCultInArticle = false;
    if (cultMatch && cultMatch[1].trim()) {
      const v = cultMatch[1].trim().toLowerCase();
      if (v.includes('có') || v.includes('yes') || v.includes('true')) {
        hasCultInArticle = true;
      }
    } else {
      const lower = aiRawText.toLowerCase();
      if (lower.includes('bón phân') || lower.includes('tưới nước') || lower.includes('tỉa cành') || lower.includes('luân canh') || lower.includes('làm đất')) {
        hasCultInArticle = true;
      }
    }

    // Extract Evidence Text
    const evidenceMatch = aiRawText.match(/\[TRÍCH DẪN CỐT LÕI\]:\s*([\s\S]*?)(?:$|\n\[)/i) || 
                          aiRawText.match(/Trích dẫn cốt lõi:\s*([\s\S]*?)(?:$|\n[A-Z])/i) || 
                          aiRawText.match(/Trích dẫn:\s*([\s\S]*?)(?:$|\n[A-Z])/i);
    if (evidenceMatch && evidenceMatch[1].trim()) {
      setEvidenceText(evidenceMatch[1].trim());
      parsedCount++;
    } else if (!evidenceText) {
      setEvidenceText(aiRawText.trim());
    }

    // Extract Multi-Class Co-Mentions (Only when in Disease mode)
    const autoSelectedCodes: string[] = [];
    const autoSelectedNames: string[] = [];
    const newConfigs: Record<string, { contentType: string; matchLevel: string; customEvidence?: string; hasCultivation?: boolean }> = {};

    if (!selectedClass?.isHealthy) {
      // 1. Auto-tag Healthy class if article mentions cultivation techniques
      const healthyClassOfPlant = samePlantClasses.find(c => c.isHealthy);
      if (hasCultInArticle && healthyClassOfPlant) {
        if (!autoSelectedCodes.includes(healthyClassOfPlant.modelClass)) {
          autoSelectedCodes.push(healthyClassOfPlant.modelClass);
          autoSelectedNames.push(`${healthyClassOfPlant.plantName} (Canh tác)`);
          newConfigs[healthyClassOfPlant.modelClass] = {
            contentType: 'Kỹ thuật canh tác & phòng ngừa',
            matchLevel: 'Khớp trực tiếp',
            hasCultivation: true
          };
        }
      }

      // 2. Parse co-mentioned diseases block
      const multiClassMatch = aiRawText.match(/\[CÁC BỆNH CÙNG CÂY CÓ TRONG BÀI\]:\s*([\s\S]*?)(?:$|\n\[)/i) ||
                              aiRawText.match(/Các bệnh cùng cây(?:\s*có trong bài)?:\s*([\s\S]*?)(?:$|\n[A-Z])/i);

      if (multiClassMatch && multiClassMatch[1].trim()) {
        const blockText = multiClassMatch[1].trim();
        const lowerBlock = blockText.toLowerCase();
        const isExplicitlyNone = lowerBlock === 'không' || lowerBlock === 'không có' || lowerBlock === 'none' || lowerBlock === 'không đề cập' || lowerBlock === 'n/a';
        
        if (!isExplicitlyNone) {
          const lines = blockText.split(/\r?\n/).filter(l => l.trim().length > 0);
          samePlantClasses.forEach(c => {
            const matchingLine = lines.find(l => l.includes(c.modelClass) || l.toLowerCase().includes(c.diseaseName.toLowerCase()));
            if (matchingLine) {
              const lineLower = matchingLine.toLowerCase();
              let customNote = '';
              const noteMatch = matchingLine.match(/(?:Tóm_Tắt|Tóm tắt|Tóm lược):\s*(.*)/i) || 
                                matchingLine.match(/\|\s*([^|]+)$/);
              if (noteMatch && noteMatch[1].trim() && !noteMatch[1].toLowerCase().includes('mức_độ') && !noteMatch[1].toLowerCase().includes('canh_tác')) {
                customNote = noteMatch[1].trim();
              }

              if (c.isHealthy) {
                if (!autoSelectedCodes.includes(c.modelClass)) {
                  autoSelectedCodes.push(c.modelClass);
                  autoSelectedNames.push(`${c.plantName} (Canh tác)`);
                }
                newConfigs[c.modelClass] = {
                  contentType: 'Kỹ thuật canh tác & phòng ngừa',
                  matchLevel: 'Khớp trực tiếp',
                  customEvidence: customNote || undefined,
                  hasCultivation: true
                };
              } else {
                let cType = 'Chỉ triệu chứng bệnh';
                let mLevel = 'Khớp trực tiếp';

                if (lineLower.includes('đủ triệu chứng') || lineLower.includes('triệu chứng và thuốc') || lineLower.includes('triệu chứng & thuốc') || lineLower.includes('triệu chứng & biện pháp') || lineLower.includes('đủ thuốc')) {
                  cType = 'Triệu chứng & Biện pháp';
                  mLevel = 'Khớp trực tiếp';
                } else if (lineLower.includes('chỉ thuốc') || lineLower.includes('chỉ biện pháp') || lineLower.includes('chỉ điều trị') || lineLower.includes('thuốc bvtv')) {
                  cType = 'Chỉ biện pháp điều trị / thuốc';
                  mLevel = 'Khớp trực tiếp';
                } else if (lineLower.includes('chỉ triệu chứng') || lineLower.includes('triệu chứng')) {
                  cType = 'Chỉ triệu chứng bệnh';
                  mLevel = 'Khớp trực tiếp';
                } else if (lineLower.includes('chỉ tham khảo') || lineLower.includes('nhắc tên') || lineLower.includes('tham khảo') || lineLower.includes('không có')) {
                  cType = 'Chỉ tham khảo / Không có chi tiết';
                  mLevel = 'Tham khảo chung';
                }

                if (!autoSelectedCodes.includes(c.modelClass)) {
                  autoSelectedCodes.push(c.modelClass);
                  autoSelectedNames.push(c.diseaseName);
                }
                newConfigs[c.modelClass] = {
                  contentType: cType,
                  matchLevel: mLevel,
                  customEvidence: customNote || undefined,
                  hasCultivation: false
                };
              }
            }
          });
        }
      }

      // 3. Fallback scan raw text for direct mentions
      samePlantClasses.forEach(c => {
        if (aiRawText.includes(c.modelClass) && !autoSelectedCodes.includes(c.modelClass)) {
          autoSelectedCodes.push(c.modelClass);
          autoSelectedNames.push(c.isHealthy ? `${c.plantName} (Canh tác)` : c.diseaseName);
          newConfigs[c.modelClass] = {
            contentType: c.isHealthy ? 'Kỹ thuật canh tác & phòng ngừa' : 'Chỉ tham khảo / Không có chi tiết',
            matchLevel: 'Tham khảo chung',
            hasCultivation: c.isHealthy
          };
        }
      });
    }

    if (autoSelectedCodes.length > 0) {
      setAdditionalClassCodes(autoSelectedCodes);
      setAdditionalClassConfigs(newConfigs);
      parsedCount++;
    }

    const extraMsg = autoSelectedCodes.length > 0
      ? ` và tự động tick chọn + phân loại ${autoSelectedCodes.length} mục cùng cây (${autoSelectedNames.join(', ')})!`
      : '! Bạn chỉ cần kiểm tra và bấm Lưu.';

    setNotification({
      type: 'success',
      message: `✨ Đã tự động bóc tách thành công ${parsedCount} trường${extraMsg}`
    });
  };

  // Submit new source (supports multi-class batch saving)
  const handleSubmitSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) {
      setNotification({ type: 'error', message: 'Vui lòng chọn 1 lớp cây trồng từ danh sách.' });
      return;
    }
    if (!sourceUrl.trim()) {
      setNotification({ type: 'error', message: 'Vui lòng nhập đường dẫn URL tài liệu.' });
      return;
    }

    // Target classes to save: current selectedClass + any additional selected classes from same plant
    const targetClasses = [
      selectedClass,
      ...classes.filter(c => additionalClassCodes.includes(c.modelClass))
    ];

    // Check duplicate URL before sending request
    const cleanCurrentUrl = normalizeUrl(sourceUrl);
    const duplicateClasses = targetClasses.filter(cls =>
      sources.some(s => s.modelClass === cls.modelClass && normalizeUrl(s.sourceUrl) === cleanCurrentUrl)
    );

    if (duplicateClasses.length > 0) {
      const names = duplicateClasses.map(c => c.diseaseName).join(', ');
      setNotification({
        type: 'error',
        message: `⚠️ URL này đã được lưu trước đó cho bệnh: "${names}". Hệ thống tự động chặn để chống trùng lặp!`
      });
      return;
    }

    setSubmitting(true);
    setNotification(null);

    try {
      await Promise.all(
        targetClasses.map(cls => {
          const isMain = cls.modelClass === selectedClass.modelClass;
          const extraConfig = additionalClassConfigs[cls.modelClass];

          let clsContentType = isMain 
            ? (selectedClass.isHealthy ? 'Kỹ thuật canh tác & phòng ngừa' : contentType)
            : (extraConfig?.contentType || (cls.isHealthy ? 'Kỹ thuật canh tác & phòng ngừa' : 'Chỉ triệu chứng bệnh'));

          let clsMatchLevel = isMain 
            ? matchLevel 
            : (extraConfig?.matchLevel || (cls.isHealthy ? 'Khớp trực tiếp' : 'Tham khảo chung'));

          let clsHasCultivation = cls.isHealthy ? true : Boolean(extraConfig?.hasCultivation);

          if (cls.isHealthy) {
            clsContentType = 'Kỹ thuật canh tác & phòng ngừa';
            clsHasCultivation = true;
          }

          const clsEvidenceText = isMain
            ? evidenceText.trim()
            : (extraConfig?.customEvidence?.trim()
                ? (cls.isHealthy
                    ? `[Kỹ thuật canh tác & chăm sóc]: ${extraConfig.customEvidence.trim()}\n[Tài liệu tham khảo]: ${evidenceText.trim()}`
                    : `[Tóm tắt riêng cho ${cls.diseaseName}]: ${extraConfig.customEvidence.trim()}\n[Tài liệu tham khảo]: ${evidenceText.trim()}`)
                : evidenceText.trim());

          const clsReviewerNotes = isMain
            ? reviewerNotes.trim()
            : (reviewerNotes.trim()
                ? `[Đồng lưu từ ${selectedClass.diseaseName}] ` + reviewerNotes.trim()
                : `[Đồng lưu từ ${selectedClass.diseaseName}]`);

          return axios.post(`${API_BASE}/sources`, {
            modelClass: cls.modelClass,
            plantName: cls.plantName,
            diseaseName: cls.diseaseName,
            sourceUrl: sourceUrl.trim(),
            sourceTitle: sourceTitle.trim() || sourceUrl.trim(),
            organization: organization.trim() || 'Chưa xác định',
            publishedDate: publishedDate.trim() || 'Không ghi ngày',
            matchLevel: clsMatchLevel,
            sourceScope: sourceScope || 'Việt Nam',
            evidenceText: clsEvidenceText,
            contentType: clsContentType,
            hasCultivationTechnique: clsHasCultivation,
            isManualApproved,
            reviewerNotes: clsReviewerNotes
          });
        })
      );

      const targetNames = targetClasses.map(c => c.diseaseName).join(', ');
      setNotification({
        type: 'success',
        message: targetClasses.length > 1
          ? `🎉 Đã lưu thành công tài liệu này cho ${targetClasses.length} lớp bệnh: ${targetNames}!`
          : `🎉 Đã lưu thành công nguồn dữ liệu cho "${selectedClass.diseaseName}"!`
      });

      // Reset form fields
      setSourceUrl('');
      setSourceTitle('');
      setOrganization('');
      setPublishedDate('');
      setMatchLevel('Khớp trực tiếp');
      setSourceScope('Việt Nam');
      setEvidenceText('');
      setAiRawText('');
      setHasCultivation(false);
      setIsManualApproved(false);
      setReviewerNotes('');
      setAdditionalClassCodes([]);
      setAdditionalClassConfigs({});

      // Refresh data
      await fetchData();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.response?.data?.message || 'Có lỗi xảy ra khi lưu nguồn tài liệu.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete source
  const handleDeleteSource = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa nguồn tài liệu "${name}"?`)) {
      return;
    }

    try {
      await axios.delete(`${API_BASE}/sources/${id}`);
      setNotification({ type: 'success', message: 'Đã xóa nguồn tài liệu thành công.' });
      await fetchData();
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Lỗi khi xóa nguồn dữ liệu.' });
    }
  };

  // Filtered classes
  const filteredClasses = classes.filter(c => {
    if (selectedPhase !== 'all' && c.phase !== selectedPhase) return false;
    if (statusFilter === 'completed' && c.sourcesCount < 2) return false;
    if (statusFilter === 'in_progress' && c.sourcesCount !== 1) return false;
    if (statusFilter === 'unstarted' && c.sourcesCount !== 0) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.plantName.toLowerCase().includes(q) ||
                        c.diseaseName.toLowerCase().includes(q) ||
                        c.modelClass.toLowerCase().includes(q);
      if (!matchName) return false;
    }
    return true;
  });

  return (
    <div className="container" style={{ padding: '32px 20px', maxWidth: '1360px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{
              background: '#1b5e20',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '6px'
            }}>
              DATA LEAD TOOL
            </span>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
              Đồ Án Tốt Nghiệp PTIT • Lavitree Tri Thức Nông Nghiệp
            </span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#1b5e20', letterSpacing: '-0.5px', margin: 0 }}>
            Hệ Thống Thu Thập &amp; Thẩm Định Tri Thức (38 Lớp Bệnh Cây)
          </h1>
          <p style={{ color: '#475569', fontSize: '14px', marginTop: '6px', maxWidth: '850px' }}>
            Dành riêng cho nhóm dữ liệu thực hiện tra cứu, đối chiếu và nhập nguồn tài liệu khuyến nông uy tín để huấn luyện Agent Tư Vấn và xây dựng Cẩm Nang Bệnh học cho đồ án.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => fetchData()}
            className="btn btn-outline"
            style={{ fontSize: '13px', padding: '8px 14px' }}
            disabled={refreshing}
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
            Làm Mới
          </button>

          <a
            href={`${API_BASE}/export`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
            style={{ fontSize: '13px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
          >
            <Download size={16} />
            Xuất Báo Cáo CSV (Nộp GVHD)
          </a>
        </div>
      </div>

      {/* Floating Toast Notification (Slide-in from right, fixed at top-right, auto-dismiss) */}
      {notification && (
        <div
          className="toast-slide-in"
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 999999,
            minWidth: '320px',
            maxWidth: '520px',
            padding: '14px 18px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            background: '#ffffff',
            border: `1.5px solid ${notification.type === 'success' ? '#22c55e' : '#ef4444'}`,
            color: notification.type === 'success' ? '#14532d' : '#991b1b',
            boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.16), 0 4px 12px rgba(0, 0, 0, 0.08)',
            fontSize: '13.5px',
            lineHeight: 1.45
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: notification.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: notification.type === 'success' ? '#16a34a' : '#dc2626',
              borderRadius: '50%',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13.5px' }}>
                {notification.type === 'success' ? 'Thao Tác Thành Công' : 'Thông Báo'}
              </div>
              <div style={{ fontSize: '13px', color: notification.type === 'success' ? '#166534' : '#b91c1c', marginTop: '2px' }}>
                {notification.message}
              </div>
            </div>
          </div>
          <button
            onClick={() => setNotification(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              fontSize: '16px',
              padding: '4px 6px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontWeight: 700
            }}
            title="Đóng thông báo"
          >
            ✕
          </button>
        </div>
      )}

      {/* Compact Dashboard Bar (Anti-fatigue & Clean Viewport) */}
      {stats && (
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '12px 18px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          {/* Top row: Single compact KPI strip */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            {/* Progress */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Tiến độ:</span>
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#1b5e20' }}>{stats.completionPercentage}%</span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>({stats.completedClasses}/{stats.totalClasses} lớp)</span>
              </div>
              <div style={{ width: '120px', height: '7px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${stats.completionPercentage}%`, height: '100%', background: '#1b5e20', transition: 'width 0.4s' }} />
              </div>
            </div>

            {/* Stat pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', background: '#dcfce7', color: '#15803d', fontWeight: 700 }}>
                🟢 {stats.completedClasses} Đủ nguồn (≥2)
              </span>
              <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', background: '#fef3c7', color: '#b45309', fontWeight: 700 }}>
                🟡 {stats.inProgressClasses} Đang làm (1)
              </span>
              <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', background: '#f1f5f9', color: '#64748b', fontWeight: 700 }}>
                ⚪ {stats.unstartedClasses} Chưa có (0)
              </span>
              <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', background: '#e0f2fe', color: '#0369a1', fontWeight: 700 }}>
                🔵 {stats.totalSources} Link đã lưu
              </span>
            </div>

            {/* Toggle for guidelines & phase details */}
            <button
              type="button"
              onClick={() => setShowDashboardDetails(!showDashboardDetails)}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#0284c7',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {showDashboardDetails ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {showDashboardDetails ? 'Thu gọn Hướng dẫn & 3 Đợt' : '📖 Hướng Dẫn & Tiến Độ 3 Đợt'}
            </button>
          </div>

          {/* Collapsible details (Phase bars & Guidelines) */}
          {showDashboardDetails && (
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px dashed #e2e8f0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* 3-Phase progress */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', background: '#f8fafc', padding: '12px 16px', borderRadius: '8px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    <span style={{ color: '#1b5e20' }}>Đợt 1: Cây chủ lực VN (16 lớp)</span>
                    <span style={{ color: '#1b5e20' }}>{stats.phase1.completed}/{stats.phase1.total} ({stats.phase1.percent}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${stats.phase1.percent}%`, height: '100%', background: '#1b5e20' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    <span style={{ color: '#0284c7' }}>Đợt 2: Cây ăn quả &amp; phụ (10 lớp)</span>
                    <span style={{ color: '#0284c7' }}>{stats.phase2.completed}/{stats.phase2.total} ({stats.phase2.percent}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${stats.phase2.percent}%`, height: '100%', background: '#0284c7' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                    <span style={{ color: '#16a34a' }}>Đợt 3: Cây khỏe mạnh (12 lớp)</span>
                    <span style={{ color: '#16a34a' }}>{stats.phase3.completed}/{stats.phase3.total} ({stats.phase3.percent}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${stats.phase3.percent}%`, height: '100%', background: '#16a34a' }} />
                  </div>
                </div>
              </div>

              {/* Guidelines */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', fontSize: '12px', color: '#334155', lineHeight: 1.5 }}>
                <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontWeight: 700, color: '#166534', marginBottom: '4px' }}>1. Tiêu chí chọn nguồn:</div>
                  Mỗi bệnh cần 2–3 nguồn. Ưu tiên .edu/.gov quốc tế (Cornell, Penn State) &amp; nguồn Việt Nam (Báo Nông nghiệp, Viện BVTV, Khuyến nông tỉnh).
                </div>
                <div style={{ background: '#f0f9ff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                  <div style={{ fontWeight: 700, color: '#0369a1', marginBottom: '4px' }}>2. Dùng Trợ lý AI Trình duyệt:</div>
                  Mở bài báo ➔ Bấm "🤖 Sao chép Prompt cho AI" ➔ Dán vào Gemini/Copilot cạnh trình duyệt ➔ Dán tóm tắt vào ô Nhập Nhanh để điền form tự động!
                </div>
                <div style={{ background: '#fefce8', padding: '10px 14px', borderRadius: '8px', border: '1px solid #fef08a' }}>
                  <div style={{ fontWeight: 700, color: '#854d0e', marginBottom: '4px' }}>3. Duyệt ngoại lệ (Manual Approve):</div>
                  Nếu bài viết rất hay, có phác đồ rõ ràng nhưng ở trang khác (.com/.vn), hãy tích [x] Duyệt ngoại lệ để hệ thống chấp nhận.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Workspace: Left 38-class Selector & Right Form */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 420px) 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: 38 Classes List */}
        <div className="card" style={{ padding: '18px', maxHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column', position: 'sticky', top: '16px' }}>
          <div style={{ marginBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1b5e20', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} /> Danh Sách 38 Lớp Cây Trồng
            </h3>
            
            {/* Phase Tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              <button
                type="button"
                onClick={() => setSelectedPhase('all')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid #cbd5e1',
                  background: selectedPhase === 'all' ? '#1b5e20' : '#fff',
                  color: selectedPhase === 'all' ? '#fff' : '#475569'
                }}
              >
                Tất cả (38)
              </button>
              <button
                type="button"
                onClick={() => setSelectedPhase(1)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid #cbd5e1',
                  background: selectedPhase === 1 ? '#1b5e20' : '#fff',
                  color: selectedPhase === 1 ? '#fff' : '#475569'
                }}
              >
                Đợt 1 (16)
              </button>
              <button
                type="button"
                onClick={() => setSelectedPhase(2)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid #cbd5e1',
                  background: selectedPhase === 2 ? '#0284c7' : '#fff',
                  color: selectedPhase === 2 ? '#fff' : '#475569'
                }}
              >
                Đợt 2 (10)
              </button>
              <button
                type="button"
                onClick={() => setSelectedPhase(3)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid #cbd5e1',
                  background: selectedPhase === 3 ? '#16a34a' : '#fff',
                  color: selectedPhase === 3 ? '#fff' : '#475569'
                }}
              >
                Đợt 3 (12)
              </button>
            </div>

            {/* Search and Status filter */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Lọc tên cây, bệnh..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 30px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px'
                  }}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  background: '#fff'
                }}
              >
                <option value="all">Mọi trạng thái</option>
                <option value="unstarted">Chưa có nguồn (0)</option>
                <option value="in_progress">Đang làm (1)</option>
                <option value="completed">Đã đủ (&gt;=2)</option>
              </select>
            </div>
          </div>

          {/* Scrollable list */}
          <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredClasses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8', fontSize: '13px' }}>
                Không tìm thấy lớp nào phù hợp bộ lọc.
              </div>
            ) : (
              filteredClasses.map((item) => {
                const isSelected = selectedClass?.modelClass === item.modelClass;
                const isDone = item.sourcesCount >= 2;
                const isOne = item.sourcesCount === 1;

                return (
                  <div
                    key={item.modelClass}
                    onClick={() => handleSelectClass(item)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: isSelected ? '2px solid #1b5e20' : '1px solid #e2e8f0',
                      background: isSelected ? '#f0fdf4' : '#ffffff',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: isSelected ? '#1b5e20' : '#1e293b' }}>
                        {item.plantName}: {item.diseaseName}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: '999px',
                        whiteSpace: 'nowrap',
                        background: isDone ? '#dcfce7' : isOne ? '#fef3c7' : '#f1f5f9',
                        color: isDone ? '#15803d' : isOne ? '#b45309' : '#64748b'
                      }}>
                        {item.sourcesCount} nguồn
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                        {item.modelClass.length > 25 ? item.modelClass.substring(0, 23) + '...' : item.modelClass}
                      </span>
                      
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {(() => {
                          const coverage = getClassCoverage(item);
                          if (coverage.isPerfect) {
                            return (
                              <span title="Đạt chuẩn: Đủ cả QT, VN, Triệu chứng & Thuốc BVTV VN" style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '1px 5px', borderRadius: '4px' }}>
                                🌟 Đủ chuẩn
                              </span>
                            );
                          }
                          if (coverage.hasBoth && !coverage.hasTreatmentVn && !item.isHealthy) {
                            return (
                              <span title="Thiếu thuốc BVTV lưu hành tại VN" style={{ fontSize: '10px', background: '#fef3c7', color: '#b45309', fontWeight: 700, padding: '1px 5px', borderRadius: '4px' }}>
                                ⚠️ Cần thuốc VN
                              </span>
                            );
                          }
                          if (coverage.hasVn) {
                            return (
                              <span title="Mới có nguồn Việt Nam" style={{ fontSize: '10px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600, padding: '1px 5px', borderRadius: '4px' }}>
                                🇻🇳 VN
                              </span>
                            );
                          }
                          if (coverage.hasIntl) {
                            return (
                              <span title="Mới có nguồn Quốc tế" style={{ fontSize: '10px', background: '#f3e8ff', color: '#7e22ce', fontWeight: 600, padding: '1px 5px', borderRadius: '4px' }}>
                                🌐 QT
                              </span>
                            );
                          }
                          return null;
                        })()}

                        <span style={{
                          fontSize: '10.5px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: item.phase === 1 ? '#e0f2fe' : item.phase === 2 ? '#fae8ff' : '#ecfdf5',
                          color: item.phase === 1 ? '#0369a1' : item.phase === 2 ? '#86198f' : '#047857',
                          fontWeight: 600
                        }}>
                          Đợt {item.phase}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Input Form & Search Assistant */}
        <div id="source-entry-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Active Class Info & Keyword Assistant Card */}
          {selectedClass ? (
            <div className="card" style={{ padding: '22px', borderTop: '4px solid #1b5e20' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{
                      background: selectedClass.phase === 1 ? '#1b5e20' : selectedClass.phase === 2 ? '#0284c7' : '#16a34a',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      {selectedClass.phaseName}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Mã mô hình: <code>{selectedClass.modelClass}</code>
                    </span>
                  </div>
                  <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#1e293b', margin: '4px 0' }}>
                    {selectedClass.plantName} — {selectedClass.diseaseName}
                  </h2>
                  <p style={{ fontSize: '13px', color: '#475569', margin: '4px 0 0' }}>
                    {selectedClass.guidanceNotes}
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Trạng thái thu thập:</div>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: selectedClass.sourcesCount >= 2 ? '#16a34a' : selectedClass.sourcesCount === 1 ? '#ca8a04' : '#dc2626'
                  }}>
                    {selectedClass.status}
                  </div>
                </div>
              </div>

              {/* Enhanced Knowledge Coverage Diagnostic Card */}
              {(() => {
                const coverage = getClassCoverage(selectedClass);
                const badgeBg = coverage.statusType === 'success' ? '#dcfce7' : coverage.statusType === 'warning' ? '#fef3c7' : coverage.statusType === 'info' ? '#e0f2fe' : '#f1f5f9';
                const badgeColor = coverage.statusType === 'success' ? '#15803d' : coverage.statusType === 'warning' ? '#b45309' : coverage.statusType === 'info' ? '#0369a1' : '#64748b';
                const borderColor = coverage.statusType === 'success' ? '#86efac' : coverage.statusType === 'warning' ? '#fde047' : coverage.statusType === 'info' ? '#7dd3fc' : '#e2e8f0';

                return (
                  <div style={{
                    marginTop: '16px',
                    padding: '16px 18px',
                    borderRadius: '12px',
                    background: coverage.statusType === 'success' ? '#f0fdf4' : coverage.statusType === 'warning' ? '#fffbeb' : '#f8fafc',
                    border: `1.5px solid ${borderColor}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    {/* Header & Overall Status Pill */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Layers size={18} color={coverage.statusType === 'success' ? '#16a34a' : coverage.statusType === 'warning' ? '#d97706' : '#0284c7'} />
                        Đánh Giá Độ Bao Quát Tri Thức Của Lớp Này:
                      </div>
                      <div>
                        <span style={{
                          background: badgeBg,
                          color: badgeColor,
                          fontSize: '12.5px',
                          fontWeight: 700,
                          padding: '4px 14px',
                          borderRadius: '12px',
                          border: `1px solid ${borderColor}`
                        }}>
                          {coverage.statusLabel}
                        </span>
                      </div>
                    </div>

                    {/* 4 Checklist Criteria Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
                      {/* Criterion 1: Nguồn Việt Nam */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: coverage.hasVn ? '#dcfce7' : '#ffffff',
                        border: `1px solid ${coverage.hasVn ? '#86efac' : '#cbd5e1'}`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '15px' }}>{coverage.hasVn ? '✅' : '❌'}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '12px', color: coverage.hasVn ? '#14532d' : '#334155' }}>
                              🇻🇳 Nguồn Việt Nam
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#64748b' }}>nongnghiep.vn, Cục BVTV</div>
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: coverage.hasVn ? '#15803d' : '#dc2626' }}>
                          {coverage.hasVn ? 'Đã có' : 'Chưa có'}
                        </span>
                      </div>

                      {/* Criterion 2: Nguồn Quốc Tế */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: coverage.hasIntl ? '#dcfce7' : '#ffffff',
                        border: `1px solid ${coverage.hasIntl ? '#86efac' : '#cbd5e1'}`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '15px' }}>{coverage.hasIntl ? '✅' : '❌'}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '12px', color: coverage.hasIntl ? '#14532d' : '#334155' }}>
                              🌐 Nguồn Quốc Tế
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#64748b' }}>.edu, FAO, Cornell, PSU</div>
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: coverage.hasIntl ? '#15803d' : '#dc2626' }}>
                          {coverage.hasIntl ? 'Đã có' : 'Chưa có'}
                        </span>
                      </div>

                      {selectedClass.isHealthy ? (
                        /* Criterion 3 (Healthy): Kỹ Thuật Canh Tác (Dành riêng cho Cây Khỏe) */
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: coverage.hasCultivation ? '#dcfce7' : '#ffffff',
                          border: `1px solid ${coverage.hasCultivation ? '#86efac' : '#cbd5e1'}`
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '15px' }}>{coverage.hasCultivation ? '✅' : '⚠️'}</span>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '12px', color: coverage.hasCultivation ? '#14532d' : '#334155' }}>
                                🌾 Kỹ Thuật Canh Tác
                              </div>
                              <div style={{ fontSize: '10.5px', color: '#64748b' }}>Làm đất, tưới tiêu, bón phân, tỉa cành</div>
                            </div>
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: coverage.hasCultivation ? '#15803d' : '#d97706' }}>
                            {coverage.hasCultivation ? 'Đã có' : 'Cần bổ sung'}
                          </span>
                        </div>
                      ) : (
                        <>
                          {/* Criterion 3 (Disease): Triệu Chứng Nhận Diện */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: coverage.hasSymptoms ? '#dcfce7' : '#ffffff',
                            border: `1px solid ${coverage.hasSymptoms ? '#86efac' : '#cbd5e1'}`
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '15px' }}>{coverage.hasSymptoms ? '✅' : '❌'}</span>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '12px', color: coverage.hasSymptoms ? '#14532d' : '#334155' }}>
                                  🔍 Triệu Chứng Vết Bệnh
                                </div>
                                <div style={{ fontSize: '10.5px', color: '#64748b' }}>Hình thái, nhận diện lá</div>
                              </div>
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: coverage.hasSymptoms ? '#15803d' : '#dc2626' }}>
                              {coverage.hasSymptoms ? 'Đã có' : 'Chưa có'}
                            </span>
                          </div>

                          {/* Criterion 4 (Disease): Thuốc BVTV tại VN */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: coverage.hasTreatmentVn ? '#dcfce7' : '#ffffff',
                            border: `1.5px solid ${coverage.hasTreatmentVn ? '#86efac' : '#f59e0b'}`
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '15px' }}>{coverage.hasTreatmentVn ? '✅' : '⚠️'}</span>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '12px', color: coverage.hasTreatmentVn ? '#14532d' : '#b45309' }}>
                                  💊 Thuốc BVTV Tại VN
                                </div>
                                <div style={{ fontSize: '10.5px', color: coverage.hasTreatmentVn ? '#15803d' : '#d97706' }}>
                                  Bắt buộc nguồn VN
                                </div>
                              </div>
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: coverage.hasTreatmentVn ? '#15803d' : '#b45309' }}>
                              {coverage.hasTreatmentVn ? 'Đã có thuốc VN' : 'Thiếu thuốc VN'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Bonus Cultivation Indicator for Phase 1 & 2 */}
                    {!selectedClass.isHealthy && coverage.hasCultivation && (
                      <div style={{
                        marginTop: '8px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        color: '#065f46',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span>🌾 Đã có tài liệu kèm Kỹ Thuật Canh Tác &amp; Chăm Sóc phòng ngừa (Điểm cộng Bonus)!</span>
                      </div>
                    )}

                    {/* Actionable Advice box */}
                    <div style={{
                      fontSize: '12.5px',
                      lineHeight: 1.5,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: coverage.statusType === 'success' ? '#f0fdf4' : coverage.statusType === 'warning' ? '#fefce8' : '#f0f9ff',
                      color: coverage.statusType === 'success' ? '#166534' : coverage.statusType === 'warning' ? '#854d0e' : '#0369a1',
                      border: `1px solid ${coverage.statusType === 'success' ? '#bbf7d0' : coverage.statusType === 'warning' ? '#fef08a' : '#bae6fd'}`
                    }}>
                      {coverage.advice}
                    </div>
                  </div>
                );
              })()}

              {/* Keyword Assistant: Dual Parallel Boxes (Vietnam & International) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
                gap: '14px',
                marginTop: '16px'
              }}>
                {/* Box 1: Vietnam Keywords */}
                <div style={{
                  background: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🇻🇳 1. Từ Khóa Google Tìm Nguồn Việt Nam
                      </span>
                      <span style={{ fontSize: '10.5px', background: '#dcfce7', color: '#15803d', fontWeight: 600, padding: '2px 6px', borderRadius: '4px' }}>
                        Khuyến nông &amp; Thuốc BVTV
                      </span>
                    </div>
                    <div style={{
                      background: '#ffffff',
                      border: '1px solid #bbf7d0',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '12.5px',
                      color: '#14532d',
                      fontWeight: 600,
                      lineHeight: 1.45,
                      wordBreak: 'break-word',
                      fontFamily: 'monospace'
                    }}>
                      {getVnKeywords(selectedClass)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleCopyKeywordsVn(getVnKeywords(selectedClass))}
                      className="btn btn-outline"
                      style={{ fontSize: '12px', padding: '6px 12px', flex: 1, borderColor: '#86efac', color: '#166534', background: '#fff' }}
                    >
                      {copiedKeywordVn ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                      {copiedKeywordVn ? 'Đã sao chép!' : 'Sao chép từ khóa VN'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenGoogle(getVnKeywords(selectedClass), true)}
                      className="btn btn-primary"
                      style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <ExternalLink size={14} />
                      Tìm Google VN
                    </button>
                  </div>
                </div>

                {/* Box 2: International Keywords */}
                <div style={{
                  background: '#f0f9ff',
                  border: '1.5px solid #7dd3fc',
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🌐 2. Từ Khóa Google Tìm Nguồn Quốc Tế
                      </span>
                      <span style={{ fontSize: '10.5px', background: '#e0f2fe', color: '#0284c7', fontWeight: 600, padding: '2px 6px', borderRadius: '4px' }}>
                        Chuẩn .edu / FAO
                      </span>
                    </div>
                    <div style={{
                      background: '#ffffff',
                      border: '1px solid #bae6fd',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '12.5px',
                      color: '#075985',
                      fontWeight: 600,
                      lineHeight: 1.45,
                      wordBreak: 'break-word',
                      fontFamily: 'monospace'
                    }}>
                      {selectedClass.suggestedKeywords}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleCopyKeywordsIntl(selectedClass.suggestedKeywords)}
                      className="btn btn-outline"
                      style={{ fontSize: '12px', padding: '6px 12px', flex: 1, borderColor: '#7dd3fc', color: '#0369a1', background: '#fff' }}
                    >
                      {copiedKeywordIntl ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                      {copiedKeywordIntl ? 'Đã sao chép!' : 'Sao chép từ khóa QT'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenGoogle(selectedClass.suggestedKeywords, false)}
                      style={{
                        background: '#0284c7',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '12px',
                        padding: '6px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      <ExternalLink size={14} />
                      Tìm Google QT
                    </button>
                  </div>
                </div>
              </div>

              {/* AI Assistant Box (Gemini / Copilot Prompt & Smart Paste) */}
              <div style={{
                background: '#faf5ff',
                border: '1px solid #e9d5ff',
                borderRadius: '10px',
                padding: '16px',
                marginTop: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ background: '#7c3aed', color: '#fff', borderRadius: '6px', padding: '4px 6px', display: 'flex' }}>
                      <Bot size={15} />
                    </div>
                    <div>
                      <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#5b21b6' }}>
                        3. Trợ lý AI Trình duyệt (Gemini / Copilot / Edge):
                      </span>
                      <span style={{ fontSize: '11.5px', color: '#64748b', display: 'block' }}>
                        Mở bài báo ➔ Bấm AI cạnh trình duyệt ➔ Dán prompt này để AI đọc trang web và trả về bản tóm tắt tiếng Việt!
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyAiPrompt}
                    style={{
                      background: copiedPrompt ? '#16a34a' : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '7px 16px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {copiedPrompt ? <Check size={15} /> : <Wand2 size={15} />}
                    {copiedPrompt ? '✅ Đã chép Prompt AI!' : '🤖 Sao chép Prompt cho AI'}
                  </button>
                </div>

                {/* Optional toggle to view or manual copy prompt */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowPromptPreview(!showPromptPreview)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#7c3aed',
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline',
                      fontWeight: 600
                    }}
                  >
                    {showPromptPreview ? 'Ẩn nội dung Prompt ▲' : '👁️ Bấm vào đây để xem toàn bộ nội dung Prompt (hoặc tự bôi đen chép) ▼'}
                  </button>

                  {showPromptPreview && (
                    <div style={{ marginTop: '8px', background: '#ffffff', border: '1px solid #d8b4fe', borderRadius: '8px', padding: '10px' }}>
                      <textarea
                        readOnly
                        rows={6}
                        value={generateAiPrompt(selectedClass)}
                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                        style={{
                          width: '100%',
                          fontSize: '12px',
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          resize: 'vertical',
                          fontFamily: 'monospace',
                          lineHeight: '1.5',
                          color: '#1e293b'
                        }}
                      />
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                        💡 Mẹo: Click vào khung trên để tự động bôi đen tất cả, rồi ấn Ctrl+C để sao chép.
                      </div>
                    </div>
                  )}
                </div>

                {/* Smart Paste AI Input Box */}
                <div style={{ paddingTop: '8px', borderTop: '1px dashed #e9d5ff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#6b21a8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={15} color="#7c3aed" /> Nhập Nhanh: Dán kết quả từ AI vào đây để điền form tự động:
                    </label>
                  </div>

                  <textarea
                    rows={2}
                    placeholder={`Dán kết quả AI trả về vào đây (Ví dụ: [TIÊU ĐỀ]: ..., [CƠ QUAN]: ..., [NGÀY CẬP NHẬT]: ..., [TRÍCH DẪN CỐT LÕI]: ...)`}
                    value={aiRawText}
                    onChange={(e) => setAiRawText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d8b4fe',
                      fontSize: '12.5px',
                      fontFamily: 'sans-serif',
                      resize: 'vertical',
                      background: '#ffffff'
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px', gap: '8px' }}>
                    {aiRawText && (
                      <button
                        type="button"
                        onClick={() => setAiRawText('')}
                        style={{ background: 'transparent', border: 'none', color: '#9333ea', fontSize: '12px', cursor: 'pointer' }}
                      >
                        Xóa nội dung
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleParseAiText}
                      style={{
                        background: '#7c3aed',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Wand2 size={13} />
                      ⚡ Phân Tích &amp; Điền Vào Form Ngay
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs: Entry Form vs Saved Sources for Current Class (Anti-fatigue Navigation) */}
              <div style={{
                display: 'flex',
                borderBottom: '2px solid #e2e8f0',
                marginTop: '20px',
                gap: '12px'
              }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('entry')}
                  style={{
                    padding: '10px 16px',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
                    borderBottom: activeTab === 'entry' ? '3px solid #1b5e20' : '3px solid transparent',
                    background: 'transparent',
                    color: activeTab === 'entry' ? '#1b5e20' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '-2px'
                  }}
                >
                  <FileText size={16} />
                  ✏️ Form Nhập Liệu Thẩm Định
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('sources')}
                  style={{
                    padding: '10px 16px',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
                    borderBottom: activeTab === 'sources' ? '3px solid #1b5e20' : '3px solid transparent',
                    background: 'transparent',
                    color: activeTab === 'sources' ? '#1b5e20' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '-2px'
                  }}
                >
                  <BookOpen size={16} />
                  📚 Nguồn Đã Lưu Của Lớp Này
                  <span style={{
                    background: activeTab === 'sources' ? '#1b5e20' : '#cbd5e1',
                    color: '#fff',
                    fontSize: '11px',
                    padding: '2px 7px',
                    borderRadius: '12px',
                    fontWeight: 700
                  }}>
                    {sources.filter(s => s.modelClass === selectedClass.modelClass).length}
                  </span>
                </button>
              </div>

              {/* TAB 1: FORM INPUT */}
              {activeTab === 'entry' && (
                <form onSubmit={handleSubmitSource} style={{ marginTop: '18px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1b5e20', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} /> Chi Tiết Nguồn Dữ Liệu Thẩm Định
                </h3>

                {selectedClass.isHealthy && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: '#ecfdf5',
                    border: '1.5px solid #10b981',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <Sparkles size={20} color="#059669" />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#065f46' }}>
                        🌿 Chế độ Thu thập Cẩm nang Canh tác &amp; Chăm sóc Cây khỏe ({selectedClass.plantName})
                      </div>
                      <div style={{ fontSize: '12px', color: '#047857', marginTop: '2px' }}>
                        Chuyên mục quy trình nông học: chuẩn bị đất, thời vụ, tưới tiêu, bón phân NPK/hữu cơ, bấm ngọn tỉa cành tạo tán. Không yêu cầu triệu chứng bệnh hay thuốc BVTV hóa học.
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  {/* Source URL */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                        Đường dẫn URL bài viết / tài liệu (*)
                      </label>
                      {sourceUrl && (
                        <button
                          type="button"
                          onClick={() => setSourceUrl('')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            fontSize: '11.5px',
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                        >
                          Xóa URL
                        </button>
                      )}
                    </div>
                    <input
                      type="url"
                      required
                      placeholder="https://extension.psu.edu/... hoặc https://nongnghiep.vn/..."
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: isDuplicateForSelectedClass
                          ? '2px solid #ef4444'
                          : normalizedCurrentUrl
                            ? '1.5px solid #22c55e'
                            : '1px solid #cbd5e1',
                        fontSize: '14px',
                        outline: 'none',
                        background: isDuplicateForSelectedClass ? '#fff5f5' : '#ffffff',
                        transition: 'border 0.2s, background 0.2s'
                      }}
                    />

                    {/* Real-time duplicate status feedback */}
                    {normalizedCurrentUrl && isDuplicateForSelectedClass && (
                      <div style={{
                        marginTop: '6px',
                        padding: '8px 12px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#b91c1c',
                        fontSize: '12.5px',
                        fontWeight: 600
                      }}>
                        <AlertCircle size={16} color="#dc2626" />
                        <span>
                          ⚠️ <strong>URL này đã tồn tại:</strong> Lớp "{selectedClass?.diseaseName}" đã được lưu URL này trước đó. Vui lòng chọn bài viết khác để tránh trùng lặp!
                        </span>
                      </div>
                    )}

                    {normalizedCurrentUrl && !isDuplicateForSelectedClass && existingOtherSourcesWithUrl.length > 0 && (
                      <div style={{
                        marginTop: '6px',
                        padding: '8px 12px',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#1d4ed8',
                        fontSize: '12.5px'
                      }}>
                        <Info size={16} color="#2563eb" />
                        <span>
                          ℹ️ <strong>URL dùng chung:</strong> URL này đang được gán cho {existingOtherSourcesWithUrl.map(s => `"${s.diseaseName}"`).join(', ')}. Hệ thống cho phép gán thêm cho lớp này nếu bài viết đề cập nhiều bệnh.
                        </span>
                      </div>
                    )}

                    {normalizedCurrentUrl && !isDuplicateForSelectedClass && existingOtherSourcesWithUrl.length === 0 && (
                      <div style={{
                        marginTop: '6px',
                        padding: '6px 12px',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#15803d',
                        fontSize: '12px'
                      }}>
                        <CheckCircle2 size={14} color="#16a34a" />
                        <span>✓ URL hợp lệ, chưa từng có trong hệ thống cho bất kỳ bệnh nào.</span>
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Tiêu đề bài viết / Tài liệu
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Hướng dẫn phòng trị bệnh mốc sương trên cà chua"
                      value={sourceTitle}
                      onChange={(e) => setSourceTitle(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  {/* Organization */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Cơ quan / Tác giả / Trường Đại học
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Penn State Extension, Viện BVTV"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  {/* Published Date */}
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      <Calendar size={14} color="#0284c7" /> Thời gian xuất bản / Cập nhật
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: 2024, Tháng 5/2023, hoặc Không ghi ngày"
                      value={publishedDate}
                      onChange={(e) => setPublishedDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  {/* Match Level */}
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      <Target size={14} color="#16a34a" /> Mức độ khớp với lớp này
                    </label>
                    <select
                      value={matchLevel}
                      onChange={(e) => setMatchLevel(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        background: '#fff'
                      }}
                    >
                      <option value="Khớp trực tiếp">Khớp trực tiếp (Đúng cây - Đúng chuyên mục)</option>
                      <option value="Gần nghĩa cần kiểm tra">Gần nghĩa / Cần đối chiếu thêm thông tin</option>
                      <option value="Tham khảo chung">Chỉ tham khảo chung (Tổng quan canh tác)</option>
                    </select>
                  </div>

                  {/* Source Scope (Việt Nam vs Quốc tế) */}
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      <Globe size={14} color="#0284c7" /> Phạm vi nguồn tài liệu
                    </label>
                    <select
                      value={sourceScope}
                      onChange={(e) => setSourceScope(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        background: '#fff'
                      }}
                    >
                      <option value="Việt Nam">🇻🇳 Việt Nam (Nông nghiệp &amp; Khuyến nông trong nước)</option>
                      <option value="Quốc tế">🌐 Quốc tế (Học thuật &amp; Chuẩn quốc tế)</option>
                    </select>
                  </div>

                  {/* Content Type */}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Loại nội dung tài liệu cung cấp
                    </label>
                    {selectedClass.isHealthy ? (
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: '#f0fdf4',
                        border: '1.5px solid #86efac',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        color: '#166534',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span>🌾 Kỹ thuật canh tác &amp; Chăm sóc cây</span>
                      </div>
                    ) : (
                      <select
                        value={contentType}
                        onChange={(e) => {
                          const val = e.target.value;
                          setContentType(val);
                          if (val === 'Chỉ tham khảo / Không có chi tiết') {
                            setMatchLevel('Tham khảo chung');
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '14px',
                          background: '#fff'
                        }}
                      >
                        <option value="Triệu chứng & Biện pháp">Cả triệu chứng nhận diện &amp; biện pháp phòng trị (Đầy đủ nhất)</option>
                        <option value="Chỉ triệu chứng bệnh">Chỉ triệu chứng / hình ảnh nhận biết vết bệnh</option>
                        <option value="Chỉ biện pháp điều trị / thuốc">Chỉ biện pháp điều trị / hoạt chất thuốc BVTV</option>
                        <option value="Chỉ tham khảo / Không có chi tiết">Không có thông tin triệu chứng / thuốc (Chỉ nhắc tên / Tham khảo)</option>
                      </select>
                    )}
                  </div>
                </div>

                {/* Evidence snippet */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    {selectedClass.isHealthy
                      ? 'Quy trình kỹ thuật canh tác & Chăm sóc cây cốt lõi (1–3 câu tóm tắt) *'
                      : 'Trích dẫn chứng cứ / Điểm cốt lõi (Tóm tắt ngắn 1–3 câu tiếng Việt) *'}
                  </label>
                  <textarea
                    rows={3}
                    placeholder={selectedClass.isHealthy
                      ? "Ví dụ: Lên luống cao 25-30cm thoát nước tốt, mật độ trồng thích hợp. Bón lót phân chuồng hoai mục kết hợp super lân. Tưới ẩm định kỳ 70-80%, bấm ngọn tỉa cành tạo tán..."
                      : "Ví dụ: Vết bệnh sũng nước màu nâu xám trên lá, có lớp mốc trắng mặt dưới lá trong điều kiện ẩm ướt. Phòng trị bằng thuốc gốc đồng, Mancozeb..."}
                    value={evidenceText}
                    onChange={(e) => setEvidenceText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      resize: 'vertical'
                    }}
                  />
                </div>

                {/* Multi-Class Tagging Box (Same Plant) - ONLY FOR DISEASE MODE */}
                {selectedClass && !selectedClass.isHealthy && samePlantClasses.length > 0 && (() => {
                  const healthyClassItem = samePlantClasses.find(c => c.isHealthy);
                  const otherDiseaseClasses = samePlantClasses.filter(c => !c.isHealthy);
                  const isHealthyChecked = Boolean(healthyClassItem && additionalClassCodes.includes(healthyClassItem.modelClass));
                  const diseaseCodes = otherDiseaseClasses.map(c => c.modelClass);
                  const isAllDiseasesSelected = diseaseCodes.length > 0 && diseaseCodes.every(code => additionalClassCodes.includes(code));

                  return (
                    <div style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '10px',
                      padding: '16px',
                      marginBottom: '20px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Layers size={17} color="#166534" />
                            Gán thêm URL này cho các bệnh khác trên cùng cây {selectedClass.plantName}
                            {additionalClassCodes.length > 0 && (
                              <span style={{ background: '#22c55e', color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                                +{additionalClassCodes.length} mục được chọn
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '12px', color: '#15803d', margin: '4px 0 0', lineHeight: 1.4 }}>
                            Nếu bài viết là tài liệu tổng hợp đề cập đến nhiều bệnh hoặc có kèm kỹ thuật canh tác chung trên cây <strong>{selectedClass.plantName}</strong>, hãy tích chọn dưới đây để tự động đồng bộ 1 lần!
                          </p>
                        </div>

                        {otherDiseaseClasses.length > 0 && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (isAllDiseasesSelected) {
                                  // Deselect all diseases, keep healthy if selected
                                  setAdditionalClassCodes(prev => prev.filter(c => !diseaseCodes.includes(c)));
                                  setAdditionalClassConfigs(prev => {
                                    const next = { ...prev };
                                    diseaseCodes.forEach(code => delete next[code]);
                                    return next;
                                  });
                                } else {
                                  // Select all other diseases
                                  setAdditionalClassCodes(prev => Array.from(new Set([...prev, ...diseaseCodes])));
                                  setAdditionalClassConfigs(prev => {
                                    const next = { ...prev };
                                    diseaseCodes.forEach(code => {
                                      if (!next[code]) {
                                        next[code] = {
                                          contentType: 'Chỉ triệu chứng bệnh',
                                          matchLevel: 'Khớp trực tiếp'
                                        };
                                      }
                                    });
                                    return next;
                                  });
                                }
                              }}
                              style={{
                                background: '#ffffff',
                                border: '1px solid #86efac',
                                color: '#166534',
                                fontSize: '11.5px',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 600
                              }}
                            >
                              {isAllDiseasesSelected ? 'Bỏ chọn các bệnh cùng cây' : 'Chọn tất cả bệnh cùng cây'}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 1. Dedicated Healthy/Cultivation Card for this plant */}
                      {healthyClassItem && (
                        <div style={{
                          padding: '12px 14px',
                          borderRadius: '8px',
                          background: isHealthyChecked ? '#dcfce7' : '#ffffff',
                          border: isHealthyChecked ? '1.5px solid #16a34a' : '1px dashed #86efac',
                          marginBottom: '12px',
                          transition: 'all 0.15s'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <input
                              type="checkbox"
                              id={`sub-healthy-${healthyClassItem.modelClass}`}
                              checked={isHealthyChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAdditionalClassCodes(prev => Array.from(new Set([...prev, healthyClassItem.modelClass])));
                                  setAdditionalClassConfigs(prev => ({
                                    ...prev,
                                    [healthyClassItem.modelClass]: {
                                      contentType: 'Kỹ thuật canh tác & phòng ngừa',
                                      matchLevel: 'Khớp trực tiếp',
                                      hasCultivation: true
                                    }
                                  }));
                                } else {
                                  setAdditionalClassCodes(prev => prev.filter(c => c !== healthyClassItem.modelClass));
                                  setAdditionalClassConfigs(prev => {
                                    const next = { ...prev };
                                    delete next[healthyClassItem.modelClass];
                                    return next;
                                  });
                                }
                              }}
                              style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                            />
                            <label htmlFor={`sub-healthy-${healthyClassItem.modelClass}`} style={{ flex: 1, cursor: 'pointer', margin: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, color: '#14532d', fontSize: '13px' }}>
                                  🌾 Kèm Kỹ thuật canh tác, tưới tiêu &amp; chăm sóc cây {selectedClass.plantName}
                                </span>
                                <span style={{ fontSize: '11px', color: '#166534', background: '#bbf7d0', padding: '1px 8px', borderRadius: '10px', fontWeight: 600 }}>
                                  Cẩm nang Cây khỏe ({healthyClassItem.modelClass})
                                </span>
                                <span style={{ fontSize: '11px', color: healthyClassItem.sourcesCount >= 2 ? '#16a34a' : '#d97706', fontWeight: 600 }}>
                                  ({healthyClassItem.sourcesCount}/2 nguồn)
                                </span>
                              </div>
                              <p style={{ fontSize: '12px', color: '#15803d', margin: '3px 0 0', lineHeight: 1.4 }}>
                                Tích chọn nếu bài viết có hướng dẫn thêm về chuẩn bị đất, thời vụ, bón phân, tưới nước hoặc tỉa cành. Hệ thống sẽ tự động tạo 1 tài liệu canh tác cho lớp Cây khỏe mạnh!
                              </p>
                            </label>
                          </div>

                          {isHealthyChecked && (
                            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #86efac' }}>
                              <input
                                type="text"
                                placeholder={`Tóm tắt riêng kỹ thuật canh tác cho cây ${selectedClass.plantName} (nếu có, để trống sẽ dùng trích dẫn chung)...`}
                                value={additionalClassConfigs[healthyClassItem.modelClass]?.customEvidence || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setAdditionalClassConfigs(prev => ({
                                    ...prev,
                                    [healthyClassItem.modelClass]: {
                                      ...prev[healthyClassItem.modelClass],
                                      contentType: 'Kỹ thuật canh tác & phòng ngừa',
                                      matchLevel: 'Khớp trực tiếp',
                                      customEvidence: val,
                                      hasCultivation: true
                                    }
                                  }));
                                }}
                                style={{
                                  width: '100%',
                                  padding: '6px 10px',
                                  fontSize: '12px',
                                  borderRadius: '6px',
                                  border: '1px solid #86efac',
                                  background: '#ffffff'
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* 2. Grid of other diseases on the same plant */}
                      {otherDiseaseClasses.length > 0 && (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                          gap: '10px'
                        }}>
                          {otherDiseaseClasses.map(cls => {
                            const isChecked = additionalClassCodes.includes(cls.modelClass);
                            const config = additionalClassConfigs[cls.modelClass] || {
                              contentType: 'Chỉ triệu chứng bệnh',
                              matchLevel: 'Khớp trực tiếp'
                            };

                            return (
                              <div
                                key={cls.modelClass}
                                style={{
                                  padding: '10px 12px',
                                  borderRadius: '8px',
                                  background: isChecked ? '#f0fdf4' : '#ffffff',
                                  border: isChecked ? '1.5px solid #22c55e' : '1px solid #e2e8f0',
                                  transition: 'all 0.15s',
                                  fontSize: '12.5px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <input
                                    type="checkbox"
                                    id={`sub-check-${cls.modelClass}`}
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setAdditionalClassCodes(prev => prev.filter(c => c !== cls.modelClass));
                                        setAdditionalClassConfigs(prev => {
                                          const next = { ...prev };
                                          delete next[cls.modelClass];
                                          return next;
                                        });
                                      } else {
                                        setAdditionalClassCodes(prev => [...prev, cls.modelClass]);
                                        setAdditionalClassConfigs(prev => ({
                                          ...prev,
                                          [cls.modelClass]: {
                                            contentType: 'Triệu chứng & Biện pháp',
                                            matchLevel: 'Khớp trực tiếp'
                                          }
                                        }));
                                      }
                                    }}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                  />
                                  <label
                                    htmlFor={`sub-check-${cls.modelClass}`}
                                    style={{ flex: 1, minWidth: 0, cursor: 'pointer', margin: 0 }}
                                  >
                                    <div style={{ fontWeight: 600, color: isChecked ? '#14532d' : '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {cls.diseaseName}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                                      <span>{cls.modelClass}</span>
                                      <span style={{ color: cls.sourcesCount >= 2 ? '#16a34a' : '#d97706' }}>
                                        ({cls.sourcesCount}/2 nguồn)
                                      </span>
                                    </div>
                                  </label>
                                </div>

                                {/* Sub-options for Knowledge Depth & Coverage */}
                                {isChecked && (
                                  <div style={{
                                    paddingTop: '8px',
                                    borderTop: '1px dashed #bbf7d0',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px'
                                  }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#166534' }}>
                                      Mức độ tri thức cho bệnh này:
                                    </div>

                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAdditionalClassConfigs(prev => ({
                                            ...prev,
                                            [cls.modelClass]: {
                                              ...prev[cls.modelClass],
                                              contentType: 'Triệu chứng & Biện pháp',
                                              matchLevel: 'Khớp trực tiếp'
                                            }
                                          }));
                                        }}
                                        style={{
                                          fontSize: '11px',
                                          padding: '3px 7px',
                                          borderRadius: '4px',
                                          border: config.contentType === 'Triệu chứng & Biện pháp' ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
                                          background: config.contentType === 'Triệu chứng & Biện pháp' ? '#dcfce7' : '#ffffff',
                                          color: config.contentType === 'Triệu chứng & Biện pháp' ? '#14532d' : '#475569',
                                          cursor: 'pointer',
                                          fontWeight: config.contentType === 'Triệu chứng & Biện pháp' ? 700 : 500
                                        }}
                                        title="Bài viết có hướng dẫn chi tiết cả triệu chứng lẫn thuốc/biện pháp đặc trị cho bệnh này"
                                      >
                                        💊 Đủ Triệu chứng &amp; Thuốc
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAdditionalClassConfigs(prev => ({
                                            ...prev,
                                            [cls.modelClass]: {
                                              ...prev[cls.modelClass],
                                              contentType: 'Chỉ triệu chứng bệnh',
                                              matchLevel: 'Khớp trực tiếp'
                                            }
                                          }));
                                        }}
                                        style={{
                                          fontSize: '11px',
                                          padding: '3px 7px',
                                          borderRadius: '4px',
                                          border: config.contentType === 'Chỉ triệu chứng bệnh' && config.matchLevel === 'Khớp trực tiếp' ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                                          background: config.contentType === 'Chỉ triệu chứng bệnh' && config.matchLevel === 'Khớp trực tiếp' ? '#e0f2fe' : '#ffffff',
                                          color: config.contentType === 'Chỉ triệu chứng bệnh' && config.matchLevel === 'Khớp trực tiếp' ? '#0369a1' : '#475569',
                                          cursor: 'pointer',
                                          fontWeight: config.contentType === 'Chỉ triệu chứng bệnh' && config.matchLevel === 'Khớp trực tiếp' ? 700 : 500
                                        }}
                                        title="Bài viết mô tả vết bệnh nhận diện nhưng không có phác đồ thuốc BVTV riêng cho bệnh này"
                                      >
                                        🔍 Chỉ Triệu chứng
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAdditionalClassConfigs(prev => ({
                                            ...prev,
                                            [cls.modelClass]: {
                                              ...prev[cls.modelClass],
                                              contentType: 'Chỉ biện pháp điều trị / thuốc',
                                              matchLevel: 'Khớp trực tiếp'
                                            }
                                          }));
                                        }}
                                        style={{
                                          fontSize: '11px',
                                          padding: '3px 7px',
                                          borderRadius: '4px',
                                          border: config.contentType === 'Chỉ biện pháp điều trị / thuốc' && config.matchLevel === 'Khớp trực tiếp' ? '1.5px solid #8b5cf6' : '1px solid #cbd5e1',
                                          background: config.contentType === 'Chỉ biện pháp điều trị / thuốc' && config.matchLevel === 'Khớp trực tiếp' ? '#f3e8ff' : '#ffffff',
                                          color: config.contentType === 'Chỉ biện pháp điều trị / thuốc' && config.matchLevel === 'Khớp trực tiếp' ? '#6b21a8' : '#475569',
                                          cursor: 'pointer',
                                          fontWeight: config.contentType === 'Chỉ biện pháp điều trị / thuốc' && config.matchLevel === 'Khớp trực tiếp' ? 700 : 500
                                        }}
                                        title="Bài viết có phác đồ thuốc BVTV / biện pháp phòng trị mà không mô tả triệu chứng nhận diện"
                                      >
                                        💊 Chỉ Thuốc BVTV
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAdditionalClassConfigs(prev => ({
                                            ...prev,
                                            [cls.modelClass]: {
                                              ...prev[cls.modelClass],
                                              contentType: 'Chỉ tham khảo / Không có chi tiết',
                                              matchLevel: 'Tham khảo chung'
                                            }
                                          }));
                                        }}
                                        style={{
                                          fontSize: '11px',
                                          padding: '3px 7px',
                                          borderRadius: '4px',
                                          border: config.matchLevel === 'Tham khảo chung' ? '1.5px solid #eab308' : '1px solid #cbd5e1',
                                          background: config.matchLevel === 'Tham khảo chung' ? '#fef9c3' : '#ffffff',
                                          color: config.matchLevel === 'Tham khảo chung' ? '#854d0e' : '#475569',
                                          cursor: 'pointer',
                                          fontWeight: config.matchLevel === 'Tham khảo chung' ? 700 : 500
                                        }}
                                        title="Bài viết chỉ nhắc tên bệnh hoặc nói lướt qua để tham khảo (không có thông tin cụ thể)"
                                      >
                                        📖 Tham khảo / Nhắc tên
                                      </button>
                                    </div>

                                    {/* Custom evidence input */}
                                    <div style={{ marginTop: '2px' }}>
                                      <input
                                        type="text"
                                        placeholder={`Tóm tắt riêng cho ${cls.diseaseName} (nếu có, để trống sẽ dùng trích dẫn chung)...`}
                                        value={config.customEvidence || ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setAdditionalClassConfigs(prev => ({
                                            ...prev,
                                            [cls.modelClass]: {
                                              ...prev[cls.modelClass],
                                              customEvidence: val
                                            }
                                          }));
                                        }}
                                        style={{
                                          width: '100%',
                                          fontSize: '11px',
                                          padding: '4px 8px',
                                          borderRadius: '4px',
                                          border: '1px solid #cbd5e1',
                                          boxSizing: 'border-box',
                                          background: '#ffffff'
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* HITL Manual Approve Box */}
                <div style={{
                  background: isManualApproved ? '#fefce8' : '#f8fafc',
                  border: isManualApproved ? '2px solid #eab308' : '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '20px',
                  transition: 'all 0.2s'
                }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isManualApproved}
                      onChange={(e) => setIsManualApproved(e.target.checked)}
                      style={{ marginTop: '3px', width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: isManualApproved ? '#854d0e' : '#1e293b' }}>
                        [x] Đã bàn bạc nội bộ / Duyệt ngoại lệ (Manual Approve)
                      </div>
                      <p style={{ fontSize: '12.5px', color: '#64748b', margin: '4px 0 0', lineHeight: 1.5 }}>
                        Tích vào đây nếu trang web <strong>không có đuôi .edu / .gov</strong> nhưng bài viết có chất lượng học thuật tốt, thông tin chính xác và nhóm đã thống nhất chấp nhận để tránh bị hệ thống từ chối.
                      </p>
                    </div>
                  </label>

                  {isManualApproved && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #fde047' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#854d0e', marginBottom: '4px' }}>
                        Lý do phê duyệt ngoại lệ (Ghi chú ngắn)
                      </label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Bài viết của kỹ sư BVTV, nội dung chi tiết và đối chiếu trùng khớp triệu chứng"
                        value={reviewerNotes}
                        onChange={(e) => setReviewerNotes(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #facc15',
                          fontSize: '13px',
                          background: '#fff'
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Submit button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    type="submit"
                    disabled={submitting || isDuplicateForSelectedClass}
                    className="btn btn-primary"
                    style={{
                      padding: '10px 24px',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      opacity: isDuplicateForSelectedClass ? 0.6 : 1,
                      cursor: isDuplicateForSelectedClass ? 'not-allowed' : 'pointer',
                      background: isDuplicateForSelectedClass ? '#94a3b8' : undefined
                    }}
                  >
                    {submitting
                      ? 'Đang lưu vào cơ sở dữ liệu...'
                      : isDuplicateForSelectedClass
                        ? '⚠️ URL Đã Tồn Tại (Không Được Lưu Trùng)'
                        : additionalClassCodes.length > 0
                          ? `Lưu Nguồn Cho ${additionalClassCodes.length + 1} Lớp Bệnh Cùng Lúc`
                          : 'Lưu Nguồn Tri Thức Này'}
                  </button>
                </div>
                </form>
              )}

              {/* TAB 2: SAVED SOURCES TABLE FOR CURRENT CLASS */}
              {activeTab === 'sources' && (
                <div style={{ marginTop: '18px' }}>
                  {(() => {
                    const currentClassSources = sources.filter(s => s.modelClass === selectedClass.modelClass);

                    if (currentClassSources.length === 0) {
                      return (
                        <div style={{
                          padding: '36px 20px',
                          textAlign: 'center',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px dashed #cbd5e1',
                          color: '#64748b',
                          fontSize: '13px'
                        }}>
                          <p style={{ margin: '0 0 12px', fontWeight: 600, color: '#334155' }}>
                            Chưa có nguồn tài liệu nào được lưu cho lớp "{selectedClass.diseaseName}".
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveTab('entry')}
                            className="btn btn-primary"
                            style={{ fontSize: '12.5px', padding: '6px 16px' }}
                          >
                            ✏️ Nhập nguồn đầu tiên ngay
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                              <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 600 }}>Tiêu Đề / Cơ Quan</th>
                              <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 600 }}>Khớp &amp; Ngày Cập Nhật</th>
                              <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 600 }}>Đánh Giá Tên Miền</th>
                              <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 600 }}>Trích Dẫn</th>
                              <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 600, textAlign: 'center' }}>Thao Tác</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentClassSources.map((item) => (
                              <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '12px', maxWidth: '240px' }}>
                                  <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '2px' }}>
                                    {item.sourceTitle}
                                  </div>
                                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                                    {item.organization}
                                  </div>
                                  <a
                                    href={item.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ fontSize: '11px', color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}
                                  >
                                    Mở liên kết <ExternalLink size={11} />
                                  </a>
                                </td>

                                <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      fontSize: '10.5px',
                                      fontWeight: 600,
                                      background: (item.sourceScope === 'Quốc tế' || (!item.sourceScope && (item.sourceUrl.includes('.edu') || item.sourceUrl.includes('.org')))) ? '#f3e8ff' : '#e0f2fe',
                                      color: (item.sourceScope === 'Quốc tế' || (!item.sourceScope && (item.sourceUrl.includes('.edu') || item.sourceUrl.includes('.org')))) ? '#7e22ce' : '#0369a1'
                                    }}>
                                      {(item.sourceScope === 'Quốc tế' || (!item.sourceScope && (item.sourceUrl.includes('.edu') || item.sourceUrl.includes('.org')))) ? '🌐 Quốc tế' : '🇻🇳 Việt Nam'}
                                    </span>

                                    <span style={{
                                      display: 'inline-block',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      fontSize: '10.5px',
                                      fontWeight: 600,
                                      background: item.matchLevel === 'Khớp trực tiếp' ? '#dcfce7' : '#fef3c7',
                                      color: item.matchLevel === 'Khớp trực tiếp' ? '#15803d' : '#b45309'
                                    }}>
                                      {item.matchLevel || 'Khớp trực tiếp'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                                    {item.publishedDate ? `Năm: ${item.publishedDate}` : 'Không ghi ngày'}
                                  </div>
                                  <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                    <span>{item.contentType}</span>
                                    {item.hasCultivationTechnique && (
                                      <span style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', fontSize: '9.5px', padding: '0 4px', borderRadius: '3px', fontWeight: 600 }}>
                                        🌾 Kèm canh tác
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    background: item.isManualApproved ? '#fef3c7' : item.sourceQuality.includes('Cao') ? '#dcfce7' : '#f1f5f9',
                                    color: item.isManualApproved ? '#92400e' : item.sourceQuality.includes('Cao') ? '#15803d' : '#475569'
                                  }}>
                                    {item.sourceQuality}
                                  </span>
                                  {item.reviewerNotes && (
                                    <div style={{ fontSize: '10.5px', color: '#854d0e', marginTop: '4px' }}>
                                      Lý do: {item.reviewerNotes}
                                    </div>
                                  )}
                                </td>

                                <td style={{ padding: '12px', fontSize: '12px', color: '#475569', maxWidth: '280px' }}>
                                  {item.evidenceText ? (
                                    <span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                      "{item.evidenceText}"
                                    </span>
                                  ) : (
                                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Không có trích dẫn</span>
                                  )}
                                </td>

                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSource(item.id, item.sourceTitle)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: '#dc2626',
                                      padding: '6px',
                                      borderRadius: '4px'
                                    }}
                                    title="Xóa nguồn này"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              Vui lòng chọn 1 lớp cây trồng từ danh sách bên trái để bắt đầu nhập nguồn.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default KnowledgeCollectorPage;
