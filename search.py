import sys  
content = open('frontend/src/pages/messages.jsx', 'r', encoding='utf-8').read()  
for i, line in enumerate(content.splitlines()):  
    if 'REACTION' in line or 'emoji' in line.lower():  
        print(f'{i+1}: {line.encode(\" "ascii\, \ignore\).decode(\ascii\)}')  
