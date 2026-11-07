import os
import logging
from typing import List, Tuple, Optional
import chromadb
from app.rag.schema import KnowledgeRecord

logger = logging.getLogger("rag.vector")


def rag_data_dir() -> str:
    """Thư mục lưu chỉ mục. Trong Docker là volume agent_data; test trỏ RAG_DATA_DIR sang thư mục tạm."""
    configured = os.environ.get("RAG_DATA_DIR")
    if configured:
        return configured
    return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


class MultilingualEmbeddingFunction:
    """
    Embedding Function đa ngôn ngữ cho ChromaDB.
    Tuân thủ nguyên tắc Fail-Closed: Tuyệt đối không trả về all-zeros vector nếu không load được model.
    """
    def __init__(self, model_name: Optional[str] = None):
        self.model = None
        self.model_name = model_name or os.environ.get("EMBEDDING_MODEL_NAME", "BAAI/bge-m3")
        self.dimension: int = 1024
        self._init_model()

    def _init_model(self):
        # Đảm bảo nạp từ cache offline nếu TRANSFORMERS_OFFLINE được bật
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading SentenceTransformer: {self.model_name}...")
            self.model = SentenceTransformer(self.model_name)
            self.dimension = self.model.get_sentence_embedding_dimension()
            logger.info(f"SentenceTransformer loaded successfully. Model: {self.model_name}, Dimension: {self.dimension}")
        except Exception as e:
            logger.critical(f"Failed to load required embedding model '{self.model_name}': {e}")
            raise RuntimeError(
                f"CRITICAL: Cannot load embedding model '{self.model_name}'. "
                f"Agent Service cannot operate with missing or zero-vector embeddings. Error: {e}"
            )

    def __call__(self, input: List[str]) -> List[List[float]]:
        if not self.model:
            raise RuntimeError("CRITICAL: SentenceTransformer model is None. Zero-vector fallback is strictly forbidden.")

        embeddings = self.model.encode(
            input,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False
        )
        return embeddings.tolist()


class VectorRetriever:
    """
    Quản lý lưu trữ và truy vấn Dense Vector Semantic Search trên ChromaDB cục bộ.
    Áp dụng kiến trúc Blue-Green Atomic Swap khi reindex để chống rỗng chỉ mục (downtime).
    """
    COLLECTION_BLUE = "agri_knowledge_blue"
    COLLECTION_GREEN = "agri_knowledge_green"

    def __init__(self, persist_dir: Optional[str] = None):
        if not persist_dir:
            persist_dir = os.path.join(rag_data_dir(), "chroma_db")

        os.makedirs(persist_dir, exist_ok=True)
        self.persist_dir = persist_dir
        self.client = chromadb.PersistentClient(path=self.persist_dir)
        self.embedding_fn = MultilingualEmbeddingFunction()

        self.pointer_file = os.path.join(self.persist_dir, "active_collection.txt")
        self.active_collection_name = self._get_active_collection_name()
        self.collection = self.client.get_or_create_collection(
            name=self.active_collection_name,
            metadata=self._collection_metadata()
        )
        self.index_compatible = self._is_compatible(self.collection)

    def _collection_metadata(self) -> dict:
        return {
            "hnsw:space": "cosine",
            "model_name": self.embedding_fn.model_name,
            "dimension": self.embedding_fn.dimension
        }

    def _is_compatible(self, collection) -> bool:
        """Chỉ mục dựng bằng model khác thì không truy vấn được; chờ reindex dựng lại thay vì lỗi ngầm."""
        metadata = collection.metadata or {}
        compatible = (
            metadata.get("model_name") == self.embedding_fn.model_name
            and metadata.get("dimension") == self.embedding_fn.dimension
        )
        if not compatible:
            logger.error(
                f"Vector index was built with {metadata.get('model_name')} ({metadata.get('dimension')}d), "
                f"running model is {self.embedding_fn.model_name} ({self.embedding_fn.dimension}d). "
                "Vector search is disabled until the next reindex."
            )
        return compatible

    def _get_active_collection_name(self) -> str:
        if os.path.exists(self.pointer_file):
            try:
                with open(self.pointer_file, "r", encoding="utf-8") as f:
                    name = f.read().strip()
                    if name in (self.COLLECTION_BLUE, self.COLLECTION_GREEN):
                        return name
            except Exception:
                pass
        return self.COLLECTION_BLUE

    def _set_active_collection_name(self, name: str) -> None:
        tmp_file = f"{self.pointer_file}.tmp"
        with open(tmp_file, "w", encoding="utf-8") as f:
            f.write(name)
        os.replace(tmp_file, self.pointer_file)
        self.active_collection_name = name

    def get_collection(self):
        """Luôn lấy active collection hiện tại."""
        return self.collection

    def reindex(self, records: List[KnowledgeRecord]) -> int:
        """
        Blue-Green Atomic Reindex:
        1. Tạo chỉ mục trên staging collection (nếu đang là Blue thì nạp Green, và ngược lại).
        2. Nếu nạp lỗi giữa chừng, huỷ bỏ staging collection; collection cũ vẫn phục vụ bình thường.
        3. Chỉ khi nạp 100% thành công mới trỏ pointer sang collection mới và xoá collection cũ.
        Danh sách rỗng vẫn đi qua các bước này để gỡ hết bài khỏi chỉ mục.
        """
        target_collection_name = (
            self.COLLECTION_GREEN if self.active_collection_name == self.COLLECTION_BLUE
            else self.COLLECTION_BLUE
        )
        old_collection_name = self.active_collection_name

        logger.info(f"Starting Blue-Green reindex into candidate: {target_collection_name}...")

        # 1. Làm sạch target collection nếu đã tồn tại trước đó
        try:
            self.client.delete_collection(name=target_collection_name)
        except Exception:
            pass

        target_collection = self.client.create_collection(
            name=target_collection_name,
            metadata=self._collection_metadata()
        )

        try:
            if records:
                ids = []
                documents = []
                metadatas = []

                for r in records:
                    # Kỹ thuật Contextual Prepending: Ghép rõ tên loài cây và tên bệnh
                    doc_text = f"Cây {r.plant_name} - {r.disease_name} ({r.model_class}): {r.evidence_text}"
                    ids.append(r.id)
                    documents.append(doc_text)
                    metadatas.append({
                        "model_class": r.model_class,
                        "plant_name": r.plant_name,
                        "disease_name": r.disease_name,
                        "source_title": r.source_title,
                        "organization": r.organization,
                        "source_url": r.source_url,
                        "unit_type": r.unit_type,
                        "is_verbatim": str(r.is_verbatim).lower(),
                        "raw_evidence": r.evidence_text
                    })

                embeddings = self.embedding_fn(documents)

                target_collection.add(
                    ids=ids,
                    embeddings=embeddings,
                    documents=documents,
                    metadatas=metadatas
                )

            # 2. Hoán đổi nguyên tử (Atomic Switch)
            self._set_active_collection_name(target_collection_name)
            self.collection = target_collection
            self.index_compatible = True
            logger.info(f"Atomic switch completed! Active collection is now {target_collection_name} ({len(records)} records).")

            # 3. Dọn dẹp collection cũ
            try:
                self.client.delete_collection(name=old_collection_name)
                logger.info(f"Old collection {old_collection_name} cleaned up.")
            except Exception as ex_clean:
                logger.warning(f"Could not delete old collection {old_collection_name}: {ex_clean}")

            return len(records)

        except Exception as e:
            logger.error(f"Reindex failed halfway: {e}. Discarding candidate collection {target_collection_name}. Old index {old_collection_name} remains intact.")
            try:
                self.client.delete_collection(name=target_collection_name)
            except Exception:
                pass
            raise e

    def _query(self, collection, query_embedding: List[float], where_filter: Optional[dict], top_k: int):
        count = collection.count()
        if count == 0:
            return None
        return collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, count),
            where=where_filter,
            include=["metadatas", "distances"]
        )

    def search(
        self,
        query: str,
        disease_code: Optional[str] = None,
        top_k: int = 10
    ) -> List[Tuple[KnowledgeRecord, float, int]]:
        """
        Truy vấn Dense Vector Semantic Search từ ChromaDB theo Cosine Distance.
        """
        if not self.index_compatible:
            return []

        where_filter = {"model_class": {"$eq": disease_code}} if disease_code else None
        query_embedding = self.embedding_fn([query])[0]

        collection = self.collection
        try:
            results = self._query(collection, query_embedding, where_filter, top_k)
        except Exception:
            # Collection cũ có thể vừa bị xoá sau khi reindex đổi chỉ mục: thử lại trên chỉ mục mới
            if self.collection is collection:
                raise
            results = self._query(self.collection, query_embedding, where_filter, top_k)

        output: List[Tuple[KnowledgeRecord, float, int]] = []
        if not results or not results["ids"] or not results["ids"][0]:
            return output

        ids = results["ids"][0]
        metadatas = results["metadatas"][0]
        distances = results["distances"][0]

        for rank, (doc_id, meta, dist) in enumerate(zip(ids, metadatas, distances)):
            # Cosine similarity = 1 - cosine distance
            similarity = 1.0 - dist
            rec = KnowledgeRecord(
                id=doc_id,
                model_class=meta.get("model_class", ""),
                plant_name=meta.get("plant_name", ""),
                disease_name=meta.get("disease_name", ""),
                source_title=meta.get("source_title", ""),
                organization=meta.get("organization", ""),
                source_url=meta.get("source_url", ""),
                evidence_text=meta.get("raw_evidence", ""),
                unit_type=meta.get("unit_type", "SUMMARY"),
                is_verbatim=meta.get("is_verbatim", "false") == "true",
                is_manual_approved=True
            )
            output.append((rec, round(similarity, 4), rank))

        return output
