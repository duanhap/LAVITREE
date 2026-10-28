import io
import sys
from PIL import Image
from fastapi.testclient import TestClient

if sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from app.main import app

client = TestClient(app)

def create_sample_image(format="JPEG", size=(224, 224), color=(34, 139, 34)):
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=format)
    buf.seek(0)
    return buf.getvalue()

def test_health():
    print("[1/7] Kiểm tra GET /health...")
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["model_loaded"] is True
    print(" -> PASSED: GET /health (model_loaded=True)")

def test_predict_real_model():
    print("[2/7] Kiểm tra POST /api/v1/predict (Mô hình thật ResNet-18)...")
    img_bytes = create_sample_image()
    files = {"file": ("sample_leaf.jpg", img_bytes, "image/jpeg")}
    res = client.post("/api/v1/predict", files=files)
    assert res.status_code == 200
    data = res.json()

    assert data["success"] is True
    assert data["is_ood"] is False
    assert "top1" in data and data["top1"] is not None
    assert "class_code" in data["top1"]
    assert "plant_name" in data["top1"]
    assert "disease_name" in data["top1"]
    assert "confidence" in data["top1"]
    assert "confusion_group" in data["top1"]

    assert "top3" in data and len(data["top3"]) == 3
    assert data["gradcam_base64"].startswith("data:image/jpeg;base64,")
    assert "inference_time_ms" in data and data["inference_time_ms"] > 0
    assert "tier" not in data
    assert "predicted_class" not in data

    print(f" -> PASSED: Dự đoán thực tế thành công: Top-1='{data['top1']['plant_name']} - {data['top1']['disease_name']}' ({data['top1']['class_code']})")
    print(f"    Confidence: {data['top1']['confidence']:.4f}, Latency: {data['inference_time_ms']}ms")

def test_predict_without_heatmap():
    print("[3/7] Kiểm tra POST /api/v1/predict?include_heatmap=false...")
    img_bytes = create_sample_image()
    files = {"file": ("sample_leaf.jpg", img_bytes, "image/jpeg")}
    res = client.post("/api/v1/predict?include_heatmap=false", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["gradcam_base64"] is None
    print(" -> PASSED: include_heatmap=false -> gradcam_base64 is None")

def test_predict_mock_ood():
    print("[4/7] Kiểm tra POST /api/v1/predict?mock_ood=true...")
    img_bytes = create_sample_image()
    files = {"file": ("test.jpg", img_bytes, "image/jpeg")}
    res = client.post("/api/v1/predict?mock_ood=true", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["is_ood"] is True
    assert data["top1"] is None
    assert data["top3"] == []
    assert data["gradcam_base64"] is None
    print(" -> PASSED: mock_ood=true trả về cấu trúc OOD chuẩn 100%")

def test_invalid_mimetype():
    print("[5/7] Kiểm tra chặn MIME type không hợp lệ -> HTTP 400...")
    files = {"file": ("test.txt", b"plain text content", "text/plain")}
    res = client.post("/api/v1/predict", files=files)
    assert res.status_code == 400
    assert "định dạng không hỗ trợ" in res.json()["detail"]
    print(" -> PASSED: HTTP 400 cho MIME type không hợp lệ")

def test_oversized_file():
    print("[6/7] Kiểm tra chặn tệp > 10MB -> HTTP 400...")
    huge_bytes = b"0" * (10 * 1024 * 1024 + 1)
    files = {"file": ("huge.jpg", huge_bytes, "image/jpeg")}
    res = client.post("/api/v1/predict", files=files)
    assert res.status_code == 400
    assert "vượt quá 10MB" in res.json()["detail"]
    print(" -> PASSED: HTTP 400 cho tệp vượt quá 10MB")

def test_corrupted_image():
    print("[7/7] Kiểm tra chặn ảnh hỏng byte -> HTTP 422...")
    corrupt_bytes = b"\xFF\xD8\xFFnot-a-valid-jpeg-image-bytes"
    files = {"file": ("corrupt.jpg", corrupt_bytes, "image/jpeg")}
    res = client.post("/api/v1/predict", files=files)
    assert res.status_code == 422
    assert "lỗi cấu trúc hoặc không thể giải mã" in res.json()["detail"]
    print(" -> PASSED: HTTP 422 cho ảnh hỏng cấu trúc (verify fail)")

if __name__ == "__main__":
    print("=== BẮT ĐẦU KIỂM THỬ PHA 4: ENDPOINT CHUẨN HÓA & BẢO MẬT ===")
    test_health()
    test_predict_real_model()
    test_predict_without_heatmap()
    test_predict_mock_ood()
    test_invalid_mimetype()
    test_oversized_file()
    test_corrupted_image()
    print("=== TẤT CẢ 7/7 BÀI TEST PHA 4 ĐỀU THÀNH CÔNG (100% PASS)! ===")
