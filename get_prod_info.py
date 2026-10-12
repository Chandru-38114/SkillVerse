import requests

BASE_URL = "https://skillverse-api-fm56.onrender.com"

# Login
res = requests.post(
    f"{BASE_URL}/auth/login",
    json={"email": "test.real.user@example.com", "mobile_number": None, "password": "Password1!"},
    headers={"Origin": "https://skill-verse-theta.vercel.app"}
)
if res.status_code != 200:
    print("Login failed:", res.text)
    exit(1)

token = res.json()["access_token"]

# Marketplace Search
res4 = requests.get(
    f"{BASE_URL}/marketplace/search",
    headers={"Authorization": f"Bearer {token}", "Origin": "https://skill-verse-theta.vercel.app"}
)

if res4.status_code == 200:
    users = res4.json()
    urls = [u.get("profile_picture_url") for u in users if u.get("profile_picture_url")]
    print("Found avatars:", urls)
else:
    print("Marketplace search failed:", res4.text)
