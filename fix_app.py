with open('frontend/src/App.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("import Signup from './pages/signup'", "import Signup from './pages/signup'\nimport Onboarding from './pages/onboarding'")

text = text.replace('<Route path="/signup" element={<Signup />} />', '<Route path="/signup" element={<Signup />} />\n          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />')

with open('frontend/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
