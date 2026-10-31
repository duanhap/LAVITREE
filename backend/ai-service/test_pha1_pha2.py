import sys
import os
from pathlib import Path
from PIL import Image
import torch
import numpy as np

if sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from app.services.class_mapping import class_mapping_service
from app.services.ood_filter import (
    calculate_vegetation_ratio,
    calculate_energy_score,
    OODFilter,
)

def test_class_mapping():
    print("[1/4] Kiểm thử class_mapping_service...")
    assert class_mapping_service.total_classes == 38, f"Cần đúng 38 lớp, nhận được {class_mapping_service.total_classes}"
    assert class_mapping_service.get_class_info("Orange___healthy") is None, "Phải bỏ qua Orange___healthy"
    assert class_mapping_service.get_class_info("Squash___healthy") is None, "Phải bỏ qua Squash___healthy"

    # Kiểm tra ánh xạ tiếng Việt
    info = class_mapping_service.get_class_info("Tomato___Late_blight")
    assert info is not None
    assert info["plant_name"] == "Cà chua"
    assert "mốc sương" in info["disease_name"].lower()
    assert info["capture_tip"] is not None

    # Kiểm tra nhóm nhầm lẫn
    early = class_mapping_service.get_class_info("Tomato___Early_blight")
    assert early["confusion_group"] == "TOMATO_LEAF_SPOT"

    warning = class_mapping_service.format_confusion_warning("Tomato___Early_blight")
    assert "dễ nhầm với" in warning
    assert "Target spot" in warning
    print(" -> PASSED: class_mapping_service đạt 100% tiêu chí!")


def test_vegetation_ratio():
    print("[2/4] Kiểm thử calculate_vegetation_ratio (Tầng 1)...")
    black_img = Image.new("RGB", (100, 100), (0, 0, 0))
    ratio_black = calculate_vegetation_ratio(black_img)
    assert ratio_black == 0.0, f"Ảnh đen tỷ lệ phải là 0, nhận {ratio_black}"

    green_img = Image.new("RGB", (100, 100), (34, 139, 34))
    ratio_green = calculate_vegetation_ratio(green_img)
    assert ratio_green >= 0.9, f"Ảnh xanh lá tỷ lệ phải >= 0.9, nhận {ratio_green}"

    hand_img = Image.new("RGB", (100, 100), (255, 205, 178))
    ratio_hand = calculate_vegetation_ratio(hand_img)
    assert ratio_hand < 0.05, f"Ảnh màu da tay tỷ lệ phải < 0.05, nhận {ratio_hand}"

    print(f" -> PASSED: Vegetation ratio (Black={ratio_black:.2f}, Green={ratio_green:.2f}, Hand={ratio_hand:.2f})")


def test_energy_score():
    print("[3/4] Kiểm thử calculate_energy_score (Tầng 2)...")
    # Giả lập logits đều bằng 0 (38 chiều)
    # log(38 * exp(0)) = log(38) ~= 3.63758
    logits = torch.zeros(38)
    energy = calculate_energy_score(logits, temperature=1.0)
    expected = float(np.log(38))
    assert abs(energy - expected) < 1e-4, f"Energy tính sai: {energy} vs {expected}"

    # Logits tự tin cao (vị trí 0 = 10, còn lại 0)
    confident_logits = torch.zeros(38)
    confident_logits[0] = 10.0
    energy_conf = calculate_energy_score(confident_logits, temperature=1.0)
    assert energy_conf > 10.0, f"Energy của mẫu tự tin phải > 10: {energy_conf}"
    print(f" -> PASSED: Energy score công thức chuẩn Liu et al. (Uniform={energy:.4f}, Confident={energy_conf:.4f})")


def test_decision_fusion_policy():
    print("[4/4] Kiểm thử Decision Fusion Policy của OODFilter...")
    # Tạo OODFilter với ngưỡng tạm thời 2.0
    filter_instance = OODFilter(temperature=1.0)
    filter_instance.energy_threshold = 2.0

    green_leaf = Image.new("RGB", (100, 100), (34, 139, 34))
    black_desk = Image.new("RGB", (100, 100), (10, 10, 10))

    # Ca 1: OOD (Energy < 2.0)
    low_energy_logits = torch.zeros(38) - 5.0  # Energy = log(38) - 5.0 = -1.36 < 2.0
    dec1 = filter_instance.evaluate(low_energy_logits, black_desk, confidence=0.90, top1_class_code="Tomato___healthy")
    assert dec1["is_ood"] is True
    assert dec1["is_uncertain"] is False
    assert "Ảnh nằm ngoài phạm vi 38 lớp" in dec1["warning_message"]

    # Ca 2: In-Distribution, nhưng vegetation_ratio < 5% và confidence < 0.70
    high_energy_logits = torch.zeros(38)
    high_energy_logits[0] = 5.0
    dec2 = filter_instance.evaluate(high_energy_logits, black_desk, confidence=0.55, top1_class_code="Tomato___Late_blight")
    assert dec2["is_ood"] is False
    assert dec2["is_uncertain"] is True
    assert "Ảnh có tỷ lệ lá thấp" in dec2["warning_message"]

    # Ca 3: In-Distribution, vegetation_ratio >= 5% và confidence < 0.70
    dec3 = filter_instance.evaluate(high_energy_logits, green_leaf, confidence=0.55, top1_class_code="Tomato___Late_blight")
    assert dec3["is_ood"] is False
    assert dec3["is_uncertain"] is True
    assert "Mô hình chưa hoàn toàn chắc chắn" in dec3["warning_message"]

    # Ca 4a: In-Distribution, confidence >= 0.70 và Top-1 thuộc Confusion Group
    dec4a = filter_instance.evaluate(high_energy_logits, green_leaf, confidence=0.85, top1_class_code="Tomato___Early_blight")
    assert dec4a["is_ood"] is False
    assert dec4a["is_uncertain"] is False
    assert dec4a["confusion_group"] == "TOMATO_LEAF_SPOT"
    assert "dễ nhầm với" in dec4a["warning_message"]

    # Ca 4b: In-Distribution, confidence >= 0.70 và Top-1 không thuộc Confusion Group
    dec4b = filter_instance.evaluate(high_energy_logits, green_leaf, confidence=0.95, top1_class_code="Tomato___Late_blight")
    assert dec4b["is_ood"] is False
    assert dec4b["is_uncertain"] is False
    assert dec4b["confusion_group"] is None
    assert "Chụp kỹ cả mặt dưới lá" in dec4b["warning_message"]

    print(" -> PASSED: Cả 4 quy tắc kết hợp Decision Fusion Policy hoạt động chính xác!")


if __name__ == "__main__":
    print("=== CHẠY KIỂM THỬ PHA 1 & PHA 2: CLASS MAPPING VÀ OOD FILTER ===")
    test_class_mapping()
    test_vegetation_ratio()
    test_energy_score()
    test_decision_fusion_policy()
    print("=== TẤT CẢ CÁC BÀI TEST PHA 1 & PHA 2 ĐỀU THÀNH CÔNG (100% PASS)! ===")
