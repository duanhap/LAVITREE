import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BookOpen, Search, Copy, ExternalLink, CheckCircle2, AlertCircle,
  Filter, Download, Trash2, Info, ShieldCheck, Layers, Sparkles,
  Clock, ArrowRight, FileText, Check, AlertTriangle, RefreshCw
} from 'lucide-react';

interface ClassItem {
  modelClass: string;
  plantName: string;
  diseaseName: string;
  phase: number;
  phaseName: string;
  isHealthy: boolean;
  suggestedKeywords: string;
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
  evidenceText: string;
  contentType: string;
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
  const [evidenceText, setEvidenceText] = useState<string>('');
  const [contentType, setContentType] = useState<string>('Triệu chứng & Biện pháp');
  const [isManualApproved, setIsManualApproved] = useState<boolean>(false);
  const [reviewerNotes, setReviewerNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [copiedKeyword, setCopiedKeyword] = useState<boolean>(false);

  // Notification / Alert
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showGuide, setShowGuide] = useState<boolean>(true);

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
        // update selectedClass counter
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

  // Handle select a class
  const handleSelectClass = (cls: ClassItem) => {
    setSelectedClass(cls);
    setCopiedKeyword(false);
    // Smooth scroll to form if on mobile
    if (window.innerWidth < 768) {
      document.getElementById('source-entry-form')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Copy keywords
  const handleCopyKeywords = (keywords: string) => {
    navigator.clipboard.writeText(keywords);
    setCopiedKeyword(true);
    setTimeout(() => setCopiedKeyword(false), 2000);
  };

  // Open Google search
  const handleOpenGoogle = (keywords: string) => {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(keywords)}`, '_blank');
  };

  // Submit new source
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

    setSubmitting(true);
    setNotification(null);

    try {
      await axios.post(`${API_BASE}/sources`, {
        modelClass: selectedClass.modelClass,
        plantName: selectedClass.plantName,
        diseaseName: selectedClass.diseaseName,
        sourceUrl: sourceUrl.trim(),
        sourceTitle: sourceTitle.trim() || sourceUrl.trim(),
        organization: organization.trim() || 'Chưa xác định',
        evidenceText: evidenceText.trim(),
        contentType,
        isManualApproved,
        reviewerNotes: reviewerNotes.trim()
      });

      setNotification({
        type: 'success',
        message: `Đã lưu thành công nguồn dữ liệu cho "${selectedClass.diseaseName}"!`
      });

      // Reset form fields (keep class selection)
      setSourceUrl('');
      setSourceTitle('');
      setOrganization('');
      setEvidenceText('');
      setIsManualApproved(false);
      setReviewerNotes('');

      // Refresh data to update progress counters
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

      {/* Notification Banner */}
      {notification && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '10px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: notification.type === 'success' ? '#dcfce7' : '#fee2e2',
          border: `1px solid ${notification.type === 'success' ? '#86efac' : '#fca5a5'}`,
          color: notification.type === 'success' ? '#14532d' : '#991b1b',
          fontSize: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <strong>{notification.message}</strong>
          </div>
          <button
            onClick={() => setNotification(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Guide & Instructions Accordion Banner */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #cbd5e1',
        borderRadius: '12px',
        padding: '18px 22px',
        marginBottom: '28px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowGuide(!showGuide)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#0284c7', color: '#fff', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Info size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Hướng Dẫn Thực Hiện Dành Cho Bạn Làm Dữ Liệu (Đọc kỹ trước khi tìm)
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Mục đích: Đảm bảo dữ liệu đầu vào chuẩn khoa học, có nguồn kiểm chứng minh bạch để bảo vệ trước Hội đồng.
              </span>
            </div>
          </div>
          <span style={{ fontSize: '13px', color: '#0284c7', fontWeight: 600 }}>
            {showGuide ? 'Thu gọn ▲' : 'Xem hướng dẫn chi tiết ▼'}
          </span>
        </div>

        {showGuide && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#1b5e20', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} color="#16a34a" /> 1. Tiêu chí chọn nguồn tài liệu
              </h4>
              <ul style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.6', margin: 0, paddingLeft: '18px' }}>
                <li>Mỗi lớp bệnh cần <strong>tối thiểu 2 nguồn độc lập</strong> để đối chiếu chéo.</li>
                <li><strong>Ưu tiên cao nhất</strong>: Đại học/Khuyến nông nước ngoài (.edu, .ac.uk, extension) và Viện/Bộ nông nghiệp (.gov, .gov.vn).</li>
                <li><strong>Nguồn trong nước</strong>: Báo Nông Nghiệp VN (nongnghiep.vn), Viện BVTV, Viện Cây ăn quả Miền Nam (iasvn.org), Khuyến nông TP/tỉnh.</li>
              </ul>
            </div>

            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#d97706', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={15} color="#d97706" /> 2. Ngoại lệ: "Đã bàn bạc nội bộ -&gt; Duyệt ngoại lệ"
              </h4>
              <p style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.6', margin: 0 }}>
                Nếu tìm thấy một bài viết <strong>nội dung rất hay, có triệu chứng và phác đồ rõ ràng</strong> nhưng nằm ở trang web khác (không có đuôi .edu / .gov), bạn hãy tích chọn <strong>[x] Đã bàn bạc nội bộ / Duyệt ngoại lệ</strong>. Hệ thống sẽ ghi nhận và không báo lỗi, tránh phải từ chối nhiều lần!
              </p>
            </div>

            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#0284c7', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={15} color="#0284c7" /> 3. Lưu ý quan trọng cho ĐỢT 3 (Cây khỏe)
              </h4>
              <p style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.6', margin: 0 }}>
                Các lớp có đuôi <code>___healthy</code> (Đợt 3) là cây khỏe mạnh: <strong>TUYỆT ĐỐI KHÔNG TÌM THUỐC BVTV</strong>. Chỉ tìm kỹ thuật canh tác, tưới tiêu, bón phân hữu cơ và biện pháp phòng ngừa sâu bệnh từ sớm.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Progress Overview Stats */}
      {stats && (
        <div style={{ marginBottom: '28px' }}>
          {/* Main KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div className="card" style={{ padding: '18px', borderLeft: '4px solid #1b5e20' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Tiến Độ Hoàn Thành</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '8px 0 4px' }}>
                <span style={{ fontSize: '28px', fontWeight: 800, color: '#1b5e20' }}>{stats.completionPercentage}%</span>
                <span style={{ fontSize: '13px', color: '#64748b' }}>({stats.completedClasses}/{stats.totalClasses} lớp)</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${stats.completionPercentage}%`, height: '100%', background: '#1b5e20', transition: 'width 0.4s' }} />
              </div>
            </div>

            <div className="card" style={{ padding: '18px', borderLeft: '4px solid #16a34a' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Đã Đủ Nguồn (&gt;= 2)</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#16a34a', margin: '8px 0 4px' }}>
                {stats.completedClasses} <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748b' }}>lớp</span>
              </div>
              <span style={{ fontSize: '12px', color: '#16a34a' }}>Sẵn sàng làm dữ liệu cẩm nang</span>
            </div>

            <div className="card" style={{ padding: '18px', borderLeft: '4px solid #eab308' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Đang Thu Thập (1 nguồn)</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#ca8a04', margin: '8px 0 4px' }}>
                {stats.inProgressClasses} <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748b' }}>lớp</span>
              </div>
              <span style={{ fontSize: '12px', color: '#ca8a04' }}>Cần thêm 1 nguồn đối chiếu</span>
            </div>

            <div className="card" style={{ padding: '18px', borderLeft: '4px solid #94a3b8' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Chưa Có Nguồn (0)</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#64748b', margin: '8px 0 4px' }}>
                {stats.unstartedClasses} <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748b' }}>lớp</span>
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Cần bạn ưu tiên tìm trước</span>
            </div>

            <div className="card" style={{ padding: '18px', borderLeft: '4px solid #0284c7' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Tổng Link Đã Thu Thập</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#0284c7', margin: '8px 0 4px' }}>
                {stats.totalSources} <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748b' }}>nguồn</span>
              </div>
              <span style={{ fontSize: '12px', color: '#0284c7' }}>Lưu trong Cloud Database</span>
            </div>
          </div>

          {/* 3-Phase Breakdown Progress */}
          <div className="card" style={{ padding: '18px 24px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '14px' }}>
              Tiến Độ Theo 3 Đợt Triển Khai Chiến Lược:
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {/* Phase 1 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600, color: '#1b5e20' }}>Đợt 1: Cây chủ lực VN (16 lớp)</span>
                  <span style={{ fontWeight: 700, color: '#1b5e20' }}>{stats.phase1.completed}/{stats.phase1.total} ({stats.phase1.percent}%)</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${stats.phase1.percent}%`, height: '100%', background: '#1b5e20' }} />
                </div>
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  Cà chua, Khoai tây, Ngô, Ớt, Cam Greening
                </span>
              </div>

              {/* Phase 2 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600, color: '#0284c7' }}>Đợt 2: Cây ăn quả &amp; phụ (10 lớp)</span>
                  <span style={{ fontWeight: 700, color: '#0284c7' }}>{stats.phase2.completed}/{stats.phase2.total} ({stats.phase2.percent}%)</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${stats.phase2.percent}%`, height: '100%', background: '#0284c7' }} />
                </div>
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  Táo, Nho, Đào, Anh đào, Bí ngô, Dâu tây
                </span>
              </div>

              {/* Phase 3 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 600, color: '#16a34a' }}>Đợt 3: Cây khỏe mạnh (12 lớp)</span>
                  <span style={{ fontWeight: 700, color: '#16a34a' }}>{stats.phase3.completed}/{stats.phase3.total} ({stats.phase3.percent}%)</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${stats.phase3.percent}%`, height: '100%', background: '#16a34a' }} />
                </div>
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  Kỹ thuật chăm sóc chuẩn (KHÔNG TÌM THUỐC)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace: Left 38-class Selector & Right Form */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 420px) 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: 38 Classes List */}
        <div className="card" style={{ padding: '20px', maxHeight: '820px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '14px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1b5e20', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                        {item.modelClass.length > 28 ? item.modelClass.substring(0, 26) + '...' : item.modelClass}
                      </span>
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
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Input Form & Search Assistant */}
        <div id="source-entry-form" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Active Class Info & Keyword Assistant Card */}
          {selectedClass ? (
            <div className="card" style={{ padding: '24px', borderTop: '4px solid #1b5e20' }}>
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

              {/* Keyword Copy Box */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 16px',
                marginTop: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                    Từ khóa tra cứu gợi ý (Chuẩn khuyến nông quốc tế &amp; VN):
                  </span>
                  <code style={{ fontSize: '13px', color: '#0369a1', fontWeight: 600 }}>
                    {selectedClass.suggestedKeywords}
                  </code>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleCopyKeywords(selectedClass.suggestedKeywords)}
                    className="btn btn-outline"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    {copiedKeyword ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                    {copiedKeyword ? 'Đã sao chép!' : 'Sao chép từ khóa'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenGoogle(selectedClass.suggestedKeywords)}
                    className="btn btn-primary"
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                  >
                    <ExternalLink size={14} />
                    Tìm trên Google
                  </button>
                </div>
              </div>

              {/* Form Input for New Source */}
              <form onSubmit={handleSubmitSource} style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1b5e20', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} /> Nhập Nguồn Dữ Liệu Thẩm Định
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  {/* Source URL */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Đường dẫn URL bài viết / tài liệu (*)
                    </label>
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
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Title */}
                  <div>
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
                      placeholder="Ví dụ: Penn State Extension, Viện BVTV, Báo Nông Nghiệp VN"
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
                </div>

                {/* Content Type */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Loại nội dung tài liệu cung cấp
                  </label>
                  <select
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value)}
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
                    <option value="Kỹ thuật canh tác & phòng ngừa">Kỹ thuật canh tác, tưới tiêu &amp; chăm sóc (Đợt 3 cây khỏe)</option>
                  </select>
                </div>

                {/* Evidence snippet */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Trích dẫn chứng cứ / Điểm cốt lõi (Tóm tắt ngắn 1-3 câu)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ví dụ: Bệnh xuất hiện vết đốm sũng nước màu nâu xám trên lá, có lớp mốc trắng mặt dưới lá trong điều kiện ẩm ướt. Biện pháp: dùng thuốc gốc đồng, Mancozeb..."
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
                    disabled={submitting}
                    className="btn btn-primary"
                    style={{ padding: '10px 24px', fontSize: '14px' }}
                  >
                    {submitting ? 'Đang lưu vào cơ sở dữ liệu...' : 'Lưu Nguồn Tri Thức Này'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              Vui lòng chọn 1 lớp cây trồng từ danh sách bên trái để bắt đầu nhập nguồn.
            </div>
          )}

          {/* TABLE OF SAVED SOURCES FOR CURRENT CLASS */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BookOpen size={18} color="#1b5e20" /> Các Nguồn Đã Lưu
                  {selectedClass && <span style={{ color: '#1b5e20', fontWeight: 600 }}>({selectedClass.diseaseName})</span>}
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Danh sách bằng chứng đã lưu cho lớp đang chọn và các lớp khác
                </span>
              </div>
            </div>

            {(() => {
              const currentClassSources = selectedClass
                ? sources.filter(s => s.modelClass === selectedClass.modelClass)
                : sources;

              if (currentClassSources.length === 0) {
                return (
                  <div style={{
                    padding: '30px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px dashed #cbd5e1',
                    color: '#64748b',
                    fontSize: '13px'
                  }}>
                    Lớp này hiện chưa có nguồn tài liệu nào được lưu. Hãy dùng từ khóa ở trên để tìm và lưu nguồn đầu tiên!
                  </div>
                );
              }

              return (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 600 }}>Tiêu Đề / Cơ Quan</th>
                        <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 600 }}>Đánh Giá Tên Miền</th>
                        <th style={{ padding: '10px 12px', color: '#475569', fontWeight: 600 }}>Loại Nội Dung</th>
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

                          <td style={{ padding: '12px', color: '#334155', fontSize: '12px' }}>
                            {item.contentType}
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
        </div>

      </div>
    </div>
  );
};

export default KnowledgeCollectorPage;
