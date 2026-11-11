"""
Bộ kiểm thử định lượng & an toàn cho Tầng tri thức Hybrid RAG (TASK-06).
Chạy trên thư mục tạm nên không đụng tới chỉ mục dev trong app/data.

Giới hạn: dữ liệu lấy từ CSV seed và Gemini được mock. Các bước phải chạy thật trên
Postgres / Gemini / Docker được liệt kê trong tasks/sprint-02/task-06-hybrid-rag-knowledge.md Mục 5.
"""

import csv
import json
import os
import shutil
import sys
import tempfile
import threading
import time
from unittest.mock import MagicMock, patch

# Đảm bảo console Windows xử lý đúng encoding UTF-8
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

# Cấu hình biến môi trường kiểm thử (trước khi import app)
TEST_DATA_DIR = tempfile.mkdtemp(prefix="lavitree_rag_test_")
TEST_SECRET = "test_internal_secret_key_32chars_ok"
os.environ["RAG_DATA_DIR"] = TEST_DATA_DIR
os.environ["INTERNAL_API_SECRET"] = TEST_SECRET
os.environ["RAG_ALLOW_CSV_FALLBACK"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ.pop("AGENT_DB_URL", None)

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import main as agent_main
from app.main import app
from app.rag import sync_index, vector_retriever
from app.rag.hybrid_fusion import HybridFusionRRF
from app.rag.pipeline import get_rag_pipeline
from app.rag.reindex_worker import ReindexCoordinator
from app.rag.schema import KnowledgeRecord, LabelParagraphsRequest, ParagraphItem
from app.rag.sync_index import load_records_from_csv, sync_knowledge_index

AUTH = {"X-Internal-Key": TEST_SECRET}
LABEL_URL = "/internal/knowledge/label-paragraphs"
LABEL_BODY = {
    "model_class": "Tomato___Late_blight",
    "paragraphs": [{"id": "P1", "text": "Mặt dưới lá có lớp mốc trắng."}, {"id": "P2", "text": "Liên hệ tòa soạn."}],
}

BENCHMARK_CASES = [
    {
        "case_id": 1,
        "disease_code": "Tomato___Late_blight",
        "disease_name": "Mốc sương cà chua",
        "queries": [
            "mặt dưới lá cà chua có lớp mốc trắng như sương mai úng nước",
            "la ca chua bi moc trang mat duoi la"
        ]
    },
    {
        "case_id": 2,
        "disease_code": "Tomato___Early_blight",
        "disease_name": "Đốm vòng cà chua",
        "queries": [
            "lá già cà chua bị đốm nâu đen có các vòng tròn đồng tâm",
            "cach chua dom vong ca chua"
        ]
    },
    {
        "case_id": 3,
        "disease_code": "Tomato___Target_Spot",
        "disease_name": "Đốm mục tiêu cà chua",
        "queries": [
            "cà chua xuất hiện vết đốm mục tiêu hình tròn màu nâu có viền vàng",
            "phòng trị bệnh đốm mục tiêu trên cây cà chua"
        ]
    },
    {
        "case_id": 4,
        "disease_code": "Pepper,_bell___Bacterial_spot",
        "disease_name": "Đốm vi khuẩn ớt",
        "queries": [
            "lá ớt chuông bị đốm mắt cua sũng nước chuyển nâu hoại tử",
            "biện pháp phòng trừ bệnh đốm vi khuẩn trên ớt"
        ]
    },
    {
        "case_id": 5,
        "disease_code": "Corn_(maize)___Common_rust_",
        "disease_name": "Gỉ sắt ngô",
        "queries": [
            "lá bắp ngô có các nốt mụn mủ màu vàng nâu như bột gỉ sắt",
            "ngô bị nấm gỉ sắt lây lan khắp ruộng xử lý thế nào"
        ]
    }
]


def _ok(message: str) -> None:
    print(f"[OK] {message}", flush=True)


def _wait_reindex_idle(timeout: float = 300.0) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        state = agent_main.reindex_coordinator.status()
        if not state["running"]:
            return state
        time.sleep(0.1)
    raise AssertionError("Reindex nền không kết thúc đúng hạn")


def _record(record_id: str, model_class: str = "Tomato___Late_blight", text: str = "mốc trắng mặt dưới lá") -> KnowledgeRecord:
    return KnowledgeRecord(id=record_id, model_class=model_class, evidence_text=text)


def _full_recall_index() -> None:
    assert sync_knowledge_index() > 0


def test_01_startup_builds_index_on_empty_container():
    print("\n--- 1. CONTAINER MOI: KHOI DONG TU DUNG CHI MUC ---", flush=True)
    assert not os.listdir(TEST_DATA_DIR), "Test phải bắt đầu với thư mục dữ liệu rỗng"
    with TestClient(app) as client:
        state = _wait_reindex_idle()
        assert state["last_error"] is None and state["indexed_documents"] > 0, state
        health = client.get("/health").json()
        assert health["index_ready"] is True and health["status"] == "ok", health
        # /chat giờ là ReAct thật (cần Gemini), nên tra chỉ mục qua đúng công cụ MCP mà Agent dùng
        from app.mcp.server import mcp_server
        lookup = mcp_server.call_tool(
            "lookup_disease_knowledge",
            {"disease_code": "Tomato___Late_blight", "query_focus": "lá bị mốc trắng"}
        )
        assert not lookup.is_error, lookup.error_message
        citations = lookup.result["citations"]
        assert citations, "Container mới phải có citation sau khi khởi động"
        assert all(c["source_id"] and "is_verbatim" in c for c in citations)
    _ok(f"Khởi động xong có {state['indexed_documents']} bài và {len(citations)} citation")


def test_02_hitl_and_db_fail_closed():
    print("\n--- 2. CHI NAP BAI DA DUYET & KHONG TU DUNG CSV KHI MAT DB ---", flush=True)
    approved = load_records_from_csv()
    assert approved and all(r.is_manual_approved for r in approved)
    seed_path = os.path.join(os.path.dirname(current_dir), "core-api", "seed", "KnowledgeSources_rows.csv")
    with open(seed_path, encoding="utf-8") as f:
        unapproved_ids = {r["Id"] for r in csv.DictReader(f) if r.get("IsManualApproved", "").lower() != "true"}
    assert unapproved_ids and not unapproved_ids & {r.id for r in approved}, "Bài chưa duyệt bị nạp vào RAG"
    _ok(f"Chỉ nạp {len(approved)} bài đã duyệt, loại {len(unapproved_ids)} bài chưa duyệt")

    pipeline = get_rag_pipeline()
    before = pipeline.vector_retriever.get_collection().count()
    with patch.dict(os.environ, {
        "RAG_ALLOW_CSV_FALLBACK": "0",
        "AGENT_DB_URL": "postgresql://invalid_user:invalid_pass@127.0.0.1:1/nonexistent_db",
    }):
        try:
            sync_knowledge_index()
            assert False, "DB lỗi phải báo ConnectionError"
        except ConnectionError:
            pass
    assert pipeline.vector_retriever.get_collection().count() == before
    _ok("DB lỗi: không dùng CSV, chỉ mục cũ giữ nguyên")


def test_03_reindex_is_atomic():
    print("\n--- 3. REINDEX: LOI GIUA CHUNG KHONG MAT HAY LECH CHI MUC ---", flush=True)
    pipeline = get_rag_pipeline()
    records = [_record("a"), _record("b")]
    pipeline.reindex(records)
    active = pipeline.vector_retriever.active_collection_name

    pipeline.reindex([_record("c")])
    assert pipeline.vector_retriever.active_collection_name != active, "Phải đổi màu Blue/Green"
    pipeline.reindex(records)

    real_embedding = pipeline.vector_retriever.embedding_fn

    class BrokenEmbedding:
        model_name = real_embedding.model_name
        dimension = real_embedding.dimension

        def __call__(self, input):
            raise RuntimeError("embedding lỗi")

    pipeline.vector_retriever.embedding_fn = BrokenEmbedding()
    try:
        pipeline.reindex([_record("x")])
        assert False, "Phải báo lỗi embedding"
    except RuntimeError:
        pass
    finally:
        pipeline.vector_retriever.embedding_fn = real_embedding
    assert pipeline.vector_retriever.get_collection().count() == 2
    assert len(pipeline.bm25_retriever.records) == 2
    _ok("Embedding lỗi: vector và BM25 vẫn giữ bản cũ")

    with patch("app.rag.pipeline.BM25Retriever.fit", side_effect=RuntimeError("bm25 lỗi")):
        try:
            pipeline.reindex([_record("y")])
            assert False, "Phải báo lỗi BM25"
        except RuntimeError:
            pass
    assert pipeline.vector_retriever.get_collection().count() == len(pipeline.bm25_retriever.records) == 2
    _ok("BM25 lỗi: hai chỉ mục không lệch nhau")


def test_04_unapprove_last_record_empties_index():
    print("\n--- 4. BO DUYET BAI CUOI CUNG PHAI GO KHOI RAG ---", flush=True)
    pipeline = get_rag_pipeline()
    pipeline.reindex([_record("only")])
    with patch.object(sync_index, "load_records_from_csv", return_value=[]):
        assert sync_knowledge_index() == 0
    assert pipeline.vector_retriever.get_collection().count() == 0
    assert pipeline.bm25_retriever.records == []
    assert pipeline.lookup_disease_knowledge("Tomato___Late_blight", "mốc trắng").top_chunks == []
    _ok("Không còn bài duyệt thì RAG không còn gì để trích dẫn")


def test_05_recall_at_3_unfiltered_and_latency():
    print("\n--- 5. RECALL@3 KHONG LOC THEO disease_code & DO TRE ---", flush=True)
    _full_recall_index()
    pipeline = get_rag_pipeline()
    pipeline.vector_retriever.search("warmup", top_k=2)

    total, hits = 0, 0
    latencies = []
    for case in BENCHMARK_CASES:
        for query in case["queries"]:
            total += 1
            started = time.perf_counter()
            chunks = HybridFusionRRF.fuse(
                pipeline.bm25_retriever.search(query, top_k=6),
                pipeline.vector_retriever.search(query, top_k=6),
                query,
                top_k=3,
            )
            latencies.append((time.perf_counter() - started) * 1000)
            hit = any(c.model_class == case["disease_code"] for c in chunks)
            hits += hit
            print(f"  {'[HIT] ' if hit else '[MISS]'} {query[:55]} -> {case['disease_name']}", flush=True)

    recall = hits / total * 100
    avg_latency = sum(latencies) / len(latencies)
    print(f"[REPORT] Recall@3 khong loc: {hits}/{total} = {recall:.1f}% (muc tieu >= 90%)", flush=True)
    print(f"[REPORT] Do tre trung binh: {avg_latency:.1f}ms (muc tieu <= 200ms)", flush=True)
    assert recall >= 90.0, f"Recall@3 ({recall:.1f}%) dưới 90%"
    assert avg_latency <= 200.0, f"Độ trễ ({avg_latency:.1f}ms) vượt 200ms"


def test_06_no_foreign_disease_citation():
    print("\n--- 6. BENH CHUA CO BAI DUYET KHONG TRICH DAN BENH KHAC ---", flush=True)
    _full_recall_index()
    chunks = get_rag_pipeline().lookup_disease_knowledge("Corn_(maize)___Northern_Leaf_Blight", "lá ngô bị cháy", 2).top_chunks
    assert chunks == [], [c.model_class for c in chunks]
    filtered = get_rag_pipeline().lookup_disease_knowledge("Tomato___Late_blight", "lá bị mốc", 4).top_chunks
    assert filtered and all(c.model_class == "Tomato___Late_blight" for c in filtered)
    _ok("Bệnh chưa có bài trả rỗng; bệnh có bài chỉ trích đúng mã bệnh")


def test_07_internal_auth():
    print("\n--- 7. BAO MAT ENDPOINT NOI BO ---", flush=True)
    client = TestClient(app, raise_server_exceptions=False)
    for method, url in (("post", "/internal/reindex"), ("get", "/internal/reindex/status"), ("post", LABEL_URL)):
        assert getattr(client, method)(url).status_code == 401, url
        assert getattr(client, method)(url, headers={"X-Internal-Key": "wrong"}).status_code == 401, url
    assert client.post(LABEL_URL, json={"x": 1}).status_code == 401, "Thiếu khoá phải 401 trước khi kiểm tra body"
    assert client.post("/internal/reindex", headers={"X-Internal-Key": "é".encode("latin-1")}).status_code == 401
    with patch.dict(os.environ):
        del os.environ["INTERNAL_API_SECRET"]
        assert client.post("/internal/reindex", headers=AUTH).status_code == 401
    assert client.post(LABEL_URL, headers=AUTH, json={"x": 1}).status_code == 422
    _ok("Thiếu/sai khoá, ký tự lạ, thiếu env đều trả 401")

    with patch.dict(os.environ, {
        "RAG_ALLOW_CSV_FALLBACK": "0",
        "AGENT_DB_URL": "postgresql://lavitree_agent:SECRETPW@127.0.0.1:1/lavitree",
    }), patch("app.rag.reindex_worker.time.sleep"):
        assert client.post("/internal/reindex", headers=AUTH, json={"action": "unapprove"}).status_code == 202
        _wait_reindex_idle()
    status_text = client.get("/internal/reindex/status", headers=AUTH).text
    assert json.loads(status_text)["last_error"] == "database_unavailable"
    assert "127.0.0.1" not in status_text and "SECRETPW" not in status_text
    _ok("Lỗi DB chỉ trả mã lỗi, không lộ host hay mật khẩu")

    long_message = {"message": "a" * 2001}
    assert client.post("/api/v1/agent/chat", json=long_message).status_code == 422
    _ok("Chat chặn message quá dài")


def _label_with_gemini_text(client: TestClient, text):
    with patch("google.genai.Client") as client_cls, patch.dict(os.environ, {"GEMINI_API_KEY": "fake_test_key"}):
        client_cls.return_value.models.generate_content.return_value = MagicMock(text=text)
        return client.post(LABEL_URL, headers=AUTH, json=LABEL_BODY)


def test_08_label_paragraphs():
    print("\n--- 8. LABEL-PARAGRAPHS: VALIDATION, GUARDRAIL, LOI GEMINI ---", flush=True)
    for build in (
        lambda: ParagraphItem(id="P1", text="A" * 2001),
        lambda: LabelParagraphsRequest(model_class="m", paragraphs=[ParagraphItem(id=f"P{i}", text="a") for i in range(201)]),
    ):
        try:
            build()
            assert False, "Input quá tải phải bị chặn"
        except ValidationError:
            pass
    _ok("Chặn đoạn > 2000 ký tự và > 200 đoạn")

    client = TestClient(app, raise_server_exceptions=False)
    injected = json.dumps([
        {"id": "P99", "unit_type": "SYMPTOMS"},
        {"id": "P1", "unit_type": "symptoms"},
        {"id": "P1", "unit_type": "TREATMENT"},
        {"id": "P2", "unit_type": "HACKED"},
        {"id": ["P1"], "unit_type": "SYMPTOMS"},
        "P2",
    ])
    response = _label_with_gemini_text(client, injected)
    assert response.status_code == 200
    assert [(l["id"], l["unit_type"]) for l in response.json()["labels"]] == [("P1", "SYMPTOMS")], response.text
    _ok("Guardrail loại P99, nhãn lạ, id trùng, phần tử sai kiểu")

    with_mentions = json.dumps({"labels": [{"id": "P1", "unit_type": "SYMPTOMS", "mentions": [
        {"text": "lớp mốc trắng", "kind": "PRACTICE"},
        {"text": "Ridomil Gold", "kind": "CHEMICAL"},
        {"text": "mốc", "kind": "HACKED"},
        "Mancozeb",
    ]}]})
    res_m = _label_with_gemini_text(client, with_mentions)
    assert res_m.status_code == 200
    assert res_m.json()["labels"][0]["mentions"] == [{"text": "lớp mốc trắng", "kind": "PRACTICE"}], res_m.text
    _ok("Mentions: chỉ giữ cụm từ có nguyên văn trong đoạn, loại sai kiểu (chống bịa), và trả về cho Core")

    valid_with_meta = json.dumps({
        "labels": [{"id": "P1", "unit_type": "SYMPTOMS"}],
        "metadata": {
            "model_class": "Tomato___Late_blight",
            "source_title": "Bài báo thử nghiệm",
            "organization": "Khuyến nông",
            "published_date": "2024"
        }
    })
    res_meta = _label_with_gemini_text(client, valid_with_meta)
    assert res_meta.status_code == 200
    assert [(l["id"], l["unit_type"]) for l in res_meta.json()["labels"]] == [("P1", "SYMPTOMS")]
    assert res_meta.json()["metadata"]["model_class"] == "Tomato___Late_blight"
    assert res_meta.json()["metadata"]["source_title"] == "Bài báo thử nghiệm"
    _ok("Trích xuất và thẩm định metadata (38 lớp, năm xuất bản, cơ quan)")

    for bad in ("khong phai json", "12345", None):
        assert _label_with_gemini_text(client, bad).status_code == 503, bad
    with patch("google.genai.Client", side_effect=RuntimeError("down")), patch.dict(os.environ, {"GEMINI_API_KEY": "fake"}):
        assert client.post(LABEL_URL, headers=AUTH, json=LABEL_BODY).status_code == 503
    with patch.dict(os.environ):
        os.environ.pop("GEMINI_API_KEY", None)
        assert client.post(LABEL_URL, headers=AUTH, json=LABEL_BODY).status_code == 503
    _ok("Gemini lỗi / sai định dạng / thiếu key đều trả 503 để Core báo Admin tự gán nhãn")

    with patch("google.genai.Client") as client_cls, patch.dict(os.environ, {"GEMINI_API_KEY": "fake", "GEMINI_MODEL": "model-from-env"}):
        client_cls.return_value.models.generate_content.return_value = MagicMock(text="[]")
        assert client.post(LABEL_URL, headers=AUTH, json=LABEL_BODY).status_code == 200
        assert client_cls.return_value.models.generate_content.call_args.kwargs["model"] == "model-from-env"
    _ok("Tên model đọc từ GEMINI_MODEL")


def test_09_reindex_coordinator_never_loses_a_request():
    print("\n--- 9. REINDEX NEN: KHONG MAT YEU CAU, TU THU LAI ---", flush=True)
    started, release, runs = threading.Event(), threading.Event(), []

    def slow_run():
        runs.append(time.time())
        started.set()
        release.wait(5)
        return len(runs)

    coordinator = ReindexCoordinator(slow_run, retry_delay_seconds=0)
    t0 = time.perf_counter()
    coordinator.request()
    assert time.perf_counter() - t0 < 0.5, "request() phải trả về ngay"
    started.wait(5)
    coordinator.request()
    coordinator.request()
    release.set()
    deadline = time.time() + 5
    while coordinator.status()["running"] and time.time() < deadline:
        time.sleep(0.01)
    assert len(runs) == 2, f"3 yêu cầu phải gộp thành đúng 2 lượt, thực tế {len(runs)}"
    _ok("Yêu cầu đến giữa lượt chạy được chạy thêm đúng 1 lượt")

    attempts = []

    def flaky_run():
        attempts.append(1)
        if len(attempts) < 3:
            raise ConnectionError("db chưa sẵn sàng")
        return 7

    coordinator = ReindexCoordinator(flaky_run, retry_delay_seconds=0)
    coordinator.request()
    deadline = time.time() + 5
    while coordinator.status()["running"] and time.time() < deadline:
        time.sleep(0.01)
    state = coordinator.status()
    assert len(attempts) == 3 and state["indexed_documents"] == 7 and state["last_error"] is None, state

    def always_down():
        raise ConnectionError("db down")

    coordinator = ReindexCoordinator(always_down, max_retries=2, retry_delay_seconds=0)
    coordinator.request()
    deadline = time.time() + 5
    while coordinator.status()["running"] and time.time() < deadline:
        time.sleep(0.01)
    assert coordinator.status()["last_error"] == "database_unavailable"
    _ok("DB chập chờn được thử lại; hết lượt thử thì báo database_unavailable")


def test_10_model_mismatch_is_detected():
    print("\n--- 10. DOI MODEL EMBEDDING KHONG LOI NGAM ---", flush=True)

    class FakeEmbedding:
        def __init__(self, name, dim):
            self.model_name, self.dimension = name, dim

        def __call__(self, input):
            return [[1.0] + [0.0] * (self.dimension - 1) for _ in input]

        def name(self):
            # Chroma 1.x đòi embedding function có name(), giống MultilingualEmbeddingFunction
            return "default"

    persist_dir = tempfile.mkdtemp(prefix="lavitree_rag_model_")
    try:
        with patch.object(vector_retriever, "MultilingualEmbeddingFunction", lambda: FakeEmbedding("model-a", 8)):
            first = vector_retriever.VectorRetriever(persist_dir=persist_dir)
            first.reindex([_record("a")])
            assert first.index_compatible and len(first.search("mốc", top_k=1)) == 1
        with patch.object(vector_retriever, "MultilingualEmbeddingFunction", lambda: FakeEmbedding("model-b", 4)):
            second = vector_retriever.VectorRetriever(persist_dir=persist_dir)
            assert second.index_compatible is False
            assert second.search("mốc", top_k=1) == []
            second.reindex([_record("a")])
            assert second.index_compatible and len(second.search("mốc", top_k=1)) == 1
    finally:
        shutil.rmtree(persist_dir, ignore_errors=True)
    _ok("Lệch model: tắt vector search thay vì lỗi; reindex xong dùng lại bình thường")


def test_11_bm25_restored_from_disk_without_pickle():
    print("\n--- 11. BM25 NAP LAI TU JSON ---", flush=True)
    pipeline = get_rag_pipeline()
    pipeline.reindex([_record("persisted")])
    assert os.path.exists(pipeline.bm25_records_file)
    pipeline.bm25_retriever = None
    pipeline._load_cached_bm25()
    assert [r.id for r in pipeline.bm25_retriever.records] == ["persisted"]
    _ok("Khởi động lại vẫn có BM25, không dùng pickle")


if __name__ == "__main__":
    print("BO KIEM THU TASK-06 HYBRID RAG", flush=True)
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for test in tests:
        test()
    print(f"\nKET LUAN: {len(tests)}/{len(tests)} BO TEST PASS", flush=True)
