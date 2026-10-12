import base64
import sys

encoded = b'='

decoded = base64.b64decode(encoded).decode('utf-8')
with open('frontend/src/components/DateTimePicker.jsx', 'w', encoding='utf-8') as f:
    f.write(decoded)
