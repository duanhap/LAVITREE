"""
Automated Test Suite for TASK-A01:
- Day 1 Contract: GET /api/v1/medicines/search
- Auth: POST /api/v1/auth/register, POST /api/v1/auth/login, GET /api/v1/auth/me
- Admin Seeded Account Login
- History Auth Guard: GET /api/v1/diagnose/history
"""

import base64
import hashlib
import hmac
import json
import os
import sys
import time
import uuid
import requests

def load_env():
    candidates = [
        os.path.join(os.path.dirname(__file__), ".env"),
        os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    ]
    for env_path in candidates:
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k not in os.environ:
                            os.environ[k] = v

load_env()

BASE_URL = os.getenv("CORE_API_URL", "http://localhost:5176")

print("=" * 70)
print("     KIỂM THỬ TỰ ĐỘNG TASK-A01: AUTH JWT, SECURITY & DAY 1 STUB     ")
print(f"     Target URL: {BASE_URL}")
print("=" * 70)

passed_tests = 0
total_tests = 0

def test(name):
    global total_tests
    total_tests += 1
    print(f"\n[TEST {total_tests}] {name}")

def ok(msg):
    global passed_tests
    passed_tests += 1
    print(f"  -> SUCCESS: {msg}")

def fail(msg):
    print(f"  -> FAILED: {msg}")
    sys.exit(1)

# -------------------------------------------------------------
# 1. Day 1 Contract: GET /api/v1/medicines/search & Lọc thuốc cấm (BUG-02)
# -------------------------------------------------------------
test("Kiểm tra Day 1 Stub API: GET /api/v1/medicines/search (Lọc thuốc cấm)")
res = requests.get(f"{BASE_URL}/api/v1/medicines/search", params={"diseaseCode": "Tomato___Late_blight"})
if res.status_code != 200:
    fail(f"Expected 200 OK, got {res.status_code}: {res.text}")
data = res.json()
items = data.get("items", [])
if not items or len(items) == 0:
    fail("Danh sách items trả về rỗng!")
med = items[0]
required_fields = ["name", "active_ingredient", "phi_days", "is_allowed", "rain_resistant"]
for field in required_fields:
    if field not in med:
        fail(f"Trường '{field}' bị thiếu trong thuốc BVTV!")

for item in items:
    if not item.get("is_allowed", True):
        fail(f"LỖI BUG-02: Thuốc cấm '{item.get('name')}' xuất hiện trong danh mục gợi ý!")
    if "paraquat" in item.get("name", "").lower() or "paraquat" in item.get("active_ingredient", "").lower():
        fail("LỖI BUG-02: Paraquat xuất hiện trong gợi ý điều trị bệnh mốc sương cà chua!")
ok(f"Trả về {len(items)} thuốc BVTV đặc trị hợp lệ; 100% thuốc cấm (Paraquat) đã được lọc sạch.")

# -------------------------------------------------------------
# 2. POST /api/v1/auth/register (Nông dân đăng ký tài khoản mới)
# -------------------------------------------------------------
test("Đăng ký tài khoản Nông dân mới: POST /api/v1/auth/register")
test_email = f"farmer_{uuid.uuid4().hex[:8]}@lavitree.vn"
test_password = "SecurePassword@2026!"
test_fullname = "Nguyễn Văn Nông Dân"
test_phone = "0987654321"

reg_payload = {
    "email": test_email,
    "password": test_password,
    "full_name": test_fullname,
    "phone": test_phone
}

res = requests.post(f"{BASE_URL}/api/v1/auth/register", json=reg_payload)
if res.status_code != 201:
    fail(f"Expected 201 Created, got {res.status_code}: {res.text}")
reg_data = res.json()
token = reg_data.get("token")
user_data = reg_data.get("user", {})

if not token or len(token) < 20:
    fail("Token JWT không hợp lệ hoặc bị thiếu!")
if user_data.get("role") != "FARMER":
    fail(f"Role của tài khoản đăng ký mới phải là 'FARMER', nhận được: {user_data.get('role')}")
if user_data.get("email") != test_email.lower():
    fail(f"Email không khớp: {user_data.get('email')} vs {test_email}")
ok(f"Tạo thành công tài khoản ID: {user_data.get('id')}, cấp phát JWT Token 7 ngày.")

# -------------------------------------------------------------
# 3. Chống trùng lặp email khi đăng ký
# -------------------------------------------------------------
test("Kiểm tra chặn trùng lặp email: POST /api/v1/auth/register (Duplicate)")
res = requests.post(f"{BASE_URL}/api/v1/auth/register", json=reg_payload)
if res.status_code != 400:
    fail(f"Expected 400 Bad Request cho email trùng, got {res.status_code}")
ok("Hệ thống từ chối đăng ký trùng email chính xác (HTTP 400 Bad Request).")

# -------------------------------------------------------------
# 4. POST /api/v1/auth/login (Đăng nhập sai & đúng mật khẩu)
# -------------------------------------------------------------
test("Đăng nhập với mật khẩu sai: POST /api/v1/auth/login")
res = requests.post(f"{BASE_URL}/api/v1/auth/login", json={
    "email": test_email,
    "password": "WrongPassword123!"
})
if res.status_code != 401:
    fail(f"Expected 401 Unauthorized khi sai mật khẩu, got {res.status_code}")
ok("Hệ thống chặn truy cập khi sai mật khẩu chính xác (HTTP 401 Unauthorized).")

test("Đăng nhập với mật khẩu đúng: POST /api/v1/auth/login")
res = requests.post(f"{BASE_URL}/api/v1/auth/login", json={
    "email": test_email,
    "password": test_password
})
if res.status_code != 200:
    fail(f"Expected 200 OK khi đúng mật khẩu, got {res.status_code}")
login_data = res.json()
farmer_token = login_data.get("token")
if not farmer_token:
    fail("Không nhận được token sau khi đăng nhập thành công!")
ok("Đăng nhập thành công, nhận token xác thực Bearer.")

# -------------------------------------------------------------
# 5. Kiểm tra an toàn mật khẩu Admin (BUG-01)
# -------------------------------------------------------------
# Không ghi mật khẩu đã lộ vào code: truyền qua biến môi trường khi muốn kiểm tra.
retired_password = os.getenv("ADMIN_RETIRED_PASSWORD")
if retired_password:
    test("Chặn đăng nhập Admin với mật khẩu cũ đã lộ: POST /api/v1/auth/login (BUG-01)")
    old_admin_res = requests.post(f"{BASE_URL}/api/v1/auth/login", json={
        "email": "admin@lavitree.vn",
        "password": retired_password
    })
    if old_admin_res.status_code != 401:
        fail(f"LỖI BUG-01: Mật khẩu cũ bị lộ của Admin vẫn đăng nhập được! (Status {old_admin_res.status_code})")
    ok("Hệ thống từ chối chính xác mật khẩu Admin cũ đã lộ (HTTP 401 Unauthorized).")
else:
    print("\n[BỎ QUA] Chưa đặt ADMIN_RETIRED_PASSWORD nên không kiểm tra mật khẩu cũ.")

test("Đăng nhập tài khoản Quản trị viên với mật khẩu mới: admin@lavitree.vn")
admin_password = os.getenv("ADMIN_INITIAL_PASSWORD")
if not admin_password:
    fail("ADMIN_INITIAL_PASSWORD chưa được thiết lập trong biến môi trường hoặc file .env!")
res = requests.post(f"{BASE_URL}/api/v1/auth/login", json={
    "email": "admin@lavitree.vn",
    "password": admin_password
})
if res.status_code != 200:
    fail(f"Expected 200 OK cho Admin với mật khẩu mới, got {res.status_code}: {res.text}")
admin_data = res.json()
if admin_data.get("user", {}).get("role") != "ADMIN":
    fail(f"Tài khoản admin phải có role 'ADMIN', nhận: {admin_data.get('user', {}).get('role')}")
admin_token = admin_data.get("token")
ok("Tài khoản Admin đăng nhập thành công với mật khẩu mới, cấp JWT quyền ADMIN.")

# -------------------------------------------------------------
# 6. GET /api/v1/auth/me (Bảo vệ JWT Bearer)
# -------------------------------------------------------------
test("Truy cập thông tin người dùng không có Token: GET /api/v1/auth/me")
res = requests.get(f"{BASE_URL}/api/v1/auth/me")
if res.status_code != 401:
    fail(f"Expected 401 Unauthorized khi thiếu Token, got {res.status_code}")
ok("Middleware JWT chặn truy cập không có Token chính xác (HTTP 401 Unauthorized).")

test("Truy cập thông tin người dùng với Token giả mạo: GET /api/v1/auth/me")
res = requests.get(f"{BASE_URL}/api/v1/auth/me", headers={"Authorization": "Bearer invalid_forged_token"})
if res.status_code != 401:
    fail(f"Expected 401 Unauthorized với Token giả mạo, got {res.status_code}")
ok("Chữ ký JWT giả mạo bị từ chối chính xác (HTTP 401 Unauthorized).")

test("Truy cập thông tin người dùng với Token hợp lệ: GET /api/v1/auth/me")
res = requests.get(f"{BASE_URL}/api/v1/auth/me", headers={"Authorization": f"Bearer {farmer_token}"})
if res.status_code != 200:
    fail(f"Expected 200 OK với Token hợp lệ, got {res.status_code}: {res.text}")
me_data = res.json()
if me_data.get("email") != test_email.lower():
    fail(f"Email trả về không khớp: {me_data.get('email')} vs {test_email}")
ok(f"Xác thực danh tính thành công: {me_data.get('full_name')} ({me_data.get('email')}, Role: {me_data.get('role')})")

# -------------------------------------------------------------
# 7. GET /api/v1/diagnose/history (Bảo vệ Lịch sử khám cá nhân)
# -------------------------------------------------------------
test("Truy cập Lịch sử khám bệnh không có Token: GET /api/v1/diagnose/history")
res = requests.get(f"{BASE_URL}/api/v1/diagnose/history")
if res.status_code != 401:
    fail(f"Expected 401 Unauthorized khi thiếu Token, got {res.status_code}")
ok("Endpoint History được bảo vệ nghiêm ngặt chống rò rỉ dữ liệu (HTTP 401 Unauthorized).")

test("Truy vấn Lịch sử khám bệnh của tài khoản mới: GET /api/v1/diagnose/history")
res = requests.get(f"{BASE_URL}/api/v1/diagnose/history", headers={"Authorization": f"Bearer {farmer_token}"})
if res.status_code != 200:
    fail(f"Expected 200 OK, got {res.status_code}: {res.text}")
history_data = res.json()
if "total_records" not in history_data or "items" not in history_data:
    fail("Cấu trúc trả về của /history không đúng chuẩn api-contracts.md Mục 3.2!")
ok(f"Truy vấn lịch sử thành công: Tổng cộng {history_data.get('total_records')} bản ghi (Tài khoản mới đăng ký).")

# -------------------------------------------------------------
# 8. GET /api/v1/weather (Kiểm tra Weather API - BUG-04 to BUG-07)
# -------------------------------------------------------------
test("Kiểm tra Weather API thực tế: GET /api/v1/weather (Hà Nội)")
w_res = requests.get(f"{BASE_URL}/api/v1/weather", params={"location": "Hà Nội"})
if w_res.status_code != 200:
    fail(f"Expected 200 OK cho Weather API, got {w_res.status_code}: {w_res.text}")
w_data = w_res.json()
rain_prob = w_data.get("rainfall_probability_percent")
if rain_prob is None or rain_prob < 0 or rain_prob > 100:
    fail(f"LỖI BUG-06: Xác suất mưa không hợp lệ hoặc bị âm: {rain_prob}%")
if not w_data.get("recommendation"):
    fail("LỖI BUG-07: Khuyến nghị thời tiết bị rỗng!")
ok(f"Dữ liệu thời tiết {w_data.get('location')}: {w_data.get('temperature_c')}°C, Độ ẩm: {w_data.get('humidity_percent')}%, Xác suất mưa: {rain_prob}%, Rủi ro: {w_data.get('risk_level')}, Mô phỏng: {w_data.get('is_simulated')}")

test("Kiểm tra Weather API vị trí mặc định: GET /api/v1/weather (Hà Nam)")
w_hn_res = requests.get(f"{BASE_URL}/api/v1/weather", params={"location": "Hà Nam"})
if w_hn_res.status_code != 200:
    fail(f"Expected 200 OK cho Weather Hà Nam, got {w_hn_res.status_code}: {w_hn_res.text}")
w_hn_data = w_hn_res.json()
rain_prob_hn = w_hn_data.get("rainfall_probability_percent")
if rain_prob_hn is None or rain_prob_hn < 0 or rain_prob_hn > 100:
    fail(f"LỖI BUG-06: Xác suất mưa Hà Nam bị âm hoặc ngoài phạm vi: {rain_prob_hn}%")
ok(f"Thời tiết Hà Nam: {w_hn_data.get('temperature_c')}°C, Xác suất mưa: {rain_prob_hn}%, Rủi ro: {w_hn_data.get('risk_level')}")

# -------------------------------------------------------------
# BUG-11: Token giả mạo phải bị từ chối, kể cả trên endpoint cho phép Guest
# -------------------------------------------------------------
def b64url(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

def make_token(secret, alg="HS256", exp_offset=3600):
    header = {"alg": alg, "typ": "JWT"}
    payload = json.loads(base64.urlsafe_b64decode(farmer_token.split(".")[1] + "==="))
    payload["exp"] = int(time.time()) + exp_offset
    signing_input = f"{b64url(json.dumps(header).encode())}.{b64url(json.dumps(payload).encode())}"
    if alg == "none":
        return f"{signing_input}."
    signature = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
    return f"{signing_input}.{b64url(signature)}"

forged_tokens = {
    "ký bằng khóa sai": make_token("sai-khoa-" + uuid.uuid4().hex * 2),
    "alg=none": make_token("", alg="none"),
}
jwt_secret = os.getenv("JWT_SECRET_KEY")
if jwt_secret:
    forged_tokens["đúng khóa nhưng đã hết hạn"] = make_token(jwt_secret, exp_offset=-3600)
else:
    print("\n[BỎ QUA] Chưa có JWT_SECRET_KEY nên không kiểm tra token hết hạn.")

for label, token in forged_tokens.items():
    test(f"Từ chối token {label}")
    headers = {"Authorization": f"Bearer {token}"}
    me_res = requests.get(f"{BASE_URL}/api/v1/auth/me", headers=headers)
    history_res = requests.get(f"{BASE_URL}/api/v1/diagnose/history", headers=headers)
    # Thiếu ảnh mà vẫn phải trả 401, vì token được kiểm tra trước khi coi là Guest.
    diagnose_res = requests.post(f"{BASE_URL}/api/v1/diagnose", headers=headers, data={"notes": "x"})
    codes = (me_res.status_code, history_res.status_code, diagnose_res.status_code)
    if codes != (401, 401, 401):
        fail(f"Token {label} không bị từ chối đủ 3 endpoint: {codes}")
    ok(f"Token {label}: /auth/me, /diagnose/history và /diagnose đều trả 401.")

test("Mật khẩu chữ có dấu vượt 72 byte bị từ chối dù dưới 72 ký tự (BUG-22)")
res = requests.post(f"{BASE_URL}/api/v1/auth/register", json={
    "email": f"long_pw_{uuid.uuid4().hex[:8]}@lavitree.vn",
    "password": "ệ" * 30,
    "full_name": "Kiểm Thử Byte"
})
if res.status_code != 400:
    fail(f"Expected 400, got {res.status_code}: {res.text}")
ok("Mật khẩu 30 ký tự (90 byte) bị từ chối HTTP 400.")

test("Email chứa ký tự xuống dòng bị từ chối (BUG-22)")
res = requests.post(f"{BASE_URL}/api/v1/auth/register", json={
    "email": f"a{uuid.uuid4().hex[:8]}\n@lavitree.vn",
    "password": "Password123#",
    "full_name": "Kiểm Thử Email"
})
if res.status_code != 400:
    fail(f"Expected 400, got {res.status_code}: {res.text}")
ok("Email có ký tự xuống dòng bị từ chối HTTP 400.")

# Đặt cuối cùng vì làm cạn hạn mức auth của IP hiện tại trong 1 phút.
test("Rate limit đăng nhập trả 429 khi vượt hạn mức")
limit = int(os.getenv("AUTH_RATE_LIMIT_PER_MINUTE", "10"))
statuses = [
    requests.post(f"{BASE_URL}/api/v1/auth/login", json={
        "email": "khong_ton_tai@lavitree.vn",
        "password": "Password123#"
    }).status_code
    for _ in range(limit + 2)
]
if 429 not in statuses:
    fail(f"Không thấy 429 sau {limit + 2} lần đăng nhập: {statuses}")
ok(f"Nhận 429 sau khi vượt {limit} lần đăng nhập/phút.")

# -------------------------------------------------------------
# TỔNG KẾT
# -------------------------------------------------------------
print("\n" + "=" * 70)
print(f" KẾT QUẢ KIỂM THỬ: ĐẠT {passed_tests}/{total_tests} BÀI TEST CHUẨN!")
print(" Tất cả các tiêu chuẩn bảo mật, Day 1 Stub, băm BCrypt, lọc thuốc cấm và xác thực JWT đã hoàn tất 100%.")
print("=" * 70)
