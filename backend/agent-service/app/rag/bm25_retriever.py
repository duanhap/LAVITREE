import re
import math
from typing import List, Dict, Tuple, Optional
from app.rag.schema import KnowledgeRecord

class SimpleVietnameseTokenizer:
    """
    Bộ tiền xử lý và tách từ tiếng Việt tối ưu cho thuật ngữ nông nghiệp,
    tên cây trồng, mã bệnh và danh mục hoạt chất bảo vệ thực vật.
    """
    @staticmethod
    def tokenize(text: str) -> List[str]:
        if not text:
            return []
        cleaned = re.sub(r"[^\w\s\.-]", " ", text.lower())
        tokens = [t.strip() for t in cleaned.split() if len(t.strip()) > 1]
        return tokens

class BM25Retriever:
    """
    Thuật toán BM25 Okapi (k1=1.5, b=0.75) cho tìm kiếm từ khóa chính xác
    hoạt chất hóa học, nồng độ pha chế và triệu chứng cụ thể.
    """
    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.records: List[KnowledgeRecord] = []
        self.doc_len: List[int] = []
        self.avg_doc_len: float = 0.0
        self.doc_freqs: Dict[str, int] = {}
        self.idf: Dict[str, float] = {}

    def fit(self, records: List[KnowledgeRecord]) -> None:
        """Nạp danh sách bản ghi tri thức và xây dựng chỉ mục nghịch đảo BM25."""
        self.records = records
        self.doc_len = []
        self.doc_freqs = {}
        n_docs = len(records)

        for record in records:
            # Lập chỉ mục trên nội dung tổng hợp gồm: tên cây, tên bệnh, mã bệnh và trích đoạn bằng chứng
            full_searchable_text = f"{record.plant_name} {record.disease_name} {record.model_class} {record.source_title} {record.evidence_text}"
            tokens = set(SimpleVietnameseTokenizer.tokenize(full_searchable_text))
            self.doc_len.append(len(tokens))
            for tok in tokens:
                self.doc_freqs[tok] = self.doc_freqs.get(tok, 0) + 1

        self.avg_doc_len = (sum(self.doc_len) / n_docs) if n_docs > 0 else 1.0

        for tok, freq in self.doc_freqs.items():
            # Công thức chuẩn IDF (Lucene / BM25 Okapi)
            self.idf[tok] = math.log(1.0 + (n_docs - freq + 0.5) / (freq + 0.5))

    def search(
        self,
        query: str,
        disease_code: Optional[str] = None,
        top_k: int = 10
    ) -> List[Tuple[KnowledgeRecord, float, int]]:
        """
        Tìm kiếm BM25. Trả về danh sách tuples: (record, bm25_score, rank_0_indexed).
        Hỗ trợ lọc theo disease_code nếu được cung cấp.
        """
        if not self.records:
            return []

        query_tokens = SimpleVietnameseTokenizer.tokenize(query)
        scores: List[Tuple[int, float]] = []

        for idx, record in enumerate(self.records):
            if disease_code and record.model_class != disease_code:
                continue

            full_searchable_text = f"{record.plant_name} {record.disease_name} {record.model_class} {record.source_title} {record.evidence_text}"
            doc_tokens = SimpleVietnameseTokenizer.tokenize(full_searchable_text)
            dl = self.doc_len[idx]
            
            token_counts: Dict[str, int] = {}
            for t in doc_tokens:
                token_counts[t] = token_counts.get(t, 0) + 1

            score = 0.0
            for q_tok in query_tokens:
                if q_tok in token_counts:
                    tf = token_counts[q_tok]
                    idf = self.idf.get(q_tok, 0.1)
                    denom = tf + self.k1 * (1.0 - self.b + self.b * (dl / self.avg_doc_len))
                    score += idf * (tf * (self.k1 + 1.0)) / denom

            if score > 0:
                scores.append((idx, score))

        # Sắp xếp điểm BM25 giảm dần
        scores.sort(key=lambda x: x[1], reverse=True)

        results: List[Tuple[KnowledgeRecord, float, int]] = []
        for rank, (idx, sc) in enumerate(scores[:top_k]):
            results.append((self.records[idx], round(sc, 4), rank))

        return results

