import re

with open('backend/app/database.py', 'r', encoding='utf-8') as f:
    content = f.read()

if 'from sqlalchemy.pool import NullPool' not in content:
    content = content.replace('from sqlalchemy import create_engine', 'from sqlalchemy import create_engine\nfrom sqlalchemy.pool import NullPool')

pattern = re.compile(r'engine = create_engine\([\s\S]*?pool_pre_ping=True\s*\)')
replacement = """engine = create_engine(
    DATABASE_URL, 
    connect_args=_connect_args,
    # Supabase provides PgBouncer in Session mode with a strict 15 connection limit.
    # Using NullPool disables SQLAlchemy's internal connection holding.
    # Connections are opened and closed immediately, allowing PgBouncer to manage the pool safely.
    poolclass=NullPool
)"""

content = pattern.sub(replacement, content)

with open('backend/app/database.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("database.py patched for NullPool")
