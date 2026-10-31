import sys
import io
import time
from PIL import Image
import torch

if sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from app.services.predictor import predictor
from app.services.ood_filter import ood_filter

def test_predictor_loaded():
    print("[1/5] Kiểm tra khởi tạo mô hình...")
    assert predictor.is_loaded is True, "Model chưa được nạp"
    assert predictor.num_classes == 38, f"Số lớp phải là 38, thực tế: {predictor.num_classes}"
    assert predictor.model is not None, "Model ResNet-18 là None"
    print(" -> PASSED: Model ResNet-18 đã nạp thành công 38 lớp!")

def test_predict_in_distribution():
    print("[2/5] Kiểm tra dự đoán ảnh In-Distribution (Ảnh hợp lệ)...")
    sample_img = Image.new("RGB", (224, 224), color=(34, 139, 34))
    
    # Dự đoán có heatmap
    res = predictor.predict(sample_img, include_heatmap=True)

    # 1. Kiểm tra cấu trúc hợp đồng API contracts Mục 2.1
    assert res["success"] is True
    assert "top1" in res and res["top1"] is not None
    top1 = res["top1"]
    assert "class_code" in top1
    assert "plant_name" in top1 and len(top1["plant_name"]) > 0
    assert "disease_name" in top1 and len(top1["disease_name"]) > 0
    assert "confidence" in top1 and 0.0 <= top1["confidence"] <= 1.0
    assert "confusion_group" in top1

    # Kiểm tra top 3
    assert "top3" in res and len(res["top3"]) == 3
    for item in res["top3"]:
        assert "class_code" in item
        assert "confidence" in item

    assert res["is_ood"] is False
    assert isinstance(res["is_uncertain"], bool)
    assert "warning_message" in res
    assert res["gradcam_base64"] is not None
    assert res["gradcam_base64"].startswith("data:image/jpeg;base64,")
    assert isinstance(res["inference_time_ms"], int)

    # 2. Đảm bảo KHÔNG còn các trường cũ (tier, predicted_class)
    assert "tier" not in res, "Không được chứa trường tier"
    assert "predicted_class" not in res, "Không được chứa trường cũ predicted_class"
    assert "tier" not in top1, "Top1 không được chứa trường tier"

    print(f" -> PASSED: Dự đoán thành công: Top-1='{top1['plant_name']} - {top1['disease_name']}' (Conf: {top1['confidence']:.4f})")
    print(f"    Inference time: {res['inference_time_ms']}ms")

def test_predict_without_heatmap():
    print("[3/5] Kiểm tra tùy chọn include_heatmap=False...")
    sample_img = Image.new("RGB", (224, 224), color=(46, 139, 87))
    res = predictor.predict(sample_img, include_heatmap=False)
    assert res["gradcam_base64"] is None, "Khi include_heatmap=False, gradcam_base64 phải là None"
    print(" -> PASSED: include_heatmap=False hoạt động chính xác (gradcam_base64 is None)")

def test_predict_bytes_input():
    print("[4/5] Kiểm tra nạp đầu vào dạng bytes...")
    sample_img = Image.new("RGB", (224, 224), color=(50, 150, 50))
    buf = io.BytesIO()
    sample_img.save(buf, format="JPEG")
    img_bytes = buf.getvalue()

    res = predictor.predict(img_bytes, include_heatmap=False)
    assert res["success"] is True
    assert res["top1"] is not None
    print(" -> PASSED: Đầu vào bytes hoạt động bình thường!")

def test_predict_ood_case():
    print("[5/5] Kiểm tra phản hồi khi phát hiện OOD (is_ood = True)...")
    sample_img = Image.new("RGB", (224, 224), color=(100, 100, 100))
    
    # Kích hoạt ngưỡng cao để giả lập OOD
    original_threshold = ood_filter.energy_threshold
    try:
        ood_filter.energy_threshold = 999.0  # Mọi ảnh đều có Energy < 999
        res = predictor.predict(sample_img, include_heatmap=True)

        assert res["success"] is True
        assert res["is_ood"] is True
        assert res["is_uncertain"] is False
        assert res["top1"] is None, "Khi OOD, top1 phải là None"
        assert res["top3"] == [], "Khi OOD, top3 phải là []"
        assert res["gradcam_base64"] is None, "Khi OOD, gradcam_base64 phải là None"
        assert "Ảnh nằm ngoài phạm vi 38 lớp" in res["warning_message"]
        print(" -> PASSED: Phản hồi OOD chuẩn 100% hợp đồng API contracts!")
    finally:
        ood_filter.energy_threshold = original_threshold


if __name__ == "__main__":
    print("=== BẮT ĐẦU KIỂM THỬ PHA 3: NÂNG CẤP PLANT PREDICTOR ===")
    test_predictor_loaded()
    test_predict_in_distribution()
    test_predict_without_heatmap()
    test_predict_bytes_input()
    test_predict_ood_case()
    print("=== TẤT CẢ 5/5 BÀI TEST PHA 3 ĐỀU THÀNH CÔNG (100% PASS)! ===")
