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
    TUÂN THỦ 100% QUY TẮC HITL: Chỉ nạp các bài đã được Kỹ sư/Admin duyệt (IsManualApproved = true).
    """
    import psycopg2
    logger.info("Connecting to PostgreSQL (Read-Only) via AGENT_DB_URL...")
    conn = psycopg2.connect(db_url, connect_timeout=5)
    try:
        conn.set_session(readonly=True)
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT "Id", "ModelClass", "PlantName", "DiseaseName", "SourceUrl",
                       "SourceTitle", "Organization", "EvidenceText", "IsManualApproved",
                       "UnitType", "IsVerbatim"
                FROM "KnowledgeSources"
                WHERE "IsDeleted" = false AND "IsManualApproved" = true
            """)
            rows = cursor.fetchall()
    finally:
        conn.close()

    records: List[KnowledgeRecord] = []
    for r in rows:
        r_id, model_class, plant_name, disease_name, source_url, source_title, org, text, is_approved, unit_type, is_verbatim = r
        if demo_only and model_class not in DEMO_DISEASE_CODES:
            continue
        
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
                unit_type=unit_type or "SUMMARY",
                is_verbatim=bool(is_verbatim),
                is_manual_approved=bool(is_approved)
            )
        )

    logger.info(f"Loaded {len(records)} approved records from PostgreSQL.")
    return records


def load_records_from_csv(csv_path: Optional[str] = None, demo_only: bool = False) -> List[KnowledgeRecord]:
    """
    Nạp tri thức từ file CSV seed khi ở môi trường dev có RAG_ALLOW_CSV_FALLBACK=1.
    TUÂN THỦ NGUYÊN TẮC HITL: Tuyệt đối không nạp bài chưa duyệt (IsManualApproved = false).
    """
    if not csv_path:
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
            
            # Kiểm tra trạng thái duyệt - Bắt buộc IsManualApproved = true
            is_approved = row.get("IsManualApproved", "false").lower() == "true"
            if not is_approved:
                continue

            model_class = row.get("ModelClass", "")
            if demo_only and model_class not in DEMO_DISEASE_CODES:
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
                    is_manual_approved=True
                )
            )

    logger.info(f"Loaded {len(records)} approved records from CSV.")
    return records


def sync_knowledge_index(demo_only: bool = False) -> int:
    """
    Hàm thực thi đồng bộ: Đọc dữ liệu từ DB (hoặc CSV nếu bật RAG_ALLOW_CSV_FALLBACK=1).
    Nếu lỗi DB và không cho phép fallback, ném ngoại lệ để API trả 503 và BẢO TOÀN chỉ mục hiện tại.
    """
    from app.rag.pipeline import get_rag_pipeline

    db_url = os.environ.get("AGENT_DB_URL")
    allow_csv_fallback = os.environ.get("RAG_ALLOW_CSV_FALLBACK", "0").lower() in ("1", "true", "yes")

    records: List[KnowledgeRecord] = []

    if db_url:
        try:
            records = load_records_from_postgres(db_url, demo_only=demo_only)
        except Exception as e:
            logger.error(f"PostgreSQL connection failed: {e}")
            if allow_csv_fallback:
                logger.warning("RAG_ALLOW_CSV_FALLBACK=1: Falling back to local CSV seed.")
                records = load_records_from_csv(demo_only=demo_only)
            else:
                logger.error("RAG_ALLOW_CSV_FALLBACK is disabled. Aborting sync to keep existing index intact.")
                raise ConnectionError(f"Database sync failed and fallback is disabled: {e}")
    else:
        if allow_csv_fallback:
            logger.info("AGENT_DB_URL not set but RAG_ALLOW_CSV_FALLBACK=1: Loading CSV seed.")
            records = load_records_from_csv(demo_only=demo_only)
        else:
            raise ValueError("AGENT_DB_URL is not set and RAG_ALLOW_CSV_FALLBACK is disabled. Cannot reindex.")

    pipeline = get_rag_pipeline()
    return pipeline.reindex(records)


if __name__ == "__main__":
    count = sync_knowledge_index(demo_only=False)
    print(f"[OK] Successfully synchronized and indexed {count} approved documents.")
