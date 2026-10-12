import React, { useState } from "react";
import { api } from "../api";

export default function Notes({ session, data, onChange, isCompleted }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const sessionId = session?.id;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.saveSessionNotes(sessionId, data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const FIELDS = [
    {
      key: 'topics_discussed',
      title: 'Topics Discussed',
      hint: 'What did you cover in this session?',
      placeholder: 'e.g. React Hooks, useEffect, State management...',
      minHeight: 84,
    },
    {
      key: 'topics_completed',
      title: 'Topics Completed',
      hint: 'What milestones were achieved?',
      placeholder: 'e.g. Mastered useState and forms...',
      minHeight: 84,
    },
    {
      key: 'learning_notes',
      title: 'My Learning Notes',
      hint: 'Private notes for your revision',
      placeholder: 'Write anything you want to remember…',
      minHeight: 120,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {error && (
        <div style={{ padding: '10px 14px', border: '2px solid #9A2B1E', borderRadius: 12, background: '#F6DDD8', color: '#9A2B1E', fontWeight: 700, fontSize: 13 }}>
          {error}
        </div>
      )}

      {FIELDS.map(f => (
        <div className="fld" key={f.key}>
          <div className="h">
            <strong style={{ fontSize: 14 }}>{f.title}</strong>
            <div className="muted" style={{ fontSize: 12 }}>{f.hint}</div>
          </div>
          <textarea
            style={{ minHeight: f.minHeight }}
            value={data[f.key]}
            onChange={e => onChange({ ...data, [f.key]: e.target.value })}
            placeholder={f.placeholder}
            disabled={isCompleted}
            aria-label={f.title}
          />
        </div>
      ))}

      {!isCompleted && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-s" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Notes'}
          </button>
          {success && <span className="pill" style={{ background: '#D6F3EA' }}>✓ Saved</span>}
        </div>
      )}
    </div>
  );
}
