import os

with open('frontend/src/pages/messages.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace("src={\\}", "src={getAvatarUrl(conv.other_user_avatar)}")
code = code.replace("src={\\}", "src={getAvatarUrl(selectedConv.other_user_avatar)}")

if 'getAvatarUrl' not in code:
    code = code.replace('import { getUserProfile', 'import { getUserProfile, getAvatarUrl')

with open('frontend/src/pages/messages.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
print("Patched messages.jsx")
