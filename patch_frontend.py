import os
import re

api_file = 'frontend/src/api.js'
with open(api_file, 'r', encoding='utf-8') as f:
    api_code = f.read()
if 'export const getAvatarUrl' not in api_code:
    api_code += '\nexport const getAvatarUrl = (url) => {\n  if (!url) return null;\n  if (url.startsWith("http")) return url;\n  return ${BASE_URL};\n};\n'
    with open(api_file, 'w', encoding='utf-8') as f:
        f.write(api_code)
    print("Added getAvatarUrl to api.js")

def patch_file(filepath, replacements, add_import=False):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        code = f.read()
    
    orig_code = code
    for old, new in replacements:
        code = code.replace(old, new)
        
    if add_import and 'getAvatarUrl' not in code and code != orig_code:
        # add to imports from api
        code = re.sub(r'import {([^}]*?)BASE_URL([^}]*?)} from ["\'](\.\./)*api["\'];?', r'import {\1BASE_URL, getAvatarUrl\2} from "\3api";', code)
        # if BASE_URL wasn't imported, find an import from api and append
        if 'getAvatarUrl' not in code:
            code = code.replace('import api', 'import api, { getAvatarUrl }')
            if 'getAvatarUrl' not in code:
                # Add it at the top
                code = 'import { getAvatarUrl } from "../api";\n' + code

    if code != orig_code:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(code)
        print(f"Patched {filepath}")

# gamification.jsx
patch_file('frontend/src/pages/gamification.jsx', [
    ('src={user.profile_picture_url}', 'src={getAvatarUrl(user.profile_picture_url)}'),
    ('src={u.profile_picture_url}', 'src={getAvatarUrl(u.profile_picture_url)}')
], True)

# profile.jsx
patch_file('frontend/src/pages/profile.jsx', [
    ('src={BACKEND_URL + user.profile_picture_url}', 'src={getAvatarUrl(user.profile_picture_url)}'),
    ('import { getProfile, updateProfile }', 'import { getProfile, updateProfile, getAvatarUrl }')
])

# messages.jsx
patch_file('frontend/src/pages/messages.jsx', [
    ('src={${BACKEND_URL}}', 'src={getAvatarUrl(conv.other_user_avatar)}'),
    ('src={${BACKEND_URL}}', 'src={getAvatarUrl(selectedConv.other_user_avatar)}'),
    ('import { getUserProfile }', 'import { getUserProfile, getAvatarUrl }')
])

# navbar.jsx
patch_file('frontend/src/components/navbar.jsx', [
    ('src={BACKEND_URL + user.profile_picture_url}', 'src={getAvatarUrl(user.profile_picture_url)}'),
    ('src={${BACKEND_URL}}', 'src={getAvatarUrl(user.profile_picture_url)}')
], True)

# marketplace.jsx
patch_file('frontend/src/pages/marketplace.jsx', [
    ('src={${BACKEND_URL}}', 'src={getAvatarUrl(peer.profile_picture_url)}'),
    ('src={BACKEND_URL + peer.profile_picture_url}', 'src={getAvatarUrl(peer.profile_picture_url)}')
], True)

# dashboard.jsx
patch_file('frontend/src/pages/dashboard.jsx', [
    ('src={${BACKEND_URL}}', 'src={getAvatarUrl(peer.profile_picture_url)}'),
    ('src={BACKEND_URL + peer.profile_picture_url}', 'src={getAvatarUrl(peer.profile_picture_url)}'),
    ('src={${BACKEND_URL}}', 'src={getAvatarUrl(session.other_user_avatar)}')
], True)

# session_room.jsx
patch_file('frontend/src/pages/session_room.jsx', [
    ('src={${BACKEND_URL}}', 'src={getAvatarUrl(participant.profile_picture_url)}'),
    ('src={BACKEND_URL + participant.profile_picture_url}', 'src={getAvatarUrl(participant.profile_picture_url)}')
], True)

