import re
content = open('backend/app/models.py', encoding='utf-8').read()
print(re.findall(r'__tablename__\s*=\s*"([^"]+)"', content))
