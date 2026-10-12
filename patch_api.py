import re

with open('frontend/src/api.js', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """  listMessages: (requestId) => request(`/chat/${requestId}/messages`),
  markMessagesRead: (requestId) => request(`/chat/${requestId}/read`, { method: "POST" }),
  sendMessage: (requestId, content) => request(`/chat/${requestId}/messages`, { method: "POST", body: { content } }),"""

content = content.replace("""  listMessages: (requestId) => request(`/chat/${requestId}/messages`),
  sendMessage: (requestId, content) => request(`/chat/${requestId}/messages`, { method: "POST", body: { content } }),""", replacement)

with open('frontend/src/api.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("api.js patched")
