import React, { useState } from 'react';
import axios from 'axios';
import { UploadCloud, AlertTriangle, CheckCircle, ShieldAlert, Sparkles, Activity } from 'lucide-react';

interface TreatmentStep {
  stepOrder: number;
  actionTitle: string;
  instructions: string;
  isolationDays?: string;
}

interface Product {
  id: number;
  name: string;
  activeIngredient: string;
  price: number;
  dosageInstruction: string;
}

interface DiagnosisResult {
  recordId: string;
  plantName: string;
  diseaseNameVi: string;
  classCode: string;
  isHealthy: boolean;
  confidence: number;
  isUncertain: boolean;
  warningMessage?: string;
  gradCamImageUrl?: string;
  originalImageUrl: string;
  symptoms: string;
  treatmentSteps: TreatmentStep[];
  recommendedProducts: Product[];
}

export const DiagnosePage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setError(null);
    }
  };

  const handleScan = async () => {
    if (!selectedFile) return;
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await axios.post<DiagnosisResult>('/api/v1/diagnose/scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi kết nối máy chủ AI hoặc Core API.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '40px 20px' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#1b5e20', marginBottom: '10px' }}>
          Khám Bệnh Lá Cây Bằng Trí Tuệ Nhân Tạo
        </h1>
        <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '650px', margin: '0 auto' }}>
          Mô hình ResNet-18 nhận diện 38 lớp sâu bệnh phổ biến trên 14 loài cây trồng. Tích hợp trực quan hóa Grad-CAM Heatmap và hướng dẫn xử lý chuẩn Khuyến nông (IPM).
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 450px) 1fr', gap: '32px' }}>
        {/* Upload Column */}
        <div>
          <div className="card" style={{ textAlign: 'center' }}>
            <label
              htmlFor="leaf-upload"
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '12px',
                padding: '30px 20px',
                display: 'block',
                cursor: 'pointer',
                background: '#f8fafc',
                marginBottom: '20px',
                transition: 'border-color 0.2s'
              }}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Ảnh lá tải lên"
                  style={{ maxHeight: '250px', maxWidth: '100%', borderRadius: '8px', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: '#e2e8f0', padding: '16px', borderRadius: '50%' }}>
                    <UploadCloud size={36} color="#1b5e20" />
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: '15px', color: '#1e293b' }}>Chọn ảnh lá hoặc kéo thả vào đây</strong>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Hỗ trợ JPEG, PNG, WebP (Tối đa 10MB)</span>
                  </div>
                </div>
              )}
              <input
                id="leaf-upload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>

            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px' }}
              disabled={!selectedFile || isLoading}
              onClick={handleScan}
            >
              {isLoading ? (
                <>
                  <Activity size={18} className="animate-spin" /> Đang Phân Tích &amp; Sinh Grad-CAM...
                </>
              ) : (
                <>
                  <Sparkles size={18} /> Khám Bệnh Ngay
                </>
              )}
            </button>

            {error && (
              <div style={{ marginTop: '16px', padding: '12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '14px' }}>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Results Column */}
        <div>
          {result ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Uncertainty Alert */}
              {result.isUncertain && (
                <div style={{
                  padding: '16px',
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <AlertTriangle size={24} color="#b45309" />
                  <div>
                    <strong style={{ color: '#b45309', display: 'block' }}>Cảnh báo độ bất định (Uncertainty &lt; 70%)</strong>
                    <span style={{ fontSize: '13px', color: '#78350f' }}>{result.warningMessage}</span>
                  </div>
                </div>
              )}

              {/* Diagnosis Header */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <span className={`badge ${result.isHealthy ? 'badge-success' : 'badge-danger'}`} style={{ marginBottom: '8px' }}>
                      {result.isHealthy ? 'Cây Khỏe Mạnh' : 'Phát Hiện Sâu Bệnh'}
                    </span>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#1b5e20' }}>{result.diseaseNameVi}</h2>
                    <p style={{ color: '#64748b', fontSize: '14px' }}>Cây: <strong>{result.plantName}</strong> | Mã lớp: <code>{result.classCode}</code></p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: result.confidence > 0.7 ? '#1b5e20' : '#b45309' }}>
                      {(result.confidence * 100).toFixed(1)}%
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Độ tin cậy mô hình</span>
                  </div>
                </div>

                <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#334155', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                  <strong>Triệu chứng nhận biết:</strong> {result.symptoms}
                </p>
              </div>

              {/* Grad-CAM Explainable AI */}
              {result.gradCamImageUrl && (
                <div className="card">
                  <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={20} color="#1b5e20" /> Giải Thích AI (Explainable AI - Grad-CAM)
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <img src={previewUrl || ''} alt="Ảnh gốc" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px' }} />
                      <span style={{ display: 'block', textAlign: 'center', fontSize: '12px', color: '#64748b', marginTop: '6px' }}>Ảnh lá gốc</span>
                    </div>
                    <div>
                      <img src={result.gradCamImageUrl} alt="Grad-CAM Heatmap" style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px' }} />
                      <span style={{ display: 'block', textAlign: 'center', fontSize: '12px', color: '#64748b', marginTop: '6px' }}>Vùng nơ-ron tập trung (Heatmap)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* IPM Treatment & Care Guidelines */}
              {result.treatmentSteps.length > 0 && (
                <div className="card">
                  <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
                    Hướng Dẫn Xử Lý & Chăm Sóc Chuẩn Khuyến Nông (IPM)
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {result.treatmentSteps.map((step) => (
                      <div key={step.stepOrder} style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', borderLeft: '4px solid #1b5e20' }}>
                        <strong style={{ color: '#1b5e20', display: 'block', marginBottom: '4px' }}>
                          Bước {step.stepOrder}: {step.actionTitle}
                        </strong>
                        <p style={{ fontSize: '14px', color: '#334155' }}>{step.instructions}</p>
                        {step.isolationDays && (
                          <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '12px', color: '#64748b' }}>
                            ⏱️ Thời gian cách ly an toàn (PHI): <strong>{step.isolationDays}</strong>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', textAlign: 'center' }}>
              <div style={{ background: '#f1f5f9', padding: '20px', borderRadius: '50%', marginBottom: '16px' }}>
                <CheckCircle size={40} color="#94a3b8" />
              </div>
              <h3 style={{ color: '#475569', marginBottom: '6px' }}>Chưa có kết quả chẩn đoán</h3>
              <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '380px' }}>
                Hãy tải lên một tấm ảnh chụp vết bệnh trên lá ở cột bên trái để bắt đầu khám bệnh tự động.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
