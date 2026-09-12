import os
import re

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    content = re.sub(r'className="([^"]*\b)px-6(\b[^"]*max-w-[^"]*)"', r'className="\1px-4 sm:px-6\2"', content)
    content = re.sub(r'className="([^"]*\b)px-8(\b[^"]*max-w-[^"]*)"', r'className="\1px-4 sm:px-8\2"', content)
    
    content = re.sub(r'className="([^"]*\bcard\b[^"]*\b)p-8(\b[^"]*)"', r'className="\1p-5 sm:p-8\2"', content)
    content = re.sub(r'className="([^"]*\bcard\b[^"]*\b)p-6(\b[^"]*)"', r'className="\1p-4 sm:p-6\2"', content)
    
    content = re.sub(r'className="([^"]*\b)space-y-8(\b[^"]*)"', r'className="\1space-y-6 md:space-y-8\2"', content)
    
    content = re.sub(r'\bw-96\b', r'w-full sm:w-96', content)
    content = re.sub(r'\bw-80\b', r'w-full sm:w-80', content)
    content = re.sub(r'w-full sm:w-96 max-w-md', 'w-full max-w-md', content)

    content = re.sub(r'\bgrid-cols-2\b', r'grid-cols-1 sm:grid-cols-2', content)
    
    # fix over-replacements
    content = content.replace('sm:grid-cols-1 sm:grid-cols-2', 'sm:grid-cols-2')
    content = content.replace('md:grid-cols-1 sm:grid-cols-2', 'md:grid-cols-2')
    content = content.replace('lg:grid-cols-1 sm:grid-cols-2', 'lg:grid-cols-2')
    content = content.replace('xl:grid-cols-1 sm:grid-cols-2', 'xl:grid-cols-2')
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print('Patched:', filepath)

for root, _, files in os.walk('frontend/src'):
    for file in files:
        if file.endswith('.jsx'):
            patch_file(os.path.join(root, file))
