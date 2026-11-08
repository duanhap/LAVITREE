import argparse
import csv
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

CURRENT_DIR = Path(__file__).resolve().parent
AGENT_DIR = CURRENT_DIR.parent
OUTPUT_CACHE_PATH = AGENT_DIR / "app" / "agent" / "offline_ipm_cache.json"

# Tìm đường dẫn file CSV seed thật của Core API
WORKSPACE_ROOT = AGENT_DIR.parent.parent
SEED_CSV_PATH = WORKSPACE_ROOT / "backend" / "core-api" / "seed" / "KnowledgeSources_rows.csv"
ENV_PATH = WORKSPACE_ROOT / ".env"

DEMO_DISEASES = [
    "Tomato___Late_blight",
    "Tomato___Early_blight",
    "Tomato___Target_Spot",
    "Pepper,_bell___Bacterial_spot",
    "Corn_(maize)___Common_rust_"
]

# Bản sao của LavitreeDbContextSeeder.cs, chỉ dùng khi chạy --from-seed (không có kết nối PostgreSQL)
PRODUCTS_SEED = {
    1: {
        "product_name": "Ridomil Gold 68WG",
        "active_ingredient": "Metalaxyl-M 40g/kg + Mancozeb 640g/kg",
        "medicine_type": "Hóa học",
        "price": 65000,
        "dosage": "Pha 50g cho bình 16L nước, phun ướt đều mặt lá khi bệnh chớm xuất hiện",
        "phi_days": 7,
        "is_allowed": True,
        "rain_resistant": True,
        "target_diseases": ["Tomato___Late_blight", "Potato___Late_blight"]
    },
    2: {
        "product_name": "Antracol 70WP",
        "active_ingredient": "Propineb 700g/kg + Kẽm (Zn++)",
        "medicine_type": "Hóa học",
        "price": 45000,
        "dosage": "Pha 40-50g cho bình 16L nước, phun phòng trừ mốc sương và thán thư",
        "phi_days": 7,
        "is_allowed": True,
        "rain_resistant": False,
        "target_diseases": ["Tomato___Late_blight", "Tomato___Early_blight", "Pepper,_bell___Bacterial_spot"]
    },
    3: {
        "product_name": "Chế phẩm sinh học Trichoderma Bacillus",
        "active_ingredient": "Trichoderma spp. (10^9 CFU/g) + Bacillus subtilis",
        "medicine_type": "Sinh học",
        "price": 55000,
        "dosage": "Pha 30g cho bình 16L nước hoặc tưới gốc đối kháng nấm bệnh",
        "phi_days": 0,
        "is_allowed": True,
        "rain_resistant": True,
        "target_diseases": ["Tomato___Late_blight", "Tomato___Early_blight", "Tomato___Target_Spot"]
    },
    4: {
        "product_name": "Thuốc trừ nấm Score 250EC",
        "active_ingredient": "Difenoconazole 250g/L",
        "medicine_type": "Hóa học",
        "price": 85000,
        "dosage": "Pha 10ml cho bình 16L nước, phun khi vết đốm vừa xuất hiện",
        "phi_days": 14,
        "is_allowed": True,
        "rain_resistant": True,
        "target_diseases": ["Tomato___Early_blight", "Corn_(maize)___Common_rust_"]
    }
}

DISEASE_METADATA = {
    "Tomato___Late_blight": {
        "plant_name": "Cà chua",
        "disease_name_vi": "Bệnh mốc sương / sương mai cà chua",
        "pathogen": "Nấm Phytophthora infestans",
        "cultural_measures": [
            "Cắt tỉa toàn bộ lá gốc, cành sát đất và chùm quả bị nhiễm bệnh gom vào túi đem tiêu hủy.",
            "Tạo rãnh thoát nước sâu giữa các luống, tránh ngập úng gốc khi trời mưa ẩm kéo dài.",
            "Tuyệt đối không tưới phun mưa lên tán lá vào chiều tối để giảm thời gian ẩm ướt bề mặt lá."
        ]
    },
    "Tomato___Early_blight": {
        "plant_name": "Cà chua",
        "disease_name_vi": "Bệnh đốm vòng / cháy lá sớm cà chua",
        "pathogen": "Nấm Alternaria solani",
        "cultural_measures": [
            "Vệ sinh đồng ruộng, ngắt bỏ toàn bộ lá già nhiễm đốm vòng dưới gốc và chôn hủy xa vườn.",
            "Tăng cường bón phân hữu cơ hoai mục, cân đối NPK, tránh bón thừa đạm gây vóng cây.",
            "Luân canh với cây trồng khác họ cà (như ngô, lúa, hành tỏi) ít nhất 2 vụ."
        ]
    },
    "Tomato___Target_Spot": {
        "plant_name": "Cà chua",
        "disease_name_vi": "Bệnh đốm mục tiêu cà chua",
        "pathogen": "Nấm Corynespora cassiicola",
        "cultural_measures": [
            "Tỉa cành thông thoáng, giữ mật độ trồng vừa phải để ánh nắng xuyên đều vào tán cây.",
            "Thu dọn và tiêu hủy triệt để tàn dư cây trồng sau mỗi vụ thu hoạch."
        ]
    },
    "Pepper,_bell___Bacterial_spot": {
        "plant_name": "Ớt chuông",
        "disease_name_vi": "Bệnh đốm vi khuẩn trên ớt chuông",
        "pathogen": "Vi khuẩn Xanthomonas campestris pv. vesicatoria",
        "cultural_measures": [
            "Không làm việc hoặc tỉa cành khi tán lá ớt còn ướt sương để tránh vi khuẩn phát tán.",
            "Xử lý hạt giống bằng nước ấm 50 độ C trong 25 phút trước khi gieo trồng."
        ]
    },
    "Corn_(maize)___Common_rust_": {
        "plant_name": "Ngô (Bắp)",
        "disease_name_vi": "Bệnh gỉ sắt ngô / bắp",
        "pathogen": "Nấm Puccinia sorghi",
        "cultural_measures": [
            "Sử dụng giống ngô lai kháng hoặc chống chịu tốt với bệnh gỉ sắt.",
            "Gieo trồng đúng khung thời vụ để tránh giai đoạn cây con trùng với thời tiết sương mù ẩm kéo dài.",
            "Bón phân cân đối đạm, lân, kali; tránh bón đạm muộn làm lá xanh tốt quá mức."
        ]
    }
}


def load_approved_sources_from_seed(csv_path: Path) -> Dict[str, List[Dict[str, Any]]]:
    """Đọc trực tiếp từ CSDL Seed KnowledgeSources_rows.csv, lấy các bài đã duyệt."""
    if not csv_path.exists():
        raise FileNotFoundError(f"Knowledge sources CSV not found at: {csv_path}")

    sources_by_class: Dict[str, List[Dict[str, Any]]] = {}

    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            model_class = row.get("ModelClass", "").strip()
            is_approved = str(row.get("IsManualApproved", "")).strip().lower() == "true"
            is_deleted = str(row.get("IsDeleted", "")).strip().lower() == "true"

            if model_class in DEMO_DISEASES and is_approved and not is_deleted:
                source_id = row.get("Id", "")
                title = row.get("SourceTitle", "")
                org = row.get("Organization", "Cục Trồng trọt & BVTV")
                url = row.get("SourceUrl", "")
                evidence = row.get("EvidenceText", "")

                excerpt = evidence[:220] + ("..." if len(evidence) > 220 else "")

                sources_by_class.setdefault(model_class, []).append({
                    "source_id": source_id,
                    "source_title": title,
                    "organization": org,
                    "source_url": url,
                    # Cùng mặc định với app/rag/sync_index.py: chưa có đánh dấu nguyên văn thì không nhận là nguyên văn
                    "unit_type": row.get("UnitType") or "SUMMARY",
                    "is_verbatim": str(row.get("IsVerbatim", "")).strip().lower() == "true",
                    "excerpt": excerpt,
                    "full_text": evidence
                })

    return sources_by_class


def _load_db_url() -> Optional[str]:
    url = os.environ.get("AGENT_DB_URL")
    if url or not ENV_PATH.exists():
        return url
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        if line.startswith("AGENT_DB_URL="):
            return line.split("=", 1)[1].strip().strip('"')
    return None


def load_catalog_from_db(db_url: str) -> Tuple[Dict[str, List[Dict[str, Any]]], Dict[int, Dict[str, Any]]]:
    """Đọc tri thức đã duyệt và thuốc được phép của 5 bệnh demo từ PostgreSQL (chỉ đọc)."""
    import psycopg2

    conn = psycopg2.connect(db_url, connect_timeout=5)
    try:
        conn.set_session(readonly=True)
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'KnowledgeSources'
                  AND column_name IN ('UnitType', 'IsVerbatim')
            """)
            cols = {row[0] for row in cursor.fetchall()}
            unit_type_expr = '"UnitType"' if "UnitType" in cols else "'SUMMARY'"
            is_verbatim_expr = '"IsVerbatim"' if "IsVerbatim" in cols else "false"
            cursor.execute(f"""
                SELECT "Id", "ModelClass", "SourceTitle", "Organization", "SourceUrl", "EvidenceText",
                       {unit_type_expr}, {is_verbatim_expr}
                FROM "KnowledgeSources"
                WHERE "IsDeleted" = false AND "IsManualApproved" = true AND "ModelClass" = ANY(%s)
                ORDER BY "ModelClass", "Id"
            """, (DEMO_DISEASES,))
            sources: Dict[str, List[Dict[str, Any]]] = {}
            for source_id, model_class, title, org, url, evidence, unit_type, is_verbatim in cursor.fetchall():
                evidence = evidence or ""
                sources.setdefault(model_class, []).append({
                    "source_id": str(source_id),
                    "source_title": title or "",
                    "organization": org or "",
                    "source_url": url or "",
                    "unit_type": unit_type or "SUMMARY",
                    "is_verbatim": bool(is_verbatim),
                    "excerpt": evidence[:220] + ("..." if len(evidence) > 220 else ""),
                    "full_text": evidence
                })

            cursor.execute("""
                SELECT p."Id", p."Name", p."ActiveIngredient", p."MedicineType", p."DosageInstruction",
                       p."PhiDays", p."IsAllowed", d."ClassCode"
                FROM "Products" p
                JOIN "DiseaseProducts" dp ON dp."ProductId" = p."Id"
                JOIN "Diseases" d ON d."Id" = dp."DiseaseId"
                WHERE p."IsAllowed" = true AND d."ClassCode" = ANY(%s)
                ORDER BY p."Id"
            """, (DEMO_DISEASES,))
            products: Dict[int, Dict[str, Any]] = {}
            for product_id, name, ingredient, medicine_type, dosage, phi_days, is_allowed, class_code in cursor.fetchall():
                product = products.setdefault(product_id, {
                    "product_name": name,
                    "active_ingredient": ingredient,
                    "medicine_type": medicine_type,
                    "dosage": dosage,
                    "phi_days": phi_days,
                    "is_allowed": is_allowed,
                    "target_diseases": []
                })
                product["target_diseases"].append(class_code)
    finally:
        conn.close()
    return sources, products


def build_offline_cache(from_seed: bool = False) -> Dict[str, Any]:
    if from_seed:
        approved_sources, products = load_approved_sources_from_seed(SEED_CSV_PATH), PRODUCTS_SEED
    else:
        db_url = _load_db_url()
        if not db_url:
            raise RuntimeError("AGENT_DB_URL is not configured. Use --from-seed to export from the seed files.")
        approved_sources, products = load_catalog_from_db(db_url)
    cache_data: Dict[str, Any] = {}

    for d_code in DEMO_DISEASES:
        meta = DISEASE_METADATA.get(d_code, {})
        citations = approved_sources.get(d_code, [])

        bio_meds = []
        chem_meds = []

        for prod in products.values():
            if d_code in prod["target_diseases"]:
                if "sinh học" in prod["product_name"].lower() and prod["medicine_type"].lower() != "sinh học":
                    print(f"[WARN] {prod['product_name']}: tên là chế phẩm sinh học nhưng CSDL ghi {prod['medicine_type']}, PHI={prod['phi_days']}. Bị xử lý như thuốc hóa học.")
                med_item = {
                    "product_name": prod["product_name"],
                    "active_ingredient": prod["active_ingredient"],
                    "medicine_type": prod["medicine_type"],
                    "dosage": prod["dosage"],
                    "phi_days": prod["phi_days"],
                    "is_allowed": prod["is_allowed"]
                }
                if prod["medicine_type"].lower() == "sinh học" and prod["phi_days"] == 0:
                    bio_meds.append(med_item)
                else:
                    chem_meds.append(med_item)

        cache_data[d_code] = {
            "disease_code": d_code,
            "disease_name_vi": meta.get("disease_name_vi", d_code),
            "plant_name": meta.get("plant_name", ""),
            "pathogen": meta.get("pathogen", ""),
            "cultural_measures": meta.get("cultural_measures", []),
            "biological_measures": bio_meds,
            "chemical_measures": chem_meds,
            "citations": citations
        }

    return cache_data


def export_offline_cache(output_path: Path = OUTPUT_CACHE_PATH, from_seed: bool = False) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cache = build_offline_cache(from_seed)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

    print(f"[OK] Exported offline IPM cache from {'seed files' if from_seed else 'PostgreSQL'}: {output_path}")
    for k, v in cache.items():
        print(f"     - {k}: {len(v['citations'])} citations, {len(v['biological_measures'])} bio meds, {len(v['chemical_measures'])} chem meds")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Xuất offline_ipm_cache.json cho 5 bệnh demo.")
    parser.add_argument("--from-seed", action="store_true", help="Đọc từ seed trong repo thay vì PostgreSQL.")
    export_offline_cache(from_seed=parser.parse_args().from_seed)
