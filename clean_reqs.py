import codecs

with open('backend/requirements.txt', 'rb') as f:
    content = f.read()

# Let's decode properly. The file might be a mix of UTF-8 and UTF-16LE.
# Since it was appended to, the first part is UTF-8, and the last part is UTF-16LE.
try:
    text = content.decode('utf-8')
    text = text.replace('\x00', '')
except:
    text = content.decode('utf-16le', errors='ignore')

# Alternatively, let's just extract ASCII and printable chars
import string
printable = set(string.printable)
cleaned = ''.join(filter(lambda x: x in printable, text))

# Split into lines and reconstruct
lines = []
for line in cleaned.splitlines():
    line = line.strip()
    if line:
        lines.append(line)

with open('backend/requirements.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')
print("Cleaned requirements.txt")
