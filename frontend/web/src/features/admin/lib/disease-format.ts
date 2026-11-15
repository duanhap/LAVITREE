// Nhận diện đoạn/chủ đề thuộc nhóm Kỹ thuật canh tác & Phòng ngừa (không phải bệnh hại)
export const isHealthyTopic = (diseaseName?: string, modelClass?: string): boolean => {
  const name = (diseaseName || '').toLowerCase();
  const cls = (modelClass || '').toLowerCase();
  return name.includes('khỏe mạnh') || cls.endsWith('healthy');
};

// Chuẩn hóa tên chuyên mục hiển thị thống nhất trên bộ lọc, bảng duyệt tri thức và form nhập bài
export const formatTopicLabel = (diseaseName?: string, modelClass?: string): string =>
  isHealthyTopic(diseaseName, modelClass)
    ? '🌱 Kỹ thuật canh tác & Phòng ngừa'
    : (diseaseName || modelClass || 'Bệnh hại');
