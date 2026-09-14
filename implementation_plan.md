# Production Database Migration Plan (Sessions Table)

## User Review Required

> [!WARNING]
> **Production Schema Update**
> The production database is missing the `scheduled_start` and `scheduled_end` columns because the automated startup script in `main.py` did not successfully apply the PostgreSQL migration on Render.

I will safely apply the schema update and data conversion directly to the production database via a targeted script.

## Proposed Migration Logic

### 1. Schema Addition (SQL)
```sql
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMP WITH TIME ZONE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMP WITH TIME ZONE;
```
These columns will be created safely without dropping any existing columns.

### 2. Data Conversion (SQL)
To ensure the existing session data is flawlessly migrated into absolute UTC instantly representing IST (GMT+05:30), I will execute this update logic:
```sql
UPDATE sessions
SET 
    scheduled_start = (session_date || ' ' || start_time || ' +05:30')::timestamp with time zone,
    scheduled_end = (session_date || ' ' || end_time || ' +05:30')::timestamp with time zone
WHERE scheduled_start IS NULL AND session_date IS NOT NULL;
```
**Explanation:** 
PostgreSQL natively supports parsing timezones from strings. By concatenating the existing `session_date` (e.g. `'2026-09-11'`) with the `start_time` (e.g. `'13:12'`) and appending the IST offset (`' +05:30'`), the resulting string `'2026-09-11 13:12 +05:30'` is cast perfectly into a `TIMESTAMP WITH TIME ZONE`. PostgreSQL internally converts this to absolute UTC for storage. This entirely removes the need for complex Python parsing.

### 3. Cleanup of `main.py`
I will remove the automatic startup migration from `backend/app/main.py` since this direct targeted migration supersedes it and prevents random schema locking during application boot.

## Execution Plan
I will create `run_migration_prod.py` which executes the exact SQL above.
*(Note: To execute this script against production, I will need access to the production `DATABASE_URL`. If it is not present in my local environment variables, I will prompt you to provide it or execute the script yourself.)*

After execution, I will run local syntax tests, commit the cleanup of `main.py`, and push the fix to `phase2-websocket-chat`.
