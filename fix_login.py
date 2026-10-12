with open('frontend/src/pages/login.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

replacement = """
      if (!user.college || user.college.trim() === '') {
        navigate('/onboarding')
      } else {
        navigate('/dashboard')
      }
"""

text = text.replace("navigate('/dashboard')", replacement.strip())

with open('frontend/src/pages/login.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
