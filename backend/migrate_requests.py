import sqlite3

conn = sqlite3.connect('skillverse.db')
c = conn.cursor()

existing = {row[1] for row in c.execute('PRAGMA table_info(connection_requests)').fetchall()}
print('Before:', sorted(existing))

new_cols = [
    ('learner_current_level', 'TEXT'),
    ('learner_topics', 'TEXT'),
    ('learner_goals', 'TEXT'),
    ('learner_can_teach', 'TEXT'),
    ('learner_teach_proficiency', 'TEXT'),
]

for col_name, col_type in new_cols:
    if col_name not in existing:
        c.execute(f'ALTER TABLE connection_requests ADD COLUMN {col_name} {col_type}')
        print(f'  + Added: {col_name}')
    else:
        print(f'  = Skipped (already exists): {col_name}')

conn.commit()
after = [row[1] for row in c.execute('PRAGMA table_info(connection_requests)').fetchall()]
print('After:', after)
conn.close()
print('Done.')
