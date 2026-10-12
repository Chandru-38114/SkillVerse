import os
import re

def patch(file, patterns):
    if not os.path.exists(file): return
    with open(file, 'r', encoding='utf-8') as f:
        code = f.read()
    orig = code
    for pat, rep in patterns:
        code = re.sub(pat, rep, code)
    if code != orig:
        if 'getAvatarUrl' in code and 'getAvatarUrl' not in orig:
            if 'import api from "../api"' in code:
                code = code.replace('import api from "../api"', 'import api, { getAvatarUrl } from "../api"')
            elif 'import { BASE_URL' in code:
                code = re.sub(r'import {([^}]*?)BASE_URL([^}]*?)} from ["\'](\.\./)*api["\'];?', r'import {\1BASE_URL, getAvatarUrl\2} from "\3api";', code)
            elif 'import { getUserProfile' in code:
                 code = code.replace('import { getUserProfile', 'import { getUserProfile, getAvatarUrl')
            else:
                 code = 'import { getAvatarUrl } from "../api";\n' + code
        with open(file, 'w', encoding='utf-8') as f:
            f.write(code)
        print("Patched " + file)

patch('frontend/src/components/navbar.jsx', [
    (r'src=\{BACKEND_URL \+ user\.profile_picture_url\}', r'src={getAvatarUrl(user.profile_picture_url)}')
])
patch('frontend/src/pages/dashboard.jsx', [
    (r'src=\{\\$\{BACKEND_URL\}\$\{peer\.profile_picture_url\}\\}', r'src={getAvatarUrl(peer.profile_picture_url)}'),
    (r'src=\{\\$\{BACKEND_URL\}\$\{session\.other_user_avatar\}\\}', r'src={getAvatarUrl(session.other_user_avatar)}'),
    (r'src=\{BACKEND_URL \+ peer\.profile_picture_url\}', r'src={getAvatarUrl(peer.profile_picture_url)}')
])
patch('frontend/src/pages/marketplace.jsx', [
    (r'src=\{\\$\{BACKEND_URL\}\$\{peer\.profile_picture_url\}\\}', r'src={getAvatarUrl(peer.profile_picture_url)}'),
    (r'src=\{BACKEND_URL \+ peer\.profile_picture_url\}', r'src={getAvatarUrl(peer.profile_picture_url)}')
])
patch('frontend/src/pages/session_room.jsx', [
    (r'src=\{\\$\{BACKEND_URL\}\$\{participant\.profile_picture_url\}\\}', r'src={getAvatarUrl(participant.profile_picture_url)}'),
    (r'src=\{BACKEND_URL \+ participant\.profile_picture_url\}', r'src={getAvatarUrl(participant.profile_picture_url)}')
])
