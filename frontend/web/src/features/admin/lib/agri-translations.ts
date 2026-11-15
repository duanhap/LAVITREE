// Từ điển dịch thuật thuật ngữ nông nghiệp / hoạt chất sang tiếng Việt
export const AGRI_TRANSLATIONS: Record<string, string> = {
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
  'calcium': 'Canxi chống nứt / thối',
};

export const getAgriTranslation = (text: string): string | null => {
  if (!text) return null;
  const lower = text.trim().toLowerCase();
  if (AGRI_TRANSLATIONS[lower]) return AGRI_TRANSLATIONS[lower];
  for (const [key, val] of Object.entries(AGRI_TRANSLATIONS)) {
    if (lower.includes(key)) return val;
  }
  return null;
};
