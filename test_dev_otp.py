import requests

r1 = requests.post('http://127.0.0.1:8000/auth/signup', json={
    'name': 'Dev User',
    'email': 'devuser1@example.com',
    'password': 'Password1!',
    'confirm_password': 'Password1!',
    'mobile_number': '+9999999',
    'college': 'Test College',
    'country': 'US'
})
print("Signup Response:", r1.status_code)
# Cannot test fully if local server is down, but we checked earlier it was down.
