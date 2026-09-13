import re

with open('frontend/src/pages/session_room.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the hooks from their current location
bad_hooks_pattern = r"  const \[timeLeft.*?}, \[session\]\);\n"
bad_hooks_match = re.search(bad_hooks_pattern, content, re.DOTALL)
if bad_hooks_match:
    hooks_code = bad_hooks_match.group(0)
    content = content.replace(hooks_code, "")
else:
    print("Could not find bad hooks")

# 2. Insert them at the top of the component
insert_target = "  const navigate = useNavigate()\n"
if insert_target in content:
    content = content.replace(insert_target, insert_target + "\n" + hooks_code)
else:
    print("Could not find insert target")

# 3. Update the error handling in useEffect
fetch_effect = r"api\.getSession\(sessionId\)\s*\.then\(setSession\)\s*\.catch\(err => setError\(err\.message\)\)"
new_fetch_effect = """api.getSession(sessionId)
      .then(setSession)
      .catch(err => {
        if (err.response?.status === 410 || String(err).includes('410') || String(err).includes('expired')) {
          setIsEnded(true)
        } else {
          setError(err.message)
        }
      })"""
content = re.sub(fetch_effect, new_fetch_effect, content)

# 4. Update the isEnded return screen
ended_screen = r"if \(isEnded \|\| \(session && session\.status === 'completed'\)\) \{[\s\S]*?</div>\s*</div>\s*\)"
new_ended_screen = """if (isEnded || (session && session.status === 'completed')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-paper p-4">
        <div className="max-w-md w-full text-center p-8 card border-t-4 border-t-brand">
          <div className="text-5xl mb-4">⏱️</div>
          <h1 className="text-2xl font-display mb-2">Session Ended</h1>
          <p className="text-ink/60 mb-8 text-sm">This scheduled session has reached its end time and is no longer available.</p>
          <Link to="/sessions" className="btn-primary inline-flex">Return to Sessions</Link>
        </div>
      </div>
    )"""
content = re.sub(ended_screen, new_ended_screen, content)

with open('frontend/src/pages/session_room.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
