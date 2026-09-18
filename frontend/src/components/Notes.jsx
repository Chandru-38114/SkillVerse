import React, { useState, useEffect } from "react";
import { api, getSessionUser } from "../api";
import { ChevronLeft, CheckCircle2 } from "lucide-react";


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

  return (
    <div className="flex-1 flex flex-col h-full bg-paper w-full">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          
          {error && <div className="p-3 text-sm text-red-600 bg-red-500/10 border border-red-500/20 rounded-xl">{error}</div>}
          
          <div className="space-y-6">
            {/* Topics Discussed */}
            <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-line bg-lift/50">
                <label className="block text-sm font-semibold text-ink">Topics Discussed</label>
                <p className="text-xs text-clay mt-0.5">What did you cover in this session?</p>
              </div>
              <div className="p-2">
                <textarea 
                  className="w-full p-2 bg-transparent border-0 focus:ring-0 text-sm text-ink placeholder:text-clay/50 resize-y min-h-[100px]" 
                  value={data.topics_discussed}
                  onChange={e => onChange({...data, topics_discussed: e.target.value})}
                  placeholder="e.g. React Hooks, useEffect, State management..."
                  disabled={isCompleted}
                />
              </div>
            </div>

            {/* Topics Completed */}
            <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-line bg-lift/50">
                <label className="block text-sm font-semibold text-ink">Topics Completed</label>
                <p className="text-xs text-clay mt-0.5">What milestones were achieved?</p>
              </div>
              <div className="p-2">
                <textarea 
                  className="w-full p-2 bg-transparent border-0 focus:ring-0 text-sm text-ink placeholder:text-clay/50 resize-y min-h-[100px]" 
                  value={data.topics_completed}
                  onChange={e => onChange({...data, topics_completed: e.target.value})}
                  placeholder="e.g. Mastered useState and forms..."
                  disabled={isCompleted}
                />
              </div>
            </div>

            {/* Learning Notes */}
            <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-line bg-lift/50">
                <label className="block text-sm font-semibold text-ink">My Learning Notes</label>
                <p className="text-xs text-clay mt-0.5">Private notes for yourself</p>
              </div>
              <div className="p-2">
                <textarea 
                  className="w-full p-2 bg-transparent border-0 focus:ring-0 text-sm text-ink placeholder:text-clay/50 resize-y min-h-[160px]" 
                  value={data.learning_notes}
                  onChange={e => onChange({...data, learning_notes: e.target.value})}
                  placeholder="Write down any takeaways, links, or follow-up tasks..."
                  disabled={isCompleted}
                />
              </div>
            </div>
          </div>

          {!isCompleted && (
            <div className="mt-8 pt-6 border-t border-line flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="btn-secondary py-2.5 px-5 w-full sm:w-auto flex justify-center"
                >
                  {saving ? "Saving..." : "Save Notes"}
                </button>
                {success && <span className="text-sm font-medium text-brand animate-fade-in">Saved!</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

