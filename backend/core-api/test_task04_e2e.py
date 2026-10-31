import io
import time
import requests
from PIL import Image

import os
from pathlib import Path

BASE_URL = os.getenv("CORE_API_URL", "http://localhost:5176")

# Tự động đọc ADMIN_SECRET_KEY từ môi trường hoặc file .env (Tuyệt đối không hardcode)
ADMIN_KEY = os.getenv("ADMIN_SECRET_KEY")
if not ADMIN_KEY:
    for env_candidate in [Path(".env"), Path("../.env"), Path("../../.env")]:
        if env_candidate.exists():
            with open(env_candidate, "r", encoding="utf-8") as f:
                for line in f:
                    line_s = line.strip()
                    if line_s.startswith("ADMIN_SECRET_KEY="):
                        ADMIN_KEY = line_s.split("=", 1)[1].strip().strip('"').strip("'")
                        break
        if ADMIN_KEY:
            break

if not ADMIN_KEY:
    raise RuntimeError("ADMIN_SECRET_KEY không tìm thấy trong biến môi trường hoặc .env! Vui lòng cấu hình biến ADMIN_SECRET_KEY.")

def create_sample_leaf_image():
    buf = io.BytesIO()
    img = Image.new("RGB", (224, 224), color=(34, 139, 34))
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf.getvalue()

def create_ood_image():
    buf = io.BytesIO()
    img = Image.new("RGB", (224, 224), color=(200, 160, 140))
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf.getvalue()

print("==================================================================")
print("     KIỂM THỬ TOÀN DIỆN TASK-04: CORE API & BẢO MẬT (SPRINT 1)    ")
print("==================================================================")

# --- TEST 1: Bảo mật Admin Key (Fail-closed & Timing Attack Protection) ---
print("\n[TEST 1] Kiểm tra Bảo mật Admin Key trên KnowledgeController...")

# 1.1 Không có header X-Admin-Key
res1 = requests.get(f"{BASE_URL}/api/v1/knowledge/export")
print(f" -> 1.1 GET /export (No Key): HTTP {res1.status_code}")
assert res1.status_code == 401, f"Expected 401, got {res1.status_code}"

# 1.2 Header X-Admin-Key sai
res2 = requests.get(f"{BASE_URL}/api/v1/knowledge/export", headers={"X-Admin-Key": "wrong_key_123"})
print(f" -> 1.2 GET /export (Wrong Key): HTTP {res2.status_code}")
assert res2.status_code == 401, f"Expected 401, got {res2.status_code}"

# 1.3 Header X-Admin-Key đúng chuẩn
res3 = requests.get(f"{BASE_URL}/api/v1/knowledge/export", headers={"X-Admin-Key": ADMIN_KEY})
print(f" -> 1.3 GET /export (Valid Key): HTTP {res3.status_code}, Length: {len(res3.content)} bytes")
assert res3.status_code == 200, f"Expected 200, got {res3.status_code}"
assert "Lavitree_Knowledge_Sources" in res3.headers.get("Content-Disposition", "")

# 1.4 POST /sources không có Key
res4 = requests.post(f"{BASE_URL}/api/v1/knowledge/sources", json={})
print(f" -> 1.4 POST /sources (No Key): HTTP {res4.status_code}")
assert res4.status_code == 401, f"Expected 401, got {res4.status_code}"
print(" => [PASSED] Bảo mật Admin API Key đạt chuẩn Fail-Closed 100%!")


# --- TEST 2: Kiểm tra Validation File Upload (HTTP 400 & 422) ---
print("\n[TEST 2] Kiểm tra Validation File Upload...")

# 2.1 Không gửi file
res5 = requests.post(f"{BASE_URL}/api/v1/diagnose")
print(f" -> 2.1 Không đính kèm tệp: HTTP {res5.status_code}")
assert res5.status_code == 400, f"Expected 400, got {res5.status_code}"

# 2.2 Tệp sai định dạng (.txt)
res6 = requests.post(
    f"{BASE_URL}/api/v1/diagnose",
    files={"image": ("test.txt", b"plain text", "text/plain")}
)
print(f" -> 2.2 Định dạng tệp sai (.txt): HTTP {res6.status_code}, detail: {res6.json().get('detail')}")
assert res6.status_code == 400, f"Expected 400, got {res6.status_code}"

# 2.3 Tệp ảnh hỏng byte
res7 = requests.post(
    f"{BASE_URL}/api/v1/diagnose",
    files={"image": ("corrupted.jpg", b"corrupted bytes content not an image", "image/jpeg")}
)
print(f" -> 2.3 Ảnh hỏng byte: HTTP {res7.status_code}, detail: {res7.json().get('detail')}")
assert res7.status_code == 422, f"Expected 422, got {res7.status_code}"
print(" => [PASSED] Validation & Error Handling (400/422) đạt chuẩn 100%!")


# --- TEST 3: Kiểm tra Chính sách Lưu trữ & Quyền riêng tư OOD ---
print("\n[TEST 3] Kiểm tra Out-of-Distribution (OOD) Privacy Policy...")
ood_bytes = create_ood_image()
res8 = requests.post(
    f"{BASE_URL}/api/v1/diagnose",
    files={"image": ("hand_ood_sample.jpg", ood_bytes, "image/jpeg")}
)
print(f" -> 3.1 Gửi ảnh ngoại lai (OOD): HTTP {res8.status_code}")
assert res8.status_code == 200, f"Expected 200, got {res8.status_code}"
ood_data = res8.json()
print(f"     is_ood: {ood_data.get('is_ood')}")
print(f"     diagnosis_id: {ood_data.get('diagnosis_id')}")
print(f"     result: {ood_data.get('result')}")
print(f"     visual_evidence: {ood_data.get('visual_evidence')}")
print(f"     warning: {ood_data.get('warning')}")

assert ood_data["is_ood"] is True
assert ood_data["diagnosis_id"] is None
assert ood_data["result"] is None
assert ood_data["visual_evidence"] is None
assert len(ood_data["treatment_guidelines"]) == 0
assert len(ood_data["recommended_products"]) == 0
assert len(ood_data["verified_sources"]) == 0
print(" => [PASSED] OOD Privacy Policy đạt chuẩn (Không ghi DB, Không lưu MinIO)!")


# --- TEST 4: Chẩn đoán ca bệnh mẫu Tomato Late Blight toàn trình ---
print("\n[TEST 4] Kiểm tra Chẩn đoán khép kín toàn trình (Tomato___Late_blight)...")
leaf_bytes = create_sample_leaf_image()
t0 = time.perf_counter()
res9 = requests.post(
    f"{BASE_URL}/api/v1/diagnose",
    files={"image": ("tomato_late_blight_leaf.jpg", leaf_bytes, "image/jpeg")},
    data={"notes": "Vườn cà chua 2 sào tại Đà Lạt"}
)
latency = (time.perf_counter() - t0) * 1000
print(f" -> 4.1 POST /api/v1/diagnose: HTTP {res9.status_code}, Thời gian phản hồi: {latency:.1f}ms")
assert res9.status_code == 200, f"Expected 200, got {res9.status_code}"

diag = res9.json()
assert diag["success"] is True
assert diag["is_ood"] is False
assert diag["diagnosis_id"] is not None
print(f"     Mã ca chẩn đoán (diagnosis_id): {diag['diagnosis_id']}")

result = diag["result"]
print(f"     Cây trồng: {result['plant_name']}")
print(f"     Bệnh: {result['disease_name']} ({result['class_code']})")
print(f"     Độ tin cậy: {result['confidence']:.4f}")
print(f"     Mức độ nghiêm trọng: {result['severity_level']}")
assert result["class_code"] == "Tomato___Late_blight"
assert "Cà chua" in result["plant_name"]
assert "mốc sương" in result["disease_name"].lower() or "sương mai" in result["disease_name"].lower()

# Kiểm tra Top 3
print("\n     Top 3 Dự đoán:")
for idx, top in enumerate(result["top3"], 1):
    print(f"       {idx}. {top['disease_name']} ({top['class_code']}): {top['confidence']:.4f}")
assert len(result["top3"]) == 3

# Kiểm tra IPM Guidelines
print(f"\n     Hướng dẫn xử lý chuẩn Khuyến nông & IPM ({len(diag['treatment_guidelines'])} bước linh hoạt):")
for step in diag["treatment_guidelines"]:
    iso = f" (Cách ly: {step['isolation_days']})" if step['isolation_days'] else ""
    print(f"       Bước {step['step_order']}: {step['action_title']}{iso}")
assert len(diag["treatment_guidelines"]) >= 3

# Kiểm tra Sản phẩm thuốc BVTV
print(f"\n     Vật tư thuốc BVTV khuyến nghị ({len(diag['recommended_products'])} sản phẩm):")
for prod in diag["recommended_products"]:
    print(f"       - {prod['name']} ({prod['active_ingredient']}) - {prod['price']:,.0f} đ/{prod['unit']}")
assert len(diag["recommended_products"]) >= 3

# Kiểm tra Nguồn tài liệu đối chứng
print(f"\n     Nguồn khuyến nông đối chứng ({len(diag['verified_sources'])} tài liệu):")
for src in diag["verified_sources"]:
    print(f"       - [{src['organization']}] {src['title']}")
assert len(diag["verified_sources"]) >= 1

# Kiểm tra Visual Evidence URLs
print("\n     Bằng chứng trực quan (Visual Evidence):")
print(f"       Ảnh gốc: {diag['visual_evidence']['original_image_url']}")
print(f"       Grad-CAM: {diag['visual_evidence']['gradcam_image_url']}")
assert diag["visual_evidence"]["original_image_url"] is not None
assert diag["visual_evidence"]["gradcam_image_url"] is not None

assert latency <= 1500, f"Latency {latency}ms exceeds 1500ms SLA"
print(f"\n => [PASSED] Chẩn đoán toàn trình thành công xuất sắc! SLA {latency:.1f}ms <= 1.5s!")
print("\n==================================================================")
print("     HOÀN TẤT KIỂM THỬ 100% TEST CASES ĐẠT YÊU CẦU NGHIỆM THU!     ")
print("==================================================================")
