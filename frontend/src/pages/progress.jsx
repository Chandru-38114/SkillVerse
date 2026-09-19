import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle, ArrowRight, Award, History, TrendingUp, Clock, BookOpen } from "lucide-react";
import { api } from "../api";

const getStageProgressWidth = (stage) => {
  switch (stage) {
    case "Discovered": return "10%";
    case "Baseline Established": return "25%";
    case "Practicing": return "50%";
    case "Developing": return "75%";
    case "Mastery": return "100%";
    default: return "0%";
  }
};

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
    <div className="page pb-12 animate-fade-in stagger-1">
      <div className="mb-6">
        <Link to="/dashboard" className="text-sm font-semibold text-brand hover:underline flex items-center gap-1">
          ← Back to Skill Journey
        </Link>
      </div>
      
      {isEmptyState ? (
        /* B7: Empty State */
        <div className="card p-8 sm:p-12 text-center bg-brand/5 border border-brand/20 shadow-sm max-w-4xl mx-auto animate-slide-up stagger-2">
          <div className="w-16 h-16 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-4">
            <Compass className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-ink mb-3">YOUR SKILL JOURNEY IS WAITING</h2>
          <p className="text-clay mb-6 max-w-md mx-auto">Assess a skill, connect with another learner, and start building progress.</p>
          <Link to="/assessment" className="btn-primary inline-flex text-base py-3 px-8 shadow-sm">
            Assess a skill
          </Link>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto lg:grid lg:grid-cols-3 lg:gap-8 lg:items-start space-y-8 lg:space-y-0">
          
          <div className="lg:col-span-2 space-y-8">
            {/* B1: Page Header */}
            <div className="animate-slide-up stagger-2">
              <h1 className="text-3xl md:text-4xl font-bold text-ink mb-2">My Progress</h1>
              <p className="text-clay font-medium text-lg mb-5">Track how your skills are growing.</p>
              
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
            </div>

            {/* B2: Skill Progress */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {progressData.map((skill, idx) => {
                const certForSkill = certificates.find(c => c.skill_name === skill.skill_name && c.badge === skill.badge);
                const isEligible = skill.stage === "Mastery" || skill.stage === "Developing";
                const whatHappened = skill.what_happened || "";
                const nextMilestone = skill.next_milestone || "Keep learning and practicing to grow this skill.";
                const staggerClass = `stagger-${Math.min(idx + 3, 5)}`;
                
                return (
                  <div key={skill.id} className={`card-hover p-5 flex flex-col justify-between shadow-sm animate-slide-up ${staggerClass}`}>
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-[10px] font-bold text-brand uppercase tracking-wider mb-0.5">{skill.role === "learning" ? "Learning" : "Teaching"}</p>
                          <h2 className="text-xl font-bold text-ink leading-tight">{skill.skill_name}</h2>
                        </div>
                        <span className="text-sm font-bold text-brand bg-brand/10 px-2.5 py-1.5 rounded-md">
                          {skill.stage}
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
                      
                      {/* Visual Progress Line */}
                      <div className="w-full bg-brand/10 h-1.5 rounded-full overflow-hidden mb-5">
                        <div 
                          className="bg-brand h-full rounded-full transition-all duration-1000 ease-out" 
                          style={{ width: getStageProgressWidth(skill.stage) }}
                        ></div>
                      </div>

                      {/* B3: Narrative Progress */}
                      <div className="mb-5 min-h-[60px]">
                        <p className="text-sm font-medium text-ink/90 mb-1">{whatHappened}</p>
                        <p className="text-xs font-semibold text-brand2/90">{nextMilestone}</p>
                      </div>

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
          </div>

          <div className="lg:col-span-1 space-y-8">
            {/* B5: Learning History */}
            <div>
              <h2 className="text-xl font-bold text-ink mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-brand" /> Learning History
              </h2>
              
              <div className="bg-surface rounded-2xl shadow-sm border border-line overflow-hidden">
                {historyData.map((hist, index) => (
                  <div key={hist.id} className={`p-4 flex flex-col gap-3 ${index !== historyData.length - 1 ? 'border-b border-line' : ''}`}>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="font-bold text-ink text-base line-clamp-1">{hist.session?.skill || "Skill"}</span>
                        <span className="bg-line/50 text-clay text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">Completed</span>
                      </div>
                      <p className="text-xs text-clay font-medium mb-2">{new Date(hist.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      <p className="text-sm font-medium text-ink/80 mb-1 line-clamp-2">
                        Topics: <span className="font-normal text-clay">{hist.topics_completed || hist.topics_discussed || "General Practice"}</span>
                      </p>
                    </div>
                    {hist.semantic_summary && (
                      <div className="bg-paper/50 p-2.5 rounded border border-line text-xs font-medium text-ink/80 leading-relaxed mb-1">
                        <span className="font-bold text-clay block mb-0.5">What You Worked On</span>
                        {hist.semantic_summary}
                      </div>
                    )}
                    <div className="flex items-center justify-between bg-brand/5 p-3 rounded-lg border border-brand/10">
                      <div className="flex items-center gap-1.5 text-sm font-bold text-brand">
                        <TrendingUp className="w-4 h-4" /> 
                        +{hist.progress_percentage_after - hist.progress_percentage_before}%
                      </div>
                      <p className="text-xs font-medium text-clay">
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

        </div>
      )}
    </div>
  );
}
