with open('frontend/src/pages/login.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'handleGoogleSuccess' in line:
        print(''.join(lines[i:i+20]))
        break
