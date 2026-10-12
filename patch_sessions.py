import re

with open('backend/app/routers/sessions.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace validation signature and add timezone awareness
content = content.replace("def _validate_times(session_date: str, start_time: str, end_time: str):", "def _validate_times(start: dt.datetime, end: dt.datetime):")
content = re.sub(r'date_obj\s*=\s*dt\.date\.fromisoformat\(.*?raise HTTPException.*?session_date cannot be in the past."\)', r'''
    if start >= end:
        raise HTTPException(status_code=422, detail="Start time must be before end time.")
    from ..utils.timezone import utc_now
    # We allow scheduling slightly in the past (e.g. starting a session right now)
    if start < utc_now() - dt.timedelta(hours=1):
        raise HTTPException(status_code=422, detail="Session cannot be scheduled too far in the past.")
''', content, flags=re.DOTALL)

# Update _to_out
content = re.sub(
    r'skill=s\.skill,.*?status=s\.status,',
    r'''skill=s.skill,
        session_date=s.session_date,
        start_time=s.start_time,
        end_time=s.end_time,
        scheduled_start=s.scheduled_start,
        scheduled_end=s.scheduled_end,
        status=s.status,''',
    content, flags=re.DOTALL
)

# Replace end_dt logic in _get_my_session
content = re.sub(
    r'end_time_str = f"\{s\.session_date\}T\{s\.end_time\}:00".*?end_dt = dt\.datetime\.fromisoformat\(end_time_str\).*?if dt\.datetime\.now\(\) >= end_dt:',
    r'''from ..utils.timezone import utc_now
        end_dt = s.scheduled_end
        if end_dt and utc_now() >= end_dt:''',
    content, flags=re.DOTALL
)

# In create_session
content = re.sub(
    r'_validate_times\(payload\.session_date, payload\.start_time, payload\.end_time\).*?session = models\.Session\(\s*request_id=payload\.request_id,\s*tutor_id=req\.to_user_id,\s*learner_id=req\.from_user_id,\s*skill=req\.skill\.name,\s*session_date=payload\.session_date,\s*start_time=payload\.start_time,\s*end_time=payload\.end_time,\s*notes=payload\.notes,',
    r'''_validate_times(payload.scheduled_start, payload.scheduled_end)
    
    # Store legacy strings based on scheduled_start for backward compatibility until dropped
    from ..utils.timezone import IST
    ist_start = payload.scheduled_start.astimezone(IST)
    ist_end = payload.scheduled_end.astimezone(IST)
    
    session = models.Session(
        request_id=payload.request_id,
        tutor_id=req.to_user_id,
        learner_id=req.from_user_id,
        skill=req.skill.name,
        session_date=ist_start.strftime("%Y-%m-%d"),
        start_time=ist_start.strftime("%H:%M"),
        end_time=ist_end.strftime("%H:%M"),
        scheduled_start=payload.scheduled_start,
        scheduled_end=payload.scheduled_end,
        notes=payload.notes,''',
    content, flags=re.DOTALL
)

# upcoming_sessions query
content = re.sub(
    r'models\.Session\.session_date >= today,\s*\(models\.Session\.tutor_id.*?\.order_by\(models\.Session\.session_date, models\.Session\.start_time\)',
    r'''models.Session.scheduled_start >= utc_now() - dt.timedelta(hours=24),
            (models.Session.tutor_id == current_user.id)
            | (models.Session.learner_id == current_user.id),
        )
        .order_by(models.Session.scheduled_start)''',
    content, flags=re.DOTALL
)

# my_sessions query
content = re.sub(
    r'\.order_by\(models\.Session\.session_date\.desc\(\), models\.Session\.start_time\.desc\(\)\)',
    r'.order_by(models.Session.scheduled_start.desc())',
    content
)

# update_session
content = re.sub(
    r'new_date\s*=\s*payload\.session_date.*?_validate_times\(new_date, new_start, new_end\).*?s\.end_time\s*=\s*new_end',
    r'''from ..utils.timezone import IST
    s.scheduled_start = payload.scheduled_start or s.scheduled_start
    s.scheduled_end = payload.scheduled_end or s.scheduled_end
    _validate_times(s.scheduled_start, s.scheduled_end)
    
    ist_start = s.scheduled_start.astimezone(IST)
    ist_end = s.scheduled_end.astimezone(IST)
    s.session_date = ist_start.strftime("%Y-%m-%d")
    s.start_time = ist_start.strftime("%H:%M")
    s.end_time = ist_end.strftime("%H:%M")''',
    content, flags=re.DOTALL
)

# webrtc_signaling
content = re.sub(
    r'end_dt = dt\.datetime\.strptime.*?if dt\.datetime\.now\(\) >= end_dt:',
    r'''from ..utils.timezone import utc_now
        end_dt = s.scheduled_end
        if end_dt and utc_now() >= end_dt:''',
    content, flags=re.DOTALL
)
content = content.replace('now = dt.datetime.now()', 'now = utc_now()')

with open('backend/app/routers/sessions.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("sessions.py updated.")
