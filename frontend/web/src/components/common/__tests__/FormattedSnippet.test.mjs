import test from 'node:test';
import assert from 'node:assert/strict';
import {
  foldVi,
  splitByMention,
  isPureNumberMarker,
  splitTextIntoDisplayLines,
  cleanRawMarkdown,
  extractHeadingAndBody,
  cleanSymptomText,
} from '../../../lib/snippet-format.ts';

test('foldVi: strips accents and lowercases', () => {
  assert.equal(foldVi('Cà chua'), 'ca chua');
  assert.equal(foldVi('Đốm lá'), 'dom la');
  assert.equal(foldVi('Trichoderma'), 'trichoderma');
});

test('splitByMention: finds exact mention case-insensitively with diacritics', () => {
  const segs = splitByMention('Chế phẩm Trichoderma đối kháng nấm', 'trichoderma');
  assert.equal(segs.length, 3);
  assert.equal(segs[0].text, 'Chế phẩm ');
  assert.equal(segs[0].match, false);
  assert.equal(segs[1].text, 'Trichoderma');
  assert.equal(segs[1].match, true);
  assert.equal(segs[2].text, ' đối kháng nấm');
  assert.equal(segs[2].match, false);
});

test('isPureNumberMarker: detects number-only lines', () => {
  assert.equal(isPureNumberMarker('1.'), true);
  assert.equal(isPureNumberMarker('2.'), true);
  assert.equal(isPureNumberMarker('• 4.'), true);
  assert.equal(isPureNumberMarker('**1.1**'), true);
  assert.equal(isPureNumberMarker('IV.'), true);
  assert.equal(isPureNumberMarker('1. Giống kháng bệnh'), false);
});

test('extractHeadingAndBody: extracts markdown heading into clean badge and body', () => {
  const input = '### Biện pháp phòng chống: - Giống: Trồng giống kháng bệnh. - Biện pháp canh tác: Vệ sinh vườn.';
  const { heading, body } = extractHeadingAndBody(input);
  assert.equal(heading, 'Biện pháp phòng chống');
  assert.ok(body.includes('Giống: Trồng giống kháng bệnh'));
  assert.ok(!body.includes('###'));
  assert.ok(!body.includes('- Giống'));
});

test('cleanRawMarkdown: removes hashes, bold marks, and leading bullets', () => {
  const raw = '### Tiêu đề: **in đậm** và - bullet 1. - bullet 2.';
  const cleaned = cleanRawMarkdown(raw);
  assert.ok(!cleaned.includes('###'));
  assert.ok(!cleaned.includes('**'));
  assert.equal(cleaned, 'Tiêu đề: in đậm và bullet 1. bullet 2.');
});

test('splitTextIntoDisplayLines: separates headings, sub-items and FAQ correctly', () => {
  const raw = '### Biện pháp phòng ngừa: Bệnh có nguy hiểm không? Cần cắt tỉa cành.';
  const lines = splitTextIntoDisplayLines(raw);
  assert.ok(lines.length >= 2);
  assert.ok(lines.some((l) => l.includes('### Biện pháp phòng ngừa:')));
  assert.ok(lines.some((l) => l.includes('Bệnh có nguy hiểm không?')));
});

test('cleanSymptomText: strips camera capture commands and turns into natural botanical symptoms', () => {
  // Case 1: Chụp cận cảnh ... đặt lá trên nền trơn
  const t1 = 'Chụp cận cảnh 15–20cm các vết vảy nâu ô liu trên mặt lá, đặt lá trên nền trơn.';
  assert.equal(cleanSymptomText(t1), 'Các vết vảy nâu ô liu trên mặt lá.');

  // Case 2: Chụp rõ đốm tròn
  const t2 = 'Chụp rõ đốm tròn có viền tím sẫm trên phiến lá.';
  assert.equal(cleanSymptomText(t2), 'Đốm tròn có viền tím sẫm trên phiến lá.');

  // Case 3: Chụp rõ lớp phấn trắng
  const t3 = 'Chụp rõ lớp phấn trắng trên mặt lá.';
  assert.equal(cleanSymptomText(t3), 'Lớp phấn trắng trên mặt lá.');

  // Case 4: Lật mặt dưới lá, chụp...
  const t4 = 'Lật mặt dưới lá, chụp lớp mốc màu nâu tím.';
  assert.equal(cleanSymptomText(t4), 'Mặt dưới lá xuất hiện lớp mốc màu nâu tím.');

  // Case 5: Empty text fallback
  assert.equal(cleanSymptomText('', 'Thán thư', 'Xoài'), 'Triệu chứng nhận biết và đặc điểm bệnh Thán thư trên cây Xoài.');
});
