import requests

BASE_URL = "https://skillverse-api-fm56.onrender.com"

# Login
print("Testing POST /auth/login...")
res = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": "test.real.user@example.com", "mobile_number": None, "password": "Password1!"},
    headers={"Origin": "https://skill-verse-theta.vercel.app"}
)
print("Login status:", res.status_code)
if res.status_code != 200:
    print(res.text)
    exit(1)

token = res.json()["access_token"]
print("Login returned DOB:", res.json()["user"].get("dob"))
print("Login returned created_at:", res.json()["user"].get("created_at"))

# GET /users/me
print("\nTesting GET /users/me...")
res2 = requests.get(
    f"{BASE_URL}/users/me",
    headers={"Authorization": f"Bearer {token}", "Origin": "https://skill-verse-theta.vercel.app"}
)
print("GET /users/me status:", res2.status_code)
if res2.status_code != 200:
    print(res2.text)

# PUT /users/me
print("\nTesting PUT /users/me...")
res3 = requests.put(
    f"{BASE_URL}/users/me",
    json={"dob": "1999-01-01", "gender": "Male"},
    headers={"Authorization": f"Bearer {token}", "Origin": "https://skill-verse-theta.vercel.app"}
)
print("PUT /users/me status:", res3.status_code)
if res3.status_code != 200:
    print(res3.text)

print("PUT /users/me returned DOB:", res3.json().get("dob"))
