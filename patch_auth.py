import os
import re

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    original = content
    content = re.sub(r'px-6 py-16', 'px-4 sm:px-6 py-10 sm:py-16', content)
    content = re.sub(r'px-4 sm:px-6 py-16', 'px-4 sm:px-6 py-10 sm:py-16', content)
    content = re.sub(r'px-4 py-16', 'px-4 sm:px-6 py-10 sm:py-16', content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print('Patched:', filepath)

for root, _, files in os.walk('frontend/src/pages'):
    for file in files:
        if file.endswith('.jsx'):
            patch_file(os.path.join(root, file))
