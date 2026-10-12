import os
import re

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    original = content
    content = re.sub(r'\bpx-6 py-12\b', 'px-4 sm:px-6 py-8 sm:py-12', content)
    content = re.sub(r'\bpx-6 py-8\b', 'px-4 sm:px-6 py-6 sm:py-8', content)
    content = re.sub(r'\bpx-6 py-6\b', 'px-4 sm:px-6 py-4 sm:py-6', content)
    content = re.sub(r'\bpx-8 py-12\b', 'px-4 sm:px-8 py-8 sm:py-12', content)
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print('Patched:', filepath)

for root, _, files in os.walk('frontend/src'):
    for file in files:
        if file.endswith('.jsx'):
            patch_file(os.path.join(root, file))
