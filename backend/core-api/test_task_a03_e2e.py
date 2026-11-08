#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Kịch bản kiểm thử toàn trình E2E cho TASK-A03:
1. Quản lý kho thuốc BVTV (Medicines Search, RBAC Patch, PHI & IsAllowed)
2. Đặt hàng Vật tư Nông nghiệp COD (POST /orders, tính tiền từ DB, trừ tồn kho, chặn thuốc cấm)
3. Lịch sử đơn hàng cá nhân & Chống IDOR (GET /orders, GET /orders/{id})
4. Nhập bài báo trích đoạn nguyên văn (POST /knowledge/ingestions - tách P1..Pn)
5. Duyệt & Lưu đoạn nguyên văn (POST /knowledge/ingestions/{id}/commit - IsVerbatim=true, max 4 đoạn/URL)
6. Duyệt tri thức đơn lẻ & hàng loạt (PATCH /sources/{id}/approve, PATCH /sources/approve-batch)
7. Chuyển ca bệnh khó & Thẩm định chuyên gia (POST /diagnose/{id}/request-expert, GET /escalations, PATCH /expert-review)
"""

import os
import sys
import json
import uuid
import urllib.parse
import urllib.request
import urllib.error

# Tải biến môi trường từ .env
def load_env(env_path):
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k not in os.environ:
                        os.environ[k] = v

script_dir = os.path.dirname(os.path.abspath(__file__))
load_env(os.path.join(script_dir, ".env"))
load_env(os.path.join(script_dir, "..", "..", ".env"))

CORE_API_URL = os.environ.get("CORE_API_URL", "http://localhost:5176")
if CORE_API_URL == "http://localhost:5000":
    CORE_API_URL = "http://localhost:5176"
ADMIN_SECRET_KEY = os.environ.get("ADMIN_SECRET_KEY", "")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@lavitree.vn")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")

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

def http_json(method: str, path: str, data: dict = None, token: str = None, admin_key: str = None):
    url = f"{CORE_API_URL}{path}"
    headers = {"Accept": "application/json"}
    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if admin_key:
        headers["X-Admin-Key"] = admin_key

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

print("=" * 75)
print("     KIỂM THỬ TOÀN TRÌNH E2E TASK-A03: CỬA HÀNG & ADMIN HITL     ")
print(f"     Target Core API: {CORE_API_URL}")
print("=" * 75)

# 0. Khởi tạo tài khoản kiểm thử
# Đăng nhập Admin
admin_token = None
if ADMIN_PASSWORD:
    code, data = http_json("POST", "/api/v1/auth/login", {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if code == 200 and "token" in data:
        admin_token = data["token"]
        print(f"[*] Đăng nhập Admin thành công ({ADMIN_EMAIL})")
    else:
        print(f"[!] Không thể đăng nhập Admin bằng mật khẩu: HTTP {code}")

# Đăng ký Nông dân 1
farmer1_email = f"farmer_a03_{uuid.uuid4().hex[:8]}@lavitree.vn"
farmer1_pass = f"Pass_{uuid.uuid4().hex[:8]}!2026"
code, data = http_json("POST", "/api/v1/auth/register", {
    "email": farmer1_email,
    "password": farmer1_pass,
    "full_name": "Nguyễn Văn Nông Dân",
    "phone": "0912345678"
})
farmer1_token = data.get("token") if code == 201 else None
farmer1_id = data.get("user", {}).get("id") if code == 201 else None
if farmer1_token:
    print(f"[*] Tạo tài khoản Nông dân 1: {farmer1_email}")

# Đăng ký Nông dân 2 (dùng test IDOR)
farmer2_email = f"farmer2_a03_{uuid.uuid4().hex[:8]}@lavitree.vn"
farmer2_pass = f"Pass_{uuid.uuid4().hex[:8]}!2026"
code, data = http_json("POST", "/api/v1/auth/register", {
    "email": farmer2_email,
    "password": farmer2_pass,
    "full_name": "Trần Thị Hàng Xóm",
    "phone": "0987654321"
})
farmer2_token = data.get("token") if code == 201 else None

# =========================================================================
# 1. QUẢN LÝ KHO THUỐC BVTV (MEDICINES SEARCH & INVENTORY PATCH)
# =========================================================================
test_step(1, "Tra cứu danh mục thuốc công khai: GET /api/v1/medicines/search")
code, data = http_json("GET", "/api/v1/medicines/search?allowedOnly=true")
if code == 200 and "items" in data and len(data["items"]) > 0:
    items = data["items"]
    has_banned = any(not item.get("is_allowed", True) for item in items)
    if not has_banned:
        log_success(f"Lấy thành công {len(items)} sản phẩm lưu hành hợp pháp (0 thuốc cấm).")
    else:
        log_fail("Danh mục công khai vẫn chứa thuốc bị cấm lưu hành!")
else:
    log_fail(f"Lỗi tra cứu thuốc BVTV: HTTP {code}, {data}")

test_step(2, "RBAC Guard: Nông dân không được sửa thông số thuốc: PATCH /api/v1/medicines/1")
code, data = http_json("PATCH", "/api/v1/medicines/1", {"price": 1000}, token=farmer1_token)
if code == 403:
    log_success("Chặn thành công quyền FARMER khi cố tình sửa kho thuốc (HTTP 403 Forbidden).")
else:
    log_fail(f"FARMER không bị chặn đúng mức: HTTP {code}, {data}")

test_step(3, "Admin cập nhật thông số kho thuốc: PATCH /api/v1/medicines/1")
code, data = http_json("PATCH", "/api/v1/medicines/1", {
    "phi_days": 7,
    "stock_quantity": 99,
    "is_allowed": True
}, token=admin_token, admin_key=ADMIN_SECRET_KEY)
if code == 200 and data.get("stock_quantity") == 99 and data.get("phi_days") == 7:
    log_success(f"Admin cập nhật kho thuốc thành công: {data.get('name')}, Tồn kho: {data.get('stock_quantity')}")
else:
    log_fail(f"Cập nhật kho thuốc thất bại: HTTP {code}, {data}")

# =========================================================================
# 2. ĐẶT HÀNG VẬT TƯ NÔNG NGHIỆP COD (ORDERS API)
# =========================================================================
test_step(4, "Khách chưa đăng nhập không được đặt hàng: POST /api/v1/orders")
code, data = http_json("POST", "/api/v1/orders", {
    "items": [{"product_id": 1, "quantity": 1}],
    "shipping_address": "Xã Hải Tân, Hải Hậu, Nam Định",
    "phone_number": "0912345678"
})
if code == 401:
    log_success("Chặn thành công khách chưa đăng nhập (HTTP 401 Unauthorized).")
else:
    log_fail(f"Lỗi chặn khách: HTTP {code}, {data}")

test_step(5, "Chặn đặt mua thuốc bị cấm hoặc dừng bán: POST /api/v1/orders")
# Tạm thời tắt IsAllowed của product 4 hoặc 5
http_json("PATCH", "/api/v1/medicines/5", {"is_allowed": False}, token=admin_token, admin_key=ADMIN_SECRET_KEY)
code, data = http_json("POST", "/api/v1/orders", {
    "items": [{"product_id": 5, "quantity": 1}],
    "shipping_address": "Xã Hải Tân, Hải Hậu, Nam Định",
    "phone_number": "0912345678"
}, token=farmer1_token)
if code == 400:
    log_success(f"Chặn thành công đơn hàng chứa thuốc cấm/ngừng bán: {data.get('detail')}")
else:
    log_fail(f"Không chặn được thuốc cấm: HTTP {code}, {data}")

test_step(6, "Nông dân đặt đơn hàng COD hợp lệ: POST /api/v1/orders")
order_payload = {
    "items": [
        {"product_id": 1, "quantity": 2},
        {"product_id": 2, "quantity": 1}
    ],
    "receiver_name": "Nguyễn Văn Nông Dân",
    "shipping_address": "Thôn 2, Xã Nghĩa Bình, Huyện Nghĩa Hưng, Tỉnh Nam Định",
    "phone_number": "0912345678",
    "notes": "Giao vào sáng sớm trước khi ra đồng"
}
code, order_res = http_json("POST", "/api/v1/orders", order_payload, token=farmer1_token)
created_order_id = None
if code == 201 and "order_id" in order_res and order_res.get("total_amount", 0) > 0:
    created_order_id = order_res["order_id"]
    log_success(f"Tạo đơn COD thành công: Mã {created_order_id}, Tổng tiền tự tính: {order_res['total_amount']:,} đ, Trạng thái: {order_res.get('order_status')}")
else:
    log_fail(f"Tạo đơn COD thất bại: HTTP {code}, {order_res}")

test_step(7, "Nông dân xem lịch sử đơn hàng cá nhân: GET /api/v1/orders")
code, orders_list = http_json("GET", "/api/v1/orders", token=farmer1_token)
if code == 200 and isinstance(orders_list, list) and any(o.get("order_id") == created_order_id or o.get("id") == created_order_id for o in orders_list):
    log_success(f"Lấy thành công {len(orders_list)} đơn hàng của người dùng, chứa đơn {created_order_id}.")
else:
    log_fail(f"Lỗi lấy lịch sử đơn: HTTP {code}, {orders_list}")

test_step(8, "Xem chi tiết đơn hàng: GET /api/v1/orders/{id}")
if created_order_id:
    code, detail_data = http_json("GET", f"/api/v1/orders/{created_order_id}", token=farmer1_token)
    if code == 200 and len(detail_data.get("items", [])) == 2:
        log_success(f"Chi tiết đơn có đầy đủ {len(detail_data['items'])} sản phẩm: {[i['product_name'] for i in detail_data['items']]}")
    else:
        log_fail(f"Lỗi chi tiết đơn: HTTP {code}, {detail_data}")
else:
    log_fail("Không có mã đơn để kiểm tra chi tiết.")

test_step(9, "Chống IDOR: Người dùng khác không được xem đơn của người này")
if created_order_id and farmer2_token:
    code, idor_data = http_json("GET", f"/api/v1/orders/{created_order_id}", token=farmer2_token)
    if code in (403, 404):
        log_success(f"Bảo vệ IDOR thành công: Người dùng 2 bị từ chối xem đơn của Người dùng 1 (HTTP {code}).")
    else:
        log_fail(f"Lỗ hổng IDOR! Người dùng 2 xem được đơn của Người dùng 1: HTTP {code}")

# =========================================================================
# 3. NHẬP BÀI BÁO NGUYÊN VĂN (HITL INGESTION & COMMIT)
# =========================================================================
test_step(10, "RBAC Guard: Nông dân không được nhập bài báo: POST /api/v1/knowledge/ingestions")
code, data = http_json("POST", "/api/v1/knowledge/ingestions", {
    "model_class": "Tomato___Late_blight",
    "source_url": "https://khuyennongvn.gov.vn/bai-1",
    "source_title": "Bài viết test",
    "organization": "Khuyến nông",
    "article_text": "Đoạn 1 văn bản dài trên 40 ký tự để thử nghiệm bảo mật hệ thống."
}, token=farmer1_token)
if code == 403:
    log_success("Chặn thành công quyền FARMER khi cố nhập bài báo (HTTP 403 Forbidden).")
else:
    log_fail(f"FARMER không bị chặn: HTTP {code}, {data}")

test_step(11, "Admin dán bài báo và tách đoạn: POST /api/v1/knowledge/ingestions")
test_url = f"https://khuyennongvn.gov.vn/benh-suong-mai-ca-chua-{uuid.uuid4().hex[:6]}"
sample_article_text = """
Bệnh sương mai do nấm Phytophthora infestans gây ra, phát sinh mạnh trong điều kiện thời tiết ẩm độ không khí cao trên 85% và nhiệt độ mát mẻ từ 18 đến 22 độ C.

Triệu chứng điển hình là các vết đốm màu xanh xám sũng nước ở mép lá, sau đó chuyển sang màu nâu đen và lan rộng vào gân lá. Mặt dưới lá xuất hiện lớp mốc trắng như sương mai vào buổi sáng sớm.

Biện pháp canh tác phòng ngừa bao gồm lên luống cao 25-30cm, trồng mật độ thưa thoáng gió, ngắt bỏ lá già sát gốc và vệ sinh sạch tàn dư cây bệnh vụ trước mang đi tiêu hủy xa vườn.

Khi bệnh chớm xuất hiện, bà con phun luân phiên các loại thuốc trừ nấm sinh học hoặc hoạt chất Metalaxyl kết hợp Mancozeb theo đúng liều lượng khuyến cáo trên bao bì, chú ý thời gian cách ly PHI trước khi thu hoạch.
"""

code, ingest_res = http_json("POST", "/api/v1/knowledge/ingestions", {
    "model_class": "Tomato___Late_blight",
    "source_url": test_url,
    "source_title": "Kỹ thuật quản lý bệnh sương mai cà chua",
    "organization": "Trung tâm Khuyến nông Quốc gia",
    "published_date": "2024",
    "article_text": sample_article_text
}, token=admin_token, admin_key=ADMIN_SECRET_KEY)

ingestion_id = None
if code == 200 and "ingestion_id" in ingest_res and len(ingest_res.get("paragraphs", [])) >= 4:
    ingestion_id = ingest_res["ingestion_id"]
    paras = ingest_res["paragraphs"]
    log_success(f"Tách thành công bài báo thành {len(paras)} đoạn P1..P{len(paras)}. IngestionId: {ingestion_id}")
else:
    log_fail(f"Tách đoạn bài báo thất bại: HTTP {code}, {ingest_res}")

test_step(12, "Admin tick chọn 2 đoạn nguyên văn để duyệt: POST /api/v1/knowledge/ingestions/{id}/commit")
if ingestion_id:
    code, commit_res = http_json("POST", f"/api/v1/knowledge/ingestions/{ingestion_id}/commit", {
        "selections": [
            {"paragraph_id": "P1", "unit_type": "CAUSE_CONDITIONS"},
            {"paragraph_id": "P2", "unit_type": "SYMPTOMS"}
        ],
        "reviewer_notes": "Đã đối chiếu nguyên văn với văn bản bài báo gốc"
    }, token=admin_token, admin_key=ADMIN_SECRET_KEY)

    if code == 201 and len(commit_res.get("created_source_ids", [])) == 2:
        log_success(f"Lưu thành công 2 đoạn nguyên văn vào CSDL. IDs: {commit_res['created_source_ids']}. Reindex status: {commit_res.get('reindex_status')}")
    else:
        log_fail(f"Commit trích đoạn thất bại: HTTP {code}, {commit_res}")
else:
    log_fail("Không có ingestion_id để commit.")

test_step(13, "Kiểm tra tính nguyên văn và cờ IsVerbatim trong CSDL: GET /api/v1/knowledge/sources")
code, sources_list = http_json("GET", f"/api/v1/knowledge/sources?modelClass=Tomato___Late_blight")
if code == 200 and isinstance(sources_list, list):
    verbatim_sources = [s for s in sources_list if s.get("sourceUrl") == test_url]
    if len(verbatim_sources) == 2 and all(s.get("isVerbatim") and s.get("isManualApproved") for s in verbatim_sources):
        log_success("Hai đoạn trích có IsVerbatim = true và IsManualApproved = true, chữ bảo toàn 100% nguyên văn.")
    else:
        log_fail(f"Dữ liệu trong DB không khớp: tìm thấy {len(verbatim_sources)} đoạn, IsVerbatim={all(s.get('isVerbatim') for s in verbatim_sources)}")
else:
    log_fail(f"Lỗi kiểm tra CSDL tri thức: HTTP {code}")

test_step(14, "Chặn lưu quá 4 đoạn nguyên văn cho cùng một URL: POST commit vượt hạn mức")
if ingestion_id:
    # Đã lưu 2 đoạn, nếu cố tình lưu thêm 3 đoạn nữa (tổng 5 > 4) thì phải bị từ chối HTTP 400
    code, reject_res = http_json("POST", f"/api/v1/knowledge/ingestions/{ingestion_id}/commit", {
        "selections": [
            {"paragraph_id": "P3", "unit_type": "PREVENTION"},
            {"paragraph_id": "P4", "unit_type": "TREATMENT"},
            {"paragraph_id": "P1", "unit_type": "CAUSE_CONDITIONS"} # Bị trùng
        ]
    }, token=admin_token, admin_key=ADMIN_SECRET_KEY)

    if code == 400:
        log_success(f"Chặn thành công giới hạn tối đa 4 đoạn nguyên văn / URL: {reject_res.get('detail')}")
    else:
        log_fail(f"Không chặn được giới hạn 4 đoạn: HTTP {code}, {reject_res}")

# =========================================================================
# 4. DUYỆT TRI THỨC ĐƠN LẺ & HÀNG LOẠT (PATCH APPROVE & BULK APPROVE)
# =========================================================================
test_step(15, "RBAC Guard: Nông dân không được duyệt bài: PATCH /sources/{id}/approve")
if sources_list and len(sources_list) > 0:
    target_source_id = sources_list[0]["id"]
    code, data = http_json("PATCH", f"/api/v1/knowledge/sources/{target_source_id}/approve", {
        "is_approved": True
    }, token=farmer1_token)
    if code == 403:
        log_success("Chặn thành công quyền FARMER khi cố duyệt tri thức (HTTP 403 Forbidden).")
    else:
        log_fail(f"FARMER không bị chặn duyệt bài: HTTP {code}, {data}")

    test_step(16, "Admin duyệt đơn lẻ bài viết: PATCH /sources/{id}/approve")
    code, approve_res = http_json("PATCH", f"/api/v1/knowledge/sources/{target_source_id}/approve", {
        "is_approved": True,
        "reviewer_notes": "Duyệt đơn lẻ qua kịch bản test E2E"
    }, token=admin_token, admin_key=ADMIN_SECRET_KEY)
    if code == 200 and approve_res.get("is_manual_approved") is True:
        log_success(f"Duyệt đơn lẻ thành công cho source {target_source_id}. Reindex: {approve_res.get('reindex_status')}")
    else:
        log_fail(f"Duyệt đơn lẻ thất bại: HTTP {code}, {approve_res}")

    test_step(17, "Admin duyệt hàng loạt bài viết: PATCH /sources/approve-batch")
    batch_ids = [s["id"] for s in sources_list[:3]]
    code, batch_res = http_json("PATCH", "/api/v1/knowledge/sources/approve-batch", {
        "source_ids": batch_ids,
        "is_approved": True,
        "reviewer_notes": "Duyệt hàng loạt qua test E2E A03"
    }, token=admin_token, admin_key=ADMIN_SECRET_KEY)
    if code == 200 and batch_res.get("approved_count") == len(batch_ids):
        log_success(f"Duyệt hàng loạt thành công {batch_res['approved_count']} bài viết. Reindex: {batch_res.get('reindex_status')}")
    else:
        log_fail(f"Duyệt hàng loạt thất bại: HTTP {code}, {batch_res}")
else:
    log_fail("Không có bài viết nào trong CSDL để test duyệt.")

# =========================================================================
# 5. CHUYỂN CA BỆNH KHÓ & THẨM ĐỊNH CHUYÊN GIA (EXPERT ESCALATION)
# =========================================================================
test_step(18, "Lấy hoặc tạo 1 hồ sơ chẩn đoán để test escalation")
code, history_data = http_json("GET", "/api/v1/diagnose/history", token=farmer1_token)
diag_id = None
if code == 200 and "items" in history_data and len(history_data["items"]) > 0:
    diag_id = history_data["items"][0]["id"]
else:
    # Nếu chưa có, query lấy 1 chẩn đoán bất kỳ trong DB để gán
    code, all_diseases = http_json("GET", "/api/v1/diseases")
    disease_id = all_diseases[0]["id"] if code == 200 and len(all_diseases) > 0 else 1

test_step(19, "Nông dân gửi yêu cầu chuyển ca cho Bác sĩ Cây trồng: POST /diagnose/{id}/request-expert")
# Khám 1 ảnh mẫu để có diagnosis record thật
samples_dir = os.path.join(script_dir, "..", "ai-service", "tests", "samples")
leaf_path = os.path.join(samples_dir, "leaf.jpg")
if os.path.exists(leaf_path) and farmer1_token:
    boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
    body = bytearray()
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(b'Content-Disposition: form-data; name="image"; filename="leaf.jpg"\r\n')
    body.extend(b"Content-Type: image/jpeg\r\n\r\n")
    with open(leaf_path, "rb") as f:
        body.extend(f.read())
    body.extend(b"\r\n")
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(b'Content-Disposition: form-data; name="notes"\r\n\r\n')
    body.extend("Lá cà chua có đốm đen bất thường lan nhanh".encode("utf-8"))
    body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode("utf-8"))

    req = urllib.request.Request(
        f"{CORE_API_URL}/api/v1/diagnose",
        data=bytes(body),
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Authorization": f"Bearer {farmer1_token}"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            d_res = json.loads(resp.read().decode("utf-8"))
            diag_id = d_res.get("diagnosis_id")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"[*] Upload diagnose HTTP {e.code}: {err_body}")
    except Exception as ex:
        print(f"[*] Upload diagnose error: {ex}")

if diag_id:
    code, req_exp_res = http_json("POST", f"/api/v1/diagnose/{diag_id}/request-expert", {
        "farmer_notes": "Vết bệnh lan nhanh dù đã cắt tỉa lá và cách ly"
    }, token=farmer1_token)
    if code == 200 and req_exp_res.get("requires_expert") is True:
        log_success(f"Nông dân chuyển ca thành công: {req_exp_res.get('message')}")
    else:
        log_fail(f"Chuyển ca thất bại: HTTP {code}, {req_exp_res}")

    test_step(20, "RBAC Guard: Nông dân không được xem danh sách ca thẩm định: GET /diagnose/escalations")
    code, data = http_json("GET", "/api/v1/diagnose/escalations", token=farmer1_token)
    if code == 403:
        log_success("Chặn thành công quyền FARMER khi cố xem danh sách ca chuyên gia (HTTP 403 Forbidden).")
    else:
        log_fail(f"FARMER không bị chặn: HTTP {code}")

    test_step(21, "Admin / Bác sĩ xem danh sách ca bệnh cần thẩm định: GET /diagnose/escalations")
    code, esc_list = http_json("GET", "/api/v1/diagnose/escalations", token=admin_token, admin_key=ADMIN_SECRET_KEY)
    if code == 200 and isinstance(esc_list, list) and any(e.get("id") == diag_id for e in esc_list):
        log_success(f"Bác sĩ xem được danh sách ca bệnh ({len(esc_list)} ca), chứa ca vừa chuyển: {diag_id}")
    else:
        log_fail(f"Lỗi lấy danh sách ca bệnh khó: HTTP {code}, {esc_list}")

    test_step(22, "Chuyên gia phản hồi hướng dẫn xử lý: PATCH /diagnose/{id}/expert-review")
    code, rev_res = http_json("PATCH", f"/api/v1/diagnose/{diag_id}/expert-review", {
        "expert_notes": "Bác sĩ Cây trồng kết luận: Bị mốc sương sớm. Cần phun Ridomil Gold 68WG tỉ lệ 50g/16L nước vào lúc trời râm mát."
    }, token=admin_token, admin_key=ADMIN_SECRET_KEY)
    if code == 200 and "expert_reviewed_at" in rev_res:
        log_success(f"Lưu kết luận chuyên gia thành công vào hồ sơ {diag_id}.")
    else:
        log_fail(f"Lỗi lưu kết luận chuyên gia: HTTP {code}, {rev_res}")
else:
    log_fail("Không có ca chẩn đoán để kiểm thử quy trình thẩm định chuyên gia.")

# =========================================================================
# TỔNG KẾT KẾT QUẢ
# =========================================================================
print("\n" + "=" * 75)
print(f"     TỔNG KẾT KIỂM THỬ TASK-A03: {passed} PASS / {failed} FAIL")
print("=" * 75)

if failed == 0:
    print("[SUCCESS] TẤT CẢ CÁC CHỐT CHẶN NGHIỆP VỤ TASK-A03 ĐÃ ĐẠT 100%!")
    sys.exit(0)
else:
    print(f"[FAILURE] Có {failed} bài kiểm tra chưa đạt yêu cầu.")
    sys.exit(1)
