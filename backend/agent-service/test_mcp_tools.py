"""
Bộ kiểm thử nghiệm thu TASK-05: 4 công cụ MCP của Agent Service (FastAPI:8001).
SSOT: tasks/sprint-02/task-05-setup-agent-mcp-service.md & docs/architecture/api-contracts.md

Chạy thường:   python test_mcp_tools.py
  Core được giả lập ở tầng HTTP (httpx.MockTransport), nên code xử lý lỗi thật vẫn được chạy.
  Chế độ này KHÔNG chứng minh dữ liệu thật.
Chạy với Core thật (bằng chứng nghiệm thu):
  MCP_E2E_CORE_URL=http://localhost:5000 python test_mcp_tools.py
"""

import ast
import os
import shutil
import sys
import tempfile
import time
from contextlib import contextmanager
from unittest.mock import patch

# Đảm bảo console Windows in tiếng Việt UTF-8 không bị lỗi cp1252
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

# Thiết lập môi trường kiểm thử cách ly
TEST_DATA_DIR = tempfile.mkdtemp(prefix="lavitree_mcp_test_")
TEST_SECRET = "test_internal_secret_key_32chars_ok"
E2E_CORE_URL = os.environ.get("MCP_E2E_CORE_URL")
os.environ["RAG_DATA_DIR"] = TEST_DATA_DIR
os.environ["INTERNAL_API_SECRET"] = TEST_SECRET
os.environ["RAG_ALLOW_CSV_FALLBACK"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ.pop("AGENT_DB_URL", None)

import httpx
from fastapi.testclient import TestClient
from app.main import app, reindex_coordinator
from app.mcp.client import CoreApiClient
from app.mcp.server import mcp_server
from app.mcp import tools

AUTH = {"X-Internal-Key": TEST_SECRET}

WEATHER_OK = {
    "location": "Hà Nam",
    "temperature_c": 28.5,
    "humidity_percent": 92,
    "rainfall_probability_percent": 85,
    "rainfall_mm": 20.0,
    "is_rain": True,
    "risk_level": "HIGH",
    "recommendation": "Thời tiết mưa ẩm, nguy cơ rửa trôi rất cao.",
    "forecast_hours": 24,
    "is_simulated": False,
    "cached_at": "2026-11-07T14:00:00Z"
}


def medicine(**overrides):
    item = {
        "id": 1,
        "name": "Ridomil Gold 68WG",
        "active_ingredient": "Metalaxyl-M + Mancozeb",
        "medicine_type": "Hóa học",
        "price": 65000,
        "dosage_instruction": "Pha 50g cho bình 16L nước",
        "phi_days": 7,
        "is_allowed": True,
        "rain_resistant": True,
        "stock_quantity": 100,
        "image_url": "/products/ridomil.png",
        "target_diseases": ["Tomato___Late_blight"]
    }
    item.update(overrides)
    return item


@contextmanager
def fake_core(handler):
    """Thay Core bằng handler ở tầng HTTP. Đi qua đúng đường httpx thật, kể cả ngoại lệ mạng."""
    with patch("app.mcp.client._shared_client", httpx.Client(transport=httpx.MockTransport(handler))):
        yield


def respond(status_code=200, **kwargs):
    return lambda request: httpx.Response(status_code, **kwargs)


def network_down(request):
    raise httpx.ConnectError("connection refused", request=request)


def timed_out(request):
    raise httpx.ReadTimeout("timed out", request=request)


def must_raise_connection_error(call, label):
    try:
        result = call()
    except ConnectionError:
        return
    raise AssertionError(f"{label}: phải ném ConnectionError, thực tế trả về {result}")


def _ok(msg: str):
    print(f"[OK] {msg}", flush=True)


def test_01_health_and_service_spec(client: TestClient):
    print("\n--- 1. GET /health ---", flush=True)
    resp = client.get("/health")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data["service"] == "agent-service"
    assert data["port"] == 8001
    assert data["status"] == "ok"
    assert data["index_ready"] is True
    _ok(f"service={data['service']}, port={data['port']}, status={data['status']}")


def test_02_internal_auth_and_tool_schema(client: TestClient):
    print("\n--- 2. X-INTERNAL-KEY & DANH MỤC TOOL ---", flush=True)
    assert client.get("/api/v1/mcp/tools").status_code == 401
    assert client.get("/api/v1/mcp/tools", headers={"X-Internal-Key": "sai-khoa"}).status_code == 401
    denied = client.post(
        "/api/v1/mcp/tools/verify_phi_safety",
        json={"arguments": {"harvest_days_left": 3, "phi_days": 14}}
    )
    assert denied.status_code == 401
    _ok("Thiếu hoặc sai khoá: GET và POST đều trả 401.")

    resp = client.get("/api/v1/mcp/tools", headers=AUTH)
    assert resp.status_code == 200
    tool_list = resp.json()["tools"]
    assert {t["name"] for t in tool_list} == {
        "lookup_disease_knowledge",
        "check_weather_risk",
        "query_pesticide_store",
        "verify_phi_safety"
    }
    pesticide = next(t for t in tool_list if t["name"] == "query_pesticide_store")
    assert "allowed_only" not in pesticide["inputSchema"]["properties"]
    _ok("Đúng 4 tool; query_pesticide_store không cho LLM tắt bộ lọc thuốc cấm.")


def test_03_lookup_disease_knowledge():
    print("\n--- 3. lookup_disease_knowledge (HYBRID RAG) ---", flush=True)
    res = tools.lookup_disease_knowledge(
        disease_code="Tomato___Late_blight",
        query_focus="biện pháp sinh học và liều lượng phòng trừ mốc sương",
        top_k=3
    )
    assert res["disease_code"] == "Tomato___Late_blight"
    assert "Mốc sương" in res["disease_name"]
    assert res["total_found"] > 0
    for c in res["citations"]:
        assert c["source_id"] and c["source_title"] and c["source_url"]
        assert len(c["excerpt"]) <= 223
        assert c["excerpt"].rstrip(".") in c["full_text"]
        assert c["unit_type"] in {"SYMPTOMS", "CAUSE_CONDITIONS", "PREVENTION", "TREATMENT", "SUMMARY"}
        assert isinstance(c["is_verbatim"], bool)
    longest = max(len(c["full_text"]) for c in res["citations"])
    assert longest > 223, "Dữ liệu seed dài hơn 220 ký tự: full_text phải giữ nguyên toàn văn"
    _ok(f"AI nhận toàn văn ({longest} ký tự), giao diện nhận excerpt rút gọn.")

    empty = tools.lookup_disease_knowledge(disease_code="Unknown___Nonexistent_Disease")
    assert empty["total_found"] == 0 and empty["citations"] == []
    _ok("Bệnh chưa có bài duyệt: trả rỗng, không trích dẫn nhầm bệnh khác.")


def test_04_check_weather_risk():
    print("\n--- 4. check_weather_risk ---", flush=True)
    seen = {}

    def ok(request):
        seen["url"] = request.url
        seen["key"] = request.headers.get("X-Internal-Key")
        return httpx.Response(200, json=WEATHER_OK)

    with fake_core(ok):
        res = tools.check_weather_risk(location="Hà Nam", forecast_hours=24)
    assert seen["url"].params["forecastHours"] == "24", "Tên tham số phải khớp [FromQuery] forecastHours của Core"
    assert "forecast_hours" not in seen["url"].params
    assert seen["key"] == TEST_SECRET, "Agent phải gửi X-Internal-Key để không bị tính chung rate limit"
    assert res["risk_level"] == "HIGH" and res["forecast_hours"] == 24 and res["is_simulated"] is False
    _ok("Gửi đúng tham số forecastHours cho Core và trả nguyên kết quả.")

    with fake_core(respond(200, json={**WEATHER_OK, "is_simulated": True})):
        assert tools.check_weather_risk("Hà Nam")["is_simulated"] is True
    _ok("Giữ nguyên cờ is_simulated từ Core (chỉ có khi bật giả lập ở môi trường dev).")

    for key in ("is_rain", "risk_level", "rainfall_mm", "is_simulated"):
        partial = {k: v for k, v in WEATHER_OK.items() if k != key}
        with fake_core(respond(200, json=partial)):
            must_raise_connection_error(lambda: tools.check_weather_risk("Hà Nam"), f"thiếu {key}")
    _ok("Core thiếu trường an toàn: báo lỗi, không tự điền 'không mưa' hay 'rủi ro thấp'.")

    failures = {
        "HTTP 503": respond(503, json={"message": "x"}),
        "HTTP 429": respond(429),
        "HTTP 500": respond(500, text="stack trace"),
        "mất kết nối": network_down,
        "quá thời gian": timed_out,
        "JSON hỏng": respond(200, text="<html>"),
        "JSON không phải object": respond(200, json=[1, 2]),
    }
    for label, handler in failures.items():
        with fake_core(handler):
            must_raise_connection_error(lambda: tools.check_weather_risk("Đà Lạt"), label)
    _ok(f"{len(failures)} kiểu lỗi của Core đều báo ConnectionError, không có thời tiết giả.")

    calls = {"n": 0}

    def count(request):
        calls["n"] += 1
        return httpx.Response(200, json=WEATHER_OK)

    with fake_core(count):
        tools.check_weather_risk("Hà Nam")
        tools.check_weather_risk("Hà Nam")
    assert calls["n"] == 2
    _ok("Agent không lưu cache trùng với Core: Core phục hồi là có dữ liệu mới ngay.")


def test_05_query_pesticide_store():
    print("\n--- 5. query_pesticide_store ---", flush=True)
    seen = {}
    catalog = {
        "total": 3,
        "disease_code": "Tomato___Late_blight",
        "is_fallback": False,
        "items": [
            medicine(),
            medicine(id=3, name="Trichoderma Bacillus", medicine_type="Sinh học", phi_days=0),
            medicine(id=5, name="Paraquat", phi_days=999, is_allowed=False, stock_quantity=0)
        ]
    }

    def ok(request):
        seen["url"] = request.url
        return httpx.Response(200, json=catalog)

    with fake_core(ok):
        res = tools.query_pesticide_store(disease_code="Tomato___Late_blight")
    assert seen["url"].params["allowedOnly"] == "true"
    assert res["total"] == 2 and all(m["is_allowed"] for m in res["items"])
    assert not any(m["name"] == "Paraquat" for m in res["items"])
    assert res["is_fallback"] is False
    _ok("Luôn gửi allowedOnly=true; Core trả nhầm thuốc cấm thì client vẫn loại.")

    try:
        tools.query_pesticide_store(disease_code="Tomato___Late_blight", allowed_only=False)
        raise AssertionError("allowed_only phải bị từ chối")
    except TypeError:
        pass
    _ok("Không có đường nào để lấy thuốc cấm qua tool.")

    with fake_core(respond(200, json={**catalog, "is_fallback": True, "items": [medicine()]})):
        assert tools.query_pesticide_store("Tomato___Late_blight")["is_fallback"] is True
    _ok("Giữ cờ is_fallback khi Core dùng danh mục mẫu ở môi trường dev.")

    with fake_core(respond(200, json={"items": [medicine(is_allowed="false")]})):
        assert tools.query_pesticide_store("Tomato___Late_blight")["total"] == 0
    _ok("is_allowed dạng chuỗi 'false' vẫn được hiểu là không cấp phép.")

    no_phi = medicine()
    del no_phi["phi_days"]
    no_allowed = medicine()
    del no_allowed["is_allowed"]
    invalid_payloads = {
        "thiếu phi_days": {"items": [no_phi]},
        "thiếu is_allowed": {"items": [no_allowed]},
        "id là UUID": {"items": [medicine(id="11111111-2222-3333-4444-555555555551")]},
        "thiếu items": {"total": 0},
    }
    for label, body in invalid_payloads.items():
        with fake_core(respond(200, json=body)):
            must_raise_connection_error(lambda: tools.query_pesticide_store("Tomato___Late_blight"), label)
    _ok(f"{len(invalid_payloads)} dạng dữ liệu sai đều bị từ chối, không tự coi là an toàn.")

    for label, handler in {"HTTP 503": respond(503), "HTTP 429": respond(429), "mất kết nối": network_down}.items():
        with fake_core(handler):
            must_raise_connection_error(lambda: tools.query_pesticide_store("Corn_(maize)___Common_rust_"), label)
    _ok("Core lỗi: báo ConnectionError để Router ngoại tuyến TASK-07 xử lý, không có danh mục giả.")


def test_06_verify_phi_safety():
    print("\n--- 6. verify_phi_safety ---", flush=True)
    cases = [
        (2, 7, False),   # vi phạm
        (14, 7, True),   # an toàn
        (7, 7, False),   # điểm biên: bảo thủ
        (1, 0, True),    # chế phẩm sinh học PHI 0
        (0, 0, False),   # thu hoạch ngay hôm nay
        (30, 999, False) # thuốc cấm trong seed có PHI 999
    ]
    for harvest, phi, safe in cases:
        v = tools.verify_phi_safety(harvest_days_left=harvest, phi_days=phi)
        assert v["is_safe"] is safe, (harvest, phi)
        assert v["risk_level"] == ("SAFE" if safe else "CRITICAL_VIOLATION")
        assert v["guardrail_code"] == (None if safe else "HARVEST_BEFORE_PHI_VIOLATION")
    _ok(f"{len(cases)} ca PHI đúng, gồm ca biên DaysToHarvest <= PhiDays và PHI 999.")


def test_07_http_error_contract(client: TestClient):
    print("\n--- 7. MÃ LỖI QUA HTTP ---", flush=True)
    url = "/api/v1/mcp/tools/verify_phi_safety"
    resp = client.post(url, headers=AUTH, json={"arguments": {"harvest_days_left": 3, "phi_days": 14}})
    assert resp.status_code == 200
    assert resp.json()["result"]["risk_level"] == "CRITICAL_VIOLATION" and resp.json()["is_error"] is False
    _ok("Gọi đúng: 200.")

    assert client.post("/api/v1/mcp/tools/unknown_malicious_tool", headers=AUTH, json={}).status_code == 404
    _ok("Tool không tồn tại: 404.")

    invalid = {
        "sai kiểu": {"harvest_days_left": "not_an_int", "phi_days": 7},
        "giá trị âm": {"harvest_days_left": -5, "phi_days": 7},
        "thiếu tham số": {},
    }
    for label, arguments in invalid.items():
        resp = client.post(url, headers=AUTH, json={"arguments": arguments})
        assert resp.status_code == 422, (label, resp.status_code)
        assert "pydantic" not in resp.text and "harvest_days_left" not in resp.text, label
    resp = client.post(
        "/api/v1/mcp/tools/query_pesticide_store",
        headers=AUTH,
        json={"arguments": {"disease_code": "Tomato___Late_blight", "allowed_only": False}}
    )
    assert resp.status_code == 422
    _ok("Input sai, thiếu hoặc thừa tham số: 422, không lộ chi tiết nội bộ.")

    with fake_core(network_down):
        resp = client.post(
            "/api/v1/mcp/tools/query_pesticide_store",
            headers=AUTH,
            json={"arguments": {"disease_code": "Tomato___Late_blight"}}
        )
    assert resp.status_code == 503 and "core-api" not in resp.text
    _ok("Core mất kết nối: 503, không lộ địa chỉ nội bộ.")

    def boom(disease_code: str):
        raise RuntimeError("Collection not found at /app/data/chroma password=abc")

    with patch.dict(mcp_server._handlers, {"lookup_disease_knowledge": boom}):
        resp = client.post(
            "/api/v1/mcp/tools/lookup_disease_knowledge",
            headers=AUTH,
            json={"arguments": {"disease_code": "x"}}
        )
    assert resp.status_code == 500, "Lỗi nội bộ có chữ 'not found' không được thành 404"
    assert "/app/data" not in resp.text and "password" not in resp.text
    _ok("Lỗi nội bộ: 500 với thông báo chung, không lộ đường dẫn.")


def test_08_gemini_function_declarations():
    print("\n--- 8. GEMINI FUNCTION DECLARATIONS ---", flush=True)
    from google.genai import types

    decls = mcp_server.to_gemini_declarations()
    assert len(decls) == 4
    for d in decls:
        types.FunctionDeclaration(**d)
    _ok("google-genai chấp nhận cả 4 khai báo (kiểm tra định dạng, không gọi Gemini).")


def test_09_read_only_enforcement():
    print("\n--- 9. READ-ONLY ---", flush=True)
    methods = []

    def record(request):
        methods.append(request.method)
        if request.url.path.endswith("/weather"):
            return httpx.Response(200, json=WEATHER_OK)
        return httpx.Response(200, json={"items": [medicine()]})

    with fake_core(record):
        tools.check_weather_risk("Hà Nam")
        tools.query_pesticide_store("Tomato___Late_blight")
    assert methods == ["GET", "GET"]
    _ok("Lần chạy thật của tool chỉ phát sinh request GET.")

    mcp_dir = os.path.join(current_dir, "app", "mcp")
    write_verbs = {"post", "put", "patch", "delete", "request", "stream"}
    db_modules = {"psycopg2", "sqlalchemy", "asyncpg"}
    for name in os.listdir(mcp_dir):
        if not name.endswith(".py"):
            continue
        with open(os.path.join(mcp_dir, name), encoding="utf-8") as f:
            tree = ast.parse(f.read())
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr in write_verbs:
                # mcp_router.post là khai báo route thực thi tool, không phải lời gọi ghi tới Core
                base = getattr(node.func.value, "id", "")
                assert base == "mcp_router", f"{name}: lời gọi ghi {base}.{node.func.attr}"
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                names = {a.name.split(".")[0] for a in node.names} | {(getattr(node, "module", "") or "").split(".")[0]}
                assert not names & db_modules, f"{name}: không được kết nối DB trực tiếp"
    _ok("Mã nguồn MCP không có lời gọi ghi và không kết nối DB trực tiếp.")


def test_10_real_core_e2e():
    print("\n--- 10. CORE API THẬT ---", flush=True)
    client = CoreApiClient(base_url=E2E_CORE_URL)

    meds = client.search_medicines("Tomato___Late_blight")
    assert meds.total > 0, "DB chưa seed thuốc cho Tomato___Late_blight"
    assert meds.is_fallback is False, "Core đang trả danh mục mẫu, không phải DB thật"
    assert all(m.is_allowed for m in meds.items)
    _ok(f"Thuốc từ DB thật: {[(m.name, m.phi_days) for m in meds.items]}")

    banned = httpx.get(
        f"{E2E_CORE_URL}/api/v1/medicines/search",
        params={"diseaseCode": "Tomato___Late_blight", "allowedOnly": "false"}
    )
    assert banned.status_code == 403, "Khách không được xem thuốc cấm"
    _ok("allowedOnly=false không có quyền Admin: 403.")

    for code in ("Tomato___Early_blight", "Corn_(maize)___Common_rust_"):
        assert client.search_medicines(code).is_fallback is False
    rain_only = client.search_medicines("Tomato___Late_blight", require_rain_resistant=True)
    assert rain_only.total > 0 and all(m.rain_resistant for m in rain_only.items)
    _ok("Lọc theo bệnh và lọc kháng mưa hoạt động trên DB thật.")

    try:
        w = client.fetch_weather("Hà Nội", forecast_hours=24)
    except ConnectionError:
        print("[CHÚ Ý] Core trả 503 cho thời tiết: chưa có OPENWEATHER_API_KEY hợp lệ. Tool báo lỗi đúng thiết kế.", flush=True)
        return "weather_unavailable"
    assert w.forecast_hours == 24, "Core phải nhận đúng forecastHours"
    if w.is_simulated:
        print("[CHÚ Ý] Thời tiết đang giả lập (ENABLE_DEV_FALLBACK hoặc Development): chưa phải dữ liệu thật.", flush=True)
        return "weather_simulated"
    _ok(f"Thời tiết thật từ OpenWeatherMap: {w.risk_level}, mưa {w.rainfall_mm}mm trong {w.forecast_hours} giờ.")
    return "weather_real"


if __name__ == "__main__":
    print("=" * 70, flush=True)
    print("BỘ KIỂM THỬ NGHIỆM THU TASK-05: 4 CÔNG CỤ MCP", flush=True)
    print("=" * 70, flush=True)

    try:
        with TestClient(app) as test_client:
            # Đợi reindex nền hoàn tất
            deadline = time.time() + 60
            while reindex_coordinator.status()["running"] and time.time() < deadline:
                time.sleep(0.5)

            test_01_health_and_service_spec(test_client)
            test_02_internal_auth_and_tool_schema(test_client)
            test_03_lookup_disease_knowledge()
            test_04_check_weather_risk()
            test_05_query_pesticide_store()
            test_06_verify_phi_safety()
            test_07_http_error_contract(test_client)
            test_08_gemini_function_declarations()
            test_09_read_only_enforcement()
            e2e = test_10_real_core_e2e() if E2E_CORE_URL else None

        print("\n" + "=" * 70, flush=True)
        if e2e is None:
            print("KẾT LUẬN: 9/9 PASS với Core giả lập. CHƯA kiểm chứng với Core thật (đặt MCP_E2E_CORE_URL).", flush=True)
        elif e2e == "weather_real":
            print("KẾT LUẬN: 10/10 PASS, gồm thuốc từ DB thật và thời tiết thật.", flush=True)
        else:
            print(f"KẾT LUẬN: 10/10 PASS, thuốc từ DB thật; thời tiết CHƯA thật ({e2e}).", flush=True)
        print("=" * 70, flush=True)
    finally:
        shutil.rmtree(TEST_DATA_DIR, ignore_errors=True)
