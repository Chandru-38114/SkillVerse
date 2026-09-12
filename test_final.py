import requests
import random

BASE = "http://127.0.0.1:8000"

def test_auth():
    email = f"user_{random.randint(1000,9999)}@example.com"
    mobile = f"+1{random.randint(1000000000,9999999999)}"
    pwd = "Password1!"
    
    print("1. New Registration")
    res = requests.post(f"{BASE}/auth/signup", json={
        "name": "Test User",
        "email": email,
        "mobile_number": mobile,
        "password": pwd,
        "confirm_password": pwd,
        "college": "Test College",
        "dob": "1990-01-01",
        "gender": "Male"
    })
    print("Registration:", res.status_code, res.json())
    if res.status_code != 200: return

    print("2. Duplicate email")
    res2 = requests.post(f"{BASE}/auth/signup", json={
        "name": "Test User", "email": email, "mobile_number": "+10000000000", "password": pwd, "confirm_password": pwd, "college": "Test", "dob": "1990-01-01", "gender": "Male"
    })
    print("Duplicate Email:", res2.status_code)

    print("3. Duplicate mobile")
    res3 = requests.post(f"{BASE}/auth/signup", json={
        "name": "Test User", "email": "other@a.com", "mobile_number": mobile, "password": pwd, "confirm_password": pwd, "college": "Test", "dob": "1990-01-01", "gender": "Male"
    })
    print("Duplicate Mobile:", res3.status_code)

    print("4. Weak password")
    res4 = requests.post(f"{BASE}/auth/signup", json={
        "name": "Test User", "email": "o2@a.com", "mobile_number": "+19999999999", "password": "weak", "confirm_password": "weak", "college": "Test", "dob": "1990-01-01", "gender": "Male"
    })
    print("Weak Password:", res4.status_code)
    
    print("5. Password mismatch")
    res5 = requests.post(f"{BASE}/auth/signup", json={
        "name": "Test User", "email": "o3@a.com", "mobile_number": "+18888888888", "password": pwd, "confirm_password": "OtherPassword1!", "college": "Test", "dob": "1990-01-01", "gender": "Male"
    })
    print("Password Mismatch:", res5.status_code)

    print("6. Login with email")
    res_login = requests.post(f"{BASE}/auth/login", json={"email": email, "password": pwd})
    print("Login with email:", res_login.status_code)
    token = res_login.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}

    print("7. Login with mobile")
    res_login2 = requests.post(f"{BASE}/auth/login", json={"mobile_number": mobile, "password": pwd})
    print("Login with mobile:", res_login2.status_code)

    print("8. Wrong password")
    res_wrong = requests.post(f"{BASE}/auth/login", json={"email": email, "password": "WrongPassword1!"})
    print("Wrong Password:", res_wrong.status_code)

    print("9. Login Rate limiting")
    for _ in range(5):
        requests.post(f"{BASE}/auth/login", json={"email": email, "password": "WrongPassword1!"})
    res_rate = requests.post(f"{BASE}/auth/login", json={"email": email, "password": "WrongPassword1!"})
    print("Rate limit:", res_rate.status_code)

    print("10. Forgot password")
    res_forgot = requests.post(f"{BASE}/auth/forgot-password", json={"email": email})
    print("Forgot password:", res_forgot.status_code, res_forgot.json())
    otp = res_forgot.json().get("detail").split("Your OTP is ")[1]

    print("11. Password reset old password rejection")
    res_reset_old = requests.post(f"{BASE}/auth/reset-password", json={"email": email, "otp": otp, "new_password": pwd})
    print("Reset with old password:", res_reset_old.status_code, res_reset_old.json())

    print("12. Password reset strong password")
    new_pwd = "NewPassword2@"
    res_reset_new = requests.post(f"{BASE}/auth/reset-password", json={"email": email, "otp": otp, "new_password": new_pwd})
    print("Reset with new password:", res_reset_new.status_code)
    
    print("13. Email OTP verification")
    res_email_req = requests.post(f"{BASE}/auth/verify-email/request", headers=headers)
    e_otp = res_email_req.json().get("detail").split("Your OTP is ")[1]
    res_email_conf = requests.post(f"{BASE}/auth/verify-email/confirm", headers=headers, json={"otp": e_otp})
    print("Email verify:", res_email_conf.status_code)

    print("14. Mobile OTP verification")
    res_mob_req = requests.post(f"{BASE}/auth/verify-mobile/request", headers=headers)
    m_otp = res_mob_req.json().get("detail").split("Your OTP is ")[1]
    res_mob_conf = requests.post(f"{BASE}/auth/verify-mobile/confirm", headers=headers, json={"otp": m_otp})
    print("Mobile verify:", res_mob_conf.status_code)

    print("15. Unauthenticated protected route rejection")
    res_unauth = requests.get(f"{BASE}/users/me")
    print("Unauth:", res_unauth.status_code)

if __name__ == "__main__":
    test_auth()
