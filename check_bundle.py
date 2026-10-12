import urllib.request, re

req = urllib.request.Request('https://skill-verse-theta.vercel.app')
try:
    with urllib.request.urlopen(req) as r:
        html = r.read().decode('utf-8')

    paths = re.findall(r'src="(/assets/[^"]+\.js)"', html)
    print("Found JS paths:", paths)

    for p in paths:
        url = 'https://skill-verse-theta.vercel.app' + p
        js = urllib.request.urlopen(url).read().decode('utf-8')
        print(f"Checking {url}")
        
        if 'skillverse-api-fm56' in js:
            print('-> HAS RENDER URL')
        if 'localhost:8000' in js:
            print('-> HAS LOCALHOST:8000')
except Exception as e:
    print(e)
