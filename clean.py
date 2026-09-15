import codecs
import re
import os

files = ['frontend/src/pages/chat.jsx', 'frontend/src/pages/messages.jsx']

for file_path in files:
    with codecs.open(file_path, 'r', 'utf-8') as f:
        text = f.read()
    
    # Replace the corrupted headers
    text = re.sub(r'// â\x9d€.*?â\x9d€', '', text)
    
    # In chat.jsx, there's a COMMON_EMOJIS array we should replace with import if it exists
    if 'COMMON_EMOJIS = [' in text:
        text = re.sub(r'const COMMON_EMOJIS = \[.*?\];', '', text, flags=re.DOTALL)
        if 'import { COMMON_EMOJIS }' not in text:
            # We don't need to add import if it's already there or not needed, 
            # wait, let's just make sure we replace the array with an empty one or import.
            text = 'import { COMMON_EMOJIS } from "../utils/emojis";\n' + text

    # Strip out corrupted scheduling text
    text = re.sub(r'const text = `ðŸ“…', 'const text = `Calendar: ', text)
    
    with codecs.open(file_path, 'w', 'utf-8') as f:
        f.write(text)

print("Cleaned up corrupted characters.")
