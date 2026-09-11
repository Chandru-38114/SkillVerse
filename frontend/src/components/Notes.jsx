 import React, { useState, useEffect } from "react";
import { api } from "../api";

export default function Notes({ sessionId }) {
  const [data, setData] = useState({
    topics_discussed: "",
    topics_completed: "",
    learning_notes: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    api.getSessionProgress(sessionId)
      .then(res => {
        setData({
          topics_discussed: res.topics_discussed || "",
          topics_completed: res.topics_completed || "",
          learning_notes: res.learning_notes || ""
        });
        if (res.duration_minutes > 0) {
          setIsCompleted(true);
        }
      })
      .catch(err => {
        // If it doesn't exist yet, it just returns empty strings based on the backend dummy logic
        if (err.message.includes("404") || err.message.includes("not found")) {
          // OK
        } else {
          setError(err.message);
        }
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

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

  const handleComplete = async () => {
    if (!window.confirm("Are you sure you want to complete this session? This will update your skill progress and cannot be undone.")) {
      return;
    }
    
    setCompleting(true);
    setError(null);
    try {
      // Always save first
      await api.saveSessionNotes(sessionId, data);
      // Then complete
      const res = await api.completeSessionProgress(sessionId);
      setIsCompleted(true);
      alert(`Session completed successfully! New progress: ${res.progress_percentage}%`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCompleting(false);
    }
  };

  if (loading) return <div className="p-8">Loading notes...</div>;

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto w-full">
      <h2 className="text-xl sm:text-2xl font-bold mb-6">Session Notes & Progress</h2>
      
      {isCompleted && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg">
          <p className="font-bold">Session Completed</p>
          <p className="text-sm">Your progress has been recorded. You can still view your notes below.</p>
        </div>
      )}

      {error && <div className="mb-4 text-red-600 bg-red-50 p-3 rounded">{error}</div>}
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Topics Discussed</label>
          <textarea 
            className="w-full border p-2 rounded" 
            rows="3"
            value={data.topics_discussed}
            onChange={e => setData({...data, topics_discussed: e.target.value})}
            placeholder="e.g. React Hooks, useEffect, State"
            disabled={isCompleted}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Topics Completed</label>
          <textarea 
            className="w-full border p-2 rounded" 
            rows="3"
            value={data.topics_completed}
            onChange={e => setData({...data, topics_completed: e.target.value})}
            placeholder="e.g. Mastered useState"
            disabled={isCompleted}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">My Learning Notes</label>
          <textarea 
            className="w-full border p-2 rounded" 
            rows="5"
            value={data.learning_notes}
            onChange={e => setData({...data, learning_notes: e.target.value})}
            placeholder="Private notes for yourself..."
            disabled={isCompleted}
          />
        </div>
      </div>

      {!isCompleted && (
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="btn-secondary py-2 px-4"
            >
              {saving ? "Saving..." : "Save Notes"}
            </button>
            {success && <span className="text-sm text-green-600">Saved successfully!</span>}
          </div>
          
          <button 
            onClick={handleComplete} 
            disabled={completing}
            className="btn-primary py-2 px-4"
          >
            {completing ? "Completing..." : "Complete Session"}
          </button>
        </div>
      )}
    </div>
  );
}
