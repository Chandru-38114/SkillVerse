import { useEffect, useState } from 'react'
import { api, getSessionUser } from '../api'

export default function Gamification() {
  const [leaderboard, setLeaderboard] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const currentUser = getSessionUser()

  useEffect(() => {
    Promise.all([
      api.getLeaderboard().then(setLeaderboard),
      api.getGamificationSummary().then(setSummary)
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12 flex justify-center">
        <div className="w-8 h-8 border-4 border-clay border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-10 text-center">
        <h1 className="font-display text-4xl mb-2">🏆 Leaderboard & Achievements</h1>
        <p className="text-ink/60">Compete, earn points, and collect badges by sharing knowledge.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Left Column: Summary & Achievements */}
        <div className="md:col-span-1 space-y-6">
          
          <div className="card p-6 bg-clay/5 border-clay/20 text-center">
            <h2 className="text-sm font-bold text-ink/50 uppercase tracking-wider mb-2">Your Standing</h2>
            <div className="font-display text-5xl text-clay mb-1">{summary?.total_points || 0}</div>
            <div className="text-sm text-ink/60 mb-4">Total Points</div>
            
            {summary?.current_rank && (
              <div className="inline-block bg-clay text-white px-4 py-1 rounded-full text-sm font-bold mb-4">
                Rank #{summary.current_rank}
              </div>
            )}

            {summary?.next_milestone_points && (
              <div className="text-left mt-4 border-t border-ink/10 pt-4">
                <p className="text-xs font-bold text-ink/60 mb-1">Next Milestone: {summary.next_milestone_title}</p>
                <div className="w-full bg-sand/50 h-2 rounded-full overflow-hidden mb-1">
                  <div 
                    className="bg-clay h-full" 
                    style={{ width: `${Math.min(100, ((summary?.total_points || 0) / summary.next_milestone_points) * 100)}%` }} 
                  />
                </div>
                <p className="text-xs text-right text-ink/40">{summary?.total_points} / {summary.next_milestone_points} pts</p>
              </div>
            )}
          </div>

          <div className="card p-6">
            <h2 className="font-display text-xl mb-4">Achievements</h2>
            <div className="space-y-4">
              {summary?.achievements.map(ach => (
                <div key={ach.id} className={`flex gap-3 ${ach.earned ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                  <div className="text-3xl flex-shrink-0">{ach.icon}</div>
                  <div>
                    <h3 className="font-bold text-sm">{ach.title}</h3>
                    <p className="text-xs text-ink/60 leading-snug">{ach.description}</p>
                    {ach.earned && ach.earned_at && (
                      <p className="text-[10px] text-ink/40 mt-1">Earned on {new Date(ach.earned_at).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Leaderboard */}
        <div className="md:col-span-2">
          <div className="card overflow-hidden">
            <div className="p-6 border-b border-ink/10 bg-sand/30 flex justify-between items-center">
              <h2 className="font-display text-xl">Top Learners & Tutors</h2>
              <span className="text-xs font-bold text-ink/40 bg-white px-2 py-1 rounded shadow-sm">{leaderboard.length} users</span>
            </div>
            
            <div className="divide-y divide-ink/5 max-h-[600px] overflow-y-auto">
              {leaderboard.map((user, idx) => {
                const isCurrentUser = user.user_id === currentUser?.id;
                
                // Medals for top 3
                let rankBadge = <span className="font-bold text-ink/40 w-6 text-center">{user.rank}</span>;
                if (user.rank === 1) rankBadge = <span className="text-xl w-6 text-center" title="1st Place">🥇</span>;
                if (user.rank === 2) rankBadge = <span className="text-xl w-6 text-center" title="2nd Place">🥈</span>;
                if (user.rank === 3) rankBadge = <span className="text-xl w-6 text-center" title="3rd Place">🥉</span>;

                return (
                  <div 
                    key={user.user_id} 
                    className={`flex items-center justify-between p-4 hover:bg-sand/30 transition-colors ${isCurrentUser ? 'bg-clay/5 border-l-4 border-clay' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      {rankBadge}
                      <div className="flex items-center gap-3">
                        {user.profile_picture_url ? (
                          <img src={user.profile_picture_url} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-ink/10" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-sand flex items-center justify-center font-bold text-ink/40 border border-ink/10">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className={`font-bold ${isCurrentUser ? 'text-clay' : ''}`}>
                            {user.name} {isCurrentUser && <span className="text-xs bg-clay text-white px-1.5 py-0.5 rounded ml-1">You</span>}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="font-display text-xl text-ink/80">
                      {user.points} <span className="text-xs font-sans text-ink/40">pts</span>
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
