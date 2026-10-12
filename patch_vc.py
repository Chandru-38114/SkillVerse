import sys

with open('frontend/src/components/VideoChat.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Make VideoChat layout flex-col on mobile, flex-row on desktop
code = code.replace(
    '<div className="flex-1 flex overflow-hidden">',
    '<div className="flex-1 flex flex-col md:flex-row overflow-hidden">'
)

code = code.replace(
    '<div className="w-[300px] shrink-0 bg-ink flex flex-col relative border-r border-ink/20">',
    '<div className="w-full h-48 md:h-auto md:w-[300px] shrink-0 bg-ink flex flex-col relative border-b md:border-b-0 md:border-r border-ink/20 z-20">'
)

# Bottom controls responsive
code = code.replace(
    '<div className="flex-1 text-xs text-ink/50 font-medium">',
    '<div className="hidden md:block flex-1 text-xs text-ink/50 font-medium">'
)

with open('frontend/src/components/VideoChat.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("VideoChat patched")
