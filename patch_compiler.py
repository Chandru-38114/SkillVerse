import re

with open('backend/app/routers/compiler.py', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """                    # Broadcast the event with version
                    await compiler_manager.broadcast(session_id, user_id, json.dumps({
                        "type": "update_code",
                        "code": comp.code,
                        "version": comp.version
                    }))
                elif msg.get("type") == "execution_result":
                    await compiler_manager.broadcast(session_id, user_id, json.dumps({
                        "type": "execution_result",
                        "output": msg.get("output", ""),
                        "error": msg.get("error", ""),
                        "user_name": msg.get("user_name", ""),
                        "timestamp": msg.get("timestamp")
                    }))"""

content = content.replace("""                    # Broadcast the event with version
                    await compiler_manager.broadcast(session_id, user_id, json.dumps({
                        "type": "update_code",
                        "code": comp.code,
                        "version": comp.version
                    }))""", replacement)

with open('backend/app/routers/compiler.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("compiler.py patched")
