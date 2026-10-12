with open('frontend/src/pages/messages.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(" + 'â€¦' : str", " + '...' : str")
text = text.replace(" + 'Ã¢â‚¬Â¦' : str", " + '...' : str")

with open('frontend/src/pages/messages.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
