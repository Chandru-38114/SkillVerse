import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle, ArrowRight, Award, History, TrendingUp, Clock, BookOpen } from "lucide-react";
import { api } from "../api";

function getSkillNarrative(skill) {
  if (skill.progress_percentage === 100 && skill.badge) {
    return "This skill has reached its current milestone.";
  }
  if (skill.progress_percentage >= 80) {
    return "You're getting close to your next skill milestone.";
  }
  if (skill.sessions_completed > 0) {
    return "You've already started building momentum through your sessions.";
  }
  if (skill.progress_percentage < 40) {
    return "Keep building the fundamentals through practice and sessions.";
  }
  return "Keep learning and practicing to grow this skill.";
}

export default function Progress() {
  const [progressData, setProgressData] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) setShowLoading(true);
    }, 150);

    async function loadData() {
      try {
        const pData = await api.getMyProgress();
        const hData = await api.getProgressHistory();
        const cData = await api.getMyCertificates();
        if (isMounted) {
          setProgressData(pData || []);
          setHistoryData(hData || []);
          setCertificates(cData || []);
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) {
          clearTimeout(timer);
          setLoading(false);
          setShowLoading(false);
        }
      }
    }
    loadData();
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const handleGenerateCertificate = async (skillName) => {
    try {
      setGenerating(true);
      const newCert = await api.generateCertificate(skillName);
      setCertificates([...certificates, newCert]);
      // Remove alert for smoother UX, rely on navigation
      navigate(`/certificate/${newCert.certificate_id}`);
    } catch (err) {
      alert("Failed to generate certificate: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return showLoading ? <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12"><div className="skeleton h-32 w-full mb-6"></div><div className="grid md:grid-cols-2 gap-6"><div className="skeleton h-64 w-full"></div></div></div> : null;
  }
  if (error) return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12"><div className="alert-error">{error}</div></div>;

  const totalSessions = progressData.reduce((sum, skill) => sum + (skill.sessions_completed || 0), 0);
  const totalLearningMinutes = progressData.reduce((sum, skill) => sum + (skill.total_learning_minutes || 0), 0);
  
  const isEmptyState = progressData.length === 0;

  return (
    <div className="page pb-12">
      <div className="mb-6">
        <Link to="/dashboard" className="text-sm font-semibold text-brand hover:underline flex items-center gap-1">
          ← Back to Skill Journey
        </Link>
      </div>
      
      {/* B1: Page Header */}
      <div className="mb-8 max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-bold text-ink mb-2">My Progress</h1>
        <p className="text-clay font-medium text-lg mb-5">Track how your skills are growing.</p>
        
        {!isEmptyState && (
          <div className="flex flex-wrap gap-5 bg-brand/5 border border-brand/10 p-4 rounded-2xl shadow-sm">
            <div>
              <p className="text-xs font-bold text-brand uppercase tracking-wider mb-1">Active Skills</p>
              <p className="text-2xl font-bold text-ink">{progressData.length}</p>
            </div>
            <div className="w-px bg-brand/20"></div>
            <div>
              <p className="text-xs font-bold text-brand uppercase tracking-wider mb-1">Sessions Completed</p>
              <p className="text-2xl font-bold text-ink">{totalSessions}</p>
            </div>
            <div className="w-px bg-brand/20"></div>
            <div>
              <p className="text-xs font-bold text-brand uppercase tracking-wider mb-1">Learning Time</p>
              <p className="text-2xl font-bold text-ink">{Math.floor(totalLearningMinutes / 60)}h {totalLearningMinutes % 60}m</p>
            </div>
          </div>
        )}
      </div>

      {isEmptyState ? (
        /* B7: Empty State */
        <div className="card p-8 sm:p-12 text-center bg-brand/5 border border-brand/20 shadow-sm max-w-4xl">
          <h2 className="text-2xl font-bold text-ink mb-3">YOUR SKILL JOURNEY IS WAITING</h2>
          <p className="text-clay mb-6 max-w-md mx-auto">Assess a skill, connect with another learner, and start building progress.</p>
          <Link to="/assessment" className="btn-primary inline-flex text-base py-3 px-8 shadow-sm">
            Assess a skill
          </Link>
        </div>
      ) : (
        <div className="max-w-4xl space-y-8">
          
          {/* B2: Skill Progress */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {progressData.map((skill) => {
              const certForSkill = certificates.find(c => c.skill_name === skill.skill_name && c.badge === skill.badge);
              const isEligible = skill.progress_percentage >= 100 && skill.badge && skill.level !== "Unassessed";
              const narrative = getSkillNarrative(skill);
              
              return (
                <div key={skill.id} className="card p-5 flex flex-col justify-between shadow-sm border border-line hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-[10px] font-bold text-brand uppercase tracking-wider mb-0.5">{skill.role === "learning" ? "Learning" : "Teaching"}</p>
                        <h2 className="text-xl font-bold text-ink leading-tight">{skill.skill_name}</h2>
                      </div>
                      <span className="text-sm font-bold text-brand bg-brand/10 px-2.5 py-1.5 rounded-md">
                        {skill.progress_percentage}%
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-sm text-clay font-medium capitalize">{skill.level}</span>
                      {skill.badge && (
                        <span className="inline-flex items-center gap-1 bg-goldLight text-gold px-1.5 py-0.5 rounded text-[10px] font-bold border border-gold/20">
                          <Award className="w-3 h-3" /> {skill.badge}
                        </span>
                      )}
                    </div>
                    
                    <div className="w-full bg-line/50 rounded-full h-2 mb-4 overflow-hidden">
                      <div 
                        className="bg-brand h-full rounded-full transition-all duration-700 ease-out" 
                        style={{ width: `${Math.min(100, skill.progress_percentage)}%` }}
                      ></div>
                    </div>

                    {/* B3: Narrative Progress */}
                    <p className="text-sm font-medium text-ink/80 mb-5 min-h-[40px]">{narrative}</p>

                    <div className="flex justify-between text-xs text-clay font-medium mb-6 pt-4 border-t border-line/40">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-brand/70" /> {skill.sessions_completed || 0} sessions
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-brand/70" /> {Math.floor(skill.total_learning_minutes / 60)}h {skill.total_learning_minutes % 60}m
                      </div>
                    </div>
                  </div>

                  {/* B4 & B6: Next Action / Certificate */}
                  <div className="pt-2">
                    {certForSkill ? (
                      <Link 
                        to={`/certificate/${certForSkill.certificate_id}`}
                        className="btn-secondary w-full justify-center flex items-center gap-2"
                      >
                        <Award className="w-4 h-4" /> View Certificate
                      </Link>
                    ) : isEligible ? (
                      <button 
                        onClick={() => handleGenerateCertificate(skill.skill_name)}
                        disabled={generating}
                        className="btn-brand w-full justify-center shadow-sm"
                      >
                        {generating ? "Generating..." : "Generate Certificate"}
                      </button>
                    ) : skill.progress_percentage === 0 ? (
                      <Link to="/assessment" className="btn-brand w-full justify-center shadow-sm">
                        Take assessment
                      </Link>
                    ) : (
                      <Link to="/marketplace" className="btn-secondary w-full justify-center bg-surface border-brand/30 text-brand hover:bg-brand/5">
                        Continue learning
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* B5: Learning History */}
          <div className="pt-6">
            <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-brand" /> Learning History
            </h2>
            
            <div className="bg-surface rounded-2xl shadow-sm border border-line overflow-hidden">
              {historyData.map((hist, index) => (
                <div key={hist.id} className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${index !== historyData.length - 1 ? 'border-b border-line' : ''}`}>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="font-bold text-ink text-base">{hist.session?.skill || "Skill"}</span>
                      <span className="bg-line/50 text-clay text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">Session Completed</span>
                      <span className="text-xs text-clay font-medium">{new Date(hist.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <p className="text-sm font-medium text-ink/80 mb-1">
                      Topics: <span className="font-normal text-clay">{hist.topics_completed || hist.topics_discussed || "General Practice"}</span>
                    </p>
                  </div>
                  <div className="md:text-right flex items-center md:flex-col justify-between md:justify-center bg-brand/5 md:bg-transparent p-3 md:p-0 rounded-lg md:rounded-none">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-brand">
                      <TrendingUp className="w-4 h-4" /> 
                      +{hist.progress_percentage_after - hist.progress_percentage_before}%
                    </div>
                    <p className="text-xs font-medium text-clay mt-1">
                      {hist.progress_percentage_before}% → {hist.progress_percentage_after}%
                    </p>
                  </div>
                </div>
              ))}
              {historyData.length === 0 && (
                <div className="p-8 text-center">
                  <p className="text-clay font-medium">No completed sessions in your history.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
