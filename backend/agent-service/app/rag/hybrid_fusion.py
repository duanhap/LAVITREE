from typing import List, Dict, Optional, Tuple
from app.rag.schema import KnowledgeRecord, RetrievalChunk

class HybridFusionRRF:
    """
    Thuật toán hợp nhất Reciprocal Rank Fusion (RRF, k=60).
    Cân bằng giữa tìm kiếm từ khóa chính xác (BM25) và ngữ nghĩa triệu chứng (Dense Vector).
    """
    RRF_K = 60

    @classmethod
    def fuse(
        cls,
        bm25_results: List[Tuple[KnowledgeRecord, float, int]],
        vector_results: List[Tuple[KnowledgeRecord, float, int]],
        query: str,
        top_k: int = 5
    ) -> List[RetrievalChunk]:
        """
        Hợp nhất kết quả từ 2 bộ tìm kiếm theo điểm RRF và trả về danh sách RetrievalChunk.
        """
        q_lower = query.lower()
        # Phân loại ý định sơ bộ (Dynamic Intent Weighting)
        chemical_keywords = [
            "mancozeb", "metalaxyl", "chlorothalonil", "azoxystrobin", "difenoconazole",
            "cymoxanil", "fosetyl", "trichoderma", "bacillus", "hoạt chất", "thuốc", "liều lượng"
        ]
        is_chemical_focus = any(kw in q_lower for kw in chemical_keywords)

        bm25_weight = 1.3 if is_chemical_focus else 1.0
        vector_weight = 0.9 if is_chemical_focus else 1.3

        rrf_scores: Dict[str, float] = {}
        record_map: Dict[str, KnowledgeRecord] = {}

        # 1. Tích lũy điểm RRF từ BM25
        for rec, score, rank in bm25_results:
            rrf_point = bm25_weight / (cls.RRF_K + rank + 1)
            rrf_scores[rec.id] = rrf_scores.get(rec.id, 0.0) + rrf_point
            record_map[rec.id] = rec

        # 2. Tích lũy điểm RRF từ Vector
        for rec, score, rank in vector_results:
            rrf_point = vector_weight / (cls.RRF_K + rank + 1)
            rrf_scores[rec.id] = rrf_scores.get(rec.id, 0.0) + rrf_point
            if rec.id not in record_map:
                record_map[rec.id] = rec

        # 3. Sắp xếp theo điểm RRF giảm dần
        sorted_ids = sorted(rrf_scores.keys(), key=lambda doc_id: rrf_scores[doc_id], reverse=True)

        chunks: List[RetrievalChunk] = []
        for doc_id in sorted_ids[:top_k]:
            rec = record_map[doc_id]
            chunks.append(
                RetrievalChunk(
                    source_id=rec.id,
                    text=rec.evidence_text,
                    source_title=rec.source_title,
                    organization=rec.organization,
                    source_url=rec.source_url,
                    model_class=rec.model_class,
                    plant_name=rec.plant_name,
                    disease_name=rec.disease_name,
                    unit_type=rec.unit_type,
                    is_verbatim=rec.is_verbatim,
                    rrf_score=round(rrf_scores[doc_id], 5)
                )
            )

        return chunks

