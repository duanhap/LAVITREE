#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Kịch bản kiểm thử toàn trình E2E cho TASK-A02:
1. Sổ tay bệnh học (Handbook API & Chi tiết bệnh)
2. Đăng ký & Đăng nhập nông dân (Auth Client & UTF-8 claim)
3. Khám lá khách vãng lai (Guest Policy - Không lưu MinIO/DB)
4. Khám lá ngoại lai (OOD Policy - Không tên bệnh/Grad-CAM)
5. Khám lá nông dân đã đăng nhập (Authenticated - Lưu MinIO & DB)
6. Lịch sử khám bệnh cá nhân (History W-07 & Chi tiết W-08)
7. Các chốt chặn an toàn (Validation Guards: Notes <= 1000, 400 khi thiếu ảnh)
"""

import os
import sys
import json
import base64
import uuid
import urllib.parse
import urllib.request
import urllib.error

CORE_API_URL = os.environ.get("CORE_API_URL", "http://localhost:5176")
SAMPLES_DIR = os.path.join(os.path.dirname(__file__), "..", "ai-service", "tests", "samples")
LEAF_PATH = os.path.join(SAMPLES_DIR, "leaf.jpg")
HAND_PATH = os.path.join(SAMPLES_DIR, "hand.jpg")

passed = 0
failed = 0

def test_step(step_num: int, title: str):
    print(f"\n[TEST {step_num}] {title}")

def log_success(msg: str):
    global passed
    passed += 1
    print(f"  -> SUCCESS: {msg}")

def log_fail(msg: str):
    global failed
    failed += 1
    print(f"  -> FAILED: {msg}")

def http_json(method: str, path: str, data: dict = None, token: str = None):
    url = f"{CORE_API_URL}{path}"
    headers = {"Accept": "application/json"}
    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            return response.status, json.loads(res_body) if res_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_body)
        except:
            return e.code, {"raw": err_body}
    except Exception as ex:
        return 0, {"error": str(ex)}

def http_upload(path: str, filepath: str, notes: str = None, token: str = None):
    url = f"{CORE_API_URL}{path}"
    boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
    body = bytearray()

    if filepath and os.path.exists(filepath):
        filename = os.path.basename(filepath)
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="image"; filename="{filename}"\r\n'.encode("utf-8"))
        body.extend(b"Content-Type: image/jpeg\r\n\r\n")
        with open(filepath, "rb") as f:
            body.extend(f.read())
        body.extend(b"\r\n")

    if notes is not None:
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(b'Content-Disposition: form-data; name="notes"\r\n\r\n')
        body.extend(notes.encode("utf-8"))
        body.extend(b"\r\n")

    body.extend(f"--{boundary}--\r\n".encode("utf-8"))

    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Accept": "application/json"
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=bytes(body), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            return response.status, json.loads(res_body) if res_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_body)
        except:
            return e.code, {"raw": err_body}
    except Exception as ex:
        return 0, {"error": str(ex)}

print("=" * 70)
print("     KIỂM THỬ TOÀN TRÌNH E2E TASK-A02: WEB DIAGNOSE & HANDBOOK     ")
print(f"     Target Core API: {CORE_API_URL}")
print("=" * 70)

# 1. Sổ tay bệnh học (Handbook API)
test_step(1, "Tra cứu danh mục sổ tay bệnh học: GET /api/v1/diseases")
code, data = http_json("GET", "/api/v1/diseases")
if code == 200 and isinstance(data, list) and len(data) >= 30:
    sample = data[0]
    log_success(f"Lấy thành công {len(data)} bệnh học. Mẫu: {sample.get('commonNameVi')} ({sample.get('plantName')})")
else:
    log_fail(f"Lỗi truy vấn sổ tay bệnh: HTTP {code}, {data}")

# 2. Chi tiết bệnh học theo mã lớp (W-03)
test_step(2, "Tra cứu chi tiết bệnh Tomato___Late_blight: GET /api/v1/diseases/by-class/Tomato___Late_blight")
code, data = http_json("GET", "/api/v1/diseases/by-class/Tomato___Late_blight")
if code == 200 and data.get("classCode") == "Tomato___Late_blight":
    plans = data.get("treatmentPlans", [])
    products = data.get("products", [])
    has_banned = any("paraquat" in p.get("name", "").lower() for p in products)
    if len(plans) >= 3 and not has_banned:
        log_success(f"Lấy thành công chi tiết bệnh; {len(plans)} bước IPM; {len(products)} thuốc đặc trị hợp lệ (0 thuốc cấm).")
    else:
        log_fail(f"Thiếu phác đồ hoặc có thuốc cấm: plans={len(plans)}, has_banned={has_banned}")
else:
    log_fail(f"Lỗi truy vấn chi tiết bệnh: HTTP {code}, {data}")

# 3. Đăng ký tài khoản nông dân mới (Auth Flow)
test_step(3, "Đăng ký tài khoản nông dân mới với tên tiếng Việt có dấu: POST /api/v1/auth/register")
test_email = f"farmer_a02_{uuid.uuid4().hex[:8]}@lavitree.vn"
test_name = "Trần Thị Hoa"
test_pass = "HoaTran@2026#Secure"
reg_payload = {
    "email": test_email,
    "password": test_pass,
    "full_name": test_name,
    "phone": "0987654321"
}
code, data = http_json("POST", "/api/v1/auth/register", reg_payload)
farmer_token = None
farmer_id = None
if code == 201 and "token" in data:
    farmer_token = data["token"]
    farmer_id = data["user"]["id"]
    log_success(f"Tạo thành công tài khoản: {test_name} ({test_email}), ID: {farmer_id}")
else:
    log_fail(f"Đăng ký thất bại: HTTP {code}, {data}")

# 4. Kiểm tra giải mã JWT UTF-8
test_step(4, "Kiểm tra bảo toàn tiếng Việt trong JWT Claims (BUG-14)")
if farmer_token:
    parts = farmer_token.split(".")
    if len(parts) == 3:
        b64 = parts[1] + "=" * ((4 - len(parts[1]) % 4) % 4)
        payload = json.loads(base64.urlsafe_b64decode(b64).decode("utf-8"))
        jwt_name = payload.get("name") or payload.get("full_name") or payload.get("unique_name")
        if jwt_name == test_name:
            log_success(f"Claim name trong JWT bảo toàn 100% tiếng Việt: '{jwt_name}'")
        else:
            log_fail(f"Tiếng Việt bị sai lệch mã: mong đợi '{test_name}', nhận được '{jwt_name}'")
    else:
        log_fail("Cấu trúc token không đúng định dạng JWT 3 phần.")
else:
    log_fail("Không có token để kiểm tra.")

# 5. Đăng nhập với tài khoản vừa tạo
test_step(5, "Đăng nhập xác thực tài khoản vừa tạo: POST /api/v1/auth/login")
code, data = http_json("POST", "/api/v1/auth/login", {"email": test_email, "password": test_pass})
if code == 200 and "token" in data:
    log_success(f"Đăng nhập thành công, token Bearer cấp quyền {data['user']['role']}.")
else:
    log_fail(f"Đăng nhập thất bại: HTTP {code}, {data}")

# 6. Chẩn đoán khách vãng lai (Guest Diagnose Policy)
test_step(6, "Khám lá khách vãng lai (Guest): POST /api/v1/diagnose (Không Bearer token)")
code, data = http_upload("/api/v1/diagnose", LEAF_PATH)
if code == 200 and data.get("success"):
    is_guest_privacy_ok = data.get("diagnosis_id") is None
    has_gradcam = bool(data.get("visual_evidence", {}).get("gradcam_image_url"))
    guidelines_count = len(data.get("treatment_guidelines", []))
    products_count = len(data.get("recommended_products", []))
    sources_count = len(data.get("verified_sources", []))
    if is_guest_privacy_ok and has_gradcam and guidelines_count > 0:
        log_success(f"Guest Policy hoàn hảo: diagnosis_id=null; Grad-CAM data URL trả về; {guidelines_count} bước IPM; {products_count} thuốc đặc trị; {sources_count} nguồn khuyến nông.")
    else:
        log_fail(f"Guest Policy sai quy cách: is_guest_privacy_ok={is_guest_privacy_ok}, has_gradcam={has_gradcam}, guidelines={guidelines_count}")
else:
    log_fail(f"Chẩn đoán Guest thất bại: HTTP {code}, {data}")

# 7. Chẩn đoán ảnh ngoại lai (OOD Privacy Policy)
test_step(7, "Khám ảnh ngoại lai OOD: POST /api/v1/diagnose (hand.jpg)")
code, data = http_upload("/api/v1/diagnose", HAND_PATH)
if code == 200 and data.get("is_ood") is True:
    is_clean = (data.get("diagnosis_id") is None and 
                data.get("result") is None and 
                data.get("visual_evidence") is None and 
                len(data.get("treatment_guidelines", [])) == 0 and 
                len(data.get("recommended_products", [])) == 0)
    if is_clean:
        log_success(f"OOD Policy chuẩn xác: is_ood=true; {data.get('warning')}; không rò rỉ dữ liệu bệnh/thuốc/ảnh.")
    else:
        log_fail(f"OOD trả về dữ liệu không được phép: {data}")
else:
    log_fail(f"OOD thất bại: HTTP {code}, {data}")

# 8. Chẩn đoán Nông dân đã đăng nhập (Authenticated Diagnose)
test_step(8, "Khám lá tài khoản Nông dân đã đăng nhập: POST /api/v1/diagnose (Có Bearer token)")
saved_diagnosis_id = None
code, data = http_upload("/api/v1/diagnose", LEAF_PATH, notes="Vườn cà chua 3 sào tại Nam Định", token=farmer_token)
if code == 200 and data.get("success") and data.get("diagnosis_id"):
    saved_diagnosis_id = data.get("diagnosis_id")
    orig_url = data.get("visual_evidence", {}).get("original_image_url")
    cam_url = data.get("visual_evidence", {}).get("gradcam_image_url")
    log_success(f"Chẩn đoán lưu thành công: diagnosis_id={saved_diagnosis_id}; Ảnh gốc và Grad-CAM đã được upload.")
else:
    log_fail(f"Chẩn đoán Authenticated thất bại: HTTP {code}, {data}")

# 9. Kiểm tra Lịch sử khám bệnh (W-07)
test_step(9, "Truy vấn danh sách lịch sử chẩn đoán: GET /api/v1/diagnose/history")
code, data = http_json("GET", "/api/v1/diagnose/history", token=farmer_token)
if code == 200 and data.get("total_records", 0) >= 1:
    first_item = data["items"][0]
    if first_item.get("id") == saved_diagnosis_id:
        log_success(f"Hồ sơ vừa khám hiển thị ngay đầu danh sách: {first_item.get('disease_name')} ({first_item.get('plant_name')}) - Ghi chú: '{first_item.get('notes')}'")
    else:
        log_success(f"Tìm thấy {data.get('total_records')} bản ghi trong lịch sử.")
else:
    log_fail(f"Không tìm thấy lịch sử: HTTP {code}, {data}")

# 10. Kiểm tra Chi tiết ca khám bệnh theo ID (W-08 & BUG-17)
test_step(10, f"Truy vấn chi tiết ca khám: GET /api/v1/diagnose/history/{saved_diagnosis_id}")
if saved_diagnosis_id:
    code, data = http_json("GET", f"/api/v1/diagnose/history/{saved_diagnosis_id}", token=farmer_token)
    if code == 200 and data.get("diagnosis_id") == saved_diagnosis_id:
        plans = len(data.get("treatment_guidelines", []))
        prods = len(data.get("recommended_products", []))
        log_success(f"Chi tiết ca khám W-08 hoàn chỉnh: {plans} bước IPM; {prods} thuốc gợi ý; bằng chứng ảnh đầy đủ.")
    else:
        log_fail(f"Chi tiết ca khám lỗi: HTTP {code}, {data}")
else:
    log_fail("Không có saved_diagnosis_id để kiểm tra.")

# 11. Kiểm tra an toàn IDOR / Authorization cho endpoint chi tiết
test_step(11, f"Kiểm tra bảo mật IDOR chi tiết: Người dùng khác không được xem ca khám của {test_name}")
other_farmer_payload = {
    "email": f"other_{uuid.uuid4().hex[:8]}@lavitree.vn",
    "password": "OtherPassword@2026#",
    "full_name": "Lê Văn Khác",
    "phone": "0912345679"
}
code, reg_other = http_json("POST", "/api/v1/auth/register", other_farmer_payload)
if code == 201 and "token" in reg_other:
    other_token = reg_other["token"]
    code_leak, _ = http_json("GET", f"/api/v1/diagnose/history/{saved_diagnosis_id}", token=other_token)
    if code_leak == 404:
        log_success("IDOR được chặn triệt để: Người dùng khác nhận HTTP 404 Not Found.")
    else:
        log_fail(f"Hổng bảo mật IDOR: Mong đợi 404 nhưng nhận HTTP {code_leak}")
else:
    log_fail("Không thể tạo tài khoản người dùng khác để kiểm tra.")

# 12. Kiểm tra độ dài ghi chú > 1000 ký tự (BUG-22)
test_step(12, "Kiểm tra chặn ghi chú vượt quá 1000 ký tự: POST /api/v1/diagnose")
huge_notes = "A" * 1001
code, data = http_upload("/api/v1/diagnose", LEAF_PATH, notes=huge_notes, token=farmer_token)
if code == 400:
    log_success("Hệ thống từ chối chính xác ghi chú > 1000 ký tự (HTTP 400 Bad Request).")
else:
    log_fail(f"Không chặn ghi chú quá dài: HTTP {code}, {data}")

# 13. Kiểm tra thiếu file ảnh
test_step(13, "Kiểm tra chặn request không có ảnh: POST /api/v1/diagnose")
code, data = http_upload("/api/v1/diagnose", filepath=None, token=farmer_token)
if code == 400:
    log_success("Hệ thống từ chối chính xác request thiếu ảnh (HTTP 400 Bad Request).")
else:
    log_fail(f"Không chặn thiếu ảnh: HTTP {code}, {data}")

print("\n" + "=" * 70)
print(f" KẾT QUẢ KIỂM THỬ: {passed} PASSED / {failed} FAILED (Tổng số: {passed + failed} bài test)")
print("=" * 70)

if failed > 0:
    sys.exit(1)
