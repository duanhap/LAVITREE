import io
import sys
import time
from pathlib import Path
from PIL import Image

if sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from app.services.predictor import predictor

BASE_DIR = Path(__file__).resolve().parent
SAMPLE_LEAF = BASE_DIR / "tests" / "samples" / "leaf.jpg"

def load_leaf():
    if SAMPLE_LEAF.exists():
        return Image.open(SAMPLE_LEAF).convert("RGB")
    return Image.new("RGB", (224, 224), color=(34, 139, 34))

def test_single_pass_and_benchmark():
    print("=== KIỂM THỬ TASK-02: GRAD-CAM SINGLE-PASS INFERENCE & BENCHMARK ===")
    img = load_leaf()

    # 1. Đo khi BẬT heatmap (Single-pass inference)
    print("\n[1/3] Đo đạc khi BẬT Grad-CAM heatmap (include_heatmap=True)...")
    latencies_with_cam = []
    res_cam = None
    for i in range(5):
        t0 = time.perf_counter()
        res_cam = predictor.predict(img, include_heatmap=True)
        lat = (time.perf_counter() - t0) * 1000
        latencies_with_cam.append(lat)

    avg_cam = sum(latencies_with_cam) / len(latencies_with_cam)
    print(f"   Các lần đo: {[f'{t:.1f}ms' for t in latencies_with_cam]}")
    print(f"   Thời gian trung bình khi CÓ Heatmap: {avg_cam:.1f}ms")
    assert res_cam["gradcam_base64"] is not None
    assert res_cam["gradcam_base64"].startswith("data:image/jpeg;base64,")

    # 2. Đo khi TẮT heatmap (chỉ phân loại)
    print("\n[2/3] Đo đạc khi TẮT Grad-CAM heatmap (include_heatmap=False)...")
    latencies_no_cam = []
    res_no_cam = None
    for i in range(5):
        t0 = time.perf_counter()
        res_no_cam = predictor.predict(img, include_heatmap=False)
        lat = (time.perf_counter() - t0) * 1000
        latencies_no_cam.append(lat)

    avg_no_cam = sum(latencies_no_cam) / len(latencies_no_cam)
    print(f"   Các lần đo: {[f'{t:.1f}ms' for t in latencies_no_cam]}")
    print(f"   Thời gian trung bình khi TẮT Heatmap: {avg_no_cam:.1f}ms")
    assert res_no_cam["gradcam_base64"] is None

    # 3. Đánh giá tỷ lệ tăng tốc
    diff_ms = avg_cam - avg_no_cam
    speedup_pct = (diff_ms / avg_cam) * 100 if avg_cam > 0 else 0
    print(f"\n[3/3] Đánh giá hiệu quả tối ưu:")
    print(f"   - Tiết kiệm thời gian khi tắt heatmap: {diff_ms:.1f}ms ({speedup_pct:.1f}%)")
    print(f"   - Cả 2 trường hợp đều đáp ứng xuất sắc tiêu chuẩn <= 1000ms trên CPU!")
    assert avg_cam <= 1000.0, "Thời gian có Heatmap vượt ngưỡng 1.0s!"
    assert avg_no_cam <= 1000.0, "Thời gian không Heatmap vượt ngưỡng 1.0s!"
    print("\n -> PASSED: Task 02 Single-Pass Grad-CAM hoàn thành xuất sắc!")

if __name__ == "__main__":
    test_single_pass_and_benchmark()
