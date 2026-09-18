import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Settings, MapPin, Building, Trophy, Star, CheckCircle, ArrowRight } from "lucide-react";
import { api } from "../api";
import Avatar from "../components/ui/Avatar";

function SkillBadge({ badge }) {
  if (!badge) return null;
  return (
    <span className="inline-flex items-center gap-1.5 bg-goldLight text-gold px-2 py-1 rounded-md text-[10px] font-bold border border-gold/20 shadow-sm">
      <CheckCircle className="w-3.5 h-3.5 text-brand" /> Verified
    </span>
  );
}

export default function Profile() {
  const [user, setUser] = useState(null);
  const [skills, setSkills] = useState([]);
  const [gamification, setGamification] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [u, s, g] = await Promise.all([
          api.me(),
          api.mySkills().catch(() => []),
          api.getGamificationSummary().catch(() => null)
        ]);
        setUser(u);
        setSkills(s || []);
        setGamification(g);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return (
    <div className="page-narrow pb-20 flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
  
  if (!user) return <div className="page-narrow pb-20 text-center text-clay mt-12">Failed to load profile data</div>;

  const learningSkills = skills.filter(s => s.role === 'learning');
  const teachingSkills = skills.filter(s => s.role === 'teaching');

  return (
    <div className="page-narrow pb-20 space-y-8">
      
      {/* Header Actions */}
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold font-display text-ink">My Profile</h1>
        <Link to="/settings" className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Settings
        </Link>
      </div>

      {/* Identity Card */}
      <section className="card p-6 md:p-10 border border-line bg-surface shadow-sm text-center sm:text-left flex flex-col sm:flex-row items-center sm:items-start gap-8">
        <Avatar url={user.profile_picture_url} name={user.name} size="xl" className="shadow-md" />
        
        <div className="flex-1 space-y-3 w-full">
          <div>
            <h2 className="text-3xl font-display font-bold text-ink">{user.name}</h2>
            
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-2 text-sm text-clay font-medium">
              {user.college && (
                <span className="flex items-center gap-1.5">
                  <Building className="w-4 h-4" /> {user.college}
                </span>
              )}
              {user.country && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" /> {user.country}
                </span>
              )}
            </div>
          </div>
          
          {user.bio ? (
            <p className="text-ink/80 text-sm leading-relaxed max-w-2xl mt-4">
              {user.bio}
            </p>
          ) : (
            <p className="text-clay/60 text-sm italic mt-4">No bio provided. Add one in Settings to tell others what you're learning and teaching.</p>
          )}
        </div>
      </section>

      {/* Grid: Growth & Skills */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Left Column (Growth) */}
        <div className="md:col-span-5 space-y-8">
          <section className="card p-6 border border-line bg-surface shadow-sm">
            <h3 className="text-xs font-bold text-clay uppercase tracking-wider mb-6 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-gold" /> Growth & Points
            </h3>
            
            <div className="flex flex-col items-center text-center">
              <p className="text-5xl text-ink font-bold mb-1">{gamification?.total_points || user.points || 0}</p>
              <p className="text-xs font-bold text-gold uppercase tracking-wider mb-6">Total Points</p>
              
              <div className="w-full text-left">
                <p className="text-[10px] font-bold text-gold uppercase tracking-wider mb-1">Next Milestone</p>
                <div className="flex justify-between items-end mb-2">
                  <h4 className="font-bold text-ink">{gamification?.next_milestone_title || "Level Up"}</h4>
                  <p className="text-xs text-ink/50 font-semibold">{gamification?.total_points || user.points || 0} / {gamification?.next_milestone_points || 500}</p>
                </div>
                <div className="w-full bg-line/40 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-gold h-full rounded-full transition-all duration-700 ease-out" 
                    style={{ width: `${Math.min(100, (((gamification?.total_points || user.points || 0) / (gamification?.next_milestone_points || 500)) * 100))}%` }} 
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column (Skills) */}
        <div className="md:col-span-7 space-y-8">
          
          <section>
            <h3 className="text-xs font-bold text-clay uppercase tracking-wider mb-4 px-1">Learning Skills</h3>
            {learningSkills.length > 0 ? (
              <div className="space-y-4">
                {learningSkills.map(s => (
                  <div key={s.id} className="card p-5 border border-line bg-surface shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-ink text-base">{s.skill_name}</h4>
                        <p className="text-xs text-clay font-medium capitalize mt-0.5">{s.level} {s.badge && '• Verified'}</p>
                      </div>
                      <span className="text-xs font-bold text-brand bg-brand/10 px-2 py-1 rounded-md">
                        {s.progress_percentage || 0}%
                      </span>
                    </div>
                    <div className="w-full bg-line/50 rounded-full h-1 overflow-hidden">
                      <div className="bg-brand h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${s.progress_percentage || 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card p-6 border border-line border-dashed text-center bg-surface">
                <p className="text-sm text-clay mb-2">You aren't tracking any learning skills yet.</p>
                <Link to="/marketplace" className="text-xs font-semibold text-brand hover:underline">Find a partner to start learning</Link>
              </div>
            )}
          </section>

          <section>
            <h3 className="text-xs font-bold text-clay uppercase tracking-wider mb-4 px-1">Teaching Skills</h3>
            {teachingSkills.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {teachingSkills.map(s => (
                  <div key={s.id} className="bg-surface border border-line px-5 py-3 rounded-xl flex items-center gap-3 shadow-sm">
                    <span className="font-semibold text-sm text-ink">{s.skill_name}</span>
                    {s.badge && <SkillBadge badge={s.badge} />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="card p-6 border border-line border-dashed text-center bg-surface">
                <p className="text-sm text-clay">You haven't added any teaching skills yet.</p>
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
