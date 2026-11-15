import type { KnowledgeSourceItem, DuplicatePair } from '../types';

export const findDuplicateChunks = (rows: KnowledgeSourceItem[]): DuplicatePair[] => {
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
