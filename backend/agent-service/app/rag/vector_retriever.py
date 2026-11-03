import os
import logging
from typing import List, Tuple, Optional, Dict, Any
import chromadb
from chromadb.config import Settings
from app.rag.schema import KnowledgeRecord

logger = logging.getLogger("rag.vector")

class MultilingualEmbeddingFunction:
    """
    Embedding Function đa ngôn ngữ cho ChromaDB.
    Ưu tiên BAAI/bge-m3 (đã tải sẵn offline) hoặc paraphrase-multilingual-MiniLM-L12-v2.
    """
    def __init__(self, model_name: Optional[str] = None):
        self.model = None
        self.model_name = model_name or os.environ.get("EMBEDDING_MODEL_NAME", "BAAI/bge-m3")
        self._init_model()

    def _init_model(self):
        # Đảm bảo nạp từ cache offline nếu không có kết nối internet
        os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading SentenceTransformer: {self.model_name}...")
            self.model = SentenceTransformer(self.model_name)
            logger.info("SentenceTransformer loaded successfully.")
        except Exception as e:
            logger.warning(f"Could not load {self.model_name}: {e}. Trying fallback...")
            try:
                from sentence_transformers import SentenceTransformer
                self.model = SentenceTransformer("all-MiniLM-L6-v2")
                logger.info("Fallback to all-MiniLM-L6-v2.")
            except Exception as e2:
                logger.error(f"Fallback failed: {e2}. ChromaDB default embedding will be used.")
                self.model = None

    def __call__(self, input: List[str]) -> List[List[float]]:
        if self.model:
            embeddings = self.model.encode(
                input,
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False
            )
            return embeddings.tolist()
        return [[0.0] * 384 for _ in input]


class VectorRetriever:
    """
    Quản lý lưu trữ và truy vấn Dense Vector Semantic Search trên ChromaDB cục bộ.
    """
    COLLECTION_NAME = "agri_knowledge"

    def __init__(self, persist_dir: Optional[str] = None):
        if not persist_dir:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            persist_dir = os.path.join(base_dir, "data", "chroma_db")
        
        os.makedirs(persist_dir, exist_ok=True)
        self.persist_dir = persist_dir
        self.client = chromadb.PersistentClient(path=self.persist_dir)
        self.embedding_fn = MultilingualEmbeddingFunction()
        
        self.collection = self.client.get_or_create_collection(
            name=self.COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"}
        )

    def get_collection(self):
        """Luôn lấy collection hiện tại, tránh lỗi stale UUID khi reindex."""
        return self.client.get_or_create_collection(
            name=self.COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"}
        )

    def reindex(self, records: List[KnowledgeRecord]) -> int:
        """
        Xóa và nạp lại toàn bộ chỉ mục ChromaDB từ danh sách bản ghi đã duyệt.
        Đảm bảo không sinh bản ghi trùng và loại bỏ các bản ghi đã bị gỡ.
        """
        try:
            self.client.delete_collection(name=self.COLLECTION_NAME)
        except Exception:
            pass

        collection = self.get_collection()

        if not records:
            return 0

        ids = []
        documents = []
        metadatas = []

        for r in records:
            ids.append(r.id)
            # Contextual Enrichment: gắn kèm ngữ cảnh Cây trồng & Bệnh học vào document vector
            doc_context = f"Cây {r.plant_name} - {r.disease_name} ({r.model_class}): {r.evidence_text}"
            documents.append(doc_context)
            metadatas.append({
                "disease_code": r.model_class,
                "plant_name": r.plant_name,
                "disease_name": r.disease_name,
                "source_title": r.source_title,
                "organization": r.organization,
                "source_url": r.source_url,
                "unit_type": r.unit_type,
                "is_verbatim": r.is_verbatim,
            })

        # Tạo embeddings
        embeddings = self.embedding_fn(documents)

        # Batch upsert vào ChromaDB
        batch_size = 64
        for i in range(0, len(ids), batch_size):
            end = i + batch_size
            collection.add(
                ids=ids[i:end],
                documents=documents[i:end],
                embeddings=embeddings[i:end],
                metadatas=metadatas[i:end]
            )

        return len(ids)

    def search(
        self,
        query: str,
        disease_code: Optional[str] = None,
        top_k: int = 10
    ) -> List[Tuple[KnowledgeRecord, float, int]]:
        """
        Tìm kiếm ngữ nghĩa (Dense Vector Search) trên ChromaDB.
        Trả về danh sách tuples: (record, similarity_score, rank_0_indexed).
        """
        collection = self.get_collection()
        query_embedding = self.embedding_fn([query])[0]
        
        where_filter = None
        if disease_code:
            where_filter = {"disease_code": disease_code}

        total_docs = collection.count()
        if total_docs == 0:
            return []

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, total_docs),
            where=where_filter,
            include=["documents", "metadatas", "distances"]
        )

        output: List[Tuple[KnowledgeRecord, float, int]] = []
        if not results or not results["ids"] or not results["ids"][0]:
            return output

        ids = results["ids"][0]
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        distances = results["distances"][0] if "distances" in results else [0.0] * len(ids)

        for rank, (doc_id, text, meta, dist) in enumerate(zip(ids, docs, metas, distances)):
            # Cosine distance sang similarity: sim = 1.0 - dist
            sim_score = max(0.0, 1.0 - dist)
            rec = KnowledgeRecord(
                id=doc_id,
                model_class=meta.get("disease_code", ""),
                plant_name=meta.get("plant_name", ""),
                disease_name=meta.get("disease_name", ""),
                source_title=meta.get("source_title", ""),
                organization=meta.get("organization", ""),
                source_url=meta.get("source_url", ""),
                evidence_text=text,
                unit_type=meta.get("unit_type", "SUMMARY"),
                is_verbatim=meta.get("is_verbatim", False),
                is_manual_approved=True
            )
            output.append((rec, round(sim_score, 4), rank))

        return output

