import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search } from 'lucide-react';

interface DiseaseSummary {
  id: number;
  classCode: string;
  plantName: string;
  commonNameVi: string;
  pathogenType: string;
  severityLevel: number;
  symptoms: string;
  prevention: string;
}

export const HandbookPage: React.FC = () => {
  const [diseases, setDiseases] = useState<DiseaseSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDiseases();
  }, []);

  const fetchDiseases = async () => {
    try {
      const res = await axios.get<DiseaseSummary[]>('http://localhost:5000/api/v1/diseases');
      setDiseases(res.data);
    } catch {
      // Mock data fallback if API not running yet
      setDiseases([
        {
          id: 1,
          classCode: 'Tomato___Early_blight',
          plantName: 'Cà chua',
          commonNameVi: 'Bệnh đốm vòng cà chua',
          pathogenType: 'Nấm (Alternaria solani)',
          severityLevel: 2,
          symptoms: 'Các đốm màu nâu sẫm hoặc đen có vòng đồng tâm trên các lá già gần mặt đất.',
          prevention: 'Luân canh cây trồng, tỉa lá sát gốc, tránh tưới ướt tán lá vào chiều tối.'
        },
        {
          id: 2,
          classCode: 'Tomato___Late_blight',
          plantName: 'Cà chua',
          commonNameVi: 'Bệnh sương mai / mốc sương',
          pathogenType: 'Nấm (Phytophthora infestans)',
          severityLevel: 3,
          symptoms: 'Vết bệnh úng nước màu xám đen, mặt dưới lá có lớp phấn mốc trắng như sương.',
          prevention: 'Phun phòng khi thời tiết nồm ẩm kéo dài, tiêu hủy cây nhiễm bệnh nặng.'
        },
        {
          id: 3,
          classCode: 'Potato___Late_blight',
          plantName: 'Khoai tây',
          commonNameVi: 'Bệnh sương mai khoai tây',
          pathogenType: 'Nấm (Phytophthora infestans)',
          severityLevel: 3,
          symptoms: 'Vết thâm đen nhũn ướt trên chóp lá, nhanh chóng lan xuống củ làm thối củ.',
          prevention: 'Sử dụng giống kháng bệnh, vun gốc cao, phun thuốc gốc đồng phòng ngừa.'
        }
      ]);
    }
  };

  const filtered = diseases.filter(d =>
    d.commonNameVi.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.plantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.classCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container" style={{ padding: '40px 20px' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#1b5e20', marginBottom: '8px' }}>
          Sổ Tay Cẩm Nang 38 Bệnh Cây Trồng
        </h1>
        <p style={{ color: '#64748b' }}>
          Tra cứu nhanh triệu chứng, tác nhân gây bệnh và biện pháp phòng ngừa canh tác chuẩn khuyến nông.
        </p>

        <div style={{ marginTop: '20px', maxWidth: '500px', position: 'relative' }}>
          <input
            type="text"
            placeholder="Tìm theo tên bệnh, loài cây (cà chua, khoai tây, ngô...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px 12px 44px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '14px',
              outline: 'none'
            }}
          />
          <Search size={20} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '12px' }} />
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
        {filtered.map(disease => (
          <div key={disease.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <span className="badge badge-success">{disease.plantName}</span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Cấp độ: {disease.severityLevel}/3</span>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1b5e20', marginBottom: '4px' }}>
              {disease.commonNameVi}
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
              Tác nhân: <em>{disease.pathogenType}</em>
            </p>
            <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
              <strong>Triệu chứng:</strong> {disease.symptoms}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
