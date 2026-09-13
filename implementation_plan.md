# SkillVerse Timezone & Time System Implementation Plan

## User Review Required

> [!WARNING]
> **Database Schema Migration & Data Conversion Plan**
> Existing session data analysis:
> - The `sessions` table contains 1 row: `(1, '2026-09-11', '13:12', '17:16', 'scheduled')`
> 
> **Migration Plan:**
> 1. Add `scheduled_start (DATETIME)` and `scheduled_end (DATETIME)` columns to the `sessions` table.
> 2. **Data Conversion:** For existing rows, concatenate `session_date` and `start_time` (e.g., `"2026-09-11 13:12"`). We will assume these were entered as **IST (Asia/Kolkata)**. We will parse this string, attach the `Asia/Kolkata` timezone, convert it to **UTC**, and save the resulting absolute instant in `scheduled_start`. We will do the same for `end_time` -> `scheduled_end`.
> 3. After data is migrated safely and verified, drop the naive `session_date`, `start_time`, and `end_time` columns.
> 
> Please approve this exact data conversion logic and schema migration before I execute it.

## Open Questions

None at this stage. The requirements are clear that `Asia/Kolkata` is the single source of truth for display, while `UTC` is the standard for storage.

## Proposed Changes

### Backend Timestamp Standardization (UTC)

#### [NEW] backend/app/utils/timezone.py
Create a central utility for timezone-aware operations:
- `utc_now()`: Returns `datetime.now(dt.timezone.utc)`.
- `to_ist(dt_utc)`: Converts a UTC datetime to `Asia/Kolkata` (if needed for logging).

#### [MODIFY] backend/app/models.py
- Change all `default=dt.datetime.utcnow` to `default=utc_now`.
- Update `Session` model: replace `session_date`, `start_time`, `end_time` with `scheduled_start (DateTime)` and `scheduled_end (DateTime)`.

#### [MODIFY] backend/app/schemas.py
- Ensure all datetimes are returned explicitly in ISO-8601 format with a `Z` suffix.
- Update `SessionCreate` and `SessionOut` to use the new `scheduled_start` and `scheduled_end` fields instead of strings.

#### [MODIFY] backend/app/routers/chat.py
- Ensure `created_at` in WebSocket history and live payloads explicitly include the `Z` suffix (e.g. `msg.created_at.replace(tzinfo=dt.timezone.utc).isoformat()`) so the frontend knows it is UTC.

### Frontend Centralization & Formatting

#### [NEW] frontend/src/utils/dateTime.js
Centralize all time formatting to forcefully use **Asia/Kolkata**:
- `formatTime(utcIsoString)`
- `formatDate(utcIsoString)`
- `formatDateTime(utcIsoString)`
These functions will append `Z` (if missing from backend naive datetime) and use `Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ... })` to guarantee the display is universally IST.

#### [MODIFY] frontend/src/pages/messages.jsx & chat.jsx
- Replace all scattered `new Date(...)` and `.toLocaleTimeString()` calls with the centralized `formatTime()` and `formatDate()` utilities.

#### [MODIFY] frontend/src/pages/session_room.jsx
- Refactor the countdown and timeout logic to compare `new Date().getTime()` (which is absolute milliseconds) against the precise absolute UTC instant of `session.scheduled_start` and `session.scheduled_end`.

## Verification Plan

### Automated Tests
- Python syntax checks on all modified backend files.
- `npm run build` on the frontend.

### Manual Verification
- Send a message and confirm the timestamp displays as IST.
- Schedule a session and ensure the UTC timestamp is correctly calculated and stored, and the UI displays IST regardless of the physical browser location.
