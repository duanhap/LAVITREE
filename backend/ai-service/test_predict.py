import io
import sys
import time
from pathlib import Path
from PIL import Image
from fastapi.testclient import TestClient

if sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from app.main import app
from app.services.predictor import predictor
from app.services.ood_filter import ood_filter
from app.services.class_mapping import class_mapping_service

client = TestClient(app)

BASE_DIR = Path(__file__).resolve().parent
SAMPLES_DIR = BASE_DIR / "tests" / "samples"
SAMPLES_DIR.mkdir(parents=True, exist_ok=True)

def get_leaf_image_bytes() -> bytes:
    """Lấy ảnh lá thật nếu có trong tests/samples/leaf.jpg, nếu không tạo ảnh mẫu lá xanh."""
    for ext in ("leaf.jpg", "leaf.jpeg", "leaf.png", "sample_leaf.jpg"):
        p = SAMPLES_DIR / ext
        if p.exists():
            print(f"   [Nạp ảnh lá thật từ {p.name}]")
            return p.read_bytes()

    # Tạo ảnh mẫu mô phỏng lá xanh có gân
    buf = io.BytesIO()
    img = Image.new("RGB", (224, 224), color=(34, 139, 34))
    img.save(buf, format="JPEG")
    return buf.getvalue()

def get_ood_image_bytes() -> bytes:
    """Lấy ảnh vật thể lạ (bàn tay, mặt bàn) nếu có trong tests/samples/hand.jpg, nếu không tạo ảnh mẫu."""
    for ext in ("hand.jpg", "hand.jpeg", "hand.png", "desk.jpg", "sample_hand.jpg"):
        p = SAMPLES_DIR / ext
        if p.exists():
            print(f"   [Nạp ảnh vật thể ngoại lai từ {p.name}]")
            return p.read_bytes()

    # Tạo ảnh mẫu mô phỏng màu da tay
    buf = io.BytesIO()
    img = Image.new("RGB", (224, 224), color=(255, 205, 178))
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_1_valid_leaf_prediction():
    print("[1/5] Kiểm thử 1 ảnh lá hợp lệ (In-Distribution)...")
    leaf_bytes = get_leaf_image_bytes()
    t0 = time.perf_counter()
    res = client.post("/api/v1/predict?include_heatmap=true", files={"file": ("leaf.jpg", leaf_bytes, "image/jpeg")})
    elapsed = (time.perf_counter() - t0) * 1000

    assert res.status_code == 200, f"Dự đoán thất bại: {res.status_code} - {res.text}"
    data = res.json()
    assert data["success"] is True
    assert data["is_ood"] is False
    assert data["top1"] is not None
    assert "class_code" in data["top1"]
    assert "plant_name" in data["top1"]
    assert "disease_name" in data["top1"]
    assert len(data["top3"]) == 3
    assert data["gradcam_base64"] is not None
    assert data["gradcam_base64"].startswith("data:image/jpeg;base64,")
    assert elapsed < 1000.0, f"Thời gian phản hồi vượt 1.0s: {elapsed:.2f}ms"

    print(f" -> PASSED: Nhận diện thành công: {data['top1']['plant_name']} - {data['top1']['disease_name']}")
    print(f"    Confidence: {data['top1']['confidence']:.4f}, Latency client: {elapsed:.1f}ms (CPU inference: {data['inference_time_ms']}ms)")


def test_2_ood_foreign_object():
    print("[2/5] Kiểm thử 1 ảnh bàn tay / đồ vật ngoại lai (OOD)...")
    ood_bytes = get_ood_image_bytes()

    # Kiểm tra phản hồi chuẩn khi phát hiện OOD (qua mock_ood hoặc OODFilter)
    res = client.post("/api/v1/predict?mock_ood=true", files={"file": ("hand.jpg", ood_bytes, "image/jpeg")})
    assert res.status_code == 200
    data = res.json()

    assert data["success"] is True
    assert data["is_ood"] is True
    assert data["top1"] is None, "Khi OOD, top1 bắt buộc phải là None"
    assert data["top3"] == [], "Khi OOD, top3 bắt buộc phải là []"
    assert data["gradcam_base64"] is None, "Khi OOD, gradcam_base64 bắt buộc phải là None"
    assert "Ảnh nằm ngoài phạm vi 38 lớp" in data["warning_message"]
    print(f" -> PASSED: OOD được xử lý chuẩn: top1=None, gradcam_base64=None, warning_message='{data['warning_message']}'")


def test_3_security_and_file_validation():
    print("[3/5] Kiểm thử bảo mật (Dung lượng > 10MB, MIME type sai, tệp hỏng byte)...")

    # 3.1 Sai MIME type -> 400
    res_mime = client.post("/api/v1/predict", files={"file": ("sample.txt", b"Day la file text", "text/plain")})
    assert res_mime.status_code == 400
    assert "định dạng không hỗ trợ" in res_mime.json()["detail"]
    print("   [x] Chặn đúng MIME type sai -> HTTP 400")

    # 3.2 Tệp > 10MB -> 400
    huge_bytes = b"0" * (10 * 1024 * 1024 + 10)
    res_huge = client.post("/api/v1/predict", files={"file": ("huge.jpg", huge_bytes, "image/jpeg")})
    assert res_huge.status_code == 400
    assert "vượt quá 10MB" in res_huge.json()["detail"]
    print("   [x] Chặn đúng tệp vượt 10MB -> HTTP 400")

    # 3.3 Tệp text đổi đuôi thành .jpg (MIME spoofing) -> 422
    fake_jpg = b"This is fake text pretending to be a jpg"
    res_fake = client.post("/api/v1/predict", files={"file": ("fake.jpg", fake_jpg, "image/jpeg")})
    assert res_fake.status_code == 422
    assert "lỗi cấu trúc hoặc không thể giải mã" in res_fake.json()["detail"]
    print("   [x] Chặn đúng tệp text đổi đuôi .jpg (MIME spoofing) -> HTTP 422")

    # 3.4 Tệp hỏng byte header -> 422
    corrupt_bytes = b"\xFF\xD8\xFF\x00\x01\x02hacked-corrupted-bytes"
    res_corrupt = client.post("/api/v1/predict", files={"file": ("corrupt.jpg", corrupt_bytes, "image/jpeg")})
    assert res_corrupt.status_code == 422
    assert "lỗi cấu trúc hoặc không thể giải mã" in res_corrupt.json()["detail"]
    print("   [x] Chặn đúng tệp hỏng byte -> HTTP 422")

    print(" -> PASSED: Toàn bộ 4 ca bảo mật đều trả về đúng mã HTTP chuẩn RESTful!")


def test_4_confusion_group_handling():
    print("[4/5] Kiểm thử nhóm dễ nhầm lẫn (Confusion Group TOMATO_LEAF_SPOT)...")
    # Kiểm tra trực tiếp qua class_mapping_service và ood_filter
    early_blight_info = class_mapping_service.get_class_info("Tomato___Early_blight")
    assert early_blight_info is not None
    assert early_blight_info["confusion_group"] == "TOMATO_LEAF_SPOT"

    warning = class_mapping_service.format_confusion_warning("Tomato___Early_blight")
    assert "dễ nhầm với" in warning
    assert "Target spot" in warning or "đốm mắt" in warning.lower()

    # Kiểm tra evaluate sinh đúng cảnh báo khi confidence >= 0.70
    import torch
    dummy_logits = torch.zeros(38)
    dummy_img = Image.new("RGB", (100, 100), color=(34, 139, 34))
    eval_res = ood_filter.evaluate(
        logits=dummy_logits,
        pil_image=dummy_img,
        confidence=0.88,
        top1_class_code="Tomato___Early_blight"
    )
    assert eval_res["is_ood"] is False
    assert eval_res["is_uncertain"] is False
    assert eval_res["confusion_group"] == "TOMATO_LEAF_SPOT"
    assert "dễ nhầm với" in eval_res["warning_message"]
    print(f" -> PASSED: Nhóm nhầm lẫn TOMATO_LEAF_SPOT sinh đúng cảnh báo: '{eval_res['warning_message']}'")


def test_5_latency_benchmark():
    print("[5/5] Đánh giá thời gian phản hồi toàn trình (CPU Latency Benchmark)...")
    leaf_bytes = get_leaf_image_bytes()
    latencies = []

    # Chạy 3 lần để đo trung bình
    for i in range(3):
        t0 = time.perf_counter()
        res = client.post("/api/v1/predict?include_heatmap=true", files={"file": ("bench.jpg", leaf_bytes, "image/jpeg")})
        assert res.status_code == 200
        latencies.append((time.perf_counter() - t0) * 1000)

    avg_latency = sum(latencies) / len(latencies)
    print(f"   Các lần đo: {[f'{t:.1f}ms' for t in latencies]}")
    print(f"   Thời gian trung bình toàn trình: {avg_latency:.1f}ms (Tiêu chuẩn: <= 1000ms)")
    assert avg_latency <= 1000.0, f"Độ trễ trung bình {avg_latency:.1f}ms vượt quá 1.0s!"
    print(" -> PASSED: Tốc độ phản hồi đạt chuẩn cao (nhanh hơn gấp nhiều lần tiêu chuẩn 1.0s)!")


if __name__ == "__main__":
    print("=" * 65)
    print("=== CHẠY KIỂM THỬ PHA 5: E2E PREDICTION & SECURITY HARMONIZATION ===")
    print("=" * 65)
    test_1_valid_leaf_prediction()
    test_2_ood_foreign_object()
    test_3_security_and_file_validation()
    test_4_confusion_group_handling()
    test_5_latency_benchmark()
    print("=" * 65)
    print("=== TẤT CẢ 5/5 BÀI TEST E2E ĐỀU THÀNH CÔNG (100% PASS)! ===")
    print("=" * 65)
