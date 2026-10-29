import io
import sys
import pytest
from PIL import Image
from fastapi.testclient import TestClient

if sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from app.main import app

client = TestClient(app)

def create_dummy_image(format="JPEG", size=(100, 100), color=(0, 255, 0)):
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=format)
    buf.seek(0)
    return buf.getvalue()

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["model_loaded"] is True
    print(" [PASSED] GET /health")

@pytest.mark.skip(reason="Legacy Phase 0 stub test, superseded by test_predict.py")
def test_predict_success():
    img_bytes = create_dummy_image()
    files = {"file": ("leaf.jpg", img_bytes, "image/jpeg")}
    res = client.post("/api/v1/predict", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["is_ood"] is False
    assert data["top1"]["class_code"] == "Tomato___Late_blight"
    assert data["top1"]["plant_name"] == "Cà chua"
    assert data["top1"]["disease_name"] == "Bệnh mốc sương cà chua"
    assert len(data["top3"]) == 3
    assert data["gradcam_base64"].startswith("data:image/jpeg;base64,")
    print(" [PASSED] POST /api/v1/predict (In-Distribution Leaf)")

def test_predict_without_heatmap():
    img_bytes = create_dummy_image()
    files = {"file": ("leaf.jpg", img_bytes, "image/jpeg")}
    res = client.post("/api/v1/predict?include_heatmap=false", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["gradcam_base64"] is None
    print(" [PASSED] POST /api/v1/predict?include_heatmap=false")

@pytest.mark.skip(reason="Legacy Phase 0 filename stub test, superseded by test_predict.py real OOD filter")
def test_predict_ood_simulation():
    img_bytes = create_dummy_image()
    # Test qua filename chứa 'ood'
    files = {"file": ("hand_ood_sample.jpg", img_bytes, "image/jpeg")}
    res = client.post("/api/v1/predict", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["is_ood"] is True
    assert data["top1"] is None
    assert data["top3"] == []
    assert data["gradcam_base64"] is None
    print(" [PASSED] POST /api/v1/predict (OOD Simulation via filename)")

    # Test qua param mock_ood=true
    files2 = {"file": ("desk.jpg", img_bytes, "image/jpeg")}
    res2 = client.post("/api/v1/predict?mock_ood=true", files=files2)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["is_ood"] is True
    assert data2["top1"] is None
    print(" [PASSED] POST /api/v1/predict (OOD Simulation via mock_ood=true)")

def test_invalid_mimetype():
    files = {"file": ("test.txt", b"plain text content", "text/plain")}
    res = client.post("/api/v1/predict", files=files)
    assert res.status_code == 400
    print(" [PASSED] POST /api/v1/predict (Invalid MIME type -> 400)")

def test_oversized_file():
    huge_bytes = b"0" * (10 * 1024 * 1024 + 1)
    files = {"file": ("huge.jpg", huge_bytes, "image/jpeg")}
    res = client.post("/api/v1/predict", files=files)
    assert res.status_code == 400
    print(" [PASSED] POST /api/v1/predict (File > 10MB -> 400)")

def test_corrupted_image():
    fake_jpg_bytes = b"not a real jpeg bytes content"
    files = {"file": ("corrupt.jpg", fake_jpg_bytes, "image/jpeg")}
    res = client.post("/api/v1/predict", files=files)
    assert res.status_code == 422
    print(" [PASSED] POST /api/v1/predict (Corrupt image -> 422)")

if __name__ == "__main__":
    print("--- CHẠY KIỂM THỬ PHA 0: STUB API AI VISION SERVICE ---")
    test_health()
    test_predict_success()
    test_predict_without_heatmap()
    test_predict_ood_simulation()
    test_invalid_mimetype()
    test_oversized_file()
    test_corrupted_image()
    print("--- TẤT CẢ 7 TEST CASES PHA 0 ĐỀU THÀNH CÔNG (100% PASS)! ---")
