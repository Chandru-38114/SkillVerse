import re

with open('frontend/src/components/VideoChat.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = re.sub(
    r'className=\{"w-full.*?"\}',
    'className={`w-full h-full object-cover transition-opacity duration-200 ${isVideoOff ? "opacity-0" : "opacity-100"}`}',
    code
)

with open('frontend/src/components/VideoChat.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
