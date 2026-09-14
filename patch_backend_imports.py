import re

with open('backend/app/routers/sessions.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    stripped = line.strip()
    if stripped == "from ..utils.timezone import utc_now":
        continue
    if stripped == "from ..utils.timezone import IST":
        continue
    if stripped == "from ..utils.timezone import enforce_utc_iso":
        continue
    new_lines.append(line)

content = "".join(new_lines)

if 'from ..utils.timezone import' not in content[:500]:
    content = re.sub(
        r"(from \.\.ws_manager import webrtc_manager\n)",
        r"\1from ..utils.timezone import utc_now, IST, enforce_utc_iso\n",
        content, count=1
    )

with open('backend/app/routers/sessions.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Safely patched backend sessions.py")
