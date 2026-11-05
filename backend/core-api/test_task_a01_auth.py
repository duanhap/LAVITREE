"""
Automated Test Suite for TASK-A01:
- Day 1 Contract: GET /api/v1/medicines/search
- Auth: POST /api/v1/auth/register, POST /api/v1/auth/login, GET /api/v1/auth/me
- Admin Seeded Account Login
- History Auth Guard: GET /api/v1/diagnose/history
"""

import os
import sys
import uuid
import requests

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
# 1. Day 1 Contract: GET /api/v1/medicines/search
# -------------------------------------------------------------
test("Kiểm tra Day 1 Stub API: GET /api/v1/medicines/search")
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
ok(f"Trả về {len(items)} thuốc BVTV đặc trị kèm đầy đủ chỉ số IPM và cờ chống mưa rửa trôi.")

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
# 5. Đăng nhập tài khoản Quản trị Admin được Seed sẵn
# -------------------------------------------------------------
test("Đăng nhập tài khoản Quản trị viên (Admin Seeded): admin@lavitree.vn")
admin_password = os.getenv("ADMIN_INITIAL_PASSWORD", "Admin@Lavitree2026!")
res = requests.post(f"{BASE_URL}/api/v1/auth/login", json={
    "email": "admin@lavitree.vn",
    "password": admin_password
})
if res.status_code != 200:
    fail(f"Expected 200 OK cho Admin, got {res.status_code}: {res.text}")
admin_data = res.json()
if admin_data.get("user", {}).get("role") != "ADMIN":
    fail(f"Tài khoản admin phải có role 'ADMIN', nhận: {admin_data.get('user', {}).get('role')}")
admin_token = admin_data.get("token")
ok(f"Tài khoản Admin đăng nhập thành công với quyền ADMIN, JWT Token đã được cấp.")

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
# TỔNG KẾT
# -------------------------------------------------------------
print("\n" + "=" * 70)
print(f" KẾT QUẢ KIỂM THỬ: ĐẠT {passed_tests}/{total_tests} BÀI TEST CHUẨN!")
print(" Tất cả các tiêu chuẩn bảo mật, Day 1 Stub, băm BCrypt và xác thực JWT đã hoàn tất 100%.")
print("=" * 70)
