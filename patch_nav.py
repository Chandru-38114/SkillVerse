import sys

with open('frontend/src/components/navbar.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace('<span className="ml-2 text-sm font-bold tracking-wide">Menu</span>', '<span className="ml-2 text-sm font-bold tracking-wide hidden sm:inline">Menu</span>')

with open('frontend/src/components/navbar.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
print("Nav patched")
