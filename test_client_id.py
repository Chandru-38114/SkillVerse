import requests
import re

html = requests.get('https://skill-verse-theta.vercel.app').text
match = re.search(r'src="(/assets/index-.*?\.js)"', html)
if match:
    js_url = 'https://skill-verse-theta.vercel.app' + match.group(1)
    js = requests.get(js_url).text
    client_ids = re.findall(r'(\d+-[a-zA-Z0-9]+\.apps\.googleusercontent\.com)', js)
    print("Vercel Client IDs found:", set(client_ids))
else:
    print("No JS found")
