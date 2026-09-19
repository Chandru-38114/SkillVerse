import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getSessionUser, getAvatarUrl } from '../api'
import { Trophy, Medal, Star, ClipboardCheck, Award, Users, Flame } from 'lucide-react'

const ACHIEVEMENT_ICONS = {
  first_assessment: <ClipboardCheck className="w-8 h-8" />,
  first_badge: <Award className="w-8 h-8" />,
  first_session: <Users className="w-8 h-8" />,
  five_sessions: <Flame className="w-8 h-8" />,
  first_review: <Star className="w-8 h-8" />,
  points_500: <Trophy className="w-8 h-8" />
}

export default function Gamification() {
  const [leaderboard, setLeaderboard] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showLoading, setShowLoading] = useState(false)
  const currentUser = getSessionUser()

  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) setShowLoading(true);
    }, 150);

    Promise.all([
      api.getLeaderboard().then(data => { if (isMounted) setLeaderboard(data) }),
      api.getGamificationSummary().then(data => { if (isMounted) setSummary(data) })
    ]).finally(() => {
      if (isMounted) {
        clearTimeout(timer);
        setLoading(false);
        setShowLoading(false);
      }
    })

    return () => {
      isMounted = false;
      clearTimeout(timer);
    }
  }, [])

  if (loading) {
    return showLoading ? (
      <div className="max-w-5xl mx-auto px-6 py-12 flex justify-center">
        <div className="skeleton h-32 w-full mb-6"></div><div className="grid md:grid-cols-3 gap-6"><div className="skeleton h-64 w-full"></div><div className="md:col-span-2 skeleton h-96 w-full"></div></div>
      </div>
    ) : null;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-6">
        <Link to="/dashboard" className="text-sm font-semibold text-brand hover:underline flex items-center gap-1">
          ← Back to Skill Journey
        </Link>
      </div>

      <div className="mb-10 text-center relative py-6">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-brandLight/20 rounded-full blur-[80px] pointer-events-none" />
        <div className="w-16 h-16 bg-brand/10 text-brand rounded-2xl mx-auto mb-4 flex items-center justify-center rotate-3 border border-brand/20 shadow-sm relative z-10">
          <Trophy className="w-8 h-8 -rotate-3" />
        </div>
        <h1 className="font-display text-4xl mb-2 flex items-center justify-center gap-2 relative z-10 text-ink tracking-tight drop-shadow-md">
          Skill Journey & Leaderboard
        </h1>
        <p className="text-clay text-lg max-w-2xl mx-auto drop-shadow-sm font-medium relative z-10">
          Compete, earn points, and collect badges by sharing knowledge.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Left Column: Summary & Achievements */}
        <div className="md:col-span-1 space-y-6">
          
          <div className="section-panel p-6 text-center relative overflow-hidden group">
            <div className="absolute right-0 top-0 w-32 h-32 bg-gradient-to-bl from-brand/5 to-transparent rounded-bl-full pointer-events-none" />
            <h2 className="text-sm font-bold text-clay uppercase tracking-wider mb-2 relative z-10">Your Standing</h2>
            <div className="font-display text-5xl text-brand mb-1 relative z-10">{summary?.total_points || 0}</div>
            <div className="text-sm text-clay mb-4 relative z-10">Total Points</div>
            
            {summary?.current_rank && (
              <div className="inline-block bg-brand/10 text-brand px-4 py-1.5 rounded-full text-sm font-bold mb-4 border border-brand/20 shadow-sm relative z-10">
                Rank #{summary.current_rank}
              </div>
            )}

            {summary?.next_milestone_points && (
              <div className="text-left mt-4 border-t border-line/10 pt-4 relative z-10">
                <p className="text-xs font-bold text-clay mb-1">Next Milestone: {summary.next_milestone_title}</p>
                <div className="w-full bg-lift/80 h-2 rounded-full overflow-hidden mb-1 shadow-inner">
                  <div 
                    className="bg-brand h-full rounded-full transition-all duration-1000 ease-out" 
                    style={{ width: `${Math.min(100, ((summary?.total_points || 0) / summary.next_milestone_points) * 100)}%` }} 
                  />
                </div>
                <p className="text-xs text-right text-clay font-medium">{summary?.total_points} / {summary.next_milestone_points} <span className="uppercase text-[10px]">XP</span></p>
              </div>
            )}
          </div>

          <div className="section-panel p-6">
            <h2 className="font-display text-xl mb-6 text-ink flex items-center gap-2">
              <Award className="w-5 h-5 text-brand" /> Achievements
            </h2>
            <div className="space-y-4">
              {summary?.achievements.map(ach => (
                <div key={ach.id} className={`flex gap-4 p-3 rounded-2xl border transition-all ${ach.earned ? 'bg-white/40 border-white/60 shadow-sm' : 'bg-transparent border-transparent opacity-50 grayscale'}`}>
                  <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${ach.earned ? 'bg-brand/10 text-brand' : 'bg-lift text-clay'}`}>
                    {ACHIEVEMENT_ICONS[ach.id] || <Award className="w-6 h-6" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-sm text-ink mb-0.5">{ach.title}</h3>
                    <p className="text-xs text-clay leading-snug font-medium">{ach.description}</p>
                    {ach.earned && ach.earned_at && (
                      <p className="text-[10px] text-clay/70 mt-1 uppercase font-bold tracking-wider">Earned {new Date(ach.earned_at).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Leaderboard */}
        <div className="md:col-span-2">
          <div className="section-panel p-0 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-line/10 bg-lift/40 flex justify-between items-center relative z-10">
              <h2 className="font-display text-xl text-ink flex items-center gap-2">
                <Users className="w-5 h-5 text-brand" /> Top Learners & Tutors
              </h2>
              <span className="text-xs font-bold text-brand bg-brand/10 px-3 py-1 rounded-full shadow-sm">{leaderboard.length} users</span>
            </div>
            
            <div className="divide-y divide-line/10 max-h-[600px] overflow-y-auto bg-transparent relative z-10">
              {leaderboard.map((user, idx) => {
                const isCurrentUser = user.user_id === currentUser?.id;
                
                // Medals for top 3
                let rankBadge = <span className="font-bold text-clay w-6 text-center text-sm">{user.rank}</span>;
                if (user.rank === 1) rankBadge = <Medal className="w-6 h-6 text-brand" title="1st Place" />;
                if (user.rank === 2) rankBadge = <Medal className="w-6 h-6 text-brand/60" title="2nd Place" />;
                if (user.rank === 3) rankBadge = <Medal className="w-6 h-6 text-brand/30" title="3rd Place" />;

                return (
                  <div 
                    key={user.user_id} 
                    className={`flex items-center justify-between p-4 hover:bg-white/60 transition-colors ${isCurrentUser ? 'bg-brand/5 border-l-[3px] border-l-brand' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      {rankBadge}
                      <div className="flex items-center gap-4">
                        {user.profile_picture_url ? (
                          <img src={getAvatarUrl(user.profile_picture_url)} alt={user.name} className="w-10 h-10 rounded-full object-cover shadow-sm ring-2 ring-white" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-lift flex items-center justify-center font-bold text-clay shadow-sm ring-2 ring-white">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className={`font-bold text-sm ${isCurrentUser ? 'text-brand' : 'text-ink'}`}>
                            {user.name} {isCurrentUser && <span className="text-[10px] font-bold tracking-wider bg-brand text-white px-2 py-0.5 rounded-full ml-2 align-middle uppercase">You</span>}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="font-display text-xl text-ink font-bold">
                      {user.points} <span className="text-xs font-sans text-clay uppercase">XP</span>
                    </div>
                  </div>
                )
              })}
              
              {leaderboard.length === 0 && (
                <div className="p-8 text-center text-ink/40">
                  No users on the leaderboard yet.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
