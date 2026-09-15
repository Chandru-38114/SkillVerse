with open('backend/app/main.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if 'try:' in line and 'conn.execute(text("ALTER TABLE users ADD COLUMN gender VARCHAR;"))' in lines[min(i+1, len(lines)-1)] and 'pass' in lines[min(i+4, len(lines)-1)]:
        skip = True
        skip_count = 5
    
    if skip:
        skip_count -= 1
        if skip_count == 0:
            skip = False
        continue
    
    new_lines.append(line)

with open('backend/app/main.py', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("Removed bad block")
