import React, { useState, useEffect } from "react";
import { api, getSessionUser } from "../api";
import { ChevronLeft, CheckCircle2 } from "lucide-react";


export default function Notes({ session, onBack }) {
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
  const [isCompleted, setIsCompleted] = useState(session?.status === 'completed');

  const sessionId = session?.id;
  const user = getSessionUser();
  const isTutor = user?.id === session?.tutor_id;

  useEffect(() => {
    if (!sessionId) return;
    
    api.getSessionProgress(sessionId)
      .then(res => {
        setData({
          topics_discussed: res.topics_discussed || "",
          topics_completed: res.topics_completed || "",
          learning_notes: res.learning_notes || ""
        });
        if (res.duration_minutes > 0 || session?.status === 'completed') {
          setIsCompleted(true);
        }
      })
      .catch(err => {
        if (err.message.includes("404") || err.message.includes("not found")) {
          // OK
        } else {
          setError(err.message);
        }
      })
      .finally(() => setLoading(false));
  }, [sessionId, session]);

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
      await api.saveSessionNotes(sessionId, data);
      const res = await api.completeSessionProgress(sessionId);
      setIsCompleted(true);
      alert(`Session completed successfully! New progress: ${res.progress_percentage}%`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return <div className="p-8 flex items-center justify-center text-clay">Loading notes...</div>;
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-paper w-full">
      {/* Header with Back Button */}
      <div className="flex items-center gap-3 p-4 sm:p-6 border-b border-line bg-surface sticky top-0 z-10">
        {onBack && (
          <button 
            onClick={onBack} 
            className="p-2 -ml-2 rounded-lg hover:bg-lift text-clay hover:text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-brand/50"
            aria-label="Back to Session Room"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-ink truncate">
            Session Notes
          </h2>
          {session && (
            <p className="text-xs text-clay truncate mt-0.5">
              {isTutor ? 'Teaching' : 'Learning'} {session.skill_name || session.skill}
            </p>
          )}
        </div>
        {isCompleted && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-brand/10 text-brand rounded-full text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed</span>
          </div>
        )}
      </div>

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
                  onChange={e => setData({...data, topics_discussed: e.target.value})}
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
                  onChange={e => setData({...data, topics_completed: e.target.value})}
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
                  onChange={e => setData({...data, learning_notes: e.target.value})}
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
              
              <button 
                onClick={handleComplete} 
                disabled={completing}
                className="btn-primary py-2.5 px-5 w-full sm:w-auto shadow-elev-1 shadow-brand/20 flex justify-center"
              >
                {completing ? "Completing..." : "Complete Session"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

