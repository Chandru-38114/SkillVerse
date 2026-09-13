import re

with open('backend/app/routers/progress.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("dt.datetime.utcnow()", "utc_now()")

if "from ..utils.timezone import utc_now" not in content:
    content = content.replace("import datetime as dt", "import datetime as dt\nfrom ..utils.timezone import utc_now")

with open('backend/app/routers/progress.py', 'w', encoding='utf-8') as f:
    f.write(content)
