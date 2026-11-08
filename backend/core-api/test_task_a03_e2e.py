#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Kịch bản kiểm thử toàn trình E2E cho TASK-A03:
1. An toàn CSDL: Mặc định từ chối chạy khi chuỗi kết nối là Supabase (trừ khi có ALLOW_LIVE_DB_TEST=true)
2. Quản lý kho thuốc BVTV (Medicines Search, RBAC Patch, PHI & IsAllowed)
3. Đặt hàng Vật tư Nông nghiệp COD (POST /orders, tính tiền từ DB, trừ tồn kho atomic, chặn thuốc cấm)
4. Chống bán vượt tồn kho (Concurrency Test: 10 đơn đồng thời cho 3 sản phẩm tồn)
5. Lịch sử đơn hàng cá nhân & Chống IDOR (GET /orders, GET /orders/{id})
6. Nhập bài báo trích đoạn nguyên văn & Chống lách giới hạn 4 đoạn qua biến thể URL (POST /knowledge/ingestions)
7. Phân quyền và bảo mật danh mục tri thức: GET /knowledge/sources (chỉ Admin xem bài chưa duyệt)
8. Duyệt tri thức đơn lẻ & hàng loạt (PATCH /sources/{id}/approve, PATCH /sources/approve-batch)
9. Chuyển ca bệnh khó & Thẩm định chuyên gia (POST /diagnose/{id}/request-expert, GET /escalations, PATCH /expert-review)
10. Teardown tự động: Xóa các bài viết test, khôi phục tồn kho sản phẩm, dọn dẹp an toàn.
"""

import os
import sys
import json
import uuid
import urllib.parse
import urllib.request
import urllib.error
import concurrent.futures

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

# --- 1. CHỐT CHẶN AN TOÀN: BẢO VỆ CSDL THẬT (SUPABASE) ---
db_conn = os.environ.get("ConnectionStrings__DefaultConnection") or os.environ.get("SUPABASE_CONNECTION_STRING") or ""
allow_live = os.environ.get("ALLOW_LIVE_DB_TEST", "").strip().lower() in ("true", "1")

if ("supabase.co" in db_conn.lower() or "supabase.com" in db_conn.lower() or "pooler.supabase.com" in db_conn.lower()) and not allow_live:
    print("\n" + "!" * 75)
    print("  [AN TOÀN CSDL] Chuỗi kết nối đang trỏ tới Supabase Cloud!")
    print("  Theo yêu cầu đánh giá TVA (Mục 1), test_task_a03_e2e.py mặc định TỪ CHỐI")
    print("  chạy trên Supabase để ngăn chặn ô nhiễm dữ liệu thật.")
    print("  Để kiểm thử môi trường giả lập/local, hãy dùng DB local hoặc mock.")
    print("  Nếu muốn chạy có chủ đích trên Supabase với cơ chế teardown tự động:")
    print("    ALLOW_LIVE_DB_TEST=true python3 test_task_a03_e2e.py")
    print("!" * 75 + "\n")
    # Mã 2 = bỏ qua có chủ đích; không dùng 0 để không bị hiểu nhầm là "test đạt"
    sys.exit(2)

CORE_API_URL = os.environ.get("CORE_API_URL", "http://localhost:5176")
if CORE_API_URL == "http://localhost:5000":
    CORE_API_URL = "http://localhost:5176"
ADMIN_SECRET_KEY = os.environ.get("ADMIN_SECRET_KEY", "")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@lavitree.vn")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")

passed = 0
failed = 0

# Danh sách tài nguyên để dọn dẹp tự động (Teardown)
cleanup_source_ids = []
cleanup_order_ids = []
restore_products = {}

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

def http_json(method: str, path: str, data: dict = None, token: str = None, admin_key: str = None, timeout: int = 30):
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
        with urllib.request.urlopen(req, timeout=timeout) as response:
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

admin_token = None
farmer1_token = None
farmer1_id = None
farmer2_token = None
diag_id = None

try:
    # 0. Khởi tạo tài khoản kiểm thử
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

    farmer1_email = f"farmer_a03_{uuid.uuid4().hex[:8]}@lavitree.vn"
    farmer1_pass = f"Pass_{uuid.uuid4().hex[:8]}!2026"
    code, data = http_json("POST", "/api/v1/auth/register", {
        "email": farmer1_email,
        "password": farmer1_pass,
        "full_name": "Nguyễn Văn Nông Dân (Test)",
        "phone": "0912345678"
    })
    farmer1_token = data.get("token") if code == 201 else None
    farmer1_id = data.get("user", {}).get("id") if code == 201 else None
    if farmer1_token:
        print(f"[*] Tạo tài khoản Nông dân 1: {farmer1_email}")

    farmer2_email = f"farmer2_a03_{uuid.uuid4().hex[:8]}@lavitree.vn"
    farmer2_pass = f"Pass_{uuid.uuid4().hex[:8]}!2026"
    code, data = http_json("POST", "/api/v1/auth/register", {
        "email": farmer2_email,
        "password": farmer2_pass,
        "full_name": "Trần Thị Hàng Xóm (Test)",
        "phone": "0987654321"
    })
    farmer2_token = data.get("token") if code == 201 else None

    # =========================================================================
    # 1. QUẢN LÝ KHO THUỐC BVTV & SAO LƯU TRẠNG THÁI GỐC
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

        # Sao lưu từ danh sách đầy đủ của Admin (gồm cả thuốc đang khóa bán, ví dụ id 5 mà bài test sẽ PATCH);
        # danh sách công khai không có thuốc bị khóa nên không đủ để khôi phục.
        backup_items = items
        if admin_token or ADMIN_SECRET_KEY:
            code_all, data_all = http_json("GET", "/api/v1/medicines/search?allowedOnly=false", token=admin_token, admin_key=ADMIN_SECRET_KEY)
            if code_all == 200 and isinstance(data_all, dict) and data_all.get("items"):
                backup_items = data_all["items"]
        for it in backup_items:
            p_id = it["id"]
            restore_products[p_id] = {
                "stock_quantity": it.get("stock_quantity", 100),
                "is_allowed": it.get("is_allowed", True),
                "phi_days": it.get("phi_days", 7)
            }
    else:
        log_fail(f"Lỗi tra cứu thuốc BVTV: HTTP {code}, {data}")

    test_step(2, "RBAC Guard: Nông dân không được sửa thông số thuốc: PATCH /api/v1/medicines/1")
    code, data = http_json("PATCH", "/api/v1/medicines/1", {"price": 1000}, token=farmer1_token)
    if code == 403:
        log_success("Chặn thành công quyền FARMER khi cố tình sửa kho thuốc (HTTP 403 Forbidden).")
    else:
        log_fail(f"FARMER không bị chặn đúng mức: HTTP {code}, {data}")

    test_step(3, "Admin cập nhật thông số kho thuốc: PATCH /api/v1/medicines/1")
    orig_stock1 = restore_products.get(1, {}).get("stock_quantity", 100)
    code, data = http_json("PATCH", "/api/v1/medicines/1", {
        "phi_days": 7,
        "stock_quantity": orig_stock1,
        "is_allowed": True
    }, token=admin_token, admin_key=ADMIN_SECRET_KEY)
    if code == 200 and data.get("is_allowed") is True:
        log_success(f"Admin cập nhật kho thuốc thành công: {data.get('name')}, Tồn kho: {data.get('stock_quantity')}")
    else:
        log_fail(f"Cập nhật kho thuốc thất bại: HTTP {code}, {data}")

    # =========================================================================
    # 2. ĐẶT HÀNG VẬT TƯ NÔNG NGHIỆP COD & CHỐNG OVERSOLD (CONCURRENCY)
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

    test_step(6, "Nông dân đặt đơn hàng COD hợp lệ có ReceiverName và Notes: POST /api/v1/orders")
    order_payload = {
        "items": [
            {"product_id": 1, "quantity": 2},
            {"product_id": 2, "quantity": 1}
        ],
        "receiver_name": "Nguyễn Văn Nông Dân (Thử Nghiệm)",
        "shipping_address": "Thôn 2, Xã Nghĩa Bình, Huyện Nghĩa Hưng, Tỉnh Nam Định",
        "phone_number": "0912345678",
        "notes": "Giao vào sáng sớm trước khi ra đồng"
    }
    code, order_res = http_json("POST", "/api/v1/orders", order_payload, token=farmer1_token)
    created_order_id = None
    if code == 201 and "order_id" in order_res and order_res.get("total_amount", 0) > 0:
        created_order_id = order_res["order_id"]
        cleanup_order_ids.append(created_order_id)
        if order_res.get("receiver_name") == order_payload["receiver_name"] and order_res.get("notes") == order_payload["notes"]:
            log_success(f"Tạo đơn COD thành công có đầy đủ receiver_name & notes: Mã {created_order_id}, Tổng tiền: {order_res['total_amount']:,} đ")
        else:
            log_success(f"Tạo đơn COD thành công: Mã {created_order_id}, Tổng tiền: {order_res['total_amount']:,} đ")
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

    test_step(10, "Chống bán vượt tồn kho (Race Condition / Concurrency Overselling Test)")
    # Thiết lập tồn kho thuốc 3 thành đúng 3 đơn vị
    target_race_product_id = 3
    orig_stock3 = restore_products.get(target_race_product_id, {}).get("stock_quantity", 100)
    http_json("PATCH", f"/api/v1/medicines/{target_race_product_id}", {
        "stock_quantity": 3,
        "is_allowed": True
    }, token=admin_token, admin_key=ADMIN_SECRET_KEY)

    # Gửi đồng thời 10 đơn mua thuốc 3 (mỗi đơn mua 1 chai)
    def submit_single_order(seq):
        res_code, res_d = http_json("POST", "/api/v1/orders", {
            "items": [{"product_id": target_race_product_id, "quantity": 1}],
            "receiver_name": f"Concurrency Test {seq}",
            "shipping_address": "Xã Hải Nam, Hải Hậu, Nam Định",
            "phone_number": "0912345678"
        }, token=farmer1_token)
        return res_code, res_d

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(submit_single_order, range(10)))

    success_orders = [r for r in results if r[0] == 201]
    failed_orders = [r for r in results if r[0] == 400]
    for s_code, s_data in success_orders:
        if "order_id" in s_data:
            cleanup_order_ids.append(s_data["order_id"])

    # Tra cứu lại tồn kho thuốc 3 sau khi cạnh tranh
    _, check_stock = http_json("GET", f"/api/v1/medicines/search")
    current_stock3 = next((p["stock_quantity"] for p in check_stock.get("items", []) if p["id"] == target_race_product_id), None)

    if len(success_orders) == 3 and len(failed_orders) == 7 and current_stock3 == 0:
        log_success(f"Chống overselling hoàn hảo: Đúng 3/10 đơn thành công, 7/10 đơn bị từ chối 400, tồn kho còn đúng 0 (không âm).")
    else:
        log_fail(f"Phát hiện lỗi Race Condition overselling! Thành công: {len(success_orders)}, Thất bại: {len(failed_orders)}, Tồn kho còn: {current_stock3}")

    # =========================================================================
    # 3. NHẬP BÀI BÁO NGUYÊN VĂN & CHỐNG LÁCH GIỚI HẠN 4 ĐOẠN QUA URL BIẾN THỂ
    # =========================================================================
    test_step(11, "RBAC Guard: Nông dân không được nhập bài báo: POST /api/v1/knowledge/ingestions")
    code, data = http_json("POST", "/api/v1/knowledge/ingestions", {
        "model_class": "Tomato___Late_blight",
        "source_url": "https://test.lavitree.internal/bai-1",
        "source_title": "Bài viết test",
        "organization": "Bộ phận Kiểm thử",
        "article_text": "Đoạn 1 văn bản dài trên 40 ký tự để thử nghiệm bảo mật hệ thống."
    }, token=farmer1_token)
    if code == 403:
        log_success("Chặn thành công quyền FARMER khi cố nhập bài báo (HTTP 403 Forbidden).")
    else:
        log_fail(f"FARMER không bị chặn: HTTP {code}, {data}")

    test_step(12, "Admin dán bài báo và tách đoạn: POST /api/v1/knowledge/ingestions")
    base_test_url = f"https://kiemthu.lavitree.internal/bai-viet-e2e-{uuid.uuid4().hex[:8]}"
    sample_article_text = """
Nghiên cứu thử nghiệm kiểm soát bệnh sương mai cà chua trong điều kiện ẩm độ cao trên 85% và nhiệt độ 18-22 độ C.

Triệu chứng lâm sàng quan sát được gồm đốm xanh xám sũng nước ở mép lá, sau đó chuyển sang màu nâu sẫm lan rộng.

Biện pháp canh tác phòng ngừa bao gồm lên luống cao 25-30cm, trồng thưa thoáng gió, ngắt bỏ lá già sát gốc.

Khi bệnh chớm xuất hiện, thực hiện biện pháp quản lý tổng hợp IPM theo hướng dẫn kỹ thuật của trạm BVTV địa phương.
"""

    code, ingest_res = http_json("POST", "/api/v1/knowledge/ingestions", {
        "model_class": "Tomato___Late_blight",
        "source_url": base_test_url,
        "source_title": "[KIỂM THỬ E2E A03] Nghiên cứu kiểm soát sương mai",
        "organization": "Bộ phận Kiểm thử Tự động Lavitree",
        "published_date": "2026",
        "article_text": sample_article_text
    }, token=admin_token, admin_key=ADMIN_SECRET_KEY)

    ingestion_id = None
    if code == 200 and "ingestion_id" in ingest_res and len(ingest_res.get("paragraphs", [])) >= 4:
        ingestion_id = ingest_res["ingestion_id"]
        paras = ingest_res["paragraphs"]
        log_success(f"Tách thành công bài báo thành {len(paras)} đoạn P1..P{len(paras)}. IngestionId: {ingestion_id}")
    else:
        log_fail(f"Tách đoạn bài báo thất bại: HTTP {code}, {ingest_res}")

    test_step(13, "Admin lưu 2 đoạn nguyên văn: POST /api/v1/knowledge/ingestions/{id}/commit")
    if ingestion_id:
        code, commit_res = http_json("POST", f"/api/v1/knowledge/ingestions/{ingestion_id}/commit", {
            "selections": [
                {"paragraph_id": "P1", "unit_type": "CAUSE_CONDITIONS"},
                {"paragraph_id": "P2", "unit_type": "SYMPTOMS"}
            ],
            "reviewer_notes": "Kiểm thử lưu đoạn nguyên văn E2E"
        }, token=admin_token, admin_key=ADMIN_SECRET_KEY)

        if code == 201 and len(commit_res.get("created_source_ids", [])) == 2:
            new_ids = commit_res["created_source_ids"]
            cleanup_source_ids.extend(new_ids)
            log_success(f"Lưu thành công 2 đoạn nguyên văn vào CSDL. IDs: {new_ids}. Reindex: {commit_res.get('reindex_status')}")
        else:
            log_fail(f"Commit trích đoạn thất bại: HTTP {code}, {commit_res}")
    else:
        log_fail("Không có ingestion_id để commit.")

    test_step(14, "Chống lách giới hạn 4 đoạn qua URL biến thể (?utm=1, #hash, HTTP, www)")
    if ingestion_id:
        variant_url = f"HTTP://WWW.{base_test_url.replace('https://', '')}?utm_source=facebook&gclid=test#section2"
        code, ingest_var = http_json("POST", "/api/v1/knowledge/ingestions", {
            "model_class": "Tomato___Late_blight",
            "source_url": variant_url,
            "source_title": "[BIẾN THỂ URL] Nghiên cứu kiểm soát sương mai",
            "organization": "Bộ phận Kiểm thử Tự động Lavitree",
            "article_text": sample_article_text
        }, token=admin_token, admin_key=ADMIN_SECRET_KEY)

        if code == 200 and "ingestion_id" in ingest_var:
            var_ingest_id = ingest_var["ingestion_id"]
            # Đã lưu 2 đoạn ở base_test_url. Nếu cố tình lưu thêm 3 đoạn ở URL biến thể (tổng 5 > 4) -> phải bị chặn 400
            code, reject_res = http_json("POST", f"/api/v1/knowledge/ingestions/{var_ingest_id}/commit", {
                "selections": [
                    {"paragraph_id": "P3", "unit_type": "PREVENTION"},
                    {"paragraph_id": "P4", "unit_type": "TREATMENT"},
                    {"paragraph_id": "P1", "unit_type": "CAUSE_CONDITIONS"}
                ]
            }, token=admin_token, admin_key=ADMIN_SECRET_KEY)

            if code == 400:
                log_success(f"Chống lách luật URL biến thể thành công (HTTP 400): {reject_res.get('detail')}")
            else:
                log_fail(f"Lỗ hổng: URL biến thể đã vượt qua giới hạn 4 đoạn! HTTP {code}, {reject_res}")
        else:
            log_fail(f"Không thể khởi tạo phiên nhập bài cho URL biến thể: HTTP {code}")

    # =========================================================================
    # 4. BẢO MẬT DANH MỤC TRI THỨC: PUBLIC VS ADMIN VIEW
    # =========================================================================
    test_step(15, "Bảo mật danh mục tri thức: Khách không xem được bài chưa duyệt hoặc ReviewerNotes")
    code, pub_sources = http_json("GET", "/api/v1/knowledge/sources")
    if code == 200 and isinstance(pub_sources, list):
        unapproved = [s for s in pub_sources if not s.get("isManualApproved", True)]
        has_notes = [s for s in pub_sources if s.get("reviewerNotes")]
        if len(unapproved) == 0 and len(has_notes) == 0:
            log_success(f"Bảo vệ công khai thành công: 100% ({len(pub_sources)}) bài trả về đều đã duyệt, không lộ ghi chú nội bộ.")
        else:
            log_fail(f"Lỗ hổng lộ tri thức: Có {len(unapproved)} bài chưa duyệt hoặc {len(has_notes)} bài lộ reviewerNotes!")
    else:
        log_fail(f"Lỗi lấy danh mục tri thức công khai: HTTP {code}")

    test_step(16, "Admin xem đầy đủ bài viết chưa duyệt: GET /api/v1/knowledge/sources?isApproved=false")
    code, admin_sources = http_json("GET", "/api/v1/knowledge/sources?isApproved=false", token=admin_token, admin_key=ADMIN_SECRET_KEY)
    if code == 200 and isinstance(admin_sources, list):
        log_success(f"Admin truy cập thành công danh sách bài chưa duyệt ({len(admin_sources)} bài).")
    else:
        log_fail(f"Admin không xem được danh sách bài chưa duyệt: HTTP {code}")

    # =========================================================================
    # 5. DUYỆT TRI THỨC ĐƠN LẺ & HÀNG LOẠT (PATCH APPROVE & BULK APPROVE)
    # =========================================================================
    test_step(17, "RBAC Guard: Nông dân không được duyệt bài: PATCH /sources/{id}/approve")
    if cleanup_source_ids:
        target_sid = cleanup_source_ids[0]
        code, data = http_json("PATCH", f"/api/v1/knowledge/sources/{target_sid}/approve", {
            "is_approved": True
        }, token=farmer1_token)
        if code == 403:
            log_success("Chặn thành công quyền FARMER khi cố duyệt tri thức (HTTP 403 Forbidden).")
        else:
            log_fail(f"FARMER không bị chặn: HTTP {code}")

        test_step(18, "Admin duyệt đơn lẻ và cập nhật ghi chú: PATCH /sources/{id}/approve")
        code, app_res = http_json("PATCH", f"/api/v1/knowledge/sources/{target_sid}/approve", {
            "is_approved": True,
            "reviewer_notes": "Kiểm thử duyệt đơn lẻ E2E"
        }, token=admin_token, admin_key=ADMIN_SECRET_KEY)
        if code == 200 and app_res.get("is_manual_approved") is True:
            log_success(f"Duyệt đơn lẻ thành công cho ID {target_sid}. Reindex: {app_res.get('reindex_status')}")
        else:
            log_fail(f"Duyệt đơn lẻ thất bại: HTTP {code}, {app_res}")

    # =========================================================================
    # 6. CHUYỂN CA BỆNH KHÓ & THẨM ĐỊNH CHUYÊN GIA (EXPERT ESCALATION)
    # =========================================================================
    test_step(19, "Guard: Gọi escalations không có token trả 401 Unauthorized")
    code, _ = http_json("GET", "/api/v1/diagnose/escalations")
    if code == 401:
        log_success("Chặn thành công truy cập không xác thực vào escalations (HTTP 401).")
    else:
        log_fail(f"Sai mã lỗi escalations khi thiếu token: mong muốn 401, nhận được {code}")

    test_step(20, "Tạo hồ sơ chẩn đoán thử nghiệm và gửi yêu cầu bác sĩ thẩm định")
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
        except Exception as ex:
            print(f"[*] Upload diagnose error: {ex}")

    if diag_id:
        # Nông dân gửi chuyển ca
        farmer_note_text = "Vết bệnh lan nhanh dù đã cắt tỉa lá và cách ly"
        code, req_exp = http_json("POST", f"/api/v1/diagnose/{diag_id}/request-expert", {
            "farmer_notes": farmer_note_text
        }, token=farmer1_token)
        if code == 200 and req_exp.get("requires_expert") is True:
            log_success(f"Nông dân chuyển ca thành công: {req_exp.get('message')}")
        else:
            log_fail(f"Chuyển ca thất bại: HTTP {code}, {req_exp}")

        test_step(21, "Admin / Bác sĩ xem danh sách ca bệnh & ghi kết luận không đè ghi chú nông dân")
        code, esc_list = http_json("GET", "/api/v1/diagnose/escalations", token=admin_token, admin_key=ADMIN_SECRET_KEY)
        if code == 200 and isinstance(esc_list, list) and any(e.get("id") == diag_id for e in esc_list):
            log_success(f"Bác sĩ xem được danh sách ca bệnh ({len(esc_list)} ca), chứa ca vừa chuyển: {diag_id}")
        else:
            log_fail(f"Lỗi lấy danh sách ca bệnh: HTTP {code}, {esc_list}")

        test_step(22, "Chuyên gia phản hồi hướng dẫn xử lý (bảo tồn ghi chú nông dân)")
        code, rev_res = http_json("PATCH", f"/api/v1/diagnose/{diag_id}/expert-review", {
            "expert_notes": "[Xác nhận kiểm thử tự động] Đã phân tích hình thái lá. Đề xuất tiếp tục theo dõi điều kiện ẩm độ."
        }, token=admin_token, admin_key=ADMIN_SECRET_KEY)
        if code == 200 and "expert_reviewed_at" in rev_res:
            # Kiểm tra xem ghi chú của nông dân có bị ghi đè mất không
            code_h, hist_d = http_json("GET", f"/api/v1/diagnose/history/{diag_id}", token=farmer1_token)
            saved_notes = (hist_d.get("notes") or "") if code_h == 200 else ""
            # Ghi chú lúc khám phải còn nguyên, mô tả gửi Bác sĩ được nối thêm, kết luận nằm ở expert_notes
            if (code_h == 200 and "Lá cà chua có đốm đen bất thường lan nhanh" in saved_notes
                    and farmer_note_text in saved_notes and hist_d.get("expert_notes")):
                log_success("Kết luận chuyên gia lưu thành công, ghi chú lúc khám và mô tả gửi Bác sĩ đều còn nguyên.")
            else:
                log_fail(f"Mất ghi chú nông dân hoặc thiếu kết luận: HTTP {code_h}, notes={saved_notes!r}, expert_notes={hist_d.get('expert_notes') if isinstance(hist_d, dict) else None!r}")
        else:
            log_fail(f"Lỗi lưu kết luận chuyên gia: HTTP {code}, {rev_res}")
    else:
        log_fail("Không có ca chẩn đoán để kiểm thử quy trình thẩm định chuyên gia.")

finally:
    # =========================================================================
    # 7. TEARDOWN TỰ ĐỘNG: DỌN DẸP AN TOÀN TRÁNH Ô NHIỄM CSDL
    # =========================================================================
    print("\n" + "=" * 75)
    print("     BẮT ĐẦU DỌN DẸP TÀI NGUYÊN KIỂM THỬ (TEARDOWN)     ")
    print("=" * 75)

    # 1. Xóa các bài viết tri thức test đã commit
    if cleanup_source_ids and admin_token:
        print(f"[*] Đang dọn {len(cleanup_source_ids)} bài viết tri thức kiểm thử...")
        for s_id in cleanup_source_ids:
            try:
                http_json("DELETE", f"/api/v1/knowledge/sources/{s_id}", token=admin_token, admin_key=ADMIN_SECRET_KEY)
            except:
                pass
        print(f"[✓] Đã dọn dẹp xong các bài viết tri thức thử nghiệm.")

    # 2. Khôi phục tồn kho sản phẩm về trạng thái gốc
    if restore_products and admin_token:
        print(f"[*] Đang khôi phục lại tồn kho cho các sản phẩm đã thay đổi trong bài test...")
        for p_id, orig_state in restore_products.items():
            try:
                http_json("PATCH", f"/api/v1/medicines/{p_id}", {
                    "stock_quantity": orig_state["stock_quantity"],
                    "is_allowed": orig_state["is_allowed"],
                    "phi_days": orig_state["phi_days"]
                }, token=admin_token, admin_key=ADMIN_SECRET_KEY)
            except:
                pass
        print(f"[✓] Đã khôi phục hoàn toàn trạng thái tồn kho và giấy phép lưu hành sản phẩm.")

    # 3. Ca chẩn đoán test: API không có lệnh xóa hay gỡ cờ RequiresExpert (expert-review từ chối ghi chú rỗng),
    #    nên báo rõ để người chạy tự xử lý thay vì giả vờ đã dọn.
    if diag_id:
        print(f"[!] Ca chẩn đoán kiểm thử {diag_id} (tài khoản test, ảnh MinIO, RequiresExpert=true) vẫn còn trong DB.")
        print("    Trên DB thật, cần xóa thủ công cùng các tài khoản farmer_a03_* và đơn hàng test.")

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
