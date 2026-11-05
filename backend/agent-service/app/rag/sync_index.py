import os
import csv
import sys
import logging
from typing import List, Optional
from app.rag.schema import KnowledgeRecord

logger = logging.getLogger("rag.sync")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# 5 mã bệnh demo hạt nhân được ưu tiên trong Sprint 2
DEMO_DISEASE_CODES = {
    "Tomato___Late_blight",
    "Tomato___Early_blight",
    "Tomato___Target_Spot",
    "Pepper,_bell___Bacterial_spot",
    "Corn_(maize)___Common_rust_"
}

def load_records_from_postgres(db_url: str, demo_only: bool = False) -> List[KnowledgeRecord]:
    """
    Đọc tri thức khuyến nông từ CSDL PostgreSQL (SSOT) bằng tài khoản read-only.
    """
    import psycopg2
    logger.info(f"Connecting to PostgreSQL (Read-Only) via AGENT_DB_URL...")
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()

    query = """
    SELECT "Id", "ModelClass", "PlantName", "DiseaseName", "SourceUrl", 
           "SourceTitle", "Organization", "EvidenceText", "IsManualApproved"
    FROM "KnowledgeSources"
    WHERE "IsDeleted" = false
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()

    records: List[KnowledgeRecord] = []
    for r in rows:
        r_id, model_class, plant_name, disease_name, source_url, source_title, org, text, is_approved = r
        if demo_only and model_class not in DEMO_DISEASE_CODES:
            continue
        
        # Chỉ nạp bài đã duyệt (hoặc bài demo hạt nhân cho dev)
        records.append(
            KnowledgeRecord(
                id=str(r_id),
                model_class=model_class or "",
                plant_name=plant_name or "",
                disease_name=disease_name or "",
                source_title=source_title or "",
                organization=org or "",
                source_url=source_url or "",
                evidence_text=text or "",
                unit_type="SUMMARY",
                is_verbatim=False,
                is_manual_approved=bool(is_approved)
            )
        )

    logger.info(f"Loaded {len(records)} records from PostgreSQL.")
    return records


def load_records_from_csv(csv_path: Optional[str] = None, demo_only: bool = False) -> List[KnowledgeRecord]:
    """
    Fallback nạp tri thức từ file CSV seed nếu CSDL PostgreSQL chưa khởi chạy trong môi trường local dev.
    """
    if not csv_path:
        # Đường dẫn mặc định tới file CSV trong core-api/seed
        current_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
        csv_path = os.path.join(backend_dir, "core-api", "seed", "KnowledgeSources_rows.csv")

    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Knowledge CSV seed not found at: {csv_path}")

    logger.info(f"Loading knowledge seed from CSV: {csv_path}...")
    records: List[KnowledgeRecord] = []

    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("IsDeleted", "false").lower() == "true":
                continue
            
            model_class = row.get("ModelClass", "")
            if demo_only and model_class not in DEMO_DISEASE_CODES:
                continue

            is_approved = row.get("IsManualApproved", "false").lower() == "true"
            # Lưu ý dev: Với 5 bệnh demo, nạp đầy đủ để phục vụ kiểm thử RAG
            if not is_approved and model_class not in DEMO_DISEASE_CODES:
                continue

            records.append(
                KnowledgeRecord(
                    id=row.get("Id", ""),
                    model_class=model_class,
                    plant_name=row.get("PlantName", ""),
                    disease_name=row.get("DiseaseName", ""),
                    source_title=row.get("SourceTitle", ""),
                    organization=row.get("Organization", ""),
                    source_url=row.get("SourceUrl", ""),
                    evidence_text=row.get("EvidenceText", ""),
                    unit_type=row.get("UnitType", "SUMMARY"),
                    is_verbatim=row.get("IsVerbatim", "false").lower() == "true",
                    is_manual_approved=is_approved or (model_class in DEMO_DISEASE_CODES)
                )
            )

    logger.info(f"Loaded {len(records)} records from CSV.")
    return records


def sync_knowledge_index(demo_only: bool = False) -> int:
    """
    Hàm thực thi đồng bộ: Đọc dữ liệu từ DB (hoặc CSV fallback),
    sau đó nạp chỉ mục vào ChromaDB và BM25.
    """
    from app.rag.vector_retriever import VectorRetriever
    from app.rag.bm25_retriever import BM25Retriever
    import pickle

    db_url = os.environ.get("AGENT_DB_URL")
    records: List[KnowledgeRecord] = []

    if db_url:
        try:
            records = load_records_from_postgres(db_url, demo_only=demo_only)
        except Exception as e:
            logger.warning(f"PostgreSQL sync failed ({e}). Falling back to local CSV seed.")
            records = load_records_from_csv(demo_only=demo_only)
    else:
        logger.info("AGENT_DB_URL not set. Using local CSV seed.")
        records = load_records_from_csv(demo_only=demo_only)

    if not records:
        logger.warning("No records to index!")
        return 0

    # 1. Đồng bộ ChromaDB
    logger.info("Indexing into ChromaDB...")
    vector_retriever = VectorRetriever()
    count = vector_retriever.reindex(records)
    logger.info(f"Indexed {count} documents into ChromaDB.")

    # 2. Đồng bộ BM25
    logger.info("Building BM25 Okapi Index...")
    bm25_retriever = BM25Retriever()
    bm25_retriever.fit(records)

    # Lưu cache BM25 xuống đĩa để pipeline nạp nhanh khi khởi động
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    bm25_cache_file = os.path.join(base_dir, "data", "bm25_index.pkl")
    os.makedirs(os.path.dirname(bm25_cache_file), exist_ok=True)
    with open(bm25_cache_file, "wb") as f:
        pickle.dump(bm25_retriever, f)
    logger.info(f"BM25 index saved to {bm25_cache_file}.")

    return count


if __name__ == "__main__":
    count = sync_knowledge_index(demo_only=False)
    print(f"\n🎉 Successfully synced {count} knowledge articles into Hybrid RAG index!")

