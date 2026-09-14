import os
from sqlalchemy import create_engine, inspect
import sys
# add to path so we can import backend.app.database
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.app.database import DATABASE_URL

engine = create_engine(DATABASE_URL)
inspector = inspect(engine)

cols = inspector.get_columns('messages')
fks = inspector.get_foreign_keys('messages')
pk = inspector.get_pk_constraint('messages')
indexes = inspector.get_indexes('messages')

print("=== COLUMNS ===")
for c in cols:
    print(f"{c['name']}: type={c['type']}, nullable={c['nullable']}, default={c.get('default')}")

print("\n=== PRIMARY KEY ===")
print(pk.get('constrained_columns', []))

print("\n=== FOREIGN KEYS ===")
for fk in fks:
    print(f"{fk['constrained_columns']} -> {fk['referred_table']}.{fk['referred_columns']}")

print("\n=== INDEXES ===")
for idx in indexes:
    print(f"{idx['name']} (unique={idx['unique']}): {idx['column_names']}")
