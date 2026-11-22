import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSentenceWithMention, groupProductEvidence } from '../groupEvidence.ts';

test('extractSentenceWithMention: extracts sentence with matching mention and boundaries', () => {
  const text = 'Vườn cây cần thông thoáng. Khi chớm xuất hiện bệnh sương mai, phun Ridomil Gold 68WG với liều 50g/bình 16 lít nước. Sau 7 ngày kiểm tra lại.';
  const result = extractSentenceWithMention(text, 'Ridomil Gold');

  assert.equal(result.match, 'Ridomil Gold');
  assert.ok(result.before.includes('Khi chớm xuất hiện bệnh sương mai, phun '));
  assert.ok(result.after.includes(' 68WG với liều 50g/bình 16 lít nước'));
  assert.ok(!result.before.includes('Vườn cây cần thông thoáng')); // Before sentence excluded
  assert.ok(!result.after.includes('Sau 7 ngày kiểm tra lại')); // After sentence excluded
});

test('extractSentenceWithMention: case-insensitive matching', () => {
  const text = 'Tiến hành phun RIDOMIL GOLD khi trời râm mát.';
  const result = extractSentenceWithMention(text, 'ridomil gold');

  assert.equal(result.match, 'RIDOMIL GOLD');
  assert.ok(result.before.includes('Tiến hành phun '));
  assert.ok(result.after.includes(' khi trời râm mát'));
});

test('extractSentenceWithMention: fallback when mention is missing', () => {
  const text = 'Bài báo này chỉ đề cập đến các biện pháp canh tác và giống kháng bệnh, không nhắc đến hóa chất.';
  const result = extractSentenceWithMention(text, 'Anvil');

  assert.equal(result.match, '');
  assert.equal(result.after, '');
  assert.equal(result.before, text);
});

test('extractSentenceWithMention: fallback truncation when text > 240 chars and mention missing', () => {
  const longText = 'A'.repeat(300);
  const result = extractSentenceWithMention(longText, 'Bravonil');

  assert.equal(result.match, '');
  assert.equal(result.after, '');
  assert.equal(result.before, 'A'.repeat(240) + '…');
});

test('groupProductEvidence: categorizes into MANUAL_ONLY, SUPPORTED, UNRECOMMENDED_EVIDENCE and sorts correctly', () => {
  const diseases = [
    { class_code: 'Tomato___Late_blight', disease_name: 'Mốc sương', plant_name: 'Cà chua' },
    { class_code: 'Tomato___Early_blight', disease_name: 'Đốm vòng', plant_name: 'Cà chua' },
  ];

  const evidences = [
    // Tomato___Late_blight has evidence -> SUPPORTED
    {
      suggestion_id: 1,
      knowledge_source_id: 'ks-1',
      model_class: 'Tomato___Late_blight',
      plant_name: 'Cà chua',
      disease_name: 'Mốc sương',
      mention_text: 'Ridomil Gold',
      unit_type: 'TREATMENT',
      evidence_text: 'Trị mốc sương bằng Ridomil Gold.',
      is_verbatim: true,
      source_title: 'Viện BVTV',
      source_url: 'https://bvtv.org.vn/bai-1',
      organization: 'Viện BVTV',
      is_approved: true,
      published_date: '2025-01-01',
      status: 'LINKED',
    },
    // Potato___Late_blight has evidence but NOT in diseases -> UNRECOMMENDED_EVIDENCE
    {
      suggestion_id: 2,
      knowledge_source_id: 'ks-2',
      model_class: 'Potato___Late_blight',
      plant_name: 'Khoai tây',
      disease_name: 'Mốc sương khoai tây',
      mention_text: 'Ridomil Gold',
      unit_type: 'TREATMENT',
      evidence_text: 'Dùng cho khoai tây mốc sương.',
      is_verbatim: true,
      source_title: 'Khuyến Nông VN',
      source_url: 'https://khuyennong.gov.vn/bai-2',
      organization: 'Khuyến Nông',
      is_approved: true,
      published_date: '2025-02-01',
      status: 'LINKED',
    },
    // Tomato___Early_blight has NO evidence in evidences -> MANUAL_ONLY
  ];

  const grouped = groupProductEvidence(diseases, evidences, { mode: 'admin' });

  assert.equal(grouped.length, 3);

  // Status order must be: 1st MANUAL_ONLY, 2nd SUPPORTED, 3rd UNRECOMMENDED_EVIDENCE
  assert.equal(grouped[0].status, 'MANUAL_ONLY');
  assert.equal(grouped[0].modelClass, 'Tomato___Early_blight');
  assert.equal(grouped[0].isRecommended, true);
  assert.equal(grouped[0].totalEvidenceCount, 0);

  assert.equal(grouped[1].status, 'SUPPORTED');
  assert.equal(grouped[1].modelClass, 'Tomato___Late_blight');
  assert.equal(grouped[1].isRecommended, true);
  assert.equal(grouped[1].totalEvidenceCount, 1);

  assert.equal(grouped[2].status, 'UNRECOMMENDED_EVIDENCE');
  assert.equal(grouped[2].modelClass, 'Potato___Late_blight');
  assert.equal(grouped[2].isRecommended, false);
  assert.equal(grouped[2].totalEvidenceCount, 1);
});

test('groupProductEvidence: deduplicates articles by source_url and groups snippets', () => {
  const diseases = [
    { class_code: 'Tomato___Late_blight', disease_name: 'Mốc sương', plant_name: 'Cà chua' },
  ];

  const evidences = [
    {
      suggestion_id: 101,
      knowledge_source_id: 'ks-101',
      model_class: 'Tomato___Late_blight',
      plant_name: 'Cà chua',
      disease_name: 'Mốc sương',
      mention_text: 'Ridomil Gold',
      unit_type: 'TREATMENT',
      evidence_text: 'Đoạn 1: Phun khi mới chớm xuất hiện mốc sương.',
      is_verbatim: true,
      source_title: 'Bài hướng dẫn toàn diện',
      source_url: 'https://bvtv.org.vn/huong-dan-ca-chua',
      organization: 'Viện BVTV',
      is_approved: true,
      published_date: '2025-01-01',
      status: 'LINKED',
    },
    {
      suggestion_id: 102,
      knowledge_source_id: 'ks-102',
      model_class: 'Tomato___Late_blight',
      plant_name: 'Cà chua',
      disease_name: 'Mốc sương',
      mention_text: 'Ridomil Gold',
      unit_type: 'TREATMENT',
      evidence_text: 'Đoạn 2: Liều lượng 50g cho bình 16 lít.',
      is_verbatim: true,
      source_title: 'Bài hướng dẫn toàn diện',
      source_url: 'https://bvtv.org.vn/huong-dan-ca-chua',
      organization: 'Viện BVTV',
      is_approved: true,
      published_date: '2025-01-01',
      status: 'LINKED',
    },
  ];

  const grouped = groupProductEvidence(diseases, evidences, { mode: 'admin' });

  assert.equal(grouped.length, 1);
  const row = grouped[0];
  assert.equal(row.totalEvidenceCount, 2);
  // Merged under 1 article
  assert.equal(row.articles.length, 1);
  assert.equal(row.articles[0].sourceUrl, 'https://bvtv.org.vn/huong-dan-ca-chua');
  assert.equal(row.articles[0].snippets.length, 2);
  assert.equal(row.articles[0].snippets[0].suggestionId, 101);
  assert.equal(row.articles[0].snippets[1].suggestionId, 102);
});

test('groupProductEvidence: public mode filters out unapproved evidence', () => {
  const diseases = [
    { class_code: 'Tomato___Late_blight', disease_name: 'Mốc sương', plant_name: 'Cà chua' },
  ];

  const evidences = [
    {
      suggestion_id: 201,
      knowledge_source_id: 'ks-201',
      model_class: 'Tomato___Late_blight',
      plant_name: 'Cà chua',
      disease_name: 'Mốc sương',
      mention_text: 'Chế phẩm thử nghiệm',
      unit_type: 'TREATMENT',
      evidence_text: 'Đoạn này chưa được kiểm duyệt.',
      is_verbatim: true,
      source_title: 'Bài viết diễn đàn',
      source_url: 'https://forum.nongnghiep.vn/bai-test',
      organization: 'Cộng đồng',
      is_approved: false,
      published_date: null,
      status: 'LINKED',
    },
  ];

  // In admin mode, it shows up as SUPPORTED with isApproved = false
  const adminGrouped = groupProductEvidence(diseases, evidences, { mode: 'admin' });
  assert.equal(adminGrouped[0].status, 'SUPPORTED');
  assert.equal(adminGrouped[0].totalEvidenceCount, 1);
  assert.equal(adminGrouped[0].articles[0].isApproved, false);

  // In public mode, unapproved evidence is hidden -> becomes MANUAL_ONLY
  const publicGrouped = groupProductEvidence(diseases, evidences, { mode: 'public' });
  assert.equal(publicGrouped[0].status, 'MANUAL_ONLY');
  assert.equal(publicGrouped[0].totalEvidenceCount, 0);
  assert.equal(publicGrouped[0].articles.length, 0);
});
