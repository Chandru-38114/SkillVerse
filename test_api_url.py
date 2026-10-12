import requests
import re

html = requests.get('https://skill-verse-theta.vercel.app/login').text
match = re.search(r'src="(/assets/index-.*?\.js)"', html)
if match:
    js_url = 'https://skill-verse-theta.vercel.app' + match.group(1)
    js = requests.get(js_url).text
    
    if "skillverse-api-fm56" in js:
        print("YES, Vercel is using skillverse-api-fm56.onrender.com")
    elif "your-backend-url-here" in js:
        print("BAD: Vercel is using your-backend-url-here.com")
    else:
        print("NEITHER FOUND")
else:
    print("No JS found")
