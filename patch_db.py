import re

with open('backend/app/database.py', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'engine = create_engine\(DATABASE_URL, connect_args=_connect_args\)')
replacement = """# Safe Supabase production configuration
engine = create_engine(
    DATABASE_URL, 
    connect_args=_connect_args,
    pool_size=10,        # Safe baseline for typical Supabase tier
    max_overflow=20,     # Allow temporary spikes up to 30 total
    pool_timeout=30,     # Wait up to 30s before throwing QueuePool error
    pool_recycle=1800,   # Recycle connections every 30 minutes to prevent stale drops
    pool_pre_ping=True   # Check if connection is alive before using it
)"""

content = pattern.sub(replacement, content)

with open('backend/app/database.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("database.py patched")
